# How to Test the Delivery Query Fix

**Date**: March 31, 2026  
**Status**: Logging enhancements complete ✓

---

## Overview

I've added **4 levels of detailed logging** to help diagnose the SQL generation issue:

1. **SQLGenerator** - Shows the SQL after cleaning
2. **SemanticQueryHandler** - Shows SQL before/after generation  
3. **SQLValidator** - Shows exact validation errors with reasons
4. **QueryRewriter** - Shows intent detection

---

## Step 1: Restart Backend Server

```powershell
# 1. Kill current Node process (press Ctrl+C in terminal if running)
# OR restart with ecosystem.config

cd G:\NODEJS\practice1
npm run start
# or
pm2 restart index
```

Wait for logs to show:
```
[2026-03-31T...] [INFO] [MetadataService] Metadata initialized successfully
[2026-03-31T...] [INFO] [RelationshipGraph] Graph built
[V2_API] Semantic query handler initialized
```

---

## Step 2: Run the Query in Chat UI

Open **ERPChatV2.tsx** chat interface and ask:
```
lịch sử giao hàng 2026
```

---

## Step 3: Check the Logs

Look for this sequence in Node terminal:

### A. Query Rewriting
```
[2026-03-31T...] [INFO] [QueryRewriter] Query rewritten
  Data: {
    "original": "lịch sử giao hàng 2026",
    "intents": ["list_query"],  ← Should be list_query
    "metrics": 6,                ← Number of detected metrics
    ...
  }
```

### B. Schema Retrieval
```
[2026-03-31T...] [INFO] [SemanticRetriever] Schema retrieved
  Data: {
    "tables": 2,
    "columns": 10,
    "metrics": 4,              ← Number of matched metrics
    "ms": 3
  }
```

### C. SQL Generation (NEW LOGGING)
```
[2026-03-31T...] [INFO] [SQLGenerator] Generating metric SQL
  {
    "metricsCount": 4,
    "metricIds": ["delivery_count", "delivery_quantity", ...],
    "promptLength": 2845
  }

[2026-03-31T...] [INFO] [SQLGenerator] Metric SQL generated
  {
    "sqlLength": 342,
    "sqlPreview": "SELECT ...",     ← First 200 chars of SQL
    "ms": 15000
  }

[2026-03-31T...] [INFO] [SemanticQueryHandler] SQL generated
  {
    "sql": "SELECT ...",            ← First 300 chars  
    "sqlLength": 342,
    "metricsUsed": ["delivery_count"],
    "generationMs": 15200
  }
```

### D. Validation (ENHANCED LOGGING)
```
[2026-03-31T...] [INFO] [SQLValidator] isValidSelectStatement: valid
  {
    "length": 342,
    "startsWithSelect": true,
    "startsWithWith": false
  }

OR if it fails:

[2026-03-31T...] [WARN] [SQLValidator] isValidSelectStatement: does not start with SELECT or WITH
  {
    "firstWords": "EXPLAIN WITH ..."  ← Shows what it actually starts with
  }

[2026-03-31T...] [WARN] [SQLValidator] SQL validation failed
  {
    "sqlPreview": "...",
    "errorCount": 9,
    "errors": [
      { "code": "INVALID_STATEMENT", "message": "Query must be..." },
      { "code": "...", "message": "..." }
    ]
  }
```

---

## Step 4: Analyze the Output

**Good scenario:**
- All validation passes ✓
- SQL executes and returns data

**Problem scenario:**
- Validation fails 
- Look at the **sqlPreview** field
- Look at **errorCount** and **errors** array for specific issues
- Check **firstWords** to see what LLM actually generated

---

## Example Output to Share

When you run it and get an error, please share:

```
1. The "sqlPreview" showing first 200+ chars of generated SQL
2. The "errors" array with all validation errors
3. The "firstWords" if it complains about SELECT
4. The entire log from QueryRewriter through Validator
```

---

## Common Issues and Fixes

### Issue 1: "does not start with SELECT or WITH"
**Cause**: LLM generated something else (EXPLAIN, WITH, etc.)  
**Fix**: Adjust metric prompt to be more explicit

### Issue 2: "multiple statements detected"  
**Cause**: SQL has extra semicolons or GO statements  
**Fix**: cleanSqlOutput is supposed to handle this - may need enhancement

### Issue 3: "validation passed but execution fails"
**Cause**: SQL is syntactically correct but references non-existent tables  
**Fix**: Schema definition in prompt was wrong

---

## Quick Reference: All Files Modified

| File | Change |
|------|--------|
| `sqlGenerator.ts` | Added `cleanSqlOutput()` + logging |
| `sqlValidator.ts` | Enhanced `isValidSelectStatement()` logging |
| `semanticQueryHandler.ts` | Added SQL generation/validation logging |

---

## How to Reset if Needed

If you want to revert to original version without our logging:
1. The changes are minimal and additive
2. All new logging is non-breaking
3. Can safely restart or revert any time

---

**Ready to test!** Run the query and share the logs from the validator section.
