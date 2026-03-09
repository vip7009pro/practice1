const fs = require('fs');
const os = require('os');
const path = require('path');

const resolveSchemaIndexPath = () => {
  const explicit = String(process.env.SCHEMA_INDEX_PATH || '').trim();
  if (explicit) return explicit;

  const dataDir = String(process.env.AI_SQL_DATA_DIR || '').trim();
  if (dataDir) return path.resolve(dataDir, 'schema_index.json');

  // When bundled by `pkg`, __dirname points into a snapshot (read-only).
  // Persisting files must go to a writable mountpoint.
  const runningInPkg = Boolean(process.pkg);
  if (runningInPkg) {
    const localAppData = String(process.env.LOCALAPPDATA || '').trim();
    const baseDir = localAppData || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(baseDir, 'practice1', 'outbinary', 'schema_index.json');
  }

  return path.resolve(__dirname, '..', 'outbinary', 'schema_index.json');
};

const DEFAULT_PATH = resolveSchemaIndexPath();

const tokenize = (text) => {
  const raw = String(text || '');
  const s = raw
    .toLowerCase()
    // keep latin/digits/underscore/dot and Hangul blocks
    .replace(/[^a-z0-9_\.\u00C0-\u024F\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]+/gi, ' ');

  const base = s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);

  // Extra tokens for product codes like GH68-57670A
  const codeTokens = [];
  const codes = raw.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) || [];
  for (const c of codes) {
    const lc = String(c).toLowerCase();
    if (lc.length >= 4) codeTokens.push(lc);
    for (const part of lc.split('-')) {
      if (part.length >= 2) codeTokens.push(part);
    }
  }

  return Array.from(new Set([...base, ...codeTokens]));
};

class SchemaIndex {
  constructor(options = {}) {
    this.filePath = options.filePath || DEFAULT_PATH;
    this.docs = [];
    this.idf = new Map();
    this.loaded = false;
  }

  tryLoadOnce() {
    if (!fs.existsSync(this.filePath)) return false;
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const parsed = JSON.parse(raw);

    const nextDocs = Array.isArray(parsed?.docs) ? parsed.docs : [];
    const nextIdf = new Map();
    if (parsed?.idf && typeof parsed.idf === 'object') {
      for (const [k, v] of Object.entries(parsed.idf)) {
        nextIdf.set(k, Number(v));
      }
    }

    this.docs = nextDocs;
    this.idf = nextIdf;
    return true;
  }

  loadIfNeeded() {
    if (!this.loaded) {
      try {
        const ok = this.tryLoadOnce();
        if (ok) this.loaded = true;
      } catch {
        // If file is being written or partially updated, do not lock into loaded=true.
        this.loaded = false;
        return;
      }
    }

    // If we previously loaded but ended up empty (or load failed once), allow a retry.
    if (this.docs.length === 0) {
      try {
        const ok = this.tryLoadOnce();
        if (ok) this.loaded = true;
      } catch {
        // ignore
      }
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const idfObj = {};
    for (const [k, v] of this.idf.entries()) idfObj[k] = v;

    const content = JSON.stringify({
      updatedAt: Date.now(),
      docs: this.docs,
      idf: idfObj,
    });

    // Atomic-ish write on Windows: write temp file then replace.
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
    } catch {
      // ignore
    }
    fs.renameSync(tmpPath, this.filePath);
  }

  rebuild(docs) {
    this.docs = (docs || []).map((d) => ({
      id: String(d.id),
      text: String(d.text || ''),
      payload: d.payload || {},
    }));

    const df = new Map();
    for (const d of this.docs) {
      const uniq = new Set(tokenize(d.text));
      for (const tok of uniq) df.set(tok, (df.get(tok) || 0) + 1);
    }

    const N = Math.max(1, this.docs.length);
    this.idf = new Map();
    for (const [tok, c] of df.entries()) {
      // Smooth IDF
      const idf = Math.log((N + 1) / (Number(c) + 1)) + 1;
      this.idf.set(tok, idf);
    }

    this.persist();
  }

  search(query, topK = 5) {
    this.loadIfNeeded();

    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];

    const rawQuery = String(query || '');
    const qLower = rawQuery.toLowerCase();
    const hasCodeLike = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/.test(rawQuery) || /\d{4,}/.test(rawQuery);

    const qtf = new Map();
    for (const t of qTokens) qtf.set(t, (qtf.get(t) || 0) + 1);

    const qVec = new Map();
    let qNorm = 0;
    for (const [t, c] of qtf.entries()) {
      const w = c * (this.idf.get(t) || 0);
      if (w === 0) continue;
      qVec.set(t, w);
      qNorm += w * w;
    }

    // Fallback: if query vector is empty (e.g. tokens not in IDF, different language),
    // do a keyword/substring match so we still retrieve something.
    if (qVec.size === 0) {
      const scores = [];
      for (const d of this.docs) {
        const t = String(d.text || '').toLowerCase();
        let score = 0;

        for (const tok of qTokens) {
          if (!tok) continue;
          if (t.includes(tok)) score += 1;
        }
        if (qLower.length >= 3 && t.includes(qLower)) score += 3;

        if (score > 0) scores.push({ score, doc: d });
      }

      scores.sort((a, b) => b.score - a.score);
      const top = scores.slice(0, topK);
      if (top.length > 0) return top;

      // Final fallback: if nothing matches (common when query is Korean/code-only and schema is English),
      // return tables that likely contain identifier columns.
      if (hasCodeLike) {
        const hintTokens = [
          'code',
          'g_code',
          'item',
          'prod',
          'product',
          'part',
          'model',
          'material',
          'barcode',
          'sku',
          'no',
          'id',
          'request',
        ];

        const hintScores = [];
        for (const d of this.docs) {
          const t = String(d.text || '').toLowerCase();
          let s = 0;
          for (const h of hintTokens) {
            // weight exact column-like hits higher
            if (t.includes(`${h} -`)) s += 3;
            else if (t.includes(h)) s += 1;
          }
          // prefer docs with shorter table text? no, but lightly prefer dbo.*
          if (String(d.id || '').toLowerCase().startsWith('dbo.')) s += 0.25;
          if (s > 0) hintScores.push({ score: s, doc: d });
        }

        hintScores.sort((a, b) => b.score - a.score);
        return hintScores.slice(0, topK);
      }

      return [];
    }

    qNorm = Math.sqrt(qNorm) || 1;

    const scores = [];
    for (const d of this.docs) {
      const dtf = new Map();
      for (const t of tokenize(d.text)) dtf.set(t, (dtf.get(t) || 0) + 1);

      let dot = 0;
      let dNorm = 0;
      for (const [t, c] of dtf.entries()) {
        const w = c * (this.idf.get(t) || 0);
        if (w === 0) continue;
        dNorm += w * w;
        if (qVec.has(t)) dot += w * qVec.get(t);
      }
      dNorm = Math.sqrt(dNorm) || 1;

      const score = dot / (qNorm * dNorm);
      if (score > 0) scores.push({ score, doc: d });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  count() {
    this.loadIfNeeded();
    return this.docs.length;
  }
}

exports.SchemaIndex = SchemaIndex;
exports.tokenize = tokenize;
