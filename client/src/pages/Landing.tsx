import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { Bot, Search } from 'lucide-react'
import { InlineAiChat } from '../components/landing/InlineAiChat'
import { StatsPreview } from '../components/landing/StatsPreview'
import { FeatureCards } from '../components/landing/FeatureCards'
import { VerdictInput } from '../components/verdict/VerdictInput'
import { InvestorAlertQuickCheck } from '../components/verdict/InvestorAlertQuickCheck'
import { ShieldLottie, TypewriterText } from '../components/effects'
import { useLocale } from '../context/LocaleContext'
import { useToast } from '../context/ToastContext'
import { submitVerdict } from '../lib/api'

type Mode = 'ai' | 'manual'

export function Landing() {
  const { t } = useLocale()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(() => {
    return (localStorage.getItem('scamshield-mode') as Mode) || 'ai'
  })
  const [scanning, setScanning] = useState(false)
  const [showTypewriter, setShowTypewriter] = useState(true)
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  const switchMode = (m: Mode) => {
    setMode(m)
    localStorage.setItem('scamshield-mode', m)
  }

  const handleManualSubmit = async (type: string, value: string) => {
    setScanning(true)
    try {
      const data = await submitVerdict(type, value)
      // Navigate to /check with verdict data in state
      navigate('/check', { state: { verdict: data, inputMeta: { type, value } } })
    } catch (err) {
      toast((err as Error).message || 'Scan failed', 'error')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="pb-16">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="mx-auto max-w-4xl px-4">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ opacity, scale }}
            className="text-center mb-8"
          >
            <motion.div 
              className="flex items-center justify-center gap-2 mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <ShieldLottie size={20} className="opacity-60" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-cyber/50">
                {t('nav.community_edition')}
              </span>
            </motion.div>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
              {mode === 'ai' ? (
                showTypewriter ? (
                  <TypewriterText 
                    text={t('hero.ai.title')} 
                    speed={60} 
                    delay={400}
                    onComplete={() => setShowTypewriter(false)}
                  />
                ) : (
                  <span>{t('hero.ai.title')}</span>
                )
              ) : (
                <span className="gradient-text-cyber">{t('landing.hero.title')}</span>
              )}
            </h1>
            <p className="font-body text-base md:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              {mode === 'ai' ? t('hero.ai.subtitle') : t('landing.hero.subtitle')}
            </p>
          </motion.div>

          {/* Mode Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
              <button
                onClick={() => switchMode('ai')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs transition-all ${
                  mode === 'ai'
                    ? 'bg-cyber/10 border border-cyber/20 text-cyber'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Bot size={14} />
                {t('nav.ai_assistant')}
              </button>
              <button
                onClick={() => switchMode('manual')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs transition-all ${
                  mode === 'manual'
                    ? 'bg-cyber/10 border border-cyber/20 text-cyber'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Search size={14} />
                {t('nav.manual_toolkit')}
              </button>
            </div>
          </motion.div>

          {/* Mode Content */}
          <AnimatePresence mode="wait">
            {mode === 'ai' ? (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <InlineAiChat />
              </motion.div>
            ) : (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <VerdictInput onSubmit={handleManualSubmit} loading={scanning} />
                <InvestorAlertQuickCheck />
                <p className="text-center font-mono text-[11px] text-slate-600">
                  {t('landing.trust')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <StatsPreview />
      <FeatureCards />
    </div>
  )
}
