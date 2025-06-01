const { queryDB_New } = require("../config/database");
const moment = require("moment");
const https = require('https');
const { default: axios } = require("axios");

exports.workdaycheck = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(EMPL_NO) AS WORK_DAY FROM ZTBATTENDANCETB WHERE CTR_CD=@ctr_cd AND EMPL_NO=@empl_no AND ON_OFF=1 AND APPLY_DATE >=@start_of_year`;
  let params = { ctr_cd: DATA.CTR_CD, empl_no: EMPL_NO, start_of_year: startOfYear };
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};

exports.tangcadaycheck = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(EMPL_NO) AS TANGCA_DAY FROM ZTBATTENDANCETB WHERE CTR_CD=@ctr_cd AND EMPL_NO=@empl_no AND ON_OFF=1 AND APPLY_DATE >=@start_of_year AND OVERTIME=1`;
  let params = { ctr_cd: DATA.CTR_CD, empl_no: EMPL_NO, start_of_year: startOfYear };
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};

exports.countxacnhanchamcong = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(XACNHAN) AS COUTNXN FROM ZTBATTENDANCETB WHERE CTR_CD=@ctr_cd AND EMPL_NO=@empl_no AND XACNHAN is not null AND APPLY_DATE >=@start_of_year`;
  let params = { ctr_cd: DATA.CTR_CD, empl_no: EMPL_NO, start_of_year: startOfYear };
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};

exports.countthuongphat = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let querythuong = `SELECT TP_EMPL_NO, SUM(CASE WHEN PL_HINHTHUC='KT' THEN isnull(DIEM,0) ELSE 0 END) AS THUONG, SUM(CASE WHEN PL_HINHTHUC='KL' THEN isnull(DIEM,0)  ELSE 0 END) AS PHAT FROM ZTBTHUONGPHATTB WHERE CTR_CD=@ctr_cd AND TP_EMPL_NO=@empl_no GROUP BY TP_EMPL_NO`;
  let params = { ctr_cd: DATA.CTR_CD, empl_no: EMPL_NO };
  let kqua = await queryDB_New(querythuong, params);
  res.send(kqua);
};

exports.checkWebVer = async (req, res, DATA) => {
  let setpdQuery = `SELECT VERWEB, VERMOBILE FROM ZBTVERTABLE`;
  let checkkq = await queryDB_New(setpdQuery);
  res.send(checkkq);
};

exports.nghidaycheck = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = `SELECT COUNT(EMPL_NO) AS NGHI_DAY FROM ZTBOFFREGISTRATIONTB WHERE CTR_CD=@ctr_cd AND EMPL_NO = @empl_no AND APPLY_DATE >= @start_of_year AND REASON_CODE <>2`;
  let params = { ctr_cd: DATA.CTR_CD, empl_no: EMPL_NO, start_of_year: startOfYear };
  let kqua = await queryDB_New(query, params);
  res.send(kqua);
};

exports.checkLicense = async (req, res, DATA) => {
  const CURRENT_API_URL = 'https://script.google.com/macros/s/AKfycbyD_LRqVLETu8IvuiqDSsbItdmzRw3p_q9gCv12UOer0V-5OnqtbJvKjK86bfgGbUM1NA/exec';

  // Tạo agent để bỏ qua kiểm tra chứng chỉ tự ký
  const agent = new https.Agent({
    rejectUnauthorized: false // Chỉ dùng trong môi trường dev/test
  });

  try {
    // Gọi API bằng axios
    const response = await axios.get(CURRENT_API_URL, {
      httpsAgent: agent // Sử dụng agent để bỏ qua chứng chỉ tự ký
    });

    const resp = response.data;
    const fil = resp.filter((e) => e[0] === DATA.COMPANY);
    

    if (fil.length === 0) {
      return res.send({ tk_status: 'NG', message: 'Chưa có license !' });
    }

    const now = moment();
    const exp_date = moment(fil[0][1]);

    if (now >= exp_date) {
      return res.send({ tk_status: 'NG', message: 'Hết hạn sử dụng' });
    }

    return res.send({ tk_status: 'OK', message: 'Còn hạn sử dụng' });
  } catch (error) {
    return res.send({ tk_status: 'NG', message: `Kiểm tra license thất bại ! ${error.message}` });
  }
};
