import { useState, useMemo, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Wallet, AtSign, ArrowRight, ShieldAlert,
  ExternalLink, Scan, AlertTriangle, Zap,
} from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import { detectInputType } from '../../lib/utils'

type Tab = 'scan' | 'alert'

interface ThreatScannerProps {
  onSubmit: (type: string, value: string) => void
  loading: boolean
}

const ALERT_LIST_URL = 'https://www.sc.com.my/investor-alert-list'

function buildInvestorAlertSearchUrl(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ALERT_LIST_URL
  const encoded = encodeURIComponent(trimmed)
  return `https://www.google.com/search?q=site%3Asc.com.my%2Finvestor-alert-list+${encoded}`
}

const typeIcons = { wallet: Wallet, contract: Wallet, handle: AtSign }
const typeLabels = { wallet: 'Wallet', contract: 'Contract', handle: 'Handle' }

const presets = ['investment academy', 'crypto trading group', 'forex mentor']

export function ThreatScanner({ onSubmit, loading }: ThreatScannerProps) {
  const { t } = useLocale()
  const [tab, setTab] = useState<Tab>('scan')
  const [raw, setRaw] = useState('')
  const [alertQuery, setAlertQuery] = useState('')
  const detected = detectInputType(raw)
  const searchUrl = useMemo(() => buildInvestorAlertSearchUrl(alertQuery), [alertQuery])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!detected) return
    onSubmit(detected, raw.trim())
  }

  const TypeIcon = detected ? typeIcons[detected] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="glass-card-glow overflow-hidden relative">
        {/* Ambient glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 bg-cyber/[0.06] rounded-full blur-3xl pointer-events-none" />

        {/* Tab switcher */}
        <div className="flex border-b border-white/[0.06] relative z-10">
          <button
            onClick={() => setTab('scan')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-mono text-xs uppercase tracking-wider transition-all relative ${
              tab === 'scan'
                ? 'text-cyber'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Scan size={14} />
            {t('verdict.tab.risk_scan') || 'Risk Scanner'}
            {tab === 'scan' && (
              <motion.div
                layoutId="scanner-tab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyber to-transparent"
              />
            )}
          </button>
          <button
            onClick={() => setTab('alert')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-mono text-xs uppercase tracking-wider transition-all relative ${
              tab === 'alert'
                ? 'text-warning'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <ShieldAlert size={14} />
            {t('verdict.tab.investor_alert') || 'Investor Alert'}
            {tab === 'alert' && (
              <motion.div
                layoutId="scanner-tab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-warning to-transparent"
              />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 relative z-10">
          <AnimatePresence mode="wait">
            {tab === 'scan' ? (
              <motion.form
                key="scan"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <motion.div
                    animate={{ boxShadow: ['0 0 0px rgba(6,182,212,0)', '0 0 10px rgba(6,182,212,0.2)', '0 0 0px rgba(6,182,212,0)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="h-6 w-6 rounded-full bg-cyber/10 border border-cyber/20 flex items-center justify-center"
                  >
                    <AlertTriangle size={12} className="text-cyber" />
                  </motion.div>
                  <p className="text-xs text-slate-400">{t('verdict.scan.hint') || 'Paste any suspicious address, handle, URL, or phone number'}</p>
                </div>

                <Input
                  value={raw}
                  onChange={e => setRaw(e.target.value)}
                  placeholder={t('verdict.input.placeholder')}
                  icon={<Search size={18} />}
                  badge={
                    detected ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 rounded-md border border-cyber/20 bg-cyber/10 px-2 py-1 font-mono text-[10px] text-cyber"
                      >
                        {TypeIcon && <TypeIcon size={10} />}
                        {typeLabels[detected]}
                      </motion.span>
                    ) : undefined
                  }
                  disabled={loading}
                />

                <div className="mt-4 flex justify-center">
                  <Button type="submit" variant="primary" size="lg" disabled={!detected || loading}>
                    {loading ? (
                      <>
                        <motion.span
                          className="h-4 w-4 border-2 border-noir-950/30 border-t-noir-950 rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        {t('verdict.btn.checking')}
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        {t('verdict.btn.check')}
                        <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="alert"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert size={14} className="text-warning" />
                  <h3 className="font-display text-sm text-white">{t('alerts.quick.title')}</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">{t('alerts.quick.subtitle')}</p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={alertQuery}
                    onChange={(e) => setAlertQuery(e.target.value)}
                    placeholder={t('alerts.quick.placeholder')}
                    className="w-full rounded-xl border border-white/10 bg-noir-800/60 px-4 py-3.5 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-warning/40 focus:outline-none focus:ring-1 focus:ring-warning/20 backdrop-blur-sm transition-all"
                  />
                  <a href={searchUrl} target="_blank" rel="noreferrer" className="sm:w-auto w-full shrink-0">
                    <Button variant="ghost" className="w-full whitespace-nowrap">
                      <Search size={14} />
                      {t('alerts.quick.search')}
                    </Button>
                  </a>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((preset, idx) => (
                    <motion.button
                      key={preset}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.06 }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setAlertQuery(preset)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-warning/30 hover:text-warning transition-all flex items-center gap-1.5"
                    >
                      <Zap size={9} className="text-warning/40" />
                      {preset}
                    </motion.button>
                  ))}
                </div>

                <a
                  href={ALERT_LIST_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-cyber hover:text-cyber/80 transition-colors"
                >
                  <ExternalLink size={12} />
                  {t('alerts.quick.open_full')}
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
