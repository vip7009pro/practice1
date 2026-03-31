/**
 * SQL Generator - Generate SQL from business context using LLM
 */

import {
  GeneratedSQL,
  RewrittenQuery,
  ExpandedContext,
  BusinessMetric,
  JoinPath,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { escapeSqlString } from '../utils/helpers';

const logger = createLogger('SQLGenerator');

interface GenerateTextFn {
  (prompt: string, options?: any): Promise<string>;
}

export class SQLGenerator {
  constructor(private generateText: GenerateTextFn) {}

  /**
   * Generate SQL from rewritten query and expanded context
   */
  async generate(
    rewrittenQuery: RewrittenQuery,
    context: ExpandedContext,
    joinPaths: Map<string, JoinPath> = new Map(),
  ): Promise<GeneratedSQL> {
    const startTime = Date.now();

    try {
      // Handle metric queries specially
      if (rewrittenQuery.detected_metrics.length > 0) {
        return await this.generateForMetrics(
          rewrittenQuery,
          context,
          joinPaths,
        );
      }

      // Standard SELECT query generation
      const prompt = this.buildPrompt(rewrittenQuery, context, joinPaths);

      logger.info('Generating SQL', {
        promptLength: prompt.length,
        metrics: rewrittenQuery.detected_metrics.length,
      });

      const sqlText = await this.generateText(prompt);

      const generationMs = Date.now() - startTime;

      const result: GeneratedSQL = {
        sql: sqlText,
        explanation: 'Query generated based on business context and relationships',
        join_paths_used: Array.from(joinPaths.values()),
        metrics_used: rewrittenQuery.detected_metrics,
        prompt,
        generation_ms: generationMs,
        model: 'gemini-2.5-flash',
      };

      logger.info('SQL generated', {
        sqlLength: sqlText.length,
        ms: generationMs,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate SQL', error);
      throw new SemanticEngineError('SQL_GENERATION_FAILED', 'SQL generation failed', error);
    }
  }

  /**
   * Generate SQL specifically for metrics
   */
  private async generateForMetrics(
    rewrittenQuery: RewrittenQuery,
    context: ExpandedContext,
    joinPaths: Map<string, JoinPath>,
  ): Promise<GeneratedSQL> {
    const startTime = Date.now();

    // Find relevant metrics
    const relevantMetrics = context.metrics_context.filter((m) =>
      rewrittenQuery.detected_metrics.includes(m.id),
    );

    if (relevantMetrics.length === 0) {
      throw new SemanticEngineError(
        'METRICS_NOT_FOUND',
        'Requested metrics not found in metadata',
      );
    }

    // Build SQL from metric formulas
    const prompt = this.buildMetricPrompt(
      rewrittenQuery,
      context,
      relevantMetrics,
      joinPaths,
    );

    const sqlText = await this.generateText(prompt);
    const generationMs = Date.now() - startTime;

    return {
      sql: sqlText,
      explanation: `Query calculates: ${relevantMetrics.map((m) => m.business_name).join(', ')}`,
      join_paths_used: Array.from(joinPaths.values()),
      metrics_used: relevantMetrics.map((m) => m.id),
      prompt,
      generation_ms: generationMs,
      model: 'gemini-2.5-flash',
    };
  }

  /**
   * Build LLM prompt for standard SELECT query
   */
  private buildPrompt(
    rewrittenQuery: RewrittenQuery,
    context: ExpandedContext,
    joinPaths: Map<string, JoinPath>,
  ): string {
    const schemaDefinition = this.buildSchemaDefinition(context);
    const joinsDefinition = this.buildJoinsDefinition(joinPaths);
    const filtersDefinition = this.buildFiltersDefinition(rewrittenQuery);

    const prompt = [
      'You are a senior SQL Server expert.',
      'Generate a SQL Server SELECT query based on the following business requirements.',
      '',
      '=== DATABASE SCHEMA ===',
      schemaDefinition,
      '',
      '=== ALLOWED JOINS ===',
      joinsDefinition || 'No explicit joins required',
      '',
      '=== BUSINESS REQUIREMENTS ===',
      `Original question: ${rewrittenQuery.original_text}`,
      `Normalized interpretation: ${rewrittenQuery.normalized_text}`,
      '',
      '=== FILTERS & CONDITIONS ===',
      filtersDefinition || 'No additional filters',
      '',
      '=== RULES ===',
      '1. Output ONLY the SQL text (no markdown, no explanation)',
      '2. Use explicit schema-qualified names (e.g., dbo.tableName)',
      '3. Include WHERE clause to avoid full table scans when possible',
      '4. Use meaningful column aliases for clarity',
      '5. Keep result size reasonable (use TOP 1000 if needed)',
      '6. Ensure all aggregate functions have aliases (e.g., COUNT(*) AS total)',
      '7. Use INNER JOIN for FK relationships, LEFT JOIN for business relationships',
      '8. Never invent columns or tables not in the schema',
      '',
      'Generate the SQL query:',
    ].join('\n');

    return prompt;
  }

  /**
   * Build LLM prompt for metric queries
   */
  private buildMetricPrompt(
    rewrittenQuery: RewrittenQuery,
    context: ExpandedContext,
    metrics: BusinessMetric[],
    joinPaths: Map<string, JoinPath>,
  ): string {
    const schemaDefinition = this.buildSchemaDefinition(context);
    const joinsDefinition = this.buildJoinsDefinition(joinPaths);
    const metricsDefinition = this.buildMetricsDefinition(metrics);

    const prompt = [
      'You are a senior SQL Server expert specializing in business analytics.',
      'Generate a SQL Server SELECT query to calculate the following business metrics.',
      '',
      '=== DATABASE SCHEMA ===',
      schemaDefinition,
      '',
      '=== ALLOWED JOINS ===',
      joinsDefinition || 'No explicit joins required',
      '',
      '=== BUSINESS METRICS TO CALCULATE ===',
      metricsDefinition,
      '',
      '=== BUSINESS QUESTION ===',
      rewrittenQuery.original_text,
      '',
      '=== DIMENSIONS (GROUP BY) ===',
      rewrittenQuery.detected_dimensions.length > 0
        ? rewrittenQuery.detected_dimensions.join(', ')
        : 'No grouping (aggregate only)',
      '',
      '=== RULES ===',
      '1. Output ONLY the SQL text (no markdown, no explanation)',
      '2. Use the exact metric formulas provided (do NOT invent calculations)',
      '3. Respect business rules defined in metric conditions',
      '4. Use GROUP BY exactly as specified for dimensions',
      '5. Use meaningful aliases for metric columns',
      '6. Include WHERE clause to filter to relevant records',
      '7. Order results by highest metric value (DESC) for top-K queries',
      '',
      'Generate the SQL query:',
    ].join('\n');

    return prompt;
  }

  /**
   * Build schema definition for prompt
   */
  private buildSchemaDefinition(context: ExpandedContext): string {
    const lines: string[] = [];

    for (const table of context.main_tables) {
      lines.push(`TABLE: dbo.${table.table_name}`);
      lines.push(`  Business Name: ${table.business_name}`);
      lines.push(`  Description: ${table.description}`);

      const columns = context.all_columns_map.get(table.table_name.toLowerCase()) || [];
      for (const col of columns) {
        const keyStr = col.is_key ? ' [KEY]' : '';
        const fkStr = col.is_foreign_key ? ' [FK]' : '';
        lines.push(`    - ${col.column_name} (${col.data_type})${keyStr}${fkStr}`);
        lines.push(`        ${col.business_name}: ${col.description}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build joins definition for prompt
   */
  private buildJoinsDefinition(joinPaths: Map<string, JoinPath>): string {
    if (joinPaths.size === 0) {
      return '';
    }

    const lines: string[] = [];

    for (const [_key, path] of joinPaths) {
      lines.push(`FROM ${path.from_table} TO ${path.to_table}:`);

      for (const step of path.path) {
        lines.push(
          `  ${step.join_type.toUpperCase()} JOIN dbo.${step.next_table} ON dbo.${step.table}.${step.column} = dbo.${step.next_table}.${step.join_column}`,
        );
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build metrics definition for prompt
   */
  private buildMetricsDefinition(metrics: BusinessMetric[]): string {
    const lines: string[] = [];

    for (const metric of metrics) {
      lines.push(`METRIC: ${metric.business_name}`);
      lines.push(`  ID: ${metric.id}`);
      lines.push(`  Formula: ${metric.formula}`);
      lines.push(`  Data Type: ${metric.data_type} (${metric.unit || 'N/A'})`);

      if (metric.conditions && metric.conditions.length > 0) {
        lines.push(`  Conditions:`);
        for (const condition of metric.conditions) {
          lines.push(`    - ${condition}`);
        }
      }

      if (metric.related_dimensions && metric.related_dimensions.length > 0) {
        lines.push(`  Suggest GROUP BY: ${metric.related_dimensions.join(', ')}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build filters definition for prompt
   */
  private buildFiltersDefinition(rewrittenQuery: RewrittenQuery): string {
    if (rewrittenQuery.detected_filters.length === 0) {
      return '';
    }

    const lines: string[] = [];

    for (const filter of rewrittenQuery.detected_filters) {
      if (filter.column && filter.operator && filter.value) {
        let condition = `${filter.column} ${filter.operator}`;

        if (filter.operator === 'in') {
          const values = Array.isArray(filter.value) ? filter.value : [filter.value];
          const escaped = values.map((v) => `'${escapeSqlString(String(v))}'`).join(', ');
          condition += ` (${escaped})`;
        } else {
          const value = Array.isArray(filter.value) ? filter.value[0] : filter.value;
          condition += ` '${escapeSqlString(String(value))}'`;
        }

        lines.push(`  WHERE ${condition}`);
      }
    }

    return lines.join('\n');
  }
}
