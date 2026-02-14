# ScamShield MY - Execution Tracker (Cure-First)

Last updated: 2026-02-14 (Localization + Multi-Mode Dashboards + Icon System)

## Mission
Build ScamShield MY as a Scam Response Kit first, detection second.

Product promise:
"Most apps try to detect scams. We handle the part nobody solves: what to do after the scam happens - stop the bleeding, preserve evidence, generate reports, and contain the spread."

## Rule Charter (Project MUSTs)
- **Usage Tiers (Beta Phase)**: 
  - Free (Unauthenticated): 3 uses per day per IP.
  - Login (Beta User): 30 uses per day.
- **Dashboards**:
  - Client: Usage quota, personal incident history, recovery progress ([dashboard-client.html](file:///d:/Personal/Krackathon%20Q1%202026/public/dashboard-client.html)).
  - Admin: Global heatmap, user usage stats, system health ([dashboard-admin.html](file:///d:/Personal/Krackathon%20Q1%202026/public/dashboard-admin.html)).
- **Localization**: Full support for Bahasa Melayu (BM) and English (EN) to assist victims in high-stress situations.
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
- DONE: Unified Multi-Mode Dashboards (Client & Admin views).
- DONE: Premium SVG Icon System replacement (Cohesive branding).
- DONE: Localization Layer (Bahasa Melayu & English toggle).

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
  - UI: [index.html](file:///d:/Personal/Krackathon%20Q1%202026/public/index.html), [app.js](file:///d:/Personal/Krackathon%20Q1%202026/public/app.js)
- Shareable warning card + public page: DONE (True PNG rasterization via Browser Rendering API)
- Heatmap (platform x category + trend): DONE
- Unified Dashboards: DONE
  - Client: [dashboard-client.html](file:///d:/Personal/Krackathon%20Q1%202026/public/dashboard-client.html)
  - Admin: [dashboard-admin.html](file:///d:/Personal/Krackathon%20Q1%202026/public/dashboard-admin.html)
  - Logic: [dashboard.js](file:///d:/Personal/Krackathon%20Q1%202026/public/dashboard.js)
- Localization: DONE ([locales.js](file:///d:/Personal/Krackathon%20Q1%202026/public/locales.js))

### Cure layer MVP requirements
- Emergency Playbook (MY): DONE
- Auto-generate reports: DONE
- Damage control checklist + progress: DONE
- Containment via warning pages/cards: DONE

### Defensive reliability rules
- Provider timeouts + `Promise.allSettled`: DONE
- Degraded mode returns useful output: DONE
- Live-mode <2s SLO enforced: DONE
- Queue dead-letter properly tracked: DONE
- Per-IP/session rate limit in KV: DONE
- Deep PII masking (nested objects/arrays): DONE
- SQL LIKE wildcard escape: DONE
- Tests: 188 tests passing

## Orchestration Board

### Track 01: Infrastructure & Auth (Platform Foundation)
**Status**: ACTIVE | **Primary Agent**: Agent 1 & 7
- DONE: Worker app scaffolded with route structure and D1/KV/R2/Queue/Cron bindings.
- DONE: Production resource IDs locked in `wrangler.toml`.
- DONE: Auth Layer: Google OAuth 2.0 + JWT session management.
- DONE: D1 Schema: Robust `users`, `usage_logs`, and rollup tables.
- DONE: Secure routing for unified Dashboard access.

### Track 02: Logic & Scaling (Verdict Engine)
**Status**: STABLE | **Primary Agent**: Agent 2 & 4
- DONE: Multi-Provider Client Layer (CoinGecko, GoPlus, Honeypot, etc.).
- DONE: Normalization engine and risk threshold scoring logic.
- DONE: Live-mode <2s SLO (1800ms budget) with `Promise.allSettled`.
- DONE: Usage Quota Enforcement (Free 3 / Login 30) via KV + D1.
- DONE: Full Test Suite: 188 unit/integration tests passing (`npm run test`).

### Track 03: Visuals & Experience (Digital Frontier)
**Status**: POLISHED | **Primary Agent**: Agent 3 & 5
- DONE: Cyber-Security Aesthetic: Parallax, ASCII Art, and Motion Design.
- DONE: Single-Page Verdict Flow with judge-friendly UI.
- DONE: Premium SVG Icon System (Full coherence replacement).
- DONE: Mobile-First responsiveness and interaction feedback.
- DONE: Accessibility: `prefers-reduced-motion` support.

### Track 04: Operational Readiness (Cure Layer & Global)
**Status**: DEPLOYED | **Primary Agent**: Agent 6
- DONE: Localization: Dual-language (EN/BM) support across all UI strings.
- DONE: Warning Card Pipeline: SVG + PNG rasterization via Browser Rendering API.
- DONE: Cure Layer: Emergency Playbook, Report Generation, and Recovery Checklist.
- DONE: Heatmap Engine: Global telemetry + KPI rollups.
- DONE: Logger: Deep PII masking for production safety.

## Immediate Next Sprint (Scaling + Monitoring)
1. Deploy final build to production and run smoke tests.
2. Implement PDF export for generated reports (Legal-friendly formatting).
3. Expand warning card customization (Add scammer screenshot/proof upload).
4. Configure Cloudflare Observability alerts for provider timeout spikes.

## Definition of Done Gates (Enforced)
- Verdict API returns in under 2 seconds.
- UI supports EN/BM seamlessly.
- Dashboard stats reflect real-time D1/KV data.
- Unit + integration tests exist and pass.
