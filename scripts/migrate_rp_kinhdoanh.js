const { queryDB } = require("../config/database");

async function migrateRPKinhDoanh() {
  console.log("=== BẮT ĐẦU MIGRATION CÁC BẢNG BÁO CÁO RP_* CHO KINH DOANH ===");

  // 1. Tạo bảng RP_KD_DELIVERY_DAILY
  console.log("1. Kiểm tra / Tạo bảng RP_KD_DELIVERY_DAILY...");
  await queryDB(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RP_KD_DELIVERY_DAILY')
    BEGIN
      CREATE TABLE RP_KD_DELIVERY_DAILY (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        DELIVERY_DATE DATE NOT NULL,
        CTR_CD VARCHAR(3) NOT NULL,
        CUST_CD VARCHAR(20) NOT NULL,
        CUST_NAME_KD NVARCHAR(100) NULL,
        EMPL_NO VARCHAR(20) NULL,
        EMPL_NAME NVARCHAR(100) NULL,
        IS_IN_NHANH BIT NOT NULL DEFAULT 0,
        DELIVERY_QTY BIGINT NOT NULL DEFAULT 0,
        DELIVERED_AMOUNT FLOAT NOT NULL DEFAULT 0
      );
      CREATE INDEX IX_RP_KD_DELIVERY_DAILY_DATE ON RP_KD_DELIVERY_DAILY (CTR_CD, DELIVERY_DATE, IS_IN_NHANH);
      CREATE INDEX IX_RP_KD_DELIVERY_DAILY_CUST ON RP_KD_DELIVERY_DAILY (CTR_CD, DELIVERY_DATE, CUST_NAME_KD);
      CREATE INDEX IX_RP_KD_DELIVERY_DAILY_EMPL ON RP_KD_DELIVERY_DAILY (CTR_CD, DELIVERY_DATE, EMPL_NAME);
      PRINT 'Đã tạo bảng RP_KD_DELIVERY_DAILY';
    END
  `);

  // 2. Tạo bảng RP_KD_OVERDUE_DAILY
  console.log("2. Kiểm tra / Tạo bảng RP_KD_OVERDUE_DAILY...");
  await queryDB(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RP_KD_OVERDUE_DAILY')
    BEGIN
      CREATE TABLE RP_KD_OVERDUE_DAILY (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        DELIVERY_DATE DATE NOT NULL,
        CTR_CD VARCHAR(3) NOT NULL,
        OVERDUE VARCHAR(10) NOT NULL,
        D_PLUS INT NOT NULL,
        TOTAL_IV INT NOT NULL DEFAULT 0
      );
      CREATE INDEX IX_RP_KD_OVERDUE_DAILY_SEARCH ON RP_KD_OVERDUE_DAILY (CTR_CD, DELIVERY_DATE);
      PRINT 'Đã tạo bảng RP_KD_OVERDUE_DAILY';
    END
  `);

  // 3. Tạo bảng RP_KD_PO_WEEKLY
  console.log("3. Kiểm tra / Tạo bảng RP_KD_PO_WEEKLY...");
  await queryDB(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RP_KD_PO_WEEKLY')
    BEGIN
      CREATE TABLE RP_KD_PO_WEEKLY (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        CTR_CD VARCHAR(3) NOT NULL,
        PO_DATE DATE NOT NULL,
        PO_YEAR INT NOT NULL,
        PO_WEEK INT NOT NULL,
        YEAR_WEEK VARCHAR(20) NOT NULL,
        IS_IN_NHANH BIT NOT NULL DEFAULT 0,
        PO_QTY BIGINT NOT NULL DEFAULT 0,
        PO_AMOUNT FLOAT NOT NULL DEFAULT 0
      );
      CREATE INDEX IX_RP_KD_PO_WEEKLY_SEARCH ON RP_KD_PO_WEEKLY (CTR_CD, PO_DATE, IS_IN_NHANH);
      CREATE INDEX IX_RP_KD_PO_WEEKLY_YW ON RP_KD_PO_WEEKLY (CTR_CD, PO_YEAR, PO_WEEK);
      PRINT 'Đã tạo bảng RP_KD_PO_WEEKLY';
    END
  `);

  // 4. Tạo bảng RP_KD_PO_BALANCE_TOTAL
  console.log("4. Kiểm tra / Tạo bảng RP_KD_PO_BALANCE_TOTAL...");
  await queryDB(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RP_KD_PO_BALANCE_TOTAL')
    BEGIN
      CREATE TABLE RP_KD_PO_BALANCE_TOTAL (
        CTR_CD VARCHAR(3) NOT NULL PRIMARY KEY,
        PO_QTY BIGINT NOT NULL DEFAULT 0,
        TOTAL_DELIVERED BIGINT NOT NULL DEFAULT 0,
        PO_BALANCE BIGINT NOT NULL DEFAULT 0,
        PO_AMOUNT FLOAT NOT NULL DEFAULT 0,
        DELIVERED_AMOUNT FLOAT NOT NULL DEFAULT 0,
        BALANCE_AMOUNT FLOAT NOT NULL DEFAULT 0,
        UPDATED_AT DATETIME DEFAULT GETDATE()
      );
      PRINT 'Đã tạo bảng RP_KD_PO_BALANCE_TOTAL';
    END
  `);

  // 5. Tạo bảng RP_KD_PO_BALANCE_WEEKLY
  console.log("5. Kiểm tra / Tạo bảng RP_KD_PO_BALANCE_WEEKLY...");
  await queryDB(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RP_KD_PO_BALANCE_WEEKLY')
    BEGIN
      CREATE TABLE RP_KD_PO_BALANCE_WEEKLY (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        CTR_CD VARCHAR(3) NOT NULL,
        CUST_CD VARCHAR(20) NOT NULL,
        CUST_NAME_KD NVARCHAR(100) NULL,
        PO_YEAR INT NOT NULL,
        PO_WEEK VARCHAR(2) NOT NULL,
        PO_YW VARCHAR(20) NOT NULL,
        PO_COUNT INT NOT NULL DEFAULT 0,
        PO_QTY BIGINT NOT NULL DEFAULT 0,
        DELIVERY_QTY BIGINT NOT NULL DEFAULT 0,
        PO_BALANCE BIGINT NOT NULL DEFAULT 0
      );
      CREATE INDEX IX_RP_KD_PO_BAL_WK_SEARCH ON RP_KD_PO_BALANCE_WEEKLY (CTR_CD, PO_YEAR, PO_WEEK);
      CREATE INDEX IX_RP_KD_PO_BAL_WK_CUST ON RP_KD_PO_BALANCE_WEEKLY (CTR_CD, PO_YEAR, CUST_CD);
      PRINT 'Đã tạo bảng RP_KD_PO_BALANCE_WEEKLY';
    END
  `);

  // 6. Tạo bảng RP_KD_CUSTOMER_PO_WEEKLY
  console.log("6. Kiểm tra / Tạo bảng RP_KD_CUSTOMER_PO_WEEKLY...");
  await queryDB(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RP_KD_CUSTOMER_PO_WEEKLY')
    BEGIN
      CREATE TABLE RP_KD_CUSTOMER_PO_WEEKLY (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        CTR_CD VARCHAR(3) NOT NULL,
        CUST_CD VARCHAR(20) NOT NULL,
        CUST_NAME_KD NVARCHAR(100) NULL,
        PO_DATE DATE NOT NULL,
        PO_YEAR INT NOT NULL,
        PO_WEEK INT NOT NULL,
        PO_YW VARCHAR(20) NOT NULL,
        PO_QTY BIGINT NOT NULL DEFAULT 0
      );
      CREATE INDEX IX_RP_KD_CUST_PO_WK_SEARCH ON RP_KD_CUSTOMER_PO_WEEKLY (CTR_CD, PO_DATE);
      PRINT 'Đã tạo bảng RP_KD_CUSTOMER_PO_WEEKLY';
    END
  `);

  console.log("Đã tạo đầy đủ 6 bảng RP_* trên SQL Server.");

  // ================= NẠP DỮ LIỆU LỊCH SỬ (POPULATE) =================

  // Nạp RP_KD_DELIVERY_DAILY nếu chưa có dữ liệu
  const chk1 = await queryDB("SELECT COUNT(*) AS CNT FROM RP_KD_DELIVERY_DAILY");
  if (chk1.data?.[0]?.CNT === 0) {
    console.log("Đang nạp dữ liệu RP_KD_DELIVERY_DAILY...");
    const t = Date.now();
    await queryDB(`
      WITH INNHANHCODETB AS (
        SELECT DISTINCT G_CODE FROM P400 WHERE PL_HANG IN ('IN','I1','I2','I3','I4','I5','I6','I7','I8','I9')
      )
      INSERT INTO RP_KD_DELIVERY_DAILY (
        DELIVERY_DATE, CTR_CD, CUST_CD, CUST_NAME_KD, EMPL_NO, EMPL_NAME, IS_IN_NHANH, DELIVERY_QTY, DELIVERED_AMOUNT
      )
      SELECT 
        CAST(ZTBDelivery.DELIVERY_DATE AS DATE) AS DELIVERY_DATE,
        ZTBDelivery.CTR_CD,
        ZTBDelivery.CUST_CD,
        ISNULL(M110.CUST_NAME_KD, ZTBDelivery.CUST_CD) AS CUST_NAME_KD,
        ZTBDelivery.EMPL_NO,
        ISNULL(M010.EMPL_NAME, ZTBDelivery.EMPL_NO) AS EMPL_NAME,
        CASE WHEN INN.G_CODE IS NOT NULL THEN 1 ELSE 0 END AS IS_IN_NHANH,
        SUM(CAST(ZTBDelivery.DELIVERY_QTY AS BIGINT)) AS DELIVERY_QTY,
        SUM(CAST(ZTBDelivery.DELIVERY_QTY AS FLOAT) * CAST(ISNULL(ZTBPOTable.PROD_PRICE, 0) AS FLOAT)) AS DELIVERED_AMOUNT
      FROM ZTBDelivery
      LEFT JOIN ZTBPOTable ON (
        ZTBPOTable.CTR_CD = ZTBDelivery.CTR_CD 
        AND ZTBPOTable.CUST_CD = ZTBDelivery.CUST_CD 
        AND ZTBPOTable.G_CODE = ZTBDelivery.G_CODE 
        AND ZTBPOTable.PO_NO = ZTBDelivery.PO_NO
      )
      LEFT JOIN M110 ON (M110.CUST_CD = ZTBDelivery.CUST_CD AND M110.CTR_CD = ZTBDelivery.CTR_CD)
      LEFT JOIN M010 ON (M010.EMPL_NO = ZTBDelivery.EMPL_NO AND M010.CTR_CD = ZTBDelivery.CTR_CD)
      LEFT JOIN INNHANHCODETB INN ON (INN.G_CODE = ZTBDelivery.G_CODE)
      GROUP BY 
        CAST(ZTBDelivery.DELIVERY_DATE AS DATE),
        ZTBDelivery.CTR_CD,
        ZTBDelivery.CUST_CD,
        ISNULL(M110.CUST_NAME_KD, ZTBDelivery.CUST_CD),
        ZTBDelivery.EMPL_NO,
        ISNULL(M010.EMPL_NAME, ZTBDelivery.EMPL_NO),
        CASE WHEN INN.G_CODE IS NOT NULL THEN 1 ELSE 0 END;
    `);
    console.log(`RP_KD_DELIVERY_DAILY nạp xong trong ${(Date.now() - t) / 1000}s`);
  } else {
    console.log(`RP_KD_DELIVERY_DAILY đã có sẵn ${chk1.data[0].CNT} dòng.`);
  }

  // Nạp RP_KD_OVERDUE_DAILY
  const chk2 = await queryDB("SELECT COUNT(*) AS CNT FROM RP_KD_OVERDUE_DAILY");
  if (chk2.data?.[0]?.CNT === 0) {
    console.log("Đang nạp dữ liệu RP_KD_OVERDUE_DAILY...");
    const t = Date.now();
    await queryDB(`
      INSERT INTO RP_KD_OVERDUE_DAILY (
        DELIVERY_DATE, CTR_CD, OVERDUE, D_PLUS, TOTAL_IV
      )
      SELECT 
        CAST(ZTBDelivery.DELIVERY_DATE AS DATE) AS DELIVERY_DATE,
        ZTBDelivery.CTR_CD,
        CASE WHEN ZTBPOTable.RD_DATE < ZTBDelivery.DELIVERY_DATE THEN 'OVER' ELSE 'OK' END AS OVERDUE,
        ISNULL(DATEDIFF(day, ZTBPOTable.PO_DATE, ZTBPOTable.RD_DATE), 0) AS D_PLUS,
        COUNT(ZTBDelivery.DELIVERY_ID) AS TOTAL_IV
      FROM ZTBDelivery
      LEFT JOIN ZTBPOTable ON (
        ZTBDelivery.PO_NO = ZTBPOTable.PO_NO 
        AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE 
        AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD 
        AND ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD
      )
      GROUP BY 
        CAST(ZTBDelivery.DELIVERY_DATE AS DATE),
        ZTBDelivery.CTR_CD,
        CASE WHEN ZTBPOTable.RD_DATE < ZTBDelivery.DELIVERY_DATE THEN 'OVER' ELSE 'OK' END,
        ISNULL(DATEDIFF(day, ZTBPOTable.PO_DATE, ZTBPOTable.RD_DATE), 0);
    `);
    console.log(`RP_KD_OVERDUE_DAILY nạp xong trong ${(Date.now() - t) / 1000}s`);
  } else {
    console.log(`RP_KD_OVERDUE_DAILY đã có sẵn ${chk2.data[0].CNT} dòng.`);
  }

  // Nạp RP_KD_PO_WEEKLY
  const chk3 = await queryDB("SELECT COUNT(*) AS CNT FROM RP_KD_PO_WEEKLY");
  if (chk3.data?.[0]?.CNT === 0) {
    console.log("Đang nạp dữ liệu RP_KD_PO_WEEKLY...");
    const t = Date.now();
    await queryDB(`
      WITH INNHANHCODETB AS (
        SELECT DISTINCT G_CODE FROM P400 WHERE PL_HANG IN ('IN','I1','I2','I3','I4','I5','I6','I7','I8','I9')
      )
      INSERT INTO RP_KD_PO_WEEKLY (
        CTR_CD, PO_DATE, PO_YEAR, PO_WEEK, YEAR_WEEK, IS_IN_NHANH, PO_QTY, PO_AMOUNT
      )
      SELECT 
        ZTBPOTable.CTR_CD,
        CAST(ZTBPOTable.PO_DATE AS DATE) AS PO_DATE,
        YEAR(ZTBPOTable.PO_DATE) AS PO_YEAR,
        DATEPART(ISOWK, DATEADD(day, 1, ZTBPOTable.PO_DATE)) AS PO_WEEK,
        CONCAT(YEAR(ZTBPOTable.PO_DATE), '_', DATEPART(ISOWK, DATEADD(day, 1, ZTBPOTable.PO_DATE))) AS YEAR_WEEK,
        CASE WHEN INN.G_CODE IS NOT NULL THEN 1 ELSE 0 END AS IS_IN_NHANH,
        SUM(CAST(ZTBPOTable.PO_QTY AS BIGINT)) AS PO_QTY,
        SUM(CAST(ZTBPOTable.PO_QTY AS FLOAT) * CAST(ISNULL(ZTBPOTable.PROD_PRICE, 0) AS FLOAT)) AS PO_AMOUNT
      FROM ZTBPOTable
      LEFT JOIN INNHANHCODETB INN ON (INN.G_CODE = ZTBPOTable.G_CODE)
      GROUP BY 
        ZTBPOTable.CTR_CD,
        CAST(ZTBPOTable.PO_DATE AS DATE),
        YEAR(ZTBPOTable.PO_DATE),
        DATEPART(ISOWK, DATEADD(day, 1, ZTBPOTable.PO_DATE)),
        CASE WHEN INN.G_CODE IS NOT NULL THEN 1 ELSE 0 END;
    `);
    console.log(`RP_KD_PO_WEEKLY nạp xong trong ${(Date.now() - t) / 1000}s`);
  } else {
    console.log(`RP_KD_PO_WEEKLY đã có sẵn ${chk3.data[0].CNT} dòng.`);
  }

  // Nạp RP_KD_PO_BALANCE_TOTAL
  console.log("Đang nạp/cập nhật dữ liệu RP_KD_PO_BALANCE_TOTAL...");
  const t4 = Date.now();
  await queryDB(`
    DELETE FROM RP_KD_PO_BALANCE_TOTAL;
    INSERT INTO RP_KD_PO_BALANCE_TOTAL (
      CTR_CD, PO_QTY, TOTAL_DELIVERED, PO_BALANCE, PO_AMOUNT, DELIVERED_AMOUNT, BALANCE_AMOUNT, UPDATED_AT
    )
    SELECT 
      AA.CTR_CD,
      SUM(CAST(AA.PO_QTY AS BIGINT)) AS PO_QTY,
      SUM(CAST(AA.TotalDelivered AS BIGINT)) AS TOTAL_DELIVERED,
      SUM(CAST((AA.PO_QTY - AA.TotalDelivered) AS BIGINT)) AS PO_BALANCE,
      SUM(CAST(AA.PO_QTY AS FLOAT) * CAST(AA.PROD_PRICE AS FLOAT)) AS PO_AMOUNT,
      SUM(CAST(AA.TotalDelivered AS FLOAT) * CAST(AA.PROD_PRICE AS FLOAT)) AS DELIVERED_AMOUNT,
      SUM(CAST((AA.PO_QTY - AA.TotalDelivered) AS FLOAT) * CAST(AA.PROD_PRICE AS FLOAT)) AS BALANCE_AMOUNT,
      GETDATE()
    FROM (
      SELECT 
        ZTBPOTable.CTR_CD, 
        ZTBPOTable.CUST_CD, 
        ZTBPOTable.G_CODE, 
        ZTBPOTable.PO_NO, 
        ZTBPOTable.PO_QTY,
        ISNULL(ZTBPOTable.PROD_PRICE, 0) AS PROD_PRICE,
        ISNULL(SUM(ZTBDelivery.DELIVERY_QTY), 0) AS TotalDelivered
      FROM ZTBPOTable
      LEFT JOIN ZTBDelivery ON (
        ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD 
        AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD 
        AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE 
        AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
      )
      GROUP BY ZTBPOTable.CTR_CD, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, ZTBPOTable.PO_QTY, ZTBPOTable.PROD_PRICE
    ) AA
    GROUP BY AA.CTR_CD;
  `);
  console.log(`RP_KD_PO_BALANCE_TOTAL nạp xong trong ${(Date.now() - t4) / 1000}s`);

  // Nạp RP_KD_PO_BALANCE_WEEKLY
  const chk5 = await queryDB("SELECT COUNT(*) AS CNT FROM RP_KD_PO_BALANCE_WEEKLY");
  if (chk5.data?.[0]?.CNT === 0) {
    console.log("Đang nạp dữ liệu RP_KD_PO_BALANCE_WEEKLY...");
    const t = Date.now();
    await queryDB(`
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
    console.log(`RP_KD_PO_BALANCE_WEEKLY nạp xong trong ${(Date.now() - t) / 1000}s`);
  } else {
    console.log(`RP_KD_PO_BALANCE_WEEKLY đã có sẵn ${chk5.data[0].CNT} dòng.`);
  }

  // Nạp RP_KD_CUSTOMER_PO_WEEKLY
  const chk6 = await queryDB("SELECT COUNT(*) AS CNT FROM RP_KD_CUSTOMER_PO_WEEKLY");
  if (chk6.data?.[0]?.CNT === 0) {
    console.log("Đang nạp dữ liệu RP_KD_CUSTOMER_PO_WEEKLY...");
    const t = Date.now();
    await queryDB(`
      INSERT INTO RP_KD_CUSTOMER_PO_WEEKLY (
        CTR_CD, CUST_CD, CUST_NAME_KD, PO_DATE, PO_YEAR, PO_WEEK, PO_YW, PO_QTY
      )
      SELECT 
        Z.CTR_CD,
        Z.CUST_CD,
        ISNULL(M110.CUST_NAME_KD, Z.CUST_CD) AS CUST_NAME_KD,
        CAST(Z.PO_DATE AS DATE) AS PO_DATE,
        YEAR(Z.PO_DATE) AS PO_YEAR,
        DATEPART(ISO_WEEK, Z.PO_DATE) AS PO_WEEK,
        CONCAT(YEAR(Z.PO_DATE), '_', DATEPART(ISO_WEEK, Z.PO_DATE)) AS PO_YW,
        SUM(CAST(Z.PO_QTY AS BIGINT)) AS PO_QTY
      FROM ZTBPOTable Z
      LEFT JOIN M110 ON (M110.CUST_CD = Z.CUST_CD AND M110.CTR_CD = Z.CTR_CD)
      GROUP BY 
        Z.CTR_CD,
        Z.CUST_CD,
        ISNULL(M110.CUST_NAME_KD, Z.CUST_CD),
        CAST(Z.PO_DATE AS DATE),
        YEAR(Z.PO_DATE),
        DATEPART(ISO_WEEK, Z.PO_DATE);
    `);
    console.log(`RP_KD_CUSTOMER_PO_WEEKLY nạp xong trong ${(Date.now() - t) / 1000}s`);
  } else {
    console.log(`RP_KD_CUSTOMER_PO_WEEKLY đã có sẵn ${chk6.data[0].CNT} dòng.`);
  }

  console.log("=== HOÀN TẤT MIGRATION BẢNG REPORT KINH DOANH ===");
}

migrateRPKinhDoanh()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
