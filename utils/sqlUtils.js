const moment = require("moment");

exports.removeVietnameseTones=(str) => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system encode vietnamese combining accent as individual utf-8 characters
  // Một vài bộ encode coi các dấu mũ, dấu chữ như một kí tự riêng biệt nên thêm hai dòng này
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  // Remove extra spaces
  // Bỏ các khoảng trắng liền nhau
  str = str.replace(/ + /g, " ");
  str = str.trim();
  // Remove punctuations
  // Bỏ dấu câu, kí tự đặc biệt
  str = str.replace(
    /!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g,
    " "
  );
  return str;
}
exports.generate_condition_get_invoice = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $po_no,
  $material,
  $invoice_no,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBDelivery.CTR_CD = '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND ZTBDelivery.DELIVERY_DATE BETWEEN '" +
      $start_date +
      "' AND  '" +
      $end_date +
      "' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($po_no != "") {
    $po_no = " AND ZTBPOTable.PO_NO =  '" + $po_no + "'";
  }
  if ($material != "") {
    $material = " AND M100.PROD_MAIN_MATERIAL LIKE  '%" + $material + "%'";
  }
  if ($invoice_no != "") {
    $invoice_no = " AND ZTBDelivery.INVOICE_NO = '" + $invoice_no + "'";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $po_no +
    $material +
    $invoice_no;
  return $condition;
}
exports.generate_condition_get_plan = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $material,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBPLANTB.CTR_CD= '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND ZTBPLANTB.PLAN_DATE BETWEEN '" +
      $start_date +
      "' AND  '" +
      $end_date +
      "' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($material != "") {
    $material = " AND M100.PROD_MAIN_MATERIAL LIKE  '%" + $material + "%'";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $material;
  return $condition;
}
exports.generate_condition_get_fcst = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $material,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBFCSTTB.CTR_CD= '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    const start_weeknum = moment($start_date, "YYYY-MM-DD")
      .add(1, "day")
      .isoWeek();
    const end_weeknum = moment($end_date, "YYYY-MM-DD").add(1, "day").isoWeek();
    const yearnum = moment($start_date, "YYYY-MM-DD").add(1, "day").year();
    $inspect_time_checkvalue =
      " AND ZTBFCSTTB.FCSTWEEKNO BETWEEN '" +
      start_weeknum +
      "' AND  '" +
      end_weeknum +
      "' AND ZTBFCSTTB.FCSTYEAR = " +
      yearnum;
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($material != "") {
    $material = " AND M100.PROD_MAIN_MATERIAL LIKE  '%" + $material + "%'";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $material;
  return $condition;
}
exports.generate_condition_get_po = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $po_no,
  $over,
  $id,
  $material,
  $justPoBalance,
  $ctr_cd
)=> {
  let $condition = " WHERE ZTBPOTable.CTR_CD='" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND ZTBPOTable.PO_DATE BETWEEN '" +
      $start_date +
      "' AND  '" +
      $end_date +
      "' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($po_no != "") {
    $po_no = " AND ZTBPOTable.PO_NO =  '" + $po_no + "'";
  }
  if ($over != "") {
    $over = "";
  }
  if ($id != "") {
    $id = "AND ZTBPOTable.PO_ID=" + $id;
  }
  if ($material != "") {
    $material = "AND M100.PROD_MAIN_MATERIAL LIKE '%" + $material + "%' ";
  }
  if ($justPoBalance != false) {
    //$justPoBalance = "AND (ZTBPOTable.PO_QTY - AA.TotalDelivered) <>0";
    $justPoBalance = "AND POTB.PO_BALANCE <>0";
  } else {
    $justPoBalance = "";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $po_no +
    $over +
    $material +
    $justPoBalance +
    $id;
  return $condition;
}
exports.generate_condition_get_ycsx = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $phan_loai,
  $ycsxpending,
  $prod_request_no,
  $material,
  $inspect_input,
  $phanloaihang,
  $ctr_cd,
  $material_yes
)=> {
  console.log('material yes :::: ', $material_yes)
  let $condition = ` WHERE P400.CTR_CD= '${$ctr_cd}' `;
  let $temp_start_date = moment($start_date).format("YYYYMMDD");
  let $temp_end_date = moment($end_date).format("YYYYMMDD");
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND P400.PROD_REQUEST_DATE BETWEEN '" +
      $temp_start_date +
      "' AND  '" +
      $temp_end_date +
      "' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($prod_request_no != "") {
    $prod_request_no = "AND P400.PROD_REQUEST_NO='" + $prod_request_no + "'";
  }
  if ($material != "") {
    $material = "AND M100.PROD_MAIN_MATERIAL LIKE '%" + $material + "%' ";
  }
  if ($inspect_input != false) {
    $inspect_input = " AND LOT_TOTAL_INPUT_QTY_EA<>0 ";
  } else {
    $inspect_input = "";
  }
  if ($ycsxpending !== false) {
    $ycsxpending = ` AND NOT (P400.YCSX_PENDING =0 OR isnull(INSPECT_OUTPUT_TB.LOT_TOTAL_OUTPUT_QTY_EA, 0) >= P400.PROD_REQUEST_QTY OR M100.USE_YN='N') `;
  } else {
    $ycsxpending = "";
  }
  if ($phan_loai !== "") {
    if ($phan_loai !== "00") {
      if ($phan_loai == "22") {
        $phan_loai = ` AND P400.CODE_55<> '04' `;
      } else {
        $phan_loai = ` AND P400.CODE_55= '${$phan_loai}' `;
      }
    } else {
      $phan_loai = "";
    }
  }
  if ($phanloaihang !== 'ALL' && $phanloaihang !== undefined) {
    $phanloaihang = ` AND P400.PL_HANG='${$phanloaihang}'`;
  }
  else {
    $phanloaihang = '';
  }
  console.log('material_yes', $material_yes)
  if ($material_yes) {
    $material_yes = ` AND P400.MATERIAL_YN='Y' `;
  }
  else {
    $material_yes = '';
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $material +
    $inspect_input +
    $phan_loai +
    $prod_request_no +
    $ycsxpending +
    $phanloaihang +
    $material_yes;
  console.log($condition)
  return $condition;
}
exports.generate_condition_get_inspection_input = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBINSPECTINPUTTB.CTR_CD= '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND ZTBINSPECTINPUTTB.INPUT_DATETIME BETWEEN '" +
      $start_date +
      " 00:00:00' AND  '" +
      $end_date +
      " 23:59:59' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no = " AND P400.PROD_REQUEST_NO =  '" + $ycsx_no + "'";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $ycsx_no;
  return $condition;
}
exports.generate_condition_get_inspection_output = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBINSPECTOUTPUTTB.CTR_CD='" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND ZTBINSPECTOUTPUTTB.OUTPUT_DATETIME BETWEEN '" +
      $start_date +
      " 00:00:00' AND  '" +
      $end_date +
      " 23:59:59' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no = " AND P400.PROD_REQUEST_NO =  '" + $ycsx_no + "'";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $ycsx_no;
  return $condition;
}
exports.generate_condition_get_inspection_inoutycsx = (
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no,
  $ctr_cd
)=> {
  let $condition = "WHERE INPUTTB.CTR_CD= '" + $ctr_cd + "' ";
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no = " AND P400.PROD_REQUEST_NO =  '" + $ycsx_no + "'";
  }
  $condition =
    $condition +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $ycsx_no;
  return $condition;
}
exports.generate_condition_get_inspection_ng_data = (
  $inspect_time_checkvalue,
  $fromdate,
  $todate,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBINSPECTNGTB.CTR_CD= '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND ZTBINSPECTNGTB.INSPECT_DATETIME BETWEEN '" +
      $fromdate +
      " 00:00:00' AND  '" +
      $todate +
      " 23:59:59' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($product_type != "") {
    $product_type = " AND M100.PROD_TYPE=  '" + $product_type + "'";
  }
  if ($empl_name != "") {
    $empl_name = " AND M010.EMPL_NAME LIKE  '%" + $empl_name + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no = " AND ZTBINSPECTNGTB.PROD_REQUEST_NO =  '" + $ycsx_no + "'";
  }
  $condition +=
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $ycsx_no;
  return $condition;
}
exports.generate_condition_get_dtc_data = (
  $inspect_time_checkvalue,
  $fromdate,
  $todate,
  $input_code_cms,
  $input_code_KD,
  $ycsx_no,
  $m_name,
  $m_code,
  $test_name,
  $test_type,
  $id,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTB_REL_REQUESTTABLE.CTR_CD= '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue === false) {
    $inspect_time_checkvalue =
      " AND ZTB_REL_REQUESTTABLE.TEST_FINISH_TIME BETWEEN '" +
      $fromdate +
      " 00:00:00' AND  '" +
      $todate +
      " 23:59:59' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no =
      " AND ZTB_REL_REQUESTTABLE.PROD_REQUEST_NO =  '" + $ycsx_no + "'";
  }
  if ($id != "") {
    $id = " AND ZTB_REL_REQUESTTABLE.DTC_ID =  '" + $id + "'";
  }
  if ($m_code != "") {
    $m_code = " AND M090.M_CODE =  '" + $m_code + "'";
  }
  if ($m_name != "") {
    $m_name = " AND M090.M_NAME LIKE  '%" + $m_name + "%'";
  }
  if ($test_name !== "0") {
    $test_name = " AND ZTB_REL_RESULT.TEST_CODE ='" + $test_name + "'";
  } else {
    $test_name = "";
  }
  if ($test_type !== "0") {
    $test_type = " AND ZTB_REL_TESTTYPE.TEST_TYPE_CODE ='" + $test_type + "'";
  } else {
    $test_type = "";
  }
  $condition +=
    $inspect_time_checkvalue +
    $input_code_cms +
    $input_code_KD +
    $ycsx_no +
    $m_name +
    $m_code +
    $test_name +
    $test_type +
    $id;
  return $condition;
}
exports.generate_condition_pqc1 = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $ycsx_no,
  $process_lot_no,
  $inspec_ID,
  $inspect_factory,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBPQC1TABLE.CTR_CD= '" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND SETTING_OK_TIME BETWEEN '" +
      $start_date +
      " 00:00:00' AND  '" +
      $end_date +
      " 23:59:59' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no = " AND P400.PROD_REQUEST_NO = '" + $ycsx_no + "'";
  }
  if ($process_lot_no != "") {
    $process_lot_no =
      " AND ZTBPQC1TABLE.PROCESS_LOT_NO = '" + $process_lot_no + "'";
  }
  if ($inspec_ID != "") {
    $inspec_ID = " AND ZTBPQC1TABLE.PQC1_ID = '" + $inspec_ID + "'";
  }
  if ($inspect_factory != "All") {
    $inspect_factory = " AND ZTBPQC1TABLE.FACTORY = '" + $inspect_factory + "'";
  } else {
    $inspect_factory = "";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $ycsx_no +
    $process_lot_no +
    $inspec_ID +
    $inspect_factory;
  return $condition;
}
exports.generate_condition_pqc3 = (
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $ycsx_no,
  $process_lot_no,
  $inspec_ID,
  $inspect_factory,
  $ctr_cd
)=> {
  let $condition = "WHERE ZTBPQC3TABLE.CTR_CD ='" + $ctr_cd + "' ";
  if ($inspect_time_checkvalue == false) {
    $inspect_time_checkvalue =
      " AND OCCURR_TIME BETWEEN '" +
      $start_date +
      " 00:00:00' AND  '" +
      $end_date +
      " 23:59:59' ";
  } else {
    $inspect_time_checkvalue = "";
  }
  if ($input_cust_name != "") {
    $input_cust_name =
      " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
  }
  if ($input_code_cms != "") {
    $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
  }
  if ($input_code_KD != "") {
    $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
  }
  if ($ycsx_no != "") {
    $ycsx_no = " AND ZTBPQC3TABLE.PROD_REQUEST_NO = '" + $ycsx_no + "'";
  }
  if ($process_lot_no != "") {
    $process_lot_no =
      " AND ZTBPQC3TABLE.PROCESS_LOT_NO = '" + $process_lot_no + "'";
  }
  if ($inspec_ID != "") {
    $inspec_ID = " AND ZTBPQC3TABLE.PQC3_ID = '" + $inspec_ID + "'";
  }
  if ($inspect_factory != "All") {
    $inspect_factory = " AND ZTBPQC1TABLE.FACTORY = '" + $inspect_factory + "'";
  } else {
    $inspect_factory = "";
  }
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $ycsx_no +
    $process_lot_no +
    $inspec_ID +
    $inspect_factory;
  return $condition;
}