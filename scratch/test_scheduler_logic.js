const {
  shouldSyncReport,
  syncReportByCode,
  syncAllReports,
  getReportSyncInfo,
  REPORT_REGISTRY
} = require("../services/reportSyncService");

async function testScheduler() {
  console.log("=== 1. KIỂM TRA shouldSyncReport CHO 'KINH_DOANH' ===");
  const check = await shouldSyncReport("KINH_DOANH", 10);
  console.log("Kết quả kiểm tra 10 phút:", check);

  console.log("\n=== 2. KIỂM TRA syncReportByCode VỚI force = false (KHI CHƯA ĐỦ 10 PHÚT) ===");
  const resSkip = await syncReportByCode("KINH_DOANH", { force: false });
  console.log("Kết quả chạy force=false:", resSkip);

  console.log("\n=== 3. KIỂM TRA syncAllReports VỚI force = false ===");
  const resAllSkip = await syncAllReports({ force: false });
  console.log("Kết quả syncAllReports force=false:", resAllSkip);

  console.log("\n=== 4. KIỂM TRA DANH SÁCH REPORT_REGISTRY ĐÃ ĐĂNG KÝ ===");
  console.log("Số module báo cáo đã đăng ký:", REPORT_REGISTRY.length);
  REPORT_REGISTRY.forEach(r => console.log(`- ${r.code}: ${r.name} (Bộ phận: ${r.department}, Chu kỳ: ${r.minIntervalMinutes}p)`));

  process.exit(0);
}

testScheduler().catch(console.error);
