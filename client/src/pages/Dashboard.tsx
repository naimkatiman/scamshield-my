import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Gauge, Trophy, History, Award } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/Progress'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { getDashboardClient } from '../lib/api'

export function Dashboard() {
  const { user, isAuthenticated, quota, login } = useAuth()
  const { t } = useLocale()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    getDashboardClient()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAuthenticated])

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
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />)}
      </div>
    )
  }

  const gamification = (data?.gamification ?? {}) as { totalPoints?: number; currentStreakDays?: number; premiumUnlocked?: boolean }
  const history = (data?.history ?? []) as { action: string; createdAt: string }[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold text-white mb-1">
          Welcome back, <span className="text-cyber">{user?.email?.split('@')[0]}</span>
        </h2>
        <p className="font-body text-sm text-slate-500">Your personal ScamShield dashboard</p>
      </motion.div>

      {/* Quota Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card variant="glow" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={16} className="text-cyber" />
            <span className="section-title">Usage Quota</span>
          </div>
          {quota && (
            <>
              <div className="flex justify-between mb-2">
                <span className="font-mono text-xs text-slate-500">Today's usage</span>
                <span className="font-mono text-sm font-bold text-cyber">{quota.used} / {quota.limit}</span>
              </div>
              <ProgressBar value={quota.used} max={quota.limit} color={quota.used / quota.limit > 0.8 ? 'red' : 'cyan'} />
            </>
          )}
        </Card>
      </motion.div>

      {/* Gamification */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 gap-4">
        <Card className="text-center py-5">
          <Trophy size={20} className="text-threat-medium mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-white">{gamification.totalPoints ?? 0}</div>
          <div className="data-label">Points</div>
        </Card>
        <Card className="text-center py-5">
          <Award size={20} className="text-cyber mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-white">{gamification.currentStreakDays ?? 0}d</div>
          <div className="data-label">Streak</div>
        </Card>
        <Card className="text-center py-5">
          <Gauge size={20} className="text-safe mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-white">{gamification.premiumUnlocked ? 'PRO' : 'FREE'}</div>
          <div className="data-label">Tier</div>
        </Card>
      </motion.div>

      {/* History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <History size={14} className="text-cyber/70" />
            <span className="section-title">Recent Activity</span>
          </div>
          {history.length === 0 ? (
            <p className="font-body text-sm text-slate-600 text-center py-6">No activity yet. Start by checking a suspicious address.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <span className="font-mono text-xs text-slate-400">{item.action}</span>
                  <span className="font-mono text-[10px] text-slate-700">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
