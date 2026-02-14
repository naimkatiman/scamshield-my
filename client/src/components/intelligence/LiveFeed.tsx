import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Eye, FileText, RefreshCw, AlertTriangle } from 'lucide-react'
import { SeverityBadge } from '../ui/Badge'
import { generateLiveFeed, type LiveFeedItem } from '../../data/mockIntelligence'
import { timeAgo } from '../../lib/utils'

const typeIcons = {
  detection: Eye,
  report: FileText,
  recovery: RefreshCw,
  alert: AlertTriangle,
}

const typeColors = {
  detection: 'text-cyber',
  report: 'text-safe',
  recovery: 'text-threat-medium',
  alert: 'text-threat-critical',
}

export function LiveFeed() {
  const [items, setItems] = useState<LiveFeedItem[]>(() => generateLiveFeed(15))
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => {
        const newItem = generateLiveFeed(1)[0]
        return [newItem, ...prev.slice(0, 19)]
      })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
  const filters = ['all', 'detection', 'report', 'recovery', 'alert']

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="glass-card p-5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <Radio size={14} className="text-cyber/70" />
          <span className="section-title">Live Feed</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-2 py-1 font-mono text-[10px] transition-all ${
              filter === f ? 'bg-cyber/10 text-cyber border border-cyber/20' : 'text-slate-600 hover:text-slate-400 border border-transparent'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Feed Items */}
      <div className="flex-1 max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
        <AnimatePresence initial={false}>
          {filtered.map(item => {
            const Icon = typeIcons[item.type]
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-2.5 rounded-lg bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors"
              >
                <Icon size={12} className={`${typeColors[item.type]} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[11px] text-slate-300 leading-relaxed">{item.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <SeverityBadge severity={item.severity} />
                    <span className="font-mono text-[9px] text-slate-700">{timeAgo(item.timestamp)}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
