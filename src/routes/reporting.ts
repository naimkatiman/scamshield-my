import type { Hono } from "hono";
import { z } from "zod";
import { auditEvent, createCommunityReport, upsertPattern } from "../db/repository";
import { grantReportSubmissionRewards } from "../db/gamification";
import { logger } from "../core/logger";
import { recordCureAction } from "../core/observability";
import { generateIncidentReports } from "../core/reportGenerator";
import {
  DAILY_LIMIT_FREE,
  DAILY_LIMIT_LOGIN,
  getSessionFromRequest,
  getUsageToday,
  recordUsage,
} from "../core/auth";
import { fingerprintFromIdentifiers } from "../core/validation";
import type { Env, ReportRequest } from "../types";

const boundedIdentifiers = z.record(
  z.string().max(256),
  z.string().max(256),
).refine((obj) => Object.keys(obj).length <= 10, { message: "Too many identifiers (max 10)." });

const boundedString = (maxLen: number) => z.string().max(maxLen);

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

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_REFERER = "https://scamshield-my.m-naim.workers.dev";
const DEFAULT_REPORT_MODELS = [
  "google/gemini-3-flash-preview:online",
  "google/gemini-2.5-flash:online",
] as const;

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

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

function getOpenRouterModels(raw: string | undefined, fallback: readonly string[]): string[] {
  const parsed = parseCsvList(raw);
  return parsed.length > 0 ? parsed : [...fallback];
}

function sortObjectEntries(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

export function registerReportingRoutes(app: Hono<{ Bindings: Env }>): void {
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
    const idempotencyKey = c.req.header("idempotency-key") ?? c.req.header("x-idempotency-key") ?? undefined;

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
        rewardSummary = await grantReportSubmissionRewards(
          c.env.DB,
          session.userId,
          reportId,
          undefined,
          idempotencyKey ? `report_submit:${idempotencyKey}` : undefined,
        ).catch(() => null);
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

    const apiKey = hasUsableOpenRouterKey(c.env.OPENROUTER_API_KEY) ? c.env.OPENROUTER_API_KEY.trim() : null;
    if (!apiKey) {
      if (isStrictAiMode(c.env)) {
        return jsonError("AI service unavailable.", 503);
      }
      const generated = generateIncidentReports(parsed.data);
      recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
        endpoint: "/api/report/generate-ai",
        reason: "ai_not_configured",
      });
      return c.json({ ...generated, mode: "template", fallback: true });
    }

    const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const userId = session?.userId ?? null;
    const dailyLimit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
    const usedToday = await getUsageToday(c.env.DB, userId, ip);
    if (usedToday >= dailyLimit) {
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

    const reportModels = getOpenRouterModels(c.env.OPENROUTER_REPORT_MODELS, DEFAULT_REPORT_MODELS);
    const referer = c.env.OPENROUTER_REFERER ?? DEFAULT_OPENROUTER_REFERER;

    try {
      let lastStatus = 0;
      let lastErrorText = "";
      let data: { choices?: { message?: { content?: string } }[] } | null = null;

      for (const model of reportModels) {
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
        lastErrorText = await response.text().catch(() => "");
        logger.warn("ai_report_upstream_error", { model, status: lastStatus });

        if (isOpenRouterAuthFailure(lastStatus, lastErrorText) && isStrictAiMode(c.env)) {
          return jsonError("AI provider authentication failed.", 502);
        }
      }

      if (!data) {
        throw new Error(`AI API returned ${lastStatus}`);
      }

      const content = data.choices?.[0]?.message?.content || "";

      let aiReports: { forBank?: string; forPolice?: string; forPlatform?: string } = {};
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiReports = JSON.parse(jsonMatch[0]);
        }
      } catch {
        logger.warn("ai_report_parse_failed", { contentLength: content.length });
      }

      if (aiReports.forBank && aiReports.forPolice && aiReports.forPlatform) {
        await recordUsage(c.env.DB, userId, ip, "ai_report").catch(() => { });
        recordCureAction(c.env, "ai_report_generated", "success", Date.now() - startedAt, {
          endpoint: "/api/report/generate-ai",
        });

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

      const generated = generateIncidentReports(parsed.data);
      recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
        endpoint: "/api/report/generate-ai",
        reason: "incomplete_ai_response",
      });
      return c.json({ ...generated, mode: "template", fallback: true });

    } catch (error) {
      logger.error("ai_report_error", { message: error instanceof Error ? error.message : "unknown" });
      const generated = generateIncidentReports(parsed.data);
      recordCureAction(c.env, "ai_report_generated", "fallback", Date.now() - startedAt, {
        endpoint: "/api/report/generate-ai",
      });
      return c.json({ ...generated, mode: "template", fallback: true });
    }
  });
}
