# Semantic ERP Query Engine

A production-grade, semantic-aware SQL query engine for ERP systems. Understands business concepts, automatically generates SQL, and returns results with Vietnamese explanations and visualization hints.

## 🎯 Overview

The Semantic Query Engine bridges the gap between natural language business questions and SQL queries. Instead of just keyword matching, it:

- **Understands Business Context**: Knows about tables, columns, metrics, and their Vietnamese business names
- **Follows Relationships**: Automatically joins tables following foreign keys and business relationships
- **Generates SQL Intelligently**: Uses LLM to create semantically correct, optimized SQL
- **Explains Results**: Generates concise Vietnamese explanations of query results
- **Suggests Visualizations**: Recommends appropriate chart types based on data structure

## 🏗️ Architecture

### 8-Step Pipeline

```
User Question
    ↓
1. Query Rewriting → Normalize text, detect intent (metric/breakdown/comparison)
    ↓
2. Semantic Retrieval → Find relevant tables/columns/metrics using fuzzy matching
    ↓
3. Relationship Expansion → Expand schema context via BFS relationship follow
    ↓
4. Join Path Resolution → Compute optimal paths between tables
    ↓
5. SQL Generation → LLM-based SQL with business context
    ↓
6. Validation → Check safety (keywords, patterns, semantics)
    ↓
7. Execution → Run query with timeout & row limit protection
    ↓
8. Formatting → Format results, generate Vietnamese explanations
    ↓
Structured Result
```

### Module Structure

```
semantic-query-engine/
├── types/
│   └── index.ts                 # TypeScript interfaces & error types
├── config/
│   └── constants.ts             # Configuration & constants
├── utils/
│   ├── logger.ts                # Structured logging
│   └── helpers.ts               # 20+ utility functions
├── metadata/
│   ├── tables.json              # Table definitions
│   ├── columns.json             # Column definitions
│   ├── relationships.json        # FK & business relationships
│   ├── metrics.json             # Metric formulas & definitions
│   └── glossary.json            # Vietnamese term mappings
├── services/
│   └── metadataService.ts       # Metadata loading & querying
├── core/
│   ├── queryRewriter.ts         # Intent detection + normalization
│   ├── semanticRetriever.ts     # Fuzzy schema retrieval
│   ├── relationshipGraph.ts      # Relationship pathfinding (BFS)
│   ├── relationshipExpander.ts   # Context expansion
│   ├── joinPathResolver.ts       # Join path resolution
│   ├── sqlValidator.ts          # Safety & semantic validation
│   ├── sqlGenerator.ts          # LLM-based SQL generation
│   ├── executor.ts              # Safe query execution
│   └── formatter.ts             # Result formatting & explanations
├── handlers/
│   ├── semanticQueryHandler.ts  # Full pipeline orchestrator
│   └── businessMetricHandler.ts # Specialized metric queries
├── tests/
│   └── (test fixtures & integration tests)
├── index.ts                     # Module exports
├── README.md                    # This file
├── PIPELINE.md                  # Detailed pipeline walkthrough
└── EXTENDING.md                 # How to extend (add metrics/tables/terms)
```

## 🚀 Usage

### Backend Integration

The module is production-ready and integrated into `/routes/ai.js` with three new endpoints:

#### 1. Semantic Query Endpoint
```bash
POST /api/ai/v2/query
Content-Type: application/json

{
  "question": "Doanh thu tháng này so với tháng trước?",
  "chat_history": [...],           # Optional: for context
  "chat_summary": "...",            # Optional: conversation summary
  "explain": true,                  # Generate Vietnamese explanation
  "debug": false,                   # Detailed pipeline steps
  "top_k": 7,                       # Top-K schema retrieval
  "max_depth": 2                    # Relationship expansion depth
}
```

**Response:**
```json
{
  "tk_status": "OK",
  "data": {
    "sql": "SELECT category, SUM(total_amount) as revenue FROM orders ...",
    "data": [...],                  # Query results
    "explanation": "Doanh thu tháng này là 2.5 tỷ đồng...",
    "chat_summary": "Updated summary",
    "execution_time_ms": 145,
    "visualization_hints": {
      "type": "bar",
      "dimensions": ["category"],
      "measures": ["revenue"]
    }
  }
}
```

#### 2. Metric Query Endpoint
```bash
POST /api/ai/v2/metric
Content-Type: application/json

{
  "metric_id": "revenue_total",
  "filters": [                      # Optional: filter conditions
    { "column": "status", "operator": "eq", "value": "confirmed" }
  ],
  "group_by": ["category", "region"] # Optional: grouping columns
}
```

#### 3. List Metrics Endpoint
```bash
GET /api/ai/v2/metrics
```

### Frontend Usage

```typescript
import { getV2ApiClient } from '@/api/V2Api';

const api = getV2ApiClient();

// Simple question
const response = await api.aiV2Query({
  question: "Bán hàng tháng này",
  explain: true
});

console.log(response.data.explanation);  // Vietnamese explanation
console.log(response.data.visualization_hints);  // Chart type suggestion

// With conversation context
const response2 = await api.aiV2Query({
  question: "So với tháng trước?",  // Follow-up question
  chat_history: [...],
  chat_summary: "Talking about monthly revenue",
});

// Direct metric query
const metric = await api.aiV2Metric({
  metric_id: 'revenue_net',
  group_by: ['region']
});

console.log(metric.data.value);   // 3.2 billion
console.log(metric.data.rows);    // Breakdown by region
```

## 📊 Metadata Configuration

The engine's business understanding comes from four JSON files in `/metadata/`:

### 1. Tables (metadata/tables.json)
```json
{
  "tables": [
    {
      "table_name": "orders",
      "business_name": "Đơn hàng",
      "description": "Các đơn hàng bán hàng",
      "use_cases": ["doanh thu", "bán hàng", "đơn hàng"],
      "synonyms": ["hóa đơn", "order"]
    }
  ]
}
```

### 2. Columns (metadata/columns.json)
```json
{
  "columns": [
    {
      "column_name": "total_amount",
      "table_name": "orders",
      "business_name": "Tổng tiền",
      "data_type": "decimal",
      "is_searchable": true,
      "is_filterable": true,
      "synonyms": ["tiền", "tổng", "giá"]
    }
  ]
}
```

### 3. Relationships (metadata/relationships.json)
```json
{
  "relationships": [
    {
      "from_table": "orders",
      "from_column": "customer_id",
      "to_table": "customers",
      "to_column": "customer_id",
      "type": "fk",
      "cardinality": "N:1"
    }
  ]
}
```

### 4. Metrics (metadata/metrics.json)
```json
{
  "metrics": [
    {
      "id": "revenue_total",
      "business_name": "Doanh thu",
      "formula": "SUM(o.total_amount)",
      "tables": ["orders"],
      "data_type": "currency",
      "unit": "VND"
    }
  ]
}
```

### 5. Glossary (metadata/glossary.json)
Maps Vietnamese user terms to canonical business terms:
```json
{
  "glossary": [
    {
      "canonical_term": "doanh thu",
      "category": "revenue",
      "user_terms": ["doanh thu", "bán hàng", "sales", "thu nhập"]
    }
  ]
}
```

## ⚙️ Configuration

Key configuration in `config/constants.ts`:

```typescript
SEMANTIC_ENGINE_CONFIG = {
  max_row_limit: 10000,           # Safety limit for query results
  query_timeout_ms: 30000,        # 30-second timeout per query
  default_top_k: 7,               # Top-K schema retrieval
  max_relationship_depth: 2,      # How deep to expand relationships
}

LLM_CONFIG = {
  model: 'gemini-2.5-flash',      # Model for SQL generation
  temperature: 0.3,               # Deterministic output
}
```

## 🔒 Security Features

✅ **SQL Safety Validation**
- Blocks dangerous keywords (INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, etc.)
- Rejects dangerous patterns (xp_cmdshell, sp_executesql, etc.)
- Enforces single SELECT statement

✅ **Timeout Protection**
- 30-second default timeout per query
- Prevents runaway queries

✅ **Row Limiting**
- Auto-injects TOP clause (10,000 default)
- Prevents memory exhaustion

✅ **Semantic Validation**
- Checks table/column existence
- Validates join relationships
- Warns on risky patterns (UNION without ALL, SELECT *)

## 🧪 Testing

See [test fixtures](./tests/) for:
- Unit test examples for each component
- Integration test scenarios
- Mock database data

## 📖 Learn More

- **[PIPELINE.md](./PIPELINE.md)** - Detailed walkthrough of each pipeline step
- **[EXTENDING.md](./EXTENDING.md)** - How to add new metrics, tables, and glossary terms

## 🔧 Troubleshooting

### Query Returns No Results
1. Check that question contains keywords in tables/columns metadata
2. Verify glossary has terms for user's language/phrasing
3. Check metadata/relationships.json for required joins

### Incorrect SQL Generated
1. Enable debug mode: `debug: true` in request
2. Review `pipeline_steps` in response to see each step
3. Check that synonyms cover user's terminology
4. Verify metric formulas in metrics.json

### Timeout Errors
1. Increase `query_timeout_ms` in config/constants.ts
2. Check if query involves large tables without proper filtering
3. Verify indexes on join columns

## 📞 Support

For issues:
1. Check the [PIPELINE.md](./PIPELINE.md) walkthrough
2. Review [EXTENDING.md](./EXTENDING.md) for metadata customization
3. Enable debug mode to see detailed pipeline steps
4. Check logs for component-specific errors

## 📜 License

Part of the CMS ERP2 system. All rights reserved.
