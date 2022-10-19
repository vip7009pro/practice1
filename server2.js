const express = require("express");
const app = express();
require('dotenv').config();
const  fs = require('fs');

const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});
server.listen(3005);
console.log('serverchat:3005');

io.on('connection', client => {
    console.log("A client connected");
    console.log("Connected clients: " + io.engine.clientsCount);
    client.on('send', data => {
        io.sockets.emit('send', data);
        //console.log(data); 
    });
    client.on('notification', data => {
        io.sockets.emit('notification', data);
        console.log(data);
    });
    client.on('disconnect', () => {
        console.log("A client disconnected !");
        console.log("Connected clients: " + io.engine.clientsCount);
    });
});
