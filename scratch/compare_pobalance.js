const { queryDB } = require("../config/database_mssql");

async function comparePOBalance() {
  console.log("=== SO SÁNH TRUY VẤN CŨ VÀ MỚI CỦA PO BALANCE ===");

  // 1. pobalanceByYear
  const qOld_Year = `
  WITH PO_TABLE AS
  (
  SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY, YEAR(PO_DATE) PO_YEAR,FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')  AS PO_WEEK FROM ZTBPOTable GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS
  (
  SELECT YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  FROM ZTBDelivery
  LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
  GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS
  (
  SELECT CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW,PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY- isnull(DELIVERY_QTY,0)) AS PO_BALANCE FROM PO_TABLE
  LEFT JOIN DELIVERY_TB ON PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT PO_YEAR, SUM(PO_BALANCE) AS PO_BALANCE FROM POHTTB
  WHERE POHTTB.PO_BALANCE > 0
  GROUP BY PO_YEAR
  ORDER BY PO_YEAR ASC
  `;

  const qNew_Year = `
  SELECT 
    PO_YEAR, 
    SUM(PO_BALANCE) AS PO_BALANCE 
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002' AND PO_BALANCE > 0
  GROUP BY PO_YEAR
  ORDER BY PO_YEAR ASC;
  `;

  const resOld_Year = await queryDB(qOld_Year);
  const resNew_Year = await queryDB(qNew_Year);

  console.log("\n1. pobalanceByYear:");
  console.log("CŨ:", resOld_Year.data);
  console.log("MỚI:", resNew_Year.data);

  // 2. pobalanceYearByWeekDetail (năm 2024 hoặc 2025)
  const targetYear = resOld_Year.data?.[resOld_Year.data.length - 1]?.PO_YEAR || 2025;
  console.log(`\nKiểm tra năm ${targetYear}:`);

  const qOld_Week = `
  WITH PO_TABLE AS
  (
  SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY, YEAR(PO_DATE) PO_YEAR,FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')  AS PO_WEEK FROM ZTBPOTable GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS
  (
  SELECT YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  FROM ZTBDelivery
  LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
  GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS
  (
  SELECT CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW,PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY- isnull(DELIVERY_QTY,0)) AS PO_BALANCE FROM PO_TABLE
  LEFT JOIN DELIVERY_TB ON PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT * FROM POHTTB
  WHERE POHTTB.PO_BALANCE > 0 AND POHTTB.PO_YEAR = '${targetYear}'
  ORDER BY PO_YEAR  ASC, PO_WEEK ASC
  `;

  const qNew_Week = `
  SELECT 
    PO_YW, 
    PO_YEAR, 
    PO_WEEK, 
    SUM(PO_QTY) AS PO_QTY, 
    SUM(DELIVERY_QTY) AS DELIVERY_QTY, 
    SUM(PO_BALANCE) AS PO_BALANCE
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002' AND PO_BALANCE > 0 AND PO_YEAR = '${targetYear}'
  GROUP BY PO_YW, PO_YEAR, PO_WEEK
  ORDER BY PO_YEAR ASC, PO_WEEK ASC;
  `;

  const resOld_Week = await queryDB(qOld_Week);
  const resNew_Week = await queryDB(qNew_Week);

  console.log("\n2. pobalanceYearByWeekDetail:");
  console.log(`CŨ (${resOld_Week.data?.length} rows):`, resOld_Week.data?.slice(0, 3));
  console.log(`MỚI (${resNew_Week.data?.length} rows):`, resNew_Week.data?.slice(0, 3));

  // 3. poBalanceByYearWeekCustomer
  const testWeek = resOld_Week.data?.[0]?.PO_WEEK || '01';
  console.log(`\nKiểm tra theo tuần ${testWeek}:`);

  const qOld_Cust = `
  WITH PO_TABLE AS
  (
  SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY,CUST_CD, YEAR(PO_DATE) PO_YEAR,FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')  AS PO_WEEK FROM ZTBPOTable GROUP BY CUST_CD, YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS
  (
  SELECT ZTBDelivery.CUST_CD, YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  FROM ZTBDelivery
  LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
  GROUP BY ZTBDelivery.CUST_CD, YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS
  (
  SELECT PO_TABLE.CUST_CD, CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW,PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY- isnull(DELIVERY_QTY,0)) AS PO_BALANCE FROM PO_TABLE
  LEFT JOIN DELIVERY_TB ON PO_TABLE.CUST_CD = DELIVERY_TB.CUST_CD AND PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT POHTTB.*, M110.CUST_NAME_KD FROM POHTTB
  LEFT JOIN M110 ON M110.CUST_CD = POHTTB.CUST_CD
  WHERE POHTTB.PO_BALANCE > 0 AND POHTTB.PO_YEAR = '${targetYear}' AND POHTTB.PO_WEEK = '${testWeek}'
  ORDER BY POHTTB.PO_BALANCE ASC
  `;

  const qNew_Cust = `
  SELECT 
    CUST_CD, 
    PO_YW, 
    PO_YEAR, 
    PO_WEEK, 
    PO_QTY, 
    DELIVERY_QTY, 
    PO_BALANCE, 
    CUST_NAME_KD
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE CTR_CD = '002' AND PO_BALANCE > 0 AND PO_YEAR = '${targetYear}' AND PO_WEEK = '${testWeek}'
  ORDER BY PO_BALANCE ASC;
  `;

  const resOld_Cust = await queryDB(qOld_Cust);
  const resNew_Cust = await queryDB(qNew_Cust);

  console.log("\n3. poBalanceByYearWeekCustomer:");
  console.log(`CŨ (${resOld_Cust.data?.length} rows):`, resOld_Cust.data);
  console.log(`MỚI (${resNew_Cust.data?.length} rows):`, resNew_Cust.data);
}

comparePOBalance().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
