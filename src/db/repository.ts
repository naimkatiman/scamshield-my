import type { HeatmapCell, ReportRequest, VerdictResult, WarningCardPayload } from "../types";
import { nextActionsForVerdict } from "../core/verdictRules";

interface CachedVerdictRow {
  key: string;
  verdict: "LEGIT" | "HIGH_RISK" | "UNKNOWN";
  score: number;
  reasons_json: string;
  sources_json: string;
  updated_at: string;
}

interface WarningPageRow {
  slug: string;
  created_at: string;
  verdict: "LEGIT" | "HIGH_RISK" | "UNKNOWN";
  headline: string;
  identifiers_json: string;
  reasons_json: string;
  og_image_r2_key: string;
}

interface DashboardCountRow {
  total: number;
}

interface CommunityReportListRow {
  id: number;
  created_at: string;
  platform: string;
  category: string;
  severity: string;
  status: string;
  narrative: string;
}

export interface DashboardStats {
  totalReports: number;
  openReports: number;
  warningPages: number;
  cachedVerdicts: number;
}

export interface CommunityReportListItem {
  id: number;
  createdAt: string;
  platform: string;
  category: string;
  severity: string;
  status: string;
  narrativePreview: string;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const REASON_FALLBACKS: [string, string, string] = [
  "Identity metadata unavailable.",
  "Scanner metadata unavailable.",
  "Community metadata unavailable.",
];

function padReasons(parsed: string[]): [string, string, string] {
  return [
    parsed[0] ?? REASON_FALLBACKS[0],
    parsed[1] ?? REASON_FALLBACKS[1],
    parsed[2] ?? REASON_FALLBACKS[2],
  ];
}

export interface CachedVerdictRecord {
  result: VerdictResult;
  updatedAt: string;
}

export async function getCachedVerdictRecord(db: D1Database, key: string): Promise<CachedVerdictRecord | null> {
  const row = await db.prepare("SELECT * FROM verdict_cache WHERE key = ?").bind(key).first<CachedVerdictRow>();
  if (!row) {
    return null;
  }

  return {
    result: {
      verdict: row.verdict,
      score: row.score,
      reasons: padReasons(parseJsonArray(row.reasons_json)),
      sources: parseJsonArray(row.sources_json),
      nextActions: nextActionsForVerdict(row.verdict),
    },
    updatedAt: row.updated_at,
  };
}

export async function getCachedVerdict(db: D1Database, key: string): Promise<VerdictResult | null> {
  const cached = await getCachedVerdictRecord(db, key);
  return cached?.result ?? null;
}

export async function upsertVerdictCache(
  db: D1Database,
  key: string,
  verdict: VerdictResult,
  updatedAt = new Date().toISOString(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO verdict_cache (key, verdict, score, reasons_json, sources_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         verdict = excluded.verdict,
         score = excluded.score,
         reasons_json = excluded.reasons_json,
         sources_json = excluded.sources_json,
         updated_at = excluded.updated_at`,
    )
    .bind(
      key,
      verdict.verdict,
      verdict.score,
      JSON.stringify(verdict.reasons),
      JSON.stringify(verdict.sources),
      updatedAt,
    )
    .run();
}

export async function createCommunityReport(db: D1Database, report: ReportRequest): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO community_reports
      (reporter_session, platform, category, severity, identifiers_json, narrative, evidence_r2_keys_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
    )
    .bind(
      report.reporterSession,
      report.platform,
      report.category,
      report.severity,
      JSON.stringify(report.identifiers),
      report.narrative,
      JSON.stringify(report.evidenceKeys),
    )
    .run();

  const reportId = Number(result.meta.last_row_id ?? 0);

  // Best-effort normalized identifier index for scalable match queries.
  try {
    for (const [identifierKey, identifierValue] of Object.entries(report.identifiers)) {
      const normalized = String(identifierValue ?? "").trim().toLowerCase();
      if (!normalized) continue;
      await db
        .prepare(
          `INSERT INTO community_report_identifiers
           (report_id, identifier_key, identifier_value, normalized_value)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(reportId, identifierKey, identifierValue, normalized)
        .run();
    }
  } catch {
    // Non-critical fallback while older environments roll out migrations.
  }

  // Best-effort narrative full-text index for scale.
  try {
    await db
      .prepare("INSERT INTO community_reports_fts (rowid, narrative) VALUES (?, ?)")
      .bind(reportId, report.narrative)
      .run();
  } catch {
    // Non-critical fallback while older environments roll out migrations.
  }

  await db
    .prepare(
      `INSERT INTO daily_platform_category_counts (day, platform, category, count)
       VALUES (date('now'), ?, ?, 1)
       ON CONFLICT(day, platform, category) DO UPDATE SET
         count = count + 1`,
    )
    .bind(report.platform, report.category)
    .run();

  return reportId;
}

export async function upsertPattern(
  db: D1Database,
  fingerprint: string,
  platform: string,
  category: string,
  identifiersJson: string,
): Promise<void> {
  const count7 = await db
    .prepare(
      `SELECT COUNT(*) as total
       FROM community_reports
       WHERE platform = ?
       AND category = ?
       AND identifiers_json = ?
       AND created_at >= datetime('now', '-7 day')`,
    )
    .bind(platform, category, identifiersJson)
    .first<{ total: number }>();

  const countPrev = await db
    .prepare(
      `SELECT COUNT(*) as total
       FROM community_reports
       WHERE platform = ?
       AND category = ?
       AND identifiers_json = ?
       AND created_at < datetime('now', '-7 day')
       AND created_at >= datetime('now', '-14 day')`,
    )
    .bind(platform, category, identifiersJson)
    .first<{ total: number }>();

  const count7d = Number(count7?.total ?? 0);
  const countPrev7d = Number(countPrev?.total ?? 0);
  const trend = count7d > countPrev7d ? "↑" : count7d < countPrev7d ? "↓" : "→";

  await db
    .prepare(
      `INSERT INTO patterns (fingerprint_hash, platform, category, count_7d, count_prev_7d, trend, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fingerprint_hash, platform, category) DO UPDATE SET
        count_7d = excluded.count_7d,
        count_prev_7d = excluded.count_prev_7d,
        trend = excluded.trend,
        last_seen_at = excluded.last_seen_at`,
    )
    .bind(fingerprint, platform, category, count7d, countPrev7d, trend, new Date().toISOString())
    .run();
}

export async function getCommunityMatchCount(db: D1Database, value: string): Promise<number> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 0;

  const phrase = `"${normalized.replace(/"/g, "\"\"")}"`;

  try {
    const row = await db
      .prepare(
        `SELECT COUNT(DISTINCT cr.id) as total
         FROM community_reports cr
         LEFT JOIN community_report_identifiers cri ON cri.report_id = cr.id
         LEFT JOIN community_reports_fts fts ON fts.rowid = cr.id
         WHERE cr.created_at >= datetime('now', '-7 day')
         AND (
           cri.normalized_value = ?
           OR fts.narrative MATCH ?
         )`,
      )
      .bind(normalized, phrase)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  } catch {
    // Migration-safe fallback for older deployments without FTS/index tables.
    const escaped = normalized.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const likeTerm = `%${escaped}%`;
    const row = await db
      .prepare(
        `SELECT COUNT(*) as total
         FROM community_reports
         WHERE created_at >= datetime('now', '-7 day')
         AND (
           lower(identifiers_json) LIKE ?
           OR lower(narrative) LIKE ?
         )`,
      )
      .bind(likeTerm, likeTerm)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  }
}

export async function createWarningPage(
  db: D1Database,
  slug: string,
  payload: WarningCardPayload,
  ogImageKey: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO warning_pages (slug, verdict, headline, identifiers_json, reasons_json, og_image_r2_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
        verdict = excluded.verdict,
        headline = excluded.headline,
        identifiers_json = excluded.identifiers_json,
        reasons_json = excluded.reasons_json,
        og_image_r2_key = excluded.og_image_r2_key`,
    )
    .bind(
      slug,
      payload.verdict,
      payload.headline,
      JSON.stringify(payload.identifiers),
      JSON.stringify(payload.reasons.slice(0, 3)),
      ogImageKey,
    )
    .run();
}

export async function getWarningPage(db: D1Database, slug: string): Promise<WarningPageRow | null> {
  const row = await db.prepare("SELECT * FROM warning_pages WHERE slug = ?").bind(slug).first<WarningPageRow>();
  return row ?? null;
}

export async function getHeatmapGrid(db: D1Database): Promise<HeatmapCell[]> {
  const result = await db
    .prepare(
      `SELECT
         platform,
         category,
         SUM(CASE WHEN day >= date('now', '-6 day') THEN count ELSE 0 END) AS count_7d,
         SUM(CASE WHEN day < date('now', '-6 day') AND day >= date('now', '-13 day') THEN count ELSE 0 END) AS count_prev_7d
       FROM daily_platform_category_counts
       GROUP BY platform, category
       ORDER BY count_7d DESC`,
    )
    .all<{ platform: string; category: string; count_7d: number; count_prev_7d: number }>();

  const rows = result.results ?? [];
  return rows.map((row) => ({
    platform: row.platform,
    category: row.category,
    count: Number(row.count_7d),
    trend: Number(row.count_7d) > Number(row.count_prev_7d) ? "↑" : Number(row.count_7d) < Number(row.count_prev_7d) ? "↓" : "→",
  }));
}

export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const [totalReports, openReports, warningPages, cachedVerdicts] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total FROM community_reports").first<DashboardCountRow>(),
    db.prepare("SELECT COUNT(*) as total FROM community_reports WHERE status = 'open'").first<DashboardCountRow>(),
    db.prepare("SELECT COUNT(*) as total FROM warning_pages").first<DashboardCountRow>(),
    db.prepare("SELECT COUNT(*) as total FROM verdict_cache").first<DashboardCountRow>(),
  ]);

  return {
    totalReports: Number(totalReports?.total ?? 0),
    openReports: Number(openReports?.total ?? 0),
    warningPages: Number(warningPages?.total ?? 0),
    cachedVerdicts: Number(cachedVerdicts?.total ?? 0),
  };
}

export async function getRecentReports(db: D1Database, limit = 20): Promise<CommunityReportListItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await db
    .prepare(
      `SELECT id, created_at, platform, category, severity, status, narrative
       FROM community_reports
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<CommunityReportListRow>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    createdAt: row.created_at,
    platform: row.platform,
    category: row.category,
    severity: row.severity,
    status: row.status,
    narrativePreview: row.narrative.slice(0, 120),
  }));
}

export async function rollupHeatmap(db: D1Database): Promise<void> {
  const rows = await db
    .prepare(
      `SELECT platform, category,
              SUM(CASE WHEN created_at >= datetime('now', '-7 day') THEN 1 ELSE 0 END) AS count_7d,
              SUM(CASE WHEN created_at < datetime('now', '-7 day') AND created_at >= datetime('now', '-14 day') THEN 1 ELSE 0 END) AS count_prev_7d,
              MAX(created_at) AS last_seen_at
       FROM community_reports
       GROUP BY platform, category`,
    )
    .all<{ platform: string; category: string; count_7d: number; count_prev_7d: number; last_seen_at: string }>();

  for (const row of rows.results ?? []) {
    const trend = Number(row.count_7d) > Number(row.count_prev_7d) ? "↑" : Number(row.count_7d) < Number(row.count_prev_7d) ? "↓" : "→";
    await db
      .prepare(
        `INSERT INTO patterns (fingerprint_hash, platform, category, count_7d, count_prev_7d, trend, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(fingerprint_hash, platform, category) DO UPDATE SET
          count_7d = excluded.count_7d,
          count_prev_7d = excluded.count_prev_7d,
          trend = excluded.trend,
          last_seen_at = excluded.last_seen_at`,
      )
      .bind(`platform:${row.platform}:category:${row.category}`, row.platform, row.category, row.count_7d, row.count_prev_7d, trend, row.last_seen_at)
      .run();
  }
}

export async function auditEvent(db: D1Database, eventType: string, payload: Record<string, unknown>): Promise<void> {
  await db
    .prepare("INSERT INTO audit_events (event_type, payload_json) VALUES (?, ?)")
    .bind(eventType, JSON.stringify(payload))
    .run();
}
