const fs = require("fs");
const { existsSync } = require("fs");
const path = require("path");
require("dotenv").config();
exports.uploadFile = async (req, res) => {
  let TEMP_UPLOAD_FOLDER = process.env.TEMP_UPLOAD_FOLDER;
  let DESTINATION_FOlDER = process.env.DESTINATION_FOlDER;
  console.log("vao uploaded file thanh cong");
  console.log(req.body.filename);
  console.log(req.body.uploadfoldername);
  //console.log('token upload',req.body.token_string);
  if (!req.file) {
    res.send({ tk_status: "NG", message: "File chưa lên" });
    return;
  }
  console.log(" ten file goc: " + path.join(TEMP_UPLOAD_FOLDER, req.file.originalname));
  if (req.coloiko === "coloi") {
    if (req.file) {
      fs.rm(path.join(TEMP_UPLOAD_FOLDER, req.file.originalname), () => {
        console.log("DELETED " + req.file.originalname);
      });
      console.log(
        "successfully deleted " + path.join(TEMP_UPLOAD_FOLDER, req.file.originalname)
      );
      res.send({ tk_status: "NG", message: "Chưa đăng nhập" });
      return;
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
      return;
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
      const destDir = path.join(DESTINATION_FOlDER, uploadfoldername);
      const tempFile = path.join(TEMP_UPLOAD_FOLDER, filename);
      if (!existsSync(path.join(destDir, filename))) {
        if (!existsSync(destDir)) {
          try {
            await fs.promises.mkdir(destDir, { recursive: true });
          } catch (e) {
            res.status(500).send({ tk_status: "NG", message: "Upload file thất bại: " + e });
            return;
          }
        }
        if (filenamearray.length === 0) {
          const destFile = path.join(destDir, newfilename);
          console.log("tempfile: ", tempFile);
          console.log(
            "destination file: ",
            destFile
          );
          try {
            await fs.promises.copyFile(tempFile, destFile);
            await fs.promises.rm(path.join(TEMP_UPLOAD_FOLDER, req.file.originalname));
            res.send({ tk_status: "OK", message: "Upload file thành công" });
            return;
          } catch (err) {
            res.status(500).send({ tk_status: "NG", message: "Upload file thất bại: " + err });
            return;
          }
        } else {
          try {
            await Promise.all(
              filenamearray.map((name) =>
                fs.promises.copyFile(tempFile, path.join(destDir, name))
              )
            );
            await fs.promises.rm(path.join(TEMP_UPLOAD_FOLDER, req.file.originalname));
            res.send({ tk_status: "OK", message: "Upload file thành công" });
            return;
          } catch (err) {
            res.status(500).send({ tk_status: "NG", message: "Upload file thất bại: " + err });
            return;
          }
        }
      } else {
        fs.rm(path.join(TEMP_UPLOAD_FOLDER, req.file.originalname), (error) => {
          console.log("Loi dong 404:" + error);
          //you can handle the error here
        });
        console.log("DELETED: " + path.join(TEMP_UPLOAD_FOLDER, req.file.originalname));
        res.send({ tk_status: "NG", message: "File đã tồn tại" });
        return;
      }
    } else {
      res.send({ tk_status: "NG", message: "File chưa lên" });
      return;
    }
  }
};