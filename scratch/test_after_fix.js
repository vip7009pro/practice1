const { syncRPKinhDoanh } = require("../services/reportSyncService");
const kinhdoanhService = require("../services/kinhdoanhService");

function mockRes() {
  return {
    send: function (data) {
      this.data = data;
      return this;
    }
  };
}

async function verifyAll() {
  console.log("=== 1. CHẠY syncRPKinhDoanh VỚI FULL SYNC CHO PO BALANCE ===");
  const syncRes = await syncRPKinhDoanh(60, "002");
  console.log("Kết quả sync:", syncRes);

  console.log("\n=== 2. KIỂM TRA pobalanceByYear ===");
  const resYear = mockRes();
  await kinhdoanhService.pobalanceByYear({}, resYear, { CTR_CD: "002" });
  console.log("pobalanceByYear:", resYear.data?.data);

  console.log("\n=== 3. KIỂM TRA pobalanceYearByWeekDetail (năm 2026) ===");
  const resWeek2026 = mockRes();
  await kinhdoanhService.pobalanceYearByWeekDetail({}, resWeek2026, { CTR_CD: "002", PO_YEAR: "2026" });
  const weekData = resWeek2026.data?.data || [];
  console.log(`Số tuần năm 2026: ${weekData.length} tuần (kỳ vọng 41 tuần)`);
  console.log("Tuần 02 (tuần đầu):", weekData[0]);
  console.log("Tuần 42 (tuần cuối):", weekData[weekData.length - 1]);

  console.log("\n=== 4. KIỂM TRA poBalanceByYearWeekCustomer (năm 2026, tuần 02) ===");
  const resCustWeek = mockRes();
  await kinhdoanhService.poBalanceByYearWeekCustomer({}, resCustWeek, { CTR_CD: "002", PO_YEAR: "2026", PO_WEEK: "02" });
  console.log(`Số khách hàng có tồn tuần 02: ${resCustWeek.data?.data?.length}`);
  console.log("Chi tiết khách tồn tuần 02:", resCustWeek.data?.data);

  console.log("\n=== 5. KIỂM TRA poBalanceByYearWeekCustomerByYear (năm 2026) ===");
  const resCustYear = mockRes();
  await kinhdoanhService.poBalanceByYearWeekCustomerByYear({}, resCustYear, { CTR_CD: "002", PO_YEAR: "2026" });
  console.log(`Số khách hàng có tồn năm 2026: ${resCustYear.data?.data?.length}`);
  console.log("Top 3 khách tồn lớn nhất năm 2026:", resCustYear.data?.data?.slice(0, 3));

  process.exit(0);
}

verifyAll().catch(console.error);
