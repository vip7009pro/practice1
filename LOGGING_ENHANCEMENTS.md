# SQL Validation Debugging - Detailed Logging Added

**Date**: March 31, 2026  
**Issue**: Query generates invalid SQL - "Query must be a single SELECT statement"  
**Focus**: Add detailed logging to identify what SQL is actually being generated  

---

## Changes Made

### 1. **SQLGenerator.ts** - Clean LLM Output & Add Logging

Added `cleanSqlOutput()` method to:
- Remove markdown code blocks (```sql ... ```)
- Remove SQL comments (-- and /* */)
- Remove GO statements
- Normalize whitespace
- Remove trailing semicolons

Added detailed logging BEFORE validation:
```typescript
logger.info('Metric SQL generated', {
  sqlLength: sqlText.length,
  sqlPreview: sqlText.slice(0, 200),  // First 200 chars for debugging
  ms: Date.now() - startTime,
});
```

### 2. **SQLValidator.ts** - Enhanced Validation Logging

**Added detailed validation checks with logging:**
```typescript
// When validation fails
logger.warn('SQL validation failed', {
  sqlPreview: sql.slice(0, 150),
  errorCount: errors.length,
  errors: errors.map((e) => ({ code: e.code, message: e.message })),
  ms: validationMs,
});

// In isValidSelectStatement
logger.warn('isValidSelectStatement: does not start with SELECT or WITH', {
  firstWords: normalized.slice(0, 50),
});

logger.warn('isValidSelectStatement: multiple statements detected', {
  statementCount,
  semicolonPositions: [positions...],
});
```

### 3. **semanticQueryHandler.ts** - Pipeline Logging

Added logging after SQL generation:
```typescript
logger.info('[SemanticQueryHandler] SQL generated', {
  sql: context.generated_sql!.sql.slice(0, 300),
  sqlLength: context.generated_sql!.sql.length,
  metricsUsed: context.generated_sql!.metrics_used,
  generationMs: context.generated_sql!.generation_ms,
});

logger.error('[SemanticQueryHandler] SQL validation failed after generation', {
  sql: context.generated_sql!.sql.slice(0, 300),
  errors: context.validation_result!.errors,
});
```

---

## What This Will Show You

When you run the query again, the logs will show:

```
1. [SQLGenerator] Metric SQL generated
   - sqlLength: XXXX
   - sqlPreview: [First 200 chars of SQL]
   - ms: XXX
   
2. [SemanticQueryHandler] SQL generated
   - sql: [First 300 chars of generated SQL]
   - sqlLength: XXXX
   - metricsUsed: [list of metrics]

3. [SQLValidator] isValidSelectStatement: [reason for failure]
   - If doesn't start with SELECT: "firstWords: [first 50 chars]"
   - If multiple statements: "semicolonPositions: [array of positions]"
   
4. [SemanticQueryHandler] SQL validation failed
   - sql: [Full SQL that failed]
   - errors: [Array of validation errors with codes]
```

---

## Files Modified

1. **semantic-query-engine/core/sqlGenerator.ts**
   - Added `cleanSqlOutput()` method
   - Added detailed logging for metric SQL generation

2. **semantic-query-engine/core/sqlValidator.ts**
   - Enhanced `isValidSelectStatement()` with detailed logging
   - Added error details in validation warning logs

3. **semantic-query-engine/handlers/semanticQueryHandler.ts**
   - Added SQL preview logging after generation
   - Added error logging showing the invalid SQL

---

## Next Steps

1. **Rebuild/Restart** Node server
2. **Run query** "lịch sử giao hàng 2026" again
3. **Check logs** - Now you should see exactly:
   - What SQL was generated
   - Why validation failed (specific error reason)
   - The exact character positions/first words causing the issue
4. **Share logs** - Paste logs and we can see what LLM is generating

---

**Status**: Ready to test-run the delivery query with enhanced logging
