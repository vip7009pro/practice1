/**
 * Query Rewriter - Normalize and rewrite user queries
 */

import {
  RewrittenQuery,
  FilterExpression,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { normalizeText, tokenize } from '../utils/helpers';
import { MetadataService } from '../services/metadataService';
import dayjs from 'dayjs';

const logger = createLogger('QueryRewriter');

export class QueryRewriter {
  constructor(private metadataService: MetadataService) {}

  async rewrite(userQuery: string): Promise<RewrittenQuery> {
    const startTime = Date.now();

    try {
      const originalText = String(userQuery || '').trim();
      if (!originalText) {
        throw new SemanticEngineError('INVALID_QUERY', 'Query cannot be empty');
      }

      const normalizedText = normalizeText(originalText, false); // Keep case initially
      const tokens = tokenize(originalText);

      // Detect intents
      const intents = this.detectIntents(originalText);

      // Detect metrics
      const metrics = this.detectMetrics(tokens);

      // Detect dimensions (grouping columns)
      const dimensions = this.detectDimensions(tokens);

      // Detect filters
      const filters = this.detectFilters(originalText, tokens);

      // Detect entities (tables, business concepts)
      const entities = this.detectEntities(tokens);

      const rewrittenMs = Date.now() - startTime;

      const result: RewrittenQuery = {
        original_text: originalText,
        normalized_text: normalizedText,
        detected_intents: intents,
        detected_metrics: metrics,
        detected_dimensions: dimensions,
        detected_filters: filters,
        entities,
        llm_used: false,
        rewrite_ms: rewrittenMs,
      };

      logger.info('Query rewritten', {
        original: originalText,
        intents,
        metrics: metrics.length,
        dimensions: dimensions.length,
        filters: filters.length,
        ms: rewrittenMs,
      });

      return result;
    } catch (error) {
      logger.error('Failed to rewrite query', error);
      throw error;
    }
  }

  private detectIntents(query: string): string[] {
    const lower = query.toLowerCase();
    const intents: string[] = [];

    // Metric query detection
    if (
      /doanh thu|lợi nhuận|profit|revenue|sales|bán|tổng|tính|số lượng|qty|giá trị/.test(lower)
    ) {
      intents.push('metric_query');
    }

    // Dimension breakdown
    if (/theo|group|nhóm by|breakdown|chi tiết|từng|mỗi/.test(lower)) {
      intents.push('dimension_breakdown');
    }

    // Comparison
    if (/so với|vs|so sánh|giữa|with|compared to|vs|versus/.test(lower)) {
      intents.push('comparison');
    }

    // Top/ranking
    if (/top|hàng đầu|cao nhất|lớn nhất|bán chạy|nhiều nhất|least|thấp/.test(lower)) {
      intents.push('ranking');
    }

    // Trend analysis
    if (/trend|xu hướng|tăng|giảm|growth|decline|development/.test(lower)) {
      intents.push('trend_analysis');
    }

    // List/browse
    if (/danh sách|list|xem|browse|hiển thị/.test(lower)) {
      intents.push('list_query');
    }

    // Filter/search
    if (/tìm|find|search|lọc|filter|where/.test(lower)) {
      intents.push('filter_query');
    }

    if (intents.length === 0) {
      intents.push('unknown');
    }

    return intents;
  }

  private detectMetrics(tokens: string[]): string[] {
    const metrics = this.metadataService.getAllMetrics();
    const detectedMetrics: string[] = [];
    const seenIds = new Set<string>();

    for (const metric of metrics) {
      const metricTerms = [
        metric.name.toLowerCase(),
        metric.business_name.toLowerCase(),
        metric.id.toLowerCase(),
      ];

      for (const token of tokens) {
        for (const term of metricTerms) {
          if (term.includes(token) || token === term) {
            if (!seenIds.has(metric.id)) {
              detectedMetrics.push(metric.id);
              seenIds.add(metric.id);
            }
          }
        }
      }
    }

    return detectedMetrics;
  }

  private detectDimensions(tokens: string[]): string[] {
    const allColumns = Array.from(this.metadataService.getStats().columns || []);
    const dimensions: string[] = [];
    const seenDims = new Set<string>();

    // Common dimension keywords
    const commonDimensions = ['region', 'category', 'status', 'order_date', 'customer_id', 'product_id', 'department_id'];

    for (const dim of commonDimensions) {
      for (const token of tokens) {
        if (dim.toLowerCase().includes(token.toLowerCase()) || token.toLowerCase().includes(dim.toLowerCase())) {
          if (!seenDims.has(dim)) {
            dimensions.push(dim);
            seenDims.add(dim);
          }
        }
      }
    }

    return dimensions;
  }

  private detectFilters(query: string, tokens: string[]): FilterExpression[] {
    const filters: FilterExpression[] = [];

    // Time filters
    const timeFilters = this.extractTimeFilters(query);
    filters.push(...timeFilters);

    // Status filters
    const statusFilters = this.extractStatusFilters(query);
    filters.push(...statusFilters);

    // Region filters
    const regionFilters = this.extractRegionFilters(query, tokens);
    filters.push(...regionFilters);

    return filters;
  }

  private extractTimeFilters(query: string): FilterExpression[] {
    const filters: FilterExpression[] = [];
    const lower = query.toLowerCase();

    if (/hôm nay|today|cái nay/.test(lower)) {
      const today = dayjs().format('YYYY-MM-DD');
      filters.push({
        column: 'order_date',
        operator: 'eq',
        value: today,
      });
    } else if (/tháng này|this month|tháng hiện tại/.test(lower)) {
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
      filters.push({
        column: 'order_date',
        operator: 'gte',
        value: startOfMonth,
      });
      filters.push({
        column: 'order_date',
        operator: 'lte',
        value: endOfMonth,
      });
    } else if (/tuần này|this week|7 ngày qua/.test(lower)) {
      const startOfWeek = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
      filters.push({
        column: 'order_date',
        operator: 'gte',
        value: startOfWeek,
      });
    } else if (/năm này|this year|năm nay/.test(lower)) {
      const startOfYear = dayjs().startOf('year').format('YYYY-MM-DD');
      const endOfYear = dayjs().endOf('year').format('YYYY-MM-DD');
      filters.push({
        column: 'order_date',
        operator: 'gte',
        value: startOfYear,
      });
      filters.push({
        column: 'order_date',
        operator: 'lte',
        value: endOfYear,
      });
    }

    return filters;
  }

  private extractStatusFilters(query: string): FilterExpression[] {
    const filters: FilterExpression[] = [];
    const lower = query.toLowerCase();

    const statusMap: Record<string, string[]> = {
      active: ['active', 'hoạt động', 'đang hoạt động'],
      confirmed: ['confirmed', 'xác nhận', 'đã xác nhận'],
      shipped: ['shipped', 'vận chuyển', 'đã gửi'],
      delivered: ['delivered', 'giao hàng', 'đã giao'],
      cancelled: ['cancelled', 'hủy', 'đã hủy'],
    };

    for (const [statusValue, keywords] of Object.entries(statusMap)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          filters.push({
            column: 'status',
            operator: 'eq',
            value: statusValue,
          });
          break;
        }
      }
    }

    return filters;
  }

  private extractRegionFilters(query: string, tokens: string[]): FilterExpression[] {
    const filters: FilterExpression[] = [];
    const commonRegions = ['hà nội', 'tp hcm', 'đà nẵng', 'hải phòng', 'cần thơ', 'miền bắc', 'miền nam', 'miền trung'];

    for (const region of commonRegions) {
      if (query.toLowerCase().includes(region)) {
        filters.push({
          column: 'region',
          operator: 'contains',
          value: region,
        });
      }
    }

    return filters;
  }

  private detectEntities(tokens: string[]): string[] {
    const entities: string[] = [];
    const tables = this.metadataService.getAllTables();

    for (const token of tokens) {
      for (const table of tables) {
        const comparableTableName = normalizeText(table.table_name).split(' ');
        const comparableBusinessName = normalizeText(table.business_name).split(' ');

        if (
          comparableTableName.some((part) => part === token) ||
          comparableBusinessName.some((part) => part === token)
        ) {
          if (!entities.includes(table.table_name)) {
            entities.push(table.table_name);
          }
        }
      }
    }

    return entities;
  }
}
