import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  color?: 'cyan' | 'green' | 'red' | 'amber'
  className?: string
}

const barColors = {
  cyan: 'bg-cyber',
  green: 'bg-safe',
  red: 'bg-threat-critical',
  amber: 'bg-threat-medium',
}

const glowColors = {
  cyan: 'shadow-cyber/30',
  green: 'shadow-safe/30',
  red: 'shadow-threat-critical/30',
  amber: 'shadow-threat-medium/30',
}

export function ProgressBar({ value, max = 100, color = 'cyan', className }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn('h-full rounded-full shadow-lg', barColors[color], `shadow-lg ${glowColors[color]}`)}
      />
    </div>
  )
}

interface CircularGaugeProps {
  value: number
  total: number
  color: string
  size?: number
  strokeWidth?: number
  label: string
}

export function CircularGauge({ value, total, color, size = 80, strokeWidth = 6, label }: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? value / total : 0

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 1.5, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-bold text-slate-200">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <span className="data-label text-center">{label}</span>
    </div>
  )
}
