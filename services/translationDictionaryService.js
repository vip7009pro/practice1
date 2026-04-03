const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.resolve(__dirname, '..', 'data', 'translation_dictionary.json');
const LANGUAGE_KEYS = ['vi', 'ko', 'en', 'cn'];

const nowIso = () => new Date().toISOString();

const makeDefaultState = () => ({
  version: 1,
  updatedAt: nowIso(),
  entries: [],
});

const ensureStore = async () => {
  await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
};

const readJsonSafe = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeSearchText = (value) => {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const collectTermValues = (raw = {}) => {
  const terms = {};

  if (raw.terms && typeof raw.terms === 'object' && !Array.isArray(raw.terms)) {
    for (const [key, value] of Object.entries(raw.terms)) {
      const text = normalizeText(value);
      if (text || value === '') terms[String(key).trim()] = text;
    }
  }

  for (const key of LANGUAGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      const text = normalizeText(raw[key]);
      terms[key] = text;
    }
  }

  for (const [key, value] of Object.entries(raw)) {
    if (['id', 'terms', 'aliases', 'note', 'enabled', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(key)) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(terms, key)) continue;
    if (typeof value === 'string') {
      const text = normalizeText(value);
      if (text || value === '') {
        terms[key] = text;
      }
    }
  }

  return terms;
};

const normalizeAliases = (value) => {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;|]/g)
      : [];

  const out = [];
  for (const item of list) {
    const text = normalizeText(item);
    if (text) out.push(text);
  }
  return Array.from(new Set(out));
};

const hasAnyTerm = (entry) => {
  const terms = entry?.terms || {};
  return Object.values(terms).some((v) => normalizeText(v).length > 0);
};

const normalizeEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const existingId = normalizeText(raw.id || raw._id || raw.key || raw.name);
  const id = existingId || crypto.randomUUID();
  const terms = collectTermValues(raw);
  const aliases = normalizeAliases(raw.aliases || raw.user_terms || raw.userTerms);
  const note = normalizeText(raw.note || raw.description || raw.desc);
  const enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);
  const createdAt = normalizeText(raw.createdAt || raw.created_at) || nowIso();
  const updatedAt = normalizeText(raw.updatedAt || raw.updated_at) || createdAt;

  return {
    id,
    terms,
    aliases,
    note,
    enabled,
    createdAt,
    updatedAt,
  };
};

const normalizeStore = (value) => {
  if (Array.isArray(value)) {
    return {
      version: 1,
      updatedAt: nowIso(),
      entries: value.map(normalizeEntry).filter(Boolean),
    };
  }

  if (!value || typeof value !== 'object') {
    return makeDefaultState();
  }

  const rawEntries = Array.isArray(value.entries)
    ? value.entries
    : Array.isArray(value.items)
      ? value.items
      : Array.isArray(value.dictionary)
        ? value.dictionary
        : [];

  return {
    version: Number(value.version) > 0 ? Number(value.version) : 1,
    updatedAt: normalizeText(value.updatedAt) || nowIso(),
    entries: rawEntries.map(normalizeEntry).filter(Boolean),
  };
};

const readStore = async () => {
  await ensureStore();
  try {
    const raw = await fs.promises.readFile(STORE_PATH, 'utf8');
    if (!String(raw || '').trim()) {
      return makeDefaultState();
    }

    const parsed = readJsonSafe(raw);
    if (!parsed) {
      throw new Error('Translation dictionary JSON is invalid');
    }

    return normalizeStore(parsed);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return makeDefaultState();
    }
    throw err;
  }
};

const writeStore = async (state) => {
  await ensureStore();
  const nextState = {
    version: Number(state?.version) > 0 ? Number(state.version) : 1,
    updatedAt: nowIso(),
    entries: Array.isArray(state?.entries) ? state.entries : [],
  };

  await fs.promises.writeFile(STORE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  return nextState;
};

const mergeEntry = (existing, incoming) => {
  const mergedTerms = { ...(existing?.terms || {}) };
  const nextTerms = incoming?.terms || {};

  for (const key of Object.keys(nextTerms)) {
    mergedTerms[key] = normalizeText(nextTerms[key]);
  }

  return {
    ...existing,
    ...incoming,
    id: existing?.id || incoming.id,
    terms: mergedTerms,
    aliases: incoming.aliases.length > 0 ? incoming.aliases : existing?.aliases || [],
    note: incoming.note !== undefined ? incoming.note : existing?.note || '',
    enabled: incoming.enabled === undefined ? (existing?.enabled ?? true) : Boolean(incoming.enabled),
    createdAt: existing?.createdAt || incoming.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
};

const pickSearchPool = (entry) => {
  const pool = [];
  const terms = entry?.terms || {};
  for (const value of Object.values(terms)) {
    const text = normalizeText(value);
    if (text) pool.push(text);
  }
  for (const alias of entry?.aliases || []) {
    const text = normalizeText(alias);
    if (text) pool.push(text);
  }
  if (entry?.note) pool.push(String(entry.note));
  return pool;
};

const matchesSearch = (entry, search) => {
  if (!search) return true;
  const needle = normalizeSearchText(search);
  if (!needle) return true;

  return pickSearchPool(entry).some((value) => normalizeSearchText(value).includes(needle));
};

const createResponseItem = (entry) => ({
  ...entry,
  terms: { ...(entry.terms || {}) },
  aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : [],
});

exports.translation_dictionary_list = async (req, res, DATA) => {
  try {
    const store = await readStore();
    const search = normalizeText(DATA?.search || DATA?.query || '');
    const includeDisabled = Boolean(DATA?.includeDisabled);

    let items = Array.isArray(store.entries) ? store.entries : [];
    if (!includeDisabled) {
      items = items.filter((entry) => entry?.enabled !== false);
    }
    if (search) {
      items = items.filter((entry) => matchesSearch(entry, search));
    }

    items = [...items].sort((a, b) => {
      const aTime = Date.parse(a?.updatedAt || a?.createdAt || '') || 0;
      const bTime = Date.parse(b?.updatedAt || b?.createdAt || '') || 0;
      return bTime - aTime;
    });

    return res.send({
      tk_status: 'OK',
      data: {
        version: store.version,
        updatedAt: store.updatedAt,
        filePath: STORE_PATH,
        count: items.length,
        items: items.map(createResponseItem),
      },
    });
  } catch (e) {
    return res.send({ tk_status: 'NG', message: e?.message || String(e) });
  }
};

exports.translation_dictionary_upsert = async (req, res, DATA) => {
  try {
    const store = await readStore();
    const incomingRows = Array.isArray(DATA?.entries)
      ? DATA.entries
      : Array.isArray(DATA?.items)
        ? DATA.items
        : DATA?.entry
          ? [DATA.entry]
          : [DATA];

    const normalizedIncoming = incomingRows.map(normalizeEntry).filter(Boolean);
    if (normalizedIncoming.length === 0) {
      return res.send({ tk_status: 'NG', message: 'Missing dictionary entry' });
    }

    const nextEntries = Array.isArray(store.entries) ? [...store.entries] : [];
    const results = [];

    for (const incoming of normalizedIncoming) {
      if (!hasAnyTerm(incoming)) {
        return res.send({ tk_status: 'NG', message: 'Dictionary entry must include at least one term' });
      }

      const incomingSignature = JSON.stringify({
        terms: incoming.terms,
        aliases: incoming.aliases,
        note: incoming.note,
      });

      let index = nextEntries.findIndex((entry) => entry.id === incoming.id);
      if (index < 0) {
        index = nextEntries.findIndex((entry) => JSON.stringify({
          terms: entry.terms,
          aliases: entry.aliases || [],
          note: entry.note || '',
        }) === incomingSignature);
      }

      if (index >= 0) {
        nextEntries[index] = mergeEntry(nextEntries[index], incoming);
        results.push({ id: nextEntries[index].id, action: 'updated' });
      } else {
        const created = {
          ...incoming,
          createdAt: incoming.createdAt || nowIso(),
          updatedAt: nowIso(),
        };
        nextEntries.push(created);
        results.push({ id: created.id, action: 'created' });
      }
    }

    const nextState = await writeStore({
      version: store.version,
      entries: nextEntries,
    });

    return res.send({
      tk_status: 'OK',
      data: {
        version: nextState.version,
        updatedAt: nextState.updatedAt,
        count: nextEntries.length,
        items: nextEntries.map(createResponseItem),
        results,
      },
    });
  } catch (e) {
    return res.send({ tk_status: 'NG', message: e?.message || String(e) });
  }
};

exports.translation_dictionary_delete = async (req, res, DATA) => {
  try {
    const id = normalizeText(DATA?.id || DATA?.entry?.id);
    if (!id) {
      return res.send({ tk_status: 'NG', message: 'Missing dictionary id' });
    }

    const store = await readStore();
    const nextEntries = Array.isArray(store.entries) ? store.entries.filter((entry) => entry.id !== id) : [];
    const deleted = (store.entries || []).length - nextEntries.length;

    if (!deleted) {
      return res.send({ tk_status: 'NG', message: 'Dictionary entry not found' });
    }

    const nextState = await writeStore({
      version: store.version,
      entries: nextEntries,
    });

    return res.send({
      tk_status: 'OK',
      data: {
        version: nextState.version,
        updatedAt: nextState.updatedAt,
        count: nextEntries.length,
        deleted,
        id,
      },
    });
  } catch (e) {
    return res.send({ tk_status: 'NG', message: e?.message || String(e) });
  }
};

exports.translation_dictionary_replace_all = async (req, res, DATA) => {
  try {
    const rows = Array.isArray(DATA?.entries)
      ? DATA.entries
      : Array.isArray(DATA?.items)
        ? DATA.items
        : [];

    const normalized = rows.map(normalizeEntry).filter(Boolean);
    const filtered = normalized.filter(hasAnyTerm);

    if (!filtered.length) {
      return res.send({ tk_status: 'NG', message: 'Missing dictionary entries' });
    }

    const nextState = await writeStore({
      version: 1,
      entries: filtered.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt || nowIso(),
        updatedAt: nowIso(),
      })),
    });

    return res.send({
      tk_status: 'OK',
      data: {
        version: nextState.version,
        updatedAt: nextState.updatedAt,
        count: nextState.entries.length,
        items: nextState.entries.map(createResponseItem),
      },
    });
  } catch (e) {
    return res.send({ tk_status: 'NG', message: e?.message || String(e) });
  }
};

exports.__translation_dictionary_internal = {
  readStore,
  writeStore,
  normalizeEntry,
  normalizeStore,
};
