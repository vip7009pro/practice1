/**
 * Phase 9 — BENCHMARK + AUDIT EXECUTION PLAN (T9.3 / T9.4).
 *
 * Tạo 1 mailbox tạm + 5.000 email tổng hợp để đo thời gian thật cho các truy vấn chính,
 * chụp execution plan (SHOWPLAN_XML) để xem có dùng INDEX SEEK hay SCAN.
 * Kết thúc: xoá sạch dữ liệu benchmark.
 *
 * Chạy: node scratch/bench_mail_queries.js
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const BENCH_EMAIL = "bench-mail@cmsvina.local";
const BENCH_MSG_PREFIX = "bench-";
const VOLUME = Number(process.env.BENCH_VOLUME || 5000);
const RUNS = 5;

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
};

function ms(value) {
  return `${value.toFixed(1)}ms`;
}

async function main() {
  const { openConnection, openDedicatedConnection } = require("../config/database");
  const pool = await openConnection();

  console.log(`\n=== PHASE 9 BENCHMARK (${VOLUME} email tổng hợp) ===\n`);

  /* ---------------- Dọn dữ liệu benchmark cũ ---------------- */
  await pool.query(`DELETE FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID IN (SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MESSAGE_ID LIKE @p)`, {
    p: `${BENCH_MSG_PREFIX}%`,
  });
  await pool.query(`DELETE FROM ZTB_MAIL_MESSAGE WHERE MESSAGE_ID LIKE @p`, { p: `${BENCH_MSG_PREFIX}%` });
  await pool.query(`DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID IN (SELECT ID FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @e)`, { e: BENCH_EMAIL });
  await pool.query(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @e`, { e: BENCH_EMAIL });

  const accountRows = await pool.query(
    `INSERT INTO ZTB_MAIL_ACCOUNT (CTR_CD, EMPL_NO, EMAIL_ADDRESS, DISPLAY_NAME, POP3_HOST, POP3_PORT, POP3_SECURE, IS_ACTIVE, IS_SHARED)
     OUTPUT INSERTED.ID
     VALUES ('002', NULL, @e, N'Mailbox benchmark', 'mail.cmsvina.local', 110, 0, 0, 1)`,
    { e: BENCH_EMAIL }
  );
  const accountId = accountRows.recordset[0].ID;
  await pool.query(`INSERT INTO ZTB_MAIL_SYNC_CHECKPOINT (MAIL_ACCOUNT_ID) VALUES (@acc)`, { acc: accountId });

  console.log(`Mailbox benchmark: ID=${accountId}, chèn ${VOLUME} email…`);
  const insertStart = Date.now();
  await pool.query(
    `INSERT INTO ZTB_MAIL_MESSAGE
       (MAIL_ACCOUNT_ID, MESSAGE_ID, UIDL, FROM_ADDRESS, FROM_NAME, SUBJECT, TO_JSON, RECEIVED_AT, FOLDER,
        HAS_ATTACHMENT, ATTACHMENT_COUNT, BODY_INLINE, PREVIEW_TEXT, SIZE_BYTES)
     SELECT @acc,
            '${BENCH_MSG_PREFIX}' + CAST(n AS VARCHAR(10)) + '@bench.local',
            'UIDL-BENCH-' + CAST(n AS VARCHAR(10)),
            'bench' + CAST(n % 50 AS VARCHAR(3)) + '@cmsvina.local',
            N'Người gửi ' + CAST(n % 50 AS VARCHAR(3)),
            N'Benchmark email số ' + CAST(n AS NVARCHAR(10)) + N' – hợp đồng GH68-' + CAST(n % 999 AS NVARCHAR(3)),
            N'[{"address":"nhan@cmsvina.local","name":"Người nhận"}]',
            DATEADD(minute, -n, GETDATE()), 'INBOX', 0, 0,
            N'<p>Nội dung thử nghiệm ' + CAST(n AS NVARCHAR(10)) + N'</p>',
            N'Nội dung thử nghiệm cho benchmark',
            300
     FROM (SELECT TOP (@n) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
           FROM sys.all_objects a CROSS JOIN sys.all_objects b) t`,
    { acc: accountId, n: VOLUME }
  );
  const insertMs = Date.now() - insertStart;
  console.log(`Đã chèn ${VOLUME} email trong ${insertMs}ms (${Math.round(VOLUME / (insertMs / 1000))} email/s)\n`);

  check("chèn dữ liệu benchmark thành công", true);
  const counts = await pool.query(
    `SELECT (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @acc) AS BENCH_MSGS,
            (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE) AS ALL_MSGS`,
    { acc: accountId }
  );
  console.log(`   Tổng email trong DB: ${counts.recordset[0].ALL_MSGS} (benchmark ${counts.recordset[0].BENCH_MSGS})\n`);

  /* ---------------- Đo thời gian ---------------- */
  const queries = [
    {
      name: "Inbox keyset (limit 30) — listInbox",
      sql: `SELECT TOP (30) m.ID, m.SUBJECT, m.FROM_ADDRESS, m.RECEIVED_AT, ISNULL(us.IS_READ, m.IS_READ) AS IS_READ
            FROM ZTB_MAIL_MESSAGE m
            LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = 'NHU1903'
            WHERE m.MAIL_ACCOUNT_ID = @acc AND m.DELETED_AT IS NULL AND us.DELETED_AT IS NULL
              AND ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) = 'INBOX'
            ORDER BY m.RECEIVED_AT DESC, m.ID DESC`,
      params: { acc: accountId },
    },
    {
      name: "Đếm chưa đọc — countUnread",
      sql: `SELECT COUNT(*) AS CNT FROM ZTB_MAIL_MESSAGE m
            LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = 'NHU1903'
            WHERE m.MAIL_ACCOUNT_ID = @acc AND m.DELETED_AT IS NULL AND us.DELETED_AT IS NULL
              AND ISNULL(us.IS_READ, m.IS_READ) = 0 AND ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) = 'INBOX'`,
      params: { acc: accountId },
    },
    {
      name: "Tìm kiếm LIKE theo từ khoá (limit 30) — searchMessages",
      sql: `SELECT TOP (30) m.ID, m.SUBJECT FROM ZTB_MAIL_MESSAGE m
            LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = 'NHU1903'
            WHERE m.MAIL_ACCOUNT_ID = @acc AND m.DELETED_AT IS NULL AND us.DELETED_AT IS NULL
              AND (m.SUBJECT LIKE '%GH68-123%' OR m.PREVIEW_TEXT LIKE '%GH68-123%' OR m.BODY_INLINE LIKE '%GH68-123%'
                   OR m.FROM_ADDRESS LIKE '%GH68-123%' OR m.FROM_NAME LIKE '%GH68-123%')
            ORDER BY m.RECEIVED_AT DESC, m.ID DESC`,
      params: { acc: accountId },
    },
    {
      name: "Email mới hơn mốc — listMessagesSince",
      sql: `SELECT TOP (50) m.ID, m.SUBJECT FROM ZTB_MAIL_MESSAGE m
            LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = 'NHU1903'
            WHERE m.MAIL_ACCOUNT_ID = @acc AND m.DELETED_AT IS NULL
              AND (m.RECEIVED_AT > DATEADD(minute, -200, GETDATE()))
            ORDER BY m.RECEIVED_AT DESC, m.ID DESC`,
      params: { acc: accountId },
    },
    {
      name: "Tổng hợp dung lượng theo mailbox — admin overview",
      sql: `SELECT a.ID,
              (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID = a.ID) AS MSG_CNT,
              (SELECT ISNULL(SUM(ISNULL(m.SIZE_BYTES,0)),0) FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID = a.ID) AS MSG_BYTES,
              (SELECT COUNT(*) FROM ZTB_MAIL_ATTACHMENT x JOIN ZTB_MAIL_MESSAGE m2 ON m2.ID = x.MESSAGE_ID WHERE m2.MAIL_ACCOUNT_ID = a.ID) AS ATT_CNT
            FROM ZTB_MAIL_ACCOUNT a WHERE a.CTR_CD = '002'`,
      params: {},
    },
    {
      name: "Đính kèm theo message — listAttachmentsByMessage",
      sql: `SELECT a.ID, a.FILE_NAME, a.CONTENT_TYPE, a.FILE_SIZE, pf.STORAGE_PATH
            FROM ZTB_MAIL_ATTACHMENT a
            LEFT JOIN ZTB_MAIL_PHYSICAL_FILE pf ON pf.ID = a.PHYSICAL_FILE_ID
            WHERE a.MESSAGE_ID = (SELECT TOP 1 ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @acc ORDER BY ID)`,
      params: { acc: accountId },
    },
    {
      name: "Theo hội thoại — listThreadMessages",
      sql: `SELECT m.ID, m.SUBJECT, m.RECEIVED_AT FROM ZTB_MAIL_MESSAGE m
            WHERE m.THREAD_ID = (SELECT TOP 1 THREAD_ID FROM ZTB_MAIL_MESSAGE WHERE THREAD_ID IS NOT NULL)`,
      params: {},
    },
  ];

  console.log("--- Thời gian thực thi (min / trung vị trên " + RUNS + " lần, có warm-up) ---");
  const timings = [];
  for (const query of queries) {
    // Warm-up: lần chạy đầu bao gồm biên dịch plan + nạp page vào buffer pool ⇒ không tính vào mẫu.
    await pool.query(query.sql, query.params);
    const samples = [];
    for (let i = 0; i < RUNS; i += 1) {
      const started = Date.now();
      await pool.query(query.sql, query.params);
      samples.push(Date.now() - started);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    timings.push({ name: query.name, min, median, max });
    console.log(`  • ${query.name.padEnd(52)} min ${ms(min).padStart(9)} | med ${ms(median).padStart(9)} | max ${ms(max).padStart(9)}`);
  }
  console.log("");

  check(
    "mọi truy vấn có trung vị dưới 300ms ở mức ~5.000 email",
    timings.every((t) => t.median < 300),
    JSON.stringify(timings.filter((t) => t.median >= 300))
  );
  const searchTiming = timings.find((t) => /Tìm kiếm LIKE/.test(t.name));
  console.log(
    `   ⚠ Tìm kiếm LIKE là truy vấn nặng nhất: med ${searchTiming?.median?.toFixed(1)}ms / min ${searchTiming?.min}ms @5k email` +
      ` ⇒ ở mức 100k cần SQL Server Full-Text (đã ghi trong báo cáo Phase 9).\n`
  );

  /* ---------------- Audit execution plan ---------------- */
  console.log("--- Execution plan (seek/scan) ---");
  const planFindings = [];
  // SET STATISTICS XML chạy được chung batch và trả plan như 1 resultset phụ.
  const planConnection = await openDedicatedConnection();
  try {
    for (const query of queries) {
      const result = await planConnection.promises.query(
        `SET STATISTICS XML ON;\n${query.sql}\nSET STATISTICS XML OFF;`,
        query.params
      );
      const xml = (result.recordsets || [])
        .map((rs) => (rs[0] ? String(Object.values(rs[0])[0] || "") : ""))
        .find((text) => text.includes("<ShowPlanXML")) || "";
      const physicalOps = [...new Set((xml.match(/PhysicalOp="[^"]+"/g) || []).map((v) => v.replace(/PhysicalOp="|"/g, "")))];
      const indexNames = [...new Set((xml.match(/Index="\[[^\]]+\]"/g) || []).map((v) => v.replace(/Index="\[|\]"/g, "")))];
      const scans = physicalOps.filter((op) => /scan/i.test(op)).length;
      const seeks = physicalOps.filter((op) => /seek|lookup/i.test(op)).length;
      planFindings.push({ name: query.name, seeks, scans, indexNames, physicalOps });
      console.log(
        `  • ${query.name.padEnd(46)} seek=${seeks} scan=${scans} | idx=${indexNames.join(",") || "-"} | ops=${physicalOps.join(",") || "-"}`
      );
    }
  } finally {
    await planConnection.promises.close().catch(() => undefined);
  }
  console.log("");

  check("plan đọc được cho mọi truy vấn", planFindings.length === queries.length, `${planFindings.length}/${queries.length}`);
  const inboxPlan = planFindings.find((p) => /Inbox keyset/.test(p.name));
  check(
    "Inbox keyset dùng index có sẵn (không scan cả bảng)",
    !!inboxPlan && inboxPlan.indexNames.some((n) => /IX_MAIL_MESSAGE_INBOX/.test(n)),
    JSON.stringify(inboxPlan)
  );
  const attachPlan = planFindings.find((p) => /Đính kèm theo message/.test(p.name));
  check(
    "Đính kèm theo message dùng IX_MAIL_ATTACHMENT_MSG",
    !!attachPlan && attachPlan.indexNames.some((n) => /IX_MAIL_ATTACHMENT_MSG/.test(n)),
    JSON.stringify(attachPlan)
  );

  /* ---------------- Dọn dẹp ---------------- */
  console.log("\n--- Dọn dữ liệu benchmark ---");
  const cleanupStart = Date.now();
  await pool.query(`DELETE FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID IN (SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @acc)`, { acc: accountId });
  await pool.query(`DELETE FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @acc`, { acc: accountId });
  await pool.query(`DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @acc`, { acc: accountId });
  await pool.query(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @acc`, { acc: accountId });
  console.log(`  đã xoá ${VOLUME} email + mailbox benchmark trong ${Date.now() - cleanupStart}ms`);
  const after = await pool.query(
    `SELECT (SELECT COUNT(*) FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @e) AS ACCS,
            (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE WHERE MESSAGE_ID LIKE @p) AS MSGS`,
    { e: BENCH_EMAIL, p: `${BENCH_MSG_PREFIX}%` }
  );
  check("dọn sạch mailbox benchmark", Number(after.recordset[0].ACCS) === 0 && Number(after.recordset[0].MSGS) === 0, JSON.stringify(after.recordset[0]));

  pool.close();
  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
