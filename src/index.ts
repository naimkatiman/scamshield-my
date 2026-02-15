import { Hono } from "hono";
import { z } from "zod";
import {
  auditEvent,
  createWarningPage,
  getDashboardStats,
  getHeatmapGrid,
  getRecentReports,
  getWarningPage,
  rollupHeatmap,
} from "./db/repository";
import {
  getGamificationAdminSnapshot,
  getGamificationProfile,
  getMonthlyCompetitionOverview,
  getReferralSummary,
  listBounties,
  listBrandPartnerships,
  listCashPrizes,
  rewardWarningCardCreation,
  touchDailyStreak,
} from "./db/gamification";
import { checkRateLimit } from "./core/rateLimit";
import { logger } from "./core/logger";
import { KILLER_PITCH_LINE, calculateRecoveryProgress, emergencyPlaybook, recoveryTasks } from "./core/playbook";
import { recordCureAction } from "./core/observability";
import { renderReportPdf } from "./core/reportPdf";
import type { ReportPdfPayload } from "./core/reportPdf";
import * as verdictService from "./core/verdictService";
import { renderDashboardPage, renderReportsPage } from "./server/pages";
import { generateSlug, renderWarningCardSvg, storeWarningCard } from "./core/warningCard";
import { validateChain, validateInput, validateSlug } from "./core/validation";
import { registerAuthRoutes } from "./routes/auth";
import { registerGamificationRoutes } from "./routes/gamification";
import { registerReportingRoutes } from "./routes/reporting";
import {
  DAILY_LIMIT_FREE,
  DAILY_LIMIT_LOGIN,
  getSessionFromRequest,
  getUsageToday,
  hasSessionCookie,
  recordUsage,
  validateCsrfRequest,
  createCsrfToken,
  buildCsrfCookie,
} from "./core/auth";
import type { Env, QueueMessage, WarningCardPayload } from "./types";

const MAX_BODY_BYTES = 65_536; // 64 KB

const app = new Hono<{ Bindings: Env }>();

function parseCsvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanFlag(raw: string | undefined, fallback = false): boolean {
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function resolveCorsOrigin(env: Env, reqUrl: URL, requestOrigin: string | null): string | null {
  if (!requestOrigin) {
    return null;
  }

  const allowed = new Set(parseCsvList(env.CORS_ALLOWED_ORIGINS));
  // Same-origin is always allowed.
  allowed.add(reqUrl.origin);

  return allowed.has(requestOrigin) ? requestOrigin : null;
}

function setCorsHeaders(headers: Headers, origin: string | null): void {
  headers.set("Vary", "Origin");
  if (!origin) {
    return;
  }
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
}

function getOpenRouterModels(raw: string | undefined, fallback: readonly string[]): string[] {
  const parsed = parseCsvList(raw);
  return parsed.length > 0 ? parsed : [...fallback];
}

function isStrictAiMode(env: Env): boolean {
  return parseBooleanFlag(env.AI_STRICT_MODE, (env.PROVIDER_MODE ?? "mock") === "live");
}

function hasUsableOpenRouterKey(rawKey: string | undefined): rawKey is string {
  if (!rawKey) return false;
  const key = rawKey.trim();
  return key.length > 10 && !key.startsWith("TODO");
}

function isOpenRouterAuthFailure(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  if (status !== 502) return false;
  return body.toLowerCase().includes("authenticate") || body.toLowerCase().includes("invalid");
}

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_REFERER = "https://scamshield-my.m-naim.workers.dev";
const DEFAULT_CHAT_MODELS = [
  "google/gemini-3-flash-preview:online",
  "google/gemini-2.5-flash:online",
] as const;

const boundedString = (maxLen: number) => z.string().max(maxLen);
const boundedIdentifiers = z.record(
  z.string().max(256),
  z.string().max(256),
).refine((obj) => Object.keys(obj).length <= 10, { message: "Too many identifiers (max 10)." });

const verdictRequestSchema = z.object({
  type: z.enum(["contract", "wallet", "handle"]),
  value: z.string().min(1).max(256),
  chain: z.string().max(32).optional(),
});

const reportExportPdfSchema = z.object({
  incidentTitle: z.string().min(3).max(256),
  scamType: z.string().min(2).max(128),
  occurredAt: z.string().min(3).max(128),
  channel: z.string().min(2).max(128),
  suspects: z.array(z.string().max(256)).max(20).default([]),
  losses: z.string().max(128).default("Unknown"),
  actionsTaken: z.array(z.string().max(512)).max(20).default([]),
  extraNotes: boundedString(2000).optional(),
  severitySuggestion: z.string().max(20).default("medium"),
  forBank: z.string().min(1).max(10000),
  forPolice: z.string().min(1).max(10000),
  forPlatform: z.string().min(1).max(10000),
});

const warningCardSchema = z.object({
  verdict: z.enum(["LEGIT", "HIGH_RISK", "UNKNOWN"]),
  headline: z.string().min(4).max(200),
  identifiers: boundedIdentifiers,
  reasons: z.array(z.string().max(512)).min(1).max(3),
  slug: z.string().max(80).optional(),
});

const warningCardCustomizeSchema = z.object({
  verdict: z.enum(["LEGIT", "HIGH_RISK", "UNKNOWN"]),
  headline: z.string().min(4).max(200),
  identifiers: boundedIdentifiers,
  reasons: z.array(z.string().max(512)).min(1).max(3),
  slug: z.string().max(80).optional(),
  theme: z.enum(["auto", "danger", "caution", "safe", "neutral"]).default("auto"),
  showIdentifiers: z.boolean().default(true),
  footerText: z.string().max(200).optional(),
  language: z.enum(["en", "bm"]).default("en"),
});

const recoveryProgressSchema = z.object({
  completedTaskIds: z.array(z.string().max(64)).max(20),
});

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function enqueueWithDedupe(
  env: Env,
  dedupeKey: string,
  message: QueueMessage,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    const existing = await env.CACHE_KV.get(dedupeKey);
    if (existing) {
      return false;
    }
  } catch {
    // Fall through to best-effort queue send when KV is unavailable
  }

  await env.ENRICHMENT_QUEUE.send(message);

  try {
    await env.CACHE_KV.put(dedupeKey, "1", { expirationTtl: ttlSeconds });
  } catch {
    // Dedupe caching is best-effort
  }

  return true;
}

function sortObjectEntries(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildWarningHtml(
  appName: string,
  slug: string,
  verdict: string,
  headline: string,
  identifiers: Record<string, string>,
  reasons: string[],
): string {
  /* ── Official Warning Card Design ── */
  const cardBg = "#ffffff";
  const cardBorder = "#cbd5e1";

  // Strict colors matching styles.css
  const colors = {
    HIGH_RISK: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" }, // Red-100/600/300
    LEGIT: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },     // Green-100/700/300
    UNKNOWN: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" }    // Slate-100/600/300
  };

  const theme = colors[verdict as keyof typeof colors] || colors.UNKNOWN;
  const safeHeadline = escapeHtml(headline);
  const safeVerdict = escapeHtml(verdict);
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

  const identifierHtml = Object.entries(identifiers)
    .slice(0, 4)
    .map(([key, value]) => `
      <div class="id-row">
        <span class="id-key">${escapeHtml(key)}</span>
        <span class="id-val">${escapeHtml(value)}</span>
      </div>`).join("");

  const reasonsHtml = reasons.slice(0, 3).map((reason, i) => `
    <div class="reason">
      <span class="reason-num">${i + 1}</span>
      <span>${escapeHtml(reason)}</span>
    </div>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeHeadline} - ${escapeHtml(appName)} Warning</title>
  <meta property="og:title" content="${safeHeadline}">
  <meta property="og:description" content="Community scam warning from ScamShield MY. Verdict: ${safeVerdict}.">
  <meta property="og:image" content="/api/warning-card/image/${slug}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    /* Inlined Official Design Tokens */
    *{box-sizing:border-box}
    body {
      margin:0;
      font-family:"DM Sans",system-ui,sans-serif;
      background:#f8fafc;
      color:#0f172a;
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      padding:20px;
    }
    .card {
      background:${cardBg};
      border:1px solid ${cardBorder};
      border-radius:12px;
      box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);
      width:100%;
      max-width:600px;
      padding:32px;
      position:relative;
      overflow:hidden;
    }
    .card::before {
      content:'';
      position:absolute;
      top:0;left:0;bottom:0;width:6px;
      background:${theme.text};
    }
    .header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      margin-bottom:24px;
      padding-left:16px;
    }
    .brand {
      font-family:"Chakra Petch",monospace;
      font-weight:700;
      font-size:0.9rem;
      color:#64748b;
      text-transform:uppercase;
      letter-spacing:0.05em;
    }
    .badge {
      font-family:"Chakra Petch",monospace;
      font-weight:700;
      font-size:1.1rem;
      padding:6px 16px;
      background:${theme.bg};
      color:${theme.text};
      border-radius:4px;
      border:1px solid ${theme.border};
      text-transform:uppercase;
    }
    h1 {
      font-family:"Chakra Petch",monospace;
      font-size:1.75rem;
      font-weight:700;
      line-height:1.2;
      margin:0 0 12px;
      padding-left:16px;
    }
    .subtitle {
      color:#475569;
      font-size:1rem;
      margin:0 0 24px;
      padding-left:16px;
      line-height:1.5;
    }
    .section {
      background:#f1f5f9;
      border-radius:8px;
      padding:16px;
      margin-bottom:16px;
      margin-left:16px;
    }
    .label {
      font-size:0.75rem;
      font-weight:700;
      text-transform:uppercase;
      color:#64748b;
      margin-bottom:8px;
    }
    .id-row {
      display:flex;
      justify-content:space-between;
      padding:6px 0;
      border-bottom:1px solid #e2e8f0;
      font-size:0.9rem;
    }
    .id-row:last-child { border-bottom:none; }
    .id-key { color:#64748b; font-weight:500; }
    .id-val { font-family:monospace; color:#0f172a; font-weight:600; }
    
    .reason {
      display:flex;
      gap:12px;
      margin-bottom:8px;
      align-items:baseline;
    }
    .reason-num {
      background:#0f172a;
      color:white;
      width:20px;
      height:20px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:0.75rem;
      font-weight:700;
      flex-shrink:0;
    }
    
    .cta {
      margin-top:24px;
      padding-left:16px;
    }
    .btn {
      display:inline-block;
      background:#0f172a;
      color:white;
      padding:12px 24px;
      border-radius:6px;
      font-weight:700;
      text-decoration:none;
      font-size:0.95rem;
    }
    .footer {
      margin-top:32px;
      padding-top:16px;
      border-top:1px solid #e2e8f0;
      padding-left:16px;
      display:flex;
      justify-content:space-between;
      font-size:0.75rem;
      color:#94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">ScamShield MY // Official Warning</div>
      <div class="badge">${safeVerdict}</div>
    </div>
    
    <h1>${safeHeadline}</h1>
    <p class="subtitle">${escapeHtml(KILLER_PITCH_LINE)}</p>

    <div class="section">
      <div class="label">Target Identifier</div>
      ${identifierHtml}
    </div>

    <div class="section" style="background:white; border:1px solid #e2e8f0;">
      <div class="label">Evidence Summary</div>
      ${reasonsHtml}
    </div>

    <div class="cta">
      <a href="/" class="btn">View Full Report & Emergency Playbook</a>
    </div>

    <div class="footer">
      <span>Generated: ${timestamp}</span>
      <span>scamshield.my</span>
    </div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Middleware: CORS + rate limiting + payload size guard               */
/* ------------------------------------------------------------------ */

app.use("*", async (c, next) => {
  const reqUrl = new URL(c.req.url);
  const path = reqUrl.pathname;
  if (!path.startsWith("/api/")) {
    return next();
  }

  const requestOrigin = c.req.header("origin") ?? null;
  const allowedOrigin = resolveCorsOrigin(c.env, reqUrl, requestOrigin);

  // Handle CORS preflight
  if (c.req.method === "OPTIONS") {
    if (requestOrigin && !allowedOrigin) {
      return new Response(null, { status: 403 });
    }

    const headers = new Headers({
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
      "Access-Control-Max-Age": "86400",
    });
    setCorsHeaders(headers, allowedOrigin);

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  c.header("Vary", "Origin");
  if (allowedOrigin) {
    c.header("Access-Control-Allow-Origin", allowedOrigin);
    c.header("Access-Control-Allow-Credentials", "true");
  }
  return next();
});

app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    return next();
  }

  // Payload size guard for POST requests
  if (c.req.method === "POST") {
    const contentLength = c.req.header("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return jsonError("Request body too large (max 64 KB).", 413);
    }
  }

  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const limit = path === "/api/verdict" ? 40 : 80;
  const result = await checkRateLimit(c.env.DB, `rl:${path}:${ip}`, limit, 60);
  const resetIso = new Date(result.resetAt).toISOString();
  const remaining = Math.max(0, result.remaining);
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  if (!result.allowed) {
    const headers = new Headers({
      "Content-Type": "application/json",
      "Retry-After": retryAfter.toString(),
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": resetIso,
      Vary: "Origin",
    });

    const reqUrl = new URL(c.req.url);
    const requestOrigin = c.req.header("origin") ?? null;
    const allowedOrigin = resolveCorsOrigin(c.env, reqUrl, requestOrigin);
    setCorsHeaders(headers, allowedOrigin);

    return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and retry." }), {
      status: 429,
      headers,
    });
  }

  c.header("X-RateLimit-Limit", limit.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", resetIso);
  return next();
});

const csrfExemptApiPaths = new Set<string>([
  "/api/auth/login",
  "/api/auth/callback",
  "/api/csrf-token",
]);

app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    return next();
  }
  if (csrfExemptApiPaths.has(path)) {
    return next();
  }

  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  if (!hasSessionCookie(c.req.raw)) {
    return next();
  }

  if (!validateCsrfRequest(c.req.raw)) {
    return jsonError("CSRF validation failed.", 403);
  }

  return next();
});

/* ------------------------------------------------------------------ */
/*  Global error handler                                               */
/* ------------------------------------------------------------------ */

app.onError((err, c) => {
  logger.error("unhandled_error", {
    path: new URL(c.req.url).pathname,
    method: c.req.method,
    message: err.message,
  });
  return jsonError("Internal server error.", 500);
});

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    app: c.env.APP_NAME,
    region: c.env.REGION,
    providerMode: c.env.PROVIDER_MODE ?? "mock",
    killerPitch: KILLER_PITCH_LINE,
  });
});

// Public CSRF token endpoint - allows any user to get a CSRF token
app.get("/api/csrf-token", (c) => {
  const token = createCsrfToken();
  const cookie = buildCsrfCookie(token);
  return c.json({ token }, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
});

registerAuthRoutes(app);

app.get("/app", async (c) => {
  return c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
});

app.get("/dashboard", async (c) => {
  const [stats, heatmap] = await Promise.all([getDashboardStats(c.env.DB), getHeatmapGrid(c.env.DB)]);
  return c.html(renderDashboardPage(c.env.APP_NAME, c.env.REGION, stats, heatmap));
});

app.get("/reports", async (c) => {
  const [stats, reports] = await Promise.all([getDashboardStats(c.env.DB), getRecentReports(c.env.DB, 25)]);
  return c.html(renderReportsPage(c.env.APP_NAME, c.env.REGION, stats, reports));
});

app.get("/api/playbook", (c) => {
  const startedAt = Date.now();
  const response = {
    killerPitch: KILLER_PITCH_LINE,
    playbook: emergencyPlaybook,
    recoveryTasks,
  };

  recordCureAction(c.env, "playbook_accessed", "success", Date.now() - startedAt, {
    path: "/api/playbook",
    tasks: recoveryTasks.length,
  });

  return c.json(response);
});

app.post("/api/verdict", async (c) => {
  // ── Daily quota enforcement ──
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const userId = session?.userId ?? null;
  const dailyLimit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
  const usedToday = await getUsageToday(c.env.DB, userId, ip);
  if (usedToday >= dailyLimit) {
    const msg = session
      ? `Daily limit of ${dailyLimit} searches reached. Resets at midnight UTC.`
      : `Free tier limit of ${dailyLimit} searches reached. Sign in to get ${DAILY_LIMIT_LOGIN} daily searches.`;
    return jsonError(msg, 429);
  }

  const parsed = verdictRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid verdict payload.");
  }

  const validation = validateInput(parsed.data.type, parsed.data.value);
  if (!validation.valid) {
    return jsonError(validation.reason ?? "Invalid input format.", 422);
  }

  if (parsed.data.chain) {
    const chainCheck = validateChain(parsed.data.chain);
    if (!chainCheck.valid) {
      return jsonError(chainCheck.reason ?? "Unsupported chain.", 422);
    }
  }

  const evaluated = await verdictService.evaluateVerdict(parsed.data, c.env);

  if (evaluated.pendingEnrichment) {
    try {
      const message: QueueMessage = {
        type: "enrich_verdict",
        payload: {
          type: parsed.data.type,
          value: parsed.data.value,
          chain: parsed.data.chain,
        },
      };
      await enqueueWithDedupe(c.env, `queue:enrich:${evaluated.key}`, message, 45);
    } catch {
      logger.warn("queue_send_failed", { endpoint: "verdict" });
    }
  }

  logger.info("verdict_served", {
    inputType: parsed.data.type,
    chain: parsed.data.chain ?? "evm",
    verdict: evaluated.result.verdict,
    score: evaluated.result.score,
    cached: evaluated.cached,
    providerErrors: evaluated.providerErrors.length,
  });

  // Record usage AFTER successful verdict
  await recordUsage(c.env.DB, userId, ip, "verdict").catch(() => { });
  const streak = userId ? await touchDailyStreak(c.env.DB, userId).catch(() => null) : null;
  const gamification = userId ? await getGamificationProfile(c.env.DB, userId).catch(() => null) : null;

  return c.json({
    key: evaluated.key,
    verdict: evaluated.result.verdict,
    score: evaluated.result.score,
    reasons: evaluated.result.reasons,
    sources: evaluated.result.sources,
    nextActions: evaluated.result.nextActions,
    pendingEnrichment: evaluated.pendingEnrichment,
    providerErrors: evaluated.providerErrors,
    cached: evaluated.cached,
    timings: evaluated.timings,
    gamification: gamification
      ? {
        totalPoints: gamification.totalPoints,
        currentStreakDays: gamification.currentStreakDays,
        premiumUnlocked: gamification.premiumUnlocked,
      }
      : null,
    streak,
  });
});

registerReportingRoutes(app);

app.post("/api/recovery-progress", async (c) => {
  const startedAt = Date.now();
  const parsed = recoveryProgressSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "progress_tracked", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/recovery-progress",
    });
    return jsonError("Invalid recovery payload.");
  }

  const progress = calculateRecoveryProgress(parsed.data.completedTaskIds);
  const completed = new Set(parsed.data.completedTaskIds);

  recordCureAction(c.env, "progress_tracked", "success", Date.now() - startedAt, {
    completedTasks: parsed.data.completedTaskIds.length,
    progress,
  });

  return c.json({
    progress,
    tasks: recoveryTasks.map((task) => ({
      ...task,
      completed: completed.has(task.id),
    })),
  });
});

app.post("/api/warning-card", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const startedAt = Date.now();
  const parsed = warningCardSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "warning_card_created", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/warning-card",
    });
    return jsonError("Invalid warning card payload.");
  }

  if (parsed.data.slug) {
    const slugCheck = validateSlug(parsed.data.slug);
    if (!slugCheck.valid) {
      recordCureAction(c.env, "warning_card_created", "validation_error", Date.now() - startedAt, {
        endpoint: "/api/warning-card",
        reason: "invalid_slug",
      });
      return jsonError(slugCheck.reason ?? "Invalid slug format.", 422);
    }
  }

  const payload: WarningCardPayload = {
    verdict: parsed.data.verdict,
    headline: parsed.data.headline,
    identifiers: sortObjectEntries(parsed.data.identifiers),
    reasons: parsed.data.reasons.slice(0, 3),
  };

  const slug = parsed.data.slug ?? generateSlug(`${payload.verdict}-${payload.headline}`);

  try {
    let rewardSummary: Awaited<ReturnType<typeof rewardWarningCardCreation>> | null = null;
    const imageKey = await storeWarningCard(c.env, slug, payload);
    await createWarningPage(c.env.DB, slug, payload, imageKey);

    try {
      const queuedMessage: QueueMessage = {
        type: "render_card",
        payload: { slug, card: payload },
      };
      await enqueueWithDedupe(c.env, `queue:render:${slug}`, queuedMessage, 180);
    } catch {
      logger.warn("queue_send_failed", { endpoint: "warning-card" });
    }

    logger.info("warning_card_created", { slug, verdict: payload.verdict });
    recordCureAction(c.env, "warning_card_created", "success", Date.now() - startedAt, {
      verdict: payload.verdict,
      reasonsCount: payload.reasons.length,
    });

    if (session?.userId) {
      const idempotencyKey = c.req.header("idempotency-key") ?? c.req.header("x-idempotency-key") ?? undefined;
      rewardSummary = await rewardWarningCardCreation(
        c.env.DB,
        session.userId,
        slug,
        payload.verdict,
        undefined,
        idempotencyKey ? `warning_card:${idempotencyKey}` : undefined,
      ).catch(() => null);
    }

    return c.json({
      slug,
      warningPageUrl: `/w/${slug}`,
      imageUrl: `/api/warning-card/image/${slug}`,
      rewards: rewardSummary
        ? {
          pointsAwarded: rewardSummary.pointsAwarded + rewardSummary.streak.awardedPoints,
          warningCardPoints: rewardSummary.pointsAwarded,
          streakPoints: rewardSummary.streak.awardedPoints,
          currentStreakDays: rewardSummary.profile.currentStreakDays,
          totalPoints: rewardSummary.profile.totalPoints,
          premiumUnlocked: rewardSummary.profile.premiumUnlocked,
        }
        : null,
    });
  } catch (error) {
    logger.error("warning_card_error", { message: error instanceof Error ? error.message : "unknown" });
    recordCureAction(c.env, "warning_card_created", "failed", Date.now() - startedAt, {
      endpoint: "/api/warning-card",
    });
    return jsonError("Warning card creation failed. Please try again.", 503);
  }
});

app.get("/api/warning-card/image/:slug", async (c) => {
  const slug = c.req.param("slug");
  const warningPage = await getWarningPage(c.env.DB, slug);
  if (!warningPage) {
    return jsonError("Warning page not found.", 404);
  }

  const object = await c.env.FILES_BUCKET.get(warningPage.og_image_r2_key);
  if (!object) {
    return jsonError("Card image not found.", 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
});

/* ── PDF Export for Reports ── */

app.post("/api/report/export-pdf", async (c) => {
  const startedAt = Date.now();
  const parsed = reportExportPdfSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "report_pdf_exported", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/report/export-pdf",
    });
    return jsonError("Invalid PDF export payload.");
  }

  try {
    const pdfPayload: ReportPdfPayload = {
      incidentTitle: parsed.data.incidentTitle,
      scamType: parsed.data.scamType,
      occurredAt: parsed.data.occurredAt,
      channel: parsed.data.channel,
      suspects: parsed.data.suspects,
      losses: parsed.data.losses,
      actionsTaken: parsed.data.actionsTaken,
      severitySuggestion: parsed.data.severitySuggestion,
      forBank: parsed.data.forBank,
      forPolice: parsed.data.forPolice,
      forPlatform: parsed.data.forPlatform,
      extraNotes: parsed.data.extraNotes,
    };

    const pdf = await renderReportPdf(c.env, pdfPayload);
    const filename = `ScamShield-Report-${Date.now().toString(36)}.pdf`;

    logger.info("report_pdf_exported", { durationMs: Date.now() - startedAt, size: pdf.length });
    recordCureAction(c.env, "report_pdf_exported", "success", Date.now() - startedAt, {
      endpoint: "/api/report/export-pdf",
    });

    return new Response(pdf.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("report_pdf_error", { message: error instanceof Error ? error.message : "unknown" });
    recordCureAction(c.env, "report_pdf_exported", "failed", Date.now() - startedAt, {
      endpoint: "/api/report/export-pdf",
    });
    return jsonError("PDF generation failed. Browser Rendering may not be configured.", 503);
  }
});

/* ── Warning Card Customization ── */

app.post("/api/warning-card/customize", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const startedAt = Date.now();
  const parsed = warningCardCustomizeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "warning_card_customized", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/warning-card/customize",
    });
    return jsonError("Invalid customization payload.");
  }

  if (parsed.data.slug) {
    const slugCheck = validateSlug(parsed.data.slug);
    if (!slugCheck.valid) {
      recordCureAction(c.env, "warning_card_customized", "validation_error", Date.now() - startedAt, {
        endpoint: "/api/warning-card/customize",
        reason: "invalid_slug",
      });
      return jsonError(slugCheck.reason ?? "Invalid slug format.", 422);
    }
  }

  const { theme, showIdentifiers, footerText, language, ...cardFields } = parsed.data;

  const payload: WarningCardPayload = {
    verdict: cardFields.verdict,
    headline: cardFields.headline,
    identifiers: showIdentifiers ? sortObjectEntries(cardFields.identifiers) : {},
    reasons: cardFields.reasons.slice(0, 3),
    customization: {
      theme: theme === "auto" ? undefined : theme,
      footerText,
      language,
    },
  };

  const slug = cardFields.slug ?? generateSlug(`${payload.verdict}-${payload.headline}`);

  try {
    let rewardSummary: Awaited<ReturnType<typeof rewardWarningCardCreation>> | null = null;
    const imageKey = await storeWarningCard(c.env, slug, payload);
    await createWarningPage(c.env.DB, slug, payload, imageKey);

    logger.info("warning_card_customized", { slug, verdict: payload.verdict, theme });
    recordCureAction(c.env, "warning_card_customized", "success", Date.now() - startedAt, {
      verdict: payload.verdict,
      theme,
      language,
    });

    if (session?.userId) {
      const idempotencyKey = c.req.header("idempotency-key") ?? c.req.header("x-idempotency-key") ?? undefined;
      rewardSummary = await rewardWarningCardCreation(
        c.env.DB,
        session.userId,
        slug,
        payload.verdict,
        undefined,
        idempotencyKey ? `warning_card_custom:${idempotencyKey}` : undefined,
      ).catch(() => null);
    }

    return c.json({
      slug,
      warningPageUrl: `/w/${slug}`,
      imageUrl: `/api/warning-card/image/${slug}`,
      customization: { theme, showIdentifiers, footerText, language },
      rewards: rewardSummary
        ? {
          pointsAwarded: rewardSummary.pointsAwarded + rewardSummary.streak.awardedPoints,
          totalPoints: rewardSummary.profile.totalPoints,
        }
        : null,
    });
  } catch (error) {
    logger.error("warning_card_customize_error", { message: error instanceof Error ? error.message : "unknown" });
    recordCureAction(c.env, "warning_card_customized", "failed", Date.now() - startedAt, {
      endpoint: "/api/warning-card/customize",
    });
    return jsonError("Custom warning card creation failed.", 503);
  }
});

/* ── Warning Card SVG Preview (no storage) ── */

app.post("/api/warning-card/preview", async (c) => {
  const parsed = warningCardCustomizeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid preview payload.");
  }

  const { theme, showIdentifiers, footerText, language, ...cardFields } = parsed.data;

  const payload: WarningCardPayload = {
    verdict: cardFields.verdict,
    headline: cardFields.headline,
    identifiers: showIdentifiers ? sortObjectEntries(cardFields.identifiers) : {},
    reasons: cardFields.reasons.slice(0, 3),
    customization: {
      theme: theme === "auto" ? undefined : theme,
      footerText,
      language,
    },
  };

  const svg = renderWarningCardSvg(payload);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
});

app.get("/w/:slug", async (c) => {
  const slug = c.req.param("slug");
  const warningPage = await getWarningPage(c.env.DB, slug);
  if (!warningPage) {
    return new Response("Not found", { status: 404 });
  }

  let identifiers: Record<string, string>;
  let reasons: string[];
  try {
    identifiers = JSON.parse(warningPage.identifiers_json) as Record<string, string>;
    reasons = JSON.parse(warningPage.reasons_json) as string[];
  } catch {
    logger.error("warning_page_corrupt", { slug });
    return jsonError("Warning page data is corrupted.", 500);
  }

  const html = buildWarningHtml(c.env.APP_NAME, slug, warningPage.verdict, warningPage.headline, identifiers, reasons);
  return c.html(html);
});

app.get("/api/heatmap", async (c) => {
  const grid = await getHeatmapGrid(c.env.DB);
  return c.json({
    generatedAt: new Date().toISOString(),
    grid,
  });
});

/* ------------------------------------------------------------------ */
/*  AI Chat (OpenRouter → Gemini 3 Flash)                              */
/* ------------------------------------------------------------------ */

const AI_SYSTEM_PROMPT = `You are ScamShield MY — an AI scam-response specialist for Malaysia.
Your job: help scam victims take immediate action to stop bleeding, preserve evidence, generate reports, and contain the spread.

PERSONALITY: Calm, authoritative, empathetic but action-oriented. You speak like a crisis responder — no fluff, every sentence moves the victim forward. Use Malaysian context (MYR, local banks, NSRC 997, PDRM CCID, BNM).

CAPABILITIES YOU CAN GUIDE USERS TO (these are built into the app):
1. **Verdict Check** — Paste a wallet address, token contract, or social handle to get an instant risk score.
2. **Emergency Playbook** — Step-by-step: freeze bank, call NSRC 997, lock SIM, rotate passwords.
3. **Report Generator** — Auto-generate copy-paste reports for bank, police (PDRM), and platform.
4. **Recovery Checklist** — Track containment progress (bank freeze, revoke approvals, password rotation, SIM lock, evidence bundle, warn contacts).
5. **Warning Card** — Generate shareable warning cards to protect others in the victim's network.
6. **Scam Heatmap** — See trending scam types and platforms in Malaysia.

EMERGENCY CONTACTS:
- NSRC (National Scam Response Centre): 997
- PDRM CCID (Cyber Crime): https://semakmule.rmp.gov.my
- BNM Fraud hotline: 1-300-88-5465
- MCMC complaint: https://aduan.skmm.gov.my

CONVERSATION FLOW:
1. If user describes a scam → immediately ask what type (investment, romance, phishing, impersonation, crypto drain, job scam, etc.) and when it happened.
2. Prioritize STOP THE BLEEDING actions first (bank freeze, revoke approvals).
3. Then guide evidence collection.
4. Then reporting (bank, police, platform).
5. Suggest using the app's built-in tools (verdict check, report generator, warning card).
6. If user pastes a wallet/contract address → suggest they use the Verdict Check tool.

RULES:
- Never promise fund recovery. Say: "Recovery is not guaranteed, but fast action improves the odds."
- Always recommend calling 997 (NSRC) for bank-related scams.
- Be specific with Malaysian institutions and processes.
- Keep responses concise. Use bullet points for action items.
- If unsure, say so. Never fabricate legal advice.
- You can use markdown formatting.
- Respond in the same language the user writes in (Malay or English).`;

const aiChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(50),
});

// ── Smart Mock AI Response Generator ──
function generateMockAiResponse(messages: { role: string; content: string }[]): string {
  const userMessages = messages.filter(m => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";
  const allUserContent = userMessages.map(m => m.content.toLowerCase()).join(" ");
  const turnCount = userMessages.length;
  
  // Detect scam scenario from conversation
  const isWhatsApp = allUserContent.includes("whatsapp") || allUserContent.includes("wa ") || allUserContent.includes("whatsapp");
  const isTransferMoney = allUserContent.includes("transfer") || allUserContent.includes("bank") || allUserContent.includes("money");
  const hasSharedInfo = allUserContent.includes("yes") || allUserContent.includes("shared") || allUserContent.includes("gave");
  const hasNotSharedInfo = allUserContent.includes("no") && !allUserContent.includes("note");
  
  // First turn - ask for details
  if (turnCount === 1) {
    if (lastUserMsg.toLowerCase().includes("bank") || lastUserMsg.toLowerCase().includes("maybank") || lastUserMsg.toLowerCase().includes("cimb")) {
      return "Bank-related scams are very common in Malaysia. Here's what you should do:\n\n1. **Do NOT click any links** in suspicious messages\n2. **Call your bank directly** using the official number from their website\n3. **Check your account** through the official banking app\n4. **Report to BNM** at 1-300-88-5465 if you've shared any details\n\nWould you like me to help you identify if the message is legitimate?";
    }
    if (lastUserMsg.toLowerCase().includes("call") || lastUserMsg.toLowerCase().includes("phone")) {
      return "Phone scams often involve callers claiming to be from authorities or banks. Remember:\n\n1. **Government agencies never ask for money over the phone**\n2. **Never share OTP codes** with anyone\n3. **Hang up and verify** by calling the official number\n4. **Report to PDRM** via their hotline\n\nStay calm and don't let them pressure you into quick decisions.";
    }
    if (lastUserMsg.toLowerCase().includes("invest") || lastUserMsg.toLowerCase().includes("crypto") || lastUserMsg.toLowerCase().includes("profit")) {
      return "Investment scams promise high returns with little risk. Warning signs include:\n\n1. **Guaranteed returns** - real investments always carry risk\n2. **Pressure to act fast** - legitimate opportunities don't disappear\n3. **Unregulated platforms** - check if they're licensed by SC Malaysia\n4. **Requests for personal banking info**\n\nReport investment scams to the Securities Commission at 03-6204 8999.";
    }
    return "I'm here to help you assess potential scams. To give you the best guidance, could you tell me:\n\n1. **How were you contacted?** (call, SMS, WhatsApp, email)\n2. **What were you asked to do?** (transfer money, click a link, share info)\n3. **Did you share any personal or banking details?**\n\nThe more details you provide, the better I can assist you with next steps.";
  }
  
  // Second+ turn - provide contextual advice based on scenario
  if (isWhatsApp && isTransferMoney) {
    if (hasNotSharedInfo) {
      return "🛡️ **Good news - you're likely safe!** Since you didn't share any personal information, the scammer has limited ability to harm you.\n\n**Immediate actions:**\n1. **Block the WhatsApp number** - don't engage further\n2. **Screenshot the conversation** as evidence\n3. **Report to WhatsApp** using the \"Report\" feature\n4. **Stay vigilant** - they may try again from different numbers\n\n**⚠️ WhatsApp Scam Alert:**\nThis is a common \"parcel scam\" or \"job scam\" pattern. Scammers often:\n- Claim you won a prize or have a pending delivery\n- Ask for small payments to release larger sums\n- Use fake courier websites\n\nWould you like me to help you report this to the authorities?";
    }
    if (hasSharedInfo) {
      return "🚨 **URGENT - Take action now!**\n\nSince you've shared information, here's your action plan:\n\n**Within the next hour:**\n1. **Call your bank immediately** to freeze your account\n   - Maybank: 1-300-88-6688\n   - CIMB: 1-300-88-8228\n   - Public Bank: 1-800-88-3323\n2. **Change your online banking password** from a different device\n3. **Check for unauthorized transactions**\n\n**Report to authorities:**\n- **PDRM Cyber Crime**: https://cybersecurity.rmp.gov.my\n- **BNM Telelink**: 1-300-88-5465\n- **NPCC Scam Response**: 03-2610 1500\n\nDo you need help with any of these steps?";
    }
    return "Thank you for the details. WhatsApp scams asking for money transfers are very common in Malaysia.\n\n**Did you share any personal or banking information with them?** (yes/no)\n\nThis will help me guide you on the next steps.";
  }
  
  // Generic follow-up
  if (lastUserMsg.toLowerCase().includes("yes")) {
    return "🚨 **URGENT - Take action now!**\n\nSince you've shared information, here's your action plan:\n\n**Within the next hour:**\n1. **Call your bank immediately** to freeze your account\n2. **Change your online banking password** from a different device\n3. **Check for unauthorized transactions**\n\n**Report to authorities:**\n- **PDRM Cyber Crime**: https://cybersecurity.rmp.gov.my\n- **BNM Telelink**: 1-300-88-5465\n\nDo you need help with any of these steps?";
  }
  
  if (lastUserMsg.toLowerCase().includes("no")) {
    return "🛡️ **Good news - you're likely safe!** Since you didn't share any personal information, the scammer has limited ability to harm you.\n\n**Recommended actions:**\n1. **Block the contact** - don't engage further\n2. **Screenshot the conversation** as evidence\n3. **Report to the platform** where you were contacted\n\nWould you like me to help you report this to the authorities?";
  }
  
  return "Thank you for sharing that information. Based on what you've told me, I recommend:\n\n1. **Do not engage further** with the suspicious contact\n2. **Document everything** - take screenshots\n3. **Report to PDRM** if you've suffered any loss\n4. **Monitor your accounts** for unusual activity\n\nIs there anything specific you'd like help with?";
}

app.post("/api/ai/chat", async (c) => {
  const apiKey = hasUsableOpenRouterKey(c.env.OPENROUTER_API_KEY) ? c.env.OPENROUTER_API_KEY.trim() : null;
  const strictAiMode = isStrictAiMode(c.env);
  const parsed = aiChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid chat payload.");
  }

  // ── Mock fallback for development when API key not configured ──
  if (!apiKey) {
    if (strictAiMode) {
      return jsonError("AI service unavailable.", 503);
    }
    const mockResponse = generateMockAiResponse(parsed.data.messages);
    await new Promise(r => setTimeout(r, 500));
    return c.json({ message: mockResponse });
  }

  // ── Daily quota enforcement for AI chat ──
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const userId = session?.userId ?? null;
  const dailyLimit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
  const chatUsed = await getUsageToday(c.env.DB, userId, ip, "ai_chat");
  if (chatUsed >= dailyLimit) {
    const msg = session
      ? `Daily limit of ${dailyLimit} requests reached. Resets at midnight UTC.`
      : `Free tier limit of ${dailyLimit} requests reached. Sign in for ${DAILY_LIMIT_LOGIN} daily.`;
    return jsonError(msg, 429);
  }

  const messages = [
    { role: "system", content: AI_SYSTEM_PROMPT },
    ...parsed.data.messages,
  ];

  const models = getOpenRouterModels(c.env.OPENROUTER_CHAT_MODELS, DEFAULT_CHAT_MODELS);
  const referer = c.env.OPENROUTER_REFERER ?? DEFAULT_OPENROUTER_REFERER;

  let lastError: string | null = null;
  let lastStatus = 0;

  for (const model of models) {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "ScamShield MY",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });

    if (response.ok) {
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const message = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";
      await recordUsage(c.env.DB, userId, ip, "ai_chat").catch(() => { });
      return c.json({ message });
    }

    lastStatus = response.status;
    lastError = await response.text().catch(() => "Unknown error");
    logger.warn("ai_chat_upstream_error", { model, status: lastStatus, error: lastError });
    
    // If authentication failed, fail closed in strict mode.
    if (isOpenRouterAuthFailure(lastStatus, lastError ?? "")) {
      logger.warn("ai_chat_auth_failed", { status: lastStatus });
      if (strictAiMode) {
        return jsonError("AI provider authentication failed.", 502);
      }
      const mockResponse = generateMockAiResponse(parsed.data.messages);
      return c.json({ message: mockResponse });
    }
  }

  logger.error("ai_chat_upstream_error", { status: lastStatus, error: lastError });

  // Fall back to mock responses when all models fail and strict mode is off
  if (!strictAiMode) {
    const mockResponse = generateMockAiResponse(parsed.data.messages);
    return c.json({ message: mockResponse });
  }

  return jsonError("AI service unavailable. Try again shortly.", 502);
});

/* ─── Dashboard APIs ─── */

app.get("/api/dashboard/client", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);

  const day = new Date().toISOString().slice(0, 10);
  const usedToday = await getUsageToday(c.env.DB, session.userId, "");
  const limit = DAILY_LIMIT_LOGIN;

  const monthKey = day.slice(0, 7);

  const [history, gamification, referrals, competition, bounties, prizes] = await Promise.all([
    c.env.DB.prepare(
      "SELECT action, day, timestamp FROM usage_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 30"
    ).bind(session.userId).all(),
    getGamificationProfile(c.env.DB, session.userId),
    getReferralSummary(c.env.DB, session.userId),
    getMonthlyCompetitionOverview(c.env.DB, monthKey, 20),
    listBounties(c.env.DB, "open", 20),
    listCashPrizes(c.env.DB, { userId: session.userId, limit: 20 }),
  ]);

  return c.json({
    email: session.email,
    role: session.role,
    quota: { used: usedToday, limit, remaining: Math.max(0, limit - usedToday), day },
    history: history.results ?? [],
    gamification,
    referrals,
    competition,
    bounties,
    prizes,
  });
});

app.get("/api/dashboard/admin", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const day = new Date().toISOString().slice(0, 10);

  const [totalUsers, todayUsage, topUsers, stats, heatmap, gamificationAdmin, bounties, partnerships] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first<{ cnt: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as cnt FROM usage_logs WHERE day = ?").bind(day).first<{ cnt: number }>(),
    c.env.DB.prepare(
      `SELECT u.email, COUNT(l.id) as usage_count
       FROM usage_logs l JOIN users u ON l.user_id = u.id
       WHERE l.day = ? GROUP BY l.user_id ORDER BY usage_count DESC LIMIT 10`
    ).bind(day).all(),
    getDashboardStats(c.env.DB),
    getHeatmapGrid(c.env.DB),
    getGamificationAdminSnapshot(c.env.DB),
    listBounties(c.env.DB, "all", 20),
    listBrandPartnerships(c.env.DB, undefined, 20),
  ]);

  return c.json({
    day,
    totalUsers: totalUsers?.cnt ?? 0,
    todayUsage: todayUsage?.cnt ?? 0,
    topUsers: topUsers.results ?? [],
    scamStats: stats,
    heatmap,
    gamification: gamificationAdmin,
    bounties,
    partnerships,
  });
});

registerGamificationRoutes(app);
app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/")) {
    return jsonError("Route not found.", 404);
  }

  return c.env.ASSETS.fetch(c.req.raw);
});

/* ------------------------------------------------------------------ */
/*  Queue consumer                                                     */
/* ------------------------------------------------------------------ */

const MAX_QUEUE_RETRIES = 3;

async function processQueueMessage(env: Env, message: QueueMessage): Promise<void> {
  if (message.type === "render_card") {
    const slug = String(message.payload.slug ?? "");
    const card = message.payload.card as WarningCardPayload | undefined;
    if (!slug || !card) {
      return;
    }

    const imageKey = await storeWarningCard(env, slug, card);
    await createWarningPage(env.DB, slug, card, imageKey);
    return;
  }

  if (message.type === "enrich_verdict") {
    const type = message.payload.type;
    const value = message.payload.value;
    const chain = message.payload.chain;
    if (typeof type !== "string" || typeof value !== "string") {
      return;
    }

    const validType = type === "contract" || type === "wallet" || type === "handle";
    if (!validType) {
      return;
    }

    await verdictService.evaluateVerdict({ type, value, chain: typeof chain === "string" ? chain : undefined }, env, /* background */ true);
    return;
  }

  if (message.type === "rollup_heatmap") {
    await rollupHeatmap(env.DB);
  }
}

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const body = msg.body;
      // Use CF Queue native retry counter (auto-incremented on each msg.retry())
      const attempt = msg.attempts;

      try {
        await processQueueMessage(env, body);
        msg.ack();
        logger.info("queue_processed", { type: body.type });
      } catch (error) {
        if (attempt >= MAX_QUEUE_RETRIES) {
          logger.error("queue_dead_letter", {
            type: body.type,
            attempt: String(attempt),
            message: error instanceof Error ? error.message : "unknown",
          });
          await auditEvent(env.DB, "queue_dead_letter", {
            type: body.type,
            attempt,
            error: error instanceof Error ? error.message : "unknown",
            payload: body.payload,
          }).catch(() => { });
          msg.ack();
        } else {
          logger.warn("queue_retry", { type: body.type, attempt: String(attempt) });
          msg.retry();
        }
      }
    }
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    logger.info("cron_started", { trigger: controller.cron });
    await rollupHeatmap(env.DB);
    logger.info("cron_completed", { trigger: controller.cron });
  },
};
