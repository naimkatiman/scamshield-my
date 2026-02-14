export const ROUTES = {
  HOME: '/',
  CHECK: '/check',
  INTELLIGENCE: '/intelligence',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  WARNING: '/w/:slug',
} as const

export const VERDICT_COLORS = {
  HIGH_RISK: { bg: 'bg-threat-critical/10', border: 'border-threat-critical/30', text: 'text-threat-critical', glow: 'text-glow-red' },
  LEGIT: { bg: 'bg-safe/10', border: 'border-safe/30', text: 'text-safe', glow: 'text-glow-green' },
  UNKNOWN: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', glow: '' },
} as const

export const SEVERITY_CLASSES = {
  critical: 'threat-badge-critical',
  high: 'threat-badge-high',
  medium: 'threat-badge-medium',
  low: 'threat-badge-low',
} as const
