# ScamShield MY Production Resiliency Plan

Date: February 14, 2026

## Module Risk Matrix

| Module | Primary Risk | Hardening Fix | Observability Alert |
|---|---|---|---|
| Verdict provider fanout (`src/providers/*`) | Upstream 429/5xx storms, malformed payloads, and cascading latency | Added retry-with-jitter in `safeFetchJson` plus KV-backed circuit breaker (`src/providers/resilience.ts`) and per-provider outcome metrics. Unknown external provider exceptions now increment breaker failure state. | Trigger when provider error + circuit_open outcomes exceed 10% over 5 minutes |
| Verdict evaluation (`src/core/verdictService.ts`) | High-concurrency thundering herd on cache miss | Added in-flight dedupe map for foreground lookups + D1-to-KV timestamp coherence | Trigger when cache-miss ratio increases and p95 verdict latency breaches 1.8s |
| Queue enrichment dispatch (`src/index.ts`) | Duplicate enrich/render jobs during stale-cache traffic | Added KV dedupe keys before queue fanout (`enqueueWithDedupe`) | Trigger when queue retry/dead-letter events increase above baseline |
| Warning card rendering (`src/core/warningCard.ts`) | SVG-only output weak for social apps; rendering dependency failures | Added Browser Rendering PNG pipeline with strict binary validation and config-aware `auto` mode (`png` when configured, graceful SVG fallback otherwise) | Trigger when `warning_card_png_fallback` events > 2% or `warning_card_png_unconfigured` appears in production |
| Cure journey APIs (`/api/playbook`, `/api/report*`, `/api/recovery-progress`) | Missing action telemetry and weak forensic trail | Added structured `cure_action` events + Analytics Engine datapoints with masked logs | Trigger when action failure/validation-error rate spikes per endpoint |
| Platform telemetry (`wrangler.toml`) | No centralized production tracing/metrics | Enabled Workers observability sampling and Analytics Engine dataset binding | Trigger when sampled error rate > 2% or timeout rate > 10% |

## SLO Guardrails

- Verdict API target: p95 < 2 seconds with degraded-mode fallback preserved.
- Provider timeout budget: foreground 1800ms, background 4000ms.
- Circuit breaker open windows:
  - Generic provider failures: 60 seconds
  - 429/rate-limit failures: 90 seconds (or provider Retry-After, capped)

## Operational Notes

- Warning card rendering now defaults to `WARNING_CARD_RENDER_MODE = "auto"` (PNG when Browser Rendering credentials are configured, SVG otherwise).
- SVG fallback remains active to preserve availability if Browser Rendering is unavailable.
- Cure action metrics are low-cardinality by design to avoid Analytics Engine write bloat.
