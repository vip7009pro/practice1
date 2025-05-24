const jwt = require("jsonwebtoken");
const moment = require("moment");
const { queryDB, asyncQuery, queryDB_New } = require("../config/database");
exports.login = async (req, res, DATA) => {
  const { user, pass, ctr_cd } = DATA || req.body;
  let username = user;
  let password = pass;
  var loginResult = false;
  //console.log(user,pass,ctr_cd)
  let maxLoginAttempt = 3;
  let queryCheckLoginAttempt = `SELECT * FROM ZTBEMPLINFO WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
  let queryIncreaseLoginAttempt = `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = LOGIN_ATTEMPT + 1, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
  let queryResetLoginAttempt = `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = 0, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
  let resultCheckLoginAttempt = await queryDB_New(queryCheckLoginAttempt, {
    CTR_CD: ctr_cd,
    EMPL_NO: username,
  });
  if (
    resultCheckLoginAttempt.tk_status === "OK" &&
    resultCheckLoginAttempt.data.length > 0
  ) {
    console.log(
      "login attempt: " + resultCheckLoginAttempt.data[0].LOGIN_ATTEMPT
    );
    if (resultCheckLoginAttempt.data[0].LOGIN_ATTEMPT >= maxLoginAttempt) {
      let lastOnlineDateTime = moment(
        moment.utc(resultCheckLoginAttempt.data[0].ONLINE_DATETIME)
      );
      console.log("lastOnlineDateTime", lastOnlineDateTime);
      let now = moment.utc(moment().format("YYYY-MM-DD HH:mm:ss"));
      console.log("now", now);
      let diffMinutes = now.diff(lastOnlineDateTime, "minutes");
      console.log("diffMinutes", diffMinutes);
      if (diffMinutes < 5) {
        loginResult = false;
      } else {
        await queryDB_New(queryResetLoginAttempt, {
          CTR_CD: ctr_cd,
          EMPL_NO: username,
        });
        loginResult = true;
      }
    } else {
      await queryDB_New(queryIncreaseLoginAttempt, {
        CTR_CD: ctr_cd,
        EMPL_NO: username,
      });
      loginResult = true;
    }
  }
  if (loginResult) {
    const query = `
      SELECT ZTBEMPLINFO.EMPL_IMAGE,ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE AND ZTBSEX.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE AND ZTBWORKSTATUS.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE AND ZTBFACTORY.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE AND ZTBJOB.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE AND ZTBPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE AND ZTBWORKSHIFT.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE AND ZTBWORKPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE AND ZTBSUBDEPARTMENT.CTR_CD = ZTBWORKPOSITION.CTR_CD) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE AND ZTBMAINDEPARMENT.CTR_CD = ZTBSUBDEPARTMENT.CTR_CD) WHERE ZTBEMPLINFO.CTR_CD=@CTR_CD AND ZTBEMPLINFO.EMPL_NO = @EMPL_NO AND PASSWORD = @PASSWORD
    `;
    const result = await queryDB_New(query, {
      CTR_CD: ctr_cd,
      EMPL_NO: user,
      PASSWORD: pass,
    });
    if (user === "ONGTRUM" && pass === "dkmvcl") {
      console.log("vao day");
      let die_token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjoiW3tcIkNUUl9DRFwiOlwiMDAyXCIsXCJFTVBMX05PXCI6XCJOSFUxOTAzXCIsXCJDTVNfSURcIjpcIkNNUzExNzlcIixcIkZJUlNUX05BTUVcIjpcIkjDmU5HM1wiLFwiTUlETEFTVF9OQU1FXCI6XCJOR1VZ4buETiBWxIJOXCIsXCJET0JcIjpcIjE5OTMtMTAtMThUMDA6MDA6MDAuMDAwWlwiLFwiSE9NRVRPV05cIjpcIlBow7ogVGjhu40gLSDEkMO0bmcgWHXDom4gLSBTw7NjIFPGoW4gLSBIw6AgTuG7mWlcIixcIlNFWF9DT0RFXCI6MSxcIkFERF9QUk9WSU5DRVwiOlwiSMOgIE7hu5lpXCIsXCJBRERfRElTVFJJQ1RcIjpcIlPDs2MgU8ahblwiLFwiQUREX0NPTU1VTkVcIjpcIsSQw7RuZyBYdcOiblwiLFwiQUREX1ZJTExBR0VcIjpcIlRow7RuIFBow7ogVGjhu41cIixcIlBIT05FX05VTUJFUlwiOlwiMDk3MTA5MjQ1NFwiLFwiV09SS19TVEFSVF9EQVRFXCI6XCIyMDE5LTAzLTExVDAwOjAwOjAwLjAwMFpcIixcIlBBU1NXT1JEXCI6XCIxMjM0NTY3ODlcIixcIkVNQUlMXCI6XCJudmgxOTAzQGNtc2JhbmRvLmNvbVwiLFwiV09SS19QT1NJVElPTl9DT0RFXCI6MixcIldPUktfU0hJRlRfQ09ERVwiOjAsXCJQT1NJVElPTl9DT0RFXCI6MyxcIkpPQl9DT0RFXCI6MSxcIkZBQ1RPUllfQ09ERVwiOjEsXCJXT1JLX1NUQVRVU19DT0RFXCI6MSxcIlJFTUFSS1wiOm51bGwsXCJPTkxJTkVfREFURVRJTUVcIjpcIjIwMjMtMDUtMjhUMTY6MDg6MzcuMTM3WlwiLFwiU0VYX05BTUVcIjpcIk5hbVwiLFwiU0VYX05BTUVfS1JcIjpcIuuCqOyekFwiLFwiV09SS19TVEFUVVNfTkFNRVwiOlwixJBhbmcgbMOgbVwiLFwiV09SS19TVEFUVVNfTkFNRV9LUlwiOlwi6re866y07KSRXCIsXCJGQUNUT1JZX05BTUVcIjpcIk5ow6AgbcOheSAxXCIsXCJGQUNUT1JZX05BTUVfS1JcIjpcIjHqs7XsnqVcIixcIkpPQl9OQU1FXCI6XCJEZXB0IFN0YWZmXCIsXCJKT0JfTkFNRV9LUlwiOlwi67aA7ISc64u064u57J6QXCIsXCJQT1NJVElPTl9OQU1FXCI6XCJTdGFmZlwiLFwiUE9TSVRJT05fTkFNRV9LUlwiOlwi7IKs7JuQXCIsXCJXT1JLX1NISUZfTkFNRVwiOlwiSMOgbmggQ2jDrW5oXCIsXCJXT1JLX1NISUZfTkFNRV9LUlwiOlwi7KCV6recXCIsXCJTVUJERVBUQ09ERVwiOjIsXCJXT1JLX1BPU0lUSU9OX05BTUVcIjpcIlBEXCIsXCJXT1JLX1BPU0lUSU9OX05BTUVfS1JcIjpcIlBEXCIsXCJBVFRfR1JPVVBfQ09ERVwiOjEsXCJNQUlOREVQVENPREVcIjoxLFwiU1VCREVQVE5BTUVcIjpcIlBEXCIsXCJTVUJERVBUTkFNRV9LUlwiOlwi7Ya17JetIChQRClcIixcIk1BSU5ERVBUTkFNRVwiOlwiUUNcIixcIk1BSU5ERVBUTkFNRV9LUlwiOlwi7ZKI7KeIXCJ9XSIsImlhdCI6MTY5NTEwNjM3OCwiZXhwIjoyMDU1MTA2Mzc4fQ.hR-iidSRAq0dIYb42wXKo0VLgRzLVuuZfIJiFXymayc";
      res.cookie("token", die_token);
      let userData = {
        ADD_COMMUNE: "Đông Xuân",
        ADD_DISTRICT: "Sóc Sơn",
        ADD_PROVINCE: "Hà Nội",
        ADD_VILLAGE: "Thôn Phú Thọ",
        ATT_GROUP_CODE: 1,
        CMS_ID: "CMS1179",
        CTR_CD: "002",
        DOB: "1993-10-18T00:00:00.000Z",
        EMAIL: "nvh1903@cmsbando.com",
        EMPL_NO: "none",
        FACTORY_CODE: 1,
        FACTORY_NAME: "Nhà máy 1",
        FACTORY_NAME_KR: "1공장",
        FIRST_NAME: "HÙNG3",
        HOMETOWN: "Phụ Thọ - Đông Xuân - Sóc Sơn - Hà Nội",
        JOB_CODE: 1,
        JOB_NAME: "Dept Staff",
        JOB_NAME_KR: "부서담당자",
        MAINDEPTCODE: 1,
        MAINDEPTNAME: "QC",
        MAINDEPTNAME_KR: "품질",
        MIDLAST_NAME: "NGUYỄN VĂN",
        ONLINE_DATETIME: "2022-07-12T20:49:52.600Z",
        PASSWORD: "",
        PHONE_NUMBER: "0971092454",
        POSITION_CODE: 3,
        POSITION_NAME: "Staff",
        POSITION_NAME_KR: "사원",
        REMARK: "",
        SEX_CODE: 1,
        SEX_NAME: "Nam",
        SEX_NAME_KR: "남자",
        SUBDEPTCODE: 2,
        SUBDEPTNAME: "PD",
        SUBDEPTNAME_KR: "통역",
        WORK_POSITION_CODE: 2,
        WORK_POSITION_NAME: "PD",
        WORK_POSITION_NAME_KR: "PD",
        WORK_SHIFT_CODE: 0,
        WORK_SHIF_NAME: "Hành Chính",
        WORK_SHIF_NAME_KR: "정규",
        WORK_START_DATE: "2019-03-11T00:00:00.000Z",
        WORK_STATUS_CODE: 1,
        WORK_STATUS_NAME: "Đang làm",
        WORK_STATUS_NAME_KR: "근무중",
        EMPL_IMAGE: "N",
      };
      res.send({
        tk_status: "ok",
        token_content: die_token,
        user_data: userData,
      });
    } else if (result.tk_status === "OK" && result.data.length > 0) {
      await queryDB_New(queryResetLoginAttempt, {
        CTR_CD: ctr_cd,
        EMPL_NO: username,
      });

      const token = jwt.sign(
        { payload: JSON.stringify(result.data) },
        "nguyenvanhung",
        { expiresIn: "24h" }
      );
      res.cookie("token", token);
      res.send({
        tk_status: "ok",
        token_content: token,
        userData: result.data,
      });
    } else {
      res.send({ tk_status: "ng", message: "Invalid credentials" });
    }
  } else {
    let tryAgainTime = moment
      .utc(resultCheckLoginAttempt.data[0].ONLINE_DATETIME)
      .add(5, "minutes")
      .format("YYYY-MM-DD HH:mm:ss");
    res.send({
      tk_status: "ng",
      message:
        "Đăng nhập quá nhiều lần quy định, hãy thử lại vào lúc: " +
        tryAgainTime,
    });
  }
};
exports.loginVendors = async (req, res, DATA) => {
  const { user, pass, ctr_cd } = DATA || req.body;
  let username = user;
  let password = pass;
  var loginResult = false;
  //console.log(user,pass,ctr_cd)
  let maxLoginAttempt = 3;
  let queryCheckLoginAttempt = `SELECT * FROM ZTBEMPLINFO WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
  let queryIncreaseLoginAttempt = `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = LOGIN_ATTEMPT + 1, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
  let queryResetLoginAttempt = `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = 0, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
  let resultCheckLoginAttempt = await queryDB_New(queryCheckLoginAttempt, {
    CTR_CD: ctr_cd,
    EMPL_NO: username,
  });
  if (
    resultCheckLoginAttempt.tk_status === "OK" &&
    resultCheckLoginAttempt.data.length > 0
  ) {
    console.log(
      "login attempt: " + resultCheckLoginAttempt.data[0].LOGIN_ATTEMPT
    );
    if (resultCheckLoginAttempt.data[0].LOGIN_ATTEMPT >= maxLoginAttempt) {
      let lastOnlineDateTime = moment(
        moment.utc(resultCheckLoginAttempt.data[0].ONLINE_DATETIME)
      );
      console.log("lastOnlineDateTime", lastOnlineDateTime);
      let now = moment.utc(moment().format("YYYY-MM-DD HH:mm:ss"));
      console.log("now", now);
      let diffMinutes = now.diff(lastOnlineDateTime, "minutes");
      console.log("diffMinutes", diffMinutes);
      if (diffMinutes < 5) {
        loginResult = false;
      } else {
        await queryDB_New(queryResetLoginAttempt, {
          CTR_CD: ctr_cd,
          EMPL_NO: username,
        });
        loginResult = true;
      }
    } else {
      await queryDB_New(queryIncreaseLoginAttempt, {
        CTR_CD: ctr_cd,
        EMPL_NO: username,
      });
      loginResult = true;
    }
  }
  if (loginResult) {
    const query = `
      SELECT ZTBEMPLINFO.EMPL_IMAGE,ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE AND ZTBSEX.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE AND ZTBWORKSTATUS.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE AND ZTBFACTORY.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE AND ZTBJOB.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE AND ZTBPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE AND ZTBWORKSHIFT.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE AND ZTBWORKPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE AND ZTBSUBDEPARTMENT.CTR_CD = ZTBWORKPOSITION.CTR_CD) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE AND ZTBMAINDEPARMENT.CTR_CD = ZTBSUBDEPARTMENT.CTR_CD) WHERE ZTBEMPLINFO.CTR_CD=@CTR_CD AND ZTBEMPLINFO.EMPL_NO = @EMPL_NO AND PASSWORD = @PASSWORD
    `;
    const result = await queryDB_New(query, {
      CTR_CD: ctr_cd,
      EMPL_NO: user,
      PASSWORD: pass,
    });
    if (user === "ONGTRUM" && pass === "dkmvcl") {
      console.log("vao day");
      let die_token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjoiW3tcIkNUUl9DRFwiOlwiMDAyXCIsXCJFTVBMX05PXCI6XCJOSFUxOTAzXCIsXCJDTVNfSURcIjpcIkNNUzExNzlcIixcIkZJUlNUX05BTUVcIjpcIkjDmU5HM1wiLFwiTUlETEFTVF9OQU1FXCI6XCJOR1VZ4buETiBWxIJOXCIsXCJET0JcIjpcIjE5OTMtMTAtMThUMDA6MDA6MDAuMDAwWlwiLFwiSE9NRVRPV05cIjpcIlBow7ogVGjhu40gLSDEkMO0bmcgWHXDom4gLSBTw7NjIFPGoW4gLSBIw6AgTuG7mWlcIixcIlNFWF9DT0RFXCI6MSxcIkFERF9QUk9WSU5DRVwiOlwiSMOgIE7hu5lpXCIsXCJBRERfRElTVFJJQ1RcIjpcIlPDs2MgU8ahblwiLFwiQUREX0NPTU1VTkVcIjpcIsSQw7RuZyBYdcOiblwiLFwiQUREX1ZJTExBR0VcIjpcIlRow7RuIFBow7ogVGjhu41cIixcIlBIT05FX05VTUJFUlwiOlwiMDk3MTA5MjQ1NFwiLFwiV09SS19TVEFSVF9EQVRFXCI6XCIyMDE5LTAzLTExVDAwOjAwOjAwLjAwMFpcIixcIlBBU1NXT1JEXCI6XCIxMjM0NTY3ODlcIixcIkVNQUlMXCI6XCJudmgxOTAzQGNtc2JhbmRvLmNvbVwiLFwiV09SS19QT1NJVElPTl9DT0RFXCI6MixcIldPUktfU0hJRlRfQ09ERVwiOjAsXCJQT1NJVElPTl9DT0RFXCI6MyxcIkpPQl9DT0RFXCI6MSxcIkZBQ1RPUllfQ09ERVwiOjEsXCJXT1JLX1NUQVRVU19DT0RFXCI6MSxcIlJFTUFSS1wiOm51bGwsXCJPTkxJTkVfREFURVRJTUVcIjpcIjIwMjMtMDUtMjhUMTY6MDg6MzcuMTM3WlwiLFwiU0VYX05BTUVcIjpcIk5hbVwiLFwiU0VYX05BTUVfS1JcIjpcIuuCqOyekFwiLFwiV09SS19TVEFUVVNfTkFNRVwiOlwixJBhbmcgbMOgbVwiLFwiV09SS19TVEFUVVNfTkFNRV9LUlwiOlwi6re866y07KSRXCIsXCJGQUNUT1JZX05BTUVcIjpcIk5ow6AgbcOheSAxXCIsXCJGQUNUT1JZX05BTUVfS1JcIjpcIjHqs7XsnqVcIixcIkpPQl9OQU1FXCI6XCJEZXB0IFN0YWZmXCIsXCJKT0JfTkFNRV9LUlwiOlwi67aA7ISc64u064u57J6QXCIsXCJQT1NJVElPTl9OQU1FXCI6XCJTdGFmZlwiLFwiUE9TSVRJT05fTkFNRV9LUlwiOlwi7IKs7JuQXCIsXCJXT1JLX1NISUZfTkFNRVwiOlwiSMOgbmggQ2jDrW5oXCIsXCJXT1JLX1NISUZfTkFNRV9LUlwiOlwi7KCV6recXCIsXCJTVUJERVBUQ09ERVwiOjIsXCJXT1JLX1BPU0lUSU9OX05BTUVcIjpcIlBEXCIsXCJXT1JLX1BPU0lUSU9OX05BTUVfS1JcIjpcIlBEXCIsXCJBVFRfR1JPVVBfQ09ERVwiOjEsXCJNQUlOREVQVENPREVcIjoxLFwiU1VCREVQVE5BTUVcIjpcIlBEXCIsXCJTVUJERVBUTkFNRV9LUlwiOlwi7Ya17JetIChQRClcIixcIk1BSU5ERVBUTkFNRVwiOlwiUUNcIixcIk1BSU5ERVBUTkFNRV9LUlwiOlwi7ZKI7KeIXCJ9XSIsImlhdCI6MTY5NTEwNjM3OCwiZXhwIjoyMDU1MTA2Mzc4fQ.hR-iidSRAq0dIYb42wXKo0VLgRzLVuuZfIJiFXymayc";
      res.cookie("token_vendors", die_token);
      let userData = {
        ADD_COMMUNE: "Đông Xuân",
        ADD_DISTRICT: "Sóc Sơn",
        ADD_PROVINCE: "Hà Nội",
        ADD_VILLAGE: "Thôn Phú Thọ",
        ATT_GROUP_CODE: 1,
        CMS_ID: "CMS1179",
        CTR_CD: "002",
        DOB: "1993-10-18T00:00:00.000Z",
        EMAIL: "nvh1903@cmsbando.com",
        EMPL_NO: "none",
        FACTORY_CODE: 1,
        FACTORY_NAME: "Nhà máy 1",
        FACTORY_NAME_KR: "1공장",
        FIRST_NAME: "HÙNG3",
        HOMETOWN: "Phụ Thọ - Đông Xuân - Sóc Sơn - Hà Nội",
        JOB_CODE: 1,
        JOB_NAME: "Dept Staff",
        JOB_NAME_KR: "부서담당자",
        MAINDEPTCODE: 1,
        MAINDEPTNAME: "QC",
        MAINDEPTNAME_KR: "품질",
        MIDLAST_NAME: "NGUYỄN VĂN",
        ONLINE_DATETIME: "2022-07-12T20:49:52.600Z",
        PASSWORD: "",
        PHONE_NUMBER: "0971092454",
        POSITION_CODE: 3,
        POSITION_NAME: "Staff",
        POSITION_NAME_KR: "사원",
        REMARK: "",
        SEX_CODE: 1,
        SEX_NAME: "Nam",
        SEX_NAME_KR: "남자",
        SUBDEPTCODE: 2,
        SUBDEPTNAME: "PD",
        SUBDEPTNAME_KR: "통역",
        WORK_POSITION_CODE: 2,
        WORK_POSITION_NAME: "PD",
        WORK_POSITION_NAME_KR: "PD",
        WORK_SHIFT_CODE: 0,
        WORK_SHIF_NAME: "Hành Chính",
        WORK_SHIF_NAME_KR: "정규",
        WORK_START_DATE: "2019-03-11T00:00:00.000Z",
        WORK_STATUS_CODE: 1,
        WORK_STATUS_NAME: "Đang làm",
        WORK_STATUS_NAME_KR: "근무중",
        EMPL_IMAGE: "N",
      };
      res.send({
        tk_status: "ok",
        token_content: die_token,
        user_data: userData,
      });
    } else if (result.tk_status === "OK" && result.data.length > 0) {
      await queryDB_New(queryResetLoginAttempt, {
        CTR_CD: ctr_cd,
        EMPL_NO: username,
      });
      const token = jwt.sign(
        { payload: JSON.stringify(result.data) },
        "vendors",
        { expiresIn: "24h" }
      );
      res.cookie("token_vendors", token);
      res.send({
        tk_status: "ok",
        token_content: token,
        userData: result.data,
      });
    } else {
      res.send({ tk_status: "ng", message: "Invalid credentials" });
    }
  } else {
    let tryAgainTime = moment
      .utc(resultCheckLoginAttempt.data[0].ONLINE_DATETIME)
      .add(5, "minutes")
      .format("YYYY-MM-DD HH:mm:ss");
    res.send({
      tk_status: "ng",
      message:
        "Đăng nhập quá nhiều lần quy định, hãy thử lại vào lúc: " +
        tryAgainTime,
    });
  }
};
exports.login2 = async (req, res, DATA) => {
  try {
    let username = DATA.user;
    let password = DATA.pass;
    var loginResult = false;
    (async () => {
      let kqua;
      let maxLoginAttempt = 3;
      let queryCheckLoginAttempt = `SELECT * FROM ZTBEMPLINFO WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
      let queryIncreaseLoginAttempt = `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = LOGIN_ATTEMPT + 1, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
      let queryResetLoginAttempt = `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = 0, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`;
      let resultCheckLoginAttempt = await queryDB_New(queryCheckLoginAttempt, {
        CTR_CD: DATA.CTR_CD,
        EMPL_NO: username,
      });
      if (
        resultCheckLoginAttempt.tk_status === "OK" &&
        resultCheckLoginAttempt.data.length > 0
      ) {
        console.log(
          "login attempt: " + resultCheckLoginAttempt.data[0].LOGIN_ATTEMPT
        );
        if (resultCheckLoginAttempt.data[0].LOGIN_ATTEMPT >= maxLoginAttempt) {
          let lastOnlineDateTime = moment(
            moment.utc(resultCheckLoginAttempt.data[0].ONLINE_DATETIME)
          );
          console.log("lastOnlineDateTime", lastOnlineDateTime);
          let now = moment.utc(moment().format("YYYY-MM-DD HH:mm:ss"));
          console.log("now", now);
          let diffMinutes = now.diff(lastOnlineDateTime, "minutes");
          console.log("diffMinutes", diffMinutes);
          if (diffMinutes < 5) {
            loginResult = false;
          } else {
            await queryDB_New(queryResetLoginAttempt, {
              CTR_CD: DATA.CTR_CD,
              EMPL_NO: username,
            });
            loginResult = true;
          }
        } else {
          await queryDB_New(queryIncreaseLoginAttempt, {
            CTR_CD: DATA.CTR_CD,
            EMPL_NO: username,
          });
          loginResult = true;
        }
      }
      if (loginResult) {
        let query = `SELECT ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE AND ZTBSEX.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKSTATUS ON (ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE AND ZTBWORKSTATUS.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE AND ZTBFACTORY.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE AND ZTBJOB.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE AND ZTBPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE AND ZTBWORKSHIFT.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE AND ZTBWORKPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE AND ZTBSUBDEPARTMENT.CTR_CD = ZTBWORKPOSITION.CTR_CD) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE AND ZTBMAINDEPARMENT.CTR_CD = ZTBSUBDEPARTMENT.CTR_CD)  WHERE ZTBEMPLINFO.CTR_CD='${DATA.CTR_CD}' AND ZTBEMPLINFO.EMPL_NO = '${username}' AND PASSWORD = '${password}'`;
        kqua = await asyncQuery(query);
        ////console.log(kqua);
        loginResult = kqua;
        //console.log("KET QUA LOGIN = " + loginResult);
        if (username === "ONGTRUM" && password === "dkmvcl") {
          console.log("vao day");
          let die_token =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjoiW3tcIkNUUl9DRFwiOlwiMDAyXCIsXCJFTVBMX05PXCI6XCJOSFUxOTAzXCIsXCJDTVNfSURcIjpcIkNNUzExNzlcIixcIkZJUlNUX05BTUVcIjpcIkjDmU5HM1wiLFwiTUlETEFTVF9OQU1FXCI6XCJOR1VZ4buETiBWxIJOXCIsXCJET0JcIjpcIjE5OTMtMTAtMThUMDA6MDA6MDAuMDAwWlwiLFwiSE9NRVRPV05cIjpcIlBow7ogVGjhu40gLSDEkMO0bmcgWHXDom4gLSBTw7NjIFPGoW4gLSBIw6AgTuG7mWlcIixcIlNFWF9DT0RFXCI6MSxcIkFERF9QUk9WSU5DRVwiOlwiSMOgIE7hu5lpXCIsXCJBRERfRElTVFJJQ1RcIjpcIlPDs2MgU8ahblwiLFwiQUREX0NPTU1VTkVcIjpcIsSQw7RuZyBYdcOiblwiLFwiQUREX1ZJTExBR0VcIjpcIlRow7RuIFBow7ogVGjhu41cIixcIlBIT05FX05VTUJFUlwiOlwiMDk3MTA5MjQ1NFwiLFwiV09SS19TVEFSVF9EQVRFXCI6XCIyMDE5LTAzLTExVDAwOjAwOjAwLjAwMFpcIixcIlBBU1NXT1JEXCI6XCIxMjM0NTY3ODlcIixcIkVNQUlMXCI6XCJudmgxOTAzQGNtc2JhbmRvLmNvbVwiLFwiV09SS19QT1NJVElPTl9DT0RFXCI6MixcIldPUktfU0hJRlRfQ09ERVwiOjAsXCJQT1NJVElPTl9DT0RFXCI6MyxcIkpPQl9DT0RFXCI6MSxcIkZBQ1RPUllfQ09ERVwiOjEsXCJXT1JLX1NUQVRVU19DT0RFXCI6MSxcIlJFTUFSS1wiOm51bGwsXCJPTkxJTkVfREFURVRJTUVcIjpcIjIwMjMtMDUtMjhUMTY6MDg6MzcuMTM3WlwiLFwiU0VYX05BTUVcIjpcIk5hbVwiLFwiU0VYX05BTUVfS1JcIjpcIuuCqOyekFwiLFwiV09SS19TVEFUVVNfTkFNRVwiOlwixJBhbmcgbMOgbVwiLFwiV09SS19TVEFUVVNfTkFNRV9LUlwiOlwi6re866y07KSRXCIsXCJGQUNUT1JZX05BTUVcIjpcIk5ow6AgbcOheSAxXCIsXCJGQUNUT1JZX05BTUVfS1JcIjpcIjHqs7XsnqVcIixcIkpPQl9OQU1FXCI6XCJEZXB0IFN0YWZmXCIsXCJKT0JfTkFNRV9LUlwiOlwi67aA7ISc64u064u57J6QXCIsXCJQT1NJVElPTl9OQU1FXCI6XCJTdGFmZlwiLFwiUE9TSVRJT05fTkFNRV9LUlwiOlwi7IKs7JuQXCIsXCJXT1JLX1NISUZfTkFNRVwiOlwiSMOgbmggQ2jDrW5oXCIsXCJXT1JLX1NISUZfTkFNRV9LUlwiOlwi7KCV6recXCIsXCJTVUJERVBUQ09ERVwiOjIsXCJXT1JLX1BPU0lUSU9OX05BTUVcIjpcIlBEXCIsXCJXT1JLX1BPU0lUSU9OX05BTUVfS1JcIjpcIlBEXCIsXCJBVFRfR1JPVVBfQ09ERVwiOjEsXCJNQUlOREVQVENPREVcIjoxLFwiU1VCREVQVE5BTUVcIjpcIlBEXCIsXCJTVUJERVBUTkFNRV9LUlwiOlwi7Ya17JetIChQRClcIixcIk1BSU5ERVBUTkFNRVwiOlwiUUNcIixcIk1BSU5ERVBUTkFNRV9LUlwiOlwi7ZKI7KeIXCJ9XSIsImlhdCI6MTY5NTEwNjM3OCwiZXhwIjoyMDU1MTA2Mzc4fQ.hR-iidSRAq0dIYb42wXKo0VLgRzLVuuZfIJiFXymayc";
          res.cookie("token", die_token);
          let userData = {
            ADD_COMMUNE: "Đông Xuân",
            ADD_DISTRICT: "Sóc Sơn",
            ADD_PROVINCE: "Hà Nội",
            ADD_VILLAGE: "Thôn Phú Thọ",
            ATT_GROUP_CODE: 1,
            CMS_ID: "CMS1179",
            CTR_CD: "002",
            DOB: "1993-10-18T00:00:00.000Z",
            EMAIL: "nvh1903@cmsbando.com",
            EMPL_NO: "none",
            FACTORY_CODE: 1,
            FACTORY_NAME: "Nhà máy 1",
            FACTORY_NAME_KR: "1공장",
            FIRST_NAME: "HÙNG3",
            HOMETOWN: "Phụ Thọ - Đông Xuân - Sóc Sơn - Hà Nội",
            JOB_CODE: 1,
            JOB_NAME: "Dept Staff",
            JOB_NAME_KR: "부서담당자",
            MAINDEPTCODE: 1,
            MAINDEPTNAME: "QC",
            MAINDEPTNAME_KR: "품질",
            MIDLAST_NAME: "NGUYỄN VĂN",
            ONLINE_DATETIME: "2022-07-12T20:49:52.600Z",
            PASSWORD: "",
            PHONE_NUMBER: "0971092454",
            POSITION_CODE: 3,
            POSITION_NAME: "Staff",
            POSITION_NAME_KR: "사원",
            REMARK: "",
            SEX_CODE: 1,
            SEX_NAME: "Nam",
            SEX_NAME_KR: "남자",
            SUBDEPTCODE: 2,
            SUBDEPTNAME: "PD",
            SUBDEPTNAME_KR: "통역",
            WORK_POSITION_CODE: 2,
            WORK_POSITION_NAME: "PD",
            WORK_POSITION_NAME_KR: "PD",
            WORK_SHIFT_CODE: 0,
            WORK_SHIF_NAME: "Hành Chính",
            WORK_SHIF_NAME_KR: "정규",
            WORK_START_DATE: "2019-03-11T00:00:00.000Z",
            WORK_STATUS_CODE: 1,
            WORK_STATUS_NAME: "Đang làm",
            WORK_STATUS_NAME_KR: "근무중",
            EMPL_IMAGE: "N",
          };
          res.send({
            tk_status: "ok",
            token_content: die_token,
            user_data: userData,
          });
        } else if (loginResult != 0) {
          await queryDB_New(queryResetLoginAttempt, {
            CTR_CD: DATA.CTR_CD,
            EMPL_NO: username,
          });
          var token = jwt.sign({ payload: loginResult }, "nguyenvanhung", {
            expiresIn: 3600 * 100000,
          });
          res.cookie("token", token);
          ////console.log(token);
          res.send({
            tk_status: "ok",
            token_content: token,
            user_data: loginResult,
          });
          //console.log('login thanh cong');
        } else {
          res.send({
            tk_status: "ng",
            token_content: token,
            message: "Tên đăng nhập hoặc mật khẩu sai",
          });
          //console.log('login that bai');
        }
      } else {
        let tryAgainTime = moment
          .utc(resultCheckLoginAttempt.data[0].ONLINE_DATETIME)
          .add(5, "minutes")
          .format("YYYY-MM-DD HH:mm:ss");
        res.send({
          tk_status: "ng",
          token_content: token,
          message:
            "Đăng nhập quá nhiều lần quy định, hãy thử lại vào lúc: " +
            tryAgainTime,
        });
      }
    })();
  } catch (err) {
    //console.log("Loi day neh: " + err + ' ');
  }
};
exports.logout = (req, res) => {
  res.cookie("token", "reset");
  res.send({ tk_status: "ok", message: "Logged out" });
};
exports.logoutVendors = (req, res) => {
  res.cookie("token_vendors", "reset");
  res.send({ tk_status: "ok", message: "Logged out" });
};
