/**
 * Database Sync Service - Load metadata from actual database
 * Smart merging to avoid overwriting existing metadata
 */

import { openConnection } from '../../config/database';
import { METADATA_CONFIG } from '../config/constants';
import {
  TableMetadata,
  ColumnMetadata,
  Relationship,
} from '../types';
import { createLogger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const logger = createLogger('DbSyncService');
const METADATA_DIR = METADATA_CONFIG.METADATA_DIR;
const BUNDLED_METADATA_DIR = METADATA_CONFIG.BUNDLED_METADATA_DIR;

export class DbSyncService {
  /**
   * Load table schema from database
   */
  async loadTablesFromDB(): Promise<any[]> {
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

  /**
   * Load columns from database for a specific table
   */
  async loadColumnsFromDB(tableName: string): Promise<any[]> {
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

  /**
   * Load all columns for all tables
   */
  async loadAllColumnsFromDB(): Promise<{ [key: string]: any[] }> {
    try {
      const tables = await this.loadTablesFromDB();
      const columnsDict: { [key: string]: any[] } = {};

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

  /**
   * Detect relationships from foreign keys
   */
  async detectRelationshipsFromDB(): Promise<any[]> {
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

  /**
   * Load existing metadata from JSON files
   */
  private loadExistingMetadata(fileName: string): any {
    const filePath = this.resolveMetadataFilePath(fileName);
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

  /**
   * Smart merge: sync DB schema with existing metadata
   * Never overwrites existing metadata, only adds new items
   */
  async syncMetadataFromDB(forceSync?: boolean): Promise<{
    tables: TableMetadata[];
    columns: ColumnMetadata[];
    relationships: Relationship[];
    syncReport: any;
  }> {
    try {
      const startTime = Date.now();

      // Load existing metadata
      const existingTables = forceSync ? { tables: [] } : this.loadExistingMetadata('tables.json');
      const existingColumns = forceSync ? { columns: [] } : this.loadExistingMetadata('columns.json');
      const existingRelationships = forceSync ? { relationships: [] } : this.loadExistingMetadata('relationships.json');

      // Load from DB
      const dbTables = await this.loadTablesFromDB();
      const dbColumnsDict = await this.loadAllColumnsFromDB();
      const dbRelationships = await this.detectRelationshipsFromDB();

      // Create lookup sets for existing items
      const existingTableNames = new Set(
        existingTables.tables?.map((t: any) => t.table_name.toLowerCase()) || []
      );
      const existingColumnKeys = new Set(
        existingColumns.columns?.map((c: any) => `${c.table_name.toLowerCase()}.${c.column_name.toLowerCase()}`) || []
      );
      const existingRelKeys = new Set(
        existingRelationships.relationships?.map((r: any) => this.getRelationshipKey(r)) || []
      );

      // Merge tables
      const mergedTables = [...(existingTables.tables || [])];
      for (const dbTable of dbTables) {
        if (!existingTableNames.has(dbTable.TABLE_NAME.toLowerCase())) {
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

      // Merge columns
      const mergedColumns = [...(existingColumns.columns || [])];
      for (const [tableName, dbCols] of Object.entries(dbColumnsDict)) {
        for (const dbCol of dbCols as any[]) {
          const colKey = `${tableName.toLowerCase()}.${dbCol.COLUMN_NAME.toLowerCase()}`;
          if (!existingColumnKeys.has(colKey)) {
            mergedColumns.push({
              table_name: tableName,
              column_name: dbCol.COLUMN_NAME,
              business_name: dbCol.COLUMN_NAME,
              description: `Column ${dbCol.COLUMN_NAME}`,
              data_type: dbCol.DATA_TYPE,
              nullable: dbCol.IS_NULLABLE === 'YES',
              synonyms: [],
              is_measure: ['int', 'decimal', 'bigint', 'float', 'real'].includes(
                dbCol.DATA_TYPE.toLowerCase()
              ),
              format_hint: this.guessFormat(dbCol.DATA_TYPE),
              created_from_db_sync: true,
            });
          }
        }
      }

      // Merge relationships
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

      // Generate sync report
      const syncReport = {
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        tables: {
          existing: (existingTables.tables || []).length,
          from_db: dbTables.length,
          new_added: mergedTables.length - (existingTables.tables || []).length,
          total: mergedTables.length,
        },
        columns: {
          existing: (existingColumns.columns || []).length,
          from_db: Object.values(dbColumnsDict).flat().length,
          new_added: mergedColumns.length - (existingColumns.columns || []).length,
          total: mergedColumns.length,
        },
        relationships: {
          existing: (existingRelationships.relationships || []).length,
          from_db: dbRelationships.length,
          new_added: mergedRelationships.length - (existingRelationships.relationships || []).length,
          total: mergedRelationships.length,
        },
      };

      logger.info('Metadata sync completed', syncReport);

      return {
        tables: mergedTables,
        columns: mergedColumns,
        relationships: mergedRelationships,
        syncReport,
      };
    } catch (error) {
      logger.error('Failed to sync metadata from DB', error);
      throw error;
    }
  }

  /**
   * Save synced metadata to JSON files
   */
  async saveMetadata(
    tables: TableMetadata[],
    columns: ColumnMetadata[],
    relationships: Relationship[]
  ): Promise<void> {
    try {
      // Ensure metadata directory exists
      if (!fs.existsSync(METADATA_DIR)) {
        fs.mkdirSync(METADATA_DIR, { recursive: true });
      }

      // Save tables
      const tablesPath = path.join(METADATA_DIR, 'tables.json');
      fs.writeFileSync(tablesPath, JSON.stringify({ tables }, null, 2));

      // Save columns
      const columnsPath = path.join(METADATA_DIR, 'columns.json');
      fs.writeFileSync(columnsPath, JSON.stringify({ columns }, null, 2));

      // Save relationships
      const relationshipsPath = path.join(METADATA_DIR, 'relationships.json');
      fs.writeFileSync(relationshipsPath, JSON.stringify({ relationships }, null, 2));

      logger.info('Metadata saved successfully', {
        tables: tables.length,
        columns: columns.length,
        relationships: relationships.length,
      });
    } catch (error) {
      logger.error('Failed to save metadata', error);
      throw error;
    }
  }

  private resolveMetadataFilePath(fileName: string): string {
    const writablePath = path.join(METADATA_DIR, fileName);
    if (fs.existsSync(writablePath)) {
      return writablePath;
    }

    const bundledPath = path.join(BUNDLED_METADATA_DIR, fileName);
    if (bundledPath !== writablePath && fs.existsSync(bundledPath)) {
      return bundledPath;
    }

    return writablePath;
  }

  /**
   * Helper: Generate unique key for relationship
   */
  private getRelationshipKey(rel: any): string {
    return `${rel.source_table.toLowerCase()}.${rel.source_column.toLowerCase()}->${rel.target_table.toLowerCase()}.${rel.target_column.toLowerCase()}`;
  }

  /**
   * Helper: Guess column format from data type
   */
  private guessFormat(dataType: string): string {
    const type = dataType.toLowerCase();
    if (type.includes('int')) return 'number';
    if (type.includes('decimal') || type.includes('float') || type.includes('real')) return 'decimal';
    if (type.includes('date') || type.includes('time')) return 'datetime';
    if (type.includes('bit')) return 'boolean';
    if (type.includes('char') || type.includes('text')) return 'text';
    return 'text';
  }
}

export const dbSyncService = new DbSyncService();
