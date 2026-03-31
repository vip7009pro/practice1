/**
 * SQL Validator - Extended validation with semantic and safety checks
 */

import {
  ValidationResult,
  ValidationError,
  ExpandedContext,
} from '../types';
import { createLogger } from '../utils/logger';
import { stripSqlComments } from '../utils/helpers';

const logger = createLogger('SQLValidator');

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'MERGE',
  'CREATE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
  'XP_',
  'SP_',
];

const DANGEROUS_PATTERNS = [
  /WAITFOR/i,
  /sp_executesql/i,
  /sp_adduser/i,
  /xp_cmdshell/i,
  /xp_regread/i,
];

export class SQLValidator {
  constructor() {}

  /**
   * Validate SQL query comprehensively
   */
  validate(sql: string, context?: ExpandedContext): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Step 1: Check for forbidden keywords
    const keywordErrors = this.checkForbiddenKeywords(sql);
    errors.push(...keywordErrors);

    // Step 2: Check for dangerous patterns
    const patternErrors = this.checkDangerousPatterns(sql);
    errors.push(...patternErrors);

    // Step 3: Check for single SELECT statement
    if (!this.isValidSelectStatement(sql)) {
      errors.push({
        code: 'INVALID_STATEMENT',
        message: 'Query must be a single SELECT statement',
        severity: 'error',
      });
    }

    // Step 4: Semantic checks if context provided
    if (context) {
      const semanticErrors = this.checkSemanticCorrectness(sql, context);
      errors.push(...semanticErrors);
    }

    // Step 5: Heuristic checks
    const heuristicWarnings = this.heuristicChecks(sql);
    warnings.push(...heuristicWarnings);

    const validationMs = Date.now() - startTime;
    const ok = errors.length === 0;

    const result: ValidationResult = {
      ok,
      errors,
      warnings,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      validation_ms: validationMs,
    };

    if (!ok) {
      logger.warn('SQL validation failed', {
        errorCount: errors.length,
        warningCount: warnings.length,
        ms: validationMs,
      });
    } else {
      logger.info('SQL validation passed', { ms: validationMs });
    }

    return result;
  }

  /**
   * Check for forbidden SQL keywords
   */
  private checkForbiddenKeywords(sql: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const cleaned = stripSqlComments(sql);
    const upper = cleaned.toUpperCase();

    for (const keyword of FORBIDDEN_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      if (regex.test(upper)) {
        errors.push({
          code: 'FORBIDDEN_KEYWORD',
          message: `Forbidden SQL keyword: ${keyword}. Only SELECT queries are allowed.`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Check for dangerous patterns
   */
  private checkDangerousPatterns(sql: string): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(sql)) {
        errors.push({
          code: 'DANGEROUS_PATTERN',
          message: `Detected dangerous SQL pattern: ${pattern.source}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Check if SQL is a valid single SELECT statement
   */
  private isValidSelectStatement(sql: string): boolean {
    const cleaned = stripSqlComments(sql).trim();

    // Remove trailing semicolon
    const normalized = cleaned.replace(/;\s*$/, '').trim();

    if (!normalized) return false;

    const upper = normalized.toUpperCase();

    // Must start with SELECT or WITH
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
      return false;
    }

    // Check for multiple statements (semicolon NOT in string literals)
    const withoutStrings = normalized.replace(/'([^']|'')*'/g, "''");
    const statementCount = (withoutStrings.match(/;/g) || []).length;

    if (statementCount > 0) {
      return false;
    }

    return true;
  }

  /**
   * Semantic correctness checks
   */
  private checkSemanticCorrectness(sql: string, context: ExpandedContext): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for referenced tables
    const referencedTables = this.extractTableNames(sql);
    const validTableNames = new Set(
      Array.from(context.all_columns_map.keys()).map((t) => t.toLowerCase()),
    );

    for (const table of referencedTables) {
      if (!validTableNames.has(table.toLowerCase())) {
        errors.push({
          code: 'UNKNOWN_TABLE',
          message: `Table not found in schema: ${table}`,
          severity: 'error',
        });
      }
    }

    // Check for column references
    const referencedColumns = this.extractColumnReferences(sql);
    for (const { table, column } of referencedColumns) {
      const tableColumns = context.all_columns_map.get(table.toLowerCase()) || [];
      const columnExists = tableColumns.some((c) => c.column_name.toLowerCase() === column.toLowerCase());

      if (!columnExists) {
        errors.push({
          code: 'UNKNOWN_COLUMN',
          message: `Column not found: ${table}.${column}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Heuristic safety checks
   */
  private heuristicChecks(sql: string): string[] {
    const warnings: string[] = [];

    // Check for UNION without ALL (can be slow)
    if (/UNION\s+(?!ALL)/i.test(sql)) {
      warnings.push('UNION without ALL may be slow; consider UNION ALL if performance is an issue');
    }

    // Check for cartesian joins (no WHERE)
    if (!/WHERE/i.test(sql) && /FROM.*,.*FROM/i.test(sql)) {
      warnings.push('Query may result in cartesian join; consider adding WHERE clause');
    }

    // Check for SELECT *
    if (/SELECT\s+\*/i.test(sql)) {
      warnings.push('Using SELECT * may retrieve unnecessary columns; consider specifying columns');
    }

    // Check for GROUP BY without aggregate
    if (/GROUP\s+BY/i.test(sql) && !/SUM|COUNT|AVG|MIN|MAX/i.test(sql)) {
      warnings.push('GROUP BY without aggregate function; may not produce expected results');
    }

    return warnings;
  }

  /**
   * Extract table names from SQL
   */
  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    const cleaned = stripSqlComments(sql);

    // Simple extraction: FROM table or JOIN table
    const fromMatch = cleaned.match(/FROM\s+(\w+)/gi);
    const joinMatch = cleaned.match(/JOIN\s+(\w+)/gi);

    if (fromMatch) {
      for (const match of fromMatch) {
        const tableName = match.replace(/^FROM\s+/i, '').trim();
        if (tableName && !tables.includes(tableName)) {
          tables.push(tableName);
        }
      }
    }

    if (joinMatch) {
      for (const match of joinMatch) {
        const tableName = match.replace(/^JOIN\s+/i, '').trim();
        if (tableName && !tables.includes(tableName)) {
          tables.push(tableName);
        }
      }
    }

    return tables;
  }

  /**
   * Extract column references
   */
  private extractColumnReferences(sql: string): Array<{ table: string; column: string }> {
    const references: Array<{ table: string; column: string }> = [];

    // Simple pattern: table.column
    const columnPattern = /(\w+)\.(\w+)/g;
    let match;

    while ((match = columnPattern.exec(sql)) !== null) {
      references.push({
        table: match[1],
        column: match[2],
      });
    }

    return references;
  }
}
