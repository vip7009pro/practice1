const jwt = require("jsonwebtoken");
const { queryDB, asyncQuery } = require("../config/database");
const fs = require("fs");
exports.getCommonData = async (req, res, DATA) => {
  const { table_name } = DATA || req.body;
  const query = `SELECT * FROM ${table_name}`;
  const result = await queryDB(query);
  res.send({ tk_status: result.tk_status, data: result.data });
};
exports.checklogin = async (req, res, DATA) => {
  const { token_string } = DATA || req.body; // Lấy token từ body hoặc cookie
  const token = token_string || req.cookies.token;
  if (!token) {
    return res.send({ tk_status: "ng", message: "No token provided" });
  }
  try {
    // Giải mã token
    const decoded = jwt.verify(token, "nguyenvanhung"); // Sử dụng secret key giống với login
    const payload = JSON.parse(decoded.payload); // Giả định payload là JSON từ login
    // Kiểm tra thông tin người dùng trong database (tùy chọn)
    const userQuery = `
      SELECT EMPL_NO, WORK_STATUS_CODE 
      FROM ZTBEMPLINFO 
      WHERE EMPL_NO = '${payload[0].EMPL_NO}'
    `;
    //console.log(userQuery);
    const result = await queryDB(userQuery);
    //console.log(result);
    if (result.tk_status === "OK" && result.data.length > 0) {
      const user = result.data[0];
      const status = user.WORK_STATUS_CODE === 0 ? "coloi" : "kocoloi";
      res.send({
        tk_status: "ok",
        message: "User is logged in",
        data: payload[0],
      });
    } else {
      res.send({ tk_status: "ng", message: "User not found" });
    }
  } catch (error) {
    console.log("Check login error:", error);
    res.send({ tk_status: "ng", message: "Invalid or expired token" });
  }
};
exports.checkMYCHAMCONG = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let PASSWORD = req.payload_data["PASSWORD"];
  let checkkq = "OK";
  let setpdQuery = `SELECT MIN(C001.CHECK_DATETIME) AS MIN_TIME, MAX(C001.CHECK_DATETIME) AS MAX_TIME  FROM C001 LEFT JOIN ZTBEMPLINFO ON (C001.NV_CCID = ZTBEMPLINFO.NV_CCID AND C001.CTR_CD = ZTBEMPLINFO.CTR_CD) WHERE C001.CHECK_DATE = CAST(GETDATE() as date) AND ZTBEMPLINFO.EMPL_NO='${EMPL_NO}' AND C001.CTR_CD='${DATA.CTR_CD}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  let kqua;
  let query =
    `SELECT ZTBEMPLINFO.EMPL_IMAGE,ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO 
              LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE AND ZTBSEX.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE AND ZTBWORKSTATUS.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE AND ZTBFACTORY.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE AND ZTBJOB.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE AND ZTBPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE AND ZTBWORKSHIFT.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE AND ZTBWORKPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD) 
              LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE AND ZTBSUBDEPARTMENT.CTR_CD = ZTBWORKPOSITION.CTR_CD) 
              LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE AND ZTBMAINDEPARMENT.CTR_CD = ZTBSUBDEPARTMENT.CTR_CD) 
              WHERE ZTBEMPLINFO.EMPL_NO = '${EMPL_NO}' AND PASSWORD = '${PASSWORD}' AND ZTBEMPLINFO.CTR_CD='${DATA.CTR_CD}'`;
  kqua = await asyncQuery(query);
  //console.log('kqua',kqua);
  loginResult = kqua;
  //console.log("KET QUA LOGIN = " + loginResult);
  var token = "";
  if (loginResult != 0) {
    token = jwt.sign({ payload: loginResult }, "nguyenvanhung", {
      expiresIn: 3600 * 24 * 1,
    });
  } else if (loginResult === 0 && EMPL_NO === "NHU1903") {
    token = req.cookies.token;
  }
  //res.cookie("token", token);
  let checkkq_token;
  //console.log(checkkq);
  if (EMPL_NO === "NHU1903") {
    checkkq_token = {
      ...checkkq,
      REFRESH_TOKEN:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjoiW3tcIkNUUl9DRFwiOlwiMDAyXCIsXCJFTVBMX05PXCI6XCJOSFUxOTAzXCIsXCJDTVNfSURcIjpcIkNNUzExNzlcIixcIkZJUlNUX05BTUVcIjpcIkjDmU5HM1wiLFwiTUlETEFTVF9OQU1FXCI6XCJOR1VZ4buETiBWxIJOXCIsXCJET0JcIjpcIjE5OTMtMTAtMThUMDA6MDA6MDAuMDAwWlwiLFwiSE9NRVRPV05cIjpcIlBow7ogVGjhu40gLSDEkMO0bmcgWHXDom4gLSBTw7NjIFPGoW4gLSBIw6AgTuG7mWlcIixcIlNFWF9DT0RFXCI6MSxcIkFERF9QUk9WSU5DRVwiOlwiSMOgIE7hu5lpXCIsXCJBRERfRElTVFJJQ1RcIjpcIlPDs2MgU8ahblwiLFwiQUREX0NPTU1VTkVcIjpcIsSQw7RuZyBYdcOiblwiLFwiQUREX1ZJTExBR0VcIjpcIlRow7RuIFBow7ogVGjhu41cIixcIlBIT05FX05VTUJFUlwiOlwiMDk3MTA5MjQ1NFwiLFwiV09SS19TVEFSVF9EQVRFXCI6XCIyMDE5LTAzLTExVDAwOjAwOjAwLjAwMFpcIixcIlBBU1NXT1JEXCI6XCIxMjM0NTY3ODlcIixcIkVNQUlMXCI6XCJudmgxOTAzQGNtc2JhbmRvLmNvbVwiLFwiV09SS19QT1NJVElPTl9DT0RFXCI6MixcIldPUktfU0hJRlRfQ09ERVwiOjAsXCJQT1NJVElPTl9DT0RFXCI6MyxcIkpPQl9DT0RFXCI6MixcIkZBQ1RPUllfQ09ERVwiOjEsXCJXT1JLX1NUQVRVU19DT0RFXCI6MSxcIlJFTUFSS1wiOm51bGwsXCJPTkxJTkVfREFURVRJTUVcIjpcIjIwMjMtMDUtMjhUMTY6MDg6MzcuMTM3WlwiLFwiU0VYX05BTUVcIjpcIk5hbVwiLFwiU0VYX05BTUVfS1JcIjpcIuuCqOyekFwiLFwiV09SS19TVEFUVVNfTkFNRVwiOlwixJBhbmcgbMOgbVwiLFwiV09SS19TVEFUVVNfTkFNRV9LUlwiOlwi6re866y07KSRXCIsXCJGQUNUT1JZX05BTUVcIjpcIk5ow6AgbcOheSAxXCIsXCJGQUNUT1JZX05BTUVfS1JcIjpcIjHqs7XsnqVcIixcIkpPQl9OQU1FXCI6XCJMZWFkZXJcIixcIkpPQl9OQU1FX0tSXCI6XCLrpqzrjZRcIixcIlBPU0lUSU9OX05BTUVcIjpcIlN0YWZmXCIsXCJQT1NJVElPTl9OQU1FX0tSXCI6XCLsgqzsm5BcIixcIldPUktfU0hJRl9OQU1FXCI6XCJIw6BuaCBDaMOtbmhcIixcIldPUktfU0hJRl9OQU1FX0tSXCI6XCLsoJXqt5xcIixcIlNVQkRFUFRDT0RFXCI6MixcIldPUktfUE9TSVRJT05fTkFNRVwiOlwiUERcIixcIldPUktfUE9TSVRJT05fTkFNRV9LUlwiOlwiUERcIixcIkFUVF9HUk9VUF9DT0RFXCI6MSxcIk1BSU5ERVBUQ09ERVwiOjEsXCJTVUJERVBUTkFNRVwiOlwiUERcIixcIlNVQkRFUFROQU1FX0tSXCI6XCLthrXsl60gKFBEKVwiLFwiTUFJTkRFUFROQU1FXCI6XCJRQ1wiLFwiTUFJTkRFUFROQU1FX0tSXCI6XCLtkojsp4hcIn1dIiwiaWF0IjoxNjk1ODIyMTQ0LCJleHAiOjIwNTU4MjIxNDR9.ICdvh4twGRLSZQ0Twcp3g0GlEDJRmemTjcWipqj3NG4",
    };
  } else {
    checkkq_token = { ...checkkq, REFRESH_TOKEN: token };
  }
  //console.log(checkkq_token);
  res.send(checkkq_token);
};
exports.insert_Notification_Data = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
            INSERT INTO ZTB_NOTIFICATION (CTR_CD, TITLE, CONTENT, SUBDEPTNAME, MAINDEPTNAME, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL, NOTI_TYPE) VALUES ('${DATA.CTR_CD}', N'${DATA.TITLE}', N'${DATA.CONTENT}', N'${DATA.SUBDEPTNAME}', N'${DATA.MAINDEPTNAME}', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}', '${DATA.NOTI_TYPE}')
          `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.load_Notification_Data = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let JOB_NAME = req.payload_data["JOB_NAME"];
  let checkkq = "OK";
  let setpdQuery = ``;
  if (EMPL_NO === 'NHU1903') {
    setpdQuery = `
    SELECT TOP 1000 * FROM ZTB_NOTIFICATION WHERE CTR_CD='${DATA.CTR_CD}' ORDER BY INS_DATE DESC
    `;
  }
  else if (JOB_NAME === 'Leader') {
    setpdQuery = `
    SELECT  TOP 1000 * FROM ZTB_NOTIFICATION WHERE CTR_CD='${DATA.CTR_CD}' AND MAINDEPTNAME LIKE '%${DATA.MAINDEPTNAME}%' ORDER BY INS_DATE DESC
    `;
  }
  else {
    setpdQuery = `SELECT  TOP 1000 * FROM ZTB_NOTIFICATION WHERE CTR_CD='${DATA.CTR_CD}' AND MAINDEPTNAME LIKE '%${DATA.MAINDEPTNAME}%' AND SUBDEPTNAME LIKE '%${DATA.SUBDEPTNAME}%' ORDER BY INS_DATE DESC`;
  }
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkEMPL_NO_mobile = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT * FROM ZTBEMPLINFO WHERE CTR_CD='${DATA.CTR_CD}' AND EMPL_NO='${DATA.EMPL_NO}'`;
  //${moment().format('YYYY-MM-DD')}
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkMNAMEfromLotI222 = async (req, res, DATA) => {
  let kqua;
  let query = `SELECT I221.EXP_DATE, I222.LOTNCC, M110.CUST_NAME_KD, I222.CUST_CD, I222.M_CODE, M090.M_NAME, M090.WIDTH_CD, I222.IN_CFM_QTY, I222.ROLL_QTY FROM I222 JOIN M090 ON (M090.M_CODE = I222.M_CODE AND M090.CTR_CD = I222.CTR_CD) LEFT JOIN M110 ON (M110.CUST_CD = I222.CUST_CD AND M110.CTR_CD = I222.CTR_CD) LEFT JOIN I221 ON (I221.IN_DATE=I222.IN_DATE AND I221.IN_NO=I222.IN_NO AND I221.IN_SEQ=I222.IN_SEQ AND I221.CTR_CD = I222.CTR_CD) WHERE I222.M_LOT_NO='${DATA.M_LOT_NO}' AND I222.CTR_CD='${DATA.CTR_CD}'`;
  ////console.log(query);
  kqua = await queryDB(query);
  res.send(kqua);
};
exports.checkMNAMEfromLotI222Total = async (req, res, DATA) => {
  let kqua;
  let query = ` SELECT  M_CODE, SUBSTRING(M_LOT_NO,1,6) AS LOTCMS, SUM(IN_CFM_QTY* ROLL_QTY) AS TOTAL_CFM_QTY, SUM(ROLL_QTY) AS TOTAL_ROLL FROM I222 WHERE I222.CTR_CD='${DATA.CTR_CD}' AND M_CODE='${DATA.M_CODE}' AND  SUBSTRING(M_LOT_NO,1,6)='${DATA.LOTCMS}' GROUP BY  M_CODE, SUBSTRING(M_LOT_NO,1,6)  `;
  console.log(query);
  kqua = await queryDB(query);
  console.log(kqua);
  res.send(kqua);
};
exports.checkMNAMEfromLot = async (req, res, DATA) => {
  let kqua;
  let query = `SELECT O302.PLAN_ID, I222.LOTNCC, O302.LOC_CD, O302.WAHS_CD, O302.M_CODE, M090.M_NAME, M090.WIDTH_CD, O302.OUT_CFM_QTY, O302.ROLL_QTY, O302.LIEUQL_SX, O302.OUT_DATE FROM O302 JOIN M090 ON (M090.M_CODE = O302.M_CODE AND M090.CTR_CD = O302.CTR_CD) LEFT JOIN I222 ON (I222.M_LOT_NO = O302.M_LOT_NO AND I222.CTR_CD = O302.CTR_CD AND I222.CTR_CD = M090.CTR_CD) WHERE O302.M_LOT_NO='${DATA.M_LOT_NO}' AND O302.CTR_CD='${DATA.CTR_CD}'`;
  //console.log(query);
  kqua = await queryDB(query);
  res.send(kqua);
};
exports.checkPLAN_ID = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT ZTB_QLSXPLAN.XUATDAOFILM, ZTB_QLSXPLAN.EQ_STATUS, ZTB_QLSXPLAN.MAIN_MATERIAL, ZTB_QLSXPLAN.INT_TEM, ZTB_QLSXPLAN.CHOTBC, ZTB_QLSXPLAN.DKXL,ZTB_QLSXPLAN.NEXT_PLAN_ID, ZTB_QLSXPLAN.KQ_SX_TAM, ZTB_QLSXPLAN.KETQUASX, ZTB_QLSXPLAN.PROCESS_NUMBER, ZTB_QLSXPLAN.PLAN_ORDER, ZTB_QLSXPLAN.STEP, ZTB_QLSXPLAN.PLAN_ID,ZTB_QLSXPLAN.PLAN_DATE,ZTB_QLSXPLAN.PROD_REQUEST_NO,ZTB_QLSXPLAN.PLAN_QTY,ZTB_QLSXPLAN.PLAN_EQ,ZTB_QLSXPLAN.PLAN_FACTORY,ZTB_QLSXPLAN.PLAN_LEADTIME,ZTB_QLSXPLAN.INS_EMPL,ZTB_QLSXPLAN.INS_DATE,ZTB_QLSXPLAN.UPD_EMPL,ZTB_QLSXPLAN.UPD_DATE, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, isnull(BB.CD1,0) AS CD1 ,isnull(BB.CD2,0) AS CD2, CASE WHEN (M100.EQ1 <> 'FR' AND M100.EQ1 <> 'SR' AND  M100.EQ1 <> 'DC' AND M100.EQ1 <> 'ED') THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD1,0) END AS TON_CD1,CASE WHEN (M100.EQ2 <> 'FR' AND M100.EQ2 <> 'SR' AND  M100.EQ2 <> 'DC' AND M100.EQ2 <> 'ED') THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD2,0) END AS TON_CD2, M100.FACTORY, M100.EQ1, M100.EQ2, M100.Setting1, M100.Setting2, M100.UPH1, M100.UPH2, M100.Step1, M100.Step2, M100.LOSS_SX1, M100.LOSS_SX2, M100.LOSS_SETTING1, M100.LOSS_SETTING2, M100.NOTE, M100.FSC, M100.FSC_CODE
            FROM ZTB_QLSXPLAN JOIN P400 ON (P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO AND P400.CTR_CD = ZTB_QLSXPLAN.CTR_CD) JOIN M100 ON (P400.G_CODE = M100.G_CODE AND P400.CTR_CD = M100.CTR_CD)
            LEFT JOIN 
            (
            SELECT PVTB.PROD_REQUEST_NO, PVTB.[1] AS CD1, PVTB.[2] AS CD2, PVTB.CTR_CD FROM 
            (
            SELECT PROD_REQUEST_NO, PROCESS_NUMBER, SUM(KETQUASX) AS KETQUASX, CTR_CD FROM ZTB_QLSXPLAN WHERE STEP =0 GROUP BY PROD_REQUEST_NO, PROCESS_NUMBER, CTR_CD
            )
            AS PV
            PIVOT
            ( 
            SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2])
            ) 
            AS PVTB
            ) AS BB ON (BB.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO AND BB.CTR_CD = ZTB_QLSXPLAN.CTR_CD) 
            WHERE ZTB_QLSXPLAN.PLAN_ID='${DATA.PLAN_ID}' AND ZTB_QLSXPLAN.CTR_CD='${DATA.CTR_CD}'`;
  //${moment().format('YYYY-MM-DD')}
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkPlanIdP501 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT TOP 1 * FROM P501 WHERE CTR_CD='${DATA.CTR_CD}' AND PLAN_ID='${DATA.PLAN_ID}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkProcessLotNo_Prod_Req_No = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT TOP 1 P500.M_LOT_NO, P501.PROCESS_LOT_NO FROM P501 LEFT JOIN P500 ON (P500.PROCESS_IN_DATE = P501.PROCESS_IN_DATE AND P500.PROCESS_IN_NO = P501.PROCESS_IN_NO AND P500.PROCESS_IN_SEQ = P501.PROCESS_IN_SEQ AND P500.CTR_CD = P501.CTR_CD) WHERE P501.CTR_CD='${DATA.CTR_CD}' AND P500.PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkPROCESS_LOT_NO = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT PLAN_ID FROM P501 WHERE CTR_CD='${DATA.CTR_CD}' AND  PROCESS_LOT_NO='${DATA.PROCESS_LOT_NO}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.check_m_code_m140_main = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `select * from M140 WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE = '${DATA.G_CODE}' AND M_CODE ='${DATA.M_CODE}' AND LIEUQL_SX=1`;
  //${moment().format('YYYY-MM-DD')}
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
};
exports.isM_LOT_NO_in_IN_KHO_SX = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT * FROM IN_KHO_SX WHERE M_LOT_NO='${DATA.M_LOT_NO}' AND CTR_CD='${DATA.CTR_CD}' AND PLAN_ID_INPUT='${DATA.PLAN_ID}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.check_m_lot_exist_p500 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = ` SELECT TOP 1 * FROM P500 WHERE CTR_CD='${DATA.CTR_CD}' AND M_LOT_NO='${DATA.M_LOT_NO}' AND PLAN_ID ='${DATA.PLAN_ID_INPUT}'`;
  //${moment().format('YYYY-MM-DD')}
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
};
exports.loadPostAll = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `          
  SELECT ZTB_POST_TB.*, ZTB_DEPARTMENT_TB.SUBDEPT, ZTB_DEPARTMENT_TB.MAINDEPT,ZTB_DEPARTMENT_TB.PIN_QTY FROM ZTB_POST_TB LEFT JOIN ZTB_DEPARTMENT_TB ON ZTB_POST_TB.DEPT_CODE = ZTB_DEPARTMENT_TB.DEPT_CODE 
  ORDER BY POST_ID DESC
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadPost = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE 1=1 `;
  if (DATA.DEPT_CODE !== 0)
    condition += ` AND ZTB_POST_TB.DEPT_CODE=${DATA.DEPT_CODE}`
  if (DATA.DEPT_CODE === 0)
    condition += ` AND ZTB_POST_TB.IS_PINNED='Y'`
  let setpdQuery = `          
  SELECT ZTB_POST_TB.*, ZTB_DEPARTMENT_TB.SUBDEPT, ZTB_DEPARTMENT_TB.MAINDEPT,ZTB_DEPARTMENT_TB.PIN_QTY FROM ZTB_POST_TB LEFT JOIN ZTB_DEPARTMENT_TB ON ZTB_POST_TB.DEPT_CODE = ZTB_DEPARTMENT_TB.DEPT_CODE 
  ${condition} ORDER BY POST_ID DESC
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updatePost = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
 UPDATE ZTB_POST_TB SET TITLE=N'${DATA.TITLE}', CONTENT=N'${DATA.CONTENT}', IS_PINNED='${DATA.IS_PINNED}' WHERE POST_ID='${DATA.POST_ID}' AND CTR_CD='${DATA.CTR_CD}'
  `;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.deletePost = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  DELETE FROM ZTB_POST_TB WHERE POST_ID='${DATA.POST_ID}' AND CTR_CD='${DATA.CTR_CD}'
  `;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updatechamcongdiemdanhauto = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO ZTBATTENDANCETB (CTR_CD,EMPL_NO, APPLY_DATE, ON_OFF,CURRENT_TEAM,MCC,CURRENT_CA) 
  SELECT ZTBEMPLINFO.CTR_CD, ZTBEMPLINFO.EMPL_NO,  CAST(GETDATE() as date) AS CHECK_DATE, 1 AS ON_OFF, ZTBEMPLINFO.WORK_SHIFT_CODE AS CURRENT_TEAM, 'Y' AS MCC , ZTBEMPLINFO.CALV  AS CURRENT_CA
FROM  
   ZTBEMPLINFO JOIN
   (SELECT DISTINCT CTR_CD, CHECK_DATE, NV_CCID FROM C001 WHERE CHECK_DATE = CAST(GETDATE() as date)) AS CC 
   ON (CC.NV_CCID = ZTBEMPLINFO.NV_CCID AND CC.CTR_CD = ZTBEMPLINFO.CTR_CD)		   
   WHERE NOT EXISTS 
   (SELECT CTR_CD, EMPL_NO FROM ZTBATTENDANCETB WHERE ZTBATTENDANCETB.APPLY_DATE=CAST(GETDATE() as date) AND ZTBATTENDANCETB.EMPL_NO = ZTBEMPLINFO.EMPL_NO AND ZTBATTENDANCETB.CTR_CD = ZTBEMPLINFO.CTR_CD AND DATEPART(ISO_WEEK, GETDATE()) = ZTBEMPLINFO.CURRENT_WEEK)
   AND ZTBEMPLINFO.CTR_CD='${DATA.CTR_CD}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.getlastestPostId = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `          
  SELECT isnull(MAX(POST_ID),1) AS POST_ID FROM ZTB_POST_TB
  `;
  //console.log(insertQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.insert_information = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `          
  INSERT INTO ZTB_POST_TB (CTR_CD,  DEPT_CODE, FILE_NAME, TITLE, CONTENT, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) 
  VALUES ('002', '${DATA.DEPT_CODE}', N'${DATA.FILE_NAME}',N'${DATA.TITLE}', N'${DATA.CONTENT}',GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}')
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadWebSetting = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT * FROM ZTB_WEB_SETTING WHERE CTR_CD='${DATA.CTR_CD}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.update_file_name = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
  INSERT INTO ZTB_FILE_TRANSFER (CTR_CD, FILE_NAME, FILE_SIZE, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('${DATA.CTR_CD}',N'${DATA.FILE_NAME}',${DATA.FILE_SIZE ?? 0}, GETDATE(),'${EMPL_NO}',GETDATE(), '${EMPL_NO}')
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.get_file_list = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT * FROM ZTB_FILE_TRANSFER ORDER BY INS_DATE DESC
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.delete_file = async (req, res, DATA) => {
  let checkkq = "OK";
  fs.rm(`C:/xampp/htdocs/globalfiles/${DATA.CTR_CD}_${DATA.FILE_NAME}`, (error) => {
    //you can handle the error here
    console.log("Loi remove file" + error);
  });
  let setpdQuery = `
DELETE FROM ZTB_FILE_TRANSFER WHERE CTR_CD='${DATA.CTR_CD}' AND FILE_NAME='${DATA.FILE_NAME}'
`;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.changepassword = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
  UPDATE ZTBEMPLINFO SET PASSWORD='${DATA.PASSWORD}' WHERE CTR_CD='${DATA.CTR_CD}' AND EMPL_NO='${EMPL_NO}'
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.setWebVer = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZBTVERTABLE SET VERWEB=${DATA.WEB_VER}`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.check_chua_pd = async (req, res, DATA) => {
var today_format = moment().format("YYYY-MM-DD");
//console.log(today_format);
let kqua;
let query = `SELECT COUNT(EMPL_NO) AS CPD FROM ZTBOFFREGISTRATIONTB WHERE CTR_CD='${DATA.CTR_CD}' AND APPLY_DATE = '${today_format}' AND APPROVAL_STATUS = 2`;
kqua = await asyncQuery(query);
let chuapdqty = JSON.parse(kqua)[0]["CPD"];
//console.log(chuapdqty);
res.send(chuapdqty + "");
};
exports.setMobileVer = async (req, res, DATA) => { 
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZBTVERTABLE SET VERMOBILE=${DATA.VERMOBILE}`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.common = async (req, res, DATA) => {
};
