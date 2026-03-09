const { validateSqlSafety, normalizeSql } = require('./sqlValidator');

const trimSchema = (s, maxChars = 12000) => {
  const t = String(s || '');
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars) + '\n...';
};

const buildPrompt = ({ retrievedSchema, question }) => {
  return [
    'You are a SQL Server expert.',
    '',
    'Database schema:',
    trimSchema(retrievedSchema),
    '',
    'User question:',
    question,
    '',
    'Write a valid SQL Server query only.',
    'Rules:',
    '- Output ONLY SQL text (no markdown, no explanation).',
    '- Only SELECT queries are allowed.',
    '- Prefer explicit schema-qualified table names (e.g. dbo.Table).',
    '- Keep result size reasonable (use TOP when appropriate).',
  ].join('\n');
};

const buildFixPrompt = ({ retrievedSchema, question, previousSql, sqlError }) => {
  return [
    buildPrompt({ retrievedSchema, question }),
    '',
    'The previous SQL executed on SQL Server but failed with an error.',
    'Previous SQL:',
    String(previousSql || ''),
    '',
    'SQL Server error message:',
    String(sqlError || ''),
    '',
    'Task: regenerate a corrected query.',
    'Rules:',
    '- Output ONLY SQL text (no markdown, no explanation).',
    '- Only a single-statement SELECT query is allowed.',
    '- Do NOT use dynamic SQL, EXEC, stored procedures, temp tables, or CTE recursion.',
    '- Fix invalid table/column names using ONLY the provided schema.',
    '- Keep result size reasonable (use TOP when appropriate).',
  ].join('\n');
};

exports.generateSelectSql = async ({ generateText, retrievedSchema, question, maxRetries = 2 }) => {
  let lastSql = '';
  let lastReason = '';
  let lastPrompt = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt =
      attempt === 0
        ? buildPrompt({ retrievedSchema, question })
        : [
            buildPrompt({ retrievedSchema, question }),
            '',
            'Your previous SQL was rejected for safety reasons:',
            lastReason,
            '',
            'Regenerate a SAFE single-statement SELECT query only.',
          ].join('\n');

    lastPrompt = prompt;

    const sqlText = normalizeSql(await generateText(prompt));
    lastSql = sqlText;

    const v = validateSqlSafety(sqlText);
    if (v.ok) return { sql: sqlText, prompt: lastPrompt };

    lastReason = v.reason;
  }

  return { sql: lastSql, prompt: lastPrompt, error: lastReason || 'Failed to generate safe SQL' };
};

exports.generateSelectSqlFix = async ({ generateText, retrievedSchema, question, previousSql, sqlError, maxRetries = 1 }) => {
  let lastSql = '';
  let lastReason = '';
  let lastPrompt = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt =
      attempt === 0
        ? buildFixPrompt({ retrievedSchema, question, previousSql, sqlError })
        : [
            buildFixPrompt({ retrievedSchema, question, previousSql, sqlError }),
            '',
            'Your previous SQL was rejected for safety reasons:',
            lastReason,
            '',
            'Regenerate a SAFE single-statement SELECT query only.',
          ].join('\n');

    lastPrompt = prompt;
    const sqlText = normalizeSql(await generateText(prompt));
    lastSql = sqlText;

    const v = validateSqlSafety(sqlText);
    if (v.ok) return { sql: sqlText, prompt: lastPrompt };
    lastReason = v.reason;
  }

  return { sql: lastSql, prompt: lastPrompt, error: lastReason || 'Failed to generate safe SQL' };
};
