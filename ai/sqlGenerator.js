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
