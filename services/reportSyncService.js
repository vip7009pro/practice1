const { queryDB } = require("../config/database");
const moment = require("moment");

/**
 * Đồng bộ dữ liệu rolling cho toàn bộ 6 bảng Report Kinh Doanh (RP_*)
 * Mặc định đồng bộ từ 60 ngày trước đến hiện tại để đảm bảo mọi phát sinh mới được cập nhật.
 */
const syncRPKinhDoanh = async (days = 60, ctrCd = "002") => {
  try {
    const started = Date.now();
    const fromDate = moment().subtract(days, "days").format("YYYY-MM-DD");
    const toDate = moment().format("YYYY-MM-DD");
    const fromYear = moment().subtract(days, "days").year();

    // 1. Sync RP_KD_DELIVERY_DAILY
    await queryDB(`
      DELETE FROM RP_KD_DELIVERY_DAILY 
      WHERE DELIVERY_DATE >= '${fromDate}' AND CTR_CD = '${ctrCd}';

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
      WHERE ZTBDelivery.DELIVERY_DATE >= '${fromDate}' AND ZTBDelivery.CTR_CD = '${ctrCd}'
      GROUP BY 
        CAST(ZTBDelivery.DELIVERY_DATE AS DATE),
        ZTBDelivery.CTR_CD,
        ZTBDelivery.CUST_CD,
        ISNULL(M110.CUST_NAME_KD, ZTBDelivery.CUST_CD),
        ZTBDelivery.EMPL_NO,
        ISNULL(M010.EMPL_NAME, ZTBDelivery.EMPL_NO),
        CASE WHEN INN.G_CODE IS NOT NULL THEN 1 ELSE 0 END;
    `);

    // 2. Sync RP_KD_OVERDUE_DAILY
    await queryDB(`
      DELETE FROM RP_KD_OVERDUE_DAILY 
      WHERE DELIVERY_DATE >= '${fromDate}' AND CTR_CD = '${ctrCd}';

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
      WHERE ZTBDelivery.DELIVERY_DATE >= '${fromDate}' AND ZTBDelivery.CTR_CD = '${ctrCd}'
      GROUP BY 
        CAST(ZTBDelivery.DELIVERY_DATE AS DATE),
        ZTBDelivery.CTR_CD,
        CASE WHEN ZTBPOTable.RD_DATE < ZTBDelivery.DELIVERY_DATE THEN 'OVER' ELSE 'OK' END,
        ISNULL(DATEDIFF(day, ZTBPOTable.PO_DATE, ZTBPOTable.RD_DATE), 0);
    `);

    // 3. Sync RP_KD_PO_WEEKLY
    await queryDB(`
      DELETE FROM RP_KD_PO_WEEKLY 
      WHERE PO_DATE >= '${fromDate}' AND CTR_CD = '${ctrCd}';

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
      WHERE ZTBPOTable.PO_DATE >= '${fromDate}' AND ZTBPOTable.CTR_CD = '${ctrCd}'
      GROUP BY 
        ZTBPOTable.CTR_CD,
        CAST(ZTBPOTable.PO_DATE AS DATE),
        YEAR(ZTBPOTable.PO_DATE),
        DATEPART(ISOWK, DATEADD(day, 1, ZTBPOTable.PO_DATE)),
        CASE WHEN INN.G_CODE IS NOT NULL THEN 1 ELSE 0 END;
    `);

    // 4. Sync RP_KD_PO_BALANCE_TOTAL (toàn bộ)
    await queryDB(`
      DELETE FROM RP_KD_PO_BALANCE_TOTAL WHERE CTR_CD = '${ctrCd}';

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
        WHERE ZTBPOTable.CTR_CD = '${ctrCd}'
        GROUP BY ZTBPOTable.CTR_CD, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, ZTBPOTable.PO_QTY, ZTBPOTable.PROD_PRICE
      ) AA
      GROUP BY AA.CTR_CD;
    `);

    // 5. Sync RP_KD_PO_BALANCE_WEEKLY (Full Sync toàn bộ để đảm bảo chính xác các PO tồn từ năm cũ và PO mới giao/hủy)
    await queryDB(`
      DELETE FROM RP_KD_PO_BALANCE_WEEKLY WHERE CTR_CD = '${ctrCd}';

      WITH PO_TABLE AS (
        SELECT 
          CTR_CD,
          CUST_CD,
          YEAR(PO_DATE) AS PO_YEAR,
          FORMAT(DATEPART(ISO_WEEK, PO_DATE), 'D2') AS PO_WEEK,
          COUNT(PO_ID) AS PO_COUNT,
          SUM(CAST(PO_QTY AS BIGINT)) AS PO_QTY
        FROM ZTBPOTable
        WHERE CTR_CD = '${ctrCd}'
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
        WHERE ZTBDelivery.CTR_CD = '${ctrCd}'
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

    // 6. Sync RP_KD_CUSTOMER_PO_WEEKLY
    await queryDB(`
      DELETE FROM RP_KD_CUSTOMER_PO_WEEKLY 
      WHERE PO_DATE >= '${fromDate}' AND CTR_CD = '${ctrCd}';

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
      WHERE Z.PO_DATE >= '${fromDate}' AND Z.CTR_CD = '${ctrCd}'
      GROUP BY 
        Z.CTR_CD,
        Z.CUST_CD,
        ISNULL(M110.CUST_NAME_KD, Z.CUST_CD),
        CAST(Z.PO_DATE AS DATE),
        YEAR(Z.PO_DATE),
        DATEPART(ISO_WEEK, Z.PO_DATE);
    `);

    const elapsed = Date.now() - started;

    // Ghi nhận thời điểm đồng bộ vào bảng RP_SYNC_LOG
    await queryDB(`
      MERGE RP_SYNC_LOG AS target
      USING (SELECT 'KINH_DOANH' AS REPORT_CODE) AS source
      ON target.REPORT_CODE = source.REPORT_CODE
      WHEN MATCHED THEN
        UPDATE SET 
          LAST_SYNC_AT = GETDATE(), 
          STATUS = 'OK', 
          DURATION_MS = ${elapsed}, 
          MESSAGE = N'Đồng bộ thành công rolling ${days} ngày cho ${ctrCd}'
      WHEN NOT MATCHED THEN
        INSERT (REPORT_CODE, REPORT_NAME, LAST_SYNC_AT, STATUS, DURATION_MS, MESSAGE)
        VALUES ('KINH_DOANH', N'Báo Cáo Doanh Thu & Chỉ Số Kinh Doanh', GETDATE(), 'OK', ${elapsed}, N'Đồng bộ thành công');
    `);

    console.log(`[ReportSyncService] Đã đồng bộ rolling ${days} ngày cho ${ctrCd} trong ${elapsed}ms`);
    return { status: "OK", message: `Đã đồng bộ rolling ${days} ngày cho ${ctrCd} trong ${elapsed}ms`, duration_ms: elapsed };
  } catch (err) {
    console.error("[ReportSyncService] Lỗi đồng bộ RP Kinh Doanh:", err);
    try {
      await queryDB(`
        MERGE RP_SYNC_LOG AS target
        USING (SELECT 'KINH_DOANH' AS REPORT_CODE) AS source
        ON target.REPORT_CODE = source.REPORT_CODE
        WHEN MATCHED THEN
          UPDATE SET STATUS = 'NG', MESSAGE = N'${String(err?.message || "").replace(/'/g, "''")}';
      `);
    } catch (_) {}
    return { status: "NG", message: err.message };
  }
};

/**
 * Lấy thông tin thời điểm đồng bộ gần nhất của báo cáo
 */
const getReportSyncInfo = async (reportCode = "KINH_DOANH") => {
  try {
    const res = await queryDB(`
      SELECT 
        REPORT_CODE, 
        REPORT_NAME, 
        FORMAT(LAST_SYNC_AT, 'yyyy-MM-dd HH:mm:ss') AS LAST_SYNC_AT,
        STATUS, 
        DURATION_MS, 
        MESSAGE
      FROM RP_SYNC_LOG 
      WHERE REPORT_CODE = '${reportCode}';
    `);
    if (res?.data?.length > 0) {
      return { status: "OK", data: res.data[0] };
    }
    return { status: "OK", data: { REPORT_CODE: reportCode, LAST_SYNC_AT: moment().format('YYYY-MM-DD HH:mm:ss'), STATUS: "OK" } };
  } catch (err) {
    return { status: "NG", message: err.message };
  }
};

/**
 * Danh sách đăng ký các module báo cáo của toàn hệ thống ERP
 * Sau này khi có báo cáo của các bộ phận khác (Sản Xuất, Kho, Mua Hàng, QC...),
 * chỉ cần thêm vào mảng REPORT_REGISTRY này hoặc gọi registerReportSync().
 */
const REPORT_REGISTRY = [
  {
    code: "KINH_DOANH",
    name: "Báo Cáo Doanh Thu & Chỉ Số Kinh Doanh",
    department: "Kinh Doanh",
    minIntervalMinutes: 10, // 10 phút
    syncFn: async (ctrCd = "002") => {
      return await syncRPKinhDoanh(60, ctrCd);
    },
  },
];

/**
 * Đăng ký thêm báo cáo mới vào hệ thống đồng bộ định kỳ
 */
const registerReportSync = (reportConfig) => {
  if (!reportConfig?.code || !reportConfig?.syncFn) {
    throw new Error("Cấu hình báo cáo phải có ít nhất 'code' và 'syncFn'");
  }
  const existingIdx = REPORT_REGISTRY.findIndex((r) => r.code === reportConfig.code);
  if (existingIdx >= 0) {
    REPORT_REGISTRY[existingIdx] = { ...REPORT_REGISTRY[existingIdx], ...reportConfig };
  } else {
    REPORT_REGISTRY.push({
      minIntervalMinutes: 10,
      department: "Chung",
      ...reportConfig,
    });
  }
  console.log(`[ReportSyncRegistry] Đã đăng ký đồng bộ báo cáo: ${reportConfig.code} (${reportConfig.name || ""})`);
};

/**
 * Kiểm tra xem báo cáo đã đủ 10 phút từ lần đồng bộ trước chưa
 * (Kể cả khi restart backend, nếu chưa đủ 10 phút thì vẫn không chạy)
 */
const shouldSyncReport = async (reportCode, minIntervalMinutes = 10) => {
  try {
    const minSeconds = minIntervalMinutes * 60;
    const res = await queryDB(`
      SELECT 
        REPORT_CODE, 
        LAST_SYNC_AT, 
        DATEDIFF(second, LAST_SYNC_AT, GETDATE()) AS ELAPSED_SECONDS
      FROM RP_SYNC_LOG 
      WHERE REPORT_CODE = '${reportCode}';
    `);
    if (!res?.data || res.data.length === 0) {
      // Chưa từng sync bao giờ -> Cần sync ngay
      return { shouldSync: true, elapsedSeconds: null, lastSyncAt: null };
    }
    const elapsed = res.data[0].ELAPSED_SECONDS;
    const lastSyncAt = res.data[0].LAST_SYNC_AT;
    return {
      shouldSync: elapsed === null || elapsed >= minSeconds,
      elapsedSeconds: elapsed,
      lastSyncAt: lastSyncAt,
    };
  } catch (err) {
    console.error(`[ReportSyncScheduler] Lỗi kiểm tra thời gian sync của ${reportCode}:`, err);
    return { shouldSync: true, elapsedSeconds: null, lastSyncAt: null };
  }
};

/**
 * Đồng bộ một báo cáo cụ thể theo mã code
 * @param {string} reportCode - Mã báo cáo (VD: 'KINH_DOANH')
 * @param {object} options - { force: boolean, ctrCd: string }
 */
const syncReportByCode = async (reportCode, options = { force: false, ctrCd: "002" }) => {
  const config = REPORT_REGISTRY.find((r) => r.code === reportCode);
  if (!config) {
    return { status: "NG", message: `Không tìm thấy cấu hình báo cáo với mã '${reportCode}'` };
  }
  const minMinutes = config.minIntervalMinutes || 10;
  if (!options.force) {
    const check = await shouldSyncReport(reportCode, minMinutes);
    if (!check.shouldSync) {
      const elapsedMin = (check.elapsedSeconds / 60).toFixed(1);
      console.log(`[ReportSyncScheduler] Báo cáo ${reportCode} vừa cập nhật cách đây ${elapsedMin} phút (< ${minMinutes} phút). Bỏ qua.`);
      return {
        status: "SKIPPED",
        message: `Chưa đủ ${minMinutes} phút từ lần cập nhật trước (mới được ${elapsedMin} phút)`,
        elapsedSeconds: check.elapsedSeconds,
      };
    }
  }

  console.log(`[ReportSyncScheduler] Bắt đầu đồng bộ báo cáo ${reportCode} (force=${!!options.force})...`);
  return await config.syncFn(options.ctrCd || "002");
};

/**
 * Đồng bộ tất cả các báo cáo trong registry
 * @param {object} options - { force: boolean, ctrCd: string }
 */
const syncAllReports = async (options = { force: false, ctrCd: "002" }) => {
  const results = [];
  for (const item of REPORT_REGISTRY) {
    try {
      const r = await syncReportByCode(item.code, options);
      results.push({ code: item.code, ...r });
    } catch (e) {
      console.error(`[ReportSyncScheduler] Lỗi khi đồng bộ ${item.code}:`, e);
      results.push({ code: item.code, status: "NG", message: e.message });
    }
  }
  return results;
};

let syncTimer = null;

/**
 * Khởi động background scheduler tự động đồng bộ định kỳ
 * - Chu kỳ kiểm tra: mỗi 60 giây (1 phút).
 * - Kiểm tra trong DB nếu báo cáo nào đã đủ 10 phút từ lần sync trước mới chạy.
 * - Kể cả khi restart backend: Chạy kiểm tra sau 15 giây, nếu DB báo chưa đủ 10 phút thì BỎ QUA.
 */
const startReportSyncScheduler = (defaultIntervalMinutes = 10) => {
  const checkIntervalMs = 60 * 1000; // Kiểm tra mỗi 1 phút

  const runCheck = async () => {
    try {
      await syncAllReports({ force: false, ctrCd: "002" });
    } catch (e) {
      console.error("[ReportSyncScheduler] Lỗi định kỳ:", e?.message || e);
    }
  };

  // Kiểm tra lần đầu sau khi server khởi động 15 giây (chờ DB pool sẵn sàng)
  setTimeout(runCheck, 15000);

  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(runCheck, checkIntervalMs);

  console.log(`[ReportSyncScheduler] Đã kích hoạt bộ lập lịch đồng bộ báo cáo ERP (chu kỳ kiểm tra: 60s, định mức refresh: ${defaultIntervalMinutes} phút).`);

  return {
    stop: () => {
      if (syncTimer) clearInterval(syncTimer);
      syncTimer = null;
      console.log("[ReportSyncScheduler] Đã dừng scheduler.");
    },
    syncNow: async (reportCode, ctrCd = "002") => {
      if (reportCode) {
        return await syncReportByCode(reportCode, { force: true, ctrCd });
      }
      return await syncAllReports({ force: true, ctrCd });
    }
  };
};

module.exports = {
  syncRPKinhDoanh,
  getReportSyncInfo,
  startReportSyncScheduler,
  syncReportByCode,
  syncAllReports,
  registerReportSync,
  shouldSyncReport,
  REPORT_REGISTRY,
};
