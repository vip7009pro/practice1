/**
 * Semantic Query Handler - Orchestrates the full pipeline
 */

import {
  SemanticQueryRequest,
  SemanticQueryResponse,
  SemanticQueryData,
  PipelineContext,
  PipelineStep,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { MetadataService, getMetadataService } from '../services/metadataService';
import { QueryRewriter } from '../core/queryRewriter';
import { SemanticRetriever } from '../core/semanticRetriever';
import { RelationshipGraph } from '../core/relationshipGraph';
import { RelationshipExpander } from '../core/relationshipExpander';
import { JoinPathResolver } from '../core/joinPathResolver';
import { SQLValidator } from '../core/sqlValidator';
import { SQLGenerator } from '../core/sqlGenerator';
import { Executor } from '../core/executor';
import { Formatter } from '../core/formatter';
import { RESPONSE_CODES } from '../config/constants';

const logger = createLogger('SemanticQueryHandler');

interface DBPool {
  request(): {
    query(sql: string): Promise<{ recordset: any[]; rowsAffected: number[] }>;
  };
}

interface GenerateTextFn {
  (prompt: string, options?: any): Promise<string>;
}

export class SemanticQueryHandler {
  private metadataService: MetadataService;
  private queryRewriter: QueryRewriter;
  private semanticRetriever: SemanticRetriever;
  private relationshipGraph: RelationshipGraph;
  private relationshipExpander: RelationshipExpander;
  private joinPathResolver: JoinPathResolver;
  private sqlValidator: SQLValidator;
  private sqlGenerator: SQLGenerator;
  private executor: Executor;
  private formatter: Formatter;

  constructor(
    private dbPool: DBPool,
    private generateText: GenerateTextFn,
    metadataService?: MetadataService,
  ) {
    this.metadataService = metadataService || new MetadataService();
    this.queryRewriter = new QueryRewriter(this.metadataService);
    this.semanticRetriever = new SemanticRetriever(this.metadataService);
    this.relationshipGraph = new RelationshipGraph(this.metadataService);
    this.relationshipExpander = new RelationshipExpander(
      this.metadataService,
      this.relationshipGraph,
    );
    this.joinPathResolver = new JoinPathResolver(this.relationshipGraph);
    this.sqlValidator = new SQLValidator();
    this.sqlGenerator = new SQLGenerator(this.generateText);
    this.executor = new Executor(this.dbPool);
    this.formatter = new Formatter(this.generateText);
  }

  /**
   * Handle semantic query request
   */
  async handle(request: SemanticQueryRequest): Promise<SemanticQueryResponse> {
    const startTime = Date.now();
    const context: PipelineContext = {
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
      context.resolved_schema = await this.semanticRetriever.retrieve(
        request.question,
        topK,
      );
      this.markStepComplete('SemanticRetriever', context);

      // Step 3: Expand context
      context.steps.push(this.createStep('RelationshipExpander'));
      const depth = request.preferences?.max_depth || 2;
      context.expanded_context = await this.relationshipExpander.expand(
        context.resolved_schema!,
        depth,
      );
      this.markStepComplete('RelationshipExpander', context);

      // Step 4: Resolve join paths
      context.steps.push(this.createStep('JoinPathResolver'));
      const joinPaths = this.joinPathResolver.resolveForContext(context.expanded_context!);
      this.markStepComplete('JoinPathResolver', context, { joinPaths: joinPaths.size });

      // Step 5: Generate SQL
      context.steps.push(this.createStep('SQLGenerator'));
      context.generated_sql = await this.sqlGenerator.generate(
        context.rewritten_query!,
        context.expanded_context!,
        joinPaths,
      );
      
      // Log generated SQL detail
      logger.info('[SemanticQueryHandler] SQL generated', {
        sql: context.generated_sql!.sql.slice(0, 300),
        sqlLength: context.generated_sql!.sql.length,
        metricsUsed: context.generated_sql!.metrics_used,
        generationMs: context.generated_sql!.generation_ms,
      });
      
      this.markStepComplete('SQLGenerator', context);

      // Step 6: Validate SQL
      context.steps.push(this.createStep('SQLValidator'));
      context.validation_result = this.sqlValidator.validate(
        context.generated_sql!.sql,
        context.expanded_context,
      );
      this.markStepComplete('SQLValidator', context);

      if (!context.validation_result!.ok) {
        logger.error('[SemanticQueryHandler] SQL validation failed after generation', {
          sql: context.generated_sql!.sql.slice(0, 300),
          errors: context.validation_result!.errors,
        });
        
        throw new SemanticEngineError(
          'VALIDATION_FAILED',
          `SQL validation failed: ${context.validation_result!.errors[0]?.message}`,
        );
      }

      // Step 7: Execute SQL
      context.steps.push(this.createStep('Executor'));
      context.execution_result = await this.executor.execute(context.generated_sql!.sql);
      this.markStepComplete('Executor', context, {
        rows: context.execution_result.row_count,
      });

      if (context.execution_result.error) {
        throw new SemanticEngineError(
          'EXECUTION_FAILED',
          context.execution_result.error.message,
        );
      }

      // Step 8: Format result
      context.steps.push(this.createStep('Formatter'));
      context.formatted_result = await this.formatter.format(
        context.execution_result,
        request.question,
      );
      this.markStepComplete('Formatter', context);

      const totalMs = Date.now() - startTime;

      const response: SemanticQueryResponse = {
        tk_status: RESPONSE_CODES.OK,
        data: {
          sql: context.generated_sql!.sql,
          rows: context.formatted_result!.rows,
          summary: context.formatted_result!.summary,
          execution_time_ms: context.execution_result.execution_ms,
          total_time_ms: totalMs,
          pipeline_steps: context.steps.map((step) => ({
            step: step.name,
            duration_ms: step.duration_ms || 0,
            status: step.status,
            note: step.notes?.note,
          })),
          visualization_hints: context.formatted_result!.visualization_hints,
          debug_info: request.preferences?.debug ? this.buildDebugInfo(context) : undefined,
        },
      };

      logger.info('Query handled successfully', {
        question: request.question.substring(0, 100),
        rows: context.formatted_result!.rows.length,
        totalMs,
      });

      return response;
    } catch (error) {
      const totalMs = Date.now() - startTime;

      logger.error('Query handling failed', error, {
        question: request.question,
        totalMs,
      });

      let errorCode = RESPONSE_CODES.ERR_INTERNAL_ERROR;
      let errorMessage = 'Lỗi nội bộ xảy ra';

      if (error instanceof SemanticEngineError) {
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        tk_status: RESPONSE_CODES.ERR_INTERNAL_ERROR,
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
  private createStep(name: string): PipelineStep {
    return {
      name,
      start_ms: Date.now(),
      status: 'pending',
    };
  }

  /**
   * Mark step as complete
   */
  private markStepComplete(name: string, context: PipelineContext, notes?: any): void {
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
  private buildDebugInfo(context: PipelineContext): any {
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
}

/**
 * Factory function to create handler
 */
export async function createSemanticQueryHandler(
  dbPool: DBPool,
  generateText: GenerateTextFn,
  metadataDir?: string,
): Promise<SemanticQueryHandler> {
  const metadataService = await getMetadataService(metadataDir);
  return new SemanticQueryHandler(dbPool, generateText, metadataService);
}
