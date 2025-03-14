const { Server } = require("socket.io");

module.exports = (httpServer, httpsServer) => {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const ios = new Server(httpsServer, { cors: { origin: "*" } });

  const handleConnection = (socket, ioInstance) => {
    console.log("A client connected");
    console.log("IO: Connected clients: " + io.engine.clientsCount);
    client.on("send", (data) => {
      io.sockets.emit("send", data);
    });
    client.on("changeServer", (data) => {
      io.sockets.emit("changeServer", data);
    });
    io.sockets.emit("request_check_online2", { check: 'online' });
    io.sockets.emit("online_list", client_array);
    client.on("respond_check_online", (data) => {
      //console.log('co responde check online',data.EMPL_NO)
      if (client_array.filter(item => item.EMPL_NO === data.EMPL_NO).length === 0) client_array.push(data);
    });
    client.on("notification", (data) => {
      io.sockets.emit("notification", data);
      console.log(data);
    });
    client.on("notification_panel", (data) => {
      io.sockets.emit("notification_panel", data);
      console.log(data);    
    })
    client.on("online_list", (data) => {
      console.log(data);
    });
    client.on("setWebVer", (data) => {
      io.sockets.emit("setWebVer", data);
      console.log(data);
    });
    client.on("login", (data) => {
      if (client_array.filter(item => item.EMPL_NO === data.EMPL_NO).length === 0) client_array.push(data);
      io.sockets.emit("online_list", client_array);
      io.sockets.emit("login", data + "da dang nhap");
      console.log(data + " da dang nhap");
    });
    client.on("logout", (data) => {
      client_array = client_array.filter(obj => obj.EMPL_NO !== data.EMPL_NO);
      console.log('client_array', client_array.map((e, i) => e.EMPL_NO));
      io.sockets.emit("online_list", client_array);
      console.log(data + " da dang xuat");
    });
    client.on("disconnect", (data) => {
      console.log(data);
      console.log("A client disconnected !");
      console.log("Connected clients: " + io.engine.clientsCount);
      io.sockets.emit("request_check_online2", { check: 'online' });
      io.sockets.emit("online_list", client_array);
    });
  };

  io.on("connection", (socket) => handleConnection(socket, io));
  ios.on("connection", (socket) => handleConnection(socket, ios));
};