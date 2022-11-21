const { io } = require("socket.io-client");

const socket = io('http://14.160.33.94:3009');
socket.on("connect", () => {
    console.log(socket.id); // x8WIv7-mJelg7on_ALbx
    socket.emit('notification', 'nguyen van hung');
  });

  socket.on("disconnect", () => {
    console.log(socket.id); // undefined
  });

  socket.on('notification', data => {
    socket.emit('notification', data);
    console.log(data);
    socket.emit('notification','n1111guyen van hung') ;    
}
);
