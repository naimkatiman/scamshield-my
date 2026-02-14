import { motion } from 'framer-motion'
import { TrendingUp, Clock, FileText, Calendar } from 'lucide-react'
import { CircularGauge } from '../ui/Progress'
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter'
import { recoveryMetrics, recoveryTimeline } from '../../data/mockIntelligence'

export function RecoveryStats() {
  const totalRecovered = useAnimatedCounter(recoveryTimeline.totalRecovered, 2000)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp size={14} className="text-safe/70" />
        <span className="section-title">Recovery Dashboard</span>
      </div>

      {/* Hero stat */}
      <div className="text-center mb-6">
        <span className="data-label">Total Funds Recovered</span>
        <div className="stat-value text-safe text-3xl mt-1 text-glow-green">
          RM {totalRecovered.toLocaleString()}
        </div>
      </div>

      {/* Circular gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {recoveryMetrics.map(metric => (
          <CircularGauge
            key={metric.label}
            value={metric.value}
            total={metric.total}
            color={metric.color}
            label={metric.label}
          />
        ))}
      </div>

      {/* Timeline stats */}
      <div className="grid grid-cols-3 gap-3 border-t border-white/[0.04] pt-4">
        <div className="text-center">
          <Clock size={14} className="text-cyber mx-auto mb-1" />
          <div className="font-mono text-sm font-bold text-slate-200">{recoveryTimeline.avgFreezeTime}</div>
          <div className="data-label mt-0.5">Avg Freeze</div>
        </div>
        <div className="text-center">
          <FileText size={14} className="text-safe mx-auto mb-1" />
          <div className="font-mono text-sm font-bold text-slate-200">{recoveryTimeline.avgReportTime}</div>
          <div className="data-label mt-0.5">Avg Report</div>
        </div>
        <div className="text-center">
          <Calendar size={14} className="text-threat-medium mx-auto mb-1" />
          <div className="font-mono text-sm font-bold text-slate-200">{recoveryTimeline.avgResolutionDays}d</div>
          <div className="data-label mt-0.5">Avg Resolution</div>
        </div>
      </div>
    </motion.div>
  )
}
