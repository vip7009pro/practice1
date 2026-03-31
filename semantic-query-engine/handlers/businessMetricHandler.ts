/**
 * Business Metric Handler - Handle metric-specific queries
 */

import {
  MetricQueryRequest,
  MetricQueryResponse,
  MetricQueryData,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { MetadataService } from '../services/metadataService';
import { RelationshipGraph } from '../core/relationshipGraph';
import { RelationshipExpander } from '../core/relationshipExpander';
import { JoinPathResolver } from '../core/joinPathResolver';
import { SQLValidator } from '../core/sqlValidator';
import { SQLGenerator } from '../core/sqlGenerator';
import { Executor } from '../core/executor';
import { RESPONSE_CODES } from '../config/constants';

const logger = createLogger('BusinessMetricHandler');

interface DBPool {
  request(): {
    query(sql: string): Promise<{ recordset: any[]; rowsAffected: number[] }>;
  };
}

interface GenerateTextFn {
  (prompt: string, options?: any): Promise<string>;
}

export class BusinessMetricHandler {
  constructor(
    private metadataService: MetadataService,
    private relationshipGraph: RelationshipGraph,
    private relationshipExpander: RelationshipExpander,
    private joinPathResolver: JoinPathResolver,
    private sqlValidator: SQLValidator,
    private sqlGenerator: SQLGenerator,
    private executor: Executor,
  ) {}

  /**
   * Handle metric query
   */
  async handle(request: MetricQueryRequest): Promise<MetricQueryResponse> {
    const startTime = Date.now();

    try {
      // Get metric definition
      const metric = this.metadataService.getMetric(request.metric_id);
      if (!metric) {
        throw new SemanticEngineError(
          'METRIC_NOT_FOUND',
          `Metric not found: ${request.metric_id}`,
        );
      }

      // Validate metric
      const validation = this.metadataService.validateMetric(metric);
      if (!validation.valid) {
        throw new SemanticEngineError('INVALID_METRIC', `Invalid metric: ${validation.errors.join(', ')}`);
      }

      // Expand context for metric tables
      const context = await this.relationshipExpander.expandForMetric(metric);

      // Resolve join paths
      const joinPaths = this.joinPathResolver.resolveForContext(context);

      // Generate SQL
      const rewrittenQuery = {
        original_text: `Calculate ${metric.business_name}`,
        normalized_text: `calculate ${metric.business_name}`,
        detected_intents: ['metric_query'],
        detected_metrics: [metric.id],
        detected_dimensions: request.group_by || [],
        detected_filters: request.filters || [],
        entities: metric.tables,
        llm_used: false,
      };

      const generatedSql = await this.sqlGenerator.generate(
        rewrittenQuery,
        context,
        joinPaths,
      );

      // Validate SQL
      const validationResult = this.sqlValidator.validate(generatedSql.sql, context);
      if (!validationResult.ok) {
        throw new SemanticEngineError(
          'SQL_VALIDATION_FAILED',
          `SQL validation failed: ${validationResult.errors[0]?.message}`,
        );
      }

      // Execute SQL
      const executionResult = await this.executor.execute(generatedSql.sql);

      if (executionResult.error) {
        throw new SemanticEngineError(
          'EXECUTION_FAILED',
          executionResult.error.message,
        );
      }

      // Analyze results
      const rows = executionResult.rows || [];
      let value: number | string | undefined;
      let trend: 'up' | 'down' | 'stable' | undefined;

      if (rows.length === 1) {
        // Single row result (aggregate)
        const firstRow = rows[0];
        const metricColumn = Object.keys(firstRow)[0];
        value = firstRow[metricColumn];
      } else if (rows.length > 1) {
        // Multiple rows
        value = rows.length; // Primary value is row count
      }

      const executionMs = Date.now() - startTime;

      const response: MetricQueryResponse = {
        tk_status: RESPONSE_CODES.OK,
        data: {
          metric_id: metric.id,
          metric_name: metric.business_name,
          value,
          rows: rows.length > 1 ? rows : undefined,
          trend,
          execution_ms: executionMs,
        },
      };

      logger.info('Metric query handled', {
        metricId: metric.id,
        rows: rows.length,
        value,
        ms: executionMs,
      });

      return response;
    } catch (error) {
      logger.error('Metric query failed', error);

      let errorCode = RESPONSE_CODES.ERR_INTERNAL_ERROR;
      let errorMessage = 'Lỗi xảy ra khi tính toán metric';

      if (error instanceof SemanticEngineError) {
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        tk_status: 'NG',
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Get list of available metrics
   */
  async listMetrics(): Promise<MetricQueryResponse> {
    try {
      const metrics = this.metadataService.getAllMetrics();

      return {
        tk_status: RESPONSE_CODES.OK,
        data: {
          metric_id: 'list',
          metric_name: `Available Metrics (${metrics.length})`,
          rows: metrics.map((m) => ({
            id: m.id,
            name: m.business_name,
            description: m.description,
            formula: m.formula,
            tables: m.tables.join(', '),
            data_type: m.data_type,
          })),
        },
      };
    } catch (error) {
      logger.error('Failed to list metrics', error);

      return {
        tk_status: 'NG',
        error: {
          code: 'LIST_FAILED',
          message: 'Failed to list metrics',
        },
      };
    }
  }
}

/**
 * Factory function
 */
export function createBusinessMetricHandler(
  metadataService: MetadataService,
  relationshipGraph: RelationshipGraph,
  relationshipExpander: RelationshipExpander,
  joinPathResolver: JoinPathResolver,
  sqlValidator: SQLValidator,
  sqlGenerator: SQLGenerator,
  executor: Executor,
): BusinessMetricHandler {
  return new BusinessMetricHandler(
    metadataService,
    relationshipGraph,
    relationshipExpander,
    joinPathResolver,
    sqlValidator,
    sqlGenerator,
    executor,
  );
}
