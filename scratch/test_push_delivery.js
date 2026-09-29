/**
 * Gửi push trực tiếp tới subscription của một nhân viên và IN KẾT QUẢ từng endpoint,
 * để biết push có thực sự tới được trình duyệt hay không (thay vì bị nuốt lỗi).
 *
 * Chạy: node scratch/test_push_delivery.js [CMS_ID]
 */
const { openConnection, closePool } = require("../config/database");
const { sendNotification, setVapidDetails } = require("../utils/pushUtils");

setVapidDetails();

const normalize = (value) => String(value || "").trim().toUpperCase();

async function main() {
  const cmsId = process.argv[2] || "CMS1179";
  const pool = await openConnection();

  const employee = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID FROM ZTBEMPLINFO WHERE CMS_ID = @CMS_ID`,
      { CMS_ID: cmsId }
    )
  ).recordset[0];
  if (!employee) throw new Error(`Không tìm thấy ${cmsId}`);

  const emplNo = normalize(employee.EMPL_NO);
  const ctrCd = String(employee.CTR_CD).trim();
  console.log(`Nhân viên: ${emplNo} (${cmsId}) ctr=${ctrCd}`);

  const rows = (
    await pool.query(
      `SELECT SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB
       WHERE CTR_CD = @CTR_CD AND SUB_STATUS = '1'`,
      { CTR_CD: ctrCd }
    )
  ).recordset;

  const owned = rows
    .map((row) => {
      try {
        const parsed = JSON.parse(row.SUBSCRIPTION);
        if (parsed && parsed.subscription) {
          return { subscription: parsed.subscription, emplNo: normalize(parsed.emplNo) };
        }
        return { subscription: parsed, emplNo: "" };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  const mine = owned.filter((entry) => entry.emplNo === emplNo);
  console.log(`Subscription khớp người nhận: ${mine.length}/${owned.length} (status='1')`);

  if (mine.length === 0) {
    console.log("=> KHÔNG có subscription nào gắn với nhân viên này ⇒ không thể push.");
    await closePool();
    return;
  }

  const payload = JSON.stringify({
    title: "Kiểm thử push chat",
    body: "Nếu bạn thấy thông báo này, đường push của chat đã hoạt động.",
    url: "/?chat=1",
    tag: "chat-test",
    data: { type: "CHAT_MESSAGE", conversationId: "1" },
  });

  let ok = 0;
  for (const [index, entry] of mine.entries()) {
    try {
      const result = await sendNotification(entry.subscription, payload);
      ok += 1;
      console.log(`  [${index}] OK statusCode=${result?.statusCode} endpoint=${String(entry.subscription.endpoint).slice(0, 60)}...`);
    } catch (error) {
      console.log(
        `  [${index}] LỖI statusCode=${error?.statusCode} message=${error?.message} body=${String(error?.body || "").slice(0, 120)}`
      );
    }
  }
  console.log(`Kết quả: ${ok}/${mine.length} gửi thành công.`);
  await closePool();
}

main().catch(async (error) => {
  console.error("FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
