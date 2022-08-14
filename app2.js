const moment = require("moment");
const weeknumber1 = moment("2022-08-06", "YYYY-MM-DD").add(1, 'day').year();
console.log(weeknumber1);