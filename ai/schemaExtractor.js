const { openConnection } = require('../config/database');

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

const loadTableColumns = async () => {
  const sql = `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      c.column_id,
      c.name AS column_name,
      ty.name AS data_type,
      c.max_length,
      c.precision,
      c.scale,
      c.is_nullable,
      c.is_identity,
      CAST(ep.value AS NVARCHAR(4000)) AS column_description
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    INNER JOIN sys.columns c ON c.object_id = t.object_id
    INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.extended_properties ep
      ON ep.major_id = c.object_id
      AND ep.minor_id = c.column_id
      AND ep.name = 'MS_Description'
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, c.column_id;
  `;

  const pool = await openConnection();
  const result = await pool.request().query(sql);
  return result.recordset || [];
};

const loadTableDescriptions = async () => {
  const sql = `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      CAST(ep.value AS NVARCHAR(4000)) AS table_description
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    LEFT JOIN sys.extended_properties ep
      ON ep.major_id = t.object_id
      AND ep.minor_id = 0
      AND ep.name = 'MS_Description'
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name;
  `;

  const pool = await openConnection();
  const result = await pool.request().query(sql);
  return result.recordset || [];
};

const loadForeignKeys = async () => {
  const sql = `
    SELECT
      s1.name AS schema_name,
      t1.name AS table_name,
      c1.name AS column_name,
      s2.name AS ref_schema_name,
      t2.name AS ref_table_name,
      c2.name AS ref_column_name,
      fk.name AS fk_name
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
      ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.tables t1
      ON t1.object_id = fkc.parent_object_id
    INNER JOIN sys.schemas s1
      ON s1.schema_id = t1.schema_id
    INNER JOIN sys.columns c1
      ON c1.object_id = t1.object_id
      AND c1.column_id = fkc.parent_column_id
    INNER JOIN sys.tables t2
      ON t2.object_id = fkc.referenced_object_id
    INNER JOIN sys.schemas s2
      ON s2.schema_id = t2.schema_id
    INNER JOIN sys.columns c2
      ON c2.object_id = t2.object_id
      AND c2.column_id = fkc.referenced_column_id
    WHERE t1.is_ms_shipped = 0
      AND t2.is_ms_shipped = 0
    ORDER BY s1.name, t1.name;
  `;

  const pool = await openConnection();
  const result = await pool.request().query(sql);
  return result.recordset || [];
};

const formatType = (row) => {
  const t = String(row.data_type || '');
  if (t === 'nvarchar' || t === 'nchar' || t === 'varchar' || t === 'char') {
    if (row.max_length === -1) return `${t}(max)`;
    const len = t.startsWith('n') ? row.max_length / 2 : row.max_length;
    return `${t}(${len})`;
  }
  if (t === 'decimal' || t === 'numeric') {
    return `${t}(${row.precision},${row.scale})`;
  }
  return t;
};

exports.extractSchema = async () => {
  const [cols, fks, tds] = await Promise.all([loadTableColumns(), loadForeignKeys(), loadTableDescriptions()]);

  if (isDebug()) {
    console.log('[SchemaExtractor] loaded', {
      columns: cols.length,
      foreignKeys: fks.length,
    });
  }

  const byTable = new Map();
  for (const r of cols) {
    const schema = String(r.schema_name || 'dbo');
    const table = String(r.table_name || '');
    if (!table) continue;
    const key = `${schema}.${table}`;

    if (!byTable.has(key)) {
      byTable.set(key, {
        schema,
        table,
        description: '',
        columns: [],
        relationships: [],
      });
    }

    byTable.get(key).columns.push({
      name: String(r.column_name || ''),
      type: formatType(r),
      nullable: Boolean(r.is_nullable),
      identity: Boolean(r.is_identity),
      description: r.column_description ? String(r.column_description) : '',
    });
  }

  for (const td of tds) {
    const schema = String(td.schema_name || 'dbo');
    const table = String(td.table_name || '');
    if (!table) continue;
    const key = `${schema}.${table}`;
    const doc = byTable.get(key);
    if (!doc) continue;
    doc.description = td.table_description ? String(td.table_description) : '';
  }

  for (const fk of fks) {
    const schema = String(fk.schema_name || 'dbo');
    const table = String(fk.table_name || '');
    const key = `${schema}.${table}`;
    const doc = byTable.get(key);
    if (!doc) continue;
    doc.relationships.push({
      fk_name: String(fk.fk_name || ''),
      column: String(fk.column_name || ''),
      references: `${String(fk.ref_schema_name || 'dbo')}.${String(fk.ref_table_name || '')}.${String(
        fk.ref_column_name || '',
      )}`,
    });
  }

  const tables = Array.from(byTable.values());
  if (isDebug()) {
    const sample = tables.slice(0, 2).map((t) => ({
      table: `${t.schema}.${t.table}`,
      columns: t.columns?.length || 0,
      relationships: t.relationships?.length || 0,
    }));
    console.log('[SchemaExtractor] tables', { count: tables.length, sample });
  }

  return tables;
};
