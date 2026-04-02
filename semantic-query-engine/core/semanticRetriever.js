"use strict";
/**
 * Semantic Retriever - Retrieve relevant schema using hybrid search
 * Combines keyword matching (40%) + vector embeddings (60%)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const helpers_1 = require("../utils/helpers");
const embeddingService_1 = require("../services/embeddingService");
const constants_1 = require("../config/constants");
const logger = logger_1.createLogger('SemanticRetriever');
// Hybrid search weights
const KEYWORD_WEIGHT = 0.4;
const VECTOR_WEIGHT = 0.6;
class SemanticRetriever {
    constructor(metadataService, embeddingDir) {
        this.metadataService = metadataService;
        this.embeddingService = new embeddingService_1.EmbeddingService(embeddingDir);
    }
    /**
     * Calculate keyword similarity score
     */
    keywordScore(query, target) {
        const normalized = helpers_1.normalizeText(target);
        return helpers_1.stringSimilarity(query, normalized);
    }
    /**
     * Calculate vector similarity score
     */
    async vectorScore(query, target) {
        try {
            const queryEmbedding = await this.embeddingService.embed(query);
            const targetEmbedding = await this.embeddingService.embed(target);
            return this.embeddingService.cosineSimilarity(queryEmbedding, targetEmbedding);
        }
        catch (error) {
            logger.warn('Vector similarity calculation failed, using keyword score only', error);
            return 0;
        }
    }
    /**
     * Calculate hybrid score combining keyword and vector similarity
     */
    async hybridScore(query, target) {
        try {
            const kScore = this.keywordScore(query, target);
            const vScore = await this.vectorScore(query, target);
            return KEYWORD_WEIGHT * kScore + VECTOR_WEIGHT * vScore;
        }
        catch (error) {
            logger.warn('Hybrid score calculation failed', error);
            return this.keywordScore(query, target);
        }
    }
    async retrieve(query, topK) {
        const startTime = Date.now();
        const k = topK || constants_1.DEFAULT_TOP_K;
        try {
            const normalized = helpers_1.normalizeText(query);
            const tokens = helpers_1.tokenize(query);
            // Step 1: Retrieve relevant tables
            let relevantTables = await this.retrieveTables(normalized, tokens, k);
            // Step 2: Retrieve relevant metrics
            const relevantMetrics = await this.retrieveMetrics(normalized, tokens, Math.ceil(k / 2));
            // Step 2b: Extract tables from found metrics and add to relevant tables
            if (relevantMetrics.length > 0) {
                const tablesFromMetrics = this.extractTablesFromMetrics(relevantMetrics);
                const tableSet = new Map();
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
            const relevantColumns = await this.retrieveColumns(normalized, tokens, relevantTables);
            const retrievalMs = Date.now() - startTime;
            const result = {
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
        }
        catch (error) {
            logger.error('Failed to retrieve schema', error);
            throw new types_1.SemanticEngineError('RETRIEVAL_FAILED', 'Schema retrieval failed', error);
        }
    }
    async retrieveTables(normalizedQuery, tokens, topK) {
        const allTables = this.metadataService.getAllTables();
        const scored = [];
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
    async retrieveColumns(normalizedQuery, tokens, tables) {
        const columns = [];
        const scored = [];
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
        const selected = new Map();
        for (const { column } of scored) {
            if (selected.size >= maxCols)
                break;
            const colKey = `${column.table_name}.${column.column_name}`;
            if (!selected.has(colKey)) {
                selected.set(colKey, column);
            }
        }
        return Array.from(selected.values());
    }
    async retrieveMetrics(normalizedQuery, tokens, topK) {
        const allMetrics = this.metadataService.getAllMetrics();
        const scored = [];
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
    extractTablesFromMetrics(metrics) {
        const allTables = this.metadataService.getAllTables();
        const tableMap = new Map();
        // Create lookup map for quick access
        for (const table of allTables) {
            tableMap.set(table.table_name.toLowerCase(), table);
        }
        // Extract all table names referenced in metrics
        const extractedTables = [];
        const seenTableNames = new Set();
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
    clearEmbeddingCache() {
        this.embeddingService.clearCache();
        logger.info('Embedding cache cleared via SemanticRetriever');
    }
    /**
     * Enrich schema with metadata details
     */
    enrich(schema) {
        // Tables already have full metadata
        // Columns already have full metadata
        // Metrics already have full metadata
        return schema;
    }
}
exports.SemanticRetriever = SemanticRetriever;
