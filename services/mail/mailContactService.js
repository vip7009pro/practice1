/**
 * Command handlers DANH BẠ EMAIL — nhóm danh bạ để **gửi nhanh / CC nhanh**.
 *
 *  - `emailContactGroupList`        — danh sách nhóm (kèm thành viên) để tag nhanh khi soạn thư
 *  - `emailContactGroupSave`        — tạo mới / cập nhật nhóm (thành viên có thể lấy từ To/Cc của email)
 *  - `emailContactGroupDelete`      — xoá nhóm của chính mình
 *  - `emailContactGroupFromMessage` — đọc To/Cc/Bcc của 1 email để FE gợi ý tạo nhóm
 *
 * Quyền: mỗi người chỉ thấy & sửa nhóm CỦA MÌNH; nhóm `IS_SHARED = 1` thì cả công ty
 * thấy và tag nhanh được, nhưng chỉ chủ sở hữu (hoặc admin Email) mới sửa/xoá.
 */
const contactRepo = require("./mailContactRepository");
const mailRepo = require("./mailRepository");
const { loadOwnedMessage } = require("./mailService");
const { isMailAdmin } = require("./mailAdminRule");

const MAX_GROUPS = 200;
const MAX_MEMBERS_PER_GROUP = 500;
const MAX_NAME = 200;
const MAX_DESC = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ok(res, data) {
  res.send({ tk_status: "OK", data });
}
function fail(res, message, code) {
  res.send({ tk_status: "NG", code, message });
}

function ctx(req) {
  const p = req.payload_data || {};
  return { ctrCd: p.CTR_CD, emplNo: String(p.EMPL_NO || "").trim().toUpperCase() };
}

/* ------------------------------------------------------------------ */
/* Chuẩn hoá thành viên                                                */
/* ------------------------------------------------------------------ */

/**
 * Tách danh sách địa chỉ từ chuỗi người dùng nhập/dán.
 * Hỗ trợ `,` `;` xuống dòng, tab và cả dạng `Tên <a@b.com>`.
 */
function parseAddressList(raw) {
  return String(raw || "")
    .split(/[,;\r\n\t]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const angle = part.match(/^(.*?)<([^>]+)>$/);
      if (angle) return { address: angle[2].trim(), name: angle[1].trim().replace(/^"|"$/g, "") || null };
      return { address: part, name: null };
    });
}

/**
 * Gộp và khử trùng lặp thành viên từ nhiều nguồn:
 * `MEMBERS` (mảng {ADDRESS,NAME}), `ADDRESSES`/`MEMBERS_TEXT` (chuỗi), `TO`/`CC`/`BCC` (chuỗi).
 * Trả về `{ members, invalid }`.
 */
function collectMembers(DATA = {}) {
  const raw = [];
  if (Array.isArray(DATA.MEMBERS)) {
    for (const item of DATA.MEMBERS) {
      if (typeof item === "string") raw.push({ address: item, name: null });
      else if (item && typeof item === "object") {
        raw.push({
          address: String(item.ADDRESS || item.address || "").trim(),
          name: item.NAME || item.name || null,
        });
      }
    }
  }
  for (const key of ["ADDRESSES", "MEMBERS_TEXT", "TO", "CC", "BCC"]) {
    if (DATA[key]) raw.push(...parseAddressList(DATA[key]));
  }

  const seen = new Set();
  const members = [];
  const invalid = [];
  for (const item of raw) {
    const address = String(item.address || "").trim();
    if (!address) continue;
    if (!EMAIL_RE.test(address)) {
      invalid.push(address);
      continue;
    }
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({ address, name: item.name ? String(item.name).trim().slice(0, 200) : null });
    if (members.length >= MAX_MEMBERS_PER_GROUP) break;
  }
  return { members, invalid };
}

function mapGroup(row) {
  return {
    id: row.ID,
    name: row.GROUP_NAME,
    description: row.DESCRIPTION || null,
    isShared: row.IS_SHARED === true || row.IS_SHARED === 1,
    memberCount: Number(row.MEMBER_COUNT || 0),
    ownerEmplNo: row.EMPL_NO,
    updatedAt: row.UPDATED_AT,
  };
}

/* ------------------------------------------------------------------ */
/* Danh sách nhóm                                                      */
/* ------------------------------------------------------------------ */

exports.emailContactGroupList = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const admin = isMailAdmin(req);
    const rows = await contactRepo.listGroups({ ctrCd, emplNo });

    const withMembers = DATA.WITH_MEMBERS !== false;
    const members = withMembers
      ? await contactRepo.listMembersByGroupIds(rows.slice(0, MAX_GROUPS).map((r) => r.ID))
      : [];
    const byGroup = new Map();
    for (const m of members) {
      const list = byGroup.get(m.GROUP_ID) || [];
      list.push({ address: m.ADDRESS, name: m.DISPLAY_NAME || null });
      byGroup.set(m.GROUP_ID, list);
    }

    let groups = rows.map((row) => {
      const isOwner = String(row.EMPL_NO || "").trim().toUpperCase() === emplNo;
      return {
        ...mapGroup(row),
        isOwner,
        canEdit: isOwner || admin,
        members: byGroup.get(row.ID) || [],
      };
    });

    // Tìm nhanh theo tên nhóm HOẶC theo địa chỉ thành viên.
    const q = String(DATA.Q || "").trim().toLowerCase();
    if (q) {
      groups = groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.description || "").toLowerCase().includes(q) ||
          g.members.some((m) => m.address.toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q))
      );
    }
    groups.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));

    ok(res, { groups, total: groups.length, canShare: true });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Tạo / cập nhật nhóm                                                 */
/* ------------------------------------------------------------------ */

exports.emailContactGroupSave = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const admin = isMailAdmin(req);
    const name = String(DATA.GROUP_NAME || DATA.NAME || "").trim();
    if (!name) return fail(res, "Thiếu tên nhóm danh bạ", "INVALID_NAME");
    if (name.length > MAX_NAME) return fail(res, `Tên nhóm tối đa ${MAX_NAME} ký tự`, "INVALID_NAME");

    const { members, invalid } = collectMembers(DATA);
    if (members.length === 0) {
      return fail(
        res,
        invalid.length > 0
          ? `Không có địa chỉ email hợp lệ (${invalid.slice(0, 3).join(", ")}…)`
          : "Nhóm phải có ít nhất 1 địa chỉ email hợp lệ",
        invalid.length > 0 ? "INVALID_ADDRESS" : "NO_MEMBER"
      );
    }

    const description = DATA.DESCRIPTION ? String(DATA.DESCRIPTION).trim().slice(0, MAX_DESC) : null;
    const isShared = DATA.IS_SHARED === true || DATA.IS_SHARED === 1 || DATA.IS_SHARED === "true";
    const replace = DATA.REPLACE !== false; // mặc định GHI ĐÈ thành viên cũ

    let target = null;
    if (DATA.ID) {
      const id = Number(DATA.ID);
      if (!Number.isInteger(id) || id <= 0) return fail(res, "ID nhóm không hợp lệ", "INVALID");
      target = await contactRepo.getGroup(id);
      if (!target) return fail(res, "Không tìm thấy nhóm danh bạ", "NOT_FOUND");
      const isOwner = String(target.EMPL_NO || "").trim().toUpperCase() === emplNo;
      if (!isOwner && !admin) return fail(res, "Nhóm danh bạ này không phải của bạn", "FORBIDDEN");
    } else {
      const sameName = await contactRepo.findGroupByName({ ctrCd, emplNo, groupName: name });
      if (sameName) target = sameName; // cùng tên ⇒ cập nhật nhóm đó (không tạo trùng)
    }

    if (!target) {
      const existing = await contactRepo.listGroups({ ctrCd, emplNo });
      if (existing.filter((g) => String(g.EMPL_NO).trim().toUpperCase() === emplNo).length >= MAX_GROUPS) {
        return fail(res, `Mỗi người tối đa ${MAX_GROUPS} nhóm danh bạ`, "TOO_MANY_GROUPS");
      }
      const id = await contactRepo.insertGroup({ ctrCd, emplNo, groupName: name, description, isShared });
      const count = await contactRepo.replaceMembers(id, members);
      console.log(`[mail] contact group created id=${id} empl=${emplNo} members=${count}`);
      return ok(res, {
        id,
        name,
        memberCount: count,
        created: true,
        invalidAddresses: invalid,
        message: `Đã tạo nhóm danh bạ "${name}" với ${count} người nhận`,
      });
    }

    // Cập nhật: nhóm đã tồn tại (theo ID hoặc trùng tên) ⇒ ghi đè tên/mô tả/chia sẻ + thành viên.
    await contactRepo.updateGroup(target.ID, {
      groupName: name,
      description,
      isShared: replace ? isShared : isShared || target.IS_SHARED === true || target.IS_SHARED === 1,
    });
    const count = replace
      ? await contactRepo.replaceMembers(target.ID, members)
      : await appendMembers(target.ID, members);
    console.log(`[mail] contact group updated id=${target.ID} empl=${emplNo} members=${count}`);
    ok(res, {
      id: target.ID,
      name,
      memberCount: count,
      created: false,
      invalidAddresses: invalid,
      message: `Đã cập nhật nhóm danh bạ "${name}" (${count} người nhận)`,
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Thêm thành viên vào nhóm mà KHÔNG xoá thành viên cũ (khử trùng theo địa chỉ). */
async function appendMembers(groupId, members) {
  const current = await contactRepo.listMembers(groupId);
  const seen = new Set(current.map((m) => String(m.ADDRESS).toLowerCase()));
  const merged = current.map((m) => ({ address: m.ADDRESS, name: m.DISPLAY_NAME }));
  for (const member of members) {
    const key = member.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ address: member.address, name: member.name });
    if (merged.length >= MAX_MEMBERS_PER_GROUP) break;
  }
  return contactRepo.replaceMembers(groupId, merged);
}

/* ------------------------------------------------------------------ */
/* Xoá nhóm                                                            */
/* ------------------------------------------------------------------ */

exports.emailContactGroupDelete = async (req, res, DATA = {}) => {
  try {
    const { emplNo } = ctx(req);
    const admin = isMailAdmin(req);
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID nhóm danh bạ", "INVALID");

    const group = await contactRepo.getGroup(id);
    if (!group) return fail(res, "Không tìm thấy nhóm danh bạ", "NOT_FOUND");
    const isOwner = String(group.EMPL_NO || "").trim().toUpperCase() === emplNo;
    if (!isOwner && !admin) return fail(res, "Nhóm danh bạ này không phải của bạn", "FORBIDDEN");

    await contactRepo.deleteGroup(id);
    console.log(`[mail] contact group deleted id=${id} by=${emplNo}`);
    ok(res, { id, deleted: true, name: group.GROUP_NAME });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Tạo nhóm TỪ danh sách người nhận / CC của 1 email                   */
/* ------------------------------------------------------------------ */

exports.emailContactGroupFromMessage = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID email", "INVALID");

    const message = await loadOwnedMessage(id, ctrCd, emplNo);
    if (!message) return fail(res, "Không tìm thấy email hoặc bạn không có quyền", "FORBIDDEN");

    const safeJson = (value) => {
      if (!value) return [];
      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const to = safeJson(message.TO_JSON);
    const cc = safeJson(message.CC_JSON);
    const bcc = safeJson(message.BCC_JSON);

    // Địa chỉ của người dùng hiện tại (để loại khỏi gợi ý của chính họ).
    const own = new Set();
    for (const acc of await mailRepo.listAccounts({ ctrCd, emplNo })) {
      own.add(String(acc.EMAIL_ADDRESS || "").toLowerCase());
    }
    const norm = (list) =>
      list
        .map((m) => ({
          address: String(m.address || m.ADDRESS || "").trim(),
          name: (m.name || m.NAME || null) || null,
        }))
        .filter((m) => m.address && EMAIL_RE.test(m.address));

    const toList = norm(to);
    const ccList = norm(cc).filter((m) => !toList.some((t) => t.address.toLowerCase() === m.address.toLowerCase()));
    const bccList = norm(bcc);

    const receivers = [...toList, ...ccList].filter((m) => !own.has(m.address.toLowerCase()));

    ok(res, {
      messageId: message.MESSAGE_ID || null,
      subject: message.SUBJECT || null,
      receivedAt: message.RECEIVED_AT || null,
      from: { address: message.FROM_ADDRESS, name: message.FROM_NAME },
      to: toList,
      cc: ccList,
      bcc: bccList,
      /** Gợi ý sẵn: To + Cc (đã bỏ chính mình) — dùng trực tiếp để tạo nhóm. */
      suggestedMembers: receivers,
      suggestedName: buildSuggestedName(message.SUBJECT),
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Gợi ý tên nhóm từ tiêu đề email (bỏ Re:/Fwd:, cắt ngắn). */
function buildSuggestedName(subject) {
  const clean = String(subject || "")
    .replace(/^\s*(re|fwd|fw|tr)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}
