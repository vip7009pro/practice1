/**
 * Metadata Service - Load and manage table/column metadata
 */

import fs from 'fs';
import path from 'path';
import {
  TableMetadata,
  ColumnMetadata,
  BusinessMetric,
  Relationship,
  MetadataError,
} from '../types';
import { createLogger } from '../utils/logger';
import { normalizeText, stringSimilarity, findBestMatch } from '../utils/helpers';
import { METADATA_CONFIG } from '../config/constants';

const logger = createLogger('MetadataService');

export class MetadataService {
  private tables: Map<string, TableMetadata> = new Map();
  private columns: Map<string, ColumnMetadata[]> = new Map(); // table_name -> columns
  private metrics: Map<string, BusinessMetric> = new Map();
  private relationships: Relationship[] = [];
  private glossary: any[] = [];
  private _isLoaded = false;

  async initialize(metadataDir?: string): Promise<void> {
    const dir = metadataDir || METADATA_CONFIG.METADATA_DIR;

    // Clear all state before reloading to prevent duplicates on re-initialize
    this.tables = new Map();
    this.columns = new Map();
    this.metrics = new Map();
    this.relationships = [];
    this.glossary = [];
    this._isLoaded = false;

    try {
      await this.loadTables(path.join(dir, METADATA_CONFIG.TABLES_FILE));
      await this.loadColumns(path.join(dir, METADATA_CONFIG.COLUMNS_FILE));
      await this.loadRelationships(path.join(dir, METADATA_CONFIG.RELATIONSHIPS_FILE));
      await this.loadMetrics(path.join(dir, METADATA_CONFIG.METRICS_FILE));
      await this.loadGlossary(path.join(dir, METADATA_CONFIG.GLOSSARY_FILE));

      this._isLoaded = true;
      logger.info('Metadata initialized successfully', {
        tables: this.tables.size,
        columns: Array.from(this.columns.values()).flat().length,
        metrics: this.metrics.size,
        relationships: this.relationships.length,
      });
    } catch (error) {
      logger.error('Failed to initialize metadata', error);
      throw error;
    }
  }

  private async loadTables(filePath: string): Promise<void> {
    const data = this.loadJsonFile(filePath);
    const tableList: TableMetadata[] = data.tables || [];

    for (const table of tableList) {
      this.tables.set(table.table_name.toLowerCase(), table);
    }

    logger.info(`Loaded ${tableList.length} table definitions`);
  }

  private async loadColumns(filePath: string): Promise<void> {
    const data = this.loadJsonFile(filePath);
    const columnList: ColumnMetadata[] = data.columns || [];

    for (const column of columnList) {
      const tableName = column.table_name.toLowerCase();
      if (!this.columns.has(tableName)) {
        this.columns.set(tableName, []);
      }
      this.columns.get(tableName)!.push(column);
    }

    logger.info(`Loaded ${columnList.length} column definitions`);
  }

  private async loadRelationships(filePath: string): Promise<void> {
    const data = this.loadJsonFile(filePath);
    const rawRelationships = data.relationships || [];
    
    // Normalize relationship property names: source_table -> from_table, etc.
    this.relationships = rawRelationships
      .filter((rel: any) => {
        // Skip relationships with undefined properties
        const fromTable = rel.from_table || rel.source_table;
        const toTable = rel.to_table || rel.target_table;
        if (!fromTable || !toTable) {
          logger.warn('Skipping relationship with undefined table', rel);
          return false;
        }
        return true;
      })
      .map((rel: any) => ({
        ...rel,
        // Normalize property names
        from_table: rel.from_table || rel.source_table,
        from_column: rel.from_column || rel.source_column,
        to_table: rel.to_table || rel.target_table,
        to_column: rel.to_column || rel.target_column,
      }));
    
    logger.info(`Loaded ${this.relationships.length} relationships (after normalization)`);
  }

  private async loadMetrics(filePath: string): Promise<void> {
    const data = this.loadJsonFile(filePath);
    const metricList: BusinessMetric[] = data.metrics || [];

    for (const metric of metricList) {
      this.metrics.set(metric.id.toLowerCase(), metric);
    }

    logger.info(`Loaded ${metricList.length} business metrics`);
  }

  private async loadGlossary(filePath: string): Promise<void> {
    const data = this.loadJsonFile(filePath);
    this.glossary = data.glossary || [];
    logger.info(`Loaded ${this.glossary.length} glossary entries`);
  }

  private loadJsonFile(filePath: string): any {
    if (!fs.existsSync(filePath)) {
      throw new MetadataError(`Metadata file not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new MetadataError(`Failed to parse metadata file: ${filePath}`, error);
    }
  }

  // ============ TABLE QUERIES ============

  getTable(tableName: string): TableMetadata | null {
    return this.tables.get(tableName.toLowerCase()) || null;
  }

  getAllTables(): TableMetadata[] {
    return Array.from(this.tables.values());
  }

  findTablesByBusinessName(query: string, topK = 5): TableMetadata[] {
    const normalized = normalizeText(query);
    const scored = Array.from(this.tables.values())
      .map((table) => {
        const score = Math.max(
          stringSimilarity(normalized, table.business_name),
          stringSimilarity(normalized, table.table_name),
        );

        // Bonus for synonym match
        let synonymScore = 0;
        if (table.synonyms) {
          for (const syn of table.synonyms) {
            const synScore = stringSimilarity(normalized, syn);
            if (synScore > synonymScore) {
              synonymScore = synScore;
            }
          }
        }

        return {
          table,
          score: Math.max(score, synonymScore),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item) => item.table);
  }

  // ============ COLUMN QUERIES ============

  getColumns(tableName: string): ColumnMetadata[] {
    return this.columns.get(tableName.toLowerCase()) || [];
  }

  getColumn(tableName: string, columnName: string): ColumnMetadata | null {
    const columns = this.columns.get(tableName.toLowerCase()) || [];
    return columns.find((c) => c.column_name.toLowerCase() === columnName.toLowerCase()) || null;
  }

  findColumnsByTable(tableName: string, query: string, topK = 5): ColumnMetadata[] {
    const columns = this.columns.get(tableName.toLowerCase()) || [];
    const normalized = normalizeText(query);

    const scored = columns
      .map((column) => {
        const score = Math.max(
          stringSimilarity(normalized, column.business_name),
          stringSimilarity(normalized, column.column_name),
        );

        let synonymScore = 0;
        if (column.synonyms) {
          for (const syn of column.synonyms) {
            const synScore = stringSimilarity(normalized, syn);
            if (synScore > synonymScore) {
              synonymScore = synScore;
            }
          }
        }

        return { column, score: Math.max(score, synonymScore) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item) => item.column);
  }

  // ============ METRIC QUERIES ============

  getMetric(metricId: string): BusinessMetric | null {
    return this.metrics.get(metricId.toLowerCase()) || null;
  }

  getAllMetrics(): BusinessMetric[] {
    return Array.from(this.metrics.values());
  }

  findMetricsByName(query: string, topK = 5): BusinessMetric[] {
    const normalized = normalizeText(query);
    const scored = Array.from(this.metrics.values())
      .map((metric) => {
        const score = Math.max(
          stringSimilarity(normalized, metric.name),
          stringSimilarity(normalized, metric.business_name),
          stringSimilarity(normalized, metric.id),
        );

        return { metric, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item) => item.metric);
  }

  validateMetric(metric: BusinessMetric): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metric.id || !metric.name || !metric.formula || !metric.tables) {
      errors.push('Metric missing required fields: id, name, formula, tables');
    }

    // Validate tables exist in metadata
    for (const tableName of metric.tables || []) {
      if (!this.getTable(tableName)) {
        errors.push(`Table not found in metadata: ${tableName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============ RELATIONSHIP QUERIES ============

  getRelationships(): Relationship[] {
    return [...this.relationships];
  }

  findRelationshipsFrom(tableName: string): Relationship[] {
    return this.relationships.filter((r) => r.from_table.toLowerCase() === tableName.toLowerCase());
  }

  findRelationshipsTo(tableName: string): Relationship[] {
    return this.relationships.filter((r) => r.to_table.toLowerCase() === tableName.toLowerCase());
  }

  findRelationship(
    fromTable: string,
    toTable: string,
  ): Relationship | null {
    return (
      this.relationships.find(
        (r) =>
          r.from_table.toLowerCase() === fromTable.toLowerCase() &&
          r.to_table.toLowerCase() === toTable.toLowerCase(),
      ) || null
    );
  }

  // ============ GLOSSARY QUERIES ============

  resolveBusinessTerm(userTerm: string): string | null {
    const normalized = normalizeText(userTerm);

    for (const entry of this.glossary) {
      const userTerms: string[] = entry.user_terms || [];
      for (const term of userTerms) {
        if (normalizeText(term) === normalized) {
          return entry.canonical_term;
        }
      }

      // Fuzzy match
      const bestMatch = findBestMatch(userTerm, userTerms, 0.7);
      if (bestMatch) {
        return entry.canonical_term;
      }
    }

    return null;
  }

  getLikeGlossaryEntries(userTerm: string, topK = 3): any[] {
    const normalized = normalizeText(userTerm);
    const scored = this.glossary
      .map((entry) => {
        let score = 0;

        // Match against user terms
        for (const term of entry.user_terms || []) {
          const termScore = stringSimilarity(normalized, normalizeText(term));
          if (termScore > score) {
            score = termScore;
          }
        }

        // Match against canonical term
        const canonScore = stringSimilarity(normalized, normalizeText(entry.canonical_term));
        if (canonScore > score) {
          score = canonScore;
        }

        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((item) => item.entry);
  }

  // ============ UTILITIES ============

  isLoaded(): boolean {
    return this._isLoaded;
  }

  getStats(): {
    tables: number;
    columns: number;
    metrics: number;
    relationships: number;
  } {
    return {
      tables: this.tables.size,
      columns: Array.from(this.columns.values()).flat().length,
      metrics: this.metrics.size,
      relationships: this.relationships.length,
    };
  }
}

// Export singleton
let instance: MetadataService | null = null;

export async function getMetadataService(metadataDir?: string): Promise<MetadataService> {
  if (!instance) {
    instance = new MetadataService();
    await instance.initialize(metadataDir);
  }
  return instance;
}

export function resetMetadataService(): void {
  instance = null;
}
