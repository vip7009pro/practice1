/**
 * DAL cho NHÓM DANH BẠ EMAIL (`ZTB_MAIL_CONTACT_GROUP` + `..._MEMBER`).
 *
 * Mục đích: mỗi nhân viên tự tạo nhóm danh bạ để **gửi nhanh** / **CC nhanh**,
 * và có thể tạo nhóm trực tiếp từ danh sách người nhận / CC của một email.
 *
 * KHÔNG kiểm tra quyền — tầng `mailContactService` mới kiểm. Repository chỉ lo SQL.
 */
const { queryRows, queryOne, withTransaction } = require("./mailRepository");

const GROUP_COLUMNS = `ID, CTR_CD, EMPL_NO, GROUP_NAME, DESCRIPTION, IS_SHARED, MEMBER_COUNT, CREATED_AT, UPDATED_AT`;

/** Nhóm mà người dùng NHÌN THẤY: của chính mình HOẶC nhóm dùng chung cùng công ty. */
async function listGroups({ ctrCd, emplNo }) {
  return queryRows(
    `SELECT ${GROUP_COLUMNS}
     FROM ZTB_MAIL_CONTACT_GROUP
     WHERE CTR_CD = @CTR_CD AND (EMPL_NO = @EMPL_NO OR IS_SHARED = 1)
     ORDER BY GROUP_NAME ASC`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );
}

async function getGroup(id) {
  return queryOne(`SELECT ${GROUP_COLUMNS} FROM ZTB_MAIL_CONTACT_GROUP WHERE ID = @ID`, { ID: id });
}

/** Toàn bộ thành viên của các nhóm đã cho (1 query, tránh N+1). */
async function listMembersByGroupIds(groupIds = []) {
  if (groupIds.length === 0) return [];
  const params = {};
  const keys = groupIds.map((id, index) => {
    params[`G${index}`] = id;
    return `@G${index}`;
  });
  return queryRows(
    `SELECT ID, GROUP_ID, ADDRESS, DISPLAY_NAME, SORT_ORDER
     FROM ZTB_MAIL_CONTACT_GROUP_MEMBER
     WHERE GROUP_ID IN (${keys.join(", ")})
     ORDER BY GROUP_ID ASC, SORT_ORDER ASC, ID ASC`,
    params
  );
}

async function listMembers(groupId) {
  return queryRows(
    `SELECT ID, GROUP_ID, ADDRESS, DISPLAY_NAME, SORT_ORDER
     FROM ZTB_MAIL_CONTACT_GROUP_MEMBER
     WHERE GROUP_ID = @ID
     ORDER BY SORT_ORDER ASC, ID ASC`,
    { ID: groupId }
  );
}

/** Tìm nhóm trùng tên của chính người dùng (để upsert / báo lỗi rõ ràng). */
async function findGroupByName({ ctrCd, emplNo, groupName, excludeId = null }) {
  return queryOne(
    `SELECT ${GROUP_COLUMNS} FROM ZTB_MAIL_CONTACT_GROUP
     WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO AND UPPER(GROUP_NAME) = UPPER(@NAME)
       AND (@EXCLUDE IS NULL OR ID <> @EXCLUDE)`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo, NAME: groupName, EXCLUDE: excludeId }
  );
}

async function insertGroup({ ctrCd, emplNo, groupName, description, isShared }) {
  const rows = await queryRows(
    `INSERT INTO ZTB_MAIL_CONTACT_GROUP (CTR_CD, EMPL_NO, GROUP_NAME, DESCRIPTION, IS_SHARED)
     OUTPUT INSERTED.ID
     VALUES (@CTR_CD, @EMPL_NO, @NAME, @DESC, @SHARED)`,
    {
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
      NAME: groupName,
      DESC: description ?? null,
      SHARED: isShared ? 1 : 0,
    }
  );
  return rows[0]?.ID ?? null;
}

async function updateGroup(id, { groupName, description, isShared }) {
  await queryRows(
    `UPDATE ZTB_MAIL_CONTACT_GROUP
     SET GROUP_NAME = @NAME, DESCRIPTION = @DESC, IS_SHARED = @SHARED, UPDATED_AT = GETDATE()
     WHERE ID = @ID`,
    { ID: id, NAME: groupName, DESC: description ?? null, SHARED: isShared ? 1 : 0 }
  );
}

/** Thay TOÀN BỘ thành viên của nhóm (xoá cũ → thêm mới) trong 1 transaction. */
async function replaceMembers(groupId, members = []) {
  return withTransaction(async (tx) => {
    await tx.query(`DELETE FROM ZTB_MAIL_CONTACT_GROUP_MEMBER WHERE GROUP_ID = @ID`, { ID: groupId });
    let order = 0;
    for (const member of members) {
      order += 1;
      await tx.query(
        `INSERT INTO ZTB_MAIL_CONTACT_GROUP_MEMBER (GROUP_ID, ADDRESS, DISPLAY_NAME, SORT_ORDER)
         VALUES (@GID, @ADDR, @NAME, @ORDER)`,
        { GID: groupId, ADDR: member.address, NAME: member.name ?? null, ORDER: order }
      );
    }
    await tx.query(
      `UPDATE ZTB_MAIL_CONTACT_GROUP SET MEMBER_COUNT = @CNT, UPDATED_AT = GETDATE() WHERE ID = @ID`,
      { ID: groupId, CNT: order }
    );
    return order;
  });
}

/** Xoá nhóm + toàn bộ thành viên (1 transaction). */
async function deleteGroup(groupId) {
  return withTransaction(async (tx) => {
    await tx.query(`DELETE FROM ZTB_MAIL_CONTACT_GROUP_MEMBER WHERE GROUP_ID = @ID`, { ID: groupId });
    await tx.query(`DELETE FROM ZTB_MAIL_CONTACT_GROUP WHERE ID = @ID`, { ID: groupId });
    return true;
  });
}

/**
 * Tăng/giảm `MEMBERS_COUNT` sau khi thêm/bớt thành viên (không cần, đã set trong replaceMembers).
 * Giữ hàm đếm để kiểm tra chéo khi cần.
 */
async function countMembers(groupId) {
  const row = await queryOne(
    `SELECT COUNT(*) AS CNT FROM ZTB_MAIL_CONTACT_GROUP_MEMBER WHERE GROUP_ID = @ID`,
    { ID: groupId }
  );
  return Number(row?.CNT || 0);
}

module.exports = {
  listGroups,
  getGroup,
  listMembers,
  listMembersByGroupIds,
  findGroupByName,
  insertGroup,
  updateGroup,
  replaceMembers,
  deleteGroup,
  countMembers,
};
