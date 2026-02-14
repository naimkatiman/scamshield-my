import { Shield, Wifi, MapPin, Clock } from 'lucide-react'
import { useLocale } from '../../context/LocaleContext'
import { useRelativeClock } from '../../hooks/useAnimatedCounter'

export function IntelHeader() {
  const { t } = useLocale()
  const time = useRelativeClock()

  return (
    <div className="glass-card px-5 py-3 flex items-center justify-between">
      <div className="scan-line" />

      {/* Left - Logo */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-cyber/30 bg-cyber/10">
          <Shield size={20} className="text-cyber" />
          <span className="live-dot absolute -top-0.5 -right-0.5 !h-2.5 !w-2.5" />
        </div>
        <div>
          <span className="font-display text-sm font-bold text-white">
            SCAM<span className="text-cyber">SHIELD</span>
          </span>
          <p className="font-mono text-[10px] text-slate-600 tracking-wider">{t('intel.title')}</p>
        </div>
      </div>

      {/* Center - Threat Level */}
      <div className="hidden md:flex items-center gap-3">
        <span className="data-label">{t('intel.threat_level')}</span>
        <span className="font-mono text-xs font-bold text-threat-high">ELEVATED</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-3 w-1.5 rounded-sm ${i <= 3 ? 'bg-threat-high' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      {/* Right - Status */}
      <div className="flex items-center gap-4 text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="font-mono text-[10px]">{t('intel.status')}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <MapPin size={10} />
          <span className="font-mono text-[10px]">{t('intel.region')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={10} />
          <span className="font-mono text-[10px] tabular-nums">{time}</span>
        </div>
      </div>
    </div>
  )
}
