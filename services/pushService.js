const { queryDB_New } = require("../config/database");
const {
    sendBroadcastPushNotification,
} = require("./targetedPushService");

/** Thoát ký tự đại diện của LIKE để so khớp endpoint CHÍNH XÁC. */
function escapeLike(value) {
  return String(value || "").replace(/[\\%_[]/g, (ch) => `\\${ch}`);
}

exports.addSubscription = async (req, res, DATA) => { 
   try {
      const subscription = typeof DATA.subscription === "string"
          ? JSON.parse(DATA.subscription)
          : DATA.subscription;
      const emplNo = String(req.payload_data?.EMPL_NO || DATA.EMPL_NO || "")
          .trim()
          .toUpperCase();
      // deviceId do client sinh (localStorage) — cần để quyết định push theo THIẾT BỊ.
      const deviceId = String(DATA.deviceId || "").trim().slice(0, 120);
      const ownedSubscription = JSON.stringify({
          subscription,
          emplNo,
          // JSON.stringify tự bỏ undefined ⇒ tương thích ngược với dữ liệu cũ.
          deviceId: deviceId || undefined,
      });
      const ctrCd = DATA.CTR_CD;

      // Chống phình bảng: cùng 1 endpoint (1 trình duyệt/thiết bị) chỉ giữ ĐÚNG 1 dòng.
      // Trước đây mỗi lần mở app lại INSERT thêm 1 dòng ⇒ bảng phình rất nhanh.
      const endpoint = String(subscription?.endpoint || "");
      if (endpoint) {
         const existing = await queryDB_New(
            `SELECT TOP 1 SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB
             WHERE CTR_CD=@CTR_CD AND SUBSCRIPTION LIKE @LIKE_ENDPOINT ESCAPE '\\'`,
            { CTR_CD: ctrCd, LIKE_ENDPOINT: `%${escapeLike(endpoint)}%` }
         );
         if (existing.tk_status === "OK" && Array.isArray(existing.data) && existing.data.length > 0) {
            const oldValue = String(existing.data[0].SUBSCRIPTION || "");
            await queryDB_New(
               `UPDATE ZTB_SUBSCRIPTION_TB SET SUBSCRIPTION=@SUBSCRIPTION, SUB_STATUS='1'
                WHERE CTR_CD=@CTR_CD AND SUBSCRIPTION=@OLD_SUBSCRIPTION`,
               { CTR_CD: ctrCd, SUBSCRIPTION: ownedSubscription, OLD_SUBSCRIPTION: oldValue }
            );
            return res.send({ tk_status: "OK", message: "Cập nhật subscription thành công" });
         }
      }

      await queryDB_New(
         `INSERT INTO ZTB_SUBSCRIPTION_TB (CTR_CD, SUBSCRIPTION, SUB_STATUS) VALUES (@CTR_CD, @SUBSCRIPTION, '1')`,
         { CTR_CD: ctrCd, SUBSCRIPTION: ownedSubscription }
      );
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
