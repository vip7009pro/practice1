# Embedding Cache Invalidation System

## Overview

When table, column, or relationship metadata changes in the Semantic Engine, the embedding cache must be invalidated to ensure semantic search queries use updated embeddings. This document describes the automatic and manual cache invalidation mechanisms.

## Problem Statement

**Before this implementation:**
- When metadata (tables, columns, relationships) was updated, the JSON files changed
- However, the embedding cache (`embeddings-cache.json`) still contained old embeddings
- Semantic search queries would use stale embeddings → **Incorrect results**

**Example Scenario:**
```
1. User changes table name: "DONHANG" → "DON_HANG"
2. Backend saves to tables.json ✓
3. Embedding cache still has: { "donhang": [0.047, 0.029, ...] }
4. Query matches against stale embedding → WRONG RESULTS ❌
```

## Solution: Dual Strategy

### 1. **Automatic Cache Invalidation** ✅

When metadata is saved, cache is automatically cleared:

#### Implementation Points:

**Backend: `routes/ai.js`**
```typescript
// POST /v2/metadata/tables
fs.writeFileSync(tablesFile, ...);
global.semanticQueryHandler.clearEmbeddingCache(); // ← AUTO CLEAR

// POST /v2/metadata/columns
fs.writeFileSync(columnsFile, ...);
global.semanticQueryHandler.clearEmbeddingCache(); // ← AUTO CLEAR

// POST /v2/metadata/relationships
fs.writeFileSync(relFile, ...);
global.semanticQueryHandler.clearEmbeddingCache(); // ← AUTO CLEAR
```

**Backend Chain:**
1. SemanticQueryHandler.clearEmbeddingCache()
   ↓
2. SemanticRetriever.clearEmbeddingCache()
   ↓
3. EmbeddingService.clearCache()
   ↓
4. Cache cleared from memory (will rebuild on next query)

### 2. **Manual Cache Invalidation** ✅

Users can manually force cache clear via UI button:

#### New Endpoint:

**POST `/ai/v2/cache/clear`**

```javascript
Response (success):
{
  "tk_status": "OK",
  "data": {
    "message": "Embedding cache cleared successfully",
    "cached_entries": 0,
    "cleared_at": "2026-04-01T12:34:56Z",
    "execution_time_ms": 45
  }
}
```

#### Frontend Implementation:

**SemanticEngineManagerEnhanced.tsx:**
- New handler: `handleClearEmbeddingCache()`
- New UI section: "Embedding Cache Management"
- Button color: Warning (yellow/orange)
- Triggered manually by user

## File Changes

### Backend Files

**1. `semantic-query-engine/handlers/semanticQueryHandler.ts`**
- Added: `public clearEmbeddingCache(): void`
- Delegates to SemanticRetriever.clearEmbeddingCache()

**2. `semantic-query-engine/core/semanticRetriever.ts`**
- Added: `public clearEmbeddingCache(): void`
- Delegates to EmbeddingService.clearCache()

**3. `routes/ai.js`**
- Modified: POST `/v2/metadata/tables` → Added cache clear
- Modified: POST `/v2/metadata/columns` → Added cache clear
- Modified: POST `/v2/metadata/relationships` → Added cache clear
- Added: POST `/v2/cache/clear` → Manual invalidation endpoint

### Frontend Files

**1. `src/api/V2Api.ts`**
- Added: `async clearEmbeddingCache(): Promise<any>`
- Calls: POST `/v2/cache/clear`

**2. `src/components/SemanticEngineManagerEnhanced.tsx`**
- Added: `handleClearEmbeddingCache()` handler
- Added: UI section for cache management
- Added: "Clear Cache" button in Metadata Management tab

## User Workflow

### Automatic Flow:
1. User updates table/column/relationship metadata
2. Frontend sends POST to `/v2/metadata/tables` (or columns/relationships)
3. Backend saves metadata file
4. Backend automatically calls `clearEmbeddingCache()`
5. ✅ Cache cleared, next query will rebuild embeddings

### Manual Flow:
1. User opens "Semantic Engine Manager"
2. Goes to "Metadata Management" tab
3. Clicks "Clear Cache" button (yellow warning button)
4. Frontend calls `/v2/cache/clear` endpoint
5. Backend clears embedding cache
6. ✅ Cache cleared, semantic search uses fresh embeddings

## Cache Behavior After Clear

**Immediate after clear:**
- `embeddings-cache.json` is empty in memory
- File still exists but is not written until new embeddings are generated

**Next query:**
- Query text is embedded (cache miss)
- Table/column names are embedded (cache miss)
- Fresh embeddings generated and cached
- Results accurate with current metadata

**Cache rebuild:**
- Embeddings are recalculated progressively
- Cache saved after every 10 new embeddings (configurable)
- Performance: O(1) for cached embeddings, O(n) for new

## Logging

The system logs cache operations:

```
[V2_API] Cleared embedding cache after table metadata update
[V2_API] Cleared embedding cache after column metadata update
[V2_API] Cleared embedding cache after relationship metadata update
[V2_API] Embedding cache cleared successfully (manual)
[EmbeddingService] Cleared embedding cache
```

Monitor PM2 logs:
```bash
pm2 logs 0 --lines 50 | grep -i "cache"
```

## Testing

### Test Scenario 1: Auto Clear

1. Save a new table metadata
2. Check logs for: "Cleared embedding cache after table metadata update"
3. Query should use fresh embeddings

### Test Scenario 2: Manual Clear

1. Open Semantic Engine Manager
2. Go to "Metadata Management" tab
3. Click "Clear Cache" button
4. Check success message: "Embedding cache cleared successfully"
5. Verify next query rebuilds cache

### Test Scenario 3: Cache Effectiveness

1. Make a query (caches embeddings)
2. Make same query again (should be faster - cache hit)
3. Update metadata
4. Make same query (will be slower - cache miss, rebuilding)

## Configuration

**Cache save interval:**
- File: `semantic-query-engine/services/embeddingService.ts`
- Variable: `CACHE_SAVE_INTERVAL = 10`
- Meaning: Save cache file after every 10 new embeddings

**Edit this value to:**
- Lower (e.g., 5): More frequent disk writes, better persistence
- Higher (e.g., 50): Fewer disk writes, faster in-memory operations

## Edge Cases

### Case 1: What if metadata changes while query is running?
- Current query continues with old embeddings
- Next query uses new embeddings
- No race condition (async operations)

### Case 2: What if cache clear fails?
- Error is logged and returned to user
- Metadata still updated (separate operation)
- User can retry clear via manual button

### Case 3: What if multiple users update metadata simultaneously?
- Each update triggers independent cache clear
- Multiple clears are idempotent (safe to run multiple times)
- Last update wins (standard behavior)

## Performance Impact

**Memory:** 
- Cache cleared → ~1-2 MB freed (depends on cache size)
- Rebuilt gradually as queries arrive

**Disk I/O:**
- Auto clear: 1 log line per metadata update
- Minimal impact (~1ms)

**Semantic Search:**
- First query after clear: +100-500ms (embedding generation)
- Subsequent queries: No impact (cache hits)

## Future Enhancements

1. **Progressive cache warming:** Pre-generate embeddings for all metadata on clear
2. **Cache statistics:** Show cache hit/miss rates
3. **Scheduled clears:** Auto-clear cache on a schedule
4. **Differential updates:** Only clear embeddings for changed items
5. **Cache versioning:** Track schema version in cache metadata

## Troubleshooting

"Embeddings still seem stale after clear:"
→ Check PM2 logs for clear operation successful
→ Verify metadata was actually saved
→ Try manual clear if auto-clear failed

"Manual clear button doesn't work:"
→ Check network tab in browser DevTools
→ Verify `/v2/cache/clear` endpoint returns 200
→ Check server logs for errors

"Performance degradation after metadata update:"
→ This is expected (cache rebuilding)
→ Wait for cache to rebuild (10+ queries)
→ Or manually clear and wait for new queries

## Related Files

- Cache implementation: `semantic-query-engine/services/embeddingService.ts`
- Cache file: `semantic-query-engine/.embeddings/embeddings-cache.json`
- Metadata files:
  - `semantic-query-engine/metadata/tables.json`
  - `semantic-query-engine/metadata/columns.json`
  - `semantic-query-engine/metadata/relationships.json`
