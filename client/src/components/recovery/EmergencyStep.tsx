import { motion } from 'framer-motion'
import { Phone, Shield, Smartphone, KeyRound, ExternalLink } from 'lucide-react'
import { useLocale } from '../../context/LocaleContext'
import type { PlaybookResponse } from '../../lib/api'

interface EmergencyStepProps {
  playbook: PlaybookResponse | null
  loading: boolean
}

const actions = [
  { key: 'playbook.stop.bank', icon: Phone, color: 'text-threat-critical' },
  { key: 'playbook.stop.nsrc', icon: Shield, color: 'text-threat-high' },
  { key: 'playbook.stop.telco', icon: Smartphone, color: 'text-threat-medium' },
  { key: 'playbook.stop.pwd', icon: KeyRound, color: 'text-cyber' },
]

const reportChannels = [
  { key: 'playbook.report.police', label: 'PDRM' },
  { key: 'playbook.report.semakmule', label: 'SemakMule' },
  { key: 'playbook.report.mcmc', label: 'MCMC' },
  { key: 'playbook.report.sec', label: 'Securities Commission' },
]

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, x: -15 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
}

export function EmergencyStep({ playbook, loading }: EmergencyStepProps) {
  const { t } = useLocale()

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6">
      {/* Emergency Actions */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
        {actions.map(action => {
          const Icon = action.icon
          return (
            <motion.div key={action.key} variants={item} className="flex items-start gap-3 rounded-lg bg-white/[0.02] p-3">
              <div className={`mt-0.5 ${action.color}`}>
                <Icon size={16} />
              </div>
              <p className="font-body text-sm text-slate-300 leading-relaxed">{t(action.key)}</p>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Report Channels */}
      <div>
        <p className="section-title mb-3">{t('flow.emergency.report_to')}</p>
        <div className="grid grid-cols-2 gap-2">
          {reportChannels.map(ch => (
            <div key={ch.key} className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-3">
              <ExternalLink size={12} className="text-slate-600 mt-1 shrink-0" />
              <div>
                <p className="font-mono text-xs font-semibold text-slate-300">{ch.label}</p>
                <p className="font-body text-[11px] text-slate-500 mt-0.5 leading-relaxed">{t(ch.key)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-16 rounded-lg bg-white/[0.03]" />
      ))}
    </div>
  )
}
