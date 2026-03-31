# Semantic Query Engine - Pipeline Walkthrough

This document provides a detailed explanation of each of the 8 steps in the semantic query pipeline.

## Example Query

Throughout this walkthrough, we'll trace this example question:

```
"Doanh thu từ các khách hàng VIP trong tháng 3?"
(Revenue from VIP customers in March?)
```

---

## Step 1: Query Rewriting

**Component**: `core/queryRewriter.ts`

**Purpose**: Normalize the user's question and extract structured meaning.

### What Happens

The QueryRewriter:
1. **Normalizes text**: Removes accents, extra spaces, standardizes case
   - Input: `"Doanh thu từ các khách hàng VIP trong tháng 3?"`
   - Normalized: `"doanh thu tu cac khach hang vip trong thang 3"`

2. **Detects intents**: Identifies the user's goal
   - `metric_query`: Asking for a specific metric (doanh thu = revenue)
   - `dimension_breakdown`: Grouping by category (implicit: by customer type)
   - `filter_query`: Applying conditions (VIP customers, March)

3. **Extracts metrics**: Matches user terms to known metrics
   - "doanh thu" → "revenue_total" metric

4. **Extracts dimensions**: Identifies grouping columns
   - "khách hàng" → customers table, implied grouping

5. **Extracts filters**: Parses conditions
   - "VIP" → status = 'VIP'
   - "tháng 3" → date range (2026-03-01 to 2026-03-31)

6. **Extracts entities**: Identifies business entities mentioned
   - `["orders", "customers"]`

### Output: RewrittenQuery

```json
{
  "original_text": "Doanh thu từ các khách hàng VIP trong tháng 3?",
  "normalized_text": "doanh thu tu cac khach hang vip trong thang 3",
  "detected_intents": ["metric_query", "filter_query"],
  "detected_metrics": ["revenue_total"],
  "detected_dimensions": ["customer_type"],
  "detected_filters": [
    {
      "column": "status",
      "operator": "eq",
      "value": "VIP"
    },
    {
      "column": "order_date",
      "operator": "gte",
      "value": "2026-03-01"
    },
    {
      "column": "order_date",
      "operator": "lt",
      "value": "2026-04-01"
    }
  ],
  "entities": ["orders", "customers"],
  "rewrite_ms": 42
}
```

---

## Step 2: Semantic Retrieval

**Component**: `core/semanticRetriever.ts`

**Purpose**: Find the most relevant tables, columns, and metrics for the query.

### What Happens

The SemanticRetriever uses **token-overlap fuzzy matching** (no expensive embeddings):

1. **Score tables** against the question
   - Tokenize question: `["doanh", "thu", "khach", "hang", "vip", "thang"]`
   - Score "orders" table:
     - Match on "doanh" (revenue relevant) → 0.8
     - Match on "tháng" (date relevant) → 0.7
     - **Final score: 0.8**
   - Score "customers" table:
     - Match on "khach" (customer) → 0.9
     - Match on "hang" (VIP) → 0.6
     - **Final score: 0.9**
   - Return top tables: `[customers (0.9), orders (0.8)]`

2. **Score columns** for each relevant table
   - For "customers": Find columns matching "status", "vip"
     - "customer_type" → fuzzy match on "type VIP" → 0.85
     - "status" → exact match on intent → 0.9
     - "customer_name" → less relevant → 0.3
   - For "orders": Find columns matching "doanh", "tháng"
     - "total_amount" → synonym "doanh thu" → 0.95
     - "order_date" → matches "tháng" → 0.85
     - "order_id" → not relevant → 0.1

3. **Score metrics** against "doanh thu"
   - "revenue_total": direct match! → 1.0 (already detected in Step 1)
   - "profit": related but not exact → 0.6
   - Return: `[revenue_total (1.0)]`

### Scoring Algorithm

```
score = (token_overlap * 1.0) + (synonym_bonus * 0.6) + (searchable_multiplier * 1.2)

Example for "total_amount" matched against "doanh thu":
- Token overlap ("total" vs "doanh", "amount" vs "thu"): 0.7
- Synonym match ("giá tiền" is synonym of "total_amount"): +0.6
- Is searchable column: ×1.2 multiplier
= (0.7 + 0.6) × 1.2 = 1.56 → clamped to 1.0
```

### Output: ResolvedSchema

```json
{
  "relevant_tables": [
    {
      "table_name": "customers",
      "business_name": "Khách hàng",
      "score": 0.9
    },
    {
      "table_name": "orders",
      "business_name": "Đơn hàng",
      "score": 0.8
    }
  ],
  "relevant_columns": [
    {
      "column_name": "total_amount",
      "table_name": "orders",
      "business_name": "Tổng tiền",
      "score": 0.95
    },
    {
      "column_name": "status",
      "table_name": "customers",
      "business_name": "Trạng thái",
      "score": 0.9
    }
  ],
  "relevant_metrics": [
    {
      "id": "revenue_total",
      "business_name": "Doanh thu",
      "score": 1.0
    }
  ],
  "retrieval_ms": 28
}
```

---

## Step 3: Relationship Expansion

**Component**: `core/relationshipExpander.ts`

**Purpose**: Expand the schema context by following relationships to find related tables.

### What Happens

The RelationshipExpander performs a **breadth-first search (BFS)** through the relationship graph:

1. **Start** with main tables from Step 2
   - Main tables: `[customers, orders]`
   - Queue: `[{table: customers, depth: 0}, {table: orders, depth: 0}]`

2. **Follow relationships** up to depth=2
   - From "customers":
     - Has relationship: customers → departments (1:N)
     - Add to queue: `{table: departments, depth: 1}`
   - From "orders":
     - Has relationship: orders → order_items (1:N)
     - Has relationship: orders → customers (N:1) — already visited
     - Add to queue: `{table: order_items, depth: 1}`
   - From "departments":
     - Has relationship: departments → employees (1:N)
     - Add to queue: `{table: employees, depth: 2}`
   - From "order_items":
     - Has relationship: order_items → products (N:1)
     - Add to queue: `{table: products, depth: 2}`

3. **Collect all columns** from expanded tables
   - From each table, retrieve all relevant columns
   - customers: 8 columns
   - orders: 12 columns
   - departments: 4 columns
   - order_items: 5 columns
   - products: 10 columns

4. **Filter relationships** to only those in the context
   - Keep: customers → departments, orders → order_items, etc.
   - Drop: unrelated tables

### Output: ExpandedContext

```json
{
  "main_tables": [
    {"table_name": "customers", ...},
    {"table_name": "orders", ...}
  ],
  "related_tables": [
    {"table_name": "departments", ...},
    {"table_name": "order_items", ...},
    {"table_name": "products", ...},
    {"table_name": "employees", ...}
  ],
  "all_columns_map": {
    "customers": [...8 columns...],
    "orders": [...12 columns...],
    "departments": [...4 columns...],
    "order_items": [...5 columns...],
    "products": [...10 columns...],
    "employees": [...6 columns...]
  },
  "relationships": [
    {
      "from_table": "customers",
      "to_table": "departments",
      "type": "fk"
    },
    {
      "from_table": "orders",
      "to_table": "order_items",
      "type": "fk"
    },
    {
      "from_table": "order_items",
      "to_table": "products",
      "type": "fk"
    }
  ],
  "expansion_depth": 2,
  "expansion_ms": 15
}
```

---

## Step 4: Join Path Resolution

**Component**: `core/joinPathResolver.ts`

**Purpose**: Compute the optimal SQL JOIN statements to connect the relevant tables.

### What Happens

The JoinPathResolver uses the RelationshipGraph to find paths:

1. **Build relationship graph** from metadata
   - Nodes: All tables in system
   - Edges: All relationships (FK and business)
   - Weights: Priority (FK > business), cardinality

2. **Find paths** between each pair of required tables
   - User needs: orders → customers (for filtering by VIP)
   - BFS search:
     ```
     Start: orders
     ├─ Direct: orders.customer_id → customers.customer_id ✓
     └─ Shortest path: [orders → customers]
     ```
   - User wants: VIP customers' revenue
   - BFS search:
     ```
     Start: customers
     ├─ customers → orders (reverse FK)
     └─ Shortest path: [customers → orders]
     ```

3. **Select join types** based on relationship type
   - FK relationships → INNER JOIN (required, always exists)
   - Business relationships → LEFT JOIN (optional, may not exist)

### Output: JoinPaths Map

```json
{
  "orders_to_customers": {
    "from_table": "orders",
    "to_table": "customers",
    "path": [
      {
        "table": "orders",
        "column": "customer_id",
        "next_table": "customers",
        "join_column": "customer_id",
        "join_type": "inner",
        "relationship_type": "fk"
      }
    ],
    "total_weight": 1.0,
    "cost_estimate": 1,
    "resolution_ms": 8
  },
  "orders_to_products": {
    "from_table": "orders",
    "to_table": "products",
    "path": [
      {
        "table": "orders",
        "column": "order_id",
        "next_table": "order_items",
        "join_column": "order_id",
        "join_type": "inner",
        "relationship_type": "fk"
      },
      {
        "table": "order_items",
        "column": "product_id",
        "next_table": "products",
        "join_column": "product_id",
        "join_type": "inner",
        "relationship_type": "fk"
      }
    ],
    "total_weight": 1.0,
    "cost_estimate": 2,
    "resolution_ms": 12
  }
}
```

---

## Step 5: SQL Generation

**Component**: `core/sqlGenerator.ts`

**Purpose**: Use an LLM to generate semantically correct SQL based on business context.

### What Happens

The SQLGenerator constructs a detailed prompt for the LLM:

1. **Build schema definition**
   ```sql
   -- Table: customers (Khách hàng)
   -- Columns:
   customer_id INT PRIMARY KEY
   customer_name VARCHAR -- Tên khách hàng
   status VARCHAR -- Trạng thái (VIP, Regular, Bronze)
   created_date DATE
   ```

2. **Build filter definition**
   ```sql
   Filters to apply:
   - status must equal 'VIP'
   - order_date must be >= 2026-03-01 AND < 2026-04-01
   ```

3. **Build join definition**
   ```sql
   INNER JOIN orders ON customers.customer_id = orders.customer_id
   INNER JOIN order_items ON orders.order_id = order_items.order_id
   ```

4. **Build metric definition**
   ```sql
   Metric: revenue_total
   Formula: SUM(o.total_amount)
   Conditions: status = 'confirmed'
   ```

5. **Construct LLM prompt**
   ```
   You are a SQL Server expert. Generate a single SELECT statement.
   
   Schema:
   [table definitions...]
   
   Question: Revenue from VIP customers in March?
   
   Requirements:
   - Use schema-qualified column names (table.column)
   - Use aliases (e.g., c for customers, o for orders)
   - Include WHERE clause with all filters
   - Use correct JOIN types (INNER/LEFT)
   - Group by dimensions if needed
   - Apply the metric formula
   - Limit results to 10000 rows
   
   Return ONLY the SQL statement.
   ```

6. **Call Gemini 2.5 Flash**
   - Model: gemini-2.5-flash (fast, deterministic)
   - Temperature: 0.3 (more consistent output)
   - Timeout: 15 seconds

### Output: GeneratedSQL

```json
{
  "sql": "SELECT c.customer_name, SUM(o.total_amount) as revenue FROM customers c INNER JOIN orders o ON c.customer_id = o.customer_id WHERE c.status = 'VIP' AND o.order_date >= '2026-03-01' AND o.order_date < '2026-04-01' GROUP BY c.customer_name ORDER BY revenue DESC TOP 10000",
  "explanation": "Sum total order amounts for customers with VIP status during March 2026",
  "join_paths_used": [
    "orders_to_customers"
  ],
  "metrics_used": ["revenue_total"],
  "prompt": "[full LLM prompt...]",
  "generation_ms": 852,
  "model": "gemini-2.5-flash"
}
```

---

## Step 6: Validation

**Component**: `core/sqlValidator.ts`

**Purpose**: Verify the generated SQL is safe and semantically correct.

### What Happens

The SQLValidator performs comprehensive checks:

1. **Forbidden keyword check**
   ```
   ✓ No INSERT, UPDATE, DELETE, DROP, ALTER
   ✓ No EXEC, EXECUTE, xp_*, sp_*
   ✓ No GRANT, REVOKE
   Status: PASS
   ```

2. **Dangerous pattern check**
   ```
   ✓ No sp_executesql
   ✓ No xp_cmdshell
   ✓ No WAITFOR
   Status: PASS
   ```

3. **Single SELECT statement check**
   ```
   ✓ Exactly one SELECT
   ✓ Optional WITH clause allowed
   ✓ No semicolon at end
   Status: PASS
   ```

4. **Semantic correctness** (if context provided)
   ```
   ✓ tables exist: customers, orders
   ✓ columns exist: customer_name, total_amount, status, order_date
   ✓ joins are valid: customers.customer_id = orders.customer_id
   Status: PASS
   ```

5. **Heuristic warnings**
   ```
   ⚠ No warning: UNION without ALL (not present)
   ⚠ No warning: SELECT * (uses qualified columns)
   ⚠ No warning: cartesian join (all joins are ON-claused)
   Status: PASS (no warnings)
   ```

### Output: ValidationResult

```json
{
  "ok": true,
  "errors": [],
  "warnings": [],
  "suggestions": [],
  "validation_ms": 35
}
```

---

## Step 7: Execution

**Component**: `core/executor.ts`

**Purpose**: Execute the query safely with timeout and row limit protection.

### What Happens

1. **Inject safety clauses**
   ```sql
   -- Original SQL
   SELECT c.customer_name, SUM(o.total_amount) as revenue 
   FROM customers c ...
   
   -- Becomes (with TOP clause injected)
   SELECT TOP 10000 c.customer_name, SUM(o.total_amount) as revenue 
   FROM customers c ...
   ```

2. **Set timeout** (Promise.race)
   ```javascript
   race(
     db.query(sql),           // Execute query
     timeout(30000)           // 30-second timer
   )
   ```

3. **Execute query**
   ```
   ✓ Connection pool obtained
   ✓ Query executed
   ✓ Elapsed: 234ms
   ✓ Rows returned: 47
   ```

4. **Handle errors**
   - SQL Server errors → Parse error code/message
   - Timeout errors → Graceful timeout response
   - Connection errors → Retry logic

### Output: ExecutionResult

```json
{
  "rows": [
    {"customer_name": "ABC Corp", "revenue": 125000000},
    {"customer_name": "XYZ Ltd", "revenue": 98500000},
    {"customer_name": "123 Retail", "revenue": 75300000}
  ],
  "row_count": 3,
  "columns": ["customer_name", "revenue"],
  "execution_ms": 234,
  "error": null,
  "execution_notes": ["Executed with TOP 10000 limit"]
}
```

---

## Step 8: Formatting

**Component**: `core/formatter.ts`

**Purpose**: Format results and generate Vietnamese explanation.

### What Happens

1. **Generate Vietnamese explanation** (via LLM)
   ```
   Prompt to Gemini:
   Explain this query result in Vietnamese, 2-3 sentences, business-friendly
   
   Sample data: 
   [First 25 rows of result]
   
   Response:
   "Trong tháng 3 năm 2026, khách hàng VIP đạt doanh thu 
   298.8 triệu đồng, chủ yếu từ ABC Corp (125 triệu) và XYZ Ltd 
   (98.5 triệu). Đây là mức bán hàng ổn định so với tháng"
   ```

2. **Extract key insights**
   ```
   Numeric columns: [revenue]
   - Max: 125,000,000
   - Min: 75,300,000
   - Avg: 99,600,000
   
   String columns: [customer_name]
   - Unique values: 3
   ```

3. **Suggest visualization**
   ```
   Data structure: category (customer_name) + measure (revenue)
   Suggested type: BAR CHART
   Dimensions: [customer_name]
   Measures: [revenue]
   ```

4. **Format numbers**
   ```
   125000000 → "125,000,000" (number formatting)
   125000000 → "125 triệu đ" (currency formatting)
   0.45 → "45%" (percentage)
   ```

### Output: FormattedResult

```json
{
  "rows": [
    {"customer_name": "ABC Corp", "revenue": "125,000,000 đ"},
    {"customer_name": "XYZ Ltd", "revenue": "98,500,000 đ"},
    {"customer_name": "123 Retail", "revenue": "75,300,000 đ"}
  ],
  "summary": "Doanh thu từ khách hàng VIP trong tháng 3 là 298.8 triệu đồng, được dẫn dắt bởi ABC Corp (125 triệu), XYZ Ltd (98.5 triệu), và 123 Retail (75.3 triệu). Đây là khoảng bán hàng ổn định các khách hàng VIP.",
  "key_insights": [
    "Highest revenue: ABC Corp (125,000,000)",
    "Lowest revenue: 123 Retail (75,300,000)",
    "Average: 99,600,000",
    "3 VIP customers in total"
  ],
  "visualization_hints": {
    "type": "bar",
    "dimensions": ["customer_name"],
    "measures": ["revenue"]
  },
  "formatting_ms": 42
}
```

---

## Final Response

The SemanticQueryHandler combines all 8 steps:

```json
{
  "tk_status": "OK",
  "data": {
    "sql": "SELECT TOP 10000 c.customer_name, SUM(o.total_amount) as revenue FROM customers c INNER JOIN orders o ON c.customer_id = o.customer_id WHERE c.status = 'VIP' AND o.order_date >= '2026-03-01' AND o.order_date < '2026-04-01' GROUP BY c.customer_name ORDER BY revenue DESC",
    "rows": [
      {"customer_name": "ABC Corp", "revenue": "125,000,000 đ"},
      {"customer_name": "XYZ Ltd", "revenue": "98,500,000 đ"},
      {"customer_name": "123 Retail", "revenue": "75,300,000 đ"}
    ],
    "summary": "Doanh thu từ khách hàng VIP trong tháng 3 là 298.8 triệu đồng...",
    "execution_time_ms": 234,
    "total_time_ms": 1542,
    "pipeline_steps": [
      {"step": "query_rewriting", "duration_ms": 42, "status": "ok"},
      {"step": "semantic_retrieval", "duration_ms": 28, "status": "ok"},
      {"step": "relationship_expansion", "duration_ms": 15, "status": "ok"},
      {"step": "join_path_resolution", "duration_ms": 20, "status": "ok"},
      {"step": "sql_generation", "duration_ms": 852, "status": "ok"},
      {"step": "validation", "duration_ms": 35, "status": "ok"},
      {"step": "execution", "duration_ms": 234, "status": "ok"},
      {"step": "formatting", "duration_ms": 42, "status": "ok"}
    ],
    "visualization_hints": {
      "type": "bar",
      "dimensions": ["customer_name"],
      "measures": ["revenue"]
    }
  }
}
```

---

## Performance Profile

Typical execution for a medium-complexity query:

| Step | Time | Notes |
|------|------|-------|
| Query Rewriting | 40-60ms | Text processing, intent detection |
| Semantic Retrieval | 20-50ms | Fuzzy matching |
| Relationship Expansion | 10-25ms | BFS traversal |
| Join Path Resolution | 15-30ms | Pathfinding |
| SQL Generation | 800-1200ms | LLM call (Gemini 2.5 Flash) |
| Validation | 20-50ms | Regex + semantic checks |
| Execution | 100-500ms | DB query (varies with data) |
| Formatting | 30-100ms | LLM explanation + formatting |
| **Total** | **1100-2100ms** | Usually ~1.5 seconds |

Most time is spent in the LLM (Step 5) and DB execution (Step 7).

---

## Next Steps

- **Curious about extending?** See [EXTENDING.md](./EXTENDING.md)
- **Want to see examples?** Check the [test fixtures](./tests/)
- **Back to README?** See [README.md](./README.md)
