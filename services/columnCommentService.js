const { openConnection } = require('../config/database');

const normalizeLike = (s) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t;
};

const formatType = (row) => {
  const t = String(row.data_type || '');
  if (t === 'nvarchar' || t === 'nchar' || t === 'varchar' || t === 'char') {
    if (row.max_length === -1) return `${t}(max)`;
    const len = t.startsWith('n') ? Number(row.max_length) / 2 : Number(row.max_length);
    return `${t}(${len})`;
  }
  if (t === 'decimal' || t === 'numeric') {
    return `${t}(${row.precision},${row.scale})`;
  }
  return t;
};

exports.get_column_comments = async (req, res, DATA) => {
  try {
    const page = Math.max(1, Number(DATA?.page || 1));
    const pageSize = Math.min(500, Math.max(1, Number(DATA?.pageSize || 200)));
    const offset = (page - 1) * pageSize;

    const schema = normalizeLike(DATA?.schema);
    const table = normalizeLike(DATA?.table);
    const column = normalizeLike(DATA?.column);
    const search = normalizeLike(DATA?.search);

    const pool = await openConnection();

    const where = [];
    if (schema) where.push('s.name LIKE @schema');
    if (table) where.push('t.name LIKE @table');
    if (column) where.push('c.name LIKE @column');
    if (search) {
      where.push('(t.name LIKE @search OR c.name LIKE @search OR CAST(ep.value AS NVARCHAR(4000)) LIKE @search)');
    }

    const whereSql = where.length ? `AND ${where.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(1) AS total
      FROM sys.tables t
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      INNER JOIN sys.columns c ON c.object_id = t.object_id
      LEFT JOIN sys.extended_properties ep
        ON ep.major_id = c.object_id
        AND ep.minor_id = c.column_id
        AND ep.name = 'MS_Description'
      WHERE t.is_ms_shipped = 0
      ${whereSql};
    `;

    const listSql = `
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
      ${whereSql}
      ORDER BY s.name, t.name, c.column_id
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    `;

    const r1 = pool.request();
    if (schema) r1.input('schema', schema.includes('%') ? schema : `%${schema}%`);
    if (table) r1.input('table', table.includes('%') ? table : `%${table}%`);
    if (column) r1.input('column', column.includes('%') ? column : `%${column}%`);
    if (search) r1.input('search', search.includes('%') ? search : `%${search}%`);

    const countRes = await r1.query(countSql);
    const total = Number(countRes?.recordset?.[0]?.total || 0);

    const r2 = pool.request();
    if (schema) r2.input('schema', schema.includes('%') ? schema : `%${schema}%`);
    if (table) r2.input('table', table.includes('%') ? table : `%${table}%`);
    if (column) r2.input('column', column.includes('%') ? column : `%${column}%`);
    if (search) r2.input('search', search.includes('%') ? search : `%${search}%`);
    r2.input('offset', offset);
    r2.input('pageSize', pageSize);

    const listRes = await r2.query(listSql);
    const items = (listRes.recordset || []).map((r) => ({
      schema: String(r.schema_name),
      table: String(r.table_name),
      column_id: Number(r.column_id),
      column: String(r.column_name),
      type: formatType(r),
      nullable: Boolean(r.is_nullable),
      identity: Boolean(r.is_identity),
      description: r.column_description ? String(r.column_description) : '',
    }));

    return res.send({
      tk_status: 'OK',
      data: {
        page,
        pageSize,
        total,
        items,
      },
    });
  } catch (e) {
    return res.send({ tk_status: 'NG', message: e?.message || String(e) });
  }
};

exports.update_column_comment = async (req, res, DATA) => {
  try {
    const schema = String(DATA?.schema || 'dbo').trim();
    const table = String(DATA?.table || '').trim();
    const column = String(DATA?.column || '').trim();
    const description = DATA?.description === null || DATA?.description === undefined ? '' : String(DATA.description);

    if (!table || !column) {
      return res.send({ tk_status: 'NG', message: 'Missing table/column' });
    }

    const pool = await openConnection();

    const sql = `
      DECLARE @schema SYSNAME = @schema_name;
      DECLARE @table SYSNAME = @table_name;
      DECLARE @column SYSNAME = @column_name;

      IF EXISTS (
        SELECT 1
        FROM sys.extended_properties ep
        INNER JOIN sys.tables t ON t.object_id = ep.major_id
        INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
        INNER JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ep.minor_id
        WHERE ep.name = 'MS_Description'
          AND s.name = @schema
          AND t.name = @table
          AND c.name = @column
      )
      BEGIN
        EXEC sys.sp_updateextendedproperty
          @name = N'MS_Description',
          @value = @desc,
          @level0type = N'SCHEMA', @level0name = @schema,
          @level1type = N'TABLE',  @level1name = @table,
          @level2type = N'COLUMN', @level2name = @column;
      END
      ELSE
      BEGIN
        EXEC sys.sp_addextendedproperty
          @name = N'MS_Description',
          @value = @desc,
          @level0type = N'SCHEMA', @level0name = @schema,
          @level1type = N'TABLE',  @level1name = @table,
          @level2type = N'COLUMN', @level2name = @column;
      END
    `;

    await pool
      .request()
      .input('schema_name', schema)
      .input('table_name', table)
      .input('column_name', column)
      .input('desc', description)
      .query(sql);

    return res.send({ tk_status: 'OK', data: { schema, table, column, description } });
  } catch (e) {
    return res.send({ tk_status: 'NG', message: e?.message || String(e) });
  }
};
