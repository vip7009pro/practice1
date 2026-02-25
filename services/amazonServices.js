const { openConnection } = require('../config/database');
const { checkPermission } = require('../utils/permissionUtils');
const sql = require('mssql');

const truncateString = (value, maxLen) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen);
};

exports.insertData_Amazon_SuperFast = async (req, res, DATA) => {
  console.log('[AMZ][insertData_Amazon_SuperFast] start');
  if (!(await checkPermission(req.payload_data, ['KD', 'RND'], ['Leader', 'ADMIN', 'Dept Staff'], ['ALL']))) {
    console.log('[AMZ][insertData_Amazon_SuperFast] permission denied');
    return res.send({ tk_status: 'NG', message: 'Permission insufficent' });
  }

  const EMPL_NO = req.payload_data['EMPL_NO'];
  const uploadAmazonData = DATA.AMZDATA;

  if (!DATA || !DATA.CTR_CD) {
    console.log('[AMZ][insertData_Amazon_SuperFast] missing CTR_CD', { CTR_CD: DATA?.CTR_CD });
    return res.send({ tk_status: 'NG', message: 'Missing CTR_CD' });
  }

  console.log('[AMZ][insertData_Amazon_SuperFast] meta', {
    CTR_CD: DATA.CTR_CD,
    EMPL_NO,
    rows: Array.isArray(uploadAmazonData) ? uploadAmazonData.length : null,
  });

  if (Array.isArray(uploadAmazonData) && uploadAmazonData.length > 0) {
    const sample = uploadAmazonData[0] ?? {};
    console.log('[AMZ][insertData_Amazon_SuperFast] sample0', {
      G_CODE: sample.G_CODE,
      PROD_REQUEST_NO: sample.PROD_REQUEST_NO,
      NO_IN: sample.NO_IN,
      ROW_NO: sample.ROW_NO,
      DATA1_len: typeof sample.DATA1 === 'string' ? sample.DATA1.length : null,
      DATA2_len: typeof sample.DATA2 === 'string' ? sample.DATA2.length : null,
    });
  }

  if (!Array.isArray(uploadAmazonData) || uploadAmazonData.length === 0) {
    return res.send({ tk_status: 'NG', message: 'AMZDATA empty' });
  }

  const pool = await openConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const table = new sql.Table('AMAZONE_DATA');
    table.create = false;

    table.columns.add('CTR_CD', sql.VarChar(3), { nullable: true });
    table.columns.add('G_CODE', sql.VarChar(10), { nullable: false });
    table.columns.add('PROD_REQUEST_NO', sql.VarChar(10), { nullable: false });
    table.columns.add('NO_IN', sql.VarChar(50), { nullable: false });
    table.columns.add('ROW_NO', sql.Int, { nullable: false });
    table.columns.add('DATA_1', sql.VarChar(100), { nullable: false });
    table.columns.add('DATA_2', sql.VarChar(100), { nullable: false });
    table.columns.add('DATA_3', sql.VarChar(100), { nullable: false });
    table.columns.add('DATA_4', sql.VarChar(100), { nullable: false });
    table.columns.add('PRINT_STATUS', sql.VarChar(2), { nullable: true });
    table.columns.add('INLAI_COUNT', sql.Int, { nullable: true });
    table.columns.add('REMARK', sql.VarChar(200), { nullable: true });
    table.columns.add('INS_DATE', sql.DateTime, { nullable: true });
    table.columns.add('INS_EMPL', sql.VarChar(10), { nullable: true });
    table.columns.add('UPD_DATE', sql.DateTime, { nullable: true });
    table.columns.add('UPD_EMPL', sql.VarChar(10), { nullable: true });

    const now = new Date();

    for (let i = 0; i < uploadAmazonData.length; i++) {
      const item = uploadAmazonData[i] ?? {};

      const rowNoRaw = item.ROW_NO;
      const rowNo = rowNoRaw === undefined || rowNoRaw === null || rowNoRaw === '' ? null : Number(rowNoRaw);
      if (rowNo === null || Number.isNaN(rowNo)) {
        console.log('[AMZ][insertData_Amazon_SuperFast] invalid ROW_NO', { index: i, ROW_NO: rowNoRaw });
        throw new Error(`Invalid ROW_NO at index ${i}`);
      }

      const data1 = truncateString(item.DATA_1 ?? '', 100);
      const data2 = truncateString(item.DATA_2 ?? '', 100);
      const data3 = truncateString(item.DATA_3 ?? '', 100);
      const data4 = truncateString(item.DATA_4 ?? '', 100);
      const remark = truncateString(item.REMARK ?? '', 200);

      if (typeof item.DATA_1 === 'string' && item.DATA_1.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA_1', { index: i, len: item.DATA_1.length });
      }
      if (typeof item.DATA_2 === 'string' && item.DATA_2.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA_2', { index: i, len: item.DATA_2.length });
      }
      if (typeof item.DATA_3 === 'string' && item.DATA_3.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA_3', { index: i, len: item.DATA_3.length });
      }
      if (typeof item.DATA_4 === 'string' && item.DATA_4.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA_4', { index: i, len: item.DATA_4.length });
      }
      if (typeof item.REMARK === 'string' && item.REMARK.length > 200) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate REMARK', { index: i, len: item.REMARK.length });
      }

      table.rows.add(
        truncateString(DATA.CTR_CD, 3),
        truncateString(item.G_CODE, 10),
        truncateString(item.PROD_REQUEST_NO, 10),
        truncateString(item.NO_IN, 50),
        rowNo,
        data1,
        data2,
        data3,
        data4,
        truncateString(item.PRINT_STATUS ?? 'OK', 2),
        item.INLAI_COUNT === undefined || item.INLAI_COUNT === null || item.INLAI_COUNT === '' ? 0 : Number(item.INLAI_COUNT),
        remark,
        now,
        truncateString(EMPL_NO, 10),
        now,
        truncateString(EMPL_NO, 10)
      );
    }

    const request = new sql.Request(transaction);
    const result = await request.bulk(table);
    console.log('[AMZ][insertData_Amazon_SuperFast] bulk result', {
      rowsAffected: result?.rowsAffected,
    });

    const verifyReq = new sql.Request(transaction);
    verifyReq.input('CTR_CD', sql.VarChar(10), DATA.CTR_CD);
    verifyReq.input('INS_EMPL', sql.VarChar(20), EMPL_NO);
    verifyReq.input('FROM_DATE', sql.DateTime, now);
    const verifySql = `
      SELECT COUNT(*) AS CNT
      FROM AMAZONE_DATA WITH (NOLOCK)
      WHERE CTR_CD = @CTR_CD
        AND INS_EMPL = @INS_EMPL
        AND INS_DATE >= @FROM_DATE
    `;
    const verifyResult = await verifyReq.query(verifySql);
    const verifyCount = verifyResult?.recordset?.[0]?.CNT ?? null;
    console.log('[AMZ][insertData_Amazon_SuperFast] verify', {
      verifyCount,
      fromDate: now,
    });

    await transaction.commit();
    res.send({
      tk_status: 'OK',
      result,
      debug: {
        rowsSent: uploadAmazonData.length,
        rowsAffected: result?.rowsAffected,
        verifyCount,
        fromDate: now,
        CTR_CD: DATA.CTR_CD,
        INS_EMPL: EMPL_NO,
      },
    });
  } catch (err) {
    console.log('[AMZ][insertData_Amazon_SuperFast] error', {
      message: err?.message,
      stack: err?.stack,
    });
    try {
      await transaction.rollback();
    } catch (e) {
      console.log('[AMZ][insertData_Amazon_SuperFast] rollback error', {
        message: e?.message,
      });
    }
    res.send({ tk_status: 'NG', message: err.message });
  }
};
