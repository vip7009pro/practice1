const { queryDB_New } = require("../config/database");
const moment = require("moment");

exports.loadKPI = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_KPI_TB WHERE CTR_CD = @CTR_CD AND KPI_NAME= @KPI_NAME`;
  let params = { CTR_CD: DATA.CTR_CD, KPI_NAME: DATA.KPI_NAME};
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};

