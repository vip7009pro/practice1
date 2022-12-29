const moment = require("moment");
var date1 = moment();
var date2 = moment('2022-12-28 13:11:00');
console.log(date1.format('YYYY-MM-DD HH:mm:ss'))
console.log(date2.format('YYYY-MM-DD HH:mm:ss'))

var diff = date1.diff(date2,'minutes')
console.log(diff);

const tam = 'SR01';
console.log(tam.substring(0,2))








/* 
const LABEL_ARRAY =["0","1", "2", "3", "4", "5", "6", "7", "8", "9", "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

const label_id = "12A190EL";
console.log(label_id.substring(4,5))
console.log(label_id.substring(5,6))
console.log(label_id.substring(6,7))

let so_dau = label_id.substring(4,5);
let so_cuoi = label_id.substring(5,6);
let so_giua ='';
chiso_cua_so_dau = LABEL_ARRAY.indexOf(so_dau);
let next_label_id = '';
console.log('chiso dau:',chiso_cua_so_dau)
if(chiso_cua_so_dau< 10)
{
    if(so_cuoi === '9')
    {
        so_cuoi = '0';
        if(so_dau === '9')
        {
            so_dau ='A';
        }
        else
        {
            so_dau = LABEL_ARRAY[LABEL_ARRAY.indexOf(so_dau)+1];
        }
        next_label_id =label_id.substring(0,4)+  so_dau + so_cuoi +label_id.substring(6,8);
    }
    else
    {
        so_cuoi = LABEL_ARRAY[LABEL_ARRAY.indexOf(so_cuoi)+1];
        next_label_id =label_id.substring(0,4)+  so_dau + so_cuoi +label_id.substring(6,8);
    }
    console.log('NEXT:',next_label_id);


}
else
{
    if(so_cuoi === '9')
    {
        so_cuoi = '0';       
        so_dau = LABEL_ARRAY[LABEL_ARRAY.indexOf(so_dau)+1];
        next_label_id =label_id.substring(0,4)+  so_dau + so_cuoi +label_id.substring(6,8);
    }
    else
    {
        so_cuoi = LABEL_ARRAY[LABEL_ARRAY.indexOf(so_cuoi)+1];
        next_label_id =label_id.substring(0,4)+  so_dau + so_cuoi +label_id.substring(6,8);
    }
    console.log('NEXT:',next_label_id);

} */