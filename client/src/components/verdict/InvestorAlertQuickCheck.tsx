import { useMemo, useState } from 'react'
import { ExternalLink, Search, ShieldAlert } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'

const ALERT_LIST_URL = 'https://www.sc.com.my/investor-alert-list'

function buildInvestorAlertSearchUrl(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ALERT_LIST_URL
  const encoded = encodeURIComponent(trimmed)
  // SC pages may change query params; use a resilient site-targeted search fallback.
  return `https://www.google.com/search?q=site%3Asc.com.my%2Finvestor-alert-list+${encoded}`
}

export function InvestorAlertQuickCheck() {
  const { t } = useLocale()
  const [query, setQuery] = useState('')

  const searchUrl = useMemo(() => buildInvestorAlertSearchUrl(query), [query])

  const presets = [
    'investment academy',
    'crypto trading group',
    'forex mentor',
  ]

  return (
    <Card className="p-4 border border-warning/20 bg-warning/5">
      <div className="flex items-start gap-3">
        <ShieldAlert size={18} className="text-warning mt-0.5" />
        <div className="flex-1">
          <h3 className="font-display text-sm text-white">{t('alerts.quick.title')}</h3>
          <p className="mt-1 text-xs text-slate-300">{t('alerts.quick.subtitle')}</p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('alerts.quick.placeholder')}
              className="w-full rounded-lg border border-white/10 bg-noir-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyber/40 focus:outline-none"
            />
            <a href={searchUrl} target="_blank" rel="noreferrer" className="sm:w-auto w-full">
              <Button variant="ghost" className="w-full">
                <Search size={14} />
                {t('alerts.quick.search')}
              </Button>
            </a>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => setQuery(preset)}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyber/30 hover:text-cyber"
              >
                {preset}
              </button>
            ))}
          </div>

          <a
            href={ALERT_LIST_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyber hover:text-cyber/80"
          >
            <ExternalLink size={12} />
            {t('alerts.quick.open_full')}
          </a>
        </div>
      </div>
    </Card>
  )
}
