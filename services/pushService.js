const { queryDB_New } = require("../config/database");
const {sendNotification } = require("../utils/pushUtils");

exports.addSubscription = async (req, res, DATA) => { 
   let query = `INSERT INTO ZTB_SUBSCRIPTION_TB (CTR_CD, SUBSCRIPTION) VALUES (@CTR_CD, @SUBSCRIPTION)`;
   let params = { CTR_CD: DATA.CTR_CD, SUBSCRIPTION: DATA.subscription};
   let kqua = await queryDB_New(query, params);
   res.send({ tk_status: "OK", message: "Save subscription thanh cong" });
};

exports.sendNotificationAPI = async (req, res, DATA) => {
    console.log("Notification sent");
    let query = `SELECT SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB WHERE CTR_CD = @CTR_CD`;
    let params = { CTR_CD: DATA.CTR_CD};
    let kqua = await queryDB_New(query, params);
    for (let i = 0; i < kqua.data.length; i++) {
        let element = kqua.data[i];
        sendNotification(JSON.parse(element.SUBSCRIPTION),JSON.stringify({ title: DATA.title, body: DATA.body }));
    }
    res.send({ tk_status: "OK", message: "Send notification thanh cong" });
};
