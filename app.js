const express = require("express");
const app = express();
var cookieParser = require('cookie-parser');
var api_module = require('./api');
var cors = require('cors')
require('dotenv').config();
console.log("usser  =" + process.env.DB_USER);
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});
server.listen(3005);
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
const port = 80;
var corsOptions = {
    origin: 'http://14.160.33.94:3000',
    optionsSuccessStatus: 200,
    credentials: true
}
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.set('views', './views');
app.set('view engine', 'ejs');
var bodyParser = require('body-parser');
const { Socket } = require("socket.io");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', function (req, res, next) {    
    api_module.checklogin_index(req, res, next);
});
app.use('/login', function (req, res, next) {
    api_module.checklogin_login(req, res, next);
});
app.use('/login2', function (req, res, next) {
    api_module.checklogin_login(req, res, next);
});
app.post('/api', function (req, res) {
    //api_module.process_api(req,res);   
    var qr = req.body;
    if (req.coloiko == 'kocoloi' || qr['command'] == 'login') {
        api_module.process_api(req, res);
    }
    else {
        res.send({ tk_status: 'ng' });
    }
});
app.get('/', function (req, res) {    
    res.redirect('/nhansu');
});
app.get('/nhansu', function (req, res) {
    if (req.coloiko == 'kocoloi') {
        res.render('pages/index.ejs',
            {
                variable: 'Đây là nội dung của biến được truyền vào', selection: 'result_table', rootPath: __dirname, login_data: req.payload_data
            }
        );
    }
    else {
        res.redirect('/login2');
    }
});
app.get('/about', function (req, res) {
    if (req.coloiko == 'kocoloi') {
        res.render('pages/about.ejs',
            {
                variable: 'Đây là nội dung của biến được truyền vào', selection: 'result_table', rootPath: __dirname, login_data: req.payload_data
            }
        );
    }
    else {
        res.redirect('/login2');
    }
});
app.get('/login', function (req, res) {
    res.render('pages/login.ejs')
    console.log(req.cookies);
});
app.get('/login2', function (req, res) {
    res.render('pages/login2.ejs')
    console.log(req.cookies);
});
app.listen(port, function () {
    console.log("App dang nghe port 100");
});
