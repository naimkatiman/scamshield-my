import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Building2, BadgeAlert, Globe } from 'lucide-react'
import { Tabs } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import { useToast } from '../../context/ToastContext'
import { copyToClipboard } from '../../lib/utils'
import type { ReportsResponse } from '../../lib/api'

interface ReportsStepProps {
  reports: ReportsResponse | null
  loading: boolean
}

const tabs = [
  { id: 'bank', label: 'Bank', icon: <Building2 size={12} /> },
  { id: 'police', label: 'Police', icon: <BadgeAlert size={12} /> },
  { id: 'platform', label: 'Platform', icon: <Globe size={12} /> },
]

export function ReportsStep({ reports, loading }: ReportsStepProps) {
  const { t } = useLocale()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('bank')
  const [copied, setCopied] = useState<string | null>(null)

  if (loading || !reports) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-white/[0.03]" />
        <div className="h-40 rounded-lg bg-white/[0.03]" />
      </div>
    )
  }

  const reportMap: Record<string, string> = {
    bank: reports.forBank,
    police: reports.forPolice,
    platform: reports.forPlatform,
  }

  const currentReport = reportMap[activeTab] ?? ''

  const handleCopy = async () => {
    await copyToClipboard(currentReport)
    setCopied(activeTab)
    toast('Report copied to clipboard', 'success')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="relative">
          <textarea
            readOnly
            value={currentReport}
            className="w-full h-48 rounded-lg border border-white/[0.06] bg-noir-900/60 p-4 font-mono text-xs text-slate-300 leading-relaxed resize-none focus:outline-none focus:border-cyber/20"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3"
            onClick={handleCopy}
          >
            {copied === activeTab ? <Check size={12} className="text-safe" /> : <Copy size={12} />}
            {copied === activeTab ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
