/**
 * Semantic Retriever - Retrieve relevant schema using vector search + metadata
 */

import {
  ResolvedSchema,
  TableMetadata,
  ColumnMetadata,
  BusinessMetric,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { normalizeText, tokenize } from '../utils/helpers';
import { MetadataService } from '../services/metadataService';
import { DEFAULT_TOP_K } from '../config/constants';

const logger = createLogger('SemanticRetriever');

export class SemanticRetriever {
  constructor(private metadataService: MetadataService) {}

  async retrieve(query: string, topK?: number): Promise<ResolvedSchema> {
    const startTime = Date.now();
    const k = topK || DEFAULT_TOP_K;

    try {
      const normalized = normalizeText(query);
      const tokens = tokenize(query);

      // Step 1: Retrieve relevant tables
      let relevantTables = this.retrieveTables(normalized, tokens, k);

      // Step 2: Retrieve relevant metrics
      const relevantMetrics = this.retrieveMetrics(normalized, tokens, Math.ceil(k / 2));

      // Step 2b: Extract tables from found metrics and add to relevant tables
      if (relevantMetrics.length > 0) {
        const tablesFromMetrics = this.extractTablesFromMetrics(relevantMetrics);
        const tableSet = new Map<string, TableMetadata>();
        
        // Add initially found tables
        for (const table of relevantTables) {
          tableSet.set(table.table_name, table);
        }
        
        // Add tables from metrics
        for (const table of tablesFromMetrics) {
          tableSet.set(table.table_name, table);
        }
        
        relevantTables = Array.from(tableSet.values());
      }

      // Step 3: Retrieve relevant columns
      const relevantColumns = this.retrieveColumns(
        normalized,
        tokens,
        relevantTables,
      );

      const retrievalMs = Date.now() - startTime;

      const result: ResolvedSchema = {
        relevant_tables: relevantTables,
        relevant_columns: relevantColumns,
        relevant_metrics: relevantMetrics,
        retrieval_ms: retrievalMs,
      };

      logger.info('Schema retrieved', {
        tables: relevantTables.length,
        columns: relevantColumns.length,
        metrics: relevantMetrics.length,
        ms: retrievalMs,
      });

      return result;
    } catch (error) {
      logger.error('Failed to retrieve schema', error);
      throw new SemanticEngineError('RETRIEVAL_FAILED', 'Schema retrieval failed', error);
    }
  }

  private retrieveTables(
    normalizedQuery: string,
    tokens: string[],
    topK: number,
  ): TableMetadata[] {
    const allTables = this.metadataService.getAllTables();
    const scored: Array<{ table: TableMetadata; score: number }> = [];

    for (const table of allTables) {
      let score = 0;

      // Match normalized query against business name
      const tableBusinessNormalized = normalizeText(table.business_name);
      if (normalizedQuery.includes(tableBusinessNormalized) || tableBusinessNormalized.includes(normalizedQuery)) {
        score += 1.0;
      }

      // Token-based matching
      const tableTokens = tokenize(table.business_name + ' ' + table.table_name);
      const commonTokens = tokens.filter((t) => tableTokens.includes(t));
      score += (commonTokens.length / Math.max(tokens.length, 1)) * 0.8;

      // Synonym matching
      if (table.synonyms) {
        for (const syn of table.synonyms) {
          const synTokens = tokenize(syn);
          const synCommonTokens = tokens.filter((t) => synTokens.includes(t));
          const synScore = (synCommonTokens.length / Math.max(tokens.length, 1)) * 0.6;
          if (synScore > 0) {
            score += synScore;
          }
        }
      }

      if (score > 0) {
        scored.push({ table, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((item) => item.table);
  }

  private retrieveColumns(
    normalizedQuery: string,
    tokens: string[],
    tables: TableMetadata[],
  ): ColumnMetadata[] {
    const columns: ColumnMetadata[] = [];
    const scored: Array<{ column: ColumnMetadata; score: number }> = [];

    for (const table of tables) {
      const tableColumns = this.metadataService.getColumns(table.table_name);

      for (const column of tableColumns) {
        let score = 0;

        // Normalize column business name
        const colBusinessNormalized = normalizeText(column.business_name);

        // Direct match
        if (
          normalizedQuery.includes(colBusinessNormalized) ||
          colBusinessNormalized.includes(normalizedQuery)
        ) {
          score += 0.9;
        }

        // Token matching
        const colTokens = tokenize(column.business_name + ' ' + column.column_name);
        const commonTokens = tokens.filter((t) => colTokens.includes(t));
        score += (commonTokens.length / Math.max(tokens.length, 1)) * 0.7;

        // Synonym matching
        if (column.synonyms) {
          for (const syn of column.synonyms) {
            const synTokens = tokenize(syn);
            const synCommonTokens = tokens.filter((t) => synTokens.includes(t));
            const synScore = (synCommonTokens.length / Math.max(tokens.length, 1)) * 0.5;
            if (synScore > 0) {
              score += synScore;
            }
          }
        }

        // Searchability bonus
        if (column.is_searchable) {
          score *= 1.2;
        }

        if (score > 0) {
          scored.push({ column, score });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);

    // Return top columns (limit by number + ensure variety)
    const maxCols = Math.min(20, scored.length);
    const selected = new Map<string, ColumnMetadata>();

    for (const { column } of scored) {
      if (selected.size >= maxCols) break;

      const colKey = `${column.table_name}.${column.column_name}`;
      if (!selected.has(colKey)) {
        selected.set(colKey, column);
      }
    }

    return Array.from(selected.values());
  }

  private retrieveMetrics(
    normalizedQuery: string,
    tokens: string[],
    topK: number,
  ): BusinessMetric[] {
    const allMetrics = this.metadataService.getAllMetrics();
    const scored: Array<{ metric: BusinessMetric; score: number }> = [];

    for (const metric of allMetrics) {
      let score = 0;

      // Match normalized query
      const metricNameNormalized = normalizeText(metric.name);
      const metricBusinessNormalized = normalizeText(metric.business_name);

      if (normalizedQuery.includes(metricNameNormalized) || metricNameNormalized.includes(normalizedQuery)) {
        score += 1.0;
      }

      if (
        normalizedQuery.includes(metricBusinessNormalized) ||
        metricBusinessNormalized.includes(normalizedQuery)
      ) {
        score += 0.95;
      }

      // Token matching
      const metricTokens = tokenize(metric.name + ' ' + metric.business_name);
      const commonTokens = tokens.filter((t) => metricTokens.includes(t));
      score += (commonTokens.length / Math.max(tokens.length, 1)) * 0.8;

      if (score > 0) {
        scored.push({ metric, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((item) => item.metric);
  }

  /**
   * Extract table metadata from found metrics
   * When metrics are matched, retrieve all tables referenced in those metrics
   */
  private extractTablesFromMetrics(metrics: BusinessMetric[]): TableMetadata[] {
    const allTables = this.metadataService.getAllTables();
    const tableMap = new Map<string, TableMetadata>();

    // Create lookup map for quick access
    for (const table of allTables) {
      tableMap.set(table.table_name.toLowerCase(), table);
    }

    // Extract all table names referenced in metrics
    const extractedTables: TableMetadata[] = [];
    const seenTableNames = new Set<string>();

    for (const metric of metrics) {
      if (metric.tables && Array.isArray(metric.tables)) {
        for (const tableName of metric.tables) {
          const normalizedName = tableName.toLowerCase();

          if (!seenTableNames.has(normalizedName)) {
            const tableMetadata = tableMap.get(normalizedName);
            if (tableMetadata) {
              extractedTables.push(tableMetadata);
              seenTableNames.add(normalizedName);
            }
          }
        }
      }
    }

    return extractedTables;
  }

  /**
   * Enrich schema with metadata details
   */
  enrich(schema: ResolvedSchema): ResolvedSchema {
    // Tables already have full metadata
    // Columns already have full metadata
    // Metrics already have full metadata

    return schema;
  }
}
