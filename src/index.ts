import { Hono } from "hono";
import { z } from "zod";
import {
  auditEvent,
  createCommunityReport,
  createWarningPage,
  getDashboardStats,
  getHeatmapGrid,
  getRecentReports,
  getWarningPage,
  rollupHeatmap,
  upsertPattern,
} from "./db/repository";
import { checkRateLimit } from "./core/rateLimit";
import { logger } from "./core/logger";
import { KILLER_PITCH_LINE, calculateRecoveryProgress, emergencyPlaybook, recoveryTasks } from "./core/playbook";
import { recordCureAction } from "./core/observability";
import { generateIncidentReports } from "./core/reportGenerator";
import * as verdictService from "./core/verdictService";
import { renderDashboardPage, renderReportsPage } from "./server/pages";
import { generateSlug, storeWarningCard } from "./core/warningCard";
import { fingerprintFromIdentifiers, validateChain, validateInput, validateSlug } from "./core/validation";
import {
  buildSessionCookie,
  createJWT,
  DAILY_LIMIT_FREE,
  DAILY_LIMIT_LOGIN,
  exchangeGoogleCode,
  findOrCreateUser,
  getGoogleAuthURL,
  getSessionFromRequest,
  getUsageToday,
  recordUsage,
} from "./core/auth";
import type { Env, QueueMessage, ReportRequest, Session, WarningCardPayload } from "./types";

const MAX_BODY_BYTES = 65_536; // 64 KB

const app = new Hono<{ Bindings: Env }>();

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

const reportSchema = z.object({
  reporterSession: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Invalid session format."),
  platform: z.string().min(1).max(64),
  category: z.string().min(1).max(64),
  severity: z.enum(["low", "medium", "high", "critical"]),
  identifiers: boundedIdentifiers,
  narrative: z.string().min(1).max(5000),
  evidenceKeys: z.array(z.string().max(256)).max(20).default([]),
});

const reportGenerateSchema = z.object({
  incidentTitle: z.string().min(3).max(256),
  scamType: z.string().min(2).max(128),
  occurredAt: z.string().min(3).max(128),
  channel: z.string().min(2).max(128),
  suspects: z.array(z.string().max(256)).max(20).default([]),
  losses: z.string().max(128).default("Unknown"),
  actionsTaken: z.array(z.string().max(512)).max(20).default([]),
  extraNotes: boundedString(2000).optional(),
});

const warningCardSchema = z.object({
  verdict: z.enum(["LEGIT", "HIGH_RISK", "UNKNOWN"]),
  headline: z.string().min(4).max(200),
  identifiers: boundedIdentifiers,
  reasons: z.array(z.string().max(512)).min(1).max(3),
  slug: z.string().max(80).optional(),
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
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    return next();
  }

  // Handle CORS preflight
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  c.header("Access-Control-Allow-Origin", "*");
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
  const result = await checkRateLimit(c.env.RATE_LIMIT_KV, `rl:${path}:${ip}`, limit, 60);
  if (!result.allowed) {
    return jsonError("Too many requests. Please wait a minute and retry.", 429);
  }

  c.header("X-RateLimit-Remaining", result.remaining.toString());
  c.header("X-RateLimit-Reset", new Date(result.resetAt).toISOString());
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

/* ─── Auth Routes (Google OAuth) ─── */

app.get("/api/auth/login", (c) => {
  const url = getGoogleAuthURL(c.env);
  return c.redirect(url);
});

app.get("/api/auth/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return jsonError("Missing authorization code.", 400);

  const googleUser = await exchangeGoogleCode(code, c.env);
  if (!googleUser) return jsonError("Google authentication failed.", 401);

  const user = await findOrCreateUser(c.env.DB, googleUser.email);
  const session: Session = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 86400, // 24h
  };

  const token = await createJWT(session, c.env.JWT_SECRET);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app",
      "Set-Cookie": buildSessionCookie(token),
    },
  });
});

app.get("/api/auth/me", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return c.json({ authenticated: false });

  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const usedToday = await getUsageToday(c.env.DB, session.userId, ip);
  const limit = DAILY_LIMIT_LOGIN;

  return c.json({
    authenticated: true,
    email: session.email,
    role: session.role,
    usage: { used: usedToday, limit, remaining: Math.max(0, limit - usedToday) },
  });
});

app.get("/api/auth/logout", (c) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/app",
      "Set-Cookie": "scamshield_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
});

app.get("/api/quota", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const userId = session?.userId ?? null;
  const limit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
  const usedToday = await getUsageToday(c.env.DB, userId, ip);

  return c.json({
    authenticated: !!session,
    limit,
    used: usedToday,
    remaining: Math.max(0, limit - usedToday),
  });
});

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
  });
});

app.post("/api/report", async (c) => {
  const parsed = reportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid report payload.");
  }

  const normalizedIdentifiers = sortObjectEntries(parsed.data.identifiers);
  const report: ReportRequest = {
    ...parsed.data,
    identifiers: normalizedIdentifiers,
  };

  try {
    const startedAt = Date.now();
    const reportId = await createCommunityReport(c.env.DB, report);
    const fingerprint = fingerprintFromIdentifiers(normalizedIdentifiers);
    await upsertPattern(c.env.DB, fingerprint, report.platform, report.category, JSON.stringify(normalizedIdentifiers));
    await auditEvent(c.env.DB, "report_created", {
      reportId,
      platform: report.platform,
      category: report.category,
    });

    logger.info("report_created", { reportId, platform: report.platform, category: report.category });
    recordCureAction(c.env, "report_submitted", "success", Date.now() - startedAt, {
      severity: report.severity,
      platform: report.platform,
      category: report.category,
    });

    return c.json({
      id: reportId,
      status: "created",
      containmentReady: true,
      nextAction: "Generate warning card to contain spread",
    });
  } catch (error) {
    logger.error("report_db_error", { message: error instanceof Error ? error.message : "unknown" });
    recordCureAction(c.env, "report_submitted", "failed", 0, {
      endpoint: "/api/report",
    });
    return jsonError("Report submission failed. Please try again.", 503);
  }
});

app.post("/api/report/generate", async (c) => {
  const startedAt = Date.now();
  const parsed = reportGenerateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "report_generated", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/report/generate",
    });
    return jsonError("Invalid report generation payload.");
  }

  const generated = generateIncidentReports(parsed.data);
  recordCureAction(c.env, "report_generated", "success", Date.now() - startedAt, {
    endpoint: "/api/report/generate",
    suspectsCount: parsed.data.suspects.length,
    actionsCount: parsed.data.actionsTaken.length,
  });
  return c.json(generated);
});

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

    return c.json({
      slug,
      warningPageUrl: `/w/${slug}`,
      imageUrl: `/api/warning-card/image/${slug}`,
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

app.post("/api/ai/chat", async (c) => {
  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError("AI chat is not configured.", 503);
  }

  // ── Daily quota enforcement for AI chat ──
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const userId = session?.userId ?? null;
  const dailyLimit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
  const chatUsed = await getUsageToday(c.env.DB, userId, ip);
  if (chatUsed >= dailyLimit) {
    const msg = session
      ? `Daily limit of ${dailyLimit} requests reached. Resets at midnight UTC.`
      : `Free tier limit of ${dailyLimit} requests reached. Sign in for ${DAILY_LIMIT_LOGIN} daily.`;
    return jsonError(msg, 429);
  }
  await recordUsage(c.env.DB, userId, ip, "ai_chat").catch(() => { });

  const parsed = aiChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid chat payload.");
  }

  const messages = [
    { role: "system", content: AI_SYSTEM_PROMPT },
    ...parsed.data.messages,
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://scamshield-my.m-naim.workers.dev",
      "X-Title": "ScamShield MY",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview:online",
      messages,
      stream: true,
      max_tokens: 2048,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    logger.error("ai_chat_upstream_error", { status: response.status, error: errorText });
    return jsonError("AI service unavailable. Try again shortly.", 502);
  }

  // Stream the response through
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

/* ─── Dashboard APIs ─── */

app.get("/api/dashboard/client", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);

  const day = new Date().toISOString().slice(0, 10);
  const usedToday = await getUsageToday(c.env.DB, session.userId, "");
  const limit = DAILY_LIMIT_LOGIN;

  // Fetch recent usage history (last 30 entries)
  const history = await c.env.DB.prepare(
    "SELECT action, day, timestamp FROM usage_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 30"
  ).bind(session.userId).all();

  return c.json({
    email: session.email,
    role: session.role,
    quota: { used: usedToday, limit, remaining: Math.max(0, limit - usedToday), day },
    history: history.results ?? [],
  });
});

app.get("/api/dashboard/admin", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const day = new Date().toISOString().slice(0, 10);

  const [totalUsers, todayUsage, topUsers, stats, heatmap] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first<{ cnt: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as cnt FROM usage_logs WHERE day = ?").bind(day).first<{ cnt: number }>(),
    c.env.DB.prepare(
      `SELECT u.email, COUNT(l.id) as usage_count
       FROM usage_logs l JOIN users u ON l.user_id = u.id
       WHERE l.day = ? GROUP BY l.user_id ORDER BY usage_count DESC LIMIT 10`
    ).bind(day).all(),
    getDashboardStats(c.env.DB),
    getHeatmapGrid(c.env.DB),
  ]);

  return c.json({
    day,
    totalUsers: totalUsers?.cnt ?? 0,
    todayUsage: todayUsage?.cnt ?? 0,
    topUsers: topUsers.results ?? [],
    scamStats: stats,
    heatmap,
  });
});

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
