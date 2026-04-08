const commandHandlers = {
  ...require("./authService"),
  ...require("./fileService"),
  ...require("./commonService"),
  ...require("./userService"),
  ...require("./nhansuService"),
  ...require("./kinhdoanhService"),
  ...require("./muahangService"),
  ...require("./rndService"),
  ...require("./warehouseService"),
  ...require("./lowcodenocodeService"),
  ...require("./kpiService"),
  ...require("./pushService"),
  ...require("./qcService"),
  ...require("./sanxuatService"),
  ...require("./amazonServices"),
  ...require("./aiServices"),
  ...require("./translationDictionaryService"),
  ...require("./subscriptionService"),
  ...require("./columnCommentService"),
  ...require("./schemaAdminService"),
};

module.exports = commandHandlers;