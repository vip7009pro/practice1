const { io } = require("socket.io-client");

const socket = io('http://192.168.1.21:3005');
socket.on("connect", () => {
    console.log(socket.id); // x8WIv7-mJelg7on_ALbx
  });

  socket.on("disconnect", () => {
    console.log(socket.id); // undefined
  });

  socket.on('notification', data => {
    //socket.emit('notification', data);
    console.log(data);
});

socket.emit('notification','nguyen van hung') ;