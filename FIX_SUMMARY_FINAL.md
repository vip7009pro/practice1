# Complete Fix Summary - ERP Chat Delivery Query Issue

**Issue Reported**: Query "lịch sử giao hàng 2026" fails with "Query must be a single SELECT statement"

**Root Cause**: LLM generates invalid SQL (possibly with extra markup, comments, or multi-statements), but no logs showing what was actually generated

**Solution Applied**: Added 4-layer detailed logging + SQL output cleaning

---

## Modifications Made

### 1. **SQLGenerator.ts** (New Output Cleaning + Logging)

**Added `cleanSqlOutput()` method:**
```typescript
private cleanSqlOutput(rawSql: string): string {
  // Remove markdown code blocks (```sql ... ```)
  sql = sql.replace(/```(?:sql)?\s*\n?/g, '');
  
  // Remove SQL comments (-- and /* */)
  sql = sql.replace(/--.*?$/gm, '');
  sql = sql.replace(/\/\*.*?\*\//gs, '');
  
  // Remove GO statements
  sql = sql.replace(/\bGO\s*$/gmi, '');
  
  // Normalize whitespace
  sql = sql.split('\n').map(line => line.trim()).filter(...).join('\n');
  
  return sql.trim();
}
```

**Added logging for metric SQL:**
```typescript
logger.info('Generating metric SQL', {
  metricsCount: relevantMetrics.length,
  metricIds: relevantMetrics.map(m => m.id),
  promptLength: prompt.length,
});

let sqlText = await this.generateText(prompt);
sqlText = this.cleanSqlOutput(sqlText);  // ← NEW: Clean before validation

logger.info('Metric SQL generated', {
  sqlLength: sqlText.length,
  sqlPreview: sqlText.slice(0, 200),  // ← Easy to see first 200 chars
  ms: Date.now() - startTime,
});
```

---

### 2. **SQLValidator.ts** (Enhanced Validation Logging)

**Enhanced `isValidSelectStatement()` with detailed logging:**
```typescript
private isValidSelectStatement(sql: string): boolean {
  const normalized = ...
  
  if (!normalized) {
    logger.warn('isValidSelectStatement: empty after normalization');
    return false;
  }
  
  const upper = normalized.toUpperCase();
  
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    logger.warn('isValidSelectStatement: does not start with SELECT or WITH', {
      firstWords: normalized.slice(0, 50),  // ← Show what it actually starts with
    });
    return false;
  }
  
  if (statementCount > 0) {
    logger.warn('isValidSelectStatement: multiple statements detected', {
      statementCount,
      semicolonPositions: [...],  // ← Show where semicolons are
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
```

**Enhanced main validation result logging:**
```typescript
if (!ok) {
  logger.warn('SQL validation failed', {
    sqlPreview: sql.slice(0, 150),
    errorCount: errors.length,
    errors: errors.map(e => ({ code: e.code, message: e.message })),
    ms: validationMs,
  });
}
```

---

### 3. **semanticQueryHandler.ts** (Pipeline Logging)

**Added logging after SQL generation:**
```typescript
context.generated_sql = await this.sqlGenerator.generate(
  context.rewritten_query!,
  context.expanded_context!,
  joinPaths,
);

logger.info('[SemanticQueryHandler] SQL generated', {
  sql: context.generated_sql!.sql.slice(0, 300),
  sqlLength: context.generated_sql!.sql.length,
  metricsUsed: context.generated_sql!.metrics_used,
  generationMs: context.generated_sql!.generation_ms,
});

// ... validation ...

if (!context.validation_result!.ok) {
  logger.error('[SemanticQueryHandler] SQL validation failed after generation', {
    sql: context.generated_sql!.sql.slice(0, 300),
    errors: context.validation_result!.errors,
  });
}
```

---

## What You'll See in Logs Now

### Before (Unhelpful):
```
[WARN] [SQLValidator] SQL validation failed
  Data: {
    "errorCount": 9,
    "warningCount": 0,
    "ms": 1
  }
[ERROR] [SemanticQueryHandler] Query handling failed
  Error: SQL validation failed: Query must be a single SELECT statement
```

### After (Detailed):
```
[INFO] [SQLGenerator] Generating metric SQL
  { "metricsCount": 4, "metricIds": ["delivery_count", ...], ... }

[INFO] [SQLGenerator] Metric SQL generated
  { "sqlLength": 285, "sqlPreview": "SELECT COUNT(*) as...", "ms": 15000 }

[INFO] [SemanticQueryHandler] SQL generated
  { "sql": "SELECT COUNT(*) as cnt FROM dbo.ZTBDelivery ...", "sqlLength": 285, ... }

[WARN] [SQLValidator] isValidSelectStatement: does not start with SELECT or WITH
  { "firstWords": "EXPLAIN SELECT ..." }  ← ← ← Now you can see the problem!

[WARN] [SQL Validator] SQL validation failed
  { 
    "sqlPreview": "EXPLAIN SELECT COUNT(*) ...",
    "errorCount": 9,
    "errors": [
      { "code": "INVALID_STATEMENT", "message": "Query must be a single SELECT statement" },
      ...
    ]
  }

[ERROR] [SemanticQueryHandler] SQL validation failed after generation
  { "sql": "EXPLAIN SELECT ...", "errors": [...] }
```

---

## Testing Steps

1. **Restart backend:**
   ```powershell
   cd G:\NODEJS\practice1
   npm run start
   ```

2. **Run query in chat:**
   ```
   lịch sử giao hàng 2026
   ```

3. **Check Node terminal logs** for the detailed validation output

4. **Share the logs** showing:
   - What SQL was actually generated
   - What validation error occurred
   - What the first few words of the invalid SQL were

---

## Expected Outcomes

### Scenario 1: Success ✓
```
[INFO] [SQLValidator] SQL validation passed
[INFO] [Executor] Executing SQL
[INFO] [SemanticQueryHandler] Query handling completed
```
→ Query runs successfully

### Scenario 2: LLM Generated Wrong Format
```
[WARN] isValidSelectStatement: does not start with SELECT
  { "firstWords": "EXPLAIN SELECT..." }
```
→ Fix: LLM prompt adjustment

### Scenario 3: Multiple Statements
```
[WARN] isValidSelectStatement: multiple statements detected
  { "statementCount": 3, "semicolonPositions": [...] }
```
→ Fix: cleanSqlOutput needs enhancement

---

## Files Modified Summary

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `core/sqlGenerator.ts` | +40 lines | Add cleanSqlOutput() + metric SQL logging |
| `core/sqlValidator.ts` | +35 lines | Enhance validation logging detail |
| `handlers/semanticQueryHandler.ts` | +15 lines | Add pipeline logging post-generation |

**Total**: ~90 lines of diagnostic logging added

---

## Next Steps After Running

1. **If query passes**: Celebrate! ✨ The delivery metrics are now working
2. **If query fails**: Share the detailed logs showing:
   - The `sqlPreview` from failed validation
   - The `errors` array content
   - The `firstWords` if applicable
3. **Further fixes**: We can then adjust:
   - LLM prompt to generate better SQL
   - Validator rules if needed
   - Data cleaning logic

---

**Status**: ✅ Ready to test  
**Modules verified**: ✅ All TS modules load without errors  
**Test guide**: ✅ [TEST_GUIDE.md](./TEST_GUIDE.md)

**Action needed**: Restart backend and run the delivery query
