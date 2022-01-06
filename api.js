var sql = require("mssql");
var jwt = require('jsonwebtoken');
const moment = require("moment");
require('dotenv').config();


function generate_condition_pqc1($inspect_time_checkvalue, $start_date, $end_date, $input_cust_name, $input_code_cms, $input_code_KD, $ycsx_no, $process_lot_no, $inspec_ID, $inspect_factory) {
    $condition = "WHERE 1=1 ";
    if ($inspect_time_checkvalue == false) {
        $inspect_time_checkvalue = " AND SETTING_OK_TIME BETWEEN '"+$start_date+" 00:00:00' AND  '"+$end_date+" 23:59:59' ";
    }
    else {
        $inspect_time_checkvalue = "";
    }
    if ($input_cust_name != '') {
        $input_cust_name = " AND M110.CUST_NAME_KD LIKE '%"+$input_cust_name+"%'";
    }
    if ($input_code_cms != '') {
        $input_code_cms = " AND M100.G_CODE = '"+$input_code_cms+"'";
    }
    if ($input_code_KD != '') {
        $input_code_KD = " AND M100.G_NAME LIKE  '%"+$input_code_KD+"%'";
    }
    if ($ycsx_no != '') {
        $ycsx_no = " AND P400.PROD_REQUEST_NO = '"+$ycsx_no+"'";
    }
    if ($process_lot_no != '') {
        $process_lot_no = " AND P501_A.PROCESS_LOT_NO = '"+$process_lot_no+"'";
    }
    if ($inspec_ID != '') {
        $inspec_ID = " AND ZTBPQC1TABLE.PQC1_ID = '"+$inspec_ID+"'";
    }
    if ($inspect_factory != 'All') {
        $inspect_factory = " AND ZTBPQC1TABLE.FACTORY = '"+$inspect_factory+"'";
    }
    else {
        $inspect_factory = "";
    }
    $condition = $condition+$inspect_time_checkvalue+$input_cust_name+$input_code_cms+$input_code_KD+$ycsx_no+$process_lot_no+$inspec_ID+$inspect_factory;
    return $condition;
}

function generate_condition_pqc3($inspect_time_checkvalue, $start_date, $end_date, $input_cust_name, $input_code_cms, $input_code_KD, $ycsx_no, $process_lot_no, $inspec_ID, $inspect_factory) {
    $condition = "WHERE 1=1 ";
    if ($inspect_time_checkvalue == false) {
        $inspect_time_checkvalue = " AND OCCURR_TIME BETWEEN '" + $start_date + " 00:00:00' AND  '" + $end_date + " 23:59:59' ";
    }
    else {
        $inspect_time_checkvalue = "";
    }
    if ($input_cust_name != '') {
        $input_cust_name = " AND M110.CUST_NAME_KD LIKE '%" + $input_cust_name + "%'";
    }
    if ($input_code_cms != '') {
        $input_code_cms = " AND M100.G_CODE = '" + $input_code_cms + "'";
    }
    if ($input_code_KD != '') {
        $input_code_KD = " AND M100.G_NAME LIKE  '%" + $input_code_KD + "%'";
    }
    if ($ycsx_no != '') {
        $ycsx_no = " AND P500_A.PROD_REQUEST_NO = '" + $ycsx_no + "'";
    }
    if ($process_lot_no != '') {
        $process_lot_no = " AND P501_A.PROCESS_LOT_NO = '" + $process_lot_no + "'";
    }
    if ($inspec_ID != '') {
        $inspec_ID = " AND ZTBPQC3TABLE.PQC3_ID = '" + $inspec_ID + "'";
    }
    if ($inspect_factory != 'All') {
        $inspect_factory = " AND ZTBPQC1TABLE_B.FACTORY = '" + $inspect_factory + "'";
    }
    else {
        $inspect_factory = "";
    }
    $condition = $condition + $inspect_time_checkvalue + $input_cust_name + $input_code_cms + $input_code_KD + $ycsx_no + $process_lot_no + $inspec_ID + $inspect_factory;
    return $condition;
}
function returnDateFormat(today) {
    let year = today.getFullYear();
    let month = today.getMonth();
    let date = today.getDate();
    if (month + 1 < 10) month = '0' + (month+1);
    if (date < 10) date = '0' + date;
    return year + "-" + month + "-" + date;
}
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    trustServerCertificate: true,
    requestTimeout: 300000
};
function isNumber(str) {
    return (/^[0-9]+$/.test(str) && (str.length == 4));
}
function asyncQuery2(queryString) {
    return new Promise((resolve, reject) => {
        sql.connect(config, (err) => {
            if (err) console.log(err);
            let sqlRequest = new sql.Request();
            sqlRequest.query(queryString, function (err, data) {
                if (err) {
                    console.log("co loi tron async " + err + ' ');
                    return reject(err + ' ');
                }
                return resolve('OK');
                
            });
        });
        
        
    }).catch((err) => {
        console.log("Loi dc catch 2: " + err + ' ');
    });
}
function asyncQuery(queryString) {
    return new Promise((resolve, reject) => {
        sql.connect(config, (err) => {
            if (err) console.log(err);
            let sqlRequest = new sql.Request();
            sqlRequest.query(queryString, function (err, data) {
                if (err) {
                    console.log(err);
                    return reject(err);
                }
                var rs = data.recordset;
                if (rs.hasOwnProperty('length')) {
                    // console.log("co property");
                }
                else {
                    //  console.log("khong co property");
                }
                //console.log('length of dataset: ' + rs.length);
                let kk;
                if (rs.length != 0) {
                    kk = JSON.stringify(rs);
                    resolve(kk);
                }
                else {
                    resolve(0);
                }
            });
        });
    }).catch((err) => {
        console.log("Loi dc catch: " + err + ' ');
    });
}


const queryDB = async (query) => {
    let kq=''; 
    try {
        await sql.connect(config);
        const result = await sql.query(query);          
        if(result.rowsAffected[0]>0)      
        {
            if(result.recordset)
            {
                kq = {tk_status:"OK", data: result.recordset};
            }
            else
            {
                kq = {tk_status:"OK", message: "Modify data thanh cong"};
            }            
        }
        else
        {
            kq = {status:"NG", message: "Không có dòng dữ liệu nào"};
        }       
    }
    catch (err) {
        //console.log(err);
        kq = {status:"NG", message: err+' '};
        
    }    
    
    return kq;
}

const bulkQueryDB = async ()=>{

}

exports.checklogin_index = function (req, res, next) {
    //console.log("bam login ma cung loi?");
    try {
        //console.log("token client la: " + req.cookies.token);
        var token = req.cookies.token;
        var decoded = jwt.verify(token, 'nguyenvanhung');
        //console.log(decoded);   
        let payload_json = JSON.parse(decoded['payload']);
        //console.log(payload_json[0]);        
        //console.log('Cookie client = ' + req.cookies.token);  
        req.payload_data = payload_json[0];
        req.coloiko = 'kocoloi';
        next();
    }
    catch (err) {
        console.log("Loi check login index = " + err + ' ');
        req.coloiko = 'coloi';
        next();
    }
}
exports.checklogin_login = function (req, res, next) {
    try {
        //console.log("token client la: " + req.cookies.token);
        var token = req.cookies.token;
        var decoded = jwt.verify(token, 'nguyenvanhung');
        //console.log(decoded);   
        let payload_json = JSON.parse(decoded['payload']);
        //console.log(payload_json[0]);        
        //console.log('Cookie client = ' + req.cookies.token);  
        req.payload_data = payload_json[0];
        console.log("Di qua check login-login");
        res.redirect('/');
        next();
    }
    catch (err) {
        console.log('Chua dang nhap nen fai ve day ' + err + ' ');
        next();
    }
}
 
exports.process_api = function (req, res) {
    var qr = req.body;
    let rightnow= new Date().toLocaleString();
    console.log(moment().format("YYYY-MM-DD hh:mm:ss") + ":" + qr['command']);
    
    if (qr['command'] == 'check_chua_pd') {
        (async () => {
            var today = new Date();
            var today_format = returnDateFormat(today);
            console.log(today_format);
            let kqua;
            let query = "SELECT COUNT(EMPL_NO) AS CPD FROM ZTBOFFREGISTRATIONTB WHERE APPLY_DATE = '" + today_format + "' AND APPROVAL_STATUS  =2";
            kqua = await asyncQuery(query);
            let chuapdqty = JSON.parse(kqua)[0]['CPD'];
            console.log(chuapdqty);
            res.send(chuapdqty + '');
            
        })()
    }
    else if (qr['command'] == 'login') {
        console.log("post request from login page !");
        console.log('USER = ' + qr['user']);
        console.log('PASS = ' + qr['pass']);
        let username = qr['user'];
        let password = qr['pass'];
        var loginResult = false;
        try {
            (async () => {
                let kqua;
                let query = "SELECT ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) WHERE ZTBEMPLINFO.EMPL_NO = '" + username + "' AND PASSWORD = '" + password + "'";
                kqua = await asyncQuery(query);
                //console.log(kqua); 
                loginResult = kqua;
                console.log("KET QUA LOGIN = " + loginResult);
                if (loginResult != 0) {
                    var token = jwt.sign({ payload: loginResult }, 'nguyenvanhung', { expiresIn: 3600 * 24 });
                    res.cookie('token', token);
                    //console.log(token);                       
                    res.send({ tk_status: "ok", token_content: token });
                    console.log('login thanh cong');
                }
                else {
                    res.send({ tk_status: "ng", token_content: token });
                    console.log('login that bai');
                }
            })()
        }
        catch (err) {
            console.log("Loi day neh: " + err + ' ');
        }
        
    }
    else if (qr['command'] == 'logout') {
        res.cookie('token', 'reset');
        res.send('loged out');
    }
    else if (qr['command'] == 'att_refresh') {
        try {
            (async () => {
                let kqua;
                var todayDate = new Date().toISOString().slice(0, 10);
                console.log(todayDate);
                let sql_team1_total = "SELECT COUNT(EMPL_NO) AS TOTAL_TEAM1 FROM ZTBEMPLINFO WHERE WORK_SHIFT_CODE = 1 AND WORK_STATUS_CODE <> 2 AND WORK_STATUS_CODE <> 0";
                let sql_team1_att = "SELECT COUNT(ZTBATTENDANCETB.EMPL_NO) AS ATT_TEAM1 FROM ZTBATTENDANCETB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) WHERE ZTBATTENDANCETB.APPLY_DATE = '" + todayDate + "' AND ZTBEMPLINFO.WORK_SHIFT_CODE = 1";
                let sql_team2_total = "SELECT COUNT(EMPL_NO) AS TOTAL_TEAM2 FROM ZTBEMPLINFO WHERE WORK_SHIFT_CODE = 2 AND WORK_STATUS_CODE <> 2 AND WORK_STATUS_CODE <> 0";
                let sql_team2_att = "SELECT COUNT(ZTBATTENDANCETB.EMPL_NO) AS ATT_TEAM2 FROM ZTBATTENDANCETB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) WHERE ZTBATTENDANCETB.APPLY_DATE = '" + todayDate + "' AND ZTBEMPLINFO.WORK_SHIFT_CODE = 2";
                let sql_team_HC_total = "SELECT COUNT(EMPL_NO) AS TOTAL_TEAM_HC FROM ZTBEMPLINFO WHERE WORK_SHIFT_CODE = 0 AND WORK_STATUS_CODE <> 2 AND WORK_STATUS_CODE <> 0";
                let sql_team_HC_att = "SELECT COUNT(ZTBATTENDANCETB.EMPL_NO) AS ATT_TEAM_HC FROM ZTBATTENDANCETB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) WHERE ZTBATTENDANCETB.APPLY_DATE = '" + todayDate + "' AND ZTBEMPLINFO.WORK_SHIFT_CODE = 0";
                let sql_chua_phe_duyet = "SELECT COUNT(EMPL_NO) AS CPD FROM ZTBOFFREGISTRATIONTB WHERE APPLY_DATE = '" + todayDate + "' AND APPROVAL_STATUS  =2";
                let sql_online_datetime = "UPDATE ZTBEMPLINFO SET ONLINE_DATETIME=GETDATE() WHERE EMPL_NO='" + req.payload_data['EMPL_NO'] + "'";
                let sql_online_person = "SELECT * FROM (SELECT  EMPL_NO, ZTBEMPLINFO.FIRST_NAME,  DATEDIFF(second,  ONLINE_DATETIME, GETDATE()) AS DD FROM ZTBEMPLINFO) AS AA  WHERE AA.DD <=30";
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
                Promise.all([team1_total, team1_att, team2_total, team2_att, HC_total, HC_att, online_person]).then(values => {
                    let total_array = [].concat.apply([], values);
                    //console.log(total_array);  
                    final_array = values.map(value => {
                        return JSON.parse(value)[0];
                    })
                    final_array.pop();
                    final_array.push(JSON.parse(values[6]));
                    //console.log(final_array);
                    let result_a = final_array;
                    let team1info = "Điểm danh team 1: " + result_a[1]['ATT_TEAM1'] + "/" + result_a[0]['TOTAL_TEAM1'] + "\n";
                    let team2info = "Điểm danh team 2: " + result_a[3]['ATT_TEAM2'] + "/" + result_a[2]['TOTAL_TEAM2'] + "\n";
                    let teamHCinfo = "Điểm danh team HC: " + result_a[5]['ATT_TEAM_HC'] + "/" + result_a[4]['TOTAL_TEAM_HC'] + "\n";
                    let total_att = result_a[1]['ATT_TEAM1'] + result_a[3]['ATT_TEAM2'] + result_a[5]['ATT_TEAM_HC'];
                    let total_empl = result_a[0]['TOTAL_TEAM1'] + result_a[2]['TOTAL_TEAM2'] + result_a[4]['TOTAL_TEAM_HC'];
                    let totalInfo = "Tổng điểm danh: " + total_att + "/" + total_empl;
                    let onlineInfo = "Người Online: "
                    var pp = result_a[6].map((element) => {
                        onlineInfo += element['FIRST_NAME'] + ", ";
                    })
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
                    res.send({ tk_status: 'ok', htmldata: htmlcontent });
                    
                }).catch((err) => {
                    console.log("loi promise roi " + err + ' ');
                });
            })()
        }
        catch (err) {
            console.log(err + '');
            res.send("loi roi");
        }
        
    }
    else if (qr['command'] == 'dangkynghi') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let START_DATE = qr['ngaybatdau'];
            let END_DATE = qr['ngayketthuc'];
            let REASON_NAME = qr['reason_name'];
            let REMARK_CONTENT = qr['remark_content'];
            let CANGHI = qr['canghi'];
            var from = new Date(START_DATE);
            var to = new Date(END_DATE);
            var today = new Date();
            var today_format = returnDateFormat(today);
            let $reason_array = { "Nghỉ phép": "1", "Nửa phép": "2", "Việc riêng": "3", "Nghỉ ốm": "4", "Chế độ": "5", "Không lý do": "6" };
            let checkkq = "OK";
            if (CANGHI == 'Ca ngày') {
                for (var day = from; day <= to; day.setDate(day.getDate() + 1)) {
                    let apply_date = returnDateFormat(day);
                    let query = "INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','" + EMPL_NO + "','" + today_format + "','" + apply_date + "'," + $reason_array[REASON_NAME] + ",N'" + REMARK_CONTENT + "',2,1)";
                    kqua = await asyncQuery2(query);
                    if (kqua != "OK") checkkq = "NG";
                }
                res.send(checkkq);
            }
            else {
                console.log("Ca nghi bang ca dem");
                if (START_DATE == END_DATE) {
                    console.log("Ko duoc  chọn ngày bắt đầu và ngày kết thúc giống nhau ở ca đêm");
                    res.send('Ko duoc  chọn ngày bắt đầu và ngày kết thúc giống nhau ở ca đêm');
                }
                else {
                    for (var day = from; day < to; day.setDate(day.getDate() + 1)) {
                        let apply_date = returnDateFormat(day);
                        let query = "INSERT INTO ZTBOFFREGISTRATIONTB (CTR_CD,EMPL_NO,REQUEST_DATE,APPLY_DATE,REASON_CODE,REMARK,APPROVAL_STATUS,CA_NGHI) VALUES ('002','" + EMPL_NO + "','" + today_format + "','" + apply_date + "'," + $reason_array[REASON_NAME] + ",N'" + REMARK_CONTENT + "',2,2)";
                        kqua = await asyncQuery2(query);
                        if (kqua != "OK") checkkq = "NG";
                    }
                    res.send(checkkq);
                }
            }
            
        })()
        //res.send('ket qua tra ve' + req.cookies.token);
    }
    else if (qr['command'] == 'dangkytangca') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let START_TIME = qr['over_start'];
            let FINISH_TIME = qr['over_finish'];
            let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
            if (isNumber(START_TIME) && isNumber(FINISH_TIME)) {
                console.log("la number");
                var today = new Date();
                var today_format = returnDateFormat(today);
                let checkkq = "OK";
                let checkAttQuery = "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" + EMPL_NO + "' AND APPLY_DATE='" + today_format + "'";
                let checkAttKQ = await asyncQuery(checkAttQuery);
                if (checkAttKQ != 0) {
                    let query = "UPDATE ZTBATTENDANCETB SET OVERTIME=1, OVERTIME_INFO='" + OVERTIME_INFO + "' WHERE EMPL_NO='" + EMPL_NO + "' AND ON_OFF=1 AND APPLY_DATE='" + today_format + "'";
                    kqua = await asyncQuery2(query);
                    console.log(kqua);
                    if (kqua != "OK") {
                        checkkq = "NG";
                        res.send("Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa");
                    }
                    else {
                        res.send("Đăng ký tăng ca hoàn thành");
                    }
                }
                else {
                    res.send('Lỗi, chưa điểm danh nên không đăng ký tăng ca được');
                }
            }
            else {
                res.send('Lỗi, Nhập sai định dạng');
            }
            
        })()
    }
    else if (qr['command'] == 'tralichsu') {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let kqua;
            let query = "SELECT OFF_ID,ZTBOFFREGISTRATIONTB.EMPL_NO, MIDLAST_NAME, FIRST_NAME, REQUEST_DATE, APPLY_DATE, CA_NGHI,REASON_NAME, ZTBOFFREGISTRATIONTB.REMARK, (CASE WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =0 THEN N'Từ chối' WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =1 THEN N'Đã duyệt' WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =2 THEN N'Chờ duyệt' WHEN ZTBOFFREGISTRATIONTB.APPROVAL_STATUS =3 THEN N'Đã hủy' END) AS APPROVAL_STATUS FROM ZTBOFFREGISTRATIONTB JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE ZTBOFFREGISTRATIONTB.EMPL_NO='" + EMPL_NO + "' ORDER BY OFF_ID DESC";
            kqua = await asyncQuery(query);
            console.log(kqua);
            if(kqua == 0)
            {
                res.send({tk_status: "NO", data: kqua});
            }
            else
            {
                res.send({tk_status: "OK", data: kqua});
            }
            
        })()
    }
    else if (qr['command'] == 'mydiemdanh') {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let START_DATE = qr['from_date'];
            let END_DATE = qr['to_date'];
            let kqua;
            let query = "DECLARE @empl varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE; SET @empl='" + EMPL_NO + "'; SET @startdate='" + START_DATE + "' SET @enddate='" + END_DATE + "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBATTENDANCETB.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBATTENDANCETB LEFT JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBATTENDANCETB.EMPL_NO) LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ZTBOFFREGISTRATIONTB ON (ZTBOFFREGISTRATIONTB.EMPL_NO = ZTBATTENDANCETB.EMPL_NO AND ZTBOFFREGISTRATIONTB.APPLY_DATE = ZTBATTENDANCETB.APPLY_DATE) LEFT JOIN ZTBREASON ON ( ZTBOFFREGISTRATIONTB.REASON_CODE = ZTBREASON.REASON_CODE) WHERE ZTBATTENDANCETB.EMPL_NO=@empl AND ZTBATTENDANCETB.APPLY_DATE BETWEEN @startdate AND @enddate";
            kqua = await asyncQuery(query);
            console.log('diem danh: ' + kqua);
            res.send({tk_status:"ok", data: kqua});            
        })()
    }
    else if (qr['command'] == 'pheduyet') {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $vitrilamviec = req.payload_data['ATT_GROUP_CODE'];
            let $subdeptname = req.payload_data['SUBDEPTNAME'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                let kqua;
                let query = "";
                if (JOB_NAME == 'Leader') {
                    query = "SELECT ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE (ZTBSUBDEPARTMENT.SUBDEPTNAME='" + $subdeptname + "' OR ZTBWORKPOSITION.ATT_GROUP_CODE='" + $vitrilamviec + "') ORDER BY OFF_ID DESC";
                }
                else {
                    query = "SELECT ZTBOFFREGISTRATIONTB.CTR_CD,ZTBOFFREGISTRATIONTB.EMPL_NO,ZTBOFFREGISTRATIONTB.REQUEST_DATE,ZTBOFFREGISTRATIONTB.APPLY_DATE,ZTBOFFREGISTRATIONTB.REASON_CODE,ZTBOFFREGISTRATIONTB.REMARK,ZTBOFFREGISTRATIONTB.APPROVAL_STATUS,ZTBOFFREGISTRATIONTB.OFF_ID,ZTBOFFREGISTRATIONTB.CA_NGHI,ZTBEMPLINFO.CMS_ID,ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.ONLINE_DATETIME,ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR,ZTBREASON.REASON_NAME,ZTBREASON.REASON_NAME_KR,ZTBATTENDANCETB.ON_OFF,ZTBATTENDANCETB.OVERTIME_INFO,ZTBATTENDANCETB.OVERTIME FROM ZTBOFFREGISTRATIONTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB.REASON_CODE) LEFT JOIN ZTBATTENDANCETB ON (ZTBATTENDANCETB.APPLY_DATE = ZTBOFFREGISTRATIONTB.APPLY_DATE AND ZTBATTENDANCETB.EMPL_NO = ZTBOFFREGISTRATIONTB.EMPL_NO) WHERE ZTBWORKPOSITION.ATT_GROUP_CODE='" + $vitrilamviec + "' ORDER BY OFF_ID DESC";
                }
                kqua = await asyncQuery(query);
                // console.log(kqua);
                res.send({tk_status:"OK", data:kqua});
            }
            else {
                res.send({tk_status:"NO_LEADER"});
            }
            
        })()
    }
    else if (qr['command'] == 'setpheduyet') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $off_id = qr['off_id'];
            let $pheduyetvalue = qr['pheduyetvalue'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                var today = new Date();
                let checkkq = "OK";
                let setpdQuery = "UPDATE ZTBOFFREGISTRATIONTB SET APPROVAL_STATUS=" + $pheduyetvalue + " WHERE OFF_ID=" + $off_id;
                if ($pheduyetvalue == '3')
                    setpdQuery = "DELETE FROM ZTBOFFREGISTRATIONTB WHERE OFF_ID=" + $off_id;
                checkkq = await asyncQuery2(setpdQuery);
                if (checkkq != "OK") {
                    checkkq = "NG";
                    res.send({tk_status: "ERROR", message: "Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa"});
                }
                else {
                    res.send({tk_status: "OK"});
                }
            }
            else {
                res.send({tk_status:'NO_LEADER'});
            }
        })()
        
    }
    else if (qr['command'] == 'diemdanh') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $team_name = qr['team_name_list'];
            let $vitrilamviec = req.payload_data['ATT_GROUP_CODE'];
            let $subdeptname = req.payload_data['SUBDEPTNAME'];
            let $condition = "";
            switch ($team_name) {
                case 'TEAM 1 + Hành chính':
                    $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 2";
                    break;
                case 'TEAM 2+ Hành chính':
                    $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 1";
                    break;
                case 'TEAM 1':
                    $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =1";
                    break;
                case 'TEAM 2':
                    $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =2";
                    break;
                case 'Hành chính':
                    $condition = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =0";
                    break;
                case 'Tất cả':
                    $condition = "";
                    break;
            }
            console.log('a'+$team_name+'a');
            //console.log("job name = " + JOB_NAME);
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                var today = new Date();
                let today_format = returnDateFormat(today);
                let tradiemdanhQuery = "DECLARE @tradate DATE SET @tradate='" + today_format + "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE ZTBWORKPOSITION.ATT_GROUP_CODE = " + $vitrilamviec + " AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 " + $condition;
                if (JOB_NAME == 'Leader')
                    tradiemdanhQuery = "DECLARE @tradate DATE SET @tradate='" + today_format + "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE  (ZTBWORKPOSITION.ATT_GROUP_CODE = " + $vitrilamviec + " OR ZTBSUBDEPARTMENT.SUBDEPTNAME = '" + $subdeptname + "') AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 " + $condition;
                //console.log(tradiemdanhQuery);
                checkkq = await asyncQuery(tradiemdanhQuery);
                //console.log('check kq = ' + checkkq);
                if (checkkq != 0) {
                    res.send(checkkq);
                }
                else {
                    res.send('NO_DATA');
                }
            }
            else {
                res.send('NO_LEADER');
            }
            
        })()
    }
    else if (qr['command'] == 'setdiemdanh') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = qr['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let diemdanhvalue = qr['diemdanhvalue'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                var today = new Date();
                var today_format = returnDateFormat(today);
                let checkkq = "OK";
                let checkAttQuery = "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" + EMPL_NO + "' AND APPLY_DATE='" + today_format + "'";
                let checkAttKQ = await asyncQuery(checkAttQuery);
                console.log('checkqa = ' + checkAttKQ);
                //checkkq = await asyncQuery2(setpdQuery);
                if (checkAttKQ == 0) {
                    checkkq = "NG";
                    console.log('Chua diem danh, se them moi diem danh');
                    let insert_diemdanhQuery = "INSERT INTO ZTBATTENDANCETB (CTR_CD, EMPL_NO, APPLY_DATE, ON_OFF) VALUES ('002','" + EMPL_NO + "','" + today_format + "'," + diemdanhvalue + ")";
                    let insert_dd = await asyncQuery2(insert_diemdanhQuery);
                    if (insert_dd != 'OK') {
                        res.send("NG");
                    }
                    else {
                        res.send({tk_status: 'OK'});
                    }
                }
                else {
                    let update_diemdanhQuery = "UPDATE ZTBATTENDANCETB SET ON_OFF = " + diemdanhvalue + " WHERE  EMPL_NO='" + EMPL_NO + "' AND APPLY_DATE='" + today_format + "'";
                    let update_dd = await asyncQuery2(update_diemdanhQuery);
                    if (update_dd != 'OK') {
                        res.send({tk_status: 'NG'});
                    }
                    else {
                        res.send({tk_status: 'OK'});
                    }
                    console.log('Update trang thai diem danh');
                }
            }
            else {
                res.send('NO_LEADER');
            }
            
        })()
    }
    else if (qr['command'] == 'dangkytangca2') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = qr['EMPL_NO'];
            let START_TIME = qr['over_start'];
            let FINISH_TIME = qr['over_finish'];
            let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
            let tangcavalue = qr['tangcayesno1'];
            console.log("la number");
            var today = new Date();
            var today_format = returnDateFormat(today);
            let checkkq = "OK";
            let checkAttQuery = "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" + EMPL_NO + "' AND APPLY_DATE='" + today_format + "'";
            let checkAttKQ = await asyncQuery(checkAttQuery);
            if (checkAttKQ != 0) {
                let query = "UPDATE ZTBATTENDANCETB SET OVERTIME=" + tangcavalue + ", OVERTIME_INFO='" + OVERTIME_INFO + "' WHERE EMPL_NO='" + EMPL_NO + "' AND ON_OFF=1 AND APPLY_DATE='" + today_format + "'";
                kqua = await asyncQuery2(query);
                console.log(kqua);
                if (kqua != "OK") {
                    checkkq = "NG";
                    res.send("Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa");
                }
                else {
                    res.send({tk_status: "OK"});
                }
            }
            else {
                res.send({tk_status: "ng"});
            }
            
        })()
    }
    else if (qr['command'] == 'diemdanh_total') {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $vitrilamviec = qr['SUBDEPTNAME'];
            let $subdeptname = qr['SUBDEPTNAME'];
            let $maindeptname = qr['MAINDEPTNAME'];
            let $startdate = qr['from_date_total'];
            let $enddate = qr['to_date_total'];
            let $nghisinhvalue = qr['nghisinhvalue'];
            let $team_name = qr['team_name_total'];
            let $condition = "WHERE 1=1 ";
            let $nghisinhcondition = "";
            let $subdept_condition = "";
            let $maindept_condition = "";
            let $condition_team = "";
            if ($nghisinhvalue == 'false') {
                $nghisinhcondition = "AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0";
            }
            else {
                $nghisinhcondition = " AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0";
            }
            if ($vitrilamviec == 'Toàn bộ') {
                $subdept_condition = "";
            }
            else {
                $subdept_condition = "AND SUBDEPTNAME =N'" + $vitrilamviec + "' ";
            }
            if ($maindeptname == 'Toàn bộ') {
                $maindept_condition = "";
            }
            else {
                $maindept_condition = "AND MAINDEPTNAME =N'" + $maindeptname + "' ";
            }
            if ($team_name == 'Tất cả') {
                $condition_team = "";
            }
            else if ($team_name == 'TEAM 1 + Hành chính') {
                $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 2";
            }
            else if ($team_name == 'TEAM 2+ Hành chính') {
                $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE <> 1";
            }
            else if ($team_name == 'TEAM 1') {
                $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =1";
            }
            else if ($team_name == 'TEAM 2') {
                $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =2";
            }
            else if ($team_name == 'Hành chính') {
                $condition_team = " AND ZTBEMPLINFO.WORK_SHIFT_CODE =0";
            }
            $condition = $condition + $nghisinhcondition + $subdept_condition + $condition_team + $maindept_condition;
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                let kqua;
                let query = "DECLARE @subdept_name varchar(10); DECLARE @startdate DATE; DECLARE @enddate DATE; SET @subdept_name='" + $subdeptname + "'; SET @startdate='" + $startdate + "' SET @enddate='" + $enddate + "' SELECT ZTBEMPLINFO.EMPL_NO,        CMS_ID,        MIDLAST_NAME,        FIRST_NAME,        PHONE_NUMBER,        SEX_NAME,        WORK_STATUS_NAME,        FACTORY_NAME,        JOB_NAME,        WORK_SHIF_NAME,        WORK_POSITION_NAME,        SUBDEPTNAME,        MAINDEPTNAME,        REQUEST_DATE,        ZTBOFFREGISTRATIONTB_1.APPLY_DATE,        APPROVAL_STATUS,        OFF_ID,        CA_NGHI,        ON_OFF,        OVERTIME_INFO,        OVERTIME,        REASON_NAME,        ZTBOFFREGISTRATIONTB_1.REMARK,        ZTBATTENDANCETB_1.APPLY_DATE AS DDDATE, HOMETOWN, ADD_VILLAGE, ADD_COMMUNE, ADD_DISTRICT, ADD_PROVINCE FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN   (SELECT *    FROM ZTBATTENDANCETB    WHERE APPLY_DATE BETWEEN @startdate AND @enddate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN   (SELECT *    FROM ZTBOFFREGISTRATIONTB    WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE BETWEEN @startdate AND @enddate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBATTENDANCETB_1.EMPL_NO AND ZTBOFFREGISTRATIONTB_1.APPLY_DATE = ZTBATTENDANCETB_1.APPLY_DATE )  LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) " + $condition;
                //console.log(query);
                kqua = await asyncQuery(query);
                res.send({tk_status:"OK", data:kqua});
            }
            else {
                res.send({tk_status: "NO_LEADER"});
            }
            
        })()
    }
    else if (qr['command'] == 'setteamtab') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $team_name = qr['team_name_list'];
            let $vitrilamviec = req.payload_data['ATT_GROUP_CODE'];
            let $subdeptname = req.payload_data['SUBDEPTNAME'];
            //console.log("job name = " + JOB_NAME);
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                var today = new Date();
                let today_format = returnDateFormat(today);
                let tradiemdanhQuery = "DECLARE @tradate DATE SET @tradate='" + today_format + "' SELECT ZTBEMPLINFO.EMPL_NO,CMS_ID,MIDLAST_NAME,FIRST_NAME,PHONE_NUMBER,SEX_NAME,WORK_STATUS_NAME,FACTORY_NAME,JOB_NAME,WORK_SHIF_NAME, ZTBWORKSHIFT.WORK_SHIFT_CODE,WORK_POSITION_NAME,SUBDEPTNAME,MAINDEPTNAME,REQUEST_DATE,ZTBOFFREGISTRATIONTB_1.APPLY_DATE,APPROVAL_STATUS,OFF_ID,CA_NGHI,ON_OFF,OVERTIME_INFO,OVERTIME, REASON_NAME FROM ZTBEMPLINFO LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE) LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE) LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE) LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE) LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE) LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE) LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE) LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE) LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE) LEFT JOIN ( SELECT * FROM ZTBOFFREGISTRATIONTB WHERE ZTBOFFREGISTRATIONTB.APPLY_DATE = @tradate ) AS ZTBOFFREGISTRATIONTB_1 ON (ZTBOFFREGISTRATIONTB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN (	SELECT * FROM ZTBATTENDANCETB WHERE APPLY_DATE= @tradate ) AS ZTBATTENDANCETB_1 ON (ZTBATTENDANCETB_1.EMPL_NO = ZTBEMPLINFO.EMPL_NO) LEFT JOIN ZTBREASON ON (ZTBREASON.REASON_CODE = ZTBOFFREGISTRATIONTB_1.REASON_CODE) WHERE  (ZTBWORKPOSITION.ATT_GROUP_CODE = '" + $vitrilamviec + "' OR ZTBSUBDEPARTMENT.SUBDEPTNAME = '" + $subdeptname + "') AND ZTBEMPLINFO.WORK_STATUS_CODE <> 2 AND ZTBEMPLINFO.WORK_STATUS_CODE <> 0 ";
                //console.log(tradiemdanhQuery);
                checkkq = await asyncQuery(tradiemdanhQuery);
                //console.log('check kq = ' + checkkq);
                if (checkkq != 0) {
                    res.send(checkkq);
                }
                else {
                    res.send('NO_DATA');
                }
            }
            else {
                res.send('NO_LEADER');
            }
            
        })()
    }
    else if (qr['command'] == 'setteambt') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = qr['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $teamvalue = qr['teamvalue'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                var today = new Date();
                let checkkq = "OK";
                let setpdQuery = "UPDATE ZTBEMPLINFO SET WORK_SHIFT_CODE=" + $teamvalue + " WHERE EMPL_NO='" + EMPL_NO + "'";
                checkkq = await asyncQuery2(setpdQuery);
                if (checkkq != "OK") {
                    checkkq = "NG";
                    res.send("Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa");
                }
                else {
                    res.send({tk_status: "OK"});
                }
            }
            else {
                res.send({tk_status: "NO_LEADER"});
            }
            
        })()
    }
    else if (qr['command'] == 'confirmtangca') {
        console.log(qr);
        (async () => {
            let kqua;
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let START_TIME = qr['over_start'];
            let FINISH_TIME = qr['over_finish'];
            let OVERTIME_INFO = START_TIME + "-" + FINISH_TIME;
            let tangcavalue = qr['tangcayesno'];
            if (tangcavalue == 'Có tăng ca') {
                tangcavalue = '1';
            }
            else {
                tangcavalue = '0'
            }
            if (tangcavalue == '1') {
                if (isNumber(START_TIME) && isNumber(FINISH_TIME)) {
                    console.log("la number");
                    var today = new Date();
                    today.setDate(today.getDate() - 1);
                    var today_format = returnDateFormat(today);
                    let checkkq = "OK";
                    let checkAttQuery = "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" + EMPL_NO + "' AND APPLY_DATE='" + today_format + "'";
                    let checkAttKQ = await asyncQuery(checkAttQuery);
                    if (checkAttKQ != 0) {
                        let query = "UPDATE ZTBATTENDANCETB SET OVERTIME=" + tangcavalue + ", OVERTIME_INFO='" + OVERTIME_INFO + "' WHERE EMPL_NO='" + EMPL_NO + "' AND ON_OFF=1 AND APPLY_DATE='" + today_format + "'";
                        kqua = await asyncQuery2(query);
                        console.log(kqua);
                        if (kqua != "OK") {
                            checkkq = "NG";
                            res.send("Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa");
                        }
                        else {
                            res.send("Đăng ký tăng ca hoàn thành");
                        }
                    }
                    else {
                        res.send('Lỗi, chưa điểm danh nên không đăng ký tăng ca được');
                    }
                }
                else {
                    res.send('Lỗi, Nhập sai định dạng');
                }
            }
            else {
                OVERTIME_INFO = "";
                console.log("la number");
                var today = new Date();
                today.setDate(today.getDate() - 1);
                var today_format = returnDateFormat(today);
                let checkkq = "OK";
                let checkAttQuery = "SELECT ON_OFF FROM ZTBATTENDANCETB WHERE EMPL_NO='" + EMPL_NO + "' AND APPLY_DATE='" + today_format + "'";
                let checkAttKQ = await asyncQuery(checkAttQuery);
                if (checkAttKQ != 0) {
                    let query = "UPDATE ZTBATTENDANCETB SET OVERTIME=" + tangcavalue + ", OVERTIME_INFO='" + OVERTIME_INFO + "' WHERE EMPL_NO='" + EMPL_NO + "' AND ON_OFF=1 AND APPLY_DATE='" + today_format + "'";
                    kqua = await asyncQuery2(query);
                    console.log(kqua);
                    if (kqua != "OK") {
                        checkkq = "NG";
                        res.send("Có lỗi khi đăng ký, xem lại thông tin đã nhập đã đúng định dạng chưa");
                    }
                    else {
                        res.send("Confirm tăng ca ngày " + today_format + " hoàn thành");
                    }
                }
                else {
                    res.send('Lỗi, chưa điểm danh nên không đăng ký tăng ca được');
                }
            }
        })()
    }
    else if (qr['command'] == 'testlargetb')
    {
        (async () => {
            var today = new Date();
            var today_format = returnDateFormat(today);
            let kqua;
            let query = "SELECT TOP 10000 * FROM ZTBDelivery";
            kqua = await asyncQuery(query);
            res.send({tk_status: "OK", data: kqua});
            
        })()
    }
    else if (qr['command'] == 'diemdanhsummary')
    {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                var today = new Date();
                let today_format = returnDateFormat(today);                
                let kqua;
                let query = "DECLARE @tradate As DATE; SET @tradate = '"+today_format+"' SELECT TONG_FULL.MAINDEPTNAME, TONG_FULL.SUBDEPTNAME, (TONG_FULL.NhaMay1+TONG_FULL.NhaMay2) AS TOTAL_ALL, (isnull(TONG_ON.NhaMay1,0) + isnull(TONG_ON.NhaMay2,0)) AS TOTAL_ON, (isnull(TONG_OFF.NhaMay1,0)+ isnull(TONG_OFF.NhaMay2,0)) AS TOTAL_OFF, (isnull(TONG_NULL.NhaMay1,0)+ isnull(TONG_NULL.NhaMay2,0)) AS TOTAL_CDD, isnull(TONG_FULL.NhaMay1,0) as TOTAL_NM1, isnull(TONG_FULL.NhaMay2,0) as TOTAL_NM2, isnull(TONG_ON.NhaMay1,0) as ON_NM1, isnull(TONG_ON.NhaMay2,0) as ON_NM2, isnull(TONG_OFF.NhaMay1,0) as OFF_NM1, isnull(TONG_OFF.NhaMay2,0) as OFF_NM2, isnull(TONG_NULL.NhaMay1,0) as CDD_NM1, isnull(TONG_NULL.NhaMay2,0) as CDD_NM2 FROM fn_DiemDanhTong_FULL(@tradate) AS TONG_FULL LEFT JOIN (SELECT * FROM fn_DiemDanhTong_ON(@tradate)) AS TONG_ON ON (TONG_ON.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) LEFT JOIN (SELECT * FROM fn_DiemDanhTong_OFF(@tradate)) AS TONG_OFF ON (TONG_OFF.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) LEFT JOIN (SELECT * FROM fn_DiemDanhTong_NULL(@tradate)) AS TONG_NULL ON (TONG_NULL.SUBDEPTNAME = TONG_FULL.SUBDEPTNAME) ORDER BY MAINDEPTNAME DESC, SUBDEPTNAME ASC";
                kqua = await asyncQuery(query);
                // console.log(kqua);
                res.send({ tk_status: "OK", data: kqua });
            }
            else {
                res.send({tk_status:"NO_LEADER"});
            }
            
        })()
    }
    else if (qr['command'] == 'checklogin')
    {
        console.log(qr['command']);        
        res.send({tk_status:"ok",data:req.payload_data});
    }
    else if (qr['command'] == 'pqc1_output_data')
    {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $vitrilamviec = req.payload_data['ATT_GROUP_CODE'];
            let $subdeptname = req.payload_data['SUBDEPTNAME'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                let kqua;                             
                let query = "SELECT TOP 100 * FROM ZTBPQC1TABLE ORDER BY PQC1_ID DESC";
                kqua = await asyncQuery(query);                
                res.send({tk_status:"OK", data:kqua});
            }
            else {
                res.send({tk_status:"NO_LEADER"});
            }            
        })()
    }
    else if (qr['command'] == 'pqc2_output_data')
    {
        (async () => {
            let EMPL_NO = req.payload_data['EMPL_NO'];
            let JOB_NAME = req.payload_data['JOB_NAME'];
            let $vitrilamviec = req.payload_data['ATT_GROUP_CODE'];
            let $subdeptname = req.payload_data['SUBDEPTNAME'];
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                let kqua;                             
                let query = "SELECT TOP 100 PQC2_ID,PROCESS_LOT_NO,LINEQC_PIC,TIME1,TIME2,TIME3,CHECK1,CHECK2,CHECK3,REMARK,INS_DATE,UPD_DATE,PQC1_ID FROM ZTBPQC2TABLE";
                kqua = await asyncQuery(query);                
                res.send({tk_status:"OK", data:kqua});
            }
            else {
                res.send({tk_status:"NO_LEADER"});
            }            
        })()
    }
    else if (qr['command'] == 'pqc3_output_data')
    {
        (async () => {            
            let JOB_NAME = req.payload_data['JOB_NAME'];            
            if (JOB_NAME == 'Leader' || JOB_NAME == 'Sub Leader' || JOB_NAME == 'Dept Staff') {
                let kqua;                             
                let query = `SELECT TOP 100 [PQC3_ID],[PROCESS_LOT_NO],[LINEQC_PIC],[OCCURR_TIME],[INSPECT_QTY],[DEFECT_QTY],[DEFECT_PHENOMENON],[DEFECT_IMAGE_LINK],[REMARK],[INS_DATE],[UPD_DATE],[PQC1_ID]   FROM [dbo].[ZTBPQC3TABLE] ORDER BY PQC3_ID DESC`;
                kqua = await queryDB(query);                
                res.send(kqua);
            }
            else {
                res.send({tk_status:"NO_LEADER"});
            }            
        })()
    }
    else if (qr['command'] == 'insertchat') {        
        (async () => {            
            let EMPL_NO = qr['EMPL_NO']; 
            let CHATTIME = moment().format('YYYY-MM-DD HH:mm:ss');
            //console.log(CHATTIME);
            let MESSAGE = qr['MESSAGE'];  
            let checkkq = "OK";
            let setpdQuery = "INSERT INTO ZCHATTB (CTR_CD,EMPL_NO,CHATTIME,MESSAGE) VALUES ('002','" + EMPL_NO + "','" + CHATTIME + "',N'" + MESSAGE + "')";
            checkkq = await asyncQuery2(setpdQuery);
            if (checkkq != "OK") {                
                res.send({tk_status:"NG",message:"Có lỗi khi lưu tin nhắn lên hệ thống"});
            }
            else {
                res.send({tk_status: "OK"});
            }   
            
        })()
    }
    else if (qr['command'] == 'getchat') {
        (async () => {           
            let kqua;
            let query = "SELECT TOP 1000 ZCHATTB.EMPL_NO, CHATTIME, ZCHATTB.MESSAGE, ZTBEMPLINFO.MIDLAST_NAME, ZTBEMPLINFO.FIRST_NAME FROM ZCHATTB JOIN ZTBEMPLINFO ON (ZTBEMPLINFO.EMPL_NO = ZCHATTB.EMPL_NO) ORDER BY CHATTIME ASC";
            kqua = await asyncQuery(query);           
            if(kqua == 0)
            {
                res.send({tk_status: "NG", data: kqua});
            }
            else
            {
                res.send({tk_status: "OK", data: kqua});
            }
            
        })()
    }
    else if (qr['command'] == 'temp_info') {
       
        (async () => {           
            let PARAM = qr['param'];
            let OPTION = qr['option'];
            let query ="";
            switch (OPTION) {
              case "empl_name":
                query ="SELECT EMPL_NAME FROM M010 WHERE EMPL_NO='" + PARAM + "'";              
                break;
              case "gname":
                query ="SELECT TOP 1 G_NAME FROM P501 JOIN P500 ON (P501.PROCESS_IN_DATE =P500.PROCESS_IN_DATE AND P501.PROCESS_IN_NO =P500.PROCESS_IN_NO AND P501.PROCESS_IN_SEQ =P500.PROCESS_IN_SEQ) JOIN M100 ON (M100.G_CODE = P500.G_CODE) WHERE PROCESS_LOT_NO='"+ PARAM+"'";              
                break;
              default:

            }     
            //console.log(query);
            kqua = await asyncQuery(query);           
            if(kqua == 0)
            {
                res.send({tk_status: "NG", data: kqua});
            }
            else
            {
                res.send({tk_status: "OK", data: kqua});
            }
            
        })()
        

    }
    else if (qr['command'] == 'insert_pqc1') 
    {
        (async () => {            
            let DATA = qr['data']; 
            console.log(DATA);
            let currenttime = moment().format('YYYY-MM-DD HH:mm:ss'); 
            let checkkq = "OK";
            let setpdQuery = "  INSERT INTO [dbo].[ZTBPQC1TABLE]([CTR_CD],[PROCESS_LOT_NO],[LINEQC_PIC],[PROD_PIC],[PROD_LEADER],[LINE_NO],[STEPS],[CAVITY],[SETTING_OK_TIME],[FACTORY],[REMARK],[INS_DATE],[UPD_DATE]) VALUES ('002','"+DATA.PROCESS_LOT_NO+"','"+DATA.LINEQC_PIC+"','"+DATA.PROD_PIC+"','"+DATA.PROD_LEADER+"','"+DATA.LINE_NO+"','"+DATA.STEPS+"','"+DATA.CAVITY+"','"+DATA.SETTING_OK_TIME+"','"+DATA.FACTORY+"','"+DATA.REMARK+"','"+currenttime+"','"+currenttime+"')";
            
            checkkq = await asyncQuery2(setpdQuery);
            if (checkkq != "OK") {                
                res.send({tk_status:"NG",message:"Có lỗi khi nhập data lên hệ thống"});
            }
            else {
                res.send({tk_status: "OK"});
            } 
        })()
    }
    else if (qr['command'] == 'insert_sample_qty_pqc1') 
    {
        (async () => {            
            let DATA = qr['data'];  
            let checkkq = ""; 
            let  errflag = "OK";
            for(let i=0;i<DATA.length;i++)
            {                
                let setpdQuery = "UPDATE ZTBPQC1TABLE SET INSPECT_SAMPLE_QTY=" + DATA[i].INSPECT_SAMPLE_QTY + " WHERE PQC1_ID=" + DATA[i].PQC1_ID;
                console.log(setpdQuery);
                checkkq = await queryDB(setpdQuery); 
                if(checkkq.tk_status == "NG")
                {
                    errflag = "NG";

                }
            }          
            console.log(errflag);
            if(errflag == "NG")
            {
                res.send({tk_status:errflag,message:"Có lỗi gì đó trong quá trình update"});
            }
            else
            {
                res.send({tk_status:"OK",message:"Update data thành công !"});
            }                       
        })()
    }
    else if (qr['command'] == 'getpqc1id')
    {
        (async () => {
            let EMPL_NO = qr['EMPL_NO'];
            let PROCESS_LOT_NO = qr['PROCESS_LOT_NO'];
            let kqua;                             
            let query = `SELECT PQC1_ID FROM ZTBPQC1TABLE WHERE LINEQC_PIC='${EMPL_NO}' AND PROCESS_LOT_NO='${PROCESS_LOT_NO}'`;
            //console.log(query);
            kqua = await queryDB(query);                
            res.send(kqua);
                  
        })()
    }
    else if (qr['command'] == 'insert_pqc2') 
    {
        (async () => {            
            let DATA = qr['data']; 
            console.log(DATA);
            let currenttime = moment().format('YYYY-MM-DD HH:mm:ss'); 
            let checkkq = "OK";
            let setpdQuery = `INSERT INTO ZTBPQC2TABLE (CTR_CD, PROCESS_LOT_NO, LINEQC_PIC, TIME1, TIME2, TIME3, CHECK1, CHECK2, CHECK3, REMARK, INS_DATE, UPD_DATE, PQC1_ID) VALUES ('002','${DATA.PROCESS_LOT_NO}','${DATA.LINEQC_PIC}','${DATA.CHECKSHEET.TIME1}','${DATA.CHECKSHEET.TIME2}','${DATA.CHECKSHEET.TIME3}','${DATA.CHECKSHEET.CHECK1}','${DATA.CHECKSHEET.CHECK2}','${DATA.CHECKSHEET.CHECK3}','${DATA.REMARK}','${currenttime}','${currenttime}',${DATA.PQC1_ID})`;     
            console.log(setpdQuery);       
            checkkq = await queryDB(setpdQuery);
            res.send(checkkq);            
        })()
    }
    else if (qr['command'] == 'insert_pqc3') 
    {
        (async () => {            
            let DATA = qr['data']; 
            console.log(DATA);
            let currenttime = moment().format('YYYY-MM-DD HH:mm:ss'); 
            let checkkq = "OK";
            let setpdQuery = `INSERT INTO ZTBPQC3TABLE (CTR_CD, PROCESS_LOT_NO, LINEQC_PIC, OCCURR_TIME, INSPECT_QTY, DEFECT_QTY, DEFECT_PHENOMENON, DEFECT_IMAGE_LINK, REMARK, INS_DATE, UPD_DATE, PQC1_ID) VALUES('002','${DATA.PROCESS_LOT_NO}','${DATA.LINEQC_PIC}','${DATA.OCCURR_TIME}',${DATA.INSPECT_QTY},${DATA.DEFECT_QTY},N'${DATA.DEFECT_PHENOMENON}','${DATA.DEFECT_IMAGE_LINK}',N'${DATA.REMARK}','${currenttime}','${currenttime}',${DATA.PQC1_ID})`;     
            //console.log(setpdQuery);       
            checkkq = await queryDB(setpdQuery);
            res.send(checkkq);            
        })()
    }
    else if (qr['command'] == 'getpqcdata')
    {
        (async () => {
            let DATA = qr['DATA'];    
            console.log(DATA);       
            let kqua;   
            let query = ``;
            switch (DATA.SELECTION) {
                case 1:
                    console.log("case 1");
                    query = `SELECT ZTBPQC1TABLE.PQC1_ID, M110.CUST_NAME_KD, P400.PROD_REQUEST_NO, P400.PROD_REQUEST_QTY, P400.PROD_REQUEST_DATE, ZTBPQC1TABLE.PROCESS_LOT_NO, M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, M010.EMPL_NAME AS LINEQC_PIC, M010_A.EMPL_NAME AS PROD_PIC, M010_B.EMPL_NAME AS PROD_LEADER, ZTBPQC1TABLE.LINE_NO, ZTBPQC1TABLE.STEPS, ZTBPQC1TABLE.CAVITY,ZTBPQC1TABLE.SETTING_OK_TIME, ZTBPQC1TABLE.FACTORY, ZTBPQC1TABLE.INSPECT_SAMPLE_QTY, ZTBPOTable_A.PROD_PRICE , (ZTBPOTable_A.PROD_PRICE*ZTBPQC1TABLE.INSPECT_SAMPLE_QTY) AS SAMPLE_AMOUNT ,ZTBPQC1TABLE.REMARK, ZTBPQC1TABLE.INS_DATE, ZTBPQC1TABLE.UPD_DATE FROM ZTBPQC1TABLE LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC1TABLE.PROCESS_LOT_NO) LEFT JOIN (SELECT DISTINCT PROCESS_IN_DATE,PROCESS_IN_NO,PROCESS_IN_SEQ, PROD_REQUEST_NO FROM P500 WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ) LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO) LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE) LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC1TABLE.LINEQC_PIC) LEFT JOIN (SELECT EMPL_NAME, EMPL_NO FROM M010) AS M010_A ON (M010_A.EMPL_NO = ZTBPQC1TABLE.PROD_PIC) LEFT JOIN (SELECT EMPL_NAME, EMPL_NO FROM M010) AS M010_B ON (M010_B.EMPL_NO = ZTBPQC1TABLE.PROD_LEADER) LEFT JOIN (SELECT DISTINCT G_CODE, MIN(PROD_PRICE) AS PROD_PRICE FROM ZTBPOTable GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE) JOIN M110 ON (M110.CUST_CD = P400.CUST_CD) ${generate_condition_pqc1(DATA.ALLTIME,DATA.FROMDATE, DATA.TODATE,DATA.CUST_NAME,DATA.G_CODE, DATA.G_NAME_KD,DATA.PROD_REQUEST_NO, DATA.PROCESS_LOT_NO,DATA.PQC_ID,DATA.FACTORY)} ORDER BY PQC1_ID DESC`;
                    break;
                case 2:
                    console.log("case 2");
                    query = `SELECT TOP 100 ZTBPQC1_A_TABLE .FACTORY,ZTBPQC1_A_TABLE.PROCESS_LOT_NO,ZTBPQC1_A_TABLE.G_NAME,ZTBPQC1_A_TABLE.G_NAME_KD,ZTBPQC1_A_TABLE.LINEQC_PIC,ZTBPQC1_A_TABLE.PROD_PIC,ZTBPQC1_A_TABLE.PROD_LEADER,ZTBPQC1_A_TABLE.LINE_NO,ZTBPQC1_A_TABLE.STEPS,ZTBPQC1_A_TABLE.CAVITY,ZTBPQC1_A_TABLE.SETTING_OK_TIME,  ZTBPQC1_A_TABLE.INSPECT_SAMPLE_QTY,ZTBPQC1_A_TABLE.PROD_PRICE,ZTBPQC1_A_TABLE.SAMPLE_AMOUNT,ZTBPQC1_A_TABLE.REMARK,  ZTBPQC2TABLE.PQC1_ID,ZTBPQC2TABLE.PQC2_ID,ZTBPQC2TABLE.TIME1,ZTBPQC2TABLE.TIME2,ZTBPQC2TABLE.TIME3,ZTBPQC2TABLE.CHECK1,ZTBPQC2TABLE.CHECK2,ZTBPQC2TABLE.CHECK3,ZTBPQC2TABLE.REMARK,ZTBPQC2TABLE.INS_DATE,ZTBPQC2TABLE.UPD_DATE FROM ZTBPQC2TABLE LEFT JOIN   (SELECT ZTBPQC1TABLE.PQC1_ID,   ZTBPQC1TABLE.PROCESS_LOT_NO,   M100.G_NAME,   M100.G_NAME_KD,   M010.EMPL_NAME AS LINEQC_PIC,   M010_A.EMPL_NAME AS PROD_PIC,   M010_B.EMPL_NAME AS PROD_LEADER,   ZTBPQC1TABLE.LINE_NO,   ZTBPQC1TABLE.STEPS,   ZTBPQC1TABLE.CAVITY,   ZTBPQC1TABLE.SETTING_OK_TIME,   ZTBPQC1TABLE.FACTORY,   ZTBPQC1TABLE.INSPECT_SAMPLE_QTY,   ZTBPOTable_A.PROD_PRICE,   (ZTBPOTable_A.PROD_PRICE*ZTBPQC1TABLE.INSPECT_SAMPLE_QTY) AS SAMPLE_AMOUNT,   ZTBPQC1TABLE.REMARK,   ZTBPQC1TABLE.INS_DATE,   ZTBPQC1TABLE.UPD_DATE    FROM ZTBPQC1TABLE    LEFT JOIN      (SELECT *       FROM P501       WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC1TABLE.PROCESS_LOT_NO)    LEFT JOIN      (SELECT DISTINCT PROCESS_IN_DATE,   PROCESS_IN_NO,   PROCESS_IN_SEQ,   PROD_REQUEST_NO       FROM P500       WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ)    LEFT JOIN P400 ON (P500_A.PROD_REQUEST_NO = P400.PROD_REQUEST_NO)    LEFT JOIN M100 ON (M100.G_CODE = P400.G_CODE)    LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC1TABLE.LINEQC_PIC)    LEFT JOIN      (SELECT EMPL_NAME,  EMPL_NO       FROM M010) AS M010_A ON (M010_A.EMPL_NO = ZTBPQC1TABLE.PROD_PIC)    LEFT JOIN      (SELECT EMPL_NAME,  EMPL_NO       FROM M010) AS M010_B ON (M010_B.EMPL_NO = ZTBPQC1TABLE.PROD_LEADER)    LEFT JOIN      (SELECT DISTINCT G_CODE,   MIN(PROD_PRICE) AS PROD_PRICE       FROM ZTBPOTable       GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE)) AS ZTBPQC1_A_TABLE ON (ZTBPQC2TABLE.PQC1_ID = ZTBPQC1_A_TABLE.PQC1_ID)  ORDER BY PQC2_ID DESC`;
                    break;
                case 3:
                    console.log("case 3");
                    query = `SELECT ZTBPQC3TABLE.PQC3_ID, ZTBPQC1TABLE_B.FACTORY, M110.CUST_NAME_KD, P500_A.PROD_REQUEST_NO,  P500_A.PROD_REQUEST_DATE, ZTBPQC3TABLE.PROCESS_LOT_NO,  M100.G_CODE, M100.G_NAME, M100.G_NAME_KD, ZTBPOTable_A.PROD_PRICE, M010.EMPL_NAME AS LINEQC_PIC_NAME, ZTBPQC1TABLE_B.PROD_PIC, ZTBPQC1TABLE_B.PROD_LEADER, ZTBPQC1TABLE_B.LINE_NO, ZTBPQC3TABLE.LINEQC_PIC,ZTBPQC3TABLE.OCCURR_TIME,ZTBPQC3TABLE.INSPECT_QTY,ZTBPQC3TABLE.DEFECT_QTY, ZTBPQC3TABLE.DEFECT_PHENOMENON,ZTBPQC3TABLE.DEFECT_IMAGE_LINK,ZTBPQC3TABLE.REMARK FROM ZTBPQC3TABLE LEFT JOIN (SELECT * FROM P501 WHERE INS_DATE > '2021-06-01 00:00:00') AS P501_A ON (P501_A.PROCESS_LOT_NO = ZTBPQC3TABLE.PROCESS_LOT_NO) LEFT JOIN (SELECT DISTINCT PROCESS_IN_DATE,PROCESS_IN_NO,PROCESS_IN_SEQ, PROD_REQUEST_NO,G_CODE, PROD_REQUEST_DATE FROM P500 WHERE INS_DATE > '2021-06-01 00:00:00' ) AS P500_A ON (P501_A.PROCESS_IN_DATE = P500_A.PROCESS_IN_DATE  AND P501_A.PROCESS_IN_NO = P500_A.PROCESS_IN_NO  AND P501_A.PROCESS_IN_SEQ = P500_A.PROCESS_IN_SEQ) LEFT JOIN M100 ON (M100.G_CODE = P500_A.G_CODE) LEFT JOIN (SELECT DISTINCT G_CODE, MIN(PROD_PRICE) AS PROD_PRICE FROM ZTBPOTable GROUP BY G_CODE) AS ZTBPOTable_A ON (ZTBPOTable_A.G_CODE = M100.G_CODE) LEFT JOIN M010 ON (M010.EMPL_NO = ZTBPQC3TABLE.LINEQC_PIC) LEFT JOIN (SELECT ZTBPQC1TABLE.CTR_CD,ZTBPQC1TABLE.PQC1_ID,ZTBPQC1TABLE.PROCESS_LOT_NO,ZTBPQC1TABLE.LINEQC_PIC,ZTBPQC1TABLE.PROD_PIC,ZTBPQC1TABLE.PROD_LEADER,ZTBPQC1TABLE.LINE_NO,ZTBPQC1TABLE.STEPS,ZTBPQC1TABLE.CAVITY,ZTBPQC1TABLE.SETTING_OK_TIME,ZTBPQC1TABLE.FACTORY,ZTBPQC1TABLE.INSPECT_SAMPLE_QTY,ZTBPQC1TABLE.REMARK,ZTBPQC1TABLE.INS_DATE,ZTBPQC1TABLE.UPD_DATE  FROM ZTBPQC1TABLE JOIN ZTBPQC3TABLE ON ZTBPQC1TABLE.PQC1_ID = ZTBPQC3TABLE.PQC1_ID) AS ZTBPQC1TABLE_B ON (ZTBPQC1TABLE_B.PQC1_ID = ZTBPQC3TABLE.PQC1_ID) JOIN P400 ON (P400.PROD_REQUEST_NO = P500_A.PROD_REQUEST_NO) JOIN M110 ON ( M110.CUST_CD= P400.CUST_CD) ${generate_condition_pqc3(DATA.ALLTIME,DATA.FROMDATE, DATA.TODATE, DATA.CUST_NAME, DATA.G_CODE, DATA.G_NAME_KD, DATA.PROD_REQUEST_NO, DATA.PROCESS_LOT_NO, DATA.PQC_ID, DATA.FACTORY)} ORDER BY PQC3_ID DESC`;
                    break;
                default:
                    console.log("invalid case selected");
                    break;
            }
                       
            console.log(query);
            kqua = await queryDB(query);                
            res.send(kqua);                  
        })()
    }
    else if (qr['command'] == 'checkktdtc')
    {
        (async () => {            
            let DATA = qr['DATA'];
            let kqua;                             
            let query = `SELECT * FROM (SELECT  P500.M_CODE, SUBSTRING(P501.M_LOT_NO,0,7) AS LOT_TO, M090.WIDTH_CD FROM P501 JOIN P500 ON (P501.PROCESS_IN_DATE =P500.PROCESS_IN_DATE AND P501.PROCESS_IN_NO =P500.PROCESS_IN_NO AND P501.PROCESS_IN_SEQ =P500.PROCESS_IN_SEQ) JOIN M090 ON  (M090.M_CODE = P500.M_CODE) WHERE P501.PROCESS_LOT_NO='${DATA.PROCESS_LOT_NO}') AS AA JOIN (SELECT TRANGTHAI, M_CODE, SIZE, LOTCMS FROM NHAP_NVL) AS BB ON (AA.LOT_TO = BB.LOTCMS AND AA.M_CODE =  BB.M_CODE AND AA.WIDTH_CD = BB.SIZE)`;
            console.log(query);
            kqua = await queryDB(query);                
            res.send(kqua);
                  
        })()
    }
    else {
        console.log(qr['command']);        
        res.send({tk_status:"ok",data:req.payload_data});
    }
}
