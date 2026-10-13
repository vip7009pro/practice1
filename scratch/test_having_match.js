const { queryDB } = require("../config/database");

async function testHaving() {
  console.log("=== KIỂM TRA QUERY DÙNG HAVING SUM(PO_BALANCE) > 0 ===");

  // 1. pobalanceByYear
  const qYear = `
  SELECT 
    PO_YEAR, 
    CAST(SUM(PO_BALANCE) AS FLOAT) AS PO_BALANCE 
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002'
  GROUP BY PO_YEAR
  HAVING SUM(PO_BALANCE) > 0
  ORDER BY PO_YEAR ASC;
  `;
  const rYear = await queryDB(qYear);
  console.log("pobalanceByYear với HAVING:");
  console.log(rYear.data);

  // 2. pobalanceYearByWeekDetail 2026
  const qWeek = `
  SELECT 
    PO_YW, 
    PO_YEAR, 
    PO_WEEK, 
    CAST(SUM(PO_QTY) AS FLOAT) AS PO_QTY, 
    CAST(SUM(DELIVERY_QTY) AS FLOAT) AS DELIVERY_QTY, 
    CAST(SUM(PO_BALANCE) AS FLOAT) AS PO_BALANCE
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002' AND PO_YEAR = '2026'
  GROUP BY PO_YW, PO_YEAR, PO_WEEK
  HAVING SUM(PO_BALANCE) > 0
  ORDER BY PO_YEAR ASC, PO_WEEK ASC;
  `;
  const rWeek = await queryDB(qWeek);
  console.log("\npobalanceYearByWeekDetail 2026 với HAVING:");
  console.log(`Số dòng: ${rWeek.data?.length}`);
  console.log("Tuần 2026_02:", rWeek.data?.[0]);
  console.log("Tuần cuối:", rWeek.data?.[rWeek.data.length - 1]);

  // 3. Đối chiếu trực tiếp với câu query CŨ của pobalanceYearByWeekDetail 2026
  const qOld = `
  WITH PO_TABLE AS
  (
    SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY, YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK 
    FROM ZTBPOTable 
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS
  (
    SELECT YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  
    FROM ZTBDelivery
    LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS
  (
    SELECT CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW, PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY- isnull(DELIVERY_QTY,0)) AS PO_BALANCE 
    FROM PO_TABLE
    LEFT JOIN DELIVERY_TB ON PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT * FROM POHTTB
  WHERE POHTTB.PO_BALANCE > 0 AND POHTTB.PO_YEAR = '2026'
  ORDER BY PO_YEAR ASC, PO_WEEK ASC;
  `;
  const rOld = await queryDB(qOld);
  
  // So sánh từng dòng giữa Mới (HAVING) và Cũ
  let allMatch = true;
  for (let i = 0; i < rOld.data.length; i++) {
    const o = rOld.data[i];
    const n = rWeek.data[i];
    if (!n || o.PO_YW !== n.PO_YW || Number(o.PO_QTY) !== Number(n.PO_QTY) || Number(o.DELIVERY_QTY) !== Number(n.DELIVERY_QTY) || Number(o.PO_BALANCE) !== Number(n.PO_BALANCE)) {
      console.log(`Lệch ở dòng ${i}:`, { old: o, new: n });
      allMatch = false;
      break;
    }
  }
  if (allMatch) {
    console.log(`\n>>> XÁC NHẬN: TOÀN BỘ ${rOld.data.length} TUẦN CỦA NĂM 2026 KHỚP TUYỆT ĐỐI 100% CẢ 3 CỘT (PO_QTY, DELIVERY_QTY, PO_BALANCE)! <<<`);
  }

  process.exit(0);
}

testHaving().catch(console.error);
