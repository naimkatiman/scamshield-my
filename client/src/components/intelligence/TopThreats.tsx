import { motion } from 'framer-motion'
import { Target, Users, Banknote, Calendar, Radio } from 'lucide-react'
import { SeverityBadge } from '../ui/Badge'
import { threatCampaigns } from '../../data/mockIntelligence'

const statusColors = {
  active: 'text-threat-critical',
  monitoring: 'text-threat-medium',
  contained: 'text-safe',
}

export function TopThreats() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-5">
        <Target size={14} className="text-threat-critical/70" />
        <span className="section-title">Active Threat Campaigns</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
        {threatCampaigns.map((campaign, i) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
            className={`rounded-lg border p-4 transition-all hover:bg-white/[0.02] ${
              campaign.severity === 'critical' ? 'border-threat-critical/10 bg-threat-critical/[0.02]' : 'border-white/[0.06]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-display text-sm font-bold text-white">{campaign.name}</h4>
                <SeverityBadge severity={campaign.severity} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${statusColors[campaign.status]} ${campaign.status === 'active' ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: 'currentColor' }}
                />
                <span className={`font-mono text-[10px] ${statusColors[campaign.status]}`}>
                  {campaign.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="font-body text-xs text-slate-400 leading-relaxed mb-3">{campaign.description}</p>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <Radio size={10} className="text-slate-600" />
                <span className="font-mono text-[10px] text-slate-500">{campaign.platform}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={10} className="text-slate-600" />
                <span className="font-mono text-[10px] text-slate-500">{campaign.victims.toLocaleString()} victims</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Banknote size={10} className="text-slate-600" />
                <span className="font-mono text-[10px] text-threat-critical">RM {campaign.totalLoss.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={10} className="text-slate-600" />
                <span className="font-mono text-[10px] text-slate-500">{campaign.firstSeen}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
