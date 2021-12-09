$(document).ready(function(){
    $('#eye').click(function(){
        $(this).toggleClass('open');
        $(this).children('i').toggleClass('fa-eye-slash fa-eye');
        if($(this).hasClass('open')){
            $(this).prev().attr('type', 'text');
        }else{
            $(this).prev().attr('type', 'password');
        }
    });
    $("#login_bt").click(function(event) {   
        event.preventDefault();         
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
            success: function(result) { 
                //alert(result);
                //console.log(result);   
                var Jresult = JSON.parse(result);
                //console.log(Jresult.tk_status);
                //console.log(Jresult.token_content);
                if(Jresult.tk_status == 'ok') 
                {  
                    //console.log(Jresult.token_content);
                    //setCookie('token',Jresult.token_content,1);
                    window.location.href = "/";     
                }   
                else
                {
                    alert("Tên đăng nhập hoặc mật khẩu sai");
                }
            }
        });
    });
});