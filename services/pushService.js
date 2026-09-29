const { queryDB_New } = require("../config/database");
const {
    sendBroadcastPushNotification,
} = require("./targetedPushService");

exports.addSubscription = async (req, res, DATA) => { 
   try {
    let query = `INSERT INTO ZTB_SUBSCRIPTION_TB (CTR_CD, SUBSCRIPTION, SUB_STATUS) VALUES (@CTR_CD, @SUBSCRIPTION, '1')`;
      const subscription = typeof DATA.subscription === "string"
          ? JSON.parse(DATA.subscription)
          : DATA.subscription;
      const ownedSubscription = JSON.stringify({
          subscription,
          emplNo: req.payload_data?.EMPL_NO || DATA.EMPL_NO || "",
      });
      let params = { CTR_CD: DATA.CTR_CD, SUBSCRIPTION: ownedSubscription};
      await queryDB_New(query, params);
      res.send({ tk_status: "OK", message: "Save subscription thanh cong" });
   } catch (error) {
      console.error("Save subscription failed:", error);
      res.send({ tk_status: "NG", message: "Subscription không hợp lệ" });
   }
};

exports.sendNotificationAPI = async (req, res, DATA) => {
    console.log("Notification sent");
    await sendBroadcastPushNotification({
        ctrCd: DATA.CTR_CD,
        title: DATA.title,
        body: DATA.body,
        url: DATA.url || "/",
        data: DATA.data || {},
    });
    res.send({ tk_status: "OK", message: "Send notification thanh cong" });
};
