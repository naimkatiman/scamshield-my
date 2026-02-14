export const POINTS = {
  REPORT_SUBMITTED: 30,
  WARNING_CARD_CREATED: 12,
  DAILY_STREAK: 5,
  REFERRAL_REFERRER: 120,
  REFERRAL_NEW_USER: 40,
  BOUNTY_COMPLETED_DEFAULT: 150,
} as const;

export const PREMIUM_UNLOCK_POINTS = 500;
export const PREMIUM_UNLOCK_STREAK_DAYS = 7;

export interface ReportAchievementDefinition {
  code: string;
  title: string;
  description: string;
  reportThreshold: number;
  bonusPoints: number;
}

export const REPORT_ACHIEVEMENTS: ReadonlyArray<ReportAchievementDefinition> = [
  {
    code: "REPORT_MILESTONE_1",
    title: "First Responder",
    description: "Submitted your first verified community report.",
    reportThreshold: 1,
    bonusPoints: 20,
  },
  {
    code: "REPORT_MILESTONE_5",
    title: "Signal Booster",
    description: "Submitted 5 reports to warn the community.",
    reportThreshold: 5,
    bonusPoints: 35,
  },
  {
    code: "REPORT_MILESTONE_10",
    title: "Scam Hunter",
    description: "Reached 10 report submissions.",
    reportThreshold: 10,
    bonusPoints: 60,
  },
  {
    code: "REPORT_MILESTONE_25",
    title: "Network Guardian",
    description: "Submitted 25 reports with sustained impact.",
    reportThreshold: 25,
    bonusPoints: 120,
  },
  {
    code: "REPORT_MILESTONE_50",
    title: "Community Sentinel",
    description: "Submitted 50 reports to protect others.",
    reportThreshold: 50,
    bonusPoints: 250,
  },
];

export interface PremiumState {
  unlocked: boolean;
  remainingPoints: number;
  remainingStreakDays: number;
  reasons: string[];
}

export const PREMIUM_FEATURES: readonly string[] = [
  "Priority bounty board access",
  "Monthly competition eligibility",
  "Premium leaderboard badge",
];

function dayToEpoch(day: string): number | null {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(date)) {
    return null;
  }
  return Date.UTC(year, month - 1, date);
}

export function toIsoDay(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}

export function dayDifference(fromDay: string, toDay: string): number | null {
  const fromEpoch = dayToEpoch(fromDay);
  const toEpoch = dayToEpoch(toDay);
  if (fromEpoch === null || toEpoch === null) {
    return null;
  }
  return Math.floor((toEpoch - fromEpoch) / 86_400_000);
}

export interface StreakComputation {
  isNewDay: boolean;
  nextStreakDays: number;
  longestStreakDays: number;
  wasReset: boolean;
}

export function computeStreakProgress(
  lastActivityDay: string | null,
  currentStreakDays: number,
  longestStreakDays: number,
  today: string,
): StreakComputation {
  if (!lastActivityDay) {
    return {
      isNewDay: true,
      nextStreakDays: 1,
      longestStreakDays: Math.max(longestStreakDays, 1),
      wasReset: false,
    };
  }

  const diff = dayDifference(lastActivityDay, today);
  if (diff === null || diff < 0) {
    return {
      isNewDay: false,
      nextStreakDays: currentStreakDays,
      longestStreakDays,
      wasReset: false,
    };
  }

  if (diff === 0) {
    return {
      isNewDay: false,
      nextStreakDays: currentStreakDays,
      longestStreakDays,
      wasReset: false,
    };
  }

  if (diff === 1) {
    const next = Math.max(1, currentStreakDays + 1);
    return {
      isNewDay: true,
      nextStreakDays: next,
      longestStreakDays: Math.max(longestStreakDays, next),
      wasReset: false,
    };
  }

  return {
    isNewDay: true,
    nextStreakDays: 1,
    longestStreakDays: Math.max(longestStreakDays, 1),
    wasReset: true,
  };
}

export function getUnlockedReportAchievements(
  reportsSubmitted: number,
  existingCodes: Iterable<string>,
): ReportAchievementDefinition[] {
  const unlocked = new Set(existingCodes);
  return REPORT_ACHIEVEMENTS.filter(
    (achievement) => reportsSubmitted >= achievement.reportThreshold && !unlocked.has(achievement.code),
  );
}

export function isPremiumUnlocked(totalPoints: number, streakDays: number, alreadyUnlocked = false): boolean {
  if (alreadyUnlocked) return true;
  return totalPoints >= PREMIUM_UNLOCK_POINTS || streakDays >= PREMIUM_UNLOCK_STREAK_DAYS;
}

export function buildPremiumState(totalPoints: number, streakDays: number, alreadyUnlocked = false): PremiumState {
  const unlocked = isPremiumUnlocked(totalPoints, streakDays, alreadyUnlocked);
  if (unlocked) {
    return {
      unlocked: true,
      remainingPoints: 0,
      remainingStreakDays: 0,
      reasons: [
        totalPoints >= PREMIUM_UNLOCK_POINTS
          ? `Unlocked by points (${totalPoints}/${PREMIUM_UNLOCK_POINTS}).`
          : `Unlocked by streak (${streakDays}/${PREMIUM_UNLOCK_STREAK_DAYS} days).`,
      ],
    };
  }

  return {
    unlocked: false,
    remainingPoints: Math.max(0, PREMIUM_UNLOCK_POINTS - totalPoints),
    remainingStreakDays: Math.max(0, PREMIUM_UNLOCK_STREAK_DAYS - streakDays),
    reasons: [
      `Earn ${Math.max(0, PREMIUM_UNLOCK_POINTS - totalPoints)} more points or keep a ${PREMIUM_UNLOCK_STREAK_DAYS}-day streak.`,
    ],
  };
}

export function maskEmailForLeaderboard(email: string): string {
  const trimmed = email.trim();
  const [localRaw, domainRaw] = trimmed.split("@");
  if (!localRaw || !domainRaw) return "anonymous";
  const local = localRaw.length <= 2
    ? `${localRaw[0] ?? "*"}*`
    : `${localRaw.slice(0, 2)}${"*".repeat(Math.max(1, localRaw.length - 2))}`;
  return `${local}@${domainRaw}`;
}
