import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'
import { VerdictInput } from '../components/verdict/VerdictInput'
import { InvestorAlertQuickCheck } from '../components/verdict/InvestorAlertQuickCheck'
import { VerdictLoading } from '../components/verdict/VerdictLoading'
import { VerdictResult } from '../components/verdict/VerdictResult'
import { RecoveryKit } from '../components/recovery/RecoveryKit'
import { useLocale } from '../context/LocaleContext'
import { useToast } from '../context/ToastContext'
import { submitVerdict, type VerdictResponse } from '../lib/api'

type Phase = 'input' | 'loading' | 'result' | 'recovery'

export function VerdictFlow() {
  const { t } = useLocale()
  const { toast } = useToast()
  const location = useLocation()
  const navState = location.state as { verdict?: VerdictResponse; inputMeta?: { type: string; value: string } } | null

  const [phase, setPhase] = useState<Phase>(() => navState?.verdict ? 'result' : 'input')
  const [verdict, setVerdict] = useState<VerdictResponse | null>(navState?.verdict ?? null)
  const [inputMeta, setInputMeta] = useState<{ type: string; value: string }>(navState?.inputMeta ?? { type: '', value: '' })
  const recoveryRef = useRef<HTMLDivElement>(null)
  const phaseOrder: Phase[] = ['input', 'loading', 'result', 'recovery']
  const phaseLabels: Record<Phase, string> = {
    input: t('flow.phase.input'),
    loading: t('flow.phase.scan'),
    result: t('verdict.result.title'),
    recovery: t('flow.emergency.title'),
  }
  const currentPhaseIndex = phaseOrder.indexOf(phase)

  // Handle pre-loaded verdict from Landing page navigation
  useEffect(() => {
    if (navState?.verdict) {
      setVerdict(navState.verdict)
      setInputMeta(navState.inputMeta ?? { type: '', value: '' })
      setPhase('result')
      // Clear navigation state to prevent re-triggering on refresh
      window.history.replaceState({}, '')
    }
  }, [navState])

  const handleSubmit = async (type: string, value: string) => {
    setPhase('loading')
    setInputMeta({ type, value })
    try {
      const data = await submitVerdict(type, value)
      setVerdict(data)
      setPhase('result')
    } catch (err) {
      toast((err as Error).message || 'Verdict check failed', 'error')
      setPhase('input')
    }
  }

  const handleReset = () => {
    setPhase('input')
    setVerdict(null)
  }

  const handleContinue = () => {
    setPhase('recovery')
    setTimeout(() => {
      recoveryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <Shield size={16} className="text-cyber/60" />
          <span className="section-title">{t('verdict.result.title')}</span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white">
          {phase === 'input' && t('hero.ai.title')}
          {phase === 'loading' && 'Scanning...'}
          {phase === 'result' && t('verdict.result.title')}
          {phase === 'recovery' && t('flow.emergency.title')}
        </h2>
        <div className="mx-auto mt-5 flex max-w-2xl items-center justify-between gap-2">
          {phaseOrder.map((step, index) => {
            const active = index <= currentPhaseIndex
            const complete = index < currentPhaseIndex

            return (
              <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                    active
                      ? 'border-cyber/40 bg-cyber/15 text-cyber'
                      : 'border-white/10 bg-white/[0.02] text-slate-600'
                  }`}
                >
                  {complete ? '✓' : index + 1}
                </div>
                <span className={`truncate font-mono text-[10px] uppercase tracking-wider ${active ? 'text-slate-300' : 'text-slate-600'}`}>
                  {phaseLabels[step]}
                </span>
                {index < phaseOrder.length - 1 && (
                  <div className={`hidden h-px flex-1 sm:block ${active ? 'bg-cyber/30' : 'bg-white/[0.08]'}`} />
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Phase Content */}
      <AnimatePresence mode="wait">
        {phase === 'input' && (
          <motion.div key="input" exit={{ opacity: 0, y: -20 }} className="space-y-4">
            <VerdictInput onSubmit={handleSubmit} loading={false} />
            <InvestorAlertQuickCheck />
          </motion.div>
        )}

        {phase === 'loading' && (
          <motion.div key="loading" exit={{ opacity: 0 }}>
            <VerdictLoading />
          </motion.div>
        )}

        {phase === 'result' && verdict && (
          <motion.div key="result" exit={{ opacity: 0, y: -20 }}>
            <VerdictResult data={verdict} onReset={handleReset} onContinue={handleContinue} />
          </motion.div>
        )}

        {phase === 'recovery' && verdict && (
          <motion.div
            key="recovery"
            ref={recoveryRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <RecoveryKit verdict={verdict} inputMeta={inputMeta} onReset={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
