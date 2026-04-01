# Project Guidelines

## Scope
This workspace is a Node.js ERP backend with an AI semantic SQL engine.
- Backend runtime: `index.js` (Express + PM2)
- AI engine: `semantic-query-engine/` (TypeScript)
- Business logic: `services/` and `routes/`

## Build And Run
- Install: `npm install`
- Start (PM2): `npm run start`
- Stop (PM2): `npm run stop`
- Build Windows binary: `npm run build`
- Tests: no maintained npm test suite (`npm test` intentionally exits with error)

Before broad refactors, keep a reproducible PM2 run path and verify key endpoints still respond.

## Architecture Boundaries
- `routes/` should stay thin: HTTP validation, auth checks, and response shaping.
- `services/` contains domain and SQL orchestration logic.
- `config/` owns environment, DB pool, and SSL wiring.
- `semantic-query-engine/` owns query rewrite, retrieval, SQL generation/validation, and metadata merges.
- `ai/` supports embeddings/schema/vector operations used by semantic flows.

Do not move ERP domain logic into route handlers.

## Conventions
- Preserve existing response contract patterns used across APIs (for example `tk_status` style payloads where already used).
- Follow existing service naming conventions (action-oriented exported functions) unless a task asks for renaming.
- Reuse DB helpers from `config/database.js` instead of introducing parallel connection utilities.
- Keep metadata behavior safe: do not overwrite business-enriched metadata during sync unless the task explicitly requires it.

## Pitfalls
- `npm run start` uses PM2 and can leave running processes; avoid launching duplicate instances while debugging.
- Geo/IP filtering and deployment constraints can affect non-local testing paths; validate environment assumptions before concluding an endpoint is broken.
- Embedding outputs may vary by model/runtime shape; keep parsing logic defensive when touching embedding pipelines.

## Reference Docs (Link First)
- Quick usage and endpoints: `QUICK_REFERENCE.md`
- Semantic sync behavior: `SMART_SYNC_LOGIC.md`
- Deployment and validation checklist: `DEPLOYMENT_CHECKLIST.md`
- Metadata operations: `METADATA_MANAGEMENT_GUIDE.md`
- Semantic engine internals: `semantic-query-engine/README.md`, `semantic-query-engine/PIPELINE.md`, `semantic-query-engine/EXTENDING.md`
- Embedding edge cases: `EMBEDDING_ERROR_ANALYSIS.md`

Prefer linking these docs in responses instead of duplicating long explanations in chat.