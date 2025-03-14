const { queryDB } = require("../config/database");

exports.processCsharpRequest = async (req, res, DATA) => {
  const qr = DATA || req.body;
  const { command } = qr;

  // Xử lý các lệnh cụ thể từ C#
  switch (command) {
    case "get_data_for_csharp":
      const query = "SELECT * FROM SOME_TABLE WHERE CONDITION = 'value'";
      const result = await queryDB(query);
      res.send({ tk_status: result.tk_status, data: result.data });
      break;

    case "update_from_csharp":
      const { id, value } = qr;
      const updateQuery = `UPDATE SOME_TABLE SET COLUMN = '${value}' WHERE ID = '${id}'`;
      const updateResult = await queryDB(updateQuery);
      res.send({ tk_status: updateResult.tk_status, message: "Updated from C#" });
      break;

    default:
      res.send({ tk_status: "ng", message: `Unsupported C# command: ${command}` });
  }
};