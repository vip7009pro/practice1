const { login, logout } = require("./authService");
const { getYcsx, updateYcsx } = require("./ycsxService");
const { uploadFile } = require("./fileService");
const { getCommonData, checklogin, checkMYCHAMCONG, insert_Notification_Data, load_Notification_Data, checkEMPL_NO_mobile, checkMNAMEfromLotI222, checkPLAN_ID, checkMNAMEfromLot, checkMNAMEfromLotI222Total, checkPlanIdP501, checkProcessLotNo_Prod_Req_No, checkPROCESS_LOT_NO, check_m_code_m140_main, isM_LOT_NO_in_IN_KHO_SX, check_m_lot_exist_p500, loadPostAll, loadPost, updatePost, deletePost, updatechamcongdiemdanhauto, getlastestPostId, insert_information, loadWebSetting, update_file_name, get_file_list, delete_file, changepassword, setWebVer } = require("./commonService");
const { workdaycheck, tangcadaycheck, countxacnhanchamcong, countthuongphat, checkWebVer, nghidaycheck, checkLicense } = require("./userService");
const moment = require("moment");
const { diemdanhnhom, diemdanhnhomBP, diemdanhnhomNS, setdiemdanhnhom, setdiemdanhnhom2, setteamnhom, dangkytangcanhom, dangkynghi2, dangkynghi2_AUTO, dangkytangcacanhan, pheduyetnhom, pheduyetnhomBP, pheduyetnhomNS, setpheduyetnhom, mydiemdanhnhom, diemdanhsummarynhom, getmaindeptlist, workpositionlist, workpositionlist_BP, workpositionlist_NS, diemdanhhistorynhom, diemdanhfull, getemployee_full, insertemployee, updateemployee, getmaindept, insertmaindept, updatemaindept, deletemaindept, getsubdept, insertsubdept, updatesubdept, deletesubdept, getworkposition, insertworkposition, updateworkposition, deleteworkposition, getsubdeptall, getddmaindepttb, loadDiemDanhFullSummaryTable, xoadangkynghi_AUTO, setca, setnhamay, setEMPL_WORK_POSITION, updateM010, loadC001, loadC0012, loadCaInfo, fixTime, update_empl_image, getDepartmentList, checkdiemdanh } = require("./nhansuService");
const { checkcustcd, get_listcustomer, add_customer, edit_customer, checkFcstExist, checkGCodeVer, insert_fcst, delete_fcst, loadxuatkhopo, checklastfcstweekno, fcstamount, kd_dailyclosing, kd_weeklyclosing, kd_monthlyclosing, kd_annuallyclosing, traPOSummaryTotal, customerRevenue, PICRevenue, dailyoverduedata, weeklyoverduedata, monthlyoverduedata, yearlyoverduedata, selectcustomerList, getDailyClosingKD, getWeeklyClosingKD, kd_pooverweek, kd_runningpobalance, loadMonthlyRevenueByCustomer, traPlanDataFull, checkPlanExist, insert_plan, delete_plan, traPOFullCMS_New, traPOFullCMS2, traPOFullKD_NEW, traPOFullKD2, loadbanggiamoinhat, loadlistcodequotation, getbomgia, loadDefaultDM, checkgiaExist, updategiasp, upgiasp, updateCurrentUnit, updateGiaVLBOM2, pheduyetgia, loadM100UpGia, dongbogiasptupo, loadbanggia, loadbanggia2, updategia, deletegia, checkShortageExist, insert_shortage, delete_shortage, traShortageKD, update_banve_value, insertData_Amazon_SuperFast, pheduyet_ycsx, setMaterial_YN, setpending_ycsx, setopen_ycsx, get_ycsxInfo2, get_cavityAmazon, traDataAMZ, check_inventorydate, checkMainMaterialFSC, ycsx_fullinfo, checkpobalance_tdycsx, checktonkho_tdycsx, checkPOExist, delete_invoice, selectcodeList, insert_invoice, traInvoiceDataFull, update_invoice, update_invoice_no, loadProdOverData, updateProdOverData, tinh_hinh_kiemtra_G_CODE, updateTONTP_M100_CMS, updateBTP_M1002, updateTONKIEM_M100, checkcustomerpono, autopheduyetgiaall, delete_po, traPODataFull, update_po, checkYCSXQLSXPLAN, delete_ycsx, delete_P500_YCSX, delete_P501_YCSX, checkInLaiCount_AMZ, deleteAMZ_DATA, check_G_NAME_2Ver_active, checktrungAMZ_Full, checkfcst_tdycsx, checkYcsxExist, checkLastYCSX, checkProcessInNoP500, insertDBYCSX, insertDBYCSX_New, insert_p500, insert_p501, insert_ycsx, checkmainBOM2_M140_M_CODE_MATCHING, checkmainBOM2, checkIDCongViecAMZ, loadpono, getLastProcessLotNo, traYCSXDataFull, updateDMLOSSKT_ZTB_DM_HISTORY, update_ycsx, traFcstDataFull, baocaofcstss, customerpobalancebyprodtype_new, POBalanceByCustomer } = require("./kinhdoanhService");
const { get_material_table, checkMaterialExist, addMaterial, updateMaterial, updateM090FSC, updateTDSStatus, selectVendorList, getFSCList, loadMaterialByPO, loadMaterialByYCSX, loadMaterialMRPALL, loadMaterialByYCSX_ALL, autoUpdateDocUSEYN_EXP, getMaterialDocData, insertMaterialDocData, updateDtcApp, updateMaterialDocData, updatePurApp, updateRndApp, loadMRPPlan, checkDocVersion } = require("./muahangService");
const { updatenndscs, updateCSImageStatus, updateCSDoiSachVNStatus, updateCSDoiSachKRStatus, tracsconfirm, tracsrma, tracsCNDB, tracsTAXI, csdailyconfirmdata, csweeklyconfirmdata, csmonthlyconfirmdata, csyearlyconfirmdata, csConfirmDataByCustomer, csConfirmDataByPIC, csdailyreduceamount, csweeklyreduceamount, csmonthlyreduceamount, csyearlyreduceamount, csdailyRMAAmount, csweeklyRMAAmount, csmonthlyRMAAmount, csyearlyRMAAmount, csdailyTaxiAmount, csmonthlyTaxiAmount, csweeklyTaxiAmount, csyearlyTaxiAmount, getMaterialList, checkSpecDTC, checkSpecDTC2, insertSpecDTC, updateSpecDTC, checkAddedSpec, loadrecentRegisteredDTCData, getLastDTCID, checkLabelID2, registerDTCTest, getinputdtcspec, checkRegisterdDTCTEST, insert_dtc_result, updateDTC_TEST_EMPL, loadXbarData, loadCPKTrend, loadHistogram, dtcdata, dtcspec, getpatrolheader, getInspectionWorstTable, inspect_daily_ppm, inspect_weekly_ppm, inspect_monthly_ppm, inspect_yearly_ppm, getInspectionSummary, dailyFcost, weeklyFcost, monthlyFcost, annuallyFcost, dailyDefectTrending, get_inspection, loadChoKiemGop_NEW, loadInspectionPatrol, resetStatus, getIns_Status, updateQCPASS_FAILING, updateIQCConfirm_FAILING, loadQCFailData, checkPQC3_IDfromPLAN_ID, insertFailingData, updateQCFailTableData, updateQCPASS_HOLDING, updateMaterialHoldingReason, traholdingmaterial, updateQCPASSI222, updateIQC1Table, loadIQC1table, insertIQC1table, update_ncr_image, loadNCRData, loadHoldingMaterialByNCR_ID, insertNCRData, selectCustomerAndVendorList, checklastAuditID, insertCheckSheetData, checkAuditNamebyCustomer, insertNewAuditInfo, auditlistcheck, loadAuditResultList, loadAuditResultCheckList, checkAuditResultCheckListExist, insertResultIDtoCheckList, createNewAudit, updateEvident, resetEvident, updatechecksheetResultRow, loadRNRchitiet, RnRtheonhanvien, traOQCData, ngbyCustomerOQC, ngbyProTypeOQC, dailyOQCTrendingData, weeklyOQCTrendingData, monthlyOQCTrendingData, yearlyOQCTrendingData, checkktdtc, checkPlanIdChecksheet, insert_pqc1, update_checksheet_image_status, pqcdailyppm, pqcweeklyppm, pqcmonthlyppm, pqcyearlyppm, getPQCSummary, dailyPQCDefectTrending, trapqc3data, trapqc1data, updatepqc1sampleqty, loadErrTable, insert_pqc3, getlastestPQC3_ID, traCNDB, tradaofilm, updatenndspqc, loadDtcTestList, addTestItem, addTestPoint, loadDtcTestPointList, khkt_a_dung, temlotktraHistory, updateNCRIDForFailing, getInspectionWorstByCode, updateNCRIDForHolding, trainspectionpatrol } = require("./qcService");
const { loadDataSX, nhapkhoao, resetKhoSX_IQC1, resetKhoSX_IQC2, loadtiledat, getdatadinhmuc_G_CODE, ycsxbalanceleadtimedata, checkEQ_STATUS, diemdanhallbp, capabydeliveryplan, machinecounting, ycsxbalancecapa, getSXCapaData, getchithidatatable, checkP500M_CODE, check_lieuql_sx_m140, checkPLANID_OUT_KHO_AO, deletePlanQLSX, checkQLSXPLANSTATUS, getLastestPLAN_ID, getLastestPLANORDER, checkProd_request_no_Exist_O302, addPlanQLSX, quickcheckycsx, traYCSXDataFull_QLSX, quickcheckycsx_New, getProductionPlanCapaData, loadDefectProcessData, lichsuinputlieusanxuat_full, lichsunhapkhoao, loadDataSX_YCSX, updateBTP_P400, updatetonkiemP400, tinhhinhycsxtheongay, addMachine, deleteMachine, toggleMachineActiveStatus, loadLeadtimeData, an_lieu_kho_ao, checktonKhoAoMLotNo, checkFSC_PLAN_ID, checkYcsxStatus, checkTonTaiXuatKhoAo, delete_in_kho_ao, delete_out_kho_ao, check_2_m_code_in_kho_ao, checkM_CODE_CHITHI, checkNextPlanClosed, checktonlieutrongxuong, lichsuxuatkhoao, setUSE_YN_KHO_AO_INPUT, xuatkhoao, checktonKhoSubMLotNo, lichsunhapkhosub, checktonlieutrongxuong_sub, setUSE_YN_KHO_SUB_INPUT, deleteLongtermPlan, insertKHSXDAIHAN, loadKHSXDAIHAN, moveKHSXDAIHAN, checkplansetting, move_plan, getP4002, check_PLAN_ID_OUT_KNIFE_FILM, insert_OUT_KNIFE_FILM, check_PLAN_ID_KHO_AO, checkPLANID_O300, checkPLANID_O301, getO300_LAST_OUT_NO, getP400, insertO300, getO300_ROW, deleteM_CODE_O301, checkM_CODE_PLAN_ID_Exist_in_O301, insertO301, updatePlanQLSX, updatePlanOrder, getqlsxplan2, getqlsxplan2_New, deleteMCODEExistIN_O302, updateLIEUQL_SX_M140, deleteM_CODE_ZTB_QLSXCHITHI, updateChiThi, insertChiThi, traYCSXDataFull_QLSX_New, updateDKXLPLAN, updateXUATLIEUCHINH_PLAN, update_XUAT_DAO_FILM_PLAN, updateO301, checkPLANID_O302, neededSXQtyByYCSX, getSystemDateTime, deleteDMYCSX, deleteDMYCSX2, checkTonTaiXuatKhoSub, nhapkhosubao, tralichsutemlotsx, loadDMSX, updateO301_OUT_CFM_QTY_FROM_O302, updateUSE_YN_I222_RETURN_NVL, addProdProcessDataQLSX, updateProdProcessDataQLSX, checkProcessExist, isM_LOT_NO_in_O302, getI221Lastest_IN_NO, getI222Lastest_M_LOT_NO, insert_I221, insert_I222, loadBTPAuto2, loadBTPSummaryAuto2, updateKHSXDAIHAN, deleteNotExistKHSXDAIHAN, cancelProductionLot, traDataPlanLossSX, datasxdailylosstrend, datasxweeklylosstrend, datasxmonthlylosstrend, datasxyearlylosstrend, dailyEQEffTrending, weeklyEQEffTrending, monthlyEQEffTrending, yearlyEQEffTrending, sxdailyachivementtrending, sxweeklyachivementtrending, sxmonthlyachivementtrending, sxyearlyachivementtrending, sxLossTimeByReason, sxLossTimeByEmpl, loadBaoCaoTheoRoll, trasxlosstrendingdata, dailysxlosstrend, weeklysxlosstrend, monthlysxlosstrend, yearlysxlosstrend, loadquanlydaofilm, lichsuxuatdaofilm, machinecounting2, dailysxdata, sxweeklytrenddata, sxmonthlytrenddata, machineTimeEfficiency, sxachivementdata, tinhhinhchotbaocaosx, materialLotStatus } = require("./sanxuatService");
const { updateAmazonBOMCodeInfo, listAmazon, getBOMAMAZON, getBOMAMAZON_EMPTY, codeinfo, loadcodephoi, checkExistBOMAMAZON, insertAmazonBOM, updateAmazonBOM, checkGNAMEKDExist, update_appsheet_value, getMasterMaterialList, resetbanve, pdbanve, getbomsx, codeinforRnD, getcodefullinfo, getNextSEQ_G_CODE, insertM100BangTinhGia, updateM100BangTinhGia, insertM100, insertM100_AddVer, updateM100, deleteM140_2, checkGSEQ_M140, update_M140, insertM140, deleteM140, checkMaterialInfo, checkMassG_CODE, deleteBOM2, insertBOM2, checkTBGExist, getlastestCODKH, getAMAZON_DESIGN, deleteAMZDesign, insertAMZDesign, update_material_info, loadbarcodemanager, checkbarcodeExist, addBarcode, updateBarcode, deleteBarcode, loadquanlygiaonhan, addbangiaodaofilmtailieu, rnddailynewcode, rndweeklynewcode, rndmonthlynewcode, rndyearlynewcode, rndNewCodeByCustomer, rndNewCodeByProdType, loadSampleMonitorTable, lockSample, updateRND_SAMPLE_STATUS, updateSX_SAMPLE_STATUS, updateQC_SAMPLE_STATUS, updateMATERIAL_STATUS, updateAPPROVE_SAMPLE_STATUS, addMonitoringSample, updateProdProcessData, addProdProcessData, deleteProcessNotInCurrentListFromDataBase, deleteProdProcessData, getmachinelist, loadProdProcessData, saveLOSS_SETTING_SX, saveQLSX, setngoaiquan, updateBEP, updateLossKT } = require("./rndService");
const { insert_O302, updateStockM090, tranhaplieu, traxuatlieu, tratonlieu, updatelieuncc, checkMNAMEfromLotI222XuatKho, checksolanout_O302, xuatpackkhotp, trakhotpInOut, traSTOCKCMS_NEW, traSTOCKCMS, traSTOCKKD_NEW, traSTOCKKD, traSTOCKTACH, loadKTP_IN, loadKTP_OUT, loadStockFull, loadSTOCKG_CODE, loadSTOCKG_NAME_KD, loadSTOCK_YCSX, updatePheDuyetHuyO660, cancelPheDuyetHuyO660 } = require("./warehouseService");
const commandHandlers = {
  login,
  logout, 
  uploadFile,
  getCommonData,
  checklogin,
  checkMYCHAMCONG,
  workdaycheck,
  tangcadaycheck,
  countxacnhanchamcong,
  countthuongphat,
  checkWebVer,
  nghidaycheck,
  checkLicense,
  diemdanhnhom,
  diemdanhnhomBP,
  diemdanhnhomNS,
  setdiemdanhnhom,
  setdiemdanhnhom2,
  setteamnhom,
  dangkytangcanhom,
  dangkynghi2,
  dangkynghi2_AUTO,
  dangkytangcacanhan,
  pheduyetnhom,
  pheduyetnhomBP,
  pheduyetnhomNS,
  setpheduyetnhom,
  mydiemdanhnhom,
  diemdanhsummarynhom,
  getmaindeptlist,
  workpositionlist,
  workpositionlist_BP,
  workpositionlist_NS,
  diemdanhhistorynhom,
  diemdanhfull,
  getemployee_full,
  insertemployee,
  updateemployee,
  getmaindept,
  insertmaindept,
  updatemaindept,
  deletemaindept,
  getsubdept,
  insertsubdept,
  updatesubdept,
  deletesubdept,
  getworkposition,
  insertworkposition,
  updateworkposition,
  deleteworkposition,
  getsubdeptall,
  getddmaindepttb,
  loadDiemDanhFullSummaryTable,
  xoadangkynghi_AUTO,
  setca,
  setnhamay,
  setEMPL_WORK_POSITION,
  updateM010,
  loadC001,
  loadC0012,
  loadCaInfo,
  setdiemdanhnhom2,
  fixTime,
  update_empl_image,
  checkcustcd,
  get_listcustomer,
  add_customer,
  edit_customer,
  checkFcstExist,
  checkGCodeVer,
  insert_fcst,
  delete_fcst,
  loadxuatkhopo,
  checklastfcstweekno,
  fcstamount,
  kd_dailyclosing,
  kd_weeklyclosing,
  kd_monthlyclosing,
  kd_annuallyclosing,
  traPOSummaryTotal,
  customerRevenue,
  PICRevenue,
  dailyoverduedata,
  weeklyoverduedata,
  monthlyoverduedata,
  yearlyoverduedata,
  selectcustomerList,
  getDailyClosingKD,
  getWeeklyClosingKD,
  kd_pooverweek,
  kd_runningpobalance,
  loadMonthlyRevenueByCustomer,
  traPlanDataFull,
  checkPlanExist,
  insert_plan,
  delete_plan,
  traPOFullCMS_New,
  traPOFullCMS2,
  traPOFullKD_NEW,
  traPOFullKD2,
  loadbanggiamoinhat,
  loadlistcodequotation,
  getbomgia,
  loadDefaultDM,
  checkgiaExist,
  updategiasp,
  upgiasp,
  updateCurrentUnit,
  updateGiaVLBOM2,
  pheduyetgia,
  loadM100UpGia,
  dongbogiasptupo,
  loadbanggia,
  loadbanggia2,
  updategia,
  deletegia,
  checkShortageExist,
  insert_shortage,
  delete_shortage,
  traShortageKD,
  update_banve_value,
  insertData_Amazon_SuperFast,
  pheduyet_ycsx,
  setMaterial_YN,
  setpending_ycsx,
  setopen_ycsx,
  get_ycsxInfo2,
  get_cavityAmazon,
  traDataAMZ,
  check_inventorydate,
  checkMainMaterialFSC,
  ycsx_fullinfo,
  checkpobalance_tdycsx,
  checktonkho_tdycsx,
  insert_Notification_Data,
  checkPOExist,
  delete_invoice,
  selectcodeList,
  insert_invoice,
  traInvoiceDataFull,
  update_invoice,
  update_invoice_no,
  loadProdOverData, 
  updateProdOverData,
  tinh_hinh_kiemtra_G_CODE,
  updateTONTP_M100_CMS,
  updateBTP_M1002,
  updateTONKIEM_M100,
  checkcustomerpono,
  autopheduyetgiaall,
  delete_po,
  traPODataFull,
  update_po,
  checkYCSXQLSXPLAN,
  delete_ycsx,
  delete_P500_YCSX,
  delete_P501_YCSX,
  checkInLaiCount_AMZ,
  deleteAMZ_DATA,
  check_G_NAME_2Ver_active,
  checktrungAMZ_Full,
  checkfcst_tdycsx,
  checkYcsxExist,
  checkLastYCSX,
  checkProcessInNoP500,
  insertDBYCSX,
  insertDBYCSX_New,
  insert_p500,
  insert_p501,
  insert_ycsx,
  checkmainBOM2_M140_M_CODE_MATCHING,
  checkmainBOM2,
  checkIDCongViecAMZ,
  loadpono,
  getLastProcessLotNo,
  traYCSXDataFull,
  updateDMLOSSKT_ZTB_DM_HISTORY,
  update_ycsx,
  traFcstDataFull,
  baocaofcstss,
  customerpobalancebyprodtype_new,
  get_material_table,
  checkMaterialExist,
  addMaterial,
  updateMaterial,
  updateM090FSC,
  updateTDSStatus,
  selectVendorList,
  getFSCList,
  setMaterial_YN,
  loadMaterialByPO,
  loadMaterialByYCSX,
  loadMaterialMRPALL,
  loadMaterialByYCSX_ALL,
  autoUpdateDocUSEYN_EXP,
  getMaterialDocData,
  insertMaterialDocData,
  updateDtcApp,
  updateMaterialDocData,
  updatePurApp,
  updateRndApp,
  loadMRPPlan,
  load_Notification_Data,
  updatenndscs,
  updateCSImageStatus,
  updateCSDoiSachVNStatus,
  updateCSDoiSachKRStatus,
  tracsconfirm,
  tracsrma,
  tracsCNDB,
  tracsTAXI,
  csdailyconfirmdata,
  csweeklyconfirmdata,
  csmonthlyconfirmdata,
  csyearlyconfirmdata,
  csConfirmDataByCustomer,
  csConfirmDataByPIC,
  csdailyreduceamount,
  csweeklyreduceamount,
  csmonthlyreduceamount,
  csyearlyreduceamount,
  csdailyRMAAmount,
  csweeklyRMAAmount,
  csmonthlyRMAAmount,
  csyearlyRMAAmount,
  csdailyTaxiAmount,
  csmonthlyTaxiAmount,
  csweeklyTaxiAmount,
  csyearlyTaxiAmount,
  getMaterialList,
  checkSpecDTC,
  checkSpecDTC2,
  insertSpecDTC,
  updateSpecDTC,
  checkAddedSpec,
  loadrecentRegisteredDTCData,
  checkEMPL_NO_mobile,
  checkMNAMEfromLotI222,
  getLastDTCID,
  checkLabelID2,
  registerDTCTest,
  getinputdtcspec,
  checkRegisterdDTCTEST,
  insert_dtc_result,
  updateDTC_TEST_EMPL,
  loadXbarData,
  loadCPKTrend,
  loadHistogram,
  dtcdata,
  dtcspec,
  getpatrolheader,
  getInspectionWorstTable,
  inspect_daily_ppm,
  inspect_weekly_ppm,
  inspect_monthly_ppm,
  inspect_yearly_ppm,
  getInspectionSummary,
  dailyFcost,
  weeklyFcost,
  monthlyFcost,
  annuallyFcost,
  dailyDefectTrending,
  get_inspection,
  loadChoKiemGop_NEW,
  loadInspectionPatrol,
  resetStatus,
  getIns_Status,
  updateQCPASS_FAILING,
  updateIQCConfirm_FAILING,
  loadQCFailData,
  checkPLAN_ID,
  checkPQC3_IDfromPLAN_ID,
  checkMNAMEfromLot,
  insertFailingData,
  updateQCFailTableData,
  updateQCPASS_HOLDING,
  updateMaterialHoldingReason,
  traholdingmaterial,
  updateQCPASSI222,
  updateIQC1Table,
  loadIQC1table,
  checkMNAMEfromLotI222Total,
  insertIQC1table,
  update_ncr_image,
  loadNCRData,
  loadHoldingMaterialByNCR_ID,
  insertNCRData,
  selectCustomerAndVendorList,
  checklastAuditID,
  insertCheckSheetData,
  checkAuditNamebyCustomer,
  insertNewAuditInfo,
  auditlistcheck,
  loadAuditResultList,
  loadAuditResultCheckList,
  checkAuditResultCheckListExist,
  insertResultIDtoCheckList,
  createNewAudit,
  updateEvident,
  resetEvident,
  updatechecksheetResultRow,
  loadRNRchitiet,
  RnRtheonhanvien,
  traOQCData,
  ngbyCustomerOQC,
  ngbyProTypeOQC,
  dailyOQCTrendingData,
  weeklyOQCTrendingData,
  monthlyOQCTrendingData,
  yearlyOQCTrendingData,
  checkktdtc,
  loadDataSX,
  checkPlanIdChecksheet,
  checkPlanIdP501,
  checkProcessLotNo_Prod_Req_No,
  insert_pqc1,
  update_checksheet_image_status,
  pqcdailyppm,
  pqcweeklyppm,
  pqcmonthlyppm,
  pqcyearlyppm,
  getPQCSummary,
  dailyPQCDefectTrending,
  trapqc3data,
  trapqc1data,
  checkPROCESS_LOT_NO,
  updatepqc1sampleqty,
  loadErrTable,
  insert_pqc3,
  getlastestPQC3_ID,
  traCNDB,
  tradaofilm,
  updatenndspqc,
  loadDtcTestList,
  addTestItem,
  addTestPoint,
  loadDtcTestPointList,
  khkt_a_dung,
  temlotktraHistory,
  check_m_code_m140_main,
  isM_LOT_NO_in_IN_KHO_SX,
  check_m_lot_exist_p500,
  nhapkhoao,
  resetKhoSX_IQC1,
  resetKhoSX_IQC2,
  updateNCRIDForFailing,
  getInspectionWorstByCode,
  updateAmazonBOMCodeInfo,
  listAmazon,
  getBOMAMAZON,
  getBOMAMAZON_EMPTY,
  codeinfo,
  loadcodephoi,
  checkExistBOMAMAZON,
  insertAmazonBOM,
  updateAmazonBOM,
  checkGNAMEKDExist,
  update_appsheet_value,
  getMasterMaterialList,
  resetbanve,
  pdbanve,
  getbomsx,
  getbomgia,
  codeinforRnD,
  getcodefullinfo,
  getNextSEQ_G_CODE,
  insertM100BangTinhGia,
  updateM100BangTinhGia,
  insertM100,
  insertM100_AddVer,
  updateM100,
  deleteM140_2,
  checkGSEQ_M140,
  update_M140,
  insertM140,
  deleteM140,
  checkMaterialInfo,
  checkMassG_CODE,
  deleteBOM2,
  insertBOM2,
  checkTBGExist,
  getlastestCODKH,
  getAMAZON_DESIGN,
  deleteAMZDesign,
  insertAMZDesign,
  update_material_info,
  loadbarcodemanager,
  checkbarcodeExist,
  addBarcode,
  updateBarcode,
  deleteBarcode,
  loadquanlygiaonhan,
  addbangiaodaofilmtailieu,
  rnddailynewcode,
  rndweeklynewcode,
  rndmonthlynewcode,
  rndyearlynewcode,
  rndNewCodeByCustomer,
  rndNewCodeByProdType,
  loadSampleMonitorTable,
  lockSample,
  updateRND_SAMPLE_STATUS,
  updateSX_SAMPLE_STATUS,
  updateQC_SAMPLE_STATUS,
  updateMATERIAL_STATUS,
  updateAPPROVE_SAMPLE_STATUS,
  addMonitoringSample,
  updateProdProcessData,
  addProdProcessData,
  deleteProcessNotInCurrentListFromDataBase,
  deleteProdProcessData,
  getmachinelist,
  loadProdProcessData,
  saveLOSS_SETTING_SX,
  saveQLSX,
  setngoaiquan,
  updateBEP,
  updateLossKT,
  loadtiledat,
  getdatadinhmuc_G_CODE,
  ycsxbalanceleadtimedata,
  checkEQ_STATUS,
  diemdanhallbp,
  capabydeliveryplan,
  machinecounting,
  ycsxbalancecapa,
  getSXCapaData,
  getchithidatatable,
  checkP500M_CODE,
  check_lieuql_sx_m140,
  checkPLANID_OUT_KHO_AO,
  deletePlanQLSX,
  checkQLSXPLANSTATUS,
  getLastestPLAN_ID,
  getLastestPLANORDER,
  checkProd_request_no_Exist_O302,
  addPlanQLSX,
  quickcheckycsx,
  traYCSXDataFull_QLSX,
  quickcheckycsx_New,
  getProductionPlanCapaData,
  loadDefectProcessData,
  lichsuinputlieusanxuat_full,
  lichsunhapkhoao,
  loadDataSX_YCSX,
  updateBTP_P400,
  updatetonkiemP400,
  tinhhinhycsxtheongay,
  addMachine,
  deleteMachine,
  toggleMachineActiveStatus,
  loadLeadtimeData,
  an_lieu_kho_ao,
  checktonKhoAoMLotNo,
  checkFSC_PLAN_ID,
  checkYcsxStatus,
  checkTonTaiXuatKhoAo,
  delete_in_kho_ao,
  delete_out_kho_ao,
  check_2_m_code_in_kho_ao,
  checkM_CODE_CHITHI,
  checkNextPlanClosed,
  checktonlieutrongxuong,
  lichsuxuatkhoao,
  setUSE_YN_KHO_AO_INPUT,
  xuatkhoao,
  checktonKhoSubMLotNo,
  lichsunhapkhosub,
  checktonlieutrongxuong_sub,
  setUSE_YN_KHO_SUB_INPUT,
  deleteLongtermPlan,
  insertKHSXDAIHAN,
  loadKHSXDAIHAN,
  moveKHSXDAIHAN,
  checkplansetting,
  move_plan,
  getP4002,
  check_PLAN_ID_OUT_KNIFE_FILM,
  insert_OUT_KNIFE_FILM,
  check_PLAN_ID_KHO_AO,
  checkPLANID_O300,
  checkPLANID_O301,
  getO300_LAST_OUT_NO,
  getP400,
  insertO300,
  getO300_ROW,
  deleteM_CODE_O301,
  checkM_CODE_PLAN_ID_Exist_in_O301,
  insertO301,
  updatePlanQLSX,
  updatePlanOrder,
  getqlsxplan2,
  getqlsxplan2_New,
  deleteMCODEExistIN_O302,
  updateLIEUQL_SX_M140,
  deleteM_CODE_ZTB_QLSXCHITHI,
  updateChiThi,
  insertChiThi,
  traYCSXDataFull_QLSX_New,
  updateDKXLPLAN,
  updateXUATLIEUCHINH_PLAN,
  update_XUAT_DAO_FILM_PLAN,
  updateO301,
  checkPLANID_O302,
  neededSXQtyByYCSX,
  getSystemDateTime,
  deleteDMYCSX,
  deleteDMYCSX2,
  checkTonTaiXuatKhoSub,
  nhapkhosubao,
  tralichsutemlotsx,
  updateNCRIDForHolding,
  loadDMSX,
  updateO301_OUT_CFM_QTY_FROM_O302,
  updateUSE_YN_I222_RETURN_NVL,
  insert_O302,
  updateStockM090,
  checkDocVersion,
  addProdProcessDataQLSX,
  updateProdProcessDataQLSX,
  checkProcessExist,
  isM_LOT_NO_in_O302,
  check_G_NAME_2Ver_active,
  getI221Lastest_IN_NO,
  getI222Lastest_M_LOT_NO,
  insert_I221,
  insert_I222,
  loadBTPAuto2,
  loadBTPSummaryAuto2,
  getDepartmentList,
  updateKHSXDAIHAN,
  deleteNotExistKHSXDAIHAN,
  loadPostAll,
  loadPost,
  updatePost,
  deletePost,
  cancelProductionLot,
  traDataPlanLossSX,
  datasxdailylosstrend,
  datasxweeklylosstrend,
  datasxmonthlylosstrend,
  datasxyearlylosstrend,
  dailyEQEffTrending,
  weeklyEQEffTrending,
  monthlyEQEffTrending,
  yearlyEQEffTrending,
  sxdailyachivementtrending,
  sxweeklyachivementtrending,
  sxmonthlyachivementtrending,
  sxyearlyachivementtrending,
  sxLossTimeByReason,
  sxLossTimeByEmpl,
  loadBaoCaoTheoRoll,
  trasxlosstrendingdata,
  dailysxlosstrend,
  weeklysxlosstrend,
  monthlysxlosstrend,
  yearlysxlosstrend,
  loadquanlydaofilm,
  lichsuxuatdaofilm,
  trainspectionpatrol,
  machinecounting2,
  dailysxdata,
  sxweeklytrenddata,
  sxmonthlytrenddata,
  machineTimeEfficiency,
  sxachivementdata,
  tinhhinhchotbaocaosx,
  materialLotStatus,
  tranhaplieu,
  traxuatlieu,
  tratonlieu,
  updatelieuncc,
  checkMNAMEfromLotI222XuatKho,
  checksolanout_O302,
  xuatpackkhotp,
  trakhotpInOut,
  traSTOCKCMS_NEW,
  traSTOCKCMS,
  traSTOCKKD_NEW,
  traSTOCKKD,
  traSTOCKTACH,
  loadKTP_IN,
  loadKTP_OUT,
  loadStockFull,
  loadSTOCKG_CODE,
  loadSTOCKG_NAME_KD,
  loadSTOCK_YCSX,
  cancelPheDuyetHuyO660,
  updatechamcongdiemdanhauto,
  getlastestPostId,
  insert_information,
  loadWebSetting,
  update_file_name,
  get_file_list,
  delete_file,
  checkdiemdanh,
  POBalanceByCustomer,
  changepassword,
  setWebVer
};

exports.processApi = async (req, res) => {
  const qr = req.body;
  const { command, DATA } = qr;
  console.log(moment().format('YYYY-MM-DD HH:mm:ss'),command);

  // Kiểm tra command có tồn tại không
  const handler = commandHandlers[command];
  if (!handler) {
    return res.send({ tk_status: "NG", message: `Command '${command}' not supported` });
  }
  try {
    // Gọi hàm xử lý tương ứng
    await handler(req, res, DATA);
  } catch (error) {
    console.error(`Error processing ${command}:`, error);
    res.send({ tk_status: "ng", message: "Internal server error" });
  }
};