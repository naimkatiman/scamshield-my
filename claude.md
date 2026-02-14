# ScamShield MY - Execution Tracker (Cure-First)

Last updated: 2026-02-14 (Google Auth + Tiered Quotas + Multi-Mode Dashboards)

## Mission
Build ScamShield MY as a Scam Response Kit first, detection second.

Product promise:
"Most apps try to detect scams. We handle the part nobody solves: what to do after the scam happens - stop the bleeding, preserve evidence, generate reports, and contain the spread."

## Rule Charter (Project MUSTs)
- **Usage Tiers (Beta Phase)**: 
  - Free (Unauthenticated): 3 uses per day per IP.
  - Login (Beta User): 30 uses per day.
- **Dashboards**:
  - Client: Usage quota, personal incident history, recovery progress (Unified in /dashboard).
  - Admin: Global heatmap, user usage stats, system health (Unified in /reports + /dashboard).
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
- DONE: AI Agent interface for conversational scam assistance.
- DONE: Usage tier enforcement (3 free / 30 login) with KV + D1 tracking.
- DONE: Server-rendered Dashboard (Global telemetry + KPI).
- DONE: Server-rendered Reports list (Audit stream).

### Platform architecture
- DONE: Worker routes, D1 schema/migration, KV/R2/Queue/Cron bindings.
- DONE: Cache layering (KV hot cache + D1 persistent cache).
- DONE: Queue consumer for enrichment/card rendering + scheduled rollup.
- DONE: Rate limiting and structured logging with masking.
- DONE: Resource IDs in `wrangler.toml` updated for production readiness.
- DONE: Agent prompts professionalized for Production Scaling / National Utility phase.
- DONE: D1 Schema upgrade for `users` and `usage_logs`.
- DONE: Auth layer (Google OAuth 2.0 implementation with JWT sessions).

### Gaps blocking full rule compliance
- DONE: Queue retry accounting now uses CF-native `msg.attempts` for correct dead-letter behavior.
- DONE: Warning card R2 key supports both `.svg` and `.png`.
- DONE: Live-mode verdict path uses 1800ms provider budget for ALL foreground requests.
- DONE: nextActions logic extracted to shared `verdictRules.ts`.
- DONE: D1 cache staleness check added (>60min entries flagged for re-enrichment).
- DONE: Logger deep-masks PII in nested objects and arrays.
- DONE: Community provider LIKE wildcards (`%`, `_`) escaped.
- DONE: Warning card image route fallback content-type corrected.
- DONE: CORS middleware added for `/api/*` routes.
- DONE: `reasons_json` parsing padded to always guarantee exactly 3 elements.
- DONE: Queue consumer, Logger masking, and verdictRules tests pass.
- DONE: Deployment configuration locked with real Cloudflare resource IDs.

## Rule-to-Code Compliance Matrix

### Non-negotiable UX outputs
- One-screen verdict: DONE
  - API: `src/index.ts` (`POST /api/verdict`)
  - Scoring/reasons: `src/core/scoring.ts`
  - UI: `public/index.html`, `public/app.js`
- Shareable warning card + public page: DONE (True PNG rasterization via Browser Rendering API)
  - Routes: `src/index.ts` (`POST /api/warning-card`, `GET /w/:slug`)
  - Storage: `src/core/warningCard.ts` (PNG + SVG dual mode)
- Heatmap (platform x category + trend): DONE
  - Data: `src/db/repository.ts` (`getHeatmapGrid`, `rollupHeatmap`)
  - Route/UI: `src/index.ts` + `public/app.js`

### Cure layer MVP requirements
- Emergency Playbook (MY): DONE (`src/core/playbook.ts`, `GET /api/playbook`)
- Auto-generate reports: DONE (`src/core/reportGenerator.ts`, `POST /api/report/generate`)
- Damage control checklist + progress: DONE (`src/core/playbook.ts`, `POST /api/recovery-progress`)
- Containment via warning pages/cards: DONE

### Defensive reliability rules
- Provider timeouts + `Promise.allSettled`: DONE (`src/providers/index.ts`)
- Degraded mode returns useful output: DONE (`src/core/verdictService.ts`)
- Live-mode <2s SLO enforced: DONE (1800ms budget)
- Queue dead-letter properly tracked: DONE (`msg.attempts` in `src/index.ts`)
- Per-IP/session rate limit in KV: DONE (`src/core/rateLimit.ts`)
- Input validation and safe error messages: DONE (Zod schemas)
- CORS headers: DONE
- D1 cache staleness check: DONE
- Deep PII masking (nested objects/arrays): DONE
- SQL LIKE wildcard escape: DONE
- Shared nextActions helper: DONE
- Reasons padding: DONE
- Tests: 155 tests across 13 files — all pass

## Agent Task Board

## Agent 1 -> Rapid Scaffolding (Architecture + Boilerplate)
Status: DONE

Completed:
- Worker app scaffolded with route structure.
- `wrangler.toml` bindings set for D1/KV/R2/Queue/Cron.
- D1 migration includes required base tables plus daily rollup table.
- Core frontend pages/sections are implemented.
- **Production resource IDs provided in `wrangler.toml`.**
- **Google OAuth flow and JWT session management implemented.**

Remaining:
- None.

## Agent 2 -> Refactor + Optimize Logic
Status: DONE

Completed:
- Live provider client layer exists (CoinGecko/GoPlus/Honeypot/Chainabuse/CryptoScamDB).
- Normalization and verdict threshold logic implemented.
- KV + D1 cache layering implemented.
- Queue pipeline and scheduled heatmap rollup implemented.
- Live-mode <2s SLO enforced (1800ms provider budget).
- **True PNG rasterization for warning cards (Browser Rendering API).**
- **Usage quota tracking and enforcement (Free vs Login).**

Remaining:
- Improve provider-specific 429 handling/backoff strategy.

## Agent 3 -> UX Polish + Copywriting
Status: DONE

Completed:
- Branded, judge-friendly single-page flow.
- Strong CTA mapping from verdict to Cure actions.
- Copy buttons, tabbed report output, visual heatmap treatment.
- Malaysia-focused emergency instructions and legal-safe tone.
- **Final pass on "official enough" warning-card visual.**
- **Mobile QA checklist and spacing tweaks for small screens.**
- **Tightened unknown-state copy for better clarity.**
- **Auth UI components and quota visualization.**

Remaining:
- None.

## Agent 4 -> Edge Cases + Error Handling + Testing
Status: DONE

Completed:
- Unit tests: normalization, scoring, reason selection.
- Integration tests: provider timeouts, warning-card, heatmap.
- Validation tests: chain support, malformed inputs.
- Rate limiting tests: per-IP enforcement.
- Queue consumer tests: success, retry, dead-letter.
- Logger deep masking tests: nested objects, arrays.
- All 155 tests pass via `npm run test`.

Remaining:
- None.

## Immediate Next Sprint (Scaling + Monitoring)
1. Deploy final build to production and run smoke tests.
2. Expand Malaysia-specific playbook content with direct links to BNM/PDRM portals.
3. Implement localized Bahasa Melayu translation toggle for high-stress situations.
4. Configure Cloudflare Observability alerts for provider timeout spikes (>10% per min).

## Definition of Done Gates (Enforced)
- Verdict API returns in under 2 seconds for cached/degraded path.
- UI still works when external providers fail.
- Warning page + share card link open correctly on mobile.
- Heatmap shows non-zero data and trend arrows.
- Playbook and reports are copyable in one tap.
- Unit + integration tests exist and pass.
