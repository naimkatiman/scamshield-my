import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Search, Wallet, AtSign, Link as LinkIcon, ArrowRight } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import { detectInputType } from '../../lib/utils'

interface VerdictInputProps {
  onSubmit: (type: string, value: string) => void
  loading: boolean
}

const typeIcons = { wallet: Wallet, contract: Wallet, handle: AtSign }
const typeLabels = { wallet: 'Wallet', contract: 'Contract', handle: 'Handle' }

export function VerdictInput({ onSubmit, loading }: VerdictInputProps) {
  const { t } = useLocale()
  const [raw, setRaw] = useState('')
  const detected = detectInputType(raw)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!detected) return
    onSubmit(detected, raw.trim())
  }

  const TypeIcon = detected ? typeIcons[detected] : null

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto"
    >
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
              <span className="h-4 w-4 border-2 border-noir-950/30 border-t-noir-950 rounded-full animate-spin" />
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
  )
}
