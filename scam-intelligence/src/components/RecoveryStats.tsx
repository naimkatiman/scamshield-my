import { motion } from 'framer-motion'
import { useAnimatedCounter } from '../hooks/useAnimatedCounter'
import { recoveryMetrics, recoveryTimeline } from '../data/mockData'

function CircularGauge({
  value,
  total,
  color,
  label,
  delay,
}: {
  value: number
  total: number
  color: string
  label: string
  delay: number
}) {
  const pct = (value / total) * 100
  const animatedPct = useAnimatedCounter(pct, 2000, 1)
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedPct / 100) * circumference

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return v.toString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative">
        <svg width="88" height="88" viewBox="0 0 88 88">
          {/* Background ring */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="6"
          />
          {/* Progress ring */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 44 44)"
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
              transition: 'stroke-dashoffset 0.3s ease',
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-bold text-slate-100">
            {animatedPct.toFixed(0)}
          </span>
          <span className="font-mono text-[9px] text-slate-500">%</span>
        </div>
      </div>

      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="font-mono text-xs text-slate-400">
          {formatValue(value)}/{formatValue(total)}
        </p>
      </div>
    </motion.div>
  )
}

export default function RecoveryStats() {
  const totalRecoveredAnimated = useAnimatedCounter(
    recoveryTimeline.totalRecovered,
    2000,
    0
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="glass-card p-5"
    >
      <div className="mb-5">
        <h3 className="section-title mb-1">Recovery Operations</h3>
        <p className="font-mono text-[11px] text-slate-500">
          Fund recovery and case resolution metrics
        </p>
      </div>

      {/* Hero stat */}
      <div className="mb-6 rounded-lg border border-safe/20 bg-safe/[0.05] p-4 text-center">
        <p className="data-label mb-1">Total Funds Recovered</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="font-mono text-sm text-safe/70">RM</span>
          <span className="font-display text-3xl font-bold text-safe text-glow-green">
            {totalRecoveredAnimated.toLocaleString('en-MY')}
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-safe/60">
          {recoveryTimeline.successRate}% success rate
        </p>
      </div>

      {/* Circular gauges */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {recoveryMetrics.map((metric, i) => (
          <CircularGauge
            key={metric.label}
            value={metric.value}
            total={metric.total}
            color={metric.color}
            label={metric.label}
            delay={0.7 + i * 0.1}
          />
        ))}
      </div>

      {/* Timeline stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Avg Freeze Time',
            value: recoveryTimeline.avgFreezeTime,
            icon: '⏱',
          },
          {
            label: 'Avg Report Time',
            value: recoveryTimeline.avgReportTime,
            icon: '📝',
          },
          {
            label: 'Avg Resolution',
            value: `${recoveryTimeline.avgResolutionDays} days`,
            icon: '✓',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-center"
          >
            <span className="mb-1 block text-lg">{stat.icon}</span>
            <p className="font-display text-sm font-semibold text-slate-200">
              {stat.value}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
