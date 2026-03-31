/**
 * Formatter - Format query results and generate explanations
 */

import {
  FormattedResult,
  ExecutionResult,
  VisualizationHint,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { formatNumber, formatCurrency } from '../utils/helpers';

const logger = createLogger('Formatter');

interface GenerateTextFn {
  (prompt: string, options?: any): Promise<string>;
}

export class Formatter {
  constructor(private generateText: GenerateTextFn) {}

  /**
   * Format execution result for user consumption
   */
  async format(
    executionResult: ExecutionResult,
    originalQuery: string,
  ): Promise<FormattedResult> {
    const startTime = Date.now();

    try {
      // Check for execution errors
      if (executionResult.error) {
        const errorMsg = this.formatError(executionResult.error);
        return {
          rows: [],
          summary: errorMsg,
          key_insights: [],
          formatting_ms: Date.now() - startTime,
        };
      }

      const rows = executionResult.rows || [];

      // Generate human-readable explanation
      const summary = await this.generateExplanation(originalQuery, rows);

      // Extract key insights
      const keyInsights = this.extractInsights(rows);

      // Suggest visualization
      const vizHints = this.suggestVisualization(rows, executionResult.columns);

      const formattingMs = Date.now() - startTime;

      const result: FormattedResult = {
        rows,
        summary,
        key_insights: keyInsights,
        visualization_hints: vizHints,
        formatting_ms: formattingMs,
      };

      logger.info('Result formatted', {
        rows: rows.length,
        insights: keyInsights.length,
        ms: formattingMs,
      });

      return result;
    } catch (error) {
      logger.error('Failed to format result', error);
      throw new SemanticEngineError('FORMATTING_FAILED', 'Result formatting failed', error);
    }
  }

  /**
   * Generate human-readable explanation
   */
  private async generateExplanation(query: string, rows: any[]): Promise<string> {
    if (rows.length === 0) {
      return 'Không tìm thấy dữ liệu phù hợp với điều kiện tìm kiếm.';
    }

    const sampleData = rows.slice(0, 10);
    const totalRows = rows.length;

    const prompt = [
      'Bạn là một chuyên gia phân tích dữ liệu ERP.',
      'Hãy giải thích kết quả truy vấn bằng tiếng Việt một cách ngắn gọn và dễ hiểu.',
      'Tập trung vào các con số quan trọng và insight chính.',
      '',
      `Câu hỏi gốc: ${query}`,
      '',
      `Tổng số kết quả: ${totalRows} bản ghi`,
      '',
      `Dữ liệu mẫu (10 bản ghi đầu):`,
      JSON.stringify(sampleData, null, 2),
      '',
      'Hãy viết một đoạn giải thích ngắn (2-3 câu) về ý nghĩa của những dữ liệu này.',
    ].join('\n');

    try {
      const explanation = await this.generateText(prompt);
      return String(explanation || '').trim();
    } catch (error) {
      logger.warn('Failed to generate explanation', error);
      return `Tìm thấy ${totalRows} bản ghi khớp với tiêu chí tìm kiếm.`;
    }
  }

  /**
   * Format error message in Vietnamese
   */
  private formatError(error: any): string {
    const code = error.code || 'UNKNOWN';
    const message = error.message || 'Lỗi không xác định';

    const errorMessages: Record<string, string> = {
      QUERY_TIMEOUT: 'Truy vấn vượt quá thời gian cho phép. Vui lòng thử lại với điều kiện tìm kiếp cụ thể hơn.',
      SQL_SERVER_ERROR: `Lỗi cơ sở dữ liệu: ${error.sql_server_error || message}`,
      INVALID_STATEMENT: 'Chỉ hỗ trợ truy vấn SELECT đơn lẻ.',
      EMPTY_QUERY: 'Truy vấn không được để trống.',
    };

    return errorMessages[code] || `Lỗi: ${message}`;
  }

  /**
   * Extract key insights from data
   */
  private extractInsights(rows: any[]): string[] {
    const insights: string[] = [];

    if (rows.length === 0) {
      return insights;
    }

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    // Detect numeric columns
    const numericColumns = keys.filter((k) => typeof firstRow[k] === 'number');

    if (numericColumns.length > 0) {
      // Find max/min values
      for (const col of numericColumns.slice(0, 3)) {
        const values = rows.map((r) => r[col]).filter((v) => typeof v === 'number');

        if (values.length > 0) {
          const max = Math.max(...values);
          const min = Math.min(...values);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;

          insights.push(
            `${col}: Cao nhất ${formatNumber(max)}, thấp nhất ${formatNumber(min)}, trung bình ${formatNumber(avg.toFixed(0))}`,
          );
        }
      }
    }

    // Detect date columns
    const dateColumns = keys.filter((k) => {
      const val = firstRow[k];
      return val instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(val));
    });

    if (dateColumns.length > 0) {
      const firstDate = firstRow[dateColumns[0]];
      const lastDate = rows[rows.length - 1]?.[dateColumns[0]];

      if (firstDate && lastDate) {
        insights.push(`Dữ liệu từ ${firstDate} đến ${lastDate}`);
      }
    }

    return insights.slice(0, 5); // Limit to 5 insights
  }

  /**
   * Suggest visualization based on data
   */
  private suggestVisualization(rows: any[], columns: string[]): VisualizationHint | undefined {
    if (rows.length === 0) {
      return undefined;
    }

    // Detect data types
    const firstRow = rows[0];
    const numericCols = columns.filter((c) => typeof firstRow[c] === 'number');
    const stringCols = columns.filter((c) => typeof firstRow[c] === 'string');
    const dateCols = columns.filter(
      (c) =>
        firstRow[c] instanceof Date ||
        /^\d{4}-\d{2}-\d{2}/.test(String(firstRow[c])),
    );

    // Choose visualization based on structure
    if (dateCols.length > 0 && numericCols.length > 0) {
      // Time series data
      return {
        type: 'line',
        dimensions: dateCols.slice(0, 1),
        measures: numericCols.slice(0, 2),
      };
    }

    if (stringCols.length > 0 && numericCols.length > 0) {
      // Category comparison
      if (rows.length <= 20) {
        return {
          type: 'bar',
          dimensions: stringCols.slice(0, 1),
          measures: numericCols.slice(0, 2),
        };
      } else {
        return {
          type: 'pie',
          dimensions: stringCols.slice(0, 1),
          measures: numericCols.slice(0, 1),
        };
      }
    }

    if (numericCols.length >= 2) {
      // Scatter if 2+ numeric columns
      return {
        type: 'scatter',
        dimensions: [],
        measures: numericCols.slice(0, 2),
      };
    }

    // Default: table
    return {
      type: 'table',
      dimensions: stringCols.slice(0, 2),
      measures: numericCols.slice(0, 2),
    };
  }

  /**
   * Format row data for display
   */
  formatRow(row: any, columns: string[]): any {
    const formatted: any = {};

    for (const col of columns) {
      const value = row[col];

      if (value === null || value === undefined) {
        formatted[col] = '';
      } else if (typeof value === 'number') {
        // Format currency if column name suggests it
        if (col.toLowerCase().includes('amount') || col.toLowerCase().includes('price')) {
          formatted[col] = formatCurrency(value);
        } else {
          formatted[col] = formatNumber(value);
        }
      } else if (value instanceof Date) {
        formatted[col] = value.toLocaleDateString('vi-VN');
      } else {
        formatted[col] = String(value);
      }
    }

    return formatted;
  }
}
