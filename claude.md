# ScamShield MY - Execution Tracker (Cure-First)

Last updated: 2026-02-14 (post-deep audit)

## Mission
Build ScamShield MY as a Scam Response Kit first, detection second.

Product promise:
"Most apps try to detect scams. We handle the part nobody solves: what to do after the scam happens - stop the bleeding, preserve evidence, generate reports, and contain the spread."

## Rule Charter (Project MUSTs)
- Cure layer must remain useful even when detection providers fail.
- Verdict response must always return a useful result (`LEGIT | HIGH_RISK | UNKNOWN`) with exactly 3 reason bullets.
- Every verdict state must provide next actions.
- Emergency Playbook, report generation, recovery checklist, warning card, and heatmap must all be accessible in the MVP.
- Provider outages/timeouts must not block core UX.
- No legal promise of fund recovery.
- Keep user-facing flow fast and resilient for demo conditions.

## Current Implementation Snapshot

### Core flows
- DONE: One-screen verdict API + UI with 3 reasons and CTA flow.
- DONE: Emergency Playbook (Malaysia-specific content) and legal line.
- DONE: Auto-generated report templates (bank/police/platform) with copy actions.
- DONE: Recovery checklist with 0-100 progress meter.
- DONE: Heatmap API and UI with trend arrows and fallback demo data.
- DONE: Public warning page route (`/w/:slug`) and warning-card generation pipeline.

### Platform architecture
- DONE: Worker routes, D1 schema/migration, KV/R2/Queue/Cron bindings.
- DONE: Cache layering (KV hot cache + D1 persistent cache).
- DONE: Queue consumer for enrichment/card rendering + scheduled rollup.
- DONE: Rate limiting and structured logging with masking.

### Gaps blocking full rule compliance
- DONE: Queue retry accounting now uses CF-native `msg.attempts` for correct dead-letter behavior.
- DONE: Warning card R2 key is `.svg` matching `image/svg+xml` content-type. True PNG rasterization is a future enhancement.
- DONE: Live-mode verdict path uses 1800ms provider budget for ALL foreground requests (including mock/demo) to enforce <2s SLO.
- DONE: nextActions logic extracted to shared `verdictRules.ts` — eliminates drift between scoring and cache hydration.
- DONE: D1 cache staleness check added — stale entries (>60min) are served but flagged for re-enrichment.
- DONE: Logger deep-masks PII in nested objects and arrays (prevents wallet/email leaks in queue audit logs).
- DONE: Community provider LIKE wildcards (`%`, `_`) escaped to prevent inflated match scores.
- DONE: Warning card image route fallback content-type corrected from `image/png` to `image/svg+xml`.
- DONE: CORS middleware added for `/api/*` routes.
- DONE: `reasons_json` parsing padded to always guarantee exactly 3 elements.
- DONE: Queue consumer tests added (8 tests covering happy path, retry, dead-letter, malformed payloads).
- DONE: Deep logger masking tests added (6 tests).
- DONE: verdictRules helper tests added (4 tests).
- DONE: Unit and integration tests exist in `test/` and pass — 155 tests across 13 files.
- TODO: Replace `TODO_DEPLOY_*` placeholder IDs in `wrangler.toml` with real Cloudflare resource IDs before production deploy.

## Rule-to-Code Compliance Matrix

### Non-negotiable UX outputs
- One-screen verdict: DONE
  - API: `src/index.ts` (`POST /api/verdict`)
  - Scoring/reasons: `src/core/scoring.ts`
  - UI: `public/index.html`, `public/app.js`
- Shareable warning card + public page: DONE (SVG; true PNG is future)
  - Routes: `src/index.ts` (`POST /api/warning-card`, `GET /w/:slug`)
  - Storage: `src/core/warningCard.ts`
- Heatmap (platform x category + trend): DONE
  - Data: `src/db/repository.ts` (`getHeatmapGrid`, `rollupHeatmap`)
  - Route/UI: `src/index.ts` + `public/app.js`

### Cure layer MVP requirements
- Emergency Playbook (MY): DONE (`src/core/playbook.ts`, `GET /api/playbook`)
- Auto-generate reports: DONE (`src/core/reportGenerator.ts`, `POST /api/report/generate`)
- Damage control checklist + progress: DONE (`src/core/playbook.ts`, `POST /api/recovery-progress`)
- Containment via warning pages/cards: DONE (SVG variant; bulletin template layer is future)

### Defensive reliability rules
- Provider timeouts + `Promise.allSettled`: DONE (`src/providers/index.ts`)
- Degraded mode returns useful output: DONE (`src/core/verdictService.ts`)
- Live-mode <2s SLO enforced: DONE (1800ms for ALL foreground requests regardless of PROVIDER_MODE)
- Queue dead-letter properly tracked: DONE (`msg.attempts` in `src/index.ts`) — tested
- Per-IP/session rate limit in KV: DONE (`src/core/rateLimit.ts`, middleware in `src/index.ts`)
- Input validation and safe error messages: DONE (`src/core/validation.ts`, Zod schemas in `src/index.ts`)
- CORS headers: DONE (middleware in `src/index.ts`)
- D1 cache staleness check: DONE (`src/core/verdictService.ts` — >60min entries flagged for re-enrichment)
- Deep PII masking (nested objects/arrays): DONE (`src/core/logger.ts`)
- SQL LIKE wildcard escape: DONE (`src/db/repository.ts`)
- Shared nextActions helper: DONE (`src/core/verdictRules.ts`)
- Reasons padding: DONE (`src/db/repository.ts` — always 3 elements)
- Tests: 155 tests across 13 files (`test/*.test.ts`) — all pass

## Agent Task Board (Updated to Current State)

## Agent 1 -> Rapid Scaffolding (Architecture + Boilerplate)
Status: DONE

Completed:
- Worker app scaffolded with route structure.
- `wrangler.toml` bindings set for D1/KV/R2/Queue/Cron.
- D1 migration includes required base tables plus daily rollup table.
- Core frontend pages/sections are implemented.
- Stray `nul` artifact removed.

Remaining:
- Replace `TODO_DEPLOY_*` placeholder IDs in `wrangler.toml` before production deploy.

Handoff output to Agent 2:
- Stable interfaces for providers/scoring/cache/queues with no breaking route changes.

## Agent 2 -> Refactor + Optimize Logic
Status: DONE

Completed:
- Live provider client layer exists (CoinGecko/GoPlus/Honeypot/Chainabuse/CryptoScamDB hooks).
- Normalization and verdict threshold logic implemented.
- KV + D1 cache layering implemented.
- Queue pipeline and scheduled heatmap rollup implemented.
- Live-mode <2s SLO enforced (1800ms provider budget + async enrichment).
- Queue retry/dead-letter uses CF-native `msg.attempts`.
- Warning card key/content-type mismatch resolved (SVG explicit).

Remaining:
- True PNG rasterization for warning cards (future enhancement).
- Improve provider-specific 429 handling/backoff strategy.

Handoff output to Agent 3:
- Stable response contracts and deterministic reason ordering.

## Agent 3 -> UX Polish + Copywriting
Status: IN PROGRESS

Completed:
- Branded, judge-friendly single-page flow.
- Strong CTA mapping from verdict to Cure actions.
- Copy buttons, tabbed report output, visual heatmap treatment.
- Malaysia-focused emergency instructions and legal-safe tone.

Remaining:
- Final pass on "official enough" warning-card visual for WhatsApp/Telegram forwarding.
- Add lightweight mobile QA checklist and spacing tweaks for small screens.
- Tighten unknown-state copy to reduce ambiguity under degraded mode.

Handoff output to Agent 4:
- Locked UX/copy strings and expected interaction behavior.

## Agent 4 -> Edge Cases + Error Handling + Testing
Status: DONE

Completed:
- Unit tests: `normalizeSignals`, `computeScore` thresholds, 3-reason bullet selection.
- Integration tests: provider timeout returns response, warning-card pipeline, heatmap trends.
- Validation tests: unsupported chain, malformed inputs, oversized payload rejection.
- Rate limiting tests: per-IP enforcement.
- Queue consumer tests: success, retry, dead-letter, malformed payload handling.
- Logger deep masking tests: nested objects, arrays, deeply nested structures.
- VerdictRules tests: nextActions mapping for all verdict states.
- All 155 tests pass via `npm run test`.

## Immediate Next Sprint (Cross-Agent)
1. Replace `TODO_DEPLOY_*` IDs in `wrangler.toml` and deploy to staging.
2. True PNG card rasterization (Browser Rendering API or resvg-wasm).
3. Agent 3 performs final mobile polish + warning-card share quality pass.
4. Run demo rehearsal with provider outage simulation (`PROVIDER_MODE=live` with failing endpoints).

## Definition of Done Gates (Enforced)
- Verdict API returns in under 2 seconds for cached/degraded path.
- UI still works when external providers fail.
- Warning page + share card link open correctly on mobile.
- Heatmap shows non-zero demo data and trend arrows.
- Playbook and reports are copyable in one tap.
- Unit + integration tests exist and pass.
