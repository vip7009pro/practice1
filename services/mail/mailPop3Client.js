/**
 * POP3/POP3S client tối giản, thuần Node (`net`/`tls`) — KHÔNG phụ thuộc thư viện ngoài.
 *
 * Lý do tự viết: `node-pop3` bản mới nhất là ESM-only và bản CJS bị hỏng
 * (chứa cú pháp `import`) ⇒ không dùng được trong backend CommonJS + build `pkg`.
 *
 * Hỗ trợ đủ cho ingestion: USER/PASS, STAT, LIST, UIDL, RETR (đọc raw message, bỏ dot-stuffing),
 * TOP (đọc header), QUIT. Có timeout và huỷ kết nối an toàn.
 *
 * ⚠️ POP3S = TLS ngầm định (thường cổng 995). STARTTLS (cổng 110) chưa hỗ trợ ở bản này.
 */
const net = require("net");
const tls = require("tls");

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_LINE_BYTES = 512 * 1024; // chặn dòng rác khổng lồ

/** Bộ đọc dòng + đọc khối kết thúc bằng dấu chấm trên 1 socket. */
class LineReader {
  constructor(socket) {
    this.buf = Buffer.alloc(0);
    this.lineWaiters = [];
    this.dotWaiters = [];
    this.err = null;
    this.ended = false;
    socket.on("data", (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      this.pump();
    });
    socket.on("error", (e) => {
      this.err = e;
      this.pump();
    });
    socket.on("close", () => {
      this.ended = true;
      this.pump();
    });
  }

  readLine() {
    return new Promise((resolve, reject) => {
      this.lineWaiters.push({ resolve, reject });
      this.pump();
    });
  }

  /** Đọc khối nhiều dòng tới dòng `.` (bỏ dot-stuffing). */
  readDotBlock() {
    return new Promise((resolve, reject) => {
      this.dotWaiters.push({ resolve, reject });
      this.pump();
    });
  }

  _findLineEnd() {
    const idx = this.buf.indexOf("\r\n");
    if (idx !== -1) return { start: idx, end: idx + 2 };
    const lf = this.buf.indexOf("\n");
    if (lf !== -1) return { start: lf, end: lf + 1 };
    return null;
  }

  _findDotEnd() {
    // Trường hợp rỗng: server gửi ngay ".\r\n"
    if (this.buf.length >= 3 && this.buf.slice(0, 3).toString("latin1") === ".\r\n") {
      return { start: 0, end: 3 };
    }
    const marker = this.buf.indexOf("\r\n.\r\n");
    if (marker !== -1) return { start: marker, end: marker + 5 };
    return null;
  }

  /** Bỏ dot-stuffing: mỗi dòng bắt đầu bằng '..' ⇒ còn '.' */
  static unstuff(chunk) {
    return chunk
      .toString("latin1")
      .replace(/\r\n\.\./g, "\r\n.")
      .replace(/^\.\./, ".")
      .split("\r\n")
      .join("\r\n");
  }

  pump() {
    let progress = true;
    while (progress) {
      progress = false;
      if (this.lineWaiters.length > 0) {
        const hit = this._findLineEnd();
        if (hit && hit.start <= MAX_LINE_BYTES) {
          const line = this.buf.slice(0, hit.start).toString("utf8");
          this.buf = this.buf.slice(hit.end);
          this.lineWaiters.shift().resolve(line);
          progress = true;
          continue;
        }
      }
      if (this.dotWaiters.length > 0) {
        const hit = this._findDotEnd();
        if (hit) {
          const content = this.buf.slice(0, hit.start);
          this.buf = this.buf.slice(hit.end);
          this.dotWaiters.shift().resolve(Buffer.from(LineReader.unstuff(content), "latin1"));
          progress = true;
          continue;
        }
      }
    }
    const failure = this.err || (this.ended ? new Error("Kết nối POP3 đã đóng") : null);
    if (failure) {
      while (this.lineWaiters.length) this.lineWaiters.shift().reject(failure);
      while (this.dotWaiters.length) this.dotWaiters.shift().reject(failure);
    }
  }
}

class Pop3Client {
  constructor(options = {}) {
    this.host = options.host;
    this.port = Number(options.port) || (options.secure ? 995 : 110);
    this.secure = !!options.secure;
    this.username = options.username;
    this.password = options.password;
    this.timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    this.rejectUnauthorized = options.rejectUnauthorized !== false;
    this.log = typeof options.log === "function" ? options.log : () => {};
    this.socket = null;
    this.reader = null;
    this.connected = false;
    this.authenticated = false;
  }

  async connect() {
    this.socket = await new Promise((resolve, reject) => {
      const onError = (e) => reject(e);
      const socket = this.secure
        ? tls.connect({ host: this.host, port: this.port, rejectUnauthorized: this.rejectUnauthorized }, () => resolve(socket))
        : net.connect({ host: this.host, port: this.port }, () => resolve(socket));
      socket.setTimeout(this.timeoutMs, () => {
        socket.destroy(new Error(`POP3 timeout sau ${this.timeoutMs}ms`));
      });
      socket.once("error", onError);
      socket.once("close", () => {
        if (!this.connected) reject(new Error("Kết nối POP3 bị đóng khi đang thiết lập"));
      });
    });
    this.connected = true;
    this.reader = new LineReader(this.socket);
    const greeting = await this.reader.readLine();
    if (!/^\+OK/.test(greeting)) throw new Error(`POP3 greeting lỗi: ${greeting}`);
    this.log(`[pop3] connected ${this.host}:${this.port} secure=${this.secure}`);
    return this;
  }

  _write(text) {
    if (!this.socket || this.socket.destroyed) throw new Error("POP3 chưa kết nối");
    this.socket.write(`${text}\r\n`);
  }

  /** Gửi lệnh đơn giản, đọc 1 dòng, throw nếu -ERR. */
  async _cmd(line) {
    this._write(line);
    const response = await this.reader.readLine();
    if (!/^\+OK/.test(response)) {
      const err = new Error(`POP3 ${line.split(" ")[0]} lỗi: ${response}`);
      err.pop3Response = response;
      throw err;
    }
    return response;
  }

  async auth() {
    await this._cmd(`USER ${this.username}`);
    await this._cmd(`PASS ${this.password}`);
    this.authenticated = true;
    return true;
  }

  /** STAT ⇒ { count, size }. */
  async stat() {
    const res = await this._cmd("STAT");
    const parts = res.split(/\s+/);
    return { count: Number(parts[1]) || 0, size: Number(parts[2]) || 0 };
  }

  /** UIDL ⇒ Map<msgNo, uidl>. Nếu server không hỗ trợ, trả Map rỗng. */
  async uidl() {
    this._write("UIDL");
    const head = await this.reader.readLine();
    const map = new Map();
    if (!/^\+OK/.test(head)) return map; // server không hỗ trợ UIDL
    const block = await this.reader.readDotBlock();
    for (const line of block.toString("utf8").split(/\r?\n/)) {
      const [no, uidl] = line.trim().split(/\s+/);
      if (no && uidl) map.set(Number(no), uidl);
    }
    return map;
  }

  /** LIST ⇒ Map<msgNo, size>. */
  async list() {
    this._write("LIST");
    const head = await this.reader.readLine();
    const map = new Map();
    if (!/^\+OK/.test(head)) return map;
    const block = await this.reader.readDotBlock();
    for (const line of block.toString("utf8").split(/\r?\n/)) {
      const [no, size] = line.trim().split(/\s+/);
      if (no && size) map.set(Number(no), Number(size));
    }
    return map;
  }

  /** RETR ⇒ Buffer raw message (đã bỏ dot-stuffing). */
  async retr(msgNo, { maxBytes = 0 } = {}) {
    this._write(`RETR ${msgNo}`);
    const head = await this.reader.readLine();
    if (!/^\+OK/.test(head)) {
      const err = new Error(`POP3 RETR ${msgNo} lỗi: ${head}`);
      err.pop3Response = head;
      throw err;
    }
    const body = await this.reader.readDotBlock();
    if (maxBytes > 0 && body.length > maxBytes) {
      throw new Error(`Email vượt giới hạn ${maxBytes} byte`);
    }
    return body;
  }

  /** TOP n lines ⇒ Buffer (header + n dòng body). */
  async top(msgNo, lines = 0) {
    this._write(`TOP ${msgNo} ${lines}`);
    const head = await this.reader.readLine();
    if (!/^\+OK/.test(head)) {
      const err = new Error(`POP3 TOP ${msgNo} lỗi: ${head}`);
      err.pop3Response = head;
      throw err;
    }
    return this.reader.readDotBlock();
  }

  async quit() {
    try {
      if (this.socket && !this.socket.destroyed) {
        this._write("QUIT");
        await Promise.race([
          this.reader.readLine(),
          new Promise((r) => setTimeout(r, 2000)),
        ]);
      }
    } catch {
      /* bỏ qua lỗi khi thoát */
    } finally {
      this.destroy();
    }
  }

  destroy() {
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
    this.connected = false;
    this.authenticated = false;
  }
}

module.exports = { Pop3Client };
