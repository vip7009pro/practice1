const moment = require("moment");
const commandHandlers = require("./dbCommandHandlers");

exports.processApi = async (req, res) => {
  const qr = req.body;
  const { command, DATA } = qr;
  console.log(moment().format('YYYY-MM-DD HH:mm:ss'), command);

  const handler = commandHandlers[command];
  if (!handler) {
    return res.send({ tk_status: "NG", message: `Command '${command}' not supported` });
  }
  try {
    if (DATA.COMPANY === "CMS") {
      if (process.env.TO && parseInt(process.env.TO) > 0) {
        await new Promise(resolve => setTimeout(resolve, parseInt(process.env.TO)));
      }
      await handler(req, res, DATA);
    } else {
      res.send({ tk_status: "NG", message: "Company not supported" });
    }
  } catch (error) {
    console.log(`Error processing ${command}:`, error);
    res.send({ tk_status: "ng", message: "Internal server error" });
  }
};