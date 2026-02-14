import { motion } from 'framer-motion'
import { useAnimatedCounter } from '../hooks/useAnimatedCounter'
import { statsCards, type StatCard } from '../data/mockData'

function StatCardComponent({ card, index }: { card: StatCard; index: number }) {
  const animated = useAnimatedCounter(
    card.value,
    1800,
    card.suffix === '%' || card.suffix === 's' ? 1 : 0
  )

  const isPositiveGood = card.label === 'Recovery Rate'
  const isNegativeGood = card.label === 'Active Threats' || card.label === 'Avg Response Time'
  const changeIsGood = card.change > 0
    ? isPositiveGood || (!isNegativeGood)
    : isNegativeGood

  const formatValue = (val: number) => {
    if (card.prefix === 'RM') {
      return val.toLocaleString('en-MY')
    }
    if (val >= 10_000) {
      return val.toLocaleString('en-MY')
    }
    return val.toString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="glass-card group p-5 transition-all duration-300 hover:border-cyber/20 hover:border-glow-cyan"
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="data-label">{card.label}</span>
        <span className="text-lg opacity-70 transition-transform duration-300 group-hover:scale-110">
          {card.icon}
        </span>
      </div>

      <div className="mb-2 flex items-baseline gap-1.5">
        {card.prefix && (
          <span className="font-mono text-sm text-slate-400">{card.prefix}</span>
        )}
        <span className="stat-value text-slate-100">
          {formatValue(animated)}
        </span>
        {card.suffix && (
          <span className="font-mono text-sm text-slate-400">{card.suffix}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono text-xs font-semibold ${
            changeIsGood ? 'text-safe' : 'text-threat-critical'
          }`}
        >
          {card.change > 0 ? '↑' : '↓'} {Math.abs(card.change)}%
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          {card.changeLabel}
        </span>
      </div>
    </motion.div>
  )
}

export default function StatsRow() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {statsCards.map((card, i) => (
        <StatCardComponent key={card.label} card={card} index={i} />
      ))}
    </div>
  )
}
