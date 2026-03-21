const moment = require('moment');
const { queryDB_New } = require('../config/database');

const TRIAL_DAYS = 7;
const LIFETIME_PRODUCT_ID = 'scan_lifetime';
const PRODUCT_DAYS = {
  scan_monthly: 30,
  scan_yearly: 365,
};

async function ensureTable() {
  // Best-effort create table if missing (SQL Server)
  const query = `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ZTB_MOBILE_SUBSCRIPTION]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[ZTB_MOBILE_SUBSCRIPTION] (
    [CTR_CD] NVARCHAR(10) NOT NULL,
    [COMPANY] NVARCHAR(10) NOT NULL,
    [DEVICE_ID] NVARCHAR(200) NOT NULL,
    [TRIAL_START] DATETIME NULL,
    [ACTIVE_UNTIL] DATETIME NULL,
    [PRODUCT_ID] NVARCHAR(100) NULL,
    [PURCHASE_TOKEN] NVARCHAR(4000) NULL,
    [UPDATED_AT] DATETIME NOT NULL DEFAULT(GETDATE()),
    CONSTRAINT [PK_ZTB_MOBILE_SUBSCRIPTION] PRIMARY KEY CLUSTERED ([CTR_CD], [COMPANY], [DEVICE_ID])
  );
END

-- If table exists from an older version, add DEVICE_ID column if missing.
IF OBJECT_ID(N'[dbo].[ZTB_MOBILE_SUBSCRIPTION]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('ZTB_MOBILE_SUBSCRIPTION', 'DEVICE_ID') IS NULL
  BEGIN
    ALTER TABLE [dbo].[ZTB_MOBILE_SUBSCRIPTION] ADD [DEVICE_ID] NVARCHAR(200) NULL;
  END
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_ZTB_MOBILE_SUBSCRIPTION_DEVICE_ID' 
      AND object_id = OBJECT_ID(N'[dbo].[ZTB_MOBILE_SUBSCRIPTION]')
  )
  BEGIN
    CREATE INDEX [IX_ZTB_MOBILE_SUBSCRIPTION_DEVICE_ID] ON [dbo].[ZTB_MOBILE_SUBSCRIPTION] ([DEVICE_ID]);
  END
END
`;
  // queryDB_New expects at least 1 row affected to return OK, so we ignore its tk_status here.
  try {
    await queryDB_New(query, {});
  } catch (_) {
    // ignore
  }
}

async function getOrCreateTrial({ CTR_CD, COMPANY, DEVICE_ID }) {
  await ensureTable();

  const selectQuery = `
SELECT TOP 1 CTR_CD, COMPANY, DEVICE_ID, TRIAL_START, ACTIVE_UNTIL, PRODUCT_ID
FROM ZTB_MOBILE_SUBSCRIPTION
WHERE CTR_CD = @CTR_CD AND COMPANY = @COMPANY AND DEVICE_ID = @DEVICE_ID
`;
  const selectRes = await queryDB_New(selectQuery, { CTR_CD, COMPANY, DEVICE_ID });

  if (selectRes.tk_status === 'OK' && Array.isArray(selectRes.data) && selectRes.data.length > 0) {
    const row = selectRes.data[0];
    const activeUntil = row.ACTIVE_UNTIL ? new Date(row.ACTIVE_UNTIL) : null;
    const lifetime = String(row.PRODUCT_ID || '') === LIFETIME_PRODUCT_ID && !row.ACTIVE_UNTIL;
    const trialStart = row.TRIAL_START ? new Date(row.TRIAL_START) : null;
    const productId = row.PRODUCT_ID ? String(row.PRODUCT_ID) : null;
    return { activeUntil, lifetime, trialStart, productId };
  }

  const trialStart = new Date();
  const activeUntil = moment(trialStart).add(TRIAL_DAYS, 'days').toDate();

  const insertQuery = `
INSERT INTO ZTB_MOBILE_SUBSCRIPTION (CTR_CD, COMPANY, DEVICE_ID, TRIAL_START, ACTIVE_UNTIL, UPDATED_AT)
VALUES (@CTR_CD, @COMPANY, @DEVICE_ID, @TRIAL_START, @ACTIVE_UNTIL, GETDATE())
`;
  await queryDB_New(insertQuery, {
    CTR_CD,
    COMPANY,
    DEVICE_ID,
    TRIAL_START: trialStart,
    ACTIVE_UNTIL: activeUntil,
  });

  return { activeUntil, lifetime: false, trialStart, productId: null };
}

async function getActiveUntil({ CTR_CD, COMPANY, DEVICE_ID }) {
  await ensureTable();
  const selectQuery = `
SELECT TOP 1 ACTIVE_UNTIL
FROM ZTB_MOBILE_SUBSCRIPTION
WHERE CTR_CD = @CTR_CD AND COMPANY = @COMPANY AND DEVICE_ID = @DEVICE_ID
`;
  const res = await queryDB_New(selectQuery, { CTR_CD, COMPANY, DEVICE_ID });
  if (res.tk_status !== 'OK' || !Array.isArray(res.data) || res.data.length === 0) return null;
  const v = res.data[0].ACTIVE_UNTIL;
  return v ? new Date(v) : null;
}

async function upsertActiveUntil({ CTR_CD, COMPANY, DEVICE_ID, activeUntil, productId, purchaseToken }) {
  await ensureTable();

  const updateQuery = `
IF EXISTS (SELECT 1 FROM ZTB_MOBILE_SUBSCRIPTION WHERE CTR_CD=@CTR_CD AND COMPANY=@COMPANY AND DEVICE_ID=@DEVICE_ID)
BEGIN
  UPDATE ZTB_MOBILE_SUBSCRIPTION
  SET ACTIVE_UNTIL=@ACTIVE_UNTIL,
      PRODUCT_ID=@PRODUCT_ID,
      PURCHASE_TOKEN=@PURCHASE_TOKEN,
      UPDATED_AT=GETDATE()
  WHERE CTR_CD=@CTR_CD AND COMPANY=@COMPANY AND DEVICE_ID=@DEVICE_ID
END
ELSE
BEGIN
  INSERT INTO ZTB_MOBILE_SUBSCRIPTION (CTR_CD, COMPANY, DEVICE_ID, TRIAL_START, ACTIVE_UNTIL, PRODUCT_ID, PURCHASE_TOKEN, UPDATED_AT)
  VALUES (@CTR_CD, @COMPANY, @DEVICE_ID, NULL, @ACTIVE_UNTIL, @PRODUCT_ID, @PURCHASE_TOKEN, GETDATE())
END
`;

  await queryDB_New(updateQuery, {
    CTR_CD,
    COMPANY,
    DEVICE_ID,
    ACTIVE_UNTIL: activeUntil,
    PRODUCT_ID: productId,
    PURCHASE_TOKEN: purchaseToken,
  });
}

exports.subscription_status = async (req, res, DATA) => {
  try {
    const DEVICE_ID = DATA.deviceId;
    if (!DEVICE_ID) return res.send({ tk_status: 'NG', message: 'Missing deviceId' });

    const CTR_CD = DATA.CTR_CD;
    const COMPANY = DATA.COMPANY;

    console.log('[subscription_status] req', {
      CTR_CD,
      COMPANY,
      DEVICE_ID,
    });

    const status = await getOrCreateTrial({ CTR_CD, COMPANY, DEVICE_ID });

    console.log('[subscription_status] res', {
      activeUntil: status.activeUntil ? status.activeUntil.toISOString() : null,
      lifetime: !!status.lifetime,
      trialStart: status.trialStart ? status.trialStart.toISOString() : null,
      productId: status.productId,
    });

    res.send({
      tk_status: 'OK',
      activeUntil: status.activeUntil ? status.activeUntil.toISOString() : null,
      lifetime: !!status.lifetime,
      trialStart: status.trialStart ? status.trialStart.toISOString() : null,
      productId: status.productId,
    });
  } catch (e) {
    console.log('[subscription_status] error', e);
    res.send({ tk_status: 'NG', message: e.toString() });
  }
};

exports.subscription_verify = async (req, res, DATA) => {
  try {
    const DEVICE_ID = DATA.deviceId;
    if (!DEVICE_ID) return res.send({ tk_status: 'NG', message: 'Missing deviceId' });

    const CTR_CD = DATA.CTR_CD;
    const COMPANY = DATA.COMPANY;

    const productId = DATA.productId;
    const purchaseToken = DATA.purchaseToken;

    if (!productId || !purchaseToken) {
      return res.send({ tk_status: 'NG', message: 'Missing productId/purchaseToken' });
    }

    if (String(productId) === LIFETIME_PRODUCT_ID) {
      await upsertActiveUntil({
        CTR_CD,
        COMPANY,
        DEVICE_ID,
        activeUntil: null,
        productId,
        purchaseToken,
      });

      return res.send({ tk_status: 'OK', activeUntil: null, lifetime: true, productId: String(productId) });
    }

    const addDays = PRODUCT_DAYS[String(productId)] ?? 0;
    if (addDays <= 0) {
      return res.send({ tk_status: 'NG', message: `Unsupported productId: ${productId}` });
    }

    const currentUntil = await getActiveUntil({ CTR_CD, COMPANY, DEVICE_ID });
    const base = currentUntil && currentUntil > new Date() ? currentUntil : new Date();
    const activeUntil = moment(base).add(addDays, 'days').toDate();

    await upsertActiveUntil({
      CTR_CD,
      COMPANY,
      DEVICE_ID,
      activeUntil,
      productId,
      purchaseToken,
    });

    res.send({
      tk_status: 'OK',
      activeUntil: activeUntil.toISOString(),
      lifetime: false,
      productId: String(productId),
    });
  } catch (e) {
    res.send({ tk_status: 'NG', message: e.toString() });
  }
};
