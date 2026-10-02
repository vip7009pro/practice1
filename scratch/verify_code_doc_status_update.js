/**
 * KIỂM CHỨNG + SỬA cờ trạng thái tài liệu của mã sản phẩm (M100: BANVE / APPSHEET / PDBV).
 *
 * Chế độ:
 *   node scratch/verify_code_doc_status_update.js                → kiểm chứng qua API + TỰ KHÔI PHỤC
 *   node scratch/verify_code_doc_status_update.js --set G_CODE BANVE=Y APPSHEET=Y PDBV=P
 *                                                                → đặt cờ về giá trị chỉ định (sửa dữ liệu)
 *
 * ⚠️ Chế độ verify LUÔN snapshot trước và khôi phục sau (vì `resetbanve` set BANVE='N').
 *    Nếu bị dừng giữa chừng, chạy lại `--set` với giá trị đúng của mã đó.
 */
const http = require("http");
const jwt = require("jsonwebtoken");
const mailRepo = require("../services/mail/mailRepository");

const CTR = "002";
const args = process.argv.slice(2);
const SET_MODE = args[0] === "--set";

const token = jwt.sign(
  {
    payload: JSON.stringify([
      { EMPL_NO: "NHU1903", CTR_CD: CTR, CMS_ID: "CMS0001", JOB_NAME: "Leader", MAINDEPTNAME: "RND", SUBDEPTNAME: "RND" },
    ]),
  },
  "nguyenvanhung",
  { expiresIn: "1h" }
);

/**
 * Gọi command API. `generalQuery` phía FE tự chèn CTR_CD/COMPANY nên script phải tự thêm —
 * thiếu CTR_CD thì SQL chạy với CTR_CD='undefined' ⇒ 0 dòng ⇒ backend trả NG.
 */
const api = (command, DATA = {}) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({
      command,
      DATA: { CTR_CD: CTR, COMPANY: "CMS", ...DATA, token_string: token, secureContext: false },
    });
    const req = http.request(
      {
        host: "127.0.0.1",
        port: Number(process.env.API_PORT || 3007),
        path: "/api",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error("Phản hồi không phải JSON: " + raw.slice(0, 120))); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

const readRow = (gCode) =>
  mailRepo.queryOne(`SELECT G_CODE, BANVE, APPSHEET, PDBV FROM M100 WHERE CTR_CD=@C AND G_CODE=@G`, {
    C: CTR,
    G: gCode,
  });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass += 1; console.log(`  ✔ ${name}`); }
  else { fail += 1; console.log(`  ✘ ${name} ${extra}`); }
};

/** Đặt cờ về giá trị chỉ định — gọi ĐÚNG các command mà FE dùng. */
async function setFlags(gCode, { banve, appsheet, pdbv }) {
  if (pdbv) await api("resetbanve", { G_CODE: gCode, VALUE: pdbv }); // lưu ý: set BANVE='N'
  if (banve) await api("update_banve_value", { G_CODE: gCode, banvevalue: banve });
  if (appsheet) await api("update_appsheet_value", { G_CODE: gCode, appsheetvalue: appsheet });
}

async function main() {
  if (SET_MODE) {
    const gCode = args[1];
    if (!gCode) {
      console.error("Thiếu G_CODE. Ví dụ: --set 7A09174A BANVE=Y APPSHEET=Y PDBV=P");
      process.exit(1);
    }
    const opts = {};
    for (const arg of args.slice(2)) {
      const [key, value] = arg.split("=");
      if (key === "BANVE") opts.banve = value;
      if (key === "APPSHEET") opts.appsheet = value;
      if (key === "PDBV") opts.pdbv = value;
    }
    console.log(`TRƯỚC: ${JSON.stringify(await readRow(gCode))}`);
    await setFlags(gCode, opts);
    console.log(`SAU  : ${JSON.stringify(await readRow(gCode))}`);
    process.exit(0);
  }

  console.log("\n=== KIỂM CHỨNG CẬP NHẬT TRẠNG THÁI TÀI LIỆU (BANVE / APPSHEET) ===\n");

  const target = await mailRepo.queryOne(
    `SELECT TOP 1 G_CODE, BANVE, APPSHEET, PDBV FROM M100
     WHERE CTR_CD = @C AND BANVE = 'Y' AND APPSHEET = 'Y' ORDER BY UPD_DATE DESC`,
    { C: CTR }
  );
  if (!target) {
    console.log("Không tìm được mã nào có BANVE=Y và APPSHEET=Y — bỏ qua kiểm chứng ghi.");
  } else {
    const snapshot = { banve: target.BANVE, appsheet: target.APPSHEET, pdbv: target.PDBV || "P" };
    console.log(`Mã dùng để thử: ${target.G_CODE} — snapshot: ${JSON.stringify(snapshot)}`);
    console.log("(cuối script sẽ ghi lại đúng các giá trị này để KHÔNG đổi dữ liệu)\n");

    console.log("[1] update_banve_value (FE gọi sau khi upload bản vẽ CAD)");
    const r1 = await api("update_banve_value", { G_CODE: target.G_CODE, banvevalue: snapshot.banve });
    check("command chạy được", r1.tk_status === "OK", JSON.stringify(r1).slice(0, 160));

    console.log("[2] update_appsheet_value (FE gọi sau khi upload Appsheet)");
    const r2 = await api("update_appsheet_value", { G_CODE: target.G_CODE, appsheetvalue: snapshot.appsheet });
    check("command chạy được", r2.tk_status === "OK", JSON.stringify(r2).slice(0, 160));

    console.log("[3] resetbanve với payload VALUE (nút Reset Bản vẽ)");
    const r3 = await api("resetbanve", { G_CODE: target.G_CODE, VALUE: snapshot.pdbv });
    check("command chạy được", r3.tk_status === "OK", JSON.stringify(r3).slice(0, 160));

    console.log("\n[4] KHÔI PHỤC nguyên trạng (bắt buộc — resetbanve đã set BANVE='N')");
    await setFlags(target.G_CODE, snapshot);
    const after = await readRow(target.G_CODE);
    console.log(`   Sau khôi phục: ${JSON.stringify(after)}`);
    check(
      "cờ trở về đúng snapshot",
      after.BANVE === snapshot.banve && after.APPSHEET === snapshot.appsheet && after.PDBV === snapshot.pdbv,
      JSON.stringify({ after, snapshot })
    );
  }

  console.log("\n[5] Tên command CŨ (sai chữ hoa/thường) phải bị từ chối");
  const bad = await api("resetBanVe", { G_CODE: "___ZZ_NO_ROW___", BANVE_Y_N: "N" });
  check(
    "resetBanVe (camelCase) ⇒ 'not supported'",
    bad.tk_status === "NG" && /not supported/i.test(String(bad.message || "")),
    JSON.stringify(bad).slice(0, 160)
  );

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Lỗi:", error);
  process.exit(1);
});
