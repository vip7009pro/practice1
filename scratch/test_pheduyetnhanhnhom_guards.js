/**
 * Kiểm chứng các guard của command `pheduyetnhanhnhom`.
 *
 * AN TOÀN: chỉ gọi các nhánh THOÁT SỚM (trả về trước khi chạy queryDB),
 * nên KHÔNG ghi gì vào database production.
 */
const service = require("../services/nhansuService");

const call = (payload, DATA) =>
  new Promise((resolve) => {
    const req = { payload_data: payload };
    const res = { send: (value) => resolve(value) };
    service.pheduyetnhanhnhom(req, res, DATA);
  });

const cases = [
  {
    name: "thiếu CTR_CD",
    payload: { EMPL_NO: "E1", JOB_NAME: "Leader" },
    DATA: { off_ids: [1], pheduyetvalue: 1 },
    expect: "Thiếu thông tin công ty (CTR_CD)",
  },
  {
    name: "pheduyetvalue không hợp lệ",
    payload: { EMPL_NO: "E1", JOB_NAME: "Leader" },
    DATA: { CTR_CD: "CMS", off_ids: [1], pheduyetvalue: 3 },
    expect: "Giá trị phê duyệt không hợp lệ",
  },
  {
    name: "danh sách off_ids rỗng",
    payload: { EMPL_NO: "E1", JOB_NAME: "Leader" },
    DATA: { CTR_CD: "CMS", off_ids: [], pheduyetvalue: 1 },
    expect: "Thiếu danh sách đơn cần xử lý",
  },
  {
    name: "off_ids toàn giá trị không phải số",
    payload: { EMPL_NO: "E1", JOB_NAME: "Leader" },
    DATA: { CTR_CD: "CMS", off_ids: ["abc", null], pheduyetvalue: 1 },
    expect: "Thiếu danh sách đơn cần xử lý",
  },
  {
    name: "không đủ vai trò quản lý",
    payload: { EMPL_NO: "E1", JOB_NAME: "Staff" },
    DATA: { CTR_CD: "CMS", off_ids: [1], pheduyetvalue: 1 },
    expect: "NO_LEADER",
  },
];

(async () => {
  let failed = 0;
  for (const testCase of cases) {
    const result = await call(testCase.payload, testCase.DATA);
    const ok = result.tk_status === "NG" && result.message === testCase.expect;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"} | ${testCase.name} => ${result.tk_status} / ${result.message}`
    );
  }
  console.log(failed === 0 ? "\nTất cả guard hoạt động đúng." : `\n${failed} guard sai.`);
})();
