"use strict";
/**
 * Semantic Query Handler - Orchestrates the full pipeline
 */
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const metadataService_1 = require("../services/metadataService");
const queryRewriter_1 = require("../core/queryRewriter");
const semanticRetriever_1 = require("../core/semanticRetriever");
const relationshipGraph_1 = require("../core/relationshipGraph");
const relationshipExpander_1 = require("../core/relationshipExpander");
const joinPathResolver_1 = require("../core/joinPathResolver");
const sqlValidator_1 = require("../core/sqlValidator");
const sqlGenerator_1 = require("../core/sqlGenerator");
const executor_1 = require("../core/executor");
const formatter_1 = require("../core/formatter");
const constants_1 = require("../config/constants");
const logger = logger_1.createLogger('SemanticQueryHandler');
class SemanticQueryHandler {
    constructor(dbPool, generateText, metadataService) {
        this.dbPool = dbPool;
        this.generateText = generateText;
        this.metadataService = metadataService || new metadataService_1.MetadataService();
        this.queryRewriter = new queryRewriter_1.QueryRewriter(this.metadataService);
        this.semanticRetriever = new semanticRetriever_1.SemanticRetriever(this.metadataService);
        this.relationshipGraph = new relationshipGraph_1.RelationshipGraph(this.metadataService);
        this.relationshipExpander = new relationshipExpander_1.RelationshipExpander(this.metadataService, this.relationshipGraph);
        this.joinPathResolver = new joinPathResolver_1.JoinPathResolver(this.relationshipGraph);
        this.sqlValidator = new sqlValidator_1.SQLValidator();
        this.sqlGenerator = new sqlGenerator_1.SQLGenerator(this.generateText);
        this.executor = new executor_1.Executor(this.dbPool);
        this.formatter = new formatter_1.Formatter(this.generateText);
    }
    /**
     * Handle semantic query request
     */
    async handle(request) {
        const startTime = Date.now();
        const context = {
            request,
            steps: [],
        };
        try {
            // Step 1: Rewrite query
            context.steps.push(this.createStep('QueryRewriter'));
            context.rewritten_query = await this.queryRewriter.rewrite(request.question);
            this.markStepComplete('QueryRewriter', context);
            // Step 2: Retrieve schema
            context.steps.push(this.createStep('SemanticRetriever'));
            const topK = request.preferences?.top_k || 7;
            context.resolved_schema = await this.semanticRetriever.retrieve(request.question, topK);
            this.markStepComplete('SemanticRetriever', context);
            // Step 3: Expand context
            context.steps.push(this.createStep('RelationshipExpander'));
            const depth = request.preferences?.max_depth || 2;
            context.expanded_context = await this.relationshipExpander.expand(context.resolved_schema, depth);
            this.markStepComplete('RelationshipExpander', context);
            // Step 4: Resolve join paths
            context.steps.push(this.createStep('JoinPathResolver'));
            const joinPaths = this.joinPathResolver.resolveForContext(context.expanded_context);
            this.markStepComplete('JoinPathResolver', context, { joinPaths: joinPaths.size });
            // Step 5: Generate SQL
            context.steps.push(this.createStep('SQLGenerator'));
            context.generated_sql = await this.sqlGenerator.generate(context.rewritten_query, context.expanded_context, joinPaths);
            // Log generated SQL detail
            logger.info('[SemanticQueryHandler] SQL generated', {
                sql: context.generated_sql.sql.slice(0, 300),
                sqlLength: context.generated_sql.sql.length,
                metricsUsed: context.generated_sql.metrics_used,
                generationMs: context.generated_sql.generation_ms,
            });
            this.markStepComplete('SQLGenerator', context);
            // Step 6: Validate SQL
            context.steps.push(this.createStep('SQLValidator'));
            context.validation_result = this.sqlValidator.validate(context.generated_sql.sql, context.expanded_context);
            this.markStepComplete('SQLValidator', context);
            if (!context.validation_result.ok) {
                logger.error('[SemanticQueryHandler] SQL validation failed after generation', {
                    sql: context.generated_sql.sql.slice(0, 300),
                    errors: context.validation_result.errors,
                });
                throw new types_1.SemanticEngineError('VALIDATION_FAILED', `SQL validation failed: ${context.validation_result.errors[0]?.message}`);
            }
            // Step 7: Execute SQL
            context.steps.push(this.createStep('Executor'));
            context.execution_result = await this.executor.execute(context.generated_sql.sql);
            this.markStepComplete('Executor', context, {
                rows: context.execution_result.row_count,
            });
            if (context.execution_result.error) {
                throw new types_1.SemanticEngineError('EXECUTION_FAILED', context.execution_result.error.message);
            }
            // Step 8: Format result
            context.steps.push(this.createStep('Formatter'));
            context.formatted_result = await this.formatter.format(context.execution_result, request.question);
            this.markStepComplete('Formatter', context);
            const totalMs = Date.now() - startTime;
            const response = {
                tk_status: constants_1.RESPONSE_CODES.OK,
                data: {
                    sql: context.generated_sql.sql,
                    rows: context.formatted_result.rows,
                    summary: context.formatted_result.summary,
                    execution_time_ms: context.execution_result.execution_ms,
                    total_time_ms: totalMs,
                    pipeline_steps: context.steps.map((step) => ({
                        step: step.name,
                        duration_ms: step.duration_ms || 0,
                        status: step.status,
                        note: step.notes?.note,
                    })),
                    visualization_hints: context.formatted_result.visualization_hints,
                    debug_info: request.preferences?.debug ? this.buildDebugInfo(context) : undefined,
                },
            };
            logger.info('Query handled successfully', {
                question: request.question.substring(0, 100),
                rows: context.formatted_result.rows.length,
                totalMs,
            });
            return response;
        }
        catch (error) {
            const totalMs = Date.now() - startTime;
            logger.error('Query handling failed', error, {
                question: request.question,
                totalMs,
            });
            let errorCode = constants_1.RESPONSE_CODES.ERR_INTERNAL_ERROR;
            let errorMessage = 'Lỗi nội bộ xảy ra';
            if (error instanceof types_1.SemanticEngineError) {
                errorCode = error.code;
                errorMessage = error.message;
            }
            else if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                tk_status: constants_1.RESPONSE_CODES.ERR_INTERNAL_ERROR,
                error: {
                    code: errorCode,
                    message: errorMessage,
                },
            };
        }
    }
    /**
     * Create pipeline step tracker
     */
    createStep(name) {
        return {
            name,
            start_ms: Date.now(),
            status: 'pending',
        };
    }
    /**
     * Mark step as complete
     */
    markStepComplete(name, context, notes) {
        const step = context.steps.find((s) => s.name === name);
        if (step) {
            step.duration_ms = Date.now() - step.start_ms;
            step.status = 'ok';
            step.notes = notes;
        }
    }
    /**
     * Build debug info
     */
    buildDebugInfo(context) {
        return {
            rewritten_query: context.rewritten_query,
            resolved_schema: {
                tables: context.resolved_schema?.relevant_tables.length,
                columns: context.resolved_schema?.relevant_columns.length,
                metrics: context.resolved_schema?.relevant_metrics.length,
            },
            expanded_context: {
                mainTables: context.expanded_context?.main_tables.length,
                relatedTables: context.expanded_context?.related_tables.length,
            },
            generated_sql: context.generated_sql?.sql,
            validation_result: context.validation_result,
        };
    }
    /**
     * Clear embedding cache when metadata changes
     * Called when tables/columns/relationships are updated
     */
    clearEmbeddingCache() {
        try {
            this.semanticRetriever.clearEmbeddingCache();
            logger.info('Embedding cache cleared');
        }
        catch (error) {
            logger.error('Failed to clear embedding cache', error);
            throw error;
        }
    }
}
exports.SemanticQueryHandler = SemanticQueryHandler;
/**
 * Factory function to create handler
 */
async function createSemanticQueryHandler(dbPool, generateText, metadataDir) {
    const metadataService = await metadataService_1.getMetadataService(metadataDir);
    return new SemanticQueryHandler(dbPool, generateText, metadataService);
}
exports.createSemanticQueryHandler = createSemanticQueryHandler;
