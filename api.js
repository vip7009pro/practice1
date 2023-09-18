var sql = require("mssql");
var jwt = require("jsonwebtoken");
const moment = require("moment");
const { existsSync } = require("fs");
require("dotenv").config();
///s
function removeVietnameseTones(str) {
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
function generate_condition_get_invoice(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $po_no,
  $material
) {
  $condition = "WHERE 1=1 ";
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
  $condition =
    $condition +
    $inspect_time_checkvalue +
    $input_cust_name +
    $input_code_cms +
    $input_code_KD +
    $product_type +
    $empl_name +
    $po_no +
    $material;
  return $condition;
}
function generate_condition_get_plan(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $material
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_get_fcst(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $material
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_get_po(
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
  $justPoBalance
) {
  $condition = " WHERE 1=1 ";
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
    $over =
      "AND (CASE WHEN (ZTBPOTable.RD_DATE < GETDATE()-1) AND ((ZTBPOTable.PO_QTY-AA.TotalDelivered) <>0) THEN 'OVER' ELSE 'OK' END) LIKE '%" +
      $over +
      "%' ";
  }
  if ($id != "") {
    $id = "AND PO_ID=" + $id;
  }
  if ($material != "") {
    $material = "AND M100.PROD_MAIN_MATERIAL LIKE '%" + $material + "%' ";
  }
  if ($justPoBalance != false) {
    $justPoBalance = "AND (ZTBPOTable.PO_QTY - AA.TotalDelivered) <>0";
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
function generate_condition_get_ycsx(
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
  $inspect_input
) {
  $condition = " WHERE 1=1 ";
  $temp_start_date = moment($start_date).format("YYYYMMDD");
  $temp_end_date = moment($end_date).format("YYYYMMDD");
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
    $ycsxpending = ` AND NOT (P400.YCSX_PENDING =0 OR isnull(INSPECT_BALANCE_TB.LOT_TOTAL_OUTPUT_QTY_EA, 0) >= P400.PROD_REQUEST_QTY) `;
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
    $ycsxpending;
  return $condition;
}
function generate_condition_get_inspection_input(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_get_inspection_output(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_get_inspection_inoutycsx(
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_get_inspection_ng_data(
  $inspect_time_checkvalue,
  $fromdate,
  $todate,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $product_type,
  $empl_name,
  $ycsx_no
) {
  $condition = "WHERE 1=1 ";
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
    $ycsx_no = " AND P400.PROD_REQUEST_NO =  '" + $ycsx_no + "'";
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
function generate_condition_get_dtc_data(
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
  $id
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_pqc1(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $ycsx_no,
  $process_lot_no,
  $inspec_ID,
  $inspect_factory
) {
  $condition = "WHERE 1=1 ";
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
function generate_condition_pqc3(
  $inspect_time_checkvalue,
  $start_date,
  $end_date,
  $input_cust_name,
  $input_code_cms,
  $input_code_KD,
  $ycsx_no,
  $process_lot_no,
  $inspec_ID,
  $inspect_factory
) {
  $condition = "WHERE 1=1 ";
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
function returnDateFormat(today) {
  let year = today.getFullYear();
  let month = today.getMonth();
  let date = today.getDate();
  if (month + 1 < 10) month = "0" + (month + 1);
  if (date < 10) date = "0" + date;
  return year + "-" + month + "-" + date;
}
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  /*  port: 5005, */
  port: parseInt(process.env.DB_PORT),
  trustServerCertificate: true,
  requestTimeout: 300000,
};
function isNumber(str) {
  return /^[0-9]+$/.test(str) && str.length == 4;
}
function asyncQuery2(queryString) {
  return new Promise((resolve, reject) => {
    sql.connect(config, (err) => {
      if (err) console.log(err);
      let sqlRequest = new sql.Request();
      sqlRequest.query(queryString, function (err, data) {
        if (err) {
          //console.log("co loi tron async " + err + ' ');
          return reject(err + " ");
        }
        return resolve("OK");
      });
    });
  }).catch((err) => {
    //console.log("Loi dc catch 2: " + err + ' ');
  });
}
function asyncQuery(queryString) {
  return new Promise((resolve, reject) => {
    sql.connect(config, (err) => {
      if (err) console.log(err);
      let sqlRequest = new sql.Request();
      sqlRequest.query(queryString, function (err, data) {
        if (err) {
          //console.log(err);
          return reject(err);
        }
        var rs = data.recordset;
        if (rs.hasOwnProperty("length")) {
          // //console.log("co property");
        } else {
          //  //console.log("khong co property");
        }
        ////console.log('length of dataset: ' + rs.length);
        let kk;
        if (rs.length != 0) {
          kk = JSON.stringify(rs);
          resolve(kk);
        } else {
          resolve(0);
        }
      });
    });
  }).catch((err) => {
    //console.log("Loi dc catch: " + err + ' ');
  });
}
const queryDB = async (query) => {
  let kq = "";
  try {
    await sql.connect(config);
    const result = await sql.query(query);
    if (result.rowsAffected[0] > 0) {
      if (result.recordset) {
        kq = { tk_status: "OK", data: result.recordset };
      } else {
        kq = { tk_status: "OK", message: "Modify data thanh cong" };
      }
    } else {
      kq = { tk_status: "NG", message: "Không có dòng dữ liệu nào" };
    }
  } catch (err) {
    ////console.log(err);
    kq = { tk_status: "NG", message: err + " " };
  }
  return kq;
};
exports.checklogin_index = function (req, res, next) {
  ////console.log("bam login ma cung loi?");
  try {
    ////console.log("token client la: " + req.cookies.token);
    var token = req.cookies.token;
    //console.log('token= ' + token);
    //console.log('body', req);
    if (token === undefined)
      token =
        req.body.DATA.token_string === undefined
          ? req.body.token_string
          : req.body.DATA.token_string;
    //console.log('req', req);
    var decoded = jwt.verify(token, "nguyenvanhung");
    //console.log(decoded);
    //console.log(decoded["exp"]);
    let payload_json = JSON.parse(decoded["payload"]);
    //console.log(payload_json);
    //console.log(payload_json[0]);
    ////console.log('Cookie client = ' + req.cookies.token);
    req.payload_data = payload_json[0];
    ////console.log(payload_json);
    if (payload_json[0]["WORK_STATUS_CODE"] === 0) {
      req.coloiko = "coloi";
    } else {
      req.coloiko = "kocoloi";
    }
    next();
  } catch (err) {
    console.log("Loi check login index = " + err + " ");
    req.coloiko = "coloi";
    next();
  }
};
exports.checklogin_login = function (req, res, next) {
  try {
    console.log("token client la: " + req.cookies.token);
    var token = req.cookies.token;
    var decoded = jwt.verify(token, "nguyenvanhung");
    console.log("token= " + token);
    let payload_json = JSON.parse(decoded["payload"]);
    ////console.log(payload_json[0]);
    ////console.log('Cookie client = ' + req.cookies.token);
    req.payload_data = payload_json[0];
    //console.log("Di qua check login-login");
    res.redirect("/");
    next();
  } catch (err) {
    //console.log('Chua dang nhap nen fai ve day ' + err + ' ');
    next();
  }
};
exports.process_api = function (req, res) {
  ////console.log(req.files.file);
  //let nhanvien = req.payload_data['EMPL_NO'];
  var qr = req.body;
  let rightnow = new Date().toLocaleString();
  /*  if(req.payload_data['EMPL_NO']!== undefined) console.log(req.payload_data['EMPL_NO']); */
  console.log(moment().format("YYYY-MM-DD HH:mm:ss") + ":" + qr["command"]);
  let DATA = qr["DATA"];
  if (
    1 /* qr["command"] ==='login' || req.payload_data["EMPL_NO"]==='NHU1903' */
  ) {
    switch (qr["command"]) {
      case "check_chua_pd":
        s(async () => {
          var today = new Date();
          var today_format = moment().format("YYYY-MM-DD");
          //console.log(today_format);
          let kqua;
          let query =
            "SELECT COUNT(EMPL_NO) AS CPD FROM ZTBOFFREGISTRATIONTB WHERE APPLY_DATE = '" +
            today_format +
            "' AND APPROVAL_STATUS  =2";
          kqua = await asyncQuery(query);
          let chuapdqty = JSON.parse(kqua)[0]["CPD"];
          //console.log(chuapdqty);
          res.send(chuapdqty + "");
        })();
        break;
      case "login2":
        try {
          let DATA = qr["DATA"];
          let username = DATA.user;
          let password = DATA.pass;
          var loginResult = false;
          (async () => {
            let kqua;
            let query =
              "SELECT ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) WHERE ZTBEMPLINFO.EMPL_NO = '" +
              username +
              "' AND PASSWORD = '" +
              password +
              "'";
            kqua = await asyncQuery(query);
            ////console.log(kqua);
            loginResult = kqua;
            //console.log("KET QUA LOGIN = " + loginResult);
            if (loginResult != 0) {
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
              res.send({ tk_status: "ng", token_content: token });
              //console.log('login that bai');
            }
          })();
        } catch (err) {
          //console.log("Loi day neh: " + err + ' ');
        }
        break;
      case "login3":
        try {
          (async () => {
            let kqua;
            let query =
              "SELECT ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) ";
            kqua = await asyncQuery(query);
            ////console.log(kqua);
            loginResult = kqua;
            //console.log("KET QUA LOGIN = " + loginResult);
            if (loginResult != 0) {
              var token = jwt.sign({ payload: loginResult }, "nguyenvanhung", {
                expiresIn: 3600 * 100000,
              });
              res.cookie("token", token);
              ////console.log(token);
              //res.send({ tk_status: "ok", token_content: token, user_data: loginResult });
              //console.log('login thanh cong');
              res.send(kqua);
            } else {
              res.send(kqua);
              //res.send({ tk_status: "ng", token_content: token });
              //console.log('login that bai');
            }
          })();
        } catch (err) {
          //console.log("Loi day neh: " + err + ' ');
        }
        break;
      case "login":
        //console.log("post request from login page !");
        //console.log('USER = ' + qr['user']);
        //console.log('PASS = ' + qr['pass']);
        try {
          (async () => {
            let username = qr["user"];
            let password = qr["pass"];
            let kqua;
            let query =
              "SELECT ZTBEMPLINFO.EMPL_IMAGE,ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) WHERE ZTBEMPLINFO.EMPL_NO = '" +
              username +
              "' AND PASSWORD = '" +
              password +
              "'";
            kqua = await asyncQuery(query);
            //console.log('kqua',kqua);
            loginResult = kqua;
            //console.log("KET QUA LOGIN = " + loginResult);

            if (loginResult != 0) {
              var token = jwt.sign({ payload: loginResult }, "nguyenvanhung", {
                expiresIn: 3600 * 24 * 1,
              });
              res.cookie("token", token);
              ////console.log(token);
              res.send({
                tk_status: "ok",
                token_content: token,
                userData: loginResult,
              });
              //console.log('login thanh cong');
            } else {
              res.send({ tk_status: "ng", token_content: token });
              //console.log('login that bai');
            }
          })();
        } catch (err) {
          //console.log("Loi day neh: " + err + ' ');
        }
        break;
      case "logout":
        res.cookie("token", "reset");
        res.send("loged out");
        break;
      case "att_refresh":
        try {
          (async () => {
            let kqua;
            var todayDate = new Date().toISOString().slice(0, 10);
            //console.log(todayDate);
            let sql_team1_total =
              "SELECT COUNT(EMPL_NO) AS TOTAL_TEAM1 FROM ZTBEMPLINFO WHERE WORK_SHIFT_CODE = 1 AND WORK_STATUS_CODE <> 2 AND WORK_STATUS_CODE <> 0";
            let sql_team1_att =
              "SELECT COUNT(ZTBATTENDANCETB.EMPL_NO) AS ATT_TEAM1 FROM ZTBATTENDANCETB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) WHERE ZTBATTENDANCETB.APPLY_DATE = '" +
              todayDate +
              "' AND ZTBEMPLINFO.WORK_SHIFT_CODE = 1";
            let sql_team2_total =
              "SELECT COUNT(EMPL_NO) AS TOTAL_TEAM2 FROM ZTBEMPLINFO WHERE WORK_SHIFT_CODE = 2 AND WORK_STATUS_CODE <> 2 AND WORK_STATUS_CODE <> 0";
            let sql_team2_att =
              "SELECT COUNT(ZTBATTENDANCETB.EMPL_NO) AS ATT_TEAM2 FROM ZTBATTENDANCETB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) WHERE ZTBATTENDANCETB.APPLY_DATE = '" +
              todayDate +
              "' AND ZTBEMPLINFO.WORK_SHIFT_CODE = 2";
            let sql_team_HC_total =
              "SELECT COUNT(EMPL_NO) AS TOTAL_TEAM_HC FROM ZTBEMPLINFO WHERE WORK_SHIFT_CODE = 0 AND WORK_STATUS_CODE <> 2 AND WORK_STATUS_CODE <> 0";
            let sql_team_HC_att =
              "SELECT COUNT(ZTBATTENDANCETB.EMPL_NO) AS ATT_TEAM_HC FROM ZTBATTENDANCETB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) WHERE ZTBATTENDANCETB.APPLY_DATE = '" +
              todayDate +
              "' AND ZTBEMPLINFO.WORK_SHIFT_CODE = 0";
            let sql_chua_phe_duyet =
              "SELECT COUNT(EMPL_NO) AS CPD FROM ZTBOFFREGISTRATIONTB WHERE APPLY_DATE = '" +
              todayDate +
              "' AND APPROVAL_STATUS  =2";
            let sql_online_datetime =
              "UPDATE ZTBEMPLINFO SET ONLINE_DATETIME=GETDATE() WHERE EMPL_NO='" +
              req.payload_data["EMPL_NO"] +
              "'";
            let sql_online_person =
              "SELECT * FROM (SELECT  EMPL_NO, ZTBEMPLINFO.FIRST_NAME,  DATEDIFF(day,  ONLINE_DATETIME, GETDATE()) AS DD FROM ZTBEMPLINFO) AS AA  WHERE AA.DD <=1";
            let team1_total = asyncQuery(sql_team1_total);
            let team1_att = asyncQuery(sql_team1_att);
            let team2_total = asyncQuery(sql_team2_total);
            let team2_att = asyncQuery(sql_team2_att);
            let HC_total = asyncQuery(sql_team_HC_total);
            let HC_att = asyncQuery(sql_team_HC_att);
            let online_person = asyncQuery(sql_online_person);
            let checkchuapheduyet = asyncQuery(sql_chua_phe_duyet);
            let online_update = asyncQuery2(sql_online_datetime);
            let final_rs;
            Promise.all([
              team1_total,
              team1_att,
              team2_total,
              team2_att,
              HC_total,
              HC_att,
              online_person,
            ])
              .then((values) => {
                let total_array = [].concat.apply([], values);
                ////console.log(total_array);
                final_array = values.map((value) => {
                  return JSON.parse(value)[0];
                });
                final_array.pop();
                final_array.push(JSON.parse(values[6]));
                ////console.log(final_array);
                let result_a = final_array;
                let team1info =
                  "Điểm danh team 1: " +
                  result_a[1]["ATT_TEAM1"] +
                  "/" +
                  result_a[0]["TOTAL_TEAM1"] +
                  "\n";
                let team2info =
                  "Điểm danh team 2: " +
                  result_a[3]["ATT_TEAM2"] +
                  "/" +
                  result_a[2]["TOTAL_TEAM2"] +
                  "\n";
                let teamHCinfo =
                  "Điểm danh team HC: " +
                  result_a[5]["ATT_TEAM_HC"] +
                  "/" +
                  result_a[4]["TOTAL_TEAM_HC"] +
                  "\n";
                let total_att =
                  result_a[1]["ATT_TEAM1"] +
                  result_a[3]["ATT_TEAM2"] +
                  result_a[5]["ATT_TEAM_HC"];
                let total_empl =
                  result_a[0]["TOTAL_TEAM1"] +
                  result_a[2]["TOTAL_TEAM2"] +
                  result_a[4]["TOTAL_TEAM_HC"];
                let totalInfo =
                  "Tổng điểm danh: " + total_att + "/" + total_empl;
                let onlineInfo = "Người Online: ";
                var pp = result_a[6].map((element) => {
                  onlineInfo += element["FIRST_NAME"] + ", ";
                });
                var htmlcontent = `
                                <h5>Thông tin điểm danh</h5>
                                <ul align="left" style=" background-color: rgba(255, 255, 255,0.2);">
                                <li style="color: blue;"> ${team1info} </li>
                                <li style="color: yellow;"> ${team2info} </li>
                                <li style="color: #F3822E;"> ${teamHCinfo} </li>
                                <li style="color: #63F614;"><b> ${totalInfo} </b></li>
                                <li style="color: white;"> ${onlineInfo} </li>                        
                                </ul>
                            `;
                res.send({ tk_status: "ok", htmldata: htmlcontent });
              })
              .catch((err) => {
                //console.log("loi promise roi " + err + ' ');
              });
          })();
        } catch (err) {
          //console.log(err + '');
          res.send("loi roi");
        }
        break;
      case "dangkynghi":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_DATE = qr["ngaybatdau"];
          let END_DATE = qr["ngayketthuc"];
          let REASON_NAME = qr["reason_name"];
          let REMARK_CONTENT = qr["remark_content"];
          let CANGHI = qr["canghi"];
          var from = new Date(START_DATE);
          var to = new Date(END_DATE);
          var today = new Date();
          var today_format = moment().format("YYYY-MM-DD");
          let $reason_array = {
            "Nghỉ phép": "1",
            "Nửa phép": "2",
            "Việc riêng": "3",
            "Nghỉ ốm": "4",
            "Chế độ": "5",
            "Không lý do": "6",
          };
          let checkkq = "OK";
          if (CANGHI == "Ca ngày") {
            for (var day = from; day <= to; day.setDate(day.getDate() + 1)) {
              let apply_date = returnDateFormat(day);
              let query =
                "INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','" +
                EMPL_NO +
                "','" +
                today_format +
                "','" +
                apply_date +
                "'," +
                $reason_array[REASON_NAME] +
                ",N'" +
                REMARK_CONTENT +
                "',2,1)";
              kqua = await asyncQuery2(query);
              if (kqua != "OK") checkkq = "NG";
            }
            res.send(checkkq);
          } else {
            //console.log("Ca nghi bang ca dem");
            if (START_DATE == END_DATE) {
              //console.log("Ko duoc  chọn ngày bắt đầu và ngày kết thúc giống nhau ở ca đêm");
              res.send(
                "Ko duoc  chọn ngày bắt đầu và ngày kết thúc giống nhau ở ca đêm"
              );
            } else {
              for (var day = from; day < to; day.setDate(day.getDate() + 1)) {
                let apply_date = returnDateFormat(day);
                let query =
                  "INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','" +
                  EMPL_NO +
                  "','" +
                  today_format +
                  "','" +
                  apply_date +
                  "'," +
                  $reason_array[REASON_NAME] +
                  ",N'" +
                  REMARK_CONTENT +
                  "',2,2)";
                kqua = await asyncQuery2(query);
                if (kqua != "OK") checkkq = "NG";
              }
              res.send(checkkq);
            }
          }
        })();
        //res.send('ket qua tra ve' + req.cookies.token);
        break;
      case "dangkytangca":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_TIME = qr["over_start"];
          let FINISH_TIME = qr["over_finish"];
          let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
          if (isNumber(START_TIME) && isNumber(FINISH_TIME)) {
            //console.log("la number");
            var today = new Date();
            var today_format = moment().format("YYYY-MM-DD");
            let checkkq = "OK";
            let checkAttQuery =
              "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND APPLY_DATE='" +
              today_format +
              "'";
            let checkAttKQ = await asyncQuery(checkAttQuery);
            if (checkAttKQ != 0) {
              let query =
                "UPDATE ZTBATTENDANCETB SET OVERTIME=1, OVERTIME_INFO='" +
                OVERTIME_INFO +
                "' WHERE EMPL_NO='" +
                EMPL_NO +
                "' AND ON_OFF=1 AND APPLY_DATE='" +
                today_format +
                "'";
              kqua = await asyncQuery2(query);
              //console.log(kqua);
              if (kqua != "OK") {
                checkkq = "NG";
                res.send(
                  "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa"
                );
              } else {
                res.send("Đăng ký tăng ca hoàn thành");
              }
            } else {
              res.send("Lỗi, chưa điểm danh nên không đăng ký tăng ca được");
            }
          } else {
            res.send("Lỗi, Nhập sai định dạng");
          }
        })();
        break;
      case "tralichsu":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query =
            "SELECT OFF_ID,ZTBOFFREGISTRATIONTB.EMPL_NO, MIDLAST_NAME, FIRST_NAME, REQUEST_DATE, APPLY_DATE, CA_NGHI,REASON_NAME, ZTBOFFREGISTRATIONTB.REMARK, (CASE WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =0 THEN N'Từ chối' WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =1 THEN N'Đã duyệt' WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =2 THEN N'Chờ duyệt' WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =3 THEN N'Đã hủy' END) AS APPROVAL_STATUS FROM ZTBOFFREGISTRATIONTB JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE ZTBOFFREGISTRATIONTB.EMPL_NO='" +
            EMPL_NO +
            "' ORDER BY OFF_ID DESC";
          kqua = await asyncQuery(query);
          ////console.log(kqua);
          if (kqua == 0) {
            res.send({ tk_status: "NO", data: kqua });
          } else {
            res.send({ tk_status: "OK", data: kqua });
          }
        })();
        break;
      case "mydiemdanh":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_DATE = qr["from_date"];
          let END_DATE = qr["to_date"];
          let kqua;
          let query =
            "DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE; SET @empl='" +
            EMPL_NO +
            "'; SET @startdate='" +
            START_DATE +
            "' SET @enddate='" +
            END_DATE +
            "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBATTENDANCETB.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME,  ZTBOFFREGISTRATIONTB.REMARK,ZTBATTENDANCETB.XACNHAN FROM ZTBATTENDANCETB LEFT JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ZTBOFFREGISTRATIONTB ON (ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE) LEFT JOIN ZTBREASON ON ( ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE) WHERE ZTBATTENDANCETB.EMPL_NO=@empl AND ZTBATTENDANCETB.APPLY_DATE BETWEEN @startdate AND @enddate";
          kqua = await asyncQuery(query);
          //console.log('diem danh: ' + kqua);
          res.send({ tk_status: "ok", data: kqua });
        })();
        break;
      case "pheduyet":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query = "";
            if (JOB_NAME == "Leader") {
              query =
                "SELECT ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE (ZTBSUBDEPARTMENT.SUBDEPTNAME='" +
                $subdeptname +
                "' OR ZTBWORKPOSITION.ATT_GROUP_CODE='" +
                $vitrilamviec +
                "') ORDER BY OFF_ID DESC";
            } else {
              query =
                "SELECT ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE ZTBWORKPOSITION.ATT_GROUP_CODE='" +
                $vitrilamviec +
                "' ORDER BY OFF_ID DESC";
            }
            kqua = await asyncQuery(query);
            // //console.log(kqua);
            res.send({ tk_status: "OK", data: kqua });
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "setpheduyet":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $off_id = qr["off_id"];
          let $pheduyetvalue = qr["pheduyetvalue"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let checkkq = "OK";
            let setpdQuery =
              "UPDATE ZTBOFFREGISTRATIONTB SET APPROVAL_STATUS=" +
              $pheduyetvalue +
              " WHERE OFF_ID=" +
              $off_id;
            if ($pheduyetvalue == "3")
              setpdQuery =
                "DELETE FROM ZTBOFFREGISTRATIONTB WHERE OFF_ID=" + $off_id;
            checkkq = await asyncQuery2(setpdQuery);
            if (checkkq != "OK") {
              checkkq = "NG";
              res.send({
                tk_status: "ERROR",
                message:
                  "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa",
              });
            } else {
              res.send({ tk_status: "OK" });
            }
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "diemdanh":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $team_name = qr["team_name_list"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          let $condition = "";
          switch ($team_name) {
            case "TEAM 1 + Hành chính":
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 2";
              break;
            case "TEAM 2+ Hành chính":
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 1";
              break;
            case "TEAM 1":
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =1";
              break;
            case "TEAM 2":
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =2";
              break;
            case "Hành chính":
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =0";
              break;
            case "Tất cả":
              $condition = "";
              break;
          }
          //console.log('a'+$team_name+'a');
          ////console.log("job name = " + JOB_NAME);
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let today_format = returnDateFormat(today);
            let tradiemdanhQuery =
              "DECLARE @tradate DATE SET @tradate='" +
              today_format +
              "' SELECT ZTBEMPLINFO.EMPL_NO as id,ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE ZTBWORKPOSITION.ATT_GROUP_CODE = " +
              $vitrilamviec +
              " AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 " +
              $condition;
            if (JOB_NAME == "Leader")
              tradiemdanhQuery =
                "DECLARE @tradate DATE SET @tradate='" +
                today_format +
                "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE  (ZTBWORKPOSITION.ATT_GROUP_CODE = " +
                $vitrilamviec +
                " OR ZTBSUBDEPARTMENT.SUBDEPTNAME = '" +
                $subdeptname +
                "') AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 " +
                $condition;
            ////console.log(tradiemdanhQuery);
            checkkq = await asyncQuery(tradiemdanhQuery);
            ////console.log('check kq = ' + checkkq);
            if (checkkq != 0) {
              res.send(checkkq);
            } else {
              res.send("NO_DATA");
            }
          } else {
            res.send("NO_LEADER");
          }
        })();
        break;
      case "setdiemdanh":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = qr["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let diemdanhvalue = qr["diemdanhvalue"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            var today_format = moment().format("YYYY-MM-DD");
            let checkkq = "OK";
            let checkAttQuery =
              "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND APPLY_DATE='" +
              today_format +
              "'";
            let checkAttKQ = await asyncQuery(checkAttQuery);
            //console.log('checkqa = ' + checkAttKQ);
            //checkkq = await asyncQuery2(setpdQuery);
            if (checkAttKQ == 0) {
              checkkq = "NG";
              //console.log('Chua diem danh, se them moi diem danh');
              let insert_diemdanhQuery =
                "INSERT INTO ZTBATTENDANCETB (CTR_CD, EMPL_NO, APPLY_DATE, ON_OFF) VALUES ('002','" +
                EMPL_NO +
                "','" +
                today_format +
                "'," +
                diemdanhvalue +
                ")";
              let insert_dd = await asyncQuery2(insert_diemdanhQuery);
              if (insert_dd != "OK") {
                res.send("NG");
              } else {
                res.send({ tk_status: "OK" });
              }
            } else {
              let update_diemdanhQuery =
                "UPDATE ZTBATTENDANCETB SET ON_OFF = " +
                diemdanhvalue +
                " WHERE  EMPL_NO='" +
                EMPL_NO +
                "' AND APPLY_DATE='" +
                today_format +
                "'";
              let update_dd = await asyncQuery2(update_diemdanhQuery);
              if (update_dd != "OK") {
                res.send({ tk_status: "NG" });
              } else {
                res.send({ tk_status: "OK" });
              }
              //console.log('Update trang thai diem danh');
            }
          } else {
            res.send("NO_LEADER");
          }
        })();
        break;
      case "dangkytangca2":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = qr["EMPL_NO"];
          let START_TIME = qr["over_start"];
          let FINISH_TIME = qr["over_finish"];
          let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
          let tangcavalue = qr["tangcayesno1"];
          //console.log("la number");
          var today = new Date();
          var today_format = moment().format("YYYY-MM-DD");
          let checkkq = "OK";
          let checkAttQuery =
            "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
            EMPL_NO +
            "' AND APPLY_DATE='" +
            today_format +
            "'";
          let checkAttKQ = await asyncQuery(checkAttQuery);
          if (checkAttKQ != 0) {
            let query =
              "UPDATE ZTBATTENDANCETB SET OVERTIME=" +
              tangcavalue +
              ", OVERTIME_INFO='" +
              OVERTIME_INFO +
              "' WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND ON_OFF=1 AND APPLY_DATE='" +
              today_format +
              "'";
            kqua = await asyncQuery2(query);
            //console.log(kqua);
            if (kqua != "OK") {
              checkkq = "NG";
              res.send(
                "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa"
              );
            } else {
              res.send({ tk_status: "OK" });
            }
          } else {
            res.send({ tk_status: "ng" });
          }
        })();
        break;
      case "diemdanh_total":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $vitrilamviec = qr["SUBDEPTNAME"];
          let $subdeptname = qr["SUBDEPTNAME"];
          let $maindeptname = qr["MAINDEPTNAME"];
          let $startdate = qr["from_date_total"];
          let $enddate = qr["to_date_total"];
          let $nghisinhvalue = qr["nghisinhvalue"];
          let $team_name = qr["team_name_total"];
          let $condition = "WHERE 1=1 ";
          let $nghisinhcondition = "";
          let $subdept_condition = "";
          let $maindept_condition = "";
          let $condition_team = "";
          if ($nghisinhvalue == "false") {
            $nghisinhcondition =
              "AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0";
          } else {
            $nghisinhcondition = " AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0";
          }
          if ($vitrilamviec == "Toàn bộ") {
            $subdept_condition = "";
          } else {
            $subdept_condition = "AND SUBDEPTNAME =N'" + $vitrilamviec + "' ";
          }
          if ($maindeptname == "Toàn bộ") {
            $maindept_condition = "";
          } else {
            $maindept_condition = "AND MAINDEPTNAME =N'" + $maindeptname + "' ";
          }
          if ($team_name == "Tất cả") {
            $condition_team = "";
          } else if ($team_name == "TEAM 1 + Hành chính") {
            $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 2";
          } else if ($team_name == "TEAM 2+ Hành chính") {
            $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 1";
          } else if ($team_name == "TEAM 1") {
            $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =1";
          } else if ($team_name == "TEAM 2") {
            $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =2";
          } else if ($team_name == "Hành chính") {
            $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =0";
          }
          $condition =
            $condition +
            $nghisinhcondition +
            $subdept_condition +
            $condition_team +
            $maindept_condition;
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query =
              "DECLARE @subdept_name varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE; SET @subdept_name='" +
              $subdeptname +
              "'; SET @startdate='" +
              $startdate +
              "' SET @enddate='" +
              $enddate +
              "' SELECT ZTBEMPLINFO.EMPL_NO,        CMS_ID,        MIDLAST_NAME,        FIRST_NAME,        PHONE_NUMBER,        SEX_NAME,        WORK_STATUS_NAME,        FACTORY_NAME,        JOB_NAME,        WORK_SHIF_NAME,        WORK_POSITION_NAME,        SUBDEPTNAME,        MAINDEPTNAME,        REQUEST_DATE,        ZTBOFFREGISTRATIONTB_1.APPLY_DATE,        APPROVAL_STATUS,        OFF_ID,        CA_NGHI,        ON_OFF,        OVERTIME_INFO,        OVERTIME,        REASON_NAME,        ZTBOFFREGISTRATIONTB_1.REMARK,        ZTBATTENDANCETB_1.APPLY_DATE AS DDDATE, HOMETOWN, ADD_VILLAGE, ADD_COMMUNE, ADD_DISTRICT, ADD_PROVINCE, ZTBATTENDANCETB_1.XACNHAN FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN   (SELECT *    FROM ZTBATTENDANCETB    WHERE APPLY_DATE BETWEEN @startdate AND @enddate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN   (SELECT *    FROM ZTBOFFREGISTRATIONTB    WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE BETWEEN @startdate AND @enddate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBATTENDANCETB_1.EMPL_NO AND ZTBOFFREGISTRATIONTB_1.APPLY_DATE = ZTBATTENDANCETB_1.APPLY_DATE )  LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) " +
              $condition;
            ////console.log(query);
            kqua = await asyncQuery(query);
            res.send({ tk_status: "OK", data: kqua });
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "setteamtab":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $team_name = qr["team_name_list"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          ////console.log("job name = " + JOB_NAME);
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let today_format = returnDateFormat(today);
            let tradiemdanhQuery =
              "DECLARE @tradate DATE SET @tradate='" +
              today_format +
              "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME, ZTBWORKSHIFT.WORK_SHIFT_CODE,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE  (ZTBWORKPOSITION.ATT_GROUP_CODE = '" +
              $vitrilamviec +
              "' OR ZTBSUBDEPARTMENT.SUBDEPTNAME = '" +
              $subdeptname +
              "') AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 ";
            ////console.log(tradiemdanhQuery);
            checkkq = await asyncQuery(tradiemdanhQuery);
            ////console.log('check kq = ' + checkkq);
            if (checkkq != 0) {
              res.send(checkkq);
            } else {
              res.send("NO_DATA");
            }
          } else {
            res.send("NO_LEADER");
          }
        })();
        break;
      case "setteambt":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = qr["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $teamvalue = qr["teamvalue"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let checkkq = "OK";
            let setpdQuery =
              "UPDATE ZTBEMPLINFO SET WORK_SHIFT_CODE=" +
              $teamvalue +
              " WHERE EMPL_NO='" +
              EMPL_NO +
              "'";
            checkkq = await asyncQuery2(setpdQuery);
            if (checkkq != "OK") {
              checkkq = "NG";
              res.send(
                "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa"
              );
            } else {
              res.send({ tk_status: "OK" });
            }
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "confirmtangca":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_TIME = qr["over_start"];
          let FINISH_TIME = qr["over_finish"];
          let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
          let tangcavalue = qr["tangcayesno"];
          if (tangcavalue == "Có tăng ca") {
            tangcavalue = "1";
          } else {
            tangcavalue = "0";
          }
          if (tangcavalue == "1") {
            if (isNumber(START_TIME) && isNumber(FINISH_TIME)) {
              //console.log("la number");
              var today = new Date();
              today.setDate(today.getDate() - 1);
              var today_format = moment().format("YYYY-MM-DD");
              let checkkq = "OK";
              let checkAttQuery =
                "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
                EMPL_NO +
                "' AND APPLY_DATE='" +
                today_format +
                "'";
              let checkAttKQ = await asyncQuery(checkAttQuery);
              if (checkAttKQ != 0) {
                let query =
                  "UPDATE ZTBATTENDANCETB SET OVERTIME=" +
                  tangcavalue +
                  ", OVERTIME_INFO='" +
                  OVERTIME_INFO +
                  "' WHERE EMPL_NO='" +
                  EMPL_NO +
                  "' AND ON_OFF=1 AND APPLY_DATE='" +
                  today_format +
                  "'";
                kqua = await asyncQuery2(query);
                //console.log(kqua);
                if (kqua != "OK") {
                  checkkq = "NG";
                  res.send(
                    "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa"
                  );
                } else {
                  res.send("Đăng ký tăng ca hoàn thành");
                }
              } else {
                res.send("Lỗi, chưa điểm danh nên không đăng ký tăng ca được");
              }
            } else {
              res.send("Lỗi, Nhập sai định dạng");
            }
          } else {
            OVERTIME_INFO = "";
            //console.log("la number");
            var today = new Date();
            today.setDate(today.getDate() - 1);
            var today_format = moment().format("YYYY-MM-DD");
            let checkkq = "OK";
            let checkAttQuery =
              "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND APPLY_DATE='" +
              today_format +
              "'";
            let checkAttKQ = await asyncQuery(checkAttQuery);
            if (checkAttKQ != 0) {
              let query =
                "UPDATE ZTBATTENDANCETB SET OVERTIME=" +
                tangcavalue +
                ", OVERTIME_INFO='" +
                OVERTIME_INFO +
                "' WHERE EMPL_NO='" +
                EMPL_NO +
                "' AND ON_OFF=1 AND APPLY_DATE='" +
                today_format +
                "'";
              kqua = await asyncQuery2(query);
              //console.log(kqua);
              if (kqua != "OK") {
                checkkq = "NG";
                res.send(
                  "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa"
                );
              } else {
                res.send(
                  "Confirm tăng ca ngày " + today_format + " hoàn thành"
                );
              }
            } else {
              res.send("Lỗi, chưa điểm danh nên không đăng ký tăng ca được");
            }
          }
        })();
        break;
      case "testlargetb":
        (async () => {
          var today = new Date();
          var today_format = moment().format("YYYY-MM-DD");
          let kqua;
          let query = "SELECT TOP 10000 * FROM ZTBDelivery";
          kqua = await asyncQuery(query);
          res.send({ tk_status: "OK", data: kqua });
        })();
        break;
      case "diemdanhsummary":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let today_format = moment().format("YYYY-MM-DD");
            let kqua;
            let query =
              "DECLARE @tradate As DATE; SET @tradate = '" +
              today_format +
              "' SELECT TONG_FULL.MAINDEPTNAME, TONG_FULL.SUBDEPTNAME, (TONG_FULL.NhaMay1+TONG_FULL.NhaMay2) AS TOTAL_ALL, (isnull(TONG_ON.NhaMay1,0) + isnull(TONG_ON.NhaMay2,0)) AS TOTAL_ON, (isnull(TONG_OFF.NhaMay1,0)+ isnull(TONG_OFF.NhaMay2,0)) AS TOTAL_OFF, (isnull(TONG_NULL.NhaMay1,0)+ isnull(TONG_NULL.NhaMay2,0)) AS TOTAL_CDD, isnull(TONG_FULL.NhaMay1,0) as TOTAL_NM1, isnull(TONG_FULL.NhaMay2,0) as TOTAL_NM2, isnull(TONG_ON.NhaMay1,0) as ON_NM1, isnull(TONG_ON.NhaMay2,0) as ON_NM2, isnull(TONG_OFF.NhaMay1,0) as OFF_NM1, isnull(TONG_OFF.NhaMay2,0) as OFF_NM2, isnull(TONG_NULL.NhaMay1,0) as CDD_NM1, isnull(TONG_NULL.NhaMay2,0) as CDD_NM2 FROM fn_DiemDanhTong_FULL(@tradate) AS TONG_FULL LEFT JOIN (SELECT * FROM fn_DiemDanhTong_ON(@tradate)) AS TONG_ON ON (TONG_ON.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) LEFT JOIN (SELECT * FROM fn_DiemDanhTong_OFF(@tradate)) AS TONG_OFF ON (TONG_OFF.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) LEFT JOIN (SELECT * FROM fn_DiemDanhTong_NULL(@tradate)) AS TONG_NULL ON (TONG_NULL.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) ORDER BY MAINDEPTNAME DESC, SUBDEPTNAME ASC";
            kqua = await asyncQuery(query);
            // //console.log(kqua);
            res.send({ tk_status: "OK", data: kqua });
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "checklogin":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT WORK_STATUS_CODE FROM ZTBEMPLINFO WHERE EMPL_NO='${EMPL_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);

          if (checkkq.data[0].WORK_STATUS_CODE === 0) {
            res.send({ tk_status: "ng", message: "Đã nghỉ việc" });
          } else {
            res.send({ tk_status: "ok", data: req.payload_data });
          }
        })();

        //console.log(qr['command']);

        break;
      case "pqc1_output_data":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query =
              "SELECT TOP 100 * FROM ZTBPQC1TABLE ORDER BY PQC1_ID DESC";
            kqua = await asyncQuery(query);
            res.send({ tk_status: "OK", data: kqua });
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "pqc2_output_data":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query =
              "SELECT TOP 100 PQC2_ID,PROCESS_LOT_NO,LINEQC_PIC,TIME1,TIME2,TIME3,CHECK1,CHECK2,CHECK3,REMARK,INS_DATE,UPD_DATE,PQC1_ID FROM ZTBPQC2TABLE ORDER BY PQC2_ID DESC";
            kqua = await asyncQuery(query);
            res.send({ tk_status: "OK", data: kqua });
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "pqc3_output_data":
        (async () => {
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query = `SELECT TOP 100 [PQC3_ID],[PROCESS_LOT_NO],[LINEQC_PIC],[OCCURR_TIME],[INSPECT_QTY],[DEFECT_QTY],[DEFECT_PHENOMENON],[DEFECT_IMAGE_LINK],[REMARK],[INS_DATE],[UPD_DATE],[PQC1_ID]   FROM [dbo].[ZTBPQC3TABLE] ORDER BY PQC3_ID DESC`;
            kqua = await queryDB(query);
            res.send(kqua);
          } else {
            res.send({ tk_status: "NO_LEADER" });
          }
        })();
        break;
      case "insertchat":
        (async () => {
          let EMPL_NO = qr["EMPL_NO"];
          let CHATTIME = moment().format("YYYY-MM-DD HH:mm:ss");
          ////console.log(CHATTIME);
          let MESSAGE = qr["MESSAGE"];
          let checkkq = "OK";
          let setpdQuery =
            "INSERT INTO ZCHATTB (CTR_CD,EMPL_NO,CHATTIME,MESSAGE) VALUES ('002','" +
            EMPL_NO +
            "','" +
            CHATTIME +
            "',N'" +
            MESSAGE +
            "')";
          checkkq = await asyncQuery2(setpdQuery);
          if (checkkq != "OK") {
            res.send({
              tk_status: "NG",
              message: "Có lỗi khi lưu tin nhắn lên hệ thống",
            });
          } else {
            res.send({ tk_status: "OK" });
          }
        })();
        break;
      case "getchat":
        (async () => {
          let kqua;
          let query =
            "SELECT TOP 1000 ZCHATTB.EMPL_NO, CHATTIME, ZCHATTB.MESSAGE, ZTBEMPLINFO.MIDLAST_NAME, ZTBEMPLINFO.FIRST_NAME FROM ZCHATTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZCHATTB.EMPL_NO) ORDER BY CHATTIME ASC";
          kqua = await asyncQuery(query);
          if (kqua == 0) {
            res.send({ tk_status: "NG", data: kqua });
          } else {
            res.send({ tk_status: "OK", data: kqua });
          }
        })();
        break;
      case "temp_info":
        (async () => {
          let PARAM = qr["param"];
          let OPTION = qr["option"];
          let query = "";
          switch (OPTION) {
            case "empl_name":
              query =
                "SELECT EMPL_NAME FROM M010 WHERE EMPL_NO='" + PARAM + "'";
              break;
            case "gname":
              query =
                "SELECT TOP 1 G_NAME FROM P501 JOIN P500 ON (P501.PROCESS_IN_DATE =P500.PROCESS_IN_DATE AND P501.PROCESS_IN_NO =P500.PROCESS_IN_NO AND P501.PROCESS_IN_SEQ =P500.PROCESS_IN_SEQ) JOIN M100 ON (M100.G_CODE = P500.G_CODE) WHERE PROCESS_LOT_NO='" +
                PARAM +
                "'";
              break;
            default:
          }
          ////console.log(query);
          kqua = await asyncQuery(query);
          if (kqua == 0) {
            res.send({ tk_status: "NG", data: kqua });
          } else {
            res.send({ tk_status: "OK", data: kqua });
          }
        })();
        break;
      case "insert_pqc1":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBPQC1TABLE (CTR_CD,PROCESS_LOT_NO,LINEQC_PIC,PROD_PIC,PROD_LEADER,STEPS,CAVITY,SETTING_OK_TIME,FACTORY,REMARK,INS_DATE,REMARK2,PROD_REQUEST_NO,G_CODE,PLAN_ID,PROCESS_NUMBER,LINE_NO) VALUES('002','${DATA.PROCESS_LOT_NO}','${DATA.LINEQC_PIC}','${DATA.PROD_PIC}','${DATA.PROD_LEADER}','${DATA.STEPS}','${DATA.CAVITY}','${DATA.SETTING_OK_TIME}','${DATA.FACTORY}','${DATA.REMARK}',GETDATE(),'${DATA.REMARK}','${DATA.PROD_REQUEST_NO}','${DATA.G_CODE}','${DATA.PLAN_ID}','${DATA.PROCESS_NUMBER}','${DATA.LINE_NO}')`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_sample_qty_pqc1":
        (async () => {
          let checkkq = "";
          let errflag = "OK";
          for (let i = 0; i < DATA.length; i++) {
            let setpdQuery =
              "UPDATE ZTBPQC1TABLE SET INSPECT_SAMPLE_QTY=" +
              DATA[i].INSPECT_SAMPLE_QTY +
              " WHERE PQC1_ID=" +
              DATA[i].PQC1_ID;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            if (checkkq.tk_status == "NG") {
              errflag = "NG";
            }
          }
          //console.log(errflag);
          if (errflag == "NG") {
            res.send({
              tk_status: errflag,
              message: "Có lỗi gì đó trong quá trình update",
            });
          } else {
            res.send({ tk_status: "OK", message: "Update data thành công !" });
          }
        })();
        break;
      case "getpqc1id":
        (async () => {
          let EMPL_NO = qr["EMPL_NO"];
          let PROCESS_LOT_NO = qr["PROCESS_LOT_NO"];
          let kqua;
          let query = `SELECT PQC1_ID FROM ZTBPQC1TABLE WHERE LINEQC_PIC='${EMPL_NO}' AND PROCESS_LOT_NO='${PROCESS_LOT_NO}'`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "insert_pqc2":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBPQC2TABLE (CTR_CD, PROCESS_LOT_NO, LINEQC_PIC, TIME1, TIME2, TIME3, CHECK1, CHECK2, CHECK3, REMARK, INS_DATE, UPD_DATE, PQC1_ID) VALUES ('002','${DATA.PROCESS_LOT_NO}','${DATA.LINEQC_PIC}','${DATA.CHECKSHEET.TIME1}','${DATA.CHECKSHEET.TIME2}','${DATA.CHECKSHEET.TIME3}','${DATA.CHECKSHEET.CHECK1}','${DATA.CHECKSHEET.CHECK2}','${DATA.CHECKSHEET.CHECK3}','${DATA.REMARK}','${currenttime}','${currenttime}',${DATA.PQC1_ID})`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "insert_pqc3":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBPQC3TABLE (CTR_CD, PROCESS_LOT_NO, LINEQC_PIC, OCCURR_TIME, INSPECT_QTY, DEFECT_QTY, DEFECT_PHENOMENON, DEFECT_IMAGE_LINK, REMARK, INS_DATE, UPD_DATE, PQC1_ID) VALUES('002','${DATA.PROCESS_LOT_NO}','${DATA.LINEQC_PIC}','${DATA.OCCURR_TIME}',${DATA.INSPECT_QTY},${DATA.DEFECT_QTY},N'${DATA.DEFECT_PHENOMENON}','${DATA.DEFECT_IMAGE_LINK}',N'${DATA.REMARK}','${currenttime}','${currenttime}',${DATA.PQC1_ID})`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "getpqcdata":
        (async () => {
          ////console.log(DATA);
          let kqua;
          let query = ``;
          switch (DATA.SELECTION) {
            case 1:
              //console.log("case 1");
              query = `SELECT ZTBPQC1TABLE.PQC1_ID, M110.CUST_NAME_KD, P400.PROD_REQUEST_NO, P400.PROD_REQUEST_QTY, P400.PROD_REQUEST_DATE, ZTBPQC1TABLE.PROCESS_LOT_NO, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, M010.EMPL_NAME AS LINEQC_PIC, M010_A.EMPL_NAME AS PROD_PIC, M010_B.EMPL_NAME AS PROD_LEADER, ZTBPQC1TABLE.LINE_NO, ZTBPQC1TABLE.STEPS, ZTBPQC1TABLE.CAVITY,ZTBPQC1TABLE.SETTING_OK_TIME, ZTBPQC1TABLE.FACTORY, ZTBPQC1TABLE.INSPECT_SAMPLE_QTY, ZTBPOTable_A.PROD_PRICE , (ZTBPOTable_A.PROD_PRICE*ZTBPQC1TABLE.INSPECT_SAMPLE_QTY) AS SAMPLE_AMOUNT ,ZTBPQC1TABLE.REMARK, ZTBPQC1TABLE.INS_DATE, ZTBPQC1TABLE.UPD_DATE FROM ZTBPQC1TABLE LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC1TABLE.PROCESS_LOT_NO) LEFT JOIN (SELECT DISTINCT PROCESS_IN_DATE,PROCESS_IN_NO,PROCESS_IN_SEQ, PROD_REQUEST_NO FROM P500 WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ) LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO) LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE) LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC1TABLE.LINEQC_PIC) LEFT JOIN (SELECT EMPL_NAME, EMPL_NO FROM M010) AS M010_A ON (M010_A.EMPL_NO = ZTBPQC1TABLE.PROD_PIC) LEFT JOIN (SELECT EMPL_NAME, EMPL_NO FROM M010) AS M010_B ON (M010_B.EMPL_NO = ZTBPQC1TABLE.PROD_LEADER) LEFT JOIN (SELECT DISTINCT G_CODE, MIN(PROD_PRICE) AS PROD_PRICE FROM ZTBPOTable GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE) JOIN M110 ON (M110.CUST_CD = P400.CUST_CD) ${generate_condition_pqc1(
                DATA.ALLTIME,
                DATA.FROMDATE,
                DATA.TODATE,
                DATA.CUST_NAME,
                DATA.G_CODE,
                DATA.G_NAME_KD,
                DATA.PROD_REQUEST_NO,
                DATA.PROCESS_LOT_NO,
                DATA.PQC_ID,
                DATA.FACTORY
              )} ORDER BY PQC1_ID DESC`;
              break;
            case 2:
              //console.log("case 2");
              //query = `SELECT TOP 100 ZTBPQC1_A_TABLE .FACTORY,ZTBPQC1_A_TABLE.PROCESS_LOT_NO,ZTBPQC1_A_TABLE.G_NAME,ZTBPQC1_A_TABLE.G_NAME_KD,ZTBPQC1_A_TABLE.LINEQC_PIC,ZTBPQC1_A_TABLE.PROD_PIC,ZTBPQC1_A_TABLE.PROD_LEADER,ZTBPQC1_A_TABLE.LINE_NO,ZTBPQC1_A_TABLE.STEPS,ZTBPQC1_A_TABLE.CAVITY,ZTBPQC1_A_TABLE.SETTING_OK_TIME,  ZTBPQC1_A_TABLE.INSPECT_SAMPLE_QTY,ZTBPQC1_A_TABLE.PROD_PRICE,ZTBPQC1_A_TABLE.SAMPLE_AMOUNT,ZTBPQC1_A_TABLE.REMARK,  ZTBPQC2TABLE.PQC1_ID,ZTBPQC2TABLE.PQC2_ID,ZTBPQC2TABLE.TIME1,ZTBPQC2TABLE.TIME2,ZTBPQC2TABLE.TIME3,ZTBPQC2TABLE.CHECK1,ZTBPQC2TABLE.CHECK2,ZTBPQC2TABLE.CHECK3,ZTBPQC2TABLE.REMARK AS REMARK2,ZTBPQC2TABLE.INS_DATE,ZTBPQC2TABLE.UPD_DATE FROM ZTBPQC2TABLE LEFT JOIN   (SELECT ZTBPQC1TABLE.PQC1_ID,   ZTBPQC1TABLE.PROCESS_LOT_NO,   M100.G_NAME,   M100.G_NAME_KD,   M010.EMPL_NAME AS LINEQC_PIC,   M010_A.EMPL_NAME AS PROD_PIC,   M010_B.EMPL_NAME AS PROD_LEADER,   ZTBPQC1TABLE.LINE_NO,   ZTBPQC1TABLE.STEPS,   ZTBPQC1TABLE.CAVITY,   ZTBPQC1TABLE.SETTING_OK_TIME,   ZTBPQC1TABLE.FACTORY,   ZTBPQC1TABLE.INSPECT_SAMPLE_QTY,   ZTBPOTable_A.PROD_PRICE,   (ZTBPOTable_A.PROD_PRICE*ZTBPQC1TABLE.INSPECT_SAMPLE_QTY) AS SAMPLE_AMOUNT,   ZTBPQC1TABLE.REMARK,   ZTBPQC1TABLE.INS_DATE,   ZTBPQC1TABLE.UPD_DATE    FROM ZTBPQC1TABLE    LEFT JOIN      (SELECT *       FROM P501       WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC1TABLE.PROCESS_LOT_NO)    LEFT JOIN      (SELECT DISTINCT PROCESS_IN_DATE,   PROCESS_IN_NO,   PROCESS_IN_SEQ,   PROD_REQUEST_NO       FROM P500       WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ)    LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)    LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE)    LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC1TABLE.LINEQC_PIC)    LEFT JOIN      (SELECT EMPL_NAME,  EMPL_NO       FROM M010) AS M010_A ON (M010_A.EMPL_NO = ZTBPQC1TABLE.PROD_PIC)    LEFT JOIN      (SELECT EMPL_NAME,  EMPL_NO       FROM M010) AS M010_B ON (M010_B.EMPL_NO = ZTBPQC1TABLE.PROD_LEADER)    LEFT JOIN      (SELECT DISTINCT G_CODE,   MIN(PROD_PRICE) AS PROD_PRICE       FROM ZTBPOTable       GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE)) AS ZTBPQC1_A_TABLE ON (ZTBPQC2TABLE.PQC1_ID = ZTBPQC1_A_TABLE.PQC1_ID)  ORDER BY PQC2_ID DESC`;
              query = `SELECT TOP 100 ZTBPQC1_A_TABLE.PQC1_ID, ZTBPQC1_A_TABLE .FACTORY ,ZTBPQC1_A_TABLE.PROCESS_LOT_NO,ZTBPQC1_A_TABLE.G_NAME,ZTBPQC1_A_TABLE.G_NAME_KD,ZTBPQC1_A_TABLE.LINEQC_PIC,ZTBPQC1_A_TABLE.PROD_PIC,ZTBPQC1_A_TABLE.PROD_LEADER,ZTBPQC1_A_TABLE.LINE_NO,ZTBPQC1_A_TABLE.STEPS,ZTBPQC1_A_TABLE.CAVITY,ZTBPQC1_A_TABLE.SETTING_OK_TIME,ZTBPQC1_A_TABLE.FACTORY,ZTBPQC1_A_TABLE.INSPECT_SAMPLE_QTY,ZTBPQC1_A_TABLE.PROD_PRICE,ZTBPQC1_A_TABLE.SAMPLE_AMOUNT,ZTBPQC1_A_TABLE.REMARK,ZTBPQC1_A_TABLE.INS_DATE,ZTBPQC1_A_TABLE.UPD_DATE, ZTBPQC2TABLE.PQC1_ID,ZTBPQC2TABLE.PQC2_ID,ZTBPQC2TABLE.PROCESS_LOT_NO,ZTBPQC2TABLE.LINEQC_PIC,ZTBPQC2TABLE.TIME1,ZTBPQC2TABLE.TIME2,ZTBPQC2TABLE.TIME3,ZTBPQC2TABLE.CHECK1,ZTBPQC2TABLE.CHECK2,ZTBPQC2TABLE.CHECK3,ZTBPQC2TABLE.REMARK,ZTBPQC2TABLE.INS_DATE,ZTBPQC2TABLE.UPD_DATE FROM ZTBPQC2TABLE LEFT JOIN (SELECT ZTBPQC1TABLE.PQC1_ID,ZTBPQC1TABLE.PROCESS_LOT_NO, M100.G_NAME, M100.G_NAME_KD, M010.EMPL_NAME AS LINEQC_PIC, M010_A.EMPL_NAME AS PROD_PIC, M010_B.EMPL_NAME AS PROD_LEADER, ZTBPQC1TABLE.LINE_NO, ZTBPQC1TABLE.STEPS, ZTBPQC1TABLE.CAVITY,ZTBPQC1TABLE.SETTING_OK_TIME, ZTBPQC1TABLE.FACTORY, ZTBPQC1TABLE.INSPECT_SAMPLE_QTY, ZTBPOTable_A.PROD_PRICE , (ZTBPOTable_A.PROD_PRICE*ZTBPQC1TABLE.INSPECT_SAMPLE_QTY) AS SAMPLE_AMOUNT ,ZTBPQC1TABLE.REMARK, ZTBPQC1TABLE.INS_DATE, ZTBPQC1TABLE.UPD_DATE FROM ZTBPQC1TABLE LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC1TABLE.PROCESS_LOT_NO) LEFT JOIN (SELECT DISTINCT PROCESS_IN_DATE,PROCESS_IN_NO,PROCESS_IN_SEQ, PROD_REQUEST_NO FROM P500  WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ) LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO) LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE) LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC1TABLE.LINEQC_PIC) LEFT JOIN (SELECT EMPL_NAME, EMPL_NO FROM M010) AS M010_A ON (M010_A.EMPL_NO = ZTBPQC1TABLE.PROD_PIC) LEFT JOIN (SELECT EMPL_NAME, EMPL_NO FROM M010) AS M010_B ON (M010_B.EMPL_NO = ZTBPQC1TABLE.PROD_LEADER) LEFT JOIN (SELECT DISTINCT G_CODE, MIN(PROD_PRICE) AS PROD_PRICE FROM ZTBPOTable GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE) ) AS ZTBPQC1_A_TABLE ON (ZTBPQC2TABLE.PQC1_ID = ZTBPQC1_A_TABLE.PQC1_ID)  ORDER BY PQC2_ID DESC`;
              break;
            case 3:
              //console.log("case 3");
              //query = `SELECT ZTBPQC3TABLE.PQC3_ID, ZTBPQC1TABLE_B.FACTORY, M110.CUST_NAME_KD, P500_A.PROD_REQUEST_NO,  P500_A.PROD_REQUEST_DATE, ZTBPQC3TABLE.PROCESS_LOT_NO,  M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, ZTBPOTable_A.PROD_PRICE, M010.EMPL_NAME AS LINEQC_PIC_NAME, ZTBPQC1TABLE_B.PROD_PIC, ZTBPQC1TABLE_B.PROD_LEADER, ZTBPQC1TABLE_B.LINE_NO, ZTBPQC3TABLE.LINEQC_PIC,ZTBPQC3TABLE.OCCURR_TIME,ZTBPQC3TABLE.INSPECT_QTY,ZTBPQC3TABLE.DEFECT_QTY, ZTBPQC3TABLE.DEFECT_PHENOMENON,ZTBPQC3TABLE.DEFECT_IMAGE_LINK,ZTBPQC3TABLE.REMARK FROM ZTBPQC3TABLE LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC3TABLE.PROCESS_LOT_NO) LEFT JOIN (SELECT DISTINCT PROCESS_IN_DATE,PROCESS_IN_NO,PROCESS_IN_SEQ, PROD_REQUEST_NO,G_CODE, PROD_REQUEST_DATE FROM P500 WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ) LEFT JOIN M100 ON (M100.G_CODE = P500_A.G_CODE) LEFT JOIN (SELECT DISTINCT G_CODE, MIN(PROD_PRICE) AS PROD_PRICE FROM ZTBPOTable GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE) LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC3TABLE.LINEQC_PIC) LEFT JOIN (SELECT ZTBPQC1TABLE.CTR_CD,ZTBPQC1TABLE.PQC1_ID,ZTBPQC1TABLE.PROCESS_LOT_NO,ZTBPQC1TABLE.LINEQC_PIC,ZTBPQC1TABLE.PROD_PIC,ZTBPQC1TABLE.PROD_LEADER,ZTBPQC1TABLE.LINE_NO,ZTBPQC1TABLE.STEPS,ZTBPQC1TABLE.CAVITY,ZTBPQC1TABLE.SETTING_OK_TIME,ZTBPQC1TABLE.FACTORY,ZTBPQC1TABLE.INSPECT_SAMPLE_QTY,ZTBPQC1TABLE.REMARK,ZTBPQC1TABLE.INS_DATE,ZTBPQC1TABLE.UPD_DATE  FROM ZTBPQC1TABLE JOIN ZTBPQC3TABLE ON ZTBPQC1TABLE.PQC1_ID = ZTBPQC3TABLE.PQC1_ID) AS ZTBPQC1TABLE_B ON (ZTBPQC1TABLE_B.PQC1_ID = ZTBPQC3TABLE.PQC1_ID) JOIN P400 ON (P400.PROD_REQUEST_NO = P500_A.PROD_REQUEST_NO) JOIN M110 ON ( M110.CUST_CD= P400.CUST_CD) ${generate_condition_pqc3(DATA.ALLTIME,DATA.FROMDATE, DATA.TODATE, DATA.CUST_NAME, DATA.G_CODE, DATA.G_NAME_KD, DATA.PROD_REQUEST_NO, DATA.PROCESS_LOT_NO, DATA.PQC_ID, DATA.FACTORY)} ORDER BY PQC3_ID DESC`;
              query = `SELECT CONCAT(datepart(YEAR,ZTBPQC3TABLE.OCCURR_TIME),'_',datepart(ISO_WEEK,DATEADD(day,2,ZTBPQC3TABLE.OCCURR_TIME))) AS YEAR_WEEK,ZTBPQC3TABLE.PQC3_ID,ZTBPQC3TABLE.PQC1_ID,ZTBPQC1TABLE.FACTORY,ZTBPQC3TABLE.PROD_REQUEST_NO,P400.PROD_REQUEST_DATE,ZTBPQC3TABLE.PROCESS_LOT_NO,ZTBPQC3TABLE.G_CODE,M100.G_NAME,M100.G_NAME_KD,M100.PROD_LAST_PRICE,ZTBPQC3TABLE.LINEQC_PIC,ZTBPQC1TABLE.PROD_PIC,ZTBPQC1TABLE.PROD_LEADER,ZTBPQC1TABLE.LINE_NO,ZTBPQC3TABLE.OCCURR_TIME,ZTBPQC3TABLE.INSPECT_QTY,ZTBPQC3TABLE.DEFECT_QTY,(ZTBPQC3TABLE.DEFECT_QTY *M100.PROD_LAST_PRICE ) AS DEFECT_AMOUNT,ZTBPQC3TABLE.DEFECT_PHENOMENON,ZTBPQC3TABLE.DEFECT_IMAGE_LINK,ZTBPQC3TABLE.REMARK,ZTBPQC3TABLE.WORST5,ZTBPQC3TABLE.WORST5_MONTH  FROM ZTBPQC3TABLE LEFT JOIN ZTBPQC1TABLE ON (ZTBPQC3TABLE.PQC1_ID = ZTBPQC1TABLE.PQC1_ID) LEFT JOIN M100 ON (M100.G_CODE = ZTBPQC3TABLE.G_CODE) LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = ZTBPQC3TABLE.PROD_REQUEST_NO) ${generate_condition_pqc3(
                DATA.ALLTIME,
                DATA.FROMDATE,
                DATA.TODATE,
                DATA.CUST_NAME,
                DATA.G_CODE,
                DATA.G_NAME_KD,
                DATA.PROD_REQUEST_NO,
                DATA.PROCESS_LOT_NO,
                DATA.PQC_ID,
                DATA.FACTORY
              )} ORDER BY PQC3_ID DESC`;
              break;
            default:
              //console.log("invalid case selected");
              break;
          }
          //console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkktdtc":
        (async () => {
          let kqua;
          let query = `SELECT * FROM (SELECT  P500.M_CODE, SUBSTRING(P501.M_LOT_NO,0,7) AS LOT_TO, M090.WIDTH_CD FROM P501 JOIN P500 ON (P501.PROCESS_IN_DATE =P500.PROCESS_IN_DATE AND P501.PROCESS_IN_NO =P500.PROCESS_IN_NO AND P501.PROCESS_IN_SEQ =P500.PROCESS_IN_SEQ) JOIN M090 ON  (M090.M_CODE = P500.M_CODE) WHERE P501.PROCESS_LOT_NO='${DATA.PROCESS_LOT_NO}') AS AA JOIN (SELECT TRANGTHAI, M_CODE, SIZE, LOTCMS FROM NHAP_NVL) AS BB ON (AA.LOT_TO = BB.LOTCMS AND AA.M_CODE =  BB.M_CODE AND AA.WIDTH_CD = BB.SIZE)`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkMNAME":
        (async () => {
          let kqua;
          let query = `SELECT DISTINCT M_NAME FROM M090 WHERE M_NAME LIKE '%${DATA.M_NAME}%'`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "getcndb1data":
        (async () => {
          let kqua;
          let query = `SELECT Z_CNDBTABLE.CTR_CD,Z_CNDBTABLE.CNDB_DATE,Z_CNDBTABLE.CNDB_NO,Z_CNDBTABLE.CNDB_ENCODE,Z_CNDBTABLE.M_NAME,Z_CNDBTABLE.DEFECT_NAME,Z_CNDBTABLE.DEFECT_CONTENT,Z_CNDBTABLE.REMARK,M010.EMPL_NAME AS REG_EMPL_NAME FROM Z_CNDBTABLE JOIN M010 ON  M010.EMPL_NO = Z_CNDBTABLE.REG_EMPL_NO`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "getcndb2data":
        (async () => {
          let kqua;
          let query = `SELECT Z_SPECIAL_M_LOT.CTR_CD,Z_SPECIAL_M_LOT.CNDB_NO,Z_SPECIAL_M_LOT.CNDB_ENCODE,Z_SPECIAL_M_LOT.M_LOT_NO,I222.M_CODE,M090.M_NAME,M090.WIDTH_CD,Z_SPECIAL_M_LOT.SPECIAL_START,Z_SPECIAL_M_LOT.SPECIAL_END,Z_SPECIAL_M_LOT.UPDATE_HISTORY,Z_SPECIAL_M_LOT.REG_EMPL_NO,Z_SPECIAL_M_LOT.APPROVE_EMPL_NO,Z_SPECIAL_M_LOT.APPROVE_STATUS,Z_SPECIAL_M_LOT.INS_DATE,Z_SPECIAL_M_LOT.APPROVE_DATE_TIME,Z_SPECIAL_M_LOT.REMARK
                    FROM Z_SPECIAL_M_LOT JOIN I222 ON (Z_SPECIAL_M_LOT.M_LOT_NO = I222.M_LOT_NO) JOIN M090 ON (M090.M_CODE = I222.M_CODE)`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkMNAMEfromLot":
        (async () => {
          let kqua;
          let query = `SELECT O302.M_CODE, M090.M_NAME, M090.WIDTH_CD, O302.OUT_CFM_QTY, O302.ROLL_QTY, O302.LIEUQL_SX, O302.OUT_DATE FROM O302 JOIN M090 ON (M090.M_CODE = O302.M_CODE) WHERE O302.M_LOT_NO='${DATA.M_LOT_NO}'`;
          console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkMNAMEfromLotI222":
        (async () => {
          let kqua;
          let query = `SELECT M110.CUST_NAME_KD, I222.CUST_CD, I222.M_CODE, M090.M_NAME, M090.WIDTH_CD, I222.IN_CFM_QTY, I222.ROLL_QTY FROM I222 JOIN M090 ON (M090.M_CODE = I222.M_CODE) LEFT JOIN M110 ON (M110.CUST_CD = I222.CUST_CD) WHERE I222.M_LOT_NO='${DATA.M_LOT_NO}'`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkMNAMEfromLotI222Total":
        (async () => {
          let kqua;
          let query = ` SELECT  M_CODE, SUBSTRING(M_LOT_NO,1,6) AS LOTCMS, SUM(IN_CFM_QTY* ROLL_QTY) AS TOTAL_CFM_QTY, SUM(ROLL_QTY) AS TOTAL_ROLL FROM I222 WHERE M_CODE='${DATA.M_CODE}' AND  SUBSTRING(M_LOT_NO,1,6)='${DATA.LOTCMS}' GROUP BY  M_CODE, SUBSTRING(M_LOT_NO,1,6)  `;
          console.log(query);
          kqua = await queryDB(query);
          console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "checkPQC3_IDfromPLAN_ID":
        (async () => {
          let kqua;
          let query = `SELECT DISTINCT P501.PLAN_ID, ZTBPQC3TABLE.PQC3_ID,  ZTBPQC3TABLE.DEFECT_PHENOMENON FROM P501 LEFT JOIN ZTBPQC3TABLE ON (P501.PROCESS_LOT_NO = ZTBPQC3TABLE.PROCESS_LOT_NO) WHERE P501.PLAN_ID='${DATA.PLAN_ID}' AND ZTBPQC3TABLE.PQC3_ID is not null`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkCNDBNO":
        (async () => {
          let kqua;
          let query = `SELECT COUNT(CNDB_NO) AS CNDB_COUNT FROM Z_CNDBTABLE WHERE CNDB_NO='${DATA.CNDB_NO}'`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "insertcndb1data":
        (async () => {
          ////console.log(DATA);
          let kqua;
          let query = `INSERT INTO Z_CNDBTABLE (CTR_CD,CNDB_DATE,CNDB_NO,CNDB_ENCODE,M_NAME,DEFECT_NAME,DEFECT_CONTENT,REG_EMPL_NO,REMARK) VALUES ('002','${DATA.CNDB_DATE}','${DATA.CNDB_NO}','${DATA.CNDB_ENCODE}','${DATA.M_NAME}',N'${DATA.DEFECT_NAME}',N'${DATA.DEFECT_CONTENT}','${DATA.REG_EMPL_NO}',N'${DATA.REMARK}')`;
          //console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "insertcndb2data":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          ////console.log(DATA);
          let kqua;
          let query = `INSERT INTO Z_SPECIAL_M_LOT (CTR_CD,CNDB_NO,CNDB_ENCODE,M_LOT_NO,SPECIAL_START,SPECIAL_END,UPDATE_HISTORY,REG_EMPL_NO,APPROVE_STATUS,INS_DATE,REMARK) VALUES ('002','${DATA.CNDB_NO}','${DATA.CNDB_ENCODE}','${DATA.M_LOT_NO}','${DATA.SPECIAL_START}','${DATA.SPECIAL_END}','${EMPL_NO} | ${currenttime}','${EMPL_NO}','W','${currenttime}',N'${DATA.REMARK}')`;
          //console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "workdaycheck":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let kqua;
          let query = `SELECT COUNT(EMPL_NO) AS WORK_DAY FROM ZTBATTENDANCETB WHERE EMPL_NO='${EMPL_NO}' AND ON_OFF=1 AND APPLY_DATE >='${startOfYear}' `;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "tangcadaycheck":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let kqua;
          let query = `SELECT COUNT(EMPL_NO) AS TANGCA_DAY FROM ZTBATTENDANCETB WHERE EMPL_NO='${EMPL_NO}' AND ON_OFF=1 AND APPLY_DATE >='${startOfYear}' AND OVERTIME=1`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "nghidaycheck":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let kqua;
          let query = `SELECT COUNT(EMPL_NO) AS NGHI_DAY FROM ZTBOFFREGISTRATIONTB WHERE EMPL_NO = '${EMPL_NO}' AND APPLY_DATE >= '${startOfYear}' AND REASON_CODE <>2`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "xacnhanchamcong":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `UPDATE ZTBATTENDANCETB SET XACNHAN='${DATA.confirm_worktime}' WHERE EMPL_NO='${EMPL_NO}' AND APPLY_DATE='${DATA.confirm_date}' AND XACNHAN is null`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "countxacnhanchamcong":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = `SELECT COUNT(XACNHAN) AS COUTNXN FROM ZTBATTENDANCETB WHERE EMPL_NO='${EMPL_NO}' AND XACNHAN is not null AND APPLY_DATE >='${startOfYear}' `;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "danhsachqc":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = `SELECT * FROM ZTBEMPLINFO WHERE FIRST_NAME LIKE N'%${DATA.SEARCHNAME}%'`;
          if (DATA.SEARCHNAME == "") query = `SELECT * FROM ZTBEMPLINFO`;
          ////console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "countthuongphat":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let querythuong = `SELECT isnull(SUM(DIEM),0) AS THUONG FROM ZTBTHUONGPHATTB WHERE TP_EMPL_NO='${EMPL_NO}' AND PL_HINHTHUC='KT'`;
          let queryphat = `SELECT isnull(SUM(DIEM),0) AS PHAT FROM ZTBTHUONGPHATTB WHERE TP_EMPL_NO='${EMPL_NO}' AND PL_HINHTHUC='KL'`;
          ////console.log(query);
          kquathuong = await queryDB(querythuong);
          kquaphat = await queryDB(queryphat);
          kqua = {
            tk_status: "OK",
            data: { count_thuong: kquathuong.data, count_phat: kquaphat.data },
          };
          res.send(kqua);
        })();
        break;
      case "get_invoice":
        //console.log(qr);
        (async () => {
          ////console.log(DATA);
          //let EMPL_NO = req.payload_data['EMPL_NO'];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          switch (DATA.OPTIONS) {
            case "Tra cứu PO":
              //console.log('vao po');
              query = ` SELECT ZTBPOTable.PO_ID,DATEPART(isowk, PO_DATE) AS WEEKNUM,M010.EMPL_NAME,ZTBPOTable.CUST_CD,M110.CUST_NAME_KD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,M100.G_NAME,M100.G_NAME_KD,ZTBPOTable.PO_NO,ZTBPOTable.PO_DATE,ZTBPOTable.RD_DATE, ZTBPOTable.PROD_PRICE,ZTBPOTable.PO_QTY,  isnull(ZTBDELI.DELIVERY_QTY,0) AS DELIVERY_QTY , (ZTBPOTable.PO_QTY- isnull(ZTBDELI.DELIVERY_QTY,0)) AS PO_BALANCE_QTY,  
                            isnull((ZTBPOTable.PROD_PRICE*ZTBPOTable.PO_QTY),0) AS PO_AMOUNT , isnull((ZTBDELI.DELIVERY_QTY* ZTBPOTable.PROD_PRICE),0) AS DELIVERED_AMOUNT, isnull(((ZTBPOTable.PO_QTY- isnull(ZTBDELI.DELIVERY_QTY,0))*ZTBPOTable.PROD_PRICE),0) AS PO_BALANCE_AMOUNT, M100.PROD_TYPE, M100.PROD_MODEL, M100.PROD_PROJECT, ZTBPOTable.REMARK
                            FROM ZTBPOTable
                            LEFT JOIN M110 ON (M110.CUST_CD = ZTBPOTable.CUST_CD)
                            LEFT JOIN M100 ON (M100.G_CODE = ZTBPOTable.G_CODE)
                            LEFT JOIN (SELECT CUST_CD, G_CODE, PO_NO, SUM(DELIVERY_QTY) AS DELIVERY_QTY FROM  ZTBDelivery GROUP BY CUST_CD, PO_NO, G_CODE) AS ZTBDELI ON ( ZTBDELI.PO_NO = ZTBPOTable.PO_NO AND ZTBDELI.G_CODE = ZTBPOTable.G_CODE AND ZTBDELI.CUST_CD = ZTBPOTable.CUST_CD)
                            LEFT JOIN M010 ON (ZTBPOTable.EMPL_NO = M010.EMPL_NO)
                            ${generate_condition_get_po(
                              DATA.ALLTIME,
                              DATA.FROM_DATE,
                              DATA.TO_DATE,
                              DATA.CUST_NAME,
                              DATA.G_CODE,
                              DATA.G_NAME,
                              DATA.PROD_TYPE,
                              DATA.EMPL_NAME,
                              DATA.PO_NO,
                              "",
                              "",
                              "",
                              "",
                              ""
                            )}
                            ORDER BY ZTBPOTable.PO_ID DESC`;
              //console.log(query);
              kqua = await queryDB(query);
              ////console.log(kqua);
              res.send(kqua);
              break;
            case "Tra cứu invoice":
              //console.log('vao invoice');
              query = `SELECT M100.G_NAME, ZTBDelivery.G_CODE, M010.EMPL_NAME, M110.CUST_NAME_KD, ZTBDelivery.DELIVERY_DATE, ZTBDelivery.DELIVERY_QTY, ZTBPOTable.PROD_PRICE, (ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE) AS DELIVERED_AMOUNT, ZTBPOTable.PO_NO, M100.PROD_TYPE FROM ZTBDelivery
                            JOIN M100 ON (M100.G_CODE = ZTBDelivery.G_CODE)
                            JOIN ZTBPOTable ON (ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD)
                            JOIN M110 ON (M110.CUST_CD = ZTBDelivery.CUST_CD)
                            JOIN M010 ON (M010.EMPL_NO = ZTBDelivery.EMPL_NO)
                             ${generate_condition_get_invoice(
                               DATA.ALLTIME,
                               DATA.FROM_DATE,
                               DATA.TO_DATE,
                               DATA.CUST_NAME,
                               DATA.G_CODE,
                               DATA.G_NAME,
                               DATA.PROD_TYPE,
                               DATA.EMPL_NAME,
                               DATA.PO_NO
                             )} ORDER BY ZTBDelivery.DELIVERY_ID DESC`;
              //console.log(query);
              kqua = await queryDB(query);
              ////console.log(kqua);
              res.send(kqua);
              break;
            case "Tra cứu kế hoạch":
              break;
            case "Tra cứu FCST":
              break;
            case "Tra cứu YCSX":
              break;
          }
          //query = `SELECT * FROM ZTBEMPLINFO`;
        })();
        break;
      case "get_inspection":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          switch (DATA.OPTIONS) {
            case "Nhập Kiểm (LOT)":
              query = `SELECT ZTBINSPECTINPUTTB.INSPECT_INPUT_ID,M110.CUST_NAME_KD, M010.EMPL_NAME,ZTBINSPECTINPUTTB.G_CODE,M100.G_NAME,M100.PROD_TYPE,M100.G_NAME_KD,ZTBINSPECTINPUTTB.PROD_REQUEST_NO,P400.PROD_REQUEST_DATE,P400.PROD_REQUEST_QTY,ZTBINSPECTINPUTTB.PROCESS_LOT_NO,P501_A.INS_DATE AS PROD_DATETIME, ZTBINSPECTINPUTTB.INPUT_DATETIME,ZTBINSPECTINPUTTB.INPUT_QTY_EA,ZTBINSPECTINPUTTB.INPUT_QTY_KG,ZTBINSPECTINPUTTB.REMARK,ZTBINSPECTINPUTTB.CNDB_ENCODES,P400.EMPL_NO AS PIC_KD
                            FROM ZTBINSPECTINPUTTB
                            LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = ZTBINSPECTINPUTTB.PROD_REQUEST_NO)
                            LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)                   
                            LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE>'2021-07-01') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBINSPECTINPUTTB.PROCESS_LOT_NO)
                            LEFT JOIN M100 ON (M100.G_CODE = ZTBINSPECTINPUTTB.G_CODE)
                            LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD)                     
                            ${generate_condition_get_inspection_input(
                              DATA.ALLTIME,
                              DATA.FROM_DATE,
                              DATA.TO_DATE,
                              DATA.CUST_NAME,
                              DATA.G_CODE,
                              DATA.G_NAME,
                              DATA.PROD_TYPE,
                              DATA.EMPL_NAME,
                              DATA.PROD_REQUEST_NO
                            )}
                            ORDER BY ZTBINSPECTINPUTTB.INSPECT_INPUT_ID DESC`;
              //console.log(query);
              kqua = await queryDB(query);
              ////console.log(kqua);
              res.send(kqua);
              break;
            case "Xuất Kiểm (LOT)":
              query = `SELECT ZTBINSPECTOUTPUTTB.STATUS, ZTBINSPECTOUTPUTTB.INSPECT_OUTPUT_ID,M110.CUST_NAME_KD, M010.EMPL_NAME,ZTBINSPECTOUTPUTTB.G_CODE,M100.G_NAME,M100.PROD_TYPE,M100.G_NAME_KD,ZTBINSPECTOUTPUTTB.PROD_REQUEST_NO,P400.PROD_REQUEST_DATE,P400.PROD_REQUEST_QTY,ZTBINSPECTOUTPUTTB.PROCESS_LOT_NO,P501_A.INS_DATE AS PROD_DATETIME, ZTBINSPECTOUTPUTTB.OUTPUT_DATETIME,ZTBINSPECTOUTPUTTB.OUTPUT_QTY_EA,ZTBINSPECTOUTPUTTB.REMARK,P400.EMPL_NO AS PIC_KD,CASE 
                            WHEN (DATEPART(HOUR,OUTPUT_DATETIME) >=8 AND DATEPART(HOUR,OUTPUT_DATETIME) <20) THEN 'CA NGAY'
                            ELSE 'CA DEM' END AS CA_LAM_VIEC,
                            CASE 
                            WHEN DATEPART(HOUR,OUTPUT_DATETIME) < 8  THEN CONVERT(date,DATEADD(DAY,-1,OUTPUT_DATETIME))
                            ELSE CONVERT(date,OUTPUT_DATETIME) END  AS NGAY_LAM_VIEC
                            FROM ZTBINSPECTOUTPUTTB
                            LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = ZTBINSPECTOUTPUTTB.PROD_REQUEST_NO)
                            LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)                    
                            LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE>'2021-07-01') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBINSPECTOUTPUTTB.PROCESS_LOT_NO)
                            LEFT JOIN M100 ON (M100.G_CODE = ZTBINSPECTOUTPUTTB.G_CODE)
                            LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD)
                             ${generate_condition_get_inspection_output(
                               DATA.ALLTIME,
                               DATA.FROM_DATE,
                               DATA.TO_DATE,
                               DATA.CUST_NAME,
                               DATA.G_CODE,
                               DATA.G_NAME,
                               DATA.PROD_TYPE,
                               DATA.EMPL_NAME,
                               DATA.PROD_REQUEST_NO
                             )} ORDER BY ZTBINSPECTOUTPUTTB.INSPECT_OUTPUT_ID DESC`;
              //console.log(query);
              kqua = await queryDB(query);
              ////console.log(kqua);
              res.send(kqua);
              break;
            case "Nhập Xuất Kiểm (YCSX)":
              query = `  SELECT M010.EMPL_NAME AS PIC_KD,M110.CUST_NAME_KD, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, INPUTTB.PROD_REQUEST_NO, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, INPUTTB.INPUT_QTY AS LOT_TOTAL_INPUT_QTY_EA, isnull(OUTPUTTB.OUTPUT_QTY,0) AS LOT_TOTAL_OUTPUT_QTY_EA, isnull(INSPECTTABLE.DA_KIEM_TRA,0) AS DA_KIEM_TRA, isnull(INSPECTTABLE.OK_QTY,0) AS OK_QTY, isnull(INSPECTTABLE.LOSS_NG_QTY,0) AS LOSS_NG_QTY, (isnull(INPUTTB.INPUT_QTY,0) -  isnull(INSPECTTABLE.DA_KIEM_TRA,0)) AS INSPECT_BALANCE FROM 
                            (SELECT PROD_REQUEST_NO, SUM(INPUT_QTY_EA) AS INPUT_QTY FROM ZTBINSPECTINPUTTB  GROUP BY PROD_REQUEST_NO) AS INPUTTB
                           LEFT JOIN (SELECT PROD_REQUEST_NO, SUM(OUTPUT_QTY_EA) AS OUTPUT_QTY FROM ZTBINSPECTOUTPUTTB  GROUP BY PROD_REQUEST_NO) AS OUTPUTTB
                            ON (INPUTTB.PROD_REQUEST_NO = OUTPUTTB.PROD_REQUEST_NO)
                            LEFT JOIN (SELECT PROD_REQUEST_NO, SUM(INSPECT_TOTAL_QTY) AS DA_KIEM_TRA,SUM(INSPECT_OK_QTY) AS OK_QTY,SUM(INSPECT_TOTAL_QTY- INSPECT_OK_QTY) AS LOSS_NG_QTY FROM ZTBINSPECTNGTB GROUP BY PROD_REQUEST_NO) AS INSPECTTABLE ON (INPUTTB.PROD_REQUEST_NO = INSPECTTABLE.PROD_REQUEST_NO)
                            LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = INPUTTB.PROD_REQUEST_NO)
                            LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE)
                            LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)
                            LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD) 
                             ${generate_condition_get_inspection_inoutycsx(
                               DATA.CUST_NAME,
                               DATA.G_CODE,
                               DATA.G_NAME,
                               DATA.PROD_TYPE,
                               DATA.EMPL_NAME,
                               DATA.PROD_REQUEST_NO
                             )} ORDER BY P400.PROD_REQUEST_DATE DESC`;
              //console.log(query);
              kqua = await queryDB(query);
              ////console.log(kqua);
              res.send(kqua);
              break;
            case "Nhật Ký Kiểm Tra":
              query = `SELECT ZTBINSPECTNGTB.INSPECT_ID, CONCAT(datepart(YEAR,INSPECT_START_TIME),'_',datepart(ISO_WEEK,DATEADD(day,2,INSPECT_START_TIME))) AS YEAR_WEEK, M110.CUST_NAME_KD,ZTBINSPECTNGTB.PROD_REQUEST_NO,M100.G_NAME_KD,M100.G_NAME,ZTBINSPECTNGTB.G_CODE,M100.PROD_TYPE,ZTBINSPECTNGTB.M_LOT_NO,isnull(M090.M_NAME,'NO_INFO') as M_NAME,isnull(M090.WIDTH_CD,0) as WIDTH_CD,ZTBINSPECTNGTB.EMPL_NO AS INSPECTOR,ZTBINSPECTNGTB.LINEQC_PIC AS LINEQC,ZTBINSPECTNGTB.PROD_PIC,M100.CODE_33 AS UNIT ,ZTBINSPECTNGTB.PROCESS_LOT_NO,ZTBINSPECTNGTB.PROCESS_IN_DATE,ZTBINSPECTNGTB.INSPECT_DATETIME, ZTBINSPECTNGTB.INSPECT_START_TIME,ZTBINSPECTNGTB.INSPECT_FINISH_TIME,ZTBINSPECTNGTB.FACTORY,ZTBINSPECTNGTB.LINEQC_PIC,ZTBINSPECTNGTB.MACHINE_NO,ZTBINSPECTNGTB.INSPECT_TOTAL_QTY,ZTBINSPECTNGTB.INSPECT_OK_QTY,CAST(INSPECT_TOTAL_QTY AS float)/(CAST(DATEDIFF(MINUTE, ZTBINSPECTNGTB.INSPECT_START_TIME,ZTBINSPECTNGTB.INSPECT_FINISH_TIME) AS float) / CAST(60 as float) )  AS INSPECT_SPEED,(ERR1+ERR2+ERR3) AS INSPECT_TOTAL_LOSS_QTY, (ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS INSPECT_TOTAL_NG_QTY, (ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11) AS MATERIAL_NG_QTY, (ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS PROCESS_NG_QTY,M100.PROD_LAST_PRICE AS PROD_PRICE,ZTBINSPECTNGTB.ERR1,ZTBINSPECTNGTB.ERR2,ZTBINSPECTNGTB.ERR3,ZTBINSPECTNGTB.ERR4,ZTBINSPECTNGTB.ERR5,ZTBINSPECTNGTB.ERR6,ZTBINSPECTNGTB.ERR7,ZTBINSPECTNGTB.ERR8,ZTBINSPECTNGTB.ERR9,ZTBINSPECTNGTB.ERR10,ZTBINSPECTNGTB.ERR11,ZTBINSPECTNGTB.ERR12,ZTBINSPECTNGTB.ERR13,ZTBINSPECTNGTB.ERR14,ZTBINSPECTNGTB.ERR15,ZTBINSPECTNGTB.ERR16,ZTBINSPECTNGTB.ERR17,ZTBINSPECTNGTB.ERR18,ZTBINSPECTNGTB.ERR19,ZTBINSPECTNGTB.ERR20,ZTBINSPECTNGTB.ERR21,ZTBINSPECTNGTB.ERR22,ZTBINSPECTNGTB.ERR23,ZTBINSPECTNGTB.ERR24,ZTBINSPECTNGTB.ERR25,ZTBINSPECTNGTB.ERR26,ZTBINSPECTNGTB.ERR27,ZTBINSPECTNGTB.ERR28,ZTBINSPECTNGTB.ERR29,ZTBINSPECTNGTB.ERR30,ZTBINSPECTNGTB.ERR31,ZTBINSPECTNGTB.ERR32, isnull(ZTBINSPECTNGTB.CNDB_ENCODES,'') AS CNDB_ENCODES  FROM ZTBINSPECTNGTB  LEFT JOIN M110 ON (ZTBINSPECTNGTB.CUST_CD = M110.CUST_CD)  LEFT JOIN M100 ON (ZTBINSPECTNGTB.G_CODE = M100.G_CODE) LEFT JOIN M090 ON(ZTBINSPECTNGTB.M_CODE = M090.M_CODE) 
                             ${generate_condition_get_inspection_ng_data(
                               DATA.ALLTIME,
                               DATA.FROM_DATE,
                               DATA.TO_DATE,
                               DATA.CUST_NAME,
                               DATA.G_CODE,
                               DATA.G_NAME,
                               DATA.PROD_TYPE,
                               DATA.EMPL_NAME,
                               DATA.PROD_REQUEST_NO
                             )} ORDER BY INSPECT_ID DESC`;
              //console.log(query);
              kqua = await queryDB(query);
              ////console.log(kqua);
              res.send(kqua);
              break;
          }
          //query = `SELECT * FROM ZTBEMPLINFO`;
        })();
        break;
      case "get_listcode":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = `SELECT G_CODE as id, G_NAME as name, PROD_LAST_PRICE from M100 WHERE USE_YN='Y'`;
          //console.log(query);
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "get_listcustomer":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = `SELECT CUST_TYPE, CUST_CD, CUST_NAME_KD, CUST_NAME,  CUST_ADDR1, CUST_ADDR2,CUST_ADDR3,TAX_NO, CUST_NUMBER,  BOSS_NAME, TEL_NO1, FAX_NO, CUST_POSTAL,  CHARGE_EMAIL AS EMAIL, REMK, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL FROM M110`;
          //console.log(query);
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "add_customer":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = `INSERT INTO M110 (CTR_CD, CUST_TYPE, CUST_CD, CUST_NAME, CUST_NAME_KD, CUST_ADDR1, TAX_NO,CUST_NUMBER, BOSS_NAME, TEL_NO1, FAX_NO, CUST_POSTAL,REMK, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL,CUST_ADDR2, CUST_ADDR3, CHARGE_EMAIL) VALUES ('002','${DATA.CUST_TYPE}','${DATA.CUST_CD}', N'${DATA.CUST_NAME}','${DATA.CUST_NAME_KD}',N'${DATA.CUST_ADDR1}','${DATA.TAX_NO}','${DATA.CUST_NUMBER}',N'${DATA.BOSS_NAME}','${DATA.TEL_NO1}','${DATA.FAX_NO}','${DATA.CUST_POSTAL}',N'${DATA.REMK}',GETDATE(), '${EMPL_NO}',GETDATE(), '${EMPL_NO}',N'${DATA.ADDR2}',N'${DATA.ADDR3}',N'${DATA.EMAIL}')`;
          //console.log(query);
          kqua = await queryDB(query);
          //console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "edit_customer":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = ` UPDATE M110 SET CUST_NAME = N'${DATA.CUST_NAME}', CUST_NAME_KD ='${DATA.CUST_NAME_KD}', CUST_ADDR1 =N'${DATA.CUST_ADDR1}', CUST_ADDR2 =N'${DATA.CUST_ADDR2}',CUST_ADDR3 =N'${DATA.CUST_ADDR3}',CHARGE_EMAIL =N'${DATA.EMAIL}',TAX_NO ='${DATA.TAX_NO}', CUST_NUMBER ='${DATA.CUST_NUMBER}',BOSS_NAME =N'${DATA.BOSS_NAME}',  TEL_NO1 ='${DATA.TEL_NO1}', FAX_NO ='${DATA.FAX_NO}', CUST_POSTAL ='${DATA.CUST_POSTAL}', REMK =N'${DATA.REMK}',CUST_TYPE =N'${DATA.CUST_TYPE}', UPD_EMPL ='${EMPL_NO}', UPD_DATE = GETDATE() WHERE CUST_CD='${DATA.CUST_CD}'`;
          //console.log(query);
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "checkMaterialExist":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = `SELECT * FROM ZTB_MATERIAL_TB WHERE M_NAME ='${DATA.M_NAME}'`;
          console.log(query);
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "addMaterial":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = `INSERT INTO ZTB_MATERIAL_TB (CTR_CD, M_NAME, DESCR, CUST_CD, SSPRICE, CMSPRICE, SLITTING_PRICE, MASTER_WIDTH, ROLL_LENGTH, USE_YN, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('002', '${DATA.M_NAME}',N'${DATA.DESCR}','${DATA.CUST_CD}','${DATA.SSPRICE}','${DATA.CMSPRICE}','${DATA.SLITTING_PRICE}','${DATA.MASTER_WIDTH}','${DATA.ROLL_LENGTH}', 'Y', GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}')`;
          console.log(query);
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "updateMaterial":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let startOfYear = moment().startOf("year").format("YYYY-MM-DD");
          let query = "";
          query = `UPDATE ZTB_MATERIAL_TB SET M_NAME='${DATA.M_NAME}', CUST_CD ='${DATA.CUST_CD}',DESCR =N'${DATA.DESCR}',SSPRICE ='${DATA.SSPRICE}',CMSPRICE ='${DATA.CMSPRICE}',SLITTING_PRICE ='${DATA.SLITTING_PRICE}', MASTER_WIDTH ='${DATA.MASTER_WIDTH}',ROLL_LENGTH ='${DATA.ROLL_LENGTH}',UPD_EMPL ='${EMPL_NO}', UPD_DATE=GETDATE(), USE_YN='${DATA.USE_YN}' WHERE M_ID='${DATA.M_ID}' `;
          console.log(query);
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "insert_po":
        (async () => {
          //////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBPOTable (CTR_CD, CUST_CD, EMPL_NO,G_CODE, PO_NO, PO_QTY, PO_DATE, RD_DATE, PROD_PRICE,REMARK) VALUES ('002','${
            DATA.CUST_CD
          }', '${DATA.EMPL_NO}','${DATA.G_CODE}', '${DATA.PO_NO}', '${
            DATA.PO_QTY
          }', '${DATA.PO_DATE}', '${DATA.RD_DATE}', '${DATA.PROD_PRICE}',N'${
            DATA.REMARK === undefined ? "" : DATA.REMARK
          }')`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_invoice":
        (async () => {
          //////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBDelivery (CTR_CD, CUST_CD, EMPL_NO, G_CODE, PO_NO, DELIVERY_QTY, DELIVERY_DATE, NOCANCEL, REMARK, INVOICE_NO) VALUES ('002','${
            DATA.CUST_CD
          }', '${DATA.EMPL_NO}', '${DATA.G_CODE}', '${DATA.PO_NO}', '${
            DATA.DELIVERY_QTY
          }', '${DATA.DELIVERY_DATE}', 1,'${DATA.REMARK}', '${
            DATA.INVOICE_NO === undefined ? "" : DATA.INVOICE_NO
          }')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "get_last_prod_request_no":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 PROD_REQUEST_NO FROM P400 ORDER BY INS_DATE DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_new_ycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = ` INSERT INTO P400 (CTR_CD, PROD_REQUEST_DATE, PROD_REQUEST_NO, CODE_50, CODE_03, CODE_55, G_CODE, RIV_NO, PROD_REQUEST_QTY, CUST_CD, EMPL_NO, DELIVERY_DT, REMK, G_CODE2) VALUES ('002', '${DATA.PROD_REQUEST_DATE}', '${DATA.PROD_REQUEST_NO}', '${DATA.CODE_50}', '${DATA.CODE_03}', '${DATA.CODE_55}', '${DATA.G_CODE}', '${DATA.RIV_NO}', '${DATA.PROD_REQUEST_QTY}', '${DATA.CUST_CD}', '${DATA.EMPL_NO}', '${DATA.DELIVERY_DATE}', '${DATA.REMARK}', '${DATA.G_CODE}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getmaindept":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECt MAINDEPTCODE AS id, CTR_CD, MAINDEPTCODE, MAINDEPTNAME, MAINDEPTNAME_KR FROM ZTBMAINDEPARMENT`;
          //console.log("Nguyen van hung");
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertmaindept":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `INSERT INTO ZTBMAINDEPARMENT (CTR_CD, MAINDEPTCODE, MAINDEPTNAME, MAINDEPTNAME_KR) VALUES ('002',${DATA.MAINDEPTCODE},N'${DATA.MAINDEPTNAME}',N'${DATA.MAINDEPTNAME_KR}')`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "updatemaindept":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `UPDATE ZTBMAINDEPARMENT SET MAINDEPTCODE=${DATA.MAINDEPTCODE}, MAINDEPTNAME='${DATA.MAINDEPTNAME}', MAINDEPTNAME_KR ='${DATA.MAINDEPTNAME_KR}' WHERE MAINDEPTCODE= ${DATA.MAINDEPTCODE}`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "deletemaindept":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `DELETE FROM ZTBMAINDEPARMENT WHERE MAINDEPTCODE= ${DATA.MAINDEPTCODE}`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "getsubdept":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT SUBDEPTCODE AS id, CTR_CD, MAINDEPTCODE, SUBDEPTCODE,SUBDEPTNAME, SUBDEPTNAME_KR FROM ZTBSUBDEPARTMENT WHERE MAINDEPTCODE=${DATA.MAINDEPTCODE}`;
          //console.log("Nguyen van hung");
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertsubdept":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `INSERT INTO ZTBSUBDEPARTMENT (CTR_CD, MAINDEPTCODE, SUBDEPTCODE, SUBDEPTNAME, SUBDEPTNAME_KR) VALUES ('002',${DATA.MAINDEPTCODE},${DATA.SUBDEPTCODE},N'${DATA.SUBDEPTNAME}',N'${DATA.SUBDEPTNAME_KR}')`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "updatesubdept":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `UPDATE ZTBSUBDEPARTMENT SET SUBDEPTCODE=${DATA.SUBDEPTCODE}, SUBDEPTNAME='${DATA.SUBDEPTNAME}', SUBDEPTNAME_KR ='${DATA.SUBDEPTNAME_KR}' WHERE SUBDEPTCODE= ${DATA.SUBDEPTCODE}`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "deletesubdept":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `DELETE FROM ZTBSUBDEPARTMENT WHERE SUBDEPTCODE= ${DATA.SUBDEPTCODE}`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "getworkposition":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT WORK_POSITION_CODE AS id, CTR_CD, SUBDEPTCODE, WORK_POSITION_CODE,WORK_POSITION_NAME, WORK_POSITION_NAME_KR, ATT_GROUP_CODE FROM ZTBWORKPOSITION WHERE SUBDEPTCODE=${DATA.SUBDEPTCODE}`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertworkposition":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `INSERT INTO ZTBWORKPOSITION (CTR_CD, SUBDEPTCODE, WORK_POSITION_CODE, WORK_POSITION_NAME, WORK_POSITION_NAME_KR, ATT_GROUP_CODE) VALUES ('002',${DATA.SUBDEPTCODE},${DATA.WORK_POSITION_CODE},N'${DATA.WORK_POSITION_NAME}',N'${DATA.WORK_POSITION_NAME_KR}',${DATA.ATT_GROUP_CODE})`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "updateworkposition":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `UPDATE ZTBWORKPOSITION SET SUBDEPTCODE=${DATA.SUBDEPTCODE}, WORK_POSITION_NAME='${DATA.WORK_POSITION_NAME}', WORK_POSITION_NAME_KR ='${DATA.WORK_POSITION_NAME_KR}' WHERE WORK_POSITION_CODE= ${DATA.WORK_POSITION_CODE}`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "deleteworkposition":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `DELETE FROM ZTBWORKPOSITION WHERE WORK_POSITION_CODE= ${DATA.WORK_POSITION_CODE}`;
            ////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "getemployee_full":
        (async () => {
          //////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTBEMPLINFO.NV_CCID, ZTBEMPLINFO.EMPL_NO AS id, ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE, PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBEMPLINFO.CTR_CD,ZTBSEX.SEX_CODE,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_CODE,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_CODE,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_CODE,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_CODE,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIFT_CODE,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.WORK_POSITION_CODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.SUBDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTCODE,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR  FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE)`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertemployee":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let setpdQuery = `INSERT INTO ZTBEMPLINFO (CTR_CD,EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,NV_CCID) VALUES ('002',N'${DATA.EMPL_NO}' ,N'${DATA.CMS_ID}' ,N'${DATA.FIRST_NAME}' ,N'${DATA.MIDLAST_NAME}' ,N'${DATA.DOB}' ,N'${DATA.HOMETOWN}' ,N'${DATA.SEX_CODE}' ,N'${DATA.ADD_PROVINCE}' ,N'${DATA.ADD_DISTRICT}' ,N'${DATA.ADD_COMMUNE}' ,N'${DATA.ADD_VILLAGE}' ,N'${DATA.PHONE_NUMBER}' ,N'${DATA.WORK_START_DATE}' ,N'${DATA.PASSWORD}' ,N'${DATA.EMAIL}' ,N'${DATA.WORK_POSITION_CODE}' ,N'${DATA.WORK_SHIFT_CODE}' ,N'${DATA.POSITION_CODE}' ,N'${DATA.JOB_CODE}' ,N'${DATA.FACTORY_CODE}' ,N'${DATA.WORK_STATUS_CODE}',${DATA.NV_CCID})`;
            ////console.log(setpdQuery);
            let insertoldempl = `INSERT INTO M010 (CTR_CD,EMPL_NO, EMPL_NAME, PASSWD) VALUES ('002','${
              DATA.EMPL_NO
            }','${removeVietnameseTones(
              DATA.MIDLAST_NAME
            )} ${removeVietnameseTones(DATA.FIRST_NAME)}','${DATA.PASSWORD}')`;
            console.log(insertoldempl);
            checkkq = await queryDB(insertoldempl);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "updateemployee":
        (async () => {
          ////console.log(DATA);
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (JOB_NAME === "Leader" || JOB_NAME === "ADMIN") {
            let checkkq = "OK";
            let checkresigndate =
              DATA.WORK_STATUS_CODE === 0
                ? `, RESIGN_DATE='${DATA.RESIGN_DATE}'`
                : ``;
            let setpdQuery = `UPDATE ZTBEMPLINFO SET CMS_ID= N'${DATA.CMS_ID}' ,FIRST_NAME= N'${DATA.FIRST_NAME}' ,MIDLAST_NAME= N'${DATA.MIDLAST_NAME}' ,DOB= N'${DATA.DOB}' ,HOMETOWN= N'${DATA.HOMETOWN}' ,SEX_CODE= N'${DATA.SEX_CODE}' ,ADD_PROVINCE= N'${DATA.ADD_PROVINCE}' ,ADD_DISTRICT= N'${DATA.ADD_DISTRICT}' ,ADD_COMMUNE= N'${DATA.ADD_COMMUNE}' ,ADD_VILLAGE= N'${DATA.ADD_VILLAGE}' ,PHONE_NUMBER= N'${DATA.PHONE_NUMBER}' ,WORK_START_DATE= N'${DATA.WORK_START_DATE}' ,PASSWORD= N'${DATA.PASSWORD}' ,EMAIL= N'${DATA.EMAIL}' ,WORK_POSITION_CODE= N'${DATA.WORK_POSITION_CODE}' ,WORK_SHIFT_CODE= N'${DATA.WORK_SHIFT_CODE}' ,POSITION_CODE= N'${DATA.POSITION_CODE}' ,JOB_CODE= N'${DATA.JOB_CODE}' ,FACTORY_CODE= N'${DATA.FACTORY_CODE}' ,WORK_STATUS_CODE= N'${DATA.WORK_STATUS_CODE}', NV_CCID=${DATA.NV_CCID} ${checkresigndate} WHERE EMPL_NO= '${DATA.EMPL_NO}'`;
            console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            //console.log(checkkq);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Bạn không phải leader" });
          }
        })();
        break;
      case "diemdanhnhom":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $team_name = DATA.team_name_list;
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          let $condition = "";
          switch ($team_name) {
            case 0:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 2";
              break;
            case 1:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 1";
              break;
            case 2:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =1";
              break;
            case 3:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =2";
              break;
            case 4:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =0";
              break;
            case 5:
              $condition = "";
              break;
          }
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let today_format = moment().format("YYYY-MM-DD");
            //console.log(today_format);
            //let today_format = '2022-09-30';
            let tradiemdanhQuery =
              "DECLARE @tradate DATE SET @tradate='" +
              today_format +
              "' SELECT ZTBEMPLINFO.EMPL_NO as id,ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,ZTBEMPLINFO.WORK_POSITION_CODE, WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME, ZTBOFFREGISTRATIONTB_1.REMARK FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE ZTBWORKPOSITION.ATT_GROUP_CODE = " +
              $vitrilamviec +
              " AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 " +
              $condition;
            if (JOB_NAME == "Leader")
              tradiemdanhQuery =
                "DECLARE @tradate DATE SET @tradate='" +
                today_format +
                "' SELECT ZTBEMPLINFO.EMPL_NO as id,ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,ZTBEMPLINFO.WORK_POSITION_CODE, WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME, ZTBOFFREGISTRATIONTB_1.REMARK FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE  (ZTBWORKPOSITION.ATT_GROUP_CODE = " +
                $vitrilamviec +
                " OR ZTBSUBDEPARTMENT.SUBDEPTNAME = '" +
                $subdeptname +
                "') AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 " +
                $condition;
            ////console.log(tradiemdanhQuery);
            //checkkq = await asyncQuery(tradiemdanhQuery);x
            checkkq = await queryDB(tradiemdanhQuery);
            res.send(checkkq);
            ////console.log('check kq = ' + checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Không phải leader" });
          }
        })();
        break;
      case "diemdanhnhomBP":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let MAINDEPTCODE = req.payload_data["MAINDEPTCODE"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $team_name = DATA.team_name_list;
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          let $condition = "";
          switch ($team_name) {
            case 0:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 2";
              break;
            case 1:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 1";
              break;
            case 2:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =1";
              break;
            case 3:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =2";
              break;
            case 4:
              $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =0";
              break;
            case 5:
              $condition = "";
              break;
          }
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let today_format = moment().format("YYYY-MM-DD");
            //console.log(today_format);
            //let today_format = '2022-09-30';
            let tradiemdanhQuery = `DECLARE @tradate DATE SET @tradate='${today_format}' SELECT ZTBEMPLINFO.EMPL_NO as id,ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,ZTBEMPLINFO.WORK_POSITION_CODE, WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME, ZTBOFFREGISTRATIONTB_1.REMARK FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE ZTBMAINDEPARMENT.MAINDEPTCODE=${MAINDEPTCODE} AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 ${$condition}`;
            //console.log(tradiemdanhQuery);
            //checkkq = await asyncQuery(tradiemdanhQuery);x
            checkkq = await queryDB(tradiemdanhQuery);
            res.send(checkkq);
            ////console.log('check kq = ' + checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Không phải leader" });
          }
        })();
        break;
      case "setdiemdanhnhom":
        //console.log(qr);
        (async () => {
          let kqua;
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let CURRENT_TEAM = DATA.CURRENT_TEAM;
          let CURRENT_CA = DATA.CURRENT_CA;
          //console.log("CURRENT_TEAM:" + CURRENT_TEAM);
          let diemdanhvalue = DATA.diemdanhvalue;
          let EMPL_NO = DATA.EMPL_NO;
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            //var today_format = moment().format('YYYY-MM-DD');
            var today_format = moment().format("YYYY-MM-DD");
            let checkAttQuery =
              "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND APPLY_DATE='" +
              today_format +
              "'";
            //console.log(checkAttQuery);
            let checkAttKQ = await queryDB(checkAttQuery);
            //console.log('checkqa = ' + checkAttKQ);
            //console.log(checkAttKQ);
            if (checkAttKQ.tk_status === "NG") {
              //console.log('Chua diem danh, se them moi diem danh');
              let insert_diemdanhQuery =
                "INSERT INTO ZTBATTENDANCETB (CTR_CD, EMPL_NO, APPLY_DATE, ON_OFF, CURRENT_TEAM, CURRENT_CA) VALUES ('002','" +
                EMPL_NO +
                "','" +
                today_format +
                "'," +
                diemdanhvalue +
                ",'" +
                CURRENT_TEAM +
                "','" +
                CURRENT_CA +
                "')";
              console.log(insert_diemdanhQuery);
              let insert_dd = await queryDB(insert_diemdanhQuery);
              res.send(insert_dd);
            } else {
              let update_diemdanhQuery =
                "UPDATE ZTBATTENDANCETB SET ON_OFF = " +
                diemdanhvalue +
                ", CURRENT_TEAM='" +
                CURRENT_TEAM +
                "' WHERE  EMPL_NO='" +
                EMPL_NO +
                "' AND APPLY_DATE='" +
                today_format +
                "'";
              let update_dd = await queryDB(update_diemdanhQuery);
              res.send(update_dd);
              //console.log('da diem danh, update gia tri diem danh');
            }
          } else {
            res.send("NO_LEADER");
          }
        })();
        break;
      case "dangkytangcanhom":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = DATA.EMPL_NO;
          let OVERTIME_INFO = DATA.overtime_info;
          let tangcavalue = DATA.tangcavalue;
          var today = new Date();
          //var today_format = moment().format('YYYY-MM-DD');
          var today_format = moment().format("YYYY-MM-DD");
          let checkkq = "OK";
          let checkAttQuery =
            "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
            EMPL_NO +
            "' AND APPLY_DATE='" +
            today_format +
            "'";
          //console.log(checkAttQuery);
          let checkAttKQ = await queryDB(checkAttQuery);
          if (checkAttKQ.tk_status == "OK") {
            let query =
              "UPDATE ZTBATTENDANCETB SET OVERTIME=" +
              tangcavalue +
              ", OVERTIME_INFO='" +
              OVERTIME_INFO +
              "' WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND ON_OFF=1 AND APPLY_DATE='" +
              today_format +
              "'";
            //console.log(query);
            kqua = await queryDB(query);
            if (kqua.tk_status == "OK") {
              res.send(kqua);
            } else {
              res.send({
                tk_status: "NG",
                message: "Chưa điểm danh nên không tăng ca được",
              });
            }
            //console.log(kqua);
          } else {
            res.send({
              tk_status: "NG",
              message: "Chưa điểm danh nên không tăng ca được",
            });
          }
        })();
        break;
      case "setteamnhom":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = DATA.EMPL_NO;
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $teamvalue = DATA.teamvalue;
          ////console.log($teamvalue +  EMPL_NO);
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let checkkq = "OK";
            let setpdQuery =
              "UPDATE ZTBEMPLINFO SET WORK_SHIFT_CODE=" +
              $teamvalue +
              " WHERE EMPL_NO='" +
              EMPL_NO +
              "'";
            let updateam_diemdanh = `UPDATE ZTBATTENDANCETB SET CURRENT_TEAM= ${$teamvalue} WHERE APPLY_DATE ='${moment().format(
              "YYYY-MM-DD"
            )}' AND EMPL_NO='${DATA.EMPL_NO}'`;
            //////console.log(setpdQuery);
            checkkq = await queryDB(setpdQuery);
            checkkq2 = await queryDB(updateam_diemdanh);
            res.send(checkkq);
          } else {
            res.send({ tk_status: "NG", message: "Không phải leader" });
          }
        })();
        break;
      case "dangkynghi2":
        //console.log(qr);
        (async () => {
          let kqua;
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_DATE = DATA.ngaybatdau;
          let END_DATE = DATA.ngayketthuc;
          let REASON_CODE = DATA.reason_code;
          let REMARK_CONTENT = DATA.remark_content;
          let CANGHI = DATA.canghi;
          var from = new Date(START_DATE);
          var to = new Date(END_DATE);
          var today = new Date();
          var today_format = moment().format("YYYY-MM-DD");
          let checkkq = "OK";
          if (CANGHI === 1) {
            for (var day = from; day <= to; day.setDate(day.getDate() + 1)) {
              let apply_date = moment(day).format("YYYY-MM-DD");
              //console.log(apply_date);
              let query = `INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','${EMPL_NO}','${today_format}','${apply_date}',${REASON_CODE},N'${REMARK_CONTENT}',2,${CANGHI})`;
              //console.log(query);
              kqua = await queryDB(query);
              if (kqua.tk_status != "OK") checkkq = "NG";
            }
          } else if (CANGHI === 2) {
            for (var day = from; day < to; day.setDate(day.getDate() + 1)) {
              let apply_date = moment(day).format("YYYY-MM-DD");
              //console.log(apply_date);
              let query = `INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','${EMPL_NO}','${today_format}','${apply_date}',${REASON_CODE},N'${REMARK_CONTENT}',2,${CANGHI})`;
              //console.log(query);
              kqua = await queryDB(query);
              if (kqua.tk_status != "OK") checkkq = "NG";
            }
          }
          if (checkkq === "OK") {
            res.send({ tk_status: "OK" });
          } else {
            res.send({
              tk_status: "NG",
              message: "Ngày đã dược đăng ký rồi, không thể đăng ký lại",
            });
          }
        })();
        //res.send('ket qua tra ve' + req.cookies.token);
        break;
      case "dangkynghi2_AUTO":
        //console.log(qr);
        (async () => {
          let kqua;
          //console.log(DATA);
          let EMPL_NO = DATA.EMPL_NO;
          let START_DATE = DATA.ngaybatdau;
          let END_DATE = DATA.ngayketthuc;
          let REASON_CODE = DATA.reason_code;
          let REMARK_CONTENT = DATA.remark_content;
          let CANGHI = DATA.canghi;
          var from = new Date(START_DATE);
          var to = new Date(END_DATE);
          var today = new Date();
          var today_format = moment().format("YYYY-MM-DD");
          let checkkq = "OK";
          if (CANGHI === 1) {
            for (var day = from; day <= to; day.setDate(day.getDate() + 1)) {
              let apply_date = moment(day).format("YYYY-MM-DD");
              //console.log(apply_date);
              let query = `INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','${EMPL_NO}','${today_format}','${apply_date}',${REASON_CODE},N'${REMARK_CONTENT}',1,${CANGHI})`;
              //console.log(query);
              kqua = await queryDB(query);
              if (kqua.tk_status != "OK") checkkq = "NG";
            }
          } else if (CANGHI === 2) {
            for (var day = from; day < to; day.setDate(day.getDate() + 1)) {
              let apply_date = moment(day).format("YYYY-MM-DD");
              //console.log(apply_date);
              let query = `INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','${EMPL_NO}','${today_format}','${apply_date}',${REASON_CODE},N'${REMARK_CONTENT}',1,${CANGHI})`;
              //console.log(query);
              kqua = await queryDB(query);
              if (kqua.tk_status != "OK") checkkq = "NG";
            }
          }
          if (checkkq === "OK") {
            res.send({ tk_status: "OK" });
          } else {
            res.send({
              tk_status: "NG",
              message: "Ngày đã dược đăng ký rồi, không thể đăng ký lại",
            });
          }
        })();
        //res.send('ket qua tra ve' + req.cookies.token);
        break;
      case "dangkytangcacanhan":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_TIME = DATA.over_start;
          let FINISH_TIME = DATA.over_finish;
          let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
          if (isNumber(START_TIME) && isNumber(FINISH_TIME)) {
            //console.log("la number");
            var today = new Date();
            var today_format = moment().format("YYYY-MM-DD");
            let checkAttQuery =
              "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" +
              EMPL_NO +
              "' AND APPLY_DATE='" +
              today_format +
              "'";
            let checkAttKQ = await queryDB(checkAttQuery);
            if (checkAttKQ.tk_status != "NG") {
              let query =
                "UPDATE ZTBATTENDANCETB SET OVERTIME=1, OVERTIME_INFO='" +
                OVERTIME_INFO +
                "' WHERE EMPL_NO='" +
                EMPL_NO +
                "' AND ON_OFF=1 AND APPLY_DATE='" +
                today_format +
                "'";
              kqua = await queryDB(query);
              res.send(kqua);
            } else {
              res.send({
                tk_status: "NG",
                message: "Lỗi, chưa điểm danh nên không đăng ký tăng ca được",
              });
            }
          } else {
            res.send({
              tk_status: "NG",
              message: "Lỗi, nhập sai định dạng giờ phút",
            });
          }
        })();
        break;
      case "pheduyetnhom":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query = "";
            if (JOB_NAME == "Leader") {
              query =
                "SELECT ZTBOFFREGISTRATIONTB.OFF_ID AS id, ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE (ZTBSUBDEPARTMENT.SUBDEPTNAME='" +
                $subdeptname +
                "' OR ZTBWORKPOSITION.ATT_GROUP_CODE='" +
                $vitrilamviec +
                "') ORDER BY OFF_ID DESC";
            } else {
              query =
                "SELECT ZTBOFFREGISTRATIONTB.OFF_ID AS id,ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE ZTBWORKPOSITION.ATT_GROUP_CODE='" +
                $vitrilamviec +
                "' ORDER BY OFF_ID DESC";
            }
            console.log(query);
            kqua = await queryDB(query);
            // //console.log(kqua);
            res.send(kqua);
          } else {
            res.send({
              tk_status: "NG",
              message: "Không phải leader or staff",
            });
          }
        })();
        break;
      case "pheduyetnhomBP":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTCODE = req.payload_data["MAINDEPTCODE"];
          let $vitrilamviec = req.payload_data["ATT_GROUP_CODE"];
          let $subdeptname = req.payload_data["SUBDEPTNAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query = `SELECT ZTBOFFREGISTRATIONTB.OFF_ID AS id, ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE ZTBMAINDEPARMENT.MAINDEPTCODE=${MAINDEPTCODE}  ORDER BY OFF_ID DESC`;
            kqua = await queryDB(query);
            // //console.log(kqua);
            res.send(kqua);
          } else {
            res.send({
              tk_status: "NG",
              message: "Không phải leader or staff",
            });
          }
        })();
        break;
      case "setpheduyetnhom":
        //console.log(qr);
        (async () => {
          let kqua;
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let $off_id = DATA.off_id;
          let $pheduyetvalue = DATA.pheduyetvalue;
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            var today = new Date();
            let checkkq = "OK";
            let setpdQuery =
              "UPDATE ZTBOFFREGISTRATIONTB SET APPROVAL_STATUS=" +
              $pheduyetvalue +
              " WHERE OFF_ID=" +
              $off_id;
            if ($pheduyetvalue == "3")
              setpdQuery =
                "DELETE FROM ZTBOFFREGISTRATIONTB WHERE OFF_ID=" + $off_id;
            checkkq = await queryDB(setpdQuery);
            if (checkkq.tk_status != "OK") {
              res.send({
                tk_status: "NG",
                message:
                  "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa",
              });
            } else {
              res.send(checkkq);
            }
          } else {
            res.send({ tk_status: "NG", message: "NO_LEADER" });
          }
        })();
        break;
      case "xacnhanchamcongnhom":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `UPDATE ZTBATTENDANCETB SET XACNHAN='${DATA.confirm_worktime}' WHERE EMPL_NO='${EMPL_NO}' AND APPLY_DATE='${DATA.confirm_date}' AND XACNHAN is null`;
          //console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "mydiemdanhnhom":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_DATE = DATA.from_date;
          let END_DATE = DATA.to_date;
          let kqua;
          let query = `DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE        
           SET @startdate='${START_DATE}'
           SET @enddate='${END_DATE}'
		   SET @empl='${EMPL_NO}'
           SELECT  
		   ZTBEMPLINFOA.DATE_COLUMN,
		   ZTBEMPLINFOA.NV_CCID,
             ZTBEMPLINFOA.EMPL_NO, 
             ZTBEMPLINFOA.CMS_ID, 
             ZTBEMPLINFOA.MIDLAST_NAME, 
             ZTBEMPLINFOA.FIRST_NAME, 
             ZTBEMPLINFOA.PHONE_NUMBER, 
             ZTBSEX.SEX_NAME, 
             ZTBWORKSTATUS.WORK_STATUS_NAME, 
             ZTBFACTORY.FACTORY_NAME, 
             ZTBJOB.JOB_NAME, 
             ZTBWORKSHIFT.WORK_SHIF_NAME, 
             ZTBWORKPOSITION.WORK_POSITION_NAME, 
             ZTBSUBDEPARTMENT.SUBDEPTNAME, 
             ZTBMAINDEPARMENT.MAINDEPTNAME, 
             ZTBOFFREGISTRATIONTB.REQUEST_DATE, 
             ZTBATTENDANCETB.APPLY_DATE, 
             ZTBOFFREGISTRATIONTB.APPROVAL_STATUS, 
             ZTBOFFREGISTRATIONTB.OFF_ID, 
             ZTBOFFREGISTRATIONTB.CA_NGHI, 
             ZTBATTENDANCETB.ON_OFF, 
             ZTBATTENDANCETB.OVERTIME_INFO, 
             ZTBATTENDANCETB.OVERTIME, 
             ZTBREASON.REASON_NAME, 
             ZTBOFFREGISTRATIONTB.REMARK, 
             ZTBATTENDANCETB.XACNHAN,
			 ZTB_CALV.CA_CODE,	
			 ZTB_CALV.CA_NAME,	
			 ZTB_CALV.IN_START,	
			 ZTB_CALV.IN_END,
			 ZTB_CALV.OUT_START,
			 ZTB_CALV.OUT_END,
			 CCTB.[1] AS CHECK1,
			 CCTB.[2] AS CHECK2,
			 CCTB.[3] AS CHECK3
       FROM 
       (SELECT DATE_COLUMN, NV_CCID,EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
       LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM , ZTBATTENDANCETB.CURRENT_CA FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
         ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
       ) 
       LEFT JOIN ZTBSEX ON (
         ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
       ) 
       LEFT JOIN ZTBWORKSTATUS ON(
         ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
       ) 
       LEFT JOIN ZTBFACTORY ON (
         ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
       ) 
       LEFT JOIN ZTBJOB ON (
         ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
       ) 
       LEFT JOIN ZTBPOSITION ON (
         ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
       ) 
       LEFT JOIN ZTBWORKSHIFT ON (
         ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
       ) 
       LEFT JOIN ZTBWORKPOSITION ON (
         ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
       ) 
       LEFT JOIN ZTBSUBDEPARTMENT ON (
         ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
       ) 
       LEFT JOIN ZTBMAINDEPARMENT ON (
         ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
       ) 
       LEFT JOIN ZTBOFFREGISTRATIONTB ON (
         ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
         AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
       ) 
       LEFT JOIN ZTBREASON ON (
         ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
       )   
 LEFT JOIN ZTB_CALV ON (ZTB_CALV.CA_CODE = ZTBATTENDANCETB.CURRENT_CA)
LEFT JOIN (
			SELECT * FROM 
				(SELECT NV_CCID, CHECK_DATE, CHECK_DATETIME, RANK() OVER (PARTITION BY NV_CCID, CHECK_DATE ORDER BY CHECK_DATETIME ASC) AS CHECKNO FROM fn_cleanchamcong(10))
				AS STB
				PIVOT
				(
				MIN(STB.CHECK_DATETIME)
				FOR STB.CHECKNO IN ([1],[2],[3],[4],[5],[6])
				) AS pvtb
			 ) AS CCTB			
			 ON (CCTB.CHECK_DATE = ZTBEMPLINFOA.DATE_COLUMN AND CCTB.NV_CCID = ZTBEMPLINFOA.NV_CCID)	
 WHERE ZTBEMPLINFOA.WORK_STATUS_CODE =1  AND ZTBEMPLINFOA.EMPL_NO=@empl AND ZTBEMPLINFOA.DATE_COLUMN BETWEEN @startdate AND @enddate
 ORDER BY ZTBEMPLINFOA.DATE_COLUMN DESC, ZTBEMPLINFOA.POSITION_CODE ASC`;
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "diemdanhsummarynhom":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query =
              "DECLARE @tradate As DATE; SET @tradate = '" +
              DATA.todate +
              "' SELECT CONCAT(TONG_FULL.MAINDEPTNAME, TONG_FULL.SUBDEPTNAME) As id, TONG_FULL.MAINDEPTNAME, TONG_FULL.SUBDEPTNAME, (TONG_FULL.NhaMay1+TONG_FULL.NhaMay2) AS TOTAL_ALL, (isnull(TONG_ON.NhaMay1,0) + isnull(TONG_ON.NhaMay2,0)) AS TOTAL_ON, (isnull(TONG_OFF.NhaMay1,0)+ isnull(TONG_OFF.NhaMay2,0)) AS TOTAL_OFF, (isnull(TONG_NULL.NhaMay1,0)+ isnull(TONG_NULL.NhaMay2,0)) AS TOTAL_CDD, isnull(TONG_FULL.NhaMay1,0) as TOTAL_NM1, isnull(TONG_FULL.NhaMay2,0) as TOTAL_NM2, isnull(TONG_ON.NhaMay1,0) as ON_NM1, isnull(TONG_ON.NhaMay2,0) as ON_NM2, isnull(TONG_OFF.NhaMay1,0) as OFF_NM1, isnull(TONG_OFF.NhaMay2,0) as OFF_NM2, isnull(TONG_NULL.NhaMay1,0) as CDD_NM1, isnull(TONG_NULL.NhaMay2,0) as CDD_NM2 FROM fn_DiemDanhTong_FULL(@tradate) AS TONG_FULL LEFT JOIN (SELECT * FROM fn_DiemDanhTong_ON(@tradate)) AS TONG_ON ON (TONG_ON.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) LEFT JOIN (SELECT * FROM fn_DiemDanhTong_OFF(@tradate)) AS TONG_OFF ON (TONG_OFF.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) LEFT JOIN (SELECT * FROM fn_DiemDanhTong_NULL(@tradate)) AS TONG_NULL ON (TONG_NULL.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) ORDER BY MAINDEPTNAME DESC, SUBDEPTNAME ASC";
            kqua = await queryDB(query);
            // //console.log(kqua);
            res.send(kqua);
          } else {
            res.send({ tk_status: "NG", message: "Không phải leader" });
          }
        })();
        break;
      case "getmaindeptlist":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let kqua;
          let query = "SELECT * FROM ZTBMAINDEPARMENT";
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "workpositionlist":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let kqua;
          let query = "SELECT * FROM ZTBWORKPOSITION";
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "workpositionlist_BP":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTCODE = req.payload_data["MAINDEPTCODE"];
          let kqua;
          let query = `SELECT ZTBWORKPOSITION.CTR_CD, ZTBWORKPOSITION.SUBDEPTCODE, ZTBWORKPOSITION.WORK_POSITION_CODE, ZTBWORKPOSITION.WORK_POSITION_NAME, ZTBWORKPOSITION.WORK_POSITION_NAME_KR, ZTBWORKPOSITION.ATT_GROUP_CODE  FROM ZTBWORKPOSITION JOIN ZTBSUBDEPARTMENT ON (ZTBWORKPOSITION.SUBDEPTCODE = ZTBSUBDEPARTMENT.SUBDEPTCODE) 
                    JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE)
                    WHERE ZTBMAINDEPARMENT.MAINDEPTCODE=${MAINDEPTCODE}`;
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "diemdanhhistorynhom":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let start_date = DATA.start_date;
          let end_date = DATA.end_date;
          let maindeptcode = DATA.MAINDEPTCODE;
          let workshiftcode = DATA.WORK_SHIFT_CODE;
          let factorycode = DATA.FACTORY_CODE;
          //////console.log(DATA);
          let condition = "1=1 ";
          if (maindeptcode != 0) {
            condition += ` AND DD_TT.MAINDEPTCODE = ${maindeptcode}`;
          }
          switch (workshiftcode) {
            case 1:
              condition += ` AND DD_TT.WORK_SHIFT_CODE = 1 `;
              break;
            case 2:
              condition += ` AND DD_TT.WORK_SHIFT_CODE = 2 `;
              break;
            case 3:
              condition += ` AND DD_TT.WORK_SHIFT_CODE = 0 `;
              break;
            case 4:
              condition += ` AND DD_TT.WORK_SHIFT_CODE <> 2 `;
              break;
            case 5:
              condition += ` AND DD_TT.WORK_SHIFT_CODE <> 1 `;
              break;
          }
          if (factorycode != 0) {
            condition += ` AND DD_TT.FACTORY_CODE = ${factorycode} `;
          }
          if (
            JOB_NAME == "Leader" ||
            JOB_NAME == "Sub Leader" ||
            JOB_NAME == "Dept Staff" ||
            JOB_NAME == "ADMIN"
          ) {
            let kqua;
            let query = `DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE; SET @startdate='${start_date}' SET @enddate='${end_date}' SELECT DD_TT.APPLY_DATE as id,DD_TT.APPLY_DATE, COUNT(DD_TT.ON_OFF) AS TOTAL, COUNT(CASE DD_TT.ON_OFF WHEN 1 THEN 1 ELSE null END) AS TOTAL_ON, COUNT(CASE DD_TT.ON_OFF WHEN 0 THEN 1 ELSE null END) AS TOTAL_OFF, CAST(COUNT(CASE DD_TT.ON_OFF WHEN 1 THEN 1 ELSE null END) AS FLOAT) / CAST ( COUNT(DD_TT.ON_OFF) AS FLOAT) * 100 AS ON_RATE FROM ( SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,  ZTBMAINDEPARMENT.MAINDEPTCODE,ZTBWORKSHIFT.WORK_SHIFT_CODE, ZTBFACTORY.FACTORY_CODE, JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBATTENDANCETB.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME, ZTBOFFREGISTRATIONTB.REMARK, ZTBATTENDANCETB.XACNHAN FROM ZTBATTENDANCETB LEFT JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ZTBOFFREGISTRATIONTB ON (ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE) LEFT JOIN ZTBREASON ON ( ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE) WHERE ZTBATTENDANCETB.APPLY_DATE BETWEEN @startdate AND @enddate ) AS DD_TT WHERE  ${condition} GROUP BY DD_TT.APPLY_DATE ORDER BY DD_TT.APPLY_DATE ASC`;
            ////console.log(query);
            kqua = await queryDB(query);
            res.send(kqua);
          } else {
            res.send({ tk_status: "NG", message: "Không phải leader" });
          }
        })();
        break;
      case "diemdanhfull":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let START_DATE = DATA.from_date;
          let END_DATE = DATA.to_date;
          let kqua;
          let query = `DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE        
           SET @startdate='${START_DATE}'
           SET @enddate='${END_DATE}'
           SELECT  
		   ZTBEMPLINFOA.DATE_COLUMN,
             ZTBEMPLINFOA.EMPL_NO, 
             CMS_ID, 
             MIDLAST_NAME, 
             FIRST_NAME, 
             PHONE_NUMBER, 
             SEX_NAME, 
             WORK_STATUS_NAME, 
             FACTORY_NAME, 
             JOB_NAME, 
             WORK_SHIF_NAME, 
             WORK_POSITION_NAME, 
             SUBDEPTNAME, 
             MAINDEPTNAME, 
             REQUEST_DATE, 
             ZTBATTENDANCETB.APPLY_DATE, 
             APPROVAL_STATUS, 
             OFF_ID, 
             CA_NGHI, 
             ON_OFF, 
             OVERTIME_INFO, 
             OVERTIME, 
             REASON_NAME, 
             ZTBOFFREGISTRATIONTB.REMARK, 
             ZTBATTENDANCETB.XACNHAN 
           FROM 
             (SELECT DATE_COLUMN, EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
             LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
               ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
             ) 
             LEFT JOIN ZTBSEX ON (
               ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
             ) 
             LEFT JOIN ZTBWORKSTATUS ON(
               ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
             ) 
             LEFT JOIN ZTBFACTORY ON (
               ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
             ) 
             LEFT JOIN ZTBJOB ON (
               ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
             ) 
             LEFT JOIN ZTBPOSITION ON (
               ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
             ) 
             LEFT JOIN ZTBWORKSHIFT ON (
               ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
             ) 
             LEFT JOIN ZTBWORKPOSITION ON (
               ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
             ) 
             LEFT JOIN ZTBSUBDEPARTMENT ON (
               ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
             ) 
             LEFT JOIN ZTBMAINDEPARMENT ON (
               ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
             ) 
             LEFT JOIN ZTBOFFREGISTRATIONTB ON (
               ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
               AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
             ) 
             LEFT JOIN ZTBREASON ON (
               ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
             )   
			 WHERE ZTBEMPLINFOA.WORK_STATUS_CODE =1
			 ORDER BY ZTBEMPLINFOA.DATE_COLUMN DESC, ZTBEMPLINFOA.POSITION_CODE ASC`;
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "traPODataFull":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `SELECT 
          ZTBPOTable.PO_ID, 
          M110.CUST_NAME_KD, 
          AA.PO_NO, 
          M100.G_NAME, 
          M100.G_NAME_KD, 
          AA.G_CODE, 
          ZTBPOTable.PO_DATE, 
          ZTBPOTable.RD_DATE, 
          ZTBPOTable.PROD_PRICE, 
          ZTBPOTable.PO_QTY, 
          AA.TotalDelivered as TOTAL_DELIVERED, 
          (
            ZTBPOTable.PO_QTY - AA.TotalDelivered
          ) As PO_BALANCE, 
          (
            ZTBPOTable.PO_QTY * ZTBPOTable.PROD_PRICE
          ) As PO_AMOUNT, 
          (
            AA.TotalDelivered * ZTBPOTable.PROD_PRICE
          ) As DELIVERED_AMOUNT, 
          (
            (
              ZTBPOTable.PO_QTY - AA.TotalDelivered
            )* ZTBPOTable.PROD_PRICE
          ) As BALANCE_AMOUNT,
          M010.EMPL_NAME, 
          M100.PROD_TYPE, 
          KKK.M_NAME_FULLBOM, 
          M100.PROD_MAIN_MATERIAL, 
          M110.CUST_CD, 
          M010.EMPL_NO, 
          DATEPART(MONTH, PO_DATE) AS POMONTH, 
          DATEPART(ISOWK, PO_DATE) AS POWEEKNUM, 
          CASE WHEN (
            ZTBPOTable.RD_DATE < GETDATE()-1
          ) 
          AND (
            (
              ZTBPOTable.PO_QTY - AA.TotalDelivered
            ) <> 0
          ) THEN 'OVER' ELSE 'OK' END AS OVERDUE, 
          ZTBPOTable.REMARK 
        FROM 
          (
            SELECT 
              ZTBPOTable.EMPL_NO, 
              ZTBPOTable.CUST_CD, 
              ZTBPOTable.G_CODE, 
              ZTBPOTable.PO_NO, 
              isnull(
                SUM(ZTBDelivery.DELIVERY_QTY), 
                0
              ) AS TotalDelivered 
            FROM 
              ZTBPOTable 
              LEFT JOIN ZTBDelivery ON (
                ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD 
                AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD 
                AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE 
                AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
              ) 
            GROUP BY 
              ZTBPOTable.CTR_CD, 
              ZTBPOTable.EMPL_NO, 
              ZTBPOTable.G_CODE, 
              ZTBPOTable.CUST_CD, 
              ZTBPOTable.PO_NO
          ) AS AA 
          LEFT JOIN M010 ON (M010.EMPL_NO = AA.EMPL_NO) 
          LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE) 
          LEFT JOIN ZTBPOTable ON (
            AA.CUST_CD = ZTBPOTable.CUST_CD 
            AND AA.G_CODE = ZTBPOTable.G_CODE 
            AND AA.PO_NO = ZTBPOTable.PO_NO
          ) 
          LEFT JOIN M110 ON (M110.CUST_CD = AA.CUST_CD) 
          LEFT JOIN (
            SELECT 
              BBB.G_CODE, 
              string_agg(BBB.M_NAME, ', ') AS M_NAME_FULLBOM 
            FROM 
              (
                SELECT 
                  DISTINCT AAA.G_CODE, 
                  M090.M_NAME 
                FROM 
                  (
                    (
                      SELECT 
                        DISTINCT G_CODE, 
                        M_CODE 
                      FROM 
                        M140
                    ) AS AAA 
                    LEFT JOIN M090 ON (AAA.M_CODE = M090.M_CODE)
                  )
              ) AS BBB 
            GROUP BY 
              BBB.G_CODE
          ) AS KKK ON (KKK.G_CODE = ZTBPOTable.G_CODE) 
         ${generate_condition_get_po(
           DATA.alltime,
           DATA.start_date,
           DATA.end_date,
           DATA.cust_name,
           DATA.codeCMS,
           DATA.codeKD,
           DATA.prod_type,
           DATA.empl_name,
           DATA.po_no,
           DATA.over,
           DATA.id,
           DATA.material,
           DATA.justPoBalance
         )} ORDER BY ZTBPOTable.PO_ID DESC`;
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "traInvoiceDataFull":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          query = `SELECT M100.PROD_MAIN_MATERIAL, ZTBDelivery.DELIVERY_ID, ZTBDelivery.CUST_CD,M110.CUST_NAME_KD,ZTBDelivery.EMPL_NO,M010.EMPL_NAME,ZTBDelivery.G_CODE,M100.G_NAME,M100.G_NAME_KD,ZTBDelivery.PO_NO,ZTBDelivery.DELIVERY_DATE,ZTBDelivery.DELIVERY_QTY,ZTBPOTable.PROD_PRICE,  (ZTBDelivery.DELIVERY_QTY*ZTBPOTable.PROD_PRICE) AS DELIVERED_AMOUNT ,ZTBDelivery.REMARK,ZTBDelivery.INVOICE_NO,M100.PROD_TYPE,M100.PROD_MODEL,M100.PROD_PROJECT, DATEPART(YEAR,DELIVERY_DATE) AS YEARNUM,DATEPART(ISOWK,DELIVERY_DATE) AS WEEKNUM
                    FROM ZTBDelivery
                    LEFT JOIN M110 ON (M110.CUST_CD = ZTBDelivery.CUST_CD)
                    LEFT JOIN M010 ON (M010.EMPL_NO = ZTBDelivery.EMPL_NO)
                    LEFT JOIN M100 ON (M100.G_CODE = ZTBDelivery.G_CODE)
                    LEFT JOIN ZTBPOTable ON (ZTBDelivery.PO_NO = ZTBPOTable.PO_NO AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD)
                     ${generate_condition_get_invoice(
                       DATA.alltime,
                       DATA.start_date,
                       DATA.end_date,
                       DATA.cust_name,
                       DATA.codeCMS,
                       DATA.codeKD,
                       DATA.prod_type,
                       DATA.empl_name,
                       DATA.po_no,
                       DATA.material
                     )} ORDER BY ZTBDelivery.DELIVERY_ID DESC`;
          //console.log(query);
          kqua = await queryDB(query);
          res.send(kqua);
        })();
        break;
      case "checkPOExist":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          //let query = `SELECT * FROM ZTBPoTable WHERE G_CODE='${DATA.G_CODE}' AND CUST_CD='${DATA.CUST_CD}' AND PO_NO='${DATA.PO_NO}'`;
          let query = `SELECT  ZTBPOTable.CUST_CD, ZTBPOTable.PO_NO, ZTBPOTable.G_CODE,(ZTBPOTable.PO_QTY-AA.TotalDelivered) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable  LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN M010 ON (M010.EMPL_NO = AA.EMPL_NO) LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE) LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) JOIN M110 ON (M110.CUST_CD = AA.CUST_CD) WHERE ZTBPOTable.G_CODE='${DATA.G_CODE}' AND ZTBPOTable.CUST_CD='${DATA.CUST_CD}' AND ZTBPOTable.PO_NO='${DATA.PO_NO}'`;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "checkGCodeVer":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `SELECT USE_YN FROM M100 WHERE G_CODE='${DATA.G_CODE}'`;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "selectcodeList":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `SELECT G_CODE , G_NAME, G_NAME_KD, PROD_LAST_PRICE, USE_YN FROM M100`;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "selectcustomerList":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `SELECT DISTINCT CUST_CD , CUST_NAME_KD  FROM M110 WHERE CUST_TYPE ='KH' ORDER BY CUST_NAME_KD ASC`;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "selectVendorList":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          let query = `SELECT DISTINCT CUST_CD , CUST_NAME_KD  FROM M110 WHERE CUST_TYPE ='NCC' ORDER BY CUST_NAME_KD ASC`;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "update_po":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTBPOTable SET PO_QTY=${DATA.PO_QTY}, PO_DATE='${DATA.PO_DATE}', RD_DATE='${DATA.RD_DATE}', PROD_PRICE=${DATA.PROD_PRICE}, REMARK='${DATA.REMARK}', G_CODE='${DATA.G_CODE}',CUST_CD='${DATA.CUST_CD}', EMPL_NO='${DATA.EMPL_NO}' WHERE PO_ID=${DATA.PO_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "delete_po":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTBPOTable WHERE PO_ID=${DATA.PO_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "delete_invoice":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTBDelivery WHERE DELIVERY_ID=${DATA.DELIVERY_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "update_invoice":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTBDelivery SET CUST_CD='${DATA.CUST_CD}', G_CODE='${DATA.G_CODE}', PO_NO='${DATA.PO_NO}',  DELIVERY_DATE='${DATA.DELIVERY_DATE}', EMPL_NO='${DATA.EMPL_NO}', DELIVERY_QTY='${DATA.DELIVERY_QTY}', REMARK='${DATA.REMARK}' WHERE DELIVERY_ID=${DATA.DELIVERY_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traPlanDataFull":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          query = `SELECT ZTBPLANTB.PLAN_ID, M010.EMPL_NAME, ZTBPLANTB.EMPL_NO, M110.CUST_NAME_KD, ZTBPLANTB.CUST_CD, ZTBPLANTB.G_CODE, M100.G_NAME_KD, M100.G_NAME,  M100.PROD_TYPE ,M100.PROD_MAIN_MATERIAL, ZTBPLANTB.PLAN_DATE, ZTBPLANTB.D1,ZTBPLANTB.D2,ZTBPLANTB.D3,ZTBPLANTB.D4,ZTBPLANTB.D5,ZTBPLANTB.D6,ZTBPLANTB.D7,ZTBPLANTB.D8, ZTBPLANTB.D9, ZTBPLANTB.D10, ZTBPLANTB.D11, ZTBPLANTB.D12, ZTBPLANTB.D13, ZTBPLANTB.D14, ZTBPLANTB.D15,  ZTBPLANTB.REMARK  FROM ZTBPLANTB JOIN M100 ON (M100.G_CODE = ZTBPLANTB.G_CODE) JOIN M110 ON (M110.CUST_CD = ZTBPLANTB.CUST_CD) JOIN M010 ON (M010.EMPL_NO= ZTBPLANTB.EMPL_NO) ${generate_condition_get_plan(
            DATA.alltime,
            DATA.start_date,
            DATA.end_date,
            DATA.cust_name,
            DATA.codeCMS,
            DATA.codeKD,
            DATA.prod_type,
            DATA.empl_name,
            DATA.material
          )} ORDER BY ZTBPLANTB.PLAN_ID DESC`;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "delete_plan":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTBPLANTB WHERE PLAN_ID=${DATA.PLAN_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "delete_shortage":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTB_SHORTAGE_LIST WHERE ST_ID=${DATA.ST_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkPlanExist":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTBPLANTB WHERE G_CODE='${DATA.G_CODE}' AND CUST_CD='${DATA.CUST_CD}'  AND PLAN_DATE='${DATA.PLAN_DATE}' `;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkShortageExist":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTBPLANTB WHERE G_CODE='${DATA.G_CODE}' AND CUST_CD='${DATA.CUST_CD}'  AND PLAN_DATE='${DATA.PLAN_DATE}' `;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_plan":
        (async () => {
          //////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBPLANTB (CTR_CD,EMPL_NO,CUST_CD,G_CODE,PLAN_DATE,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,REMARK) VALUES ('002','${DATA.EMPL_NO}','${DATA.CUST_CD}', '${DATA.G_CODE}', '${DATA.PLAN_DATE}', ${DATA.D1},${DATA.D2},${DATA.D3},${DATA.D4},${DATA.D5},${DATA.D6},${DATA.D7},${DATA.D8},${DATA.D9},${DATA.D10},${DATA.D11},${DATA.D12},${DATA.D13},${DATA.D14},${DATA.D15},'${DATA.REMARK}')`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_shortage":
        (async () => {
          //////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_SHORTAGE_LIST (CTR_CD,G_CODE,CUST_CD,EMPL_NO,PLAN_DATE,D1_9H,D1_13H,D1_19H,D1_21H,D1_23H,D1_OTHER,D2_9H,D2_13H,D2_21H,D3_SANG,D3_CHIEU,D4_SANG,D4_CHIEU,PRIORITY,INS_EMPL,INS_DATE,UPD_EMPL,UPD_DATE) VALUES ('002','${DATA.G_CODE}','${DATA.CUST_CD}','${DATA.EMPL_NO}','${DATA.PLAN_DATE}','${DATA.D1_9H}','${DATA.D1_13H}','${DATA.D1_19H}','${DATA.D1_21H}','${DATA.D1_23H}','${DATA.D1_OTHER}','${DATA.D2_9H}','${DATA.D2_13H}','${DATA.D2_21H}','${DATA.D3_SANG}','${DATA.D3_CHIEU}','${DATA.D4_SANG}','${DATA.D4_CHIEU}','${DATA.PRIORITY}','${DATA.INS_EMPL}',GETDATE(),'${DATA.UPD_EMPL}',GETDATE())`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traFcstDataFull":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let kqua;
          query = `SELECT ZTBFCSTTB.FCST_ID, ZTBFCSTTB.FCSTYEAR, ZTBFCSTTB.FCSTWEEKNO,ZTBFCSTTB.G_CODE, M100.G_NAME_KD, M100.G_NAME, M010.EMPL_NAME,ZTBFCSTTB.EMPL_NO, M110.CUST_NAME_KD, M100.PROD_PROJECT, M100.PROD_MODEL, M100.PROD_MAIN_MATERIAL, ZTBFCSTTB.PROD_PRICE,ZTBFCSTTB.W1,ZTBFCSTTB.W2,ZTBFCSTTB.W3,ZTBFCSTTB.W4,ZTBFCSTTB.W5,ZTBFCSTTB.W6,ZTBFCSTTB.W7,ZTBFCSTTB.W8,ZTBFCSTTB.W9,ZTBFCSTTB.W10,ZTBFCSTTB.W11,ZTBFCSTTB.W12,ZTBFCSTTB.W13,ZTBFCSTTB.W14,ZTBFCSTTB.W15,ZTBFCSTTB.W16,ZTBFCSTTB.W17,ZTBFCSTTB.W18,ZTBFCSTTB.W19,ZTBFCSTTB.W20,ZTBFCSTTB.W21,ZTBFCSTTB.W22, ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W1 AS W1A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W2 AS W2A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W3  AS W3A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W4  AS W4A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W5 AS W5A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W6 AS W6A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W7 AS W7A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W8 AS W8A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W9 AS W9A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W10 AS W10A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W11 AS W11A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W12 AS W12A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W13 AS W13A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W14 AS W14A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W15 AS W15A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W16 AS W16A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W17 AS W17A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W18 AS W18A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W19 AS W19A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W20 AS W20A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W21 AS W21A,ZTBFCSTTB.PROD_PRICE * ZTBFCSTTB.W22 AS W22A  FROM ZTBFCSTTB JOIN M100 ON (M100.G_CODE = ZTBFCSTTB.G_CODE) JOIN M110 ON(M110.CUST_CD = ZTBFCSTTB.CUST_CD) JOIN M010 ON (M010.EMPL_NO = ZTBFCSTTB.EMPL_NO) ${generate_condition_get_fcst(
            DATA.alltime,
            DATA.start_date,
            DATA.end_date,
            DATA.cust_name,
            DATA.codeCMS,
            DATA.codeKD,
            DATA.prod_type,
            DATA.empl_name,
            DATA.material
          )} `;
          kqua = await queryDB(query);
          ////console.log(kqua);
          res.send(kqua);
        })();
        break;
      case "delete_fcst":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTBFCSTTB WHERE FCST_ID=${DATA.FCST_ID}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkFcstExist":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTBFCSTTB WHERE G_CODE='${DATA.G_CODE}' AND CUST_CD='${DATA.CUST_CD}'  AND FCSTYEAR=${DATA.FCSTYEAR}  AND FCSTWEEKNO= ${DATA.FCSTWEEKNO}`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_fcst":
        (async () => {
          //////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBFCSTTB (CTR_CD, EMPL_NO,CUST_CD,G_CODE,PROD_PRICE,FCSTYEAR,FCSTWEEKNO,W1,W2,W3,W4,W5,W6,W7,W8,W9,W10,W11,W12,W13,W14,W15,W16,W17,W18,W19,W20,W21,W22) VALUES ('002','${DATA.EMPL_NO}','${DATA.CUST_CD}','${DATA.G_CODE}','${DATA.PROD_PRICE}','${DATA.YEAR}','${DATA.WEEKNO}','${DATA.W1}','${DATA.W2}','${DATA.W3}','${DATA.W4}','${DATA.W5}','${DATA.W6}','${DATA.W7}','${DATA.W8}','${DATA.W9}','${DATA.W10}','${DATA.W11}','${DATA.W12}','${DATA.W13}','${DATA.W14}','${DATA.W15}','${DATA.W16}','${DATA.W17}','${DATA.W18}','${DATA.W19}','${DATA.W20}','${DATA.W21}','${DATA.W22}')`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traYCSXDataFull":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT
          AMAZONTB.PROD_REQUEST_NO AS DAUPAMZ,
          PLANTABLE.PROD_REQUEST_NO AS DACHITHI,
          M100.G_NAME_KD,
          P400.PO_NO,
          P400.G_CODE,
          M100.PROD_TYPE,
          M100.PROD_MAIN_MATERIAL,
          M100.DESCR,
          M100.PDBV,
          M100.PDBV_EMPL,
          M100.PDBV_DATE,
          M100.G_NAME,
          M010.EMPL_NAME,
          M010.EMPL_NO,
          M110.CUST_NAME_KD,
          M110.CUST_CD,
          P400.PROD_REQUEST_NO,
          P400.PROD_REQUEST_DATE,
          P400.PROD_REQUEST_QTY,
          isnull(INSPECT_BALANCE_TB.LOT_TOTAL_INPUT_QTY_EA, 0) AS LOT_TOTAL_INPUT_QTY_EA,
          isnull(INSPECT_BALANCE_TB.LOT_TOTAL_OUTPUT_QTY_EA, 0) AS LOT_TOTAL_OUTPUT_QTY_EA,
          isnull(INSPECT_BALANCE_TB.INSPECT_BALANCE, 0) AS INSPECT_BALANCE,
          (
              CASE
                  WHEN P400.YCSX_PENDING = 1 THEN (
                      isnull(P400.PROD_REQUEST_QTY, 0) - isnull(INSPECT_BALANCE_TB.LOT_TOTAL_INPUT_QTY_EA, 0)
                  )
                  WHEN P400.YCSX_PENDING = 0 THEN 0
              END
          ) AS SHORTAGE_YCSX,
          CASE WHEN (P400.YCSX_PENDING =0 OR isnull(INSPECT_BALANCE_TB.LOT_TOTAL_OUTPUT_QTY_EA, 0) >= P400.PROD_REQUEST_QTY) THEN 0 ELSE 1 END AS YCSX_PENDING,   
          P400.CODE_55 AS PHAN_LOAI,
          P400.REMK AS REMARK,
          P400.PO_TDYCSX,
          (
              P400.TKHO_TDYCSX + P400.BTP_TDYCSX + P400.CK_TDYCSX - P400.BLOCK_TDYCSX
          ) AS TOTAL_TKHO_TDYCSX,
          P400.TKHO_TDYCSX,
          P400.BTP_TDYCSX,
          P400.CK_TDYCSX,
          P400.BLOCK_TDYCSX,
          P400.FCST_TDYCSX,
          P400.W1,
          P400.W2,
          P400.W3,
          P400.W4,
          P400.W5,
          P400.W6,
          P400.W7,
          P400.W8,
          P400.PDUYET,
          P400.CODE_50 AS LOAIXH,
          M100.BANVE,
          M100.NO_INSPECTION
      FROM
          P400
          LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE)
          LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)
          LEFT JOIN M110 ON (P400.CUST_CD = M110.CUST_CD)
          LEFT JOIN (
              SELECT
                  M010.EMPL_NAME,
                  M110.CUST_NAME_KD,
                  M100.G_CODE,
                  M100.G_NAME,
                  P400.PROD_REQUEST_NO,
                  P400.PROD_REQUEST_QTY,
                  INOUT.LOT_TOTAL_INPUT_QTY_EA,
                  INOUT.LOT_TOTAL_OUTPUT_QTY_EA,
                  INOUT.INSPECT_BALANCE
              FROM
                  (
                      SELECT
                          P400.PROD_REQUEST_NO,
                          SUM(CC.LOT_TOTAL_INPUT_QTY_EA) AS LOT_TOTAL_INPUT_QTY_EA,
                          SUM(CC.LOT_TOTAL_OUTPUT_QTY_EA) AS LOT_TOTAL_OUTPUT_QTY_EA,
                          SUM(CC.INSPECT_BALANCE) AS INSPECT_BALANCE
                      FROM
                          (
                              SELECT
                                  AA.PROCESS_LOT_NO,
                                  AA.LOT_TOTAL_QTY_KG,
                                  AA.LOT_TOTAL_INPUT_QTY_EA,
                                  isnull(BB.LOT_TOTAL_OUTPUT_QTY_EA, 0) AS LOT_TOTAL_OUTPUT_QTY_EA,
                                  (
                                      AA.LOT_TOTAL_INPUT_QTY_EA - isnull(BB.LOT_TOTAL_OUTPUT_QTY_EA, 0)
                                  ) AS INSPECT_BALANCE
                              FROM
                                  (
                                      SELECT
                                          PROCESS_LOT_NO,
                                          SUM(INPUT_QTY_EA) AS LOT_TOTAL_INPUT_QTY_EA,
                                          SUM(INPUT_QTY_KG) AS LOT_TOTAL_QTY_KG
                                      FROM
                                          ZTBINSPECTINPUTTB
                                      GROUP BY
                                          PROCESS_LOT_NO
                                  ) AS AA
                                  LEFT JOIN (
                                      SELECT
                                          PROCESS_LOT_NO,
                                          SUM(OUTPUT_QTY_EA) AS LOT_TOTAL_OUTPUT_QTY_EA
                                      FROM
                                          ZTBINSPECTOUTPUTTB
                                      GROUP BY
                                          PROCESS_LOT_NO
                                  ) AS BB ON (AA.PROCESS_LOT_NO = BB.PROCESS_LOT_NO)
                          ) AS CC
                          LEFT JOIN P501 ON (CC.PROCESS_LOT_NO = P501.PROCESS_LOT_NO)
                          LEFT JOIN (
                              SELECT
                                  DISTINCT PROD_REQUEST_NO,
                                  PROCESS_IN_DATE,
                                  PROCESS_IN_NO
                              FROM
                                  P500
                          ) AS P500_A ON (
                              P500_A.PROCESS_IN_DATE = P501.PROCESS_IN_DATE
                              AND P500_A.PROCESS_IN_NO = P501.PROCESS_IN_NO
                          )
                          LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                      GROUP BY
                          P400.PROD_REQUEST_NO
                  ) AS INOUT
                  LEFT JOIN P400 ON (INOUT.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                  LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD)
                  LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE)
                  LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)
          ) AS INSPECT_BALANCE_TB ON (
              INSPECT_BALANCE_TB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO
          )
          LEFT JOIN (
              SELECT
                  DISTINCT PROD_REQUEST_NO
              FROM
                  AMAZONE_DATA
          ) AS AMAZONTB ON (AMAZONTB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
          LEFT JOIN (
              SELECT
                  DISTINCT PROD_REQUEST_NO
              FROM
                  ZTB_QLSXPLAN
          ) AS PLANTABLE ON (PLANTABLE.PROD_REQUEST_NO = P400.PROD_REQUEST_NO) ${generate_condition_get_ycsx(
            DATA.alltime,
            DATA.start_date,
            DATA.end_date,
            DATA.cust_name,
            DATA.codeCMS,
            DATA.codeKD,
            DATA.prod_type,
            DATA.empl_name,
            DATA.phanloai,
            DATA.ycsx_pending,
            DATA.prod_request_no,
            DATA.material,
            DATA.inspect_inputcheck
          )} ORDER BY P400.PROD_REQUEST_NO DESC`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traYCSXDataFull_QLSX":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT
          M100.FACTORY,
          M100.Setting1,
          M100.Setting2,
          M100.Step1,
          M100.Step2,
          M100.LOSS_SX1,
          M100.LOSS_SX2,
          M100.LOSS_SETTING1,
          M100.LOSS_SETTING2,
          M100.NOTE,
          M100.UPH1,
          M100.UPH2,
          M100.Step3,
          M100.Step4,
          M100.EQ3,
          M100.EQ4,
          M100.UPH3,
          M100.UPH4,
          M100.Setting3,
          M100.Setting4,
          M100.LOSS_SX3,
          M100.LOSS_SX4,
          M100.LOSS_SETTING3,
          M100.LOSS_SETTING4,
          P400.G_CODE,
          M100.PROD_TYPE,
          M100.PROD_MAIN_MATERIAL,
          M100.DESCR,
          M100.PDBV,
          M100.PDBV_EMPL,
          M100.PDBV_DATE,
          M100.G_NAME,
          M100.G_NAME_KD,
          M010.EMPL_NAME,
          M010.EMPL_NO,
          M110.CUST_NAME_KD,
          M110.CUST_CD,
          P400.PROD_REQUEST_NO,
          P400.PROD_REQUEST_DATE,
          P400.PROD_REQUEST_QTY,
          (
              CASE
                  WHEN P400.YCSX_PENDING = 1 THEN (
                      isnull(P400.PROD_REQUEST_QTY, 0) - isnull(INSPECT_BALANCE_TB.LOT_TOTAL_INPUT_QTY_EA, 0)
                  )
                  WHEN P400.YCSX_PENDING = 0 THEN 0
              END
          ) AS SHORTAGE_YCSX,
          CASE WHEN (P400.YCSX_PENDING =0 OR isnull(INSPECT_BALANCE_TB.LOT_TOTAL_OUTPUT_QTY_EA, 0) >= P400.PROD_REQUEST_QTY) THEN 0 ELSE 1 END AS YCSX_PENDING,
          P400.CODE_55 AS PHAN_LOAI,
          P400.REMK AS REMARK,
          P400.PO_TDYCSX,
          (
              P400.TKHO_TDYCSX + P400.BTP_TDYCSX + P400.CK_TDYCSX - P400.BLOCK_TDYCSX
          ) AS TOTAL_TKHO_TDYCSX,
          P400.TKHO_TDYCSX,
          P400.BTP_TDYCSX,
          P400.CK_TDYCSX,
          P400.BLOCK_TDYCSX,
          P400.FCST_TDYCSX,
          P400.W1,
          P400.W2,
          P400.W3,
          P400.W4,
          P400.W5,
          P400.W6,
          P400.W7,
          P400.W8,
          P400.PDUYET,
          P400.CODE_50 AS LOAIXH,
          M100.BANVE,
          M100.NO_INSPECTION,
          isnull(PO_TON.PO_BALANCE, 0) AS PO_BALANCE,
          M100.EQ1,
          M100.EQ2,
          isnull(AA.CD1, 0) AS CD1,
          isnull(AA.CD2, 0) AS CD2,
          isnull(AA.CD3, 0) AS CD3,
          isnull(AA.CD4, 0) AS CD4,
          isnull(BB.CD_IN, 0) AS CD_IN,
          isnull(BB.CD_DIECUT, 0) AS CD_DIECUT,
          isnull(INSPECT_BALANCE_TB.LOT_TOTAL_INPUT_QTY_EA, 0) AS LOT_TOTAL_INPUT_QTY_EA,
          isnull(INSPECT_BALANCE_TB.LOT_TOTAL_OUTPUT_QTY_EA, 0) AS LOT_TOTAL_OUTPUT_QTY_EA,
          CASE
              WHEN (
                  NOT(
                      M100.EQ1 <> 'NA'
                      AND M100.EQ1 <> 'NO'
                      AND M100.EQ1 <> ''
                      AND M100.EQ1 IS NOT NULL
                  )
              ) THEN 0
              ELSE P400.PROD_REQUEST_QTY - isnull(AA.CD1, 0)
          END AS TON_CD1,
          CASE
              WHEN (
                  NOT (
                      M100.EQ2 <> 'NA'
                      AND M100.EQ2 <> 'NO'
                      AND M100.EQ2 <> ''
                      AND M100.EQ2 IS NOT NULL
                  )
              ) THEN 0
              ELSE P400.PROD_REQUEST_QTY - isnull(AA.CD2, 0)
          END AS TON_CD2,
          CASE
              WHEN (
                  NOT (
                      M100.EQ3 <> 'NA'
                      AND M100.EQ3 <> 'NO'
                      AND M100.EQ3 <> ''
                      AND M100.EQ3 IS NOT NULL
                  )
              ) THEN 0
              ELSE P400.PROD_REQUEST_QTY - isnull(AA.CD3, 0)
          END AS TON_CD3,
          CASE
              WHEN (
                  NOT (
                      M100.EQ4 <> 'NA'
                      AND M100.EQ4 <> 'NO'
                      AND M100.EQ4 <> ''
                      AND M100.EQ4 IS NOT NULL
                  )
              ) THEN 0
              ELSE P400.PROD_REQUEST_QTY - isnull(AA.CD4, 0)
          END AS TON_CD4,
          isnull(INSPECT_BALANCE_TB.INSPECT_BALANCE, 0) AS INSPECT_BALANCE
      FROM
          P400
          LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE)
          LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)
          LEFT JOIN M110 ON (P400.CUST_CD = M110.CUST_CD)
          LEFT JOIN (
              SELECT
                  M010.EMPL_NAME,
                  M110.CUST_NAME_KD,
                  M100.G_CODE,
                  M100.G_NAME,
                  P400.PROD_REQUEST_NO,
                  P400.PROD_REQUEST_QTY,
                  INOUT.LOT_TOTAL_INPUT_QTY_EA,
                  INOUT.LOT_TOTAL_OUTPUT_QTY_EA,
                  INOUT.INSPECT_BALANCE
              FROM
                  (
                      SELECT
                          P400.PROD_REQUEST_NO,
                          SUM(CC.LOT_TOTAL_INPUT_QTY_EA) AS LOT_TOTAL_INPUT_QTY_EA,
                          SUM(CC.LOT_TOTAL_OUTPUT_QTY_EA) AS LOT_TOTAL_OUTPUT_QTY_EA,
                          SUM(CC.INSPECT_BALANCE) AS INSPECT_BALANCE
                      FROM
                          (
                              SELECT
                                  AA.PROCESS_LOT_NO,
                                  AA.LOT_TOTAL_QTY_KG,
                                  AA.LOT_TOTAL_INPUT_QTY_EA,
                                  isnull(BB.LOT_TOTAL_OUTPUT_QTY_EA, 0) AS LOT_TOTAL_OUTPUT_QTY_EA,
                                  (
                                      AA.LOT_TOTAL_INPUT_QTY_EA - isnull(BB.LOT_TOTAL_OUTPUT_QTY_EA, 0)
                                  ) AS INSPECT_BALANCE
                              FROM
                                  (
                                      SELECT
                                          PROCESS_LOT_NO,
                                          SUM(INPUT_QTY_EA) AS LOT_TOTAL_INPUT_QTY_EA,
                                          SUM(INPUT_QTY_KG) AS LOT_TOTAL_QTY_KG
                                      FROM
                                          ZTBINSPECTINPUTTB
                                      GROUP BY
                                          PROCESS_LOT_NO
                                  ) AS AA
                                  LEFT JOIN (
                                      SELECT
                                          PROCESS_LOT_NO,
                                          SUM(OUTPUT_QTY_EA) AS LOT_TOTAL_OUTPUT_QTY_EA
                                      FROM
                                          ZTBINSPECTOUTPUTTB
                                      GROUP BY
                                          PROCESS_LOT_NO
                                  ) AS BB ON (AA.PROCESS_LOT_NO = BB.PROCESS_LOT_NO)
                          ) AS CC
                          LEFT JOIN P501 ON (CC.PROCESS_LOT_NO = P501.PROCESS_LOT_NO)
                          LEFT JOIN (
                              SELECT
                                  DISTINCT PROD_REQUEST_NO,
                                  PROCESS_IN_DATE,
                                  PROCESS_IN_NO
                              FROM
                                  P500
                          ) AS P500_A ON (
                              P500_A.PROCESS_IN_DATE = P501.PROCESS_IN_DATE
                              AND P500_A.PROCESS_IN_NO = P501.PROCESS_IN_NO
                          )
                          LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                      GROUP BY
                          P400.PROD_REQUEST_NO
                  ) AS INOUT
                  LEFT JOIN P400 ON (INOUT.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                  LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD)
                  LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE)
                  LEFT JOIN M010 ON (M010.EMPL_NO = P400.EMPL_NO)
          ) AS INSPECT_BALANCE_TB ON (
              INSPECT_BALANCE_TB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO
          )
          LEFT JOIN (
              SELECT
                  AA.G_CODE,
                  (SUM(ZTBPOTable.PO_QTY) - SUM(AA.TotalDelivered)) AS PO_BALANCE
              FROM
                  (
                      SELECT
                          ZTBPOTable.EMPL_NO,
                          ZTBPOTable.CUST_CD,
                          ZTBPOTable.G_CODE,
                          ZTBPOTable.PO_NO,
                          isnull(SUM(ZTBDelivery.DELIVERY_QTY), 0) AS TotalDelivered
                      FROM
                          ZTBPOTable
                          LEFT JOIN ZTBDelivery ON (
                              ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD
                              AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD
                              AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE
                              AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
                          )
                      GROUP BY
                          ZTBPOTable.CTR_CD,
                          ZTBPOTable.EMPL_NO,
                          ZTBPOTable.G_CODE,
                          ZTBPOTable.CUST_CD,
                          ZTBPOTable.PO_NO
                  ) AS AA
                  JOIN ZTBPOTable ON (
                      AA.CUST_CD = ZTBPOTable.CUST_CD
                      AND AA.G_CODE = ZTBPOTable.G_CODE
                      AND AA.PO_NO = ZTBPOTable.PO_NO
                  )
              GROUP BY
                  AA.G_CODE
          ) AS PO_TON ON(P400.G_CODE = PO_TON.G_CODE)
          LEFT JOIN (
              SELECT
                  PVTB.PROD_REQUEST_NO,
                  isnull(PVTB.[1], 0) AS CD1,
                  isnull(PVTB.[2], 0) AS CD2,
                  isnull(PVTB.[3], 0) AS CD3,
                  isnull(PVTB.[4], 0) AS CD4
              FROM
                  (
                      SELECT
                          ZTB_QLSXPLAN.PROD_REQUEST_NO,
                          ZTB_QLSXPLAN.PROCESS_NUMBER,
                          SUM(isnull(SX_RESULT, 0)) AS KETQUASX
                      FROM
                          ZTB_SX_RESULT
                          LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID)
                      WHERE
                          ZTB_QLSXPLAN.STEP = 0
                      GROUP BY
                          ZTB_QLSXPLAN.PROD_REQUEST_NO,
                          ZTB_QLSXPLAN.PROCESS_NUMBER
                  ) AS PV PIVOT (
                      SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1], [2], [3], [4])
                  ) AS PVTB
          ) AS AA ON (P400.PROD_REQUEST_NO = AA.PROD_REQUEST_NO)
          LEFT JOIN (
              SELECT
                  PVTB.PROD_REQUEST_NO,
                  PVTB.[IN] AS CD_IN,
                  PVTB.[DIECUT] AS CD_DIECUT
              FROM
                  (
                      SELECT
                          PROD_REQUEST_NO,
                          CASE
                              WHEN (
                                  SUBSTRING(PLAN_EQ, 1, 2) = 'FR'
                                  OR SUBSTRING(PLAN_EQ, 1, 2) = 'SR'
                              ) THEN 'IN'
                              ELSE 'DIECUT'
                          END AS PROCESS_NAME,
                          SUM(KETQUASX) AS KETQUASX
                      FROM
                          ZTB_QLSXPLAN
                      WHERE
                          STEP = 0
                      GROUP BY
                          PROD_REQUEST_NO,
                          CASE
                              WHEN (
                                  SUBSTRING(PLAN_EQ, 1, 2) = 'FR'
                                  OR SUBSTRING(PLAN_EQ, 1, 2) = 'SR'
                              ) THEN 'IN'
                              ELSE 'DIECUT'
                          END
                  ) AS PV PIVOT (
                      SUM(PV.KETQUASX) FOR PV.PROCESS_NAME IN ([IN], [DIECUT])
                  ) AS PVTB
          ) AS BB ON (P400.PROD_REQUEST_NO = BB.PROD_REQUEST_NO) ${generate_condition_get_ycsx(
            DATA.alltime,
            DATA.start_date,
            DATA.end_date,
            DATA.cust_name,
            DATA.codeCMS,
            DATA.codeKD,
            DATA.prod_type,
            DATA.empl_name,
            DATA.phanloai,
            DATA.ycsx_pending,
            DATA.prod_request_no,
            DATA.material,
            DATA.inspect_inputcheck
          )} ORDER BY P400.PROD_REQUEST_NO DESC`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getP400":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM P400 WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}' AND PROD_REQUEST_DATE='${DATA.PROD_REQUEST_DATE}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkLastYCSX":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYYMMDD");
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM P400 WHERE PROD_REQUEST_DATE='${currenttime}' ORDER BY INS_DATE DESC`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getSystemDateTime":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT GETDATE() AS SYSTEM_DATETIME`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkpobalance_tdycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT AA.G_CODE, (SUM(ZTBPOTable.PO_QTY)-SUM(AA.TotalDelivered)) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA JOIN ZTBPOTable ON ( AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) WHERE AA.G_CODE='${DATA.G_CODE}' GROUP BY AA.G_CODE`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkpobalance_allcode":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT AA.G_CODE, (SUM(ZTBPOTable.PO_QTY)-SUM(AA.TotalDelivered)) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA JOIN ZTBPOTable ON ( AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO)  GROUP BY AA.G_CODE`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checktonkho_tdycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT M100.G_CODE, isnull(TONKIEM.INSPECT_BALANCE_QTY,0) AS CHO_KIEM, isnull(TONKIEM.WAIT_CS_QTY,0) AS CHO_CS_CHECK,isnull(TONKIEM.WAIT_SORTING_RMA,0) CHO_KIEM_RMA, isnull(TONKIEM.TOTAL_WAIT,0) AS TONG_TON_KIEM, isnull(BTP.BTP_QTY_EA,0) AS BTP, isnull(THANHPHAM.TONKHO,0) AS TON_TP, isnull(tbl_Block_table2.Block_Qty,0) AS BLOCK_QTY, (isnull(TONKIEM.TOTAL_WAIT,0) + isnull(BTP.BTP_QTY_EA,0)+ isnull(THANHPHAM.TONKHO,0) - isnull(tbl_Block_table2.Block_Qty,0)) AS GRAND_TOTAL_STOCK FROM M100 LEFT JOIN ( SELECT Product_MaVach, isnull([IN],0) AS NHAPKHO, isnull([OUT],0) AS XUATKHO, (isnull([IN],0)- isnull([OUT],0)) AS TONKHO FROM ( SELECT Product_Mavach, IO_Type, IO_Qty FROM tbl_InputOutput ) AS SourceTable PIVOT ( SUM(IO_Qty) FOR IO_Type IN ([IN], [OUT]) ) AS PivotTable ) AS THANHPHAM ON (THANHPHAM.Product_MaVach = M100.G_CODE) LEFT JOIN ( SELECT ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD, SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY, SUM(WAIT_CS_QTY) AS WAIT_CS_QTY, SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA, SUM(INSPECT_BALANCE_QTY+ WAIT_CS_QTY+ WAIT_SORTING_RMA) AS TOTAL_WAIT FROM ZTB_WAIT_INSPECT JOIN M100 ON ( M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE) WHERE UPDATE_DATE=CONVERT(date,GETDATE()) AND CALAMVIEC = 'DEM' GROUP BY ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD) AS TONKIEM ON (THANHPHAM.Product_MaVach = TONKIEM.G_CODE) LEFT JOIN ( SELECT Product_MaVach, SUM(Block_Qty) AS Block_Qty from tbl_Block2 GROUP BY Product_MaVach ) AS tbl_Block_table2 ON (tbl_Block_table2.Product_MaVach= M100.G_CODE) LEFT JOIN ( SELECT ZTB_HALF_GOODS.G_CODE, M100.G_NAME, SUM(BTP_QTY_EA) AS BTP_QTY_EA FROM ZTB_HALF_GOODS JOIN M100 ON (M100.G_CODE = ZTB_HALF_GOODS.G_CODE) WHERE UPDATE_DATE = CONVERT(date,GETDATE()) GROUP BY ZTB_HALF_GOODS.G_CODE, M100.G_NAME) AS BTP ON (BTP.G_CODE = THANHPHAM.Product_MaVach) WHERE M100.G_CODE='${DATA.G_CODE}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkfcst_tdycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT G_CODE, SUM(W1) AS W1, SUM(W2) AS W2, SUM(W3) AS W3, SUM(W4) AS W4, SUM(W5) AS W5, SUM(W6) AS W6, SUM(W7) AS W7, SUM(W8) AS W8 FROM ZTBFCSTTB WHERE FCSTYEAR = YEAR(GETDATE()) AND FCSTWEEKNO = (SELECT MAX(FCSTWEEKNO)FROM ZTBFCSTTB WHERE FCSTYEAR = YEAR(GETDATE()) ) AND G_CODE='${DATA.G_CODE}' GROUP BY G_CODE`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_ycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO P400 (CTR_CD, PROD_REQUEST_DATE,PROD_REQUEST_NO,CODE_50,CODE_03,CODE_55,G_CODE,RIV_NO,PROD_REQUEST_QTY,CUST_CD,EMPL_NO,REMK,USE_YN,DELIVERY_DT,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL,YCSX_PENDING,G_CODE2,PO_TDYCSX,TKHO_TDYCSX,FCST_TDYCSX,W1,W2,W3,W4,W5,W6,W7,W8,BTP_TDYCSX,CK_TDYCSX,PDUYET,BLOCK_TDYCSX,PO_NO) VALUES ('002','${DATA.PROD_REQUEST_DATE}','${DATA.PROD_REQUEST_NO}','${DATA.CODE_50}','${DATA.CODE_03}','${DATA.CODE_55}','${DATA.G_CODE}','${DATA.RIV_NO}','${DATA.PROD_REQUEST_QTY}','${DATA.CUST_CD}','${DATA.EMPL_NO}',N'${DATA.REMK}','${DATA.USE_YN}','${DATA.DELIVERY_DT}',GETDATE(),'${DATA.INS_EMPL}',GETDATE(),'${DATA.UPD_EMPL}','${DATA.YCSX_PENDING}','${DATA.G_CODE2}','${DATA.PO_TDYCSX}','${DATA.TKHO_TDYCSX}','${DATA.FCST_TDYCSX}','${DATA.W1}','${DATA.W2}','${DATA.W3}','${DATA.W4}','${DATA.W5}','${DATA.W6}','${DATA.W7}','${DATA.W8}','${DATA.BTP_TDYCSX}','${DATA.CK_TDYCSX}','${DATA.PDUYET}','${DATA.BLOCK_TDYCSX}','${DATA.PO_NO}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getLastProcessLotNo":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 PROCESS_LOT_NO,SUBSTRING(PROCESS_LOT_NO,6,3) AS SEQ_NO, INS_DATE FROM P501 WHERE SUBSTRING(PROCESS_LOT_NO,1,2) = '${DATA.machine}' AND PROCESS_IN_DATE = '${DATA.in_date}' ORDER BY INS_DATE DESC`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkYCSXO300":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM O300 WHERE PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkYCSXQLSXPLAN":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM ZTB_QLSXPLAN WHERE PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkProcessInNoP500":
        (async () => {
          ////console.log(DATA);
          let in_date = moment().format("YYYYMMDD");
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 PROCESS_IN_DATE, PROCESS_IN_NO, EQUIPMENT_CD FROM P500 WHERE PROCESS_IN_DATE='${in_date}'  ORDER BY INS_DATE DESC`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_p500":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO P500 (CTR_CD, PROCESS_IN_DATE, PROCESS_IN_NO, PROCESS_IN_SEQ, M_LOT_IN_SEQ, PROD_REQUEST_DATE, PROD_REQUEST_NO, G_CODE, M_CODE, M_LOT_NO, EMPL_NO, EQUIPMENT_CD, SCAN_RESULT, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL, FACTORY, PLAN_ID) VALUES ('002','${
            DATA.in_date
          }','${DATA.next_process_in_no}','${DATA.PROD_REQUEST_NO.substring(
            4,
            7
          )}','${DATA.PROD_REQUEST_DATE.substring(5, 8)}','${
            DATA.PROD_REQUEST_DATE
          }','${DATA.PROD_REQUEST_NO}','${DATA.G_CODE}', '','','${
            DATA.EMPL_NO
          }','${DATA.phanloai}01','OK',GETDATE(),'${DATA.EMPL_NO}',GETDATE(),'${
            DATA.EMPL_NO
          }','NM1','${DATA.PLAN_ID}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_p501":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO P501 (CTR_CD,PROCESS_IN_DATE,PROCESS_IN_NO,PROCESS_IN_SEQ,M_LOT_IN_SEQ,PROCESS_PRT_SEQ,M_LOT_NO,PROCESS_LOT_NO,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL, PLAN_ID) VALUES  ('002','${
            DATA.in_date
          }','${DATA.next_process_in_no}','${DATA.PROD_REQUEST_NO.substring(
            4,
            7
          )}','${DATA.PROD_REQUEST_DATE.substring(5, 8)}','${
            DATA.next_process_prt_seq
          }','','${DATA.next_process_lot_no}',GETDATE(),'${
            DATA.EMPL_NO
          }',GETDATE(),'${DATA.EMPL_NO}','${DATA.PLAN_ID}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "delete_ycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM P400 WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkYcsxExist":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM P400 WHERE PROD_REQUEST_NO= ${DATA.PROD_REQUEST_NO}`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "update_ycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `UPDATE P400 SET REMK='${DATA.REMK}', CODE_50='${DATA.CODE_50}', CODE_55='${DATA.CODE_55}', PROD_REQUEST_QTY='${DATA.PROD_REQUEST_QTY}', UPD_EMPL='${DATA.EMPL_NO}', DELIVERY_DT='${DATA.DELIVERY_DT}', UPD_DATE=GETDATE() WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "setpending_ycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `UPDATE P400 SET YCSX_PENDING='${DATA.YCSX_PENDING}' WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "pheduyet_ycsx":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `UPDATE P400 SET PDUYET='${DATA.PDUYET}' WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "ycsx_fullinfo":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = ` SELECT M100.G_NAME_KD, M100.FSC, M100.PDBV, M140.LIEUQL_SX, M100.PROD_MAIN_MATERIAL, M100.PO_TYPE, P400.REMK,P400.PROD_REQUEST_QTY,P400.PROD_REQUEST_NO,P400.PROD_REQUEST_DATE,P400.G_CODE,P400.DELIVERY_DT,P400.CODE_55,P400.CODE_50,M140.RIV_NO,M140.M_QTY,M140.M_CODE,M110.CUST_NAME,M100.ROLE_EA_QTY,M100.PACK_DRT,M100.G_WIDTH,M100.G_SG_R,M100.G_SG_L,M100.G_R,M100.G_NAME,M100.G_LG, M100.PROD_PRINT_TIMES, M100.G_LENGTH,M100.G_CODE_C,M100.G_CG,M100.G_C,M100.G_C_R,M100.PD, M100.CODE_33,M090.M_NAME,M090.WIDTH_CD,M010.EMPL_NO,M010.EMPL_NAME, P400.CODE_03,M140.REMK AS REMARK , (M090.STOCK_CFM_NM1 + STOCK_CFM_NM2) AS TONLIEU, (M090.HOLDING_CFM_NM1 + M090.HOLDING_CFM_NM2) AS HOLDING, (M090.STOCK_CFM_NM1 + STOCK_CFM_NM2 + M090.HOLDING_CFM_NM1 + M090.HOLDING_CFM_NM2) AS TONG_TON_LIEU, P400.PDUYET, M100.NO_INSPECTION, M100.PROD_DIECUT_STEP, M100.PROD_PRINT_TIMES,M100.FACTORY, M100.EQ1, M100.EQ2, M100.EQ3,M100.EQ4,M100.Setting1, M100.Setting2, M100.Setting3,M100.Setting4,M100.UPH1, M100.UPH2,M100.UPH3,M100.UPH4, M100.Step1, M100.Step2, M100.Step3,M100.Step4,M100.LOSS_SX1, M100.LOSS_SX2, M100.LOSS_SX3, M100.LOSS_SX4, M100.LOSS_SETTING1 , M100.LOSS_SETTING2 ,M100.LOSS_SETTING3, M100.LOSS_SETTING4, M100.NOTE FROM P400 
                    LEFT JOIN M100 ON P400.G_CODE = M100.G_CODE 
                    LEFT JOIN M010 ON P400.EMPL_NO = M010.EMPL_NO 
                    LEFT JOIN M140 ON P400.G_CODE = M140.G_CODE 
                    LEFT JOIN M090 ON M090.M_CODE = M140.M_CODE 
                    LEFT JOIN M110 ON M110.CUST_CD = P400.CUST_CD  WHERE P400.PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "tonlieugcode":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `DECLARE @tradate as datetime DECLARE @inventory as varchar(6) SET @tradate = '${DATA.tradate}' SET @inventory = '${DATA.inventory}' SELECT M090.M_CODE, M090.M_NAME, M090.WIDTH_CD, isnull(AA.INVENTORY_QTY,0) AS TON_DAU, isnull(BB.IN_CFM_QTY,0) AS INPUT, isnull(CC.OUT_CFM_QTY,0) AS OUTPUT, isnull(DD.RETURN_IN_QTY,0) AS RETURN_IN, isnull(EE.HOLDING_QTY,0) AS HOLDING, (isnull(AA.INVENTORY_QTY,0) + isnull(BB.IN_CFM_QTY,0)- isnull(CC.OUT_CFM_QTY,0) +isnull(DD.RETURN_IN_QTY,0)-isnull(EE.HOLDING_QTY,0)) AS GRAND_TOTAL FROM M090 LEFT JOIN (SELECT DISTINCT M_CODE, SUM(INVENTORY_QTY) AS INVENTORY_QTY FROM KIEMKE_NVL WHERE INVENTORY_DATE=@inventory GROUP BY M_CODE) AS AA ON (AA.M_CODE = M090.M_CODE) LEFT JOIN (SELECT DISTINCT M_CODE, SUM(IN_CFM_QTY) AS IN_CFM_QTY FROM I222 WHERE INS_DATE> @tradate GROUP BY M_CODE ) AS BB ON (BB.M_CODE = M090.M_CODE) LEFT JOIN (SELECT DISTINCT M_CODE, SUM(OUT_CFM_QTY) AS OUT_CFM_QTY FROM O302 WHERE INS_DATE>@tradate GROUP BY M_CODE ) AS CC ON (CC.M_CODE = M090.M_CODE) LEFT JOIN (SELECT DISTINCT M_CODE, SUM(RETURN_QTY) AS RETURN_IN_QTY FROM RETURN_NVL WHERE UPD_DATE>@tradate GROUP BY M_CODE) AS DD ON (DD.M_CODE = M090.M_CODE) LEFT JOIN (SELECT DISTINCT M_CODE, SUM(HOLDING_QTY) AS HOLDING_QTY FROM HOLDING_TB WHERE HOLDING_OUT_DATE is not null GROUP BY M_CODE) AS EE ON (EE.M_CODE = M090.M_CODE) WHERE M090.M_CODE='${DATA.M_CODE}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "check_inventorydate":
        (async () => {
          ////console.log(DATA);
          let currenttime = moment().format("YYYY-MM-DD HH:mm:ss");
          let checkkq = "OK";
          let setpdQuery = `SELECT MAX(INVENTORY_DATE) AS INVENTORY_DATE FROM KIEMKE_NVL`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "check_banve":
        (async () => {
          ////console.log(DATA);
          const draw_path = "C:\\xampp\\htdocs\\banve\\";
          if (!existsSync(draw_path + DATA.filename)) {
            res.send({ tk_status: "OK" });
          } else {
            res.send({ tk_status: "NG" });
          }
        })();
        break;
      case "update_banve_value":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `UPDATE M100 SET BANVE='${DATA.banvevalue}' WHERE G_CODE= '${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "check_amazon_data":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM AMAZONE_DATA WHERE DATA_1='${DATA.DATA}' OR DATA_2='${DATA.DATA}' OR  DATA_3='${DATA.DATA}' OR DATA_4='${DATA.DATA}' `;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkIDCongViecAMZ":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM AMAZONE_DATA WHERE NO_IN='${DATA.NO_IN}' `;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "get_ycsxInfo2":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT P400.CODE_50, P400.G_CODE, M100.G_NAME, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_NO, P400.PROD_REQUEST_QTY, M100.PROD_MODEL FROM P400 JOIN M100 ON (P400.G_CODE = M100.G_CODE) WHERE P400.PROD_REQUEST_NO='${DATA.ycsxno}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "get_cavityAmazon":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 CAVITY_PRINT FROM BOM_AMAZONE LEFT JOIN DESIGN_AMAZONE ON (BOM_AMAZONE.G_CODE_MAU = DESIGN_AMAZONE.G_CODE_MAU AND  BOM_AMAZONE.DOITUONG_NO = DESIGN_AMAZONE.DOITUONG_NO) WHERE BOM_AMAZONE.G_CODE='${DATA.g_code}'`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertData_Amazon":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO AMAZONE_DATA (CTR_CD,G_CODE,PROD_REQUEST_NO,NO_IN,ROW_NO,DATA_1,DATA_2,DATA_3,DATA_4,PRINT_STATUS,INLAI_COUNT,REMARK,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL) VALUES ('002','${DATA.G_CODE}','${DATA.PROD_REQUEST_NO}','${DATA.NO_IN}','${DATA.ROW_NO}','${DATA.DATA_1}','${DATA.DATA_2}','${DATA.DATA_3}','${DATA.DATA_4}','${DATA.PRINT_STATUS}','${DATA.INLAI_COUNT}','${DATA.REMARK}',GETDATE(),'${DATA.INS_EMPL}',GETDATE(),'${DATA.INS_EMPL}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertData_Amazon_SuperFast":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let uploadAmazonData = DATA.AMZDATA;
          let sql_insert_string = `INSERT INTO AMAZONE_DATA (CTR_CD,G_CODE,PROD_REQUEST_NO,NO_IN,ROW_NO,DATA_1,DATA_2,DATA_3,DATA_4,PRINT_STATUS,INLAI_COUNT,REMARK,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL) VALUES `;
          for (let i = 0; i < uploadAmazonData.length; i++) {
            sql_insert_string += `('002','${uploadAmazonData[i].G_CODE}','${uploadAmazonData[i].PROD_REQUEST_NO}','${uploadAmazonData[i].NO_IN}','${uploadAmazonData[i].ROW_NO}','${uploadAmazonData[i].DATA1}','${uploadAmazonData[i].DATA2}','','','OK','${uploadAmazonData[i].INLAI_COUNT}','${uploadAmazonData[i].REMARK}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}'),`;
          }
          sql_insert_string = sql_insert_string.substring(
            0,
            sql_insert_string.length - 1
          );
          let setpdQuery = `
          BEGIN TRANSACTION;
          BEGIN TRY
          ${sql_insert_string} 
          COMMIT;           
          END TRY
          BEGIN CATCH
          ROLLBACK;
          PRINT 'Co Loi: ' + ERROR_MESSAGE();
          END CATCH
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traPOFullCMS":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.codeSearch !== "") {
            condition += ` AND TONKHOFULL.G_NAME LIKE '%${DATA.codeSearch}%'`;
          }
          if (DATA.allcode !== false) {
            condition += ` AND PO_TABLE_1.PO_BALANCE >0 `;
          }
          let setpdQuery = `SELECT PO_TABLE_1.G_CODE,TONKHOFULL.G_NAME,TONKHOFULL.G_NAME_KD, PO_TABLE_1.PO_QTY, TOTAL_DELIVERED, PO_TABLE_1.PO_BALANCE, TONKHOFULL.CHO_KIEM, TONKHOFULL.CHO_CS_CHECK, TONKHOFULL.CHO_KIEM_RMA, TONKHOFULL.TONG_TON_KIEM, TONKHOFULL.BTP, TONKHOFULL.TON_TP, TONKHOFULL.BLOCK_QTY, TONKHOFULL.GRAND_TOTAL_STOCK, (TONKHOFULL.GRAND_TOTAL_STOCK-PO_TABLE_1.PO_BALANCE) AS THUA_THIEU, isnull(YCSXBLTB.YCSX_BALANCE,0) AS YCSX_BALANCE, isnull(YCSXBLTB.YCSX_QTY,0) AS YCSX_QTY, isnull(YCSXBLTB.KETQUASX,0) AS KETQUASX,isnull(YCSXBLTB.NHAPKHO,0) AS NHAPKHO
          FROM ( SELECT G_CODE, SUM(PO_QTY) AS PO_QTY, SUM(TOTAL_DELIVERED) AS TOTAL_DELIVERED, SUM(PO_BALANCE) AS PO_BALANCE FROM ( SELECT AA.G_CODE, ZTBPOTable.PO_QTY, AA.TotalDelivered as TOTAL_DELIVERED, (ZTBPOTable.PO_QTY-AA.TotalDelivered) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) ) AS PO_BALANCE_TABLE GROUP BY G_CODE ) AS PO_TABLE_1 LEFT JOIN ( SELECT M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, isnull(TONKIEM.INSPECT_BALANCE_QTY,0) AS CHO_KIEM, isnull(TONKIEM.WAIT_CS_QTY,0) AS CHO_CS_CHECK,isnull(TONKIEM.WAIT_SORTING_RMA,0) CHO_KIEM_RMA, isnull(TONKIEM.TOTAL_WAIT,0) AS TONG_TON_KIEM, isnull(BTP.BTP_QTY_EA,0) AS BTP, isnull(THANHPHAM.TONKHO,0) AS TON_TP, isnull(tbl_Block_table2.Block_Qty,0) AS BLOCK_QTY, (isnull(TONKIEM.TOTAL_WAIT,0) + isnull(BTP.BTP_QTY_EA,0)+ isnull(THANHPHAM.TONKHO,0) - isnull(tbl_Block_table2.Block_Qty,0)) AS GRAND_TOTAL_STOCK FROM M100 LEFT JOIN ( SELECT Product_MaVach, isnull([IN],0) AS NHAPKHO, isnull([OUT],0) AS XUATKHO, (isnull([IN],0)- isnull([OUT],0)) AS TONKHO FROM ( SELECT Product_Mavach, IO_Type, IO_Qty FROM tbl_InputOutput ) AS SourceTable PIVOT ( SUM(IO_Qty) FOR IO_Type IN ([IN], [OUT]) ) AS PivotTable ) AS THANHPHAM ON (THANHPHAM.Product_MaVach = M100.G_CODE) LEFT JOIN ( SELECT ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD, SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY, SUM(WAIT_CS_QTY) AS WAIT_CS_QTY, SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA, SUM(INSPECT_BALANCE_QTY+ WAIT_CS_QTY+ WAIT_SORTING_RMA) AS TOTAL_WAIT FROM ZTB_WAIT_INSPECT JOIN M100 ON ( M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE) WHERE UPDATE_DATE=CONVERT(date,GETDATE()) AND CALAMVIEC = 'DEM' GROUP BY ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD) AS TONKIEM ON (THANHPHAM.Product_MaVach = TONKIEM.G_CODE) LEFT JOIN ( SELECT Product_MaVach, SUM(Block_Qty) AS Block_Qty from tbl_Block2 GROUP BY Product_MaVach ) AS tbl_Block_table2 ON (tbl_Block_table2.Product_MaVach= M100.G_CODE) LEFT JOIN ( SELECT ZTB_HALF_GOODS.G_CODE, M100.G_NAME, SUM(BTP_QTY_EA) AS BTP_QTY_EA FROM ZTB_HALF_GOODS JOIN M100 ON (M100.G_CODE = ZTB_HALF_GOODS.G_CODE) WHERE UPDATE_DATE = CONVERT(date,GETDATE()) GROUP BY ZTB_HALF_GOODS.G_CODE, M100.G_NAME) AS BTP ON (BTP.G_CODE = THANHPHAM.Product_MaVach) ) AS TONKHOFULL ON (TONKHOFULL.G_CODE = PO_TABLE_1.G_CODE) 
          LEFT JOIN (
            SELECT P400.G_CODE, SUM(P400.PROD_REQUEST_QTY) AS YCSX_QTY, SUM(isnull(BB.KETQUASX,0)) AS KETQUASX, (SUM(P400.PROD_REQUEST_QTY) - SUM(isnull(BB.KETQUASX,0))) AS YCSX_BALANCE, SUM(isnull(INS_OUTPUT_TB.INS_OUTPUT,0)) AS NHAPKHO FROM 
          P400 
            LEFT JOIN
            (
              SELECT  PROD_REQUEST_NO, SUM(OUTPUT_QTY_EA) AS INS_OUTPUT FROM ZTBINSPECTOUTPUTTB GROUP BY PROD_REQUEST_NO
            ) AS INS_OUTPUT_TB 
            ON (INS_OUTPUT_TB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
            LEFT JOIN (
            SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO,  SUM(CASE WHEN ZTB_QLSXPLAN.PROCESS_NUMBER =1 AND ZTB_QLSXPLAN.STEP=0 THEN  isnull(SX_RESULT,0) ELSE 0 END) AS KETQUASX FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID) 
            WHERE ZTB_QLSXPLAN.STEP=0 GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO
            ) AS BB 
            ON (BB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
            WHERE P400.CODE_03<>'04' AND P400.PROD_REQUEST_QTY > INS_OUTPUT_TB.INS_OUTPUT AND PROD_REQUEST_DATE > '20230101'
            GROUP BY P400.G_CODE
          ) AS YCSXBLTB ON (YCSXBLTB.G_CODE =  PO_TABLE_1.G_CODE)
          ${condition}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traPOFullCMS2":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.codeSearch !== "") {
            condition += ` AND TONKHOFULL.G_NAME LIKE '%${DATA.codeSearch}%'`;
          }
          if (DATA.allcode !== false) {
            condition += ` AND PO_TABLE_1.PO_BALANCE >0 `;
          }
          let setpdQuery = `SELECT 
          PO_TABLE_1.G_CODE, 
          TONKHOFULL.G_NAME, 
          TONKHOFULL.G_NAME_KD, 
          PO_TABLE_1.PO_QTY, 
          TOTAL_DELIVERED, 
          PO_TABLE_1.PO_BALANCE, 
          TONKHOFULL.CHO_KIEM, 
          TONKHOFULL.CHO_CS_CHECK, 
          TONKHOFULL.CHO_KIEM_RMA, 
          TONKHOFULL.TONG_TON_KIEM, 
          TONKHOFULL.BTP, 
          TONKHOFULL.TON_TP, 
          TONKHOFULL.BLOCK_QTY, 
          TONKHOFULL.GRAND_TOTAL_STOCK, 
          (
            TONKHOFULL.GRAND_TOTAL_STOCK - PO_TABLE_1.PO_BALANCE
          ) AS THUA_THIEU, 
          isnull(YCSXBLTB.YCSX_BALANCE, 0) AS YCSX_BALANCE, 
          isnull(YCSXBLTB.YCSX_QTY, 0) AS YCSX_QTY, 
          isnull(YCSXBLTB.KETQUASX, 0) AS KETQUASX, 
          isnull(YCSXBLTB.NHAPKHO, 0) AS NHAPKHO 
        FROM 
          (
            SELECT 
              G_CODE, 
              SUM(PO_QTY) AS PO_QTY, 
              SUM(TOTAL_DELIVERED) AS TOTAL_DELIVERED, 
              SUM(PO_BALANCE) AS PO_BALANCE 
            FROM 
              (
                SELECT 
                  AA.G_CODE, 
                  ZTBPOTable.PO_QTY, 
                  AA.TotalDelivered as TOTAL_DELIVERED, 
                  (
                    ZTBPOTable.PO_QTY - AA.TotalDelivered
                  ) As PO_BALANCE 
                FROM 
                  (
                    SELECT 
                      ZTBPOTable.EMPL_NO, 
                      ZTBPOTable.CUST_CD, 
                      ZTBPOTable.G_CODE, 
                      ZTBPOTable.PO_NO, 
                      isnull(
                        SUM(ZTBDelivery.DELIVERY_QTY), 
                        0
                      ) AS TotalDelivered 
                    FROM 
                      ZTBPOTable 
                      LEFT JOIN ZTBDelivery ON (
                        ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD 
                        AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD 
                        AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE 
                        AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
                      ) 
                    GROUP BY 
                      ZTBPOTable.CTR_CD, 
                      ZTBPOTable.EMPL_NO, 
                      ZTBPOTable.G_CODE, 
                      ZTBPOTable.CUST_CD, 
                      ZTBPOTable.PO_NO
                  ) AS AA 
                  LEFT JOIN ZTBPOTable ON (
                    AA.CUST_CD = ZTBPOTable.CUST_CD 
                    AND AA.G_CODE = ZTBPOTable.G_CODE 
                    AND AA.PO_NO = ZTBPOTable.PO_NO
                  )
              ) AS PO_BALANCE_TABLE 
            GROUP BY 
              G_CODE
          ) AS PO_TABLE_1 
          LEFT JOIN (
            SELECT 
              M100.G_CODE, 
              M100.G_NAME, 
              M100.G_NAME_KD, 
              isnull(TONKIEM.INSPECT_BALANCE_QTY, 0) AS CHO_KIEM, 
              isnull(TONKIEM.WAIT_CS_QTY, 0) AS CHO_CS_CHECK, 
              isnull(TONKIEM.WAIT_SORTING_RMA, 0) CHO_KIEM_RMA, 
              isnull(TONKIEM.TOTAL_WAIT, 0) AS TONG_TON_KIEM, 
              isnull(BTP.BTP_QTY_EA, 0) AS BTP, 
              isnull(THANHPHAM.STOCK, 0) AS TON_TP, 
              isnull(THANHPHAM.BLOCK_QTY, 0) AS BLOCK_QTY, 
              (
                isnull(TONKIEM.TOTAL_WAIT, 0) + isnull(BTP.BTP_QTY_EA, 0)+ isnull(THANHPHAM.STOCK, 0) - isnull(THANHPHAM.BLOCK_QTY, 0)
              ) AS GRAND_TOTAL_STOCK 
            FROM 
              M100 
              LEFT JOIN (
            SELECT  AA.G_CODE, M100.G_NAME, M100.G_NAME_KD,M100.PROD_TYPE,  AA.STOCK, AA.BLOCK_QTY, (AA.STOCK+ AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
            (
            SELECT G_CODE, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK,SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660 WHERE USE_YN ='Y' GROUP BY G_CODE
            ) AS AA
            LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE)        
              ) AS THANHPHAM ON (
                THANHPHAM.G_CODE = M100.G_CODE
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
                THANHPHAM.G_CODE = TONKIEM.G_CODE
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
                BTP.G_CODE = THANHPHAM.G_CODE
              )
          ) AS TONKHOFULL ON (
            TONKHOFULL.G_CODE = PO_TABLE_1.G_CODE
          ) 
          LEFT JOIN (
            SELECT 
              P400.G_CODE, 
              SUM(P400.PROD_REQUEST_QTY) AS YCSX_QTY, 
              SUM(
                isnull(BB.KETQUASX, 0)
              ) AS KETQUASX, 
              (
                SUM(P400.PROD_REQUEST_QTY) - SUM(
                  isnull(BB.KETQUASX, 0)
                )
              ) AS YCSX_BALANCE, 
              SUM(
                isnull(INS_OUTPUT_TB.INS_OUTPUT, 0)
              ) AS NHAPKHO 
            FROM 
              P400 
              LEFT JOIN (
                SELECT 
                  PROD_REQUEST_NO, 
                  SUM(OUTPUT_QTY_EA) AS INS_OUTPUT 
                FROM 
                  ZTBINSPECTOUTPUTTB 
                GROUP BY 
                  PROD_REQUEST_NO
              ) AS INS_OUTPUT_TB ON (
                INS_OUTPUT_TB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO
              ) 
              LEFT JOIN (
                SELECT 
                  ZTB_QLSXPLAN.PROD_REQUEST_NO, 
                  SUM(
                    CASE WHEN ZTB_QLSXPLAN.PROCESS_NUMBER = 1 
                    AND ZTB_QLSXPLAN.STEP = 0 THEN isnull(SX_RESULT, 0) ELSE 0 END
                  ) AS KETQUASX 
                FROM 
                  ZTB_SX_RESULT 
                  LEFT JOIN ZTB_QLSXPLAN ON (
                    ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID
                  ) 
                WHERE 
                  ZTB_QLSXPLAN.STEP = 0 
                GROUP BY 
                  ZTB_QLSXPLAN.PROD_REQUEST_NO
              ) AS BB ON (
                BB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO
              ) 
            WHERE 
              P400.CODE_03 <> '04' 
              AND P400.PROD_REQUEST_QTY > INS_OUTPUT_TB.INS_OUTPUT 
              AND PROD_REQUEST_DATE > '20230101' 
            GROUP BY 
              P400.G_CODE
          ) AS YCSXBLTB ON (
            YCSXBLTB.G_CODE = PO_TABLE_1.G_CODE
          )
        
          ${condition}`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traPOFullKD":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.codeSearch !== "") {
            condition += ` AND TONKHOFULL.G_NAME LIKE '%${DATA.codeSearch}%'`;
          }
          if (DATA.allcode !== false) {
            condition += ` AND PO_TABLE_1.PO_BALANCE >0 `;
          }
          let setpdQuery = `SELECT TONKHOFULL.G_NAME_KD, SUM(PO_TABLE_1.PO_QTY) AS PO_QTY , SUM(TOTAL_DELIVERED) AS TOTAL_DELIVERED, SUM(PO_TABLE_1.PO_BALANCE) AS PO_BALANCE, SUM(TONKHOFULL.CHO_KIEM) AS CHO_KIEM, SUM(TONKHOFULL.CHO_CS_CHECK) AS CHO_CS_CHECK, SUM(TONKHOFULL.CHO_KIEM_RMA) AS CHO_KIEM_RMA, SUM(TONKHOFULL.TONG_TON_KIEM) AS TONG_TON_KIEM, SUM(TONKHOFULL.BTP) AS BTP, SUM(TONKHOFULL.TON_TP) AS TON_TP, SUM(TONKHOFULL.BLOCK_QTY) AS BLOCK_QTY, SUM(TONKHOFULL.GRAND_TOTAL_STOCK) AS GRAND_TOTAL_STOCK, SUM((TONKHOFULL.GRAND_TOTAL_STOCK-PO_TABLE_1.PO_BALANCE)) AS THUA_THIEU FROM ( SELECT G_CODE, SUM(PO_QTY) AS PO_QTY, SUM(TOTAL_DELIVERED) AS TOTAL_DELIVERED, SUM(PO_BALANCE) AS PO_BALANCE FROM ( SELECT AA.G_CODE, ZTBPOTable.PO_QTY, AA.TotalDelivered as TOTAL_DELIVERED, (ZTBPOTable.PO_QTY-AA.TotalDelivered) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) ) AS PO_BALANCE_TABLE GROUP BY G_CODE ) AS PO_TABLE_1 LEFT JOIN ( SELECT M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, isnull(TONKIEM.INSPECT_BALANCE_QTY,0) AS CHO_KIEM, isnull(TONKIEM.WAIT_CS_QTY,0) AS CHO_CS_CHECK,isnull(TONKIEM.WAIT_SORTING_RMA,0) CHO_KIEM_RMA, isnull(TONKIEM.TOTAL_WAIT,0) AS TONG_TON_KIEM, isnull(BTP.BTP_QTY_EA,0) AS BTP, isnull(THANHPHAM.TONKHO,0) AS TON_TP, isnull(tbl_Block_table2.Block_Qty,0) AS BLOCK_QTY, (isnull(TONKIEM.TOTAL_WAIT,0) + isnull(BTP.BTP_QTY_EA,0)+ isnull(THANHPHAM.TONKHO,0) - isnull(tbl_Block_table2.Block_Qty,0)) AS GRAND_TOTAL_STOCK FROM M100 LEFT JOIN ( SELECT Product_MaVach, isnull([IN],0) AS NHAPKHO, isnull([OUT],0) AS XUATKHO, (isnull([IN],0)- isnull([OUT],0)) AS TONKHO FROM ( SELECT Product_Mavach, IO_Type, IO_Qty FROM tbl_InputOutput ) AS SourceTable PIVOT ( SUM(IO_Qty) FOR IO_Type IN ([IN], [OUT]) ) AS PivotTable ) AS THANHPHAM ON (THANHPHAM.Product_MaVach = M100.G_CODE) LEFT JOIN ( SELECT ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD, SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY, SUM(WAIT_CS_QTY) AS WAIT_CS_QTY, SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA, SUM(INSPECT_BALANCE_QTY+ WAIT_CS_QTY+ WAIT_SORTING_RMA) AS TOTAL_WAIT FROM ZTB_WAIT_INSPECT JOIN M100 ON ( M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE) WHERE UPDATE_DATE=CONVERT(date,GETDATE()) AND CALAMVIEC = 'DEM' GROUP BY ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD) AS TONKIEM ON (THANHPHAM.Product_MaVach = TONKIEM.G_CODE) LEFT JOIN ( SELECT Product_MaVach, SUM(Block_Qty) AS Block_Qty from tbl_Block2 GROUP BY Product_MaVach ) AS tbl_Block_table2 ON (tbl_Block_table2.Product_MaVach= M100.G_CODE) LEFT JOIN ( SELECT ZTB_HALF_GOODS.G_CODE, M100.G_NAME, SUM(BTP_QTY_EA) AS BTP_QTY_EA FROM ZTB_HALF_GOODS JOIN M100 ON (M100.G_CODE = ZTB_HALF_GOODS.G_CODE) WHERE UPDATE_DATE = CONVERT(date,GETDATE()) GROUP BY ZTB_HALF_GOODS.G_CODE, M100.G_NAME) AS BTP ON (BTP.G_CODE = THANHPHAM.Product_MaVach) ) AS TONKHOFULL ON (TONKHOFULL.G_CODE = PO_TABLE_1.G_CODE)   ${condition} GROUP BY TONKHOFULL.G_NAME_KD`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traPOFullKD2":
        (async () => {
          ////console.log(DATA);
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.codeSearch !== "") {
            condition += ` AND TONKHOFULL.G_NAME LIKE '%${DATA.codeSearch}%'`;
          }
          if (DATA.allcode !== false) {
            condition += ` AND PO_TABLE_1.PO_BALANCE >0 `;
          }
          let setpdQuery = `SELECT 
          TONKHOFULL.G_NAME_KD, 
          SUM(PO_TABLE_1.PO_QTY) AS PO_QTY, 
          SUM(TOTAL_DELIVERED) AS TOTAL_DELIVERED, 
          SUM(PO_TABLE_1.PO_BALANCE) AS PO_BALANCE, 
          SUM(TONKHOFULL.CHO_KIEM) AS CHO_KIEM, 
          SUM(TONKHOFULL.CHO_CS_CHECK) AS CHO_CS_CHECK, 
          SUM(TONKHOFULL.CHO_KIEM_RMA) AS CHO_KIEM_RMA, 
          SUM(TONKHOFULL.TONG_TON_KIEM) AS TONG_TON_KIEM, 
          SUM(TONKHOFULL.BTP) AS BTP, 
          SUM(TONKHOFULL.TON_TP) AS TON_TP, 
          SUM(TONKHOFULL.BLOCK_QTY) AS BLOCK_QTY, 
          SUM(TONKHOFULL.GRAND_TOTAL_STOCK) AS GRAND_TOTAL_STOCK, 
          SUM(
            (
              TONKHOFULL.GRAND_TOTAL_STOCK - PO_TABLE_1.PO_BALANCE
            )
          ) AS THUA_THIEU 
        FROM 
          (
            SELECT 
              G_CODE, 
              SUM(PO_QTY) AS PO_QTY, 
              SUM(TOTAL_DELIVERED) AS TOTAL_DELIVERED, 
              SUM(PO_BALANCE) AS PO_BALANCE 
            FROM 
              (
                SELECT 
                  AA.G_CODE, 
                  ZTBPOTable.PO_QTY, 
                  AA.TotalDelivered as TOTAL_DELIVERED, 
                  (
                    ZTBPOTable.PO_QTY - AA.TotalDelivered
                  ) As PO_BALANCE 
                FROM 
                  (
                    SELECT 
                      ZTBPOTable.EMPL_NO, 
                      ZTBPOTable.CUST_CD, 
                      ZTBPOTable.G_CODE, 
                      ZTBPOTable.PO_NO, 
                      isnull(
                        SUM(ZTBDelivery.DELIVERY_QTY), 
                        0
                      ) AS TotalDelivered 
                    FROM 
                      ZTBPOTable 
                      LEFT JOIN ZTBDelivery ON (
                        ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD 
                        AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD 
                        AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE 
                        AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO
                      ) 
                    GROUP BY 
                      ZTBPOTable.CTR_CD, 
                      ZTBPOTable.EMPL_NO, 
                      ZTBPOTable.G_CODE, 
                      ZTBPOTable.CUST_CD, 
                      ZTBPOTable.PO_NO
                  ) AS AA 
                  LEFT JOIN ZTBPOTable ON (
                    AA.CUST_CD = ZTBPOTable.CUST_CD 
                    AND AA.G_CODE = ZTBPOTable.G_CODE 
                    AND AA.PO_NO = ZTBPOTable.PO_NO
                  )
              ) AS PO_BALANCE_TABLE 
            GROUP BY 
              G_CODE
          ) AS PO_TABLE_1 
          LEFT JOIN (
            SELECT 
              M100.G_CODE, 
              M100.G_NAME, 
              M100.G_NAME_KD, 
              isnull(TONKIEM.INSPECT_BALANCE_QTY, 0) AS CHO_KIEM, 
              isnull(TONKIEM.WAIT_CS_QTY, 0) AS CHO_CS_CHECK, 
              isnull(TONKIEM.WAIT_SORTING_RMA, 0) CHO_KIEM_RMA, 
              isnull(TONKIEM.TOTAL_WAIT, 0) AS TONG_TON_KIEM, 
              isnull(BTP.BTP_QTY_EA, 0) AS BTP, 
              isnull(THANHPHAM.STOCK, 0) AS TON_TP, 
              isnull(THANHPHAM.BLOCK_QTY, 0) AS BLOCK_QTY, 
              (
                isnull(TONKIEM.TOTAL_WAIT, 0) + isnull(BTP.BTP_QTY_EA, 0)+ isnull(THANHPHAM.STOCK, 0) - isnull(THANHPHAM.BLOCK_QTY, 0)
              ) AS GRAND_TOTAL_STOCK 
            FROM 
              M100 
              LEFT JOIN (
                 SELECT  AA.G_CODE, M100.G_NAME, M100.G_NAME_KD,M100.PROD_TYPE,  AA.STOCK, AA.BLOCK_QTY, (AA.STOCK+ AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
                    (
                    SELECT G_CODE, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK,SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660 WHERE USE_YN ='Y' GROUP BY G_CODE
                    ) AS AA
                    LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE)     
              ) AS THANHPHAM ON (
                THANHPHAM.G_CODE = M100.G_CODE
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
                THANHPHAM.G_CODE = TONKIEM.G_CODE
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
                BTP.G_CODE = THANHPHAM.G_CODE
              )
          ) AS TONKHOFULL ON (
            TONKHOFULL.G_CODE = PO_TABLE_1.G_CODE
          ) 
         ${condition} GROUP BY TONKHOFULL.G_NAME_KD`;
          //////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "trakhotpInOut":
        (async () => {
          ////console.log(DATA);
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
        })();
        break;
      case "traSTOCKCMS":
        (async () => {
          ////console.log(DATA);
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
        })();
        break;
      case "traSTOCKKD":
        (async () => {
          ////console.log(DATA);
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
        })();
        break;
      case "traSTOCKTACH":
        (async () => {
          ////console.log(DATA);
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
        })();
        break;
      case "codeinfo":
        (async () => {
          let DATA = qr["DATA"];
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT M100.LOSS_ST_SX1, M100.LOSS_ST_SX2, M100.G_CODE, G_NAME, G_NAME_KD, PROD_TYPE, PROD_LAST_PRICE, PD, (G_C* G_C_R) AS CAVITY, ROLE_EA_QTY AS PACKING_QTY,  G_WIDTH, G_LENGTH, PROD_PROJECT,PROD_MODEL, CCC.M_NAME_FULLBOM, BANVE, NO_INSPECTION, USE_YN, PDBV, PROD_DIECUT_STEP, PROD_PRINT_TIMES,FACTORY, EQ1, EQ2,  EQ3, EQ4, Setting1, Setting2, Setting3, Setting4, UPH1, UPH2, UPH3, UPH4, Step1, Step2, Step3, Step4, LOSS_SX1, LOSS_SX2, LOSS_SX3, LOSS_SX4,  LOSS_SETTING1 , LOSS_SETTING2 ,  LOSS_SETTING3 , LOSS_SETTING4 , LOSS_ST_SX1, LOSS_ST_SX2, LOSS_ST_SX3, LOSS_ST_SX4, NOTE FROM M100 LEFT JOIN (SELECT BBB.G_CODE, string_agg(BBB.M_NAME, ', ') AS M_NAME_FULLBOM FROM (SELECT DISTINCT AAA.G_CODE, M090.M_NAME FROM ( (SELECT DISTINCT G_CODE, M_CODE FROM M140) AS AAA LEFT JOIN M090 ON (AAA.M_CODE = M090.M_CODE) ) ) AS BBB GROUP BY BBB.G_CODE) AS CCC ON (CCC.G_CODE = M100.G_CODE) WHERE M100.G_NAME LIKE '%${DATA.G_NAME}%' OR M100.G_CODE ='${DATA.G_NAME}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_dailyclosing":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` SELECT  ZTBDelivery.DELIVERY_DATE, SUM(ZTBDelivery.DELIVERY_QTY) AS DELIVERY_QTY, SUM((ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE)) AS DELIVERED_AMOUNT FROM ZTBDelivery 
                    LEFT JOIN ZTBPOTable ON (ZTBPOTable.CUST_CD = ZTBDelivery.CUST_CD AND ZTBPOTable.G_CODE = ZTBDelivery.G_CODE AND ZTBPOTable.PO_NO = ZTBDelivery.PO_NO) WHERE ZTBDelivery.DELIVERY_DATE BETWEEN '${DATA.START_DATE}' AND  '${DATA.END_DATE}' GROUP BY DELIVERY_DATE ORDER BY  DELIVERY_DATE ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_weeklyclosing":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM (SELECT TOP 8 DATEPART( ISOWK, DATEADD(day,1,DELIVERY_DATE)) As DEL_WEEK, SUM(ZTBDelivery.DELIVERY_QTY) AS DELIVERY_QTY, SUM(ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE) AS DELIVERED_AMOUNT FROM ZTBDelivery 
                    LEFT JOIN ZTBPOTable ON (ZTBPOTable.CUST_CD = ZTBDelivery.CUST_CD AND ZTBPOTable.G_CODE = ZTBDelivery.G_CODE AND ZTBPOTable.PO_NO = ZTBDelivery.PO_NO) WHERE YEAR(ZTBDelivery.DELIVERY_DATE) = '${DATA.YEAR}' GROUP BY  DATEPART( ISOWK, DATEADD(day,1,DELIVERY_DATE))  ORDER BY DEL_WEEK DESC) AS AA ORDER BY AA.DEL_WEEK ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_monthlyclosing":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` SELECT  MONTH(ZTBDelivery.DELIVERY_DATE) AS MONTH_NUM,SUM(ZTBDelivery.DELIVERY_QTY) AS DELIVERY_QTY,  SUM(ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE) AS DELIVERED_AMOUNT FROM ZTBDelivery 
                    LEFT JOIN ZTBPOTable ON (ZTBPOTable.CUST_CD = ZTBDelivery.CUST_CD AND ZTBPOTable.G_CODE = ZTBDelivery.G_CODE AND ZTBPOTable.PO_NO = ZTBDelivery.PO_NO) WHERE YEAR(ZTBDelivery.DELIVERY_DATE) = '${DATA.YEAR}'
                    GROUP BY MONTH(ZTBDelivery.DELIVERY_DATE) ORDER BY MONTH_NUM ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_annuallyclosing":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` SELECT  YEAR(ZTBDelivery.DELIVERY_DATE) AS YEAR_NUM, SUM(ZTBDelivery.DELIVERY_QTY) AS DELIVERY_QTY,  SUM(ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE) AS DELIVERED_AMOUNT FROM ZTBDelivery 
                    LEFT JOIN ZTBPOTable ON (ZTBPOTable.CUST_CD = ZTBDelivery.CUST_CD AND ZTBPOTable.G_CODE = ZTBDelivery.G_CODE AND ZTBPOTable.PO_NO = ZTBDelivery.PO_NO) 
                    GROUP BY YEAR(ZTBDelivery.DELIVERY_DATE)  ORDER BY YEAR_NUM ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_runningpobalance":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM ( SELECT TOP 8 AA.PO_YEAR, AA.PO_WEEK, CONCAT(AA.PO_YEAR,'_', AA.PO_WEEK) AS YEAR_WEEK, isnull(AA.RUNNING_PO_QTY,0) AS RUNNING_PO_QTY, isnull(BB.RUNNING_DEL_QTY,0) AS RUNNING_DEL_QTY, (isnull(AA.RUNNING_PO_QTY,0)-isnull(BB.RUNNING_DEL_QTY,0)) AS RUNNING_PO_BALANCE FROM 
                    (
                    SELECT XX.PO_YEAR, XX.PO_WEEK, SUM(CAST(XX.WEEKLY_PO_QTY AS Float)) OVER(ORDER BY XX.PO_YEAR ASC, XX.PO_WEEK ASC) AS RUNNING_PO_QTY FROM 
                    (
                    SELECT DISTINCT YEAR(PO_DATE) AS PO_YEAR,DATEPART( ISOWK, DATEADD(day,2,PO_DATE)) As PO_WEEK, 
                    SUM(ZTBPOTable.PO_QTY) OVER(PARTITION BY YEAR(PO_DATE),DATEPART(ISOWK, DATEADD(day,2,PO_DATE))) AS WEEKLY_PO_QTY
                    FROM ZTBPOTable
                    ) AS XX
                    ) AS AA
                    LEFT JOIN 
                    (
                    SELECT XX.DEL_YEAR, XX.DEL_WEEK, SUM(CAST(XX.WEEKLY_DEL_QTY AS Float)) OVER(ORDER BY XX.DEL_YEAR ASC, XX.DEL_WEEK ASC) AS RUNNING_DEL_QTY FROM 
                    (
                    SELECT DISTINCT YEAR(DELIVERY_DATE) AS DEL_YEAR,DATEPART( ISOWK, DATEADD(day,2,DELIVERY_DATE)) As DEL_WEEK, 
                    SUM(ZTBDelivery.DELIVERY_QTY) OVER(PARTITION BY YEAR(DELIVERY_DATE),DATEPART(ISOWK, DATEADD(day,2,DELIVERY_DATE))) AS WEEKLY_DEL_QTY
                    FROM ZTBDelivery
                    ) AS XX
                    ) AS BB
                    ON (AA.PO_WEEK = BB.DEL_WEEK AND AA.PO_YEAR = BB.DEL_YEAR) WHERE PO_YEAR='${DATA.YEAR}'
                    ORDER BY PO_YEAR ASC, PO_WEEK DESC) AS BB ORDER BY BB.PO_WEEK ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_weeklypo":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT  DISTINCT YEAR(PO_DATE) AS PO_YEAR,DATEPART( ISOWK, DATEADD(day,2,PO_DATE)) As PO_WEEK, CONCAT(YEAR(PO_DATE),'_', DATEPART( ISOWK, DATEADD(day,2,PO_DATE))) AS YEAR_WEEK ,
                    SUM(ZTBPOTable.PO_QTY) OVER(PARTITION BY YEAR(PO_DATE),DATEPART(ISOWK, DATEADD(day,2,PO_DATE))) AS WEEKLY_PO_QTY
                    FROM ZTBPOTable
                    ORDER BY YEAR(PO_DATE) DESC ,DATEPART( ISOWK, DATEADD(day,2,PO_DATE)) DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_weeklydelivery":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT DISTINCT YEAR(DELIVERY_DATE) AS DEL_YEAR,DATEPART( ISOWK, DATEADD(day,2,DELIVERY_DATE)) As DEL_WEEK,  CONCAT(YEAR(DELIVERY_DATE),'_', DATEPART( ISOWK, DATEADD(day,2,DELIVERY_DATE))) AS YEAR_WEEK ,
                    SUM(ZTBDelivery.DELIVERY_QTY) OVER(PARTITION BY YEAR(DELIVERY_DATE),DATEPART(ISOWK, DATEADD(day,2,DELIVERY_DATE))) AS WEEKLY_DELIVERY_QTY
                    FROM ZTBDelivery
                    ORDER BY YEAR(DELIVERY_DATE) DESC ,DATEPART( ISOWK, DATEADD(day,2,DELIVERY_DATE)) DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "kd_pooverweek":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM (SELECT DISTINCT  TOP 8 YEAR(PO_DATE) AS PO_YEAR,DATEPART( ISOWK, DATEADD(day,2,PO_DATE)) As PO_WEEK, CONCAT(YEAR(PO_DATE),'_', DATEPART( ISOWK, DATEADD(day,2,PO_DATE))) AS YEAR_WEEK ,
                    SUM(ZTBPOTable.PO_QTY) OVER(PARTITION BY YEAR(PO_DATE),DATEPART(ISOWK, DATEADD(day,2,PO_DATE))) AS WEEKLY_PO_QTY
                    FROM ZTBPOTable
                    WHERE YEAR(PO_DATE)='${DATA.YEAR}'
                    ORDER BY YEAR(PO_DATE) ASC ,DATEPART( ISOWK, DATEADD(day,2,PO_DATE)) DESC) AS AA ORDER BY AA.PO_WEEK ASC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "tratonlieu":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let condition = "WHERE 1=1 ";
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND M090.M_CODE = '${DATA.M_CODE}'`;
          }
          if (DATA.JUSTBALANCE === true) {
            condition += ` AND ((OK_M1 + OK_M2)  <>0 OR (HOLDING_M1+ HOLDING_M2) <>0)`;
          }
          let setpdQuery = `SELECT TDS, M_CODE, M_NAME, WIDTH_CD, STOCK_CFM_NM1 AS TON_NM1, STOCK_CFM_NM2 AS TON_NM2, HOLDING_CFM_NM1 AS HOLDING_NM1, HOLDING_CFM_NM2 AS HOLDING_NM2, (STOCK_CFM_NM1 + STOCK_CFM_NM2) AS TOTAL_OK, (HOLDING_CFM_NM1+ HOLDING_CFM_NM1) AS TOTAL_HOLDING FROM M090  ${condition}`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "tranhaplieu":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let condition = `WHERE I222.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59' `;
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.ROLL_NO_START != "" && DATA.ROLL_NO_STOP != "") {
            condition += ` AND SUBSTRING(M_LOT_NO,7,10) BETWEEN '${DATA.ROLL_NO_START}' AND '${DATA.ROLL_NO_STOP}'`;
          }

          let setpdQuery = ` SELECT  I222.LOTNCC, I222.QC_PASS, I222.QC_PASS_EMPL, I222.QC_PASS_DATE, I222.M_LOT_NO, I222.M_CODE,M090.M_NAME, M090.WIDTH_CD, I222.IN_CFM_QTY,  I222.ROLL_QTY, (I222.IN_CFM_QTY * I222.ROLL_QTY) AS TOTAL_IN_QTY, I222.INS_DATE, M110.CUST_NAME_KD FROM I222 
                    LEFT JOIN  M110 ON (I222.CUST_CD = M110.CUST_CD)
                    LEFT JOIN M090 ON (M090.M_CODE=  I222.M_CODE)
                   
                    ${condition}
                    ORDER BY I222.INS_DATE DESC`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traxuatlieu":
        (async () => {
          //////console.log(DATA);
          let checkkq = "OK";
          let condition = ` WHERE 1=1 `;
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
          let setpdQuery = ` SELECT  M100.G_CODE, M100.G_NAME, P400.PROD_REQUEST_NO, O302.PLAN_ID, M090.M_CODE, M090.M_NAME, M090.WIDTH_CD, O302.M_LOT_NO, O302.OUT_CFM_QTY, O302.ROLL_QTY, (O302.OUT_CFM_QTY* O302.ROLL_QTY) AS TOTAL_OUT_QTY, O302.INS_DATE 
                    FROM O302
                    LEFT JOIN O301 ON (O302.OUT_DATE = O301.OUT_DATE AND O302.OUT_NO = O301.OUT_NO AND O301.OUT_SEQ = O302.OUT_SEQ)
                    LEFT JOIN O300 ON (O300.OUT_DATE = O301.OUT_DATE AND O300.OUT_NO = O301.OUT_NO)
                    LEFT JOIN P400 ON (O300.PROD_REQUEST_NO = P400.PROD_REQUEST_NO) 
                    LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE)
                    LEFT JOIN M090 ON (M090.M_CODE = O302.M_CODE) 
                    ${condition}
                    ORDER BY O302.INS_DATE DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "setngoaiquan":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` UPDATE M100 SET NO_INSPECTION= '${DATA.VALUE}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "resetbanve":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          //////console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = ` UPDATE M100 SET BANVE= 'N', PDBV='Y' WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          ////console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "pdbanve":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          if (
            (JOB_NAME === "Sub Leader" || JOB_NAME === "Leader") &&
            (SUBDEPTNAME == "PQC1" || SUBDEPTNAME == "PQC3")
          ) {
            //////console.log(DATA);
            let checkkq = "OK";
            let setpdQuery = ` UPDATE M100 SET PDBV= 'Y', PDBV_EMPL='${EMPL_NO}', PDBV_DATE=GETDATE() WHERE G_CODE='${DATA.G_CODE}'`;
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
        })();
        break;
      case "trapqc1data":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  ZTBPQC1TABLE.PQC1_ID,ZTBPQC1TABLE.PLAN_ID,CONCAT(datepart(YEAR,ZTBPQC1TABLE.SETTING_OK_TIME),'_',datepart(ISO_WEEK,DATEADD(day,2,ZTBPQC1TABLE.SETTING_OK_TIME))) AS YEAR_WEEK, ZTBPQC1TABLE.PROD_REQUEST_NO,P400.PROD_REQUEST_QTY,P400.PROD_REQUEST_DATE,ZTBPQC1TABLE.PROCESS_LOT_NO,M100.G_NAME,M100.G_NAME_KD,ZTBPQC1TABLE.LINEQC_PIC AS LINEQC_PIC,ZTBPQC1TABLE.PROD_PIC,ZTBPQC1TABLE.PROD_LEADER,ZTBPQC1TABLE.LINE_NO,ZTBPQC1TABLE.STEPS,ZTBPQC1TABLE.CAVITY,ZTBPQC1TABLE.SETTING_OK_TIME,ZTBPQC1TABLE.FACTORY,ZTBPQC1TABLE.INSPECT_SAMPLE_QTY,M100.PROD_LAST_PRICE,(M100.PROD_LAST_PRICE*ZTBPQC1TABLE.INSPECT_SAMPLE_QTY) AS SAMPLE_AMOUNT, ZTBPQC1TABLE.CNDB_ENCODES, ZTBPQC1TABLE.REMARK,ZTBPQC1TABLE.INS_DATE,ZTBPQC1TABLE.UPD_DATE, ZTBPQC3TABLE.PQC3_ID, ZTBPQC3TABLE.OCCURR_TIME, ZTBPQC3TABLE.INSPECT_QTY, ZTBPQC3TABLE.DEFECT_QTY, ZTBPQC3TABLE.DEFECT_PHENOMENON
                        FROM
                       ZTBPQC1TABLE
                       LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = ZTBPQC1TABLE.PROD_REQUEST_NO)
                       LEFT JOIN M100 ON (M100.G_CODE = ZTBPQC1TABLE.G_CODE)
                       LEFT JOIN  ZTBPQC3TABLE  ON (ZTBPQC1TABLE.PQC1_ID= ZTBPQC3TABLE.PQC1_ID)
                       ${generate_condition_pqc1(
                         DATA.ALLTIME,
                         DATA.FROM_DATE,
                         DATA.TO_DATE,
                         DATA.CUST_NAME,
                         DATA.G_CODE,
                         DATA.G_NAME,
                         DATA.PROD_REQUEST_NO,
                         DATA.PROCESS_LOT_NO,
                         DATA.ID,
                         DATA.FACTORY
                       )} 
                       ORDER BY ZTBPQC1TABLE.PQC1_ID DESC`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "trapqc3data":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT M110.CUST_NAME_KD, CONCAT(datepart(YEAR,ZTBPQC3TABLE.OCCURR_TIME),'_',datepart(ISO_WEEK,DATEADD(day,2,ZTBPQC3TABLE.OCCURR_TIME))) AS YEAR_WEEK,ZTBPQC3TABLE.PQC3_ID,ZTBPQC3TABLE.PQC1_ID,ZTBPQC1TABLE.FACTORY,ZTBPQC3TABLE.PROD_REQUEST_NO,P400.PROD_REQUEST_DATE,ZTBPQC3TABLE.PROCESS_LOT_NO,ZTBPQC3TABLE.G_CODE,M100.G_NAME,M100.G_NAME_KD,M100.PROD_LAST_PRICE,ZTBPQC3TABLE.LINEQC_PIC,ZTBPQC1TABLE.PROD_PIC,ZTBPQC1TABLE.PROD_LEADER,ZTBPQC1TABLE.LINE_NO,ZTBPQC3TABLE.OCCURR_TIME,ZTBPQC3TABLE.INSPECT_QTY,ZTBPQC3TABLE.DEFECT_QTY,(ZTBPQC3TABLE.DEFECT_QTY *M100.PROD_LAST_PRICE ) AS DEFECT_AMOUNT,ZTBPQC3TABLE.DEFECT_PHENOMENON,ZTBPQC3TABLE.DEFECT_IMAGE_LINK,ZTBPQC3TABLE.REMARK,ZTBPQC3TABLE.WORST5,ZTBPQC3TABLE.WORST5_MONTH, ZTBPQC3TABLE.ERR_CODE
                        FROM ZTBPQC3TABLE 
                       LEFT JOIN ZTBPQC1TABLE ON (ZTBPQC3TABLE.PQC1_ID = ZTBPQC1TABLE.PQC1_ID)
                       LEFT JOIN M100 ON (M100.G_CODE = ZTBPQC3TABLE.G_CODE)
                       LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = ZTBPQC3TABLE.PROD_REQUEST_NO)
                       LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD)
                       ${generate_condition_pqc3(
                         DATA.ALLTIME,
                         DATA.FROM_DATE,
                         DATA.TO_DATE,
                         DATA.CUST_NAME,
                         DATA.G_CODE,
                         DATA.G_NAME,
                         DATA.PROD_REQUEST_NO,
                         DATA.PROCESS_LOT_NO,
                         DATA.ID,
                         DATA.FACTORY
                       )} 
                       ORDER BY ZTBPQC3TABLE.PQC3_ID DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "tradaofilm":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT KNIFE_FILM_ID,FACTORY_NAME,NGAYBANGIAO,KNIFE_FILM.G_CODE, M100.G_NAME, LOAIBANGIAO_PDP,LOAIPHATHANH,SOLUONG,SOLUONGOHP,LYDOBANGIAO,PQC_EMPL_NO,RND_EMPL_NO,SX_EMPL_NO,MA_DAO,REMARK FROM KNIFE_FILM LEFT JOIN M100 ON (M100.G_CODE = KNIFE_FILM.G_CODE)
                        ORDER BY KNIFE_FILM_ID DESC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "traCNDB":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT Z_CNDBTABLE.CNDB_DATE,Z_CNDBTABLE.CNDB_NO,Z_CNDBTABLE.CNDB_ENCODE,Z_CNDBTABLE.M_NAME,Z_CNDBTABLE.DEFECT_NAME,Z_CNDBTABLE.DEFECT_CONTENT,Z_CNDBTABLE.REG_EMPL_NO,Z_CNDBTABLE.REMARK,Z_CNDBTABLE.M_NAME2,Z_CNDBTABLE.INS_DATE,Z_CNDBTABLE.APPROVAL_STATUS,Z_CNDBTABLE.APPROVAL_EMPL,Z_CNDBTABLE.APPROVAL_DATE,Z_SPECIAL_PRODUCT.G_CODE,Z_SPECIAL_PRODUCT.G_NAME,Z_SPECIAL_PRODUCT.CNDB_QTY FROM Z_CNDBTABLE LEFT JOIN Z_SPECIAL_PRODUCT ON (Z_SPECIAL_PRODUCT.CNDB_ENCODE = Z_CNDBTABLE.CNDB_ENCODE)
                        ORDER BY CNDB_DATE DESC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "traPOSummaryTotal":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT  SUM(cast(ZTBPOTable.PO_QTY as bigint)) As PO_QTY, SUM(cast(AA.TotalDelivered as bigint)) as TOTAL_DELIVERED, SUM(cast((ZTBPOTable.PO_QTY-AA.TotalDelivered) as bigint)) As PO_BALANCE,SUM((ZTBPOTable.PO_QTY*ZTBPOTable.PROD_PRICE)) As PO_AMOUNT , SUM((AA.TotalDelivered*ZTBPOTable.PROD_PRICE)) As DELIVERED_AMOUNT, SUM(((ZTBPOTable.PO_QTY-AA.TotalDelivered)*ZTBPOTable.PROD_PRICE)) As BALANCE_AMOUNT FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable  LEFT JOIN ZTBDelivery  ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO)  GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN M010 ON (M010.EMPL_NO = AA.EMPL_NO) LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE) LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO)  JOIN M110 ON (M110.CUST_CD = AA.CUST_CD) `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "customerRevenue":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM (
                            SELECT AA.CUST_NAME_KD, SUM(AA.DELIVERY_AMOUNT) AS DELIVERY_AMOUNT FROM 
                            (SELECT M010.EMPL_NAME, ZTBDelivery.G_CODE,ZTBDelivery.DELIVERY_QTY,ZTBDelivery.DELIVERY_DATE, M110.CUST_NAME_KD, (ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE) AS DELIVERY_AMOUNT
                            FROM ZTBDelivery
                            LEFT JOIN M110 ON (ZTBDelivery.CUST_CD = M110.CUST_CD)
                            LEFT JOIN M010 ON (ZTBDelivery.EMPL_NO = M010.EMPL_NO)
                            LEFT JOIN ZTBPOTable ON (ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO)
                            WHERE DELIVERY_DATE BETWEEN '${DATA.START_DATE}' AND '${DATA.END_DATE}') AS AA
                            GROUP BY AA.CUST_NAME_KD) AS BB
                            ORDER BY BB.DELIVERY_AMOUNT DESC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "PICRevenue":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM (
                            SELECT AA.EMPL_NAME, SUM(AA.DELIVERY_AMOUNT) AS DELIVERY_AMOUNT FROM 
                            (SELECT M010.EMPL_NAME, ZTBDelivery.G_CODE,ZTBDelivery.DELIVERY_QTY,ZTBDelivery.DELIVERY_DATE, M110.CUST_NAME_KD, (ZTBDelivery.DELIVERY_QTY * ZTBPOTable.PROD_PRICE) AS DELIVERY_AMOUNT
                            FROM ZTBDelivery
                            LEFT JOIN M110 ON (ZTBDelivery.CUST_CD = M110.CUST_CD)
                            LEFT JOIN M010 ON (ZTBDelivery.EMPL_NO = M010.EMPL_NO)
                            LEFT JOIN ZTBPOTable ON (ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO)
                            WHERE DELIVERY_DATE BETWEEN '${DATA.START_DATE}' AND '${DATA.END_DATE}') AS AA
                            GROUP BY AA.EMPL_NAME) AS BB
                            ORDER BY BB.DELIVERY_AMOUNT DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "POBalanceByCustomer":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT XX.CUST_NAME_KD, YY.TOTAL_PO_BALANCE, XX.TSP, XX.LABEL, XX.UV, XX.OLED, XX.TAPE, XX.RIBBON, XX.SPT, (YY.TOTAL_PO_BALANCE- XX.TSP- XX.LABEL- XX.UV- XX.OLED- XX.TAPE- XX.RIBBON- XX.SPT) AS OTHERS FROM  (SELECT  PV.CUST_NAME_KD, (isnull(PV.[TSP],0)+isnull(PV.[LABEL],0)+isnull(PV.[UV],0)+isnull(PV.[TAPE],0) + isnull(PV.[SPT],0)+ isnull(PV.[OLED],0)  + isnull(PV.[RIBBON],0)) As TOTAL_PO_BALANCE, isnull(PV.[TSP],0) As TSP, isnull(PV.[LABEL],0) As LABEL,isnull(PV.[UV],0) As UV, isnull(PV.[OLED],0) As OLED,isnull(PV.[TAPE],0) As TAPE, isnull(PV.[SPT],0) As SPT, isnull(PV.[RIBBON],0) As RIBBON FROM ( SELECT P.PO_BALANCE, P.PROD_TYPE, P.CUST_NAME_KD FROM (   SELECT AA.PO_NO,  M100.PROD_TYPE, M100.PROD_MAIN_MATERIAL, ZTBPOTable.PO_DATE,ZTBPOTable.RD_DATE, M110.CUST_NAME_KD, M100.G_NAME, M010.EMPL_NAME, AA.G_CODE, ZTBPOTable.PO_QTY, ZTBPOTable.PROD_PRICE, AA.TotalDelivered as TOTAL_DELIVERED, (ZTBPOTable.PO_QTY-AA.TotalDelivered) As PO_BALANCE,(ZTBPOTable.PO_QTY*ZTBPOTable.PROD_PRICE) As PO_AMOUNT , (AA.TotalDelivered*ZTBPOTable.PROD_PRICE) As DELIVERED_AMOUNT, ((ZTBPOTable.PO_QTY-AA.TotalDelivered)*ZTBPOTable.PROD_PRICE) As BALANCE_AMOUNT,DATEPART( MONTH, PO_DATE) AS POMONTH, DATEPART( ISOWK, PO_DATE) AS POWEEKNUM, YEAR(PO_DATE) As PO_YEAR, CASE     WHEN (ZTBPOTable.RD_DATE < GETDATE()-1) AND ((ZTBPOTable.PO_QTY-AA.TotalDelivered) <>0) THEN 'OVER'        ELSE 'OK' END AS OVERDUE, ZTBPOTable.REMARK, ZTBPOTable.PO_ID FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable  LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN M010 ON (M010.EMPL_NO = AA.EMPL_NO) LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE) LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) JOIN M110 ON (M110.CUST_CD = AA.CUST_CD)  ) AS P ) AS j PIVOT (SUM(j.PO_BALANCE) FOR j.PROD_TYPE IN ([TSP],[LABEL],[UV],[OLED],[TAPE],[SPT],[RIBBON])) AS PV ) AS XX JOIN /*customer sum po balance*/  (SELECT AA.CUST_NAME_KD, SUM(AA.PO_BALANCE) AS TOTAL_PO_BALANCE FROM (SELECT AA.PO_NO,  M100.PROD_TYPE, M100.PROD_MAIN_MATERIAL, ZTBPOTable.PO_DATE,ZTBPOTable.RD_DATE, M110.CUST_NAME_KD, M100.G_NAME, M010.EMPL_NAME, AA.G_CODE, ZTBPOTable.PO_QTY, ZTBPOTable.PROD_PRICE, AA.TotalDelivered as TOTAL_DELIVERED, (ZTBPOTable.PO_QTY-AA.TotalDelivered) As PO_BALANCE,(ZTBPOTable.PO_QTY*ZTBPOTable.PROD_PRICE) As PO_AMOUNT , (AA.TotalDelivered*ZTBPOTable.PROD_PRICE) As DELIVERED_AMOUNT, ((ZTBPOTable.PO_QTY-AA.TotalDelivered)*ZTBPOTable.PROD_PRICE) As BALANCE_AMOUNT,DATEPART( MONTH, PO_DATE) AS POMONTH, DATEPART( ISOWK, PO_DATE) AS POWEEKNUM, YEAR(PO_DATE) As PO_YEAR, CASE     WHEN (ZTBPOTable.RD_DATE < GETDATE()-1) AND ((ZTBPOTable.PO_QTY-AA.TotalDelivered) <>0) THEN 'OVER'        ELSE 'OK' END AS OVERDUE, ZTBPOTable.REMARK, ZTBPOTable.PO_ID FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable  LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN M010 ON (M010.EMPL_NO = AA.EMPL_NO) LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE) LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) JOIN M110 ON (M110.CUST_CD = AA.CUST_CD)) AS AA GROUP BY AA.CUST_NAME_KD ) AS YY ON XX.CUST_NAME_KD = YY.CUST_NAME_KD WHERE XX.TOTAL_PO_BALANCE >0 ORDER BY TOTAL_PO_BALANCE DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "setnhamay":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTBEMPLINFO SET FACTORY_CODE = ${DATA.FACTORY} WHERE EMPL_NO='${DATA.EMPL_NO}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "baocaofcstss":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT FCST1.WEEKNO, FCST1.SEVT AS SEVT1,FCST1.SEV AS SEV1, FCST1.[SAMSUNG-ASIA] AS SAMSUNG_ASIA1, FCST1.TOTAL_SS AS TT_SS1, FCST2.SEVT AS SEVT2,FCST2.SEV AS SEV2, FCST2.[SAMSUNG-ASIA] AS SAMSUNG_ASIA2,FCST2.TOTAL_SS AS TT_SS2 FROM ( SELECT CASE WHEN LEN(WEEKNO) =2 THEN CONCAT('W0',SUBSTRING(WEEKNO,2,1)) ELSE WEEKNO END AS WEEKNO, [SEVT],[SEV], [SAMSUNG-ASIA], ([SEVT]+[SEV]+ [SAMSUNG-ASIA]) AS TOTAL_SS FROM ( SELECT CUST_NAME_KD, WEEKNO,FCST FROM (SELECT * FROM (SELECT M110. CUST_NAME_KD, SUM(ZTBFCSTTB.W1) AS W1,SUM(ZTBFCSTTB.W2) AS W2,SUM(ZTBFCSTTB.W3) AS W3,SUM(ZTBFCSTTB.W4) AS W4,SUM(ZTBFCSTTB.W5) AS W5,SUM(ZTBFCSTTB.W6) AS W6,SUM(ZTBFCSTTB.W7) AS W7,SUM(ZTBFCSTTB.W8) AS W8,SUM(ZTBFCSTTB.W9) AS W9,SUM(ZTBFCSTTB.W10) AS W10,SUM(ZTBFCSTTB.W11) AS W11,SUM(ZTBFCSTTB.W12) AS W12,SUM(ZTBFCSTTB.W13) AS W13,SUM(ZTBFCSTTB.W14) AS W14,SUM(ZTBFCSTTB.W15) AS W15,SUM(ZTBFCSTTB.W16) AS W16,SUM(ZTBFCSTTB.W17) AS W17,SUM(ZTBFCSTTB.W18) AS W18,SUM(ZTBFCSTTB.W19) AS W19,SUM(ZTBFCSTTB.W20) AS W20,SUM(ZTBFCSTTB.W21) AS W21,SUM(ZTBFCSTTB.W22) AS W22 FROM ZTBFCSTTB LEFT JOIN M110 ON (M110.CUST_CD= ZTBFCSTTB.CUST_CD) WHERE FCSTYEAR=${DATA.FCSTYEAR1} AND FCSTWEEKNO=${DATA.FCSTWEEKNUM1} GROUP BY M110. CUST_NAME_KD) AS AA) AS PVDT UNPIVOT ( FCST FOR WEEKNO IN (W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19, W20, W21, W22) ) AS UNPV ) AS PVTB PIVOT ( SUM(FCST) FOR CUST_NAME_KD IN ([SEVT],[SEV],[SAMSUNG-ASIA]) ) AS PVT ) AS FCST1 LEFT JOIN ( SELECT CASE WHEN LEN(WEEKNO) =2 THEN CONCAT('W0',SUBSTRING(WEEKNO,2,1)) ELSE WEEKNO END AS WEEKNO, [SEVT],[SEV], [SAMSUNG-ASIA], ([SEVT]+[SEV]+ [SAMSUNG-ASIA]) AS TOTAL_SS FROM ( SELECT CUST_NAME_KD, WEEKNO,FCST FROM (SELECT * FROM (SELECT M110. CUST_NAME_KD, SUM(ZTBFCSTTB.W1) AS W1,SUM(ZTBFCSTTB.W2) AS W2,SUM(ZTBFCSTTB.W3) AS W3,SUM(ZTBFCSTTB.W4) AS W4,SUM(ZTBFCSTTB.W5) AS W5,SUM(ZTBFCSTTB.W6) AS W6,SUM(ZTBFCSTTB.W7) AS W7,SUM(ZTBFCSTTB.W8) AS W8,SUM(ZTBFCSTTB.W9) AS W9,SUM(ZTBFCSTTB.W10) AS W10,SUM(ZTBFCSTTB.W11) AS W11,SUM(ZTBFCSTTB.W12) AS W12,SUM(ZTBFCSTTB.W13) AS W13,SUM(ZTBFCSTTB.W14) AS W14,SUM(ZTBFCSTTB.W15) AS W15,SUM(ZTBFCSTTB.W16) AS W16,SUM(ZTBFCSTTB.W17) AS W17,SUM(ZTBFCSTTB.W18) AS W18,SUM(ZTBFCSTTB.W19) AS W19,SUM(ZTBFCSTTB.W20) AS W20,SUM(ZTBFCSTTB.W21) AS W21,SUM(ZTBFCSTTB.W22) AS W22 FROM ZTBFCSTTB LEFT JOIN M110 ON (M110.CUST_CD= ZTBFCSTTB.CUST_CD) WHERE FCSTYEAR=${DATA.FCSTYEAR2} AND FCSTWEEKNO=${DATA.FCSTWEEKNUM2} GROUP BY M110. CUST_NAME_KD) AS AA) AS PVDT UNPIVOT ( FCST FOR WEEKNO IN (W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19, W20, W21, W22) ) AS UNPV ) AS PVTB PIVOT ( SUM(FCST) FOR CUST_NAME_KD IN ([SEVT],[SEV],[SAMSUNG-ASIA]) ) AS PVT ) AS FCST2 ON (FCST1.WEEKNO = FCST2.WEEKNO) ORDER BY FCST1.WEEKNO ASC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "fcstamount":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT FCSTYEAR,FCSTWEEKNO, SUM(W1+W2+W3+W4) AS FCST4W_QTY,  SUM((W1+W2+W3+W4)*PROD_PRICE) AS FCST4W_AMOUNT,SUM(W1+W2+W3+W4+W5+W6+W7+W8) AS FCST8W_QTY,  SUM((W1+W2+W3+W4+W5+W6+W7+W8)*PROD_PRICE) AS FCST8W_AMOUNT  FROM ZTBFCSTTB
                        WHERE FCSTYEAR=${DATA.FCSTYEAR} AND FCSTWEEKNO=${DATA.FCSTWEEKNO}
                        GROUP BY FCSTYEAR,FCSTWEEKNO`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "dtcdata":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT  ZTB_REL_SPECTTABLE.BARCODE_CONTENT, ZTB_REL_RESULT.DTC_ID, (CASE ZTBEMPLINFO.FACTORY_CODE WHEN 1 THEN 'NM1' WHEN 2 THEN 'NM2' END) AS FACTORY , ZTB_REL_REQUESTTABLE.TEST_FINISH_TIME, ZTB_REL_REQUESTTABLE.TEST_EMPL_NO, ZTB_REL_RESULT.G_CODE, ZTB_REL_REQUESTTABLE.PROD_REQUEST_NO, M100.G_NAME, ZTB_REL_TESTTABLE.TEST_NAME, ZTB_REL_SPECTTABLE.POINT_CODE, ZTB_REL_SPECTTABLE.CENTER_VALUE , ZTB_REL_SPECTTABLE.UPPER_TOR,LOWER_TOR , ZTB_REL_RESULT.RESULT, ZTB_REL_SPECTTABLE.REMARK ,ZTB_REL_RESULT.REMARK, ZTB_REL_SPECTTABLE.REMARK , ZTB_REL_TESTTYPE.TEST_TYPE_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME , ZTB_REL_RESULT.SAMPLE_NO, ZTB_REL_REQUESTTABLE.REQUEST_DATETIME , ZTB_REL_REQUESTTABLE.REQUEST_EMPL_NO ,ZTB_REL_RESULT.M_CODE ,M090.M_NAME , M090.WIDTH_CD AS SIZE, ZTB_REL_REQUESTTABLE.REMARK, NHAP_NVL.LOTCMS , ZTB_REL_RESULT.TEST_CODE,M090.TDS, M090.TDS_EMPL ,TDS_UPD_DATE FROM ZTB_REL_RESULT LEFT JOIN M100 ON(M100.G_CODE = ZTB_REL_RESULT.G_CODE) LEFT JOIN M090 ON (M090.M_CODE = ZTB_REL_RESULT.M_CODE) LEFT JOIN ZTB_REL_SPECTTABLE ON (  ZTB_REL_SPECTTABLE.G_CODE = ZTB_REL_RESULT.G_CODE AND ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_RESULT.TEST_CODE AND ZTB_REL_SPECTTABLE.POINT_CODE = ZTB_REL_RESULT.POINT_CODE AND ZTB_REL_SPECTTABLE.M_CODE = ZTB_REL_RESULT.M_CODE)  LEFT JOIN ZTB_REL_REQUESTTABLE ON (ZTB_REL_REQUESTTABLE.DTC_ID = ZTB_REL_RESULT.DTC_ID AND ZTB_REL_REQUESTTABLE.TEST_CODE = ZTB_REL_RESULT.TEST_CODE )  LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_RESULT.TEST_CODE) LEFT JOIN ZTB_REL_TESTTYPE ON (ZTB_REL_TESTTYPE.TEST_TYPE_CODE = ZTB_REL_REQUESTTABLE.TEST_TYPE_CODE) LEFT JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTB_REL_REQUESTTABLE.REQUEST_EMPL_NO) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN NHAP_NVL ON(NHAP_NVL.LOTNCC = ZTB_REL_REQUESTTABLE.REMARK AND NHAP_NVL.SIZE = M090.WIDTH_CD) ${generate_condition_get_dtc_data(
            DATA.ALLTIME,
            DATA.FROM_DATE,
            DATA.TO_DATE,
            DATA.G_CODE,
            DATA.G_NAME,
            DATA.PROD_REQUEST_NO,
            DATA.M_NAME,
            DATA.M_CODE,
            DATA.TEST_NAME,
            DATA.TEST_TYPE,
            DATA.ID
          )} ORDER BY TEST_FINISH_TIME DESC`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "dtcspec":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE='${DATA.G_CODE}'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND M090.M_CODE='${DATA.M_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.TEST_NAME !== "0") {
            condition += ` AND ZTB_REL_TESTTABLE.TEST_CODE = '${DATA.TEST_NAME}'`;
          }
          let setpdQuery = ` SELECT M090.TDS, M100.BANVE, M110.CUST_NAME_KD, ZTB_REL_SPECTTABLE.G_CODE, M100.G_NAME, ZTB_REL_TESTTABLE.TEST_NAME, ZTB_REL_TESTPOINT.POINT_NAME, ZTB_REL_SPECTTABLE.PRI, ZTB_REL_SPECTTABLE.CENTER_VALUE, ZTB_REL_SPECTTABLE.UPPER_TOR, ZTB_REL_SPECTTABLE.LOWER_TOR, (ZTB_REL_SPECTTABLE.CENTER_VALUE-ZTB_REL_SPECTTABLE.LOWER_TOR) AS MIN_SPEC, (ZTB_REL_SPECTTABLE.CENTER_VALUE+ZTB_REL_SPECTTABLE.UPPER_TOR) AS MAX_SPEC, ZTB_REL_SPECTTABLE.BARCODE_CONTENT, ZTB_REL_SPECTTABLE.REMARK, M090.M_NAME, M090.WIDTH_CD,ZTB_REL_SPECTTABLE.M_CODE FROM ZTB_REL_SPECTTABLE LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_SPECTTABLE.TEST_CODE) LEFT JOIN ZTB_REL_TESTPOINT ON (ZTB_REL_TESTPOINT.POINT_CODE = ZTB_REL_SPECTTABLE.POINT_CODE AND ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_TESTPOINT.TEST_CODE) LEFT JOIN M100 ON (M100.G_CODE = ZTB_REL_SPECTTABLE.G_CODE) LEFT JOIN M090 ON (M090.M_CODE =ZTB_REL_SPECTTABLE.M_CODE) LEFT JOIN M110 ON (M110.CUST_CD = M100.CUST_CD) ${condition}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "update_empl_image":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE ZTBEMPLINFO SET EMPL_IMAGE='Y' WHERE EMPL_NO='${DATA.EMPL_NO}' `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getcodefullinfo":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT FSC, PO_TYPE, G_CODE, M100.CUST_CD, M110.CUST_NAME, M110.CUST_NAME_KD, PROD_PROJECT, PROD_MODEL, CODE_12, PROD_TYPE, G_NAME_KD, DESCR, PROD_MAIN_MATERIAL, G_NAME, G_LENGTH, G_WIDTH, PD, G_LG, G_CG, G_C, G_C_R, G_SG_L, G_SG_R, PACK_DRT, KNIFE_TYPE, KNIFE_LIFECYCLE, KNIFE_PRICE, CODE_33, ROLE_EA_QTY,RPM, PIN_DISTANCE, PROCESS_TYPE, EQ1, EQ2, EQ3, EQ4, PROD_DIECUT_STEP, PROD_PRINT_TIMES, M100.REMK, M100.USE_YN, FACTORY,  Setting1, Setting2,Setting3,Setting4, UPH1, UPH2, UPH3, UPH4, Step1, Step2,Step3,Step4, LOSS_SX1, LOSS_SX2, LOSS_SX3, LOSS_SX4, LOSS_SETTING1 , LOSS_SETTING2 ,LOSS_SETTING3 ,LOSS_SETTING4 ,NOTE, PROD_DVT  FROM M100 LEFT JOIN M110 ON (M110.CUST_CD = M100.CUST_CD)
          WHERE M100.G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getbomsx":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT isnull(M140.LIEUQL_SX,0) AS LIEUQL_SX, M140.MAIN_M,M140.G_CODE, M100.G_NAME, M100.G_NAME_KD, M140.RIV_NO, M140.M_CODE, M090.M_NAME, M090.WIDTH_CD, M140.M_QTY, M140.INS_EMPL, M140.INS_DATE, M140.UPD_EMPL,M140.UPD_DATE FROM M140 JOIN M100 ON (M140.G_CODE = M100.G_CODE) JOIN M090 ON (M090.M_CODE = M140.M_CODE) WHERE M140.G_CODE='${DATA.G_CODE}' AND M140.RIV_NO='A' `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getbomgia":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM ZTB_BOM2  WHERE RIV_NO='A' AND G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getNextSEQ_G_CODE":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT MAX(SEQ_NO) AS LAST_SEQ_NO FROM M100 WHERE CODE_12 = '${DATA.CODE_12}' AND CODE_27='${DATA.CODE_27}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertM100":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO M100 (CTR_CD,CUST_CD,PROD_PROJECT,PROD_MODEL,CODE_12,PROD_TYPE,G_NAME_KD,DESCR,PROD_MAIN_MATERIAL,G_NAME,G_LENGTH,G_WIDTH,PD,G_C,G_C_R,G_SG_L,G_SG_R,PACK_DRT,KNIFE_TYPE,KNIFE_LIFECYCLE,KNIFE_PRICE,CODE_33,ROLE_EA_QTY,RPM,PIN_DISTANCE,PROCESS_TYPE,EQ1,EQ2, EQ3, EQ4,PROD_DIECUT_STEP,PROD_PRINT_TIMES,REMK,USE_YN,G_CODE,G_CG,G_LG, SEQ_NO, CODE_27, REV_NO, INS_EMPL, UPD_EMPL, INS_DATE, UPD_DATE, PO_TYPE, FSC, PROD_DVT) VALUES ('002','${DATA.CODE_FULL_INFO.CUST_CD}','${DATA.CODE_FULL_INFO.PROD_PROJECT}','${DATA.CODE_FULL_INFO.PROD_MODEL}','${DATA.CODE_FULL_INFO.CODE_12}','${DATA.CODE_FULL_INFO.PROD_TYPE}','${DATA.CODE_FULL_INFO.G_NAME_KD}','${DATA.CODE_FULL_INFO.DESCR}','${DATA.CODE_FULL_INFO.PROD_MAIN_MATERIAL}','${DATA.CODE_FULL_INFO.G_NAME}','${DATA.CODE_FULL_INFO.G_LENGTH}','${DATA.CODE_FULL_INFO.G_WIDTH}','${DATA.CODE_FULL_INFO.PD}','${DATA.CODE_FULL_INFO.G_C}','${DATA.CODE_FULL_INFO.G_C_R}','${DATA.CODE_FULL_INFO.G_SG_L}','${DATA.CODE_FULL_INFO.G_SG_R}','${DATA.CODE_FULL_INFO.PACK_DRT}','${DATA.CODE_FULL_INFO.KNIFE_TYPE}','${DATA.CODE_FULL_INFO.KNIFE_LIFECYCLE}','${DATA.CODE_FULL_INFO.KNIFE_PRICE}','${DATA.CODE_FULL_INFO.CODE_33}','${DATA.CODE_FULL_INFO.ROLE_EA_QTY}','${DATA.CODE_FULL_INFO.RPM}','${DATA.CODE_FULL_INFO.PIN_DISTANCE}','${DATA.CODE_FULL_INFO.PROCESS_TYPE}','${DATA.CODE_FULL_INFO.EQ1}','${DATA.CODE_FULL_INFO.EQ2}','${DATA.CODE_FULL_INFO.EQ3}','${DATA.CODE_FULL_INFO.EQ4}','${DATA.CODE_FULL_INFO.PROD_DIECUT_STEP}','${DATA.CODE_FULL_INFO.PROD_PRINT_TIMES}','${DATA.CODE_FULL_INFO.REMK}','${DATA.CODE_FULL_INFO.USE_YN}','${DATA.G_CODE}','${DATA.CODE_FULL_INFO.G_CG}','${DATA.CODE_FULL_INFO.G_LG}','${DATA.NEXT_SEQ_NO}','${DATA.CODE_27}','A','${EMPL_NO}','${EMPL_NO}',GETDATE(), GETDATE(), '${DATA.CODE_FULL_INFO.PO_TYPE}','${DATA.CODE_FULL_INFO.FSC}','${DATA.CODE_FULL_INFO.PROD_DVT}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertM100_AddVer":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO M100 (CTR_CD,CUST_CD,PROD_PROJECT,PROD_MODEL,CODE_12,PROD_TYPE,G_NAME_KD,DESCR,PROD_MAIN_MATERIAL,G_NAME,G_LENGTH,G_WIDTH,PD,G_C,G_C_R,G_SG_L,G_SG_R,PACK_DRT,KNIFE_TYPE,KNIFE_LIFECYCLE,KNIFE_PRICE,CODE_33,ROLE_EA_QTY,RPM,PIN_DISTANCE,PROCESS_TYPE,EQ1,EQ2,EQ3, EQ4,PROD_DIECUT_STEP,PROD_PRINT_TIMES,REMK,USE_YN,G_CODE,G_CG,G_LG, SEQ_NO, CODE_27, REV_NO, INS_EMPL, UPD_EMPL, INS_DATE, UPD_DATE, PO_TYPE, FSC, PROD_DVT) VALUES ('002','${DATA.CODE_FULL_INFO.CUST_CD}','${DATA.CODE_FULL_INFO.PROD_PROJECT}','${DATA.CODE_FULL_INFO.PROD_MODEL}','${DATA.CODE_FULL_INFO.CODE_12}','${DATA.CODE_FULL_INFO.PROD_TYPE}','${DATA.CODE_FULL_INFO.G_NAME_KD}','${DATA.CODE_FULL_INFO.DESCR}','${DATA.CODE_FULL_INFO.PROD_MAIN_MATERIAL}','${DATA.CODE_FULL_INFO.G_NAME}','${DATA.CODE_FULL_INFO.G_LENGTH}','${DATA.CODE_FULL_INFO.G_WIDTH}','${DATA.CODE_FULL_INFO.PD}','${DATA.CODE_FULL_INFO.G_C}','${DATA.CODE_FULL_INFO.G_C_R}','${DATA.CODE_FULL_INFO.G_SG_L}','${DATA.CODE_FULL_INFO.G_SG_R}','${DATA.CODE_FULL_INFO.PACK_DRT}','${DATA.CODE_FULL_INFO.KNIFE_TYPE}','${DATA.CODE_FULL_INFO.KNIFE_LIFECYCLE}','${DATA.CODE_FULL_INFO.KNIFE_PRICE}','${DATA.CODE_FULL_INFO.CODE_33}','${DATA.CODE_FULL_INFO.ROLE_EA_QTY}','${DATA.CODE_FULL_INFO.RPM}','${DATA.CODE_FULL_INFO.PIN_DISTANCE}','${DATA.CODE_FULL_INFO.PROCESS_TYPE}','${DATA.CODE_FULL_INFO.EQ1}','${DATA.CODE_FULL_INFO.EQ2}','${DATA.CODE_FULL_INFO.EQ3}','${DATA.CODE_FULL_INFO.EQ4}','${DATA.CODE_FULL_INFO.PROD_DIECUT_STEP}','${DATA.CODE_FULL_INFO.PROD_PRINT_TIMES}','${DATA.CODE_FULL_INFO.REMK}','${DATA.CODE_FULL_INFO.USE_YN}','${DATA.G_CODE}','${DATA.CODE_FULL_INFO.G_CG}','${DATA.CODE_FULL_INFO.G_LG}','${DATA.NEXT_SEQ_NO}','${DATA.CODE_27}','${DATA.REV_NO}','${EMPL_NO}','${EMPL_NO}',GETDATE(), GETDATE(), '${DATA.CODE_FULL_INFO.PO_TYPE}', '${DATA.CODE_FULL_INFO.FSC}','${DATA.CODE_FULL_INFO.PROD_DVT}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertM100BangTinhGia":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_QUOTATION_CALC_TB (CTR_CD,G_CODE,WIDTH_OFFSET,LENGTH_OFFSET,KNIFE_UNIT,FILM_UNIT,INK_UNIT,LABOR_UNIT,DELIVERY_UNIT,DEPRECATION_UNIT,GMANAGEMENT_UNIT,M_LOSS_UNIT,G_WIDTH,G_LENGTH,G_C,G_C_R,G_LG,G_CG,G_SG_L,G_SG_R,PROD_PRINT_TIMES) VALUES ('002','${DATA.G_CODE}','${DATA.DEFAULT_DM.WIDTH_OFFSET}','${DATA.DEFAULT_DM.LENGTH_OFFSET}','${DATA.DEFAULT_DM.KNIFE_UNIT}','${DATA.DEFAULT_DM.FILM_UNIT}','${DATA.DEFAULT_DM.INK_UNIT}','${DATA.DEFAULT_DM.LABOR_UNIT}','${DATA.DEFAULT_DM.DELIVERY_UNIT}','${DATA.DEFAULT_DM.DEPRECATION_UNIT}','${DATA.DEFAULT_DM.GMANAGEMENT_UNIT}','${DATA.DEFAULT_DM.M_LOSS_UNIT}','${DATA.CODE_FULL_INFO.G_WIDTH}','${DATA.CODE_FULL_INFO.G_LENGTH}','${DATA.CODE_FULL_INFO.G_C}','${DATA.CODE_FULL_INFO.G_C_R}','${DATA.CODE_FULL_INFO.G_LG}','${DATA.CODE_FULL_INFO.G_CG}','${DATA.CODE_FULL_INFO.G_SG_L}','${DATA.CODE_FULL_INFO.G_SG_R}','${DATA.CODE_FULL_INFO.PROD_PRINT_TIMES}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "updateM100":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE M100 SET FSC='${DATA.FSC}', PO_TYPE='${DATA.PO_TYPE}', CUST_CD='${DATA.CUST_CD}',PROD_PROJECT='${DATA.PROD_PROJECT}',PROD_MODEL='${DATA.PROD_MODEL}',PROD_TYPE='${DATA.PROD_TYPE}',G_NAME_KD='${DATA.G_NAME_KD}',DESCR='${DATA.DESCR}',PROD_MAIN_MATERIAL='${DATA.PROD_MAIN_MATERIAL}',G_NAME='${DATA.G_NAME}',G_LENGTH='${DATA.G_LENGTH}',G_WIDTH='${DATA.G_WIDTH}',PD='${DATA.PD}',G_C='${DATA.G_C}',G_C_R='${DATA.G_C_R}',G_SG_L='${DATA.G_SG_L}',G_SG_R='${DATA.G_SG_R}',PACK_DRT='${DATA.PACK_DRT}',KNIFE_TYPE='${DATA.KNIFE_TYPE}',KNIFE_LIFECYCLE='${DATA.KNIFE_LIFECYCLE}',KNIFE_PRICE='${DATA.KNIFE_PRICE}',CODE_33='${DATA.CODE_33}',ROLE_EA_QTY='${DATA.ROLE_EA_QTY}',RPM='${DATA.RPM}',PIN_DISTANCE='${DATA.PIN_DISTANCE}',PROCESS_TYPE='${DATA.PROCESS_TYPE}',EQ1='${DATA.EQ1}',EQ2='${DATA.EQ2}', EQ3='${DATA.EQ3}',EQ4='${DATA.EQ4}', PROD_DIECUT_STEP='${DATA.PROD_DIECUT_STEP}',PROD_PRINT_TIMES='${DATA.PROD_PRINT_TIMES}',REMK='${DATA.REMK}',USE_YN='${DATA.USE_YN}',G_CG='${DATA.G_CG}',G_LG='${DATA.G_LG}',PROD_DVT='${DATA.PROD_DVT}', PDBV='P', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE G_CODE = '${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "updateM100BangTinhGia":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_QUOTATION_CALC_TB SET G_LENGTH='${DATA.G_LENGTH}',G_WIDTH='${DATA.G_WIDTH}',G_C='${DATA.G_C}',G_C_R='${DATA.G_C_R}',G_SG_L='${DATA.G_SG_L}',G_SG_R='${DATA.G_SG_R}',PROD_PRINT_TIMES='${DATA.PROD_PRINT_TIMES}', G_CG='${DATA.G_CG}',G_LG='${DATA.G_LG}'  WHERE G_CODE = '${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "loadDefaultDM":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTB_TBG_CONFIG2`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "checkTBGExist":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTB_QUOTATION_CALC_TB WHERE G_CODE='${DATA.G_CODE}'`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          console.log(checkkq);
        })();
        break;
      case "getMaterialList":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          //let setpdQuery = `SELECT M090.M_CODE, M090.M_NAME, M090.WIDTH_CD, ZTB_MATERIAL_TB.CUST_CD, ZTB_MATERIAL_TB.SSPRICE, ZTB_MATERIAL_TB.CMSPRICE, ZTB_MATERIAL_TB.SLITTING_PRICE, ZTB_MATERIAL_TB.MASTER_WIDTH, ZTB_MATERIAL_TB.ROLL_LENGTH FROM M090 LEFT JOIN ZTB_MATERIAL_TB ON (ZTB_MATERIAL_TB.M_NAME = M090.M_NAME)`;
          ////console.log(setpdQuery);
          let setpdQuery = ` SELECT M090.M_CODE, M090.M_NAME, M090.WIDTH_CD FROM M090 WHERE USE_YN='Y'`;
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertM140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO M140 (CTR_CD, G_CODE,RIV_NO,G_SEQ,M_CODE,M_QTY,META_PAT_CD,REMK,USE_YN,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL, MAIN_M) VALUES ('002','${DATA.G_CODE}','A','${DATA.G_SEQ}', '${DATA.M_CODE}','${DATA.M_QTY}', 'x', '','Y', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}','${DATA.MAIN_M}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "update_M140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE M140 SET M_QTY=${DATA.M_QTY}, MAIN_M = ${DATA.MAIN_M}, LIEUQL_SX=${DATA.LIEUQL_SX}, UPD_EMPL='${EMPL_NO}', UPD_DATE=GETDATE() WHERE G_CODE='${DATA.G_CODE}' AND M_CODE ='${DATA.M_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "checkGSEQ_M140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT MAX(G_SEQ) AS MAX_G_SEQ FROM M140 WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertBOM2":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_BOM2 (CTR_CD, G_CODE, RIV_NO, G_SEQ, M_CODE, M_NAME, CUST_CD, USAGE, MAT_MASTER_WIDTH, MAT_CUTWIDTH, MAT_ROLL_LENGTH, MAT_THICKNESS, M_QTY, REMARK, PROCESS_ORDER, INS_EMPL, UPD_EMPL, INS_DATE, UPD_DATE, MAIN_M, M_CMS_PRICE, M_SS_PRICE, M_SLITTING_PRICE) VALUES ('002', '${DATA.G_CODE}','A','${DATA.G_SEQ}','${DATA.M_CODE}','${DATA.M_NAME}','${DATA.CUST_CD}','${DATA.USAGE}','${DATA.MAT_MASTER_WIDTH}','${DATA.MAT_CUTWIDTH}','${DATA.MAT_ROLL_LENGTH}','${DATA.MAT_THICKNESS}','${DATA.M_QTY}','${DATA.REMARK}','${DATA.PROCESS_ORDER}','${EMPL_NO}','${EMPL_NO}',GETDATE(),GETDATE(),'${DATA.MAIN_M}',${DATA.M_CMS_PRICE},${DATA.M_SS_PRICE},${DATA.M_SLITTING_PRICE})`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          console.log(checkkq);
        })();
        break;
      case "deleteM140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM M140 WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "deleteM140_2":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM M140 WHERE G_CODE='${DATA.G_CODE}' AND M_CODE NOT IN (${DATA.M_LIST})`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "deleteBOM2":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTB_BOM2 WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "listAmazon":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT DISTINCT BOM_AMAZONE.G_CODE, M100.G_NAME, M100.G_NAME_KD FROM BOM_AMAZONE JOIN M100 ON (M100.G_CODE=  BOM_AMAZONE.G_CODE) WHERE M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getBOMAMAZON":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT BOM_AMAZONE.AMZ_PROD_NAME, BOM_AMAZONE.AMZ_COUNTRY, BOM_AMAZONE.G_CODE, M100.G_NAME, DESIGN_AMAZONE.G_CODE_MAU,  M100_B.G_NAME AS TEN_MAU,BOM_AMAZONE.DOITUONG_NO, DESIGN_AMAZONE.DOITUONG_NAME, BOM_AMAZONE.GIATRI, BOM_AMAZONE.REMARK FROM BOM_AMAZONE LEFT JOIN DESIGN_AMAZONE ON (BOM_AMAZONE.G_CODE_MAU= DESIGN_AMAZONE.G_CODE_MAU AND BOM_AMAZONE.DOITUONG_NO= DESIGN_AMAZONE.DOITUONG_NO) LEFT JOIN M100 ON (M100.G_CODE = BOM_AMAZONE.G_CODE)  LEFT JOIN  (SELECT * FROM M100) AS M100_B ON (M100_B.G_CODE = DESIGN_AMAZONE.G_CODE_MAU) WHERE BOM_AMAZONE.G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getAMAZON_DESIGN":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM DESIGN_AMAZONE WHERE DESIGN_AMAZONE.G_CODE_MAU='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "deleteAMZDesign":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM DESIGN_AMAZONE WHERE DESIGN_AMAZONE.G_CODE_MAU='${DATA.G_CODE}'`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkDesignExistAMZ":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM DESIGN_AMAZONE WHERE DESIGN_AMAZONE.G_CODE_MAU='${DATA.G_CODE}'`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertAMZDesign":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO DESIGN_AMAZONE (CTR_CD,G_CODE_MAU,DOITUONG_NO,DOITUONG_NAME,PHANLOAI_DT,CAVITY_PRINT,FONT_NAME,POS_X,POS_Y,SIZE_W,SIZE_H,ROTATE,REMARK,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL,FONT_SIZE,FONT_STYLE,GIATRI,DOITUONG_STT) VALUES ('002','${DATA.G_CODE_MAU}','${DATA.DOITUONG_NO}','${DATA.DOITUONG_NAME}','${DATA.PHANLOAI_DT}','${DATA.CAVITY_PRINT}','${DATA.FONT_NAME}','${DATA.POS_X}','${DATA.POS_Y}','${DATA.SIZE_W}','${DATA.SIZE_H}','${DATA.ROTATE}','${DATA.REMARK}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}','${DATA.FONT_SIZE}','${DATA.FONT_STYLE}','${DATA.GIATRI}','${DATA.DOITUONG_STT}')`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getBOMAMAZON_EMPTY":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT DESIGN_AMAZONE.G_CODE_MAU, M100.G_NAME AS TEN_MAU, DOITUONG_NO, DOITUONG_NAME FROM DESIGN_AMAZONE JOIN M100 ON (M100.G_CODE = DESIGN_AMAZONE.G_CODE_MAU) WHERE G_CODE_MAU ='${DATA.G_CODE_MAU}'`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "loadcodephoi":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT DISTINCT DESIGN_AMAZONE.G_CODE_MAU, M100.G_NAME FROM DESIGN_AMAZONE JOIN M100 ON (M100.G_CODE = DESIGN_AMAZONE.G_CODE_MAU)`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "checkExistBOMAMAZON":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM BOM_AMAZONE WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertAmazonBOM":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO BOM_AMAZONE (CTR_CD, G_CODE, G_CODE_MAU, DOITUONG_NO, GIATRI, REMARK, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL,  AMZ_COUNTRY) VALUES ('002','${DATA.G_CODE}', '${DATA.G_CODE_MAU}','${DATA.DOITUONG_NO}','${DATA.GIATRI}','${DATA.REMARK}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}','${DATA.AMZ_COUNTRY}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "updateAmazonBOM":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE BOM_AMAZONE SET GIATRI='${DATA.GIATRI}', REMARK = '${DATA.REMARK}',  AMZ_COUNTRY='${DATA.AMZ_COUNTRY}' WHERE G_CODE='${DATA.G_CODE}' AND G_CODE_MAU='${DATA.G_CODE_MAU}' AND DOITUONG_NO=${DATA.DOITUONG_NO}`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "updateAmazonBOMCodeInfo":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE BOM_AMAZONE SET  AMZ_PROD_NAME='${DATA.AMZ_PROD_NAME}', AMZ_COUNTRY='${DATA.AMZ_COUNTRY}' WHERE G_CODE='${DATA.G_CODE}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "xoadangkynghi_AUTO":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTBOFFREGISTRATIONTB WHERE APPLY_DATE='${moment().format(
            "YYYY-MM-DD"
          )}' AND EMPL_NO='${DATA.EMPL_NO}' AND REMARK ='AUTO'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getddmaindepttb":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE        
          SET @startdate='${DATA.FROM_DATE}'
          SET @enddate='${DATA.TO_DATE}'
      SELECT EMPL_LIST.MAINDEPTNAME, COUNT(EMPL_LIST.EMPL_NO) AS COUNT_TOTAL, SUM(CASE WHEN ON_OFF =1 THEN 1 ELSE 0 END) AS COUT_ON, SUM(CASE WHEN ON_OFF =0 THEN 1 ELSE 0 END) AS COUT_OFF, SUM(CASE WHEN ON_OFF is null THEN 1 ELSE 0 END) AS COUNT_CDD, SUM(CASE WHEN ON_OFF =1 THEN 1 ELSE 0 END)*1.0/COUNT(EMPL_LIST.EMPL_NO)*100 AS ON_RATE FROM
      (
          SELECT  
      ZTBEMPLINFOA.DATE_COLUMN,
            ZTBEMPLINFOA.EMPL_NO, 
            CMS_ID, 
            MIDLAST_NAME, 
            FIRST_NAME, 
            PHONE_NUMBER, 
            SEX_NAME, 
            WORK_STATUS_NAME, 
            FACTORY_NAME, 
            JOB_NAME, 
            WORK_SHIF_NAME, 
            WORK_POSITION_NAME, 
            SUBDEPTNAME, 
            MAINDEPTNAME, 
            REQUEST_DATE, 
            ZTBATTENDANCETB.APPLY_DATE, 
            APPROVAL_STATUS, 
            OFF_ID, 
            CA_NGHI, 
            ON_OFF, 
            OVERTIME_INFO, 
            OVERTIME, 
            REASON_NAME, 
            ZTBOFFREGISTRATIONTB.REMARK, 
            ZTBATTENDANCETB.XACNHAN 
          FROM 
            (SELECT DATE_COLUMN, EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
            LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
              ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
            ) 
            LEFT JOIN ZTBSEX ON (
              ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
            ) 
            LEFT JOIN ZTBWORKSTATUS ON(
              ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
            ) 
            LEFT JOIN ZTBFACTORY ON (
              ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
            ) 
            LEFT JOIN ZTBJOB ON (
              ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
            ) 
            LEFT JOIN ZTBPOSITION ON (
              ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
            ) 
            LEFT JOIN ZTBWORKSHIFT ON (
              ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
            ) 
            LEFT JOIN ZTBWORKPOSITION ON (
              ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
            ) 
            LEFT JOIN ZTBSUBDEPARTMENT ON (
              ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
            ) 
            LEFT JOIN ZTBMAINDEPARMENT ON (
              ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
            ) 
            LEFT JOIN ZTBOFFREGISTRATIONTB ON (
              ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
              AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
            ) 
            LEFT JOIN ZTBREASON ON (
              ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
            )   
      WHERE ZTBEMPLINFOA.WORK_STATUS_CODE =1
      ) AS EMPL_LIST
      GROUP BY EMPL_LIST.MAINDEPTNAME`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getqlsxplan":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_QLSXPLAN.OLD_PLAN_QTY ,ZTB_QLSXPLAN.XUATDAOFILM, ZTB_QLSXPLAN.EQ_STATUS, ZTB_QLSXPLAN.MAIN_MATERIAL, ZTB_QLSXPLAN.INT_TEM, ZTB_QLSXPLAN.CHOTBC, ZTB_QLSXPLAN.DKXL, ZTB_QLSXPLAN.NEXT_PLAN_ID, ZTB_QLSXPLAN.KQ_SX_TAM, ZTB_QLSXPLAN.KETQUASX, ZTB_QLSXPLAN.PROCESS_NUMBER, ZTB_QLSXPLAN.PLAN_ORDER, ZTB_QLSXPLAN.STEP, ZTB_QLSXPLAN.PLAN_ID,ZTB_QLSXPLAN.PLAN_DATE,ZTB_QLSXPLAN.PROD_REQUEST_NO,ZTB_QLSXPLAN.PLAN_QTY,ZTB_QLSXPLAN.PLAN_EQ,ZTB_QLSXPLAN.PLAN_FACTORY,ZTB_QLSXPLAN.PLAN_LEADTIME,ZTB_QLSXPLAN.INS_EMPL,ZTB_QLSXPLAN.INS_DATE,ZTB_QLSXPLAN.UPD_EMPL,ZTB_QLSXPLAN.UPD_DATE, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, BB.CD1, BB.CD2, BB.CD3, BB.CD4, 
          CASE WHEN (M100.EQ1 IN ('NA','NO',null,'')) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD1,0) END AS TON_CD1,          
          CASE WHEN (M100.EQ2 IN ('NA','NO',null,'')) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD2,0) END AS TON_CD2,
		  CASE WHEN (M100.EQ3 IN ('NA','NO',null,'')) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD3,0) END AS TON_CD3,
		  CASE WHEN (M100.EQ4 IN ('NA','NO',null,'')) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD4,0) END AS TON_CD4,

           M100.FACTORY, M100.EQ1, M100.EQ2, M100.Setting1, M100.Setting2, M100.UPH1, M100.UPH2, M100.Step1, M100.Step2, M100.LOSS_SX1, M100.LOSS_SX2, M100.LOSS_SETTING1, M100.LOSS_SETTING2, M100.Step3, M100.Step4, M100.EQ3, M100.EQ4, M100.UPH3, M100.UPH4, M100.Setting3, M100.Setting4, M100.LOSS_SX3, M100.LOSS_SX4, M100.LOSS_SETTING3, M100.LOSS_SETTING4, M100.NOTE
                    FROM ZTB_QLSXPLAN JOIN P400 ON (P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO) JOIN M100 ON (P400.G_CODE = M100.G_CODE)
                    LEFT JOIN 
                    (SELECT PVTB.PROD_REQUEST_NO, isnull(PVTB.[1],0) AS CD1, isnull(PVTB.[2],0) AS CD2,isnull(PVTB.[3],0) AS CD3,isnull(PVTB.[4],0) AS CD4 FROM 
                    (
                        SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER, SUM(isnull(SX_RESULT,0)) AS KETQUASX FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID) WHERE ZTB_QLSXPLAN.STEP=0 GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER
                    )
                    AS PV
                    PIVOT
                    ( 
                    SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2],[3],[4])
                    ) 
                    AS PVTB) AS BB ON (BB.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO)
                    WHERE ZTB_QLSXPLAN.PLAN_DATE='${DATA.PLAN_DATE}' ORDER BY ZTB_QLSXPLAN.PLAN_ORDER ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getqlsxplan2":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND ZTB_QLSXPLAN.PLAN_FACTORY='${DATA.FACTORY}'`;
          }
          if (DATA.MACHINE !== "ALL") {
            condition += ` AND SUBSTRING(ZTB_QLSXPLAN.PLAN_EQ,1,2)='${DATA.MACHINE}'`;
          }
          condition += ` AND ZTB_QLSXPLAN.PLAN_DATE='${DATA.PLAN_DATE}'`;
          let setpdQuery = `SELECT ZTB_QLSXPLAN.XUATDAOFILM, ZTB_QLSXPLAN.EQ_STATUS, ZTB_QLSXPLAN.MAIN_MATERIAL, ZTB_QLSXPLAN.INT_TEM, ZTB_QLSXPLAN.CHOTBC, ZTB_QLSXPLAN.DKXL,ZTB_QLSXPLAN.NEXT_PLAN_ID, ZTB_QLSXPLAN.KQ_SX_TAM, ZTB_QLSXPLAN.KETQUASX, ZTB_QLSXPLAN.PROCESS_NUMBER, ZTB_QLSXPLAN.PLAN_ORDER, ZTB_QLSXPLAN.STEP, ZTB_QLSXPLAN.PLAN_ID,ZTB_QLSXPLAN.PLAN_DATE,ZTB_QLSXPLAN.PROD_REQUEST_NO,ZTB_QLSXPLAN.PLAN_QTY,ZTB_QLSXPLAN.PLAN_EQ,ZTB_QLSXPLAN.PLAN_FACTORY,ZTB_QLSXPLAN.PLAN_LEADTIME,ZTB_QLSXPLAN.INS_EMPL,ZTB_QLSXPLAN.INS_DATE,ZTB_QLSXPLAN.UPD_EMPL,ZTB_QLSXPLAN.UPD_DATE, M100.G_CODE, M100.G_NAME, M100.PD, (M100.G_C*M100.G_C_R) AS CAVITY, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, isnull(BB.CD1,0) AS CD1, isnull(BB.CD2,0) AS CD2, BB.CD3, BB.CD4,
          CASE WHEN ( NOT(M100.EQ1 <> 'NA' AND M100.EQ1 <>'NO' AND M100.EQ1 <>'' AND M100.EQ1 is not null)) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD1,0) END AS TON_CD1,
          CASE WHEN  (NOT (M100.EQ2 <> 'NA' AND M100.EQ2 <>'NO' AND M100.EQ2 <>'' AND M100.EQ2 is not null)) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD2,0) END AS TON_CD2,
          CASE WHEN  (NOT (M100.EQ3 <> 'NA' AND M100.EQ3 <>'NO' AND M100.EQ3 <>'' AND M100.EQ3 is not null)) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD3,0) END AS TON_CD3,
          CASE WHEN  (NOT (M100.EQ4 <> 'NA' AND M100.EQ4 <>'NO' AND M100.EQ4 <>'' AND M100.EQ4 is not null)) THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD4,0) END AS TON_CD4,
          M100.FACTORY, M100.EQ1, M100.EQ2, M100.Setting1, M100.Setting2, M100.UPH1, M100.UPH2, M100.Step1, M100.Step2, M100.LOSS_SX1, M100.LOSS_SX2, M100.LOSS_SETTING1, M100.LOSS_SETTING2,M100.Step3, M100.Step4, M100.EQ3, M100.EQ4, M100.UPH3, M100.UPH4, M100.Setting3, M100.Setting4, M100.LOSS_SX3, M100.LOSS_SX4, M100.LOSS_SETTING3, M100.LOSS_SETTING4, M100.NOTE,ZTB_SX_RESULT.SETTING_START_TIME, ZTB_SX_RESULT.MASS_START_TIME, ZTB_SX_RESULT.MASS_END_TIME
                              FROM ZTB_QLSXPLAN 
							  LEFT JOIN ZTB_SX_RESULT ON (ZTB_SX_RESULT.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
							  JOIN P400 ON (P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO) 
							  JOIN M100 ON (P400.G_CODE = M100.G_CODE)
                              LEFT JOIN 
                              (SELECT PVTB.PROD_REQUEST_NO, isnull(PVTB.[1],0) AS CD1, isnull(PVTB.[2],0) AS CD2,isnull(PVTB.[3],0) AS CD3,isnull(PVTB.[4],0) AS CD4 FROM 
                              (
                                  SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER, SUM(isnull(SX_RESULT,0)) AS KETQUASX FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID) WHERE ZTB_QLSXPLAN.STEP=0 GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER
                              )
                              AS PV
                              PIVOT
                              ( 
                              SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2],[3],[4])
                              ) 
                              AS PVTB) AS BB ON (BB.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO)
                    ${condition} ORDER BY ZTB_QLSXPLAN.PLAN_EQ ASC,  ZTB_QLSXPLAN.PLAN_ORDER ASC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getqlsxplan_table":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  ZTB_QLSXPLAN.XUATDAOFILM, ZTB_QLSXPLAN.EQ_STATUS, ZTB_QLSXPLAN.MAIN_MATERIAL, ZTB_QLSXPLAN.INT_TEM, ZTB_QLSXPLAN.CHOTBC, ZTB_QLSXPLAN.DKXL,ZTB_QLSXPLAN.NEXT_PLAN_ID, ZTB_QLSXPLAN.KQ_SX_TAM,ZTB_QLSXPLAN.KETQUASX, ZTB_QLSXPLAN.PROCESS_NUMBER, ZTB_QLSXPLAN.PLAN_ORDER, ZTB_QLSXPLAN.STEP, ZTB_QLSXPLAN.PLAN_ID,ZTB_QLSXPLAN.PLAN_DATE,ZTB_QLSXPLAN.PROD_REQUEST_NO,ZTB_QLSXPLAN.PLAN_QTY,ZTB_QLSXPLAN.PLAN_EQ,ZTB_QLSXPLAN.PLAN_FACTORY,ZTB_QLSXPLAN.PLAN_LEADTIME,ZTB_QLSXPLAN.INS_EMPL,ZTB_QLSXPLAN.INS_DATE,ZTB_QLSXPLAN.UPD_EMPL,ZTB_QLSXPLAN.UPD_DATE, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, BB.CD1, BB.CD2, BB.CD3, BB.CD4, CASE WHEN (M100.EQ1 <> 'FR' AND M100.EQ1 <> 'SR' AND  M100.EQ1 <> 'DC' AND M100.EQ1 <> 'ED') THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD1,0) END AS TON_CD1,CASE WHEN (M100.EQ2 <> 'FR' AND M100.EQ2 <> 'SR' AND  M100.EQ2 <> 'DC' AND M100.EQ2 <> 'ED') THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD2,0) END AS TON_CD2, M100.FACTORY, M100.EQ1, M100.EQ2, M100.Setting1, M100.Setting2, M100.UPH1, M100.UPH2, M100.Step1, M100.Step2, M100.LOSS_SX1, M100.LOSS_SX2, M100.LOSS_SETTING1, M100.LOSS_SETTING2,M100.Step3, M100.Step4, M100.EQ3, M100.EQ4, M100.UPH3, M100.UPH4, M100.Setting3, M100.Setting4, M100.LOSS_SX3, M100.LOSS_SX4, M100.LOSS_SETTING3, M100.LOSS_SETTING4, M100.NOTE
                    FROM ZTB_QLSXPLAN JOIN P400 ON (P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO) JOIN M100 ON (P400.G_CODE = M100.G_CODE)
                    LEFT JOIN 
                    (SELECT PVTB.PROD_REQUEST_NO, isnull(PVTB.[1],0) AS CD1, isnull(PVTB.[2],0) AS CD2,isnull(PVTB.[3],0) AS CD3,isnull(PVTB.[4],0) AS CD4 FROM 
                    (
                        SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER, SUM(isnull(SX_RESULT,0)) AS KETQUASX FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID) WHERE ZTB_QLSXPLAN.STEP=0 GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER
                    )
                    AS PV
                    PIVOT
                    ( 
                    SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2],[3],[4])
                    ) 
                    AS PVTB) AS BB ON (BB.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO)
                    WHERE ZTB_QLSXPLAN.PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}' ORDER BY ZTB_QLSXPLAN.PLAN_ORDER DESC `;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "checkdiemdanh":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTBATTENDANCETB WHERE EMPL_NO= '${EMPL_NO}' AND APPLY_DATE= '${moment().format(
            "YYYY-MM-DD"
          )}' `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getchithidatatable":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_QLSXCHITHI.LIEUQL_SX ,ZTB_QLSXCHITHI.CHITHI_ID, ZTB_QLSXCHITHI.PLAN_ID, ZTB_QLSXCHITHI.M_CODE, M090.M_NAME, M090.WIDTH_CD, ZTB_QLSXCHITHI.M_ROLL_QTY, ZTB_QLSXCHITHI.M_MET_QTY,ZTB_QLSXCHITHI.M_QTY, isnull(BB.TOTAL_OUT_QTY,0) AS OUT_KHO_SX, AA.OUT_CFM_QTY ,ZTB_QLSXCHITHI.INS_EMPL, ZTB_QLSXCHITHI.INS_DATE, ZTB_QLSXCHITHI.UPD_EMPL, ZTB_QLSXCHITHI.UPD_DATE FROM ZTB_QLSXCHITHI JOIN M090 ON (M090.M_CODE = ZTB_QLSXCHITHI.M_CODE) 
                    LEFT JOIN 
                    (
                    SELECT PLAN_ID, M_CODE, SUM(OUT_CFM_QTY) AS OUT_CFM_QTY FROM O302 WHERE PLAN_ID='${DATA.PLAN_ID}' GROUP BY PLAN_ID, M_CODE
                    ) AS AA ON (AA.PLAN_ID=ZTB_QLSXCHITHI.PLAN_ID AND AA.M_CODE=ZTB_QLSXCHITHI.M_CODE)
                    LEFT JOIN  
                    (SELECT PLAN_ID_OUTPUT, M_CODE, isnull(SUM(TOTAL_OUT_QTY),0) AS TOTAL_OUT_QTY  FROM OUT_KHO_SX WHERE PLAN_ID_OUTPUT='${DATA.PLAN_ID}' AND OUT_KHO_SX.PHANLOAI='N' GROUP BY PLAN_ID_OUTPUT, M_CODE) AS BB ON (BB.PLAN_ID_OUTPUT=ZTB_QLSXCHITHI.PLAN_ID AND BB.M_CODE=ZTB_QLSXCHITHI.M_CODE)
                    WHERE ZTB_QLSXCHITHI.PLAN_ID='${DATA.PLAN_ID}' ORDER BY ZTB_QLSXCHITHI.M_CODE ASC            
                    `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getLastestPLAN_ID":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 PLAN_ID from ZTB_QLSXPLAN WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}' ORDER BY PLAN_ID DESC `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "getLastestPLANORDER":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  TOP 1 *  FROM ZTB_QLSXPLAN WHERE PLAN_DATE='${DATA.PLAN_DATE}' AND PLAN_EQ='${DATA.PLAN_EQ}' AND PLAN_FACTORY='${DATA.PLAN_FACTORY}' ORDER BY PLAN_ORDER DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "addPlanQLSX":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_QLSXPLAN (CTR_CD,PLAN_ID,PLAN_DATE,PROD_REQUEST_NO,PLAN_QTY,PLAN_EQ,PLAN_FACTORY,PLAN_LEADTIME,STEP,INS_EMPL,INS_DATE,UPD_EMPL,UPD_DATE,PLAN_ORDER, G_CODE, PROCESS_NUMBER, NEXT_PLAN_ID) VALUES('002','${DATA.PLAN_ID}','${DATA.PLAN_DATE}','${DATA.PROD_REQUEST_NO}','${DATA.PLAN_QTY}','${DATA.PLAN_EQ}','${DATA.PLAN_FACTORY}','${DATA.PLAN_LEADTIME}','${DATA.STEP}','${EMPL_NO}',GETDATE(),'${EMPL_NO}',GETDATE(),'${DATA.PLAN_ORDER}', '${DATA.G_CODE}','${DATA.PROCESS_NUMBER}','${DATA.NEXT_PLAN_ID}')`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "deletePlanQLSX":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery1 = `DELETE FROM ZTB_QLSXPLAN WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          let setpdQuery2 = `DELETE FROM ZTB_QLSXCHITHI WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          let setpdQuery3 = `DELETE FROM O300 WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          let setpdQuery4 = `DELETE FROM O301 WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery1);
          checkkq = await queryDB(setpdQuery1);
          checkkq = await queryDB(setpdQuery2);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "updatePlanQLSX":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          //let setpdQuery = `UPDATE ZTB_QLSXPLAN SET PLAN_QTY=${DATA.PLAN_QTY}, STEP=${DATA.STEP}, PLAN_LEADTIME=${DATA.PLAN_LEADTIME}, PLAN_ORDER=${DATA.PLAN_ORDER},PROCESS_NUMBER=${DATA.PROCESS_NUMBER},KETQUASX=${DATA.KETQUASX},PLAN_EQ='${DATA.PLAN_EQ}', UPD_EMPL='${EMPL_NO}', UPD_DATE=GETDATE() WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          let setpdQuery = `UPDATE ZTB_QLSXPLAN SET NEXT_PLAN_ID = '${DATA.NEXT_PLAN_ID}' ,PLAN_QTY=${DATA.PLAN_QTY}, OLD_PLAN_QTY=${DATA.OLD_PLAN_QTY},STEP=${DATA.STEP}, PLAN_LEADTIME=${DATA.PLAN_LEADTIME}, PLAN_ORDER=${DATA.PLAN_ORDER},PROCESS_NUMBER=${DATA.PROCESS_NUMBER},PLAN_EQ='${DATA.PLAN_EQ}', UPD_EMPL='${EMPL_NO}', UPD_DATE=GETDATE() WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "deleteChiThi":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTB_QLSXCHITHI WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
          ////console.log(checkkq);
        })();
        break;
      case "insertChiThi":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_QLSXCHITHI (CTR_CD, PLAN_ID, M_CODE, M_ROLL_QTY, M_MET_QTY, INS_EMPL, INS_DATE, UPD_EMPL, UPD_DATE, M_QTY, LIEUQL_SX) VALUES ('002','${DATA.PLAN_ID}','${DATA.M_CODE}','${DATA.M_ROLL_QTY}','${DATA.M_MET_QTY}','${EMPL_NO}', GETDATE(),'${EMPL_NO}',GETDATE(),'${DATA.M_QTY}',${DATA.LIEUQL_SX})`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "updateChiThi":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_QLSXCHITHI SET LIEUQL_SX=${DATA.LIEUQL_SX}, M_MET_QTY ='${DATA.M_MET_QTY}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE PLAN_ID='${DATA.PLAN_ID}' AND M_CODE='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "getO300_LAST_OUT_NO":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 OUT_NO, OUT_DATE FROM O300 WHERE OUT_DATE='${moment().format(
            "YYYYMMDD"
          )}' ORDER BY OUT_NO DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "getO300_ROW":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 OUT_NO, OUT_DATE FROM O300 WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "setEMPL_WORK_POSITION":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTBEMPLINFO SET WORK_POSITION_CODE=${DATA.WORK_POSITION_CODE} WHERE EMPL_NO='${DATA.EMPL_NO}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "insertO300":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO O300 (CTR_CD,OUT_DATE,OUT_NO,CODE_03,CODE_50,CODE_52,PROD_REQUEST_DATE,PROD_REQUEST_NO,USE_YN,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL,FACTORY,PLAN_ID) VALUES('002','${DATA.OUT_DATE}','${DATA.OUT_NO}','${DATA.CODE_03}','${DATA.CODE_50}','${DATA.CODE_52}','${DATA.PROD_REQUEST_DATE}','${DATA.PROD_REQUEST_NO}','${DATA.USE_YN}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}','${DATA.FACTORY}','${DATA.PLAN_ID}')`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "insertO301":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO O301 (CTR_CD, OUT_DATE, OUT_NO, OUT_SEQ, CODE_03, M_CODE, OUT_PRE_QTY, USE_YN, INS_DATE, INS_EMPL, PLAN_ID) VALUES('002','${DATA.OUT_DATE}','${DATA.OUT_NO}','${DATA.OUT_SEQ}','${DATA.CODE_03}','${DATA.M_CODE}','${DATA.OUT_PRE_QTY}','${DATA.USE_YN}',GETDATE(),'${EMPL_NO}','${DATA.PLAN_ID}')`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "updateO301":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE O301 SET OUT_PRE_QTY='${DATA.OUT_PRE_QTY}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE PLAN_ID='${DATA.PLAN_ID}' AND M_CODE='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkPLANID_O302":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM O302 WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkPLANID_O300":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM O300 WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkPLANID_O301":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM O301 WHERE PLAN_ID='${DATA.PLAN_ID}' ORDER BY OUT_SEQ DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "saveQLSX":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE M100 SET FACTORY='${DATA.FACTORY}',EQ1='${DATA.EQ1}',EQ2='${DATA.EQ2}', EQ3='${DATA.EQ3}',EQ4='${DATA.EQ4}',Setting1='${DATA.Setting1}', Setting2='${DATA.Setting2}', Setting3='${DATA.Setting3}', Setting4='${DATA.Setting4}', UPH1='${DATA.UPH1}',UPH2='${DATA.UPH2}',UPH3='${DATA.UPH3}',UPH4='${DATA.UPH4}',Step1='${DATA.Step1}',Step2='${DATA.Step2}',Step3='${DATA.Step3}',Step4='${DATA.Step4}',LOSS_SX1='${DATA.LOSS_SX1}', LOSS_SX2='${DATA.LOSS_SX2}',LOSS_SX3='${DATA.LOSS_SX3}',LOSS_SX4='${DATA.LOSS_SX4}',LOSS_SETTING1='${DATA.LOSS_SETTING1}',LOSS_SETTING2='${DATA.LOSS_SETTING2}',LOSS_SETTING3='${DATA.LOSS_SETTING3}',LOSS_SETTING4='${DATA.LOSS_SETTING4}',NOTE='${DATA.NOTE}' WHERE G_CODE='${DATA.G_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "deleteMCODEExistIN_O302":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM ZTB_QLSXCHITHI
                    WHERE NOT EXISTS 
                    (SELECT * FROM O302
                    WHERE O302.PLAN_ID = ZTB_QLSXCHITHI.PLAN_ID
                    AND O302.M_CODE = ZTB_QLSXCHITHI.M_CODE)
                    AND ZTB_QLSXCHITHI.PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "deleteMCODE_O301_Not_ExistIN_O302":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM O301
                    WHERE NOT EXISTS 
                    (SELECT * FROM O302
                    WHERE O302.PLAN_ID = O301.PLAN_ID
                    AND O302.M_CODE = O301.M_CODE)
                    AND O301.PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkM_CODE_PLAN_ID_Exist":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTB_QLSXCHITHI WHERE PLAN_ID='${DATA.PLAN_ID}' AND M_CODE='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkM_CODE_PLAN_ID_Exist_in_O301":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM O301 WHERE PLAN_ID='${DATA.PLAN_ID}' AND M_CODE='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "updateLIEUQL_SX_M140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE M140 SET LIEUQL_SX=${DATA.LIEUQL_SX}, UPD_DATE =GETDATE() WHERE G_CODE='${DATA.G_CODE}' AND M_CODE='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checktonlieutrongxuong":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let conditon = ` WHERE IN_KHO_SX.USE_YN='Y'`;
          console.log("factory: " + DATA.FACTORY);
          if (DATA.FACTORY !== "ALL") {
            conditon += ` AND IN_KHO_SX.FACTORY = '${DATA.FACTORY}' `;
          }
          let setpdQuery = `SELECT IN_KHO_SX.IN_KHO_ID, IN_KHO_SX.FACTORY, IN_KHO_SX.PHANLOAI, IN_KHO_SX.PLAN_ID_INPUT, IN_KHO_SX.M_CODE, M090.M_NAME, M090.WIDTH_CD, IN_KHO_SX.M_LOT_NO, IN_KHO_SX.ROLL_QTY, IN_KHO_SX.IN_QTY, IN_KHO_SX.TOTAL_IN_QTY,CASE WHEN IN_KHO_SX.FSC ='Y' THEN 'Y' ELSE 'N' END AS FSC  FROM IN_KHO_SX LEFT JOIN M090 ON  (M090.M_CODE= IN_KHO_SX.M_CODE) ${conditon} `;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "xuatkhoao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO OUT_KHO_SX (CTR_CD,FACTORY,PHANLOAI,PLAN_ID_INPUT,PLAN_ID_OUTPUT,M_CODE,M_LOT_NO,ROLL_QTY,OUT_QTY,TOTAL_OUT_QTY,USE_YN,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL, REMARK) VALUES ('002','${DATA.FACTORY}','${DATA.PHANLOAI}', '${DATA.PLAN_ID_INPUT}', '${DATA.PLAN_ID_OUTPUT}','${DATA.M_CODE}','${DATA.M_LOT_NO}','${DATA.ROLL_QTY}','${DATA.OUT_QTY}','${DATA.TOTAL_OUT_QTY}','${DATA.USE_YN}', GETDATE(), '${EMPL_NO}', GETDATE(),'${EMPL_NO}','WEB_OUT')`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "nhapkhoao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO IN_KHO_SX (CTR_CD,FACTORY,PHANLOAI,PLAN_ID_INPUT, PLAN_ID_SUDUNG, M_CODE,M_LOT_NO,ROLL_QTY,IN_QTY,TOTAL_IN_QTY,USE_YN,INS_DATE,INS_EMPL,UPD_DATE,UPD_EMPL) VALUES ('002','${DATA.FACTORY}','${DATA.PHANLOAI}', '${DATA.PLAN_ID_INPUT}','${DATA.PLAN_ID_SUDUNG}', '${DATA.M_CODE}','${DATA.M_LOT_NO}','${DATA.ROLL_QTY}','${DATA.IN_QTY}','${DATA.TOTAL_IN_QTY}','${DATA.USE_YN}', GETDATE(), '${EMPL_NO}', GETDATE(),'${EMPL_NO}')`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "lichsuxuatkhoao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let conditon = ` WHERE OUT_KHO_SX.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59'`;
          if (DATA.FACTORY !== "ALL") {
            conditon += ` AND OUT_KHO_SX.FACTORY = '${DATA.FACTORY}' `;
          }
          let setpdQuery = `SELECT  OUT_KHO_SX.OUT_KHO_ID,  OUT_KHO_SX.FACTORY, OUT_KHO_SX.PHANLOAI, OUT_KHO_SX.M_CODE, M090.M_NAME, M090.WIDTH_CD, OUT_KHO_SX.M_LOT_NO, OUT_KHO_SX.PLAN_ID_INPUT,OUT_KHO_SX.PLAN_ID_OUTPUT, OUT_KHO_SX.ROLL_QTY, OUT_KHO_SX.OUT_QTY, OUT_KHO_SX.TOTAL_OUT_QTY, OUT_KHO_SX.INS_DATE FROM OUT_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = OUT_KHO_SX.M_CODE) ${conditon} ORDER BY OUT_KHO_SX.INS_DATE DESC`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "lichsunhapkhoao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let conditon = ` WHERE IN_KHO_SX.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59'`;
          if (DATA.FACTORY !== "ALL") {
            conditon += ` AND IN_KHO_SX.FACTORY = '${DATA.FACTORY}' `;
          }
          let setpdQuery = `SELECT  IN_KHO_SX.IN_KHO_ID, IN_KHO_SX.USE_YN, IN_KHO_SX.REMARK, IN_KHO_SX.PLAN_ID_SUDUNG, IN_KHO_SX.FACTORY, IN_KHO_SX.PHANLOAI, IN_KHO_SX.M_CODE, M090.M_NAME, M090.WIDTH_CD, IN_KHO_SX.M_LOT_NO, IN_KHO_SX.PLAN_ID_INPUT, IN_KHO_SX.ROLL_QTY, IN_KHO_SX.IN_QTY, IN_KHO_SX.TOTAL_IN_QTY, IN_KHO_SX.INS_DATE FROM IN_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = IN_KHO_SX.M_CODE) ${conditon} ORDER BY IN_KHO_SX.INS_DATE DESC`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "deleteXuatKhoAo":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DELETE FROM OUT_KHO_SX WHERE PLAN_ID_INPUT='${DATA.PLAN_ID_INPUT}' AND PLAN_ID_OUTPUT='${DATA.CURRENT_PLAN_ID}' AND M_CODE='${DATA.M_CODE}' AND M_LOT_NO='${DATA.M_LOT_NO}' AND PHANLOAI='${DATA.PHANLOAI}' AND TOTAL_OUT_QTY=${DATA.TOTAL_OUT_QTY}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkM_CODE_CHITHI":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM ZTB_QLSXCHITHI WHERE PLAN_ID='${DATA.PLAN_ID_OUTPUT}' AND M_CODE='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "lichsuinputlieusanxuat":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT P500.PLAN_ID, P500.PROD_REQUEST_NO, M100.G_NAME, M100.G_NAME_KD, P500.M_CODE, M090.M_NAME, M090.WIDTH_CD, P500.M_LOT_NO, isnull(BB.TOTAL_OUT_QTY,0)  AS INPUT_QTY, (isnull(BB.TOTAL_OUT_QTY,0)- isnull(P500.REMAIN_QTY,0)) AS USED_QTY ,isnull(P500.REMAIN_QTY,0) AS REMAIN_QTY, P500.EMPL_NO, P500.EQUIPMENT_CD, P500.INS_DATE FROM P500
                    LEFT JOIN M100 ON (M100.G_CODE = P500.G_CODE)
                    LEFT JOIN M090 ON (M090.M_CODE = P500.M_CODE)
                    LEFT JOIN  
                    (SELECT PLAN_ID_OUTPUT, M_CODE, M_LOT_NO, isnull(SUM(TOTAL_OUT_QTY),0) AS TOTAL_OUT_QTY  FROM OUT_KHO_SX WHERE OUT_KHO_SX.PHANLOAI='N' GROUP BY PLAN_ID_OUTPUT, M_CODE,M_LOT_NO) AS BB ON (BB.PLAN_ID_OUTPUT = P500.PLAN_ID AND BB.M_CODE = P500.M_CODE AND BB.M_LOT_NO=P500.M_LOT_NO)
                    WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "lichsuinputlieusanxuat_full":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = "WHERE 1=1";
          if (DATA.ALLTIME === false) {
            condition += ` AND P500.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59' `;
          }
          if (DATA.PROD_REQUEST_NO !== "") {
            condition += ` AND P500.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
          }
          if (DATA.PLAN_ID !== "") {
            condition += ` AND P500.PLAN_ID = '${DATA.PLAN_ID}'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND P500.M_CODE = '${DATA.M_CODE}'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          let setpdQuery = `SELECT P500.PLAN_ID, P500.PROD_REQUEST_NO, M100.G_NAME,M100.G_CODE, M100.G_NAME_KD, P500.M_CODE, M090.M_NAME, M090.WIDTH_CD, P500.M_LOT_NO, isnull(BB.TOTAL_OUT_QTY,0)  AS INPUT_QTY, (isnull(BB.TOTAL_OUT_QTY,0)- isnull(P500.REMAIN_QTY,0)) AS USED_QTY ,isnull(P500.REMAIN_QTY,0) AS REMAIN_QTY, P500.EMPL_NO, P500.EQUIPMENT_CD, P500.INS_DATE FROM P500
                    LEFT JOIN M100 ON (M100.G_CODE = P500.G_CODE)
                    LEFT JOIN M090 ON (M090.M_CODE = P500.M_CODE)
                    LEFT JOIN  
                    (SELECT PLAN_ID_SUDUNG, M_CODE, M_LOT_NO, isnull(SUM(TOTAL_IN_QTY),0) AS TOTAL_OUT_QTY  FROM IN_KHO_SX  GROUP BY PLAN_ID_SUDUNG, M_CODE,M_LOT_NO) AS BB ON (BB.PLAN_ID_SUDUNG = P500.PLAN_ID AND BB.M_CODE = P500.M_CODE AND BB.M_LOT_NO=P500.M_LOT_NO) ${condition}
                    ORDER BY INS_DATE DESC `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "confirmlieutonsx":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE P500 SET REMAIN_QTY=${DATA.REMAIN_QTY} WHERE PLAN_ID='${DATA.PLAN_ID}' AND M_CODE='${DATA.M_CODE}' AND M_LOT_NO='${DATA.M_LOT_NO}' AND EQUIPMENT_CD='${DATA.EQUIPMENT_CD}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "returnkhoao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ``;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkEQ_STATUS":
        (async () => {
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT 
          ZTB_QLSXPLAN.STEP, 
          M100.G_NAME_KD, 
          M100.G_NAME, 
          M100.UPH1,
          M100.UPH2,
          M100.UPH3,
          M100.UPH4,
          M100.Setting1,
          M100.Setting2,
          M100.Setting3,
          M100.Setting4,
          ZTB_SX_EQ_STATUS.FACTORY, 
          ZTB_SX_EQ_STATUS.EQ_NAME, 
          SUBSTRING(ZTB_SX_EQ_STATUS.EQ_NAME, 1, 2) AS EQ_SERIES, 
          ZTB_SX_EQ_STATUS.EQ_ACTIVE, 
          ZTB_SX_EQ_STATUS.REMARK, 
          ZTB_SX_EQ_STATUS.EQ_STATUS, 
          ZTB_SX_EQ_STATUS.CURR_PLAN_ID, 
          ZTB_SX_EQ_STATUS.CURR_G_CODE, 
          ZTB_SX_EQ_STATUS.INS_EMPL, 
          ZTB_SX_EQ_STATUS.INS_DATE, 
          ZTB_SX_EQ_STATUS.UPD_EMPL, 
          ZTB_SX_EQ_STATUS.UPD_DATE, 
          ZTB_SX_EQ_STATUS.EQ_CODE,
          ZTB_SX_RESULT.SETTING_START_TIME,
          ZTB_SX_RESULT.MASS_START_TIME,
          ZTB_SX_RESULT.MASS_END_TIME,  
          ZTB_QLSXPLAN.KQ_SX_TAM,
          ZTB_SX_RESULT.SX_RESULT,
          ZTB_QLSXPLAN.PROCESS_NUMBER,
          ZTB_QLSXPLAN.PLAN_QTY
        FROM 
          ZTB_SX_EQ_STATUS 
          LEFT JOIN M100 ON (
            M100.G_CODE = ZTB_SX_EQ_STATUS.CURR_G_CODE
          ) 
          LEFT JOIN ZTB_QLSXPLAN ON (
            ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_EQ_STATUS.CURR_PLAN_ID
          ) 
          LEFT JOIN ZTB_SX_RESULT ON (ZTB_SX_RESULT.PLAN_ID = ZTB_SX_EQ_STATUS.CURR_PLAN_ID)  
        ORDER BY 
          FACTORY DESC, 
          EQ_NAME ASC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "traDataAMZ":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let condition = " WHERE 1=1";
          if (DATA.ALLTIME !== true)
            condition += ` AND AMAZONE_DATA.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59'`;
          if (DATA.G_NAME !== "")
            condition += `AND M100.G_NAME LIKE '%${DATA.G_NAME}%' `;
          if (DATA.NO_IN !== "")
            condition += ` AND AMAZONE_DATA.NO_IN ='${DATA.NO_IN}' `;
          if (DATA.PROD_REQUEST_NO !== "")
            condition += ` AND AMAZONE_DATA.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}' `;
          let checkkq = "OK";
          let setpdQuery = `SELECT M100.G_NAME, AMAZONE_DATA.G_CODE, AMAZONE_DATA.PROD_REQUEST_NO, AMAZONE_DATA.NO_IN, AMAZONE_DATA.ROW_NO, AMAZONE_DATA.DATA_1, AMAZONE_DATA.DATA_2,AMAZONE_DATA.DATA_3,AMAZONE_DATA.DATA_4, AMAZONE_DATA.PRINT_STATUS, AMAZONE_DATA.INLAI_COUNT, AMAZONE_DATA.REMARK, AMAZONE_DATA.INS_DATE, AMAZONE_DATA.INS_EMPL FROM AMAZONE_DATA LEFT JOIN M100 ON (M100.G_CODE = AMAZONE_DATA.G_CODE) ${condition}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "move_plan":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_QLSXPLAN SET PLAN_DATE ='${DATA.PLAN_DATE}' WHERE PLAN_ID= '${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkplansetting":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM  ZTB_SX_RESULT WHERE PLAN_ID= '${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "setUSE_YN_KHO_AO_INPUT":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          /* let setpdQuery = `UPDATE IN_KHO_SX SET USE_YN ='${DATA.USE_YN}', PLAN_ID_SUDUNG='${DATA.PLAN_ID_SUDUNG}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE PLAN_ID_INPUT= '${DATA.PLAN_ID_INPUT}' AND M_CODE='${DATA.M_CODE}' AND M_LOT_NO='${DATA.M_LOT_NO}' AND TOTAL_IN_QTY=${DATA.TOTAL_IN_QTY}`;  */
          let setpdQuery = `UPDATE IN_KHO_SX SET USE_YN ='${DATA.USE_YN}', PLAN_ID_SUDUNG='${DATA.PLAN_ID_SUDUNG}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE IN_KHO_ID=${DATA.IN_KHO_ID}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "inspect_daily_ppm":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT CAST(INSPECT_START_TIME as date) AS INSPECT_DATE, SUM(INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) AS MATERIAL_NG, SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS PROCESS_NG, SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS TOTAL_NG, CAST(SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS TOTAL_PPM, CAST(SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS MATERIAL_PPM, CAST(SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS PROCESS_PPM  FROM 
                    ZTBINSPECTNGTB 
                    WHERE ZTBINSPECTNGTB.FACTORY='${DATA.FACTORY}'
                    GROUP BY CAST(INSPECT_START_TIME as date) 
                    ORDER BY CAST(INSPECT_START_TIME as date) DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "inspect_weekly_ppm":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT YEAR(INSPECT_START_TIME) AS YEAR_NUM,  DATEPART(iso_week, DATEADD(DAY, 2, INSPECT_START_TIME)) AS WEEK_NUM, SUM(INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) AS MATERIAL_NG, SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS PROCESS_NG, SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS TOTAL_NG, CAST(SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS TOTAL_PPM, CAST(SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS MATERIAL_PPM, CAST(SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS PROCESS_PPM  FROM ZTBINSPECTNGTB 
                    WHERE ZTBINSPECTNGTB.FACTORY='${
                      DATA.FACTORY
                    }' AND  YEAR(INSPECT_START_TIME) ='${moment().format(
            "YYYY"
          )}'
                    GROUP BY YEAR(INSPECT_START_TIME), DATEPART(iso_week, DATEADD(DAY, 2, INSPECT_START_TIME))
                    ORDER BY YEAR(INSPECT_START_TIME) DESC, DATEPART(iso_week, DATEADD(DAY, 2, INSPECT_START_TIME))  DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "inspect_monthly_ppm":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT YEAR(INSPECT_START_TIME) AS YEAR_NUM, MONTH(INSPECT_START_TIME) AS MONTH_NUM, SUM(INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) AS MATERIAL_NG, SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS PROCESS_NG, SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS TOTAL_NG, CAST(SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS TOTAL_PPM, CAST(SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS MATERIAL_PPM, CAST(SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS PROCESS_PPM  FROM ZTBINSPECTNGTB 
                    WHERE ZTBINSPECTNGTB.FACTORY='${
                      DATA.FACTORY
                    }' AND YEAR(INSPECT_START_TIME)='${moment().format("YYYY")}'
                    GROUP BY YEAR(INSPECT_START_TIME), MONTH(INSPECT_START_TIME)
                    ORDER BY YEAR(INSPECT_START_TIME) DESC, MONTH(INSPECT_START_TIME) ASC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "inspect_yearly_ppm":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT YEAR(INSPECT_START_TIME) AS YEAR_NUM,  SUM(INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) AS MATERIAL_NG, SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS PROCESS_NG, SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS TOTAL_NG, CAST(SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS TOTAL_PPM, CAST(SUM(ERR4+ ERR5+ ERR6+ ERR7 +ERR8 +ERR9 +ERR10+ERR11) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS MATERIAL_PPM, CAST(SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) as float)/CAST(SUM(INSPECT_TOTAL_QTY) as float)*1000000 AS PROCESS_PPM  FROM ZTBINSPECTNGTB 
                    WHERE ZTBINSPECTNGTB.FACTORY='${DATA.FACTORY}'
                    GROUP BY YEAR(INSPECT_START_TIME)
                    ORDER BY YEAR(INSPECT_START_TIME) ASC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "loadDataSX":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE 1=1  ";
          if (DATA.ALLTIME === false) {
            condition += ` AND ZTB_QLSXPLAN.PLAN_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.PLAN_ID !== "") {
            condition += ` AND ZTB_QLSXPLAN.PLAN_ID = '${DATA.PLAN_ID}'`;
          }
          if (DATA.PROD_REQUEST_NO !== "") {
            condition += ` AND ZTB_QLSXPLAN.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
          }
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND ZTB_QLSXPLAN.PLAN_FACTORY = '${DATA.FACTORY}'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND SD_LIEU.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND M090.M_CODE = '${DATA.M_CODE}'`;
          }
          if (DATA.PLAN_EQ !== "ALL") {
            condition += ` AND SUBSTRING(ZTB_QLSXPLAN.PLAN_EQ,1,2)= '${DATA.PLAN_EQ}'`;
          }
          let setpdQuery = `            
          SELECT
CASE WHEN  P400.CODE_55 = '04' THEN 'SAMPLE' ELSE 'MASS' END AS PHAN_LOAI,
ZTB_QLSXPLAN.G_CODE, ZTB_QLSXPLAN.PLAN_ID,ZTB_QLSXPLAN.PLAN_DATE, ZTB_QLSXPLAN.PROD_REQUEST_NO, M100.G_NAME, M100.G_NAME_KD, ZTB_QLSXPLAN.PLAN_QTY,M100.EQ1, M100.EQ2, ZTB_QLSXPLAN.PLAN_EQ, ZTB_QLSXPLAN.PLAN_FACTORY, ZTB_QLSXPLAN.PROCESS_NUMBER, ZTB_QLSXPLAN.STEP, SD_LIEU.M_NAME, SD_LIEU.WAREHOUSE_OUTPUT_QTY, isnull(SD_LIEU.TOTAL_OUT_QTY,0) AS TOTAL_OUT_QTY,(isnull(SD_LIEU.TOTAL_OUT_QTY,0)-isnull( SD_LIEU.REMAIN_QTY,0)) AS USED_QTY, (isnull(SD_LIEU.REMAIN_QTY,0)) AS REMAIN_QTY, ZTB_SX_RESULT.PD, ZTB_SX_RESULT.CAVITY, CASE WHEN ZTB_QLSXPLAN.PROCESS_NUMBER = 1 THEN M100.LOSS_SETTING1 WHEN ZTB_QLSXPLAN.PROCESS_NUMBER=2 THEN M100.LOSS_SETTING2 ELSE 0 END AS SETTING_MET_TC, CASE WHEN ZTB_QLSXPLAN.PROCESS_NUMBER = 1 THEN M100.LOSS_ST_SX1 WHEN ZTB_QLSXPLAN.PROCESS_NUMBER=2 THEN M100.LOSS_ST_SX1 ELSE 0 END AS SETTING_DM_SX,
ZTB_SX_RESULT.SETTING_MET,CAST(((SD_LIEU.WAREHOUSE_OUTPUT_QTY) - ZTB_SX_RESULT.SETTING_MET)/ZTB_SX_RESULT.PD * ZTB_SX_RESULT.CAVITY*1000 AS int) AS WAREHOUSE_ESTIMATED_QTY, CAST(((SD_LIEU.TOTAL_OUT_QTY-  SD_LIEU.REMAIN_QTY) - ZTB_SX_RESULT.SETTING_MET)/ZTB_SX_RESULT.PD * ZTB_SX_RESULT.CAVITY*1000 AS int) AS ESTIMATED_QTY,  CAST(((SD_LIEU.TOTAL_OUT_QTY-  SD_LIEU.REMAIN_QTY))/ZTB_SX_RESULT.PD * ZTB_SX_RESULT.CAVITY*1000 AS int) AS ESTIMATED_QTY_ST, CAST(ZTB_SX_RESULT.SX_RESULT AS float) AS KETQUASX, INSPECT_INPUT_TABLE.INS_INPUT,  
 INSPECT_NK_TABLE.INSPECT_TOTAL_QTY, INSPECT_NK_TABLE.INSPECT_OK_QTY, INSPECT_NK_TABLE.INSPECT_NG_QTY,
INSPECT_OUTPUT_TABLE.INS_OUTPUT,  ZTB_SX_RESULT.SETTING_START_TIME, ZTB_SX_RESULT.MASS_START_TIME, ZTB_SX_RESULT.MASS_END_TIME, ZTB_SX_RESULT.RPM,ZTB_SX_RESULT.EQ_NAME AS EQ_NAME_TT, SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2) AS MACHINE_NAME, ZTB_SX_RESULT.SX_DATE, ZTB_SX_RESULT.WORK_SHIFT, ZTB_SX_RESULT.INS_EMPL, ZTB_SX_EFFICIENCY.FACTORY, ZTB_SX_EFFICIENCY.BOC_KIEM, ZTB_SX_EFFICIENCY.LAY_DO, ZTB_SX_EFFICIENCY.MAY_HONG, ZTB_SX_EFFICIENCY.DAO_NG, ZTB_SX_EFFICIENCY.CHO_LIEU, ZTB_SX_EFFICIENCY.CHO_BTP, ZTB_SX_EFFICIENCY.HET_LIEU, ZTB_SX_EFFICIENCY.LIEU_NG, ZTB_SX_EFFICIENCY.CAN_HANG, ZTB_SX_EFFICIENCY.HOP_FL, ZTB_SX_EFFICIENCY.CHO_QC, ZTB_SX_EFFICIENCY.CHOT_BAOCAO, ZTB_SX_EFFICIENCY.CHUYEN_CODE, ZTB_SX_EFFICIENCY.KHAC, ZTB_SX_EFFICIENCY.REMARK
    FROM ZTB_QLSXPLAN
    LEFT JOIN 
    (
        SELECT isnull(isnull(WAREHOUSE_OUT.PLAN_ID_INPUT,AA.PLAN_ID_SUDUNG),BB.PLAN_ID) AS PLAN_ID_OUTPUT, isnull(isnull(WAREHOUSE_OUT.M_NAME,AA.M_NAME),BB.M_NAME) AS M_NAME, AA.INPUT_QTY AS TOTAL_OUT_QTY, BB.REMAIN_QTY, (AA.INPUT_QTY - BB.REMAIN_QTY) AS USED_QTY, WAREHOUSE_OUT.WAREHOUSE_OUTPUT_QTY FROM
        (SELECT PLAN_ID_SUDUNG, M090.M_NAME, SUM(TOTAL_IN_QTY) AS INPUT_QTY  FROM IN_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = IN_KHO_SX.M_CODE)  WHERE IN_KHO_SX.USE_YN='X' GROUP BY IN_KHO_SX.PLAN_ID_SUDUNG, M090.M_NAME) AS AA
        FULL OUTER JOIN
        (SELECT P500.PLAN_ID, M090.M_NAME, SUM(REMAIN_QTY) AS REMAIN_QTY FROM P500  LEFT JOIN M090 ON (M090.M_CODE = P500.M_CODE) GROUP BY PLAN_ID,M090.M_NAME) AS BB
        ON(AA.PLAN_ID_SUDUNG = BB.PLAN_ID AND AA.M_NAME = BB.M_NAME)		
        FULL OUTER JOIN(SELECT PLAN_ID_INPUT, M090.M_NAME, SUM(TOTAL_IN_QTY) AS WAREHOUSE_OUTPUT_QTY  FROM IN_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = IN_KHO_SX.M_CODE) WHERE IN_KHO_SX.PHANLOAI='N' GROUP BY PLAN_ID_INPUT, M090.M_NAME)  AS WAREHOUSE_OUT
        ON(AA.PLAN_ID_SUDUNG = WAREHOUSE_OUT.PLAN_ID_INPUT AND AA.M_NAME = WAREHOUSE_OUT.M_NAME)	
                    
    ) AS SD_LIEU ON  (ZTB_QLSXPLAN.PLAN_ID = SD_LIEU.PLAN_ID_OUTPUT)
                
    LEFT JOIN  ZTB_SX_RESULT ON (ZTB_SX_RESULT.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
    LEFT JOIN
    (SELECT PLAN_ID, SUM(CAST(INPUT_QTY_EA as float)) AS INS_INPUT FROM ZTBINSPECTINPUTTB GROUP BY PLAN_ID) AS INSPECT_INPUT_TABLE ON(ZTB_QLSXPLAN.PLAN_ID = INSPECT_INPUT_TABLE.PLAN_ID)
    LEFT JOIN
    (SELECT PLAN_ID, SUM(CAST(OUTPUT_QTY_EA as float)) AS INS_OUTPUT FROM ZTBINSPECTOUTPUTTB GROUP BY PLAN_ID) AS INSPECT_OUTPUT_TABLE ON (ZTB_QLSXPLAN.PLAN_ID = INSPECT_OUTPUT_TABLE.PLAN_ID)
	LEFT JOIN
              (SELECT PLAN_ID, SUM(CAST(INSPECT_TOTAL_QTY  as float)) AS INSPECT_TOTAL_QTY,  SUM(CAST(INSPECT_OK_QTY  as float)) AS INSPECT_OK_QTY, SUM(CAST((ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31
)  as float)) AS INSPECT_NG_QTY FROM ZTBINSPECTNGTB GROUP BY PLAN_ID) AS INSPECT_NK_TABLE ON (ZTB_QLSXPLAN.PLAN_ID = INSPECT_NK_TABLE.PLAN_ID)
    LEFT JOIN M100 ON (M100.G_CODE = ZTB_QLSXPLAN.G_CODE)
    LEFT JOIN ZTB_SX_EFFICIENCY ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_EFFICIENCY.PLAN_ID)
    LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO)               
                    ${condition}
                    ORDER BY ZTB_QLSXPLAN.NEXT_PLAN_ID DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "loadDataSX_YCSX":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE PROD_REQUEST_NO1 is not null  ";
          if (DATA.ALLTIME === false) {
            condition += ` AND P400.PROD_REQUEST_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.PROD_REQUEST_NO !== "") {
            condition += ` AND P400.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
          }
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND M100.FACTORY = '${DATA.FACTORY}'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND SD_LIEU.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          let setpdQuery = `
          SELECT 
          CASE WHEN  isnull(INS_OUTPUT_TB.INS_OUTPUT,0) >= P400.PROD_REQUEST_QTY  THEN 'CLOSED' ELSE 'PENDING' END AS YCSX_PENDING, P400.G_CODE, CASE WHEN P400.CODE_55 = '04' THEN 'SAMPLE' ELSE 'MASS' END AS PHAN_LOAI, P400.PROD_REQUEST_NO, M100.G_NAME,M100.G_NAME_KD,M100.FACTORY, M100.EQ1, M100.EQ2, M100.EQ3, M100.EQ4, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, isnull(SD_LIEU.M_NAME,'X') AS M_NAME,  isnull(SD_LIEU.TOTAL_OUT_QTY,0) AS M_OUTPUT,isnull(SCANNED.SCANNED_QTY,0) AS SCANNED_QTY,(isnull(SD_LIEU.REMAIN_QTY,0)) AS REMAIN_QTY, (isnull(SCANNED.SCANNED_QTY,0)- isnull(SD_LIEU.REMAIN_QTY,0)) AS USED_QTY, M100.PD, M100.G_C* M100.G_C_R AS CAVITY, CAST((isnull(SD_LIEU.TOTAL_OUT_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000 AS int) AS WAREHOUSE_ESTIMATED_QTY, CAST((isnull(SCANNED.SCANNED_QTY,0)- isnull(SD_LIEU.REMAIN_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000 AS int) AS ESTIMATED_QTY, KQSXTABLE.CD1,KQSXTABLE.CD2, KQSXTABLE.CD3, KQSXTABLE.CD4,  isnull(INS_INPUT_TB.INS_INPUT,0) INS_INPUT, 
       isnull(NHATKYKT.INSPECT_TOTAL_QTY,0) AS INSPECT_TOTAL_QTY, isnull(NHATKYKT.INSPECT_OK_QTY,0) AS INSPECT_OK_QTY, isnull(NHATKYKT.INSPECT_LOSS_QTY,0) AS INSPECT_LOSS_QTY, isnull(NHATKYKT.INSPECT_TOTAL_NG,0) AS INSPECT_TOTAL_NG, isnull(NHATKYKT.INSPECT_MATERIAL_NG,0) AS INSPECT_MATERIAL_NG, isnull(NHATKYKT.INSPECT_PROCESS_NG,0) AS INSPECT_PROCESS_NG,
      isnull(INS_OUTPUT_TB.INS_OUTPUT,0)
                      AS INS_OUTPUT,
                      CASE WHEN CAST((isnull(SCANNED.SCANNED_QTY,0)- isnull(SD_LIEU.REMAIN_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000 AS int) <>0 THEN 1-isnull(KQSXTABLE.CD1,0) /CAST((isnull(SCANNED.SCANNED_QTY,0)- isnull(SD_LIEU.REMAIN_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000 AS float) ELSE 0 END AS LOSS_SX1,
 
                      CASE 
                      WHEN isnull(KQSXTABLE.CD1,0) <>0 AND  (M100.EQ2 <> 'NA' AND M100.EQ2 <>'NO' AND M100.EQ2 <>'' AND M100.EQ2 is not null) THEN 1-CAST(isnull(KQSXTABLE.CD2,0) as float) /Cast(isnull(KQSXTABLE.CD1,0) as float) 
                      WHEN isnull(KQSXTABLE.CD1,0) <>0 AND NOT (M100.EQ2 <> 'NA' AND M100.EQ2 <>'NO' AND M100.EQ2 <>'' AND M100.EQ2 is not null) THEN 0
                      ELSE 0
                      END AS LOSS_SX2,
 
             CASE 
                      WHEN isnull(KQSXTABLE.CD2,0) <>0 AND   (M100.EQ3 <> 'NA' AND M100.EQ3 <>'NO' AND M100.EQ3 <>'' AND M100.EQ3 is not null) THEN 1-CAST(isnull(KQSXTABLE.CD3,0) as float) /Cast(isnull(KQSXTABLE.CD2,0) as float) 
                      WHEN isnull(KQSXTABLE.CD2,0) <>0 AND NOT (M100.EQ3 <> 'NA' AND M100.EQ3 <>'NO' AND M100.EQ3 <>'' AND M100.EQ3 is not null) THEN 0
                      ELSE 0
                      END AS LOSS_SX3,
 
             CASE 
                      WHEN isnull(KQSXTABLE.CD3,0) <>0 AND   (M100.EQ4 <> 'NA' AND M100.EQ4 <>'NO' AND M100.EQ4 <>'' AND M100.EQ4 is not null) THEN 1-CAST(isnull(KQSXTABLE.CD4,0) as float) /Cast(isnull(KQSXTABLE.CD3,0) as float) 
                      WHEN isnull(KQSXTABLE.CD3,0) <>0 AND  NOT (M100.EQ4 <> 'NA' AND M100.EQ4 <>'NO' AND M100.EQ4 <>'' AND M100.EQ4 is not null) THEN 0
                      ELSE 0
                      END AS LOSS_SX4, 
                      CASE 
                      WHEN isnull(INS_INPUT_TB.INS_INPUT,0) <>0 THEN 1-CAST(isnull(INS_OUTPUT_TB.INS_OUTPUT,0) as float) /Cast(isnull(INS_INPUT_TB.INS_INPUT,0) as float)
                      ELSE 0
                      END AS LOSS_INSPECT,		
                      CASE 
                      WHEN (isnull(SCANNED.SCANNED_QTY,0)- isnull(SD_LIEU.REMAIN_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000  <>0 THEN 1-CAST(isnull(INS_OUTPUT_TB.INS_OUTPUT,0) as float) /Cast((isnull(SCANNED.SCANNED_QTY,0)- isnull(SD_LIEU.REMAIN_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000 as float)
                      ELSE 0
                      END AS TOTAL_LOSS,
                       CASE 
                      WHEN (isnull(SD_LIEU.TOTAL_OUT_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000  <>0 THEN 1-CAST(isnull(INS_OUTPUT_TB.INS_OUTPUT,0) as float) /Cast((isnull(SD_LIEU.TOTAL_OUT_QTY,0)) / M100.PD * (M100.G_C* M100.G_C_R)*1000 as float)
                      ELSE 0
                      END AS TOTAL_LOSS2
                      FROM P400
                      LEFT JOIN (SELECT PVTB.PROD_REQUEST_NO, isnull(PVTB.[1],0) AS CD1, isnull(PVTB.[2],0) AS CD2,isnull(PVTB.[3],0) AS CD3,isnull(PVTB.[4],0) AS CD4 FROM 
                      (
                          SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER, SUM(isnull(SX_RESULT,0)) AS KETQUASX FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID) WHERE ZTB_QLSXPLAN.STEP=0 GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER
                      )
                      AS PV
                      PIVOT
                      ( 
                      SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2],[3],[4])
                      ) 
                      AS PVTB) AS KQSXTABLE ON (P400.PROD_REQUEST_NO = KQSXTABLE.PROD_REQUEST_NO) 
                      LEFT JOIN 
                      (
                      SELECT  PROD_REQUEST_NO, SUM(INPUT_QTY_EA) AS INS_INPUT FROM ZTBINSPECTINPUTTB GROUP BY PROD_REQUEST_NO
                      ) AS INS_INPUT_TB ON (INS_INPUT_TB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                      LEFT JOIN
                      (
                          SELECT  PROD_REQUEST_NO, SUM(OUTPUT_QTY_EA) AS INS_OUTPUT FROM ZTBINSPECTOUTPUTTB GROUP BY PROD_REQUEST_NO
                      ) AS INS_OUTPUT_TB ON (INS_OUTPUT_TB.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                      LEFT JOIN 
                      (SELECT DISTINCT PROD_REQUEST_NO AS PROD_REQUEST_NO1 FROM ZTB_QLSXPLAN) AS ZTB_QLSXPLAN_A ON (ZTB_QLSXPLAN_A.PROD_REQUEST_NO1 = P400.PROD_REQUEST_NO) 
                      LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE)
                      LEFT JOIN
                      ( 			
                              SELECT isnull(AA.PROD_REQUEST_NO,BB.PROD_REQUEST_NO) AS PROD_REQUEST_NO, isnull(AA.M_NAME,BB.M_NAME) AS M_NAME, AA.TOTAL_OUT_QTY, isnull(BB.REMAIN_QTY,0) AS REMAIN_QTY FROM 
                              (
                                  SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO,M090.M_NAME, SUM(IN_KHO_SX.TOTAL_IN_QTY) AS TOTAL_OUT_QTY 
                                  FROM IN_KHO_SX 			
                                  LEFT JOIN M090 ON (IN_KHO_SX.M_CODE = M090.M_CODE) 
                                  LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = IN_KHO_SX.PLAN_ID_INPUT)
                                  WHERE IN_KHO_SX.PHANLOAI='N'
                                  GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO,M090.M_NAME
                              ) AS AA
                              FULL OUTER JOIN 
                              (
                                  SELECT P500.PROD_REQUEST_NO, M090.M_NAME, SUM(P500.REMAIN_QTY) AS REMAIN_QTY
                                  FROM P500	LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = P500.PLAN_ID)
                                  LEFT JOIN M090 ON (P500.M_CODE = M090.M_CODE)
                                  WHERE ZTB_QLSXPLAN.PROCESS_NUMBER =1 
                                  GROUP BY P500.PROD_REQUEST_NO, M090.M_NAME
                              ) AS BB
                              ON (AA.PROD_REQUEST_NO = BB.PROD_REQUEST_NO AND AA.M_NAME = BB.M_NAME)							
                      ) AS SD_LIEU 
                      ON (SD_LIEU.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)	
                      LEFT JOIN (
                          SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO, M090.M_NAME, SUM(TOTAL_IN_QTY) AS SCANNED_QTY  FROM IN_KHO_SX  LEFT JOIN ZTB_QLSXPLAN ON(ZTB_QLSXPLAN.PLAN_ID = IN_KHO_SX.PLAN_ID_SUDUNG)
                          LEFT JOIN M090 ON (M090.M_CODE = IN_KHO_SX.M_CODE)
                          WHERE IN_KHO_SX.USE_YN='X'
                          GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO, M090.M_NAME				
                      ) AS SCANNED 
                      ON (SCANNED.PROD_REQUEST_NO = SD_LIEU.PROD_REQUEST_NO AND SCANNED.M_NAME = SD_LIEU.M_NAME) 
            LEFT JOIN (
            SELECT PROD_REQUEST_NO, SUM(INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(INSPECT_OK_QTY) AS INSPECT_OK_QTY, SUM(ERR1+ ERR2+ERR3) AS INSPECT_LOSS_QTY, SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11) AS INSPECT_MATERIAL_NG, SUM(ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31) AS INSPECT_PROCESS_NG, SUM(ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31
 ) INSPECT_TOTAL_NG  FROM ZTBINSPECTNGTB WHERE INSPECT_DATETIME >= '2022-10-18' GROUP BY PROD_REQUEST_NO
            ) AS NHATKYKT ON (NHATKYKT.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
                    ${condition}
                    ORDER BY P400.PROD_REQUEST_NO DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkQLSXPLANSTATUS":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let condition = " WHERE 1=1  ";
          if (DATA.ALLTIME === false) {
            condition += ` AND ZTB_QLSXPLAN.PLAN_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.PLAN_ID !== "") {
            condition += ` AND ZTB_QLSXPLAN.PLAN_ID = '${DATA.PLAN_ID}'`;
          }
          if (DATA.PROD_REQUEST_NO !== "") {
            condition += ` AND ZTB_QLSXPLAN.PROD_REQUEST_NO = '${DATA.PROD_REQUEST_NO}'`;
          }
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND ZTB_QLSXPLAN.PLAN_FACTORY = '${DATA.FACTORY}'`;
          }
          if (DATA.PLAN_EQ !== "ALL") {
            condition += ` AND SUBSTRING(ZTB_QLSXPLAN.PLAN_EQ,1,2)= '${DATA.PLAN_EQ}'`;
          }
          let checkkq = "OK";
          let setpdQuery = `SELECT   ZTB_SX_RESULT.WORK_SHIFT, ZTB_QLSXPLAN.PLAN_QTY, ZTB_QLSXPLAN.KQ_SX_TAM, ZTB_QLSXPLAN.KETQUASX, ZTB_QLSXPLAN.STEP, ZTB_QLSXPLAN.PLAN_FACTORY, ZTB_QLSXPLAN.PLAN_ID, ZTB_QLSXPLAN.PLAN_DATE,  ZTB_QLSXPLAN.PLAN_EQ, M100.G_NAME,M100.G_NAME_KD, OUT_KNIFE_FILM_A.PLAN_ID AS XUATDAO, ZTB_SX_RESULT.SETTING_START_TIME, ZTB_SX_RESULT.MASS_START_TIME, ZTB_SX_RESULT.MASS_END_TIME,O301_A.PLAN_ID AS DKXL, OUT_KHO_SX_A.PLAN_ID_OUTPUT AS XUATLIEU, ZTB_SX_RESULT.SX_RESULT AS CHOTBC
                FROM ZTB_QLSXPLAN
                LEFT JOIN (SELECT DISTINCT PLAN_ID FROM OUT_KNIFE_FILM) AS OUT_KNIFE_FILM_A  
                ON (ZTB_QLSXPLAN.PLAN_ID  = OUT_KNIFE_FILM_A.PLAN_ID)
                LEFT JOIN  ZTB_SX_RESULT ON( ZTB_SX_RESULT.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
                LEFT JOIN (SELECT DISTINCT PLAN_ID_OUTPUT FROM OUT_KHO_SX) AS OUT_KHO_SX_A 
                ON (ZTB_QLSXPLAN.PLAN_ID = OUT_KHO_SX_A.PLAN_ID_OUTPUT)
                LEFT JOIN M100 ON (M100.G_CODE = ZTB_QLSXPLAN.G_CODE)
                LEFT JOIN (SELECT DISTINCT PLAN_ID FROM O301 WHERE INS_DATE > '2022-11-21') AS O301_A ON (O301_A.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
                    ${condition}
                    ORDER BY ZTB_QLSXPLAN.PLAN_DATE DESC, ZTB_QLSXPLAN.PLAN_ID DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "updateDKXLPLAN":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_QLSXPLAN SET DKXL='V' WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkWebVer":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT VERWEB FROM ZBTVERTABLE`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "getP4002":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM P400 WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "insert_OUT_KNIFE_FILM":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO OUT_KNIFE_FILM (CTR_CD, CA_LAM_VIEC, PLAN_ID, KNIFE_FILM_NO, QTY_KNIFE_FILM, CAVITY, PD, EQ_THUC_TE, EMPL_NO, F_WIDTH, F_LENGTH, INS_DATE, INS_EMPL) VALUES ('002','${DATA.CA_LAM_VIEC}','${DATA.PLAN_ID}','${DATA.KNIFE_FILM_NO}', 1,1,1, '${DATA.EQ_THUC_TE}','${DATA.EMPL_NO}',0,0,GETDATE(),'${DATA.EMPL_NO}')`;
          let updateVQLSXPLAN = `UPDATE ZTB_QLSXPLAN SET XUATDAOFILM ='V' WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          checkkq = await queryDB(updateVQLSXPLAN);
          res.send(checkkq);
        })();
        break;
      case "check_PLAN_ID_OUT_KNIFE_FILM":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM OUT_KNIFE_FILM WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "check_PLAN_ID_KHO_AO":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT * FROM OUT_KHO_SX WHERE PLAN_ID_OUTPUT='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkProd_request_no_Exist_O302":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT TOP 1 * FROM P500 WHERE PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}' AND PLAN_ID is null`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "updateXUATLIEUCHINH_PLAN":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE ZTB_QLSXPLAN SET MAIN_MATERIAL='V' WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "update_XUAT_DAO_FILM_PLAN":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE ZTB_QLSXPLAN SET XUATDAOFILM='V' WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "getIns_Status":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT ZTB_INS_STATUS.KHUVUC, ZTB_INS_STATUS.FACTORY,ZTB_INS_STATUS.EQ_NAME,ZTB_INS_STATUS.EMPL_COUNT,ZTB_INS_STATUS.EQ_STATUS,ZTB_INS_STATUS.CURR_PLAN_ID,ZTB_INS_STATUS.CURR_G_CODE,ZTB_INS_STATUS.REMARK,ZTB_INS_STATUS.INS_EMPL,ZTB_INS_STATUS.INS_DATE,ZTB_INS_STATUS.UPD_EMPL,ZTB_INS_STATUS.UPD_DATE, M100.G_NAME_KD, M100.G_NAME FROM ZTB_INS_STATUS LEFT JOIN M100 ON (M100.G_CODE = ZTB_INS_STATUS.CURR_G_CODE) ORDER BY ZTB_INS_STATUS.EQ_NAME ASC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "check_lieuql_sx_m140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `select top 1 * from M140 WHERE G_CODE = '${DATA.G_CODE}' AND LIEUQL_SX =1`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "check_m_code_m140":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `select * from M140 WHERE G_CODE = '${DATA.G_CODE}' AND M_CODE ='${DATA.M_CODE}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checktrungAMZ_Full":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM AMAZONE_DATA WHERE DATA_1 IN( SELECT AAA.originalcodecount FROM ( SELECT AA.code as originalcodecount, COUNT(AA.code) AS COUNT_ FROM (SELECT code FROM ( SELECT DATA_1 FROM AMAZONE_DATA UNION ALL SELECT DATA_2 FROM AMAZONE_DATA ) AS UNIQUEDATA(code) ) as AA GROUP BY AA.code HAVING COUNT(AA.code) >1 ) AS AAA ) UNION SELECT * FROM AMAZONE_DATA WHERE DATA_2 IN( SELECT AAA.originalcodecount FROM ( SELECT AA.code as originalcodecount, COUNT(AA.code) AS COUNT_ FROM (SELECT code FROM ( SELECT DATA_1 FROM AMAZONE_DATA UNION ALL SELECT DATA_2 FROM AMAZONE_DATA ) AS UNIQUEDATA(code) ) as AA GROUP BY AA.code HAVING COUNT(AA.code) >1 ) AS AAA )`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "traShortageKD":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE 1=1  ";
          if (DATA.ALLTIME === false) {
            condition += ` AND ZTB_SHORTAGE_LIST.PLAN_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.ST_ID !== "") {
            condition += ` AND ZTB_SHORTAGE_LIST.ST_ID = '${DATA.ST_ID}'`;
          }
          if (DATA.CUST_NAME !== "") {
            condition += ` AND M110.CUST_NAME_KD LIKE '%${DATA.CUST_NAME}%'`;
          }
          let setpdQuery = `SELECT M100.G_NAME, ZTB_SHORTAGE_LIST.G_CODE,  ZTB_SHORTAGE_LIST.ST_ID,ZTB_SHORTAGE_LIST.PLAN_DATE, M110.CUST_NAME_KD, PO_TON.PO_BALANCE, TONKHOFULL.TON_TP, TONKHOFULL.BTP, TONKHOFULL.TONG_TON_KIEM, ZTB_SHORTAGE_LIST.D1_9H, ZTB_SHORTAGE_LIST.D1_13H, ZTB_SHORTAGE_LIST.D1_19H, ZTB_SHORTAGE_LIST.D1_21H, ZTB_SHORTAGE_LIST.D1_23H, ZTB_SHORTAGE_LIST.D2_9H, ZTB_SHORTAGE_LIST.D2_13H, ZTB_SHORTAGE_LIST.D2_21H, ZTB_SHORTAGE_LIST.D3_SANG, ZTB_SHORTAGE_LIST.D3_CHIEU, ZTB_SHORTAGE_LIST.D4_SANG, ZTB_SHORTAGE_LIST.D4_CHIEU, (ZTB_SHORTAGE_LIST.D1_9H+ ZTB_SHORTAGE_LIST.D1_13H+ ZTB_SHORTAGE_LIST.D1_19H+ ZTB_SHORTAGE_LIST.D1_21H+ ZTB_SHORTAGE_LIST.D1_23H) AS TODAY_TOTAL, (TONKHOFULL.TON_TP - (ZTB_SHORTAGE_LIST.D1_9H+ ZTB_SHORTAGE_LIST.D1_13H+ ZTB_SHORTAGE_LIST.D1_19H+ ZTB_SHORTAGE_LIST.D1_21H+ ZTB_SHORTAGE_LIST.D1_23H)) AS TODAY_THIEU, CASE WHEN M100.UPH1 > M100.UPH2 THEN M100.UPH2 ELSE M100.UPH1 END AS UPH, ZTB_SHORTAGE_LIST.PRIORITY FROM ZTB_SHORTAGE_LIST LEFT JOIN M100 ON (M100.G_CODE = ZTB_SHORTAGE_LIST.G_CODE) LEFT JOIN M110 ON (M110.CUST_CD = ZTB_SHORTAGE_LIST.CUST_CD) LEFT JOIN M010 ON (M010.EMPL_NO = ZTB_SHORTAGE_LIST.EMPL_NO) LEFT JOIN (SELECT AA.G_CODE, (SUM(ZTBPOTable.PO_QTY)-SUM(AA.TotalDelivered)) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA JOIN ZTBPOTable ON ( AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) GROUP BY AA.G_CODE) AS PO_TON ON(ZTB_SHORTAGE_LIST.G_CODE = PO_TON.G_CODE) LEFT JOIN ( SELECT M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, isnull(TONKIEM.INSPECT_BALANCE_QTY, 0) AS CHO_KIEM, isnull(TONKIEM.WAIT_CS_QTY, 0) AS CHO_CS_CHECK, isnull(TONKIEM.WAIT_SORTING_RMA, 0) CHO_KIEM_RMA, isnull(TONKIEM.TOTAL_WAIT, 0) AS TONG_TON_KIEM, isnull(BTP.BTP_QTY_EA, 0) AS BTP, isnull(THANHPHAM.TONKHO, 0) AS TON_TP, isnull(tbl_Block_table2.Block_Qty, 0) AS BLOCK_QTY, ( isnull(TONKIEM.TOTAL_WAIT, 0) + isnull(BTP.BTP_QTY_EA, 0)+ isnull(THANHPHAM.TONKHO, 0) - isnull(tbl_Block_table2.Block_Qty, 0) ) AS GRAND_TOTAL_STOCK FROM M100 LEFT JOIN ( SELECT Product_MaVach, isnull([IN], 0) AS NHAPKHO, isnull([OUT], 0) AS XUATKHO, ( isnull([IN], 0)- isnull([OUT], 0) ) AS TONKHO FROM ( SELECT Product_Mavach, IO_Type, IO_Qty FROM tbl_InputOutput ) AS SourceTable PIVOT ( SUM(IO_Qty) FOR IO_Type IN ([IN], [OUT]) ) AS PivotTable ) AS THANHPHAM ON ( THANHPHAM.Product_MaVach = M100.G_CODE ) LEFT JOIN ( SELECT ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD, SUM(INSPECT_BALANCE_QTY) AS INSPECT_BALANCE_QTY, SUM(WAIT_CS_QTY) AS WAIT_CS_QTY, SUM(WAIT_SORTING_RMA) AS WAIT_SORTING_RMA, SUM( INSPECT_BALANCE_QTY + WAIT_CS_QTY + WAIT_SORTING_RMA ) AS TOTAL_WAIT FROM ZTB_WAIT_INSPECT JOIN M100 ON ( M100.G_CODE = ZTB_WAIT_INSPECT.G_CODE ) WHERE UPDATE_DATE = CONVERT( date, GETDATE() ) AND CALAMVIEC = 'DEM' GROUP BY ZTB_WAIT_INSPECT.G_CODE, M100.G_NAME, M100.G_NAME_KD ) AS TONKIEM ON ( THANHPHAM.Product_MaVach = TONKIEM.G_CODE ) LEFT JOIN ( SELECT Product_MaVach, SUM(Block_Qty) AS Block_Qty from tbl_Block2 GROUP BY Product_MaVach ) AS tbl_Block_table2 ON ( tbl_Block_table2.Product_MaVach = M100.G_CODE ) LEFT JOIN ( SELECT ZTB_HALF_GOODS.G_CODE, M100.G_NAME, SUM(BTP_QTY_EA) AS BTP_QTY_EA FROM ZTB_HALF_GOODS JOIN M100 ON ( M100.G_CODE = ZTB_HALF_GOODS.G_CODE ) WHERE UPDATE_DATE = CONVERT( date, GETDATE() ) GROUP BY ZTB_HALF_GOODS.G_CODE, M100.G_NAME ) AS BTP ON ( BTP.G_CODE = THANHPHAM.Product_MaVach ) ) AS TONKHOFULL ON ( TONKHOFULL.G_CODE = ZTB_SHORTAGE_LIST.G_CODE ) ${condition} ORDER BY ZTB_SHORTAGE_LIST.ST_ID DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "tinhhinhchotbaocaosx":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_SX_RESULT.SX_DATE, COUNT(ZTB_SX_RESULT.PLAN_ID) AS TOTAL, COUNT(CASE WHEN ZTB_SX_RESULT.MASS_END_TIME is not null THEN 1 ELSE null END) AS DA_CHOT, COUNT(CASE WHEN ZTB_SX_RESULT.MASS_END_TIME is  null THEN 1 ELSE null END) AS CHUA_CHOT,  COUNT(CASE WHEN ZTB_SX_EFFICIENCY.PLAN_ID is not null THEN 1 ELSE null END) AS DA_NHAP_HIEUSUAT, COUNT(CASE WHEN ZTB_SX_EFFICIENCY.PLAN_ID is  null THEN 1 ELSE null END) AS CHUA_NHAP_HIEUSUAT    FROM ZTB_SX_RESULT LEFT JOIN ZTB_SX_EFFICIENCY ON (ZTB_SX_RESULT.PLAN_ID = ZTB_SX_EFFICIENCY.PLAN_ID AND ZTB_SX_RESULT.WORK_SHIFT = ZTB_SX_EFFICIENCY.WORK_SHIFT) 
                    WHERE ZTB_SX_RESULT.FACTORY='${DATA.FACTORY}'
                    GROUP BY ZTB_SX_RESULT.SX_DATE ORDER BY ZTB_SX_RESULT.SX_DATE DESC `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checklastfcstweekno":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT TOP 1 * FROM ZTBFCSTTB WHERE FCSTYEAR = '${DATA.FCSTWEEKNO}' ORDER BY FCSTWEEKNO DESC `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "get_material_table":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE 1=1 `;
          if (DATA.M_NAME !== "") {
            condition += ` AND ZTB_MATERIAL_TB.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.NGMATERIAL === true) {
            condition += ` AND  (CUST_CD is null OR SSPRICE is null OR CMSPRICE is null OR SLITTING_PRICE is null OR MASTER_WIDTH is null OR ROLL_LENGTH is null)`;
          }
          let setpdQuery = `SELECT ZTB_MATERIAL_TB.M_ID, ZTB_MATERIAL_TB.M_NAME, ZTB_MATERIAL_TB.DESCR, ZTB_MATERIAL_TB.CUST_CD, M110.CUST_NAME_KD,ZTB_MATERIAL_TB.SSPRICE, ZTB_MATERIAL_TB.CMSPRICE, ZTB_MATERIAL_TB.SLITTING_PRICE ,ZTB_MATERIAL_TB.MASTER_WIDTH, ZTB_MATERIAL_TB.ROLL_LENGTH, ZTB_MATERIAL_TB.USE_YN, ZTB_MATERIAL_TB.INS_DATE, ZTB_MATERIAL_TB.INS_EMPL, ZTB_MATERIAL_TB.UPD_DATE, ZTB_MATERIAL_TB.UPD_EMPL FROM ZTB_MATERIAL_TB LEFT JOIN M110 ON (M110.CUST_CD = ZTB_MATERIAL_TB.CUST_CD) ${condition}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkMaterialInfo":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` `;
          if (DATA.M_NAME !== "") {
            condition += ` WHERE M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          let setpdQuery = ` SELECT * FROM ZTB_MATERIAL_TB ${condition}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "update_material_table_from_bom":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` INSERT INTO ZTB_MATERIAL_TB  (CTR_CD,M_NAME) SELECT DISTINCT '002', ZTB_BOM2.M_NAME FROM ZTB_BOM2 WHERE (ZTB_BOM2.M_NAME not in (SELECT M_NAME FROM  ZTB_MATERIAL_TB) AND ZTB_BOM2.CATEGORY = 1)`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "update_material_info":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE ZTB_MATERIAL_TB SET CUST_CD ='${DATA.CUST_CD}', SSPRICE ='${DATA.SSPRICE}',CMSPRICE ='${DATA.CMSPRICE}',SLITTING_PRICE ='${DATA.SLITTING_PRICE}',MASTER_WIDTH ='${DATA.MASTER_WIDTH}',ROLL_LENGTH ='${DATA.ROLL_LENGTH}' WHERE M_ID=${DATA.M_ID}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "load_kehoachchithi":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
                    SELECT ZTB_KHCT_TABLE.KH_ID, ZTB_KHCT_TABLE.KH_FACTORY, ZTB_KHCT_TABLE.KH_DATE, ZTB_KHCT_TABLE.KH_EQ, ZTB_KHCT_TABLE.PROD_REQUEST_NO, ZTB_KHCT_TABLE.SELECTED_PLAN_ID, 
                    M100.G_CODE, 
                    M100.G_NAME, 
                    M100.G_NAME_KD, 
                    P400.PROD_REQUEST_DATE, 
                    P400.PROD_REQUEST_QTY, 
                    isnull(BB.CD1, 0) AS CD1, 
                    isnull(BB.CD2, 0) AS CD2, 
                    CASE WHEN (
                        M100.EQ1 <> 'FR' 
                        AND M100.EQ1 <> 'SR' 
                        AND M100.EQ1 <> 'DC' 
                        AND M100.EQ1 <> 'ED'
                    ) THEN 0 ELSE P400.PROD_REQUEST_QTY - isnull(BB.CD1, 0) END AS TON_CD1, 
                    CASE WHEN (
                        M100.EQ2 <> 'FR' 
                        AND M100.EQ2 <> 'SR' 
                        AND M100.EQ2 <> 'DC' 
                        AND M100.EQ2 <> 'ED'
                    ) THEN 0 ELSE P400.PROD_REQUEST_QTY - isnull(BB.CD2, 0) END AS TON_CD2, 
                    M100.FACTORY, 
                    M100.EQ1, 
                    M100.EQ2, 
                    M100.Setting1, 
                    M100.Setting2, 
                    M100.UPH1, 
                    M100.UPH2, 
                    M100.Step1, 
                    M100.Step2, 
                    M100.LOSS_SX1, 
                    M100.LOSS_SX2, 
                    M100.LOSS_SETTING1, 
                    M100.LOSS_SETTING2, 
                    M100.NOTE,
                        ZTB_QLSXPLAN.XUATDAOFILM, 
                    ZTB_QLSXPLAN.EQ_STATUS, 
                    ZTB_QLSXPLAN.MAIN_MATERIAL, 
                    ZTB_QLSXPLAN.INT_TEM, 
                    ZTB_QLSXPLAN.CHOTBC, 
                    ZTB_QLSXPLAN.DKXL, 
                    ZTB_QLSXPLAN.NEXT_PLAN_ID, 
                    ZTB_QLSXPLAN.KQ_SX_TAM, 
                    ZTB_QLSXPLAN.KETQUASX, 
                    ZTB_QLSXPLAN.PROCESS_NUMBER, 
                    ZTB_QLSXPLAN.PLAN_ORDER, 
                    ZTB_QLSXPLAN.STEP, 
                    ZTB_QLSXPLAN.PLAN_ID, 
                    ZTB_QLSXPLAN.PLAN_DATE, 
                    ZTB_QLSXPLAN.PLAN_QTY, 
                    ZTB_QLSXPLAN.PLAN_EQ, 
                    ZTB_QLSXPLAN.PLAN_FACTORY
                    FROM ZTB_KHCT_TABLE
                    LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_KHCT_TABLE.SELECTED_PLAN_ID)
                    LEFT JOIN P400 ON (
                        P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO
                    ) 
                    LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE) 
                    LEFT JOIN (
                        SELECT 
                        PVTB.PROD_REQUEST_NO, 
                        PVTB.[1] AS CD1, 
                        PVTB.[2] AS CD2 
                        FROM 
                        (
                            SELECT 
                            PROD_REQUEST_NO, 
                            PROCESS_NUMBER, 
                            SUM(KETQUASX) AS KETQUASX 
                            FROM 
                            ZTB_QLSXPLAN 
                            WHERE 
                            STEP = 0 
                            GROUP BY 
                            PROD_REQUEST_NO, 
                            PROCESS_NUMBER
                        ) AS PV PIVOT (
                            SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1], [2])
                        ) AS PVTB
                    ) AS BB ON (
                        BB.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO
        )`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "check_2_m_code_in_kho_ao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT PLAN_ID_INPUT, COUNT(DISTINCT M_CODE) AS COUNT_M_CODE FROM IN_KHO_SX WHERE PLAN_ID_INPUT= '${DATA.PLAN_ID_INPUT}' GROUP BY PLAN_ID_INPUT `;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "check_m_lot_exist_p500":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT TOP 1 * FROM P500 WHERE M_LOT_NO='${DATA.M_LOT_NO}' AND PLAN_ID ='${DATA.PLAN_ID_INPUT}'`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "an_lieu_kho_ao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE  IN_KHO_SX SET USE_YN='Z' WHERE IN_KHO_ID = ${DATA.IN_KHO_ID}`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "delete_in_kho_ao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` DELETE FROM IN_KHO_SX WHERE IN_KHO_ID = ${DATA.IN_KHO_ID}`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "delete_out_kho_ao":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` DELETE FROM OUT_KHO_SX WHERE PLAN_ID_INPUT = '${DATA.PLAN_ID_INPUT}' AND M_LOT_NO='${DATA.M_LOT_NO}'`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "tracsconfirm":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` 
                    SELECT CONCAT(datepart(YEAR,CS_CONFIRM_TABLE.CONFIRM_DATE),'_',datepart(ISO_WEEK,DATEADD(day,1,CS_CONFIRM_TABLE.CONFIRM_DATE))) AS YEAR_WEEK,CS_CONFIRM_TABLE.CONFIRM_ID,CS_CONFIRM_TABLE.CONFIRM_DATE,CS_CONFIRM_TABLE.CONTACT_ID,CS_CONFIRM_TABLE.CS_EMPL_NO,M010.EMPL_NAME,CS_CONFIRM_TABLE.G_CODE,M100.G_NAME,M100.G_NAME_KD,CS_CONFIRM_TABLE.PROD_REQUEST_NO,CS_CONFIRM_TABLE.CUST_CD,M110.CUST_NAME_KD,CS_CONFIRM_TABLE.CONTENT,CS_CONFIRM_TABLE.INSPECT_QTY,CS_CONFIRM_TABLE.NG_QTY,CS_CONFIRM_TABLE.REPLACE_RATE,CS_CONFIRM_TABLE.REDUCE_QTY,CS_CONFIRM_TABLE.FACTOR,CS_CONFIRM_TABLE.RESULT,CS_CONFIRM_TABLE.CONFIRM_STATUS,CS_CONFIRM_TABLE.REMARK,CS_CONFIRM_TABLE.INS_DATETIME,CS_CONFIRM_TABLE.PHANLOAI,CS_CONFIRM_TABLE.LINK,M100.PROD_TYPE,M100.PROD_MODEL,M100.PROD_PROJECT,M100.PROD_LAST_PRICE
                    FROM CS_CONFIRM_TABLE
                    LEFT JOIN M010 ON (M010.EMPL_NO = CS_CONFIRM_TABLE.CS_EMPL_NO)
                    LEFT JOIN M100 ON (M100.G_CODE = CS_CONFIRM_TABLE.G_CODE)
                    LEFT JOIN M110 ON (M110.CUST_CD = CS_CONFIRM_TABLE.CUST_CD) 
                    ORDER BY CONFIRM_DATE DESC`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          res.send(checkkq);
        })();
        break;
      case "checkPLAN_ID":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_QLSXPLAN.XUATDAOFILM, ZTB_QLSXPLAN.EQ_STATUS, ZTB_QLSXPLAN.MAIN_MATERIAL, ZTB_QLSXPLAN.INT_TEM, ZTB_QLSXPLAN.CHOTBC, ZTB_QLSXPLAN.DKXL,ZTB_QLSXPLAN.NEXT_PLAN_ID, ZTB_QLSXPLAN.KQ_SX_TAM, ZTB_QLSXPLAN.KETQUASX, ZTB_QLSXPLAN.PROCESS_NUMBER, ZTB_QLSXPLAN.PLAN_ORDER, ZTB_QLSXPLAN.STEP, ZTB_QLSXPLAN.PLAN_ID,ZTB_QLSXPLAN.PLAN_DATE,ZTB_QLSXPLAN.PROD_REQUEST_NO,ZTB_QLSXPLAN.PLAN_QTY,ZTB_QLSXPLAN.PLAN_EQ,ZTB_QLSXPLAN.PLAN_FACTORY,ZTB_QLSXPLAN.PLAN_LEADTIME,ZTB_QLSXPLAN.INS_EMPL,ZTB_QLSXPLAN.INS_DATE,ZTB_QLSXPLAN.UPD_EMPL,ZTB_QLSXPLAN.UPD_DATE, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PROD_REQUEST_QTY, isnull(BB.CD1,0) AS CD1 ,isnull(BB.CD2,0) AS CD2, CASE WHEN (M100.EQ1 <> 'FR' AND M100.EQ1 <> 'SR' AND  M100.EQ1 <> 'DC' AND M100.EQ1 <> 'ED') THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD1,0) END AS TON_CD1,CASE WHEN (M100.EQ2 <> 'FR' AND M100.EQ2 <> 'SR' AND  M100.EQ2 <> 'DC' AND M100.EQ2 <> 'ED') THEN 0 ELSE P400.PROD_REQUEST_QTY-isnull(BB.CD2,0) END AS TON_CD2, M100.FACTORY, M100.EQ1, M100.EQ2, M100.Setting1, M100.Setting2, M100.UPH1, M100.UPH2, M100.Step1, M100.Step2, M100.LOSS_SX1, M100.LOSS_SX2, M100.LOSS_SETTING1, M100.LOSS_SETTING2, M100.NOTE
                    FROM ZTB_QLSXPLAN JOIN P400 ON (P400.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO) JOIN M100 ON (P400.G_CODE = M100.G_CODE)
                    LEFT JOIN 
                    (
                    SELECT PVTB.PROD_REQUEST_NO, PVTB.[1] AS CD1, PVTB.[2] AS CD2 FROM 
                    (
                    SELECT PROD_REQUEST_NO, PROCESS_NUMBER, SUM(KETQUASX) AS KETQUASX FROM ZTB_QLSXPLAN WHERE STEP =0 GROUP BY PROD_REQUEST_NO, PROCESS_NUMBER
                    )
                    AS PV
                    PIVOT
                    ( 
                    SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2])
                    ) 
                    AS PVTB
                    ) AS BB ON (BB.PROD_REQUEST_NO = ZTB_QLSXPLAN.PROD_REQUEST_NO) 
                    WHERE ZTB_QLSXPLAN.PLAN_ID='${DATA.PLAN_ID}'`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "check_xuat_kho_ao_mobile":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  OUT_KHO_SX.OUT_KHO_ID,  OUT_KHO_SX.FACTORY, OUT_KHO_SX.PHANLOAI, OUT_KHO_SX.M_CODE, M090.M_NAME, M090.WIDTH_CD, OUT_KHO_SX.M_LOT_NO, OUT_KHO_SX.PLAN_ID_INPUT,OUT_KHO_SX.PLAN_ID_OUTPUT, OUT_KHO_SX.ROLL_QTY, OUT_KHO_SX.OUT_QTY, OUT_KHO_SX.TOTAL_OUT_QTY, OUT_KHO_SX.INS_DATE FROM OUT_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = OUT_KHO_SX.M_CODE) WHERE OUT_KHO_SX.PLAN_ID_OUTPUT='${DATA.PLAN_ID}' AND OUT_KHO_SX.M_LOT_NO='${DATA.M_LOT_NO}'`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkEMPL_NO_mobile":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTBEMPLINFO WHERE EMPL_NO='${DATA.EMPL_NO}'`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkM_LOT_NO_p500_mobile":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM P500 WHERE PLAN_ID='${DATA.PLAN_ID}' AND M_LOT_NO='${DATA.M_LOT_NO}'`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_p500_mobile":
        (async () => {
          //console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO P500 (CTR_CD, PROCESS_IN_DATE, PROCESS_IN_NO, PROCESS_IN_SEQ, M_LOT_IN_SEQ, PROD_REQUEST_DATE, PROD_REQUEST_NO, G_CODE, M_CODE, M_LOT_NO, EMPL_NO, EQUIPMENT_CD, SCAN_RESULT, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL, FACTORY, PLAN_ID, INPUT_QTY, IN_KHO_ID) VALUES ('002','${
            DATA.in_date
          }','${DATA.next_process_in_no}','${DATA.PROD_REQUEST_NO.substring(
            4,
            7
          )}','${DATA.PROD_REQUEST_DATE.substring(5, 8)}','${
            DATA.PROD_REQUEST_DATE
          }','${DATA.PROD_REQUEST_NO}','${DATA.G_CODE}', '${DATA.M_CODE}','${
            DATA.M_LOT_NO
          }','${DATA.EMPL_NO}','${DATA.phanloai}','OK',GETDATE(),'${
            DATA.EMPL_NO
          }',GETDATE(),'${DATA.EMPL_NO}','NM1','${DATA.PLAN_ID}', '${
            DATA.INPUT_QTY
          }','${DATA.IN_KHO_ID}')`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
          //res.send({tk_status:'OK',data:req.payload_data});
        })();
        break;
      case "checkOutKhoSX_mobile":
        (async () => {
          //console.log(DATA);
          let checkkq = "OK";
          let setpdQuery = `SELECT OUT_KHO_SX.TOTAL_OUT_QTY, OUT_KHO_SX.PLAN_ID_INPUT, IN_KHO_SX.IN_KHO_ID  FROM OUT_KHO_SX LEFT JOIN IN_KHO_SX ON  (IN_KHO_SX.PLAN_ID_INPUT = OUT_KHO_SX.PLAN_ID_INPUT AND IN_KHO_SX.M_CODE = OUT_KHO_SX.M_CODE AND IN_KHO_SX.M_LOT_NO = OUT_KHO_SX.M_LOT_NO AND IN_KHO_SX.TOTAL_IN_QTY = OUT_KHO_SX.TOTAL_OUT_QTY)  WHERE PLAN_ID_OUTPUT='${DATA.PLAN_ID_OUTPUT}' AND OUT_KHO_SX.M_CODE='${DATA.M_CODE}' AND OUT_KHO_SX.M_LOT_NO='${DATA.M_LOT_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
          //res.send({tk_status:'OK',data:req.payload_data});
        })();
        break;
      case "setUSE_YN_KHO_AO_INPUT_mobile":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE IN_KHO_SX SET PLAN_ID_SUDUNG='${DATA.PLAN_ID_SUDUNG}', REMARK='X_MB', USE_YN ='${DATA.USE_YN}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE PLAN_ID_INPUT= '${DATA.PLAN_ID_INPUT}' AND M_CODE='${DATA.M_CODE}' AND M_LOT_NO='${DATA.M_LOT_NO}' AND TOTAL_IN_QTY=${DATA.TOTAL_IN_QTY}`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "setUSE_YN_KHO_AO_OUTPUT_mobile":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE OUT_KHO_SX SET REMARK='X_MB', USE_YN ='${DATA.USE_YN}', UPD_DATE=GETDATE(), UPD_EMPL='${EMPL_NO}' WHERE PLAN_ID_OUTPUT= '${DATA.PLAN_ID_OUTPUT}' AND M_CODE='${DATA.M_CODE}' AND M_LOT_NO='${DATA.M_LOT_NO}' AND TOTAL_OUT_QTY=${DATA.TOTAL_OUT_QTY}`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkP500PlanID_mobile":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT P500.PLAN_ID, M090.M_NAME, M090.WIDTH_CD,P500.M_CODE, P500.M_LOT_NO, isnull(OUT_KHO_SX.TOTAL_OUT_QTY,0) AS  TOTAL_OUT_QTY, isnull(P500.REMAIN_QTY,0) AS REMAIN_QTY, P500.EQUIPMENT_CD, P500.INS_DATE FROM P500 LEFT JOIN M090 ON (M090.M_CODE = P500.M_CODE) LEFT JOIN OUT_KHO_SX ON (OUT_KHO_SX.PLAN_ID_OUTPUT = P500.PLAN_ID AND OUT_KHO_SX.M_LOT_NO = P500.M_LOT_NO AND OUT_KHO_SX.M_CODE = P500.M_CODE) 
                    WHERE P500.PLAN_ID='${DATA.PLAN_ID}'
                    ORDER BY P500.INS_DATE DESC`;
          //${moment().format('YYYY-MM-DD')}
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "materialLotStatus":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = `  WHERE O302.PLAN_ID is not null AND O302.LIEUQL_SX = 1`;
          if (DATA.ALLTIME === false) {
            condition += ` AND O302.INS_DATE BETWEEN ''${DATA.FROM_DATE}'' AND ''${DATA.TO_DATE} 23:59:59'' `;
          }
          if (DATA.PROD_REQUEST_NO !== "") {
            condition += ` AND ZTB_QLSXPLAN.PROD_REQUEST_NO= '${DATA.PROD_REQUEST_NO}'`;
          }
          if (DATA.PLAN_ID !== "") {
            condition += ` AND O302.PLAN_ID = '${DATA.PLAN_ID}'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND O302.M_CODE ='${DATA.M_CODE}'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND O302.FACTORY = '${DATA.FACTORY}'`;
          }
          if (DATA.PLAN_EQ !== "ALL") {
            condition += ` AND SUBSTRING(ZTB_QLSXPLAN.PLAN_EQ,1,2) = '${DATA.PLAN_EQ}'`;
          }
          let setpdQuery = `
          DECLARE @eq_string varchar(max) = '';
          DECLARE @eq_temp_string varchar(max) = '';
          DECLARE @vao_eq varchar(max) = '';
          DECLARE @temp_qty varchar(max) = '';
          DECLARE @temp_met varchar(max) = '';
          DECLARE @tempTable TABLE (ResultValue nvarchar(max)) DECLARE @i INT = 0;
          DECLARE @eq_series varchar(2)
          INSERT INTO
            @tempTable
          SELECT
            DISTINCT SUBSTRING(EQ_NAME, 1, 2) AS EQ_SERIES
          FROM
            ZTB_SX_EQ_STATUS DECLARE ghepcursor CURSOR FOR (
              SELECT
                *
              FROM
                @tempTable
            ) OPEN ghepcursor;
          FETCH NEXT
          FROM
            ghepcursor INTO @eq_series;
          WHILE @@FETCH_STATUS = 0 BEGIN
          SET
            @eq_temp_string = @eq_temp_string + 'isnull([' + @eq_series + '],0) AS ' + @eq_series + '_EA, '
          SET
            @eq_string = @eq_string + '[' + @eq_series + '],'
          SET
            @vao_eq = @vao_eq + 'CASE WHEN P500_EQ.' + @eq_series + ' is not null THEN ''Y'' ELSE ''N'' END AS VAO_' + @eq_series + ', '
          SET
            @temp_qty = @temp_qty + 'P501_QTY.' + @eq_series + '_EA, '
          SET
            @temp_met = @temp_met + 'P501_QTY.' + @eq_series + '_EA * M100.PD/(M100.G_C * M100.G_C_R)/1000 AS ' + @eq_series + '_RESULT, ' FETCH NEXT
          FROM
            ghepcursor INTO @eq_series;
          END CLOSE ghepcursor;
          DEALLOCATE ghepcursor;
          SET
            @temp_met = SUBSTRING(@temp_met, 1, LEN(@temp_met) -1)
          SET
            @temp_qty = SUBSTRING(@temp_qty, 1, LEN(@temp_qty) -1)
          SET
            @vao_eq = SUBSTRING(@vao_eq, 1, LEN(@vao_eq) -1)
          SET
            @eq_string = SUBSTRING(@eq_string, 1, LEN(@eq_string) -1)
          SET
            @eq_temp_string = SUBSTRING(@eq_temp_string, 1, LEN(@eq_temp_string) -1) PRINT(@eq_string) PRINT(@eq_temp_string) PRINT(@vao_eq) PRINT(@temp_qty) PRINT(@temp_met) DECLARE @query varchar(max) DECLARE @query2 varchar(max)
          SELECT
            @query = 'SELECT PVTB.M_LOT_NO, ' + @eq_string + ' FROM 
          (
          SELECT DISTINCT M_LOT_NO, SUBSTRING(EQUIPMENT_CD,1,2) AS EQ_SERIES FROM P500 
          JOIN (SELECT DISTINCT SUBSTRING(EQ_NAME,1,2) AS EQ_SERIES from ZTB_SX_EQ_STATUS) AS EQ_TABLE ON (EQ_TABLE.EQ_SERIES =  SUBSTRING(P500.EQUIPMENT_CD,1,2)) WHERE P500.PLAN_ID is not null
          ) AS BANGNGUON
          PIVOT
          (
            MIN(BANGNGUON.EQ_SERIES)
            FOR BANGNGUON.EQ_SERIES IN (' + @eq_string + ')
          ) AS PVTB
          SELECT PVTB.M_LOT_NO, ' + @eq_temp_string + '  FROM 
          (
          SELECT  P501.M_LOT_NO, SUBSTRING(P500.EQUIPMENT_CD,1,2) AS EQ_SERIES,SUM(isnull(P501.TEMP_QTY,0)) AS TEMP_QTY FROM P501 LEFT JOIN P500 ON (P500.PROCESS_IN_DATE = P501.PROCESS_IN_DATE AND P500.PROCESS_IN_NO = P501.PROCESS_IN_NO AND P500.PROCESS_IN_SEQ = P501.PROCESS_IN_SEQ) 
          WHERE P501.PLAN_ID is not null
          GROUP BY  P501.M_LOT_NO, SUBSTRING(P500.EQUIPMENT_CD,1,2)
          ) AS BANGNGUON
          PIVOT
          (
            SUM(BANGNGUON.TEMP_QTY)
            FOR BANGNGUON.EQ_SERIES IN (' + @eq_string + ')
          ) AS PVTB
          '
          SELECT
            @query2 = '
          SELECT O302.INS_DATE, O302.M_LOT_NO, O302.M_CODE, M090.M_NAME, M090.WIDTH_CD, CASE WHEN O302.M_LOT_NO is not null THEN ''Y'' ELSE ''N'' END AS XUAT_KHO, 
                              ' + @vao_eq + ', 
                              CASE WHEN RETURN_LIEU.M_LOT_NO is not null AND  GIAONHAN.M_LOT_NO is not null THEN ''R''  WHEN RETURN_LIEU.M_LOT_NO is  null AND  GIAONHAN.M_LOT_NO is not null THEN ''Y''  ELSE ''N'' END AS CONFIRM_GIAONHAN,
                              CASE WHEN ZTBINSPECTINPUTTB_A.M_LOT_NO is not null THEN ''Y'' ELSE ''N'' END AS VAO_KIEM,
                              CASE WHEN NHATKY.M_LOT_NO is not null THEN ''Y'' ELSE ''N'' END AS NHATKY_KT, 
                              CASE WHEN ZTBINSPECTOUTPUTTB_A.M_LOT_NO is not null THEN ''Y'' ELSE ''N'' END AS RA_KIEM,
                              O302.ROLL_QTY, O302.OUT_CFM_QTY, (O302.ROLL_QTY * O302.OUT_CFM_QTY) AS TOTAL_OUT_QTY, 
                              ' + @temp_met + ',
                              isnull(NHATKY.INSPECT_TOTAL_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS INSPECT_TOTAL_QTY, 
                              isnull(NHATKY.INSPECT_OK_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS INSPECT_OK_QTY,
                              isnull(ZTBINSPECTOUTPUTTB_A.INS_OUTPUT_EA,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS INS_OUT, 
                              M100.PD, M100.G_C * M100.G_C_R AS CAVITY, 
                              (O302.ROLL_QTY * O302.OUT_CFM_QTY)/ M100.PD * (M100.G_C * M100.G_C_R)*1000 AS TOTAL_OUT_EA,
                              ' + @temp_qty + ',
                    isnull(NHATKY.INSPECT_TOTAL_QTY,0) AS INSPECT_TOTAL_EA, 
                    isnull(NHATKY.INSPECT_OK_QTY,0) AS INSPECT_OK_EA, 
                    isnull(ZTBINSPECTOUTPUTTB_A.INS_OUTPUT_EA,0) AS INS_OUTPUT_EA,
                              1-isnull(NHATKY.INSPECT_OK_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 /(O302.ROLL_QTY * O302.OUT_CFM_QTY) AS ROLL_LOSS_KT,
                              1-isnull(ZTBINSPECTOUTPUTTB_A.INS_OUTPUT_EA,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 /(O302.ROLL_QTY * O302.OUT_CFM_QTY) AS ROLL_LOSS, M100.EQ1, M100.EQ2, M100.EQ3, M100.EQ4,
                    ZTB_QLSXPLAN.PROD_REQUEST_NO, O302.PLAN_ID,ZTB_QLSXPLAN.PLAN_EQ, M100.G_CODE, M100.G_NAME, O302.FACTORY           
                               FROM O302 
                              LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM IN_KHO_SX WHERE PHANLOAI=''N'') AS IN_KHO_SX_A ON (IN_KHO_SX_A.M_LOT_NO = O302.M_LOT_NO)
                              LEFT JOIN (
                    SELECT PVTB.M_LOT_NO, ' + @eq_string + ' FROM 
                      (
                      SELECT DISTINCT M_LOT_NO, SUBSTRING(EQUIPMENT_CD,1,2) AS EQ_SERIES FROM P500 
                      JOIN (SELECT DISTINCT SUBSTRING(EQ_NAME,1,2) AS EQ_SERIES from ZTB_SX_EQ_STATUS) AS EQ_TABLE ON (EQ_TABLE.EQ_SERIES =  SUBSTRING(P500.EQUIPMENT_CD,1,2)) WHERE P500.PLAN_ID is not null
                      ) AS BANGNGUON
                      PIVOT
                      (
                        MIN(BANGNGUON.EQ_SERIES)
                        FOR BANGNGUON.EQ_SERIES IN (' + @eq_string + ')
                      ) AS PVTB
                    ) AS P500_EQ ON (P500_EQ.M_LOT_NO = O302.M_LOT_NO)
                              LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM ZTB_GIAONHAN_M_LOT WHERE CONFIRM=''OK'' AND PHANLOAI=''N'' ) AS GIAONHAN ON (O302.M_LOT_NO = GIAONHAN.M_LOT_NO)
                              LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM ZTB_GIAONHAN_M_LOT WHERE CONFIRM=''OK'' AND PHANLOAI=''R'' ) AS RETURN_LIEU ON (O302.M_LOT_NO = RETURN_LIEU.M_LOT_NO)
                              LEFT JOIN (SELECT DISTINCT P501.M_LOT_NO FROM ZTBINSPECTINPUTTB LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = ZTBINSPECTINPUTTB.PROCESS_LOT_NO) WHERE ZTBINSPECTINPUTTB.PLAN_ID is not null) AS ZTBINSPECTINPUTTB_A ON (O302.M_LOT_NO = ZTBINSPECTINPUTTB_A.M_LOT_NO)
                              LEFT JOIN (SELECT  P501.M_LOT_NO, SUM(ZTBINSPECTNGTB.INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(ZTBINSPECTNGTB.INSPECT_OK_QTY) AS INSPECT_OK_QTY  FROM ZTBINSPECTNGTB LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = ZTBINSPECTNGTB.PROCESS_LOT_NO) WHERE ZTBINSPECTNGTB.PLAN_ID is not null GROUP BY P501.M_LOT_NO) AS NHATKY ON(NHATKY.M_LOT_NO = O302.M_LOT_NO)
                              LEFT JOIN (SELECT  P501.M_LOT_NO, SUM(ZTBINSPECTOUTPUTTB.OUTPUT_QTY_EA) AS INS_OUTPUT_EA FROM ZTBINSPECTOUTPUTTB LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = ZTBINSPECTOUTPUTTB.PROCESS_LOT_NO) WHERE ZTBINSPECTOUTPUTTB.PLAN_ID is not null GROUP BY P501.M_LOT_NO) AS ZTBINSPECTOUTPUTTB_A ON (O302.M_LOT_NO = ZTBINSPECTOUTPUTTB_A.M_LOT_NO)
                              LEFT JOIN 
                    (
                      SELECT PVTB.M_LOT_NO, ' + @eq_temp_string + '  FROM 
                      (
                      SELECT  P501.M_LOT_NO, SUBSTRING(P500.EQUIPMENT_CD,1,2) AS EQ_SERIES,SUM(isnull(P501.TEMP_QTY,0)) AS TEMP_QTY FROM P501 LEFT JOIN P500 ON (P500.PROCESS_IN_DATE = P501.PROCESS_IN_DATE AND P500.PROCESS_IN_NO = P501.PROCESS_IN_NO AND P500.PROCESS_IN_SEQ = P501.PROCESS_IN_SEQ) 
                      WHERE P501.PLAN_ID is not null
                      GROUP BY  P501.M_LOT_NO, SUBSTRING(P500.EQUIPMENT_CD,1,2)
                      ) AS BANGNGUON
                      PIVOT
                      (
                        SUM(BANGNGUON.TEMP_QTY)
                        FOR BANGNGUON.EQ_SERIES IN (' + @eq_string + ')
                      ) AS PVTB
                    ) AS P501_QTY ON (P501_QTY.M_LOT_NO = O302.M_LOT_NO)
                              LEFT JOIN M090 ON (M090.M_CODE= O302.M_CODE)
                              LEFT JOIN ZTB_QLSXPLAN ON (O302.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
                              LEFT JOIN M100 ON (ZTB_QLSXPLAN.G_CODE = M100.G_CODE)
                              ${condition}
                              ORDER BY O302.INS_DATE DESC '
            EXECUTE(@query2)
                   
                    `;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "materialLotStatus1":
        (async () => {
          ////console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = `  WHERE O302.PLAN_ID is not null AND O302.LIEUQL_SX = 1`;
          if (DATA.ALLTIME === false) {
            condition += ` AND O302.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE} 23:59:59' `;
          }
          if (DATA.PROD_REQUEST_NO !== "") {
            condition += ` AND ZTB_QLSXPLAN.PROD_REQUEST_NO= '${DATA.PROD_REQUEST_NO}'`;
          }
          if (DATA.PLAN_ID !== "") {
            condition += ` AND O302.PLAN_ID = '${DATA.PLAN_ID}'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND O302.M_CODE ='${DATA.M_CODE}'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND M100.G_CODE = '${DATA.G_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND O302.FACTORY = '${DATA.FACTORY}'`;
          }
          if (DATA.PLAN_EQ !== "ALL") {
            condition += ` AND SUBSTRING(ZTB_QLSXPLAN.PLAN_EQ,1,2) = '${DATA.PLAN_EQ}'`;
          }
          let setpdQuery = `
                    SELECT O302.INS_DATE, O302.M_LOT_NO, O302.M_CODE, M090.M_NAME, M090.WIDTH_CD, M100.EQ1, M100.EQ2, CASE WHEN O302.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS XUAT_KHO, 
                    CASE WHEN P500_FR.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS VAO_FR, 
                    CASE WHEN P500_SR.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS VAO_SR, 
                    CASE WHEN P500_DC.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS VAO_DC, 
                    CASE WHEN P500_ED.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS VAO_ED, 
                    CASE WHEN RETURN_LIEU.M_LOT_NO is not null AND  GIAONHAN.M_LOT_NO is not null THEN 'R'  WHEN RETURN_LIEU.M_LOT_NO is  null AND  GIAONHAN.M_LOT_NO is not null THEN 'Y'  ELSE 'N' END AS CONFIRM_GIAONHAN,
                    CASE WHEN ZTBINSPECTINPUTTB_A.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS VAO_KIEM,
                    CASE WHEN NHATKY.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS NHATKY_KT, 
                    CASE WHEN ZTBINSPECTOUTPUTTB_A.M_LOT_NO is not null THEN 'Y' ELSE 'N' END AS RA_KIEM,
                    O302.ROLL_QTY, O302.OUT_CFM_QTY, (O302.ROLL_QTY * O302.OUT_CFM_QTY) AS TOTAL_OUT_QTY, 
                    isnull(FR_QTY.TEMP_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS FR_RESULT,
                    isnull(SR_QTY.TEMP_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS SR_RESULT,
                    isnull(DC_QTY.TEMP_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS DC_RESULT,
                    isnull(ED_QTY.TEMP_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS ED_RESULT,
                    isnull(NHATKY.INSPECT_TOTAL_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS INSPECT_TOTAL_QTY, 
                    isnull(NHATKY.INSPECT_OK_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS INSPECT_OK_QTY,
                    isnull(ZTBINSPECTOUTPUTTB_A.INS_OUTPUT_EA,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 AS INS_OUT, 
                    M100.PD, M100.G_C * M100.G_C_R AS CAVITY, 
                    (O302.ROLL_QTY * O302.OUT_CFM_QTY)/ M100.PD * (M100.G_C * M100.G_C_R)*1000 AS TOTAL_OUT_EA,
                    isnull(FR_QTY.TEMP_QTY,0) AS FR_EA, isnull(SR_QTY.TEMP_QTY,0) AS SR_EA, isnull(DC_QTY.TEMP_QTY,0) AS DC_EA, isnull(ED_QTY.TEMP_QTY,0) AS ED_EA, isnull(NHATKY.INSPECT_TOTAL_QTY,0) AS INSPECT_TOTAL_EA, isnull(NHATKY.INSPECT_OK_QTY,0) AS INSPECT_OK_EA, isnull(ZTBINSPECTOUTPUTTB_A.INS_OUTPUT_EA,0) AS INS_OUTPUT_EA,
                    1-isnull(NHATKY.INSPECT_OK_QTY,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 /(O302.ROLL_QTY * O302.OUT_CFM_QTY) AS ROLL_LOSS_KT,
                    1-isnull(ZTBINSPECTOUTPUTTB_A.INS_OUTPUT_EA,0)* M100.PD/(M100.G_C * M100.G_C_R)/1000 /(O302.ROLL_QTY * O302.OUT_CFM_QTY) AS ROLL_LOSS,
        ZTB_QLSXPLAN.PROD_REQUEST_NO, O302.PLAN_ID,ZTB_QLSXPLAN.PLAN_EQ, M100.G_CODE, M100.G_NAME, O302.FACTORY           
                     FROM O302 
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM IN_KHO_SX WHERE PHANLOAI='N') AS IN_KHO_SX_A ON (IN_KHO_SX_A.M_LOT_NO = O302.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM P500 WHERE SUBSTRING(EQUIPMENT_CD,1,2)='FR' AND PLAN_ID is not null) AS P500_FR ON (O302.M_LOT_NO = P500_FR.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM P500 WHERE SUBSTRING(EQUIPMENT_CD,1,2)='SR' AND PLAN_ID is not null) AS P500_SR ON (O302.M_LOT_NO = P500_SR.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM P500 WHERE SUBSTRING(EQUIPMENT_CD,1,2)='DC' AND PLAN_ID is not null) AS P500_DC ON (O302.M_LOT_NO = P500_DC.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM P500 WHERE SUBSTRING(EQUIPMENT_CD,1,2)='ED' AND PLAN_ID is not null) AS P500_ED ON (O302.M_LOT_NO = P500_ED.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM ZTB_GIAONHAN_M_LOT WHERE CONFIRM='OK' AND PHANLOAI='N' ) AS GIAONHAN ON (O302.M_LOT_NO = GIAONHAN.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT M_LOT_NO FROM ZTB_GIAONHAN_M_LOT WHERE CONFIRM='OK' AND PHANLOAI='R' ) AS RETURN_LIEU ON (O302.M_LOT_NO = RETURN_LIEU.M_LOT_NO)
                    LEFT JOIN (SELECT DISTINCT P501.M_LOT_NO FROM ZTBINSPECTINPUTTB LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = ZTBINSPECTINPUTTB.PROCESS_LOT_NO) WHERE ZTBINSPECTINPUTTB.PLAN_ID is not null) AS ZTBINSPECTINPUTTB_A ON (O302.M_LOT_NO = ZTBINSPECTINPUTTB_A.M_LOT_NO)
                    LEFT JOIN (SELECT  P501.M_LOT_NO, SUM(ZTBINSPECTNGTB.INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(ZTBINSPECTNGTB.INSPECT_OK_QTY) AS INSPECT_OK_QTY  FROM ZTBINSPECTNGTB LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = ZTBINSPECTNGTB.PROCESS_LOT_NO) WHERE ZTBINSPECTNGTB.PLAN_ID is not null GROUP BY P501.M_LOT_NO) AS NHATKY ON(NHATKY.M_LOT_NO = O302.M_LOT_NO)
                    LEFT JOIN (SELECT  P501.M_LOT_NO, SUM(ZTBINSPECTOUTPUTTB.OUTPUT_QTY_EA) AS INS_OUTPUT_EA FROM ZTBINSPECTOUTPUTTB LEFT JOIN P501 ON (P501.PROCESS_LOT_NO = ZTBINSPECTOUTPUTTB.PROCESS_LOT_NO) WHERE ZTBINSPECTOUTPUTTB.PLAN_ID is not null GROUP BY P501.M_LOT_NO) AS ZTBINSPECTOUTPUTTB_A ON (O302.M_LOT_NO = ZTBINSPECTOUTPUTTB_A.M_LOT_NO)
                    LEFT JOIN (SELECT M_LOT_NO, SUM(isnull(TEMP_QTY,0)) AS TEMP_QTY FROM P501 WHERE PLAN_ID is not null  AND SUBSTRING(PROCESS_LOT_NO,2,1)='F' AND M_LOT_NO is not null GROUP BY M_LOT_NO) AS FR_QTY ON (FR_QTY.M_LOT_NO = O302.M_LOT_NO)
                    LEFT JOIN (SELECT M_LOT_NO, SUM(isnull(TEMP_QTY,0)) AS TEMP_QTY FROM P501 WHERE PLAN_ID is not null  AND SUBSTRING(PROCESS_LOT_NO,2,1)='S' AND M_LOT_NO is not null GROUP BY M_LOT_NO) AS SR_QTY ON (SR_QTY.M_LOT_NO = O302.M_LOT_NO)
                    LEFT JOIN (SELECT M_LOT_NO, SUM(isnull(TEMP_QTY,0)) AS TEMP_QTY FROM P501 WHERE PLAN_ID is not null  AND SUBSTRING(PROCESS_LOT_NO,2,1)='D' AND M_LOT_NO is not null GROUP BY M_LOT_NO) AS DC_QTY ON (DC_QTY.M_LOT_NO = O302.M_LOT_NO)
                    LEFT JOIN (SELECT M_LOT_NO, SUM(isnull(TEMP_QTY,0)) AS TEMP_QTY FROM P501 WHERE PLAN_ID is not null  AND SUBSTRING(PROCESS_LOT_NO,2,1)='E' AND M_LOT_NO is not null GROUP BY M_LOT_NO) AS ED_QTY ON (ED_QTY.M_LOT_NO = O302.M_LOT_NO)
                    LEFT JOIN M090 ON (M090.M_CODE= O302.M_CODE)
                    LEFT JOIN ZTB_QLSXPLAN ON (O302.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
                    LEFT JOIN M100 ON (ZTB_QLSXPLAN.G_CODE = M100.G_CODE)
                   ${condition}
                    ORDER BY O302.INS_DATE DESC `;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkSpecDTC":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE 1=1 `;
          if (DATA.checkNVL === false) {
            condition += ` AND ZTB_REL_SPECTTABLE.G_CODE='${DATA.G_CODE}' `;
          } else {
            condition += ` AND ZTB_REL_SPECTTABLE.M_CODE='${DATA.M_CODE}' `;
          }
          if (DATA.TEST_NAME !== "0") {
            condition += ` AND ZTB_REL_TESTPOINT.TEST_CODE = ${DATA.TEST_NAME} `;
          }
          let setpdQuery = `SELECT  M110.CUST_NAME_KD, M100.G_CODE, M100.G_NAME,  M090.M_CODE, M090.M_NAME, M090.WIDTH_CD, ZTB_REL_TESTTABLE.TEST_CODE,ZTB_REL_TESTTABLE.TEST_NAME,ZTB_REL_TESTPOINT.POINT_CODE, ZTB_REL_TESTPOINT.POINT_NAME, ZTB_REL_SPECTTABLE.PRI,ZTB_REL_SPECTTABLE.CENTER_VALUE, ZTB_REL_SPECTTABLE.LOWER_TOR, ZTB_REL_SPECTTABLE.UPPER_TOR, ZTB_REL_SPECTTABLE.BARCODE_CONTENT, ZTB_REL_SPECTTABLE.REMARK, M090.TDS, M100.BANVE FROM ZTB_REL_TESTPOINT LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_TESTPOINT.TEST_CODE) LEFT JOIN ZTB_REL_SPECTTABLE ON (ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_TESTPOINT.TEST_CODE AND ZTB_REL_SPECTTABLE.POINT_CODE = ZTB_REL_TESTPOINT.POINT_CODE) LEFT JOIN M100 ON (M100.G_CODE = ZTB_REL_SPECTTABLE.G_CODE) LEFT JOIN M090 ON (M090.M_CODE = ZTB_REL_SPECTTABLE.M_CODE) LEFT JOIN M110 ON (M110.CUST_CD = M100.CUST_CD) ${condition}`;
          //${moment().format('YYYY-MM-DD')}
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkSpecDTC2":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  ZTB_REL_TESTTABLE.TEST_CODE,ZTB_REL_TESTTABLE.TEST_NAME,ZTB_REL_TESTPOINT.POINT_CODE, ZTB_REL_TESTPOINT.POINT_NAME
                    FROM ZTB_REL_TESTPOINT 
                    LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_TESTPOINT.TEST_CODE)
                    WHERE ZTB_REL_TESTPOINT.TEST_CODE = ${DATA.TEST_NAME}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertSpecDTC":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_REL_SPECTTABLE (CTR_CD,G_CODE,TEST_CODE,POINT_CODE,PRI,CENTER_VALUE,UPPER_TOR,LOWER_TOR,BARCODE_CONTENT,REMARK,INS_EMPL_NO,INS_DATE,M_CODE) VALUES ('002','${DATA.G_CODE}', '${DATA.TEST_CODE}', '${DATA.POINT_CODE}', '${DATA.PRI}','${DATA.CENTER_VALUE}','${DATA.UPPER_TOR}','${DATA.LOWER_TOR}','${DATA.BARCODE_CONTENT}','${DATA.REMARK}','${EMPL_NO}',GETDATE(),'${DATA.M_CODE}')`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateSpecDTC":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_REL_SPECTTABLE SET  PRI= '${DATA.PRI}', CENTER_VALUE ='${DATA.CENTER_VALUE}',UPPER_TOR = '${DATA.UPPER_TOR}', LOWER_TOR= '${DATA.LOWER_TOR}', BARCODE_CONTENT= '${DATA.BARCODE_CONTENT}',REMARK = N'${DATA.REMARK}',UPD_EMPL_NO='${EMPL_NO}', UPD_DATE= GETDATE(),M_CODE='${DATA.M_CODE}' WHERE G_CODE= '${DATA.G_CODE}' AND M_CODE='${DATA.M_CODE}' AND TEST_CODE=${DATA.TEST_CODE} AND POINT_CODE=${DATA.POINT_CODE}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkAddedSpec":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_REL_TESTTABLE.TEST_CODE, ZTB_REL_TESTTABLE.TEST_NAME, AA.TEST_CODE AS CHECKADDED FROM ZTB_REL_TESTTABLE LEFT JOIN (SELECT DISTINCT TEST_CODE FROM ZTB_REL_SPECTTABLE WHERE M_CODE='${DATA.M_CODE}' AND G_CODE='${DATA.G_CODE}') AS AA ON (AA.TEST_CODE = ZTB_REL_TESTTABLE.TEST_CODE)`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkRegisterdDTCTEST":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_REL_TESTTABLE.TEST_CODE, ZTB_REL_TESTTABLE.TEST_NAME, AA.TEST_CODE AS CHECKADDED FROM ZTB_REL_TESTTABLE LEFT JOIN (SELECT DISTINCT TEST_CODE FROM ZTB_REL_REQUESTTABLE WHERE DTC_ID=${DATA.DTC_ID}) AS AA ON (AA.TEST_CODE = ZTB_REL_TESTTABLE.TEST_CODE)`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getLastDTCID":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT MAX(DTC_ID) AS LAST_DCT_ID FROM ZTB_REL_REQUESTTABLE`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadrecentRegisteredDTCData":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  TOP 200 ZTB_REL_REQUESTTABLE.DTC_ID, (CASE ZTBEMPLINFO.FACTORY_CODE WHEN 1 THEN 'NM1' WHEN 2 THEN 'NM2' END) AS FACTORY , ZTB_REL_REQUESTTABLE.TEST_FINISH_TIME, ZTB_REL_REQUESTTABLE.TEST_EMPL_NO, ZTB_REL_REQUESTTABLE.G_CODE, ZTB_REL_REQUESTTABLE.PROD_REQUEST_NO, M100.G_NAME, ZTB_REL_TESTTABLE.TEST_NAME,  ZTB_REL_TESTTYPE.TEST_TYPE_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME , ZTB_REL_REQUESTTABLE.REQUEST_DATETIME , ZTB_REL_REQUESTTABLE.REQUEST_EMPL_NO ,M090.M_NAME , M090.WIDTH_CD AS SIZE, ZTB_REL_REQUESTTABLE.REMARK, NHAP_NVL.LOTCMS FROM 
                    ZTB_REL_REQUESTTABLE
                   LEFT JOIN M100 ON(M100.G_CODE = ZTB_REL_REQUESTTABLE.G_CODE) 
                   LEFT JOIN M090 ON (M090.M_CODE = ZTB_REL_REQUESTTABLE.M_CODE)
                   LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_REQUESTTABLE.TEST_CODE) 
                   LEFT JOIN ZTB_REL_TESTTYPE ON (ZTB_REL_TESTTYPE.TEST_TYPE_CODE = ZTB_REL_REQUESTTABLE.TEST_TYPE_CODE) 
                   LEFT JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTB_REL_REQUESTTABLE.REQUEST_EMPL_NO) 
                   LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) 
                   LEFT JOIN NHAP_NVL ON(NHAP_NVL.LOTNCC = ZTB_REL_REQUESTTABLE.REMARK AND NHAP_NVL.SIZE = M090.WIDTH_CD) 
                   ORDER BY ZTB_REL_REQUESTTABLE.DTC_ID DESC, ZTB_REL_TESTTABLE.TEST_NAME DESC`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkLabelID2":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTBLOTPRINTHISTORYTB.LABEL_ID2, ZTBLOTPRINTHISTORYTB.G_CODE, M100.G_NAME, P400.PROD_REQUEST_NO,P400.PROD_REQUEST_DATE FROM ZTBLOTPRINTHISTORYTB LEFT JOIN P400 ON  (P400.PROD_REQUEST_NO = ZTBLOTPRINTHISTORYTB.PROD_REQUEST_NO) LEFT JOIN  M100 ON (M100.G_CODE = ZTBLOTPRINTHISTORYTB.G_CODE) WHERE LABEL_ID2='${DATA.LABEL_ID2}' `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "registerDTCTest":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` INSERT INTO ZTB_REL_REQUESTTABLE (CTR_CD,DTC_ID,TEST_CODE,TEST_TYPE_CODE,REQUEST_DEPT_CODE,PROD_REQUEST_NO,PROD_REQUEST_DATE,REQUEST_EMPL_NO,REQUEST_DATETIME,REMARK,G_CODE,M_CODE,M_LOT_NO) VALUES ('002',${DATA.DTC_ID}, ${DATA.TEST_CODE},  ${DATA.TEST_TYPE_CODE},  ${DATA.REQUEST_DEPT_CODE}, '${DATA.PROD_REQUEST_NO}', '${DATA.PROD_REQUEST_DATE}', '${DATA.REQUEST_EMPL_NO}',GETDATE(),'${DATA.REMARK}','${DATA.G_CODE}','${DATA.M_CODE}','${DATA.M_LOT_NO}')`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insert_dtc_result":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` INSERT INTO ZTB_REL_RESULT (CTR_CD,DTC_ID,G_CODE,TEST_CODE,POINT_CODE,SAMPLE_NO,RESULT,REMARK,M_CODE) VALUES ('002',${DATA.DTC_ID}, '${DATA.G_CODE}',${DATA.TEST_CODE},${DATA.POINT_CODE}, ${DATA.SAMPLE_NO}, ${DATA.RESULT}, '${DATA.REMARK}', '${DATA.M_CODE}')`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateDTC_TEST_EMPL":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE ZTB_REL_REQUESTTABLE SET TEST_EMPL_NO='${EMPL_NO}', TEST_FINISH_TIME=GETDATE()  WHERE DTC_ID=${DATA.DTC_ID} AND TEST_CODE=${DATA.TEST_CODE}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "traholdingmaterial":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE 1=1  `;
          if (DATA.ALLTIME === false) {
            condition += ` AND HOLDING_TB.INS_DATE BETWEEN '${DATA.FROM_DATE}' AND  '${DATA.TO_DATE} 23:59:59'`;
          }
          if (DATA.M_CODE !== "") {
            condition += ` AND HOLDING_TB.M_CODE = '${DATA.M_CODE}' `;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M090.M_NAME LIKE '%${DATA.M_NAME}%' `;
          }
          if (DATA.M_LOT_NO !== "") {
            condition += ` AND HOLDING_TB.M_LOT_NO = '${DATA.M_LOT_NO}' `;
          }
          if (DATA.M_STATUS !== "ALL") {
            condition += ` AND HOLDING_TB.QC_PASS = '${DATA.M_STATUS}' `;
          }
          let setpdQuery = ` SELECT HOLDING_TB.HOLD_ID, HOLDING_TB.REASON, HOLDING_TB.ID, HOLDING_TB.HOLDING_MONTH, HOLDING_TB.FACTORY, HOLDING_TB.WAHS_CD, HOLDING_TB.LOC_CD, HOLDING_TB.M_LOT_NO, HOLDING_TB.M_CODE, M090.M_NAME, M090.WIDTH_CD, HOLDING_TB.HOLDING_ROLL_QTY,HOLDING_TB.HOLDING_QTY, ( HOLDING_TB.HOLDING_ROLL_QTY*HOLDING_TB.HOLDING_QTY) AS HOLDING_TOTAL_QTY, HOLDING_TB.HOLDING_IN_DATE, HOLDING_TB.HOLDING_OUT_DATE, HOLDING_TB.VENDOR_LOT, HOLDING_TB.USE_YN, HOLDING_TB.INS_DATE, HOLDING_TB.INS_EMPL, HOLDING_TB.UPD_DATE, HOLDING_TB.UPD_EMPL, HOLDING_TB.QC_PASS, HOLDING_TB.QC_PASS_DATE, HOLDING_TB.QC_PASS_EMPL FROM HOLDING_TB 
                    LEFT JOIN M090 ON (M090.M_CODE = HOLDING_TB.M_CODE) ${condition} ORDER BY HOLDING_TB.INS_DATE DESC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateQCPASS_HOLDING":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE HOLDING_TB SET QC_PASS='${DATA.VALUE}', QC_PASS_DATE=GETDATE(), QC_PASS_EMPL='${EMPL_NO}' WHERE HOLDING_TB.ID=${DATA.ID} AND M_LOT_NO='${DATA.M_LOT_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateQCPASS_FAILING":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_SX_NG_MATERIAL SET QC_PASS='${DATA.VALUE}', QC_PASS_DATE=GETDATE(), QC_PASS_EMPL='${EMPL_NO}' WHERE ZTB_SX_NG_MATERIAL.PLAN_ID_SUDUNG='${DATA.PLAN_ID_SUDUNG}' AND M_LOT_NO='${DATA.M_LOT_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadQCFailData":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT ZTB_SX_NG_MATERIAL.FAIL_ID, ZTB_SX_NG_MATERIAL.FACTORY,ZTB_SX_NG_MATERIAL.PLAN_ID_SUDUNG,M100.G_NAME, ZTB_SX_NG_MATERIAL.LIEUQL_SX,ZTB_SX_NG_MATERIAL.M_CODE,ZTB_SX_NG_MATERIAL.M_LOT_NO,ZTB_SX_NG_MATERIAL.VENDOR_LOT, 
                    M090.M_NAME, M090.WIDTH_CD, ZTB_SX_NG_MATERIAL.ROLL_QTY,ZTB_SX_NG_MATERIAL.IN_QTY,ZTB_SX_NG_MATERIAL.TOTAL_IN_QTY,ZTB_SX_NG_MATERIAL.USE_YN,ZTB_SX_NG_MATERIAL.PQC3_ID, ZTBPQC3TABLE.DEFECT_PHENOMENON, ZTB_SX_NG_MATERIAL.OUT_DATE,ZTB_SX_NG_MATERIAL.INS_EMPL,ZTB_SX_NG_MATERIAL.INS_DATE,ZTB_SX_NG_MATERIAL.UPD_EMPL,ZTB_SX_NG_MATERIAL.UPD_DATE,ZTB_SX_NG_MATERIAL.PHANLOAI,ZTB_SX_NG_MATERIAL.QC_PASS,ZTB_SX_NG_MATERIAL.QC_PASS_DATE,ZTB_SX_NG_MATERIAL.QC_PASS_EMPL,ZTB_SX_NG_MATERIAL.REMARK, IN1_EMPL, IN2_EMPL, OUT1_EMPL, OUT2_EMPL, IN_CUST_CD, OUT_CUST_CD, OUT_PLAN_ID, REMARK_OUT, M110.CUST_NAME_KD AS IN_CUST_NAME, M110_A.CUST_NAME_KD AS OUT_CUST_NAME
                     FROM ZTB_SX_NG_MATERIAL
                    LEFT JOIN ZTB_QLSXPLAN ON (ZTB_SX_NG_MATERIAL.PLAN_ID_SUDUNG = ZTB_QLSXPLAN.PLAN_ID)
                    LEFT JOIN M100 ON (ZTB_QLSXPLAN.G_CODE = M100.G_CODE)
                    LEFT JOIN M090 ON (M090.M_CODE = ZTB_SX_NG_MATERIAL.M_CODE)
                    LEFT JOIN M110 ON (M110.CUST_CD = ZTB_SX_NG_MATERIAL.IN_CUST_CD)
                    LEFT JOIN (SELECT * FROM M110) AS M110_A ON (M110_A.CUST_CD = ZTB_SX_NG_MATERIAL.OUT_CUST_CD)
                    LEFT JOIN ZTBPQC3TABLE ON (ZTB_SX_NG_MATERIAL.PQC3_ID = ZTBPQC3TABLE.PQC3_ID) ORDER BY ZTB_SX_NG_MATERIAL.INS_DATE DESC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getinputdtcspec":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT  ZTB_REL_REQUESTTABLE.DTC_ID, ZTB_REL_REQUESTTABLE.G_CODE,  ZTB_REL_REQUESTTABLE.M_CODE, ZTB_REL_TESTTABLE.TEST_NAME, ZTB_REL_TESTTABLE.TEST_CODE,ZTB_REL_TESTPOINT.POINT_NAME,ZTB_REL_TESTPOINT.POINT_CODE, ZTB_REL_SPECTTABLE.CENTER_VALUE , ZTB_REL_SPECTTABLE.UPPER_TOR,LOWER_TOR ,  null AS RESULT , ZTB_REL_SPECTTABLE.REMARK  FROM 
                    ZTB_REL_REQUESTTABLE
                   LEFT JOIN M100 ON(M100.G_CODE = ZTB_REL_REQUESTTABLE.G_CODE) 
                   LEFT JOIN M090 ON (M090.M_CODE = ZTB_REL_REQUESTTABLE.M_CODE) 
                   LEFT JOIN ZTB_REL_SPECTTABLE ON (  ZTB_REL_SPECTTABLE.G_CODE = ZTB_REL_REQUESTTABLE.G_CODE AND ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_REQUESTTABLE.TEST_CODE AND ZTB_REL_SPECTTABLE.M_CODE = ZTB_REL_REQUESTTABLE.M_CODE)
                   LEFT JOIN ZTB_REL_TESTPOINT ON(ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_TESTPOINT.TEST_CODE AND ZTB_REL_SPECTTABLE.POINT_CODE = ZTB_REL_TESTPOINT.POINT_CODE)
                   LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_REQUESTTABLE.TEST_CODE)  
                   WHERE ZTB_REL_REQUESTTABLE.DTC_ID=${DATA.DTC_ID} AND ZTB_REL_REQUESTTABLE.TEST_CODE=${DATA.TEST_CODE}
                   ORDER BY ZTB_REL_REQUESTTABLE.DTC_ID DESC, ZTB_REL_TESTTABLE.TEST_NAME DESC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadIQC1table":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT  IQC1_TABLE.IQC1_ID, IQC1_TABLE.M_CODE, IQC1_TABLE.M_LOT_NO, IQC1_TABLE.LOT_CMS, IQC1_TABLE.LOT_VENDOR, IQC1_TABLE.CUST_CD, M110.CUST_NAME_KD, IQC1_TABLE.EXP_DATE, IQC1_TABLE.INPUT_LENGTH, IQC1_TABLE.TOTAL_ROLL, IQC1_TABLE.NQ_CHECK_ROLL, IQC1_TABLE.DTC_ID, IQC1_TABLE.TEST_EMPL, IQC1_TABLE.TOTAL_RESULT,XX.NGOAIQUAN, XX.KICHTHUOC,XX.THICKNESS, XX.DIENTRO, XX.CANNANG, XX.KEOKEO, XX.KEOKEO2, XX.FTIR, XX.MAIMON, XX.XRF, XX.SCANBARCODE, XX.PHTHALATE, XX.MAUSAC, XX.SHOCKNHIET, XX.TINHDIEN, XX.NHIETAM, XX.TVOC, XX.DOBONG, IQC1_TABLE.INS_DATE, IQC1_TABLE.INS_EMPL, IQC1_TABLE.UPD_DATE, IQC1_TABLE.UPD_EMPL, IQC1_TABLE.REMARK, CASE WHEN (XX.NGOAIQUAN=0 OR XX.KICHTHUOC=0 OR XX.THICKNESS=0 OR XX.DIENTRO=0 OR XX.CANNANG=0 OR XX.KEOKEO=0 OR XX.KEOKEO2=0 OR XX.FTIR=0 OR XX.MAIMON=0 OR XX.XRF=0 OR XX.SCANBARCODE=0 OR XX.PHTHALATE=0 OR XX.MAUSAC=0 OR XX.SHOCKNHIET=0 OR XX.TINHDIEN=0 OR XX.NHIETAM=0 OR XX.TVOC=0 OR XX.DOBONG=0) THEN 'NG' ELSE CASE WHEN (XX.NGOAIQUAN=2 OR XX.KICHTHUOC=2 OR XX.THICKNESS=2 OR XX.DIENTRO=2 OR XX.CANNANG=2 OR XX.KEOKEO=2 OR XX.KEOKEO2=2 OR XX.FTIR=2 OR XX.MAIMON=2 OR XX.XRF=2 OR XX.SCANBARCODE=2 OR XX.PHTHALATE=2 OR XX.MAUSAC=2 OR XX.SHOCKNHIET=2 OR XX.TINHDIEN=2 OR XX.NHIETAM=2 OR XX.TVOC=2 OR XX.DOBONG=2) THEN 'PENDING' ELSE 'OK' END  END AS AUTO_JUDGEMENT FROM IQC1_TABLE LEFT JOIN 
          (SELECT PVTB.DTC_ID, isnull(PVTB.[Điện trở],-1) AS DIENTRO,isnull(PVTB.[Kích thước],-1) AS KICHTHUOC,isnull(PVTB.[Cân nặng],-1) AS CANNANG,isnull(PVTB.[Kéo keo],0) AS KEOKEO,isnull(PVTB.[FTIR],-1) AS FTIR,isnull(PVTB.[Mài mòn],-1) AS MAIMON ,isnull(PVTB.[XRF],-1) AS XRF,isnull(PVTB.[Scanbarcode],-1) AS SCANBARCODE,isnull(PVTB.[Kéo keo 2],-1) AS KEOKEO2,isnull(PVTB.[Phtalate],-1) AS PHTHALATE,isnull(PVTB.[Màu sắc],-1) AS MAUSAC,isnull(PVTB.[Shock nhiệt],-1) AS SHOCKNHIET,isnull(PVTB.[Tĩnh điện],-1) AS TINHDIEN,isnull(PVTB.[Nhiệt cao Ẩm cao],-1) AS NHIETAM,isnull(PVTB.[TVOC],-1) AS TVOC ,isnull(PVTB.[Độ bóng],-1) AS DOBONG,isnull(PVTB.[Ngoại quan],-1) AS NGOAIQUAN, isnull(PVTB.[Độ dày],-1) AS THICKNESS
           FROM 
          (					
SELECT AA.DTC_ID, AA.TEST_NAME,
CASE WHEN SUM(CASE WHEN AA.JUDGEMENT = 'NG' THEN 1 ELSE 0 END) >0 THEN 0 
ELSE CASE WHEN SUM(CASE WHEN AA.JUDGEMENT = 'PD' THEN 1 ELSE 0 END) >0 THEN 2  ELSE 1 END END AS FINAL_JUDGEMENT  

FROM
          (SELECT  ZTB_REL_REQUESTTABLE.DTC_ID,  ZTB_REL_TESTTABLE.TEST_NAME, ZTB_REL_TESTPOINT.POINT_CODE, ZTB_REL_SPECTTABLE.CENTER_VALUE , ZTB_REL_SPECTTABLE.UPPER_TOR,ZTB_REL_SPECTTABLE.LOWER_TOR , ZTB_REL_RESULT.RESULT, 
CASE WHEN ZTB_REL_RESULT.RESULT is null THEN 'PD' ELSE
CASE WHEN (ZTB_REL_SPECTTABLE.CENTER_VALUE + ZTB_REL_SPECTTABLE.UPPER_TOR >= ZTB_REL_RESULT.RESULT AND ZTB_REL_SPECTTABLE.CENTER_VALUE - ZTB_REL_SPECTTABLE.LOWER_TOR <= ZTB_REL_RESULT.RESULT) THEN 'OK' ELSE 'NG' END END

AS JUDGEMENT

          FROM  ZTB_REL_REQUESTTABLE
          LEFT JOIN ZTB_REL_RESULT ON (ZTB_REL_REQUESTTABLE.DTC_ID = ZTB_REL_RESULT.DTC_ID AND ZTB_REL_REQUESTTABLE.TEST_CODE = ZTB_REL_RESULT.TEST_CODE )  
          LEFT JOIN ZTB_REL_SPECTTABLE ON (  ZTB_REL_SPECTTABLE.G_CODE = ZTB_REL_REQUESTTABLE.G_CODE AND ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_REQUESTTABLE.TEST_CODE AND ZTB_REL_SPECTTABLE.POINT_CODE = ZTB_REL_RESULT.POINT_CODE AND ZTB_REL_SPECTTABLE.M_CODE = ZTB_REL_REQUESTTABLE.M_CODE)
          LEFT JOIN ZTB_REL_TESTPOINT ON(ZTB_REL_SPECTTABLE.TEST_CODE = ZTB_REL_TESTPOINT.TEST_CODE AND ZTB_REL_SPECTTABLE.POINT_CODE = ZTB_REL_TESTPOINT.POINT_CODE)
          LEFT JOIN ZTB_REL_TESTTABLE ON (ZTB_REL_TESTTABLE.TEST_CODE = ZTB_REL_REQUESTTABLE.TEST_CODE)) AS AA GROUP BY AA.DTC_ID, AA.TEST_NAME



) AS BANGNGUON
          PIVOT 
          (SUM (BANGNGUON.FINAL_JUDGEMENT) 
              FOR BANGNGUON.TEST_NAME IN ([Điện trở],[Kích thước],[Cân nặng],[Kéo keo],[FTIR],[Mài mòn],[XRF],[Scanbarcode],[Kéo keo 2],[Phtalate],[Màu sắc],[Shock nhiệt],[Tĩnh điện],[Nhiệt cao Ẩm cao],[TVOC],[Độ bóng],[Ngoại quan],[Độ dày]
          )
          )
          AS PVTB) AS XX
          ON (XX.DTC_ID = IQC1_TABLE.DTC_ID)
          LEFT JOIN M110 ON (M110.CUST_CD = IQC1_TABLE.CUST_CD)`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertIQC1table":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO IQC1_TABLE (CTR_CD,M_CODE,M_LOT_NO,LOT_CMS,LOT_VENDOR,CUST_CD,EXP_DATE,INPUT_LENGTH,TOTAL_ROLL,NQ_CHECK_ROLL,DTC_ID,TEST_EMPL,INS_DATE,INS_EMPL,REMARK) VALUES ('002','${DATA.M_CODE}','${DATA.M_LOT_NO}','${DATA.LOT_CMS}','${DATA.LOT_VENDOR}','${DATA.CUST_CD}','${DATA.EXP_DATE}','${DATA.INPUT_LENGTH}','${DATA.TOTAL_ROLL}','${DATA.NQ_CHECK_ROLL}','${DATA.DTC_ID}','${DATA.TEST_EMPL}',GETDATE(),'${EMPL_NO}','${DATA.REMARK}')`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateQCPASSI222":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE  I222  SET QC_PASS= '${DATA.VALUE}', QC_PASS_EMPL='${EMPL_NO}', QC_PASS_DATE = GETDATE() WHERE M_CODE ='${DATA.M_CODE}' AND SUBSTRING(M_LOT_NO,1,6) = '${DATA.LOT_CMS}'`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateIQC1Table":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE  IQC1_TABLE  SET TOTAL_RESULT= '${DATA.VALUE}', UPD_EMPL='${EMPL_NO}', UPD_DATE = GETDATE(), REMARK=N'${DATA.REMARK}' WHERE IQC1_ID=${DATA.IQC1_ID}`;
          ////console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "insertFailingData":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTB_SX_NG_MATERIAL (CTR_CD,FACTORY,PLAN_ID_SUDUNG,LIEUQL_SX,M_CODE,M_LOT_NO,VENDOR_LOT,ROLL_QTY,IN_QTY,TOTAL_IN_QTY,USE_YN,PQC3_ID,OUT_DATE,INS_EMPL,INS_DATE,PHANLOAI,QC_PASS,REMARK, IN1_EMPL, IN2_EMPL, IN_CUST_CD ) VALUES ('002','${DATA.FACTORY}','${DATA.PLAN_ID_SUDUNG}','${DATA.LIEUQL_SX}','${DATA.M_CODE}','${DATA.M_LOT_NO}','${DATA.VENDOR_LOT}','${DATA.ROLL_QTY}','${DATA.IN_QTY}','${DATA.TOTAL_IN_QTY}','Y','${DATA.PQC3_ID}','${DATA.OUT_DATE}','${EMPL_NO}',GETDATE(),'${DATA.PHANLOAI}','N',N'${DATA.REMARK}','${DATA.IN1_EMPL}','${DATA.IN2_EMPL}','${DATA.IN_CUST_CD}')`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateQCFailTableData":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE  ZTB_SX_NG_MATERIAL SET OUT1_EMPL='${DATA.OUT1_EMPL}', OUT2_EMPL='${DATA.OUT2_EMPL}', OUT_CUST_CD='${DATA.OUT_CUST_CD}', OUT_PLAN_ID='${DATA.OUT_PLAN_ID}',REMARK_OUT='${DATA.REMARK_OUT}', QC_PASS ='Y', QC_PASS_EMPL ='${EMPL_NO}', QC_PASS_DATE = GETDATE() WHERE FAIL_ID=${DATA.FAIL_ID}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateMaterialHoldingReason":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE HOLDING_TB SET REASON = N'${DATA.REASON}' WHERE HOLD_ID=${DATA.HOLD_ID}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkPROCESS_LOT_NO":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT PLAN_ID FROM P501 WHERE  PROCESS_LOT_NO='${DATA.PROCESS_LOT_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "uploadfile":
        (async () => {
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ``;
          //console.log(setpdQuery);
          //checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send({ tk_status: "OK", data: [{}] });
          //res.send(checkkq);
        })();
        break;
      case "checkPlanIdP501":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 * FROM P501 WHERE PLAN_ID='${DATA.PLAN_ID}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkProcessLotNo_Prod_Req_No":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT TOP 1 P500.M_LOT_NO, P501.PROCESS_LOT_NO FROM P501 LEFT JOIN P500 ON (P500.PROCESS_IN_DATE = P501.PROCESS_IN_DATE AND P500.PROCESS_IN_NO = P501.PROCESS_IN_NO AND P500.PROCESS_IN_SEQ = P501.PROCESS_IN_SEQ) WHERE P500.PROD_REQUEST_NO='${DATA.PROD_REQUEST_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "saveLOSS_SETTING_SX":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE M100 SET LOSS_ST_SX1 = ${DATA.LOSS_ST_SX1}, LOSS_ST_SX2 = ${DATA.LOSS_ST_SX2},LOSS_ST_SX3 = ${DATA.LOSS_ST_SX3}, LOSS_ST_SX4 = ${DATA.LOSS_ST_SX4}  WHERE G_CODE='${DATA.G_CODE}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkFSC_PLAN_ID":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT ZTB_QLSXPLAN.PLAN_ID, ZTB_QLSXPLAN.G_CODE, M100.FSC FROM ZTB_QLSXPLAN JOIN M100 ON (M100.G_CODE = ZTB_QLSXPLAN.G_CODE) WHERE ZTB_QLSXPLAN.PLAN_ID='${DATA.PLAN_ID}' `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkcustcodeponoPOBALANCE":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT  (ZTBPOTable.PO_QTY-AA.TotalDelivered) As PO_BALANCE FROM (SELECT ZTBPOTable.EMPL_NO, ZTBPOTable.CUST_CD, ZTBPOTable.G_CODE, ZTBPOTable.PO_NO, isnull(SUM(ZTBDelivery.DELIVERY_QTY),0) AS TotalDelivered FROM ZTBPOTable  LEFT JOIN ZTBDelivery ON (ZTBDelivery.CTR_CD = ZTBPOTable.CTR_CD AND ZTBDelivery.CUST_CD = ZTBPOTable.CUST_CD AND ZTBDelivery.G_CODE = ZTBPOTable.G_CODE AND ZTBDelivery.PO_NO = ZTBPOTable.PO_NO) GROUP BY ZTBPOTable.CTR_CD,ZTBPOTable.EMPL_NO,ZTBPOTable.G_CODE,ZTBPOTable.CUST_CD,ZTBPOTable.PO_NO) AS AA LEFT JOIN M010 ON (M010.EMPL_NO = AA.EMPL_NO) LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE) LEFT JOIN ZTBPOTable ON (AA.CUST_CD = ZTBPOTable.CUST_CD AND AA.G_CODE = ZTBPOTable.G_CODE AND AA.PO_NO = ZTBPOTable.PO_NO) JOIN M110 ON (M110.CUST_CD = AA.CUST_CD) WHERE ZTBPOTable.G_CODE='${DATA.G_CODE}' AND ZTBPOTable.CUST_CD='${DATA.CUST_CD}' AND ZTBPOTable.PO_NO='${DATA.PO_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "diemdanhallbp":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DECLARE @tradate DATE SET @tradate='${moment().format(
            "YYYY-MM-DD"
          )}' SELECT ZTBEMPLINFO.EMPL_NO as id,ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,ZTBEMPLINFO.WORK_POSITION_CODE, WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME, ZTBOFFREGISTRATIONTB_1.REMARK FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) 
          WHERE ZTBMAINDEPARMENT.MAINDEPTCODE = ${
            DATA.MAINDEPTCODE
          }  AND JOB_NAME='Worker' AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "machinecounting":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT SUBSTRING(EQ_NAME,1,2) AS EQ_NAME, COUNT(SUBSTRING(EQ_NAME,1,2)) AS EQ_QTY FROM ZTB_SX_EQ_STATUS WHERE EQ_ACTIVE ='OK'  GROUP BY SUBSTRING(EQ_NAME,1,2) ORDER BY EQ_NAME DESC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "machinecounting2":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE EQ_ACTIVE ='OK'  `;
          if (DATA.FACTORY !== "ALL") {
            condition += ` AND FACTORY='${DATA.FACTORY}'`;
          }
          if (DATA.EQ_NAME !== "ALL") {
            condition += ` AND SUBSTRING(EQ_NAME,1,2)='${DATA.EQ_NAME}'`;
          }

          let setpdQuery = `SELECT FACTORY, SUBSTRING(EQ_NAME,1,2) AS EQ_NAME, COUNT(SUBSTRING(EQ_NAME,1,2)) AS EQ_QTY FROM ZTB_SX_EQ_STATUS  ${condition}  GROUP BY FACTORY, SUBSTRING(EQ_NAME,1,2)  ORDER BY FACTORY ASC, EQ_NAME ASC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "machineTimeEfficiency":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = `WHERE 
            AA.SX_DATE BETWEEN '${DATA.FROM_DATE}' 
            AND '${DATA.TO_DATE}' AND AA.PLAN_FACTORY is not null `;
          if (DATA.FACTORY !== "ALL")
            condition += ` AND AA.PLAN_FACTORY='${DATA.FACTORY}' `;
          if (DATA.MACHINE !== "ALL")
            condition += ` AND SUBSTRING(AA.PLAN_EQ,1,2)='${DATA.MACHINE}'`;

          let setpdQuery = `SELECT 
            AA.PLAN_FACTORY, 
            SUBSTRING(AA.PLAN_EQ, 0, 3) AS MACHINE, 
            SUM(AA.TOTAL_TIME) AS TOTAL_TIME, 
            SUM(AA.RUN_TIME_SX) AS RUN_TIME_SX, 
            SUM(AA.SETTING_TIME) AS SETTING_TIME, 
            SUM(AA.TOTAL_LOSS_TIME) AS LOSS_TIME, 
            CAST(
              SUM(AA.RUN_TIME_SX) as float
            )/ CAST(
              SUM(AA.TOTAL_TIME) as float
            ) AS HIEU_SUAT_TIME, 
            CAST(
              SUM(AA.SETTING_TIME) as float
            )/ CAST(
              SUM(AA.TOTAL_TIME) as float
            ) AS SETTING_TIME_RATE, 
            CAST(
              SUM(AA.TOTAL_LOSS_TIME) as float
            )/ CAST(
              SUM(AA.TOTAL_TIME) as float
            ) AS LOSS_TIME_RATE 
          FROM 
            (
              SELECT               
                ZTB_QLSXPLAN.PLAN_EQ, 
                ZTB_SX_RESULT.PLAN_ID, 
                ZTB_SX_RESULT.SX_DATE, 
                ZTB_QLSXPLAN.PLAN_FACTORY, 
                M100.G_NAME, 
                ZTB_SX_RESULT.WORK_SHIFT, 
                ZTB_SX_RESULT.INS_EMPL, 
                M010.EMPL_NAME, 
                ZTB_QLSXPLAN.PLAN_QTY, 
                ZTB_QLSXPLAN.KETQUASX,
                DATEDIFF(
                  minute, SETTING_START_TIME, MASS_END_TIME
                ) as TOTAL_TIME, 	 
                (
                  DATEDIFF(
                    minute, MASS_START_TIME, MASS_END_TIME
                  ) 
                ) AS RUN_TIME_SX, 
                DATEDIFF(
                  minute, SETTING_START_TIME, MASS_START_TIME
                ) as SETTING_TIME, 
                (
                  isnull(LAY_DO, 0) + isnull(MAY_HONG, 0) + isnull(DAO_NG, 0) + isnull(CHO_BTP, 0) + isnull(CHO_LIEU, 0) + isnull(HET_LIEU, 0) + isnull(LIEU_NG, 0) + isnull(CAN_HANG, 0) + isnull(HOP_FL, 0) + isnull(CHO_QC, 0) + isnull(CHOT_BAOCAO, 0) + isnull(CHUYEN_CODE, 0) + isnull(KHAC, 0)
                ) AS TOTAL_LOSS_TIME     
              FROM 
                ZTB_SX_RESULT 
                LEFT JOIN ZTB_SX_EFFICIENCY ON (
                  ZTB_SX_RESULT.PLAN_ID = ZTB_SX_EFFICIENCY.PLAN_ID 
                  AND ZTB_SX_RESULT.WORK_SHIFT = ZTB_SX_EFFICIENCY.WORK_SHIFT
                ) 
                LEFT JOIN M010 ON (
                  M010.EMPL_NO = ZTB_SX_RESULT.INS_EMPL
                ) 
                LEFT JOIN ZTB_QLSXPLAN ON (
                  ZTB_SX_RESULT.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID
                ) 
                LEFT JOIN M100 ON (
                  M100.G_CODE = ZTB_QLSXPLAN.G_CODE
                ) 
              LEFT JOIN P400 ON (ZTB_QLSXPLAN.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)
              WHERE 
                MASS_END_TIME is not null AND ((ZTB_QLSXPLAN.PROCESS_NUMBER =1  AND M100.UPH1<>0 AND M100.UPH1 is not null) OR (ZTB_QLSXPLAN.PROCESS_NUMBER =2  AND M100.UPH2<>0 AND M100.UPH2 is not null)) AND P400.CODE_55 <> '04'
            ) AS AA 
          ${condition}
          GROUP BY 
            AA.PLAN_FACTORY, 
            SUBSTRING(AA.PLAN_EQ, 0, 3) 
          ORDER BY 
            AA.PLAN_FACTORY ASC, 
            MACHINE DESC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "ycsxbalancecapa":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT 
          EQ1 AS EQ_NAME, 
          (isnull(LEADTIME1, 0) + isnull(LEADTIME2, 0))*1.2 AS YCSX_BALANCE 
        FROM 
          (
            SELECT 
              YCSXCAPATB.EQ1, 
              SUM(YCSXCAPATB.LEATIME1) AS LEADTIME1 
            FROM 
              (
                SELECT 
                  TONYCSX_TABLE.EQ1, 
                  CASE WHEN TONYCSX_TABLE.TON_CD1 <= 0 THEN 0 ELSE (
                    TONYCSX_TABLE.Setting1 + TONYCSX_TABLE.TON_CD1 / TONYCSX_TABLE.UPH1 * 60 * Step1
                  ) END AS LEATIME1 
                FROM 
                  (
                    SELECT 
                      P400.PROD_REQUEST_NO, 
                      M100.G_CODE, 
                      M100.G_NAME, 
                      P400.PROD_REQUEST_QTY, 
                      isnull(KQSXTB.CD1, 0) AS CD1, 
                      isnull(KQSXTB.CD2, 0) AS CD2, 
                      CASE WHEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD1, 0) >= 0 THEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD1, 0) ELSE 0 END AS TON_CD1, 
                      CASE WHEN CAPA_TB.EQ2 IN ('FR', 'SR', 'DC', 'ED') THEN CASE WHEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD2, 0) >= 0 THEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD2, 0) ELSE 0 END ELSE 0 END TON_CD2, 
                      CAPA_TB.FACTORY, 
                      CAPA_TB.EQ1, 
                      CAPA_TB.EQ2, 
                      CAPA_TB.Setting1, 
                      CAPA_TB.Setting2, 
                      CAPA_TB.UPH1, 
                      CAPA_TB.UPH2, 
                      CAPA_TB.Step1, 
                      CAPA_TB.Step2 
                    FROM 
                      P400 
                      LEFT JOIN (
                        (
                          SELECT 
                            PVTB.PROD_REQUEST_NO, 
                            isnull(PVTB.[1], 0) AS CD1, 
                            isnull(PVTB.[2], 0) AS CD2 
                          FROM 
                            (
                              SELECT 
                                ZTB_QLSXPLAN.PROD_REQUEST_NO, 
                                ZTB_QLSXPLAN.PROCESS_NUMBER, 
                                SUM(
                                  isnull(SX_RESULT, 0)
                                ) AS KETQUASX 
                              FROM 
                                ZTB_SX_RESULT 
                                LEFT JOIN ZTB_QLSXPLAN ON (
                                  ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID
                                ) 
                              WHERE 
                                ZTB_QLSXPLAN.STEP = 0 
                              GROUP BY 
                                ZTB_QLSXPLAN.PROD_REQUEST_NO, 
                                ZTB_QLSXPLAN.PROCESS_NUMBER
                            ) AS PV PIVOT (
                              SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1], [2])
                            ) AS PVTB
                        )
                      ) AS KQSXTB ON (
                        P400.PROD_REQUEST_NO = KQSXTB.PROD_REQUEST_NO
                      ) 
                      LEFT JOIN (
                        SELECT 
                          G_CODE, 
                          G_NAME, 
                          FACTORY, 
                          EQ1, 
                          EQ2, 
                          Setting1, 
                          Setting2, 
                          UPH1, 
                          UPH2, 
                          Step1, 
                          Step2 
                        FROM 
                          M100 
                        WHERE 
                          FACTORY IN ('NM1', 'NM2') 
                          AND EQ1 IN('FR', 'SR', 'DC', 'ED') 
                          AND Setting1 is not null 
                          AND Setting1 <> 0 
                          AND UPH1 is not null 
                          AND UPH1 <> 0 
                          AND (
                            (
                              EQ2 IN ('FR', 'SR', 'DC', 'ED') 
                              AND Setting2 is not null 
                              AND Setting2 <> 0 
                              AND UPH2 is not null 
                              AND UPH2 <> 0
                            ) 
                            OR (
                              EQ2 NOT IN ('FR', 'SR', 'DC', 'ED')
                            )
                          )
                      ) AS CAPA_TB ON(CAPA_TB.G_CODE = P400.G_CODE) 
                      LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE) 
                LEFT JOIN (SELECT PROD_REQUEST_NO, SUM(OUTPUT_QTY_EA) AS OUTPUT_QTY FROM ZTBINSPECTOUTPUTTB GROUP BY PROD_REQUEST_NO) AS INSP_OUTPUT ON(P400.PROD_REQUEST_NO= INSP_OUTPUT.PROD_REQUEST_NO)
                    WHERE 
                      PROD_REQUEST_DATE > '20230101'  AND P400.PROD_REQUEST_QTY > INSP_OUTPUT.OUTPUT_QTY
                      AND CAPA_TB.FACTORY is not null 
                      AND P400.YCSX_PENDING = 1 
                      AND P400.CODE_55 <> '04'
                  ) AS TONYCSX_TABLE
              ) AS YCSXCAPATB 
            GROUP BY 
              YCSXCAPATB.EQ1
          ) AS LTCD1 
          LEFT JOIN (
            SELECT 
              YCSXCAPATB.EQ2, 
              SUM(YCSXCAPATB.LEATIME2) AS LEADTIME2 
            FROM 
              (
                SELECT 
                  TONYCSX_TABLE.EQ2, 
                  CASE WHEN TONYCSX_TABLE.EQ2 IN ('FR', 'SR', 'DC', 'ED') THEN CASE WHEN TONYCSX_TABLE.TON_CD2 <= 0 THEN 0 ELSE (
                    TONYCSX_TABLE.Setting2 + TONYCSX_TABLE.TON_CD2 / TONYCSX_TABLE.UPH2 * 60 * Step2
                  ) END ELSE 0 END AS LEATIME2 
                FROM 
                  (
                    SELECT 
                      P400.PROD_REQUEST_NO, 
                      M100.G_CODE, 
                      M100.G_NAME, 
                      P400.PROD_REQUEST_QTY, 
                      isnull(KQSXTB.CD1, 0) AS CD1, 
                      isnull(KQSXTB.CD2, 0) AS CD2, 
                      CASE WHEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD1, 0) >= 0 THEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD1, 0) ELSE 0 END AS TON_CD1, 
                      CASE WHEN CAPA_TB.EQ2 IN ('FR', 'SR', 'DC', 'ED') THEN CASE WHEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD2, 0) >= 0 THEN P400.PROD_REQUEST_QTY - isnull(KQSXTB.CD2, 0) ELSE 0 END ELSE 0 END TON_CD2, 
                      CAPA_TB.FACTORY, 
                      CAPA_TB.EQ1, 
                      CAPA_TB.EQ2, 
                      CAPA_TB.Setting1, 
                      CAPA_TB.Setting2, 
                      CAPA_TB.UPH1, 
                      CAPA_TB.UPH2, 
                      CAPA_TB.Step1, 
                      CAPA_TB.Step2 
                    FROM 
                      P400 
                      LEFT JOIN (
                        (
                          SELECT 
                            PVTB.PROD_REQUEST_NO, 
                            isnull(PVTB.[1], 0) AS CD1, 
                            isnull(PVTB.[2], 0) AS CD2 
                          FROM 
                            (
                              SELECT 
                                ZTB_QLSXPLAN.PROD_REQUEST_NO, 
                                ZTB_QLSXPLAN.PROCESS_NUMBER, 
                                SUM(
                                  isnull(SX_RESULT, 0)
                                ) AS KETQUASX 
                              FROM 
                                ZTB_SX_RESULT 
                                LEFT JOIN ZTB_QLSXPLAN ON (
                                  ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID
                                ) 
                              WHERE 
                                ZTB_QLSXPLAN.STEP = 0 
                              GROUP BY 
                                ZTB_QLSXPLAN.PROD_REQUEST_NO, 
                                ZTB_QLSXPLAN.PROCESS_NUMBER
                            ) AS PV PIVOT (
                              SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1], [2])
                            ) AS PVTB
                        )
                      ) AS KQSXTB ON (
                        P400.PROD_REQUEST_NO = KQSXTB.PROD_REQUEST_NO
                      ) 
                      LEFT JOIN (
                        SELECT 
                          G_CODE, 
                          G_NAME, 
                          FACTORY, 
                          EQ1, 
                          EQ2, 
                          Setting1, 
                          Setting2, 
                          UPH1, 
                          UPH2, 
                          Step1, 
                          Step2 
                        FROM 
                          M100 
                        WHERE 
                          FACTORY IN ('NM1', 'NM2') 
                          AND EQ1 IN('FR', 'SR', 'DC', 'ED') 
                          AND Setting1 is not null 
                          AND Setting1 <> 0 
                          AND UPH1 is not null 
                          AND UPH1 <> 0 
                          AND (
                            (
                              EQ2 IN ('FR', 'SR', 'DC', 'ED') 
                              AND Setting2 is not null 
                              AND Setting2 <> 0 
                              AND UPH2 is not null 
                              AND UPH2 <> 0
                            ) 
                            OR (
                              EQ2 NOT IN ('FR', 'SR', 'DC', 'ED')
                            )
                          )
                      ) AS CAPA_TB ON(CAPA_TB.G_CODE = P400.G_CODE) 
                      LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE) 
                LEFT JOIN (SELECT PROD_REQUEST_NO, SUM(OUTPUT_QTY_EA) AS OUTPUT_QTY FROM ZTBINSPECTOUTPUTTB GROUP BY PROD_REQUEST_NO) AS INSP_OUTPUT ON(P400.PROD_REQUEST_NO= INSP_OUTPUT.PROD_REQUEST_NO)
                    WHERE 
                      PROD_REQUEST_DATE > '20230101' AND P400.PROD_REQUEST_QTY > INSP_OUTPUT.OUTPUT_QTY
                      AND CAPA_TB.FACTORY is not null 
                      AND P400.YCSX_PENDING = 1 
                      AND P400.CODE_55 <> '04'
                  ) AS TONYCSX_TABLE
              ) AS YCSXCAPATB 
            WHERE 
              YCSXCAPATB.EQ2 IN ('FR', 'SR', 'DC', 'ED') 
            GROUP BY 
              YCSXCAPATB.EQ2
          ) AS LTCD2 ON (LTCD1.EQ1 = LTCD2.EQ2) 
        ORDER BY 
          EQ1 DESC 
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "ycsxbalanceleadtimedata":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM 
            (SELECT TONYCSX_TABLE.PROD_REQUEST_NO, TONYCSX_TABLE.PROD_REQUEST_QTY, TONYCSX_TABLE.G_CODE,TONYCSX_TABLE.G_NAME, TONYCSX_TABLE.Setting1 ,TONYCSX_TABLE.Setting2, TONYCSX_TABLE.UPH1, TONYCSX_TABLE.UPH2, TONYCSX_TABLE.TON_CD1, TONYCSX_TABLE.TON_CD2, TONYCSX_TABLE.EQ1, TONYCSX_TABLE.EQ2, (TONYCSX_TABLE.Setting1 + TONYCSX_TABLE.TON_CD1/TONYCSX_TABLE.UPH1*60) AS LEATIME1, CASE WHEN TONYCSX_TABLE.EQ2 IN ('FR','SR','DC','ED') THEN (TONYCSX_TABLE.Setting2 + TONYCSX_TABLE.TON_CD2/TONYCSX_TABLE.UPH2*60) ELSE 0 END AS LEATIME2  FROM 
            (
            SELECT P400.PROD_REQUEST_NO,  M100.G_CODE, M100.G_NAME,P400.PROD_REQUEST_QTY, isnull(KQSXTB.CD1,0) AS CD1, isnull(KQSXTB.CD2,0) AS CD2, 
            CASE WHEN P400.PROD_REQUEST_QTY- isnull(KQSXTB.CD1,0) >=0 THEN P400.PROD_REQUEST_QTY- isnull(KQSXTB.CD1,0) ELSE 0 END AS TON_CD1,
            CASE WHEN CAPA_TB.EQ2 IN ('FR','SR','DC','ED') THEN 
            CASE WHEN P400.PROD_REQUEST_QTY- isnull(KQSXTB.CD2,0) >=0 THEN P400.PROD_REQUEST_QTY- isnull(KQSXTB.CD2,0) ELSE 0 END 
            ELSE 0 END TON_CD2,
            CAPA_TB.FACTORY, CAPA_TB.EQ1, CAPA_TB.EQ2,  CAPA_TB.Setting1, CAPA_TB.Setting2, CAPA_TB.UPH1, CAPA_TB.UPH2, CAPA_TB.Step1, CAPA_TB.Step2  FROM P400
            LEFT JOIN 
            ((SELECT PVTB.PROD_REQUEST_NO, isnull(PVTB.[1],0) AS CD1, isnull(PVTB.[2],0) AS CD2 FROM 
            (
                SELECT ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER, SUM(isnull(SX_RESULT,0)) AS KETQUASX FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_QLSXPLAN.PLAN_ID = ZTB_SX_RESULT.PLAN_ID) WHERE ZTB_QLSXPLAN.STEP=0 GROUP BY ZTB_QLSXPLAN.PROD_REQUEST_NO, ZTB_QLSXPLAN.PROCESS_NUMBER
            )
            AS PV
            PIVOT
            ( 
            SUM(PV.KETQUASX) FOR PV.PROCESS_NUMBER IN ([1],[2])
            ) 
            AS PVTB)) AS KQSXTB ON (P400.PROD_REQUEST_NO = KQSXTB.PROD_REQUEST_NO)
            LEFT JOIN 
            (
            SELECT G_CODE, G_NAME, FACTORY, EQ1, EQ2, Setting1, Setting2, UPH1, UPH2, Step1, Step2 FROM M100 WHERE FACTORY IN ('NM1','NM2') AND EQ1 IN('FR','SR','DC','ED') AND Setting1 is not null AND Setting1 <>0 AND UPH1 is not null AND UPH1 <>0 AND ((EQ2 IN ('FR','SR','DC','ED') AND Setting2 is not null AND Setting2 <>0 AND UPH2 is not null AND UPH2 <>0) OR (EQ2 NOT IN ('FR','SR','DC','ED')))
            ) AS CAPA_TB
            ON(CAPA_TB.G_CODE = P400.G_CODE)
            LEFT JOIN M100 ON (P400.G_CODE = M100.G_CODE)
            WHERE PROD_REQUEST_DATE > '20230101' AND P400.CODE_55 <> '04'
            ) AS TONYCSX_TABLE
            ) AS YCSXCAPATB
            ORDER BY YCSXCAPATB.LEATIME1 DESC, YCSXCAPATB.LEATIME2 DESC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getdatadinhmuc_G_CODE":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM M100 WHERE G_CODE='${DATA.G_CODE}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadCaInfo":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT * FROM ZTB_CALV ORDER BY CA_CODE ASC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "dailysxdata":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE SX_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'  `;
          if (DATA.FACTORY !== "ALL")
            condition += ` AND ZTB_SX_RESULT.FACTORY='${DATA.FACTORY}'`;
          if (DATA.MACHINE !== "ALL")
            condition += ` AND SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2)='${DATA.MACHINE}'`;

          let setpdQuery = ``;
          if (DATA.MACHINE !== "ALL") {
            setpdQuery = `SELECT  ZTB_SX_RESULT.SX_DATE, SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2) AS MACHINE_NAME, SUM(ZTB_SX_RESULT.SX_RESULT) AS SX_RESULT, SUM(ZTB_QLSXPLAN.PLAN_QTY) AS PLAN_QTY  FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_SX_RESULT.PLAN_ID= ZTB_QLSXPLAN.PLAN_ID) ${condition} GROUP BY ZTB_SX_RESULT.SX_DATE, SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2)  ORDER BY SX_DATE ASC`;
          } else {
            setpdQuery = `SELECT  ZTB_SX_RESULT.SX_DATE, SUM(ZTB_SX_RESULT.SX_RESULT) AS SX_RESULT, SUM(ZTB_QLSXPLAN.PLAN_QTY) AS PLAN_QTY  FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_SX_RESULT.PLAN_ID= ZTB_QLSXPLAN.PLAN_ID) ${condition} GROUP BY ZTB_SX_RESULT.SX_DATE ORDER BY SX_DATE ASC`;
          }

          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "sxachivementdata":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE SX_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}' `;
          if (DATA.FACTORY !== "ALL")
            condition += ` AND ZTB_SX_RESULT.FACTORY = '${DATA.FACTORY}'`;

          let setpdQuery = `SELECT MACHINE_NAME, SUM(PLAN_QTY) AS PLAN_QTY, 
          SUM(AA.M_OUTPUT) AS WH_OUTPUT,
          SUM(SX_RESULT) AS SX_RESULT_TOTAL, 
                    SUM(CASE WHEN  AA.STEP=0 THEN SX_RESULT ELSE 0 END) AS RESULT_STEP_FINAL,
                    SUM(CASE WHEN AA.VAOKIEM='KVK' AND AA.STEP=0 THEN SX_RESULT ELSE 0 END) AS RESULT_TO_NEXT_PROCESS,
                    SUM(CASE WHEN AA.VAOKIEM='VK' AND AA.STEP=0 THEN SX_RESULT ELSE 0 END) AS RESULT_TO_INSPECTION,
                    SUM(INS_INPUT) AS INS_INPUT,  SUM(INSPECT_TOTAL_QTY) AS INSPECT_TOTAL_QTY, SUM(INSPECT_OK_QTY) AS INSPECT_OK_QTY, SUM(INSPECT_NG_QTY) AS INSPECT_NG_QTY, SUM(INS_OUTPUT) AS INS_OUTPUT FROM (
                   SELECT  ZTB_SX_RESULT.PLAN_ID, ZTB_SX_RESULT.SX_DATE, ZTB_QLSXPLAN.STEP, M100.EQ1, M100.EQ2,  SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2) AS MACHINE_NAME, CASE WHEN M100.EQ2 NOT IN ('FR','SR','DC','ED')  THEN 'VK' ELSE CASE WHEN SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2) = M100.EQ2 THEN 'VK' ELSE 'KVK' END END AS VAOKIEM,ZTB_QLSXPLAN.PLAN_QTY,
                
                    isnull(ZTB_SX_RESULT.SX_RESULT,0) AS SX_RESULT,  
                    isnull(INSPECT_INPUT_TABLE.INS_INPUT,0) AS INS_INPUT,  
                     isnull(INSPECT_NK_TABLE.INSPECT_TOTAL_QTY,0) AS INSPECT_TOTAL_QTY, isnull(INSPECT_NK_TABLE.INSPECT_OK_QTY,0) AS INSPECT_OK_QTY, isnull(INSPECT_NK_TABLE.INSPECT_NG_QTY,0) AS INSPECT_NG_QTY,
                    isnull(INSPECT_OUTPUT_TABLE.INS_OUTPUT,0) AS INS_OUTPUT ,
                SD_LIEU.WAREHOUSE_OUTPUT_QTY,
                SD_LIEU.WAREHOUSE_OUTPUT_QTY/ZTB_SX_RESULT.PD*ZTB_SX_RESULT.CAVITY*1000 AS M_OUTPUTSX,
                SD_LIEU.WAREHOUSE_OUTPUT_QTY/M100.PD*(M100.G_C*M100.G_C_R)*1000 AS M_OUTPUT
                FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_SX_RESULT.PLAN_ID= ZTB_QLSXPLAN.PLAN_ID) 
                    LEFT JOIN M100 ON (M100.G_CODE = ZTB_SX_RESULT.G_CODE)
                        LEFT JOIN
                        (SELECT PLAN_ID, SUM(CAST(INPUT_QTY_EA as float)) AS INS_INPUT FROM ZTBINSPECTINPUTTB GROUP BY PLAN_ID) AS INSPECT_INPUT_TABLE ON(ZTB_SX_RESULT.PLAN_ID = INSPECT_INPUT_TABLE.PLAN_ID)
                        LEFT JOIN
                        (SELECT PLAN_ID, SUM(CAST(OUTPUT_QTY_EA as float)) AS INS_OUTPUT FROM ZTBINSPECTOUTPUTTB GROUP BY PLAN_ID) AS INSPECT_OUTPUT_TABLE ON (ZTB_SX_RESULT.PLAN_ID = INSPECT_OUTPUT_TABLE.PLAN_ID)
                      LEFT JOIN
                                  (SELECT PLAN_ID, SUM(CAST(INSPECT_TOTAL_QTY  as float)) AS INSPECT_TOTAL_QTY,  SUM(CAST(INSPECT_OK_QTY  as float)) AS INSPECT_OK_QTY, SUM(CAST((ERR4+ERR5+ERR6+ERR7+ERR8+ERR9+ERR10+ERR11+ERR12+ERR13+ERR14+ERR15+ERR16+ERR17+ERR18+ERR19+ERR20+ERR21+ERR22+ERR23+ERR24+ERR25+ERR26+ERR27+ERR28+ERR29+ERR30+ERR31
                    )  as float)) AS INSPECT_NG_QTY FROM ZTBINSPECTNGTB GROUP BY PLAN_ID) AS INSPECT_NK_TABLE ON (ZTB_SX_RESULT.PLAN_ID = INSPECT_NK_TABLE.PLAN_ID)
                LEFT JOIN (
                     SELECT isnull(isnull(WAREHOUSE_OUT.PLAN_ID_INPUT,AA.PLAN_ID_SUDUNG),BB.PLAN_ID) AS PLAN_ID_OUTPUT, isnull(isnull(WAREHOUSE_OUT.M_NAME,AA.M_NAME),BB.M_NAME) AS M_NAME, AA.INPUT_QTY AS TOTAL_OUT_QTY, BB.REMAIN_QTY, (AA.INPUT_QTY - BB.REMAIN_QTY) AS USED_QTY, WAREHOUSE_OUT.WAREHOUSE_OUTPUT_QTY
                     
                FROM
                  (SELECT PLAN_ID_SUDUNG, M090.M_NAME, SUM(TOTAL_IN_QTY) AS INPUT_QTY  FROM IN_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = IN_KHO_SX.M_CODE)  WHERE IN_KHO_SX.USE_YN='X' GROUP BY IN_KHO_SX.PLAN_ID_SUDUNG, M090.M_NAME) AS AA
                  FULL OUTER JOIN
                  (SELECT P500.PLAN_ID, M090.M_NAME, SUM(REMAIN_QTY) AS REMAIN_QTY FROM P500  LEFT JOIN M090 ON (M090.M_CODE = P500.M_CODE) GROUP BY PLAN_ID,M090.M_NAME) AS BB
                  ON(AA.PLAN_ID_SUDUNG = BB.PLAN_ID AND AA.M_NAME = BB.M_NAME)		
                  FULL OUTER JOIN(SELECT PLAN_ID_INPUT, M090.M_NAME, SUM(TOTAL_IN_QTY) AS WAREHOUSE_OUTPUT_QTY  FROM IN_KHO_SX LEFT JOIN M090 ON (M090.M_CODE = IN_KHO_SX.M_CODE) WHERE IN_KHO_SX.PHANLOAI='N' GROUP BY PLAN_ID_INPUT, M090.M_NAME)  AS WAREHOUSE_OUT
                  ON(AA.PLAN_ID_SUDUNG = WAREHOUSE_OUT.PLAN_ID_INPUT AND AA.M_NAME = WAREHOUSE_OUT.M_NAME)	
                ) AS SD_LIEU ON (SD_LIEU.PLAN_ID_OUTPUT = ZTB_SX_RESULT.PLAN_ID)
          ${condition}
          ) AS AA
          GROUP BY AA.MACHINE_NAME
          ORDER BY AA.MACHINE_NAME ASC`;

          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "sxweeklytrenddata":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = `WHERE SX_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
          if (DATA.FACTORY !== "ALL")
            condition += ` AND ZTB_SX_RESULT.FACTORY='${DATA.FACTORY}'`;
          if (DATA.MACHINE !== "ALL")
            condition += ` AND SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2)='${DATA.MACHINE}'`;
          let setpdQuery = `SELECT AA.SX_WEEK, SUM(AA.SX_RESULT) AS SX_RESULT, SUM(AA.PLAN_QTY) AS PLAN_QTY FROM 
          (SELECT DATEPART(YEAR, ZTB_SX_RESULT.SX_DATE) AS SX_YEAR, DATEPART(ISO_WEEK,DATEADD(DAY,+2,ZTB_SX_RESULT.SX_DATE)) AS SX_WEEK, ZTB_SX_RESULT.SX_DATE, SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2) AS MACHINE_NAME, ZTB_SX_RESULT.SX_RESULT, ZTB_QLSXPLAN.PLAN_QTY  FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_SX_RESULT.PLAN_ID= ZTB_QLSXPLAN.PLAN_ID) ${condition}) AS AA
          GROUP BY  AA.SX_WEEK
          ORDER BY AA.SX_WEEK ASC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "sxmonthlytrenddata":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = `WHERE SX_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
          if (DATA.FACTORY !== "ALL")
            condition += ` AND ZTB_SX_RESULT.FACTORY='${DATA.FACTORY}'`;
          if (DATA.MACHINE !== "ALL")
            condition += ` AND SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2)='${DATA.MACHINE}'`;
          let setpdQuery = `SELECT AA.SX_MONTH, SUM(AA.SX_RESULT) AS SX_RESULT, SUM(AA.PLAN_QTY) AS PLAN_QTY FROM 
          (SELECT DATEPART(MONTH, ZTB_SX_RESULT.SX_DATE) AS SX_MONTH, DATEPART(ISO_WEEK,DATEADD(DAY,+2,ZTB_SX_RESULT.SX_DATE)) AS SX_WEEK, ZTB_SX_RESULT.SX_DATE, SUBSTRING(ZTB_SX_RESULT.EQ_NAME,1,2) AS MACHINE_NAME, ZTB_SX_RESULT.SX_RESULT, ZTB_QLSXPLAN.PLAN_QTY  FROM ZTB_SX_RESULT LEFT JOIN ZTB_QLSXPLAN ON (ZTB_SX_RESULT.PLAN_ID= ZTB_QLSXPLAN.PLAN_ID)${condition}) AS AA
          GROUP BY  AA.SX_MONTH
          ORDER BY AA.SX_MONTH ASC`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updatechamcongdiemdanhauto":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO ZTBATTENDANCETB (CTR_CD,EMPL_NO, APPLY_DATE, ON_OFF,CURRENT_TEAM,MCC,CURRENT_CA) 
          SELECT ZTBEMPLINFO.CTR_CD, ZTBEMPLINFO.EMPL_NO,  CAST(GETDATE() as date) AS CHECK_DATE, 1 AS ON_OFF, ZTBEMPLINFO.WORK_SHIFT_CODE AS CURRENT_TEAM, 'Y' AS MCC ,  CASE WHEN ZTBEMPLINFO.WORK_SHIFT_CODE =0 THEN 0  WHEN  ZTBEMPLINFO.WORK_SHIFT_CODE =3 THEN 0 ELSE CASE WHEN DATETABLE.DAYSHIFT= ZTBEMPLINFO.WORK_SHIFT_CODE THEN 1 ELSE 2 END END AS CURRENT_CA
FROM  
           ZTBEMPLINFO JOIN
           (SELECT DISTINCT CHECK_DATE, NV_CCID FROM C001 WHERE CHECK_DATE = CAST(GETDATE() as date)) AS CC 
           ON (CC.NV_CCID = ZTBEMPLINFO.NV_CCID)
       LEFT JOIN DATETABLE ON (DATETABLE.DATE_COLUMN=CAST(GETDATE() as date))
           WHERE NOT EXISTS 
           (SELECT EMPL_NO FROM ZTBATTENDANCETB WHERE ZTBATTENDANCETB.APPLY_DATE=CAST(GETDATE() as date) AND ZTBATTENDANCETB.EMPL_NO = ZTBEMPLINFO.EMPL_NO)`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkcurrentDAYSHIFT":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT DAYSHIFT FROM DATETABLE WHERE DATE_COLUMN=CAST(GETDATE() as date)`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkMYCHAMCONG":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let PASSWORD = req.payload_data["PASSWORD"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT MIN(C001.CHECK_DATETIME) AS MIN_TIME, MAX(C001.CHECK_DATETIME) AS MAX_TIME  FROM C001 LEFT JOIN ZTBEMPLINFO ON (C001.NV_CCID = ZTBEMPLINFO.NV_CCID) WHERE C001.CHECK_DATE = CAST(GETDATE() as date) AND ZTBEMPLINFO.EMPL_NO='${EMPL_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);

          let kqua;
          let query =
            "SELECT ZTBEMPLINFO.EMPL_IMAGE,ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) WHERE ZTBEMPLINFO.EMPL_NO = '" +
            EMPL_NO +
            "' AND PASSWORD = '" +
            PASSWORD +
            "'";

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

          //console.log(checkkq);
          let checkkq_token = { ...checkkq, REFRESH_TOKEN: token };
          //console.log(checkkq_token);
          res.send(checkkq_token);
        })();
        break;
      case "updatelieuncc":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` UPDATE I222 SET LOTNCC='${DATA.LOTNCC}' WHERE M_LOT_NO='${DATA.M_LOT_NO}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadM100UpGia":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` SELECT G_CODE, G_NAME, G_NAME_KD, PROD_MAIN_MATERIAL  FROM M100 `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "pheduyetgia":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE PROD_PRICE_TABLE SET FINAL='${
            DATA.FINAL
          }', INS_DATE=GETDATE(), INS_EMPL='${EMPL_NO}' WHERE G_CODE='${
            DATA.G_CODE
          }' AND CUST_CD ='${DATA.CUST_CD}' AND MOQ=${
            DATA.MOQ
          } AND PRICE_DATE='${moment
            .utc(DATA.PRICE_DATE)
            .format("YYYY-MM-DD")}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "mobile_checkProcessLotNo":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT M100.G_NAME, P501.TEMP_QTY ,P501.INS_DATE, ZTB_QLSXPLAN.PLAN_EQ,  ZTBLOTPRINTHISTORYTB.LOT_PRINT_DATE AS INSPECT_START, GETDATE() AS INSPECT_STOP FROM P501 
          LEFT JOIN ZTB_QLSXPLAN ON (P501.PLAN_ID = ZTB_QLSXPLAN.PLAN_ID)
          LEFT JOIN M100 ON (M100.G_CODE = ZTB_QLSXPLAN.G_CODE)
          LEFT JOIN ZTBLOTPRINTHISTORYTB ON (P501.PROCESS_LOT_NO = ZTBLOTPRINTHISTORYTB.PROCESS_LOT_NO)
          WHERE P501.PROCESS_LOT_NO='${DATA.PROCESS_LOT_NO}'`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadC001":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE        
           SET @startdate='${DATA.FROM_DATE}'
           SET @enddate='${DATA.TO_DATE}'
           SELECT  
		   ZTBEMPLINFOA.DATE_COLUMN,
		   ZTBEMPLINFOA.NV_CCID,
             ZTBEMPLINFOA.EMPL_NO, 
             ZTBEMPLINFOA.CMS_ID, 
             ZTBEMPLINFOA.MIDLAST_NAME, 
             ZTBEMPLINFOA.FIRST_NAME, 
             ZTBEMPLINFOA.PHONE_NUMBER, 
             ZTBSEX.SEX_NAME, 
             ZTBWORKSTATUS.WORK_STATUS_NAME, 
             ZTBFACTORY.FACTORY_NAME, 
             ZTBJOB.JOB_NAME, 
             ZTBWORKSHIFT.WORK_SHIF_NAME, 
             ZTBWORKPOSITION.WORK_POSITION_NAME, 
             ZTBSUBDEPARTMENT.SUBDEPTNAME, 
             ZTBMAINDEPARMENT.MAINDEPTNAME, 
             ZTBOFFREGISTRATIONTB.REQUEST_DATE, 
             ZTBATTENDANCETB.APPLY_DATE, 
             ZTBOFFREGISTRATIONTB.APPROVAL_STATUS, 
             ZTBOFFREGISTRATIONTB.OFF_ID, 
             ZTBOFFREGISTRATIONTB.CA_NGHI, 
             ZTBATTENDANCETB.ON_OFF, 
             ZTBATTENDANCETB.OVERTIME_INFO, 
             ZTBATTENDANCETB.OVERTIME, 
             ZTBREASON.REASON_NAME, 
             ZTBOFFREGISTRATIONTB.REMARK, 
             ZTBATTENDANCETB.XACNHAN,
			 ZTB_CALV.CA_CODE,	
			 ZTB_CALV.CA_NAME,	
			 ZTB_CALV.IN_START,	
			 ZTB_CALV.IN_END,
			 ZTB_CALV.OUT_START,
			 ZTB_CALV.OUT_END,
       CHAMCONG0.CHECK_DATE AS CHECK_DATE0,
			 CHAMCONG0.CHECK1 AS CHECK10,
			 CHAMCONG0.CHECK2 AS CHECK20,
			 CHAMCONG0.CHECK3 AS CHECK30,
			 CHAMCONG0.CHECK4 AS CHECK40,
			 CHAMCONG0.CHECK5 AS CHECK50,
			 CHAMCONG0.CHECK6 AS CHECK60,
			 CHAMCONG.CHECK_DATE,
			 CHAMCONG.CHECK1,
			 CHAMCONG.CHECK2,
			 CHAMCONG.CHECK3,
			 CHAMCONG.CHECK4,
			 CHAMCONG.CHECK5,
			 CHAMCONG.CHECK6,
			 CHAMCONG2.CHECK_DATE AS CHECK_DATE2,
			 CHAMCONG2.CHECK1 AS CHECK12,
			 CHAMCONG2.CHECK2 AS CHECK22,
			 CHAMCONG2.CHECK3 AS CHECK32,
			 CHAMCONG2.CHECK4 AS CHECK42,
			 CHAMCONG2.CHECK5 AS CHECK52,
			 CHAMCONG2.CHECK6 AS CHECK62
       FROM 
       (SELECT DATE_COLUMN, NV_CCID,EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
       LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM , ZTBATTENDANCETB.CURRENT_CA FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
         ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
       ) 
       LEFT JOIN ZTBSEX ON (
         ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
       ) 
       LEFT JOIN ZTBWORKSTATUS ON(
         ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
       ) 
       LEFT JOIN ZTBFACTORY ON (
         ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
       ) 
       LEFT JOIN ZTBJOB ON (
         ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
       ) 
       LEFT JOIN ZTBPOSITION ON (
         ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
       ) 
       LEFT JOIN ZTBWORKSHIFT ON (
         ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
       ) 
       LEFT JOIN ZTBWORKPOSITION ON (
         ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
       ) 
       LEFT JOIN ZTBSUBDEPARTMENT ON (
         ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
       ) 
       LEFT JOIN ZTBMAINDEPARMENT ON (
         ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
       ) 
       LEFT JOIN ZTBOFFREGISTRATIONTB ON (
         ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
         AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
       ) 
       LEFT JOIN ZTBREASON ON (
         ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
       )   
 LEFT JOIN ZTB_CALV ON (ZTB_CALV.CA_CODE = ZTBATTENDANCETB.CURRENT_CA)
 LEFT JOIN (
 SELECT pvtb.NV_CCID, pvtb.CHECK_DATE, pvtb.[1] AS CHECK1, pvtb.[2] AS CHECK2,pvtb.[3] AS CHECK3,pvtb.[4] AS CHECK4,pvtb.[5] AS CHECK5,pvtb.[6] AS CHECK6 FROM
(SELECT CHECK_DATE, NV_CCID, CHECK_DATETIME, RANK() OVER(PARTITION BY CHECK_DATE, NV_CCID ORDER BY CHECK_DATETIME ASC) AS ATT_TIMES FROM C001) BANGNGUON
PIVOT 
(
  MIN(CHECK_DATETIME)
  FOR BANGNGUON.ATT_TIMES IN ([1],[2],[3],[4],[5],[6])
) as pvtb
) AS CHAMCONG 
ON (CHAMCONG.CHECK_DATE = ZTBEMPLINFOA.DATE_COLUMN AND CHAMCONG.NV_CCID = ZTBEMPLINFOA.NV_CCID)
LEFT JOIN (
 SELECT pvtb.NV_CCID, pvtb.CHECK_DATE, pvtb.[1] AS CHECK1, pvtb.[2] AS CHECK2,pvtb.[3] AS CHECK3,pvtb.[4] AS CHECK4,pvtb.[5] AS CHECK5,pvtb.[6] AS CHECK6 FROM
(SELECT CHECK_DATE, NV_CCID, CHECK_DATETIME, RANK() OVER(PARTITION BY CHECK_DATE,NV_CCID ORDER BY CHECK_DATETIME ASC) AS ATT_TIMES FROM C001) BANGNGUON
PIVOT 
(
  MIN(CHECK_DATETIME)
  FOR BANGNGUON.ATT_TIMES IN ([1],[2],[3],[4],[5],[6])
) as pvtb
) AS CHAMCONG2 
ON (DATEADD(day,-1,CHAMCONG2.CHECK_DATE) = ZTBEMPLINFOA.DATE_COLUMN AND CHAMCONG2.NV_CCID = ZTBEMPLINFOA.NV_CCID)
LEFT JOIN (
 SELECT pvtb.NV_CCID, pvtb.CHECK_DATE, pvtb.[1] AS CHECK1, pvtb.[2] AS CHECK2,pvtb.[3] AS CHECK3,pvtb.[4] AS CHECK4,pvtb.[5] AS CHECK5,pvtb.[6] AS CHECK6 FROM
(SELECT CHECK_DATE, NV_CCID, CHECK_DATETIME, RANK() OVER(PARTITION BY CHECK_DATE,NV_CCID ORDER BY CHECK_DATETIME ASC) AS ATT_TIMES FROM C001) BANGNGUON
PIVOT 
(
  MIN(CHECK_DATETIME)
  FOR BANGNGUON.ATT_TIMES IN ([1],[2],[3],[4],[5],[6])
) as pvtb
) AS CHAMCONG0			
ON (DATEADD(day,+1,CHAMCONG0.CHECK_DATE) = ZTBEMPLINFOA.DATE_COLUMN AND CHAMCONG0.NV_CCID = ZTBEMPLINFOA.NV_CCID)
 WHERE ZTBEMPLINFOA.WORK_STATUS_CODE =1 
 ORDER BY ZTBEMPLINFOA.DATE_COLUMN DESC, ZTBEMPLINFOA.POSITION_CODE ASC
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadC0012":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE        
           SET @startdate='${DATA.FROM_DATE}'
           SET @enddate='${DATA.TO_DATE}'
           SELECT 
 ZTBEMPLINFOA.DATE_COLUMN,
		   ZTBEMPLINFOA.NV_CCID,
             ZTBEMPLINFOA.EMPL_NO, 
             ZTBEMPLINFOA.CMS_ID, 
             ZTBEMPLINFOA.MIDLAST_NAME, 
             ZTBEMPLINFOA.FIRST_NAME, 
             ZTBEMPLINFOA.PHONE_NUMBER, 
             ZTBSEX.SEX_NAME, 
             ZTBWORKSTATUS.WORK_STATUS_NAME, 
             ZTBFACTORY.FACTORY_NAME, 
             ZTBJOB.JOB_NAME, 
             ZTBWORKSHIFT.WORK_SHIF_NAME, 
             ZTBWORKPOSITION.WORK_POSITION_NAME, 
             ZTBSUBDEPARTMENT.SUBDEPTNAME, 
             ZTBMAINDEPARMENT.MAINDEPTNAME, 
             ZTBOFFREGISTRATIONTB.REQUEST_DATE, 
             ZTBATTENDANCETB.APPLY_DATE, 
             ZTBOFFREGISTRATIONTB.APPROVAL_STATUS, 
             ZTBOFFREGISTRATIONTB.OFF_ID, 
             ZTBOFFREGISTRATIONTB.CA_NGHI, 
             ZTBATTENDANCETB.ON_OFF, 
             ZTBATTENDANCETB.OVERTIME_INFO, 
             ZTBATTENDANCETB.OVERTIME, 
             ZTBREASON.REASON_NAME, 
             ZTBOFFREGISTRATIONTB.REMARK, 
             ZTBATTENDANCETB.XACNHAN,
			 XX.CHECK1,
			 XX.CHECK2,
			 XX.CHECK3,
			 XX.PREV_CHECK1,
			 XX.PREV_CHECK2,
			 XX.PREV_CHECK3,
			 XX.NEXT_CHECK1,
			 XX.NEXT_CHECK2,
			 XX.NEXT_CHECK3
FROM 
(SELECT DATE_COLUMN, NV_CCID,EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
       
	   LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM , ZTBATTENDANCETB.CURRENT_CA FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
         ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
       ) 
       LEFT JOIN ZTBSEX ON (
         ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
       ) 
       LEFT JOIN ZTBWORKSTATUS ON(
         ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
       ) 
       LEFT JOIN ZTBFACTORY ON (
         ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
       ) 
       LEFT JOIN ZTBJOB ON (
         ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
       ) 
       LEFT JOIN ZTBPOSITION ON (
         ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
       ) 
       LEFT JOIN ZTBWORKSHIFT ON (
         ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
       ) 
       LEFT JOIN ZTBWORKPOSITION ON (
         ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
       ) 
       LEFT JOIN ZTBSUBDEPARTMENT ON (
         ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
       ) 
       LEFT JOIN ZTBMAINDEPARMENT ON (
         ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
       ) 
       LEFT JOIN ZTBOFFREGISTRATIONTB ON (
         ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
         AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
       ) 
       LEFT JOIN ZTBREASON ON (
         ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
       )  
LEFT JOIN 
(
SELECT pvtb.NV_CCID, pvtb.CHECK_DATE, pvtb.[1] AS CHECK1, pvtb.[2] AS CHECK2, pvtb.[3] AS CHECK3,
LEAD(pvtb.[1]) OVER (ORDER BY NV_CCID ASC, CHECK_DATE ASC, pvtb.[1] ASC) AS NEXT_CHECK1,
LEAD(pvtb.[2]) OVER (ORDER BY NV_CCID ASC, CHECK_DATE ASC, pvtb.[2] ASC) AS NEXT_CHECK2,
LEAD(pvtb.[3]) OVER (ORDER BY NV_CCID ASC, CHECK_DATE ASC, pvtb.[3] ASC) AS NEXT_CHECK3,
LAG(pvtb.[1]) OVER (ORDER BY NV_CCID ASC, CHECK_DATE ASC, pvtb.[1] ASC) AS PREV_CHECK1,
LAG(pvtb.[2]) OVER (ORDER BY NV_CCID ASC, CHECK_DATE ASC, pvtb.[2] ASC) AS PREV_CHECK2,
LAG(pvtb.[3]) OVER (ORDER BY NV_CCID ASC, CHECK_DATE ASC, pvtb.[3] ASC) AS PREV_CHECK3
FROM 
(SELECT NV_CCID, CHECK_DATE, CHECK_DATETIME, RANK() OVER (PARTITION BY NV_CCID, CHECK_DATE ORDER BY CHECK_DATETIME ASC) AS CHECKNO FROM fn_cleanchamcong(10))
AS STB
PIVOT
(
MIN(STB.CHECK_DATETIME)
FOR STB.CHECKNO IN ([1],[2],[3],[4],[5],[6])
) AS pvtb
) AS XX
ON (XX.NV_CCID = ZTBEMPLINFOA.NV_CCID AND XX.CHECK_DATE = ZTBEMPLINFOA.DATE_COLUMN)
ORDER BY XX.NV_CCID ASC, XX.CHECK_DATE ASC
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadDiemDanhFullSummaryTable":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE        
          SET @startdate='${DATA.FROM_DATE}'
          SET @enddate='${DATA.TO_DATE}'
SELECT DIEMDANHBP.MAINDEPTNAME,DIEMDANHBP.COUNT_TOTAL,DIEMDANHBP.COUNT_ON,DIEMDANHBP.COUNT_OFF,DIEMDANHBP.COUNT_CDD,DIEMDANHBP.T1_TOTAL,DIEMDANHBP.T1_ON,DIEMDANHBP.T1_OFF,DIEMDANHBP.T1_CDD,DIEMDANHBP.T2_TOTAL,DIEMDANHBP.T2_ON,DIEMDANHBP.T2_OFF,DIEMDANHBP.T2_CDD,DIEMDANHBP.HC_TOTAL,DIEMDANHBP.HC_ON,DIEMDANHBP.HC_OFF,DIEMDANHBP.HC_CDD,DIEMDANHBP.ON_RATE,isnull(BANGNGHI.[TOTAL],0) AS [TOTAL],isnull(BANGNGHI.[Phép năm],0) AS PHEP_NAM,isnull(BANGNGHI.[Nửa phép],0) AS NUA_PHEP,isnull(BANGNGHI.[Nghỉ việc riêng],0) AS NGHI_VIEC_RIENG,isnull(BANGNGHI.[Nghỉ ốm],0) AS NGHI_OM,isnull(BANGNGHI.[Chế độ],0) AS CHE_DO,isnull(BANGNGHI.[Không lý do],0) AS KHONG_LY_DO

FROM 
(
      SELECT EMPL_LIST.MAINDEPTNAME, COUNT(EMPL_LIST.EMPL_NO) AS COUNT_TOTAL, SUM(CASE WHEN ON_OFF =1 THEN 1 ELSE 0 END) AS COUNT_ON, SUM(CASE WHEN ON_OFF =0 THEN 1 ELSE 0 END) AS COUNT_OFF, SUM(CASE WHEN ON_OFF is null THEN 1 ELSE 0 END) AS COUNT_CDD, 
      SUM(CASE WHEN  WORK_SHIF_NAME='TEAM 1' THEN 1 ELSE 0 END) AS T1_TOTAL,
      SUM(CASE WHEN ON_OFF =1 AND WORK_SHIF_NAME='TEAM 1' THEN 1 ELSE 0 END) AS T1_ON,
      SUM(CASE WHEN ON_OFF =0 AND WORK_SHIF_NAME='TEAM 1' THEN 1 ELSE 0 END) AS T1_OFF,
      SUM(CASE WHEN ON_OFF is null AND WORK_SHIF_NAME='TEAM 1' THEN 1 ELSE 0 END) AS T1_CDD,
      SUM(CASE WHEN  WORK_SHIF_NAME='TEAM 2' THEN 1 ELSE 0 END) AS T2_TOTAL,
      SUM(CASE WHEN ON_OFF =1 AND WORK_SHIF_NAME='TEAM 2' THEN 1 ELSE 0 END) AS T2_ON,
      SUM(CASE WHEN ON_OFF =0 AND WORK_SHIF_NAME='TEAM 2' THEN 1 ELSE 0 END) AS T2_OFF,
      SUM(CASE WHEN ON_OFF is null AND WORK_SHIF_NAME='TEAM 2' THEN 1 ELSE 0 END) AS T2_CDD,
      SUM(CASE WHEN  WORK_SHIF_NAME=N'Hành Chính' THEN 1 ELSE 0 END) AS HC_TOTAL,
      SUM(CASE WHEN ON_OFF =1 AND WORK_SHIF_NAME=N'Hành Chính' THEN 1 ELSE 0 END) AS HC_ON,
      SUM(CASE WHEN ON_OFF =0 AND WORK_SHIF_NAME=N'Hành Chính' THEN 1 ELSE 0 END) AS HC_OFF,	
      SUM(CASE WHEN ON_OFF is null AND WORK_SHIF_NAME=N'Hành Chính' THEN 1 ELSE 0 END) AS HC_CDD, 		   
      SUM(CASE WHEN ON_OFF =1 THEN 1 ELSE 0 END)*1.0/COUNT(EMPL_LIST.EMPL_NO)*100 AS ON_RATE		   
      FROM
      (
          SELECT  
      ZTBEMPLINFOA.DATE_COLUMN,
            ZTBEMPLINFOA.EMPL_NO, 
            CMS_ID, 
            MIDLAST_NAME, 
            FIRST_NAME, 
            PHONE_NUMBER, 
            SEX_NAME, 
            WORK_STATUS_NAME, 
            FACTORY_NAME, 
            JOB_NAME, 
            WORK_SHIF_NAME, 
            WORK_POSITION_NAME, 
            SUBDEPTNAME, 
            MAINDEPTNAME, 
            REQUEST_DATE, 
            ZTBATTENDANCETB.APPLY_DATE, 
            APPROVAL_STATUS, 
            OFF_ID, 
            CA_NGHI, 
            ON_OFF, 
            OVERTIME_INFO, 
            OVERTIME, 
            REASON_NAME, 
            ZTBOFFREGISTRATIONTB.REMARK, 
            ZTBATTENDANCETB.XACNHAN 
          FROM 
            (SELECT DATE_COLUMN, EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
            LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
              ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
            ) 
            LEFT JOIN ZTBSEX ON (
              ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
            ) 
            LEFT JOIN ZTBWORKSTATUS ON(
              ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
            ) 
            LEFT JOIN ZTBFACTORY ON (
              ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
            ) 
            LEFT JOIN ZTBJOB ON (
              ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
            ) 
            LEFT JOIN ZTBPOSITION ON (
              ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
            ) 
            LEFT JOIN ZTBWORKSHIFT ON (
              ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
            ) 
            LEFT JOIN ZTBWORKPOSITION ON (
              ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
            ) 
            LEFT JOIN ZTBSUBDEPARTMENT ON (
              ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
            ) 
            LEFT JOIN ZTBMAINDEPARMENT ON (
              ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
            ) 
            LEFT JOIN ZTBOFFREGISTRATIONTB ON (
              ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
              AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
            ) 
            LEFT JOIN ZTBREASON ON (
              ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
            )   
      WHERE ZTBEMPLINFOA.WORK_STATUS_CODE =1
      ) AS EMPL_LIST
      GROUP BY EMPL_LIST.MAINDEPTNAME
)AS DIEMDANHBP
LEFT JOIN 
(
SELECT pvtb.MAINDEPTNAME, (pvtb.[Phép năm]+ pvtb.[Nửa phép]+pvtb.[Nghỉ việc riêng]+pvtb.[Nghỉ ốm]+pvtb.[Chế độ]+pvtb.[Không lý do]) AS TOTAL, 
pvtb.[Phép năm], pvtb.[Nửa phép],pvtb.[Nghỉ việc riêng],pvtb.[Nghỉ ốm],pvtb.[Chế độ],pvtb.[Không lý do]
FROM 
(
SELECT XX.MAINDEPTNAME,XX.REASON_NAME FROM  (
          SELECT  
      ZTBEMPLINFOA.DATE_COLUMN,
            ZTBEMPLINFOA.EMPL_NO, 
            CMS_ID, 
            MIDLAST_NAME, 
            FIRST_NAME, 
            PHONE_NUMBER, 
            SEX_NAME, 
            WORK_STATUS_NAME, 
            FACTORY_NAME, 
            JOB_NAME, 
            WORK_SHIF_NAME, 
            WORK_POSITION_NAME, 
            SUBDEPTNAME, 
            MAINDEPTNAME, 
            REQUEST_DATE, 
            ZTBATTENDANCETB.APPLY_DATE, 
            APPROVAL_STATUS, 
            OFF_ID, 
            CA_NGHI, 
            ON_OFF, 
            OVERTIME_INFO, 
            OVERTIME, 
      CASE WHEN ON_OFF is null AND OFF_ID is null AND DATEPART(WEEKDAY,ZTBEMPLINFOA.DATE_COLUMN)<>1 THEN N'Không lý do' ELSE REASON_NAME END AS REASON_NAME,             
            ZTBOFFREGISTRATIONTB.REMARK, 
            ZTBATTENDANCETB.XACNHAN 
          FROM 
            (SELECT DATE_COLUMN, EMPL_NO,CMS_ID,FIRST_NAME,MIDLAST_NAME,DOB,HOMETOWN,SEX_CODE,ADD_PROVINCE,ADD_DISTRICT,ADD_COMMUNE,ADD_VILLAGE,PHONE_NUMBER,WORK_START_DATE,PASSWORD,EMAIL,WORK_POSITION_CODE,WORK_SHIFT_CODE,POSITION_CODE,JOB_CODE,FACTORY_CODE,WORK_STATUS_CODE,REMARK,ONLINE_DATETIME,EMPL_IMAGE,RESIGN_DATE  FROM DATETABLE CROSS JOIN ZTBEMPLINFO WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate AND ZTBEMPLINFO.WORK_STATUS_CODE<>0) AS ZTBEMPLINFOA 
            LEFT JOIN (SELECT DATETABLE.CTR_CD, DATETABLE.DATE_COLUMN, ZTBATTENDANCETB.EMPL_NO,  ZTBATTENDANCETB.APPLY_DATE,  ZTBATTENDANCETB.ON_OFF,  ZTBATTENDANCETB.REMARK,  ZTBATTENDANCETB.OVERTIME_INFO, ZTBATTENDANCETB.OVERTIME, ZTBATTENDANCETB.XACNHAN,CURRENT_TEAM FROM DATETABLE LEFT JOIN ZTBATTENDANCETB ON (DATETABLE.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE) WHERE DATETABLE.DATE_COLUMN BETWEEN @startdate AND @enddate) AS ZTBATTENDANCETB ON (
              ZTBEMPLINFOA.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBEMPLINFOA.DATE_COLUMN = ZTBATTENDANCETB.APPLY_DATE
            ) 
            LEFT JOIN ZTBSEX ON (
              ZTBSEX.SEX_CODE = ZTBEMPLINFOA.SEX_CODE
            ) 
            LEFT JOIN ZTBWORKSTATUS ON(
              ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFOA.WORK_STATUS_CODE
            ) 
            LEFT JOIN ZTBFACTORY ON (
              ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFOA.FACTORY_CODE
            ) 
            LEFT JOIN ZTBJOB ON (
              ZTBJOB.JOB_CODE = ZTBEMPLINFOA.JOB_CODE
            ) 
            LEFT JOIN ZTBPOSITION ON (
              ZTBPOSITION.POSITION_CODE = ZTBEMPLINFOA.POSITION_CODE
            ) 
            LEFT JOIN ZTBWORKSHIFT ON (
              ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFOA.WORK_SHIFT_CODE
            ) 
            LEFT JOIN ZTBWORKPOSITION ON (
              ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFOA.WORK_POSITION_CODE
            ) 
            LEFT JOIN ZTBSUBDEPARTMENT ON (
              ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE
            ) 
            LEFT JOIN ZTBMAINDEPARMENT ON (
              ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE
            ) 
            LEFT JOIN ZTBOFFREGISTRATIONTB ON (
              ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO 
              AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE
            ) 
            LEFT JOIN ZTBREASON ON (
              ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE
            )   
      WHERE ZTBEMPLINFOA.WORK_STATUS_CODE =1
      AND CASE WHEN ON_OFF is null AND OFF_ID is null AND DATEPART(WEEKDAY,ZTBEMPLINFOA.DATE_COLUMN)<>1  THEN N'Không lý do' ELSE REASON_NAME END is not null) AS XX
     ) AS BANGNGUON
     PIVOT
     (
     COUNT(BANGNGUON.REASON_NAME)
     FOR BANGNGUON.REASON_NAME IN ([Phép năm],[Nửa phép],[Nghỉ việc riêng],[Nghỉ ốm],[Chế độ],[Không lý do])
     ) AS pvtb

) BANGNGHI
ON(DIEMDANHBP.MAINDEPTNAME = BANGNGHI.MAINDEPTNAME)`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadbanggia":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE 1=1`;
          if (DATA.ALLTIME !== true) {
            condition += ` AND BB.[1] BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND  M100.G_CODE='${DATA.G_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M100.PROD_MAIN_MATERIAL LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.CUST_NAME_KD !== "") {
            condition += ` AND M110.CUST_NAME_KD LIKE '${DATA.CUST_NAME_KD}'`;
          }
          let setpdQuery = ` SELECT 
            M110.CUST_NAME_KD, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, M100.PROD_MAIN_MATERIAL, AA.MOQ, AA.[1] AS PRICE1,AA.[2] AS PRICE2,AA.[3] AS PRICE3,AA.[4] AS PRICE4,AA.[5] AS PRICE5,AA.[6] AS PRICE6,AA.[7] AS PRICE7,AA.[8] AS PRICE8,AA.[9] AS PRICE9,AA.[10] AS PRICE10,AA.[11] AS PRICE11,AA.[12] AS PRICE12,AA.[13] AS PRICE13,AA.[14] AS PRICE14,AA.[15] AS PRICE15,AA.[16] AS PRICE16,AA.[17] AS PRICE17,AA.[18] AS PRICE18,AA.[19] AS PRICE19,AA.[20] AS PRICE20, BB.[1] AS PRICE_DATE1,BB.[2] AS PRICE_DATE2,BB.[3] AS PRICE_DATE3,BB.[4] AS PRICE_DATE4,BB.[5] AS PRICE_DATE5,BB.[6] AS PRICE_DATE6,BB.[7] AS PRICE_DATE7,BB.[8] AS PRICE_DATE8,BB.[9] AS PRICE_DATE9,BB.[10] AS PRICE_DATE10,BB.[11] AS PRICE_DATE11,BB.[12] AS PRICE_DATE12,BB.[13] AS PRICE_DATE13,BB.[14] AS PRICE_DATE14,BB.[15] AS PRICE_DATE15,BB.[16] AS PRICE_DATE16,BB.[17] AS PRICE_DATE17,BB.[18] AS PRICE_DATE18,BB.[19] AS PRICE_DATE19,BB.[20] AS PRICE_DATE20
            FROM 
            (
              SELECT * FROM 
              (SELECT CUST_CD, G_CODE, MOQ,  RANK() OVER (PARTITION BY CUST_CD, G_CODE, MOQ ORDER BY PRICE_DATE ASC) AS RANK_NO, PROD_PRICE FROM PROD_PRICE_TABLE)
              as bangnguon
              PIVOT 
              ( SUM(PROD_PRICE)
              for RANK_NO IN ([1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11],[12],[13],[14],[15],[16],[17],[18],[19],[20])
              ) AS pvtb
            ) AS AA
            LEFT JOIN
            (
              SELECT * FROM 
              (SELECT CUST_CD, G_CODE, MOQ, PRICE_DATE , RANK() OVER (PARTITION BY CUST_CD, G_CODE, MOQ ORDER BY PRICE_DATE ASC) AS RANK_NO FROM PROD_PRICE_TABLE)
              as bangnguon
              PIVOT 
              ( MAX(PRICE_DATE)
              for RANK_NO IN ([1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11],[12],[13],[14],[15],[16],[17],[18],[19],[20])
              ) AS pvtb	
            )
            AS BB
            ON (AA.CUST_CD = BB.CUST_CD AND AA.MOQ = BB.MOQ AND AA.G_CODE = BB.G_CODE)
            LEFT JOIN M110 ON (M110.CUST_CD = AA.CUST_CD)
            LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE)
            ${condition}
            `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadbanggia2":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE 1=1`;
          if (DATA.ALLTIME !== true) {
            condition += ` AND PROD_PRICE_TABLE.PRICE_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND  M100.G_CODE='${DATA.G_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M100.PROD_MAIN_MATERIAL LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.CUST_NAME_KD !== "") {
            condition += ` AND M110.CUST_NAME_KD LIKE '${DATA.CUST_NAME_KD}'`;
          }
          let setpdQuery = ` 
            SELECT M100.PROD_MAIN_MATERIAL, M110.CUST_NAME_KD ,PROD_PRICE_TABLE.CUST_CD,PROD_PRICE_TABLE.G_CODE,M100.G_NAME,M100.G_NAME_KD, M100.DESCR, M100.PROD_DVT, PROD_PRICE_TABLE.PRICE_DATE,PROD_PRICE_TABLE.MOQ,PROD_PRICE_TABLE.PROD_PRICE,PROD_PRICE_TABLE.INS_DATE,PROD_PRICE_TABLE.INS_EMPL,PROD_PRICE_TABLE.UPD_DATE,PROD_PRICE_TABLE.UPD_EMPL,PROD_PRICE_TABLE.REMARK,PROD_PRICE_TABLE.FINAL
            FROM 
            PROD_PRICE_TABLE
            LEFT JOIN 
            M100 ON (M100.G_CODE = PROD_PRICE_TABLE.G_CODE)
            LEFT JOIN
            M110 ON (M110.CUST_CD = PROD_PRICE_TABLE.CUST_CD)
            ${condition}
            ORDER BY M100.G_CODE ASC, PROD_PRICE_TABLE.PRICE_DATE ASC
            `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadbanggiamoinhat":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = ` WHERE 1=1`;
          if (DATA.ALLTIME !== true) {
            condition += ` AND PROD_PRICE_TABLE.PRICE_DATE BETWEEN '${DATA.FROM_DATE}' AND '${DATA.TO_DATE}'`;
          }
          if (DATA.G_CODE !== "") {
            condition += ` AND  M100.G_CODE='${DATA.G_CODE}'`;
          }
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }
          if (DATA.M_NAME !== "") {
            condition += ` AND M100.PROD_MAIN_MATERIAL LIKE '%${DATA.M_NAME}%'`;
          }
          if (DATA.CUST_NAME_KD !== "") {
            condition += ` AND M110.CUST_NAME_KD LIKE '%${DATA.CUST_NAME_KD}%'`;
          }
          if (DATA.CUST_CD !== "" && DATA.CUST_CD !== undefined) {
            condition += ` AND M110.CUST_CD = '${DATA.CUST_CD}'`;
          }
          let setpdQuery = ` 
            SELECT M110.CUST_NAME_KD ,PROD_PRICE_TABLE.CUST_CD,PROD_PRICE_TABLE.G_CODE,M100.G_NAME, M100.G_NAME_KD, M100.DESCR, M100.PROD_DVT, M100.PROD_MAIN_MATERIAL, PROD_PRICE_TABLE.PRICE_DATE,PROD_PRICE_TABLE.MOQ,PROD_PRICE_TABLE.PROD_PRICE,PROD_PRICE_TABLE.INS_DATE,PROD_PRICE_TABLE.INS_EMPL,PROD_PRICE_TABLE.UPD_DATE,PROD_PRICE_TABLE.UPD_EMPL,PROD_PRICE_TABLE.REMARK,PROD_PRICE_TABLE.FINAL, M100.G_WIDTH, M100.G_LENGTH, M100.G_NAME_KT,M100.EQ1, M100.EQ2, M100.EQ3, M100.EQ4
            FROM 
           (SELECT CUST_CD, G_CODE, MOQ, MAX(PRICE_DATE) AS LAST_PRICE_DATE FROM PROD_PRICE_TABLE GROUP BY CUST_CD, G_CODE, MOQ) AS AA
           LEFT JOIN 
           PROD_PRICE_TABLE
           ON (AA.CUST_CD = PROD_PRICE_TABLE.CUST_CD AND AA.G_CODE = PROD_PRICE_TABLE.G_CODE AND AA.LAST_PRICE_DATE = PROD_PRICE_TABLE.PRICE_DATE AND AA.MOQ = PROD_PRICE_TABLE.MOQ) 
           LEFT JOIN 
           M100 ON (M100.G_CODE = PROD_PRICE_TABLE.G_CODE)
           LEFT JOIN
           M110 ON (M110.CUST_CD = PROD_PRICE_TABLE.CUST_CD)
            ${condition}
            ORDER BY M100.G_CODE ASC, PROD_PRICE_TABLE.MOQ DESC, PROD_PRICE_TABLE.PRICE_DATE ASC
            `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadpono":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT PO_NO, CUST_CD, G_CODE, PO_DATE,RD_DATE, PO_QTY FROM ZTBPOTable WHERE G_CODE='${DATA.G_CODE}' AND CUST_CD ='${DATA.CUST_CD}' ORDER BY PO_DATE DESC`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "upgiasp":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `INSERT INTO PROD_PRICE_TABLE (CTR_CD, CUST_CD, G_CODE, PRICE_DATE, MOQ, PROD_PRICE, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL, REMARK, FINAL, CURRENCY, RATE) 
          VALUES ('002','${DATA.CUST_CD}','${DATA.G_CODE}','${DATA.PRICE_DATE}','${DATA.MOQ}','${DATA.PROD_PRICE}',GETDATE(),'${EMPL_NO}',GETDATE(),'${EMPL_NO}','${DATA.REMARK}','N','USD', 1)`;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "dongbogiasptupo":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          INSERT INTO PROD_PRICE_TABLE
          SELECT '002' AS CTR_CD, AA.CUST_CD, AA.G_CODE, AA.PRICE_DATE, AA.MOQ, AA.PROD_PRICE, GETDATE() AS INS_DATE,'${EMPL_NO}' AS INS_EMPL, GETDATE() AS UPD_DATE,'${EMPL_NO}' AS UPD_EMPL, 'AUTO' AS REMARK, 'N' AS FINAL, 'USD' AS CURRENCY, null as RATE  FROM 
          (
          SELECT XX.G_CODE, XX.CUST_CD, XX.MOQ, XX.PRICE_DATE, MIN(XX.PROD_PRICE) AS PROD_PRICE FROM 
          (
          SELECT DISTINCT G_CODE, CUST_CD,  1 AS MOQ, ROUND(PROD_PRICE,6) AS PROD_PRICE, MIN(PO_DATE) AS PRICE_DATE FROM ZTBPOTable GROUP BY G_CODE, CUST_CD,  PROD_PRICE
          ) AS XX 　GROUP BY XX.G_CODE, XX.CUST_CD, XX.MOQ, XX.PRICE_DATE
          ) AS AA　
          LEFT JOIN 
          (
          SELECT G_CODE, CUST_CD,   MOQ, PROD_PRICE, PRICE_DATE FROM PROD_PRICE_TABLE
          ) AS BB
          ON (AA.G_CODE = BB.G_CODE AND AA.CUST_CD = BB.CUST_CD AND AA.MOQ = BB.MOQ AND AA.PROD_PRICE = BB.PROD_PRICE  AND AA.PRICE_DATE = BB.PRICE_DATE)
          WHERE  BB.G_CODE is null`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getmachinelist":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          SELECT DISTINCT SUBSTRING(EQ_NAME,1,2) AS EQ_NAME  FROM ZTB_SX_EQ_STATUS`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadbarcodemanager":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          SELECT pvtb.G_CODE,pvtb.G_NAME, pvtb.BARCODE_STT ,pvtb.BARCODE_TYPE, pvtb.[RND] AS BARCODE_RND,  pvtb.[DTC] AS BARCODE_INSP,  pvtb.[KT] AS BARCODE_RELI, 
          CASE WHEN pvtb.[RND] = pvtb.[DTC] AND pvtb.[KT] = pvtb.[DTC] THEN 'OK' ELSE 'NG' END AS STATUS
          FROM 
          (
          SELECT ZTB_BARCODE_MANAGER.G_CODE, M100.G_NAME, ZTB_BARCODE_MANAGER.BARCODE_STT, ZTB_BARCODE_MANAGER.BARCODE_TYPE, ZTB_BARCODE_MANAGER.MAINDEPTNAME, ZTB_BARCODE_MANAGER.BARCODE_CONTENT FROM ZTB_BARCODE_MANAGER LEFT JOIN M100 ON (M100.G_CODE = ZTB_BARCODE_MANAGER.G_CODE)
          ) AS bangnguon
          PIVOT
          (
            MIN(bangnguon.BARCODE_CONTENT) 
            FOR bangnguon.MAINDEPTNAME IN ([RND],[DTC],[KT])
          ) AS pvtb
          `;
          setpdQuery = `
          SELECT ZTB_BARCODE_MANAGER.G_CODE, M100.G_NAME,  ZTB_BARCODE_MANAGER.BARCODE_STT, ZTB_BARCODE_MANAGER.BARCODE_TYPE,  ZTB_BARCODE_MANAGER.RND AS BARCODE_RND, ZTB_BARCODE_MANAGER.DTC AS BARCODE_RELI, ZTB_BARCODE_MANAGER.KT AS BARCODE_INSP, CASE WHEN (RND= DTC AND DTC=KT) AND (RND is not null) THEN 'OK' ELSE 'NG' END AS STATUS FROM ZTB_BARCODE_MANAGER LEFT JOIN M100 ON (ZTB_BARCODE_MANAGER.G_CODE = M100.G_CODE)
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkbarcodeExist":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
         SELECT * FROM ZTB_BARCODE_MANAGER WHERE G_CODE ='${DATA.G_CODE}' AND BARCODE_STT=${DATA.BARCODE_STT}
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "addBarcode":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQueryrnd = `
            INSERT INTO ZTB_BARCODE_MANAGER (CTR_CD, G_CODE, BARCODE_STT, BARCODE_TYPE,  RND, INS_DATE, INS_EMPL, UPD_DATE, UPD_EMPL) VALUES ('002','${DATA.G_CODE}','${DATA.BARCODE_STT}','${DATA.BARCODE_TYPE}','${DATA.BARCODE_RND}', GETDATE(), '${EMPL_NO}', GETDATE(), '${EMPL_NO}')
          `;
          console.log("setpdQueryrnd", setpdQueryrnd);
          checkkq = await queryDB(setpdQueryrnd);
          res.send(checkkq);
        })();
        break;
      case "updateBarcode":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQueryrnd = `
            UPDATE ZTB_BARCODE_MANAGER SET BARCODE_TYPE='${DATA.BARCODE_TYPE}', RND='${DATA.BARCODE_RND}' WHERE G_CODE='${DATA.G_CODE}' AND BARCODE_STT=${DATA.BARCODE_STT}
          `;
          checkkq = await queryDB(setpdQueryrnd);
          console.log(setpdQueryrnd);

          res.send(checkkq);
        })();
        break;
      case "capabydeliveryplan":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          DECLARE @tradate date;
           set @tradate ='${DATA.PLAN_DATE}';           
           SELECT * FROM 
		   (		   
           SELECT XX.FACTORY, XX.EQ,
           CASE
           WHEN XX.LT = 'LT1' THEN @tradate
           WHEN XX.LT = 'LT2' THEN DATEADD(DAY, 1, @tradate)
           WHEN XX.LT = 'LT3' THEN DATEADD(DAY, 2, @tradate)
           WHEN XX.LT = 'LT4' THEN DATEADD(DAY, 3, @tradate)
           WHEN XX.LT = 'LT5' THEN DATEADD(DAY, 4, @tradate)
           WHEN XX.LT = 'LT6' THEN DATEADD(DAY, 5, @tradate)
           WHEN XX.LT = 'LT7' THEN DATEADD(DAY, 6, @tradate)
           WHEN XX.LT = 'LT8' THEN DATEADD(DAY, 7, @tradate)
		   WHEN XX.LT = 'LT9' THEN DATEADD(DAY, 8, @tradate)
		   WHEN XX.LT = 'LT10' THEN DATEADD(DAY, 9, @tradate)
		   WHEN XX.LT = 'LT11' THEN DATEADD(DAY, 10, @tradate)
		   WHEN XX.LT = 'LT12' THEN DATEADD(DAY, 11, @tradate)
		   WHEN XX.LT = 'LT13' THEN DATEADD(DAY, 12, @tradate)
		   WHEN XX.LT = 'LT14' THEN DATEADD(DAY, 13, @tradate)
		   WHEN XX.LT = 'LT15' THEN DATEADD(DAY, 14, @tradate)		   
           END AS PL_DATE
           , SUM(XX.LEATIME) AS LEADTIME FROM
           (
           SELECT upv.FACTORY, upv.EQ1 AS EQ,upv.G_CODE, upv.LT, upv.LEATIME FROM
           (
           SELECT M100.FACTORY, M100.EQ1, M100.G_CODE, ZTBPLANTB.PLAN_DATE,
          CASE WHEN ZTBPLANTB.D1 is null OR ZTBPLANTB.D1 =0 THEN 0 ELSE (ZTBPLANTB.D1*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT1,
          CASE WHEN ZTBPLANTB.D2 is null OR ZTBPLANTB.D2 =0 THEN 0 ELSE (ZTBPLANTB.D2*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT2,
          CASE WHEN ZTBPLANTB.D3 is null OR ZTBPLANTB.D3 =0 THEN 0 ELSE (ZTBPLANTB.D3*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT3,
          CASE WHEN ZTBPLANTB.D4 is null OR ZTBPLANTB.D4 =0 THEN 0 ELSE (ZTBPLANTB.D4*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT4,
          CASE WHEN ZTBPLANTB.D5 is null OR ZTBPLANTB.D5 =0 THEN 0 ELSE (ZTBPLANTB.D5*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT5,
          CASE WHEN ZTBPLANTB.D6 is null OR ZTBPLANTB.D6 =0 THEN 0 ELSE (ZTBPLANTB.D6*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT6,
          CASE WHEN ZTBPLANTB.D7 is null OR ZTBPLANTB.D7 =0 THEN 0 ELSE (ZTBPLANTB.D7*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT7,
          CASE WHEN ZTBPLANTB.D8 is null OR ZTBPLANTB.D8 =0 THEN 0 ELSE (ZTBPLANTB.D8*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT8,
          CASE WHEN ZTBPLANTB.D9 is null OR ZTBPLANTB.D9 =0 THEN 0 ELSE (ZTBPLANTB.D9*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT9,
          CASE WHEN ZTBPLANTB.D10 is null OR ZTBPLANTB.D10 =0 THEN 0 ELSE (ZTBPLANTB.D10*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT10,
          CASE WHEN ZTBPLANTB.D11 is null OR ZTBPLANTB.D11 =0 THEN 0 ELSE (ZTBPLANTB.D11*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT11,
          CASE WHEN ZTBPLANTB.D12 is null OR ZTBPLANTB.D12 =0 THEN 0 ELSE (ZTBPLANTB.D12*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT12,
          CASE WHEN ZTBPLANTB.D13 is null OR ZTBPLANTB.D13 =0 THEN 0 ELSE (ZTBPLANTB.D13*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT13,
          CASE WHEN ZTBPLANTB.D14 is null OR ZTBPLANTB.D14 =0 THEN 0 ELSE (ZTBPLANTB.D14*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT14,
          CASE WHEN ZTBPLANTB.D15 is null OR ZTBPLANTB.D15 =0 THEN 0 ELSE (ZTBPLANTB.D15*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT15
           FROM  ZTBPLANTB LEFT JOIN M100 ON (M100.G_CODE = ZTBPLANTB.G_CODE)
           WHERE (M100.EQ1 <> 'NA' AND M100.EQ1 <>'NO' AND M100.EQ1 <>'' AND M100.EQ1 is not null) AND  M100.UPH1 <>0 AND ZTBPLANTB.PLAN_DATE = @tradate
           ) AS AA
           UNPiVOT
           (
             LEATIME FOR LT IN ([LT1],[LT2],[LT3],[LT4],[LT5],[LT6],[LT7],[LT8],[LT9],[LT10],[LT11],[LT12],[LT13],[LT14],[LT15])
           ) as upv
           UNION ALL
           SELECT upv.FACTORY, upv.EQ2 AS EQ,upv.G_CODE, upv.LT, upv.LEATIME FROM
           (
           SELECT M100.FACTORY, M100.EQ2, M100.G_CODE, ZTBPLANTB.PLAN_DATE,
          CASE WHEN ZTBPLANTB.D1 is null OR ZTBPLANTB.D1 =0 THEN 0 ELSE (ZTBPLANTB.D1*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT1,
          CASE WHEN ZTBPLANTB.D2 is null OR ZTBPLANTB.D2 =0 THEN 0 ELSE (ZTBPLANTB.D2*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT2,
          CASE WHEN ZTBPLANTB.D3 is null OR ZTBPLANTB.D3 =0 THEN 0 ELSE (ZTBPLANTB.D3*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT3,
          CASE WHEN ZTBPLANTB.D4 is null OR ZTBPLANTB.D4 =0 THEN 0 ELSE (ZTBPLANTB.D4*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT4,
          CASE WHEN ZTBPLANTB.D5 is null OR ZTBPLANTB.D5 =0 THEN 0 ELSE (ZTBPLANTB.D5*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT5,
          CASE WHEN ZTBPLANTB.D6 is null OR ZTBPLANTB.D6 =0 THEN 0 ELSE (ZTBPLANTB.D6*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT6,
          CASE WHEN ZTBPLANTB.D7 is null OR ZTBPLANTB.D7 =0 THEN 0 ELSE (ZTBPLANTB.D7*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT7,
          CASE WHEN ZTBPLANTB.D8 is null OR ZTBPLANTB.D8 =0 THEN 0 ELSE (ZTBPLANTB.D8*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT8,
          CASE WHEN ZTBPLANTB.D9 is null OR ZTBPLANTB.D9 =0 THEN 0 ELSE (ZTBPLANTB.D9*1.0/M100.UPH1*60*M100.Step1 + M100.Setting1)*1.2 END AS LT9,
          CASE WHEN ZTBPLANTB.D10 is null OR ZTBPLANTB.D10 =0 THEN 0 ELSE (ZTBPLANTB.D10*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT10,
          CASE WHEN ZTBPLANTB.D11 is null OR ZTBPLANTB.D11 =0 THEN 0 ELSE (ZTBPLANTB.D11*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT11,
          CASE WHEN ZTBPLANTB.D12 is null OR ZTBPLANTB.D12 =0 THEN 0 ELSE (ZTBPLANTB.D12*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT12,
          CASE WHEN ZTBPLANTB.D13 is null OR ZTBPLANTB.D13 =0 THEN 0 ELSE (ZTBPLANTB.D13*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT13,
          CASE WHEN ZTBPLANTB.D14 is null OR ZTBPLANTB.D14 =0 THEN 0 ELSE (ZTBPLANTB.D14*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT14,
          CASE WHEN ZTBPLANTB.D15 is null OR ZTBPLANTB.D15 =0 THEN 0 ELSE (ZTBPLANTB.D15*1.0/M100.UPH2*60*M100.Step2 + M100.Setting2)*1.2 END AS LT15
           FROM  ZTBPLANTB LEFT JOIN M100 ON (M100.G_CODE = ZTBPLANTB.G_CODE)
           WHERE (M100.EQ2 <> 'NA' AND M100.EQ2 <>'NO' AND M100.EQ2 <>'' AND M100.EQ2 is not null) AND M100.UPH2 <>0 AND ZTBPLANTB.PLAN_DATE = @tradate
           ) AS AA
           UNPiVOT
           (
             LEATIME FOR LT IN ([LT1],[LT2],[LT3],[LT4],[LT5],[LT6],[LT7],[LT8],[LT9],[LT10],[LT11],[LT12],[LT13],[LT14],[LT15])
           ) as upv
           ) AS XX          
           GROUP BY XX.FACTORY, XX.EQ, XX.LT
		   ) AS YY
		   WHERE  YY.FACTORY='${DATA.FACTORY}'
       ORDER BY YY.PL_DATE ASC
       `;
          /* WHERE YY.EQ='${DATA.EQ}' AND YY.FACTORY='${DATA.FACTORY}' */
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadquanlygiaonhan":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          SELECT TOP 100 KNIFE_FILM.KNIFE_FILM_ID,KNIFE_FILM.FACTORY_NAME,KNIFE_FILM.NGAYBANGIAO,KNIFE_FILM.G_CODE, M100.G_NAME, M100.PROD_TYPE, M110.CUST_NAME_KD, KNIFE_FILM.LOAIBANGIAO_PDP,KNIFE_FILM.LOAIPHATHANH,KNIFE_FILM.SOLUONG,KNIFE_FILM.SOLUONGOHP,KNIFE_FILM.LYDOBANGIAO,KNIFE_FILM.PQC_EMPL_NO,KNIFE_FILM.RND_EMPL_NO,KNIFE_FILM.SX_EMPL_NO,KNIFE_FILM.REMARK,KNIFE_FILM.CFM_GIAONHAN,KNIFE_FILM.CFM_INS_EMPL,KNIFE_FILM.CFM_DATE,KNIFE_FILM.KNIFE_FILM_STATUS,KNIFE_FILM.MA_DAO,KNIFE_FILM.TOTAL_PRESS,KNIFE_FILM.CUST_CD,KNIFE_FILM.KNIFE_TYPE
          FROM KNIFE_FILM 
          LEFT JOIN M100 ON M100.G_CODE = KNIFE_FILM.G_CODE
          LEFT JOIN M110 ON M110.CUST_CD = M100.CUST_CD
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadKTP_IN":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
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
          LEFT JOIN M100 ON (M100.G_CODE = I660.G_CODE)
          LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = I660.PROD_REQUEST_NO)
          LEFT JOIN M110 ON (P400.CUST_CD = M110.CUST_CD)
          LEFT JOIN M010 ON (P400.EMPL_NO = M010.EMPL_NO)
          ${condition}
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadStockFull":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE I660.USE_YN <> 'X' ";
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
          LEFT JOIN M100 ON (M100.G_CODE = I660.G_CODE)
          LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = I660.PROD_REQUEST_NO)
          LEFT JOIN M110 ON (P400.CUST_CD = M110.CUST_CD)
          LEFT JOIN M010 ON (P400.EMPL_NO = M010.EMPL_NO)
          ${condition}
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadKTP_OUT":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
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
          SELECT  O660.OUT_DATE, O660.FACTORY,O660.AUTO_ID,O660.INSPECT_OUTPUT_ID,O660.PACK_ID,M010.EMPL_NAME, O660.PROD_REQUEST_NO,O660.G_CODE,M100.G_NAME, M100.G_NAME_KD, O660.PLAN_ID,O660.CUST_CD,O660.OUT_QTY, M100.PROD_TYPE, M110.CUST_NAME_KD, 
          CASE WHEN O660.OUT_TYPE='N' THEN 'NORMAL' WHEN O660.OUT_TYPE='F' THEN 'FREE' WHEN O660.OUT_TYPE='L' THEN 'CHANGE LOT' ELSE 'OTHER' END AS OUT_TYPE ,
          CASE WHEN O660.USE_YN='T' THEN 'PREPARING' WHEN O660.USE_YN='Y' THEN 'PREPAIRED' ELSE 'COMPLETED' END AS USE_YN
          ,O660.INS_DATE,O660.INS_EMPL,O660.UPD_DATE,O660.UPD_EMPL,O660.STATUS,O660.REMARK,O660.AUTO_ID_IN,O660.OUT_PRT_SEQ
          FROM O660
          LEFT JOIN M100 ON (M100.G_CODE = O660.G_CODE)
          LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = O660.PROD_REQUEST_NO)
          LEFT JOIN M110 ON (M110.CUST_CD = O660.CUST_CD)
          LEFT JOIN M010 ON (P400.EMPL_NO = M010.EMPL_NO)
          ${condition}
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadSTOCKG_CODE":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
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
          SELECT  AA.G_CODE, M100.G_NAME, M100.G_NAME_KD,M100.PROD_TYPE,  AA.STOCK, AA.BLOCK_QTY, (AA.STOCK+ AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
          (
          SELECT G_CODE, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK,SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660 WHERE USE_YN ='Y' GROUP BY G_CODE
          ) AS AA
          LEFT JOIN M100 ON (M100.G_CODE = AA.G_CODE)
          ${condition}
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadSTOCKG_NAME_KD":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let condition = " WHERE 1=1 ";
          if (DATA.G_NAME !== "") {
            condition += ` AND M100.G_NAME LIKE '%${DATA.G_NAME}%'`;
          }

          let setpdQuery = `
          SELECT   AA.G_NAME_KD, AA.STOCK, AA.BLOCK_QTY,(AA.STOCK+ AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
          (
          SELECT M100.G_NAME_KD, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK,SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660  LEFT JOIN M100 ON  (M100.G_CODE = I660.G_CODE) WHERE I660.USE_YN ='Y' GROUP BY M100.G_NAME_KD
          ) AS AA
          ${condition}
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadSTOCK_YCSX":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
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
          SELECT M110.CUST_NAME_KD, AA.PROD_REQUEST_NO,M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, P400.PROD_REQUEST_DATE, P400.PO_NO, M100.PROD_TYPE, AA.STOCK, AA.BLOCK_QTY,(AA.STOCK+ AA.BLOCK_QTY) AS TOTAL_STOCK FROM 
          (
          SELECT I660.PROD_REQUEST_NO, SUM(CASE WHEN STATUS='N' THEN I660.IN_QTY ELSE 0 END) AS STOCK,SUM(CASE WHEN STATUS='B' THEN I660.IN_QTY ELSE 0 END) AS BLOCK_QTY FROM I660  WHERE I660.USE_YN ='Y' GROUP BY I660.PROD_REQUEST_NO
          ) AS AA
          LEFT JOIN P400 ON (P400.PROD_REQUEST_NO = AA.PROD_REQUEST_NO)
          LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE)
          LEFT JOIN M110 ON (M110.CUST_CD = P400.CUST_CD) 
          ${condition}
          `;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkcustomerpono":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          SELECT TOP 1 PO_NO FROM ZTBPOTable WHERE PO_NO LIKE '%${DATA.CHECK_PO_NO}%' ORDER BY PO_NO DESC
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "checkcustcd":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = ` `;
          if (DATA.COMPANY_TYPE === "KH") {
            setpdQuery = `SELECT TOP 1 CUST_CD FROM M110 WHERE SUBSTRING(M110.CUST_CD,1,2) = 'KH' ORDER BY CUST_CD DESC`;
          } else if (DATA.COMPANY_TYPE === "NCC") {
            setpdQuery = `SELECT TOP 1 CUST_CD FROM M110 WHERE SUBSTRING(M110.CUST_CD,1,3) = 'NCC' ORDER BY CUST_CD DESC`;
          }
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getlastestCODKH":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          SELECT TOP 1 G_NAME_KD FROM M100 WHERE CUST_CD='${DATA.CUST_CD}' AND G_NAME_KD lIKE 'KH%' ORDER BY G_NAME_KD DESC
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "addCodeToQuotationTable":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          INSERT INTO ZTB_QUOTATION_CALC_TB (CTR_CD,G_CODE,G_WIDTH,G_LENGTH,G_C,G_C_R,G_LG,G_CG,G_SG_L,G_SG_R,PROD_PRINT_TIMES) VALUES ('002','${DATA.G_CODE}','${DATA.G_WIDTH}','${DATA.G_LENGTH}','${DATA.G_C}','${DATA.G_C_R}','${DATA.G_LG}','${DATA.G_CG}','${DATA.G_SG_L}','${DATA.G_SG_R}','${DATA.PROD_PRINT_TIMES}')
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "addBOMToQuotationTable":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          INSERT INTO ZTB_QUOTATION_MATERIAL (CTR_CD, Q_ID, G_CODE, M_CODE, M_NAME, OPEN_PRICE, ORIGINAL_PRICE) VALUES ('002','${DATA.Q_ID}','${DATA.G_CODE}','${DATA.M_CODE}','${DATA.M_NAME}','${DATA.OPEN_PRICE}','${DATA.ORIGINAL_PRICE}')
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "loadlistcodequotation":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
          SELECT M110.CUST_CD, M110.CUST_NAME_KD, ZTB_QUOTATION_CALC_TB.G_CODE,M100.G_NAME, M100.G_NAME_KD, ZTB_QUOTATION_CALC_TB.WIDTH_OFFSET,ZTB_QUOTATION_CALC_TB.LENGTH_OFFSET,ZTB_QUOTATION_CALC_TB.KNIFE_UNIT,ZTB_QUOTATION_CALC_TB.FILM_UNIT,ZTB_QUOTATION_CALC_TB.INK_UNIT,ZTB_QUOTATION_CALC_TB.LABOR_UNIT,ZTB_QUOTATION_CALC_TB.DELIVERY_UNIT,ZTB_QUOTATION_CALC_TB.DEPRECATION_UNIT,ZTB_QUOTATION_CALC_TB.GMANAGEMENT_UNIT,ZTB_QUOTATION_CALC_TB.M_LOSS_UNIT,ZTB_QUOTATION_CALC_TB.G_WIDTH,ZTB_QUOTATION_CALC_TB.G_LENGTH,ZTB_QUOTATION_CALC_TB.G_C,ZTB_QUOTATION_CALC_TB.G_C_R,ZTB_QUOTATION_CALC_TB.G_LG,ZTB_QUOTATION_CALC_TB.G_CG,ZTB_QUOTATION_CALC_TB.G_SG_L,ZTB_QUOTATION_CALC_TB.G_SG_R,ZTB_QUOTATION_CALC_TB.PROD_PRINT_TIMES,ZTB_QUOTATION_CALC_TB.KNIFE_COST,ZTB_QUOTATION_CALC_TB.FILM_COST,ZTB_QUOTATION_CALC_TB.INK_COST,ZTB_QUOTATION_CALC_TB.LABOR_COST,ZTB_QUOTATION_CALC_TB.DELIVERY_COST,ZTB_QUOTATION_CALC_TB.DEPRECATION_COST,ZTB_QUOTATION_CALC_TB.GMANAGEMENT_COST,ZTB_QUOTATION_CALC_TB.MATERIAL_COST,ZTB_QUOTATION_CALC_TB.TOTAL_COST,ZTB_QUOTATION_CALC_TB.SALE_PRICE,ZTB_QUOTATION_CALC_TB.PROFIT
FROM ZTB_QUOTATION_CALC_TB LEFT JOIN M100 ON (M100.G_CODE = ZTB_QUOTATION_CALC_TB.G_CODE) LEFT JOIN M110 ON (M110.CUST_CD = M100.CUST_CD)        
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateGiaVLBOM2":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `
              UPDATE ZTB_BOM2 SET M_CMS_PRICE=${DATA.M_CMS_PRICE}, M_SS_PRICE=${DATA.M_SS_PRICE} WHERE G_CODE ='${DATA.G_CODE}' AND M_CODE='${DATA.M_CODE}'
          `;
          console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "getMasterMaterialList":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `SELECT DISTINCT M_NAME FROM ZTB_MATERIAL_TB`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "updateCurrentUnit":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZTB_QUOTATION_CALC_TB  SET KNIFE_UNIT=${DATA.KNIFE_UNIT} , FILM_UNIT=${DATA.FILM_UNIT} , INK_UNIT=${DATA.INK_UNIT} , LABOR_UNIT=${DATA.LABOR_UNIT} , DELIVERY_UNIT=${DATA.DELIVERY_UNIT} , DEPRECATION_UNIT=${DATA.DEPRECATION_UNIT} , GMANAGEMENT_UNIT=${DATA.GMANAGEMENT_UNIT}, M_LOSS_UNIT=${DATA.M_LOSS_UNIT}  WHERE G_CODE ='${DATA.G_CODE}'`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      case "setWebVer":
        (async () => {
          let DATA = qr["DATA"];
          //console.log(DATA);
          let EMPL_NO = req.payload_data["EMPL_NO"];
          let JOB_NAME = req.payload_data["JOB_NAME"];
          let MAINDEPTNAME = req.payload_data["MAINDEPTNAME"];
          let SUBDEPTNAME = req.payload_data["SUBDEPTNAME"];
          let checkkq = "OK";
          let setpdQuery = `UPDATE ZBTVERTABLE SET VERWEB=${DATA.WEB_VER}`;
          //console.log(setpdQuery);
          checkkq = await queryDB(setpdQuery);
          //console.log(checkkq);
          res.send(checkkq);
        })();
        break;
      default:
        //console.log(qr['command']);
        res.send({ tk_status: "ok", data: req.payload_data });
    }
  } else {
    res.send({
      tk_status: "NG",
      message: "Bạn không có quyền truy cập sub server",
    });
  }
};
