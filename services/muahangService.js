const { queryDB } = require("../config/database");
const moment = require("moment");
exports.get_material_table = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ` WHERE 1=1 `;
  if (DATA.M_NAME !== "") {
    condition += ` AND ZTB_MATERIAL_TB.M_NAME LIKE '%${DATA.M_NAME}%'`;
  }
  if (DATA.NGMATERIAL === true) {
    condition += ` AND  (CUST_CD is null OR SSPRICE is null OR CMSPRICE is null OR SLITTING_PRICE is null OR MASTER_WIDTH is null OR ROLL_LENGTH is null)`;
  }
  let setpdQuery = `WITH RankedMaterials AS (
SELECT
CTR_CD,
M_ID,
DOC_TYPE,
VER,
ROW_NUMBER() OVER (PARTITION BY CTR_CD,M_ID,DOC_TYPE ORDER BY VER DESC) AS rn
FROM
ZTB_DOC_TB WHERE PUR_APP='Y' AND RND_APP='Y' AND DTC_APP='Y' AND CTR_CD='002'
),
TDS_TB AS
(
SELECT CTR_CD,M_ID,DOC_TYPE,VER FROM RankedMaterials WHERE rn = 1 AND DOC_TYPE='TDS'
),
MSDS_TB AS
(
SELECT CTR_CD,M_ID,DOC_TYPE,VER FROM RankedMaterials WHERE rn = 1 AND DOC_TYPE='MSDS'
),
SGS_TB AS
(
SELECT CTR_CD,M_ID,DOC_TYPE,VER FROM RankedMaterials WHERE rn = 1 AND DOC_TYPE='SGS'
)
SELECT ZTB_MATERIAL_TB.M_ID, ZTB_MATERIAL_TB.M_NAME, ZTB_MATERIAL_TB.DESCR, ZTB_MATERIAL_TB.CUST_CD, M110.CUST_NAME_KD,ZTB_MATERIAL_TB.SSPRICE, ZTB_MATERIAL_TB.CMSPRICE, ZTB_MATERIAL_TB.SLITTING_PRICE ,ZTB_MATERIAL_TB.MASTER_WIDTH, ZTB_MATERIAL_TB.ROLL_LENGTH, ZTB_MATERIAL_TB.FSC, ZTB_MATERIAL_TB.FSC_CODE,ZTB_FSC_TB.FSC_NAME, ZTB_MATERIAL_TB.USE_YN,ZTB_MATERIAL_TB.EXP_DATE,
TDS_TB.VER AS TDS_VER,
SGS_TB.VER AS SGS_VER,
MSDS_TB.VER AS MSDS_VER,
ZTB_MATERIAL_TB.INS_DATE, ZTB_MATERIAL_TB.INS_EMPL, ZTB_MATERIAL_TB.UPD_DATE, ZTB_MATERIAL_TB.UPD_EMPL FROM ZTB_MATERIAL_TB LEFT JOIN M110 ON (M110.CUST_CD = ZTB_MATERIAL_TB.CUST_CD AND M110.CTR_CD = ZTB_MATERIAL_TB.CTR_CD) LEFT JOIN ZTB_FSC_TB ON (ZTB_FSC_TB.FSC_CODE = ZTB_MATERIAL_TB.FSC_CODE AND ZTB_FSC_TB.CTR_CD = ZTB_MATERIAL_TB.CTR_CD) LEFT JOIN TDS_TB ON (ZTB_MATERIAL_TB.M_ID = TDS_TB.M_ID AND ZTB_MATERIAL_TB.CTR_CD = TDS_TB.CTR_CD) LEFT JOIN MSDS_TB ON (ZTB_MATERIAL_TB.M_ID = MSDS_TB.M_ID AND ZTB_MATERIAL_TB.CTR_CD = MSDS_TB.CTR_CD) LEFT JOIN SGS_TB ON (ZTB_MATERIAL_TB.M_ID = SGS_TB.M_ID AND ZTB_MATERIAL_TB.CTR_CD = SGS_TB.CTR_CD) ${condition} AND ZTB_MATERIAL_TB.CTR_CD='${DATA.CTR_CD}'`;
  //${moment().format('YYYY-MM-DD')}
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
};
exports.checkMaterialExist = async (req, res, DATA) => {
  let kqua;
  let query = "";
  query = `SELECT * FROM ZTB_MATERIAL_TB WHERE CTR_CD='${DATA.CTR_CD}' AND M_NAME ='${DATA.M_NAME}'`;
  console.log(query);
  kqua = await queryDB(query);
  ////console.log(kqua);
  res.send(kqua);
};
exports.addMaterial = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let kqua;
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = "";
  query = `INSERT INTO ZTB_MATERIAL_TB (CTR_CD, M_NAME, DESCR, CUST_CD, SSPRICE, CMSPRICE, SLITTING_PRICE, MASTER_WIDTH, ROLL_LENGTH, USE_YN, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('${DATA.CTR_CD}', '${DATA.M_NAME.trim()}',N'${DATA.DESCR.trim()}','${DATA.CUST_CD.trim()}','${DATA.SSPRICE}','${DATA.CMSPRICE}','${DATA.SLITTING_PRICE}','${DATA.MASTER_WIDTH}','${DATA.ROLL_LENGTH}', 'Y', GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}')`;
  console.log(query);
  kqua = await queryDB(query);
  ////console.log(kqua);
  res.send(kqua);
};
exports.updateMaterial = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let kqua;
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = "";
  query = `UPDATE ZTB_MATERIAL_TB SET EXP_DATE='${DATA.EXP_DATE}', M_NAME='${DATA.M_NAME.trim()}', CUST_CD ='${DATA.CUST_CD.trim()}',DESCR =N'${DATA.DESCR.trim()}',SSPRICE ='${DATA.SSPRICE}',CMSPRICE ='${DATA.CMSPRICE}',SLITTING_PRICE ='${DATA.SLITTING_PRICE}', MASTER_WIDTH ='${DATA.MASTER_WIDTH}',ROLL_LENGTH ='${DATA.ROLL_LENGTH}',UPD_EMPL ='${EMPL_NO}', UPD_DATE=GETDATE(), USE_YN='${DATA.USE_YN}', FSC='${DATA.FSC}', FSC_CODE='${DATA.FSC_CODE}'  WHERE CTR_CD='${DATA.CTR_CD}' AND M_ID='${DATA.M_ID}' `;
  kqua = await queryDB(query);
  ////console.log(kqua);
  res.send(kqua);
};
exports.updateM090FSC = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let kqua;
  let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
  let query = "";
  query = `UPDATE M090 SET FSC='${DATA.FSC}', FSC_CODE='${DATA.FSC_CODE}', INS_DATE='${moment().format('YYYY-MM-DD HH:mm:ss')}', UPD_EMPL='${EMPL_NO}' WHERE CTR_CD='${DATA.CTR_CD}' AND M_NAME='${DATA.M_NAME}'`;
  console.log(query);
  kqua = await queryDB(query);
  ////console.log(kqua);
  res.send(kqua);
};
exports.updateTDSStatus = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_MATERIAL_TB SET TDS='Y' WHERE CTR_CD='${DATA.CTR_CD}' AND M_ID=${DATA.M_ID}
    `;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.selectVendorList = async (req, res, DATA) => {
  let kqua;
  let query = `SELECT DISTINCT CUST_CD , CUST_NAME_KD  FROM M110 WHERE CTR_CD='${DATA.CTR_CD}' AND CUST_TYPE ='NCC' ORDER BY CUST_NAME_KD ASC`;
  kqua = await queryDB(query);
  ////console.log(kqua);
  res.send(kqua);
};
exports.getFSCList = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
    SELECT * FROM ZTB_FSC_TB WHERE CTR_CD='${DATA.CTR_CD}'
    `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.setMaterial_YN = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  UPDATE P400 SET MATERIAL_YN='${DATA.MATERIAL_YN}' WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadMaterialByPO = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ` WHERE AA.PO_BALANCE <> 0  AND (M100.G_C*M100.G_C_R)<>0`;
  if (DATA.SHORTAGE_ONLY === true)
    condition += ` AND  CAST((AA.PO_BALANCE*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000) AS bigint) > 0`;
  if (DATA.NEWPO === true)
    condition += ` AND AA.DELIVERY_QTY =0`
  let condition2 = ``;
  if (DATA.ALLTIME !== true) {
    condition2 += ` WHERE ZTBPOTable.PO_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE}'`
  }
  let setpdQuery = `
  SELECT M110.CUST_CD, M110.CUST_NAME_KD, M100.G_CODE, M100.G_NAME_KD, ZTB_BOM2.M_CODE, M090.M_NAME, M090.WIDTH_CD, AA.PO_NO, AA.PO_QTY, AA.DELIVERY_QTY, AA.PO_BALANCE, M100.PD,M100.G_C AS CAVITY_COT, M100.G_C_R AS CAVITY_HANG,M100.G_C *M100.G_C_R AS CAVITY, CAST((AA.PO_BALANCE*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000)
  AS bigint) AS NEED_M_QTY  FROM 
  (
  SELECT ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, ZTBPOTable.PO_QTY, ZTBPOTable.CTR_CD, isnull(DELI.DELIVERY_QTY,0) AS DELIVERY_QTY,  (ZTBPOTable.PO_QTY- isnull(DELI.DELIVERY_QTY,0)) AS PO_BALANCE FROM ZTBPOTable  LEFT JOIN
  (SELECT CUST_CD, G_CODE, PO_NO, CTR_CD, SUM(isnull(ZTBDelivery.DELIVERY_QTY,0)) AS DELIVERY_QTY FROM ZTBDelivery GROUP BY CUST_CD, G_CODE, PO_NO, CTR_CD) AS DELI
  ON(ZTBPOTable.CUST_CD = DELI.CUST_CD  AND ZTBPOTable.G_CODE = DELI.G_CODE AND ZTBPOTable.PO_NO = DELI.PO_NO AND ZTBPOTable.CTR_CD = DELI.CTR_CD)
  ${condition2}
  ) AS AA
  LEFT JOIN  ZTB_BOM2 ON (AA.G_CODE = ZTB_BOM2.G_CODE AND AA.CTR_CD = ZTB_BOM2.CTR_CD)
  LEFT JOIN M100 ON (AA.G_CODE = M100.G_CODE AND AA.CTR_CD = M100.CTR_CD)
  LEFT JOIN M110 ON (M110.CUST_CD = AA.CUST_CD AND M110.CTR_CD = AA.CTR_CD)
  LEFT JOIN M090 ON (ZTB_BOM2.M_CODE = M090.M_CODE AND ZTB_BOM2.CTR_CD = M090.CTR_CD)
  ${condition}
  AND AA.CTR_CD='${DATA.CTR_CD}'
  ORDER BY CAST((AA.PO_BALANCE*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000*1.0)
  AS bigint) DESC
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadMaterialByYCSX = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `  WHERE P400.PROD_REQUEST_QTY <> 0  AND (M100.G_C*M100.G_C_R)<>0 AND PL_HANG ='TT' `;
  if (DATA.ALLTIME !== true)
    condition += ` AND P400.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59'`
  let setpdQuery = `
    SELECT  P400.PROD_REQUEST_NO, P400.PROD_REQUEST_DATE, M110.CUST_CD, M110.CUST_NAME_KD, M100.G_CODE, M100.G_NAME_KD, ZTB_BOM2.M_CODE, M090.M_NAME, M090.WIDTH_CD, P400.PROD_REQUEST_QTY, M100.PD, M100.G_C AS CAVITY_COT, M100.G_C_R AS CAVITY_HANG, M100.G_C * M100.G_C_R AS CAVITY, CAST(( P400.PROD_REQUEST_QTY*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000)AS bigint) AS NEED_M_QTY, P400.MATERIAL_YN 
    FROM P400 
    LEFT JOIN  ZTB_BOM2 ON (P400.G_CODE = ZTB_BOM2.G_CODE AND P400.CTR_CD = ZTB_BOM2.CTR_CD)
    LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE AND P400.CTR_CD = M100.CTR_CD)
    LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD AND M110.CTR_CD = P400.CTR_CD)
    LEFT JOIN M090 ON (ZTB_BOM2.M_CODE = M090.M_CODE AND ZTB_BOM2.CTR_CD = M090.CTR_CD)
   ${condition}
    AND P400.CTR_CD='${DATA.CTR_CD}'
    ORDER BY CAST((P400.PROD_REQUEST_QTY*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000*1.0)
    AS bigint) DESC
    `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadMaterialMRPALL = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ` WHERE AA.PO_BALANCE <> 0  AND (M100.G_C*M100.G_C_R)<>0`;
  if (DATA.SHORTAGE_ONLY === true)
    condition += ` AND  CAST((AA.PO_BALANCE*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000) AS bigint) > 0`;
  if (DATA.NEWPO === true)
    condition += ` AND AA.DELIVERY_QTY =0`
  let condition2 = ``
  if (DATA.SHORTAGE_ONLY === true)
    condition2 = ` WHERE ((M090.STOCK_CFM_NM1 + STOCK_CFM_NM2) - CC.NEED_M_QTY) < 0`
  let condition3 = ``;
  if (DATA.ALLTIME !== true) {
    condition3 += ` WHERE ZTBPOTable.PO_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE}'`
  }
  let setpdQuery = `
  SELECT CC.M_CODE, M090.M_NAME, M090.WIDTH_CD, CC.NEED_M_QTY, (isnull(M090.STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0)) AS STOCK_M,(isnull(M090.HOLDING_CFM_NM1,0) + isnull(M090.HOLDING_CFM_NM2,0)) AS HOLDING_M,   ((isnull(M090.STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0)) - CC.NEED_M_QTY) AS M_SHORTAGE FROM 
  (
  SELECT BB.M_CODE, SUM(BB.NEED_M_QTY) AS NEED_M_QTY FROM 
  (
  SELECT  ZTB_BOM2.M_CODE, AA.PO_NO, AA.PO_QTY, AA.DELIVERY_QTY, AA.PO_BALANCE, M100.PD,M100.G_C AS CAVITY_COT, M100.G_C_R AS CAVITY_HANG, CAST((AA.PO_BALANCE*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000)
  AS bigint) AS NEED_M_QTY FROM 
  (
  SELECT ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, ZTBPOTable.PO_QTY, ZTBPOTable.CTR_CD, isnull(DELI.DELIVERY_QTY,0) AS DELIVERY_QTY,  (ZTBPOTable.PO_QTY- isnull(DELI.DELIVERY_QTY,0)) AS PO_BALANCE FROM ZTBPOTable  LEFT JOIN
  (SELECT CUST_CD, G_CODE, PO_NO, CTR_CD, SUM(isnull(ZTBDelivery.DELIVERY_QTY,0)) AS DELIVERY_QTY FROM ZTBDelivery GROUP BY CUST_CD, G_CODE, PO_NO, CTR_CD) AS DELI
  ON(ZTBPOTable.CUST_CD = DELI.CUST_CD  AND ZTBPOTable.G_CODE = DELI.G_CODE AND ZTBPOTable.PO_NO = DELI.PO_NO AND ZTBPOTable.CTR_CD = DELI.CTR_CD)
  ${condition3}
  ) AS AA
  LEFT JOIN  ZTB_BOM2 ON (AA.G_CODE = ZTB_BOM2.G_CODE AND AA.CTR_CD = ZTB_BOM2.CTR_CD)
  LEFT JOIN M100 ON (AA.G_CODE = M100.G_CODE AND AA.CTR_CD = M100.CTR_CD)
  ${condition}
  ) AS BB
  GROUP BY BB.M_CODE
  ) AS CC
  LEFT JOIN M090 ON (M090.M_CODE = CC.M_CODE)
  ${condition2}
  WHERE M090.CTR_CD='${DATA.CTR_CD}'
  ORDER BY ((M090.STOCK_CFM_NM1 + STOCK_CFM_NM2) - CC.NEED_M_QTY) ASC
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadMaterialByYCSX_ALL = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `  WHERE P400.PROD_REQUEST_QTY <> 0  AND (M100.G_C*M100.G_C_R)<>0 AND PL_HANG ='TT' `;
  if (DATA.ALLTIME !== true)
    condition += ` AND P400.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59'`
  let condition2 = ``;
  if (DATA.SHORTAGE_ONLY === true)
    condition2 += `WHERE ((isnull(M090.STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0)) - TTTB.NEED_M_QTY) < 0`;
  let setpdQuery = `
    WITH DETAILTB AS
    (
      SELECT P400.PROD_REQUEST_NO, P400.PROD_REQUEST_DATE, M110.CUST_CD, M110.CUST_NAME_KD, M100.G_CODE, M100.G_NAME_KD, ZTB_BOM2.M_CODE, M090.M_NAME, M090.WIDTH_CD, P400.PROD_REQUEST_QTY, M100.PD,M100.G_C AS CAVITY_COT, M100.G_C_R AS CAVITY_HANG,M100.G_C *M100.G_C_R AS CAVITY, CAST(( P400.PROD_REQUEST_QTY*1.0)*(M100.PD*1.0)/(M100.G_C *M100.G_C_R*1000)AS bigint) AS NEED_M_QTY, P400.CTR_CD
      FROM P400 
      LEFT JOIN  ZTB_BOM2 ON (P400.G_CODE = ZTB_BOM2.G_CODE AND P400.CTR_CD = ZTB_BOM2.CTR_CD)
      LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE AND P400.CTR_CD = M100.CTR_CD)
      LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD AND M110.CTR_CD = P400.CTR_CD)
      LEFT JOIN M090 ON (ZTB_BOM2.M_CODE = M090.M_CODE AND ZTB_BOM2.CTR_CD = M090.CTR_CD)
      ${condition}
      AND P400.CTR_CD='${DATA.CTR_CD}'
    ),
    TTTB AS
    (
    SELECT DETAILTB.M_CODE, DETAILTB.M_NAME, DETAILTB.WIDTH_CD, SUM(NEED_M_QTY) AS NEED_M_QTY, DETAILTB.CTR_CD
    FROM DETAILTB GROUP BY DETAILTB.M_CODE, DETAILTB.M_NAME, DETAILTB.WIDTH_CD, DETAILTB.CTR_CD
    )
    SELECT TTTB.M_CODE, TTTB.M_NAME, TTTB.WIDTH_CD, TTTB.NEED_M_QTY, (isnull(M090.STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0)) AS STOCK_M, (isnull(M090.HOLDING_CFM_NM1,0) + isnull(M090.HOLDING_CFM_NM2,0)) AS HOLDING_M, ((isnull(M090.STOCK_CFM_NM1,0) + isnull(STOCK_CFM_NM2,0)) - TTTB.NEED_M_QTY) AS M_SHORTAGE FROM 
    TTTB LEFT JOIN M090 ON (M090.M_CODE = TTTB.M_CODE AND M090.CTR_CD = TTTB.CTR_CD)            
    ${condition2}
    AND TTTB.CTR_CD='${DATA.CTR_CD}'
    ORDER BY TTTB.M_CODE ASC
    `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.autoUpdateDocUSEYN_EXP = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  MERGE INTO ZTB_DOC_TB
  USING
  (
  SELECT * FROM ZTB_DOC_TB WHERE EXP_DATE <= GETDATE() AND EXP_YN='Y' AND CTR_CD='${DATA.CTR_CD}'
  ) AS SRC_TB
  ON (SRC_TB.CTR_CD = ZTB_DOC_TB.CTR_CD AND SRC_TB.DOC_ID = ZTB_DOC_TB.DOC_ID)
  WHEN MATCHED THEN
  UPDATE 
  SET USE_YN='N';
  `;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.getMaterialDocData = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ` WHERE CTR_CD='${DATA.CTR_CD}' AND USE_YN='Y'`
  if (DATA.DOC_TYPE !== 'ALL') condition += ` AND DOC_TYPE='${DATA.DOC_TYPE}' `
  if (DATA.M_NAME !== '') condition += ` AND M_NAME LIKE '%${DATA.M_NAME}%'`
  let setpdQuery = `SELECT * FROM ZTB_DOC_TB ${condition}`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.insertMaterialDocData = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO ZTB_DOC_TB (CTR_CD,DOC_TYPE,M_ID,M_NAME,VER,FILE_NAME,FILE_UPLOADED,INS_DATE, INS_EMPL) VALUES ('${DATA.CTR_CD}','${DATA.DOC_TYPE}',${DATA.M_ID},'${DATA.M_NAME}',${DATA.VER},N'${DATA.FILE_NAME}', 'Y',GETDATE(),'${EMPL_NO}')`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateDtcApp = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZTB_DOC_TB SET DTC_APP='${DATA.DTC_APP}', DTC_EMPL='${EMPL_NO}', DTC_APP_DATE=GETDATE() WHERE DOC_ID=${DATA.DOC_ID} AND CTR_CD='${DATA.CTR_CD}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateMaterialDocData = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZTB_DOC_TB SET USE_YN='${DATA.USE_YN}', REG_DATE='${DATA.REG_DATE}', EXP_DATE='${DATA.EXP_DATE}', EXP_YN='${DATA.EXP_YN}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE DOC_ID=${DATA.DOC_ID} AND CTR_CD='${DATA.CTR_CD}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updatePurApp = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZTB_DOC_TB SET PUR_APP='${DATA.PUR_APP}', PUR_EMPL='${EMPL_NO}', PUR_APP_DATE=GETDATE() WHERE DOC_ID=${DATA.DOC_ID} AND CTR_CD='${DATA.CTR_CD}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateRndApp = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZTB_DOC_TB SET RND_APP='${DATA.RND_APP}', RND_EMPL='${EMPL_NO}', RND_APP_DATE=GETDATE() WHERE DOC_ID=${DATA.DOC_ID} AND CTR_CD='${DATA.CTR_CD}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadMRPPlan = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
WITH BOM2TB AS
(SELECT DISTINCT CTR_CD, G_CODE, M_CODE FROM ZTB_BOM2),
TINHLIEUTB AS
(
SELECT BOM2TB.CTR_CD, BOM2TB.M_CODE, 
INIT_WH_STOCK*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS M_INIT_WH_STOCK,
INIT_INSP_STOCK*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS M_INIT_INSP_STOCK,
INIT_BTP_STOCK*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS M_INIT_BTP_STOCK,
M100.BTP_QTY*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS M_BTP_QTY,
M100.TONKIEM_QTY*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS M_TONKIEM_QTY,
M100.STOCK_QTY*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS M_STOCK_QTY,
D1*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD1,
D2*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD2,
D3*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD3,
D4*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD4,
D5*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD5,
D6*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD6,
D7*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD7,
D8*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD8,
D9*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD9,
D10*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD10,
D11*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD11,
D12*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD12,
D13*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD13,
D14*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD14,
D15*M100.PD/(M100.G_C* M100.G_C_R)*1.0/1000 AS MD15
FROM ZTB_G_CODE_PLAN_TB 
LEFT JOIN BOM2TB ON BOM2TB.CTR_CD = ZTB_G_CODE_PLAN_TB.CTR_CD AND BOM2TB.G_CODE = ZTB_G_CODE_PLAN_TB.G_CODE
LEFT JOIN M100 ON BOM2TB.CTR_CD = M100.CTR_CD AND BOM2TB.G_CODE = M100.G_CODE
WHERE PLAN_DATE='${DATA.PLAN_DATE}' 
),
AGGLIEUTB AS
(
SELECT CTR_CD, M_CODE, SUM(M_INIT_WH_STOCK) AS M_INIT_WH_STOCK, SUM(M_INIT_INSP_STOCK) AS M_INIT_INSP_STOCK, SUM(M_INIT_BTP_STOCK) AS M_INIT_BTP_STOCK, 
MIN(M_BTP_QTY) AS M_BTP_QTY, MIN(M_TONKIEM_QTY) AS M_TONKIEM_QTY, MIN(M_STOCK_QTY) AS M_STOCK_QTY,
SUM(MD1) AS MD1, 
SUM(MD2) AS MD2,
SUM(MD3) AS MD3,
SUM(MD4) AS MD4,
SUM(MD5) AS MD5,
SUM(MD6) AS MD6,
SUM(MD7) AS MD7,
SUM(MD8) AS MD8,
SUM(MD9) AS MD9,
SUM(MD10) AS MD10,
SUM(MD11) AS MD11,
SUM(MD12) AS MD12,
SUM(MD13) AS MD13,
SUM(MD14) AS MD14,
SUM(MD15) AS MD15
FROM TINHLIEUTB GROUP BY CTR_CD, M_CODE
)
SELECT M110.CUST_NAME_KD,M090.M_NAME, M090.WIDTH_CD, AGGLIEUTB.*, (M090.STOCK_CFM_NM1 + M090.STOCK_CFM_NM2) AS RAW_M_STOCK, (M090.STOCK_CFM_NM1 + M090.STOCK_CFM_NM2 + AGGLIEUTB.M_INIT_BTP_STOCK + AGGLIEUTB.M_INIT_INSP_STOCK + AGGLIEUTB.M_INIT_WH_STOCK) TOTAL_STOCK, AGGLIEUTB.M_BTP_QTY, AGGLIEUTB.M_TONKIEM_QTY, AGGLIEUTB.M_STOCK_QTY FROM AGGLIEUTB 
LEFT JOIN M090 ON M090.CTR_CD = AGGLIEUTB.CTR_CD AND M090.M_CODE = AGGLIEUTB.M_CODE
LEFT JOIN ZTB_MATERIAL_TB ON M090.CTR_CD = ZTB_MATERIAL_TB.CTR_CD AND M090.M_NAME = ZTB_MATERIAL_TB.M_NAME
LEFT JOIN M110 ON ZTB_MATERIAL_TB.CTR_CD = M110.CTR_CD AND ZTB_MATERIAL_TB.CUST_CD = M110.CUST_CD
WHERE ZTB_MATERIAL_TB.USE_YN='Y' AND AGGLIEUTB.CTR_CD='${DATA.CTR_CD}' AND M090.CODE_12='A'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.checkDocVersion = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT MAX(VER) AS VER FROM ZTB_DOC_TB WHERE M_ID=${DATA.M_ID} AND DOC_TYPE='${DATA.DOC_TYPE}' AND CTR_CD='${DATA.CTR_CD}' `;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.workdaycheck = async (req, res, DATA) => {
};
exports.workdaycheck = async (req, res, DATA) => {
};
exports.workdaycheck = async (req, res, DATA) => {
};
exports.workdaycheck = async (req, res, DATA) => {
};
exports.workdaycheck = async (req, res, DATA) => {
};
exports.workdaycheck = async (req, res, DATA) => {
};