/**
 * Configuration Constants
 */

import os from 'os';
import path from 'path';

// Direct export for commonly used constant
export const DEFAULT_TOP_K = 7;

export const SEMANTIC_ENGINE_CONFIG = {
  // Query execution limits
  MAX_ROW_LIMIT: parseInt(process.env.SEMANTIC_MAX_ROW_LIMIT || '10000', 10),
  QUERY_TIMEOUT_MS: parseInt(process.env.SEMANTIC_QUERY_TIMEOUT_MS || '30000', 10),
  
  // Relationship expansion
  MAX_RELATIONSHIP_DEPTH: parseInt(process.env.SEMANTIC_MAX_DEPTH || '2', 10),
  DEFAULT_TOP_K: parseInt(process.env.SEMANTIC_TOP_K || String(DEFAULT_TOP_K), 10),
  
  // Semantic retrieval
  SIMILARITY_THRESHOLD: 0.5,
  FUZZY_MATCH_THRESHOLD: 0.6,
  
  // Pipeline
  ENABLE_CACHING: String(process.env.SEMANTIC_ENABLE_CACHING || 'true').toLowerCase() === 'true',
  CACHE_TTL_MS: parseInt(process.env.SEMANTIC_CACHE_TTL_MS || '3600000', 10), // 1 hour
  
  // Debug
  DEBUG: String(process.env.SEMANTIC_DEBUG || '').toLowerCase() === 'true',
};

export const SQL_SAFETY_CONFIG = {
  // Forbidden SQL keywords (for safety)
  FORBIDDEN_KEYWORDS: [
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
  ],
  
  // Require WHERE clause for large tables
  FULL_TABLE_SCAN_THRESHOLD: 10000, // If table has >10k rows, requires WHERE
  
  // Max result rows
  MAX_SELECT_ROWS: 100000,
};

export const VALIDATION_CONFIG = {
  // Validation rules
  ALLOW_FULL_TABLE_SCAN: false,
  ALLOW_IMPLICIT_JOINS: false,
  REQUIRE_COLUMN_ALIAS_FOR_AGGREGATES: true,
  VALIDATE_RELATIONSHIPS: true,
  
  // Error thresholds
  MAX_VALIDATION_WARNINGS: 10,
};

export const LLM_CONFIG = {
  // Gemini model
  GEMINI_MODEL: String(process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
  
  // Temperature (0 = deterministic, 1 = creative)
  TEMPERATURE_SQL_GENERATION: 0.1,
  TEMPERATURE_EXPLANATION: 0.3,
  TEMPERATURE_QUERY_REWRITE: 0.2,
  
  // Timeouts
  LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10),
  LLM_RETRIES: parseInt(process.env.LLM_RETRIES || '2', 10),
};

export const METADATA_CONFIG = {
  // Metadata directory
  METADATA_DIR: resolveSemanticMetadataDir(),
  BUNDLED_METADATA_DIR: path.resolve(__dirname, '..', 'metadata'),
  
  // Files
  TABLES_FILE: 'tables.json',
  COLUMNS_FILE: 'columns.json',
  RELATIONSHIPS_FILE: 'relationships.json',
  METRICS_FILE: 'metrics.json',
  GLOSSARY_FILE: 'glossary.json',
};

function resolveSemanticMetadataDir(): string {
  const explicit = String(process.env.SEMANTIC_METADATA_DIR || '').trim();
  if (explicit) {
    return path.resolve(explicit);
  }

  if ((process as any).pkg) {
    const localAppData = String(process.env.LOCALAPPDATA || '').trim();
    const baseDir = localAppData || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(baseDir, 'practice1', 'semantic-query-engine', 'metadata');
  }

  return path.resolve(__dirname, '..', 'metadata');
}

export const PIPELINE_CONFIG = {
  // Step timeouts
  STEP_REWRITE_TIMEOUT_MS: 15000,
  STEP_RETRIEVE_TIMEOUT_MS: 5000,
  STEP_EXPAND_TIMEOUT_MS: 5000,
  STEP_RESOLVE_PATHS_TIMEOUT_MS: 5000,
  STEP_GENERATE_SQL_TIMEOUT_MS: 20000,
  STEP_VALIDATE_TIMEOUT_MS: 5000,
  STEP_EXECUTE_TIMEOUT_MS: 30000,
  STEP_FORMAT_TIMEOUT_MS: 15000,
  
  // Health checks
  MAX_RETRIES_PER_STEP: 2,
};

export const RESPONSE_CODES = {
  // Success
  OK: 'OK',
  
  // Errors
  ERR_INVALID_REQUEST: 'INVALID_REQUEST',
  ERR_METADATA_NOT_FOUND: 'METADATA_NOT_FOUND',
  ERR_SCHEMA_RETRIEVAL_FAILED: 'SCHEMA_RETRIEVAL_FAILED',
  ERR_SQL_GENERATION_FAILED: 'SQL_GENERATION_FAILED',
  ERR_VALIDATION_FAILED: 'VALIDATION_FAILED',
  ERR_EXECUTION_FAILED: 'EXECUTION_FAILED',
  ERR_FORMATTING_FAILED: 'FORMATTING_FAILED',
  ERR_TIMEOUT: 'TIMEOUT',
  ERR_INTERNAL_ERROR: 'INTERNAL_ERROR',
};
