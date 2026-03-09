const express = require('express');
const router = express.Router();

const { checkLoginIndex } = require('../middleware/auth');
const { SchemaIndex } = require('../ai/schemaIndex');
const { generateSelectSql, generateSelectSqlFix } = require('../ai/sqlGenerator');
const { validateSqlSafety, normalizeSql } = require('../ai/sqlValidator');
const { gemini_generateText } = require('../services/aiServices');
const { openConnection } = require('../config/database');

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

const tokenizeQ = (q) => {
  const s = String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9_\u00C0-\u024F\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]+/gi, ' ');
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
};

const pickRelevantColumns = ({ question, rows, maxCols = 10 }) => {
  const first = rows?.[0] || {};
  const keys = Object.keys(first);
  if (keys.length <= maxCols) return keys;

  const qTokens = new Set(tokenizeQ(question));
  const boost = [
    ['code', 7],
    ['g_code', 9],
    ['id', 7],
    ['no', 6],
    ['name', 8],
    ['desc', 7],
    ['descr', 7],
    ['remark', 5],
    ['status', 6],
    ['date', 6],
    ['time', 5],
    ['qty', 6],
    ['amt', 6],
    ['price', 6],
    ['cust', 5],
    ['customer', 5],
    ['vendor', 4],
    ['model', 5],
    ['material', 4],
  ];

  const scored = keys.map((k) => {
    const kl = String(k).toLowerCase();
    let s = 0;

    for (const [pat, w] of boost) {
      if (kl.includes(pat)) s += w;
    }
    for (const t of qTokens) {
      if (t && kl.includes(t)) s += 10;
    }

    // prefer shorter, readable columns
    if (kl.length <= 12) s += 1;

    return { k, s };
  });

  scored.sort((a, b) => b.s - a.s);
  const picked = scored.slice(0, maxCols).map((x) => x.k);

  // Ensure deterministic fallback if everything scores 0
  if (scored[0]?.s === 0) return keys.slice(0, maxCols);
  return picked;
};

const buildExplanation = async ({ question, sql, recordset }) => {
  const rows = Array.isArray(recordset) ? recordset : [];
  const totalRows = rows.length;
  const cols = totalRows > 0 ? Object.keys(rows[0] || {}) : [];
  const pickedCols = pickRelevantColumns({ question, rows, maxCols: 10 });
  const sample = rows.slice(0, 25).map((r) => {
    const o = {};
    for (const c of pickedCols) o[c] = r?.[c];
    return o;
  });

  const prompt = [
    'You are a senior ERP data analyst.',
    'Explain the query result to the user in Vietnamese in a concise, business-friendly way.',
    'If the question is in Korean, you may include Korean product code as-is, but the explanation must be Vietnamese.',
    'If there are many columns, focus only on the most relevant ones. Mention that the user can refer to the table for remaining fields.',
    'Do not invent fields that are not present in the sample.',
    '',
    'User question:',
    String(question || ''),
    '',
    'SQL executed:',
    String(sql || ''),
    '',
    `Result stats: rows=${totalRows}, columns=${cols.length}, shown_columns=${pickedCols.join(', ')}`,
    '',
    'Result sample (JSON array):',
    JSON.stringify(sample),
  ].join('\n');

  const text = await gemini_generateText(prompt, { model: 'gemini-2.5-flash', temperature: 0.2 });
  return String(text || '').trim();
};

const schemaIndex = new SchemaIndex();

const getExecRetryLimit = () => {
  const v = Number(process.env.AI_SQL_EXEC_RETRY || 2);
  if (!Number.isFinite(v)) return 2;
  return Math.max(0, Math.min(5, Math.floor(v)));
};

router.post('/query', checkLoginIndex, async (req, res) => {
  const started = Date.now();
  try {
    if (req.coloiko === 'coloi') {
      return res.status(401).json({ tk_status: 'NG', message: 'Unauthorized' });
    }

    const question = req.body?.question || req.body?.DATA?.question;
    const sqlOverride = req.body?.sql || req.body?.sql_override || req.body?.DATA?.sql || req.body?.DATA?.sql_override;
    const explain = Boolean(req.body?.explain ?? req.body?.DATA?.explain ?? true);
    if (sqlOverride && String(sqlOverride).trim().length > 0) {
      let sqlText = normalizeSql(String(sqlOverride));
      sqlText = String(sqlText).replace(/;\s*$/, '').trim();
      console.log('[AI_SQL][manual] sql_override');

      const validation = validateSqlSafety(sqlText);
      if (!validation.ok) {
        return res.json({ tk_status: 'NG', message: validation.reason, sql: sqlText });
      }

      const pool = await openConnection();
      const qStarted = Date.now();
      const result = await pool.request().query(sqlText);
      const qMs = Date.now() - qStarted;
      let explanation = '';
      if (explain) {
        try {
          explanation = await buildExplanation({ question: String(question || ''), sql: sqlText, recordset: result.recordset || [] });
        } catch (e) {
          if (isDebug()) console.log('[AI_SQL][manual] explain_error', e?.message || e);
        }
      }
      const ms = Date.now() - started;
      console.log('[AI_SQL][manual] done', { ms, query_ms: qMs, rows: result?.recordset?.length || 0 });

      return res.json({
        tk_status: 'OK',
        data: {
          sql: sqlText,
          data: result.recordset || [],
          explanation,
          execution_time_ms: ms,
        },
      });
    }

    if (!question || String(question).trim().length === 0) {
      return res.status(400).json({ tk_status: 'NG', message: 'Missing question' });
    }

    console.log('[AI_SQL][query] question', String(question));

    const t0 = Date.now();
    const hits = schemaIndex.search(String(question), 5);
    const searchMs = Date.now() - t0;
    if (isDebug()) {
      console.log(
        '[AI_SQL][query] schema_search',
        { ms: searchMs, indexCount: schemaIndex.count() },
        hits.map((h) => ({
          id: h?.doc?.id,
          score: Number(h?.score || 0),
        })),
      );
    }

    const retrievedSchema = hits
      .map((h) => {
        const name = h?.doc?.payload?.table_name || h?.doc?.id || '';
        return [`--- ${name} (score=${Number(h?.score || 0).toFixed(4)}) ---`, String(h?.doc?.text || ''), ''].join(
          '\n',
        );
      })
      .join('\n');
    if (isDebug()) {
      console.log('[AI_SQL][query] retrieved_schema_preview', retrievedSchema.slice(0, 1500));
    }

    const t1 = Date.now();
    const execRetryLimit = getExecRetryLimit();
    const pool = await openConnection();

    let sqlRes = await generateSelectSql({
      generateText: gemini_generateText,
      retrievedSchema,
      question: String(question),
      maxRetries: 2,
    });
    const genMs = Date.now() - t1;
    if (isDebug()) {
      console.log('[AI_SQL][query] sql_generated', { ms: genMs, sql: sqlRes.sql });
    }

    let finalSql = '';
    let finalPrompt = sqlRes.prompt || '';
    let qMs = 0;
    let result = null;
    const attempts = [];

    for (let execAttempt = 0; execAttempt <= execRetryLimit; execAttempt++) {
      if (sqlRes.error) {
        return res.json({
          tk_status: 'NG',
          message: sqlRes.error,
          sql: sqlRes.sql || '',
          sql_generation_prompt: sqlRes.prompt || '',
        });
      }

      const validation = validateSqlSafety(sqlRes.sql);
      if (!validation.ok) {
        return res.json({
          tk_status: 'NG',
          message: validation.reason,
          sql: sqlRes.sql || '',
          sql_generation_prompt: sqlRes.prompt || '',
        });
      }

      finalSql = sqlRes.sql;
      finalPrompt = sqlRes.prompt || finalPrompt;
      const qStarted = Date.now();

      try {
        console.log('sql', finalSql);
        result = await pool.request().query(finalSql);
        qMs = Date.now() - qStarted;
        attempts.push({ attempt: execAttempt, ok: true, sql: finalSql });
        break;
      } catch (e) {
        qMs = Date.now() - qStarted;
        const errMsg = e?.message || String(e);
        attempts.push({ attempt: execAttempt, ok: false, sql: finalSql, error: errMsg });
        if (isDebug()) console.log('[AI_SQL][query] sql_exec_error', { attempt: execAttempt, message: errMsg });

        if (execAttempt >= execRetryLimit) {
          return res.json({
            tk_status: 'NG',
            message: errMsg,
            sql: finalSql,
            sql_generation_prompt: finalPrompt,
            attempts,
          });
        }

        const fixStarted = Date.now();
        const fixRes = await generateSelectSqlFix({
          generateText: gemini_generateText,
          retrievedSchema,
          question: String(question),
          previousSql: finalSql,
          sqlError: errMsg,
          maxRetries: 1,
        });
        const fixMs = Date.now() - fixStarted;
        if (isDebug()) {
          console.log('[AI_SQL][query] sql_fixed', { attempt: execAttempt + 1, ms: fixMs, sql: fixRes.sql });
        }
        sqlRes = fixRes;
      }
    }

    if (!result) {
      return res.json({ tk_status: 'NG', message: 'Failed to execute query', sql: finalSql, sql_generation_prompt: finalPrompt, attempts });
    }

    let explanation = '';
    if (explain) {
      try {
        explanation = await buildExplanation({ question: String(question || ''), sql: finalSql, recordset: result.recordset || [] });
      } catch (e) {
        if (isDebug()) console.log('[AI_SQL][query] explain_error', e?.message || e);
      }
    }

    const ms = Date.now() - started;
    console.log('[AI_SQL][query] done', { ms, query_ms: qMs, rows: result?.recordset?.length || 0 });

    return res.json({
      tk_status: 'OK',
      data: {
        sql: finalSql,
        sql_generation_prompt: finalPrompt || '',
        data: result.recordset || [],
        explanation,
        execution_time_ms: ms,
        attempts,
      },
    });
  } catch (e) {
    const ms = Date.now() - started;
    console.log('[AI_SQL][query] error', { ms, message: e?.message || e });
    return res.json({ tk_status: 'NG', message: e?.message || String(e) });
  }
});

module.exports = router;
