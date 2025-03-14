const fs = require("fs");
const { existsSync } = require("fs");
require("dotenv").config();
exports.uploadFile = async (req, res) => {
  let TEMP_UPLOAD_FOLDER = process.env.TEMP_UPLOAD_FOLDER;
  let DESTINATION_FOlDER = process.env.DESTINATION_FOlDER;
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
};