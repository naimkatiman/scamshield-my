import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import { Search, BarChart3, ArrowRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import shieldScanData from '../../assets/lottie/shield-scan.json'

export function HeroSection() {
  const { t } = useLocale()

  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      <div className="mx-auto max-w-4xl px-4 text-center">
        {/* Lottie Shield */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto mb-8 w-32 h-32 md:w-40 md:h-40"
        >
          <Lottie animationData={shieldScanData} loop className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="font-display text-4xl md:text-6xl font-bold tracking-tight text-white mb-5"
        >
          <span className="gradient-text-cyber">{t('landing.hero.title')}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="font-body text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {t('landing.hero.subtitle')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/check">
            <Button variant="primary" size="lg">
              <Search size={18} />
              {t('landing.hero.cta_check')}
              <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/intelligence">
            <Button variant="ghost" size="lg">
              <BarChart3 size={18} />
              {t('landing.hero.cta_intel')}
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
