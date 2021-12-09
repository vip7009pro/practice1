$(document).ready(function () {
    $("#myTopnav").fadeIn(250);
    var chat_bt = 1;
    var menu_value = 1;
    function IsJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
    function summary() {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'diemdanhsummary'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else if (Jresult.tk_status == 'NO_LEADER') {
                    //alert("Bạn không phải learder, mời phắn");
                }
                else {
                    var res = getHTMLTABLE2_SummaryTB(JSON.parse(Jresult.data), 'summarytb');
                    $("#summary").empty().append(res);
                }
            }
        });
    }
    summary();
    $("#notification_bar").hide();
    $("#chat_panel").hide();
    function isValid(date, h1, m1, h2, m2) {
        return true;
        var h = date.getHours();
        var m = date.getMinutes();
        return (h1 < h || h1 == h && m1 <= m) && (h < h2 || h == h2 && m <= m2);
    }
    function myFunction() {
        alert("Check topnav");
        var x = document.getElementById("myTopnav");
        if (x.className === "topnav") {
            x.className += " responsive";
        } else {
            x.className = "topnav";
        }
    }
    function setCookie(cname, cvalue, exdays) {
        const d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }
    var socket = io.connect('14.160.33.94:3005');
    socket.on("notification", function (data) {
        if (data.type == 'diemdanh') {
            if (data.on_off == '0') {
                $("#notifi_content").empty().append(data.time + ":<br> " + data.empl_no + ": Điểm danh NGHỈ LÀM");
            }
            else {
                $("#notifi_content").empty().append(data.time + ":<br> " + data.empl_no + ": Điểm danh ĐI LÀM");
            }
        }
        else if (data.type == 'tangca') {
        }
        att_refresh();
        //cpd();
        $("#notification_bar").fadeIn(150);
        $("#notification_bar").fadeOut(5000);
    });
    socket.on("send", function (data) {
        console.log(data);
        if (data.username == $('#chat_name').text()) {
            $("#chat_panel").show();
            // $("#hide_show_button2").text('-');
            $("#chat_content").append("<p class='message'>" + "<b style='color: blue'>" + data.chattime + ' </b> : ' + "<b style='color: green'>" + data.username + " </b>: " + data.message + "</p>")
        }
        else {
            $("#chat_content").append("<p class='message'>" + "<b style='color: blue'>" + data.chattime + ' </b> : ' + "<b style='color: red'>" + data.username + " </b>: " + data.message + "</p>")
        }
        var myDiv = document.getElementById("chat_content");
        myDiv.scrollTop = myDiv.scrollHeight;
    });
    $(".nav-item").click(function () {
        //$("#myTopnav").fadeOut(250);
    });
    $("#nav_show_btn").click(function () {
        if (menu_value == 1) {
            menu_value = 0;
            $("#myTopnav").fadeOut(250);
        }
        else {
            menu_value = 1;
            $("#myTopnav").fadeIn(250);
        }
    });
    $("#chat_sendMessage").on('click', function () {
        var username = $('#chat_name').text();
        var message = $('#chat_message').val();
        var chattime = new Date();
        var ct = chattime.getFullYear() + "-" + (chattime.getMonth() + 1) + "-" + chattime.getDate() + "  " + chattime.getHours() + ":" + chattime.getMinutes() + ":" + chattime.getSeconds();
        if (username == '' || message == '') {
            alert('Please enter name and message!!');
        } else {
            //Gửi dữ liệu cho socket
            socket.emit('send', { username: username, message: message, chattime: ct });
            $('#chat_message').val('');
        }
    });
    $('#chat_message').on('keydown', function (e) {
        if (e.which == 13) {
            var username = $('#chat_name').text();
            var message = $('#chat_message').val();
            var chattime = new Date();
            var ct = chattime.getFullYear() + "-" + (chattime.getMonth() + 1) + "-" + chattime.getDate() + "  " + chattime.getHours() + ":" + chattime.getMinutes() + ":" + chattime.getSeconds();
            if (username == '' || message == '') {
                alert('Please enter name and message!!');
            } else {
                //Gửi dữ liệu cho socket
                socket.emit('send', { username: username, message: message, chattime: ct });
                $('#chat_message').val('');
            }
            return false;
        }
        else if (e.which == 27) {
            if (chat_bt == 0) {
                $("#chat_panel").fadeIn(250);
                chat_bt = 1;
            }
            else {
                $("#chat_panel").fadeOut(250);
                chat_bt = 0;
            }
        }
    });
    $("#loading_image").hide();
    var background_refresh = 0;
    $(document).ajaxSend(function () {
        if (background_refresh == 0) {
            $("#loading_image").fadeIn(250);
        } else {
            background_refresh = 0;
        }
    });
    $(document).ajaxComplete(function () {
        if (background_refresh == 0) {
            $("#loading_image").fadeOut(250);
        } else {
            background_refresh = 0;
        }
    });
    $("#hide_show_button").click(function () {
        //$("#empl_info").fadeOut(250);
        // $("#empl_info").toggle();
        if ($("#hide_show_button").text() == '+') {
            $("#empl_info").fadeIn(250);
            $("#hide_show_button").text('-');
        }
        else {
            $("#empl_info").fadeOut(250);
            $("#hide_show_button").text('+');
        }
    });
    $("#hide_show_button2").click(function () {
        //$("#chat_panel").toggle();
        if (chat_bt == 1) {
            $("#chat_panel").fadeIn(250);
            chat_bt = 0;
        }
        else {
            $("#chat_panel").fadeOut(250);
            chat_bt = 1;
        }
    });
    $(".nav-tabs a").click(function () {
        $(this).tab('show');
    });
    $('#tangcayesno').change(function () {
        var SelectedText = $('option:selected', this).text();
        var SelectedValue = $('option:selected', this).val();
        if (SelectedText == "Có tăng ca") {
            $("#over_start").prop('disabled', false);
            $("#over_finish").prop('disabled', false);
            $("#overtime_submit").prop('disabled', false);
        } else {
            $("#over_start").prop('disabled', true);
            $("#over_finish").prop('disabled', true);
            $("#overtime_submit").prop('disabled', true);
        }
    });
    $('#ca_nghi').change(function () {
        var SelectedText = $('option:selected', this).text();
        var SelectedValue = $('option:selected', this).val();
        if (SelectedText == "Ca ngày") {
            //alert("bạn chọn ca ngày");
            $("#time_1").text("(08:00)");
            $("#time_2").text("(17:00)");
        } else {
            //alert("bạn chọn ca đêm");
            $("#time_1").text("(20:00)");
            $("#time_2").text("(05:00)");
        }
    });
    $("#off_history").click(function () {
        //alert("Lịch sử nghỉ");
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'tralichsu'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                if (Jresult.tk_status == 'NO') {
                    alert("Chưa từng làm đơn nghỉ nào !");
                }
                else {
                    var res = getHTMLTABLE2_lichsunghi(JSON.parse(Jresult.data), 'off_his_table')
                    $("#off_data").empty().append(res);
                    $('#off_his_table').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    $("#attendance").click(function () {
        var team_name_list1 = $('#team_name').val();
        //alert("vao diem danh nhom");		
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'diemdanh',
                team_name_list: team_name_list1
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                if (result == 'NO_LEADER') {
                    alert("Bạn ko fai leader,mời phắn");
                }
                else if (result == 'NO_DATA') {
                    alert("Không có data");
                }
                else {
                    alert("Có " + JSON.parse(result).length + " người nha");
                    var res = getHTMLTABLE2_diemdanhnhom(JSON.parse(result), 'empl_tb');
                    $("#empl_list").empty().append(res);
                    $('#empl_tb').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    $("#smt_button").click(function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'dangkynghi',
                canghi: $("#ca_nghi").val(),
                ngaybatdau: $("#nghi_from_date").val(),
                ngayketthuc: $("#nghi_to_date").val(),
                reason_name: $("#reason").val(),
                remark_content: $("#nghi_remark").val()
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                if (result == 'OK') {
                    alert("Đăng ký nghỉ thành công");
                }
                else {
                    alert("Lỗi: đã đăng ký vào ngày đó rồi, ko đky trùng đc nữa");
                }
                // alert(result);
            }
        });
    });
    $("#overtime_submit").click(function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'dangkytangca',
                tangcayesno: $("#tangcayesno").val(),
                over_start: $("#over_start").val(),
                over_finish: $("#over_finish").val()
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                alert(result);
            }
        });
    });
    $("#overtime_submit_confirm").click(function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'confirmtangca',
                tangcayesno: $("#tangcayesno").val(),
                over_start: $("#over_start").val(),
                over_finish: $("#over_finish").val()
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                alert(result);
            }
        });
    });
    $("#login_bt").click(function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'login',
                user: $('#login_id').val(),
                pass: $('#login_pw').val()
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                //console.log(Jresult.tk_status);
                //console.log(Jresult.token_content);
                if (Jresult.tk_status == 'ok') {
                    //console.log(Jresult.token_content);
                    //setCookie('token',Jresult.token_content,1);
                    window.location.href = "/";
                }
                else {
                    alert("Tên đăng nhập hoặc mật khẩu sai");
                }
            }
        });
    });
    $("#logout_bt").click(function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'logout'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                window.location.href = "/login2";
            }
        });
    });
    //tra dang ky nghi cua ban than
    $("#check_approve").click(function () {
        var dateObj = new Date();
        dateObj.toLocaleString('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        var month = dateObj.getUTCMonth() + 1;
        //months from 1-12
        if (month < 10) {
            month = "0" + month;
        }
        var day = dateObj.getUTCDate();
        var year = dateObj.getUTCFullYear();
        var oldday = day - 4;
        if (day < 10) {
            day = "0" + day;
        }
        if (oldday < 10) {
            oldday = "0" + oldday;
        }
        var newdate = "" + year + "-" + month + "-" + day + "";
        var olddate = "" + year + "-" + month + "-" + oldday + "";
        $("#tra_from_date").val(newdate);
        $("#tra_to_date").val(newdate);
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'pheduyet'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else if (Jresult.tk_status == 'error') {
                    alert("Có lỗi");
                }
                else if (Jresult.tk_status == 'NO_LEADER') {
                    alert("Bạn không phải leader, mời phắn");
                }
                else {
                    var res = getHTMLTABLE2_pheduyet(JSON.parse(Jresult.data), 'approve_table');
                    $("#off_approve").empty().append(res);
                    $('#approve_table').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    ///diemdanh tab click
    $("#diemdanh_history").click(function () {
        var newdate = new Date();
        var olddate = new Date();
        newdate.toLocaleString('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        olddate.toLocaleString('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        var month2 = newdate.getUTCMonth() + 1;
        var day2 = newdate.getUTCDate();
        if (month2 < 10) {
            month2 = "0" + month2;
        }
        if (day2 < 10) {
            day2 = "0" + day2;
        }
        //alert(month2);
        //alert(day2);
        var date2 = "" + newdate.getUTCFullYear() + "-" + month2 + "-" + day2 + "";
        //alert(date2);
        $("#dd_from_date").val(date2);
        $("#dd_to_date").val(date2);
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'mydiemdanh',
                from_date: date2,
                to_date: date2
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else {
                    var res = getHTMLTABLE2_mydiemdanh(JSON.parse(result), 'mydiemdanh_tb');
                    $("#attendance_history").empty().append(res);
                    $('#mydiemdanh_tb').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    $("#setteam").click(function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'setteamtab'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                if (result == 'NO_LEADER') {
                    alert("Bạn ko fai leader,mời phắn");
                }
                else if (result == 'NO_DATA') {
                    alert("Không có data");
                }
                else {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        var res = getHTMLTABLE2_dieuchuyenteam(JSON.parse(result), 'hr_modify_table');
                        $("#hr_modify_list").empty().append(res);
                        $('#hr_modify_table').DataTable({
                            "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                        });
                        $('.dataTables_length').addClass('bs-select');
                    }
                }
            }
        });
    });
    //tra phe duyet all 1 bp	
    $("#trapheduyet").click(function () {
        var frm_date = $("#tra_from_date").val();
        var t_date = $("#tra_to_date").val();
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'pheduyet',
                from_date: frm_date,
                to_date: t_date
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else if (Jresult.tk_status == 'error') {
                    alert("Có lỗi");
                }
                else if (Jresult.tk_status == 'NO_LEADER') {
                    alert("Bạn không phải leader, mời phắn");
                }
                else {
                    var res = getHTMLTABLE2_pheduyet(JSON.parse(Jresult.data), 'approve_table');
                    $("#off_approve").empty().append(res);
                    $('#approve_table').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    ///tra lich su diem danh cua ban than - tradiemdanh button
    $("#getdiemdanh").click(function () {
        var frm_date = $("#dd_from_date").val();
        var t_date = $("#dd_to_date").val();
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'mydiemdanh',
                from_date: frm_date,
                to_date: t_date
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else {
                    var res = getHTMLTABLE2_mydiemdanh(JSON.parse(result), 'mydiemdanh_tb');
                    $("#attendance_history").empty().append(res);
                    $('#mydiemdanh_tb').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    ///diemdanhtotal tab click
    $("#attendance_total").click(function () {
        //setInterval(att_refresh,5000);
        //alert("vao diem danh total");		
        var newdate = new Date();
        var olddate = new Date();
        newdate.toLocaleString('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        olddate.toLocaleString('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        var month2 = newdate.getUTCMonth() + 1;
        var day2 = newdate.getUTCDate();
        if (month2 < 10) {
            month2 = "0" + month2;
        }
        if (day2 < 10) {
            day2 = "0" + day2;
        }
        //alert(month2);
        //alert(day2);
        var date2 = "" + newdate.getUTCFullYear() + "-" + month2 + "-" + day2 + "";
        //alert(date2);
        $("#from_date_total").val(date2);
        $("#to_date_total").val(date2);
        //$('#nghisinhcheckbox').prop('checked',false);
        var nghisinhvalue = $('#nghisinhcheckbox').prop('checked');
        var maindeptname = $('#main_deparment_name').val();
        var subdeptname = $('#deparment_name').val();
        //subdeptname = 'QC';
        //alert("Nghi sinh value= " + nghisinhvalue);
        //alert("Subdeptname= " + subdeptname);
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'diemdanh_total',
                from_date_total: date2,
                to_date_total: date2,
                nghisinhvalue: nghisinhvalue,
                SUBDEPTNAME: subdeptname,
                MAINDEPTNAME: maindeptname,
                team_name_total: ''
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else if (Jresult.tk_status == 'NO_LEADER') {
                    alert("Bạn không phải learder, mời phắn");
                }
                else {
                    console.log(Jresult.data);
                    alert("Có " + JSON.parse(Jresult.data).length + " người nha");
                    var res = getHTMLTABLE2_diemdanhtong(JSON.parse(Jresult.data), 'empl_tb_total');
                    $("#total_att_table").empty().append(res);
                    $('#empl_tb_total').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    ///diemdanhnhom button click 
    $("#nhom_att_button").click(function () {
        //alert("Bam nut tra team");
        //$('#nghisinhcheckbox').prop('checked',false);	
        var team_name = $('#team_name').val();
        //alert(team_name);
        //alert("Nghi sinh value= " + nghisinhvalue);
        //alert("Subdeptname= " + subdeptname);
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'diemdanh',
                team_name_list: team_name
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                if (result == 'NO_LEADER') {
                    alert("Bạn ko fai leader,mời phắn");
                }
                else if (result == 'NO_DATA') {
                    alert("Không có data");
                }
                else {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        alert("Có " + JSON.parse(result).length + " người nha");
                        var res = getHTMLTABLE2_diemdanhnhom(JSON.parse(result), 'empl_tb');
                        $("#empl_list").empty().append(res);
                        $('#empl_tb').DataTable({
                            "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                        });
                        $('.dataTables_length').addClass('bs-select');
                    }
                }
            }
        });
    });
    ///diemdanhtotal button click 
    $("#total_att_button").click(function () {
        //alert("Tra tong");
        var frm_date = $("#from_date_total").val();
        var t_date = $("#to_date_total").val();
        //$('#nghisinhcheckbox').prop('checked',false);
        var nghisinhvalue = $('#nghisinhcheckbox').prop('checked');
        var maindeptname = $('#main_deparment_name').val();
        var subdeptname = $('#deparment_name').val();
        var team_name_total1 = $('#team_name_total').val();
        //alert("Team Name = " +team_name_total1);
        //alert("Nghi sinh value= " + nghisinhvalue);
        //alert("Subdeptname= " + subdeptname);
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'diemdanh_total',
                from_date_total: frm_date,
                to_date_total: t_date,
                nghisinhvalue: nghisinhvalue,
                SUBDEPTNAME: subdeptname,
                team_name_total: team_name_total1,
                MAINDEPTNAME: maindeptname
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else if (Jresult.tk_status == 'NO_LEADER') {
                    alert("Bạn không phải learder, mời phắn");
                }
                else {
                    console.log(Jresult.data);
                    alert("Có " + JSON.parse(Jresult.data).length + " người nha");
                    var res = getHTMLTABLE2_diemdanhtong(JSON.parse(Jresult.data), 'empl_tb_total');
                    $("#total_att_table").empty().append(res);
                    $('#empl_tb_total').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    $(document).on('click', '.approve_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(1)");
        $tds2 = $row.find("td:nth-child(2)");
        $tds_on_off = $row.find("td:nth-child(20)");
        $tds_lydo = $row.find("td:nth-child(17)");
        var $on_off = "";
        var $lydo = "";
        $.each($tds_on_off, function () {
            $on_off = $(this).text();
        });
        $.each($tds_lydo, function () {
            $on_lydooff = $(this).text();
        });
        //alert($on_off);
        if ($on_off != 1 || $on_lydooff == 'Nửa phép') {
            $.each($tds, function () {
                //console.log($(this).text());
                //alert($(this).text() + " Phê duyệt");
                var OFF_ID = $(this).text();
                $.ajax({
                    url: "/api",
                    type: "post",
                    dataType: "text",
                    data: {
                        command: 'setpheduyet',
                        off_id: OFF_ID,
                        pheduyetvalue: '1'
                    },
                    async: true,
                    timeout: 10000,
                    success: function (result) {
                        //$("#off_approve").empty().append(result);
                        var Jresult = JSON.parse(result);
                        if (Jresult.tk_status == 'ng') {
                            alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                            window.location.href = "/";
                        }
                        else if (Jresult.tk_status == 'ERROR') {
                            alert("Có lỗi");
                        }
                        else if (Jresult.tk_status == 'NO_LEADER') {
                            alert("Bạn không phải leader, mời phắn");
                        }
                        else {
                            $tds2.html("<b><p style='color:LightGreen;'>Đã duyệt</p> </b>");
                        }
                    }
                });
            });
        }
        else {
            alert("Không phê duyệt được khi đã điểm danh đi làm !, điểm danh nghỉ rồi mới phê duyệt được");
        }
    });
    $(document).on('click', '.deny_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(1)");
        $tds2 = $row.find("td:nth-child(2)");
        $.each($tds, function () {
            //console.log($(this).text());
            //alert($(this).text()+ " Từ chối");
            var OFF_ID = $(this).text();
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'setpheduyet',
                    off_id: OFF_ID,
                    pheduyetvalue: '0'
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        $tds2.html("<b><p style='color:red;'>Từ chối</p> </b>");
                        console.log(result);
                    }
                    //$("#off_approve").empty().append(result);
                }
            });
        });
    });
    $(document).on('click', '.ON_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(4)");
        $tds_donnghi = $row.find("td:nth-child(19)");
        $tds_nuaphep = $row.find("td:nth-child(25)");
        var $don_nghi = "";
        var $nuaphep = "";
        $.each($tds_donnghi, function () {
            $don_nghi = $(this).text();
            //alert($don_nghi);
        });
        $.each($tds_nuaphep, function () {
            $nuaphep = $(this).text();
            //alert($nuaphep); 
        });
        //alert($nuaphep);
        var $daduyet = 'Đã duyệt';
        var $np = 'Nửa phép';
        if ($don_nghi == $daduyet && $nuaphep != $np) {
            alert("Người này đã được duyệt đơn nghỉ hôm nay, Chỉ có thể đánh nghỉ, hủy duyệt mới điểm danh được");
        } else {
            //alert('vao day ok');
            $.each($tds, function () {
                //console.log($(this).text());
                //alert($(this).text() + " Phê duyệt");
                var EMPL_NO1 = $(this).text();
                //alert(EMPL_NO1);
                $.ajax({
                    url: "/api",
                    type: "post",
                    dataType: "text",
                    data: {
                        command: 'setdiemdanh',
                        diemdanhvalue: '1',
                        EMPL_NO: EMPL_NO1
                    },
                    async: true,
                    timeout: 10000,
                    success: function (result) {
                        var Jresult = JSON.parse(result);
                        if (Jresult.tk_status == 'ng') {
                            alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                            window.location.href = "/";
                        }
                        else {
                            var chattime = new Date();
                            var ct = chattime.getFullYear() + "-" + (chattime.getMonth() + 1) + "-" + chattime.getDate() + "  " + chattime.getHours() + ":" + chattime.getMinutes() + ":" + chattime.getSeconds();
                            notification_data = {
                                type: 'diemdanh',
                                empl_no: EMPL_NO1,
                                on_off: '1',
                                time: ct
                            };
                            socket.emit('notification', notification_data);
                            //alert(result);
                            //$("#off_approve").empty().append(result);
                            $tds2.html("<b><p style='color:LightGreen;'>Đi làm</p> </b> <button type='button' class='RESET_button btn btn-warning'> RESET </button>");
                        }
                        //console.log(result);
                    }
                });
            });
        }
    });
    $(document).on('click', '.OFF_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(4)");
        $.each($tds, function () {
            //console.log($(this).text());
            //alert($(this).text() + " Phê duyệt");
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'setdiemdanh',
                    diemdanhvalue: '0',
                    EMPL_NO: EMPL_NO1
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        var chattime = new Date();
                        var ct = chattime.getFullYear() + "-" + (chattime.getMonth() + 1) + "-" + chattime.getDate() + "  " + chattime.getHours() + ":" + chattime.getMinutes() + ":" + chattime.getSeconds();
                        notification_data = {
                            type: 'diemdanh',
                            empl_no: EMPL_NO1,
                            on_off: '0',
                            time: ct
                        };
                        socket.emit('notification', notification_data);
                        //$("#off_approve").empty().append(result);
                        $tds2.html("<b><p style='color:red;'>Nghỉ làm</p> </b> <button type='button' class='RESET_button btn btn-warning'> RESET </button>");
                    }
                }
            });
        });
    });
    $(document).on('click', '.RESET_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(4)");
        $.each($tds, function () {
            if ((isValid(new Date(), 17, 10, 20, 10) || isValid(new Date(), 5, 10, 8, 10))) {
                $tds2.html("<button type='button' class='ON_button btn btn-success'> LÀM </button> <button type='button' class='OFF_button btn btn-danger'> NGHỈ </button>");
            }
            else {
                alert("Chỉ RESET được trong khoảng thời gian 7h-> 8h10 hoặc 19h -> 20h10");
            }
        });
        //$("#off_approve").empty().append(result);
        //$tds2.html("<button type='button' class='ON_button btn btn-success'> LÀM </button> <button type='button' class='OFF_button btn btn-danger'> NGHỈ </button>");
    });
    $(document).on('click', '.RESET_TC_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            // if (isValid(new Date(), 8, 00, 15, 30)) 
            if (1 == 1) {
                $tds2.html("<button type='button' class='K_TC_button btn btn-success'> K_T_C </button> <button type='button' class='TC0206_button btn btn-outline-light'> 02-06 </button> <button type='button' class='TC_NGAY_button btn btn-outline-light'> 17-20 </button> <button type='button' class='TC_NGAY2_button btn btn-outline-light'> 17-18 </button><button type='button' class='TC_DEM_button btn btn-outline-light'> 05-08 </button><button type='button' class='TC_16_button btn btn-outline-light'> 16-20 </button>");
            }
            else {
                alert("Chỉ RESET được trong khoảng thời gian 7h-> 15h30");
            }
        });
    });
    $(document).on('click', '.cancel_button', function () {
        if (confirm('Bạn có chắc chắn muốn hủy phê duyệt nghỉ?')) {
            var $row = $(this).closest("tr")
                , $tds = $row.find("td:nth-child(1)");
            $tds2 = $row.find("td:nth-child(2)");
            $.each($tds, function () {
                //console.log($(this).text());
                //alert($(this).text()+ " Từ chối");
                var OFF_ID = $(this).text();
                $.ajax({
                    url: "/api",
                    type: "post",
                    dataType: "text",
                    data: {
                        command: 'setpheduyet',
                        off_id: OFF_ID,
                        pheduyetvalue: '3'
                    },
                    async: true,
                    timeout: 10000,
                    success: function (result) {
                        var Jresult = JSON.parse(result);
                        if (Jresult.tk_status == 'ng') {
                            alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                            window.location.href = "/";
                        }
                        else {
                            $tds2.html("<b><p style='color:yellow;'>Đã xóa</p> </b>");
                            console.log(result);
                        }
                    }
                });
            });
            // Save it!
            //console.log('Thing was saved to the database.');
        } else {
            // Do nothing!
            alert('Giữ nguyên trạng thái phê duyệt !');
            console.log('Giữ nguyên trạng thái phê duyệt !');
        }
    });
    $(document).on('click', '#test_table', function () {
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'testlargetb'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else {
                    var res = getHTMLTABLE22(JSON.parse(Jresult.data), 'tbkinhdoanh');
                    $("#testtb").empty().append(res);
                    $('#tbkinhdoanh').DataTable({
                        "lengthMenu": [[-1, 10, 25, 50, 100], ["All", 10, 25, 50, 100]]
                    });
                    $('.dataTables_length').addClass('bs-select');
                }
            }
        });
    });
    att_refresh();
    setInterval(att_refresh, 10000);
    setInterval(summary, 10000);
    function att_refresh() {
        //alert("Refresh diem danh");
        background_refresh = 1;
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'att_refresh'
            },
            async: true,
            timeout: 10000,
            success: function (result) {
                console.log(result);
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else {
                    $("#att_refresh").empty().append(Jresult.htmldata);
                }
                //console.log(result);
            }
        });
    }
    function cpd() {
        background_refresh = 1;
        $.ajax({
            url: "/api",
            type: "post",
            dataType: "text",
            data: {
                command: 'check_chua_pd'
            },
            async: true,
            timeout: 100000,
            success: function (result) {
                var Jresult = JSON.parse(result);
                if (Jresult.tk_status == 'ng') {
                    alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                    window.location.href = "/";
                }
                else {
                    console.log(result);
                    if (result != 0) {
                        alert("Có " + result + " đơn nghỉ chưa được phê duyệt, của bộ phận nào vào check ngay  ~!");
                    }
                }
            }
        });
        console.log("Refresh chua phe duyet");
    }
    cpd();
    $(document).on('click', '.K_TC_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);				
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'dangkytangca2',
                    tangcayesno1: '0',
                    EMPL_NO: EMPL_NO1,
                    over_start: '',
                    over_finish: ''
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        if (Jresult.tk_status == 'OK') {
                            $tds2.html("<b><p style='color:#d6f789;'>TC</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button>");
                        }
                        else {
                            alert("Lỗi rồi !");
                        }
                    }
                }
            });
        });
    });
    $(document).on('click', '.TC_16_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);				
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'dangkytangca2',
                    tangcayesno1: '1',
                    EMPL_NO: EMPL_NO1,
                    over_start: '1600',
                    over_finish: '2000'
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        //alert(result);
                        if (Jresult.tk_status == 'OK') {
                            $tds2.html("<b><p style='color:#d6f789;'>TC</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button>");
                        }
                        else {
                            alert("Lỗi rồi !");
                        }
                    }
                }
            });
        });
    });
    $(document).on('click', '.TC0206_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);				
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'dangkytangca2',
                    tangcayesno1: '1',
                    EMPL_NO: EMPL_NO1,
                    over_start: '0200',
                    over_finish: '0600'
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        //alert(result);
                        if (Jresult.tk_status == 'OK') {
                            $tds2.html("<b><p style='color:#d6f789;'>TC</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button>");
                        }
                        else {
                            alert("Lỗi rồi !");
                        }
                    }
                }
            });
        });
    });
    $(document).on('click', '.TC_NGAY_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);				
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'dangkytangca2',
                    tangcayesno1: '1',
                    EMPL_NO: EMPL_NO1,
                    over_start: '1700',
                    over_finish: '2000'
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    console.log(result);
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        if (Jresult.tk_status == 'OK') {
                            $tds2.html("<b><p style='color:#d6f789;'>TC</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button>");
                        }
                        else {
                            alert("Lỗi rồi !");
                        }
                    }
                }
            });
        });
    });
    $(document).on('click', '.TC_NGAY2_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);				
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'dangkytangca2',
                    tangcayesno1: '1',
                    EMPL_NO: EMPL_NO1,
                    over_start: '1700',
                    over_finish: '1800'
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        if (Jresult.tk_status == 'OK') {
                            $tds2.html("<b><p style='color:#d6f789;'>TC</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button>");
                        }
                        else {
                            alert("Lỗi rồi !");
                        }
                    }
                }
            });
        });
    });
    $(document).on('click', '.TC_DEM_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $tds2 = $row.find("td:nth-child(5)");
        $.each($tds, function () {
            var EMPL_NO1 = $(this).text();
            //alert(EMPL_NO1);				
            $.ajax({
                url: "/api",
                type: "post",
                dataType: "text",
                data: {
                    command: 'dangkytangca2',
                    tangcayesno1: '1',
                    EMPL_NO: EMPL_NO1,
                    over_start: '0500',
                    over_finish: '0800'
                },
                async: true,
                timeout: 10000,
                success: function (result) {
                    var Jresult = JSON.parse(result);
                    if (Jresult.tk_status == 'ng') {
                        alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                        window.location.href = "/";
                    }
                    else {
                        if (Jresult.tk_status == 'OK') {
                            $tds2.html("<b><p style='color:#d6f789;'>TC</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button>");
                        }
                        else {
                            alert("Lỗi rồi !");
                        }
                    }
                }
            });
        });
    });
    $(document).on('click', '.SET_TEAM1_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $workshiftname = $row.find("td:nth-child(4)");
        $tds2 = $row.find("td:nth-child(5)");
        if (confirm('Bạn có chắc chắn muốn chuyển team?')) {
            $.each($tds, function () {
                var EMPL_NO1 = $(this).text();
                //alert(EMPL_NO1);
                $.ajax({
                    url: "/api",
                    type: "post",
                    dataType: "text",
                    data: {
                        command: 'setteambt',
                        EMPL_NO: EMPL_NO1,
                        teamvalue: '1'
                    },
                    async: true,
                    timeout: 10000,
                    success: function (result) {
                        var Jresult = JSON.parse(result);
                        if (Jresult.tk_status == 'ng') {
                            alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                            window.location.href = "/";
                        }
                        else {
                            //alert(result);				
                            $workshiftname.html("<b align='center'> TEAM 1 </b>");
                            $tds2.html("<button type='button' class='SET_TEAM2_button btn btn-danger'> SET_TEAM__2 </button><button type='button' class='SET_TEAM_HC_button btn btn-success'> SET_TEAMHC </button>");
                        }
                    }
                });
            });
        }
    });
    $(document).on('click', '.SET_TEAM2_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $workshiftname = $row.find("td:nth-child(4)");
        $tds2 = $row.find("td:nth-child(5)");
        if (confirm('Bạn có chắc chắn muốn chuyển team?')) {
            $.each($tds, function () {
                var EMPL_NO1 = $(this).text();
                //alert(EMPL_NO1);
                $.ajax({
                    url: "/api",
                    type: "post",
                    dataType: "text",
                    data: {
                        command: 'setteambt',
                        EMPL_NO: EMPL_NO1,
                        teamvalue: '2'
                    },
                    async: true,
                    timeout: 10000,
                    success: function (result) {
                        //alert(result);			
                        var Jresult = JSON.parse(result);
                        if (Jresult.tk_status == 'ng') {
                            alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                            window.location.href = "/";
                        }
                        else {
                            $workshiftname.html("<b align='center'> TEAM 2 </b>");
                            $tds2.html("<button type='button' class='SET_TEAM1_button btn btn-primary'> SET_TEAM__1 </button><button type='button' class='SET_TEAM_HC_button btn btn-success'> SET_TEAMHC </button>");
                        }
                    }
                });
            });
        }
    });
    $(document).on('click', '.SET_TEAM_HC_button', function () {
        var $row = $(this).closest("tr")
            , $tds = $row.find("td:nth-child(2)");
        $workshiftname = $row.find("td:nth-child(4)");
        $tds2 = $row.find("td:nth-child(5)");
        if (confirm('Bạn có chắc chắn muốn chuyển team?')) {
            $.each($tds, function () {
                var EMPL_NO1 = $(this).text();
                //alert(EMPL_NO1);
                $.ajax({
                    url: "/api",
                    type: "post",
                    dataType: "text",
                    data: {
                        command: 'setteambt',
                        EMPL_NO: EMPL_NO1,
                        teamvalue: '0'
                    },
                    async: true,
                    timeout: 10000,
                    success: function (result) {
                        //alert(result);				
                        var Jresult = JSON.parse(result);
                        if (Jresult.tk_status == 'ng') {
                            alert("Phiên đăng nhập hết hạn, đăng nhập lại nhé");
                            window.location.href = "/";
                        }
                        else {
                            $workshiftname.html("<b align='center'>Hành Chính</b>");
                            $tds2.html("<button type='button' class='SET_TEAM1_button btn btn-primary'> SET_TEAM__1 </button><button type='button' class='SET_TEAM2_button btn btn-danger'> SET_TEAM__2 </button>");
                        }
                    }
                });
            });
        }
    });
    $("#changeview_empl").click(function () {
        //alert("Change view");
        $("#empl_tb").toggleClass("table-responsive");
    });
    $("#changeview_duyet").click(function () {
        //alert("Change view");
        $("#approve_table").toggleClass("table-responsive");
        changeview_offhistory
    });
    $("#changeview_offhistory").click(function () {
        //alert("Change view");
        $("#off_his_table").toggleClass("table-responsive");
    });
    $("#changeview_diemdanh").click(function () {
        //alert("Change view");
        $("#mydiemdanh_tb").toggleClass("table-responsive");
    });
    $("#changeview_diemdanh_total").click(function () {
        //alert("Change view");
        $("#empl_tb_total").toggleClass("table-responsive");
    });
    $("#changeview_hr_modify").click(function () {
        //alert("Change view");
        $("#hr_modify_table").toggleClass("table-responsive");
    });
});
