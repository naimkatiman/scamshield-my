import { motion } from 'framer-motion'
import { Zap, HeartPulse, Radar } from 'lucide-react'
import { Card } from '../ui/Card'
import { useLocale } from '../../context/LocaleContext'

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function FeatureCards() {
  const { t } = useLocale()

  const features = [
    { icon: Zap, title: t('landing.feature.verdict'), desc: t('landing.feature.verdict_desc'), color: 'text-cyber', glow: 'group-hover:shadow-cyber/10' },
    { icon: HeartPulse, title: t('landing.feature.recovery'), desc: t('landing.feature.recovery_desc'), color: 'text-safe', glow: 'group-hover:shadow-safe/10' },
    { icon: Radar, title: t('landing.feature.intel'), desc: t('landing.feature.intel_desc'), color: 'text-threat-high', glow: 'group-hover:shadow-threat-high/10' },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className="grid md:grid-cols-3 gap-5 mx-auto max-w-5xl px-4 mt-16"
    >
      {features.map(f => (
        <motion.div key={f.title} variants={item}>
          <Card hover variant="glow" className={`group p-7 h-full transition-shadow duration-300 ${f.glow}`}>
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] ${f.color}`}>
              <f.icon size={22} />
            </div>
            <h3 className="font-display text-base font-semibold text-white mb-2">{f.title}</h3>
            <p className="font-body text-sm text-slate-400 leading-relaxed">{f.desc}</p>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
