/**
 * Test Phase 4 — Tệp đính kèm: stream, HTTP Range, chính sách inline an toàn, quyền truy cập.
 *
 * Chạy: node scratch/test_mail_files.js
 */
const http = require("http");
const jwt = require("jsonwebtoken");

const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT || 3007);

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
};

function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { ...extraHeaders };
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = http.request({ host: HOST, port: PORT, path, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const api = (command, DATA, token) =>
  request("POST", "/api", { command, DATA: { ...(DATA || {}), token_string: token, secureContext: false } }).then((r) => {
    const text = r.buffer.toString("utf8");
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* bỏ qua */
    }
    return { status: r.status, headers: r.headers, body: text, json };
  });

const tokenFor = (emplNo, ctrCd, cmsId) =>
  jwt.sign({ payload: JSON.stringify([{ EMPL_NO: emplNo, CTR_CD: ctrCd, CMS_ID: cmsId }]) }, "nguyenvanhung", {
    expiresIn: "1h",
  });

/** Body multipart/form-data đơn giản cho 1 file. */
function multipartFile(field, fileName, contentType, content) {
  const boundary = `----erpmail${Date.now()}`;
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${field}"; filename="${fileName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return { boundary, body: Buffer.concat([Buffer.from(head, "utf8"), content, Buffer.from(tail, "utf8")]) };
}

async function main() {
  const token = tokenFor("NHU1903", "002", "CMS0001");
  console.log("\n=== PHASE 4 TEST: tệp đính kèm ===\n");

  console.log("[1] Tìm email có đính kèm");
  const inbox = await api("emailInbox", { folder: "INBOX", limit: 60 }, token);
  const messages = inbox.json?.data?.messages || [];
  let message = null;
  let attachments = [];
  for (const m of messages) {
    if (!m.hasAttachment) continue;
    const detail = await api("emailGet", { ID: m.id }, token);
    const list = detail.json?.data?.attachments || [];
    const normal = list.filter((a) => !a.isInline && a.available);
    if (normal.length > 0) {
      message = m;
      attachments = list;
      break;
    }
  }
  check("tìm được email có đính kèm thường đã READY", !!message, `(${messages.length} email đã quét)`);
  if (!message) return;

  const file = attachments.find((a) => !a.isInline && a.available);
  console.log(`   → email #${message.id}, tệp: ${file.fileName} (${file.contentType})`);

  console.log("[2] GET /mailfile/attachment/:id — tải về");
  const dl = await request("GET", `/mailfile/attachment/${file.id}?token_string=${encodeURIComponent(token)}`);
  check("HTTP 200", dl.status === 200, `(${dl.status})`);
  check("Content-Disposition: attachment", /^attachment;/i.test(String(dl.headers["content-disposition"])), String(dl.headers["content-disposition"]));
  check("Accept-Ranges: bytes", dl.headers["accept-ranges"] === "bytes");
  check("X-Content-Type-Options: nosniff", dl.headers["x-content-type-options"] === "nosniff");
  check("Content-Length khớp số byte nhận được", Number(dl.headers["content-length"]) === dl.buffer.length, `(${dl.headers["content-length"]} vs ${dl.buffer.length})`);

  console.log("[3] Range request (bytes=0-9)");
  const ranged = await request("GET", `/mailfile/attachment/${file.id}?token_string=${encodeURIComponent(token)}`, null, {
    Range: "bytes=0-9",
  });
  check("HTTP 206", ranged.status === 206, `(${ranged.status})`);
  check("Content-Range đúng dạng", /^bytes 0-9\/\d+$/.test(String(ranged.headers["content-range"])), String(ranged.headers["content-range"]));
  check("chỉ nhận đúng 10 byte", ranged.buffer.length === 10, `(${ranged.buffer.length})`);
  check("10 byte đầu trùng với file đầy đủ", ranged.buffer.equals(dl.buffer.subarray(0, 10)));

  console.log("[4] Chính sách inline an toàn");
  for (const att of attachments.filter((a) => a.available)) {
    const inline = await request("GET", `/mailfile/attachment/${att.id}/inline?token_string=${encodeURIComponent(token)}`);
    const disp = String(inline.headers["content-disposition"] || "");
    const type = String(att.contentType || "").toLowerCase();
    const ext = String(att.fileName || "").split(".").pop().toLowerCase();
    const DANGEROUS = ["exe", "bat", "cmd", "ps1", "vbs", "js", "jar", "msi", "scr", "lnk"];
    const safeType = /^image\/(png|jpe?g|gif|webp|bmp|avif|tiff)$/.test(type) || type.startsWith("application/pdf");
    const shouldInline = safeType && !DANGEROUS.includes(ext);
    check(
      `inline ${shouldInline ? "ĐƯỢC" : "BỊ CHẶN"}: ${att.fileName} → ${disp.split(";")[0]}`,
      shouldInline ? /^inline;/i.test(disp) : /^attachment;/i.test(disp)
    );
  }

  console.log("[5] Bảo mật quyền truy cập");
  const otherToken = tokenFor("ZTEST99", "OTHERCTR", "OTHER001");
  const forbidden = await request("GET", `/mailfile/attachment/${file.id}?token_string=${encodeURIComponent(otherToken)}`);
  check("token công ty khác ⇒ 403", forbidden.status === 403, `(${forbidden.status})`);

  const missingToken = await request("GET", `/mailfile/attachment/${file.id}`);
  check("không có token ⇒ 401/403", [401, 403].includes(missingToken.status), `(${missingToken.status})`);

  const notFound = await request("GET", `/mailfile/attachment/99999999?token_string=${encodeURIComponent(token)}`);
  check("ID không tồn tại ⇒ 404", notFound.status === 404, `(${notFound.status})`);

  console.log("[6] Upload outbox — cờ 'dangerous'");
  const danger = multipartFile("uploadedfile", "kiemtra.bat", "application/octet-stream", Buffer.from("@echo off\r\n"));
  const upDanger = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: `/mailfile/outbox?token_string=${encodeURIComponent(token)}`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${danger.boundary}`,
          "Content-Length": danger.body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.write(danger.body);
    req.end();
  });
  let upJson = null;
  try {
    upJson = JSON.parse(upDanger.body);
  } catch {
    /* bỏ qua */
  }
  check("upload OK", upJson?.tk_status === "OK", `status=${upDanger.status} body=${upDanger.body.slice(0, 200)}`);
  check("đánh dấu dangerous=true cho .bat", upJson?.data?.dangerous === true, JSON.stringify(upJson?.data));
  if (upJson?.data?.id) {
    await request("DELETE", `/mailfile/outbox/${upJson.data.id}?token_string=${encodeURIComponent(token)}`);
  }

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
