const fs = require('fs');
const path = require('path');

const cosineSimilarity = (a, b) => {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = Number(a[i] || 0);
    const y = Number(b[i] || 0);
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

class LocalVectorStore {
  constructor(options = {}) {
    this.filePath =
      options.filePath || path.resolve(__dirname, '..', 'outbinary', 'schema_vectors.json');
    this.docs = new Map();
    this.loaded = false;
  }

  loadIfNeeded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const d of Array.isArray(parsed) ? parsed : []) {
        if (!d || !d.id) continue;
        this.docs.set(String(d.id), d);
      }
    } catch (e) {
      // ignore
    }
  }

  persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(Array.from(this.docs.values()), null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  upsertMany(items) {
    this.loadIfNeeded();
    for (const it of items || []) {
      if (!it || !it.id || !Array.isArray(it.embedding)) continue;
      this.docs.set(String(it.id), {
        id: String(it.id),
        embedding: it.embedding,
        payload: it.payload || {},
        text: String(it.text || ''),
        updatedAt: Date.now(),
      });
    }
    this.persist();
  }

  query(embedding, topK = 5) {
    this.loadIfNeeded();
    const results = [];
    for (const d of this.docs.values()) {
      const score = cosineSimilarity(embedding, d.embedding);
      results.push({ score, doc: d });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  count() {
    this.loadIfNeeded();
    return this.docs.size;
  }
}

exports.LocalVectorStore = LocalVectorStore;
