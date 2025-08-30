const { queryDB_New } = require("../config/database");
const moment = require("moment");
const https = require('https');
const axios = require('axios');

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

const fetchGitHubFile = async () => {
  let data = "";
  try {
    const response = await axios.get('https://drive.google.com/uc?export=download&id=17I9btqvrHv7Qaq81dEoMRRVpqgqoYVB3', {
      timeout: 30000, // Timeout 30 giây
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (response.status !== 200) {
      throw new Error(`Lỗi khi fetch: ${response.status} ${response.statusText}`);
    }
    //console.log('Nội dung file:', response.data);
    data = response.data;
  } catch (error) {
    console.error('Lỗi fetch:', error.message);
    throw error;
  }
  return data;
}
/* const fetchGitHubFile = async () => {
  let data = "";
  try {
    const response = await fetch('https://raw.githubusercontent.com/vip7009pro/practice1/refs/heads/master/ERPLicense.json', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`Lỗi khi fetch: ${response.status} ${response.statusText}`);
    }
    const content = await response.text();
    //console.log('Nội dung file:', content);
    data = content;
  } catch (error) {
    console.error('Loi fet cmnr:', error.message);
    throw error;
  }
  return data;
}
 */
exports.checkLicense = async (req, res, DATA) => {

  let resp = await fetchGitHubFile();
  const today = new Date().toISOString().split('T')[0];
  const found = resp.find(element => element.COMPANY === DATA.COMPANY);

  if (found) {
    if (found.EXP_DATE > today) {
      return res.send({ tk_status: "OK", message: "License is valid" });
    } else {
      return res.send({ tk_status: "NG", message: "License is expired" });
    }
  } else {
    return res.send({ tk_status: "NG", message: "License is not found" });
  }
};
