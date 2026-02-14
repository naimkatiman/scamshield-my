
import {
  buildPremiumState,
  computeStreakProgress,
  getUnlockedReportAchievements,
  isPremiumUnlocked,
  maskEmailForLeaderboard,
  POINTS,
  PREMIUM_FEATURES,
  PREMIUM_UNLOCK_POINTS,
  PREMIUM_UNLOCK_STREAK_DAYS,
  toIsoDay,
  type PremiumState,
  type ReportAchievementDefinition,
} from "../core/gamification";

interface GamificationProfileRow {
  user_id: string;
  total_points: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_day: string | null;
  reports_submitted: number;
  premium_unlocked: number;
  referral_code: string | null;
  referred_by_user_id: string | null;
}

interface AchievementRow {
  code: string;
  title: string;
  description: string;
  awarded_at: string;
}

interface LeaderboardRow {
  user_id: string;
  email: string | null;
  total_points: number;
  current_streak_days: number;
  reports_submitted: number;
  premium_unlocked: number;
}

interface BountyRow {
  id: number;
  title: string;
  description: string;
  target_identifier: string;
  platform: string;
  reward_points: number;
  priority: string;
  status: string;
  created_by_user_id: string | null;
  claimed_by_user_id: string | null;
  created_at: string;
  claimed_at: string | null;
  closed_at: string | null;
}

interface MonthlyCompetitionRow {
  id: number;
  month_key: string;
  name: string;
  prize_pool_cents: number;
  currency: string;
  sponsor: string | null;
  status: string;
  rules_json: string;
  created_at: string;
  updated_at: string;
}

interface CompetitionWinnerRow {
  user_id: string;
  email: string | null;
  rank: number;
  points: number;
  prize_cents: number;
  created_at: string;
}

interface CashPrizeRow {
  id: number;
  user_id: string;
  email: string | null;
  competition_id: number | null;
  amount_cents: number;
  currency: string;
  partner_name: string | null;
  status: string;
  payout_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BrandPartnershipRow {
  id: number;
  brand_name: string;
  contact_email: string | null;
  prize_type: string;
  contribution_cents: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReferralDetailRow {
  email: string | null;
  created_at: string;
  points_awarded: number;
}

interface ReferralSummaryCountsRow {
  total_referrals: number;
  rewarded_points: number;
}

export interface UserAchievement {
  code: string;
  title: string;
  description: string;
  awardedAt: string;
}

export interface GamificationProfile {
  userId: string;
  totalPoints: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDay: string | null;
  reportsSubmitted: number;
  premiumUnlocked: boolean;
  premium: PremiumState;
  premiumFeatures: readonly string[];
  referralCode: string;
  referredByUserId: string | null;
  achievements: UserAchievement[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  currentStreakDays: number;
  reportsSubmitted: number;
  premiumUnlocked: boolean;
}

export interface ReferralDetail {
  displayName: string;
  createdAt: string;
  pointsAwarded: number;
}

export interface ReferralSummary {
  referralCode: string;
  totalReferrals: number;
  rewardedPoints: number;
  referrals: ReferralDetail[];
}

export interface StreakUpdateResult {
  streakUpdated: boolean;
  awardedPoints: number;
  currentStreakDays: number;
  longestStreakDays: number;
  today: string;
}

export interface ReportRewardResult {
  reportCount: number;
  reportPointsAwarded: number;
  streak: StreakUpdateResult;
  unlockedAchievements: UserAchievement[];
  achievementBonusPoints: number;
  profile: GamificationProfile;
}

export interface BountyRecord {
  id: number;
  title: string;
  description: string;
  targetIdentifier: string;
  platform: string;
  rewardPoints: number;
  priority: string;
  status: string;
  createdByUserId: string | null;
  claimedByUserId: string | null;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
}

export interface CreateBountyInput {
  title: string;
  description: string;
  targetIdentifier: string;
  platform: string;
  rewardPoints: number;
  priority: "low" | "medium" | "high" | "critical";
  createdByUserId?: string | null;
}

export interface BountyCompletionResult {
  bounty: BountyRecord;
  winnerUserId: string;
  awardedPoints: number;
}

export interface MonthlyCompetitionRecord {
  id: number;
  monthKey: string;
  name: string;
  prizePoolCents: number;
  currency: string;
  sponsor: string | null;
  status: string;
  rules: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyCompetitionLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
}

export interface MonthlyCompetitionOverview {
  competition: MonthlyCompetitionRecord;
  leaderboard: MonthlyCompetitionLeaderboardEntry[];
  winners: CompetitionWinner[];
}

export interface CompetitionWinner {
  userId: string;
  displayName: string;
  rank: number;
  points: number;
  prizeCents: number;
  createdAt: string;
}

export interface UpsertCompetitionInput {
  monthKey: string;
  name: string;
  prizePoolCents: number;
  currency: string;
  sponsor?: string | null;
  status?: "active" | "completed" | "planned";
  rules?: Record<string, unknown>;
}

export interface SeedMonthlyCompetitionInput {
  monthKey?: string;
  name?: string;
  prizePoolCents?: number;
  currency?: string;
  sponsor?: string | null;
  rules?: Record<string, unknown>;
}

export interface SeedMonthlyCompetitionResult {
  competition: MonthlyCompetitionRecord;
  created: boolean;
}

export type SeedBountyTemplate = Omit<CreateBountyInput, "createdByUserId">;

export interface SeedBountiesResult {
  created: BountyRecord[];
  existing: BountyRecord[];
}

export interface FinalizeCompetitionResult {
  competition: MonthlyCompetitionRecord;
  winners: CompetitionWinner[];
  prizes: CashPrizeRecord[];
}

export interface CashPrizeRecord {
  id: number;
  userId: string;
  displayName: string;
  competitionId: number | null;
  amountCents: number;
  currency: string;
  partnerName: string | null;
  status: string;
  payoutReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashPrizeInput {
  userId: string;
  competitionId?: number | null;
  amountCents: number;
  currency?: string;
  partnerName?: string | null;
  status?: string;
  payoutReference?: string | null;
  notes?: string | null;
}

export interface UpdateCashPrizeStatusInput {
  status: string;
  payoutReference?: string | null;
  notes?: string | null;
}

export interface BrandPartnershipRecord {
  id: number;
  brandName: string;
  contactEmail: string | null;
  prizeType: string;
  contributionCents: number;
  currency: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandPartnershipInput {
  brandName: string;
  contactEmail?: string | null;
  prizeType: string;
  contributionCents?: number;
  currency?: string;
  status?: "pipeline" | "active" | "paused" | "closed";
  notes?: string | null;
}

export interface GamificationAdminSnapshot {
  totalPointsAwarded: number;
  premiumUsers: number;
  openBounties: number;
  pendingCashPrizes: number;
  activePartnerships: number;
  leaderboard: LeaderboardEntry[];
  activeCompetition: MonthlyCompetitionRecord;
  recentCashPrizes: CashPrizeRecord[];
}

function parseRulesJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallthrough
  }
  return {};
}

function mapAchievement(row: AchievementRow): UserAchievement {
  return {
    code: row.code,
    title: row.title,
    description: row.description,
    awardedAt: row.awarded_at,
  };
}

function mapBounty(row: BountyRow): BountyRecord {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    targetIdentifier: row.target_identifier,
    platform: row.platform,
    rewardPoints: Number(row.reward_points),
    priority: row.priority,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    claimedByUserId: row.claimed_by_user_id,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    closedAt: row.closed_at,
  };
}

function mapMonthlyCompetition(row: MonthlyCompetitionRow): MonthlyCompetitionRecord {
  return {
    id: Number(row.id),
    monthKey: row.month_key,
    name: row.name,
    prizePoolCents: Number(row.prize_pool_cents),
    currency: row.currency,
    sponsor: row.sponsor,
    status: row.status,
    rules: parseRulesJson(row.rules_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCashPrize(row: CashPrizeRow): CashPrizeRecord {
  return {
    id: Number(row.id),
    userId: row.user_id,
    displayName: row.email ? maskEmailForLeaderboard(row.email) : "anonymous",
    competitionId: row.competition_id === null ? null : Number(row.competition_id),
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    partnerName: row.partner_name,
    status: row.status,
    payoutReference: row.payout_reference,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBrandPartnership(row: BrandPartnershipRow): BrandPartnershipRecord {
  return {
    id: Number(row.id),
    brandName: row.brand_name,
    contactEmail: row.contact_email,
    prizeType: row.prize_type,
    contributionCents: Number(row.contribution_cents),
    currency: row.currency,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function randomReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "SS";
  for (const value of bytes) {
    code += alphabet[value % alphabet.length];
  }
  return code;
}

function monthRange(monthKey: string): { start: string; endExclusive: string } {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid month key.");
  }

  const start = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endExclusive = `${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}-01`;
  return { start, endExclusive };
}

function currentMonthKey(day = toIsoDay()): string {
  return day.slice(0, 7);
}

const FIRST_MONTHLY_COMPETITION_RULES = {
  scoring: "Points from reports, streaks, referrals, and bounties.",
  verification: "All entries are subject to anti-abuse and identity verification checks.",
  payouts: "Cash payouts are reviewed and approved by admins before release.",
} satisfies Record<string, unknown>;

const FIRST_MONTHLY_BOUNTIES: readonly SeedBountyTemplate[] = [
  {
    title: "Telegram Recovery Agent Impersonation Sweep",
    description:
      "Trace Telegram accounts impersonating recovery agents and document linked wallet, domain, and handle indicators.",
    targetIdentifier: "@recovery-helpdesk",
    platform: "Telegram",
    rewardPoints: 220,
    priority: "critical",
  },
  {
    title: "Spoofed Banking Login Domain Hunt",
    description:
      "Identify active look-alike banking login domains circulating in scam chats and capture evidence for blocking.",
    targetIdentifier: "secure-maybank-verification.com",
    platform: "Web",
    rewardPoints: 180,
    priority: "high",
  },
  {
    title: "WhatsApp Investment Syndicate Lead Map",
    description:
      "Map recruiter accounts and payout wallets from WhatsApp investment scam threads with corroborated links.",
    targetIdentifier: "+60 11-9999 1212",
    platform: "WhatsApp",
    rewardPoints: 160,
    priority: "high",
  },
];

async function getProfileRow(db: D1Database, userId: string): Promise<GamificationProfileRow | null> {
  const row = await db
    .prepare(`SELECT user_id, total_points, current_streak_days, longest_streak_days, last_activity_day,
                     reports_submitted, premium_unlocked, referral_code, referred_by_user_id
              FROM user_gamification_profiles WHERE user_id = ?`)
    .bind(userId)
    .first<GamificationProfileRow>();
  return row ?? null;
}

export async function ensureGamificationProfile(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("INSERT INTO user_gamification_profiles (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING")
    .bind(userId)
    .run();
  await ensureReferralCode(db, userId);
}

export async function ensureReferralCode(db: D1Database, userId: string): Promise<string> {
  const existing = await getProfileRow(db, userId);
  if (existing?.referral_code) {
    return existing.referral_code;
  }

  for (let i = 0; i < 8; i += 1) {
    const code = randomReferralCode();
    try {
      const result = await db
        .prepare(
          `UPDATE user_gamification_profiles
           SET referral_code = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND referral_code IS NULL`,
        )
        .bind(code, userId)
        .run();
      if (Number(result.meta.changes ?? 0) > 0) {
        return code;
      }
    } catch {
      // Collision on unique code, retry.
    }

    const after = await getProfileRow(db, userId);
    if (after?.referral_code) {
      return after.referral_code;
    }
  }

  throw new Error("Unable to generate referral code.");
}

export async function listUserAchievements(db: D1Database, userId: string): Promise<UserAchievement[]> {
  const result = await db
    .prepare("SELECT code, title, description, awarded_at FROM user_achievements WHERE user_id = ? ORDER BY awarded_at DESC")
    .bind(userId)
    .all<AchievementRow>();
  return (result.results ?? []).map(mapAchievement);
}

async function syncPremiumStatus(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_gamification_profiles
       SET premium_unlocked = CASE
         WHEN premium_unlocked = 1 THEN 1
         WHEN total_points >= ? OR current_streak_days >= ? THEN 1
         ELSE 0
       END,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
    )
    .bind(PREMIUM_UNLOCK_POINTS, PREMIUM_UNLOCK_STREAK_DAYS, userId)
    .run();
}

async function withSavepoint<T>(db: D1Database, action: () => Promise<T>): Promise<T> {
  const savepoint = `sp_${crypto.randomUUID().replace(/-/g, "_")}`;
  await db.prepare(`SAVEPOINT ${savepoint}`).run();
  try {
    const result = await action();
    await db.prepare(`RELEASE SAVEPOINT ${savepoint}`).run();
    return result;
  } catch (error) {
    await db.prepare(`ROLLBACK TO SAVEPOINT ${savepoint}`).run().catch(() => { });
    await db.prepare(`RELEASE SAVEPOINT ${savepoint}`).run().catch(() => { });
    throw error;
  }
}

async function claimIdempotencyKey(
  db: D1Database,
  scope: string,
  idempotencyKey: string | undefined,
  userId?: string | null,
): Promise<boolean> {
  if (!idempotencyKey) {
    return true;
  }
  const normalizedKey = idempotencyKey.trim();
  if (!normalizedKey) {
    return true;
  }

  try {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO gamification_idempotency_keys
         (idempotency_key, scope, user_id)
         VALUES (?, ?, ?)`,
      )
      .bind(normalizedKey, scope, userId ?? null)
      .run();
    return Number(result.meta.changes ?? 0) > 0;
  } catch {
    // Backward compatibility while older DBs roll forward.
    return true;
  }
}

export async function getGamificationProfile(db: D1Database, userId: string): Promise<GamificationProfile> {
  await ensureGamificationProfile(db, userId);
  await syncPremiumStatus(db, userId);

  const row = await getProfileRow(db, userId);
  if (!row || !row.referral_code) {
    throw new Error("Gamification profile unavailable.");
  }

  const achievements = await listUserAchievements(db, userId);
  const premium = buildPremiumState(Number(row.total_points), Number(row.current_streak_days), row.premium_unlocked === 1);

  return {
    userId: row.user_id,
    totalPoints: Number(row.total_points),
    currentStreakDays: Number(row.current_streak_days),
    longestStreakDays: Number(row.longest_streak_days),
    lastActivityDay: row.last_activity_day,
    reportsSubmitted: Number(row.reports_submitted),
    premiumUnlocked: row.premium_unlocked === 1,
    premium,
    premiumFeatures: PREMIUM_FEATURES,
    referralCode: row.referral_code,
    referredByUserId: row.referred_by_user_id,
    achievements,
  };
}

export async function awardPoints(
  db: D1Database,
  userId: string,
  actionType: string,
  points: number,
  metadata: Record<string, unknown> = {},
  day = toIsoDay(),
  uniquePerDay = false,
  idempotencyKey?: string,
): Promise<number> {
  if (!Number.isFinite(points) || points <= 0) {
    return 0;
  }

  await ensureGamificationProfile(db, userId);
  const pointsValue = Math.floor(points);

  return withSavepoint(db, async () => {
    const canProceed = await claimIdempotencyKey(db, `award:${actionType}`, idempotencyKey, userId);
    if (!canProceed) {
      return 0;
    }

    const insertSql = uniquePerDay
      ? "INSERT OR IGNORE INTO points_ledger (user_id, action_type, points, metadata_json, day) VALUES (?, ?, ?, ?, ?)"
      : "INSERT INTO points_ledger (user_id, action_type, points, metadata_json, day) VALUES (?, ?, ?, ?, ?)";

    const insertResult = await db
      .prepare(insertSql)
      .bind(userId, actionType, pointsValue, JSON.stringify(metadata), day)
      .run();

    if (Number(insertResult.meta.changes ?? 0) === 0) {
      return 0;
    }

    await db
      .prepare(
        `UPDATE user_gamification_profiles
         SET total_points = total_points + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
      )
      .bind(pointsValue, userId)
      .run();

    await syncPremiumStatus(db, userId);

    return pointsValue;
  });
}

export async function touchDailyStreak(
  db: D1Database,
  userId: string,
  today = toIsoDay(),
): Promise<StreakUpdateResult> {
  await ensureGamificationProfile(db, userId);

  const row = await getProfileRow(db, userId);
  if (!row) {
    throw new Error("Gamification profile unavailable.");
  }

  const progress = computeStreakProgress(
    row.last_activity_day,
    Number(row.current_streak_days),
    Number(row.longest_streak_days),
    today,
  );

  if (!progress.isNewDay) {
    return {
      streakUpdated: false,
      awardedPoints: 0,
      currentStreakDays: Number(row.current_streak_days),
      longestStreakDays: Number(row.longest_streak_days),
      today,
    };
  }

  await db
    .prepare(
      `UPDATE user_gamification_profiles
       SET last_activity_day = ?,
           current_streak_days = ?,
           longest_streak_days = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
    )
    .bind(today, progress.nextStreakDays, progress.longestStreakDays, userId)
    .run();

  const awardedPoints = await awardPoints(
    db,
    userId,
    "daily_streak",
    POINTS.DAILY_STREAK,
    {
      streakDays: progress.nextStreakDays,
      wasReset: progress.wasReset,
    },
    today,
    true,
  );

  return {
    streakUpdated: true,
    awardedPoints,
    currentStreakDays: progress.nextStreakDays,
    longestStreakDays: progress.longestStreakDays,
    today,
  };
}

async function insertAchievement(
  db: D1Database,
  userId: string,
  achievement: ReportAchievementDefinition,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO user_achievements (user_id, code, title, description, metadata_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, code) DO NOTHING`,
    )
    .bind(userId, achievement.code, achievement.title, achievement.description, JSON.stringify(metadata))
    .run();

  return Number(result.meta.changes ?? 0) > 0;
}

export async function grantReportSubmissionRewards(
  db: D1Database,
  userId: string,
  reportId: number,
  today = toIsoDay(),
  idempotencyKey?: string,
): Promise<ReportRewardResult> {
  await ensureGamificationProfile(db, userId);
  const scope = "report_submission_reward";
  const resolvedIdempotencyKey = idempotencyKey ?? `${scope}:${userId}:${reportId}`;

  return withSavepoint(db, async () => {
    const canProceed = await claimIdempotencyKey(db, scope, resolvedIdempotencyKey, userId);
    if (!canProceed) {
      const profile = await getGamificationProfile(db, userId);
      return {
        reportCount: profile.reportsSubmitted,
        reportPointsAwarded: 0,
        streak: {
          streakUpdated: false,
          awardedPoints: 0,
          currentStreakDays: profile.currentStreakDays,
          longestStreakDays: profile.longestStreakDays,
          today,
        },
        unlockedAchievements: [],
        achievementBonusPoints: 0,
        profile,
      };
    }

    const streak = await touchDailyStreak(db, userId, today);

    await db
      .prepare(
        `UPDATE user_gamification_profiles
         SET reports_submitted = reports_submitted + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
      )
      .bind(userId)
      .run();

    const profileRow = await getProfileRow(db, userId);
    const reportCount = Number(profileRow?.reports_submitted ?? 0);

    const reportPointsAwarded = await awardPoints(
      db,
      userId,
      "report_submitted",
      POINTS.REPORT_SUBMITTED,
      {
        reportId,
        reportCount,
      },
      today,
      false,
      `${resolvedIdempotencyKey}:points`,
    );

    const existingAchievements = await listUserAchievements(db, userId);
    const unlockedDefs = getUnlockedReportAchievements(
      reportCount,
      existingAchievements.map((item) => item.code),
    );

    const unlockedAchievements: UserAchievement[] = [];
    let achievementBonusPoints = 0;

    for (const achievement of unlockedDefs) {
      const inserted = await insertAchievement(db, userId, achievement, { reportCount, reportId });
      if (!inserted) {
        continue;
      }

      unlockedAchievements.push({
        code: achievement.code,
        title: achievement.title,
        description: achievement.description,
        awardedAt: new Date().toISOString(),
      });

      achievementBonusPoints += await awardPoints(
        db,
        userId,
        "achievement_unlocked",
        achievement.bonusPoints,
        {
          code: achievement.code,
          reportCount,
        },
        today,
        false,
        `${resolvedIdempotencyKey}:achievement:${achievement.code}`,
      );
    }

    const profile = await getGamificationProfile(db, userId);

    return {
      reportCount,
      reportPointsAwarded,
      streak,
      unlockedAchievements,
      achievementBonusPoints,
      profile,
    };
  });
}

export async function rewardWarningCardCreation(
  db: D1Database,
  userId: string,
  slug: string,
  verdict: string,
  today = toIsoDay(),
  idempotencyKey?: string,
): Promise<{ pointsAwarded: number; streak: StreakUpdateResult; profile: GamificationProfile }> {
  await ensureGamificationProfile(db, userId);
  const resolvedIdempotencyKey = idempotencyKey ?? `warning_card_reward:${userId}:${slug}`;
  const canProceed = await claimIdempotencyKey(db, "warning_card_reward", resolvedIdempotencyKey, userId);
  if (!canProceed) {
    const profile = await getGamificationProfile(db, userId);
    return {
      pointsAwarded: 0,
      streak: {
        streakUpdated: false,
        awardedPoints: 0,
        currentStreakDays: profile.currentStreakDays,
        longestStreakDays: profile.longestStreakDays,
        today,
      },
      profile,
    };
  }
  const streak = await touchDailyStreak(db, userId, today);
  const pointsAwarded = await awardPoints(db, userId, "warning_card_created", POINTS.WARNING_CARD_CREATED, {
    slug,
    verdict,
  }, today, false, `${resolvedIdempotencyKey}:points`);
  const profile = await getGamificationProfile(db, userId);
  return { pointsAwarded, streak, profile };
}
export async function getLeaderboard(db: D1Database, limit = 20): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db
    .prepare(
      `SELECT p.user_id, u.email, p.total_points, p.current_streak_days, p.reports_submitted, p.premium_unlocked
       FROM user_gamification_profiles p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.total_points > 0
       ORDER BY p.total_points DESC, p.current_streak_days DESC, p.reports_submitted DESC, p.updated_at ASC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<LeaderboardRow>();

  return (rows.results ?? []).map((row, idx) => ({
    rank: idx + 1,
    userId: row.user_id,
    displayName: row.email ? maskEmailForLeaderboard(row.email) : "anonymous",
    totalPoints: Number(row.total_points),
    currentStreakDays: Number(row.current_streak_days),
    reportsSubmitted: Number(row.reports_submitted),
    premiumUnlocked: Number(row.premium_unlocked) === 1,
  }));
}

export async function getReferralSummary(db: D1Database, userId: string): Promise<ReferralSummary> {
  await ensureGamificationProfile(db, userId);

  const profileRow = await getProfileRow(db, userId);
  if (!profileRow?.referral_code) {
    throw new Error("Referral code missing.");
  }

  const counts = await db
    .prepare(
      `SELECT COUNT(*) as total_referrals,
              COALESCE(SUM(points_awarded), 0) as rewarded_points
       FROM referrals
       WHERE referrer_user_id = ?`,
    )
    .bind(userId)
    .first<ReferralSummaryCountsRow>();

  const detailRows = await db
    .prepare(
      `SELECT u.email, r.created_at, r.points_awarded
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = ?
       ORDER BY r.created_at DESC
       LIMIT 25`,
    )
    .bind(userId)
    .all<ReferralDetailRow>();

  return {
    referralCode: profileRow.referral_code,
    totalReferrals: Number(counts?.total_referrals ?? 0),
    rewardedPoints: Number(counts?.rewarded_points ?? 0),
    referrals: (detailRows.results ?? []).map((row) => ({
      displayName: row.email ? maskEmailForLeaderboard(row.email) : "anonymous",
      createdAt: row.created_at,
      pointsAwarded: Number(row.points_awarded),
    })),
  };
}

export async function applyReferralCode(
  db: D1Database,
  referredUserId: string,
  referralCode: string,
): Promise<{ referrerUserId: string; referrerPoints: number; referredPoints: number }> {
  await ensureGamificationProfile(db, referredUserId);

  const normalizedCode = referralCode.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Referral code is required.");
  }

  const referredProfile = await getProfileRow(db, referredUserId);
  if (referredProfile?.referred_by_user_id) {
    throw new Error("Referral already applied.");
  }

  const referrer = await db
    .prepare("SELECT user_id FROM user_gamification_profiles WHERE referral_code = ?")
    .bind(normalizedCode)
    .first<{ user_id: string }>();

  if (!referrer?.user_id) {
    throw new Error("Referral code not found.");
  }

  if (referrer.user_id === referredUserId) {
    throw new Error("Cannot use your own referral code.");
  }

  const insert = await db
    .prepare(
      `INSERT OR IGNORE INTO referrals
       (referrer_user_id, referred_user_id, referral_code, status, points_awarded, rewarded_at)
       VALUES (?, ?, ?, 'rewarded', ?, CURRENT_TIMESTAMP)`,
    )
    .bind(referrer.user_id, referredUserId, normalizedCode, POINTS.REFERRAL_REFERRER + POINTS.REFERRAL_NEW_USER)
    .run();

  if (Number(insert.meta.changes ?? 0) === 0) {
    throw new Error("Referral already linked to this account.");
  }

  await db
    .prepare(
      `UPDATE user_gamification_profiles
       SET referred_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
    )
    .bind(referrer.user_id, referredUserId)
    .run();

  const referrerPoints = await awardPoints(db, referrer.user_id, "referral_reward", POINTS.REFERRAL_REFERRER, {
    referredUserId,
  });
  const referredPoints = await awardPoints(db, referredUserId, "referral_signup_bonus", POINTS.REFERRAL_NEW_USER, {
    referrerUserId: referrer.user_id,
  });

  return {
    referrerUserId: referrer.user_id,
    referrerPoints,
    referredPoints,
  };
}

export async function createBounty(db: D1Database, input: CreateBountyInput): Promise<BountyRecord> {
  const result = await db
    .prepare(
      `INSERT INTO bounties (title, description, target_identifier, platform, reward_points, priority, status, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .bind(
      input.title,
      input.description,
      input.targetIdentifier,
      input.platform,
      Math.max(1, Math.floor(input.rewardPoints)),
      input.priority,
      input.createdByUserId ?? null,
    )
    .run();

  const bountyId = Number(result.meta.last_row_id ?? 0);
  const bounty = await getBountyById(db, bountyId);
  if (!bounty) {
    throw new Error("Bounty creation failed.");
  }
  return bounty;
}

async function getSeedBountyByIdentity(
  db: D1Database,
  template: SeedBountyTemplate,
): Promise<BountyRecord | null> {
  const row = await db
    .prepare(
      `SELECT * FROM bounties
       WHERE title = ? AND target_identifier = ? AND platform = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(template.title, template.targetIdentifier, template.platform)
    .first<BountyRow>();

  return row ? mapBounty(row) : null;
}

export async function seedFirstMonthlyBounties(
  db: D1Database,
  createdByUserId: string | null,
  templates: readonly SeedBountyTemplate[] = FIRST_MONTHLY_BOUNTIES,
): Promise<SeedBountiesResult> {
  const created: BountyRecord[] = [];
  const existing: BountyRecord[] = [];

  for (const template of templates) {
    const insert = await db
      .prepare(
        `INSERT INTO bounties (title, description, target_identifier, platform, reward_points, priority, status, created_by_user_id)
         SELECT ?, ?, ?, ?, ?, ?, 'open', ?
         WHERE NOT EXISTS (
           SELECT 1 FROM bounties
           WHERE title = ? AND target_identifier = ? AND platform = ?
         )`,
      )
      .bind(
        template.title,
        template.description,
        template.targetIdentifier,
        template.platform,
        Math.max(1, Math.floor(template.rewardPoints)),
        template.priority,
        createdByUserId,
        template.title,
        template.targetIdentifier,
        template.platform,
      )
      .run();

    if (Number(insert.meta.changes ?? 0) > 0) {
      const bountyId = Number(insert.meta.last_row_id ?? 0);
      const bounty = await getBountyById(db, bountyId);
      if (!bounty) {
        throw new Error("Seeded bounty missing after insert.");
      }
      created.push(bounty);
      continue;
    }

    const bounty = await getSeedBountyByIdentity(db, template);
    if (bounty) {
      existing.push(bounty);
      continue;
    }

    // Safety fallback for unusual D1 metadata responses.
    const fallback = await createBounty(db, { ...template, createdByUserId });
    created.push(fallback);
  }

  return {
    created,
    existing,
  };
}

export async function listBounties(
  db: D1Database,
  status: "open" | "claimed" | "closed" | "all" = "open",
  limit = 25,
): Promise<BountyRecord[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const statusFilter = status === "all" ? null : status;

  const sql = statusFilter
    ? `SELECT * FROM bounties WHERE status = ?
       ORDER BY CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
                created_at DESC
       LIMIT ?`
    : `SELECT * FROM bounties
       ORDER BY CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
                created_at DESC
       LIMIT ?`;

  const query = db.prepare(sql);
  const result = statusFilter
    ? await query.bind(statusFilter, safeLimit).all<BountyRow>()
    : await query.bind(safeLimit).all<BountyRow>();

  return (result.results ?? []).map(mapBounty);
}

export async function getBountyById(db: D1Database, bountyId: number): Promise<BountyRecord | null> {
  const row = await db.prepare("SELECT * FROM bounties WHERE id = ?").bind(bountyId).first<BountyRow>();
  return row ? mapBounty(row) : null;
}

export async function claimBounty(db: D1Database, bountyId: number, userId: string): Promise<BountyRecord> {
  await ensureGamificationProfile(db, userId);

  const result = await db
    .prepare(
      `UPDATE bounties
       SET status = 'claimed',
           claimed_by_user_id = ?,
           claimed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'open'`,
    )
    .bind(userId, bountyId)
    .run();

  if (Number(result.meta.changes ?? 0) === 0) {
    const existing = await getBountyById(db, bountyId);
    if (!existing) {
      throw new Error("Bounty not found.");
    }
    if (existing.status !== "open") {
      throw new Error("Bounty is no longer open.");
    }
    throw new Error("Bounty claim failed.");
  }

  const updated = await getBountyById(db, bountyId);
  if (!updated) {
    throw new Error("Bounty not found after claim.");
  }
  return updated;
}

export async function completeBounty(
  db: D1Database,
  bountyId: number,
  winnerUserId?: string,
  today = toIsoDay(),
  idempotencyKey?: string,
): Promise<BountyCompletionResult> {
  const bounty = await getBountyById(db, bountyId);
  if (!bounty) {
    throw new Error("Bounty not found.");
  }

  if (bounty.status === "closed") {
    const winner = bounty.claimedByUserId;
    if (!winner) {
      throw new Error("Closed bounty has no winner.");
    }
    return {
      bounty,
      winnerUserId: winner,
      awardedPoints: 0,
    };
  }

  const finalWinner = winnerUserId ?? bounty.claimedByUserId;
  if (!finalWinner) {
    throw new Error("Bounty must be claimed before completion.");
  }

  await ensureGamificationProfile(db, finalWinner);
  const resolvedIdempotencyKey = idempotencyKey ?? `bounty_complete:${bountyId}:${finalWinner}`;

  return withSavepoint(db, async () => {
    const canProceed = await claimIdempotencyKey(db, "bounty_complete", resolvedIdempotencyKey, finalWinner);
    if (!canProceed) {
      const existing = await getBountyById(db, bountyId);
      if (!existing) {
        throw new Error("Bounty not found.");
      }
      return {
        bounty: existing,
        winnerUserId: existing.claimedByUserId ?? finalWinner,
        awardedPoints: 0,
      };
    }

    const closeResult = await db
      .prepare(
        `UPDATE bounties
         SET status = 'closed',
             claimed_by_user_id = ?,
             closed_at = CURRENT_TIMESTAMP,
             claimed_at = COALESCE(claimed_at, CURRENT_TIMESTAMP)
         WHERE id = ? AND status != 'closed'`,
      )
      .bind(finalWinner, bountyId)
      .run();

    if (Number(closeResult.meta.changes ?? 0) === 0) {
      const existing = await getBountyById(db, bountyId);
      if (!existing) {
        throw new Error("Bounty not found.");
      }
      return {
        bounty: existing,
        winnerUserId: existing.claimedByUserId ?? finalWinner,
        awardedPoints: 0,
      };
    }

    await touchDailyStreak(db, finalWinner, today);
    const awardedPoints = await awardPoints(
      db,
      finalWinner,
      "bounty_completed",
      Math.max(1, bounty.rewardPoints || POINTS.BOUNTY_COMPLETED_DEFAULT),
      {
        bountyId,
        title: bounty.title,
      },
      today,
      false,
      `${resolvedIdempotencyKey}:points`,
    );

    const updated = await getBountyById(db, bountyId);
    if (!updated) {
      throw new Error("Bounty not found after completion.");
    }

    return {
      bounty: updated,
      winnerUserId: finalWinner,
      awardedPoints,
    };
  });
}

export async function seedFirstMonthlyCompetition(
  db: D1Database,
  input: SeedMonthlyCompetitionInput = {},
): Promise<SeedMonthlyCompetitionResult> {
  const monthKey = input.monthKey ?? currentMonthKey();
  monthRange(monthKey); // validates shape and month bounds before insert

  const name = input.name ?? `ScamShield ${monthKey} Kickoff Competition`;
  const prizePoolCents = Math.max(0, Math.floor(input.prizePoolCents ?? 150_000));
  const currency = (input.currency ?? "USD").toUpperCase();
  const sponsor = input.sponsor === undefined ? "ScamShield Community Partners" : input.sponsor;
  const rules = input.rules ?? FIRST_MONTHLY_COMPETITION_RULES;

  const insert = await db
    .prepare(
      `INSERT INTO monthly_competitions
       (month_key, name, prize_pool_cents, currency, sponsor, status, rules_json)
       VALUES (?, ?, ?, ?, ?, 'active', ?)
       ON CONFLICT(month_key) DO NOTHING`,
    )
    .bind(
      monthKey,
      name,
      prizePoolCents,
      currency,
      sponsor ?? null,
      JSON.stringify(rules),
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM monthly_competitions WHERE month_key = ?")
    .bind(monthKey)
    .first<MonthlyCompetitionRow>();

  if (!row) {
    throw new Error("Monthly competition not found after seed.");
  }

  return {
    competition: mapMonthlyCompetition(row),
    created: Number(insert.meta.changes ?? 0) > 0,
  };
}

export async function ensureMonthlyCompetition(
  db: D1Database,
  monthKey = currentMonthKey(),
): Promise<MonthlyCompetitionRecord> {
  const defaults = {
    monthKey,
    name: `ScamShield ${monthKey} Monthly Hunt`,
    prizePoolCents: 0,
    currency: "USD",
    sponsor: null,
    status: "active",
    rules: {
      scoring: "Points from reports, streaks, referrals, and bounties.",
      payout: "Cash prizes are subject to verification and admin approval.",
    },
  } satisfies UpsertCompetitionInput;

  return upsertMonthlyCompetition(db, defaults);
}

export async function upsertMonthlyCompetition(
  db: D1Database,
  input: UpsertCompetitionInput,
): Promise<MonthlyCompetitionRecord> {
  const status = input.status ?? "active";
  const currency = (input.currency || "USD").toUpperCase();

  await db
    .prepare(
      `INSERT INTO monthly_competitions
       (month_key, name, prize_pool_cents, currency, sponsor, status, rules_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(month_key) DO UPDATE SET
         name = excluded.name,
         prize_pool_cents = excluded.prize_pool_cents,
         currency = excluded.currency,
         sponsor = excluded.sponsor,
         status = excluded.status,
         rules_json = excluded.rules_json,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      input.monthKey,
      input.name,
      Math.max(0, Math.floor(input.prizePoolCents)),
      currency,
      input.sponsor ?? null,
      status,
      JSON.stringify(input.rules ?? {}),
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM monthly_competitions WHERE month_key = ?")
    .bind(input.monthKey)
    .first<MonthlyCompetitionRow>();

  if (!row) {
    throw new Error("Monthly competition not found after upsert.");
  }

  return mapMonthlyCompetition(row);
}

export async function getMonthlyCompetitionLeaderboard(
  db: D1Database,
  monthKey = currentMonthKey(),
  limit = 20,
): Promise<MonthlyCompetitionLeaderboardEntry[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const range = monthRange(monthKey);

  const rows = await db
    .prepare(
      `SELECT p.user_id, u.email, SUM(p.points) as points
       FROM points_ledger p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.day >= ? AND p.day < ?
       GROUP BY p.user_id
       ORDER BY points DESC
       LIMIT ?`,
    )
    .bind(range.start, range.endExclusive, safeLimit)
    .all<{ user_id: string; email: string | null; points: number }>();

  return (rows.results ?? []).map((row, idx) => ({
    rank: idx + 1,
    userId: row.user_id,
    displayName: row.email ? maskEmailForLeaderboard(row.email) : "anonymous",
    points: Number(row.points),
  }));
}

export async function getCompetitionWinners(db: D1Database, competitionId: number): Promise<CompetitionWinner[]> {
  const rows = await db
    .prepare(
      `SELECT w.user_id, u.email, w.rank, w.points, w.prize_cents, w.created_at
       FROM competition_winners w
       LEFT JOIN users u ON u.id = w.user_id
       WHERE w.competition_id = ?
       ORDER BY w.rank ASC`,
    )
    .bind(competitionId)
    .all<CompetitionWinnerRow>();

  return (rows.results ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.email ? maskEmailForLeaderboard(row.email) : "anonymous",
    rank: Number(row.rank),
    points: Number(row.points),
    prizeCents: Number(row.prize_cents),
    createdAt: row.created_at,
  }));
}

export async function getMonthlyCompetitionOverview(
  db: D1Database,
  monthKey = currentMonthKey(),
  leaderboardLimit = 20,
): Promise<MonthlyCompetitionOverview> {
  const competition = await ensureMonthlyCompetition(db, monthKey);
  const leaderboard = await getMonthlyCompetitionLeaderboard(db, monthKey, leaderboardLimit);
  const winners = await getCompetitionWinners(db, competition.id);

  return {
    competition,
    leaderboard,
    winners,
  };
}

export async function createCashPrize(db: D1Database, input: CreateCashPrizeInput): Promise<CashPrizeRecord> {
  const currency = (input.currency || "USD").toUpperCase();
  const status = input.status ?? "pending";

  const result = await db
    .prepare(
      `INSERT INTO cash_prizes
       (user_id, competition_id, amount_cents, currency, partner_name, status, payout_reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.userId,
      input.competitionId ?? null,
      Math.max(0, Math.floor(input.amountCents)),
      currency,
      input.partnerName ?? null,
      status,
      input.payoutReference ?? null,
      input.notes ?? null,
    )
    .run();

  const prizeId = Number(result.meta.last_row_id ?? 0);
  const prize = await getCashPrizeById(db, prizeId);
  if (!prize) {
    throw new Error("Cash prize not found after creation.");
  }
  return prize;
}

export async function updateCashPrizeStatus(
  db: D1Database,
  cashPrizeId: number,
  input: UpdateCashPrizeStatusInput,
): Promise<CashPrizeRecord> {
  await db
    .prepare(
      `UPDATE cash_prizes
       SET status = ?,
           payout_reference = COALESCE(?, payout_reference),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(input.status, input.payoutReference ?? null, input.notes ?? null, cashPrizeId)
    .run();

  const prize = await getCashPrizeById(db, cashPrizeId);
  if (!prize) {
    throw new Error("Cash prize not found.");
  }
  return prize;
}

export async function getCashPrizeById(db: D1Database, cashPrizeId: number): Promise<CashPrizeRecord | null> {
  const row = await db
    .prepare(
      `SELECT cp.id, cp.user_id, u.email, cp.competition_id, cp.amount_cents, cp.currency, cp.partner_name,
              cp.status, cp.payout_reference, cp.notes, cp.created_at, cp.updated_at
       FROM cash_prizes cp
       LEFT JOIN users u ON u.id = cp.user_id
       WHERE cp.id = ?`,
    )
    .bind(cashPrizeId)
    .first<CashPrizeRow>();

  return row ? mapCashPrize(row) : null;
}

export async function listCashPrizes(
  db: D1Database,
  options: { userId?: string; status?: string; limit?: number } = {},
): Promise<CashPrizeRecord[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 25)));

  if (options.userId && options.status) {
    const rows = await db
      .prepare(
        `SELECT cp.id, cp.user_id, u.email, cp.competition_id, cp.amount_cents, cp.currency, cp.partner_name,
                cp.status, cp.payout_reference, cp.notes, cp.created_at, cp.updated_at
         FROM cash_prizes cp
         LEFT JOIN users u ON u.id = cp.user_id
         WHERE cp.user_id = ? AND cp.status = ?
         ORDER BY cp.created_at DESC
         LIMIT ?`,
      )
      .bind(options.userId, options.status, safeLimit)
      .all<CashPrizeRow>();
    return (rows.results ?? []).map(mapCashPrize);
  }

  if (options.userId) {
    const rows = await db
      .prepare(
        `SELECT cp.id, cp.user_id, u.email, cp.competition_id, cp.amount_cents, cp.currency, cp.partner_name,
                cp.status, cp.payout_reference, cp.notes, cp.created_at, cp.updated_at
         FROM cash_prizes cp
         LEFT JOIN users u ON u.id = cp.user_id
         WHERE cp.user_id = ?
         ORDER BY cp.created_at DESC
         LIMIT ?`,
      )
      .bind(options.userId, safeLimit)
      .all<CashPrizeRow>();
    return (rows.results ?? []).map(mapCashPrize);
  }

  if (options.status) {
    const rows = await db
      .prepare(
        `SELECT cp.id, cp.user_id, u.email, cp.competition_id, cp.amount_cents, cp.currency, cp.partner_name,
                cp.status, cp.payout_reference, cp.notes, cp.created_at, cp.updated_at
         FROM cash_prizes cp
         LEFT JOIN users u ON u.id = cp.user_id
         WHERE cp.status = ?
         ORDER BY cp.created_at DESC
         LIMIT ?`,
      )
      .bind(options.status, safeLimit)
      .all<CashPrizeRow>();
    return (rows.results ?? []).map(mapCashPrize);
  }

  const rows = await db
    .prepare(
      `SELECT cp.id, cp.user_id, u.email, cp.competition_id, cp.amount_cents, cp.currency, cp.partner_name,
              cp.status, cp.payout_reference, cp.notes, cp.created_at, cp.updated_at
       FROM cash_prizes cp
       LEFT JOIN users u ON u.id = cp.user_id
       ORDER BY cp.created_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<CashPrizeRow>();
  return (rows.results ?? []).map(mapCashPrize);
}
export async function createBrandPartnership(
  db: D1Database,
  input: CreateBrandPartnershipInput,
): Promise<BrandPartnershipRecord> {
  const result = await db
    .prepare(
      `INSERT INTO brand_partnerships
       (brand_name, contact_email, prize_type, contribution_cents, currency, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.brandName,
      input.contactEmail ?? null,
      input.prizeType,
      Math.max(0, Math.floor(input.contributionCents ?? 0)),
      (input.currency ?? "USD").toUpperCase(),
      input.status ?? "pipeline",
      input.notes ?? null,
    )
    .run();

  const partnerId = Number(result.meta.last_row_id ?? 0);
  const partner = await getBrandPartnershipById(db, partnerId);
  if (!partner) {
    throw new Error("Brand partnership not found after creation.");
  }
  return partner;
}

export async function getBrandPartnershipById(
  db: D1Database,
  partnershipId: number,
): Promise<BrandPartnershipRecord | null> {
  const row = await db
    .prepare("SELECT * FROM brand_partnerships WHERE id = ?")
    .bind(partnershipId)
    .first<BrandPartnershipRow>();
  return row ? mapBrandPartnership(row) : null;
}

export async function listBrandPartnerships(
  db: D1Database,
  status?: string,
  limit = 25,
): Promise<BrandPartnershipRecord[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const rows = status
    ? await db
      .prepare("SELECT * FROM brand_partnerships WHERE status = ? ORDER BY created_at DESC LIMIT ?")
      .bind(status, safeLimit)
      .all<BrandPartnershipRow>()
    : await db
      .prepare("SELECT * FROM brand_partnerships ORDER BY created_at DESC LIMIT ?")
      .bind(safeLimit)
      .all<BrandPartnershipRow>();

  return (rows.results ?? []).map(mapBrandPartnership);
}

export async function finalizeMonthlyCompetition(
  db: D1Database,
  monthKey: string,
  payoutCentsByRank: number[],
  partnerName?: string,
): Promise<FinalizeCompetitionResult> {
  const competition = await ensureMonthlyCompetition(db, monthKey);
  const top = Math.max(1, Math.min(10, payoutCentsByRank.length || 3));
  const leaderboard = await getMonthlyCompetitionLeaderboard(db, monthKey, top);

  await db
    .prepare("UPDATE monthly_competitions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(competition.id)
    .run();

  const prizes: CashPrizeRecord[] = [];

  for (const entry of leaderboard) {
    const rank = entry.rank;
    const prizeCents = Math.max(0, Math.floor(payoutCentsByRank[rank - 1] ?? 0));

    await db
      .prepare(
        `INSERT INTO competition_winners (competition_id, user_id, rank, points, prize_cents)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(competition_id, rank) DO UPDATE SET
           user_id = excluded.user_id,
           points = excluded.points,
           prize_cents = excluded.prize_cents`,
      )
      .bind(competition.id, entry.userId, rank, entry.points, prizeCents)
      .run();

    if (prizeCents > 0) {
      const prize = await createCashPrize(db, {
        userId: entry.userId,
        competitionId: competition.id,
        amountCents: prizeCents,
        currency: competition.currency,
        partnerName: partnerName ?? competition.sponsor ?? null,
        status: "pending",
        notes: `Auto-created from ${competition.monthKey} monthly competition (rank ${rank}).`,
      });
      prizes.push(prize);
    }
  }

  const finalizedCompetitionRow = await db
    .prepare("SELECT * FROM monthly_competitions WHERE id = ?")
    .bind(competition.id)
    .first<MonthlyCompetitionRow>();

  if (!finalizedCompetitionRow) {
    throw new Error("Competition missing after finalization.");
  }

  const winners = await getCompetitionWinners(db, competition.id);

  return {
    competition: mapMonthlyCompetition(finalizedCompetitionRow),
    winners,
    prizes,
  };
}

export async function getGamificationAdminSnapshot(db: D1Database): Promise<GamificationAdminSnapshot> {
  const [
    totalPointsAwarded,
    premiumUsers,
    openBounties,
    pendingCashPrizes,
    activePartnerships,
    leaderboard,
    activeCompetition,
    recentCashPrizes,
  ] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(points), 0) as total FROM points_ledger").first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) as total FROM user_gamification_profiles WHERE premium_unlocked = 1").first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) as total FROM bounties WHERE status IN ('open', 'claimed')").first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) as total FROM cash_prizes WHERE status IN ('pending', 'approved')").first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) as total FROM brand_partnerships WHERE status = 'active'").first<{ total: number }>(),
    getLeaderboard(db, 10),
    ensureMonthlyCompetition(db, currentMonthKey()),
    listCashPrizes(db, { limit: 10 }),
  ]);

  return {
    totalPointsAwarded: Number(totalPointsAwarded?.total ?? 0),
    premiumUsers: Number(premiumUsers?.total ?? 0),
    openBounties: Number(openBounties?.total ?? 0),
    pendingCashPrizes: Number(pendingCashPrizes?.total ?? 0),
    activePartnerships: Number(activePartnerships?.total ?? 0),
    leaderboard,
    activeCompetition,
    recentCashPrizes,
  };
}

export function getCompetitionMonthKey(day = toIsoDay()): string {
  return currentMonthKey(day);
}

export async function getPointBalance(db: D1Database, userId: string): Promise<number> {
  await ensureGamificationProfile(db, userId);
  const row = await getProfileRow(db, userId);
  return Number(row?.total_points ?? 0);
}

export function canUnlockPremium(totalPoints: number, streakDays: number, alreadyUnlocked = false): boolean {
  return isPremiumUnlocked(totalPoints, streakDays, alreadyUnlocked);
}
