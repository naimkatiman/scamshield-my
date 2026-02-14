import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'
import { VerdictInput } from '../components/verdict/VerdictInput'
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
  const [phase, setPhase] = useState<Phase>('input')
  const [verdict, setVerdict] = useState<VerdictResponse | null>(null)
  const [inputMeta, setInputMeta] = useState<{ type: string; value: string }>({ type: '', value: '' })
  const recoveryRef = useRef<HTMLDivElement>(null)

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
      </motion.div>

      {/* Phase Content */}
      <AnimatePresence mode="wait">
        {phase === 'input' && (
          <motion.div key="input" exit={{ opacity: 0, y: -20 }}>
            <VerdictInput onSubmit={handleSubmit} loading={false} />
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
