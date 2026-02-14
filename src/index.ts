import { Hono } from "hono";
import { z } from "zod";
import { auditEvent, createCommunityReport, createWarningPage, getHeatmapGrid, getWarningPage, rollupHeatmap, upsertPattern } from "./db/repository";
import { checkRateLimit } from "./core/rateLimit";
import { logger } from "./core/logger";
import { KILLER_PITCH_LINE, calculateRecoveryProgress, emergencyPlaybook, recoveryTasks } from "./core/playbook";
import { generateIncidentReports } from "./core/reportGenerator";
import { evaluateVerdict } from "./core/verdictService";
import { generateSlug, storeWarningCard } from "./core/warningCard";
import { fingerprintFromIdentifiers, validateChain, validateInput, validateSlug } from "./core/validation";
import type { Env, QueueMessage, ReportRequest, WarningCardPayload } from "./types";

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
  const badgeColor = verdict === "HIGH_RISK" ? "#dc2626" : verdict === "LEGIT" ? "#15803d" : "#475569";
  const badgeBg = verdict === "HIGH_RISK" ? "rgba(220,38,38,0.15)" : verdict === "LEGIT" ? "rgba(21,128,61,0.15)" : "rgba(71,85,105,0.15)";
  const borderColor = verdict === "HIGH_RISK" ? "#fca5a5" : verdict === "LEGIT" ? "#86efac" : "#94a3b8";
  const safeHeadline = escapeHtml(headline);
  const safeVerdict = escapeHtml(verdict);

  const identifierHtml = Object.entries(identifiers)
    .slice(0, 4)
    .map(([key, value]) => `<div class="id-row"><span class="id-key">${escapeHtml(key)}</span><span class="id-val">${escapeHtml(value)}</span></div>`)
    .join("");

  const reasonsHtml = reasons.slice(0, 3).map((reason, i) =>
    `<div class="reason"><span class="reason-num">${i + 1}</span><span>${escapeHtml(reason)}</span></div>`
  ).join("");

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeHeadline} - ${escapeHtml(appName)} Warning</title>
  <meta property="og:title" content="${safeHeadline}">
  <meta property="og:description" content="Community scam warning from ScamShield MY. ${safeVerdict} verdict with evidence.">
  <meta property="og:image" content="/api/warning-card/image/${slug}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeHeadline}">
  <meta name="twitter:description" content="Community scam warning from ScamShield MY">
  <meta name="twitter:image" content="/api/warning-card/image/${slug}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:"DM Sans","Segoe UI",system-ui,sans-serif;background:#0a0f1a;color:#e2e8f0;min-height:100vh}
    .wrap{max-width:680px;margin:0 auto;padding:24px 16px 48px}
    .header{display:flex;align-items:center;gap:10px;margin-bottom:24px}
    .shield{font-size:1.4rem}
    .brand{font-family:"Chakra Petch",monospace;font-weight:700;font-size:0.85rem;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase}
    .badge{display:inline-flex;align-items:center;padding:10px 22px;border-radius:10px;font-family:"Chakra Petch",monospace;font-weight:700;font-size:1.3rem;letter-spacing:0.06em;color:${badgeColor};background:${badgeBg};border:2px solid ${borderColor};margin-bottom:16px}
    h1{font-family:"Chakra Petch",monospace;font-size:clamp(1.4rem,3vw,2rem);font-weight:700;margin:0 0 8px;line-height:1.25;color:#f8fafc}
    .subtitle{color:#94a3b8;font-size:0.9rem;line-height:1.5;margin:0 0 24px}
    .panel{background:#111827;border:1px solid #1e293b;border-radius:14px;padding:18px 20px;margin-bottom:14px}
    .panel-title{font-family:"Chakra Petch",monospace;font-weight:600;font-size:0.78rem;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px}
    .id-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #1e293b}
    .id-row:last-child{border-bottom:none}
    .id-key{font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;min-width:60px}
    .id-val{font-family:monospace;font-size:0.88rem;color:#e2e8f0;word-break:break-all}
    .reason{display:flex;align-items:flex-start;gap:10px;padding:8px 0;font-size:0.88rem;color:#cbd5e1;line-height:1.45}
    .reason-num{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(5,102,141,0.2);color:#7dd3fc;font-weight:700;font-size:0.7rem}
    .cta{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
    .cta-text{color:#94a3b8;font-size:0.88rem;margin:0}
    .cta-link{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:999px;background:#05668d;color:#fff;font-weight:600;font-size:0.88rem;text-decoration:none;transition:background 0.2s}
    .cta-link:hover{background:#028090}
    .footer{margin-top:24px;padding-top:16px;border-top:1px solid #1e293b;display:flex;justify-content:space-between;color:#475569;font-size:0.75rem}
    .legal{color:#475569;font-size:0.75rem;font-style:italic;margin-top:16px}
    @media(max-width:500px){.wrap{padding:16px 12px 32px}.badge{font-size:1.1rem;padding:8px 16px}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <span class="shield">&#x1F6E1;</span>
      <span class="brand">${escapeHtml(appName)}</span>
    </div>

    <div class="badge">${safeVerdict}</div>
    <h1>${safeHeadline}</h1>
    <p class="subtitle">${escapeHtml(KILLER_PITCH_LINE)}</p>

    <div class="panel">
      <p class="panel-title">Identifiers</p>
      ${identifierHtml}
    </div>

    <div class="panel">
      <p class="panel-title">Evidence</p>
      ${reasonsHtml}
    </div>

    <div class="panel">
      <div class="cta">
        <p class="cta-text">Take action now. Open the Emergency Playbook and generate copy-ready reports for bank, police, and platform.</p>
        <a href="/" class="cta-link">Open ScamShield MY</a>
      </div>
    </div>

    <p class="legal">ScamShield MY does not promise fund recovery. We provide fast containment and reporting pathways.</p>

    <div class="footer">
      <span>Generated ${timestamp} UTC</span>
      <span>${escapeHtml(appName)}</span>
    </div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Middleware: rate limiting + payload size guard                      */
/* ------------------------------------------------------------------ */

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

app.get("/api/playbook", (c) => {
  return c.json({
    killerPitch: KILLER_PITCH_LINE,
    playbook: emergencyPlaybook,
    recoveryTasks,
  });
});

app.post("/api/verdict", async (c) => {
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

  const evaluated = await evaluateVerdict(parsed.data, c.env);

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
      await c.env.ENRICHMENT_QUEUE.send(message);
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
    const reportId = await createCommunityReport(c.env.DB, report);
    const fingerprint = fingerprintFromIdentifiers(normalizedIdentifiers);
    await upsertPattern(c.env.DB, fingerprint, report.platform, report.category, JSON.stringify(normalizedIdentifiers));
    await auditEvent(c.env.DB, "report_created", {
      reportId,
      platform: report.platform,
      category: report.category,
    });

    logger.info("report_created", { reportId, platform: report.platform, category: report.category });

    return c.json({
      id: reportId,
      status: "created",
      containmentReady: true,
      nextAction: "Generate warning card to contain spread",
    });
  } catch (error) {
    logger.error("report_db_error", { message: error instanceof Error ? error.message : "unknown" });
    return jsonError("Report submission failed. Please try again.", 503);
  }
});

app.post("/api/report/generate", async (c) => {
  const parsed = reportGenerateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid report generation payload.");
  }

  const generated = generateIncidentReports(parsed.data);
  return c.json(generated);
});

app.post("/api/recovery-progress", async (c) => {
  const parsed = recoveryProgressSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid recovery payload.");
  }

  const progress = calculateRecoveryProgress(parsed.data.completedTaskIds);
  const completed = new Set(parsed.data.completedTaskIds);

  return c.json({
    progress,
    tasks: recoveryTasks.map((task) => ({
      ...task,
      completed: completed.has(task.id),
    })),
  });
});

app.post("/api/warning-card", async (c) => {
  const parsed = warningCardSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
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
      await c.env.ENRICHMENT_QUEUE.send(queuedMessage);
    } catch {
      logger.warn("queue_send_failed", { endpoint: "warning-card" });
    }

    logger.info("warning_card_created", { slug, verdict: payload.verdict });

    return c.json({
      slug,
      warningPageUrl: `/w/${slug}`,
      imageUrl: `/api/warning-card/image/${slug}`,
    });
  } catch (error) {
    logger.error("warning_card_error", { message: error instanceof Error ? error.message : "unknown" });
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
      "Content-Type": object.httpMetadata?.contentType ?? "image/png",
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

    await evaluateVerdict({ type, value, chain: typeof chain === "string" ? chain : undefined }, env, /* background */ true);
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
