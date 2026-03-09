const FORBIDDEN = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'MERGE',
  'CREATE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
  'XP_',
];

const stripComments = (sql) => {
  let s = String(sql || '');
  s = s.replace(/--.*$/gm, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  return s;
};

const stripCodeFences = (sql) => {
  let s = String(sql || '').trim();

  // Common pattern: ```sql\n...\n```
  const fenceMatch = s.match(/```[a-zA-Z0-9_\-]*\s*\n([\s\S]*?)\n```/m);
  if (fenceMatch && fenceMatch[1]) return String(fenceMatch[1]).trim();

  // Remove stray fence tokens if present
  s = s.replace(/```[a-zA-Z0-9_\-]*/g, '');
  s = s.replace(/```/g, '');
  return s.trim();
};

const sanitizeSqlInput = (sql) => {
  let s = stripCodeFences(sql);
  // Sometimes models return leading labels like "SQL:". Remove common prefixes.
  s = s.replace(/^\s*sql\s*:\s*/i, '');
  return s.trim();
};

const normalize = (sql) => stripComments(sanitizeSqlInput(sql)).trim();

const isSelectOnly = (sql) => {
  let s = normalize(sql);
  if (!s) return false;

  // Allow a single trailing semicolon
  s = s.replace(/;\s*$/, '').trim();

  // allow leading parentheses / WITH
  const sUpper = s.toUpperCase();
  if (!(sUpper.startsWith('SELECT') || sUpper.startsWith('WITH'))) return false;

  for (const kw of FORBIDDEN) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(sUpper)) return false;
  }

  // Block multiple statements
  const withoutStrings = s.replace(/'([^']|'')*'/g, "''");
  if (withoutStrings.includes(';')) return false;

  return true;
};

exports.validateSqlSafety = (sql) => {
  if (!isSelectOnly(sql)) {
    return {
      ok: false,
      reason:
        'Unsafe SQL detected. Only single-statement SELECT queries are allowed. The assistant must not use INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/EXEC/etc.',
    };
  }
  return { ok: true };
};

exports.normalizeSql = normalize;
