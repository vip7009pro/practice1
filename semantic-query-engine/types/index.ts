/**
 * Semantic Query Engine - Core Type Definitions
 */

// ============ TABLE & COLUMN METADATA ============
export interface TableMetadata {
  table_name: string;
  schema?: string;
  business_name: string;
  description: string;
  use_cases: string[];
  synonyms?: string[];
  row_count?: number;
  last_updated?: string;
}

export interface ColumnMetadata {
  column_name: string;
  table_name: string;
  business_name: string;
  description: string;
  data_type: string;
  example_value?: string;
  business_rules?: string[];
  is_key?: boolean;
  is_foreign_key?: boolean;
  is_searchable?: boolean;
  is_filterable?: boolean;
  synonyms?: string[];
}

// ============ BUSINESS METRICS ============
export interface BusinessMetric {
  id: string;
  name: string;
  business_name: string;
  description: string;
  formula: string; // SQL expression, e.g. "SUM(total_amount - discount)"
  tables: string[];
  data_type: 'number' | 'currency' | 'percentage' | 'count';
  unit?: string;
  conditions?: string[]; // Additional WHERE conditions
  related_dimensions?: string[]; // Suggest grouping by these columns
  examples?: Array<{ question: string; expected_metric_value: string }>;
}

// ============ RELATIONSHIPS ============
export interface Relationship {
  id?: string;
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  type: 'fk' | 'business'; // fk = foreign key, business = semantic relationship
  cardinality?: '1:1' | '1:N' | 'N:N';
  weight?: number; // 0-1, confidence/preference
  description?: string;
}

// ============ QUERY PROCESSING ============
export interface RewrittenQuery {
  original_text: string;
  normalized_text: string;
  detected_intents: string[]; // 'metric_query', 'dimension_breakdown', 'comparison', etc
  detected_metrics: string[]; // Metric IDs
  detected_dimensions: string[]; // Column names for grouping
  detected_filters: FilterExpression[];
  entities: string[]; // Extracted business entities
  llm_used?: boolean;
  rewrite_ms?: number;
}

export interface FilterExpression {
  column?: string;
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value?: string | string[];
}

export interface ResolvedSchema {
  relevant_tables: TableMetadata[];
  relevant_columns: ColumnMetadata[];
  relevant_metrics: BusinessMetric[];
  search_score?: number;
  retrieval_ms?: number;
}

export interface ExpandedContext {
  main_tables: TableMetadata[];
  related_tables: TableMetadata[];
  all_columns_map: Map<string, ColumnMetadata[]>; // table_name -> columns
  relationships: Relationship[];
  metrics_context: BusinessMetric[];
  expansion_depth: number;
  expansion_ms?: number;
}

export interface JoinPath {
  from_table: string;
  to_table: string;
  path: JoinStep[];
  total_weight: number;
  cost_estimate: number;
  resolution_ms?: number;
}

export interface JoinStep {
  table: string;
  column: string;
  next_table: string;
  join_column: string;
  join_type: 'inner' | 'left' | 'right' | 'full';
  relationship_type: 'fk' | 'business';
}

// ============ SQL GENERATION ============
export interface GeneratedSQL {
  sql: string;
  explanation: string; // Why this SQL
  join_paths_used: JoinPath[];
  metrics_used: string[];
  prompt?: string; // For debugging
  generation_ms?: number;
  model?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions?: string[];
  validation_ms?: number;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  line?: number;
}

// ============ QUERY EXECUTION ============
export interface ExecutionResult {
  rows: any[];
  row_count: number;
  columns: string[];
  execution_ms: number;
  error?: ExecutionError;
  execution_notes?: string[];
}

export interface ExecutionError {
  code: string;
  message: string;
  sql_server_error?: string;
  sql_server_error_code?: number;
}

// ============ RESULT FORMATTING ============
export interface FormattedResult {
  rows: any[];
  summary: string; // Human-readable explanation in Vietnamese
  key_insights: string[];
  visualization_hints?: VisualizationHint;
  execution_ms?: number;
  formatting_ms?: number;
}

export interface VisualizationHint {
  type: 'line' | 'bar' | 'pie' | 'table' | 'scatter';
  dimensions: string[];
  measures: string[];
}

// ============ API REQUEST/RESPONSE ============
export interface SemanticQueryRequest {
  question: string;
  chat_history?: Array<{ user: string; assistant: string }>;
  chat_summary?: string;
  preferences?: {
    top_k?: number; // Top-K schema retrieval
    max_depth?: number; // Relationship expansion depth
    explain?: boolean;
    debug?: boolean;
  };
  user_id?: string;
  session_id?: string;
}

export interface SemanticQueryResponse {
  tk_status: 'OK' | 'NG';
  data?: SemanticQueryData;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SemanticQueryData {
  sql: string;
  rows: any[];
  summary: string;
  execution_time_ms: number;
  total_time_ms?: number;
  pipeline_steps?: Array<{
    step: string;
    duration_ms: number;
    status: 'ok' | 'error';
    note?: string;
  }>;
  visualization_hints?: VisualizationHint;
  chat_summary?: string; // Updated summary for conversation
  debug_info?: any; // Only if debug=true
}

// ============ METRIC REQUEST/RESPONSE ============
export interface MetricQueryRequest {
  metric_id: string;
  filters?: FilterExpression[];
  group_by?: string[];
  order_by?: string;
  limit?: number;
  preferences?: SemanticQueryRequest['preferences'];
}

export interface MetricQueryResponse {
  tk_status: 'OK' | 'NG';
  data?: MetricQueryData;
  error?: {
    code: string;
    message: string;
  };
}

export interface MetricQueryData {
  metric_id: string;
  metric_name: string;
  value?: number | string;
  rows?: any[];
  summary?: string;
  trend?: 'up' | 'down' | 'stable';
  comparison_value?: number | string;
  execution_ms?: number;
}

// ============ INTERNAL CONFIG ============
export interface SemanticEngineConfig {
  metadata_dir: string;
  vector_store_path?: string;
  db_pool: any; // mssql pool
  gemini_api_key?: string;
  max_row_limit: number;
  query_timeout_ms: number;
  max_relationship_depth: number;
  default_top_k: number;
  enable_caching: boolean;
  debug: boolean;
}

export interface PipelineStep {
  name: string;
  start_ms: number;
  duration_ms?: number;
  status: 'pending' | 'ok' | 'error';
  error?: string;
  notes?: any;
}

export interface PipelineContext {
  request: SemanticQueryRequest;
  steps: PipelineStep[];
  rewritten_query?: RewrittenQuery;
  resolved_schema?: ResolvedSchema;
  expanded_context?: ExpandedContext;
  generated_sql?: GeneratedSQL;
  validation_result?: ValidationResult;
  execution_result?: ExecutionResult;
  formatted_result?: FormattedResult;
}

// ============ ERRORS ============
export class SemanticEngineError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'SemanticEngineError';
  }
}

export class ValidationException extends SemanticEngineError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationException';
  }
}

export class ExecutionError extends SemanticEngineError {
  constructor(message: string, details?: any) {
    super('EXECUTION_ERROR', message, details);
    this.name = 'ExecutionError';
  }
}

export class MetadataError extends SemanticEngineError {
  constructor(message: string, details?: any) {
    super('METADATA_ERROR', message, details);
    this.name = 'MetadataError';
  }
}
