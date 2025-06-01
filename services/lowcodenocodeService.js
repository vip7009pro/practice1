const jwt = require("jsonwebtoken");
const { queryDB_New, asyncQuery, queryDB, queryDB_New2 } = require("../config/database");
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
exports.loadTableList = async (req, res, DATA) => {
  let query = `
  SELECT *
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME;`;
  let checkkq = await queryDB_New2(query, {}, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.createTable = async (req, res, DATA) => { 
  let query = `CREATE TABLE ${DATA.TABLE_NAME} (${DATA.FIELDS})`;
  console.log(query);
  let checkkq = await queryDB_New2(query, {}, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.renameTable = async (req, res, DATA) => {
  let query = `sp_rename @OLD_NAME, @NEW_NAME`;
  let params = {
    OLD_NAME: DATA.OLD_NAME,
    NEW_NAME: DATA.NEW_NAME
  }
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.deleteTable = async (req, res, DATA) => {
  let query = `DROP TABLE @TABLE_NAME`;
  let params = {
    TABLE_NAME: DATA.TABLE_NAME
  }
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadColumnList = async (req, res, DATA) => {
  let query = `
 SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    CASE 
        WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'YES'
        ELSE 'NO'
    END AS IS_PRIMARY_KEY,
    CASE 
        WHEN sc.is_identity = 1 THEN 'YES'
        ELSE 'NO'
    END AS IS_IDENTITY
FROM 
    INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON c.TABLE_NAME = kcu.TABLE_NAME 
    AND c.COLUMN_NAME = kcu.COLUMN_NAME 
    AND kcu.CONSTRAINT_NAME LIKE 'PK_%'
INNER JOIN 
    sys.tables t
    ON t.name = c.TABLE_NAME
INNER JOIN 
    sys.columns sc
    ON sc.object_id = t.object_id
    AND sc.name = c.COLUMN_NAME
WHERE 
    c.TABLE_NAME = @TABLE_NAME;
    `;
  let filters = [
    {
      placeholder: "{{TABLE_NAME}}",
      clause: "TABLE_NAME = @TABLE_NAME",
      paramName: "TABLE_NAME",    
    }
  ]
  let params = {
    TABLE_NAME: DATA.TABLE_NAME
  }
  //console.log(query);
  let checkkq = await queryDB_New2(query, params, filters);  
  
  res.send(checkkq);
};
exports.addColumn = async (req, res, DATA) => {
  //console.log(DATA);
  let query = `ALTER TABLE ${DATA.TABLE_NAME} ADD ${DATA.DATA_TYPE}`;
  console.log(query);
  let checkkq = await queryDB_New2(query, {}, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.renameColumn = async (req, res, DATA) => {
  let query = `sp_rename @OLD_NAME, @NEW_NAME`;
  let params = {
    OLD_NAME: DATA.OLD_NAME,
    NEW_NAME: DATA.NEW_NAME
  }
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.deleteColumn = async (req, res, DATA) => {
  let query = `ALTER TABLE ${DATA.TABLE_NAME} DROP COLUMN ${DATA.COLUMN_NAME}`;
  console.log(query);
  let checkkq = await queryDB_New2(query, {}, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateColumn = async (req, res, DATA) => {
  let query = `ALTER TABLE ${DATA.TABLE_NAME} ALTER COLUMN ${DATA.DATA_TYPE}`;  
  console.log(query);
  let checkkq = await queryDB_New2(query, {}, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.addQuery = async (req, res, DATA) => {
  let query = `INSERT INTO ZTB_QUERYTB (QueryName,BaseQuery,Description,CreatedAt,UpdatedAt,IsActive) VALUES (@QueryName,@BaseQuery,@Description,GETDATE(),GETDATE(),@IsActive)`;
  let params = {
    QueryName: DATA.QueryName,
    BaseQuery: DATA.BaseQuery,
    Description: DATA.Description,
    IsActive: DATA.IsActive
  };
  //console.log(params)
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.getQueryList = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_QUERYTB`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);  
};
exports.getQueryFilter = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_QUERY_FILTER WHERE 1=1 AND {{QueryID}}`;
  let filters = [
    {
      placeholder: "{{QueryID}}",
      clause: "QueryID = @QueryID",
      paramName: "QueryID",    
    }
  ]
  let params = {
    QueryID: DATA.QueryID
  };
  let checkkq = await queryDB_New2(query, params, filters);
  //console.log(checkkq);
  res.send(checkkq);  
};
exports.addQueryFilter = async (req, res, DATA) => {
  let query = `INSERT INTO ZTB_QUERY_FILTER (QueryID,Placeholder,Clause,ParamName,LikeType,SkipValues,CreatedAt,UpdatedAt) VALUES (@QueryID,@Placeholder,@Clause,@ParamName,@LikeType,@SkipValues,GETDATE(),GETDATE())`;
  let params = {
    QueryID: DATA.QueryID,
    Placeholder: DATA.Placeholder,
    Clause: DATA.Clause,
    ParamName: DATA.ParamName,
    LikeType: DATA.LikeType,
    SkipValues:  DATA.SkipValues,
  };
  //console.log(params)
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateQueryFilter = async (req, res, DATA) => {
  let query = `UPDATE ZTB_QUERY_FILTER SET Placeholder = @Placeholder, Clause = @Clause, ParamName = @ParamName, LikeType = @LikeType, SkipValues = @SkipValues, UpdatedAt = GETDATE() WHERE FilterID = @FilterID`;
  let params = {
    FilterID: DATA.FilterID,
    Placeholder: DATA.Placeholder,
    Clause: DATA.Clause,
    ParamName: DATA.ParamName,
    LikeType: DATA.LikeType,
    SkipValues: DATA.SkipValues,    
  };
  //console.log(params)
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.deleteQueryFilter = async (req, res, DATA) => {
  let query = `DELETE FROM ZTB_QUERY_FILTER WHERE FilterID = @FilterID`;
  let params = {
    FilterID: DATA.FilterID
  };
  //console.log(params)
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.runQuery = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_QUERYTB WHERE 1=1 AND {{QueryName}}`;
  let filters = [
    {
      placeholder: "{{QueryName}}",
      clause: "QueryName = @QueryName",
      paramName: "QueryName",    
    }
  ]
  let params = {
    QueryName: DATA.QueryName
  };



  let checkQuery = await queryDB_New2(query, params, filters);


  let filterQuery = `SELECT * FROM ZTB_QUERY_FILTER WHERE 1=1 AND {{QueryID}}`;
  let filtersQuery = [
    {
      placeholder: "{{QueryID}}",
      clause: "QueryID = @QueryID",
      paramName: "QueryID",    
    }
  ]
  let paramsQuery = { 
    QueryID: checkQuery.data[0].QueryID
  };
  let checkQueryFilter = await queryDB_New2(filterQuery, paramsQuery, filtersQuery);
  let finalQuery = checkQuery.data[0].BaseQuery;
  let finalFilter = (checkQueryFilter.data.length > 0 ? checkQueryFilter.data : []).map(item => {
    return {
      placeholder: item.Placeholder,
      clause: item.Clause,
      paramName: item.ParamName,
      like: item.LikeType,
      skipValues: JSON.parse(JSON.stringify(item.SkipValues))
    }
  });
  let finalParams = DATA.PARAMS;

  let checkkq = await queryDB_New2(finalQuery, finalParams, finalFilter);
  res.send(checkkq);
};


exports.insertData = async (req, res, DATA) => {
  let filteredFields = DATA.FIELDS.filter(item => item.isIdentity !== 'YES');
  let query = `INSERT INTO ${DATA.TABLE_NAME} (${filteredFields.map(item => item.name).join(",")}) VALUES (${filteredFields.map(item => `@${item.name}`).join(",")})`;
  let params = filteredFields.reduce((acc, item) => {
    acc[item.name] = item.value ?? "";
    return acc;
  }, {});
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.insertData2 = async (req, res, DATA) => {
  let filteredFields = DATA.FIELDS.filter(item => item.isIdentity !== 'YES');
  let filteredDATA = filteredFields.reduce((acc, item) => {
    if (DATA.DATA.hasOwnProperty(item.name)) {
      acc[item.name] = DATA.DATA[item.name];
    }
    return acc;
  }, {});
  let query = `INSERT INTO ${DATA.TABLE_NAME} (${Object.keys(filteredDATA).join(",")}) VALUES (${Object.keys(filteredDATA).map(item => `@${item}`).join(",")})`;
  console.log(query);
  let params = Object.keys(filteredDATA).reduce((acc, item) => {
    acc[item] = filteredDATA[item] ?? "";
    return acc;
  }, {});
  console.log(params);
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.loadData = async (req, res, DATA) => {
  let query = `SELECT TOP 1000 * FROM ${DATA.TABLE_NAME}`;
  console.log(query);
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.loadMenuData = async (req, res, DATA) => {
  let query = `SELECT ZTB_MENU_TB.*,ZTB_SUBMENU_TB.SubMenuID, ZTB_SUBMENU_TB.SubMenuName, ZTB_SUBMENU_TB.Text as SubText, ZTB_SUBMENU_TB.Link as SubLink, ZTB_SUBMENU_TB.CreateAt as SubCreateAt, ZTB_SUBMENU_TB.UpdatedAt as SubUpdatedAt, ZTB_SUBMENU_TB.MenuCode, ZTB_SUBMENU_TB.SubMenuIcon, ZTB_SUBMENU_TB.SubIconColor FROM ZTB_MENU_TB
LEFT JOIN ZTB_SUBMENU_TB ON (ZTB_MENU_TB.MenuID = ZTB_SUBMENU_TB.MenuID) ORDER BY ZTB_MENU_TB.MenuID ASC, ZTB_SUBMENU_TB.SubMenuID ASC`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadMainMenus = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_MENU_TB ORDER BY MenuID ASC`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.loadSubMenus = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_SUBMENU_TB ORDER BY SubMenuID ASC`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateMainMenu = async (req, res, DATA) => {
  let query =` UPDATE ZTB_MENU_TB SET MenuName = @MenuName, MenuIcon = @MenuIcon, IconColor = @IconColor, Text = @Text, Link = @Link, UpdatedAt = GETDATE() WHERE MenuID = @MenuID`;
  let params = {
    MenuName: DATA.MenuName,
    MenuIcon: DATA.MenuIcon,
    IconColor: DATA.IconColor,
    MenuID: DATA.MenuID,
    Text: DATA.Text,
    Link: DATA.Link,   
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.updateSubMenu = async (req, res, DATA) => {
  let query =` UPDATE ZTB_SUBMENU_TB SET SubMenuName = @SubMenuName, SubMenuIcon = @SubMenuIcon, SubIconColor = @SubIconColor, Text = @Text, Link = @Link, UpdatedAt = GETDATE() WHERE SubMenuID = @SubMenuID`;
  let params = {
    SubMenuID: DATA.SubMenuID,
    SubMenuName: DATA.SubMenuName,
    SubMenuIcon: DATA.SubMenuIcon,
    SubIconColor: DATA.SubIconColor,   
    Text: DATA.Text,
    Link: DATA.Link
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.createSubMenu = async (req, res, DATA) => {
  let query = `INSERT INTO ZTB_SUBMENU_TB (MenuID,SubMenuName,SubMenuIcon,SubIconColor,MenuCode,Text,Link,CreateAt,UpdatedAt) VALUES (@MenuID,@SubMenuName,@SubMenuIcon,@SubIconColor,@MenuCode,@Text,@Link,GETDATE(),GETDATE())`;
  let params = {
    MenuID: DATA.MenuID,
    SubMenuName: DATA.SubMenuName,
    SubMenuIcon: DATA.SubMenuIcon,
    SubIconColor: DATA.SubIconColor,   
    MenuCode: DATA.MenuCode,
    Text: DATA.Text,
    Link: DATA.Link
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.deleteSubMenu = async (req, res, DATA) => {
  let query = `DELETE FROM ZTB_SUBMENU_TB WHERE SubMenuID = @SubMenuID`;
  let params = {
    SubMenuID: DATA.SubMenuID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.createMainMenu = async (req, res, DATA) => {
  let query = `INSERT INTO ZTB_MENU_TB (MenuName,MenuIcon,IconColor,Text,Link,CreateAt,UpdatedAt) VALUES (@MenuName,@MenuIcon,@IconColor,@Text,@Link,GETDATE(),GETDATE())`;
  let params = {
    MenuName: DATA.MenuName,
    MenuIcon: DATA.MenuIcon,
    IconColor: DATA.IconColor,   
    Text: DATA.Text,
    Link: DATA.Link
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.deleteMainMenu = async (req, res, DATA) => {
  let query = `DELETE FROM ZTB_MENU_TB WHERE MenuID = @MenuID`;
  let params = {
    MenuID: DATA.MenuID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.updateMainMenu = async (req, res, DATA) => {
  let query =` UPDATE ZTB_MENU_TB SET MenuName = @MenuName, MenuIcon = @MenuIcon, IconColor = @IconColor, Text = @Text, Link = @Link, UpdatedAt = GETDATE() WHERE MenuID = @MenuID`;
  let params = {
    MenuName: DATA.MenuName,
    MenuIcon: DATA.MenuIcon,
    IconColor: DATA.IconColor,   
    Text: DATA.Text,
    Link: DATA.Link,
    MenuID: DATA.MenuID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.updateSubMenu = async (req, res, DATA) => {
  let query =` UPDATE ZTB_SUBMENU_TB SET SubMenuName = @SubMenuName, SubMenuIcon = @SubMenuIcon, SubIconColor = @SubIconColor, Text = @Text, Link = @Link, UpdatedAt = GETDATE(), MenuCode = @MenuCode WHERE SubMenuID = @SubMenuID`;
  let params = {
    SubMenuID: DATA.SubMenuID,
    SubMenuName: DATA.SubMenuName,
    SubMenuIcon: DATA.SubMenuIcon,
    SubIconColor: DATA.SubIconColor,   
    MenuCode: DATA.MenuCode,
    Text: DATA.Text,
    Link: DATA.Link
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
