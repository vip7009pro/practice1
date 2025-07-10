const webpush = require('web-push');
const vapidKeys = {
    publicKey: 'BDrr_753esKQykp6mnFRExVohLC_yBXGdodkkOB3KzVAJegzQ79Nk-bDxAeZ3feyzIa9XgAcxpoXb0kdtP9cXBE',
    privateKey: 'AfhZ33scVM0UVOCMKoQ8MSOw0GVINJA7Acv37lQPsGw'
};
exports.setVapidDetails = () => {
    console.log("Setting Vapid Details");
    webpush.setVapidDetails(
        "mailto:pagehungnguyen@gmail.com",
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
}

exports.sendNotification = (subscription, payload) => {
    return webpush.sendNotification(subscription, payload);
};

exports.unsubscribeUser = (subscription) => {
    console.log("Unsubscribing User");
    return webpush.unsubscribeUser(subscription);
}
