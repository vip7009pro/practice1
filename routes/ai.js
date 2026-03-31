const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const { checkLoginIndex } = require('../middleware/auth');
const { SchemaIndex } = require('../ai/schemaIndex');
const { generateSelectSql, generateSelectSqlFix } = require('../ai/sqlGenerator');
const { validateSqlSafety, normalizeSql } = require('../ai/sqlValidator');
const { gemini_generateText } = require('../services/aiServices');
const { openConnection } = require('../config/database');

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

async function ensureSemanticQueryHandler() {
  if (global.semanticQueryHandler) {
    return global.semanticQueryHandler;
  }

  try {
    const { createSemanticQueryHandler } = require('../semantic-query-engine');
    const pool = await openConnection();
    global.semanticQueryHandler = await createSemanticQueryHandler(
      pool,
      gemini_generateText,
      './semantic-query-engine/metadata',
    );
    console.log('[V2_API] Semantic query handler initialized (lazy)');
    return global.semanticQueryHandler;
  } catch (err) {
    console.error('[V2_API] Failed to initialize semantic query handler', err);
    throw err;
  }
}

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

const buildEffectiveQuestion = ({ question, chat_history, chat_summary }) => {
  const q = String(question || '').trim();
  const summary = String(chat_summary || '').trim();

  const turns = Array.isArray(chat_history) ? chat_history : [];
  const safeTurns = turns
    .filter((t) => t && (t.user || t.assistant))
    .slice(Math.max(0, turns.length - 6))
    .map((t, i) => {
      const u = String(t?.user || '').trim();
      const a = String(t?.assistant || '').trim();
      return [`Turn ${i + 1} - User: ${u}`, `Turn ${i + 1} - Assistant: ${a}`].join('\n');
    })
    .join('\n');

  return [
    'You are continuing an ERP data conversation.',
    'Use the conversation context to resolve follow-up/elliptical questions.',
    'Do NOT change the time range / filters unless the user explicitly overrides them.',
    '',
    summary ? `Conversation summary so far:\n${summary}` : '',
    safeTurns ? `Recent conversation turns:\n${safeTurns}` : '',
    '',
    `Current user question:\n${q}`,
  ]
    .filter((x) => String(x || '').trim().length > 0)
    .join('\n');
};

const buildNextSummary = async ({ prevSummary, question, explanation }) => {
  const prev = String(prevSummary || '').trim();
  const q = String(question || '').trim();
  const a = String(explanation || '').trim();

  const prompt = [
    'You are maintaining a running summary of an ERP chat session.',
    'Write the updated summary in Vietnamese, max 8 bullet points.',
    'Focus on: chosen metrics, time ranges, filters (customer/product/department), grouping, and any assumptions.',
    'Do not include SQL. Do not include raw tables. Keep it short.',
    '',
    prev ? `Previous summary:\n${prev}` : 'Previous summary: (empty)',
    '',
    `New turn - User question:\n${q}`,
    '',
    `New turn - Assistant answer (explanation):\n${a}`,
    '',
    'Return ONLY the updated summary text.',
  ].join('\n');

  const text = await gemini_generateText(prompt, { model: 'gemini-2.5-flash', temperature: 0.2 });
  return String(text || '').trim();
};

router.post('/query', checkLoginIndex, async (req, res) => {
  const started = Date.now();
  try {
    if (req.coloiko === 'coloi') {
      return res.status(401).json({ tk_status: 'NG', message: 'Unauthorized' });
    }

    const question = req.body?.question || req.body?.DATA?.question;
    const chat_history = req.body?.chat_history || req.body?.DATA?.chat_history;
    const chat_summary = req.body?.chat_summary || req.body?.DATA?.chat_summary;
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

      let nextSummary = String(chat_summary || '').trim();
      if (explain) {
        try {
          nextSummary = await buildNextSummary({ prevSummary: nextSummary, question: String(question || ''), explanation });
        } catch (e) {
          if (isDebug()) console.log('[AI_SQL][manual] summary_error', e?.message || e);
        }
      }

      return res.json({
        tk_status: 'OK',
        data: {
          sql: sqlText,
          data: result.recordset || [],
          explanation,
          chat_summary: nextSummary,
          execution_time_ms: ms,
        },
      });
    }

    if (!question || String(question).trim().length === 0) {
      return res.status(400).json({ tk_status: 'NG', message: 'Missing question' });
    }

    const effectiveQuestion = buildEffectiveQuestion({ question, chat_history, chat_summary });
    console.log('[AI_SQL][query] question', String(question));

    const t0 = Date.now();
    const hits = schemaIndex.search(String(effectiveQuestion), 5);
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
      question: String(effectiveQuestion),
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
          question: String(effectiveQuestion),
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

    let nextSummary = String(chat_summary || '').trim();
    if (explain) {
      try {
        nextSummary = await buildNextSummary({ prevSummary: nextSummary, question: String(question || ''), explanation });
      } catch (e) {
        if (isDebug()) console.log('[AI_SQL][query] summary_error', e?.message || e);
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
        chat_summary: nextSummary,
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

// ============ SEMANTIC QUERY ENGINE V2 ENDPOINTS ============

/**
 * POST /ai/v2/query
 * Semantic-aware ERP query using the new semantic query engine
 */
router.post('/v2/query', checkLoginIndex, async (req, res) => {
  const started = Date.now();
  try {
    const question = req.body?.question || req.body?.DATA?.question;
    const chat_history = req.body?.chat_history || req.body?.DATA?.chat_history;
    const chat_summary = req.body?.chat_summary || req.body?.DATA?.chat_summary;
    const debug = req.body?.debug || req.body?.DATA?.debug || false;

    if (!question || String(question).trim().length === 0) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_QUESTION', message: 'Missing question' },
      });
    }

    // Lazy-load semantic query engine
    if (!global.semanticQueryHandler) {
      try {
        const { createSemanticQueryHandler } = require('../semantic-query-engine');
        const pool = await openConnection();

        global.semanticQueryHandler = await createSemanticQueryHandler(
          pool,
          gemini_generateText,
          './semantic-query-engine/metadata',
        );
        console.log('[V2_API] Semantic query handler initialized');
      } catch (err) {
        console.error('[V2_API] Failed to initialize semantic query handler', err);
        return res.status(500).json({
          tk_status: 'NG',
          error: {
            code: 'INIT_FAILED',
            message: 'Failed to initialize semantic query engine',
            details: isDebug() ? err.message : undefined,
          },
        });
      }
    }

    // Build semantic query request
    const semanticRequest = {
      question: String(question),
      chat_history: Array.isArray(chat_history) ? chat_history : [],
      chat_summary: String(chat_summary || ''),
      preferences: {
        explain: Boolean(req.body?.explain ?? true),
        debug: Boolean(debug),
        top_k: Number(req.body?.top_k || 7),
        max_depth: Number(req.body?.max_depth || 2),
      },
      user_id: req.user?.id || 'anonymous',
      session_id: req.sessionID || 'no_session',
    };

    // Execute semantic query
    const response = await global.semanticQueryHandler.handle(semanticRequest);

    const ms = Date.now() - started;

    if (response.tk_status === 'NG') {
      console.log('[V2_API] Query failed', { ms, error: response.error?.code });
      return res.json(response);
    }

    // Build next summary if explain is enabled
    let nextSummary = String(chat_summary || '').trim();
    if (req.body?.explain !== false && response.data?.summary) {
      try {
        nextSummary = await buildNextSummary({
          prevSummary: nextSummary,
          question: String(question),
          explanation: response.data.summary,
        });
      } catch (e) {
        if (isDebug()) console.log('[V2_API] summary_error', e?.message || e);
      }
    }

    console.log('[V2_API] Query completed', {
      ms,
      query_ms: response.data?.execution_time_ms,
      rows: response.data?.rows?.length || 0,
    });

    // Return formatted response
    return res.json({
      tk_status: response.tk_status,
      data: {
        sql: response.data?.sql || '',
        data: response.data?.rows || [],
        explanation: response.data?.summary || '',
        chat_summary: nextSummary,
        execution_time_ms: response.data?.total_time_ms || 0,
        visualization_hints: response.data?.visualization_hints,
        pipeline_steps: debug ? response.data?.pipeline_steps : undefined,
      },
    });
  } catch (e) {
    const ms = Date.now() - started;
    console.error('[V2_API] Unexpected error', { ms, message: e?.message });
    return res.status(500).json({
      tk_status: 'NG',
      error: {
        code: 'INTERNAL_ERROR',
        message: e?.message || 'Internal server error',
      },
    });
  }
});

/**
 * POST /ai/v2/metric
 * Execute metric query using the new semantic query engine
 */
router.post('/v2/metric', checkLoginIndex, async (req, res) => {
  const started = Date.now();
  try {
    const metric_id = req.body?.metric_id || req.body?.DATA?.metric_id;
    const filters = req.body?.filters || req.body?.DATA?.filters || [];
    const group_by = req.body?.group_by || req.body?.DATA?.group_by || [];
    const debug = req.body?.debug || req.body?.DATA?.debug || false;

    if (!metric_id || String(metric_id).trim().length === 0) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_METRIC_ID', message: 'Missing metric_id' },
      });
    }

    // Lazy-load metric handler
    if (!global.businessMetricHandler) {
      try {
        const {
          MetadataService,
          RelationshipGraph,
          RelationshipExpander,
          JoinPathResolver,
          SQLValidator,
          SQLGenerator,
          Executor,
          createBusinessMetricHandler,
        } = require('../semantic-query-engine');

        const pool = await openConnection();
        const metadataService = await new MetadataService();
        await metadataService.initialize('./semantic-query-engine/metadata');

        const graph = new RelationshipGraph(metadataService);
        const expander = new RelationshipExpander(metadataService, graph);
        const resolver = new JoinPathResolver(graph);
        const validator = new SQLValidator();
        const generator = new SQLGenerator(metadataService, gemini_generateText);
        const executor = new Executor(pool);

        global.businessMetricHandler = createBusinessMetricHandler(
          metadataService,
          graph,
          expander,
          resolver,
          validator,
          generator,
          executor,
        );

        console.log('[V2_API] Business metric handler initialized');
      } catch (err) {
        console.error('[V2_API] Failed to initialize metric handler', err);
        return res.status(500).json({
          tk_status: 'NG',
          error: {
            code: 'INIT_FAILED',
            message: 'Failed to initialize metric engine',
            details: isDebug() ? err.message : undefined,
          },
        });
      }
    }

    // Build metric query request
    const metricRequest = {
      metric_id: String(metric_id),
      filters: Array.isArray(filters) ? filters : [],
      group_by: Array.isArray(group_by) ? group_by : [],
      preferences: {
        debug: Boolean(debug),
      },
    };

    // Execute metric query
    const response = await global.businessMetricHandler.handle(metricRequest);

    const ms = Date.now() - started;

    if (response.tk_status === 'NG') {
      console.log('[V2_API] Metric query failed', { ms, error: response.error?.code });
      return res.json(response);
    }

    console.log('[V2_API] Metric query completed', {
      ms,
      metric: metric_id,
      rows: response.data?.rows?.length || 0,
    });

    // Return formatted response
    return res.json({
      tk_status: response.tk_status,
      data: {
        metric_id: response.data?.metric_id,
        metric_name: response.data?.metric_name,
        value: response.data?.value,
        rows: response.data?.rows,
        execution_time_ms: response.data?.execution_ms || 0,
      },
    });
  } catch (e) {
    const ms = Date.now() - started;
    console.error('[V2_API] Unexpected error', { ms, message: e?.message });
    return res.status(500).json({
      tk_status: 'NG',
      error: {
        code: 'INTERNAL_ERROR',
        message: e?.message || 'Internal server error',
      },
    });
  }
});

/**
 * GET /ai/v2/metrics
 * List available metrics
 */
router.get('/v2/metrics', checkLoginIndex, async (req, res) => {
  try {
    // Lazy-load metric handler
    if (!global.businessMetricHandler) {
      try {
        const { createBusinessMetricHandler, MetadataService } = require('../semantic-query-engine');

        const pool = await openConnection();
        const metadataService = new MetadataService();
        await metadataService.initialize('./semantic-query-engine/metadata');

        // Initialize other components
        global.businessMetricHandler = createBusinessMetricHandler(metadataService, metadataService, metadataService, metadataService, metadataService, metadataService, metadataService);
      } catch (err) {
        console.error('[V2_API] Failed to initialize for metrics list', err);
        return res.status(500).json({
          tk_status: 'NG',
          error: { code: 'INIT_FAILED', message: 'Failed to load metrics' },
        });
      }
    }

    const response = await global.businessMetricHandler.listMetrics();
    return res.json(response);
  } catch (e) {
    console.error('[V2_API] Failed to list metrics', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: {
        code: 'LIST_FAILED',
        message: e?.message || 'Failed to list metrics',
      },
    });
  }
});

// ==================== METADATA MANAGEMENT ENDPOINTS ====================

/**
 * Sync metadata from database
 * GET /ai/v2/metadata/sync
 * Returns: Synced tables, columns, relationships
 */
router.get('/v2/metadata/sync', checkLoginIndex, async (req, res) => {
  try {
    console.log('[V2_API] DEBUG: Sync request received at:', new Date().toISOString());

    let DbSyncService;
    const dbSyncPath = path.join(__dirname, '..', 'semantic-query-engine', 'services', 'dbSyncService');
    console.log('[V2_API] DEBUG: dbSyncPath', dbSyncPath);
    console.log('[V2_API] DEBUG: exists js', fs.existsSync(`${dbSyncPath}.js`));
    console.log('[V2_API] DEBUG: exists ts', fs.existsSync(`${dbSyncPath}.ts`));
    console.log('[V2_API] DEBUG: exists path', fs.existsSync(dbSyncPath));

    try {
      DbSyncService = require(dbSyncPath).DbSyncService;
    } catch (e) {
      console.warn('[V2_API] WARN: Could not require DbSyncService JS, trying ts-node/register fallback:', e?.message || e);
      try {
        require('ts-node/register/transpile-only');
        DbSyncService = require(`${dbSyncPath}.ts`).DbSyncService;
      } catch (err) {
        const msg = err?.message || err;
        console.error('[V2_API] ERROR: Failed to load DbSyncService from .ts file:', msg);
        return res.status(500).json({
          tk_status: 'NG',
          error: {
            code: 'SYNC_SERVICE_LOAD_FAILED',
            message: 'Require dbSyncService failed. ts-node fallback failed; ensure ts-node is installed and project paths are valid.',
            details: msg,
          },
        });
      }
    }

    const syncService = new DbSyncService();
    console.log('[V2_API] DEBUG: DbSyncService imported:', !!syncService);

    // Get forceSync parameter from query string
    const forceSync = req.query.forceSync === 'true' || req.body.forceSync === true;
    console.log('[V2_API] DEBUG: forceSync mode:', forceSync);

    // Perform sync
    const syncResult = await syncService.syncMetadataFromDB(forceSync);
    
    console.log('[V2_API] DEBUG: Sync completed. Report:', syncResult.syncReport);

    // Save synced data
    await syncService.saveMetadata(
      syncResult.tables,
      syncResult.columns,
      syncResult.relationships
    );

    // Ensure semantic query handler exists and initialize metadata service
    await ensureSemanticQueryHandler();
    try {
      await global.semanticQueryHandler.metadataService.initialize(
        './semantic-query-engine/metadata'
      );
      console.log('[V2_API] Semantic query handler metadata service reinitialized');
    } catch (e) {
      console.log('[V2_API] Note: Could not reinitialize metadata service', e?.message);
    }

    return res.json({
      tk_status: 'OK',
      data: {
        syncReport: syncResult.syncReport,
        tables: syncResult.tables,
        columns: syncResult.columns,
        relationships: syncResult.relationships,
      },
    });
  } catch (e) {
    console.error('[V2_API] Metadata sync failed:', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: {
        code: 'SYNC_FAILED',
        message: e?.message || 'Failed to sync metadata from database',
      },
    });
  }
});

/**
 * Get all tables from metadata
 * GET /ai/v2/metadata/tables
 */
router.get('/v2/metadata/tables', checkLoginIndex, async (req, res) => {
  try {
    await ensureSemanticQueryHandler();

    const tables = global.semanticQueryHandler.metadataService.getAllTables();
    return res.json({
      tk_status: 'OK',
      data: { tables, count: tables.length },
    });
  } catch (e) {
    console.error('[V2_API] Failed to get tables', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to get tables' },
    });
  }
});

/**
 * Get columns for a table
 * GET /ai/v2/metadata/columns/:tableName
 */
router.get('/v2/metadata/columns/:tableName', checkLoginIndex, async (req, res) => {
  try {
    await ensureSemanticQueryHandler();

    const { tableName } = req.params;
    const columns = global.semanticQueryHandler.metadataService.getColumns(tableName);

    return res.json({
      tk_status: 'OK',
      data: { columns, count: columns.length },
    });
  } catch (e) {
    console.error('[V2_API] Failed to get columns', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to get columns' },
    });
  }
});

/**
 * Get all relationships
 * GET /ai/v2/metadata/relationships
 */
router.get('/v2/metadata/relationships', checkLoginIndex, async (req, res) => {
  try {
    await ensureSemanticQueryHandler();

    const relationships = global.semanticQueryHandler.metadataService.getRelationships();
    return res.json({
      tk_status: 'OK',
      data: { relationships, count: relationships.length },
    });
  } catch (e) {
    console.error('[V2_API] Failed to get relationships', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to get relationships' },
    });
  }
});

/**
 * Add/Update a table metadata
 * POST /ai/v2/metadata/tables
 */
router.post('/v2/metadata/tables', checkLoginIndex, async (req, res) => {
  try {
    const { table_name, business_name, description, synonyms, is_fact, use_cases } = req.body;

    if (!table_name) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_FIELD', message: 'table_name is required' },
      });
    }

    // Read current tables file
    const fs = require('fs');
    const path = require('path');
    const tablesFile = path.join('./semantic-query-engine/metadata', 'tables.json');

    let data = { tables: [] };
    if (fs.existsSync(tablesFile)) {
      const content = fs.readFileSync(tablesFile, 'utf-8');
      data = JSON.parse(content);
    }

    // Find and update or add new table
    const existingIdx = data.tables.findIndex(t => t.table_name.toLowerCase() === table_name.toLowerCase());
    const newTable = {
      table_name,
      business_name: business_name || table_name,
      description: description || '',
      synonyms: synonyms || [],
      is_fact: is_fact !== undefined ? is_fact : true,
      use_cases: use_cases || [],
    };

    if (existingIdx >= 0) {
      data.tables[existingIdx] = newTable;
    } else {
      data.tables.push(newTable);
    }

    fs.writeFileSync(tablesFile, JSON.stringify(data, null, 2));

    // Reinitialize if needed
    if (global.semanticQueryHandler) {
      try {
        await global.semanticQueryHandler.metadataService.initialize(
          './semantic-query-engine/metadata'
        );
      } catch (e) {
        console.log('[V2_API] Note: Could not reinitialize metadata service', e?.message);
      }
    }

    return res.json({
      tk_status: 'OK',
      data: { table: newTable, message: 'Table metadata saved' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to save table', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to save table' },
    });
  }
});

/**
 * Add/Update column metadata
 * POST /ai/v2/metadata/columns
 */
router.post('/v2/metadata/columns', checkLoginIndex, async (req, res) => {
  try {
    const {
      table_name,
      column_name,
      business_name,
      description,
      data_type,
      nullable,
      synonyms,
      is_measure,
      format_hint,
    } = req.body;

    if (!table_name || !column_name) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_FIELD', message: 'table_name and column_name are required' },
      });
    }

    const fs = require('fs');
    const path = require('path');
    const columnsFile = path.join('./semantic-query-engine/metadata', 'columns.json');

    let data = { columns: [] };
    if (fs.existsSync(columnsFile)) {
      const content = fs.readFileSync(columnsFile, 'utf-8');
      data = JSON.parse(content);
    }

    // Find and update or add new column
    const key = `${table_name.toLowerCase()}.${column_name.toLowerCase()}`;
    const existingIdx = data.columns.findIndex(
      c =>
        c.table_name.toLowerCase() === table_name.toLowerCase() &&
        c.column_name.toLowerCase() === column_name.toLowerCase()
    );

    const newColumn = {
      table_name,
      column_name,
      business_name: business_name || column_name,
      description: description || '',
      data_type: data_type || 'varchar',
      nullable: nullable !== undefined ? nullable : true,
      synonyms: synonyms || [],
      is_measure: is_measure !== undefined ? is_measure : false,
      format_hint: format_hint || 'text',
    };

    if (existingIdx >= 0) {
      data.columns[existingIdx] = newColumn;
    } else {
      data.columns.push(newColumn);
    }

    fs.writeFileSync(columnsFile, JSON.stringify(data, null, 2));

    if (global.semanticQueryHandler) {
      try {
        await global.semanticQueryHandler.metadataService.initialize(
          './semantic-query-engine/metadata'
        );
      } catch (e) {
        console.log('[V2_API] Note: Could not reinitialize metadata service', e?.message);
      }
    }

    return res.json({
      tk_status: 'OK',
      data: { column: newColumn, message: 'Column metadata saved' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to save column', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to save column' },
    });
  }
});

/**
 * Add/Update relationship
 * POST /ai/v2/metadata/relationships
 */
router.post('/v2/metadata/relationships', checkLoginIndex, async (req, res) => {
  try {
    const {
      name,
      source_table,
      source_column,
      target_table,
      target_column,
      cardinality,
      business_meaning,
    } = req.body;

    if (!source_table || !source_column || !target_table || !target_column) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_FIELD', message: 'All relationship fields are required' },
      });
    }

    const fs = require('fs');
    const path = require('path');
    const relFile = path.join('./semantic-query-engine/metadata', 'relationships.json');

    let data = { relationships: [] };
    if (fs.existsSync(relFile)) {
      const content = fs.readFileSync(relFile, 'utf-8');
      data = JSON.parse(content);
    }

    // Check if relationship already exists
    const key = `${source_table.toLowerCase()}.${source_column.toLowerCase()}->${target_table.toLowerCase()}.${target_column.toLowerCase()}`;
    const existingIdx = data.relationships.findIndex(r => {
      const rKey = `${r.source_table.toLowerCase()}.${r.source_column.toLowerCase()}->${r.target_table.toLowerCase()}.${r.target_column.toLowerCase()}`;
      return rKey === key;
    });

    const newRel = {
      name: name || `${source_table}_to_${target_table}`,
      source_table,
      source_column,
      target_table,
      target_column,
      cardinality: cardinality || 'N:1',
      business_meaning: business_meaning || '',
      is_hidden: false,
    };

    if (existingIdx >= 0) {
      data.relationships[existingIdx] = newRel;
    } else {
      data.relationships.push(newRel);
    }

    fs.writeFileSync(relFile, JSON.stringify(data, null, 2));

    if (global.semanticQueryHandler) {
      try {
        await global.semanticQueryHandler.metadataService.initialize(
          './semantic-query-engine/metadata'
        );
      } catch (e) {
        console.log('[V2_API] Note: Could not reinitialize metadata service', e?.message);
      }
    }

    return res.json({
      tk_status: 'OK',
      data: { relationship: newRel, message: 'Relationship saved' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to save relationship', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to save relationship' },
    });
  }
});

// ==================== BUSINESS TRAINING ENDPOINTS ====================

/**
 * Get common query patterns for training
 * GET /ai/v2/training/patterns
 */
router.get('/v2/training/patterns', checkLoginIndex, async (req, res) => {
  try {
    await ensureSemanticQueryHandler();

    const { TrainingService } = require('../semantic-query-engine/services/trainingService');
    const trainingService = new TrainingService(global.semanticQueryHandler.metadataService);

    const patterns = await trainingService.learFromCommonPatterns();
    return res.json({
      tk_status: 'OK',
      data: { patterns, approach: 'pattern_based_learning' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to get patterns', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to get patterns' },
    });
  }
});

/**
 * Create a business rule (without writing SQL)
 * POST /ai/v2/training/rule
 */
router.post('/v2/training/rule', checkLoginIndex, async (req, res) => {
  try {
    const { name, condition, applies_to, result_field, calculation } = req.body;

    if (!name || !applies_to || !condition) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_FIELD', message: 'name, applies_to, and condition are required' },
      });
    }

    await ensureSemanticQueryHandler();

    const { TrainingService } = require('../semantic-query-engine/services/trainingService');
    const trainingService = new TrainingService(global.semanticQueryHandler.metadataService);

    const rule = await trainingService.createBusinessRule({
      name,
      condition,
      applies_to,
      result_field,
      calculation,
    });

    return res.json({
      tk_status: 'OK',
      data: { rule, message: 'Business rule created successfully' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to create rule', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to create rule' },
    });
  }
});

/**
 * Map business concept to SQL (semantic approach)
 * POST /ai/v2/training/concept
 */
router.post('/v2/training/concept', checkLoginIndex, async (req, res) => {
  try {
    const { business_question, primary_metric, dimension, time_period, filters } = req.body;

    if (!business_question || !primary_metric || !dimension) {
      return res.status(400).json({
        tk_status: 'NG',
        error: { code: 'MISSING_FIELD', message: 'business_question, primary_metric, and dimension are required' },
      });
    }

    await ensureSemanticQueryHandler();

    const { TrainingService } = require('../semantic-query-engine/services/trainingService');
    const trainingService = new TrainingService(global.semanticQueryHandler.metadataService);

    const concept = await trainingService.mapBusinessConceptToSQL({
      business_question,
      primary_metric,
      dimension,
      time_period,
      filters,
    });

    return res.json({
      tk_status: 'OK',
      data: { concept, message: 'Business concept mapped successfully' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to map concept', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to map concept' },
    });
  }
});

/**
 * Get training examples
 * GET /ai/v2/training/examples
 */
router.get('/v2/training/examples', checkLoginIndex, async (req, res) => {
  try {
    await ensureSemanticQueryHandler();

    const { TrainingService } = require('../semantic-query-engine/services/trainingService');
    const trainingService = new TrainingService(global.semanticQueryHandler.metadataService);

    const examples = trainingService.getTrainingExamples();
    return res.json({
      tk_status: 'OK',
      data: { examples, count: examples.length },
    });
  } catch (e) {
    console.error('[V2_API] Failed to get examples', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to get examples' },
    });
  }
});

/**
 * Delete training example
 * DELETE /ai/v2/training/examples/:id
 */
router.delete('/v2/training/examples/:id', checkLoginIndex, async (req, res) => {
  try {
    await ensureSemanticQueryHandler();

    const { id } = req.params;
    const { TrainingService } = require('../semantic-query-engine/services/trainingService');
    const trainingService = new TrainingService(global.semanticQueryHandler.metadataService);

    trainingService.deleteTrainingExample(id);

    return res.json({
      tk_status: 'OK',
      data: { message: 'Training example deleted' },
    });
  } catch (e) {
    console.error('[V2_API] Failed to delete example', e);
    return res.status(500).json({
      tk_status: 'NG',
      error: { code: 'FAILED', message: e?.message || 'Failed to delete example' },
    });
  }
});

module.exports = router;
