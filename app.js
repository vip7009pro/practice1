const express = require("express");
const app = express();
var cookieParser = require("cookie-parser");
var api_module = require("./api");
var cors = require("cors");
require("dotenv").config();
var compression = require("compression");
const fileupload = require("express-fileupload");
var multer = require("multer");
const fs = require("fs");
//var upload = multer({ dest: 'uploadfiles/' });
let client_array = [];

const API_PORT = 3007;
const SOCKET_PORT = 3005;
const DRAW_PATH ='D:\\xampp\\htdocs\\banve\\';
const EMPL_IMAGE_PATH ='D:\\xampp\\htdocs\\Picture_NS\\';

/* const API_PORT = 5011;
const SOCKET_PORT = 3005;
//const SOCKET_PORT = 5012;

const DRAW_PATH ='C:\\xampp\\htdocs\\banve\\';
const EMPL_IMAGE_PATH ='C:\\xampp\\htdocs\\Picture_NS\\';
 */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploadfiles");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

app.use(
  compression({
    level: 6,
    threshold: 10000 * 1024,
  })
);
console.log("usser  =" + process.env.DB_USER);
console.log("server  =" + process.env.DB_SERVER);
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});
server.listen(SOCKET_PORT);
console.log("Socket server listening on port " + SOCKET_PORT);
//server.listen(5012);
io.on("connection", (client) => {
  console.log("A client connected");
  console.log("Connected clients: " + io.engine.clientsCount);
  client.on("send", (data) => {
    io.sockets.emit("send", data);
    //console.log(data);
  });
  client.on("notification", (data) => {
    io.sockets.emit("notification", data);    
    client_array.push(data);
    //console.log(client_array);
    console.log(data);
  });
  client.on("login", (data) => {    
    if(!client_array.includes(data))
    client_array.push(data);
    //io.sockets.emit("login", client_array);
    io.sockets.emit("login", data + 'da dang nhap');
    //console.log(client_array);
    console.log(data +' da dang nhap');
  });
  client.on("logout", (data) => { 
    if(client_array.indexOf(data) >-1)   
    client_array.splice(client_array.indexOf(data),1);
    io.sockets.emit("logout", client_array);
    //console.log(client_array);
    console.log(data +' da dang xuat');
  });
  client.on("disconnect", (data) => {
    console.log(data);
    console.log("A client disconnected !");
    console.log("Connected clients: " + io.engine.clientsCount);
  });
});
//const port = 5011;
const port = 3007;
var corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost",
    "http://14.160.33.94",
    "http://14.160.33.94:3000",
    "http://14.160.33.94:3010",
    "http://14.160.33.94:3030",
    "http://localhost",
    "https://script.google.com/",
    "*",
  ],
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.static(__dirname + "/public"));
app.set("views", "./views");
app.set("view engine", "ejs");
var bodyParser = require("body-parser");
const { Socket } = require("socket.io");
const { existsSync } = require("fs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/", function (req, res, next) {
  api_module.checklogin_index(req, res, next);
});
app.use("/upload", function (req, res, next) {
  api_module.checklogin_index(req, res, next);
});
app.use("/login", function (req, res, next) {
  api_module.checklogin_login(req, res, next);
});
app.use("/login2", function (req, res, next) {
  api_module.checklogin_login(req, res, next);
});
app.post("/api", function (req, res) {
  //api_module.process_api(req,res);
  var qr = req.body;
  if (
    req.coloiko == "kocoloi" ||
    qr["command"] == "login" ||
    qr["command"] == "login2" ||
    qr["command"] == "login3"
  ) {
    api_module.process_api(req, res);
  } else {
    res.send({ tk_status: "ng" });
  }
});
app.post("/upload", upload.single("banve"), function (req, res) {
  console.log(req.body.filename);
  if (req.coloiko === "coloi") {
    if (req.file) {
      fs.rm("uploadfiles\\" + req.file.originalname),
        () => {
          console.log("DELETED " + req.file.originalname);
        };
      console.log(
        "successfully deleted " + "uploadfiles\\" + req.file.originalname
      );
      res.send({ tk_status: "NG", message: "Chưa đăng nhập" });
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  } else if (req.coloiko === "kocoloi") {
    if (req.file) {
      const filename = req.file.originalname;
      const newfilename = req.body.filename;
      const draw_folder = DRAW_PATH;
      console.log("ket qua:" + existsSync(draw_folder + filename));
      if (!existsSync(draw_folder + filename)) {
        fs.copyFile(
          "uploadfiles\\" + filename,
          draw_folder + newfilename + ".pdf",
          (err) => {
            if (err) {
              res.send({
                tk_status: "NG",
                message: "Upload file thất bại: " + err,
              });
            } else {
              fs.rm("uploadfiles\\" + req.file.originalname, (error) => {
                //you can handle the error here
              });
              res.send({ tk_status: "OK", message: "Upload file thành công" });
            }
          }
        );
      } else {
        fs.rm("uploadfiles\\" + req.file.originalname, (error) => {
          //you can handle the error here
        });
        console.log("DELETED: " + "uploadfiles\\" + req.file.originalname);
        res.send({ tk_status: "NG", message: "File đã tồn tại" });
      }
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  }
});
app.post("/uploadavatar", upload.single("avatar"), function (req, res) {
  console.log(req.body.filename);
  if (req.coloiko === "coloi") {
    if (req.file) {
      fs.rm("uploadfiles\\" + req.file.originalname),
        () => {
          console.log("DELETED " + req.file.originalname);
        };
      console.log(
        "successfully deleted " + "uploadfiles\\" + req.file.originalname
      );
      res.send({ tk_status: "NG", message: "Chưa đăng nhập" });
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  } else if (req.coloiko === "kocoloi") {
    if (req.file) {
      const filename = req.file.originalname;
      const newfilename = req.body.filename;
      const draw_folder = EMPL_IMAGE_PATH;
      console.log("ket qua:" + existsSync(draw_folder + filename));
      if (!existsSync(draw_folder + filename)) {
        fs.copyFile(
          "uploadfiles\\" + filename,
          draw_folder + newfilename + ".jpg",
          (err) => {
            if (err) {
              res.send({
                tk_status: "NG",
                message: "Upload file thất bại: " + err,
              });
            } else {
              fs.rm("uploadfiles\\" + req.file.originalname, (error) => {
                //you can handle the error here
              });
              res.send({ tk_status: "OK", message: "Upload file thành công" });
            }
          }
        );
      } else {
        fs.rm("uploadfiles\\" + req.file.originalname, (error) => {
          //you can handle the error here
        });
        console.log("DELETED: " + "uploadfiles\\" + req.file.originalname);
        res.send({ tk_status: "NG", message: "File đã tồn tại" });
      }
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  }
});
app.listen(API_PORT, function () {
  console.log("App dang nghe port " + API_PORT);
});
