import { motion } from 'framer-motion'
import { Copy, ExternalLink, MessageCircle, Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { TelegramIcon, WhatsAppIcon } from '../ui/BrandIcons'
import { useLocale } from '../../context/LocaleContext'
import { useToast } from '../../context/ToastContext'
import { copyToClipboard } from '../../lib/utils'
import type { WarningCardResponse } from '../../lib/api'

interface ShareStepProps {
  warningCard: WarningCardResponse | null
  loading: boolean
}

export function ShareStep({ warningCard, loading }: ShareStepProps) {
  const { t } = useLocale()
  const { toast } = useToast()

  if (loading || !warningCard) {
    return <div className="h-32 rounded-lg bg-white/[0.03] animate-pulse" />
  }

  const url = warningCard.warningPageUrl
  const shareText = `Warning: Suspicious activity detected. Check details: ${url}`

  const handleCopy = async () => {
    await copyToClipboard(url)
    toast('Link copied!', 'success')
  }

  return (
    <div className="space-y-5">
      {/* Warning URL */}
      <div className="flex items-center gap-2 rounded-lg bg-noir-900/60 border border-white/[0.06] p-3">
        <code className="flex-1 font-mono text-xs text-cyber truncate">{url}</code>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          <Copy size={12} />
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink size={12} />
          </Button>
        </a>
      </div>

      {/* Warning Image Preview */}
      {warningCard.imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-white/[0.06] overflow-hidden bg-noir-900/40"
        >
          <img
            src={warningCard.imageUrl}
            alt="Warning card preview"
            className="w-full max-h-48 object-contain"
            loading="lazy"
          />
        </motion.div>
      )}

      {/* Share Buttons */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="safe" size="sm">
            <WhatsAppIcon size={14} />
            {t('flow.share.whatsapp')}
          </Button>
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Warning: Suspicious activity detected')}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm">
            <TelegramIcon size={14} />
            {t('flow.share.telegram')}
          </Button>
        </a>
        {typeof navigator.share === 'function' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigator.share({ title: 'ScamShield Warning', text: shareText, url })}
          >
            <ExternalLink size={14} />
            {t('flow.share.native')}
          </Button>
        )}
      </div>
    </div>
  )
}
