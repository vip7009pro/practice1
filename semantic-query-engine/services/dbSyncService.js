const { openConnection } = require('../../config/database');
const { createLogger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const logger = createLogger('DbSyncService');
const METADATA_DIR = path.join(__dirname, '../metadata');

class DbSyncService {
  async loadTablesFromDB() {
    try {
      const pool = await openConnection();
      const query = `
        SELECT 
          TABLE_CATALOG,
          TABLE_SCHEMA,
          TABLE_NAME,
          TABLE_TYPE
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA', 'pg_catalog')
        ORDER BY TABLE_NAME
      `;
      const result = await pool.request().query(query);
      return result.recordset || [];
    } catch (error) {
      logger.error('Failed to load tables from DB', error);
      throw error;
    }
  }

  async loadColumnsFromDB(tableName) {
    try {
      const pool = await openConnection();
      const query = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
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

  async loadAllColumnsFromDB() {
    try {
      const tables = await this.loadTablesFromDB();
      const columnsDict = {};

      for (const table of tables) {
        const columns = await this.loadColumnsFromDB(table.TABLE_NAME);
        columnsDict[table.TABLE_NAME] = columns;
      }

      return columnsDict;
    } catch (error) {
      logger.error('Failed to load all columns from DB', error);
      throw error;
    }
  }

  async detectRelationshipsFromDB() {
    try {
      const pool = await openConnection();
      const query = `
        SELECT 
          KCU1.TABLE_NAME AS source_table,
          KCU1.COLUMN_NAME AS source_column,
          KCU2.TABLE_NAME AS target_table,
          KCU2.COLUMN_NAME AS target_column,
          RC.CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS RC
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU1
          ON KCU1.CONSTRAINT_NAME = RC.CONSTRAINT_NAME
          AND KCU1.TABLE_SCHEMA = RC.CONSTRAINT_SCHEMA
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU2
          ON KCU2.CONSTRAINT_NAME = RC.UNIQUE_CONSTRAINT_NAME
          AND KCU2.TABLE_SCHEMA = RC.UNIQUE_CONSTRAINT_SCHEMA
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
      const existingTables = forceSync ? { tables: [] } : this.loadExistingMetadata('tables.json');
      const existingColumns = forceSync ? { columns: [] } : this.loadExistingMetadata('columns.json');
      const existingRelationships = forceSync ? { relationships: [] } : this.loadExistingMetadata('relationships.json');

      const dbTables = await this.loadTablesFromDB();
      const dbColumnsDict = await this.loadAllColumnsFromDB();
      const dbRelationships = await this.detectRelationshipsFromDB();

      const existingTableNames = new Set(
        (existingTables.tables || []).map((t) => String(t.table_name || '').toLowerCase())
      );
      const existingColumnKeys = new Set(
        (existingColumns.columns || []).map((c) => `${String(c.table_name || '').toLowerCase()}.${String(c.column_name || '').toLowerCase()}`)
      );
      const existingRelKeys = new Set(
        (existingRelationships.relationships || []).map((r) => this.getRelationshipKey(r))
      );

      // Start with existing (empty array when forceSync=true)
      const mergedTables = [...(existingTables.tables || [])];
      for (const dbTable of dbTables) {
        if (!existingTableNames.has(String(dbTable.TABLE_NAME || '').toLowerCase())) {
          mergedTables.push({
            table_name: dbTable.TABLE_NAME,
            business_name: dbTable.TABLE_NAME,
            description: `Table ${dbTable.TABLE_NAME}`,
            synonyms: [],
            is_fact: dbTable.TABLE_TYPE === 'VIEW' ? false : true,
            created_from_db_sync: true,
          });
        }
      }

      const mergedColumns = [...(existingColumns.columns || [])];
      for (const [tableName, dbCols] of Object.entries(dbColumnsDict)) {
        for (const dbCol of dbCols) {
          const colKey = `${String(tableName).toLowerCase()}.${String(dbCol.COLUMN_NAME || '').toLowerCase()}`;
          if (!existingColumnKeys.has(colKey)) {
            mergedColumns.push({
              table_name: tableName,
              column_name: dbCol.COLUMN_NAME,
              business_name: dbCol.COLUMN_NAME,
              description: `Column ${dbCol.COLUMN_NAME}`,
              data_type: dbCol.DATA_TYPE,
              nullable: dbCol.IS_NULLABLE === 'YES',
              synonyms: [],
              is_measure: ['int', 'decimal', 'bigint', 'float', 'real'].includes(String(dbCol.DATA_TYPE || '').toLowerCase()),
              format_hint: this.guessFormat(dbCol.DATA_TYPE),
              created_from_db_sync: true,
            });
          }
        }
      }

      const mergedRelationships = [...(existingRelationships.relationships || [])];
      for (const dbRel of dbRelationships) {
        const relKey = this.getRelationshipKey({
          source_table: dbRel.source_table,
          source_column: dbRel.source_column,
          target_table: dbRel.target_table,
          target_column: dbRel.target_column,
        });
        if (!existingRelKeys.has(relKey)) {
          mergedRelationships.push({
            name: `${dbRel.source_table}_to_${dbRel.target_table}`,
            source_table: dbRel.source_table,
            source_column: dbRel.source_column,
            target_table: dbRel.target_table,
            target_column: dbRel.target_column,
            cardinality: 'N:1',
            business_meaning: `${dbRel.source_table} references ${dbRel.target_table}`,
            is_hidden: false,
            created_from_db_sync: true,
          });
        }
      }

      const syncReport = {
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        forceSync,
        tables: {
          existing: forceSync ? 0 : (existingTables.tables || []).length,
          from_db: dbTables.length,
          new_added: mergedTables.length - (forceSync ? 0 : (existingTables.tables || []).length),
          total: mergedTables.length,
        },
        columns: {
          existing: forceSync ? 0 : (existingColumns.columns || []).length,
          from_db: Object.values(dbColumnsDict).flat().length,
          new_added: mergedColumns.length - (forceSync ? 0 : (existingColumns.columns || []).length),
          total: mergedColumns.length,
        },
        relationships: {
          existing: forceSync ? 0 : (existingRelationships.relationships || []).length,
          from_db: dbRelationships.length,
          new_added: mergedRelationships.length - (forceSync ? 0 : (existingRelationships.relationships || []).length),
          total: mergedRelationships.length,
        },
      };

      return {
        tables: mergedTables,
        columns: mergedColumns,
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
      fs.writeFileSync(path.join(METADATA_DIR, 'tables.json'), JSON.stringify({ tables }, null, 2));
      fs.writeFileSync(path.join(METADATA_DIR, 'columns.json'), JSON.stringify({ columns }, null, 2));
      fs.writeFileSync(path.join(METADATA_DIR, 'relationships.json'), JSON.stringify({ relationships }, null, 2));
      return true;
    } catch (error) {
      logger.error('Failed to save metadata', error);
      throw error;
    }
  }

  guessFormat(dataType) {
    const dt = String(dataType || '').toLowerCase();
    if (['datetime', 'smalldatetime', 'date', 'time', 'datetime2'].includes(dt)) return 'date';
    if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney'].includes(dt)) return 'number';
    if (['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'].includes(dt)) return 'string';
    return 'string';
  }

  getRelationshipKey(rel) {
    const source_table = String(rel.source_table || '').toLowerCase();
    const target_table = String(rel.target_table || '').toLowerCase();
    const source_column = String(rel.source_column || '').toLowerCase();
    const target_column = String(rel.target_column || '').toLowerCase();
    return `${source_table}.${source_column}:${target_table}.${target_column}`;
  }
}

module.exports = { DbSyncService };
