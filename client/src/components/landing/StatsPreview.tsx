import { motion } from 'framer-motion'
import { Shield, AlertTriangle, FileText, TrendingUp } from 'lucide-react'
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter'
import { Card } from '../ui/Card'

const stats = [
  { icon: Shield, label: 'Scams Detected', value: 14892, suffix: '', color: 'text-cyber' },
  { icon: AlertTriangle, label: 'Active Threats', value: 247, suffix: '', color: 'text-threat-high' },
  { icon: FileText, label: 'Reports Filed', value: 3461, suffix: '', color: 'text-safe' },
  { icon: TrendingUp, label: 'Recovery Rate', value: 34.2, suffix: '%', color: 'text-cyber-bright', decimals: 1 },
]

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.6 } },
}

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function StatCardItem({ stat, index }: { stat: typeof stats[0]; index: number }) {
  const animated = useAnimatedCounter(stat.value, 1800, stat.decimals ?? 0)
  const Icon = stat.icon

  return (
    <motion.div variants={item}>
      <Card hover className="text-center py-6">
        <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] ${stat.color}`}>
          <Icon size={20} />
        </div>
        <div className={`stat-value ${stat.color} mb-1`}>
          {stat.value >= 1000 ? animated.toLocaleString() : animated}
          {stat.suffix}
        </div>
        <div className="data-label">{stat.label}</div>
      </Card>
    </motion.div>
  )
}

export function StatsPreview() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-auto max-w-4xl px-4"
    >
      {stats.map((stat, i) => (
        <StatCardItem key={stat.label} stat={stat} index={i} />
      ))}
    </motion.div>
  )
}
