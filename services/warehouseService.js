const { queryDB } = require("../config/database");
const moment = require("moment");
exports.insert_O302 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO O302 (CTR_CD, OUT_DATE, OUT_NO, OUT_SEQ, M_LOT_NO, LOC_CD, M_CODE, OUT_CFM_QTY, WAHS_CD, REMK, USE_YN, INS_DATE, INS_EMPL, FACTORY, CUST_CD, ROLL_QTY, OUT_DATE_THUCTE, IN_DATE_O302, PLAN_ID, SOLANOUT, LIEUQL_SX, INS_RECEPTION, FSC_O302) VALUES ('${DATA.CTR_CD}', '${DATA.OUT_DATE}','${DATA.OUT_NO}', '${DATA.OUT_SEQ}', '${DATA.M_LOT_NO}','${DATA.LOC_CD}','${DATA.M_CODE}','${DATA.OUT_CFM_QTY}', '${DATA.WAHS_CD}','${DATA.REMARK}','${DATA.USE_YN}', GETDATE(), '${DATA.INS_EMPL}', '${DATA.FACTORY}', '${DATA.CUST_CD}',${DATA.ROLL_QTY},'${DATA.OUT_DATE_THUCTE}', '${DATA.IN_DATE_O302}', '${DATA.PLAN_ID}', '${DATA.SOLANOUT}', ${DATA.LIEUQL_SX}, '${DATA.INS_RECEPTION}', '${DATA.FSC_O302}') `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateStockM090 = async (req, res, DATA) => {
  let setpdQuery1 = `
    MERGE INTO M090 USING(
    SELECT 
      M090.CTR_CD,
      M090.M_CODE, 
      M090.M_NAME, 
      isnull(STOCK_TB2.STOCK_ROLL_NM1, 0) AS STOCK_ROLL_NM1, 
      isnull(STOCK_TB2.STOCK_CFM_NM1, 0) AS STOCK_CFM_NM1, 
      isnull(HOLDING_TB.HOLDING_ROLL_NM1, 0) AS HOLDING_ROLL_NM1, 
      isnull(HOLDING_TB.HOLDING_CFM_NM1, 0) AS HOLDING_CFM_NM1 
    FROM 
      M090 
      LEFT JOIN(
        SELECT 
          STOCK_TB.CTR_CD,
          STOCK_TB.M_CODE, 
          SUM(STOCK_TB.IN_ROLL_QTY) AS STOCK_ROLL_NM1, 
          SUM(STOCK_TB.IN_CFM_QTY) AS STOCK_CFM_NM1 
        FROM 
          (
            SELECT 
              I222.CTR_CD,
              I222.M_CODE, 
              SUM(I222.ROLL_QTY) AS IN_ROLL_QTY, 
              SUM(I222.ROLL_QTY * IN_CFM_QTY) AS IN_CFM_QTY 
            FROM 
              I222 
            WHERE 
              I222.USE_YN = 'T' 
              AND I222.FACTORY = 'NM1' 
              AND I222.CTR_CD='${DATA.CTR_CD}'
            GROUP BY 
              I222.CTR_CD, I222.M_CODE 
            UNION ALL 
            SELECT 
              RETURN_NVL.CTR_CD,
              RETURN_NVL.M_CODE, 
              SUM(RETURN_NVL.ROLL_QTY) AS IN_ROLL_QTY, 
              SUM(RETURN_NVL.ROLL_QTY * RETURN_QTY) AS IN_CFM_QTY 
            FROM 
              RETURN_NVL 
            WHERE 
              RETURN_NVL.USE_YN = 'Y' 
              AND RETURN_NVL.FACTORY = 'NM1' 
              AND RETURN_NVL.CTR_CD='${DATA.CTR_CD}'
            GROUP BY 
              RETURN_NVL.CTR_CD, RETURN_NVL.M_CODE
          ) AS STOCK_TB 
        GROUP BY 
          STOCK_TB.CTR_CD, STOCK_TB.M_CODE
      ) AS STOCK_TB2 ON(STOCK_TB2.CTR_CD = M090.CTR_CD AND STOCK_TB2.M_CODE = M090.M_CODE) 
      LEFT JOIN(
        SELECT 
          HOLDING_TB.CTR_CD,
          HOLDING_TB.M_CODE, 
          SUM(HOLDING_TB.HOLDING_ROLL_QTY) AS HOLDING_ROLL_NM1, 
          SUM(
            HOLDING_TB.HOLDING_ROLL_QTY * HOLDING_QTY
          ) AS HOLDING_CFM_NM1 
        FROM 
          HOLDING_TB 
        WHERE 
          HOLDING_TB.USE_YN = 'B' 
          AND HOLDING_TB.FACTORY = 'NM1' 
          AND HOLDING_TB.CTR_CD='${DATA.CTR_CD}'
        GROUP BY 
          HOLDING_TB.CTR_CD, HOLDING_TB.M_CODE
      ) AS HOLDING_TB ON(HOLDING_TB.CTR_CD = M090.CTR_CD AND HOLDING_TB.M_CODE = M090.M_CODE)
    WHERE M090.CTR_CD='${DATA.CTR_CD}'
  ) AS TONLIEU ON(M090.CTR_CD = TONLIEU.CTR_CD AND M090.M_CODE = TONLIEU.M_CODE) WHEN MATCHED THEN 
  UPDATE 
  SET 
    STOCK_ROLL_NM1 = TONLIEU.STOCK_ROLL_NM1, 
    STOCK_CFM_NM1 = TONLIEU.STOCK_CFM_NM1, 
    HOLDING_ROLL_NM1 = TONLIEU.HOLDING_ROLL_NM1, 
    HOLDING_CFM_NM1 = TONLIEU.HOLDING_CFM_NM1;
    `;
  let setpdQuery2 = `
     MERGE INTO M090 USING(
    SELECT 
      M090.M_CODE, 
      M090.M_NAME, 
      M090.CTR_CD,
      isnull(STOCK_TB2.STOCK_ROLL_NM2, 0) AS STOCK_ROLL_NM2, 
      isnull(STOCK_TB2.STOCK_CFM_NM2, 0) AS STOCK_CFM_NM2, 
      isnull(HOLDING_TB.HOLDING_ROLL_NM2, 0) AS HOLDING_ROLL_NM2, 
      isnull(HOLDING_TB.HOLDING_CFM_NM2, 0) AS HOLDING_CFM_NM2 
    FROM 
      M090 
      LEFT JOIN(
        SELECT 
          STOCK_TB.M_CODE, 
          STOCK_TB.CTR_CD,
          SUM(STOCK_TB.IN_ROLL_QTY) AS STOCK_ROLL_NM2, 
          SUM(STOCK_TB.IN_CFM_QTY) AS STOCK_CFM_NM2 
        FROM 
          (
            SELECT 
              I222.M_CODE, 
              I222.CTR_CD,
              SUM(I222.ROLL_QTY) AS IN_ROLL_QTY, 
              SUM(I222.ROLL_QTY * IN_CFM_QTY) AS IN_CFM_QTY 
            FROM 
              I222 
            WHERE 
              I222.USE_YN = 'T' 
              AND I222.FACTORY = 'NM2' 
              AND I222.CTR_CD='${DATA.CTR_CD}'
            GROUP BY 
              I222.M_CODE, I222.CTR_CD
            UNION ALL 
            SELECT 
              RETURN_NVL.M_CODE, 
              RETURN_NVL.CTR_CD,
              SUM(RETURN_NVL.ROLL_QTY) AS IN_ROLL_QTY, 
              SUM(RETURN_NVL.ROLL_QTY * RETURN_QTY) AS IN_CFM_QTY 
            FROM 
              RETURN_NVL 
            WHERE 
              RETURN_NVL.USE_YN = 'Y' 
              AND RETURN_NVL.FACTORY = 'NM2' 
              AND RETURN_NVL.CTR_CD='${DATA.CTR_CD}'
            GROUP BY 
              RETURN_NVL.M_CODE, RETURN_NVL.CTR_CD
          ) AS STOCK_TB 
        GROUP BY 
          STOCK_TB.M_CODE, STOCK_TB.CTR_CD
      ) AS STOCK_TB2 ON(STOCK_TB2.M_CODE = M090.M_CODE AND STOCK_TB2.CTR_CD = M090.CTR_CD) 
      LEFT JOIN(
        SELECT 
          HOLDING_TB.M_CODE, 
          HOLDING_TB.CTR_CD,
          SUM(HOLDING_TB.HOLDING_ROLL_QTY) AS HOLDING_ROLL_NM2, 
          SUM(
            HOLDING_TB.HOLDING_ROLL_QTY * HOLDING_QTY
          ) AS HOLDING_CFM_NM2 
        FROM 
          HOLDING_TB 
        WHERE 
          HOLDING_TB.USE_YN = 'B' 
          AND HOLDING_TB.FACTORY = 'NM2' 
          AND HOLDING_TB.CTR_CD='${DATA.CTR_CD}'
        GROUP BY 
          HOLDING_TB.M_CODE, HOLDING_TB.CTR_CD
      ) AS HOLDING_TB ON(HOLDING_TB.M_CODE = M090.M_CODE AND HOLDING_TB.CTR_CD = M090.CTR_CD)
    WHERE M090.CTR_CD='${DATA.CTR_CD}'
  ) AS TONLIEU ON(M090.M_CODE = TONLIEU.M_CODE AND M090.CTR_CD = TONLIEU.CTR_CD) WHEN MATCHED THEN 
  UPDATE 
  SET 
    STOCK_ROLL_NM2 = TONLIEU.STOCK_ROLL_NM2, 
    STOCK_CFM_NM2 = TONLIEU.STOCK_CFM_NM2, 
    HOLDING_ROLL_NM2 = TONLIEU.HOLDING_ROLL_NM2, 
    HOLDING_CFM_NM2 = TONLIEU.HOLDING_CFM_NM2;
    `
  //console.log(setpdQuery);
  checkkq1 = await queryDB(setpdQuery1);
  checkkq2 = await queryDB(setpdQuery2);
  //console.log(checkkq);
  res.send(checkkq1);
};
exports.tranhaplieu = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE I222.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59' `;
  if (DATA.M_NAME !== "") {
    condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
  }
  if (DATA.ROLL_NO_START != "" && DATA.ROLL_NO_STOP != "") {
    condition += ` AND SUBSTRING(M_LOT_NO,7,10) BETWEEN '${DATA.ROLL_NO_START}' AND '${DATA.ROLL_NO_STOP}'`;
  }
  let setpdQuery = ` SELECT  M1102.CUST_NAME_KD AS MAKER, I222.LOTNCC, I222.QC_PASS, I222.QC_PASS_EMPL, I222.QC_PASS_DATE, I222.M_LOT_NO, I222.M_CODE,M090.M_NAME, M090.WIDTH_CD, I222.IN_CFM_QTY,  I222.ROLL_QTY, (I222.IN_CFM_QTY * I222.ROLL_QTY) AS TOTAL_IN_QTY, I222.INS_DATE, M110.CUST_NAME_KD, I222.USE_YN, I221.INVOICE, I221.EXP_DATE, I222.LOC_CD,I222.FACTORY, CASE WHEN CODE_50 = '01' THEN 'GC'  WHEN CODE_50 = '02' THEN 'SK' WHEN CODE_50 = '03' THEN 'KD' WHEN CODE_50 = '04' THEN 'VN' WHEN CODE_50 = '05' THEN 'SAMPLE' WHEN CODE_50 = '06' THEN 'Vai bac 4' ELSE 'ETC' END AS PHAN_LOAI      FROM I222 					
            LEFT JOIN  M110 ON (I222.CUST_CD = M110.CUST_CD AND I222.CTR_CD = M110.CTR_CD)
            LEFT JOIN M090 ON (M090.M_CODE=  I222.M_CODE AND I222.CTR_CD = M090.CTR_CD)
  LEFT JOIN ZTB_MATERIAL_TB ON (ZTB_MATERIAL_TB.CTR_CD = M090.CTR_CD AND ZTB_MATERIAL_TB.M_NAME = M090.M_NAME)
  LEFT JOIN M110 AS M1102 ON (M1102.CTR_CD = ZTB_MATERIAL_TB.CTR_CD AND M1102.CUST_CD = ZTB_MATERIAL_TB.CUST_CD)
  LEFT JOIN I221 ON (I221.CTR_CD = I222.CTR_CD AND I221.IN_DATE = I222.IN_DATE AND I221.IN_NO = I222.IN_NO AND I221.IN_SEQ = I222.IN_SEQ)
            ${condition}
            AND I222.CTR_CD='${DATA.CTR_CD}'
            ORDER BY I222.INS_DATE DESC`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.traxuatlieu = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ` WHERE O302.CTR_CD='${DATA.CTR_CD}'  `;
  if (DATA.ALLTIME !== true) {
    condition += ` AND O302.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  if (DATA.M_NAME !== "") {
    condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
  }
  if (DATA.M_CODE !== "") {
    condition += ` AND M090.M_CODE = '${DATA.M_CODE}'`;
  }
  if (DATA.PROD_REQUEST_NO !== "") {
    condition += ` AND P400.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
  }
  if (DATA.PLAN_ID !== "") {
    condition += ` AND O302.PLAN_ID ='${DATA.PLAN_ID}'`;
  }
  let setpdQuery = `  SELECT  M100.G_CODE, M100.G_NAME, P400.PROD_REQUEST_NO, O302.PLAN_ID, M090.M_CODE, M090.M_NAME, M090.WIDTH_CD,I222.LOTNCC, O302.M_LOT_NO, O302.OUT_CFM_QTY, O302.ROLL_QTY, (O302.OUT_CFM_QTY* O302.ROLL_QTY) AS TOTAL_OUT_QTY, O302.INS_DATE,O302.INS_EMPL, O302.INS_RECEPTION 
            FROM O302
            LEFT JOIN O301 ON (O302.OUT_DATE = O301.OUT_DATE AND O302.OUT_NO = O301.OUT_NO AND O301.OUT_SEQ = O302.OUT_SEQ AND O302.CTR_CD = O301.CTR_CD)
            LEFT JOIN O300 ON (O300.OUT_DATE = O301.OUT_DATE AND O300.OUT_NO = O301.OUT_NO AND O300.CTR_CD = O301.CTR_CD)
            LEFT JOIN P400 ON (O300.PROD_REQUEST_NO = P400.PROD_REQUEST_NO AND O300.CTR_CD = P400.CTR_CD) 
            LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE AND P400.CTR_CD = M100.CTR_CD)
            LEFT JOIN M090 ON (M090.M_CODE = O302.M_CODE AND O302.CTR_CD = M090.CTR_CD) 
            LEFT JOIN I222 ON (I222.M_LOT_NO = O302.M_LOT_NO AND O302.CTR_CD = I222.CTR_CD)
            ${condition}                   
            ORDER BY O302.INS_DATE DESC`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.tratonlieu = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE M090.CTR_CD='${DATA.CTR_CD}' `;
  if (DATA.M_NAME !== "") {
    condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
  }
  if (DATA.M_CODE !== "") {
    condition += ` AND M090.M_CODE = '${DATA.M_CODE}'`;
  }
  if (DATA.JUSTBALANCE === true) {
    condition += ` AND ((isnull(STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0))  <>0 OR (isnull(HOLDING_CFM_NM1,0)+ isnull(HOLDING_CFM_NM2,0)) <>0)`;
  }
  let setpdQuery = `SELECT TDS, M_CODE, M_NAME, WIDTH_CD, isnull(STOCK_CFM_NM1,0) AS TON_NM1, isnull(STOCK_CFM_NM2,0) AS TON_NM2, isnull(HOLDING_CFM_NM1,0) AS HOLDING_NM1, isnull(HOLDING_CFM_NM2,0) AS HOLDING_NM2, (isnull(STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0)) AS TOTAL_OK, (isnull(HOLDING_CFM_NM1,0)+ isnull(HOLDING_CFM_NM1,0)) AS TOTAL_HOLDING FROM M090  ${condition}`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.updatelieuncc = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = ` UPDATE I222 SET LOTNCC='${DATA.LOTNCC}' WHERE CTR_CD='${DATA.CTR_CD}' AND M_LOT_NO='${DATA.M_LOT_NO}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkMNAMEfromLotI222XuatKho = async (req, res, DATA) => {
  let kqua;
  let query = `SELECT RETURNVLTB.RETURN_QTY, I222.USE_YN, CHITHITB.LIEUQL_SX, I222.LOC_CD, I222.WAHS_CD,  M110.CUST_NAME_KD, I222.CUST_CD, I222.M_CODE, M090.M_NAME, M090.WIDTH_CD, I222.IN_CFM_QTY, I222.ROLL_QTY, I222.IN_DATE, M110.CUST_NAME_KD, M090.FSC, M090.FSC_CODE FROM I222 
  LEFT JOIN M090 ON (M090.M_CODE = I222.M_CODE AND M090.CTR_CD = I222.CTR_CD) 
  LEFT JOIN M110 ON (M110.CUST_CD = I222.CUST_CD AND M110.CTR_CD = I222.CTR_CD) 
  LEFT JOIN (SELECT * FROM ZTB_QLSXCHITHI WHERE PLAN_ID='${DATA.PLAN_ID}') AS CHITHITB ON (CHITHITB.M_CODE = I222.M_CODE AND CHITHITB.CTR_CD = I222.CTR_CD)
  LEFT JOIN (SELECT * FROM RETURN_NVL WHERE M_LOT_NO='${DATA.M_LOT_NO}' AND USE_YN='Y') AS RETURNVLTB ON (RETURNVLTB.M_LOT_NO = I222.M_LOT_NO AND RETURNVLTB.CTR_CD = I222.CTR_CD)
  WHERE I222.M_LOT_NO='${DATA.M_LOT_NO}' AND I222.CTR_CD='${DATA.CTR_CD}'`;
  ////console.log(query);
  kqua = await queryDB(query);
  res.send(kqua);
};
exports.checksolanout_O302 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT MAX(SOLANOUT) AS SOLANOUT FROM O302 WHERE  CTR_CD='${DATA.CTR_CD}' AND PLAN_ID ='${DATA.PLAN_ID}'`;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
};
exports.xuatpackkhotp = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE 1=1 `;
  if (!DATA.ALLTIME) {
    condition += ` AND AA.OUT_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
  }
  if (DATA.G_CODE !== '') {
    condition += `AND AA.G_CODE='${DATA.G_CODE}'`
  }
  if (DATA.G_NAME !== '') {
    condition += `AND AA.G_NAME LIKE'%${DATA.G_NAME}%'`
  }
  if (DATA.CUST_NAME_KD !== '') {
    condition += `AND AA.CUST_NAME_KD LIKE'%${DATA.CUST_NAME_KD}%'`
  }
  else
    if (DATA.CAPBU === false) {
      condition += `AND  AA.CUST_NAME_KD <>'CMSV'`
    }
  let setpdQuery = `SELECT * FROM 
  (
  SELECT  tbl_Bxout.Product_MaVach AS G_CODE, M100.G_NAME,M100.G_NAME_KD, M100.PROD_MODEL, tbl_Bxout.OutID,M110.CUST_NAME_KD, tbl_Bxout.Customer_SortName, CAST(tbl_Bxout.Time as date) as OUT_DATE,tbl_Bxout.Time AS OUT_DATETIME,isnull(tbl_Bxin.Qty*tbl_Bxin.Qty_KTID, tbl_Bxout.Qty_OutID*tbl_Bxout.Qty) AS Out_Qty,
  isnull(CAST(P501.INS_DATE AS date), P501_A.INS_DATE) SX_DATE,
  isnull(ZTBLOTPRINTHISTORYTB.LABEL_ID2,ZTBLOTPRINTHISTORYTB_A.LABEL_ID2) AS INSPECT_LOT_NO,
  CAST(isnull(tbl_Bxin.SXID,P501_A.PROCESS_LOT_NO) AS varchar) AS PROCESS_LOT_NO , 
  isnull(P501.M_LOT_NO, P501_A.M_LOT_NO) AS M_LOT_NO, 
  isnull(I222.LOTNCC, I222_A.LOTNCC) AS LOTNCC,
  isnull(M090.M_NAME,M090_A.M_NAME) AS M_NAME,
  isnull(M090.WIDTH_CD,M090_A.WIDTH_CD) AS WIDTH_CD,
  isnull(P501.INS_EMPL, P501_A.INS_EMPL) AS SX_EMPL,
  isnull(ZTBLOTPRINTHISTORYTB.LINEQC_EMPL_NO,ZTBLOTPRINTHISTORYTB_A.LINEQC_EMPL_NO) AS LINEQC_EMPL,
  isnull(ZTBLOTPRINTHISTORYTB.EMPL_NO,ZTBLOTPRINTHISTORYTB_A.EMPL_NO) AS INSPECT_EMPL,
  isnull(ZTBLOTPRINTHISTORYTB.EXP_DATE,ZTBLOTPRINTHISTORYTB_A.EXP_DATE) AS EXP_DATE,
  tbl_Bxout.Outtype
  FROM tbl_Bxout 
  LEFT JOIN M100 ON (M100.G_CODE = tbl_Bxout.Product_MaVach)
  LEFT JOIN tbl_Bxin ON (tbl_Bxout.OutID = tbl_Bxin.BXID)
  LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = CAST(tbl_Bxin.SXID as varchar))
  LEFT JOIN  ZTBLOTPRINTHISTORYTB ON (ZTBLOTPRINTHISTORYTB.LABEL_ID2 = CAST(tbl_Bxout.OutID as varchar))
  LEFT JOIN (SELECT * FROM P501) AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBLOTPRINTHISTORYTB.PROCESS_LOT_NO)
  LEFT JOIN I222 ON I222.M_LOT_NO = P501.M_LOT_NO
  LEFT JOIN M090 ON M090.M_CODE = I222.M_CODE
  LEFT JOIN (SELECT * FROM I222) AS I222_A ON I222_A.M_LOT_NO= P501_A.M_LOT_NO
  LEFT JOIN (SELECT * FROM M090) AS M090_A ON M090_A.M_CODE = I222_A.M_CODE
  LEFT JOIN tbl_Customer ON tbl_Customer.Customer_SortName = tbl_Bxout.Customer_SortName
  LEFT JOIN M110 ON tbl_Customer.CUST_CD = M110.CUST_CD
  LEFT JOIN (SELECT * FROM ZTBLOTPRINTHISTORYTB) AS ZTBLOTPRINTHISTORYTB_A ON ZTBLOTPRINTHISTORYTB_A.LABEL_ID2 = CAST(tbl_Bxin.KTID as varchar)
  ) AS AA
  ${condition}
  ORDER BY AA.OUT_DATETIME DESC`;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.trakhotpInOut = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.ALLTIME !== true) {
    condition += `AND tbl_InputOutput.IO_Date BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}' `;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND tbl_InputOutput.Product_MaVach = '${DATA.G_CODE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
  }
  if (DATA.CUST_NAME !== "") {
    condition += ` AND tbl_InputOutput.Customer_ShortName LIKE '%${DATA.CUST_NAME}%' `;
  }
  if (DATA.CAPBU === false && DATA.INOUT === "OUT") {
    condition += ` AND Customer_ShortName <> 'CMSV' `;
  }
  condition += ` AND tbl_InputOutput.IO_Type = '${DATA.INOUT}' `;
  let setpdQuery = `SELECT tbl_InputOutput.IO_Status, tbl_InputOutput.IO_Note,tbl_InputOutput.IO_Number, M110.CUST_NAME_KD, tbl_InputOutput.Product_MaVach AS G_CODE, M100.G_NAME, M100.G_NAME_KD, tbl_InputOutput.Customer_ShortName, tbl_InputOutput.IO_Date, CONVERT(datetime,tbl_InputOutput.IO_Time) AS INPUT_DATETIME, tbl_InputOutput.IO_Shift ,tbl_InputOutput.IO_Type, tbl_InputOutput.IO_Qty FROM tbl_InputOutput LEFT JOIN M100 ON (M100.G_CODE= tbl_InputOutput.Product_MaVach) 
            LEFT JOIN tbl_Customer ON (tbl_Customer.Customer_SortName = tbl_InputOutput.Customer_ShortName)
            LEFT JOIN M110 ON (M110.CUST_CD = tbl_Customer.CUST_CD) ${condition} ORDER BY tbl_InputOutput.IO_Time DESC`;
  //////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.traSTOCKCMS_NEW = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
  }
  if (DATA.JUSTBALANCE !== false) {
    condition += `AND (THANHPHAM.TONKHO >0 OR TONKIEM_NEW.INSPECT_BALANCE_QTY >0 OR BTP.BTP_QTY_EA > 0)`;
  }
  let setpdQuery = `WITH CTE_THANHPHAM AS (
SELECT 
Product_MaVach AS G_CODE, 
SUM(CASE WHEN IO_type = 'IN' THEN IO_Qty ELSE 0 END) AS NHAPKHO,
SUM(CASE WHEN IO_type = 'OUT' THEN IO_Qty ELSE 0 END) AS XUATKHO,
SUM(CASE WHEN IO_type = 'OUT' AND IO_Status = 'Pending' THEN IO_Qty ELSE 0 END) AS XUATKHO_PD,
SUM(CASE WHEN IO_type = 'IN' THEN IO_Qty ELSE 0 END) - SUM(CASE WHEN IO_type = 'OUT' THEN IO_Qty ELSE 0 END) AS TONKHO,
SUM(CASE WHEN IO_type = 'OUT' AND (IO_Status <> 'Pending' OR IO_Status IS NULL) THEN IO_Qty ELSE 0 END) AS XUATKHO_TT,
SUM(CASE WHEN IO_type = 'IN' THEN IO_Qty ELSE 0 END) - SUM(CASE WHEN IO_type = 'OUT' AND (IO_Status <> 'Pending' OR IO_Status IS NULL) THEN IO_Qty ELSE 0 END) AS TONKHO_TT
FROM tbl_InputOutput
GROUP BY Product_MaVach
),
CTE_TONKIEM AS (
SELECT 
ZTB_WAIT_INSPECT.G_CODE,
M100.G_NAME,
M100.G_NAME_KD,
SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY,
SUM(WAIT_CS_QTY) AS WAIT_CS_QTY,
SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA,
SUM(INSPECT_BALANCE_QTY + WAIT_CS_QTY + WAIT_SORTING_RMA) AS TOTAL_WAIT
FROM ZTB_WAIT_INSPECT
INNER JOIN M100 ON M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE
WHERE UPDATE_DATE = CONVERT(DATE, GETDATE()) AND CALAMVIEC = 'DEM'
GROUP BY ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD
),
CTE_TONKIEM_NEW AS (
SELECT 
CTR_CD, 
G_CODE, 
SUM(INPUT_QTY_EA) AS INSPECT_BALANCE_QTY 
FROM ZTBINSPECTINPUTTB
WHERE INSPECT_YN = 'Y' AND P400_YN = 'Y'
GROUP BY CTR_CD, G_CODE
),
CTE_BLOCK_TABLE AS (
SELECT 
Product_MaVach, 
SUM(Block_Qty) AS Block_Qty
FROM tbl_Block2
GROUP BY Product_MaVach
),
CTE_BTP AS (
SELECT 
ZTB_HALF_GOODS.G_CODE,
M100.G_NAME,
SUM(BTP_QTY_EA) AS BTP_QTY_EA
FROM ZTB_HALF_GOODS
INNER JOIN M100 ON M100.G_CODE = ZTB_HALF_GOODS.G_CODE
WHERE UPDATE_DATE = CONVERT(DATE, GETDATE())
GROUP BY ZTB_HALF_GOODS.G_CODE, M100.G_NAME
)
SELECT 
M100.G_CODE,
M100.G_NAME,
M100.G_NAME_KD,
ISNULL(TONKIEM_NEW.INSPECT_BALANCE_QTY, 0) AS CHO_KIEM,
ISNULL(TONKIEM.WAIT_CS_QTY, 0) AS CHO_CS_CHECK,
ISNULL(TONKIEM.WAIT_SORTING_RMA, 0) AS CHO_KIEM_RMA,
ISNULL(TONKIEM_NEW.INSPECT_BALANCE_QTY, 0) 
+ ISNULL(TONKIEM.WAIT_CS_QTY, 0) 
+ ISNULL(TONKIEM.WAIT_SORTING_RMA, 0) AS TONG_TON_KIEM,
ISNULL(M100.BTP_QTY, 0) AS BTP,
ISNULL(THANHPHAM.TONKHO, 0) AS TON_TP,
ISNULL(tbl_Block_table2.Block_Qty, 0) AS BLOCK_QTY,
ISNULL(TONKIEM_NEW.INSPECT_BALANCE_QTY, 0) 
+ ISNULL(TONKIEM.WAIT_CS_QTY, 0) 
+ ISNULL(TONKIEM.WAIT_SORTING_RMA, 0) 
+ ISNULL(M100.BTP_QTY, 0)
+ ISNULL(THANHPHAM.TONKHO, 0) 
- ISNULL(tbl_Block_table2.Block_Qty, 0) AS GRAND_TOTAL_STOCK,
ISNULL(THANHPHAM.XUATKHO_PD, 0) AS PENDINGXK,
ISNULL(THANHPHAM.TONKHO_TT, 0) AS TON_TPTT
FROM M100
LEFT JOIN CTE_THANHPHAM AS THANHPHAM ON THANHPHAM.G_CODE = M100.G_CODE
LEFT JOIN CTE_TONKIEM AS TONKIEM ON M100.G_CODE = TONKIEM.G_CODE
LEFT JOIN CTE_TONKIEM_NEW AS TONKIEM_NEW ON M100.G_CODE = TONKIEM_NEW.G_CODE
LEFT JOIN CTE_BLOCK_TABLE AS tbl_Block_table2 ON tbl_Block_table2.Product_MaVach = M100.G_CODE
LEFT JOIN CTE_BTP AS BTP ON BTP.G_CODE = M100.G_CODE ${condition} `;
  //////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.traSTOCKCMS = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
  }
  if (DATA.JUSTBALANCE !== false) {
    condition += `AND THANHPHAM.TONKHO >0 `;
  }
  let setpdQuery = `SELECT M100.G_CODE
  ,M100.G_NAME
  ,M100.G_NAME_KD
  ,isnull(TONKIEM.INSPECT_BALANCE_QTY, 0) AS CHO_KIEM
  ,isnull(TONKIEM.WAIT_CS_QTY, 0) AS CHO_CS_CHECK
  ,isnull(TONKIEM.WAIT_SORTING_RMA, 0) CHO_KIEM_RMA
  ,isnull(TONKIEM.TOTAL_WAIT, 0) AS TONG_TON_KIEM
  ,isnull(BTP.BTP_QTY_EA, 0) AS BTP
  ,isnull(THANHPHAM.TONKHO, 0) AS TON_TP          
  ,isnull(tbl_Block_table2.Block_Qty, 0) AS BLOCK_QTY
  ,(isnull(TONKIEM.TOTAL_WAIT, 0) + isnull(BTP.BTP_QTY_EA, 0) + isnull(THANHPHAM.TONKHO, 0) - isnull(tbl_Block_table2.Block_Qty, 0)) AS GRAND_TOTAL_STOCK
  ,isnull(THANHPHAM.XUATKHO_PD, 0) AS PENDINGXK
  ,isnull(THANHPHAM.TONKHO_TT, 0) AS TON_TPTT
FROM M100
LEFT JOIN (
  select Product_MaVach AS G_CODE, SUM(CASE WHEN IO_type='IN' THEN IO_Qty ELSE 0 END) AS NHAPKHO,SUM(CASE WHEN IO_type='OUT' THEN IO_Qty ELSE 0 END) AS XUATKHO,SUM(CASE WHEN IO_type='OUT' AND IO_Status= 'Pending' THEN IO_Qty ELSE 0 END) AS XUATKHO_PD,SUM(CASE WHEN IO_type='IN' THEN IO_Qty ELSE 0 END) -SUM(CASE WHEN IO_type='OUT' THEN IO_Qty ELSE 0 END) AS TONKHO, SUM(CASE WHEN IO_type='OUT' AND (IO_Status<> 'Pending' OR IO_Status is null) THEN IO_Qty ELSE 0 END) AS XUATKHO_TT, SUM(CASE WHEN IO_type='IN' THEN IO_Qty ELSE 0 END) -SUM(CASE WHEN IO_type='OUT' AND (IO_Status<> 'Pending' OR IO_Status is null)THEN IO_Qty ELSE 0 END) AS TONKHO_TT FROM tbl_InputOutput 
group by Product_MaVach 
  ) AS THANHPHAM ON (THANHPHAM.G_CODE = M100.G_CODE)
LEFT JOIN (
  SELECT ZTB_WAIT_INSPECT.G_CODE
    ,M100.G_NAME
    ,M100.G_NAME_KD
    ,SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY
    ,SUM(WAIT_CS_QTY) AS WAIT_CS_QTY
    ,SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA
    ,SUM(INSPECT_BALANCE_QTY + WAIT_CS_QTY + WAIT_SORTING_RMA) AS TOTAL_WAIT
  FROM ZTB_WAIT_INSPECT
  INNER JOIN M100 ON (M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE)
  WHERE UPDATE_DATE = CONVERT(DATE, GETDATE())
    AND CALAMVIEC = 'DEM'
  GROUP BY ZTB_WAIT_INSPECT.G_CODE
    ,M100.G_NAME
    ,M100.G_NAME_KD
  ) AS TONKIEM ON (THANHPHAM.G_CODE = TONKIEM.G_CODE)
LEFT JOIN (
  SELECT Product_MaVach
    ,SUM(Block_Qty) AS Block_Qty
  FROM tbl_Block2
  GROUP BY Product_MaVach
  ) AS tbl_Block_table2 ON (tbl_Block_table2.Product_MaVach = M100.G_CODE)
LEFT JOIN (
  SELECT ZTB_HALF_GOODS.G_CODE
    ,M100.G_NAME
    ,SUM(BTP_QTY_EA) AS BTP_QTY_EA
  FROM ZTB_HALF_GOODS
  INNER JOIN M100 ON (M100.G_CODE = ZTB_HALF_GOODS.G_CODE)
  WHERE UPDATE_DATE = CONVERT(DATE, GETDATE())
  GROUP BY ZTB_HALF_GOODS.G_CODE
    ,M100.G_NAME
  ) AS BTP ON (BTP.G_CODE = THANHPHAM.G_CODE) ${condition} `;
  //////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.traSTOCKKD_NEW = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
  }
  if (DATA.JUSTBALANCE !== false) {
    condition += `AND (THANHPHAM.TONKHO >0  OR TONKIEM_NEW.INSPECT_BALANCE_QTY > 0 OR BTP.BTP_QTY_EA > 0) `;
  }
  let setpdQuery = `WITH CTE_THANHPHAM AS (
SELECT 
Product_MaVach, 
SUM(CASE WHEN IO_type = 'IN' THEN IO_Qty ELSE 0 END) AS NHAPKHO,
SUM(CASE WHEN IO_type = 'OUT' THEN IO_Qty ELSE 0 END) AS XUATKHO,
SUM(CASE WHEN IO_type = 'OUT' AND IO_Status = 'Pending' THEN IO_Qty ELSE 0 END) AS XUATKHO_PD,
SUM(CASE WHEN IO_type = 'IN' THEN IO_Qty ELSE 0 END) - SUM(CASE WHEN IO_type = 'OUT' THEN IO_Qty ELSE 0 END) AS TONKHO,
SUM(CASE WHEN IO_type = 'OUT' AND (IO_Status <> 'Pending' OR IO_Status IS NULL) THEN IO_Qty ELSE 0 END) AS XUATKHO_TT,
SUM(CASE WHEN IO_type = 'IN' THEN IO_Qty ELSE 0 END) - SUM(CASE WHEN IO_type = 'OUT' AND (IO_Status <> 'Pending' OR IO_Status IS NULL) THEN IO_Qty ELSE 0 END) AS TONKHO_TT
FROM tbl_InputOutput
GROUP BY Product_MaVach
),
CTE_TONKIEM AS (
SELECT 
ZTB_WAIT_INSPECT.G_CODE, 
M100.G_NAME, 
M100.G_NAME_KD, 
SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY, 
SUM(WAIT_CS_QTY) AS WAIT_CS_QTY, 
SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA, 
SUM(INSPECT_BALANCE_QTY + WAIT_CS_QTY + WAIT_SORTING_RMA) AS TOTAL_WAIT
FROM ZTB_WAIT_INSPECT
JOIN M100 ON M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE
WHERE UPDATE_DATE = CONVERT(date, GETDATE()) AND CALAMVIEC = 'DEM'
GROUP BY ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD
),
CTE_TONKIEM_NEW AS (
SELECT 
CTR_CD, 
G_CODE, 
SUM(INPUT_QTY_EA) AS INSPECT_BALANCE_QTY
FROM ZTBINSPECTINPUTTB
WHERE INSPECT_YN = 'Y' AND P400_YN = 'Y'
GROUP BY CTR_CD, G_CODE
),
CTE_BLOCK_TABLE AS (
SELECT 
Product_MaVach, 
SUM(Block_Qty) AS Block_Qty
FROM tbl_Block2
GROUP BY Product_MaVach
),
CTE_BTP AS (
SELECT 
ZTB_HALF_GOODS.G_CODE, 
M100.G_NAME, 
SUM(BTP_QTY_EA) AS BTP_QTY_EA
FROM ZTB_HALF_GOODS
JOIN M100 ON M100.G_CODE = ZTB_HALF_GOODS.G_CODE
WHERE UPDATE_DATE = CONVERT(date, GETDATE())
GROUP BY ZTB_HALF_GOODS.G_CODE, M100.G_NAME
)
SELECT 
M100.G_NAME_KD, 
SUM(ISNULL(TONKIEM_NEW.INSPECT_BALANCE_QTY, 0)) AS CHO_KIEM, 
SUM(ISNULL(TONKIEM.WAIT_CS_QTY, 0)) AS CHO_CS_CHECK, 
SUM(ISNULL(TONKIEM.WAIT_SORTING_RMA, 0)) AS CHO_KIEM_RMA, 
SUM(ISNULL(TONKIEM_NEW.INSPECT_BALANCE_QTY, 0) + ISNULL(TONKIEM.WAIT_CS_QTY, 0) + ISNULL(TONKIEM.WAIT_SORTING_RMA, 0)) AS TONG_TON_KIEM, 
SUM(ISNULL(M100.BTP_QTY, 0)) AS BTP, 
SUM(ISNULL(THANHPHAM.TONKHO, 0)) AS TON_TP,
SUM(ISNULL(THANHPHAM.XUATKHO_PD, 0)) AS PENDINGXK,
SUM(ISNULL(THANHPHAM.TONKHO_TT, 0)) AS TON_TPTT,
SUM(ISNULL(tbl_Block_table2.Block_Qty, 0)) AS BLOCK_QTY, 
SUM(
ISNULL(TONKIEM_NEW.INSPECT_BALANCE_QTY, 0) + ISNULL(TONKIEM.WAIT_CS_QTY, 0) + ISNULL(TONKIEM.WAIT_SORTING_RMA, 0)
+ ISNULL(TONKIEM.WAIT_CS_QTY, 0) 
+ ISNULL(TONKIEM.WAIT_SORTING_RMA, 0)
+ ISNULL(M100.BTP_QTY, 0) 
+ ISNULL(THANHPHAM.TONKHO, 0) 
- ISNULL(tbl_Block_table2.Block_Qty, 0)
) AS GRAND_TOTAL_STOCK
FROM M100
LEFT JOIN CTE_THANHPHAM AS THANHPHAM ON THANHPHAM.Product_MaVach = M100.G_CODE
LEFT JOIN CTE_TONKIEM AS TONKIEM ON M100.G_CODE = TONKIEM.G_CODE
LEFT JOIN CTE_TONKIEM_NEW AS TONKIEM_NEW ON M100.G_CODE = TONKIEM_NEW.G_CODE
LEFT JOIN CTE_BLOCK_TABLE AS tbl_Block_table2 ON tbl_Block_table2.Product_MaVach = M100.G_CODE
LEFT JOIN CTE_BTP AS BTP ON BTP.G_CODE = M100.G_CODE ${condition} GROUP BY M100.G_NAME_KD`;
  //////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.traSTOCKKD = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
  }
  if (DATA.JUSTBALANCE !== false) {
    condition += `AND THANHPHAM.TONKHO >0 `;
  }
  let setpdQuery = `SELECT 
  M100.G_NAME_KD, 
  SUM(
    isnull(TONKIEM.INSPECT_BALANCE_QTY, 0)
  ) AS CHO_KIEM, 
  SUM(
    isnull(TONKIEM.WAIT_CS_QTY, 0)
  ) AS CHO_CS_CHECK, 
  SUM(
    isnull(TONKIEM.WAIT_SORTING_RMA, 0)
  ) AS CHO_KIEM_RMA, 
  SUM(
    isnull(TONKIEM.TOTAL_WAIT, 0)
  ) AS TONG_TON_KIEM, 
  SUM(
    isnull(BTP.BTP_QTY_EA, 0)
  ) AS BTP, 
  SUM(
    isnull(THANHPHAM.TONKHO, 0)
  ) AS TON_TP,
   SUM(
    isnull(THANHPHAM.XUATKHO_PD, 0)
  ) AS PENDINGXK,
   SUM(
    isnull(THANHPHAM.TONKHO_TT, 0)
  ) AS TON_TPTT,
  SUM(
    isnull(tbl_Block_table2.Block_Qty, 0)
  ) AS BLOCK_QTY, 
  SUM(
    (
      isnull(TONKIEM.TOTAL_WAIT, 0)
    ) + isnull(BTP.BTP_QTY_EA, 0)+ isnull(THANHPHAM.TONKHO, 0) - isnull(tbl_Block_table2.Block_Qty, 0)
  ) AS GRAND_TOTAL_STOCK 
FROM 
  M100 
  LEFT JOIN (
    select Product_MaVach, SUM(CASE WHEN IO_type='IN' THEN IO_Qty ELSE 0 END) AS NHAPKHO,SUM(CASE WHEN IO_type='OUT' THEN IO_Qty ELSE 0 END) AS XUATKHO,SUM(CASE WHEN IO_type='OUT' AND IO_Status= 'Pending' THEN IO_Qty ELSE 0 END) AS XUATKHO_PD,SUM(CASE WHEN IO_type='IN' THEN IO_Qty ELSE 0 END) -SUM(CASE WHEN IO_type='OUT' THEN IO_Qty ELSE 0 END) AS TONKHO, SUM(CASE WHEN IO_type='OUT' AND (IO_Status<> 'Pending' OR IO_Status is null) THEN IO_Qty ELSE 0 END) AS XUATKHO_TT, SUM(CASE WHEN IO_type='IN' THEN IO_Qty ELSE 0 END) -SUM(CASE WHEN IO_type='OUT' AND (IO_Status<> 'Pending' OR IO_Status is null)THEN IO_Qty ELSE 0 END) AS TONKHO_TT FROM tbl_InputOutput 
group by Product_MaVach 
  ) AS THANHPHAM ON (
    THANHPHAM.Product_MaVach = M100.G_CODE
  ) 
  LEFT JOIN (
    SELECT 
      ZTB_WAIT_INSPECT.G_CODE, 
      M100.G_NAME, 
      M100.G_NAME_KD, 
      SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY, 
      SUM(WAIT_CS_QTY) AS WAIT_CS_QTY, 
      SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA, 
      SUM(
        INSPECT_BALANCE_QTY + WAIT_CS_QTY + WAIT_SORTING_RMA
      ) AS TOTAL_WAIT 
    FROM 
      ZTB_WAIT_INSPECT 
      JOIN M100 ON (
        M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE
      ) 
    WHERE 
      UPDATE_DATE = CONVERT(
        date, 
        GETDATE()
      ) 
      AND CALAMVIEC = 'DEM' 
    GROUP BY 
      ZTB_WAIT_INSPECT.G_CODE, 
      M100.G_NAME, 
      M100.G_NAME_KD
  ) AS TONKIEM ON (
    THANHPHAM.Product_MaVach = TONKIEM.G_CODE
  ) 
  LEFT JOIN (
    SELECT 
      Product_MaVach, 
      SUM(Block_Qty) AS Block_Qty 
    from 
      tbl_Block2 
    GROUP BY 
      Product_MaVach
  ) AS tbl_Block_table2 ON (
    tbl_Block_table2.Product_MaVach = M100.G_CODE
  ) 
  LEFT JOIN (
    SELECT 
      ZTB_HALF_GOODS.G_CODE, 
      M100.G_NAME, 
      SUM(BTP_QTY_EA) AS BTP_QTY_EA 
    FROM 
      ZTB_HALF_GOODS 
      JOIN M100 ON (
        M100.G_CODE = ZTB_HALF_GOODS.G_CODE
      ) 
    WHERE 
      UPDATE_DATE = CONVERT(
        date, 
        GETDATE()
      ) 
    GROUP BY 
      ZTB_HALF_GOODS.G_CODE, 
      M100.G_NAME
  ) AS BTP ON (
    BTP.G_CODE = THANHPHAM.Product_MaVach
  ) ${condition} GROUP BY M100.G_NAME_KD`;
  //////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.traSTOCKTACH = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
  }
  if (DATA.JUSTBALANCE !== false) {
    condition += `AND THANHPHAM.TONKHO >0 `;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}' `;
  }
  let setpdQuery = `SELECT isnull(THANHPHAM.WH_Name,'NO_STOCK') AS KHO_NAME, tbl_Location.LC_NAME, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, isnull(THANHPHAM.NHAPKHO,0) AS NHAPKHO, isnull(THANHPHAM.XUATKHO,0) AS XUATKHO, isnull(THANHPHAM.TONKHO,0) AS TONKHO, isnull(tbl_Block_table2.Block_Qty,0) AS BLOCK_QTY, ( isnull(THANHPHAM.TONKHO,0)-isnull(tbl_Block_table2.Block_Qty,0)) AS GRAND_TOTAL_TP FROM M100 LEFT JOIN ( SELECT Product_MaVach, WH_Name, isnull([IN],0) AS NHAPKHO, isnull([OUT],0) AS XUATKHO, (isnull([IN],0)- isnull([OUT],0)) AS TONKHO FROM ( SELECT Product_Mavach, WH_Name, IO_Type, IO_Qty FROM tbl_InputOutput ) AS SourceTable PIVOT ( SUM(IO_Qty) FOR IO_Type IN ([IN], [OUT]) ) AS PivotTable ) AS THANHPHAM ON (THANHPHAM.Product_MaVach = M100.G_CODE) LEFT JOIN ( SELECT Product_MaVach, WH_Name, SUM(Block_Qty) AS Block_Qty from tbl_Block2 GROUP BY Product_MaVach,WH_Name ) AS tbl_Block_table2 ON (tbl_Block_table2.Product_MaVach= THANHPHAM.Product_MaVach AND tbl_Block_table2.WH_Name= THANHPHAM.WH_Name) LEFT JOIN tbl_Location ON (tbl_Location.Product_MaVach = THANHPHAM.Product_MaVach AND tbl_Location.WH_Name = THANHPHAM.WH_Name) ${condition}`;
  //////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
};
exports.loadKTP_IN = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.ALLTIME === false) {
    condition += ` AND I660.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59'`;
  }
  if (DATA.FACTORY !== "ALL") {
    condition += ` AND I660.FACTORY = '${DATA.FACTORY}' `;
  }
  if (DATA.PROD_TYPE !== "ALL") {
    condition += ` AND M100.PROD_TYPE = '${DATA.PROD_TYPE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
  }
  if (DATA.PROD_REQUEST_NO !== "") {
    condition += ` AND I660.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
  }
  if (DATA.KD_EMPL_NAME !== "") {
    condition += ` AND M010.EMPL_NAME LIKE '%${DATA.KD_EMPL_NAME}%'`;
  }
  if (DATA.CUST_NAME_KD !== "") {
    condition += ` AND M110.CUST_NAME_KD LIKE '%${DATA.CUST_NAME_KD}%'`;
  }
  let setpdQuery = `
  SELECT CAST(I660.INS_DATE as date) AS IN_DATE,I660.FACTORY,I660.AUTO_ID,I660.INSPECT_OUTPUT_ID,I660.PACK_ID,M010.EMPL_NAME, I660.PROD_REQUEST_NO,M110.CUST_NAME_KD, I660.G_CODE, M100.G_NAME, M100.G_NAME_KD, M100.PROD_TYPE, I660.PLAN_ID,I660.IN_QTY,
  CASE WHEN I660.USE_YN= 'T' THEN 'PENDING' WHEN I660.USE_YN= 'Y' THEN 'TONKHO'  ELSE 'DA GIAO' END AS USE_YN
  ,I660.EMPL_GIAO,I660.EMPL_NHAN,I660.INS_DATE,I660.INS_EMPL,I660.UPD_DATE,I660.UPD_EMPL,
  CASE WHEN I660.STATUS ='N' THEN 'OK' ELSE 'BL' END AS STATUS
  ,I660.REMARK
  FROM I660
  LEFT JOIN M100 ON (M100.G_CODE = I660.G_CODE AND M100.CTR_CD = I660.CTR_CD)
  LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = I660.PROD_REQUEST_NO AND P400.CTR_CD = I660.CTR_CD)
  LEFT JOIN M110 ON (P400.CUST_CD = M110.CUST_CD AND M110.CTR_CD = P400.CTR_CD)
  LEFT JOIN M010 ON (P400.EMPL_NO = M010.EMPL_NO AND M010.CTR_CD = P400.CTR_CD)
  ${condition}
  AND I660.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadKTP_OUT = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.ALLTIME === false) {
    condition += ` AND O660.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59'`;
  }
  if (DATA.FACTORY !== "ALL") {
    condition += ` AND O660.FACTORY = '${DATA.FACTORY}' `;
  }
  if (DATA.PROD_TYPE !== "ALL") {
    condition += ` AND M100.PROD_TYPE = '${DATA.PROD_TYPE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
  }
  if (DATA.PROD_REQUEST_NO !== "") {
    condition += ` AND O660.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
  }
  if (DATA.KD_EMPL_NAME !== "") {
    condition += ` AND M010.EMPL_NAME LIKE '%${DATA.KD_EMPL_NAME}%'`;
  }
  if (DATA.CUST_NAME_KD !== "") {
    condition += ` AND M110.CUST_NAME_KD LIKE '%${DATA.CUST_NAME_KD}%'`;
  }
  if (DATA.OUT_TYPE !== "ALL") {
    condition += ` AND O660.OUT_TYPE = '${DATA.OUT_TYPE}'`;
  }
  let setpdQuery = `
  SELECT  O660.OUT_DATE, O660.FACTORY,O660.AUTO_ID,O660.INSPECT_OUTPUT_ID,O660.PACK_ID,M010.EMPL_NAME, O660.PROD_REQUEST_NO,O660.G_CODE,M100.G_NAME, M100.G_NAME_KD, O660.PLAN_ID,O660.CUST_CD,O660.OUT_QTY, M100.PROD_TYPE, M110.CUST_NAME_KD, P400.PO_NO,
  CASE WHEN O660.OUT_TYPE='N' THEN 'NORMAL' WHEN O660.OUT_TYPE='F' THEN 'FREE' WHEN O660.OUT_TYPE='L' THEN 'CHANGE LOT'  WHEN O660.OUT_TYPE='D' THEN 'SCRAP' ELSE 'OTHER' END AS OUT_TYPE ,
  CASE WHEN O660.USE_YN='T' THEN 'PREPARING' WHEN O660.USE_YN='Y' THEN 'PREPAIRED' WHEN O660.USE_YN='P' THEN 'PENDING' ELSE 'COMPLETED' END AS USE_YN
  ,O660.INS_DATE,O660.INS_EMPL,O660.UPD_DATE,O660.UPD_EMPL,O660.STATUS,O660.REMARK,O660.AUTO_ID_IN,O660.OUT_PRT_SEQ, O660.CTR_CD
  FROM O660
  LEFT JOIN M100 ON (M100.G_CODE = O660.G_CODE AND M100.CTR_CD = O660.CTR_CD)
  LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = O660.PROD_REQUEST_NO AND P400.CTR_CD = O660.CTR_CD)
  LEFT JOIN M110 ON (M110.CUST_CD = O660.CUST_CD AND M110.CTR_CD = O660.CTR_CD)
  LEFT JOIN M010 ON (P400.EMPL_NO = M010.EMPL_NO AND M010.CTR_CD = O660.CTR_CD)
  ${condition}
  AND O660.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadStockFull = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE I660.USE_YN <> 'X'  AND (I660.REMARK is null OR  I660.REMARK<> 'Pending Huy ton')";
  if (DATA.ALLTIME === false) {
    condition += ` AND I660.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59'`;
  }
  if (DATA.FACTORY !== "ALL") {
    condition += ` AND I660.FACTORY = '${DATA.FACTORY}' `;
  }
  if (DATA.PROD_TYPE !== "ALL") {
    condition += ` AND M100.PROD_TYPE = '${DATA.PROD_TYPE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
  }
  if (DATA.PROD_REQUEST_NO !== "") {
    condition += ` AND I660.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
  }
  if (DATA.KD_EMPL_NAME !== "") {
    condition += ` AND M010.EMPL_NAME LIKE '%${DATA.KD_EMPL_NAME}%'`;
  }
  if (DATA.CUST_NAME_KD !== "") {
    condition += ` AND M110.CUST_NAME_KD LIKE '%${DATA.CUST_NAME_KD}%'`;
  }
  let setpdQuery = `
  SELECT CAST(I660.INS_DATE as date) AS IN_DATE,I660.FACTORY,I660.AUTO_ID,I660.INSPECT_OUTPUT_ID,I660.PACK_ID,M010.EMPL_NAME, I660.PROD_REQUEST_NO,M110.CUST_NAME_KD, I660.G_CODE, M100.G_NAME, M100.G_NAME_KD, M100.PROD_TYPE, I660.PLAN_ID,I660.IN_QTY,
  CASE WHEN I660.USE_YN= 'T' THEN 'PENDING' WHEN I660.USE_YN= 'Y' THEN 'TONKHO'  ELSE 'DA GIAO' END AS USE_YN
  ,I660.EMPL_GIAO,I660.EMPL_NHAN,I660.INS_DATE,I660.INS_EMPL,I660.UPD_DATE,I660.UPD_EMPL,
  CASE WHEN I660.STATUS ='N' THEN 'OK' ELSE 'BL' END AS STATUS
  ,I660.REMARK, I660.CTR_CD
  FROM I660
  LEFT JOIN M100 ON (M100.G_CODE = I660.G_CODE AND M100.CTR_CD = I660.CTR_CD)
  LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = I660.PROD_REQUEST_NO AND P400.CTR_CD = I660.CTR_CD)
  LEFT JOIN M110 ON (P400.CUST_CD = M110.CUST_CD AND M110.CTR_CD = P400.CTR_CD)
  LEFT JOIN M010 ON (P400.EMPL_NO = M010.EMPL_NO AND M010.CTR_CD = P400.CTR_CD)
  ${condition}
  AND I660.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadSTOCKG_CODE = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.PROD_TYPE !== "ALL") {
    condition += ` AND M100.PROD_TYPE = '${DATA.PROD_TYPE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
  }
  let setpdQuery = `
  SELECT  AA.G_CODE, M100.G_NAME, M100.G_NAME_KD, M100.PROD_TYPE, AA.STOCK, AA.BLOCK_QTY, (AA.STOCK + AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
  (
  SELECT G_CODE, CTR_CD, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK, SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660 WHERE USE_YN ='Y'  AND (I660.REMARK is null OR  I660.REMARK<> 'Pending Huy ton') AND I660.CTR_CD='${DATA.CTR_CD}' GROUP BY G_CODE, CTR_CD
  ) AS AA
  LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE AND M100.CTR_CD = AA.CTR_CD)
  ${condition}
  AND M100.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadSTOCKG_NAME_KD = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  let setpdQuery = `
  SELECT   AA.G_NAME_KD, AA.STOCK, AA.BLOCK_QTY,(AA.STOCK+ AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
  (
  SELECT M100.G_NAME_KD, M100.CTR_CD, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK,SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660  LEFT JOIN M100 ON  (M100.G_CODE = I660.G_CODE AND M100.CTR_CD = I660.CTR_CD) WHERE I660.USE_YN ='Y'  AND (I660.REMARK is null OR  I660.REMARK<> 'Pending Huy ton') AND I660.CTR_CD='${DATA.CTR_CD}' GROUP BY M100.G_NAME_KD, M100.CTR_CD
  ) AS AA
  ${condition}
  AND AA.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadSTOCK_YCSX = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = " WHERE 1=1 ";
  if (DATA.PROD_TYPE !== "ALL") {
    condition += ` AND M100.PROD_TYPE = '${DATA.PROD_TYPE}' `;
  }
  if (DATA.G_NAME !== "") {
    condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  }
  if (DATA.G_CODE !== "") {
    condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
  }
  if (DATA.PROD_REQUEST_NO !== "") {
    condition += ` AND AA.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
  }
  if (DATA.CUST_NAME_KD !== "") {
    condition += ` AND M110.CUST_NAME_KD LIKE '%${DATA.CUST_NAME_KD}%'`;
  }
  let setpdQuery = `
  SELECT M110.CUST_NAME_KD, AA.PROD_REQUEST_NO, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PO_NO, M100.PROD_TYPE, AA.STOCK, AA.BLOCK_QTY, (AA.STOCK + AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
  (
  SELECT I660.PROD_REQUEST_NO, I660.CTR_CD, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK, SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660 WHERE I660.USE_YN ='Y'  AND (I660.REMARK is null OR  I660.REMARK<> 'Pending Huy ton') AND I660.CTR_CD='${DATA.CTR_CD}' GROUP BY I660.PROD_REQUEST_NO, I660.CTR_CD
  ) AS AA
  LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = AA.PROD_REQUEST_NO AND P400.CTR_CD = AA.CTR_CD)
  LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE AND M100.CTR_CD = P400.CTR_CD)
  LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD AND M110.CTR_CD = P400.CTR_CD)
  ${condition}
  AND AA.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updatePheDuyetHuyO660 = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
  UPDATE O660 SET USE_YN = 'X', REMARK = 'XUAT_HUY',OUT_PRT_SEQ='999', OUT_DATE='${moment().format('YYYYMMDD')}', UPD_DATE = '${moment().format('YYYY-MM-DD HH:mm:ss')}', UPD_EMPL='${EMPL_NO}' WHERE CTR_CD='${DATA.CTR_CD}' AND AUTO_ID= ${DATA.AUTO_ID}          
  `;
  console.log(setpdQuery)
  checkkq = await queryDB(setpdQuery);
  setpdQuery = `
  UPDATE I660 SET USE_YN = 'X',  UPD_DATE = '${moment().format('YYYY-MM-DD HH:mm:ss')}', UPD_EMPL='${EMPL_NO}' WHERE CTR_CD='${DATA.CTR_CD}' AND AUTO_ID= ${DATA.AUTO_ID_IN}          
  `;
  console.log(setpdQuery)
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.cancelPheDuyetHuyO660 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
    DELETE FROM O660 WHERE CTR_CD='${DATA.CTR_CD}' AND AUTO_ID= ${DATA.AUTO_ID} AND OUT_TYPE='D' AND UPD_DATE is null
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.common = async (req, res, DATA) => {
};
exports.common = async (req, res, DATA) => {
};