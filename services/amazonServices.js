const { openDedicatedConnection, formatSqlValue } = require('../config/database');
const { checkPermission } = require('../utils/permissionUtils');

const BATCH_SIZE = parseInt(process.env.AMAZON_BULK_BATCH_SIZE || '200', 10) || 200;

const columns = [
  'CTR_CD',
  'G_CODE',
  'PROD_REQUEST_NO',
  'NO_IN',
  'ROW_NO',
  'DATA_1',
  'DATA_2',
  'DATA_3',
  'DATA_4',
  'PRINT_STATUS',
  'INLAI_COUNT',
  'REMARK',
  'INS_DATE',
  'INS_EMPL',
  'UPD_DATE',
  'UPD_EMPL',
];

const truncateString = (value, maxLen) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen);
};

const buildRowValues = (row) => [
  truncateString(row.CTR_CD, 3),
  truncateString(row.G_CODE, 10),
  truncateString(row.PROD_REQUEST_NO, 10),
  truncateString(row.NO_IN, 50),
  row.ROW_NO,
  row.DATA_1,
  row.DATA_2,
  row.DATA_3,
  row.DATA_4,
  row.PRINT_STATUS,
  row.INLAI_COUNT,
  row.REMARK,
  row.INS_DATE,
  row.INS_EMPL,
  row.UPD_DATE,
  row.UPD_EMPL,
];

const buildInsertSql = (rows) => {
  const values = rows
    .map((row) => `(${buildRowValues(row).map((value) => formatSqlValue(value)).join(', ')})`)
    .join(',\n');

  return `
    INSERT INTO AMAZONE_DATA (${columns.join(', ')})
    VALUES
    ${values}
  `;
};

exports.insertData_Amazon_SuperFast = async (req, res, DATA) => {
  console.log('DATA AMZ', DATA);
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

  const connection = await openDedicatedConnection();
  const now = new Date();
  const normalizedRows = [];

  try {
    for (let i = 0; i < uploadAmazonData.length; i++) {
      const item = uploadAmazonData[i] ?? {};

      const rowNoRaw = item.ROW_NO;
      const rowNo = rowNoRaw === undefined || rowNoRaw === null || rowNoRaw === '' ? null : Number(rowNoRaw);
      if (rowNo === null || Number.isNaN(rowNo)) {
        console.log('[AMZ][insertData_Amazon_SuperFast] invalid ROW_NO', { index: i, ROW_NO: rowNoRaw });
        throw new Error(`Invalid ROW_NO at index ${i}`);
      }

      const data1 = truncateString(item.DATA1 ?? '', 100);
      const data2 = truncateString(item.DATA2 ?? '', 100);
      const data3 = truncateString(item.DATA3 ?? '', 100);
      const data4 = truncateString(item.DATA4 ?? '', 100);
      const remark = truncateString(item.REMARK ?? '', 200);

      if (typeof item.DATA1 === 'string' && item.DATA1.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA1', { index: i, len: item.DATA1.length });
      }
      if (typeof item.DATA2 === 'string' && item.DATA2.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA2', { index: i, len: item.DATA2.length });
      }
      if (typeof item.DATA3 === 'string' && item.DATA3.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA3', { index: i, len: item.DATA3.length });
      }
      if (typeof item.DATA4 === 'string' && item.DATA4.length > 100) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate DATA4', { index: i, len: item.DATA4.length });
      }
      if (typeof item.REMARK === 'string' && item.REMARK.length > 200) {
        console.log('[AMZ][insertData_Amazon_SuperFast] truncate REMARK', { index: i, len: item.REMARK.length });
      }

      normalizedRows.push({
        CTR_CD: truncateString(DATA.CTR_CD, 3),
        G_CODE: truncateString(item.G_CODE, 10),
        PROD_REQUEST_NO: truncateString(item.PROD_REQUEST_NO, 10),
        NO_IN: truncateString(item.NO_IN, 50),
        ROW_NO: rowNo,
        DATA_1: data1,
        DATA_2: data2,
        DATA_3: data3,
        DATA_4: data4,
        PRINT_STATUS: truncateString(item.PRINT_STATUS ?? 'OK', 2),
        INLAI_COUNT: item.INLAI_COUNT === undefined || item.INLAI_COUNT === null || item.INLAI_COUNT === '' ? 0 : Number(item.INLAI_COUNT),
        REMARK: remark,
        INS_DATE: now,
        INS_EMPL: truncateString(EMPL_NO, 10),
        UPD_DATE: now,
        UPD_EMPL: truncateString(EMPL_NO, 10),
      });
    }

    await connection.promises.beginTransaction();

    let totalInserted = 0;
    for (let index = 0; index < normalizedRows.length; index += BATCH_SIZE) {
      const batch = normalizedRows.slice(index, index + BATCH_SIZE);
      console.log('[AMZ][insertData_Amazon_SuperFast] batch insert', {
        batchIndex: Math.floor(index / BATCH_SIZE),
        batchSize: batch.length,
      });
      await connection.promises.query(buildInsertSql(batch));
      totalInserted += batch.length;
    }

    const verifySql = `
      SELECT COUNT(*) AS CNT
      FROM AMAZONE_DATA WITH (NOLOCK)
      WHERE CTR_CD = ${formatSqlValue(truncateString(DATA.CTR_CD, 3))}
        AND INS_EMPL = ${formatSqlValue(truncateString(EMPL_NO, 10))}
        AND INS_DATE >= ${formatSqlValue(now)}
    `;
    const verifyResult = await connection.promises.query(verifySql);
    const verifyCount = verifyResult?.results?.[0]?.[0]?.CNT ?? null;
    console.log('[AMZ][insertData_Amazon_SuperFast] verify', {
      verifyCount,
      fromDate: now,
    });

    await connection.promises.commit();
    res.send({
      tk_status: 'OK',
      result: {
        rowsAffected: [totalInserted],
      },
      debug: {
        rowsSent: uploadAmazonData.length,
        rowsAffected: [totalInserted],
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
      await connection.promises.rollback();
    } catch (e) {
      console.log('[AMZ][insertData_Amazon_SuperFast] rollback error', {
        message: e?.message,
      });
    }
    res.send({ tk_status: 'NG', message: err.message });
  } finally {
    try {
      await connection.promises.close();
    } catch (e) {
      console.log('[AMZ][insertData_Amazon_SuperFast] close error', {
        message: e?.message,
      });
    }
  }
};
