# ScamShield MY Observability Dashboard Config

Date: February 14, 2026

## Runtime Config Baseline

- Worker observability is enabled in `wrangler.toml`:
  - `[observability]`
  - `enabled = true`
  - `head_sampling_rate = 0.2`
- Analytics dataset binding:
  - `[[analytics_engine_datasets]]`
  - `binding = "SCAMSHIELD_METRICS"`
  - `dataset = "scamshield_metrics"`

## Metrics Emitted

- Provider outcome metric (`src/core/observability.ts`):
  - `indexes`: `["provider", provider_name, outcome]`
  - `blobs`: `[provider_name, outcome, detail]`
  - `doubles`: `[1, latency_ms]`
- Cure action metric (`src/core/observability.ts`):
  - `indexes`: `["cure_action", action, status]`
  - `blobs`: `[action, status]`
  - `doubles`: `[1, duration_ms]`

Tracked cure actions:

- `playbook_accessed`
- `report_submitted`
- `report_generated`
- `ai_report_generated`
- `progress_tracked`
- `warning_card_created`
- `warning_card_customized`
- `report_pdf_exported`

## Dashboard Queries (Analytics Engine SQL API)

```sql
-- Provider failure and circuit-open rate (5-minute buckets)
SELECT
  intDiv(toUInt32(timestamp), 300) * 300 AS bucket_epoch,
  indexes[2] AS provider,
  indexes[3] AS outcome,
  SUM(_sample_interval) AS events,
  AVG(doubles[2]) AS avg_latency_ms
FROM scamshield_metrics
WHERE indexes[1] = 'provider'
  AND timestamp >= NOW() - INTERVAL '2' HOUR
GROUP BY bucket_epoch, provider, outcome
ORDER BY bucket_epoch DESC;
```

```sql
-- Cure action reliability
SELECT
  indexes[2] AS action,
  indexes[3] AS status,
  SUM(_sample_interval) AS events,
  AVG(doubles[2]) AS avg_duration_ms
FROM scamshield_metrics
WHERE indexes[1] = 'cure_action'
  AND timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY action, status
ORDER BY events DESC;
```

## Alert Thresholds

- Provider timeout/failure spike:
  - Alert when `(error + circuit_open) / total provider events > 0.10` in 5 minutes.
- Provider hard outage:
  - Alert when `circuit_open events > 20` for same provider in 5 minutes.
- Cure path degradation:
  - Alert when `status = failed` exceeds `2%` for any cure action in 10 minutes.
- Validation anomaly:
  - Alert when `validation_error` doubles vs prior 1-hour baseline.
- Warning card render misconfiguration:
  - Alert on any `warning_card_png_unconfigured` log event in production.

## Logpush Blueprint

- Dataset: `workers_trace_events`
- Frequency: `high`
- Scope filter: `ScriptName = "scamshield-my"`
- Destination: R2 or SIEM bucket
- Required fields:
  - `EventTimestamp`
  - `ScriptName`
  - `Outcome`
  - `Logs`
  - `Exceptions`

Template payload (Cloudflare API):

```json
{
  "name": "scamshield-workers-traces",
  "dataset": "workers_trace_events",
  "enabled": true,
  "frequency": "high",
  "destination_conf": "r2://<bucket>/<path>",
  "filter": "{\"where\":{\"and\":[{\"key\":\"ScriptName\",\"operator\":\"eq\",\"value\":\"scamshield-my\"}]}}"
}
```
