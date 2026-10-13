const { queryDB } = require("../config/database");

async function testFullSync() {
  console.log("=== THỬ NGHIỆM FULL SYNC RP_KD_PO_BALANCE_WEEKLY ===");
  const t0 = Date.now();
  
  // Truncate & nạp toàn bộ RP_KD_PO_BALANCE_WEEKLY
  await queryDB(`
    DELETE FROM RP_KD_PO_BALANCE_WEEKLY;

    WITH PO_TABLE AS (
      SELECT 
        CTR_CD,
        CUST_CD,
        YEAR(PO_DATE) AS PO_YEAR,
        FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK,
        COUNT(PO_ID) AS PO_COUNT,
        SUM(CAST(PO_QTY AS BIGINT)) AS PO_QTY
      FROM ZTBPOTable
      GROUP BY CTR_CD, CUST_CD, YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
    ),
    DELIVERY_TB AS (
      SELECT 
        ZTBDelivery.CTR_CD,
        ZTBDelivery.CUST_CD,
        YEAR(ZTBPOTable.PO_DATE) AS PO_YEAR,
        FORMAT(DATEPART(ISO_WEEK, ZTBPOTable.PO_DATE), 'D2') AS PO_WEEK,
        SUM(CAST(ZTBDelivery.DELIVERY_QTY AS BIGINT)) AS DELIVERY_QTY
      FROM ZTBDelivery
      LEFT JOIN ZTBPOTable ON (
        ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD 
        AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD 
        AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE 
        AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
      )
      GROUP BY ZTBDelivery.CTR_CD, ZTBDelivery.CUST_CD, YEAR(ZTBPOTable.PO_DATE), FORMAT(DATEPART(ISO_WEEK, ZTBPOTable.PO_DATE), 'D2')
    )
    INSERT INTO RP_KD_PO_BALANCE_WEEKLY (
      CTR_CD, CUST_CD, CUST_NAME_KD, PO_YEAR, PO_WEEK, PO_YW, PO_COUNT, PO_QTY, DELIVERY_QTY, PO_BALANCE
    )
    SELECT 
      P.CTR_CD,
      P.CUST_CD,
      ISNULL(M110.CUST_NAME_KD, P.CUST_CD) AS CUST_NAME_KD,
      P.PO_YEAR,
      P.PO_WEEK,
      CONCAT(P.PO_YEAR, '_', P.PO_WEEK) AS PO_YW,
      P.PO_COUNT,
      P.PO_QTY,
      ISNULL(D.DELIVERY_QTY, 0) AS DELIVERY_QTY,
      (P.PO_QTY - ISNULL(D.DELIVERY_QTY, 0)) AS PO_BALANCE
    FROM PO_TABLE P
    LEFT JOIN DELIVERY_TB D ON (
      D.CTR_CD = P.CTR_CD 
      AND D.CUST_CD = P.CUST_CD 
      AND D.PO_YEAR = P.PO_YEAR 
      AND D.PO_WEEK = P.PO_WEEK
    )
    LEFT JOIN M110 ON (M110.CUST_CD = P.CUST_CD AND M110.CTR_CD = P.CTR_CD);
  `);
  
  const elapsed = Date.now() - t0;
  console.log(`Full Sync RP_KD_PO_BALANCE_WEEKLY hoàn tất trong: ${elapsed}ms`);

  // Kiểm tra pobalanceByYear từ bảng mới
  const qNewYear = `
  SELECT 
    PO_YEAR, 
    CAST(SUM(PO_BALANCE) AS FLOAT) AS PO_BALANCE 
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE PO_BALANCE > 0
  GROUP BY PO_YEAR
  ORDER BY PO_YEAR ASC;
  `;
  const resNewYear = await queryDB(qNewYear);
  console.log("\nKết quả pobalanceByYear từ RP_KD_PO_BALANCE_WEEKLY sau khi Full Sync:");
  console.log(resNewYear.data);

  // Kiểm tra pobalanceYearByWeekDetail 2026
  const qNewWeek2026 = `
  SELECT 
    PO_YW, 
    PO_YEAR, 
    PO_WEEK, 
    CAST(SUM(PO_QTY) AS FLOAT) AS PO_QTY, 
    CAST(SUM(DELIVERY_QTY) AS FLOAT) AS DELIVERY_QTY, 
    CAST(SUM(PO_BALANCE) AS FLOAT) AS PO_BALANCE
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE PO_BALANCE > 0 AND PO_YEAR = '2026'
  GROUP BY PO_YW, PO_YEAR, PO_WEEK
  ORDER BY PO_YEAR ASC, PO_WEEK ASC;
  `;
  const resNewWeek = await queryDB(qNewWeek2026);
  console.log(`\nSố tuần năm 2026 sau khi Full Sync: ${resNewWeek.data?.length} tuần (trước đó cũ là 41 tuần)`);
  console.log("Tuần đầu:", resNewWeek.data?.[0]);
  console.log("Tuần cuối:", resNewWeek.data?.[resNewWeek.data.length - 1]);

  process.exit(0);
}

testFullSync().catch(console.error);
