const jwt = require("jsonwebtoken");
const { queryDB_New, asyncQuery, queryDB } = require("../config/database");
const fs = require("fs");
const moment = require("moment");



exports.loadFormList = async (req, res, DATA) => {
  let query = `SELECT * FROM Forms ORDER BY FormName ASC`; 
  console.log(query);
  let params = {};
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.insertForm = async (req, res, DATA) => {
  let query = `INSERT INTO Forms (FormName, Description, CreatedAt) VALUES (@FormName, @Description, GETDATE())`;
  let params = { FormName: DATA.FormName, Description: DATA.Description };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateForm = async (req, res, DATA) => {
  let query = `UPDATE Forms SET FormName = @FormName, Description = @Description WHERE FormID = @FormID`;
  let params = { FormName: DATA.FormName, Description: DATA.Description, FormID: DATA.FormID };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.deleteForm = async (req, res, DATA) => {
  let query = `DELETE FROM Forms WHERE FormID = @FormID`;
  let params = { FormID: DATA.FormID };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadFormDetail = async (req, res, DATA) => {
  let query = `SELECT * FROM Forms WHERE FormID = @FormID`;
  let params = { FormID: DATA.FormID };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadFieldList = async (req, res, DATA) => {
  let query = `SELECT * FROM Fields WHERE FormID = @FormID ORDER BY FieldName ASC`;
  let params = { FormID: DATA.FormID };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.insertField = async (req, res, DATA) => {
  let query = `INSERT INTO Fields (FormID, FieldName, DataType, ReferenceFormID, Length, IsRequired, CreatedAt) VALUES (@FormID, @FieldName, @DataType, @ReferenceFormID, @Length, @IsRequired, GETDATE())`;
  let params = { FormID: DATA.FormID, FieldName: DATA.FieldName, DataType: DATA.DataType, ReferenceFormID: DATA.ReferenceFormID, Length: DATA.Length, IsRequired: DATA.IsRequired };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateField = async (req, res, DATA) => {
  let query = `UPDATE Fields SET FormID = @FormID, FieldName = @FieldName, DataType = @DataType, ReferenceFormID = @ReferenceFormID, Length = @Length, IsRequired = @IsRequired WHERE FieldID = @FieldID`;
  let params = { FieldID: DATA.FieldID, FormID: DATA.FormID, FieldName: DATA.FieldName, DataType: DATA.DataType, ReferenceFormID: DATA.ReferenceFormID, Length: DATA.Length, IsRequired: DATA.IsRequired };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.deleteField = async (req, res, DATA) => {
  let query = `DELETE FROM Fields WHERE FieldID = @FieldID`;
  let params = { FieldID: DATA.FieldID };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.testSQL = async (req, res, DATA) => {
  let query = DATA.QUERY;
  let params = {};
  let EMPL_NO = req.payload_data["EMPL_NO"];
  let checkkq = "";
  if(EMPL_NO === 'NHU1903' || EMPL_NO === 'NVD1201'){
    checkkq = await queryDB_New(query, params);
  }else{
    checkkq = { tk_status: "NG", message: "Bạn không có quyền thực hiện thao tác này" };
  }
  //console.log(checkkq);
  res.send(checkkq);
};
exports.common = async (req, res, DATA) => {
};
exports.common = async (req, res, DATA) => {
};
exports.common = async (req, res, DATA) => {
};
exports.common = async (req, res, DATA) => {
};
exports.common = async (req, res, DATA) => {
};
exports.common = async (req, res, DATA) => {
};
