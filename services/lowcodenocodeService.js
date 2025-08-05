const jwt = require("jsonwebtoken");
const { queryDB_New, asyncQuery, queryDB, queryDB_New2 } = require("../config/database");
const fs = require("fs");
const moment = require("moment");

exports.loadFormList = async (req, res, DATA) => {
  let query = `SELECT * FROM Forms ORDER BY FormName ASC`; 
  //console.log(query);
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
 /*  console.log(query);
  console.log(params); */
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.insertField = async (req, res, DATA) => {
  let query = `INSERT INTO Fields (FormID, FieldName, DataType, ReferenceFormID,ReferenceFieldIDs,Length, IsRequired, CreatedAt) VALUES (@FormID, @FieldName, @DataType, @ReferenceFormID, @ReferenceFieldIDs, @Length, @IsRequired, GETDATE())`;
  let params = { FormID: DATA.FormID, FieldName: DATA.FieldName, DataType: DATA.DataType, ReferenceFormID: DATA.ReferenceFormID, ReferenceFieldIDs: DATA.ReferenceFieldIDs, Length: DATA.Length, IsRequired: DATA.IsRequired };
  let checkkq = await queryDB_New(query, params);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateField = async (req, res, DATA) => {
  let query = `UPDATE Fields SET FormID = @FormID, FieldName = @FieldName, DataType = @DataType, ReferenceFormID = @ReferenceFormID,ReferenceFieldIDs = @ReferenceFieldIDs, Length = @Length, IsRequired = @IsRequired WHERE FieldID = @FieldID`;
  let params = { FieldID: DATA.FieldID, FormID: DATA.FormID, FieldName: DATA.FieldName, DataType: DATA.DataType, ReferenceFormID: DATA.ReferenceFormID, ReferenceFieldIDs: DATA.ReferenceFieldIDs, Length: DATA.Length, IsRequired: DATA.IsRequired };
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
  let query = `SELECT * FROM ZTB_QUERY_FILTER WHERE 1=1 AND {{QueryID}} ORDER BY STT ASC`;
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
exports.getQueryFilterByQueryName = async (req, res, DATA) => {
  let query = `SELECT * FROM ZTB_QUERY_FILTER WHERE 1=1 AND {{QueryName}}`;
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
  let checkkq = await queryDB_New2(query, params, filters);
  //console.log(checkkq);
  res.send(checkkq);  
};
exports.getQueryIDFromQueryName = async (req, res, DATA) => {
  let query = `SELECT QueryID FROM ZTB_QUERYTB WHERE QueryName = @QueryName`;
  let params = {
    QueryName: DATA.QueryName
  };
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);  
}; 

exports.updateBaseQuery = async (req, res, DATA) => {
  let query = `UPDATE ZTB_QUERYTB SET BaseQuery = @BaseQuery WHERE QueryID = @QueryID`;
  let params = {
    QueryID: DATA.QueryID,
    BaseQuery: DATA.BaseQuery,
  };
  //console.log(params)
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.addQueryFilter = async (req, res, DATA) => {
  let query = `INSERT INTO ZTB_QUERY_FILTER (QueryID,Placeholder,Clause,ParamName,LikeType,SkipValues,SELECTION_TEXT,SELECTION_VALUE,QueryName,CreatedAt,UpdatedAt,STT,INPUT_TYPE) VALUES (@QueryID,@Placeholder,@Clause,@ParamName,@LikeType,@SkipValues,@SELECTION_TEXT,@SELECTION_VALUE,@QueryName,GETDATE(),GETDATE(),@STT,@INPUT_TYPE)`;
  let params = {
    QueryID: DATA.QueryID,
    Placeholder: DATA.Placeholder,
    Clause: DATA.Clause,
    ParamName: DATA.ParamName,
    LikeType: DATA.LikeType,
    SkipValues:  DATA.SkipValues,
    SELECTION_TEXT: DATA.SELECTION_TEXT,
    SELECTION_VALUE: DATA.SELECTION_VALUE,
    QueryName: DATA.QueryName,
    STT: DATA.STT,
    INPUT_TYPE: DATA.INPUT_TYPE,    
  };
  //console.log(params)
  let checkkq = await queryDB_New2(query, params, []);
  //console.log(checkkq);
  res.send(checkkq);
};
exports.updateQueryFilter = async (req, res, DATA) => {
  let query = `UPDATE ZTB_QUERY_FILTER SET Placeholder = @Placeholder, Clause = @Clause, ParamName = @ParamName, LikeType = @LikeType, SkipValues = @SkipValues,SELECTION_TEXT = @SELECTION_TEXT,SELECTION_VALUE = @SELECTION_VALUE,QueryName = @QueryName,STT = @STT,INPUT_TYPE = @INPUT_TYPE, UpdatedAt = GETDATE() WHERE FilterID = @FilterID`;
  let params = {
    FilterID: DATA.FilterID,
    Placeholder: DATA.Placeholder,
    Clause: DATA.Clause,
    ParamName: DATA.ParamName,
    LikeType: DATA.LikeType,
    SkipValues: DATA.SkipValues,    
    SELECTION_TEXT: DATA.SELECTION_TEXT,
    SELECTION_VALUE: DATA.SELECTION_VALUE,
    QueryName: DATA.QueryName,
    STT: DATA.STT,
    INPUT_TYPE: DATA.INPUT_TYPE,    
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
  //console.log(checkQuery);


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
  //console.log('checkQueryFilter',checkQueryFilter)
  let finalQuery = checkQuery.data[0].BaseQuery;
  let finalFilter = (checkQueryFilter.tk_status !== 'NG' && checkQueryFilter.data.length > 0 ? checkQueryFilter.data : []).map(item => {
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
  let query = `SELECT ZTB_MENU_TB.*,ZTB_SUBMENU_TB.SubMenuID, ZTB_SUBMENU_TB.SubMenuName, ZTB_SUBMENU_TB.Text as SubText, ZTB_SUBMENU_TB.Link as SubLink, ZTB_SUBMENU_TB.CreateAt as SubCreateAt, ZTB_SUBMENU_TB.UpdatedAt as SubUpdatedAt, ZTB_SUBMENU_TB.MenuCode, ZTB_SUBMENU_TB.SubMenuIcon, ZTB_SUBMENU_TB.SubIconColor, ZTB_SUBMENU_TB.PAGE_ID FROM ZTB_MENU_TB
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
exports.createSubMenu = async (req, res, DATA) => {
  let query = `INSERT INTO ZTB_SUBMENU_TB (MenuID,SubMenuName,SubMenuIcon,SubIconColor,MenuCode,Text,Link,CreateAt,UpdatedAt,PAGE_ID) VALUES (@MenuID,@SubMenuName,@SubMenuIcon,@SubIconColor,@MenuCode,@Text,@Link,GETDATE(),GETDATE(),@PAGE_ID)`;
  let params = {
    MenuID: DATA.MenuID,
    SubMenuName: DATA.SubMenuName,
    SubMenuIcon: DATA.SubMenuIcon,
    SubIconColor: DATA.SubIconColor,   
    MenuCode: DATA.MenuCode,
    Text: DATA.Text,
    Link: DATA.Link,
    PAGE_ID: DATA.PAGE_ID
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
  let query =` UPDATE ZTB_SUBMENU_TB SET SubMenuName = @SubMenuName, SubMenuIcon = @SubMenuIcon, SubIconColor = @SubIconColor, Text = @Text, Link = @Link, UpdatedAt = GETDATE(), MenuCode = @MenuCode, PAGE_ID = @PAGE_ID WHERE SubMenuID = @SubMenuID`;
  let params = {
    SubMenuID: DATA.SubMenuID,
    SubMenuName: DATA.SubMenuName,
    SubMenuIcon: DATA.SubMenuIcon,
    SubIconColor: DATA.SubIconColor,   
    MenuCode: DATA.MenuCode,
    PAGE_ID: DATA.PAGE_ID,
    Text: DATA.Text,
    Link: DATA.Link
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};



///table dang EAV

exports.insertPage = async (req, res, DATA) => {
  let query = `
    INSERT INTO Pages (PageName, Description, Layout, PageGroupID, PageGroupName, CreatedAt, LastModifiedAt)
    VALUES (@PageName, @Description, @Layout, @PageGroupID, @PageGroupName, GETDATE(), GETDATE())
  `;
  let params = {
    PageName: DATA.PageName,
    Description: DATA.Description,
    Layout: DATA.Layout,
    PageGroupID: DATA.PageGroupID,
    PageGroupName: DATA.PageGroupName
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.loadPageList = async (req, res) => {
  let query = `SELECT * FROM Pages`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.updatePage = async (req, res, DATA) => {
  let query = `UPDATE Pages SET PageName = @PageName, Description = @Description, Layout = @Layout, LastModifiedAt = GETDATE(), PageGroupID = @PageGroupID, PageGroupName = @PageGroupName WHERE PageID = @PageID`;
  let params = {
    PageID: DATA.PageID,
    PageName: DATA.PageName,
    Description: DATA.Description,
    Layout: DATA.Layout,
    PageGroupID: DATA.PageGroupID,
    PageGroupName: DATA.PageGroupName
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.deletePage = async (req, res, DATA) => {
  let query = `DELETE FROM Pages WHERE PageID = @PageID`;
  let params = {
    PageID: DATA.PageID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.insertPageComponent = async (req, res, DATA) => {
  let query = `INSERT INTO PageComponents (PageID, ComponentType, ComponentName, ReferenceID, PositionX, PositionY, Width, Height, ComponentOrder) VALUES (@PageID, @ComponentType, @ComponentName, @ReferenceID, @PositionX, @PositionY, @Width, @Height, @ComponentOrder)`;
  let params = {
    PageID: DATA.PageID,
    ComponentType: DATA.ComponentType,
    ComponentName: DATA.ComponentName,
    ReferenceID: DATA.ReferenceID,
    PositionX: DATA.PositionX,
    PositionY: DATA.PositionY,
    Width: DATA.Width,
    Height: DATA.Height,
    ComponentOrder: DATA.ComponentOrder
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.deletePageComponent = async (req, res, DATA) => {
  let query = `DELETE FROM PageComponents WHERE ComponentID = @ComponentID`;
  let params = {
    ComponentID: DATA.ComponentID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.loadPageComponentList = async (req, res,DATA) => {
  let query = `SELECT * FROM PageComponents WHERE PageID = @PageID`;
  let params = {
    PageID: DATA.PageID
  };
  /* console.log(query);
  console.log(params); */
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.updatePageComponent = async (req, res, DATA) => {
  let query = `UPDATE PageComponents SET PageID = @PageID, ComponentType = @ComponentType, ComponentName = @ComponentName, ReferenceID = @ReferenceID, PositionX = @PositionX, PositionY = @PositionY, Width = @Width, Height = @Height, ComponentOrder = @ComponentOrder, GridWidth = @GridWidth WHERE ComponentID = @ComponentID`;
  let params = {
    ComponentID: DATA.ComponentID,
    PageID: DATA.PageID,
    ComponentType: DATA.ComponentType,
    ComponentName: DATA.ComponentName,
    ReferenceID: DATA.ReferenceID,
    PositionX: DATA.PositionX,
    PositionY: DATA.PositionY,
    Width: DATA.Width,
    Height: DATA.Height,
    ComponentOrder: DATA.ComponentOrder,
    GridWidth: DATA.GridWidth
  };
  /* console.log(query);
  console.log(params); */
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};




exports.insertComponentAttribute = async (req, res, DATA) => {
  let query = `INSERT INTO ComponentAttributes (ComponentID, AttributeName, AttributeValue) VALUES (@ComponentID, @AttributeName, @AttributeValue)`;
  let params = {
    ComponentID: DATA.ComponentID,
    AttributeName: DATA.AttributeName,
    AttributeValue: DATA.AttributeValue
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.updateComponentAttribute = async (req, res, DATA) => {
  let query = `UPDATE ComponentAttributes SET ComponentID = @ComponentID, AttributeName = @AttributeName, AttributeValue = @AttributeValue WHERE AttributeID = @AttributeID`;
  let params = {
    AttributeID: DATA.AttributeID,
    ComponentID: DATA.ComponentID,
    AttributeName: DATA.AttributeName,
    AttributeValue: DATA.AttributeValue
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.deleteComponentAttribute = async (req, res, DATA) => {
  let query = `DELETE FROM ComponentAttributes WHERE AttributeID = @AttributeID`;
  let params = {
    AttributeID: DATA.AttributeID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.loadComponentAttributeList = async (req, res,DATA) => {
  let query = `SELECT * FROM ComponentAttributes WHERE ComponentID = @ComponentID`;
  let params = {
    ComponentID: DATA.ComponentID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};


exports.insertRecord = async (req, res, DATA) => {
  let query = `INSERT INTO Records (FormID, CreatedAt) OUTPUT INSERTED.RecordID VALUES (@FormID, GETDATE())`;
  let params = {
    FormID: DATA.FormID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.updateRecord = async (req, res, DATA) => {
  let query = `UPDATE Records SET RecordID = @RecordID, FormID = @FormID, CreatedAt = GETDATE() WHERE RecordID = @RecordID`;
  let params = {
    RecordID: DATA.RecordID,
    FormID: DATA.FormID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.deleteRecord = async (req, res, DATA) => {
  let query = `DELETE FROM Records WHERE RecordID = @RecordID`;
  let params = {
    RecordID: DATA.RecordID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.loadRecordList = async (req, res,DATA) => {
  let query = `SELECT * FROM Records WHERE FormID = @FormID`;
  let params = {
    FormID: DATA.FormID
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};  

exports.insertFormData = async (req, res, DATA) => {
  let query = `INSERT INTO FormData (FormID,RecordID,FieldID,Value,CreatedAt) VALUES (@FormID, @RecordID, @FieldID, @Value, GETDATE())`;
  let params = {
    FormID: DATA.FormID,
    RecordID: DATA.RecordID,
    FieldID: DATA.FieldID,
    Value: DATA.Value
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.load_pivotedData = async (req, res, DATA) => {
  let query = `
DECLARE @sql NVARCHAR(MAX) = '';
DECLARE @columns NVARCHAR(MAX) = '';

SELECT @columns = STRING_AGG(QUOTENAME(FieldName), ',')
FROM Fields
WHERE FormID = @FormID;
SET @sql = N'
SELECT *
FROM (
    SELECT 
        r.RecordID,
        r.CreatedAt,
        f.FieldName,
        fd.Value
    FROM Records r
    JOIN FormData fd ON r.RecordID = fd.RecordID
    JOIN Fields f ON fd.FieldID = f.FieldID
    WHERE r.FormID = @FormID
) AS SourceTable
PIVOT (
    MAX(Value)
    FOR FieldName IN (' + @columns + ')
) AS PivotTable;';

-- Thực thi truy vấn
EXEC sp_executesql @sql, N'@FormID INT', @FormID;`;
  let params = {
    FormID: DATA.FormID,
  };
  /* console.log(query);
  console.log(params); */
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.load_pivotedDataSpecificFields = async (req, res, DATA) => {
  let query = `
DECLARE @sql NVARCHAR(MAX) = '';
DECLARE @columns NVARCHAR(MAX) = '';

SELECT @columns = STRING_AGG(QUOTENAME(FieldName), ',')
FROM Fields
WHERE FormID = @FormID;
SET @sql = N'
SELECT *
FROM (
    SELECT 
        r.RecordID,
        r.CreatedAt,
        f.FieldName,
        fd.Value
    FROM Records r
    JOIN FormData fd ON r.RecordID = fd.RecordID
    JOIN Fields f ON fd.FieldID = f.FieldID
    WHERE r.FormID = @FormID AND f.FieldID IN (' + @Fields + ')
) AS SourceTable
PIVOT (
    MAX(Value)
    FOR FieldName IN (' + @columns + ')
) AS PivotTable;';

-- Thực thi truy vấn
EXEC sp_executesql @sql, N'@FormID INT, @Fields NVARCHAR(MAX)', @FormID, @Fields;`;
  let params = {
    FormID: DATA.FormID,
    Fields: DATA.FieldIDs
  };
  /* console.log(query);
  console.log(params); */
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};


exports.loadRelationshipList = async (req, res) => {
  let query = `SELECT Relationships.*, f1.FieldName AS ParentFieldName, f2.FieldName AS ChildFieldName, b1.FormName AS ParentTableName, b2.FormName AS ChildTableName  FROM Relationships 
LEFT JOIN Fields f1 ON  f1.FieldID = Relationships.ParentFieldID
LEFT JOIN Fields f2 ON  f2.FieldID = Relationships.ChildFieldID
LEFT JOIN Forms b1 ON b1.FormID = Relationships.ParentTableID
LEFT JOIN Forms b2 ON b2.FormID = Relationships.ChildTableID`;
  let checkkq = await queryDB_New2(query, {}, []);
  res.send(checkkq);
};
exports.loadRelationshipDetail = async (req, res, DATA) => {
  let query = `SELECT Relationships.*, f1.FieldName AS ParentFieldName, f2.FieldName AS ChildFieldName FROM Relationships 
LEFT JOIN Fields f1 ON  f1.FieldID = Relationships.ParentFieldID
LEFT JOIN Fields f2 ON  f2.FieldID = Relationships.ChildFieldID WHERE RelationshipID = @RelationshipID`;
  let params = {
    RelationshipID: DATA.RelationshipID,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.insertRelationship = async (req, res, DATA) => {
  let query = `
    IF NOT EXISTS (
      SELECT 1 FROM Relationships 
      WHERE ParentTableID = @ParentTableID 
        AND ChildTableID = @ChildTableID 
        AND ParentFieldID = @ParentFieldID 
        AND ChildFieldID = @ChildFieldID
    ) 
    BEGIN
      INSERT INTO Relationships (ParentTableID, ChildTableID, ParentFieldID, ChildFieldID, RelationshipType, CreatedAt, UpdatedAt)
      VALUES (@ParentTableID, @ChildTableID, @ParentFieldID, @ChildFieldID, @RelationshipType, GETDATE(), GETDATE());
    END
    ELSE
    BEGIN
      UPDATE Relationships
      SET RelationshipType = @RelationshipType, UpdatedAt = GETDATE()
      WHERE ParentTableID = @ParentTableID 
        AND ChildTableID = @ChildTableID 
        AND ParentFieldID = @ParentFieldID 
        AND ChildFieldID = @ChildFieldID;
    END
  `;
  let params = {
    ParentTableID: DATA.ParentTableID,
    ChildTableID: DATA.ChildTableID,
    ParentFieldID: DATA.ParentFieldID,
    ChildFieldID: DATA.ChildFieldID,
    RelationshipType: DATA.RelationshipType,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.updateRelationship = async (req, res, DATA) => {
  let query = `
    UPDATE Relationships
    SET ParentTableID = @ParentTableID, ChildTableID = @ChildTableID, ParentFieldID = @ParentFieldID, ChildFieldID = @ChildFieldID, RelationshipType = @RelationshipType
    WHERE RelationshipID = @RelationshipID
  `;
  let params = {
    RelationshipID: DATA.RelationshipID,
    ParentTableID: DATA.ParentTableID,
    ChildTableID: DATA.ChildTableID,
    ParentFieldID: DATA.ParentFieldID,
    ChildFieldID: DATA.ChildFieldID,
    RelationshipType: DATA.RelationshipType,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.deleteRelationship = async (req, res, DATA) => {
  let query = `DELETE FROM Relationships WHERE RelationshipID = @RelationshipID`;
  let params = {
    RelationshipID: DATA.RelationshipID,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.loadTwoTableRelationship = async (req, res, DATA) => {
  let query = `SELECT Relationships.*, f1.FieldName AS ParentFieldName, f2.FieldName AS ChildFieldName FROM Relationships 
LEFT JOIN Fields f1 ON  f1.FieldID = Relationships.ParentFieldID
LEFT JOIN Fields f2 ON  f2.FieldID = Relationships.ChildFieldID WHERE Relationships.ParentTableID = @ParentTableID AND Relationships.ChildTableID=@ChildTableID`;
  let params = {
    ParentTableID: DATA.ParentTableID,
    ChildTableID: DATA.ChildTableID,
  };  
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.createViewTrackingTable = async (req, res, DATA) => {
  let query = `
  -- Tạo hoặc cập nhật bảng FormViewTracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FormViewTracking')
BEGIN
    CREATE TABLE FormViewTracking (
        FormID INT PRIMARY KEY,
        ViewName NVARCHAR(128),
        LastUpdated DATETIME,
        FieldHash NVARCHAR(256)
    );
END
ELSE
BEGIN
    -- Thêm cột FieldHash nếu chưa tồn tại
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FormViewTracking') AND name = 'FieldHash')
    BEGIN
        ALTER TABLE FormViewTracking
        ADD FieldHash NVARCHAR(256);
    END
END;`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.createViewForOneForm = async (req, res, DATA) => {
  let query = `
 CREATE OR ALTER PROCEDURE sp_UpdateFormView
    @FormID INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FormName NVARCHAR(128);
    DECLARE @ViewName NVARCHAR(128);
    DECLARE @SQL NVARCHAR(MAX) = '';
    DECLARE @CurrentFields NVARCHAR(MAX) = '';
    DECLARE @FieldHash NVARCHAR(256) = '';
    DECLARE @StoredFieldHash NVARCHAR(256) = '';
    DECLARE @ViewExists BIT = 0;

    -- Lấy FormName và kiểm tra FormID có tồn tại không
    SELECT @FormName = FormName
    FROM Forms
    WHERE FormID = @FormID;

    IF @FormName IS NULL
    BEGIN
        PRINT 'FormID ' + CAST(@FormID AS NVARCHAR(10)) + ' does not exist.';
        RETURN;
    END;

    -- Tạo tên View từ FormName, thay khoảng trắng và ký tự không hợp lệ thành '_'
    SET @ViewName = 'View_' + REPLACE(REPLACE(@FormName, ' ', '_'), '[^a-zA-Z0-9_]', '_');

    -- Kiểm tra xem View đã tồn tại chưa
    IF EXISTS (SELECT 1 FROM sys.views WHERE name = @ViewName)
        SET @ViewExists = 1;

    -- Lấy danh sách field hiện tại và tạo hash để kiểm tra thay đổi
    SELECT @CurrentFields = STRING_AGG(CAST(FieldID AS NVARCHAR(10)) + ':' + FieldName, ','),
           @FieldHash = CONVERT(NVARCHAR(256), HASHBYTES('SHA2_256', STRING_AGG(CAST(FieldID AS NVARCHAR(10)) + ':' + FieldName, ',')))
    FROM Fields
    WHERE FormID = @FormID;

    -- Lấy hash của field từ FormViewTracking
    SELECT @StoredFieldHash = FieldHash
    FROM FormViewTracking
    WHERE FormID = @FormID;

    -- Nếu View tồn tại và hash không thay đổi, không cần cập nhật
    IF @ViewExists = 1 AND ISNULL(@FieldHash, '') = ISNULL(@StoredFieldHash, '')
    BEGIN
        PRINT 'No changes detected for View ' + @ViewName;
        RETURN;
    END;

    -- Xóa View cũ nếu tồn tại
    IF @ViewExists = 1
    BEGIN
        SET @SQL = 'DROP VIEW ' + QUOTENAME(@ViewName) + ';';
        EXEC sp_executesql @SQL;
    END;

    -- Tạo câu truy vấn động để sinh View mới, bao gồm cột CreatedAt
    SET @SQL = 'CREATE VIEW ' + QUOTENAME(@ViewName) + ' AS ' +
               'SELECT r.RecordID, r.CreatedAt, ' +
               ISNULL(
                   (
                       SELECT STRING_AGG(
                           'MAX(CASE WHEN f.FieldID = ' + CAST(f.FieldID AS NVARCHAR(10)) + 
                           ' THEN fd.Value END) AS ' + QUOTENAME(f.FieldName), ', ')
                       FROM Fields f 
                       WHERE f.FormID = @FormID
                   ), ''
               ) +
               ' FROM Records r ' +
               ' LEFT JOIN FormData fd ON r.RecordID = fd.RecordID ' +
               ' LEFT JOIN Fields f ON fd.FieldID = f.FieldID ' +
               ' WHERE r.FormID = ' + CAST(@FormID AS NVARCHAR(10)) +
               ' GROUP BY r.RecordID, r.CreatedAt;';

    -- Nếu không có field, tạo View chỉ với RecordID và CreatedAt
    IF @CurrentFields IS NULL
    BEGIN
        SET @SQL = 'CREATE VIEW ' + QUOTENAME(@ViewName) + ' AS ' +
                   'SELECT r.RecordID, r.CreatedAt ' +
                   'FROM Records r ' +
                   'WHERE r.FormID = ' + CAST(@FormID AS NVARCHAR(10)) + ';';
    END;

    -- Thực thi câu lệnh tạo View
    EXEC sp_executesql @SQL;

    -- Cập nhật bảng FormViewTracking
    IF EXISTS (SELECT 1 FROM FormViewTracking WHERE FormID = @FormID)
    BEGIN
        UPDATE FormViewTracking
        SET ViewName = @ViewName, 
            LastUpdated = GETDATE(),
            FieldHash = @FieldHash
        WHERE FormID = @FormID;
    END
    ELSE
    BEGIN
        INSERT INTO FormViewTracking (FormID, ViewName, LastUpdated, FieldHash)
        VALUES (@FormID, @ViewName, GETDATE(), @FieldHash);
    END;

    PRINT 'View ' + @ViewName + ' created or updated successfully.';
END;
GO
`;
  let params = {
    FormID: DATA.FormID,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
  
exports.updateViewForAllForm = async (req, res, DATA) => {
  let query = `
  -- Stored Procedure để kiểm tra và cập nhật View cho tất cả Form
CREATE OR ALTER PROCEDURE sp_UpdateAllFormViews
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FormID INT;

    -- Lấy danh sách tất cả FormID
    DECLARE form_cursor CURSOR FOR
    SELECT FormID FROM Forms;

    OPEN form_cursor;
    FETCH NEXT FROM form_cursor INTO @FormID;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_UpdateFormView @FormID;
        FETCH NEXT FROM form_cursor INTO @FormID;
    END;

    CLOSE form_cursor;
    DEALLOCATE form_cursor;

    PRINT 'All form views updated successfully.';
END;
GO
`;
let checkkq = await queryDB_New2(query, {}, []);
res.send(checkkq);
};
  
exports.loadViewList = async (req, res) => {
  let query = `SELECT * FROM FormViewTracking`;
  let params = {};
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.deleteView = async (req, res, DATA) => {
  let query = `DELETE FROM FormViewTracking WHERE FormID = @FormID`;
  let params = {
    FormID: DATA.FormID,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.loadViewData = async (req, res, DATA) => {
  let query = `SELECT * FROM ${DATA.ViewName}`;
  //console.log(query);
  let checkkq = await queryDB_New2(query, {}, []);
  res.send(checkkq);
};

exports.loadViewDataSpecificFields = async (req, res, DATA) => {
  let query = `SELECT RecordID, CreatedAt, ${DATA.Fields} FROM ${DATA.ViewName}`;
  //console.log(query);
  let checkkq = await queryDB_New2(query, {}, []);
  res.send(checkkq);
};

exports.getFormIDFromViewName = async (req, res, DATA) => {
  let query = `SELECT FormID FROM FormViewTracking WHERE ViewName = @ViewName`;
  let params = {
    ViewName: DATA.ViewName,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};
exports.getViewNameFromFormID = async (req, res, DATA) => {
  let query = `SELECT ViewName FROM FormViewTracking WHERE FormID = @FormID`;
  let params = {
    FormID: DATA.FormID,
  };  
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};

exports.loadPageListFromGroupName = async (req, res, DATA) => {
  let query = `SELECT * FROM Pages WHERE PageGroupName = @PageGroupName`;
  let params = {
    PageGroupName: DATA.PageGroupName,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};  

exports.loadPageListFromGroupID = async (req, res, DATA) => {
  let query = `SELECT * FROM Pages WHERE PageGroupID = @PageGroupID`;
  let params = {
    PageGroupID: DATA.PageGroupID,
  };
  let checkkq = await queryDB_New2(query, params, []);
  res.send(checkkq);
};  