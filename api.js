var sql = require("mssql");
var jwt = require('jsonwebtoken');
require('dotenv').config();
function returnDateFormat(today) {
    let year = today.getFullYear();
    let month = today.getMonth();
    let date = today.getDate();
    if (month + 1 < 10) month = '0' + (month);
    if (date < 10) date = '0' + date;
    return year + "-" + (month + 1) + "-" + date;
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
    console.log(rightnow + ":" + qr['command']);
    if (qr['command'] == 'check_chua_pd') {
        (async () => {
            var today = new Date();
            var today_format = returnDateFormat(today);
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
    else {
        console.log(qr['command']);        
        res.send({tk_status:"ok",data:req.payload_data});
    }
}
