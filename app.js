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
let client_array = [];
let API_PORT = parseInt(process.env.API_PORT);
let SOCKET_PORT = parseInt(process.env.SOCKET_PORT);
let DRAW_PATH = process.env.DRAW_PATH;
let EMPL_IMAGE_PATH = process.env.EMPL_IMAGE_PATH;
let TEMP_UPLOAD_FOLDER = process.env.TEMP_UPLOAD_FOLDER;
let DESTINATION_FOlDER = process.env.DESTINATION_FOlDER;
let DESTINATION_55FOlDER = process.env.DESTINATION_55FOlDER;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOAD_FOLDER);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOAD_FOLDER);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.originalname);
  },
});
const upload2 = multer({ storage: storage2 });
app.use(
  compression({
    level: 9,
    threshold: 10 * 1024,
  })
);
console.log("user  =" + process.env.DB_USER);
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
  client.on("online_list", (data) => {
    io.sockets.emit("online_list", data);   
    console.log(data);
  });
  client.on("login", (data) => {
    if (!client_array.includes(data)) client_array.push(data);
    //io.sockets.emit("login", client_array);
    io.sockets.emit("login", data + "da dang nhap");
    //console.log(client_array);
    console.log(data + " da dang nhap");
  });
  client.on("logout", (data) => {
    if (client_array.indexOf(data) > -1)
      client_array.splice(client_array.indexOf(data), 1);
    io.sockets.emit("logout", client_array);
    //console.log(client_array);
    console.log(data + " da dang xuat");
  });
  client.on("disconnect", (data) => {
    console.log(data);
    console.log("A client disconnected !");
    console.log("Connected clients: " + io.engine.clientsCount);
  });
});

var corsOptions = {
  origin: [
    "http://localhost:3001",
    "http://192.168.1.192",
    "http://192.168.1.2",
    "http://192.168.1.136:3010",
    "http://222.252.1.63",
    "http://222.252.1.214",
    "http://222.252.1.63:3000",
    "http://192.168.1.22:3000",
    "http://cms.ddns.net:3000",
    "http://cms.ddns.net",
    "http://14.160.33.94:3001",
    "http://localhost:3000",
    "http://localhost",
    "http://14.160.33.94",
    "http://14.160.33.94:3010",
    "http://14.160.33.94:3030",
    "https://script.google.com/",
    "*",
  ],
  optionsSuccessStatus: 200,
  credentials: true,
};
api_module.openConnection();
app.use(cors(corsOptions));
app.use(cookieParser());
/* app.use(express.static(__dirname + "/public"));
app.set("views", "./views");
app.set("view engine", "ejs"); */
var bodyParser = require("body-parser");
/* const { Socket } = require("socket.io"); */
const { existsSync } = require("fs");
app.use(bodyParser.json({ limit: "25mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "25mb" }));

app.use("/", function (req, res, next) {
  api_module.checklogin_index(req, res, next);
});
app.use("/uploadfile", function (req, res, next) {
  api_module.checklogin_index_update(req, res, next);
});
app.use("/uploadfilechecksheet", function (req, res, next) {
  console.log('vao check')
  api_module.checklogin_index_update(req, res, next);
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
    console.log("loi cmnr");
    res.send({ tk_status: "ng" });
  }
});
app.post("/uploadfile", upload2.single("uploadedfile"), function (req, res) {
  console.log("vao uploaded file thanh cong");
  console.log(req.body.filename);
  console.log(req.body.uploadfoldername);
  //console.log('token upload',req.body.token_string);
  console.log(" ten file goc: " + TEMP_UPLOAD_FOLDER + req.file.originalname);
  if (req.coloiko === "coloi") {
    if (req.file) {
      fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, () => {
        console.log("DELETED " + req.file.originalname);
      });
      console.log(
        "successfully deleted " + TEMP_UPLOAD_FOLDER + req.file.originalname
      );
      res.send({ tk_status: "NG", message: "Chưa đăng nhập" });
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  } else if (req.coloiko === "kocoloi") {
    if (req.file) {
      const filename = req.file.originalname;
      const newfilename = req.body.filename;
      const uploadfoldername = req.body.uploadfoldername;
      const newfilenamelist = req.body.newfilenamelist;

      let filenamearray = [];
      if (newfilenamelist) filenamearray = JSON.parse(newfilenamelist);
      console.log("filenamearray:", filenamearray);
     
      if (!existsSync(DESTINATION_FOlDER + uploadfoldername + filename)) {
        //fs.mkdir(DESTINATION_FOlDER + uploadfoldername);
        if (!existsSync(DESTINATION_FOlDER + uploadfoldername)) {
          fs.mkdir(DESTINATION_FOlDER + uploadfoldername, (e) => {
            if (!e) {
            } else {
              console.log(e);
            }
          });
        }

        if (filenamearray.length === 0) {
          console.log("tempfile: ", TEMP_UPLOAD_FOLDER + filename);
          console.log(
            "destination file: ",
            DESTINATION_FOlDER + uploadfoldername + "\\" + newfilename
          );
          fs.copyFile(
            TEMP_UPLOAD_FOLDER + filename,
            DESTINATION_FOlDER + uploadfoldername + "\\" + newfilename,
            (err) => {
              if (err) {
                res.send({
                  tk_status: "NG",
                  message: "Upload file thất bại: " + err,
                });
              } else {
                fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, (error) => {
                  //you can handle the error here
                  console.log("Loi remove dong 364:" + error);
                });
                res.send({
                  tk_status: "OK",
                  message: "Upload file thành công",
                });
              }
            }
          );
        } else {
          let err_code = "";
          for (let i = 0; i < filenamearray.length; i++) {
            fs.copyFile(
              TEMP_UPLOAD_FOLDER + filename,
              DESTINATION_FOlDER + uploadfoldername + "\\" + filenamearray[i],
              (err) => {
                if (err) {
                  err_code += err + "| ";
                } else {
                }
              }
            );
          }
          if (err_code === "") {
            fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, (error) => {
              console.log("Loi dong 390:" + error);
              //res.send({ tk_status: "NG", message: "Upload file thất bại: " + error });
            });
            res.send({ tk_status: "OK", message: "Upload file thành công" });
          } else {
            res.send({
              tk_status: "NG",
              message: "Upload file thất bại: " + err,
            });
          }
        }
      } else {
        fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, (error) => {
          console.log("Loi dong 404:" + error);
          //you can handle the error here
        });
        console.log("DELETED: " + TEMP_UPLOAD_FOLDER + req.file.originalname);
        res.send({ tk_status: "NG", message: "File đã tồn tại" });
      }
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  }
});
app.post("/uploadfilechecksheet", upload2.single("uploadedfile"), function (req, res) {
  console.log("vao uploaded file thanh cong");
  console.log(req.body.filename);
  console.log(req.body.uploadfoldername);
  //console.log('token upload',req.body.token_string);
  console.log(" ten file goc: " + TEMP_UPLOAD_FOLDER + req.file.originalname);
  if (req.coloiko === "coloi") {
    if (req.file) {
      fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, () => {
        console.log("DELETED " + req.file.originalname);
      });
      console.log(
        "successfully deleted " + TEMP_UPLOAD_FOLDER + req.file.originalname
      );
      res.send({ tk_status: "NG", message: "Chưa đăng nhập" });
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
    }
  } else if (req.coloiko === "kocoloi") {
    if (req.file) {
      const filename = req.file.originalname;
      const newfilename = req.body.filename;
      const uploadfoldername = req.body.uploadfoldername;
      const newfilenamelist = req.body.newfilenamelist;

      let filenamearray = [];
      if (newfilenamelist) filenamearray = JSON.parse(newfilenamelist);
      console.log("filenamearray:", filenamearray);
     
      if (!existsSync(DESTINATION_55FOlDER + uploadfoldername + filename)) {
        //fs.mkdir(DESTINATION_55FOlDER + uploadfoldername);
        if (!existsSync(DESTINATION_55FOlDER + uploadfoldername)) {
          fs.mkdir(DESTINATION_55FOlDER + uploadfoldername, (e) => {
            if (!e) {
            } else {
              console.log(e);
            }
          });
        }

        if (filenamearray.length === 0) {
          console.log("tempfile: ", TEMP_UPLOAD_FOLDER + filename);
          console.log(
            "destination file: ",
            DESTINATION_55FOlDER + uploadfoldername + "\\" + newfilename
          );
          fs.copyFile(
            TEMP_UPLOAD_FOLDER + filename,
            DESTINATION_55FOlDER + uploadfoldername + "\\" + newfilename,
            (err) => {
              if (err) {
                res.send({
                  tk_status: "NG",
                  message: "Upload file thất bại: " + err,
                });
              } else {
                fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, (error) => {
                  //you can handle the error here
                  console.log("Loi remove dong 364:" + error);
                });
                res.send({
                  tk_status: "OK",
                  message: "Upload file thành công",
                });
              }
            }
          );
        } else {
          let err_code = "";
          for (let i = 0; i < filenamearray.length; i++) {
            fs.copyFile(
              TEMP_UPLOAD_FOLDER + filename,
              DESTINATION_FOlDER + uploadfoldername + "\\" + filenamearray[i],
              (err) => {
                if (err) {
                  err_code += err + "| ";
                } else {
                }
              }
            );
          }
          if (err_code === "") {
            fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, (error) => {
              console.log("Loi dong 390:" + error);
              //res.send({ tk_status: "NG", message: "Upload file thất bại: " + error });
            });
            res.send({ tk_status: "OK", message: "Upload file thành công" });
          } else {
            res.send({
              tk_status: "NG",
              message: "Upload file thất bại: " + err,
            });
          }
        }
      } else {
        fs.rm(TEMP_UPLOAD_FOLDER + req.file.originalname, (error) => {
          console.log("Loi dong 404:" + error);
          //you can handle the error here
        });
        console.log("DELETED: " + TEMP_UPLOAD_FOLDER + req.file.originalname);
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
