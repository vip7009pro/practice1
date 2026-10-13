const { queryDB } = require("../config/database");

async function run() {
  console.log("=== 1. SO SÁNH pobalanceByYear ===");
  // CŨ
  const t0 = Date.now();
  const qOldYear = `
  WITH PO_TABLE AS (
    SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY, YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK 
    FROM ZTBPOTable 
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS (
    SELECT YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  
    FROM ZTBDelivery
    LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS (
    SELECT CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW, PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY - isnull(DELIVERY_QTY,0)) AS PO_BALANCE 
    FROM PO_TABLE
    LEFT JOIN DELIVERY_TB ON PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT PO_YEAR, SUM(PO_BALANCE) AS PO_BALANCE FROM POHTTB
  WHERE POHTTB.PO_BALANCE > 0
  GROUP BY PO_YEAR
  ORDER BY PO_YEAR ASC;
  `;
  const resOldYear = await queryDB(qOldYear);
  console.log(`Query CŨ pobalanceByYear: ${Date.now() - t0}ms`);
  console.log("Kết quả CŨ:", resOldYear.data);

  // MỚI HIỆN TẠI TỪ RP_KD_PO_BALANCE_WEEKLY
  const t1 = Date.now();
  const qNewYear = `
  SELECT 
    PO_YEAR, 
    CAST(SUM(PO_BALANCE) AS FLOAT) AS PO_BALANCE 
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002' AND PO_BALANCE > 0
  GROUP BY PO_YEAR
  ORDER BY PO_YEAR ASC;
  `;
  const resNewYear = await queryDB(qNewYear);
  console.log(`Query MỚI (bảng RP_) pobalanceByYear: ${Date.now() - t1}ms`);
  console.log("Kết quả MỚI:", resNewYear.data);

  console.log("\n=== 2. SO SÁNH pobalanceYearByWeekDetail (năm 2026) ===");
  const t2 = Date.now();
  const qOldWeek2026 = `
  WITH PO_TABLE AS (
    SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY, YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK 
    FROM ZTBPOTable 
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS (
    SELECT YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  
    FROM ZTBDelivery
    LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS (
    SELECT CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW, PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY - isnull(DELIVERY_QTY,0)) AS PO_BALANCE 
    FROM PO_TABLE
    LEFT JOIN DELIVERY_TB ON PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT * FROM POHTTB
  WHERE POHTTB.PO_BALANCE > 0 AND POHTTB.PO_YEAR = '2026'
  ORDER BY PO_YEAR ASC, PO_WEEK ASC;
  `;
  const resOldWeek = await queryDB(qOldWeek2026);
  console.log(`Query CŨ pobalanceYearByWeekDetail 2026: ${Date.now() - t2}ms, số dòng: ${resOldWeek.data?.length}`);
  console.log("CŨ (5 dòng đầu):", resOldWeek.data?.slice(0, 5));
  console.log("CŨ (5 dòng cuối):", resOldWeek.data?.slice(-5));

  const t3 = Date.now();
  const qNewWeek2026 = `
  SELECT 
    PO_YW, 
    PO_YEAR, 
    PO_WEEK, 
    CAST(SUM(PO_QTY) AS FLOAT) AS PO_QTY, 
    CAST(SUM(DELIVERY_QTY) AS FLOAT) AS DELIVERY_QTY, 
    CAST(SUM(PO_BALANCE) AS FLOAT) AS PO_BALANCE
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002' AND PO_BALANCE > 0 AND PO_YEAR = '2026'
  GROUP BY PO_YW, PO_YEAR, PO_WEEK
  ORDER BY PO_YEAR ASC, PO_WEEK ASC;
  `;
  const resNewWeek = await queryDB(qNewWeek2026);
  console.log(`Query MỚI pobalanceYearByWeekDetail 2026: ${Date.now() - t3}ms, số dòng: ${resNewWeek.data?.length}`);
  console.log("MỚI (5 dòng đầu):", resNewWeek.data?.slice(0, 5));
  console.log("MỚI (5 dòng cuối):", resNewWeek.data?.slice(-5));

  process.exit(0);
}

run().catch(console.error);
