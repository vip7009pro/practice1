/**
 * Semantic Retriever - Retrieve relevant schema using hybrid search
 * Combines keyword matching (40%) + vector embeddings (60%)
 */

import {
  ResolvedSchema,
  TableMetadata,
  ColumnMetadata,
  BusinessMetric,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { normalizeText, tokenize, stringSimilarity } from '../utils/helpers';
import { MetadataService } from '../services/metadataService';
import { EmbeddingService } from '../services/embeddingService';
import { DEFAULT_TOP_K } from '../config/constants';

const logger = createLogger('SemanticRetriever');

// Hybrid search weights
const KEYWORD_WEIGHT = 0.4;
const VECTOR_WEIGHT = 0.6;

export class SemanticRetriever {
  private embeddingService: EmbeddingService;

  constructor(private metadataService: MetadataService, embeddingDir?: string) {
    this.embeddingService = new EmbeddingService(embeddingDir);
  }

  /**
   * Calculate keyword similarity score
   */
  private keywordScore(query: string, target: string): number {
    const normalized = normalizeText(target);
    return stringSimilarity(query, normalized);
  }

  /**
   * Calculate vector similarity score
   */
  private async vectorScore(query: string, target: string): Promise<number> {
    try {
      const queryEmbedding = await this.embeddingService.embed(query);
      const targetEmbedding = await this.embeddingService.embed(target);
      return this.embeddingService.cosineSimilarity(queryEmbedding, targetEmbedding);
    } catch (error) {
      logger.warn('Vector similarity calculation failed, using keyword score only', error);
      return 0;
    }
  }

  /**
   * Calculate hybrid score combining keyword and vector similarity
   */
  private async hybridScore(query: string, target: string): Promise<number> {
    try {
      const kScore = this.keywordScore(query, target);
      const vScore = await this.vectorScore(query, target);
      return KEYWORD_WEIGHT * kScore + VECTOR_WEIGHT * vScore;
    } catch (error) {
      logger.warn('Hybrid score calculation failed', error);
      return this.keywordScore(query, target);
    }
  }

  async retrieve(query: string, topK?: number): Promise<ResolvedSchema> {
    const startTime = Date.now();
    const k = topK || DEFAULT_TOP_K;

    try {
      const normalized = normalizeText(query);
      const tokens = tokenize(query);

      // Step 1: Retrieve relevant tables
      let relevantTables = await this.retrieveTables(normalized, tokens, k);

      // Step 2: Retrieve relevant metrics
      const relevantMetrics = await this.retrieveMetrics(normalized, tokens, Math.ceil(k / 2));

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
      const relevantColumns = await this.retrieveColumns(
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

      // Save embeddings cache after retrieval completes
      await this.embeddingService.saveCache();

      return result;
    } catch (error) {
      logger.error('Failed to retrieve schema', error);
      throw new SemanticEngineError('RETRIEVAL_FAILED', 'Schema retrieval failed', error);
    }
  }

  private async retrieveTables(
    normalizedQuery: string,
    tokens: string[],
    topK: number,
  ): Promise<TableMetadata[]> {
    const allTables = this.metadataService.getAllTables();
    const scored: Array<{ table: TableMetadata; score: number }> = [];

    for (const table of allTables) {
      // Combine keyword score + vector score
      const kScore = this.keywordScore(normalizedQuery, table.business_name);

      // Add vector similarity for table business name
      const vScore = await this.vectorScore(normalizedQuery, table.business_name);

      // Hybrid score
      let score = KEYWORD_WEIGHT * kScore + VECTOR_WEIGHT * vScore;

      // Add synonym boost
      if (table.synonyms && table.synonyms.length > 0) {
        let bestSynonyScore = 0;
        for (const syn of table.synonyms) {
          const synV = await this.vectorScore(normalizedQuery, syn);
          if (synV > bestSynonyScore) {
            bestSynonyScore = synV;
          }
        }
        if (bestSynonyScore > score) {
          score = bestSynonyScore;
        }
      }

      if (score > 0) {
        scored.push({ table, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((item) => item.table);
  }

  private async retrieveColumns(
    normalizedQuery: string,
    tokens: string[],
    tables: TableMetadata[],
  ): Promise<ColumnMetadata[]> {
    const columns: ColumnMetadata[] = [];
    const scored: Array<{ column: ColumnMetadata; score: number }> = [];

    for (const table of tables) {
      const tableColumns = this.metadataService.getColumns(table.table_name);

      for (const column of tableColumns) {
        // Hybrid scoring for column
        const kScore = this.keywordScore(normalizedQuery, column.business_name);
        const vScore = await this.vectorScore(normalizedQuery, column.business_name);
        let score = KEYWORD_WEIGHT * kScore + VECTOR_WEIGHT * vScore;

        // Add synonym boost
        if (column.synonyms && column.synonyms.length > 0) {
          let bestSynScore = 0;
          for (const syn of column.synonyms) {
            const synV = await this.vectorScore(normalizedQuery, syn);
            if (synV > bestSynScore) {
              bestSynScore = synV;
            }
          }
          if (bestSynScore > 0) {
            score = Math.max(score, bestSynScore * 0.9);
          }
        }

        // Searchability bonus
        if (column.is_searchable && score > 0) {
          score *= 1.1;
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

  private async retrieveMetrics(
    normalizedQuery: string,
    tokens: string[],
    topK: number,
  ): Promise<BusinessMetric[]> {
    const allMetrics = this.metadataService.getAllMetrics();
    const scored: Array<{ metric: BusinessMetric; score: number }> = [];

    for (const metric of allMetrics) {
      // Hybrid scoring for metric name
      const kScoreName = this.keywordScore(normalizedQuery, metric.name);
      const vScoreName = await this.vectorScore(normalizedQuery, metric.name);
      let score = KEYWORD_WEIGHT * kScoreName + VECTOR_WEIGHT * vScoreName;

      // Also check business name
      const kScoreBusiness = this.keywordScore(normalizedQuery, metric.business_name);
      const vScoreBusiness = await this.vectorScore(normalizedQuery, metric.business_name);
      const businessScore = KEYWORD_WEIGHT * kScoreBusiness + VECTOR_WEIGHT * vScoreBusiness;

      // Take the best of the two
      score = Math.max(score, businessScore);

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
   * Clear embedding cache
   * Called when metadata changes to invalidate cached embeddings
   */
  public clearEmbeddingCache(): void {
    this.embeddingService.clearCache();
    logger.info('Embedding cache cleared via SemanticRetriever');
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
