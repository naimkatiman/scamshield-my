import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, FileText, CheckSquare, Share2, ChevronDown } from 'lucide-react'
import { EmergencyStep } from './EmergencyStep'
import { ReportsStep } from './ReportsStep'
import { ChecklistStep } from './ChecklistStep'
import { ShareStep } from './ShareStep'
import { useLocale } from '../../context/LocaleContext'
import { getPlaybook, generateReports, createWarningCard, type VerdictResponse, type PlaybookResponse, type ReportsResponse, type WarningCardResponse } from '../../lib/api'

interface RecoveryKitProps {
  verdict: VerdictResponse
  inputMeta: { type: string; value: string }
  onReset: () => void
}

const steps = [
  { id: 'emergency', icon: AlertTriangle, color: 'text-threat-critical' },
  { id: 'reports', icon: FileText, color: 'text-cyber' },
  { id: 'checklist', icon: CheckSquare, color: 'text-safe' },
  { id: 'share', icon: Share2, color: 'text-threat-medium' },
]

export function RecoveryKit({ verdict, inputMeta, onReset }: RecoveryKitProps) {
  const { t } = useLocale()
  const [openStep, setOpenStep] = useState<string>('emergency')
  const [playbook, setPlaybook] = useState<PlaybookResponse | null>(null)
  const [reports, setReports] = useState<ReportsResponse | null>(null)
  const [warningCard, setWarningCard] = useState<WarningCardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [pb, rp, wc] = await Promise.allSettled([
          getPlaybook(),
          generateReports({
            incidentTitle: `Suspicious ${inputMeta.type}: ${inputMeta.value}`,
            scamType: 'Unknown',
            occurredAt: new Date().toISOString(),
            channel: 'Unknown',
            suspects: [inputMeta.value],
            losses: 'Unknown',
            actionsTaken: [],
            extraNotes: verdict.reasons.join('. '),
          }),
          createWarningCard({
            verdict: verdict.verdict,
            headline: `Suspicious ${inputMeta.type} flagged`,
            identifiers: { [inputMeta.type]: inputMeta.value },
            reasons: verdict.reasons,
          }),
        ])
        if (pb.status === 'fulfilled') setPlaybook(pb.value)
        if (rp.status === 'fulfilled') setReports(rp.value)
        if (wc.status === 'fulfilled') setWarningCard(wc.value)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [verdict, inputMeta])

  const stepTitles: Record<string, string> = {
    emergency: t('flow.emergency.title'),
    reports: t('flow.reports.title'),
    checklist: t('flow.checklist.title'),
    share: t('flow.share.title'),
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {/* Step progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isOpen = openStep === step.id
          return (
            <div key={step.id} className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOpenStep(step.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                  isOpen ? `${step.color} border-current bg-current/10` : 'text-slate-600 border-white/10 bg-white/[0.02]'
                }`}
              >
                <Icon size={14} />
              </motion.button>
              {i < steps.length - 1 && <div className="w-8 h-px bg-white/10" />}
            </div>
          )
        })}
      </div>

      {/* Accordion steps */}
      {steps.map(step => {
        const Icon = step.icon
        const isOpen = openStep === step.id
        return (
          <motion.div
            key={step.id}
            layout
            className="glass-card overflow-hidden"
          >
            <button
              onClick={() => setOpenStep(isOpen ? '' : step.id)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <Icon size={18} className={step.color} />
              <span className="font-display text-sm font-semibold text-white flex-1">
                {stepTitles[step.id]}
              </span>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={16} className="text-slate-500" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">
                    {step.id === 'emergency' && <EmergencyStep playbook={playbook} loading={loading} />}
                    {step.id === 'reports' && <ReportsStep reports={reports} loading={loading} />}
                    {step.id === 'checklist' && <ChecklistStep playbook={playbook} loading={loading} />}
                    {step.id === 'share' && <ShareStep warningCard={warningCard} loading={loading} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
