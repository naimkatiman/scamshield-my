import { Shield } from 'lucide-react'
import { useLocale } from '../../context/LocaleContext'

export function Footer() {
  const { t } = useLocale()
  return (
    <footer className="relative z-10 border-t border-white/[0.04] py-8 mt-16">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Shield size={14} className="text-cyber/40" />
          <span className="font-display text-xs font-semibold tracking-widest text-cyber/40 uppercase">ScamShield MY</span>
        </div>
        <p className="font-mono text-[11px] text-slate-600 max-w-lg mx-auto leading-relaxed">
          {t('footer.legal')}
        </p>
        <p className="font-mono text-[10px] text-slate-700 mt-2">
          {t('footer.sub')}
        </p>
      </div>
    </footer>
  )
}
