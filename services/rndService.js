const { queryDB } = require("../config/database");
const moment = require("moment");
exports.updateAmazonBOMCodeInfo = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE BOM_AMAZONE SET  AMZ_PROD_NAME='${DATA.AMZ_PROD_NAME}', AMZ_COUNTRY='${DATA.AMZ_COUNTRY}' WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.listAmazon = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT DISTINCT BOM_AMAZONE.G_CODE, M100.G_NAME, M100.G_NAME_KD FROM BOM_AMAZONE JOIN M100 ON (M100.G_CODE = BOM_AMAZONE.G_CODE AND M100.CTR_CD = BOM_AMAZONE.CTR_CD) WHERE BOM_AMAZONE.CTR_CD='${DATA.CTR_CD}' AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.getBOMAMAZON = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT BOM_AMAZONE.AMZ_PROD_NAME, BOM_AMAZONE.AMZ_COUNTRY, BOM_AMAZONE.G_CODE, M100.G_NAME, DESIGN_AMAZONE.G_CODE_MAU,  M100_B.G_NAME AS TEN_MAU,BOM_AMAZONE.DOITUONG_NO, DESIGN_AMAZONE.DOITUONG_NAME, BOM_AMAZONE.GIATRI, BOM_AMAZONE.REMARK FROM BOM_AMAZONE LEFT JOIN DESIGN_AMAZONE ON (BOM_AMAZONE.G_CODE_MAU= DESIGN_AMAZONE.G_CODE_MAU AND BOM_AMAZONE.DOITUONG_NO= DESIGN_AMAZONE.DOITUONG_NO AND BOM_AMAZONE.CTR_CD = DESIGN_AMAZONE.CTR_CD) LEFT JOIN M100 ON (M100.G_CODE = BOM_AMAZONE.G_CODE AND M100.CTR_CD = BOM_AMAZONE.CTR_CD)  LEFT JOIN  (SELECT * FROM M100) AS M100_B ON (M100_B.G_CODE = DESIGN_AMAZONE.G_CODE_MAU AND M100_B.CTR_CD = DESIGN_AMAZONE.CTR_CD) WHERE BOM_AMAZONE.CTR_CD='${DATA.CTR_CD}' AND BOM_AMAZONE.G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.getBOMAMAZON_EMPTY = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT DESIGN_AMAZONE.G_CODE_MAU, M100.G_NAME AS TEN_MAU, DOITUONG_NO, DOITUONG_NAME FROM DESIGN_AMAZONE JOIN M100 ON (M100.G_CODE = DESIGN_AMAZONE.G_CODE_MAU AND M100.CTR_CD = DESIGN_AMAZONE.CTR_CD) WHERE DESIGN_AMAZONE.CTR_CD='${DATA.CTR_CD}' AND G_CODE_MAU ='${DATA.G_CODE_MAU}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.codeinfo = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE 1=1 `
  if (DATA.G_NAME !== '') {
    condition += ` AND  (M100.G_NAME LIKE '%${DATA.G_NAME}%' OR M100.G_CODE ='${DATA.G_NAME}' OR M100.G_NAME_KD LIKE '%${DATA.G_NAME}%') `
  }
  if (DATA.CNDB === false) {
    condition += ` AND G_CODE_CNDB is null`;
  }
  if (DATA.ACTIVE_ONLY === true) {
    condition += ` AND M100.USE_YN='Y' `
  }
  let setpdQuery = `SELECT isnull(M100.BEP,0) AS BEP, CASE WHEN M100.CODE_33='01' THEN 'EA' WHEN M100.CODE_33='02' THEN 'ROLL' WHEN M100.CODE_33='03' THEN 'SHEET' WHEN M100.CODE_33='04' THEN 'MET' WHEN M100.CODE_33='06' THEN 'PACK (BAG)' WHEN M100.CODE_33='99' THEN 'X' END AS PACKING_TYPE, M100.INSPECT_SPEED, M100.G_CODE, G_NAME, G_NAME_KD,M100.DESCR, PROD_TYPE, PROD_LAST_PRICE, PD, (G_C* G_C_R) AS CAVITY, ROLE_EA_QTY AS PACKING_QTY,  G_WIDTH, G_LENGTH, PROD_PROJECT,PROD_MODEL, CCC.M_NAME_FULLBOM, BANVE, NO_INSPECTION, USE_YN, PDBV, PROD_DIECUT_STEP, PROD_PRINT_TIMES,FACTORY, EQ1, EQ2,  EQ3, EQ4, Setting1, Setting2, Setting3, Setting4, UPH1, UPH2, UPH3, UPH4, Step1, Step2, Step3, Step4, LOSS_SX1, LOSS_SX2, LOSS_SX3, LOSS_SX4,  LOSS_SETTING1 , LOSS_SETTING2 ,  LOSS_SETTING3 , LOSS_SETTING4 , LOSS_ST_SX1, LOSS_ST_SX2, LOSS_ST_SX3, LOSS_ST_SX4, NOTE, EXP_DATE, QL_HSD, APPSHEET, LOSS_KT FROM M100 LEFT JOIN (SELECT BBB.CTR_CD, BBB.G_CODE, string_agg(BBB.M_NAME, ', ') AS M_NAME_FULLBOM FROM (SELECT DISTINCT AAA.CTR_CD, AAA.G_CODE, M090.M_NAME FROM ( (SELECT DISTINCT G_CODE, M_CODE, CTR_CD FROM M140) AS AAA LEFT JOIN M090 ON (AAA.M_CODE = M090.M_CODE AND AAA.CTR_CD = M090.CTR_CD) ) ) AS BBB GROUP BY BBB.CTR_CD ,BBB.G_CODE) AS CCC ON (CCC.G_CODE = M100.G_CODE AND CCC.CTR_CD = M100.CTR_CD) ${condition} AND M100.CTR_CD='${DATA.CTR_CD}' ORDER BY G_CODE ASC`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadcodephoi = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT DISTINCT DESIGN_AMAZONE.G_CODE_MAU, M100.G_NAME FROM DESIGN_AMAZONE JOIN M100 ON (M100.G_CODE = DESIGN_AMAZONE.G_CODE_MAU) WHERE DESIGN_AMAZONE.CTR_CD='${DATA.CTR_CD}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.checkExistBOMAMAZON = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT * FROM BOM_AMAZONE WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.insertAmazonBOM = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO BOM_AMAZONE (CTR_CD, G_CODE, G_CODE_MAU, DOITUONG_NO, GIATRI, REMARK, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL,  AMZ_COUNTRY) VALUES ('${DATA.CTR_CD}','${DATA.G_CODE}', '${DATA.G_CODE_MAU}','${DATA.DOITUONG_NO}','${DATA.GIATRI}','${DATA.REMARK}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}','${DATA.AMZ_COUNTRY}')`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateAmazonBOM = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE BOM_AMAZONE SET GIATRI='${DATA.GIATRI}', REMARK = '${DATA.REMARK}',  AMZ_COUNTRY='${DATA.AMZ_COUNTRY}' WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}' AND G_CODE_MAU='${DATA.G_CODE_MAU}' AND DOITUONG_NO=${DATA.DOITUONG_NO}`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.checkGNAMEKDExist = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT TOP 1 * FROM M100 WHERE CTR_CD='${DATA.CTR_CD}' AND  G_NAME_KD='${DATA.G_NAME_KD}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.update_appsheet_value = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE M100 SET APPSHEET='${DATA.appsheetvalue}' WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE= '${DATA.G_CODE}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.getMasterMaterialList = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT DISTINCT M_NAME, EXP_DATE FROM ZTB_MATERIAL_TB WHERE CTR_CD='${DATA.CTR_CD}' AND USE_YN='Y'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.resetbanve = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = ` UPDATE M100 SET BANVE= 'N', PDBV='${DATA.VALUE}', INS_DATE='${moment().format('YYYY-MM-DD HH:mm:ss')}', INS_EMPL='${EMPL_NO}' WHERE CTR_CD='${DATA.CTR_CD}'  AND G_CODE='${DATA.G_CODE}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
}
exports.pdbanve = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let JOB_NAME = req.payload_data["JOB_NAME"];
  let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
  if (
    (JOB_NAME === "Sub Leader" || JOB_NAME === "Leader") &&
    (SUBDEPTNAME == "PQC1" || SUBDEPTNAME == "PQC3")
  ) {
    //////console.log(DATA);
    let checkkq = "OK";
    let setpdQuery = ` UPDATE M100 SET PDBV= 'Y', PDBV_EMPL='${EMPL_NO}', PDBV_DATE=GETDATE() WHERE CTR_CD='${DATA.CTR_CD}'  AND G_CODE='${DATA.G_CODE}'`;
    ////console.log(setpdQuery);
    checkkq = await queryDB(setpdQuery);
    ////console.log(checkkq);
    res.send(checkkq);
  } else {
    res.send({
      tk_status: "NG",
      message: "Không đủ quyền hạn, cần PQC phê duyệt",
    });
  }
}
exports.getbomsx = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT isnull(M140.LIEUQL_SX,0) AS LIEUQL_SX, M140.MAIN_M,M140.G_CODE, M100.G_NAME, M100.G_NAME_KD, M140.RIV_NO, M140.M_CODE, M090.M_NAME, M090.WIDTH_CD, M140.M_QTY, M140.INS_EMPL, M140.INS_DATE, M140.UPD_EMPL,M140.UPD_DATE, (M090.STOCK_CFM_NM1+M090.STOCK_CFM_NM2) AS M_STOCK FROM M140 JOIN M100 ON (M140.G_CODE = M100.G_CODE AND M140.CTR_CD = M100.CTR_CD) JOIN M090 ON (M090.M_CODE = M140.M_CODE AND M090.CTR_CD = M140.CTR_CD) WHERE M140.G_CODE='${DATA.G_CODE}' AND M140.RIV_NO='A' AND M140.CTR_CD='${DATA.CTR_CD}' ORDER BY (M090.STOCK_CFM_NM1+M090.STOCK_CFM_NM2) DESC`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.getbomgia = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `  SELECT ZTB_BOM2.BOM_ID,ZTB_BOM2.G_CODE,ZTB_BOM2.RIV_NO,ZTB_BOM2.G_SEQ,ZTB_BOM2.CATEGORY,ZTB_BOM2.M_CODE, M140.M_CODE AS M_CODE_SX,ZTB_BOM2.CUST_CD,ZTB_BOM2.IMPORT_CAT,ZTB_BOM2.M_CMS_PRICE,ZTB_BOM2.M_SS_PRICE,ZTB_BOM2.M_SLITTING_PRICE,ZTB_BOM2.USAGE,ZTB_BOM2.MAT_MASTER_WIDTH,ZTB_BOM2.MAT_ROLL_LENGTH,ZTB_BOM2.MAT_THICKNESS,ZTB_BOM2.M_QTY,ZTB_BOM2.REMARK,ZTB_BOM2.PROCESS_ORDER,ZTB_BOM2.INS_EMPL,ZTB_BOM2.UPD_EMPL,ZTB_BOM2.INS_DATE,ZTB_BOM2.UPD_DATE,ZTB_BOM2.MAIN_M, M090.M_NAME, M090.WIDTH_CD AS MAT_CUTWIDTH FROM ZTB_BOM2 LEFT JOIN M090 ON M090.M_CODE = ZTB_BOM2.M_CODE AND M090.CTR_CD = ZTB_BOM2.CTR_CD LEFT JOIN M140 ON ZTB_BOM2.G_CODE = M140.G_CODE AND ZTB_BOM2.M_CODE = M140.M_CODE AND ZTB_BOM2.CTR_CD = M140.CTR_CD WHERE ZTB_BOM2.RIV_NO='A' AND ZTB_BOM2.G_CODE='${DATA.G_CODE}' AND ZTB_BOM2.CTR_CD='${DATA.CTR_CD}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.codeinforRnD = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE M100.CTR_CD='${DATA.CTR_CD}' `
  if (DATA.G_NAME !== '') {
    condition += ` AND  (M100.G_NAME LIKE '%${DATA.G_NAME}%' OR M100.G_CODE ='${DATA.G_NAME}' OR M100.G_NAME_KD LIKE '%${DATA.G_NAME}%') `
  }
  if (DATA.CNDB === false) {
    condition += ` AND G_CODE_CNDB is null`;
  }
  if (DATA.ACTIVE_ONLY === true) {
    condition += ` AND M100.USE_YN='Y' `
  }
  let setpdQuery = `SELECT isnull(M100.BEP,0) AS BEP, M100.G_CODE, G_NAME, G_NAME_KD, PROD_TYPE, PROD_LAST_PRICE, PD, (G_C* G_C_R) AS CAVITY, ROLE_EA_QTY AS PACKING_QTY,  G_WIDTH, G_LENGTH, PROD_PROJECT,PROD_MODEL, BANVE, NO_INSPECTION, USE_YN, PDBV, PROD_DIECUT_STEP, PROD_PRINT_TIMES,FACTORY, EQ1, EQ2,  EQ3, EQ4, Setting1, Setting2, Setting3, Setting4, UPH1, UPH2, UPH3, UPH4, Step1, Step2, Step3, Step4, LOSS_SX1, LOSS_SX2, LOSS_SX3, LOSS_SX4,  LOSS_SETTING1 , LOSS_SETTING2 ,  LOSS_SETTING3 , LOSS_SETTING4 , LOSS_ST_SX1, LOSS_ST_SX2, LOSS_ST_SX3, LOSS_ST_SX4, NOTE, EXP_DATE, QL_HSD, APPSHEET, APPROVED_YN FROM M100  ${condition} ORDER BY G_CODE ASC`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.getcodefullinfo = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT PDBV, UPDATE_REASON, FSC_CODE, FSC, PO_TYPE, G_CODE, M100.CUST_CD, M110.CUST_NAME, M110.CUST_NAME_KD, PROD_PROJECT, PROD_MODEL, CODE_12, PROD_TYPE, G_NAME_KD, DESCR, PROD_MAIN_MATERIAL, G_NAME, G_LENGTH, G_WIDTH, PD, G_LG, G_CG, G_C, G_C_R, G_SG_L, G_SG_R, PACK_DRT, KNIFE_TYPE, KNIFE_LIFECYCLE, KNIFE_PRICE, CODE_33, ROLE_EA_QTY,RPM, PIN_DISTANCE, PROCESS_TYPE, EQ1, EQ2, EQ3, EQ4, PROD_DIECUT_STEP, PROD_PRINT_TIMES, M100.REMK, M100.USE_YN, FACTORY,  Setting1, Setting2,Setting3,Setting4, UPH1, UPH2, UPH3, UPH4, Step1, Step2,Step3,Step4, LOSS_SX1, LOSS_SX2, LOSS_SX3, LOSS_SX4, LOSS_SETTING1 , LOSS_SETTING2 ,LOSS_SETTING3 ,LOSS_SETTING4 ,NOTE, PROD_DVT, QL_HSD, EXP_DATE, PD_HSD, UPD_COUNT, M100.UPD_DATE, M100.UPD_EMPL, APPROVED_YN  FROM M100 LEFT JOIN M110 ON (M110.CUST_CD = M100.CUST_CD AND M110.CTR_CD = M100.CTR_CD)
  WHERE M100.CTR_CD='${DATA.CTR_CD}' AND  M100.G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.getNextSEQ_G_CODE = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT MAX(SEQ_NO) AS LAST_SEQ_NO FROM M100 WHERE CTR_CD='${DATA.CTR_CD}' AND CODE_12 = '${DATA.CODE_12}' AND CODE_27='${DATA.CODE_27}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.insertM100BangTinhGia = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO ZTB_QUOTATION_CALC_TB (CTR_CD,G_CODE,WIDTH_OFFSET,LENGTH_OFFSET,KNIFE_UNIT,FILM_UNIT,INK_UNIT,LABOR_UNIT,DELIVERY_UNIT,DEPRECATION_UNIT,GMANAGEMENT_UNIT,M_LOSS_UNIT,G_WIDTH,G_LENGTH,G_C,G_C_R,G_LG,G_CG,G_SG_L,G_SG_R,PROD_PRINT_TIMES) VALUES ('${DATA.CTR_CD}','${DATA.G_CODE}','${DATA.DEFAULT_DM.WIDTH_OFFSET}','${DATA.DEFAULT_DM.LENGTH_OFFSET}','${DATA.DEFAULT_DM.KNIFE_UNIT}','${DATA.DEFAULT_DM.FILM_UNIT}','${DATA.DEFAULT_DM.INK_UNIT}','${DATA.DEFAULT_DM.LABOR_UNIT}','${DATA.DEFAULT_DM.DELIVERY_UNIT}','${DATA.DEFAULT_DM.DEPRECATION_UNIT}','${DATA.DEFAULT_DM.GMANAGEMENT_UNIT}','${DATA.DEFAULT_DM.M_LOSS_UNIT}','${DATA.CODE_FULL_INFO.G_WIDTH}','${DATA.CODE_FULL_INFO.G_LENGTH}','${DATA.CODE_FULL_INFO.G_C}','${DATA.CODE_FULL_INFO.G_C_R}','${DATA.CODE_FULL_INFO.G_LG}','${DATA.CODE_FULL_INFO.G_CG}','${DATA.CODE_FULL_INFO.G_SG_L}','${DATA.CODE_FULL_INFO.G_SG_R}','${DATA.CODE_FULL_INFO.PROD_PRINT_TIMES}')`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateM100BangTinhGia = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZTB_QUOTATION_CALC_TB SET G_LENGTH='${DATA.G_LENGTH}',G_WIDTH='${DATA.G_WIDTH}',G_C='${DATA.G_C}',G_C_R='${DATA.G_C_R}',G_SG_L='${DATA.G_SG_L}',G_SG_R='${DATA.G_SG_R}',PROD_PRINT_TIMES='${DATA.PROD_PRINT_TIMES}', G_CG='${DATA.G_CG}',G_LG='${DATA.G_LG}'  WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE = '${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.insertM100 = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  //console.log(DATA.CODE_FULL_INFO)
  let setpdQuery = `INSERT INTO M100 (CTR_CD,CUST_CD,PROD_PROJECT,PROD_MODEL,CODE_12,PROD_TYPE,G_NAME_KD,DESCR,PROD_MAIN_MATERIAL,G_NAME,G_LENGTH,G_WIDTH,PD,G_C,G_C_R,G_SG_L,G_SG_R,PACK_DRT,KNIFE_TYPE,KNIFE_LIFECYCLE,KNIFE_PRICE,CODE_33,ROLE_EA_QTY,RPM,PIN_DISTANCE,PROCESS_TYPE,EQ1,EQ2, EQ3, EQ4,PROD_DIECUT_STEP,PROD_PRINT_TIMES,REMK,USE_YN,G_CODE,G_CG,G_LG, SEQ_NO, CODE_27, REV_NO, INS_EMPL, UPD_EMPL, INS_DATE, UPD_DATE, PO_TYPE, FSC, PROD_DVT,  QL_HSD, EXP_DATE, FSC_CODE, APPROVED_YN) VALUES ('${DATA.CTR_CD}','${DATA.CODE_FULL_INFO.CUST_CD}','${DATA.CODE_FULL_INFO.PROD_PROJECT}','${DATA.CODE_FULL_INFO.PROD_MODEL}','${DATA.CODE_FULL_INFO.CODE_12}','${DATA.CODE_FULL_INFO.PROD_TYPE}','${DATA.CODE_FULL_INFO.G_NAME_KD}',N'${DATA.CODE_FULL_INFO.DESCR}','${DATA.CODE_FULL_INFO.PROD_MAIN_MATERIAL}','${DATA.CODE_FULL_INFO.G_NAME}','${DATA.CODE_FULL_INFO.G_LENGTH}','${DATA.CODE_FULL_INFO.G_WIDTH}','${DATA.CODE_FULL_INFO.PD}','${DATA.CODE_FULL_INFO.G_C}','${DATA.CODE_FULL_INFO.G_C_R}','${DATA.CODE_FULL_INFO.G_SG_L}','${DATA.CODE_FULL_INFO.G_SG_R}','${DATA.CODE_FULL_INFO.PACK_DRT}','${DATA.CODE_FULL_INFO.KNIFE_TYPE}','${DATA.CODE_FULL_INFO.KNIFE_LIFECYCLE}','${DATA.CODE_FULL_INFO.KNIFE_PRICE}','${DATA.CODE_FULL_INFO.CODE_33}','${DATA.CODE_FULL_INFO.ROLE_EA_QTY}','${DATA.CODE_FULL_INFO.RPM}','${DATA.CODE_FULL_INFO.PIN_DISTANCE}','${DATA.CODE_FULL_INFO.PROCESS_TYPE}','${DATA.CODE_FULL_INFO.EQ1}','${DATA.CODE_FULL_INFO.EQ2}','${DATA.CODE_FULL_INFO.EQ3}','${DATA.CODE_FULL_INFO.EQ4}','${DATA.CODE_FULL_INFO.PROD_DIECUT_STEP}','${DATA.CODE_FULL_INFO.PROD_PRINT_TIMES}','${DATA.CODE_FULL_INFO.REMK}','${DATA.CODE_FULL_INFO.USE_YN}','${DATA.G_CODE}','${DATA.CODE_FULL_INFO.G_CG}','${DATA.CODE_FULL_INFO.G_LG}','${DATA.NEXT_SEQ_NO}','${DATA.CODE_27}','A','${EMPL_NO}','${EMPL_NO}',GETDATE(), GETDATE(), '${DATA.CODE_FULL_INFO.PO_TYPE}','${DATA.CODE_FULL_INFO.FSC}','${DATA.CODE_FULL_INFO.PROD_DVT}','${DATA.CODE_FULL_INFO.QL_HSD}','${DATA.CODE_FULL_INFO.EXP_DATE}','${DATA.CODE_FULL_INFO.FSC_CODE ?? '01'}','${DATA.CODE_FULL_INFO.APPROVED_YN === undefined? 'Y' : DATA.CODE_FULL_INFO.APPROVED_YN}')`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.insertM100_AddVer = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO M100 (CTR_CD,CUST_CD,PROD_PROJECT,PROD_MODEL,CODE_12,PROD_TYPE,G_NAME_KD,DESCR,PROD_MAIN_MATERIAL,G_NAME,G_LENGTH,G_WIDTH,PD,G_C,G_C_R,G_SG_L,G_SG_R,PACK_DRT,KNIFE_TYPE,KNIFE_LIFECYCLE,KNIFE_PRICE,CODE_33,ROLE_EA_QTY,RPM,PIN_DISTANCE,PROCESS_TYPE,EQ1,EQ2,EQ3, EQ4,PROD_DIECUT_STEP,PROD_PRINT_TIMES,REMK,USE_YN,G_CODE,G_CG,G_LG, SEQ_NO, CODE_27, REV_NO, INS_EMPL, UPD_EMPL, INS_DATE, UPD_DATE, PO_TYPE, FSC, PROD_DVT,QL_HSD, EXP_DATE, FSC_CODE,APPROVED_YN) VALUES ('${DATA.CTR_CD}','${DATA.CODE_FULL_INFO.CUST_CD}','${DATA.CODE_FULL_INFO.PROD_PROJECT}','${DATA.CODE_FULL_INFO.PROD_MODEL}','${DATA.CODE_FULL_INFO.CODE_12}','${DATA.CODE_FULL_INFO.PROD_TYPE}','${DATA.CODE_FULL_INFO.G_NAME_KD}','${DATA.CODE_FULL_INFO.DESCR}','${DATA.CODE_FULL_INFO.PROD_MAIN_MATERIAL}','${DATA.CODE_FULL_INFO.G_NAME}','${DATA.CODE_FULL_INFO.G_LENGTH}','${DATA.CODE_FULL_INFO.G_WIDTH}','${DATA.CODE_FULL_INFO.PD}','${DATA.CODE_FULL_INFO.G_C}','${DATA.CODE_FULL_INFO.G_C_R}','${DATA.CODE_FULL_INFO.G_SG_L}','${DATA.CODE_FULL_INFO.G_SG_R}','${DATA.CODE_FULL_INFO.PACK_DRT}','${DATA.CODE_FULL_INFO.KNIFE_TYPE}','${DATA.CODE_FULL_INFO.KNIFE_LIFECYCLE}','${DATA.CODE_FULL_INFO.KNIFE_PRICE}','${DATA.CODE_FULL_INFO.CODE_33}','${DATA.CODE_FULL_INFO.ROLE_EA_QTY}','${DATA.CODE_FULL_INFO.RPM}','${DATA.CODE_FULL_INFO.PIN_DISTANCE}','${DATA.CODE_FULL_INFO.PROCESS_TYPE}','${DATA.CODE_FULL_INFO.EQ1}','${DATA.CODE_FULL_INFO.EQ2}','${DATA.CODE_FULL_INFO.EQ3}','${DATA.CODE_FULL_INFO.EQ4}','${DATA.CODE_FULL_INFO.PROD_DIECUT_STEP}','${DATA.CODE_FULL_INFO.PROD_PRINT_TIMES}','${DATA.CODE_FULL_INFO.REMK}','${DATA.CODE_FULL_INFO.USE_YN}','${DATA.G_CODE}','${DATA.CODE_FULL_INFO.G_CG}','${DATA.CODE_FULL_INFO.G_LG}','${DATA.NEXT_SEQ_NO}','${DATA.CODE_27}','${DATA.REV_NO}','${EMPL_NO}','${EMPL_NO}',GETDATE(), GETDATE(), '${DATA.CODE_FULL_INFO.PO_TYPE}', '${DATA.CODE_FULL_INFO.FSC}','${DATA.CODE_FULL_INFO.PROD_DVT}','${DATA.CODE_FULL_INFO.QL_HSD}','${DATA.CODE_FULL_INFO.EXP_DATE}','${DATA.CODE_FULL_INFO.FSC_CODE}' , '${DATA.CODE_FULL_INFO.APPROVED_YN === undefined? 'Y' : DATA.CODE_FULL_INFO.APPROVED_YN}')`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateM100 = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `UPDATE M100 SET FSC='${DATA.FSC}', PO_TYPE='${DATA.PO_TYPE}', CUST_CD='${DATA.CUST_CD}',PROD_PROJECT='${DATA.PROD_PROJECT}',PROD_MODEL='${DATA.PROD_MODEL}',PROD_TYPE='${DATA.PROD_TYPE}',G_NAME_KD='${DATA.G_NAME_KD}',DESCR=N'${DATA.DESCR}',PROD_MAIN_MATERIAL='${DATA.PROD_MAIN_MATERIAL}',G_NAME='${DATA.G_NAME}',G_LENGTH='${DATA.G_LENGTH}',G_WIDTH='${DATA.G_WIDTH}',PD='${DATA.PD}',G_C='${DATA.G_C}',G_C_R='${DATA.G_C_R}',G_SG_L='${DATA.G_SG_L}',G_SG_R='${DATA.G_SG_R}',PACK_DRT='${DATA.PACK_DRT}',KNIFE_TYPE='${DATA.KNIFE_TYPE}',KNIFE_LIFECYCLE='${DATA.KNIFE_LIFECYCLE}',KNIFE_PRICE='${DATA.KNIFE_PRICE}',CODE_33='${DATA.CODE_33}',ROLE_EA_QTY='${DATA.ROLE_EA_QTY}',RPM='${DATA.RPM}',PIN_DISTANCE='${DATA.PIN_DISTANCE}',PROCESS_TYPE='${DATA.PROCESS_TYPE}',EQ1='${DATA.EQ1}',EQ2='${DATA.EQ2}', EQ3='${DATA.EQ3}',EQ4='${DATA.EQ4}', PROD_DIECUT_STEP='${DATA.PROD_DIECUT_STEP}',PROD_PRINT_TIMES='${DATA.PROD_PRINT_TIMES}',REMK='${DATA.REMK}',USE_YN='${DATA.USE_YN}',G_CG='${DATA.G_CG}',G_LG='${DATA.G_LG}',PROD_DVT='${DATA.PROD_DVT}', PDBV='P',QL_HSD='${DATA.QL_HSD}',EXP_DATE = ${DATA.EXP_DATE}, PD_HSD='${DATA.PD_HSD ?? 'N'}', FSC_CODE='${DATA.FSC_CODE}',UPDATE_REASON=N'${DATA.UPDATE_REASON}', UPD_COUNT = ${DATA.UPD_COUNT},APPROVED_YN='${DATA.APPROVED_YN===undefined ? 'Y' : DATA.APPROVED_YN}',  UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE CTR_CD='${DATA.CTR_CD}' AND  G_CODE = '${DATA.G_CODE}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.deleteM140_2 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `DELETE FROM M140 WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}' AND M_CODE NOT IN (${DATA.M_LIST})`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.checkGSEQ_M140 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT MAX(G_SEQ) AS MAX_G_SEQ FROM M140 WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.update_M140 = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `UPDATE M140 SET M_QTY=${DATA.M_QTY}, MAIN_M = ${DATA.MAIN_M}, LIEUQL_SX=${DATA.LIEUQL_SX}, UPD_EMPL='${EMPL_NO}', UPD_DATE=GETDATE() WHERE G_CODE='${DATA.G_CODE}' AND M_CODE ='${DATA.M_CODE}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.insertM140 = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO M140 (CTR_CD, G_CODE,RIV_NO,G_SEQ,M_CODE,M_QTY,META_PAT_CD,REMK,USE_YN,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL, MAIN_M, LIEUQL_SX) VALUES ('${DATA.CTR_CD}','${DATA.G_CODE}','A','${DATA.G_SEQ}', '${DATA.M_CODE}','${DATA.M_QTY}', 'x', '','Y', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}','${DATA.MAIN_M}','${DATA.LIEUQL_SX}')`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.deleteM140 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `DELETE FROM M140 WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.checkMaterialInfo = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ` `;
  if (DATA.M_NAME !== "") {
    condition += ` WHERE M_NAME LIKE '%${DATA.M_NAME}%'`;
  }
  let setpdQuery = ` SELECT * FROM ZTB_MATERIAL_TB ${condition} AND CTR_CD='${DATA.CTR_CD}' `;
  //${moment().format('YYYY-MM-DD')}
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.checkMassG_CODE = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
     SELECT TOP 1 * FROM P400 WHERE CTR_CD='${DATA.CTR_CD}'  AND G_CODE='${DATA.G_CODE}' AND CODE_55 <> '04' ORDER BY INS_DATE DESC
    `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.deleteBOM2 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `DELETE FROM ZTB_BOM2 WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.insertBOM2 = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO ZTB_BOM2 (CTR_CD, G_CODE, RIV_NO, G_SEQ, M_CODE, M_NAME, CUST_CD, USAGE, MAT_MASTER_WIDTH, MAT_CUTWIDTH, MAT_ROLL_LENGTH, MAT_THICKNESS, M_QTY, REMARK, PROCESS_ORDER, INS_EMPL, UPD_EMPL, INS_DATE, UPD_DATE, MAIN_M, M_CMS_PRICE, M_SS_PRICE, M_SLITTING_PRICE) VALUES ('${DATA.CTR_CD}', '${DATA.G_CODE}','A','${DATA.G_SEQ}','${DATA.M_CODE}','${DATA.M_NAME}','${DATA.CUST_CD}','${DATA.USAGE}','${DATA.MAT_MASTER_WIDTH}','${DATA.MAT_CUTWIDTH}','${DATA.MAT_ROLL_LENGTH}','${DATA.MAT_THICKNESS}','${DATA.M_QTY}','${DATA.REMARK}','${DATA.PROCESS_ORDER}','${EMPL_NO}','${EMPL_NO}',GETDATE(),GETDATE(),${DATA.MAIN_M},${DATA.M_CMS_PRICE},${DATA.M_SS_PRICE},${DATA.M_SLITTING_PRICE})`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.checkTBGExist = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT * FROM ZTB_QUOTATION_CALC_TB WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
  console.log(checkkq);
}
exports.getlastestCODKH = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT TOP 1 G_NAME_KD FROM M100 WHERE CTR_CD='${DATA.CTR_CD}' AND CUST_CD='${DATA.CUST_CD}' AND G_NAME_KD lIKE 'KH%' ORDER BY G_NAME_KD DESC
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.getAMAZON_DESIGN = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `SELECT * FROM DESIGN_AMAZONE WHERE CTR_CD='${DATA.CTR_CD}' AND DESIGN_AMAZONE.G_CODE_MAU='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.deleteAMZDesign = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `DELETE FROM DESIGN_AMAZONE WHERE CTR_CD='${DATA.CTR_CD}' AND DESIGN_AMAZONE.G_CODE_MAU='${DATA.G_CODE}'`;
  ///console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.insertAMZDesign = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO DESIGN_AMAZONE (CTR_CD,G_CODE_MAU,DOITUONG_NO,DOITUONG_NAME,PHANLOAI_DT,CAVITY_PRINT,FONT_NAME,POS_X,POS_Y,SIZE_W,SIZE_H,ROTATE,REMARK,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL,FONT_SIZE,FONT_STYLE,GIATRI,DOITUONG_STT) VALUES ('${DATA.CTR_CD}','${DATA.G_CODE_MAU}','${DATA.DOITUONG_NO}','${DATA.DOITUONG_NAME}','${DATA.PHANLOAI_DT}','${DATA.CAVITY_PRINT}','${DATA.FONT_NAME}','${DATA.POS_X}','${DATA.POS_Y}','${DATA.SIZE_W}','${DATA.SIZE_H}','${DATA.ROTATE}','${DATA.REMARK}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}','${DATA.FONT_SIZE}','${DATA.FONT_STYLE}',N'${DATA.GIATRI}','${DATA.DOITUONG_STT}')`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.checkDesignExistAMZ = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `SELECT * FROM DESIGN_AMAZONE WHERE CTR_CD='${DATA.CTR_CD}' AND DESIGN_AMAZONE.G_CODE_MAU='${DATA.G_CODE}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.update_material_info = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = ` UPDATE ZTB_MATERIAL_TB SET CUST_CD ='${DATA.CUST_CD}', SSPRICE ='${DATA.SSPRICE}',CMSPRICE ='${DATA.CMSPRICE}',SLITTING_PRICE ='${DATA.SLITTING_PRICE}',MASTER_WIDTH ='${DATA.MASTER_WIDTH}',ROLL_LENGTH ='${DATA.ROLL_LENGTH}' WHERE CTR_CD='${DATA.CTR_CD}' AND M_ID=${DATA.M_ID}`;
  //${moment().format('YYYY-MM-DD')}
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.loadbarcodemanager = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT pvtb.G_CODE, pvtb.G_NAME, pvtb.BARCODE_STT, pvtb.BARCODE_TYPE, pvtb.[RND] AS BARCODE_RND, pvtb.[DTC] AS BARCODE_INSP, pvtb.[KT] AS BARCODE_RELI, 
  CASE WHEN pvtb.[RND] = pvtb.[DTC] AND pvtb.[KT] = pvtb.[DTC] THEN 'OK' ELSE 'NG' END AS STATUS
  FROM 
  (
  SELECT ZTB_BARCODE_MANAGER.CTR_CD, ZTB_BARCODE_MANAGER.G_CODE, M100.G_NAME, ZTB_BARCODE_MANAGER.BARCODE_STT, ZTB_BARCODE_MANAGER.BARCODE_TYPE, ZTB_BARCODE_MANAGER.MAINDEPTNAME, ZTB_BARCODE_MANAGER.BARCODE_CONTENT FROM ZTB_BARCODE_MANAGER LEFT JOIN M100 ON (M100.G_CODE = ZTB_BARCODE_MANAGER.G_CODE AND M100.CTR_CD = ZTB_BARCODE_MANAGER.CTR_CD)
  ) AS bangnguon
  PIVOT
  (
    MIN(bangnguon.BARCODE_CONTENT) 
    FOR bangnguon.MAINDEPTNAME IN ([RND],[DTC],[KT])
  ) AS pvtb
  WHERE pvtb.CTR_CD='${DATA.CTR_CD}'
  `;
  setpdQuery = `
  SELECT ZTB_BARCODE_MANAGER.CTR_CD, ZTB_BARCODE_MANAGER.G_CODE, M100.G_NAME, ZTB_BARCODE_MANAGER.BARCODE_STT, ZTB_BARCODE_MANAGER.BARCODE_TYPE, ZTB_BARCODE_MANAGER.RND AS BARCODE_RND, ZTB_BARCODE_MANAGER.DTC AS BARCODE_RELI, ZTB_BARCODE_MANAGER.KT AS BARCODE_INSP, CASE WHEN (RND= DTC COLLATE Latin1_General_CS_AS AND DTC=KT COLLATE Latin1_General_CS_AS ) AND (RND is not null) THEN 'OK' ELSE 'NG' END AS STATUS, P500_A.G_CODE AS SX_STATUS 
  FROM ZTB_BARCODE_MANAGER 
  LEFT JOIN M100 ON (ZTB_BARCODE_MANAGER.G_CODE = M100.G_CODE AND ZTB_BARCODE_MANAGER.CTR_CD = M100.CTR_CD)
  LEFT JOIN (SELECT DISTINCT CTR_CD,G_CODE FROM P500) AS P500_A ON P500_A.G_CODE = ZTB_BARCODE_MANAGER.G_CODE AND P500_A.CTR_CD = ZTB_BARCODE_MANAGER.CTR_CD
  WHERE ZTB_BARCODE_MANAGER.CTR_CD='${DATA.CTR_CD}'
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.checkbarcodeExist = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
    SELECT * FROM ZTB_BARCODE_MANAGER WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE ='${DATA.G_CODE}' AND BARCODE_STT=${DATA.BARCODE_STT}
  `;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.addBarcode = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQueryrnd = `
    INSERT INTO ZTB_BARCODE_MANAGER (CTR_CD, G_CODE, BARCODE_STT, BARCODE_TYPE,  RND, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('${DATA.CTR_CD}','${DATA.G_CODE}','${DATA.BARCODE_STT}','${DATA.BARCODE_TYPE}','${DATA.BARCODE_RND}', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}')
  `;
  //console.log("setpdQueryrnd", setpdQueryrnd);
  checkkq = await queryDB(setpdQueryrnd);
  res.send(checkkq);
}
exports.updateBarcode = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQueryrnd = `
    UPDATE ZTB_BARCODE_MANAGER SET BARCODE_TYPE='${DATA.BARCODE_TYPE}', RND='${DATA.BARCODE_RND}' WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}' AND BARCODE_STT=${DATA.BARCODE_STT}
  `;
  checkkq = await queryDB(setpdQueryrnd);
  //console.log(setpdQueryrnd);
  res.send(checkkq);
}
exports.deleteBarcode = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQueryrnd = `
    DELETE FROM ZTB_BARCODE_MANAGER  WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}' AND BARCODE_STT=${DATA.BARCODE_STT}
  `;
  checkkq = await queryDB(setpdQueryrnd);
  //console.log(setpdQueryrnd);
  res.send(checkkq);
}
exports.loadquanlygiaonhan = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT TOP 100 KNIFE_FILM.KNIFE_FILM_ID,KNIFE_FILM.FACTORY_NAME,KNIFE_FILM.NGAYBANGIAO,KNIFE_FILM.G_CODE, M100.G_NAME, M100.PROD_TYPE, M110.CUST_NAME_KD, KNIFE_FILM.LOAIBANGIAO_PDP,KNIFE_FILM.LOAIPHATHANH,KNIFE_FILM.SOLUONG,KNIFE_FILM.SOLUONGOHP,KNIFE_FILM.LYDOBANGIAO,KNIFE_FILM.PQC_EMPL_NO,KNIFE_FILM.RND_EMPL_NO,KNIFE_FILM.SX_EMPL_NO,KNIFE_FILM.REMARK,KNIFE_FILM.CFM_GIAONHAN,KNIFE_FILM.CFM_INS_EMPL,KNIFE_FILM.CFM_DATE,KNIFE_FILM.KNIFE_FILM_STATUS,KNIFE_FILM.MA_DAO,KNIFE_FILM.TOTAL_PRESS,KNIFE_FILM.CUST_CD,KNIFE_FILM.KNIFE_TYPE
  FROM KNIFE_FILM 
  LEFT JOIN M100 ON M100.G_CODE = KNIFE_FILM.G_CODE AND M100.CTR_CD = KNIFE_FILM.CTR_CD
  LEFT JOIN M110 ON M110.CUST_CD = M100.CUST_CD AND M110.CTR_CD = M100.CTR_CD
  WHERE KNIFE_FILM.CTR_CD='${DATA.CTR_CD}'
  ORDER BY KNIFE_FILM.NGAYBANGIAO DESC, KNIFE_FILM.KNIFE_FILM_ID DESC
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.addbangiaodaofilmtailieu = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
   INSERT INTO KNIFE_FILM (CTR_CD,FACTORY_NAME, NGAYBANGIAO, G_CODE, LOAIBANGIAO_PDP, LOAIPHATHANH, SOLUONG, SOLUONGOHP, LYDOBANGIAO, PQC_EMPL_NO, RND_EMPL_NO, SX_EMPL_NO, REMARK, MA_DAO, CUST_CD, G_WIDTH, G_LENGTH, KNIFE_TYPE) VALUES ('${DATA.CTR_CD}','${DATA.FACTORY}','${DATA.NGAYBANGIAO}','${DATA.G_CODE}','${DATA.LOAIBANGIAO_PDP}','${DATA.LOAIPHATHANH}','${DATA.SOLUONG}','${DATA.SOLUONGOHP}','${DATA.LYDOBANGIAO}','${DATA.PQC_EMPL_NO}','${DATA.RND_EMPL_NO}','${DATA.SX_EMPL_NO}',N'${DATA.REMARK}','${DATA.MA_DAO}','${DATA.CUST_CD}',${DATA.G_WIDTH},${DATA.G_LENGTH},'${DATA.KNIFE_TYPE}')
  `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.rnddailynewcode = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE CODETB.CREATED_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59' `;
  let setpdQuery = `
    WITH CODETB AS (SELECT G_CODE, CTR_CD, CASE WHEN REV_NO='A' THEN 1 ELSE 0 END AS NEWCODE, CASE WHEN REV_NO<>'A' THEN 1 ELSE 0 END AS ECN, CAST(INS_DATE as date) AS CREATED_DATE FROM M100 WHERE CTR_CD='${DATA.CTR_CD}')
    SELECT CODETB.CREATED_DATE, SUM(NEWCODE) AS NEWCODE, SUM(ECN) AS ECN FROM CODETB 
    ${condition} AND CODETB.CTR_CD='${DATA.CTR_CD}'
    GROUP BY CODETB.CREATED_DATE            
    ORDER BY CODETB.CREATED_DATE DESC
    `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.rndweeklynewcode = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE CODETB.CREATED_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59' `;
  let setpdQuery = `
      WITH CODETB AS (SELECT G_CODE, CTR_CD, CASE WHEN REV_NO='A' THEN 1 ELSE 0 END AS NEWCODE, CASE WHEN REV_NO<>'A' THEN 1 ELSE 0 END AS ECN, CAST(INS_DATE as date) AS CREATED_DATE FROM M100 WHERE CTR_CD='${DATA.CTR_CD}')
      SELECT YEAR(CREATED_DATE) AS CREATED_YEAR,  DATEPART(WEEK,CREATED_DATE) AS CREATE_WEEK, CONCAT(YEAR(CREATED_DATE),'_', DATEPART(WEEK,CREATED_DATE)) AS CREATED_YW,SUM(NEWCODE) AS NEWCODE, SUM(ECN) AS ECN FROM CODETB 
      ${condition} AND CODETB.CTR_CD='${DATA.CTR_CD}'
      GROUP BY YEAR(CREATED_DATE), DATEPART(WEEK,CREATED_DATE)              
      ORDER BY YEAR(CREATED_DATE) DESC,  DATEPART(WEEK,CREATED_DATE) DESC
      `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.rndmonthlynewcode = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE CODETB.CREATED_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59' `;
  let setpdQuery = `
      WITH CODETB AS (SELECT G_CODE, CTR_CD, CASE WHEN REV_NO='A' THEN 1 ELSE 0 END AS NEWCODE, CASE WHEN REV_NO<>'A' THEN 1 ELSE 0 END AS ECN, CAST(INS_DATE as date) AS CREATED_DATE FROM M100 WHERE CTR_CD='${DATA.CTR_CD}')
      SELECT YEAR(CREATED_DATE) AS CREATED_YEAR,  MONTH(CREATED_DATE) AS CREATE_MONTH, CONCAT(YEAR(CREATED_DATE),'_', MONTH(CREATED_DATE)) AS CREATED_YM,SUM(NEWCODE) AS NEWCODE, SUM(ECN) AS ECN FROM CODETB 
      ${condition} AND CODETB.CTR_CD='${DATA.CTR_CD}'
      GROUP BY YEAR(CREATED_DATE),  MONTH(CREATED_DATE)              
      ORDER BY YEAR(CREATED_DATE) DESC,  MONTH(CREATED_DATE) DESC
      `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.rndyearlynewcode = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = `WHERE CODETB.CREATED_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59' `;
  let setpdQuery = `
      WITH CODETB AS (SELECT G_CODE, CTR_CD, CASE WHEN REV_NO='A' THEN 1 ELSE 0 END AS NEWCODE, CASE WHEN REV_NO<>'A' THEN 1 ELSE 0 END AS ECN, CAST(INS_DATE as date) AS CREATED_DATE FROM M100 WHERE CTR_CD='${DATA.CTR_CD}')
      SELECT YEAR(CREATED_DATE) AS CREATED_YEAR, SUM(NEWCODE) AS NEWCODE, SUM(ECN) AS ECN FROM CODETB 
      ${condition} AND CODETB.CTR_CD='${DATA.CTR_CD}'
      GROUP BY YEAR(CREATED_DATE)        
      ORDER BY YEAR(CREATED_DATE) DESC
      `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.rndNewCodeByCustomer = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
      WITH CODETB AS (SELECT G_CODE, CAST(INS_DATE as date) AS CREATED_DATE, CUST_CD, CTR_CD FROM M100),
      CUST_CODE_TB AS 
      (SELECT CODETB.CUST_CD, COUNT(G_CODE) AS NEWCODE, CODETB.CTR_CD FROM CODETB
      WHERE CODETB.CREATED_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59' 
      AND CODETB.CTR_CD='${DATA.CTR_CD}'
      GROUP BY CODETB.CUST_CD, CODETB.CTR_CD
      ) 
      SELECT M110.CUST_NAME_KD, CUST_CODE_TB.NEWCODE FROM CUST_CODE_TB 
      LEFT JOIN M110 ON M110.CUST_CD = CUST_CODE_TB.CUST_CD AND M110.CTR_CD = CUST_CODE_TB.CTR_CD 
      WHERE CUST_CODE_TB.CTR_CD='${DATA.CTR_CD}'
      ORDER BY CUST_CODE_TB.NEWCODE DESC
      `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.rndNewCodeByProdType = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
      WITH CODETB AS (SELECT G_CODE, CAST(INS_DATE as date) AS CREATED_DATE, PROD_TYPE, CTR_CD FROM M100)
      SELECT CODETB.PROD_TYPE, COUNT(G_CODE) AS NEWCODE FROM CODETB
      WHERE CODETB.CREATED_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59' 
      AND CODETB.CTR_CD='${DATA.CTR_CD}'
      GROUP BY CODETB.PROD_TYPE, CODETB.CTR_CD      
      ORDER BY NEWCODE DESC       
      `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadSampleMonitorTable = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
    SELECT ZTB_SAMPLE_MONITOR.REQ_ID, ZTB_SAMPLE_MONITOR.SAMPLE_ID, ZTB_SAMPLE_MONITOR.PROD_REQUEST_NO, ZTB_SAMPLE_MONITOR.G_NAME_KD, ZTB_SAMPLE_MONITOR.FILE_MAKET, ZTB_SAMPLE_MONITOR.FILM_FILE, ZTB_SAMPLE_MONITOR.KNIFE_STATUS,ZTB_SAMPLE_MONITOR.KNIFE_CODE, ZTB_SAMPLE_MONITOR.FILM, ZTB_SAMPLE_MONITOR.RND_EMPL, ZTB_SAMPLE_MONITOR.RND_UPD_DATE, ZTB_SAMPLE_MONITOR.MATERIAL_STATUS, ZTB_SAMPLE_MONITOR.PUR_EMPL, ZTB_SAMPLE_MONITOR.PUR_UPD_DATE, ZTB_SAMPLE_MONITOR.PRINT_STATUS,ZTB_SAMPLE_MONITOR.DIECUT_STATUS, ZTB_SAMPLE_MONITOR.PR_EMPL, ZTB_SAMPLE_MONITOR.PR_UPD_DATE, ZTB_SAMPLE_MONITOR.QC_STATUS, ZTB_SAMPLE_MONITOR.QC_EMPL, ZTB_SAMPLE_MONITOR.QC_UPD_DATE, ZTB_SAMPLE_MONITOR.APPROVE_STATUS, ZTB_SAMPLE_MONITOR.APPROVE_DATE, ZTB_SAMPLE_MONITOR.USE_YN, ZTB_SAMPLE_MONITOR.REMARK, ZTB_SAMPLE_MONITOR.INS_DATE, ZTB_SAMPLE_MONITOR.INS_EMPL, P400.PROD_REQUEST_DATE, P400.G_CODE, P400.PROD_REQUEST_QTY, P400.CUST_CD, P400.DELIVERY_DT, M100.G_WIDTH, M100.G_LENGTH, M110.CUST_NAME_KD, M100.G_NAME
    FROM ZTB_SAMPLE_MONITOR LEFT OUTER JOIN
    P400 ON P400.PROD_REQUEST_NO = ZTB_SAMPLE_MONITOR.PROD_REQUEST_NO AND P400.CTR_CD = ZTB_SAMPLE_MONITOR.CTR_CD LEFT OUTER JOIN
    M100 ON P400.G_CODE = M100.G_CODE AND P400.CTR_CD = M100.CTR_CD LEFT OUTER JOIN
    M110 ON M110.CUST_CD = P400.CUST_CD AND M110.CTR_CD = P400.CTR_CD
    WHERE ZTB_SAMPLE_MONITOR.CTR_CD='${DATA.CTR_CD}'
    ORDER BY SAMPLE_ID DESC
    `;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.lockSample = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_SAMPLE_MONITOR SET USE_YN='${DATA.USE_YN}' WHERE CTR_CD='${DATA.CTR_CD}' AND SAMPLE_ID=${DATA.SAMPLE_ID}
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateRND_SAMPLE_STATUS = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_SAMPLE_MONITOR SET FILE_MAKET='${DATA.FILE_MAKET}', FILM_FILE='${DATA.FILM_FILE}', KNIFE_STATUS='${DATA.KNIFE_STATUS}', KNIFE_CODE=N'${DATA.KNIFE_CODE ?? ''}', FILM='${DATA.FILM}', RND_EMPL='${EMPL_NO}', RND_UPD_DATE=GETDATE() WHERE  CTR_CD='${DATA.CTR_CD}' AND SAMPLE_ID=${DATA.SAMPLE_ID}
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateSX_SAMPLE_STATUS = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_SAMPLE_MONITOR SET PRINT_STATUS='${DATA.PRINT_STATUS}', DIECUT_STATUS='${DATA.DIECUT_STATUS}', PR_EMPL='${EMPL_NO}', PR_UPD_DATE=GETDATE() WHERE CTR_CD='${DATA.CTR_CD}' AND SAMPLE_ID=${DATA.SAMPLE_ID}
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateQC_SAMPLE_STATUS = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_SAMPLE_MONITOR SET QC_STATUS='${DATA.QC_STATUS}',  QC_EMPL='${EMPL_NO}', QC_UPD_DATE=GETDATE() WHERE CTR_CD='${DATA.CTR_CD}' AND SAMPLE_ID=${DATA.SAMPLE_ID}
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateMATERIAL_STATUS = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_SAMPLE_MONITOR SET MATERIAL_STATUS='${DATA.MATERIAL_STATUS}',  PUR_EMPL='${EMPL_NO}', PUR_UPD_DATE=GETDATE() WHERE CTR_CD='${DATA.CTR_CD}' AND SAMPLE_ID=${DATA.SAMPLE_ID}
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateAPPROVE_SAMPLE_STATUS = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
    UPDATE ZTB_SAMPLE_MONITOR SET APPROVE_STATUS='${DATA.APPROVE_STATUS}',REMARK=N'${DATA.REMARK}', ${DATA.APPROVE_STATUS === 'Y' ? 'APPROVE_DATE=GETDATE(),' : ''}  UPD_EMPL='${EMPL_NO}', UPD_DATE=GETDATE() WHERE CTR_CD='${DATA.CTR_CD}' AND SAMPLE_ID=${DATA.SAMPLE_ID}
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.addMonitoringSample = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
    INSERT INTO ZTB_SAMPLE_MONITOR (CTR_CD, PROD_REQUEST_NO, G_NAME_KD, INS_EMPL, UPD_EMPL,INS_DATE, UPD_DATE, REQ_ID) VALUES ('${DATA.CTR_CD}','${DATA.PROD_REQUEST_NO}','${DATA.G_NAME_KD}','${EMPL_NO}','${EMPL_NO}',GETDATE(),GETDATE(),${DATA.REQ_ID})
    `;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.updateProdProcessData = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
  UPDATE ZTB_PROD_PROCESS_TB SET EQ_SERIES='${DATA.EQ_SERIES}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE G_CODE='${DATA.G_CODE}' AND CTR_CD='${DATA.CTR_CD}' AND PROCESS_NUMBER=${DATA.PROCESS_NUMBER}
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.addProdProcessData = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `
  INSERT INTO ZTB_PROD_PROCESS_TB (CTR_CD, G_CODE, PROCESS_NUMBER, EQ_SERIES, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('${DATA.CTR_CD}', '${DATA.G_CODE}', ${DATA.PROCESS_NUMBER}, '${DATA.EQ_SERIES}', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}')
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.deleteProcessNotInCurrentListFromDataBase = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  DELETE FROM ZTB_PROD_PROCESS_TB WHERE G_CODE='${DATA.G_CODE}' AND PROCESS_NUMBER NOT IN (${DATA.PROCESS_NUMBER_LIST}) AND CTR_CD='${DATA.CTR_CD}'
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.deleteProdProcessData = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  DELETE FROM ZTB_PROD_PROCESS_TB WHERE G_CODE='${DATA.G_CODE}' AND CTR_CD='${DATA.CTR_CD}'
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.getmachinelist = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT DISTINCT SUBSTRING(EQ_NAME,1,2) AS EQ_NAME  FROM ZTB_SX_EQ_STATUS WHERE CTR_CD='${DATA.CTR_CD}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadProdProcessData = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  SELECT * FROM ZTB_PROD_PROCESS_TB WHERE G_CODE='${DATA.G_CODE}' AND CTR_CD='${DATA.CTR_CD}' ORDER BY PROCESS_NUMBER ASC
  `;
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.saveLOSS_SETTING_SX = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE M100 SET LOSS_ST_SX1 = ${DATA.LOSS_ST_SX1}, LOSS_ST_SX2 = ${DATA.LOSS_ST_SX2},LOSS_ST_SX3 = ${DATA.LOSS_ST_SX3}, LOSS_ST_SX4 = ${DATA.LOSS_ST_SX4}  WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.saveQLSX = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE M100 SET FACTORY='${DATA.FACTORY}',EQ1='${DATA.EQ1}',EQ2='${DATA.EQ2}', EQ3='${DATA.EQ3}',EQ4='${DATA.EQ4}',Setting1='${DATA.Setting1}', Setting2='${DATA.Setting2}', Setting3='${DATA.Setting3}', Setting4='${DATA.Setting4}', UPH1='${DATA.UPH1}',UPH2='${DATA.UPH2}',UPH3='${DATA.UPH3}',UPH4='${DATA.UPH4}',Step1='${DATA.Step1}',Step2='${DATA.Step2}',Step3='${DATA.Step3}',Step4='${DATA.Step4}',LOSS_SX1='${DATA.LOSS_SX1}', LOSS_SX2='${DATA.LOSS_SX2}',LOSS_SX3='${DATA.LOSS_SX3}',LOSS_SX4='${DATA.LOSS_SX4}',LOSS_SETTING1='${DATA.LOSS_SETTING1}',LOSS_SETTING2='${DATA.LOSS_SETTING2}',LOSS_SETTING3='${DATA.LOSS_SETTING3}',LOSS_SETTING4='${DATA.LOSS_SETTING4}',NOTE='${DATA.NOTE}' WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE='${DATA.G_CODE}'`;
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.setngoaiquan = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  //////console.log(DATA);
  let checkkq = "OK";
  let setpdQuery = ` UPDATE M100 SET NO_INSPECTION= '${DATA.VALUE}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE CTR_CD='${DATA.CTR_CD}'  AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
}
exports.updateBEP = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = ` UPDATE M100 SET BEP= '${DATA.BEP}' WHERE CTR_CD='${DATA.CTR_CD}'  AND G_CODE='${DATA.G_CODE}'`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
}
exports.updateLossKT = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = ` UPDATE M100 SET LOSS_KT= '${DATA.LOSS_KT}' WHERE CTR_CD='${DATA.CTR_CD}'  AND G_CODE='${DATA.G_CODE}'`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  ////console.log(checkkq);
  res.send(checkkq);
}
exports.check_m_code_m140 = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `select * from M140 WHERE CTR_CD='${DATA.CTR_CD}' AND G_CODE = '${DATA.G_CODE}' AND M_CODE ='${DATA.M_CODE}'`;
  //${moment().format('YYYY-MM-DD')}
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  res.send(checkkq);
}
exports.addYCTK = async (req, res, DATA) => {
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "OK";
  let setpdQuery = `INSERT INTO ZTB_YCTK_TB (CTR_CD, CUST_CD, G_CODE, DESIGN_REQUEST_DATE, ESTIMATED_PO, MATERIAL, Coating_KhongPhu, Coating_LamiBong, Coating_OpamMo, Coating_UVBong, Coating_UVMo, LabelWidth, LabelHeight, Tolerance, FaceOut, FaceIn, TopBottomSpacing, BetweenLabelSpacing, LinerSpacing, CornerRadius, AdhesiveRemoval, HasToothCut, DieCutType, LabelForm, LabelFormQty, RollCore, PrintYN, DecalType, ApproveType, SpecialRequirement, SpecialRequirementLevel, RND_EMPL, QC_EMPL, KD_EMPL, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('${DATA.CTR_CD}', '${DATA.CUST_CD}', '${DATA.G_CODE}', '${DATA.DESIGN_REQUEST_DATE}', ${DATA.ESTIMATED_PO}, N'${DATA.MATERIAL}', ${DATA.Coating_KhongPhu? 1: 0}, ${DATA.Coating_LamiBong? 1: 0}, ${DATA.Coating_OpamMo? 1: 0}, ${DATA.Coating_UVBong? 1: 0}, ${DATA.Coating_UVMo? 1: 0}, ${DATA.LabelWidth}, ${DATA.LabelHeight}, ${DATA.Tolerance}, ${DATA.FaceOut}, ${DATA.FaceIn}, ${DATA.TopBottomSpacing}, ${DATA.BetweenLabelSpacing}, ${DATA.LinerSpacing}, ${DATA.CornerRadius}, ${DATA.AdhesiveRemoval? 1: 0}, ${DATA.HasToothCut? 1: 0}, N'${DATA.DieCutType}', N'${DATA.LabelForm}', ${DATA.LabelFormQty}, N'${DATA.RollCore}', N'${DATA.PrintYN}', N'${DATA.DecalType}', N'${DATA.ApproveType}', N'${DATA.SpecialRequirement}', ${DATA.SpecialRequirementLevel},'${EMPL_NO}', '${EMPL_NO}', '${EMPL_NO}', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}')`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadyctkdata = async (req, res, DATA) => {
  let checkkq = "OK";
  let condition = ``;
  if (DATA.ALL_TIME) {
    condition += ``;
  } else {
    condition += ` AND DESIGN_REQUEST_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
  }
  let setpdQuery = `WITH APPROVED_SAMPLE_TABLE AS 
(
	SELECT DISTINCT CTR_CD, REQ_ID FROM ZTB_SAMPLE_MONITOR WHERE QC_STATUS = 'Y' AND REQ_ID is not null
)
SELECT ZTB_YCTK_TB.*, M100.G_NAME, M100.G_NAME_KD, M110.CUST_NAME_KD,CASE WHEN APPROVED_SAMPLE_TABLE.REQ_ID is null THEN 'P' ELSE 'Y' END AS SAMPLE_STATUS FROM ZTB_YCTK_TB LEFT JOIN M100 ON M100.G_CODE = ZTB_YCTK_TB.G_CODE AND M100.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN M110 ON M110.CUST_CD = ZTB_YCTK_TB.CUST_CD AND M110.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN APPROVED_SAMPLE_TABLE ON APPROVED_SAMPLE_TABLE.CTR_CD = ZTB_YCTK_TB.CTR_CD AND APPROVED_SAMPLE_TABLE.REQ_ID = ZTB_YCTK_TB.REQ_ID 
WHERE ZTB_YCTK_TB.CTR_CD='${DATA.CTR_CD}' ${condition} ORDER BY ZTB_YCTK_TB.REQ_ID DESC`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.deleteYCTK = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `DELETE FROM ZTB_YCTK_TB WHERE REQ_ID=${DATA.REQ_ID}`;
  ////console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.updateYCTK = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `UPDATE ZTB_YCTK_TB SET CUST_CD='${DATA.CUST_CD}', G_CODE='${DATA.G_CODE}', DESIGN_REQUEST_DATE='${DATA.DESIGN_REQUEST_DATE}', ESTIMATED_PO=${DATA.ESTIMATED_PO}, MATERIAL=N'${DATA.MATERIAL}', Coating_KhongPhu=${DATA.Coating_KhongPhu?1:0}, Coating_LamiBong=${DATA.Coating_LamiBong?1:0}, Coating_OpamMo=${DATA.Coating_OpamMo?1:0}, Coating_UVBong=${DATA.Coating_UVBong?1:0}, Coating_UVMo=${DATA.Coating_UVMo?1:0}, LabelWidth=${DATA.LabelWidth}, LabelHeight=${DATA.LabelHeight}, Tolerance=${DATA.Tolerance}, FaceOut=${DATA.FaceOut}, FaceIn=${DATA.FaceIn}, TopBottomSpacing=${DATA.TopBottomSpacing}, BetweenLabelSpacing=${DATA.BetweenLabelSpacing}, LinerSpacing=${DATA.LinerSpacing}, CornerRadius=${DATA.CornerRadius}, AdhesiveRemoval=${DATA.AdhesiveRemoval?1:0}, HasToothCut=${DATA.HasToothCut?1:0}, DieCutType='${DATA.DieCutType}', LabelForm='${DATA.LabelForm}', LabelFormQty=${DATA.LabelFormQty}, RollCore='${DATA.RollCore}', PrintYN='${DATA.PrintYN}', DecalType='${DATA.DecalType}', ApproveType='${DATA.ApproveType}', SpecialRequirement=N'${DATA.SpecialRequirement}', SpecialRequirementLevel=${DATA.SpecialRequirementLevel} WHERE REQ_ID=${DATA.REQ_ID}`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadyctkdatatrenddaily = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  WITH APPROVED_SAMPLE_TABLE AS 
  (
    SELECT DISTINCT CTR_CD, REQ_ID FROM ZTB_SAMPLE_MONITOR WHERE QC_STATUS = 'Y' AND REQ_ID is not null
  ),
  YCTKTB AS
  (
  SELECT ZTB_YCTK_TB.*, M100.G_NAME, M100.G_NAME_KD, M110.CUST_NAME_KD,CASE WHEN APPROVED_SAMPLE_TABLE.REQ_ID is null THEN 'P' ELSE 'Y' END AS SAMPLE_STATUS FROM ZTB_YCTK_TB LEFT JOIN M100 ON M100.G_CODE = ZTB_YCTK_TB.G_CODE AND M100.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN M110 ON M110.CUST_CD = ZTB_YCTK_TB.CUST_CD AND M110.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN APPROVED_SAMPLE_TABLE ON APPROVED_SAMPLE_TABLE.CTR_CD = ZTB_YCTK_TB.CTR_CD AND APPROVED_SAMPLE_TABLE.REQ_ID = ZTB_YCTK_TB.REQ_ID 
  WHERE ZTB_YCTK_TB.CTR_CD='${DATA.CTR_CD}' AND ZTB_YCTK_TB.DESIGN_REQUEST_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'
  )
  SELECT DESIGN_REQUEST_DATE AS REQ_DATE,YEAR(DESIGN_REQUEST_DATE) AS REQ_YEAR, DATEPART(ISO_WEEK,DESIGN_REQUEST_DATE) AS REQ_WEEK, CONCAT(YEAR(DESIGN_REQUEST_DATE),'_', DATEPART(ISO_WEEK,DESIGN_REQUEST_DATE)) AS REQ_YW,MONTH(DESIGN_REQUEST_DATE) AS REQ_MONTH,  CONCAT(YEAR(DESIGN_REQUEST_DATE),'_', MONTH(DESIGN_REQUEST_DATE)) AS REQ_YM, SUM(CASE WHEN SAMPLE_STATUS = 'Y' THEN 1 ELSE 0 END) AS COMPLETED, SUM(CASE WHEN SAMPLE_STATUS = 'P' THEN 1 ELSE 0 END) AS PENDING, COUNT(SAMPLE_STATUS) AS TOTAL  
  FROM YCTKTB 
  GROUP BY DESIGN_REQUEST_DATE
  ORDER BY DESIGN_REQUEST_DATE DESC
`;
  console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadyctkdatatrendweekly = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  WITH APPROVED_SAMPLE_TABLE AS 
  (
    SELECT DISTINCT CTR_CD, REQ_ID FROM ZTB_SAMPLE_MONITOR WHERE QC_STATUS = 'Y' AND REQ_ID is not null
  ),
  YCTKTB AS
  (
  SELECT ZTB_YCTK_TB.*, M100.G_NAME, M100.G_NAME_KD, M110.CUST_NAME_KD,CASE WHEN APPROVED_SAMPLE_TABLE.REQ_ID is null THEN 'P' ELSE 'Y' END AS SAMPLE_STATUS FROM ZTB_YCTK_TB LEFT JOIN M100 ON M100.G_CODE = ZTB_YCTK_TB.G_CODE AND M100.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN M110 ON M110.CUST_CD = ZTB_YCTK_TB.CUST_CD AND M110.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN APPROVED_SAMPLE_TABLE ON APPROVED_SAMPLE_TABLE.CTR_CD = ZTB_YCTK_TB.CTR_CD AND APPROVED_SAMPLE_TABLE.REQ_ID = ZTB_YCTK_TB.REQ_ID 
  WHERE ZTB_YCTK_TB.CTR_CD='${DATA.CTR_CD}' AND ZTB_YCTK_TB.DESIGN_REQUEST_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'
  )
  SELECT YEAR(DESIGN_REQUEST_DATE) AS REQ_YEAR, DATEPART(ISO_WEEK,DESIGN_REQUEST_DATE) AS REQ_WEEK, CONCAT(YEAR(DESIGN_REQUEST_DATE),'_', DATEPART(ISO_WEEK,DESIGN_REQUEST_DATE)) AS REQ_YW, SUM(CASE WHEN SAMPLE_STATUS = 'Y' THEN 1 ELSE 0 END) AS COMPLETED, SUM(CASE WHEN SAMPLE_STATUS = 'P' THEN 1 ELSE 0 END) AS PENDING, COUNT(SAMPLE_STATUS) AS TOTAL  
  FROM YCTKTB 
  GROUP BY YEAR(DESIGN_REQUEST_DATE), DATEPART(ISO_WEEK,DESIGN_REQUEST_DATE)
  ORDER BY YEAR(DESIGN_REQUEST_DATE) DESC, DATEPART(ISO_WEEK,DESIGN_REQUEST_DATE) DESC
`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadyctkdatatrendmonthly = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  WITH APPROVED_SAMPLE_TABLE AS 
  (
    SELECT DISTINCT CTR_CD, REQ_ID FROM ZTB_SAMPLE_MONITOR WHERE QC_STATUS = 'Y' AND REQ_ID is not null
  ),
  YCTKTB AS
  (
  SELECT ZTB_YCTK_TB.*, M100.G_NAME, M100.G_NAME_KD, M110.CUST_NAME_KD,CASE WHEN APPROVED_SAMPLE_TABLE.REQ_ID is null THEN 'P' ELSE 'Y' END AS SAMPLE_STATUS FROM ZTB_YCTK_TB LEFT JOIN M100 ON M100.G_CODE = ZTB_YCTK_TB.G_CODE AND M100.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN M110 ON M110.CUST_CD = ZTB_YCTK_TB.CUST_CD AND M110.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN APPROVED_SAMPLE_TABLE ON APPROVED_SAMPLE_TABLE.CTR_CD = ZTB_YCTK_TB.CTR_CD AND APPROVED_SAMPLE_TABLE.REQ_ID = ZTB_YCTK_TB.REQ_ID 
  WHERE ZTB_YCTK_TB.CTR_CD='${DATA.CTR_CD}' AND ZTB_YCTK_TB.DESIGN_REQUEST_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'
  )
  SELECT YEAR(DESIGN_REQUEST_DATE) AS REQ_YEAR, MONTH(DESIGN_REQUEST_DATE) AS REQ_MONTH, CONCAT(YEAR(DESIGN_REQUEST_DATE),'_', MONTH(DESIGN_REQUEST_DATE)) AS REQ_YM, SUM(CASE WHEN SAMPLE_STATUS = 'Y' THEN 1 ELSE 0 END) AS COMPLETED, SUM(CASE WHEN SAMPLE_STATUS = 'P' THEN 1 ELSE 0 END) AS PENDING, COUNT(SAMPLE_STATUS) AS TOTAL  
  FROM YCTKTB 
  GROUP BY YEAR(DESIGN_REQUEST_DATE), MONTH(DESIGN_REQUEST_DATE)
  ORDER BY YEAR(DESIGN_REQUEST_DATE) DESC, MONTH(DESIGN_REQUEST_DATE) DESC
`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.loadyctkdatatrendyearly = async (req, res, DATA) => {
  let checkkq = "OK";
  let setpdQuery = `
  WITH APPROVED_SAMPLE_TABLE AS 
  (
    SELECT DISTINCT CTR_CD, REQ_ID FROM ZTB_SAMPLE_MONITOR WHERE QC_STATUS = 'Y' AND REQ_ID is not null
  ),
  YCTKTB AS
  (
  SELECT ZTB_YCTK_TB.*, M100.G_NAME, M100.G_NAME_KD, M110.CUST_NAME_KD,CASE WHEN APPROVED_SAMPLE_TABLE.REQ_ID is null THEN 'P' ELSE 'Y' END AS SAMPLE_STATUS FROM ZTB_YCTK_TB LEFT JOIN M100 ON M100.G_CODE = ZTB_YCTK_TB.G_CODE AND M100.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN M110 ON M110.CUST_CD = ZTB_YCTK_TB.CUST_CD AND M110.CTR_CD = ZTB_YCTK_TB.CTR_CD  LEFT JOIN APPROVED_SAMPLE_TABLE ON APPROVED_SAMPLE_TABLE.CTR_CD = ZTB_YCTK_TB.CTR_CD AND APPROVED_SAMPLE_TABLE.REQ_ID = ZTB_YCTK_TB.REQ_ID 
  WHERE ZTB_YCTK_TB.CTR_CD='${DATA.CTR_CD}' AND ZTB_YCTK_TB.DESIGN_REQUEST_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'
  )
  SELECT YEAR(DESIGN_REQUEST_DATE) AS REQ_YEAR, SUM(CASE WHEN SAMPLE_STATUS = 'Y' THEN 1 ELSE 0 END) AS COMPLETED, SUM(CASE WHEN SAMPLE_STATUS = 'P' THEN 1 ELSE 0 END) AS PENDING, COUNT(SAMPLE_STATUS) AS TOTAL  
  FROM YCTKTB 
  GROUP BY YEAR(DESIGN_REQUEST_DATE)
  ORDER BY YEAR(DESIGN_REQUEST_DATE) DESC
`;
  //console.log(setpdQuery);
  checkkq = await queryDB(setpdQuery);
  //console.log(checkkq);
  res.send(checkkq);
}
exports.common = async (req, res, DATA) => {
}
exports.common = async (req, res, DATA) => {
}
exports.common = async (req, res, DATA) => {
}