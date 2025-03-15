const { queryDB } = require("../config/database");
const moment = require("moment");
exports.workdaycheck = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(EMPL_NO) AS WORK_DAY FROM ZTBATTENDANCETB WHERE CTR_CD='${DATA.CTR_CD}' AND EMPL_NO='${EMPL_NO}' AND ON_OFF=1 AND APPLY_DATE >='${startOfYear}' `;
  ////console.log(query);
  let kqua = await queryDB(query);
  res.send(kqua);
};
exports.tangcadaycheck = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(EMPL_NO) AS TANGCA_DAY FROM ZTBATTENDANCETB WHERE CTR_CD='${DATA.CTR_CD}' AND EMPL_NO='${EMPL_NO}' AND ON_OFF=1 AND APPLY_DATE >='${startOfYear}' AND OVERTIME=1`;
  ////console.log(query);
  let kqua = await queryDB(query);
  res.send(kqua);
};
exports.countxacnhanchamcong = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(XACNHAN) AS COUTNXN FROM ZTBATTENDANCETB WHERE CTR_CD='${DATA.CTR_CD}' AND EMPL_NO='${EMPL_NO}' AND XACNHAN is not null AND APPLY_DATE >='${startOfYear}' `;
  ////console.log(query);
  let kqua = await queryDB(query);
  res.send(kqua);
};
exports.countthuongphat = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let querythuong = `SELECT TP_EMPL_NO, SUM(CASE WHEN PL_HINHTHUC='KT' THEN isnull(DIEM,0) ELSE 0 END) AS THUONG, SUM(CASE WHEN PL_HINHTHUC='KL' THEN isnull(DIEM,0)  ELSE 0 END) AS PHAT FROM ZTBTHUONGPHATTB WHERE CTR_CD='${DATA.CTR_CD}' AND TP_EMPL_NO='${EMPL_NO}' GROUP BY TP_EMPL_NO`;
  ////console.log(query);
  let kqua = await queryDB(querythuong);
  res.send(kqua);
};
exports.checkWebVer = async (req, res, DATA) => {
  let setpdQuery = `SELECT VERWEB, VERMOBILE FROM ZBTVERTABLE`;
  let checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
};
exports.nghidaycheck = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(EMPL_NO) AS NGHI_DAY FROM ZTBOFFREGISTRATIONTB WHERE CTR_CD='${DATA.CTR_CD}' AND EMPL_NO = '${EMPL_NO}' AND APPLY_DATE >= '${startOfYear}' AND REASON_CODE <>2`;
  ////console.log(query);
  let kqua = await queryDB(query);
  res.send(kqua);
};
exports.checkLicense = async (req, res, DATA) => {
  let CURRENT_API_URL = 'https://script.google.com/macros/s/AKfycbyD_LRqVLETu8IvuiqDSsbItdmzRw3p_q9gCv12UOer0V-5OnqtbJvKjK86bfgGbUM1NA/exec'
  fetch(CURRENT_API_URL)
    .then(res => res.json())
    .then(body => {
      let resp = body;
      //console.log(resp);
      let fil = resp.filter((e) => e[0] === DATA.COMPANY)
      if (fil.length = 0) {
        res.send({ tk_status: 'NG', message: 'Chưa có license !' });
      }
      else {
        let fil = resp.filter((e) => e[0] === DATA.COMPANY)
        let now = moment();
        let exp_date = moment(fil[0][1]);
        if (now >= exp_date) {
          res.send({ tk_status: 'NG', message: 'Hết hạn sử dụng' });
        }
        else {
          res.send({ tk_status: 'OK', message: 'Còn hạn sử dụng' });
        }
      }
    })
    .catch((e) => {
      //res.send({ tk_status: 'OK', message: 'Còn hạn sử dụng' });
      res.send({ tk_status: 'NG', message: 'Kiểm tra license thất bại !' + e });
    })
};
