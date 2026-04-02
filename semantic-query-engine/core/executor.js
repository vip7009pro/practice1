"use strict";
/**
 * Executor - Safe query execution with timeouts and row limits
 */
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
const logger = logger_1.createLogger('Executor');
const MAX_ROW_LIMIT = constants_1.SEMANTIC_ENGINE_CONFIG.MAX_ROW_LIMIT;
const QUERY_TIMEOUT_MS = constants_1.SEMANTIC_ENGINE_CONFIG.QUERY_TIMEOUT_MS;
class Executor {
    constructor(dbPool) {
        this.dbPool = dbPool;
    }
    /**
     * Execute safe SQL query with timeout and row limit
     */
    async execute(sql, timeout = QUERY_TIMEOUT_MS, rowLimit = MAX_ROW_LIMIT) {
        const startTime = Date.now();
        if (!sql || String(sql).trim().length === 0) {
            throw new types_1.SemanticEngineError('EMPTY_QUERY', 'SQL query cannot be empty');
        }
        try {
            // Add row limit if not already present
            let executingSql = String(sql).trim();
            if (!executingSql.toUpperCase().includes('TOP')) {
                // Inject TOP clause after SELECT
                const selectMatch = executingSql.match(/^(\s*SELECT\s+)/i);
                if (selectMatch) {
                    executingSql = `${selectMatch[1]} TOP ${rowLimit} ${executingSql.substring(selectMatch[0].length)}`;
                }
            }
            logger.info('Executing query', {
                sqlLength: executingSql.length,
                timeout,
                rowLimit,
            });
            // Execute with timeout
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Query execution timeout after ${timeout}ms`)), timeout));
            const executionPromise = this.executeQuery(executingSql);
            const result = (await Promise.race([
                executionPromise,
                timeoutPromise,
            ]));
            const executionMs = Date.now() - startTime;
            const rows = Array.isArray(result.recordset) ? result.recordset : [];
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            const executionResult = {
                rows,
                row_count: rows.length,
                columns,
                execution_ms: executionMs,
                execution_notes: [
                    `Executed in ${executionMs}ms`,
                    `Returned ${rows.length} rows`,
                    rows.length >= rowLimit ? `⚠️ Result may be limited to TOP ${rowLimit}` : null,
                ].filter(Boolean),
            };
            logger.info('Query executed successfully', {
                rows: rows.length,
                columns: columns.length,
                ms: executionMs,
            });
            return executionResult;
        }
        catch (error) {
            const executionMs = Date.now() - startTime;
            let errorMessage = 'Query execution failed';
            let errorCode = 'UNKNOWN ERROR';
            let sqlServerError;
            let sqlServerErrorCode;
            if (error instanceof Error) {
                errorMessage = error.message;
                // Parse SQL Server error
                if (error.message.includes('SQL Server')) {
                    errorCode = 'SQL_SERVER_ERROR';
                    sqlServerError = error.message;
                    // Try to extract error number
                    const errorMatch = error.message.match(/Error (\d+)/);
                    if (errorMatch) {
                        sqlServerErrorCode = parseInt(errorMatch[1], 10);
                    }
                }
                else if (error.message.includes('timeout')) {
                    errorCode = 'QUERY_TIMEOUT';
                }
            }
            logger.error('Query execution failed', error, { ms: executionMs });
            const execError = {
                code: errorCode,
                message: errorMessage,
                sql_server_error: sqlServerError,
                sql_server_error_code: sqlServerErrorCode,
            };
            return {
                rows: [],
                row_count: 0,
                columns: [],
                execution_ms: executionMs,
                error: execError,
            };
        }
    }
    /**
     * Execute query using DB pool
     */
    async executeQuery(sql) {
        try {
            const result = await this.dbPool.request().query(sql);
            return result;
        }
        catch (error) {
            logger.error('DB Pool execution error', error);
            throw error;
        }
    }
    /**
     * Test connection
     */
    async testConnection() {
        try {
            const result = await this.dbPool.request().query('SELECT 1 AS test');
            return result.recordset && result.recordset.length > 0;
        }
        catch (error) {
            logger.error('Connection test failed', error);
            return false;
        }
    }
}
exports.Executor = Executor;
