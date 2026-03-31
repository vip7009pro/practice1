# Extending the Semantic Query Engine

This guide explains how to customize the semantic engine for your ERP system by adding tables, columns, metrics, relationships, and glossary terms.

## Quick Start

All customization happens in the **metadata files**:

```
semantic-query-engine/metadata/
├── tables.json          # Your business tables
├── columns.json         # Table columns with business names
├── relationships.json    # How tables connect (FKs + business relationships)
├── metrics.json         # Key business metrics
└── glossary.json        # Vietnamese business terminology
```

## 1. Adding a New Table

### Scenario: You have a new `suppliers` table

**File**: `metadata/tables.json`

```json
{
  "tables": [
    {
      "table_name": "suppliers",
      "schema": "dbo",
      "business_name": "Nhà cung cấp",
      "description": "Danh sách các nhà cung cấp hàng hóa và dịch vụ",
      "use_cases": [
        "chi phí cung cấp",
        "nhà cung cấp",
        "mua hàng",
        "giá cung cấp"
      ],
      "synonyms": [
        "vendor",
        "nhà phân phối",
        "cung cấp",
        "supplier"
      ],
      "row_count": 250,
      "last_updated": "2026-03-28"
    }
  ]
}
```

### Key Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `table_name` | **Required** - Exact SQL table name | `suppliers` |
| `schema` | Optional - SQL schema name | `dbo` |
| `business_name` | **Required** - Vietnamese business name | `Nhà cung cấp` |
| `description` | **Required** - What this table contains | `Danh sách...` |
| `use_cases` | **Required** - When users ask about this | `["chi phí", "nhà cung cấp"]` |
| `synonyms` | Optional - Other names users might use | `["vendor", "supplier"]` |
| `row_count` | Optional - For optimization hints | `250` |
| `last_updated` | Optional - For cache invalidation | `2026-03-28` |

### Best Practices

✅ Include 3-5 use_cases covering common questions
✅ Add both English and Vietnamese synonyms
✅ Keep business_name concise (2-4 words max)
✅ Use meaningful descriptions (full sentences)

---

## 2. Adding Columns

### Scenario: The `suppliers` table has these columns

**File**: `metadata/columns.json`

Add to the `columns` array:

```json
{
  "column_name": "supplier_id",
  "table_name": "suppliers",
  "business_name": "Mã nhà cung cấp",
  "description": "Mã định danh duy nhất cho nhà cung cấp",
  "data_type": "integer",
  "example_value": "10001",
  "business_rules": [
    "Phải là số dương",
    "Không được trùng lặp"
  ],
  "is_key": true,
  "is_foreign_key": false,
  "is_searchable": true,
  "is_filterable": true,
  "synonyms": ["mã nhà cung cấp", "supplier code"]
},
{
  "column_name": "supplier_name",
  "table_name": "suppliers",
  "business_name": "Tên nhà cung cấp",
  "description": "Tên gọi chính thức của công ty cung cấp",
  "data_type": "varchar",
  "example_value": "Công ty TNHH ABC",
  "business_rules": [
    "Không được để trống",
    "Độ dài từ 5 đến 255 ký tự"
  ],
  "is_key": false,
  "is_foreign_key": false,
  "is_searchable": true,
  "is_filterable": false,
  "synonyms": ["tên nhà cung cấp", "supplier name", "công ty"]
},
{
  "column_name": "cost_per_unit",
  "table_name": "suppliers",
  "business_name": "Giá cung cấp",
  "description": "Giá mua mỗi đơn vị hàng từ nhà cung cấp này",
  "data_type": "decimal",
  "example_value": "50000.00",
  "business_rules": [
    "Phải là số dương",
    "Có 2 chữ số phần thập phân (VND)"
  ],
  "is_key": false,
  "is_foreign_key": false,
  "is_searchable": true,
  "is_filterable": true,
  "synonyms": ["giá cung cấp", "đơn giá", "cost", "unit price"]
},
{
  "column_name": "is_active",
  "table_name": "suppliers",
  "business_name": "Hoạt động",
  "description": "Nhà cung cấp có đang hoạt động kinh doanh không",
  "data_type": "bit",
  "example_value": "1",
  "business_rules": [
    "1 = hoạt động",
    "0 = dừng hoạt động"
  ],
  "is_key": false,
  "is_foreign_key": false,
  "is_searchable": false,
  "is_filterable": true,
  "synonyms": ["hoạt động", "active", "status"]
}
```

### Key Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `column_name` | **Required** - Exact SQL column name | `supplier_id` |
| `table_name` | **Required** - Parent table name | `suppliers` |
| `business_name` | **Required** - Vietnamese column name | `Mã nhà cung cấp` |
| `description` | **Required** - What this column contains | `Mã định danh duy nhất...` |
| `data_type` | **Required** - SQL data type | `integer`, `varchar`, `decimal`, `bit`, `date`, `datetime` |
| `is_key` | **Required** - Is this the PRIMARY KEY? | `true` / `false` |
| `is_foreign_key` | **Required** - Is this a FOREIGN KEY? | `true` / `false` |
| `is_searchable` | **Required** - Can users search/filter on this? | `true` for user-facing fields |
| `is_filterable` | **Required** - Include in WHERE clause? | `true` for dimensions & filters |
| `synonyms` | Optional - Alternative names | `["mã", "code"]` |
| `example_value` | Optional - Sample value for documentation | `10001` |
| `business_rules` | Optional - Data validation rules | `["Phải là số dương"]` |

### Best Practices

✅ Mark `is_searchable=true` for columns users ask about
✅ Mark `is_filterable=true` for dimension/filter columns
✅ Include full business rules for numeric/date columns
✅ Add Vietnamese and English synonyms
✅ Use consistent data_type naming (SQL Server convention)

---

## 3. Adding Relationships

### Scenario: Connect orders to the new suppliers table

**File**: `metadata/relationships.json`

```json
{
  "relationships": [
    {
      "from_table": "orders",
      "from_column": "supplier_id",
      "to_table": "suppliers",
      "to_column": "supplier_id",
      "type": "fk",
      "cardinality": "N:1",
      "weight": 1.0,
      "description": "Each order comes from one supplier"
    },
    {
      "from_table": "purchase_orders",
      "from_column": "supplier_id",
      "to_table": "suppliers",
      "to_column": "supplier_id",
      "type": "fk",
      "cardinality": "N:1",
      "weight": 1.0,
      "description": "Purchase orders are from suppliers"
    }
  ]
}
```

### Relationship Types

**Foreign Key (FK)** - Hard constraint, always use INNER JOIN
```json
{
  "type": "fk",
  "cardinality": "N:1",
  "weight": 1.0,
  "description": "Enforced database constraint"
}
```

**Business Relationship** - Semantic connection, uses LEFT JOIN
```json
{
  "type": "business",
  "cardinality": "1:N",
  "weight": 0.7,
  "description": "Suppliers may have associated products"
}
```

### Cardinality Types

| Type | Meaning | Example |
|------|---------|---------|
| `N:1` | Many-to-One | Many orders → One customer |
| `1:N` | One-to-Many | One department → Many employees |
| `1:1` | One-to-One | One employee → One office |
| `N:N` | Many-to-Many | Many students → Many courses |

### Weight (0.0 to 1.0)

- **1.0** = Strong relationship (use immediately)
- **0.7-0.9** = Moderate (include if expanding)
- **0.5** = Weak (only if needed)
- **0.0-0.4** = Very weak (rarely use)

### Best Practices

✅ Always specify `cardinality` - helps with JOIN selection
✅ Set weight=1.0 for FK relationships (they're enforced)
✅ Use weight < 1.0 for business relationships (conditional)
✅ Include descriptive text explaining the relationship

---

## 4. Adding Metrics

### Scenario: Add a "Cost of Supply" metric

**File**: `metadata/metrics.json`

```json
{
  "metrics": [
    {
      "id": "cost_of_supply",
      "name": "Cost of Supply",
      "business_name": "Chi phí cung cấp",
      "description": "Tổng chi phí mua hàng từ các nhà cung cấp",
      "formula": "SUM(po.quantity * s.cost_per_unit)",
      "tables": ["purchase_orders", "suppliers"],
      "data_type": "currency",
      "unit": "VND",
      "conditions": [
        "po.status IN ('confirmed', 'received')"
      ],
      "related_dimensions": [
        "supplier_id",
        "product_id",
        "purchase_month"
      ],
      "examples": [
        {
          "question": "Chi phí cung cấp hôm nay?",
          "expected_metric_value": "120,000,000"
        },
        {
          "question": "Nhà cung cấp nào tốn chi phí nhất?",
          "expected_metric_value": "Breakdown by supplier"
        }
      ]
    },
    {
      "id": "supplier_lead_time_days",
      "name": "Supplier Lead Time",
      "business_name": "Thời gian cung cấp",
      "description": "Số ngày trung bình từ đặt hàng đến nhận hàng",
      "formula": "AVG(DATEDIFF(day, po.order_date, po.received_date))",
      "tables": ["purchase_orders"],
      "data_type": "number",
      "unit": "Days",
      "conditions": [
        "po.status = 'received'",
        "po.received_date IS NOT NULL"
      ],
      "related_dimensions": [
        "supplier_id",
        "product_category"
      ]
    }
  ]
}
```

### Metric Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `id` | **Required** - Unique identifier (snake_case) | `cost_of_supply` |
| `name` | **Required** - English name | `Cost of Supply` |
| `business_name` | **Required** - Vietnamese name | `Chi phí cung cấp` |
| `description` | **Required** - What we're measuring | `Tổng chi phí mua hàng...` |
| `formula` | **Required** - SQL expression | `SUM(po.quantity * s.cost_per_unit)` |
| `tables` | **Required** - Required tables for this metric | `["purchase_orders", "suppliers"]` |
| `data_type` | **Required** - Result type | `currency`, `number`, `percentage`, `count` |
| `unit` | Optional - Display unit | `VND`, `Days`, `%` |
| `conditions` | Optional - WHERE conditions to apply | `["po.status = 'confirmed'"]` |
| `related_dimensions` | Optional - Suggested GROUP BY columns | `["supplier_id", "product_id"]` |
| `examples` | Optional - Example questions | `[{question, expected_value}]` |

### Formula Best Practices

✅ Use **table aliases** for clarity: `po.quantity`, `s.cost_per_unit`
✅ Aggregate functions: `SUM()`, `AVG()`, `COUNT()`, `MIN()`, `MAX()`
✅ Include **NULL handling** if needed: `ISNULL(cost, 0)`
✅ Use **DATEDIFF** for time calculations: `DATEDIFF(day, start_date, end_date)`
✅ Add parentheses for complex formulas: `(SUM(revenue) - SUM(cost)) / SUM(revenue)`

### Example Metric Types

```json
[
  {
    "id": "monthly_revenue",
    "formula": "SUM(o.total_amount)",
    "data_type": "currency",
    "unit": "VND"
  },
  {
    "id": "customer_count",
    "formula": "COUNT(DISTINCT c.customer_id)",
    "data_type": "count"
  },
  {
    "id": "profit_margin",
    "formula": "(SUM(revenue) - SUM(cost)) / SUM(revenue) * 100",
    "data_type": "percentage",
    "unit": "%"
  },
  {
    "id": "avg_order_days",
    "formula": "AVG(DATEDIFF(day, order_date, delivery_date))",
    "data_type": "number",
    "unit": "Days"
  }
]
```

---

## 5. Adding Glossary Terms

### Scenario: Add Vietnamese business terminology

**File**: `metadata/glossary.json`

```json
{
  "glossary": [
    {
      "canonical_term": "chi phí",
      "category": "cost",
      "user_terms": [
        "chi phí",
        "chi phí cung cấp",
        "chi phí mua hàng",
        "cost",
        "giá mua"
      ],
      "related_metrics": ["cost_of_supply", "cost_of_goods_sold"],
      "alternative_spellings": [
        "chi phí",
        "chiphi"
      ]
    },
    {
      "canonical_term": "thời gian cung cấp",
      "category": "time",
      "user_terms": [
        "thời gian cung cấp",
        "thời gian giao hàng",
        "lead time",
        "ngày cung cấp",
        "bao lâu"
      ],
      "related_metrics": ["supplier_lead_time_days"],
      "time_filter": "lead_time_days"
    },
    {
      "canonical_term": "tất cả nhà cung cấp",
      "category": "filter",
      "user_terms": [
        "tất cả nhà cung cấp",
        "toàn bộ nhà cung cấp",
        "mọi nhà cung cấp"
      ],
      "filter_condition": {
        "column": "is_active",
        "operator": "eq",
        "value": 1
      }
    },
    {
      "canonical_term": "nhà cung cấp hoạt động",
      "category": "filter",
      "user_terms": [
        "nhà cung cấp hoạt động",
        "nhà cung cấp đang kinh doanh",
        "active suppliers"
      ],
      "synonyms": ["nhà cung cấp", "suppliers"],
      "filter_condition": {
        "column": "is_active",
        "operator": "eq",
        "value": 1
      }
    }
  ]
}
```

### Glossary Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `canonical_term` | **Required** - Standard business term | `chi phí` |
| `category` | **Required** - Type of term | `cost`, `metric`, `filter`, `time` |
| `user_terms` | **Required** - Ways users might say this | `["chi phí", "cost"]` |
| `related_metrics` | Optional - Associated metrics | `["cost_of_supply"]` |
| `alternative_spellings` | Optional - Typos/variations | `["chiphi"]` |
| `synonyms` | Optional - Related terms | `["giá mua"]` |
| `filter_condition` | Optional - Auto-filter | `{column, operator, value}` |
| `time_filter` | Optional - Time resolution | `today`, `month`, `year` |

### Term Categories

**Cost/Financial Terms**
```json
{
  "canonical_term": "lợi nhuận",
  "category": "cost",
  "user_terms": ["lợi nhuận", "profit", "lãi"]
}
```

**Time Terms**
```json
{
  "canonical_term": "tháng này",
  "category": "time",
  "user_terms": ["tháng này", "tháng hiện tại", "this month"],
  "time_filter": "month"
}
```

**Status Terms**
```json
{
  "canonical_term": "đã xác nhận",
  "category": "status",
  "user_terms": ["đã xác nhận", "confirmed", "đã duyệt"],
  "filter_condition": {
    "column": "status",
    "operator": "eq",
    "value": "confirmed"
  }
}
```

---

## 6. Complete Example: Adding a "Warehouse" System

Here's a full example of adding warehouse management to your system:

### Step 1: Add Tables (tables.json)

```json
{
  "table_name": "warehouses",
  "business_name": "Kho hàng",
  "description": "Các kho lưu trữ hàng hóa",
  "use_cases": ["kho hàng", "tồn kho", "vị trí lưu trữ"],
  "synonyms": ["kho", "warehouse", "depot"]
},
{
  "table_name": "inventory",
  "business_name": "Tồn kho",
  "description": "Số lượng hàng tồn tại trong các kho",
  "use_cases": ["tồn kho", "hàng tồn", "số lượng", "stock"],
  "synonyms": ["tồn kho", "inventory", "stock"]
}
```

### Step 2: Add Columns (columns.json)

```json
{
  "column_name": "warehouse_id",
  "table_name": "warehouses",
  "business_name": "Mã kho",
  "data_type": "integer",
  "is_key": true,
  "is_searchable": true,
  "synonyms": ["warehouse code"]
},
{
  "column_name": "warehouse_name",
  "table_name": "warehouses",
  "business_name": "Tên kho",
  "data_type": "varchar",
  "is_searchable": true,
  "synonyms": ["warehouse name"]
},
{
  "column_name": "location",
  "table_name": "warehouses",
  "business_name": "Địa điểm",
  "data_type": "varchar",
  "is_filterable": true,
  "synonyms": ["location", "vị trí", "địa chỉ"]
},
{
  "column_name": "product_id",
  "table_name": "inventory",
  "business_name": "Mã sản phẩm",
  "data_type": "integer",
  "is_foreign_key": true,
  "is_filterable": true
},
{
  "column_name": "warehouse_id",
  "table_name": "inventory",
  "business_name": "Mã kho",
  "data_type": "integer",
  "is_foreign_key": true,
  "is_filterable": true
},
{
  "column_name": "quantity",
  "table_name": "inventory",
  "business_name": "Số lượng",
  "data_type": "integer",
  "is_searchable": true,
  "is_filterable": true,
  "synonyms": ["số lượng", "qty", "amount"]
}
```

### Step 3: Add Relationships (relationships.json)

```json
{
  "from_table": "inventory",
  "from_column": "product_id",
  "to_table": "products",
  "to_column": "product_id",
  "type": "fk",
  "cardinality": "N:1",
  "weight": 1.0
},
{
  "from_table": "inventory",
  "from_column": "warehouse_id",
  "to_table": "warehouses",
  "to_column": "warehouse_id",
  "type": "fk",
  "cardinality": "N:1",
  "weight": 1.0
}
```

### Step 4: Add Metrics (metrics.json)

```json
{
  "id": "total_inventory",
  "business_name": "Tổng tồn kho",
  "formula": "SUM(i.quantity)",
  "tables": ["inventory"],
  "data_type": "count",
  "unit": "Units",
  "related_dimensions": ["product_id", "warehouse_id"]
},
{
  "id": "inventory_by_warehouse",
  "business_name": "Tồn kho theo kho",
  "formula": "SUM(i.quantity) as total_units, COUNT(DISTINCT i.product_id) as unique_products",
  "tables": ["inventory", "warehouses"],
  "data_type": "count",
  "related_dimensions": ["warehouse_id", "warehouse_name"]
}
```

### Step 5: Add Glossary (glossary.json)

```json
{
  "canonical_term": "tồn kho",
  "category": "inventory",
  "user_terms": ["tồn kho", "inventory", "stock", "hàng tồn", "số lượng"]
},
{
  "canonical_term": "kho hàng",
  "category": "location",
  "user_terms": ["kho hàng", "kho", "warehouse", "depot"]
}
```

---

## 7. Verification Checklist

After adding new metadata, verify:

### Tables ✓
- [ ] Exact SQL table name matches schema
- [ ] Business name is in Vietnamese
- [ ] 3-5 use_cases cover common questions
- [ ] Synonyms include English variants

### Columns ✓
- [ ] Data type matches SQL Server types
- [ ] is_searchable=true for user-facing fields
- [ ] is_filterable=true for dimensions
- [ ] Column names exist in actual table

### Relationships ✓
- [ ] Both tables referenced exist in metadata
- [ ] Column names exist in respective tables
- [ ] Cardinality is logically correct
- [ ] Weight reflects relationship strength

### Metrics ✓
- [ ] Formula uses correct table aliases
- [ ] All tables in formula are listed in `tables` field
- [ ] Data type matches formula output
- [ ] Related dimensions are actual columns
- [ ] Conditions use valid syntax

### Glossary ✓
- [ ] user_terms include common variations
- [ ] canonical_term matches existing metric/table names
- [ ] Filter conditions reference valid columns
- [ ] Related metrics are actual metric IDs

---

## 8. Debugging Metadata Issues

### Metric not found by user question
1. Check glossary.json - add missing Vietnamese terms
2. Check metric.business_name - make it more descriptive
3. Check metric.tables - ensure all required tables exist
4. Add example questions to metric

### Column not being retrieved for query
1. Check columns.json - `is_searchable` should be true
2. Check synonyms - add variations users might use
3. Increase `top_k` parameter in API request (default 7)
4. Check MetadataService logs for fuzzy matching scores

### Join not working between tables
1. Check relationships.json - relationship should exist
2. Check cardinality - should match FK structure
3. Verify column names are exact (case-sensitive in metadata)
4. Check weight > 0 - ensure relationship is enabled
5. Enable debug mode to see join path resolution

### Vietnamese text not displaying
1. Ensure JSON files are saved as UTF-8 (no BOM)
2. Check business_name contains valid Vietnamese characters
3. Verify explanations are in Vietnamese (check Formatter)
4. Check LLM is configured with Vietnamese support

---

## Next Steps

- After updating metadata, no code changes needed
- Reload the application to reload metadata from files
- Test with debug mode enabled to see matching scores
- Iterate on glossary terms based on user queries

For more details on the pipeline, see [PIPELINE.md](./PIPELINE.md).
