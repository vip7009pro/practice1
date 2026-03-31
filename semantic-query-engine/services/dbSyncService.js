const { openConnection } = require('../../config/database');
const { createLogger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const logger = createLogger('DbSyncService');
const METADATA_DIR = path.join(__dirname, '../metadata');

class DbSyncService {
  /**
   * Load all tables from DB, including MS_Description comment as TABLE_DESCRIPTION.
   */
  async loadTablesFromDB() {
    try {
      const pool = await openConnection();
      const query = `
        SELECT
          t.TABLE_CATALOG,
          t.TABLE_SCHEMA,
          t.TABLE_NAME,
          t.TABLE_TYPE,
          CAST(ep.value AS NVARCHAR(500)) AS TABLE_DESCRIPTION
        FROM INFORMATION_SCHEMA.TABLES t
        LEFT JOIN sys.extended_properties ep
          ON ep.major_id = OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME)
          AND ep.minor_id = 0
          AND ep.name = 'MS_Description'
        WHERE t.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA', 'pg_catalog')
        ORDER BY t.TABLE_NAME
      `;
      const result = await pool.request().query(query);
      return result.recordset || [];
    } catch (error) {
      logger.error('Failed to load tables from DB', error);
      throw error;
    }
  }

  /**
   * Load columns for a single table, including MS_Description comment.
   */
  async loadColumnsFromDB(tableName) {
    try {
      const pool = await openConnection();
      const query = `
        SELECT
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.NUMERIC_PRECISION,
          c.NUMERIC_SCALE,
          CAST(ep.value AS NVARCHAR(500)) AS COLUMN_DESCRIPTION
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN sys.extended_properties ep
          ON ep.major_id = OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME)
          AND ep.minor_id = COLUMNPROPERTY(
            OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME),
            c.COLUMN_NAME, 'ColumnId')
          AND ep.name = 'MS_Description'
        WHERE c.TABLE_NAME = @tableName
        ORDER BY c.ORDINAL_POSITION
      `;
      const result = await pool
        .request()
        .input('tableName', tableName)
        .query(query);
      return result.recordset || [];
    } catch (error) {
      logger.error(`Failed to load columns for table ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Bulk-load ALL columns for ALL tables in a single query (avoids N+1 DB calls).
   * Includes MS_Description as COLUMN_DESCRIPTION.
   */
  async loadAllColumnsFromDB() {
    try {
      const pool = await openConnection();
      const query = `
        SELECT
          c.TABLE_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.NUMERIC_PRECISION,
          c.NUMERIC_SCALE,
          CAST(ep.value AS NVARCHAR(500)) AS COLUMN_DESCRIPTION
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t
          ON t.TABLE_NAME   = c.TABLE_NAME
          AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
          AND t.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA', 'pg_catalog')
        LEFT JOIN sys.extended_properties ep
          ON ep.major_id = OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME)
          AND ep.minor_id = COLUMNPROPERTY(
            OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME),
            c.COLUMN_NAME, 'ColumnId')
          AND ep.name = 'MS_Description'
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
      `;
      const result = await pool.request().query(query);
      const rows = result.recordset || [];

      // Group by table name
      const columnsDict = {};
      for (const row of rows) {
        if (!columnsDict[row.TABLE_NAME]) columnsDict[row.TABLE_NAME] = [];
        columnsDict[row.TABLE_NAME].push(row);
      }
      return columnsDict;
    } catch (error) {
      logger.error('Failed to load all columns from DB', error);
      throw error;
    }
  }

  /**
   * Detect FK relationships using sys.foreign_keys + sys.foreign_key_columns.
   *
   * FIX: The previous INFORMATION_SCHEMA approach cross-joined KCU1 and KCU2
   * without matching ORDINAL_POSITION, so each FK column was paired with every
   * PK column producing N×M duplicates per FK relationship.
   *
   * sys.foreign_key_columns always gives exactly one row per FK column pair.
   */
  async detectRelationshipsFromDB() {
    try {
      const pool = await openConnection();
      const query = `
        SELECT
          OBJECT_NAME(fk.parent_object_id)                        AS source_table,
          COL_NAME(fk.parent_object_id, fkc.parent_column_id)    AS source_column,
          OBJECT_NAME(fk.referenced_object_id)                    AS target_table,
          COL_NAME(fk.referenced_object_id, fkc.referenced_column_id) AS target_column,
          OBJECT_NAME(fk.object_id)                               AS CONSTRAINT_NAME
        FROM sys.foreign_keys          AS fk
        INNER JOIN sys.foreign_key_columns AS fkc
          ON fk.object_id = fkc.constraint_object_id
        ORDER BY source_table, source_column
      `;
      const result = await pool.request().query(query);
      return result.recordset || [];
    } catch (error) {
      logger.error('Failed to detect relationships from DB', error);
      throw error;
    }
  }

  loadExistingMetadata(fileName) {
    const filePath = path.join(METADATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return { tables: [], columns: [], relationships: [] };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn(`Failed to parse existing metadata file: ${fileName}`, error);
      return { tables: [], columns: [], relationships: [] };
    }
  }

  async syncMetadataFromDB(forceSync = false) {
    try {
      const startTime = Date.now();

      // When forceSync=true, treat existing metadata as empty → full overwrite
      const existingTables        = forceSync ? { tables: []        } : this.loadExistingMetadata('tables.json');
      const existingColumns       = forceSync ? { columns: []       } : this.loadExistingMetadata('columns.json');
      const existingRelationships = forceSync ? { relationships: [] } : this.loadExistingMetadata('relationships.json');

      const dbTables        = await this.loadTablesFromDB();
      const dbColumnsDict   = await this.loadAllColumnsFromDB();
      const dbRelationships = await this.detectRelationshipsFromDB();

      const existingTableNames = new Set(
        (existingTables.tables || []).map((t) => String(t.table_name || '').toLowerCase())
      );
      const existingColumnKeys = new Set(
        (existingColumns.columns || []).map(
          (c) => `${String(c.table_name || '').toLowerCase()}.${String(c.column_name || '').toLowerCase()}`
        )
      );
      const existingRelKeys = new Set(
        (existingRelationships.relationships || []).map((r) => this.getRelationshipKey(r))
      );

      // ── Tables ──────────────────────────────────────────────────────────────
      const mergedTables = [...(existingTables.tables || [])];
      for (const dbTable of dbTables) {
        const tableNameLower = String(dbTable.TABLE_NAME || '').toLowerCase();
        if (!existingTableNames.has(tableNameLower)) {
          mergedTables.push({
            table_name:   dbTable.TABLE_NAME,
            business_name: dbTable.TABLE_NAME,
            // Use DB comment (MS_Description) as description when available
            description:  dbTable.TABLE_DESCRIPTION
              ? String(dbTable.TABLE_DESCRIPTION).trim()
              : `Table ${dbTable.TABLE_NAME}`,
            synonyms:     [],
            is_fact:      dbTable.TABLE_TYPE === 'VIEW' ? false : true,
            created_from_db_sync: true,
          });
        } else if (forceSync && dbTable.TABLE_DESCRIPTION) {
          // forceSync: refresh description from DB comment for existing tables
          const idx = mergedTables.findIndex(
            (t) => String(t.table_name || '').toLowerCase() === tableNameLower
          );
          if (idx >= 0 && !mergedTables[idx].description_custom) {
            mergedTables[idx].description = String(dbTable.TABLE_DESCRIPTION).trim();
          }
        }
      }

      // ── Columns ─────────────────────────────────────────────────────────────
      const mergedColumns = [...(existingColumns.columns || [])];
      for (const [tableName, dbCols] of Object.entries(dbColumnsDict)) {
        for (const dbCol of dbCols) {
          const colKey = `${String(tableName).toLowerCase()}.${String(dbCol.COLUMN_NAME || '').toLowerCase()}`;
          if (!existingColumnKeys.has(colKey)) {
            const comment = dbCol.COLUMN_DESCRIPTION ? String(dbCol.COLUMN_DESCRIPTION).trim() : null;
            mergedColumns.push({
              table_name:    tableName,
              column_name:   dbCol.COLUMN_NAME,
              // Use comment as business_name when available (often Vietnamese label in this ERP)
              business_name: comment || dbCol.COLUMN_NAME,
              description:   comment || `Column ${dbCol.COLUMN_NAME}`,
              data_type:     dbCol.DATA_TYPE,
              nullable:      dbCol.IS_NULLABLE === 'YES',
              synonyms:      [],
              is_measure:    ['int', 'decimal', 'bigint', 'float', 'real']
                .includes(String(dbCol.DATA_TYPE || '').toLowerCase()),
              format_hint:   this.guessFormat(dbCol.DATA_TYPE),
              created_from_db_sync: true,
            });
          } else if (forceSync && dbCol.COLUMN_DESCRIPTION) {
            // forceSync: refresh description for existing columns
            const idx = mergedColumns.findIndex(
              (c) =>
                String(c.table_name  || '').toLowerCase() === String(tableName).toLowerCase() &&
                String(c.column_name || '').toLowerCase() === String(dbCol.COLUMN_NAME || '').toLowerCase()
            );
            if (idx >= 0 && !mergedColumns[idx].description_custom) {
              const comment = String(dbCol.COLUMN_DESCRIPTION).trim();
              mergedColumns[idx].description   = comment;
              if (!mergedColumns[idx].business_name_custom) {
                mergedColumns[idx].business_name = comment;
              }
            }
          }
        }
      }

      // ── Relationships ────────────────────────────────────────────────────────
      const mergedRelationships = [...(existingRelationships.relationships || [])];
      for (const dbRel of dbRelationships) {
        const relKey = this.getRelationshipKey({
          source_table:  dbRel.source_table,
          source_column: dbRel.source_column,
          target_table:  dbRel.target_table,
          target_column: dbRel.target_column,
        });
        if (!existingRelKeys.has(relKey)) {
          existingRelKeys.add(relKey); // prevent double-add within same sync batch
          mergedRelationships.push({
            // Include source_column in name → guarantees unique names per FK column pair
            name:             `${dbRel.source_table}_${dbRel.source_column}_to_${dbRel.target_table}`,
            source_table:     dbRel.source_table,
            source_column:    dbRel.source_column,
            target_table:     dbRel.target_table,
            target_column:    dbRel.target_column,
            cardinality:      'N:1',
            business_meaning: `${dbRel.source_table}.${dbRel.source_column} \u2192 ${dbRel.target_table}.${dbRel.target_column}`,
            is_hidden:        false,
            created_from_db_sync: true,
          });
        }
      }

      const syncReport = {
        timestamp:    new Date().toISOString(),
        duration_ms:  Date.now() - startTime,
        forceSync,
        tables: {
          existing:  forceSync ? 0 : (existingTables.tables || []).length,
          from_db:   dbTables.length,
          new_added: mergedTables.length - (forceSync ? 0 : (existingTables.tables || []).length),
          total:     mergedTables.length,
        },
        columns: {
          existing:  forceSync ? 0 : (existingColumns.columns || []).length,
          from_db:   Object.values(dbColumnsDict).reduce((s, c) => s + c.length, 0),
          new_added: mergedColumns.length - (forceSync ? 0 : (existingColumns.columns || []).length),
          total:     mergedColumns.length,
        },
        relationships: {
          existing:  forceSync ? 0 : (existingRelationships.relationships || []).length,
          from_db:   dbRelationships.length,
          new_added: mergedRelationships.length - (forceSync ? 0 : (existingRelationships.relationships || []).length),
          total:     mergedRelationships.length,
        },
      };

      return {
        tables:        mergedTables,
        columns:       mergedColumns,
        relationships: mergedRelationships,
        syncReport,
      };
    } catch (error) {
      logger.error('Failed to sync metadata from database', error);
      throw error;
    }
  }

  async saveMetadata(tables, columns, relationships) {
    try {
      if (!fs.existsSync(METADATA_DIR)) {
        fs.mkdirSync(METADATA_DIR, { recursive: true });
      }
      fs.writeFileSync(path.join(METADATA_DIR, 'tables.json'),        JSON.stringify({ tables },        null, 2));
      fs.writeFileSync(path.join(METADATA_DIR, 'columns.json'),       JSON.stringify({ columns },       null, 2));
      fs.writeFileSync(path.join(METADATA_DIR, 'relationships.json'), JSON.stringify({ relationships }, null, 2));
      return true;
    } catch (error) {
      logger.error('Failed to save metadata', error);
      throw error;
    }
  }

  guessFormat(dataType) {
    const dt = String(dataType || '').toLowerCase();
    if (['datetime', 'smalldatetime', 'date', 'time', 'datetime2'].includes(dt))            return 'date';
    if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric',
         'float', 'real', 'money', 'smallmoney'].includes(dt))                               return 'number';
    if (['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'].includes(dt))             return 'string';
    return 'string';
  }

  getRelationshipKey(rel) {
    // Support both new schema (source_table/target_table) and old schema (from_table/to_table)
    const source_table  = String(rel.source_table  || rel.from_table  || '').toLowerCase();
    const target_table  = String(rel.target_table  || rel.to_table    || '').toLowerCase();
    const source_column = String(rel.source_column || rel.from_column || '').toLowerCase();
    const target_column = String(rel.target_column || rel.to_column   || '').toLowerCase();
    return `${source_table}.${source_column}:${target_table}.${target_column}`;
  }
}

module.exports = { DbSyncService };
