const kinhdoanhService = require("../services/kinhdoanhService");

function mockCall(cmd, params) {
  return new Promise((resolve) => {
    kinhdoanhService[cmd]({}, { send: (d) => resolve(d) }, params);
  });
}

async function checkAllThree() {
  console.log("=== 1. KIỂM TRA kd_annuallyclosing (Yearly Closing) ===");
  const resYearly = await mockCall("kd_annuallyclosing", {
    START_DATE: "2020-01-01",
    END_DATE: "2026-12-31",
    CTR_CD: "002"
  });
  console.log("Số năm:", resYearly.data?.length);
  resYearly.data?.forEach((r) => {
    console.log(`Năm ${r.YEAR_NUM}: DELIVERY_QTY=${r.DELIVERY_QTY} (${typeof r.DELIVERY_QTY}), AMOUNT=${r.DELIVERED_AMOUNT}`);
  });

  console.log("\n=== 2. KIỂM TRA kd_monthlyclosing (Monthly Closing) ===");
  const resMonthly = await mockCall("kd_monthlyclosing", {
    START_DATE: "2026-01-01",
    END_DATE: "2026-12-31",
    CTR_CD: "002"
  });
  console.log("Số tháng:", resMonthly.data?.length);
  resMonthly.data?.slice(0, 5).forEach((r) => {
    console.log(`Tháng ${r.MONTH_YW}: DELIVERY_QTY=${r.DELIVERY_QTY} (${typeof r.DELIVERY_QTY}), AMOUNT=${r.DELIVERED_AMOUNT}`);
  });

  console.log("\n=== 3. KIỂM TRA kd_pooverweek (PO By Week) ===");
  const resPOWeek = await mockCall("kd_pooverweek", {
    FROM_DATE: "2026-07-01",
    TO_DATE: "2026-10-13",
    CTR_CD: "002",
    IN_NHANH: false
  });
  console.log("Số tuần PO:", resPOWeek.data?.length);
  resPOWeek.data?.slice(0, 5).forEach((r) => {
    console.log(`Tuần ${r.YEAR_WEEK}: WEEKLY_PO_QTY=${r.WEEKLY_PO_QTY} (${typeof r.WEEKLY_PO_QTY}), AMOUNT=${r.WEEKLY_PO_AMOUNT}`);
  });

  process.exit(0);
}

checkAllThree().catch(console.error);
