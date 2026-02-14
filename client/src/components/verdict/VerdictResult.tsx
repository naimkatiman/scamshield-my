import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import { AlertTriangle, CheckCircle, HelpCircle, ChevronRight } from 'lucide-react'
import { VerdictBadge } from '../ui/Badge'
import { ProgressBar } from '../ui/Progress'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import type { VerdictResponse } from '../../lib/api'
import successCheckData from '../../assets/lottie/success-check.json'
import alertWarningData from '../../assets/lottie/alert-warning.json'

interface VerdictResultProps {
  data: VerdictResponse
  onReset: () => void
  onContinue: () => void
}

const reasonIcons: Record<string, typeof AlertTriangle> = {
  HIGH_RISK: AlertTriangle,
  LEGIT: CheckCircle,
  UNKNOWN: HelpCircle,
}

export function VerdictResult({ data, onReset, onContinue }: VerdictResultProps) {
  const { t } = useLocale()
  const isRisky = data.verdict === 'HIGH_RISK' || data.verdict === 'UNKNOWN'
  const ReasonIcon = reasonIcons[data.verdict]
  const lottieData = data.verdict === 'LEGIT' ? successCheckData : alertWarningData
  const scoreColor = data.score >= 70 ? 'red' : data.score < 30 ? 'green' : 'amber'
  const cardVariant = data.verdict === 'HIGH_RISK' ? 'threat' : data.verdict === 'LEGIT' ? 'safe' : 'default'

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Verdict Header */}
      <Card variant={cardVariant} className="text-center py-8">
        {/* Lottie */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto w-20 h-20 mb-5"
        >
          <Lottie animationData={lottieData} loop={false} className="w-full h-full" />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-5"
        >
          <VerdictBadge verdict={data.verdict} size="lg" />
        </motion.div>

        {/* Score Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-sm mx-auto"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="data-label">{t('verdict.result.risk_score')}</span>
            <span className="font-mono text-sm font-bold text-slate-200">{data.score}%</span>
          </div>
          <ProgressBar value={data.score} color={scoreColor} />
        </motion.div>
      </Card>

      {/* Reasons */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } } }}
        className="space-y-3"
      >
        {data.reasons.map((reason, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
          >
            <Card className="flex items-start gap-3 p-4">
              <ReasonIcon size={16} className={data.verdict === 'LEGIT' ? 'text-safe mt-0.5' : 'text-threat-critical mt-0.5'} />
              <span className="font-body text-sm text-slate-300 leading-relaxed">{reason}</span>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col sm:flex-row justify-center gap-3 pt-2"
      >
        {isRisky ? (
          <Button variant="danger" size="lg" onClick={onContinue}>
            <AlertTriangle size={16} />
            Recovery Kit
            <ChevronRight size={14} />
          </Button>
        ) : (
          <Button variant="safe" size="lg" onClick={onReset}>
            <CheckCircle size={16} />
            {t('flow.legit.check_another')}
          </Button>
        )}
        <Button variant="ghost" size="md" onClick={onReset}>
          Check Another
        </Button>
      </motion.div>

      {/* Legit Tips */}
      {data.verdict === 'LEGIT' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Card variant="safe" className="p-5">
            <h3 className="font-display text-sm font-semibold text-safe mb-3">{t('flow.legit.title')}</h3>
            <p className="text-xs text-slate-500 mb-3">{t('flow.legit.subtitle')}</p>
            <ul className="space-y-2">
              {[t('flow.legit.tip1'), t('flow.legit.tip2'), t('flow.legit.tip3')].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckCircle size={14} className="text-safe/50 mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
