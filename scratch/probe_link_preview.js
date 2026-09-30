/** In raw kết quả chatLinkPreview cho 1 URL (chẩn đoán nhanh). */
const jwt = require("jsonwebtoken");

const API = process.env.CHAT_TEST_API || "http://localhost:3007/api";
const url = process.argv[2] || "https://vi.wikipedia.org/wiki/Vi%E1%BB%87t_Nam";

async function main() {
  const token = jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: "002", EMPL_NO: "NHU1903", WORK_STATUS_CODE: 1 }]) },
    "nguyenvanhung",
    { expiresIn: "24h" }
  );
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secureContext: false,
      command: "chatLinkPreview",
      DATA: { url, token_string: token, COMPANY: "CMS" },
    }),
  });
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error("FAIL:", error?.message || error);
  process.exit(1);
});
