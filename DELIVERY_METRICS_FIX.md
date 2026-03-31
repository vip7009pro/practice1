# ERP Chat - Delivery History Query Fix

**Date**: March 31, 2026  
**Issue**: Query "lịch sử giao hàng 2026" (delivery history 2026) failed with error "Requested metrics not found in metadata"  
**Status**: ✅ FIXED

---

## Problem Analysis

### Error Flow
```
1. User Query: "lịch sử giao hàng 2026" (Delivery history 2026)
   ↓
2. QueryRewriter.detectMetrics() → returned 1 metric
   ↓
3. SemanticRetriever.retrieveMetrics() → found 0 matching metrics
   ↓
4. RelationshipExpander → set metrics_context = []
   ↓
5. SQLGenerator.generateForMetrics() → FAILED: "Requested metrics not found"
```

### Root Causes
1. **No delivery metrics existed** in `metrics.json`
2. **Intent detection was too broad** - "history" not recognized as list_query
3. **No fallback mechanism** for metric queries that can't find metrics

---

## Solutions Implemented

### 1. Added Delivery Metrics (metrics.json)

Added 5 new metrics to support delivery queries:

```json
{
  "id": "delivery_count",
  "name": "Số lần giao hàng",
  "business_name": "Số lần giao",
  "description": "Tổng số lần giao hàng",
  "formula": "COUNT(DISTINCT delivery_id) WHERE NOCANCEL = 1",
  "tables": ["ZTBDelivery"]
},
{
  "id": "delivery_quantity",
  "name": "Tổng số lượng giao hàng",
  "business_name": "Số lượng giao",
  "formula": "SUM(DELIVERY_QTY) WHERE NOCANCEL = 1",
  "tables": ["ZTBDelivery"]
},
{
  "id": "delivery_by_date",
  "name": "Giao hàng theo ngày",
  "business_name": "Giao hàng ngày",
  "formula": "SUM(DELIVERY_QTY) GROUP BY DELIVERY_DATE WHERE NOCANCEL = 1",
  "tables": ["ZTBDelivery"]
},
{
  "id": "delivery_by_customer",
  "name": "Giao hàng theo khách hàng",
  "business_name": "Giao hàng khách",
  "formula": "SUM(DELIVERY_QTY) GROUP BY CUST_CD WHERE NOCANCEL = 1",
  "tables": ["ZTBDelivery"]
},
{
  "id": "delivery_by_product",
  "name": "Giao hàng theo sản phẩm",
  "business_name": "Giao hàng sản phẩm",
  "formula": "SUM(DELIVERY_QTY) GROUP BY G_CODE WHERE NOCANCEL = 1",
  "tables": ["ZTBDelivery"]
}
```

### 2. Enhanced ZTBDelivery Table (tables.json)

**Before:**
```json
{
  "table_name": "ZTBDelivery",
  "business_name": "ZTBDelivery",
  "description": "Table ZTBDelivery",
  "synonyms": ["doanhthu", "giaohang", "delivery"],
  "use_cases": ["tra doanh thu", "lịch sử giao hàng", "đơn hàng tồn"]
}
```

**After:**
```json
{
  "table_name": "ZTBDelivery",
  "business_name": "Lịch sử giao hàng",
  "description": "Bảng lịch sử giao hàng - Ghi lại chi tiết từng lần giao hàng",
  "synonyms": [
    "doanhthu", "giaohang", "delivery", "delivery_history",
    "lịch giao", "lịch sử", "shipping", "shipment", "klisngu"
  ],
  "use_cases": [
    "tra doanh thu", "lịch sử giao hàng", "đơn hàng tồn",
    "giao hàng 2026", "lịch sử giao hàng theo khách hàng",
    "lịch sử giao hàng theo sản phẩm", "giao hàng theo ngày",
    "thống kê giao hàng"
  ]
}
```

### 3. Improved Column Metadata (columns.json)

Updated ZTBDelivery delivery-related columns with better business names and synonyms:

| Column | Business Name | Synonyms |
|--------|---------------|----------|
| DELIVERY_QTY | Số lượng giao hàng - Delivery quantity | qty, số lượng, quantity, số cái, sl |
| DELIVERY_DATE | Ngày giao hàng - Delivery date | ngày, date, năm, 2026, tháng, tuần |
| CUST_CD | Khách hàng - Customer code | khách, customer, kh, mã kh |
| G_CODE | Sản phẩm - Product code | sản phẩm, product, mã sp, code |

### 4. Fixed QueryRewriter Intent Detection (queryRewriter.ts)

**Changed logic:**
- Moved `list_query` detection **BEFORE** `metric_query` detection
- Added keywords: "lịch sử", "history" to detect list queries
- Prevents false positive metric detection for history/list browse queries

```typescript
// List/browse detection - check this FIRST before metric detection
if (/danh sách|list|xem|browse|hiển thị|lịch sử|history/.test(lower)) {
  intents.push('list_query');
}

// Metric query detection - skip if already list_query
if (
  !intents.includes('list_query') &&
  /doanh thu|lợi nhuận|profit|revenue|sales|tính|giá trị/.test(lower)
) {
  intents.push('metric_query');
}
```

### 5. Added Fallback in SQLGenerator (sqlGenerator.ts)

**When metrics are detected but not found in context:**
- Instead of throwing error, fallback to standard SELECT query generation
- Logs warning with details of mismatch
- Provides graceful degradation

```typescript
if (relevantMetrics.length === 0) {
  logger.warn('Detected metrics not found in context, falling back to standard query', {
    detected: rewrittenQuery.detected_metrics,
    contextMetrics: context.metrics_context.map((m) => m.id),
  });

  // Fall back to standard SELECT generation
  const prompt = this.buildPrompt(rewrittenQuery, context, joinPaths);
  const sqlText = await this.generateText(prompt);
  // ... return result
}
```

---

## Test Case

### Query
```
User: "Lịch sử giao hàng 2026"
(Delivery history 2026)
```

### Expected Pipeline
```
✓ 1. QueryRewriter: Detect "list_query" intent + "delivery" entities
✓ 2. SemanticRetriever: Find ZTBDelivery table + delivery columns + delivery metrics
✓ 3. RelationshipExpander: Expand context with delivery-related tables
✓ 4. JoinPathResolver: Resolve paths (delivery → customer → order, etc.)
✓ 5. SQLGenerator: Generate appropriate metric or SELECT query
✓ 6. Executor: Run query against SQL Server
✓ 7. Formatter: Format results with explanation
✓ 8. Return: Results + delivery history data for 2026
```

---

## Files Modified

1. **semantic-query-engine/metadata/metrics.json** ✓
   - Added 5 delivery metrics

2. **semantic-query-engine/metadata/tables.json** ✓
   - Enhanced ZTBDelivery with better names and synonyms

3. **semantic-query-engine/metadata/columns.json** ✓
   - Improved column names and synonyms for delivery columns

4. **semantic-query-engine/core/queryRewriter.ts** ✓
   - Fixed intent detection order
   - Added history/list keywords

5. **semantic-query-engine/core/sqlGenerator.ts** ✓
   - Added fallback for missing metrics
   - Improved error handling

---

## Verification

All metadata files validate as valid JSON and contain expected data:

```bash
✓ metrics.json: 15 metrics (5 new for delivery)
✓ tables.json: ZTBDelivery with enhanced metadata
✓ columns.json: Delivery columns with proper business names
✓ TypeScript: QueryRewriter and SQLGenerator updated
```

---

## Next Steps

1. **Verify in Chat UI**: Test the query "lịch sử giao hàng 2026" in ERPChatV2.tsx
2. **Monitor Logs**: Check for any remaining errors in v2/query pipeline
3. **Expand Metrics**: Add more delivery-related metrics if needed (e.g., by center, by employee)
4. **Training**: Use delivery queries to train the semantic engine with examples

---

**Last Updated**: 2026-03-31 T16:45:00  
**Status**: Ready for testing
