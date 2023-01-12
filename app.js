const express = require("express");
const app = express();
var cookieParser = require('cookie-parser');
var api_module = require('./api');
var cors = require('cors')
require('dotenv').config();
var compression = require('compression')
const fileupload = require("express-fileupload");
var multer = require('multer');
const  fs = require('fs');
//var upload = multer({ dest: 'uploadfiles/' });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploadfiles')
    },
    filename: function (req, file, cb) {       
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, file.originalname);
    }
  })
  
const upload = multer({ storage: storage });

app.use(compression({
    level: 6,
    threshold: 10000* 1024
}));
console.log("usser  =" + process.env.DB_USER);
console.log("server  =" + process.env.DB_SERVER);
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});
server.listen(3005);
console.log('Socket server listening on port 3005');
//server.listen(5012);
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
//const port = 5011;
const port = 3007;
var corsOptions = {
    origin: ['http://14.160.33.94','http://14.160.33.94:3000','http://14.160.33.94:3010','http://14.160.33.94:3030','http://localhost','https://script.google.com/','*'],
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
const { existsSync } = require("fs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', function (req, res, next) {    
    api_module.checklogin_index(req, res, next);
});
app.use('/upload', function (req, res, next) {    
    api_module.checklogin_index(req, res, next);
});
app.use('/login', function (req, res, next) {
    api_module.checklogin_login(req, res, next);
});
app.use('/login2', function (req, res, next) {
    api_module.checklogin_login(req, res, next);
});
app.post('/api',function (req, res) {
    //api_module.process_api(req,res); 
    var qr = req.body;
    if (req.coloiko == 'kocoloi' || qr['command'] == 'login' || qr['command'] == 'login2') {
        api_module.process_api(req, res);
    }
    else {
        res.send({ tk_status: 'ng' });
    }
});

app.post('/upload',  upload.single('banve'),function (req, res) {    
    console.log(req.body.filename);
    if(req.coloiko ==='coloi')    
    {        
        if(req.file)
        {
            fs.rm('uploadfiles\\' + req.file.originalname), ()=> {
                console.log("DELETED " + req.file.originalname);
            };        
            console.log('successfully deleted ' + 'uploadfiles\\' + req.file.originalname);
            res.send({tk_status:"NG",message:"Chưa đăng nhập"});
        }
        else
        {
            res.send({tk_status:"NG",message:"File chưa lên"}); 
        }
       
    }
    else if(req.coloiko ==='kocoloi')    
    {        
        if(req.file)
        {
            const filename = req.file.originalname;
            const newfilename = req.body.filename;
            const draw_folder = 'D:\\xampp\\htdocs\\banve\\';
            console.log('ket qua:' + existsSync(draw_folder + filename));

            if(!existsSync(draw_folder + filename))
            {              
                    fs.copyFile('uploadfiles\\' + filename, draw_folder + newfilename +'.pdf', (err) => {
                    if (err) {
                        res.send({tk_status:"NG",message:"Upload file thất bại: " + err});
                    }
                    else {
                        fs.rm('uploadfiles\\' + req.file.originalname,(error) => {
                            //you can handle the error here
                        }); 
                        res.send({tk_status:"OK",message:"Upload file thành công"});
                    }
                  });
            }
            else
            {
                fs.rm('uploadfiles\\' + req.file.originalname,(error) => {
                    //you can handle the error here
                }); 
                console.log('DELETED: '+'uploadfiles\\' + req.file.originalname );
                res.send({tk_status:"NG",message:"File đã tồn tại"});            
            }
        }
        else
        {
            res.send({tk_status:"NG",message:"File chưa lên"});           

        }
        
    }   
});

app.post('/uploadavatar',  upload.single('avatar'),function (req, res) {    
    console.log(req.body.filename);
    if(req.coloiko ==='coloi')    
    {        
        if(req.file)
        {
            fs.rm('uploadfiles\\' + req.file.originalname), ()=> {
                console.log("DELETED " + req.file.originalname);
            };        
            console.log('successfully deleted ' + 'uploadfiles\\' + req.file.originalname);
            res.send({tk_status:"NG",message:"Chưa đăng nhập"});
        }
        else
        {
            res.send({tk_status:"NG",message:"File chưa lên"}); 
        }
       
    }
    else if(req.coloiko ==='kocoloi')    
    {        
        if(req.file)
        {
            const filename = req.file.originalname;
            const newfilename = req.body.filename;
            const draw_folder = 'D:\\xampp\\htdocs\\Picture_NS\\';
            console.log('ket qua:' + existsSync(draw_folder + filename));

            if(!existsSync(draw_folder + filename))
            {              
                    fs.copyFile('uploadfiles\\' + filename, draw_folder + newfilename +'.jpg', (err) => {
                    if (err) {
                        res.send({tk_status:"NG",message:"Upload file thất bại: " + err});
                    }
                    else {
                        fs.rm('uploadfiles\\' + req.file.originalname,(error) => {
                            //you can handle the error here
                        }); 
                        res.send({tk_status:"OK",message:"Upload file thành công"});
                    }
                  });
            }
            else
            {
                fs.rm('uploadfiles\\' + req.file.originalname,(error) => {
                    //you can handle the error here
                }); 
                console.log('DELETED: '+'uploadfiles\\' + req.file.originalname );
                res.send({tk_status:"NG",message:"File đã tồn tại"});            
            }
        }
        else
        {
            res.send({tk_status:"NG",message:"File chưa lên"});           

        }
        
    }   
});


app.post('/api2', function (req, res) {
    api_module.process_api(req,res);   
    var qr = req.body;  
});

app.get('/', function (req, res) {    
    //res.redirect('/nhansu');
    res.redirect('http://14.160.33.94:3010');
    //res.redirect("14.160.33.94:3010");
});
app.get('/nhansu', function (req, res) {
    res.redirect('http://14.160.33.94:3010');
    /* if (req.coloiko == 'kocoloi') {
        res.render('pages/index.ejs',
            {
                variable: 'Đây là nội dung của biến được truyền vào', selection: 'result_table', rootPath: __dirname, login_data: req.payload_data
            }
        );
    }
    else {
        res.redirect('/login2');
    } */
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
    console.log("App dang nghe port " + port);
});
