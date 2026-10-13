const { queryDB } = require("../config/database");

async function debugCompare() {
  console.log("=== KIỂM TRA TUẦN 2026_02 ===");
  
  // 1. Query cũ của pobalanceYearByWeekDetail cho tuần 2026_02
  const qOldWeek2 = `
  WITH PO_TABLE AS
  (
    SELECT COUNT(PO_ID) AS PO_COUNT, SUM(PO_QTY) AS PO_QTY, YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK 
    FROM ZTBPOTable 
    WHERE YEAR(PO_DATE) = 2026 AND FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') = '02'
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  DELIVERY_TB AS
  (
    SELECT YEAR(PO_DATE) PO_YEAR, FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK, SUM(DELIVERY_QTY) AS DELIVERY_QTY  
    FROM ZTBDelivery
    LEFT JOIN ZTBPOTable ON ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
    WHERE YEAR(PO_DATE) = 2026 AND FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') = '02'
    GROUP BY YEAR(PO_DATE), FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2')
  ),
  POHTTB AS
  (
    SELECT CONCAT(PO_TABLE.PO_YEAR,'_', PO_TABLE.PO_WEEK) AS PO_YW, PO_TABLE.PO_YEAR, PO_TABLE.PO_WEEK, PO_QTY, isnull(DELIVERY_QTY,0) AS DELIVERY_QTY, (PO_QTY- isnull(DELIVERY_QTY,0)) AS PO_BALANCE 
    FROM PO_TABLE
    LEFT JOIN DELIVERY_TB ON PO_TABLE.PO_YEAR = DELIVERY_TB.PO_YEAR AND PO_TABLE.PO_WEEK = DELIVERY_TB.PO_WEEK
  )
  SELECT * FROM POHTTB;
  `;
  const rOld = await queryDB(qOldWeek2);
  console.log("Query CŨ tuần 2026_02:", rOld.data);

  // 2. Query từ bảng RP_KD_PO_BALANCE_WEEKLY
  const qRP = `
  SELECT 
    PO_YW, 
    PO_YEAR, 
    PO_WEEK, 
    SUM(PO_QTY) AS PO_QTY, 
    SUM(DELIVERY_QTY) AS DELIVERY_QTY, 
    SUM(PO_BALANCE) AS PO_BALANCE
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE PO_YEAR = 2026 AND PO_WEEK = '02'
  GROUP BY PO_YW, PO_YEAR, PO_WEEK;
  `;
  const rRP = await queryDB(qRP);
  console.log("Query từ RP_KD_PO_BALANCE_WEEKLY tuần 2026_02:", rRP.data);

  // 3. Từng dòng trong RP_KD_PO_BALANCE_WEEKLY của tuần 2026_02
  const qRPDetail = `
  SELECT CUST_CD, CUST_NAME_KD, PO_QTY, DELIVERY_QTY, PO_BALANCE
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE PO_YEAR = 2026 AND PO_WEEK = '02';
  `;
  const rRPDetail = await queryDB(qRPDetail);
  console.log("Chi tiết từng khách trong RP_ tuần 2026_02:", rRPDetail.data);

  // 4. Kiểm tra xem có khách hàng nào có PO_BALANCE < 0 hay không
  const qNegative = `
  SELECT COUNT(*) as neg_count
  FROM RP_KD_PO_BALANCE_WEEKLY
  WHERE PO_BALANCE < 0;
  `;
  const rNeg = await queryDB(qNegative);
  console.log("Số bản ghi PO_BALANCE < 0 trong RP_:", rNeg.data);

  // 5. Kiểm tra tổng PO_QTY của tuần 2026_02 trực tiếp trong ZTBPOTable
  const qRawPO = `
  SELECT SUM(PO_QTY) as total_po_qty
  FROM ZTBPOTable
  WHERE YEAR(PO_DATE) = 2026 AND FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') = '02';
  `;
  const rRaw = await queryDB(qRawPO);
  console.log("Tổng PO_QTY thực tế trong ZTBPOTable tuần 2026_02:", rRaw.data);

  process.exit(0);
}

debugCompare().catch(console.error);
