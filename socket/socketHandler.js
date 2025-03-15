const { Server } = require("socket.io");

module.exports = (httpServer, httpsServer) => {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const ios = new Server(httpsServer, { cors: { origin: "*" } });
  let client_array = [];

  const handleConnection = (client, ioInstance) => {
    console.log("A client connected");
    console.log("IO: Connected clients: " + ioInstance.engine.clientsCount);
    client.on("send", (data) => {
      ioInstance.sockets.emit("send", data);
    });
    client.on("changeServer", (data) => {
      ioInstance.sockets.emit("changeServer", data);
    });
    ioInstance.sockets.emit("request_check_online2", { check: 'online' });
    ioInstance.sockets.emit("online_list", client_array);
    client.on("respond_check_online", (data) => {
      //console.log('co responde check online',data.EMPL_NO)
      if (client_array.filter(item => item.EMPL_NO === data.EMPL_NO).length === 0) client_array.push(data);
    });
    client.on("notification", (data) => {
      ioInstance.sockets.emit("notification", data);
      console.log(data);
    });
    client.on("notification_panel", (data) => {
      ioInstance.sockets.emit("notification_panel", data);
      console.log(data);    
    })
    client.on("online_list", (data) => {
      console.log(data);
    });
    client.on("setWebVer", (data) => {
      ioInstance.sockets.emit("setWebVer", data);
      console.log(data);
    });
    client.on("login", (data) => {
      if (client_array.filter(item => item.EMPL_NO === data.EMPL_NO).length === 0) client_array.push(data);
      ioInstance.sockets.emit("online_list", client_array);
      ioInstance.sockets.emit("login", data + "da dang nhap");
      console.log(data + " da dang nhap");
    });
    client.on("logout", (data) => {
      client_array = client_array.filter(obj => obj.EMPL_NO !== data.EMPL_NO);
      console.log('client_array', client_array.map((e, i) => e.EMPL_NO));
      ioInstance.sockets.emit("online_list", client_array);
      console.log(data + " da dang xuat");
    });
    client.on("disconnect", (data) => {
      console.log(data);
      console.log("A client disconnected !");
      console.log("Connected clients: " + io.engine.clientsCount);
      ioInstance.sockets.emit("request_check_online2", { check: 'online' });
      ioInstance.sockets.emit("online_list", client_array);
    });
  };

  io.on("connection", (client) => handleConnection(client, io));
  ios.on("connection", (client) => handleConnection(client, ios));
};