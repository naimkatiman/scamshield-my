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
import {
  applyReferralCode,
  claimBounty,
  completeBounty,
  createBounty,
  createBrandPartnership,
  createCashPrize,
  ensureGamificationProfile,
  finalizeMonthlyCompetition,
  getCompetitionMonthKey,
  getGamificationAdminSnapshot,
  getGamificationProfile,
  getLeaderboard,
  getMonthlyCompetitionOverview,
  getReferralSummary,
  grantReportSubmissionRewards,
  listBounties,
  listBrandPartnerships,
  listCashPrizes,
  seedFirstMonthlyBounties,
  seedFirstMonthlyCompetition,
  rewardWarningCardCreation,
  touchDailyStreak,
  upsertMonthlyCompetition,
  updateCashPrizeStatus,
} from "./db/gamification";
import { checkRateLimit } from "./core/rateLimit";
import { logger } from "./core/logger";
import { KILLER_PITCH_LINE, calculateRecoveryProgress, emergencyPlaybook, recoveryTasks } from "./core/playbook";
import { recordCureAction } from "./core/observability";
import { generateIncidentReports } from "./core/reportGenerator";
import { renderReportPdf } from "./core/reportPdf";
import type { ReportPdfPayload } from "./core/reportPdf";
import * as verdictService from "./core/verdictService";
import { renderDashboardPage, renderReportsPage } from "./server/pages";
import { generateSlug, renderWarningCardSvg, storeWarningCard } from "./core/warningCard";
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

const referralApplySchema = z.object({
  code: z.string().min(4).max(32),
});

const bountyCreateSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(10).max(2000),
  targetIdentifier: z.string().min(3).max(256),
  platform: z.string().min(2).max(64),
  rewardPoints: z.number().int().min(1).max(10000).default(150),
  priority: z.enum(["low", "medium", "high", "critical"]).default("high"),
});

const bountyCompleteSchema = z.object({
  winnerUserId: z.string().min(10).max(64).optional(),
});

const monthlyCompetitionSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  name: z.string().min(3).max(160),
  prizePoolCents: z.number().int().min(0).max(100_000_000),
  currency: z.string().min(3).max(3).default("USD"),
  sponsor: z.string().max(120).optional(),
  status: z.enum(["active", "completed", "planned"]).default("active"),
  rules: z.record(z.any()).optional(),
});

const monthlyCompetitionSeedSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  name: z.string().min(3).max(160).optional(),
  prizePoolCents: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().min(3).max(3).optional(),
  sponsor: z.string().max(120).nullable().optional(),
  rules: z.record(z.any()).optional(),
});

const bountySeedSchema = z.object({
  bounties: z.array(bountyCreateSchema).min(1).max(20).optional(),
});

const finalizeCompetitionSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  payoutCentsByRank: z.array(z.number().int().min(0).max(10_000_000)).min(1).max(10),
  partnerName: z.string().max(120).optional(),
});

const cashPrizeCreateSchema = z.object({
  userId: z.string().min(10).max(64),
  competitionId: z.number().int().min(1).optional(),
  amountCents: z.number().int().min(0).max(50_000_000),
  currency: z.string().min(3).max(3).default("USD"),
  partnerName: z.string().max(120).optional(),
  status: z.enum(["pending", "approved", "paid", "cancelled"]).default("pending"),
  payoutReference: z.string().max(256).optional(),
  notes: z.string().max(2000).optional(),
});

const cashPrizeUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "paid", "cancelled"]),
  payoutReference: z.string().max(256).optional(),
  notes: z.string().max(2000).optional(),
});

const brandPartnershipSchema = z.object({
  brandName: z.string().min(2).max(120),
  contactEmail: z.string().email().optional(),
  prizeType: z.string().min(3).max(160),
  contributionCents: z.number().int().min(0).max(100_000_000).default(0),
  currency: z.string().min(3).max(3).default("USD"),
  status: z.enum(["pipeline", "active", "paused", "closed"]).default("pipeline"),
  notes: z.string().max(2000).optional(),
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
  const resetIso = new Date(result.resetAt).toISOString();
  const remaining = Math.max(0, result.remaining);
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  if (!result.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and retry." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": resetIso,
      },
    });
  }

  c.header("X-RateLimit-Limit", limit.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", resetIso);
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

  const user = await findOrCreateUser(c.env.DB, googleUser.email, c.env);
  await ensureGamificationProfile(c.env.DB, user.id).catch(() => { });
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
  const gamification = await getGamificationProfile(c.env.DB, session.userId).catch(() => null);

  return c.json({
    authenticated: true,
    email: session.email,
    role: session.role,
    usage: { used: usedToday, limit, remaining: Math.max(0, limit - usedToday) },
    gamification: gamification
      ? {
        totalPoints: gamification.totalPoints,
        currentStreakDays: gamification.currentStreakDays,
        premiumUnlocked: gamification.premiumUnlocked,
      }
      : null,
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

app.post("/api/report", async (c) => {
  const startedAt = Date.now();
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const parsed = reportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "report_submitted", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/report",
    });
    return jsonError("Invalid report payload.");
  }

  const normalizedIdentifiers = sortObjectEntries(parsed.data.identifiers);
  const report: ReportRequest = {
    ...parsed.data,
    identifiers: normalizedIdentifiers,
  };

  try {
    let rewardSummary: Awaited<ReturnType<typeof grantReportSubmissionRewards>> | null = null;
    const reportId = await createCommunityReport(c.env.DB, report);
    const fingerprint = fingerprintFromIdentifiers(normalizedIdentifiers);
    await upsertPattern(c.env.DB, fingerprint, report.platform, report.category, JSON.stringify(normalizedIdentifiers));
    await auditEvent(c.env.DB, "report_created", {
      reportId,
      platform: report.platform,
      category: report.category,
    });

    if (session?.userId) {
      rewardSummary = await grantReportSubmissionRewards(c.env.DB, session.userId, reportId).catch(() => null);
    }

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
      rewards: rewardSummary
        ? {
          pointsAwarded: rewardSummary.reportPointsAwarded + rewardSummary.achievementBonusPoints + rewardSummary.streak.awardedPoints,
          reportPoints: rewardSummary.reportPointsAwarded,
          streakPoints: rewardSummary.streak.awardedPoints,
          currentStreakDays: rewardSummary.profile.currentStreakDays,
          unlockedAchievements: rewardSummary.unlockedAchievements,
          totalPoints: rewardSummary.profile.totalPoints,
          premiumUnlocked: rewardSummary.profile.premiumUnlocked,
        }
        : null,
    });
  } catch (error) {
    logger.error("report_db_error", { message: error instanceof Error ? error.message : "unknown" });
    recordCureAction(c.env, "report_submitted", "failed", Date.now() - startedAt, {
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

app.post("/api/report/generate-ai", async (c) => {
  const startedAt = Date.now();
  const parsed = reportGenerateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    recordCureAction(c.env, "ai_report_generated", "validation_error", Date.now() - startedAt, {
      endpoint: "/api/report/generate-ai",
    });
    return jsonError("Invalid report generation payload.");
  }

  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Fallback to template if AI is not configured
    const generated = generateIncidentReports(parsed.data);
    recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
      endpoint: "/api/report/generate-ai",
      reason: "ai_not_configured",
    });
    return c.json({ ...generated, mode: "template", fallback: true });
  }

  // ── Daily quota enforcement ──
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const userId = session?.userId ?? null;
  const dailyLimit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
  const usedToday = await getUsageToday(c.env.DB, userId, ip);
  if (usedToday >= dailyLimit) {
    // Fallback to template if quota exceeded
    const generated = generateIncidentReports(parsed.data);
    recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
      endpoint: "/api/report/generate-ai",
      reason: "quota_exceeded",
    });
    return c.json({ ...generated, mode: "template", fallback: true });
  }

  const reportPrompt = `You are generating official incident reports for a Malaysian scam victim. Generate THREE separate reports based on the following incident details. Each report should be professional, detailed, and ready to copy-paste.

INCIDENT DETAILS:
- Title: ${parsed.data.incidentTitle}
- Scam Type: ${parsed.data.scamType}
- Occurred At: ${parsed.data.occurredAt}
- Channel: ${parsed.data.channel}
- Suspect Identifiers: ${parsed.data.suspects.join(", ") || "N/A"}
- Estimated Loss: ${parsed.data.losses}
- Actions Taken: ${parsed.data.actionsTaken.join("; ") || "None yet"}
${parsed.data.extraNotes ? `- Additional Notes: ${parsed.data.extraNotes}` : ""}

Generate exactly 3 reports in this JSON format (no markdown, no code blocks, just valid JSON):
{
  "forBank": "Full bank report text here...",
  "forPolice": "Full police report text here...",
  "forPlatform": "Full platform report text here..."
}

REQUIREMENTS:
- Bank report: Address to fraud department, include transaction details, request immediate freeze, reference NSRC 997.
- Police report: Formal tone for PDRM CCID filing, include timeline, evidence summary, reference semakmule.rmp.gov.my.
- Platform report: Address to trust & safety team, include account identifiers, request suspension and log preservation.
- All reports should use Malaysian context (MYR, Malaysian institutions, BNM, PDRM).
- Include specific action requests in each report.
- Keep each report between 200-400 words.`;

  const reportModels: [string, string] = [
    "google/gemini-3-flash-preview:online",
    "google/gemini-2.5-flash:online",
  ];

  try {
    let lastStatus = 0;
    let data: { choices?: { message?: { content?: string } }[] } | null = null;

    for (const model of reportModels) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://scamshield-my.m-naim.workers.dev",
          "X-Title": "ScamShield MY",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: reportPrompt }],
          stream: false,
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        data = await response.json() as { choices?: { message?: { content?: string } }[] };
        break;
      }
      lastStatus = response.status;
      logger.warn("ai_report_upstream_error", { model, status: lastStatus });
    }

    if (!data) {
      throw new Error(`AI API returned ${lastStatus}`);
    }

    const content = data.choices?.[0]?.message?.content || "";

    // Parse the AI response - try to extract JSON
    let aiReports: { forBank?: string; forPolice?: string; forPlatform?: string } = {};
    try {
      // Try to find JSON in the response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiReports = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, fall back to template
      logger.warn("ai_report_parse_failed", { contentLength: content.length });
    }

    if (aiReports.forBank && aiReports.forPolice && aiReports.forPlatform) {
      await recordUsage(c.env.DB, userId, ip, "ai_report").catch(() => { });
      recordCureAction(c.env, "ai_report_generated", "success", Date.now() - startedAt, {
        endpoint: "/api/report/generate-ai",
      });

      // Calculate severity from input (reuse template logic)
      const templateResult = generateIncidentReports(parsed.data);
      return c.json({
        severitySuggestion: templateResult.severitySuggestion,
        timeline: templateResult.timeline,
        identifiers: templateResult.identifiers,
        category: parsed.data.scamType,
        forBank: aiReports.forBank,
        forPolice: aiReports.forPolice,
        forPlatform: aiReports.forPlatform,
        mode: "ai",
        fallback: false,
      });
    }

    // AI returned incomplete — fall back
    const generated = generateIncidentReports(parsed.data);
    recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
      endpoint: "/api/report/generate-ai",
      reason: "incomplete_ai_response",
    });
    return c.json({ ...generated, mode: "template", fallback: true });

  } catch (error) {
    logger.error("ai_report_error", { message: error instanceof Error ? error.message : "unknown" });
    // Fallback to template
    const generated = generateIncidentReports(parsed.data);
    recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
      endpoint: "/api/report/generate-ai",
    });
    return c.json({ ...generated, mode: "template", fallback: true });
  }
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
      rewardSummary = await rewardWarningCardCreation(c.env.DB, session.userId, slug, payload.verdict).catch(() => null);
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
      rewardSummary = await rewardWarningCardCreation(c.env.DB, session.userId, slug, payload.verdict).catch(() => null);
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

app.post("/api/ai/chat", async (c) => {
  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError("AI chat is not configured.", 503);
  }

  const parsed = aiChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid chat payload.");
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

  const models: [string, string] = [
    "google/gemini-3-flash-preview:online",
    "google/gemini-2.5-flash:online",
  ];

  let lastError: string | null = null;
  let lastStatus = 0;

  for (const model of models) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://scamshield-my.m-naim.workers.dev",
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
  }

  logger.error("ai_chat_upstream_error", { status: lastStatus, error: lastError });
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

/* ─── Gamification APIs ─── */

app.get("/api/leaderboard", async (c) => {
  const limitParam = Number.parseInt(c.req.query("limit") ?? "20", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 20;
  const leaderboard = await getLeaderboard(c.env.DB, limit);
  return c.json({
    generatedAt: new Date().toISOString(),
    leaderboard,
  });
});

app.get("/api/gamification/me", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);

  const monthKey = c.req.query("month") ?? getCompetitionMonthKey();
  const [profile, referrals, prizes, competition] = await Promise.all([
    getGamificationProfile(c.env.DB, session.userId),
    getReferralSummary(c.env.DB, session.userId),
    listCashPrizes(c.env.DB, { userId: session.userId, limit: 20 }),
    getMonthlyCompetitionOverview(c.env.DB, monthKey, 20),
  ]);

  return c.json({
    profile,
    referrals,
    prizes,
    competition,
  });
});

app.get("/api/referrals/me", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);
  const referral = await getReferralSummary(c.env.DB, session.userId);
  return c.json(referral);
});

app.post("/api/referrals/apply", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);

  const parsed = referralApplySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid referral payload.");

  try {
    const applied = await applyReferralCode(c.env.DB, session.userId, parsed.data.code);
    const [profile, referral] = await Promise.all([
      getGamificationProfile(c.env.DB, session.userId),
      getReferralSummary(c.env.DB, session.userId),
    ]);
    return c.json({
      status: "applied",
      applied,
      profile,
      referral,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Referral apply failed.", 409);
  }
});

app.post("/api/admin/seeds/monthly-competition", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = monthlyCompetitionSeedSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Invalid monthly competition seed payload.");

  const seeded = await seedFirstMonthlyCompetition(c.env.DB, parsed.data);
  return c.json(seeded);
});

app.post("/api/admin/seeds/bounties", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = bountySeedSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Invalid bounty seed payload.");

  const seeded = await seedFirstMonthlyBounties(c.env.DB, session.userId, parsed.data.bounties);
  return c.json(seeded);
});

app.get("/api/bounties", async (c) => {
  const statusQuery = (c.req.query("status") ?? "open").toLowerCase();
  const status = statusQuery === "all" || statusQuery === "open" || statusQuery === "claimed" || statusQuery === "closed"
    ? statusQuery
    : "open";
  const limitParam = Number.parseInt(c.req.query("limit") ?? "25", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 25;

  const bounties = await listBounties(c.env.DB, status, limit);
  return c.json({ bounties });
});

app.post("/api/bounties", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = bountyCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid bounty payload.");

  const bounty = await createBounty(c.env.DB, {
    ...parsed.data,
    createdByUserId: session.userId,
  });
  return c.json({ bounty });
});

app.post("/api/bounties/:id/claim", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);

  const bountyId = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(bountyId) || bountyId <= 0) return jsonError("Invalid bounty id.");

  try {
    const bounty = await claimBounty(c.env.DB, bountyId, session.userId);
    await touchDailyStreak(c.env.DB, session.userId).catch(() => { });
    return c.json({ bounty });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Bounty claim failed.", 409);
  }
});

app.post("/api/bounties/:id/complete", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const bountyId = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(bountyId) || bountyId <= 0) return jsonError("Invalid bounty id.");

  const parsed = bountyCompleteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Invalid bounty completion payload.");

  try {
    const completed = await completeBounty(c.env.DB, bountyId, parsed.data.winnerUserId);
    return c.json(completed);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Bounty completion failed.", 409);
  }
});

app.get("/api/competitions/monthly", async (c) => {
  const monthKey = c.req.query("month") ?? getCompetitionMonthKey();
  const limitParam = Number.parseInt(c.req.query("limit") ?? "20", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 20;
  const competition = await getMonthlyCompetitionOverview(c.env.DB, monthKey, limit);
  return c.json(competition);
});

app.post("/api/competitions/monthly", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = monthlyCompetitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid competition payload.");

  const competition = await upsertMonthlyCompetition(c.env.DB, parsed.data);
  return c.json({ competition });
});

app.post("/api/competitions/monthly/finalize", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = finalizeCompetitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid finalize payload.");

  const monthKey = parsed.data.monthKey ?? getCompetitionMonthKey();
  const finalized = await finalizeMonthlyCompetition(
    c.env.DB,
    monthKey,
    parsed.data.payoutCentsByRank,
    parsed.data.partnerName,
  );
  return c.json(finalized);
});

app.get("/api/prizes", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session) return jsonError("Authentication required.", 401);

  const status = c.req.query("status") ?? undefined;
  const scope = c.req.query("scope") ?? "mine";
  const prizes = session.role === "admin" && scope === "all"
    ? await listCashPrizes(c.env.DB, { status, limit: 50 })
    : await listCashPrizes(c.env.DB, { userId: session.userId, status, limit: 50 });

  return c.json({ prizes });
});

app.post("/api/prizes", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = cashPrizeCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid cash prize payload.");

  const prize = await createCashPrize(c.env.DB, parsed.data);
  return c.json({ prize });
});

app.patch("/api/prizes/:id", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const prizeId = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(prizeId) || prizeId <= 0) return jsonError("Invalid prize id.");

  const parsed = cashPrizeUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid cash prize update payload.");

  const prize = await updateCashPrizeStatus(c.env.DB, prizeId, parsed.data);
  return c.json({ prize });
});

app.get("/api/partnerships", async (c) => {
  const status = c.req.query("status") ?? undefined;
  const partnerships = await listBrandPartnerships(c.env.DB, status, 50);
  return c.json({ partnerships });
});

app.post("/api/partnerships", async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);

  const parsed = brandPartnershipSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid partnership payload.");

  const partnership = await createBrandPartnership(c.env.DB, parsed.data);
  return c.json({ partnership });
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
