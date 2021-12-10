function getHTMLTABLE22(data, table_id)
{
    //console.log(Object.keys(data[0]));
    var header_array = Object.keys(data[0]).map((element)=>{
    return "<th>" + element + "</th>";
    });
    var header_string = header_array.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        for(var element in data[i]) 
        {
            //console.log(element);               
            tr.push("<td>" + data[i][element] + "</td>")
        }
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_lichsunghi(data, table_id)
{
    /* console.log(Object.keys(data[0]));
    var header_array = Object.keys(data[0]).map((element)=>{
    return "<th>" + element + "</th>";
    }); */
    var header_array = ['OFF_ID','EMPL_NO','MIDLAST_NAME','FIRST_NAME','REQUEST_DATE','APPLY_DATE',
    'CA_NGHI','REASON_NAME','REMARK','APPROVAL_STATUS'];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        for(var element in data[i]) 
        {
            if(element == 'REQUEST_DATE')
            {                 
                tr.push("<td>" + data[i][element].slice(0,10) + "</td>")
            }
            else if(element == 'APPLY_DATE')
            {     
                tr.push("<td>" + data[i][element].slice(0,10) + "</td>")
            }
            else if(element == 'APPROVAL_STATUS')
            {     
                switch (data[i][element])
                {
                    case 'Từ chối':
                        tr.push("<td> <b> <p style='color:red;'>Từ chối</p> </b> </td>");
                    break;
                    case 'Đã duyệt':
                        tr.push("<td> <b><p style='color:#d6f789;'>Đã duyệt</p> </b></td>");
                    break;
                    case 'Chờ duyệt':
                        tr.push("<td> <b><p style='color:white;'>Chờ duyệt</p> </b></td>");
                    break;
                    case 'Đã hủy':
                        tr.push("<td> <b><p style='color:yellow;'>Đã Hủy</p> </b></td>");
                    break;
                }
            }
            else 
            {                           
                tr.push("<td>" + data[i][element] + "</td>")
            }
        }
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_mydiemdanh(data, table_id)
{
    /* console.log(Object.keys(data[0]));
    var header_array = Object.keys(data[0]).map((element)=>{
    return "<th>" + element + "</th>";
    }); */
    var header_array = ['EMPL_NO','CMS_ID','APPLY_DATE','DIEM_DANH','MIDLAST_NAME','FIRST_NAME','PHONE_NUMBER','SEX_NAME','WORK_STATUS_NAME','FACTORY_NAME','JOB_NAME','WORK_SHIF_NAME','WORK_POSITION_NAME','SUBDEPTNAME','MAINDEPTNAME','REQUEST_DATE','APPROVAL_STATUS','OFF_ID','CA_NGHI','ON_OFF','OVERTIME_INFO','OVERTIME','REASON_NAME'];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        tr.push("<td>" + data[i]['EMPL_NO']+ "</td>");
        tr.push("<td>" + data[i]['CMS_ID']+ "</td>");
        tr.push("<td>" + data[i]['APPLY_DATE'].slice(0,10)+ "</td>");
        switch (data[i]['ON_OFF'])
        {
            case 0:
                tr.push("<td> <b> <p style='color:red;'>Nghỉ làm</p> </b> </td>");
            break;
            case 1:
                tr.push("<td> <b><p style='color:#d6f789;'>Đi làm</p> </b></td>");
            break;           
        }
        tr.push("<td>" + data[i]['MIDLAST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FIRST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['PHONE_NUMBER']+ "</td>");
        tr.push("<td>" + data[i]['SEX_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_STATUS_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FACTORY_NAME']+ "</td>");
        tr.push("<td>" + data[i]['JOB_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_SHIF_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_POSITION_NAME']+ "</td>");
        tr.push("<td>" + data[i]['SUBDEPTNAME']+ "</td>");
        tr.push("<td>" + data[i]['MAINDEPTNAME']+ "</td>");
        if(data[i]['REQUEST_DATE']==null)
        {
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REQUEST_DATE'].slice(0,10)+ "</td>");
            tr.push("<td>" + data[i]['APPROVAL_STATUS']+ "</td>");
            tr.push("<td>" + data[i]['OFF_ID']+ "</td>");
            tr.push("<td>" + data[i]['CA_NGHI']+ "</td>");
        }
        tr.push("<td>" + data[i]['ON_OFF']+ "</td>");
        if(data[i]['OVERTIME_INFO']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['OVERTIME_INFO']+ "</td>");
        }       
        tr.push("<td>" + data[i]['OVERTIME']+ "</td>");
        if(data[i]['REASON_NAME']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REASON_NAME']+ "</td>"); 
        }        
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_pheduyet(data, table_id)
{
    console.log(data);
    /* console.log(Object.keys(data[0]));
    var header_array = Object.keys(data[0]).map((element)=>{
    return "<th>" + element + "</th>";
    }); */
    var header_array = ['OFF_ID','APPROVAL_STATUS','EMPL_NO','CMS_ID','MIDLAST_NAME','FIRST_NAME','DOB','POSITION_NAME','FACTORY_NAME','WORK_SHIF_NAME','JOB_NAME','MAINDEPT_NAME','SUBDEPT_NAME','WORK_POSITION_NAME','REQUEST_DATE','APPLY_DATE','REASON_NAME','CA_NGHI','REMARK','ON_OFF'];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        tr.push("<td>" + data[i]['OFF_ID']+ "</td>"); 
        switch (data[i]['APPROVAL_STATUS'])
        {
            case 0:
                tr.push("<td> <b> <p style='color:red;'>Từ chối</p> </b> <button type='button' class='cancel_button btn btn-success'> Xóa </button> </td>");
            break;
            case 1:
                tr.push("<td> <b><p style='color:#d6f789;'>Đã duyệt</p> </b> <button type='button' class='cancel_button btn btn-success'> Xóa </button></td>");
            break;
            case 2:
                tr.push("<td><button type='button' class='approve_button btn btn-success'> Phê duyệt </button> <button type='button' class='deny_button btn btn-danger'> Từ chối </button> </td>");
            break;
            case 3:
                tr.push("<td> <b><p style='color:yellow;'>Đã Hủy</p> </b><button type='button' class='cancel_button btn btn-success'> Xóa </button></td>");
            break;
        }
        tr.push("<td>" + data[i]['EMPL_NO']+ "</td>");
        tr.push("<td>" + data[i]['CMS_ID']+ "</td>");
        tr.push("<td>" + data[i]['MIDLAST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FIRST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['DOB'].slice(0,10)+ "</td>");
        tr.push("<td>" + data[i]['POSITION_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FACTORY_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_SHIF_NAME']+ "</td>");
        tr.push("<td>" + data[i]['JOB_NAME']+ "</td>");
        tr.push("<td>" + data[i]['MAINDEPTNAME']+ "</td>");
        tr.push("<td>" + data[i]['SUBDEPTNAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_POSITION_NAME']+ "</td>");
        tr.push("<td>" + data[i]['REQUEST_DATE'].slice(0,10)+ "</td>");
        tr.push("<td>" + data[i]['APPLY_DATE'].slice(0,10)+ "</td>");
        tr.push("<td>" + data[i]['REASON_NAME']+ "</td>");
        tr.push("<td>" + data[i]['CA_NGHI']+ "</td>");
        tr.push("<td>" + data[i]['REMARK']+ "</td>");
        if(data[i]['ON_OFF']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['ON_OFF']+ "</td>");
        }
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_diemdanhnhom(data, table_id)
{
    /* console.log(Object.keys(data[0]));
    var header_array = Object.keys(data[0]).map((element)=>{
    return "<th>" + element + "</th>";
    }); */
    var header_array = ['STT','EMPL_NO','CMS_ID','DIEM_DANH','DANG_KY_TANG_CA','MIDLAST_NAME','FIRST_NAME','PHONE_NUMBER','SEX_NAME','WORK_STATUS_NAME','FACTORY_NAME','JOB_NAME','WORK_SHIF_NAME','WORK_POSITION_NAME','SUBDEPTNAME','MAINDEPTNAME','REQUEST_DATE','APPLY_DATE','APPROVAL_STATUS','OFF_ID','CA_NGHI','ON_OFF','OVERTIME_INFO','OVERTIME','REASON_NAME'];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        tr.push("<td>" +(i+1)+ "</td>");
        tr.push("<td>" + data[i]['EMPL_NO']+ "</td>");
        tr.push("<td>" + data[i]['CMS_ID']+ "</td>");
        //tr.push("<td>" + data[i]['DIEM_DANH']+ "</td>");
        switch (data[i]['ON_OFF'])
        {
            case 0:
                tr.push("<td> <b> <p style='color:red;'>Nghỉ làm</p> </b> <button type='button' class='RESET_button btn btn-warning'> RESET </button></td>");
            break;
            case 1:
                tr.push("<td> <b><p style='color:#d6f789;'>Đi làm</p> </b><button type='button' class='RESET_button btn btn-warning'> RESET </button></td>");
            break;  
            default:
                tr.push("<td><button type='button' class='ON_button btn btn-success'> LÀM </button> <button type='button' class='OFF_button btn btn-danger'> NGHỈ </button> </td>");
            break;                         
        }
        //tr.push("<td>" + data[i]['DANG_KY_TANG_CA']+ "</td>");
        switch (data[i]['OVERTIME'])
        {
            case 0:
                tr.push("<td> <b> <p style='color:red;'>Không tăng ca</p> </b> <button type='button' class='RESET_TC_button btn btn-warning'> RESET </button></td>");
            break;
            case 1:
                tr.push("<td><b><p style='color:#d6f789;'>Tăng ca</p> </b><button type='button' class='RESET_TC_button btn btn-warning'> RESET </button></td>");
            break;  
            default:
                tr.push("<td><button type='button' class='K_TC_button btn btn-success'> K_T_C </button> <button type='button' class='TC0206_button btn btn-outline-light'> 02-06 </button> <button type='button' class='TC_NGAY_button btn btn-outline-light'> 17-20 </button> <button type='button' class='TC_NGAY2_button btn btn-outline-light'> 17-18 </button><button type='button' class='TC_DEM_button btn btn-outline-light'> 05-08 </button><button type='button' class='TC_16_button btn btn-outline-light'> 16-20 </button></td>");
            break;                         
        }
        tr.push("<td>" + data[i]['MIDLAST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FIRST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['PHONE_NUMBER']+ "</td>");
        tr.push("<td>" + data[i]['SEX_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_STATUS_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FACTORY_NAME']+ "</td>");
        tr.push("<td>" + data[i]['JOB_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_SHIF_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_POSITION_NAME']+ "</td>");
        tr.push("<td>" + data[i]['SUBDEPTNAME']+ "</td>");
        tr.push("<td>" + data[i]['MAINDEPTNAME']+ "</td>");
        if(data[i]['REQUEST_DATE']==null)
        {
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REQUEST_DATE'].slice(0,10)+ "</td>");
            tr.push("<td>" + data[i]['APPLY_DATE'].slice(0,10)+ "</td>");
            //tr.push("<td>" + data[i]['APPROVAL_STATUS']+ "</td>");
            switch (data[i]['APPROVAL_STATUS'])
            {
                case 0:
                    tr.push("<td> <b> <p style='color:red;'>Từ chối</p> </b> </td>");
                break;
                case 1:
                    tr.push("<td><b><p style='color:#d6f789;'>Đã duyệt</p></b></td>");
                break;
                case 2:
                    tr.push("<td> <b><p style='color:white;'>Chờ duyệt</p> </b></td>");
                break;   
                case 3:
                    tr.push("<td> <b><p style='color:yellow;'>Đã hủy</p> </b></td>");
                break;               
            }
            tr.push("<td>" + data[i]['OFF_ID']+ "</td>");
            tr.push("<td>" + data[i]['CA_NGHI']+ "</td>");
        }
        tr.push("<td>" + data[i]['ON_OFF']+ "</td>");
        if(data[i]['OVERTIME_INFO']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['OVERTIME_INFO']+ "</td>");
        }
       // tr.push("<td>" + data[i]['OVERTIME']+ "</td>");
        if(data[i]['OVERTIME']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['OVERTIME']+ "</td>");
        }
        if(data[i]['REASON_NAME']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REASON_NAME']+ "</td>");
        }
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_diemdanhtong(data, table_id)
{
    /* console.log(Object.keys(data[0]));
    var header_array = Object.keys(data[0]).map((element)=>{
    return "<th>" + element + "</th>";
    }); */
    var header_array = ['STT','EMPL_NO','CMS_ID','DIEM_DANH','MIDLAST_NAME','FIRST_NAME','PHONE_NUMBER','SEX_NAME','WORK_STATUS_NAME','FACTORY_NAME','JOB_NAME','WORK_SHIF_NAME','WORK_POSITION_NAME','SUBDEPTNAME','MAINDEPTNAME','REQUEST_DATE','APPLY_DATE','APPROVAL_STATUS','OFF_ID','CA_NGHI','ON_OFF','OVERTIME_INFO','OVERTIME','REASON_NAME','LY_DO','DDDATE','QUE_QUAN', 'ADD_VILLAGE','ADD_COMMUNE','ADD_DISTRICT', 'ADD_PROVINCE'];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        tr.push("<td>" +(i+1)+ "</td>");
        tr.push("<td>" + data[i]['EMPL_NO']+ "</td>");
        tr.push("<td>" + data[i]['CMS_ID']+ "</td>");
       // tr.push("<td>" + data[i]['DIEM_DANH']+ "</td>");
        switch(data[i]['ON_OFF'])
        {
            case 0:
                tr.push("<td> <b> <p style='color:red;'>Nghỉ làm</p> </b> </td>");
            break;
            case 1:
                tr.push("<td> <b><p style='color:#d6f789;'>Đi làm</p> </b></td>");                
            break;
            default:
                tr.push("<td> <b><p style='color:#E59866;'>Chưa điểm danh</p> </b></td>");
            break;
        }
        tr.push("<td>" + data[i]['MIDLAST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FIRST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['PHONE_NUMBER']+ "</td>");
        tr.push("<td>" + data[i]['SEX_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_STATUS_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FACTORY_NAME']+ "</td>");
        tr.push("<td>" + data[i]['JOB_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_SHIF_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_POSITION_NAME']+ "</td>");
        tr.push("<td>" + data[i]['SUBDEPTNAME']+ "</td>");
        tr.push("<td>" + data[i]['MAINDEPTNAME']+ "</td>");
        if(data[i]['REQUEST_DATE']==null)
        {
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REQUEST_DATE'].slice(0,10)+ "</td>");
            tr.push("<td>" + data[i]['APPLY_DATE'].slice(0,10)+ "</td>");
            //tr.push("<td>" + data[i]['APPROVAL_STATUS']+ "</td>");
            switch (data[i]['APPROVAL_STATUS'])
            {
                case 0:
                    tr.push("<td> <b> <p style='color:red;'>Từ chối</p> </b> </td>");
                break;
                case 1:
                    tr.push("<td><b><p style='color:#d6f789;'>Đã duyệt</p></b></td>");
                break;
                case 2:
                    tr.push("<td> <b><p style='color:white;'>Chờ duyệt</p> </b></td>");
                break;   
                case 3:
                    tr.push("<td> <b><p style='color:yellow;'>Đã hủy</p> </b></td>");
                break;               
            }
            tr.push("<td>" + data[i]['OFF_ID']+ "</td>");
            tr.push("<td>" + data[i]['CA_NGHI']+ "</td>");
        }
        if(data[i]['OVERTIME_INFO']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['ON_OFF']+ "</td>");
        }
        //tr.push("<td>" + data[i]['OVERTIME_INFO']+ "</td>");
        if(data[i]['OVERTIME_INFO']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['OVERTIME_INFO']+ "</td>");
        }
        if(data[i]['OVERTIME']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['OVERTIME']+ "</td>");
        }
        if(data[i]['REASON_NAME']==null)
        {
            tr.push("<td></td>");
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REASON_NAME']+ "</td>");
            tr.push("<td>" + data[i]['REMARK']+ "</td>");
        }        
        if(data[i]['DDDATE']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['DDDATE'].slice(0,10)+ "</td>");
        }
        tr.push("<td>" + data[i]['HOMETOWN']+ "</td>");
        tr.push("<td>" + data[i]['ADD_VILLAGE']+ "</td>");
        tr.push("<td>" + data[i]['ADD_COMMUNE']+ "</td>");
        tr.push("<td>" + data[i]['ADD_DISTRICT']+ "</td>");
        tr.push("<td>" + data[i]['ADD_PROVINCE']+ "</td>");        
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_dieuchuyenteam(data, table_id)
{
    var header_array = ['STT','EMPL_NO','CMS_ID','WORK_SHIF_NAME','SET_TEAM','MIDLAST_NAME','FIRST_NAME','PHONE_NUMBER','SEX_NAME','WORK_STATUS_NAME','FACTORY_NAME','JOB_NAME','WORK_POSITION_NAME','SUBDEPTNAME','MAINDEPTNAME','REQUEST_DATE','APPLY_DATE','APPROVAL_STATUS','OFF_ID','CA_NGHI','ON_OFF','OVERTIME_INFO','OVERTIME','REASON_NAME'];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        tr.push("<td>" +(i+1)+ "</td>");        
        tr.push("<td>" + data[i]['EMPL_NO']+ "</td>");
        tr.push("<td>" + data[i]['CMS_ID']+ "</td>");
        tr.push("<td><b>" + data[i]['WORK_SHIF_NAME']+ "</b></td>");
        switch(data[i]['WORK_SHIFT_CODE'])
        {
            case 0:
                tr.push("<td><button type='button' class='SET_TEAM1_button btn btn-primary'> SET_TEAM__1 </button><button type='button' class='SET_TEAM2_button btn btn-danger'> SET_TEAM__2 </button></td>");
            break;
            case 1:
                tr.push("<td><button type='button' class='SET_TEAM2_button btn btn-danger'> SET_TEAM__2 </button><button type='button' class='SET_TEAM_HC_button btn btn-success'> SET_TEAMHC </button></td>");
            break;
            case 2:
                tr.push("<td><button type='button' class='SET_TEAM1_button btn btn-primary'> SET_TEAM__1 </button><button type='button' class='SET_TEAM_HC_button btn btn-success'> SET_TEAMHC </button></td>");
            break;
        }
        tr.push("<td>" + data[i]['MIDLAST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FIRST_NAME']+ "</td>");
        tr.push("<td>" + data[i]['PHONE_NUMBER']+ "</td>");
        tr.push("<td>" + data[i]['SEX_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_STATUS_NAME']+ "</td>");
        tr.push("<td>" + data[i]['FACTORY_NAME']+ "</td>");
        tr.push("<td>" + data[i]['JOB_NAME']+ "</td>");
        tr.push("<td>" + data[i]['WORK_POSITION_NAME']+ "</td>");
        tr.push("<td>" + data[i]['SUBDEPTNAME']+ "</td>");
        tr.push("<td>" + data[i]['MAINDEPTNAME']+ "</td>");
        if(data[i]['REQUEST_DATE']==null)
        {
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REQUEST_DATE'].slice(0,10)+ "</td>");
            tr.push("<td>" + data[i]['APPLY_DATE'].slice(0,10)+ "</td>");
            //tr.push("<td>" + data[i]['APPROVAL_STATUS']+ "</td>");
            switch (data[i]['APPROVAL_STATUS'])
            {
                case 0:
                    tr.push("<td> <b> <p style='color:red;'>Từ chối</p> </b> </td>");
                break;
                case 1:
                    tr.push("<td><b><p style='color:#d6f789;'>Đã duyệt</p></b></td>");
                break;
                case 2:
                    tr.push("<td> <b><p style='color:white;'>Chờ duyệt</p> </b></td>");
                break;   
                case 3:
                    tr.push("<td> <b><p style='color:yellow;'>Đã hủy</p> </b></td>");
                break;               
            }
            tr.push("<td>" + data[i]['OFF_ID']+ "</td>");
            tr.push("<td>" + data[i]['CA_NGHI']+ "</td>");
        }
        tr.push("<td>" + data[i]['ON_OFF']+ "</td>");
        if(data[i]['OVERTIME_INFO']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['OVERTIME_INFO']+ "</td>");
        }
        tr.push("<td>" + data[i]['OVERTIME']+ "</td>");
        if(data[i]['REASON_NAME']==null)
        {
            tr.push("<td></td>");
        }
        else
        {
            tr.push("<td>" + data[i]['REASON_NAME']+ "</td>");
        } 
        tr.push('</tr>');            
    }
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-dark table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}
function getHTMLTABLE2_SummaryTB(data, table_id)
{
    var header_array = ['STT','MAINDEPTNAME','SUBDEPTNAME','TOTAL_ALL','TOTAL_ON','TOTAL_OFF','TOTAL_CDD','TOTAL_NM1','TOTAL_NM2','ON_NM1','ON_NM2','OFF_NM1','OFF_NM2','CDD_NM1','CDD_NM2'
];
    var header_th = header_array.map((element)=>{
        return "<th>"+ element + "</th>";
    });
    var header_string = header_th.join(' ');
    //console.log(header_string);
    var tr=[];
    let t1=t2=t3=t4=t5=t6=t7=t8=t9=t10=t11=t12=0;
    for (var i = 0; i < data.length; i++) {
        tr.push('<tr>');
        tr.push("<td>" + (i + 1) + "</td>");
        tr.push("<td style='align:center;'>" + data[i]['MAINDEPTNAME'] + "</td>");
        tr.push("<td>" + data[i]['SUBDEPTNAME'] + "</td>");  
        tr.push("<td style='align:center; color:blue;'>" + data[i]['TOTAL_ALL'] + "</td>"); t1 += data[i]['TOTAL_ALL'];
        tr.push("<td style='align:center; color:#23FF55;'>" + data[i]['TOTAL_ON'] + "</td>"); t2 += data[i]['TOTAL_ON'];
        tr.push("<td style='align:center; color:#FF8C11;'>" + data[i]['TOTAL_OFF'] + "</td>"); t3+= data[i]['TOTAL_OFF'];
        tr.push("<td style='align:center; color:yellow;'>" + data[i]['TOTAL_CDD'] + "</td>"); t4+= data[i]['TOTAL_CDD'];
        tr.push("<td>" + data[i]['TOTAL_NM1'] + "</td>"); t5+= data[i]['TOTAL_NM1'];
        tr.push("<td>" + data[i]['TOTAL_NM2'] + "</td>"); t6+= data[i]['TOTAL_NM2'];
        tr.push("<td>" + data[i]['ON_NM1'] + "</td>"); t7+= data[i]['ON_NM1'];
        tr.push("<td>" + data[i]['ON_NM2'] + "</td>"); t8+= data[i]['ON_NM2'];
        tr.push("<td>" + data[i]['OFF_NM1'] + "</td>"); t9+= data[i]['OFF_NM1'];
        tr.push("<td>" + data[i]['OFF_NM2'] + "</td>"); t10+= data[i]['OFF_NM2'];
        tr.push("<td>" + data[i]['CDD_NM1'] + "</td>"); t11+= data[i]['CDD_NM1'];
        tr.push("<td>" + data[i]['CDD_NM2'] + "</td>"); t12+= data[i]['CDD_NM2'];
        tr.push('</tr>');            
    }
    tr.push('<tr>');
    tr.push("<td></td>");
    tr.push("<td>Grand</td>");
    tr.push("<td>Total</td>");
    tr.push("<td style='align:center; color:black;'>" +t1+ "</td>");
    tr.push("<td style='align:center; color:black;'>" +t2+ "</td>");
    tr.push("<td style='align:center; color:black;'>" +t3+ "</td>");
    tr.push("<td style='align:center; color:black;'>" +t4+ "</td>");
    tr.push("<td>" +t5+ "</td>");
    tr.push("<td>" +t6+ "</td>");
    tr.push("<td>" +t7+ "</td>");
    tr.push("<td>" +t8+ "</td>");
    tr.push("<td>" +t9+ "</td>");
    tr.push("<td>" +t10+ "</td>");
    tr.push("<td>" +t11+ "</td>");
    tr.push("<td>" +t12+ "</td>");
    tr.push('</tr>');
    var table_data = "<table id='" + table_id + "' class='table table-responsive table-striped table table-bordered table-sm ' cellspaceing='0' width='100%'><thead><tr>" + header_string + "</tr></thead> <tbody>"+tr.join('') + " <tbody><table>";
    //console.log(table_data);
    return table_data;
}