import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Trophy, Flame, Users, RefreshCcw, ShieldCheck } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { getDashboardAdmin, getLeaderboard, type DashboardAdminResponse, type LeaderboardEntry } from '../lib/api'

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
}

export function Leaderboard() {
  const { isAuthenticated, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [adminSnapshot, setAdminSnapshot] = useState<DashboardAdminResponse | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const leaderboardPromise = getLeaderboard(50)
      const adminPromise = isAuthenticated && isAdmin ? getDashboardAdmin().catch(() => null) : Promise.resolve(null)

      const [leaderboardData, adminData] = await Promise.all([leaderboardPromise, adminPromise])
      setRows(leaderboardData.leaderboard ?? [])
      setGeneratedAt(leaderboardData.generatedAt ?? null)
      setAdminSnapshot(adminData)
    } catch (err) {
      setError((err as Error).message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-4">
        {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl bg-white/[0.03] animate-pulse" />)}
      </div>
    )
  }

  const top = rows[0]

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Community Leaderboard</h2>
          <p className="font-body text-sm text-slate-500">Rankings by total points, streak consistency, and report volume.</p>
        </div>
        <Button size="sm" onClick={loadData}>
          <RefreshCcw size={14} />
          Refresh
        </Button>
      </motion.div>

      {error && (
        <Card variant="threat" className="p-4">
          <p className="font-mono text-xs text-threat-critical">{error}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glow" className="p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={15} className="text-threat-medium" />
            <span className="section-title">Top Defender</span>
          </div>
          {top ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-2xl text-white">#{top.rank} {top.displayName}</p>
                <p className="font-mono text-xs text-slate-500 mt-1">{top.reportsSubmitted} reports submitted</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl text-cyber">{top.totalPoints} pts</p>
                <p className="font-mono text-xs text-slate-500">{top.currentStreakDays} day streak</p>
              </div>
            </div>
          ) : (
            <p className="font-body text-sm text-slate-600">No leaderboard entries yet.</p>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-cyber/80" />
            <span className="section-title">Snapshot</span>
          </div>
          <p className="font-mono text-2xl text-white">{rows.length}</p>
          <p className="data-label">Visible Ranked Users</p>
          <p className="font-mono text-[10px] text-slate-600 mt-3">Updated {formatDateTime(generatedAt)}</p>
        </Card>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={14} className="text-cyber" />
            <span className="section-title">Rankings</span>
          </div>

          {rows.length === 0 ? (
            <p className="font-body text-sm text-slate-600 text-center py-8">No leaderboard entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">Rank</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">User</th>
                    <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500">Points</th>
                    <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500">Streak</th>
                    <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500">Reports</th>
                    <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={`${entry.userId}-${entry.rank}`} className="border-b border-white/[0.03] last:border-0">
                      <td className="py-2 font-mono text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          {entry.rank <= 3 ? <Flame size={12} className="text-threat-medium" /> : null}
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-slate-200">{entry.displayName}</td>
                      <td className="py-2 text-right font-mono text-xs text-cyber">{entry.totalPoints}</td>
                      <td className="py-2 text-right font-mono text-xs text-slate-300">{entry.currentStreakDays}d</td>
                      <td className="py-2 text-right font-mono text-xs text-slate-300">{entry.reportsSubmitted}</td>
                      <td className="py-2 text-right font-mono text-xs">
                        <span className={entry.premiumUnlocked ? 'text-safe' : 'text-slate-500'}>
                          {entry.premiumUnlocked ? 'PRO' : 'FREE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {adminSnapshot && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card variant="safe" className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={14} className="text-safe" />
              <span className="section-title">Admin Snapshot</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-xl text-white">{adminSnapshot.totalUsers}</div>
                <div className="data-label">Total Users</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-xl text-white">{adminSnapshot.todayUsage}</div>
                <div className="data-label">Usage Today</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-xl text-safe">{adminSnapshot.gamification?.premiumUsers ?? 0}</div>
                <div className="data-label">Premium Users</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="font-mono text-xl text-cyber">{adminSnapshot.gamification?.openBounties ?? 0}</div>
                <div className="data-label">Open Bounties</div>
              </div>
            </div>
            <p className="font-mono text-[10px] text-slate-600">Reporting day: {adminSnapshot.day}</p>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
