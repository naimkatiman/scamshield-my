import type { Hono } from "hono";
import { z } from "zod";
import {
  applyReferralCode,
  claimBounty,
  completeBounty,
  createBounty,
  createBrandPartnership,
  createCashPrize,
  finalizeMonthlyCompetition,
  getCompetitionMonthKey,
  getGamificationProfile,
  getLeaderboard,
  getMonthlyCompetitionOverview,
  getReferralSummary,
  listBounties,
  listBrandPartnerships,
  listCashPrizes,
  seedFirstMonthlyBounties,
  seedFirstMonthlyCompetition,
  touchDailyStreak,
  upsertMonthlyCompetition,
  updateCashPrizeStatus,
} from "../db/gamification";
import { getSessionFromRequest } from "../core/auth";
import type { Env } from "../types";

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

const referralApplySchema = z.object({
  code: z.string().min(4).max(32),
});

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parseBooleanFlag(raw: string | undefined, fallback = false): boolean {
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function registerGamificationRoutes(app: Hono<{ Bindings: Env }>): void {
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
      listCashPrizes(c.env.DB, { userId: session.userId, limit: 25 }),
      getMonthlyCompetitionOverview(c.env.DB, monthKey, 20),
    ]);

    return c.json({ profile, referrals, prizes, competition });
  });

  app.get("/api/referrals/me", async (c) => {
    const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!session) return jsonError("Authentication required.", 401);

    const summary = await getReferralSummary(c.env.DB, session.userId);
    return c.json(summary);
  });

  app.post("/api/referrals/apply", async (c) => {
    const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!session) return jsonError("Authentication required.", 401);

    const parsed = referralApplySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid referral code payload.");

    try {
      const result = await applyReferralCode(c.env.DB, session.userId, parsed.data.code);
      return c.json(result);
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
      const idempotencyKey = c.req.header("idempotency-key") ?? c.req.header("x-idempotency-key") ?? undefined;
      const completed = await completeBounty(
        c.env.DB,
        bountyId,
        parsed.data.winnerUserId,
        undefined,
        idempotencyKey ? `bounty_complete:${idempotencyKey}` : undefined,
      );
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
    const publicListingEnabled = parseBooleanFlag(c.env.PUBLIC_PARTNERSHIPS_ENABLED, false);
    if (!publicListingEnabled) {
      const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
      if (!session || session.role !== "admin") return jsonError("Admin access required.", 403);
    }
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
}
