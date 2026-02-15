import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Gauge,
  Trophy,
  History,
  Award,
  Medal,
  Crown,
  Copy,
  Share2,
  Target,
  Lock,
  CheckCircle2,
  Flag,
  CalendarDays,
  Gift,
  RefreshCcw,
  Crosshair,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/Progress'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { useToast } from '../context/ToastContext'
import { applyReferralCode, claimBounty, getDashboardClient, type DashboardClientResponse, type UserAchievement } from '../lib/api'

const ACHIEVEMENT_MILESTONES = [
  {
    code: 'REPORT_MILESTONE_1',
    title: 'First Responder',
    description: 'Submit 1 verified report',
    reportThreshold: 1,
    bonusPoints: 20,
  },
  {
    code: 'REPORT_MILESTONE_5',
    title: 'Signal Booster',
    description: 'Submit 5 community reports',
    reportThreshold: 5,
    bonusPoints: 35,
  },
  {
    code: 'REPORT_MILESTONE_10',
    title: 'Scam Hunter',
    description: 'Reach 10 reports',
    reportThreshold: 10,
    bonusPoints: 60,
  },
  {
    code: 'REPORT_MILESTONE_25',
    title: 'Network Guardian',
    description: 'Sustain 25 reports',
    reportThreshold: 25,
    bonusPoints: 120,
  },
  {
    code: 'REPORT_MILESTONE_50',
    title: 'Community Sentinel',
    description: 'Protect others with 50 reports',
    reportThreshold: 50,
    bonusPoints: 250,
  },
] as const

const PREMIUM_POINT_TARGET = 500
const PREMIUM_STREAK_TARGET = 7

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
}

function formatCurrencyFromCents(cents: number, currency = 'USD'): string {
  const amount = Number(cents || 0) / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function priorityClass(priority: string): string {
  const normalized = priority.toLowerCase()
  if (normalized === 'critical') return 'threat-badge-critical'
  if (normalized === 'high') return 'threat-badge-high'
  if (normalized === 'low') return 'threat-badge-low'
  return 'threat-badge-medium'
}

function prizeStatusClass(status: string): string {
  const normalized = status.toLowerCase()
  if (normalized === 'paid') return 'text-safe'
  if (normalized === 'approved') return 'text-cyber'
  if (normalized === 'cancelled') return 'text-threat-critical'
  return 'text-threat-medium'
}

function collectNewAchievements(previous: Set<string>, current: UserAchievement[]): UserAchievement[] {
  return current.filter((achievement) => !previous.has(achievement.code))
}

export function Dashboard() {
  const { user, isAuthenticated, quota, login } = useAuth()
  const { t } = useLocale()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardClientResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claimingBountyId, setClaimingBountyId] = useState<number | null>(null)
  const [applyingReferral, setApplyingReferral] = useState(false)
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const knownAchievementCodes = useRef<Set<string>>(new Set())
  const hasLoadedOnce = useRef(false)

  const refreshDashboard = useCallback(
    async (announceUnlocks: boolean) => {
      if (!isAuthenticated) {
        setLoading(false)
        setData(null)
        setError(null)
        return
      }

      try {
        const payload = await getDashboardClient()
        setData(payload)
        setError(null)

        const achievements = payload.gamification?.achievements ?? []
        const newCodes = new Set(achievements.map((achievement) => achievement.code))

        if (announceUnlocks && hasLoadedOnce.current) {
          const unlocked = collectNewAchievements(knownAchievementCodes.current, achievements)
          unlocked.forEach((achievement) => {
            toast(`Achievement unlocked: ${achievement.title}`, 'success')
          })
        }

        knownAchievementCodes.current = newCodes
        hasLoadedOnce.current = true
      } catch (err) {
        setError((err as Error).message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    },
    [isAuthenticated, toast]
  )

  useEffect(() => {
    setLoading(true)
    refreshDashboard(false)
  }, [refreshDashboard])

  useEffect(() => {
    if (!isAuthenticated) return
    const interval = window.setInterval(() => {
      refreshDashboard(true).catch(() => {})
    }, 45000)
    return () => window.clearInterval(interval)
  }, [isAuthenticated, refreshDashboard])

  const gamification = data?.gamification
  const referrals = data?.referrals
  const history = data?.history ?? []
  const competition = data?.competition
  const bounties = data?.bounties ?? []
  const prizes = data?.prizes ?? []

  const quotaUsed = data?.quota?.used ?? quota?.used ?? 0
  const quotaLimit = data?.quota?.limit ?? quota?.limit ?? 1
  const quotaRemaining = data?.quota?.remaining ?? Math.max(0, quotaLimit - quotaUsed)
  const quotaDay = data?.quota?.day

  const unlockedAchievementMap = useMemo(() => {
    const map = new Map<string, UserAchievement>()
    ;(gamification?.achievements ?? []).forEach((achievement) => map.set(achievement.code, achievement))
    return map
  }, [gamification?.achievements])

  const referralShareText = useMemo(() => {
    const code = referrals?.referralCode ?? ''
    return code
      ? `Join ScamShield with my referral code ${code}.`
      : 'Join ScamShield to help fight scam campaigns.'
  }, [referrals?.referralCode])

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <LayoutDashboard size={40} className="text-cyber/30 mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold text-white mb-2">{t('nav.dashboard')}</h2>
        <p className="font-body text-sm text-slate-500 mb-6">Sign in to access your personal dashboard with usage stats, gamification, and history.</p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={login}
          className="inline-flex items-center gap-2 rounded-xl bg-cyber px-6 py-3 font-mono text-sm font-semibold text-noir-950 shadow-lg shadow-cyber/20"
        >
          {t('nav.signin')}
        </motion.button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 space-y-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />)}
      </div>
    )
  }

  const handleCopyReferral = async () => {
    const code = referrals?.referralCode
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      toast('Referral code copied', 'success')
    } catch {
      toast('Failed to copy referral code', 'error')
    }
  }

  const handleShareReferral = async () => {
    if (!referrals?.referralCode) return

    const sharePayload = {
      title: 'ScamShield Referral',
      text: referralShareText,
    }

    try {
      if (navigator.share) {
        await navigator.share(sharePayload)
        return
      }
      await navigator.clipboard.writeText(`${sharePayload.text} Code: ${referrals.referralCode}`)
      toast('Referral message copied', 'success')
    } catch {
      toast('Unable to share referral code', 'error')
    }
  }

  const handleApplyReferral = async () => {
    if (!referralCodeInput.trim()) {
      toast('Enter a referral code first', 'error')
      return
    }

    setApplyingReferral(true)
    try {
      const result = await applyReferralCode(referralCodeInput.trim().toUpperCase())
      toast(`Referral applied. +${result.referredPoints} points awarded.`, 'success')
      setReferralCodeInput('')
      await refreshDashboard(true)
    } catch (err) {
      toast((err as Error).message || 'Failed to apply referral code', 'error')
    } finally {
      setApplyingReferral(false)
    }
  }

  const handleClaimBounty = async (bountyId: number) => {
    setClaimingBountyId(bountyId)
    try {
      const result = await claimBounty(bountyId)
      toast(`Bounty claimed: ${result.bounty.title}`, 'success')
      await refreshDashboard(true)
    } catch (err) {
      toast((err as Error).message || 'Failed to claim bounty', 'error')
    } finally {
      setClaimingBountyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white mb-1">
            Welcome back, <span className="text-cyber">{user?.email?.split('@')[0]}</span>
          </h2>
          <p className="font-body text-sm text-slate-500">Track progress, claim bounties, and unlock premium rewards.</p>
        </div>
        <Button size="sm" onClick={() => refreshDashboard(true)} className="self-start">
          <RefreshCcw size={14} />
          Refresh
        </Button>
      </motion.div>

      {error && (
        <Card variant="threat" className="p-4">
          <p className="font-mono text-xs text-threat-critical">{error}</p>
        </Card>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card variant="glow" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={16} className="text-cyber" />
            <span className="section-title">Usage Quota</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div>
              <div className="font-mono text-2xl text-white">{quotaUsed}</div>
              <div className="data-label">Used Today</div>
            </div>
            <div>
              <div className="font-mono text-2xl text-white">{quotaLimit}</div>
              <div className="data-label">Daily Limit</div>
            </div>
            <div>
              <div className="font-mono text-2xl text-cyber">{quotaRemaining}</div>
              <div className="data-label">Remaining</div>
            </div>
          </div>
          <ProgressBar value={quotaUsed} max={Math.max(1, quotaLimit)} color={quotaUsed / Math.max(1, quotaLimit) > 0.8 ? 'red' : 'cyan'} />
          <p className="mt-3 font-mono text-[10px] text-slate-600">Quota window: {quotaDay ?? new Date().toISOString().slice(0, 10)}</p>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="text-center py-5">
          <Trophy size={20} className="text-threat-medium mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-white">{gamification?.totalPoints ?? 0}</div>
          <div className="data-label">Points</div>
        </Card>
        <Card className="text-center py-5">
          <Award size={20} className="text-cyber mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-white">{gamification?.currentStreakDays ?? 0}d</div>
          <div className="data-label">Streak</div>
        </Card>
        <Card className="text-center py-5">
          <Target size={20} className="text-safe mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-white">{gamification?.reportsSubmitted ?? 0}</div>
          <div className="data-label">Reports</div>
        </Card>
        <Card className="text-center py-5">
          <Crown size={20} className={gamification?.premiumUnlocked ? 'text-safe mx-auto mb-2' : 'text-slate-500 mx-auto mb-2'} />
          <div className="font-mono text-xl font-bold text-white">{gamification?.premiumUnlocked ? 'PRO' : 'FREE'}</div>
          <div className="data-label">Tier</div>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Medal size={14} className="text-cyber/80" />
              <span className="section-title">Achievement Milestones</span>
            </div>
            <div className="space-y-4">
              {ACHIEVEMENT_MILESTONES.map((milestone) => {
                const unlocked = unlockedAchievementMap.get(milestone.code)
                const progressReports = Math.min(gamification?.reportsSubmitted ?? 0, milestone.reportThreshold)
                return (
                  <div key={milestone.code} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-mono text-xs text-slate-100">{milestone.title}</p>
                        <p className="font-body text-xs text-slate-500">{milestone.description}</p>
                      </div>
                      <span className={`font-mono text-[10px] ${unlocked ? 'text-safe' : 'text-slate-500'}`}>
                        +{milestone.bonusPoints} pts
                      </span>
                    </div>
                    <ProgressBar value={progressReports} max={milestone.reportThreshold} color={unlocked ? 'green' : 'cyan'} />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-600">
                        {progressReports}/{milestone.reportThreshold} reports
                      </span>
                      <span className={`font-mono text-[10px] ${unlocked ? 'text-safe' : 'text-slate-500'}`}>
                        {unlocked ? `Unlocked ${formatDate(unlocked.awardedAt)}` : 'Locked'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card variant={gamification?.premiumUnlocked ? 'safe' : 'default'} className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown size={14} className={gamification?.premiumUnlocked ? 'text-safe' : 'text-cyber'} />
                <span className="section-title">Premium Features</span>
              </div>
              <span className={`font-mono text-xs ${gamification?.premiumUnlocked ? 'text-safe' : 'text-slate-400'}`}>
                {gamification?.premiumUnlocked ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">Points Progress</span>
                  <span className="font-mono text-[10px] text-slate-300">{gamification?.totalPoints ?? 0}/{PREMIUM_POINT_TARGET}</span>
                </div>
                <ProgressBar value={Math.min(gamification?.totalPoints ?? 0, PREMIUM_POINT_TARGET)} max={PREMIUM_POINT_TARGET} color={gamification?.premiumUnlocked ? 'green' : 'cyan'} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">Streak Progress</span>
                  <span className="font-mono text-[10px] text-slate-300">{gamification?.currentStreakDays ?? 0}/{PREMIUM_STREAK_TARGET} days</span>
                </div>
                <ProgressBar value={Math.min(gamification?.currentStreakDays ?? 0, PREMIUM_STREAK_TARGET)} max={PREMIUM_STREAK_TARGET} color={gamification?.premiumUnlocked ? 'green' : 'amber'} />
              </div>
            </div>

            <p className="font-body text-xs text-slate-500 mb-4">
              {gamification?.premium?.reasons?.[0] ?? 'Earn 500 points or keep a 7-day streak to unlock premium.'}
            </p>

            <div className="space-y-2">
              {(gamification?.premiumFeatures ?? []).map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  {gamification?.premiumUnlocked ? <CheckCircle2 size={14} className="text-safe" /> : <Lock size={14} className="text-slate-600" />}
                  <span className={`font-body text-sm ${gamification?.premiumUnlocked ? 'text-slate-200' : 'text-slate-500'}`}>{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Share2 size={14} className="text-cyber/80" />
                <span className="section-title">Referral Program</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">Invite and earn points</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-lg text-cyber">{referrals?.referralCode ?? '-'}</div>
                <div className="data-label">Your Code</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-lg text-white">{referrals?.totalReferrals ?? 0}</div>
                <div className="data-label">Referrals</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-lg text-safe">{referrals?.rewardedPoints ?? 0}</div>
                <div className="data-label">Referral Points</div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleCopyReferral} disabled={!referrals?.referralCode}>
                <Copy size={13} />
                Copy Code
              </Button>
              <Button size="sm" onClick={handleShareReferral} disabled={!referrals?.referralCode}>
                <Share2 size={13} />
                Share Invite
              </Button>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">Apply Referral Code</p>
              {gamification?.referredByUserId ? (
                <p className="font-body text-sm text-safe">Referral already linked to your account.</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={referralCodeInput}
                    onChange={(event) => setReferralCodeInput(event.target.value)}
                    placeholder="Enter referral code"
                    className="uppercase"
                  />
                  <Button onClick={handleApplyReferral} disabled={applyingReferral || !referralCodeInput.trim()}>
                    {applyingReferral ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
              )}
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto">
              {(referrals?.referrals ?? []).length === 0 ? (
                <p className="font-body text-sm text-slate-600 text-center py-4">No referral activity yet.</p>
              ) : (
                referrals?.referrals.map((item, index) => (
                  <div key={`${item.displayName}-${item.createdAt}-${index}`} className="flex items-center justify-between border-b border-white/[0.04] pb-2 last:border-0">
                    <div>
                      <p className="font-mono text-xs text-slate-300">{item.displayName}</p>
                      <p className="font-mono text-[10px] text-slate-600">{formatDate(item.createdAt)}</p>
                    </div>
                    <span className="font-mono text-xs text-safe">+{item.pointsAwarded}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Flag size={14} className="text-cyber/80" />
              <span className="section-title">Monthly Competition</span>
            </div>

            {competition?.competition ? (
              <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-mono text-sm text-slate-100">{competition.competition.name}</p>
                <p className="font-body text-xs text-slate-500 mt-1">
                  {competition.competition.monthKey} • {competition.competition.status} • pool {formatCurrencyFromCents(competition.competition.prizePoolCents, competition.competition.currency)}
                </p>
              </div>
            ) : (
              <p className="font-body text-sm text-slate-600 mb-4">No monthly competition configured yet.</p>
            )}

            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">Leaderboard</p>
              {(competition?.leaderboard ?? []).length === 0 ? (
                <p className="font-body text-sm text-slate-600">No competition entries yet.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {competition?.leaderboard.slice(0, 10).map((entry) => (
                    <div key={`${entry.userId}-${entry.rank}`} className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">#{entry.rank}</span>
                        <span className="font-mono text-xs text-slate-200">{entry.displayName}</span>
                      </div>
                      <span className="font-mono text-xs text-cyber">{entry.points} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">Latest Winners</p>
              {(competition?.winners ?? []).length === 0 ? (
                <p className="font-body text-sm text-slate-600">Winners will appear after monthly finalization.</p>
              ) : (
                <div className="space-y-2">
                  {competition?.winners.slice(0, 3).map((winner) => (
                    <div key={`${winner.userId}-${winner.rank}`} className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2">
                      <div>
                        <p className="font-mono text-xs text-slate-200">#{winner.rank} {winner.displayName}</p>
                        <p className="font-mono text-[10px] text-slate-600">{winner.points} points</p>
                      </div>
                      <span className="font-mono text-xs text-threat-medium">{formatCurrencyFromCents(winner.prizeCents, competition?.competition?.currency ?? 'USD')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Crosshair size={14} className="text-cyber/80" />
              <span className="section-title">Bounty Board</span>
            </div>

            {bounties.length === 0 ? (
              <p className="font-body text-sm text-slate-600 text-center py-6">No open bounties right now.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {bounties.map((bounty) => (
                  <div key={bounty.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs text-slate-100">{bounty.targetIdentifier || bounty.title}</p>
                      <span className={priorityClass(bounty.priority)}>{bounty.priority.toUpperCase()}</span>
                    </div>
                    <p className="font-body text-xs text-slate-500 mb-3 line-clamp-2">{bounty.description}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-slate-600">{bounty.platform}</span>
                        <span className="font-mono text-xs text-cyber">+{bounty.rewardPoints} pts</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleClaimBounty(bounty.id)}
                        disabled={claimingBountyId === bounty.id || bounty.status !== 'open'}
                      >
                        {claimingBountyId === bounty.id ? 'Claiming...' : bounty.status === 'open' ? 'Claim' : bounty.status}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Gift size={14} className="text-cyber/80" />
              <span className="section-title">Prize & Achievement Feed</span>
            </div>

            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">Recent Unlocks</p>
              {(gamification?.achievements ?? []).length === 0 ? (
                <p className="font-body text-sm text-slate-600">No achievements unlocked yet.</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {(gamification?.achievements ?? []).slice(0, 6).map((achievement) => (
                    <div key={achievement.code} className="rounded-lg border border-white/[0.05] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs text-slate-100">{achievement.title}</p>
                        <span className="font-mono text-[10px] text-safe">{formatDate(achievement.awardedAt)}</span>
                      </div>
                      <p className="font-body text-xs text-slate-500 mt-1">{achievement.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">Cash Prize History</p>
              {prizes.length === 0 ? (
                <p className="font-body text-sm text-slate-600">No cash prize records yet.</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {prizes.slice(0, 6).map((prize) => (
                    <div key={prize.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2">
                      <div>
                        <p className="font-mono text-xs text-slate-200">{formatCurrencyFromCents(prize.amountCents, prize.currency)}</p>
                        <p className="font-mono text-[10px] text-slate-600">{prize.partnerName ?? 'Community pool'}</p>
                      </div>
                      <span className={`font-mono text-[10px] uppercase tracking-wider ${prizeStatusClass(prize.status)}`}>
                        {prize.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <History size={14} className="text-cyber/70" />
            <span className="section-title">Recent Activity</span>
          </div>
          {history.length === 0 ? (
            <p className="font-body text-sm text-slate-600 text-center py-6">No activity yet. Start by checking a suspicious address.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.slice(0, 20).map((item, index) => (
                <div key={`${item.timestamp}-${index}`} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <span className="font-mono text-xs text-slate-400">{item.action}</span>
                  <div className="text-right">
                    <p className="font-mono text-[10px] text-slate-600">{formatDate(item.timestamp)}</p>
                    <p className="font-mono text-[10px] text-slate-700">{formatDateTime(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 text-slate-600">
            <CalendarDays size={13} />
            <span className="font-mono text-[10px]">Last sync {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
