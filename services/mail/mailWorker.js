/**
 * Mail Worker — vòng lặp nền đồng bộ mailbox POP3.
 *
 * Đặc điểm:
 *  - Không chạy POP3 trong HTTP request.
 *  - Giới hạn số mailbox đồng thời (`MAIL_MAX_CONCURRENCY`, mặc định 3).
 *  - Retry + exponential backoff cho lỗi kết nối/xác thực.
 *  - Khoá SQL trong `syncMailbox` đảm bảo 1 mailbox không bị 2 nơi sync cùng lúc.
 *  - Graceful shutdown: dừng nhận tick mới, chờ job hiện tại kết thúc.
 */
const mailRepo = require("./mailRepository");
const mailCrypto = require("./mailCrypto");
const { syncMailbox } = require("./mailIngest");
const { reconcile } = require("./mailReconcile");

const INTERVAL_SECONDS = Number(process.env.MAIL_SYNC_INTERVAL_SECONDS || 45) || 45;
const MAX_CONCURRENCY = Number(process.env.MAIL_MAX_CONCURRENCY || 3) || 3;
const MAX_RETRIES = Number(process.env.MAIL_SYNC_MAX_RETRIES || 3) || 3;
const RECONCILE_EVERY_TICKS = Number(process.env.MAIL_RECONCILE_EVERY_TICKS || 20) || 20;

// Chỉ retry các lỗi có khả năng tạm thời.
const RETRYABLE = new Set(["ERROR", "POP3", "ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]);

let timer = null;
let ticking = false;
let stopping = false;
let tickCount = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chạy tác vụ song song có giới hạn. */
async function runPool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
    while (queue.length > 0 && !stopping) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** Sync 1 mailbox kèm retry + backoff. */
async function syncWithRetry(accountId) {
  let delay = 5000;
  let last = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    last = await syncMailbox(accountId, { manual: false });
    if (last.ok) return last;
    // Không retry các trạng thái "không phải lỗi tạm thời".
    if (!RETRYABLE.has(last.errorCode)) return last;
    if (attempt < MAX_RETRIES) {
      console.log(`[mailworker] acc=${accountId} lỗi "${last.message}" — thử lại sau ${delay}ms`);
      await sleep(delay);
      delay *= 4;
    }
  }
  return last;
}

async function tick() {
  if (ticking || stopping) return;
  ticking = true;
  try {
    const accounts = await mailRepo.listSyncableAccounts({ intervalSeconds: INTERVAL_SECONDS });
    if (accounts.length === 0) return;
    console.log(`[mailworker] đồng bộ ${accounts.length} mailbox (concurrency=${MAX_CONCURRENCY})`);
    await runPool(accounts.map((a) => a.ID), MAX_CONCURRENCY, syncWithRetry);

    tickCount += 1;
    if (RECONCILE_EVERY_TICKS > 0 && tickCount % RECONCILE_EVERY_TICKS === 0) {
      await reconcile().catch((e) => console.warn(`[mailworker] reconcile lỗi: ${e?.message || e}`));
    }
  } catch (error) {
    console.error(`[mailworker] tick lỗi: ${error?.message || error}`);
  } finally {
    ticking = false;
  }
}

/** Khởi động worker. Trả { stop } để tắt an toàn. */
function startMailWorker() {
  if (String(process.env.MAIL_WORKER_ENABLED || "true").toLowerCase() === "false") {
    console.log("[mailworker] đang TẮT (MAIL_WORKER_ENABLED=false)");
    return { stop: async () => undefined };
  }
  if (!mailCrypto.isConfigured()) {
    console.warn("[mailworker] ⚠️ Thiếu MAIL_CRED_KEY — sẽ không đọc được credential mailbox.");
  }

  // Chạy ngay lần đầu, không chặn khởi động server.
  tick().catch((e) => console.error(`[mailworker] tick đầu lỗi: ${e?.message || e}`));

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    tick().catch((e) => console.error(`[mailworker] tick lỗi: ${e?.message || e}`));
  }, Math.max(5, INTERVAL_SECONDS) * 1000);

  console.log(`[mailworker] started (interval=${INTERVAL_SECONDS}s, concurrency=${MAX_CONCURRENCY})`);

  return {
    stop: async () => {
      stopping = true;
      if (timer) clearInterval(timer);
      timer = null;
      // Chờ job hiện tại (tối đa ~30s) để commit xong.
      const deadline = Date.now() + 30000;
      while (ticking && Date.now() < deadline) await sleep(200);
      console.log("[mailworker] stopped");
    },
  };
}

module.exports = { startMailWorker, tick, syncWithRetry };
