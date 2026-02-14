import { motion } from 'framer-motion'
import { threatCampaigns, type ThreatCampaign } from '../data/mockData'
import clsx from 'clsx'

const SEVERITY_BADGE: Record<ThreatCampaign['severity'], string> = {
  critical: 'threat-badge-critical',
  high: 'threat-badge-high',
  medium: 'threat-badge-medium',
}

const STATUS_STYLE: Record<ThreatCampaign['status'], { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-threat-critical/10', text: 'text-threat-critical', dot: 'bg-threat-critical' },
  monitoring: { bg: 'bg-threat-medium/10', text: 'text-threat-medium', dot: 'bg-threat-medium' },
  contained: { bg: 'bg-safe/10', text: 'text-safe', dot: 'bg-safe' },
}

function formatRM(amount: number): string {
  if (amount >= 1_000_000) return `RM ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `RM ${(amount / 1_000).toFixed(0)}K`
  return `RM ${amount}`
}

export default function TopThreats() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.6 }}
      className="glass-card-threat flex flex-col"
    >
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-title mb-1">Active Threat Campaigns</h3>
            <p className="font-mono text-[11px] text-slate-500">
              {threatCampaigns.filter((t) => t.status === 'active').length} active,{' '}
              {threatCampaigns.filter((t) => t.status === 'monitoring').length} monitoring
            </p>
          </div>
          <span className="font-display text-2xl font-bold text-threat-critical text-glow-red">
            {threatCampaigns.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: '420px' }}>
        {threatCampaigns.map((campaign, i) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08 }}
            className={clsx(
              'group mb-2 rounded-lg border border-transparent p-4 transition-all duration-200',
              'hover:border-white/[0.06] hover:bg-white/[0.02]',
              campaign.severity === 'critical' && 'border-threat-critical/10 bg-threat-critical/[0.02]'
            )}
          >
            {/* Campaign header */}
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold tracking-wide text-slate-200">
                  {campaign.name}
                </span>
                <span className={SEVERITY_BADGE[campaign.severity]}>
                  {campaign.severity}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    STATUS_STYLE[campaign.status].dot,
                    campaign.status === 'active' && 'animate-pulse'
                  )}
                />
                <span
                  className={clsx(
                    'font-mono text-[10px] uppercase',
                    STATUS_STYLE[campaign.status].text
                  )}
                >
                  {campaign.status}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              {campaign.description}
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-600">PLATFORM</span>
                <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {campaign.platform}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-600">VICTIMS</span>
                <span className="font-mono text-[10px] font-semibold text-threat-high">
                  {campaign.victims.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-600">TOTAL LOSS</span>
                <span className="font-mono text-[10px] font-semibold text-threat-critical">
                  {formatRM(campaign.totalLoss)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-600">SINCE</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {campaign.firstSeen}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
