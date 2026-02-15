const API_BASE = ''

async function ensureCsrfToken(): Promise<string | null> {
  let csrf = getCsrfToken()
  if (!csrf) {
    try {
      const res = await fetch(`${API_BASE}/api/csrf-token`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        csrf = data.token
      }
    } catch {
      // Ignore errors, will send request without CSRF
    }
  }
  return csrf
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/scamshield_csrf=([^;]+)/)
  return match ? match[1] : null
}

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const csrf = await ensureCsrfToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`)
  return data as T
}

// Auth
export interface AuthMeResponse {
  authenticated: boolean
  email?: string
  role?: string
  usage?: { used: number; limit: number; remaining: number }
  gamification?: { totalPoints: number; currentStreakDays: number; premiumUnlocked: boolean } | null
}

export const authMe = () => fetchJSON<AuthMeResponse>('/api/auth/me')
export const authLogout = () => fetch('/api/auth/logout', { credentials: 'same-origin' })

// Verdict
export interface VerdictResponse {
  key: string
  verdict: 'LEGIT' | 'HIGH_RISK' | 'UNKNOWN'
  score: number
  reasons: string[]
  sources: string[]
  nextActions: string[]
  pendingEnrichment?: boolean
  cached?: boolean
}

export const submitVerdict = (type: string, value: string, chain?: string) =>
  fetchJSON<VerdictResponse>('/api/verdict', {
    method: 'POST',
    body: JSON.stringify({ type, value, chain }),
  })

// Playbook
export interface PlaybookResponse {
  killerPitch: string
  playbook: { reportChannels: { name: string; action: string; url?: string }[] }
  recoveryTasks: { id: string; label: string; why: string; weight: number }[]
}

export const getPlaybook = () => fetchJSON<PlaybookResponse>('/api/playbook')

// Reports
export interface ReportPayload {
  incidentTitle: string
  scamType: string
  occurredAt: string
  channel: string
  suspects: string[]
  losses: string
  actionsTaken: string[]
  extraNotes: string
}

export interface ReportsResponse {
  forBank: string
  forPolice: string
  forPlatform: string
  mode?: string
  fallback?: boolean
}

export const generateReports = (payload: ReportPayload) =>
  fetchJSON<ReportsResponse>('/api/report/generate', { method: 'POST', body: JSON.stringify(payload) })

export const generateAIReports = (payload: ReportPayload) =>
  fetchJSON<ReportsResponse>('/api/report/generate-ai', { method: 'POST', body: JSON.stringify(payload) })

// Warning Card
export interface WarningCardResponse {
  warningPageUrl: string
  imageUrl: string
  slug: string
}

export const createWarningCard = (data: { verdict: string; headline: string; identifiers: Record<string, string>; reasons: string[] }) =>
  fetchJSON<WarningCardResponse>('/api/warning-card', { method: 'POST', body: JSON.stringify(data) })

// AI Chat
export interface ChatResponse {
  message: string
  options?: Array<{ text: string; action: string }>
  error?: string
}

export const sendChatMessage = (messages: { role: string; content: string }[]) =>
  fetchJSON<ChatResponse>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) })

// Recovery
export const updateRecoveryProgress = (completedTaskIds: string[]) =>
  fetchJSON<{ progress: number }>('/api/recovery-progress', { method: 'POST', body: JSON.stringify({ completedTaskIds }) })

// Heatmap
export const getHeatmap = () => fetchJSON<{ grid: { platform: string; category: string; count: number; trend: string }[] }>('/api/heatmap')

// Dashboard
export interface UsageHistoryEntry {
  action: string
  day: string
  timestamp: string
}

export interface UserAchievement {
  code: string
  title: string
  description: string
  awardedAt: string
}

export interface PremiumState {
  unlocked: boolean
  remainingPoints: number
  remainingStreakDays: number
  reasons: string[]
}

export interface GamificationProfile {
  userId: string
  totalPoints: number
  currentStreakDays: number
  longestStreakDays: number
  lastActivityDay: string | null
  reportsSubmitted: number
  premiumUnlocked: boolean
  premium: PremiumState
  premiumFeatures: readonly string[]
  referralCode: string
  referredByUserId: string | null
  achievements: UserAchievement[]
}

export interface ReferralDetail {
  displayName: string
  createdAt: string
  pointsAwarded: number
}

export interface ReferralSummary {
  referralCode: string
  totalReferrals: number
  rewardedPoints: number
  referrals: ReferralDetail[]
}

export interface MonthlyCompetitionRecord {
  id: number
  monthKey: string
  name: string
  prizePoolCents: number
  currency: string
  sponsor: string | null
  status: string
  rules: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface MonthlyCompetitionLeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  points: number
}

export interface CompetitionWinner {
  userId: string
  displayName: string
  rank: number
  points: number
  prizeCents: number
  createdAt: string
}

export interface MonthlyCompetitionOverview {
  competition: MonthlyCompetitionRecord
  leaderboard: MonthlyCompetitionLeaderboardEntry[]
  winners: CompetitionWinner[]
}

export interface BountyRecord {
  id: number
  title: string
  description: string
  targetIdentifier: string
  platform: string
  rewardPoints: number
  priority: string
  status: string
  createdByUserId: string | null
  claimedByUserId: string | null
  createdAt: string
  claimedAt: string | null
  closedAt: string | null
}

export interface CashPrizeRecord {
  id: number
  userId: string
  displayName: string
  competitionId: number | null
  amountCents: number
  currency: string
  partnerName: string | null
  status: string
  payoutReference: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardClientResponse {
  email: string
  role: string
  quota: { used: number; limit: number; remaining: number; day: string }
  history: UsageHistoryEntry[]
  gamification: GamificationProfile
  referrals: ReferralSummary
  competition: MonthlyCompetitionOverview
  bounties: BountyRecord[]
  prizes: CashPrizeRecord[]
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  totalPoints: number
  currentStreakDays: number
  reportsSubmitted: number
  premiumUnlocked: boolean
}

export interface BrandPartnershipRecord {
  id: number
  brandName: string
  contactEmail: string | null
  prizeType: string
  contributionCents: number
  currency: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface GamificationAdminSnapshot {
  totalPointsAwarded: number
  premiumUsers: number
  openBounties: number
  pendingCashPrizes: number
  activePartnerships: number
  leaderboard: LeaderboardEntry[]
  activeCompetition: MonthlyCompetitionRecord
  recentCashPrizes: CashPrizeRecord[]
}

export interface DashboardAdminResponse {
  day: string
  totalUsers: number
  todayUsage: number
  topUsers: Array<{ email: string; usage_count: number }>
  scamStats: Record<string, unknown>
  heatmap: { platform: string; category: string; count: number; trend: string }[]
  gamification: GamificationAdminSnapshot
  bounties: BountyRecord[]
  partnerships: BrandPartnershipRecord[]
}

export interface LeaderboardResponse {
  generatedAt: string
  leaderboard: LeaderboardEntry[]
}

export const getDashboardClient = () => fetchJSON<DashboardClientResponse>('/api/dashboard/client')
export const getDashboardAdmin = () => fetchJSON<DashboardAdminResponse>('/api/dashboard/admin')
export const getLeaderboard = (limit = 50) => fetchJSON<LeaderboardResponse>(`/api/leaderboard?limit=${limit}`)
export const applyReferralCode = (code: string) =>
  fetchJSON<{ referrerUserId: string; referrerPoints: number; referredPoints: number }>('/api/referrals/apply', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
export const claimBounty = (bountyId: number) => fetchJSON<{ bounty: BountyRecord }>(`/api/bounties/${bountyId}/claim`, { method: 'POST' })
