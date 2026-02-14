# ScamShield MY - Execution Tracker (Cure-First)

Last updated: 2026-02-14

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
- PARTIAL: Warning card currently stored as SVG payload with `.png` key (needs true PNG output path).
- PARTIAL: Retry attempt counter in queue body is read but not incremented before retry (dead-letter threshold logic needs hardening).
- PARTIAL: `<2s` verdict target is not enforced/benchmarked in live mode.
- TODO: Unit and integration tests are missing (`npm run test` currently fails: no test files found).

## Rule-to-Code Compliance Matrix

### Non-negotiable UX outputs
- One-screen verdict: DONE
  - API: `src/index.ts` (`POST /api/verdict`)
  - Scoring/reasons: `src/core/scoring.ts`
  - UI: `public/index.html`, `public/app.js`
- Shareable warning card + public page: PARTIAL
  - Routes: `src/index.ts` (`POST /api/warning-card`, `GET /w/:slug`)
  - Storage: `src/core/warningCard.ts`
  - Pending: real PNG generation
- Heatmap (platform x category + trend): DONE
  - Data: `src/db/repository.ts` (`getHeatmapGrid`, `rollupHeatmap`)
  - Route/UI: `src/index.ts` + `public/app.js`

### Cure layer MVP requirements
- Emergency Playbook (MY): DONE (`src/core/playbook.ts`, `GET /api/playbook`)
- Auto-generate reports: DONE (`src/core/reportGenerator.ts`, `POST /api/report/generate`)
- Damage control checklist + progress: DONE (`src/core/playbook.ts`, `POST /api/recovery-progress`)
- Containment via warning pages/cards: PARTIAL (works, but needs true PNG + bulletin template layer)

### Defensive reliability rules
- Provider timeouts + `Promise.allSettled`: DONE (`src/providers/index.ts`)
- Degraded mode returns useful output: DONE (`src/core/verdictService.ts`)
- Per-IP/session rate limit in KV: DONE (`src/core/rateLimit.ts`, middleware in `src/index.ts`)
- Input validation and safe error messages: DONE (`src/core/validation.ts`, Zod schemas in `src/index.ts`)
- Tests for scoring/normalization/reason selection/timeouts/card pipeline: TODO (`test/` empty)

## Agent Task Board (Updated to Current State)

## Agent 1 -> Rapid Scaffolding (Architecture + Boilerplate)
Status: MOSTLY DONE

Completed:
- Worker app scaffolded with route structure.
- `wrangler.toml` bindings set for D1/KV/R2/Queue/Cron.
- D1 migration includes required base tables plus daily rollup table.
- Core frontend pages/sections are implemented.

Remaining:
- Replace placeholder Cloudflare IDs in `wrangler.toml` for deploy environments.
- Add production env docs (`dev`, `staging`, `prod`) with binding names.
- Remove accidental workspace artifact file `nul`.

Handoff output to Agent 2:
- Stable interfaces for providers/scoring/cache/queues with no breaking route changes.

## Agent 2 -> Refactor + Optimize Logic
Status: IN PROGRESS

Completed:
- Live provider client layer exists (CoinGecko/GoPlus/Honeypot/Chainabuse/CryptoScamDB hooks).
- Normalization and verdict threshold logic implemented.
- KV + D1 cache layering implemented.
- Queue pipeline and scheduled heatmap rollup implemented.

Remaining:
- Enforce strict `<2s` response SLO path for live mode (fast fallback + async enrichment first).
- Harden queue retry/dead-letter behavior by tracking attempts correctly.
- Improve provider-specific 429 handling/backoff strategy.
- Implement true PNG rendering for warning cards in R2.

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
Status: NOT STARTED

Priority tasks:
- Create unit tests:
  - `normalizeSignals`
  - `computeScore` thresholds
  - exactly 3 reason bullet selection
- Create integration tests (mock providers):
  - provider timeout still returns response
  - warning-card generation persists record + object key
  - heatmap trend calculations
- Validate abuse/error cases:
  - unsupported chain
  - malformed inputs
  - oversized payload rejection
  - provider 429/degraded path
- Add reliability checklist output for demo runbook.

Blocking fact:
- `npm run test` fails right now because `test/**/*.test.ts` files do not exist.

## Immediate Next Sprint (Cross-Agent)
1. Agent 4 creates baseline test suite so CI is meaningful.
2. Agent 2 finalizes queue retry hardening and true PNG card generation.
3. Agent 3 performs final mobile polish + warning-card share quality pass.
4. Run demo rehearsal with provider outage simulation (`PROVIDER_MODE=live` with failing endpoints).

## Definition of Done Gates (Enforced)
- Verdict API returns in under 2 seconds for cached/degraded path.
- UI still works when external providers fail.
- Warning page + share card link open correctly on mobile.
- Heatmap shows non-zero demo data and trend arrows.
- Playbook and reports are copyable in one tap.
- Unit + integration tests exist and pass.
