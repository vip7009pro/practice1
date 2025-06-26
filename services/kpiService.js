const { queryDB_New } = require("../config/database");
const moment = require("moment");

exports.loadKPI = async (req, res, DATA) => {
  let condition = "";
  if (DATA.KPI_NAME !== "ALL") condition += ` AND KPI_NAME = '${DATA.KPI_NAME}'`;
  let query = `SELECT * FROM ZTB_KPI_TB WHERE CTR_CD = @CTR_CD ${condition}`;
  let params = { CTR_CD: DATA.CTR_CD};
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};
exports.loadKPIList = async (req, res, DATA) => {
  let query = `SELECT DISTINCT KPI_NAME FROM ZTB_KPI_TB WHERE CTR_CD = @CTR_CD`;
  let params = { CTR_CD: DATA.CTR_CD};
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};

exports.insertKPI = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let KPI_DATA = DATA.KPI_DATA; //array
  let queries = [];
  for (let i = 0; i < KPI_DATA.length; i++) {
    let element = KPI_DATA[i];
    queries.push(`INSERT INTO ZTB_KPI_TB (CTR_CD,KPI_NAME,KPI_YEAR,KPI_PERIOD,KPI_MONTH,KPI_VALUE,VALUE_TYPE,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL) VALUES (@CTR_CD_${i}, @KPI_NAME_${i}, @KPI_YEAR_${i}, @KPI_PERIOD_${i}, @KPI_MONTH_${i}, @KPI_VALUE_${i}, @VALUE_TYPE_${i}, GETDATE(), @INS_EMPL_${i}, GETDATE(), @UPD_EMPL_${i})`);
  }
  let query = queries.join(";");
  //console.log(query);
  let params = {};
  for (let i = 0; i < KPI_DATA.length; i++) {
    let element = KPI_DATA[i];
    params[`CTR_CD_${i}`] = DATA.CTR_CD;
    params[`KPI_NAME_${i}`] = element.KPI_NAME;
    params[`KPI_YEAR_${i}`] = element.KPI_YEAR;
    params[`KPI_PERIOD_${i}`] = element.KPI_PERIOD;
    params[`KPI_MONTH_${i}`] = element.KPI_MONTH;
    params[`KPI_VALUE_${i}`] = element.KPI_VALUE;
    params[`VALUE_TYPE_${i}`] = element.VALUE_TYPE;
    params[`INS_DATE_${i}`] = element.INS_DATE;
    params[`INS_EMPL_${i}`] = EMPL_NO;
    params[`UPD_DATE_${i}`] = element.UPD_DATE;
    params[`UPD_EMPL_${i}`] = EMPL_NO;
  }
  let kqua = await queryDB_New(query, params);
  res.send(kq);
};

exports.updateKPI = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let KPI_DATA = DATA.KPI_DATA; //array
  let queries = [];
  for (let i = 0; i < KPI_DATA.length; i++) {
    let element = KPI_DATA[i];
    queries.push(`UPDATE ZTB_KPI_TB SET KPI_NAME = @KPI_NAME_${i}, KPI_YEAR = @KPI_YEAR_${i}, KPI_PERIOD = @KPI_PERIOD_${i}, KPI_MONTH = @KPI_MONTH_${i}, KPI_VALUE = @KPI_VALUE_${i}, VALUE_TYPE = @VALUE_TYPE_${i}, UPD_DATE = GETDATE(), UPD_EMPL = @UPD_EMPL_${i} WHERE CTR_CD = @CTR_CD_${i} AND KPI_NAME = @KPI_NAME_${i} AND KPI_YEAR = @KPI_YEAR_${i} AND KPI_PERIOD = @KPI_PERIOD_${i} AND KPI_MONTH = @KPI_MONTH_${i}`);
  }
  let query = queries.join(";");
  let params = {};
  for (let i = 0; i < KPI_DATA.length; i++) {
    let element = KPI_DATA[i];
    params[`CTR_CD_${i}`] = DATA.CTR_CD;
    params[`KPI_NAME_${i}`] = element.KPI_NAME;
    params[`KPI_YEAR_${i}`] = element.KPI_YEAR;
    params[`KPI_PERIOD_${i}`] = element.KPI_PERIOD;
    params[`KPI_MONTH_${i}`] = element.KPI_MONTH;
    params[`KPI_VALUE_${i}`] = element.KPI_VALUE;
    params[`VALUE_TYPE_${i}`] = element.VALUE_TYPE;
    params[`UPD_DATE_${i}`] = element.UPD_DATE;
    params[`UPD_EMPL_${i}`] = EMPL_NO;
  }
  let kq = await queryDB_New(query, params);
  res.send(kq);
};

exports.deleteKPI = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let query = `DELETE FROM ZTB_KPI_TB WHERE CTR_CD = @CTR_CD AND KPI_NAME = @KPI_NAME AND KPI_YEAR = @KPI_YEAR AND KPI_PERIOD = @KPI_PERIOD`;
  let params = { CTR_CD: DATA.CTR_CD, KPI_NAME: DATA.KPI_NAME, KPI_YEAR: DATA.KPI_YEAR, KPI_PERIOD: DATA.KPI_PERIOD};
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};  