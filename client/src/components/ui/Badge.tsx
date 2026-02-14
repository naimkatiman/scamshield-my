import { cn } from '../../lib/utils'
import { SEVERITY_CLASSES, VERDICT_COLORS } from '../../lib/constants'

interface VerdictBadgeProps {
  verdict: 'LEGIT' | 'HIGH_RISK' | 'UNKNOWN'
  size?: 'sm' | 'lg'
}

export function VerdictBadge({ verdict, size = 'sm' }: VerdictBadgeProps) {
  const colors = VERDICT_COLORS[verdict]
  const label = verdict === 'HIGH_RISK' ? 'HIGH RISK' : verdict
  return (
    <span className={cn(
      'inline-flex items-center gap-2 rounded-lg border font-mono font-bold tracking-wider',
      colors.bg, colors.border, colors.text, colors.glow,
      size === 'lg' ? 'px-5 py-2.5 text-lg' : 'px-3 py-1.5 text-xs',
    )}>
      {verdict === 'HIGH_RISK' && <span className="h-2 w-2 rounded-full bg-threat-critical animate-pulse" />}
      {verdict === 'LEGIT' && <span className="h-2 w-2 rounded-full bg-safe" />}
      {label}
    </span>
  )
}

interface SeverityBadgeProps {
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return <span className={SEVERITY_CLASSES[severity]}>{severity.toUpperCase()}</span>
}
