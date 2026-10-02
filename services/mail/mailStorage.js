/**
 * Lưu trữ file cho module Email — body HTML + attachment trên NAS/ổ đĩa.
 *
 * Layout:
 *   <MAIL_STORAGE_PATH>/<CTR_CD>/<yyyy>/<mm>/<mailbox>/<msgRef>/body.html
 *   <MAIL_STORAGE_PATH>/_files/<ab>/<sha256>.<ext>          (kho vật lý, dedup theo hash)
 *
 * Nguyên tắc:
 *  - Ghi ATOMIC: ghi file tạm rồi rename (tránh file dở khi worker crash).
 *  - Dedup: attachment lưu theo SHA-256; nhiều email trỏ cùng 1 file vật lý.
 *  - Chặn path traversal: mọi thao tác đọc/ghi phải nằm trong root.
 *  - Chọn thư mục GHI ĐƯỢC, có phương án dự phòng (an toàn với bản build pkg).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

let cachedRoot = null;

/** Làm sạch 1 phân đoạn đường dẫn (chống `..`, ký tự lạ). */
function safeSegment(value, fallback = "x") {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || fallback;
}

/**
 * Chọn thư mục gốc GHI ĐƯỢC.
 * Thứ tự: `MAIL_STORAGE_PATH` → `outbinary/mailstore` cạnh tiến trình → thư mục tạm HĐH.
 */
function resolveMailRoot() {
  if (cachedRoot) return cachedRoot;
  const candidates = [
    process.env.MAIL_STORAGE_PATH,
    path.join(process.cwd(), "outbinary", "mailstore"),
    path.join(__dirname, "..", "..", "outbinary", "mailstore"),
    path.join(os.tmpdir(), "erp-mail-store"),
  ].filter(Boolean);

  let lastError = null;
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      cachedRoot = path.resolve(dir);
      return cachedRoot;
    } catch (error) {
      lastError = error;
      console.warn(`[mailstorage] Không dùng được thư mục "${dir}": ${error?.message || error}`);
    }
  }
  throw lastError || new Error("Không tìm được thư mục lưu trữ email");
}

/** Đảm bảo đường dẫn tuyệt đối nằm trong root (chống traversal). */
function assertInsideRoot(absPath) {
  const root = resolveMailRoot();
  const resolved = path.resolve(absPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Đường dẫn nằm ngoài kho lưu trữ email");
  }
  return resolved;
}

/** Ghi buffer/string atomic (temp → rename). Tạo thư mục cha nếu cần. */
function writeAtomic(absPath, data) {
  const target = assertInsideRoot(absPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
  return target;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Thư mục chứa 1 email: <root>/<ctr>/<yyyy>/<mm>/<mailbox>/<msgRef>/. */
function buildMessageDir({ ctrCd, sentAt, mailboxKey, messageRef }) {
  const root = resolveMailRoot();
  const d = sentAt instanceof Date && !Number.isNaN(sentAt.getTime()) ? sentAt : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return path.join(
    root,
    safeSegment(ctrCd, "CTR"),
    yyyy,
    mm,
    safeSegment(mailboxKey, "mailbox"),
    safeSegment(messageRef, "msg")
  );
}

/**
 * Ghi body HTML vào thư mục email. Trả về đường dẫn tuyệt đối.
 * Ghi atomic + trả path tương đối gọn (vẫn tuyệt đối) để lưu DB.
 */
function writeBody(bodyContent, messageDir) {
  return writeAtomic(path.join(messageDir, "body.html"), bodyContent);
}

/**
 * Ghi 1 file đính kèm vào kho vật lý theo SHA-256 (dedup).
 * @param {Buffer} buffer
 * @param {string} [ext] đuôi gồm dấu chấm, ví dụ ".pdf"
 * @returns {{hash:string, storagePath:string, size:number, existed:boolean}}
 */
function writePhysicalFile(buffer, ext = "") {
  const root = resolveMailRoot();
  const hash = sha256(buffer);
  const safeExt = /^\.[A-Za-z0-9]{1,12}$/.test(String(ext || "")) ? String(ext).toLowerCase() : "";
  const sub = path.join(root, "_files", hash.slice(0, 2));
  const target = assertInsideRoot(path.join(sub, `${hash}${safeExt}`));
  const existed = fs.existsSync(target);
  if (!existed) writeAtomic(target, buffer);
  return { hash, storagePath: target, size: buffer.length, existed };
}

/**
 * Mở read stream cho file trong kho (đã kiểm tra nằm trong root + tồn tại).
 * @param {string} absPath
 * @param {{start?:number,end?:number}} [range] đọc 1 phần (HTTP Range) để không kéo cả file lớn vào RAM.
 */
function openReadStream(absPath, range) {
  const target = assertInsideRoot(absPath);
  if (!fs.existsSync(target)) {
    const err = new Error("File không tồn tại trong kho lưu trữ");
    err.code = "ENOENT";
    throw err;
  }
  const size = fs.statSync(target).size;
  const start = Number(range?.start);
  const end = Number(range?.end);
  const useRange = Number.isInteger(start) && start >= 0 && Number.isInteger(end) && end >= start;
  const stream = useRange
    ? fs.createReadStream(target, { start, end: Math.min(end, Math.max(size - 1, 0)) })
    : fs.createReadStream(target);
  return { stream, size, path: target, range: useRange ? { start, end: Math.min(end, Math.max(size - 1, 0)) } : null };
}

function exists(absPath) {
  try {
    return fs.existsSync(assertInsideRoot(absPath));
  } catch {
    return false;
  }
}

/** Xoá file vật lý (khi REF_COUNT về 0). Bỏ qua nếu không tồn tại. */
function removeFile(absPath) {
  try {
    const target = assertInsideRoot(absPath);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return true;
  } catch (error) {
    console.warn(`[mailstorage] Xoá file lỗi: ${error?.message || error}`);
    return false;
  }
}

/** Reset cache root — dùng cho test khi đổi MAIL_STORAGE_PATH. */
function resetRootCache() {
  cachedRoot = null;
}

module.exports = {
  resolveMailRoot,
  resetRootCache,
  safeSegment,
  assertInsideRoot,
  sha256,
  buildMessageDir,
  writeBody,
  writePhysicalFile,
  openReadStream,
  exists,
  removeFile,
};
