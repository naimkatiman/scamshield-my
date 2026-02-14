import { motion } from 'framer-motion'
import { Shield, AlertTriangle, FileText, Banknote, TrendingUp, Zap } from 'lucide-react'
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter'
import { statsCards, type StatCard } from '../../data/mockIntelligence'
import { formatNumber } from '../../lib/utils'

const iconMap: Record<string, typeof Shield> = {
  shield: Shield,
  'alert-triangle': AlertTriangle,
  'file-text': FileText,
  banknote: Banknote,
  'trending-up': TrendingUp,
  zap: Zap,
}

function StatCardComponent({ card, index }: { card: StatCard; index: number }) {
  const animated = useAnimatedCounter(card.value, 1800, card.suffix === '%' || card.suffix === 's' ? 1 : 0)
  const Icon = iconMap[card.icon] ?? Shield
  const isPositiveBad = card.label.includes('Risk') || card.label.includes('Threat')
  const changeGood = isPositiveBad ? card.change < 0 : card.change > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ borderColor: 'rgba(6,182,212,0.2)' }}
      className="glass-card p-4 group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-cyber group-hover:scale-110 transition-transform">
          <Icon size={16} />
        </div>
        <span className={`font-mono text-[10px] font-semibold ${changeGood ? 'text-safe' : 'text-threat-critical'}`}>
          {card.change > 0 ? '↑' : '↓'} {Math.abs(card.change)}%
        </span>
      </div>
      <div className="stat-value text-cyber text-2xl mb-1">
        {card.prefix ?? ''}
        {card.value >= 10000 ? animated.toLocaleString() : animated}
        {card.suffix ?? ''}
      </div>
      <div className="data-label">{card.label}</div>
      <div className="font-mono text-[9px] text-slate-700 mt-0.5">{card.changeLabel}</div>
    </motion.div>
  )
}

export function StatsRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statsCards.map((card, i) => (
        <StatCardComponent key={card.label} card={card} index={i} />
      ))}
    </div>
  )
}
