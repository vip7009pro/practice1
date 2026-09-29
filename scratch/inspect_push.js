/**
 * Kiểm tra subscription Web Push: owner nào đã đăng ký, có khớp người nhận không,
 * và thử gửi 1 push giống payload chat để xác minh đường push.
 *
 * Chạy: node scratch/inspect_push.js            (chỉ liệt kê)
 *       node scratch/inspect_push.js --send CMS1179   (gửi push thử tới user đó)
 */
const { openConnection, closePool } = require("../config/database");
const { sendTargetedPushNotification } = require("../services/targetedPushService");
require("../utils/pushUtils").setVapidDetails();

async function main() {
  const pool = await openConnection();
  const rows = (
    await pool.query(
      `SELECT CTR_CD, SUB_STATUS, LEN(SUBSCRIPTION) AS SUB_LEN, SUBSCRIPTION
       FROM ZTB_SUBSCRIPTION_TB`
    )
  ).recordset || [];

  console.log(`Tổng subscription: ${rows.length}`);
  rows.forEach((row, index) => {
    let owner = "(parse-fail)";
    try {
      owner = String(JSON.parse(row.SUBSCRIPTION)?.emplNo || "");
    } catch (error) {
      owner = "(parse-fail)";
    }
    console.log(
      `  [${index}] ctr=${JSON.stringify(row.CTR_CD)} status=${row.SUB_STATUS} len=${row.SUB_LEN} owner=${JSON.stringify(owner)}`
    );
  });

  const sendIndex = process.argv.indexOf("--send");
  if (sendIndex === -1) {
    await closePool();
    return;
  }

  const cmsId = process.argv[sendIndex + 1] || "CMS1179";
  const employee = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID FROM ZTBEMPLINFO WHERE CMS_ID = @CMS_ID`,
      { CMS_ID: cmsId }
    )
  ).recordset[0];
  if (!employee) throw new Error(`Không tìm thấy ${cmsId}`);

  const emplNo = String(employee.EMPL_NO).trim().toUpperCase();
  console.log(`\nGửi push thử tới ${emplNo} (ctr=${employee.CTR_CD}) với payload giống chat...`);

  await sendTargetedPushNotification({
    ctrCd: String(employee.CTR_CD).trim(),
    targetEmplNos: [emplNo],
    title: "Kiểm thử chat nội bộ",
    body: "Nếu bạn thấy thông báo này thì đường push chat hoạt động.",
    url: "/?chat=1",
    data: { type: "CHAT_MESSAGE", conversationId: "1", senderEmplNo: "TEST" },
  });

  console.log("Đã gọi gửi push (xem cảnh báo 'Không gửi được targeted push' nếu lỗi).");
  await closePool();
}

main().catch(async (error) => {
  console.error("FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
