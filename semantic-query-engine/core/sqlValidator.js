"use strict";
/**
 * SQL Validator - Extended validation with semantic and safety checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const helpers_1 = require("../utils/helpers");
const logger = logger_1.createLogger('SQLValidator');
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
class SQLValidator {
    constructor() { }
    /**
     * Validate SQL query comprehensively
     */
    validate(sql, context) {
        const startTime = Date.now();
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Step 1: Check for forbidden keywords
        const keywordErrors = this.checkForbiddenKeywords(sql);
        errors.push(...keywordErrors);
        // Step 2: Check for dangerous patterns
        const patternErrors = this.checkDangerousPatterns(sql);
        errors.push(...patternErrors);
        // Step 3: Check for single SELECT statement
        if (!this.isValidSelectStatement(sql)) {
            const err = {
                code: 'INVALID_STATEMENT',
                message: 'Query must be a single SELECT statement',
                severity: 'error',
            };
            errors.push(err);
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
        const result = {
            ok,
            errors,
            warnings,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            validation_ms: validationMs,
        };
        if (!ok) {
            logger.warn('SQL validation failed', {
                sqlPreview: sql.slice(0, 150),
                errorCount: errors.length,
                warningCount: warnings.length,
                errors: errors.map((e) => ({ code: e.code, message: e.message })),
                ms: validationMs,
            });
        }
        else {
            logger.info('SQL validation passed', {
                sqlLength: sql.length,
                ms: validationMs,
            });
        }
        return result;
    }
    /**
     * Check for forbidden SQL keywords
     */
    checkForbiddenKeywords(sql) {
        const errors = [];
        const cleaned = helpers_1.stripSqlComments(sql);
        const upper = cleaned.toUpperCase();
        for (const keyword of FORBIDDEN_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            if (regex.test(upper)) {
                const err = {
                    code: 'FORBIDDEN_KEYWORD',
                    message: `Forbidden SQL keyword: ${keyword}. Only SELECT queries are allowed.`,
                    severity: 'error',
                };
                errors.push(err);
            }
        }
        return errors;
    }
    /**
     * Check for dangerous patterns
     */
    checkDangerousPatterns(sql) {
        const errors = [];
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(sql)) {
                const err = {
                    code: 'DANGEROUS_PATTERN',
                    message: `Detected dangerous SQL pattern: ${pattern.source}`,
                    severity: 'error',
                };
                errors.push(err);
            }
        }
        return errors;
    }
    /**
     * Check if SQL is a valid single SELECT statement
     */
    isValidSelectStatement(sql) {
        const cleaned = helpers_1.stripSqlComments(sql).trim();
        // Remove trailing semicolon
        const normalized = cleaned.replace(/;\s*$/, '').trim();
        if (!normalized) {
            logger.warn('isValidSelectStatement: empty after normalization');
            return false;
        }
        const upper = normalized.toUpperCase();
        // Must start with SELECT or WITH
        if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
            logger.warn('isValidSelectStatement: does not start with SELECT or WITH', {
                firstWords: normalized.slice(0, 50),
            });
            return false;
        }
        // Check for multiple statements (semicolon NOT in string literals)
        const withoutStrings = normalized.replace(/'([^']|'')*'/g, "''");
        const statementCount = (withoutStrings.match(/;/g) || []).length;
        if (statementCount > 0) {
            logger.warn('isValidSelectStatement: multiple statements detected', {
                statementCount,
                semicolonPositions: Array.from(withoutStrings.matchAll(/;/g)).map((m) => m.index),
            });
            return false;
        }
        logger.info('isValidSelectStatement: valid', {
            length: normalized.length,
            startsWithSelect: upper.startsWith('SELECT'),
            startsWithWith: upper.startsWith('WITH'),
        });
        return true;
    }
    /**
     * Semantic correctness checks
     */
    checkSemanticCorrectness(sql, context) {
        const errors = [];
        // Extract table-alias mappings first
        const aliasMap = this.extractTableAliases(sql);
        // Check for referenced tables
        const referencedTables = this.extractTableNames(sql);
        const validTableNames = new Set(Array.from(context.all_columns_map.keys()).map((t) => t.toLowerCase()));
        for (const table of referencedTables) {
            if (!validTableNames.has(table.toLowerCase())) {
                const err = {
                    code: 'UNKNOWN_TABLE',
                    message: `Table not found in schema: ${table}`,
                    severity: 'error',
                };
                errors.push(err);
            }
        }
        // Check for column references
        const referencedColumns = this.extractColumnReferences(sql);
        for (const { table, column } of referencedColumns) {
            // Resolve alias to real table name
            const realTableName = aliasMap.get(table.toLowerCase()) || table;
            const tableColumns = context.all_columns_map.get(realTableName.toLowerCase()) || [];
            const columnExists = tableColumns.some((c) => c.column_name.toLowerCase() === column.toLowerCase());
            if (!columnExists) {
                const err = {
                    code: 'UNKNOWN_COLUMN',
                    message: `Column not found: ${table}.${column}`,
                    severity: 'error',
                };
                errors.push(err);
            }
        }
        return errors;
    }
    /**
     * Heuristic safety checks
     */
    heuristicChecks(sql) {
        const warnings = [];
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
    extractTableNames(sql) {
        const tables = [];
        const cleaned = helpers_1.stripSqlComments(sql);
        // Capture schema-qualified names: dbo.TableName or just TableName
        const fromMatch = cleaned.match(/FROM\s+((?:\w+\.)?[\w]+)/gi);
        const joinMatch = cleaned.match(/JOIN\s+((?:\w+\.)?[\w]+)/gi);
        const processMatches = (matches) => {
            if (!matches)
                return;
            for (const match of matches) {
                let tableName = match.replace(/^(FROM|JOIN)\s+/i, '').trim();
                // Remove schema prefix (dbo.TableName -> TableName)
                if (tableName.includes('.')) {
                    tableName = tableName.split('.')[1];
                }
                if (tableName && !tables.includes(tableName)) {
                    tables.push(tableName);
                }
            }
        };
        processMatches(fromMatch);
        processMatches(joinMatch);
        return tables;
    }
    /**
     * Extract table-alias mappings from SQL
     * e.g., "dbo.ZTBDelivery AS T1" -> { "t1": "ZTBDelivery" }
     */
    extractTableAliases(sql) {
        const aliasMap = new Map();
        const cleaned = helpers_1.stripSqlComments(sql);
        // Match: (schema.)TableName AS AliasName
        // Pattern: word.word AS word, or word AS word
        const aliasPattern = /(?:FROM|JOIN)\s+((?:\w+\.)?[\w]+)\s+(?:AS\s+)?(\w+)(?:\s|,|WHERE|JOIN|$)/gi;
        let match;
        while ((match = aliasPattern.exec(cleaned)) !== null) {
            let tableName = match[1].trim();
            const aliasName = match[2].trim();
            // Skip if alias is a keyword (ON, INNER, LEFT, etc.)
            if (['ON', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'WHERE', 'AND', 'OR'].includes(aliasName.toUpperCase())) {
                continue;
            }
            // Remove schema prefix (dbo.TableName -> TableName)
            if (tableName.includes('.')) {
                tableName = tableName.split('.')[1];
            }
            // Map alias to real table name (case-insensitive)
            aliasMap.set(aliasName.toLowerCase(), tableName);
        }
        return aliasMap;
    }
    /**
     * Extract column references (table.column patterns, excluding schema.table patterns)
     */
    extractColumnReferences(sql) {
        const references = [];
        const cleaned = helpers_1.stripSqlComments(sql);
        // Pattern: table.column (excluding aliases and schema qualifiers)
        // Match word.word but skip dbo.something patterns
        const columnPattern = /(\w+)\.(\w+)/g;
        let match;
        const seen = new Set();
        while ((match = columnPattern.exec(cleaned)) !== null) {
            const potentialTable = match[1];
            const potentialColumn = match[2];
            // Skip common schema names (dbo, schema, sys, tempdb, etc.)
            if (['dbo', 'schema', 'sys', 'tempdb', 'guest', 'information_schema'].includes(potentialTable.toLowerCase())) {
                continue;
            }
            // Skip if it looks like an alias reference (usually all caps or mixed case after AS)
            const key = `${potentialTable}.${potentialColumn}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            references.push({
                table: potentialTable,
                column: potentialColumn,
            });
        }
        return references;
    }
}
exports.SQLValidator = SQLValidator;
