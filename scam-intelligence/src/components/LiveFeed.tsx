import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateLiveFeed, type LiveFeedItem } from '../data/mockData'
import clsx from 'clsx'

const TYPE_ICONS: Record<LiveFeedItem['type'], string> = {
  detection: '◆',
  report: '◇',
  recovery: '●',
  alert: '▲',
}

const TYPE_COLORS: Record<LiveFeedItem['type'], string> = {
  detection: 'text-cyber',
  report: 'text-slate-400',
  recovery: 'text-safe',
  alert: 'text-threat-critical',
}

const SEVERITY_STYLES: Record<LiveFeedItem['severity'], string> = {
  critical: 'threat-badge-critical',
  high: 'threat-badge-high',
  medium: 'threat-badge-medium',
  low: 'threat-badge-low',
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function LiveFeed() {
  const [items, setItems] = useState<LiveFeedItem[]>(() => generateLiveFeed(15))
  const [filter, setFilter] = useState<LiveFeedItem['type'] | 'all'>('all')
  const listRef = useRef<HTMLDivElement>(null)

  // Simulate new items arriving
  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const newItem = generateLiveFeed(1)[0]
        newItem.timestamp = new Date()
        newItem.id = `live-${Date.now()}`
        return [newItem, ...prev.slice(0, 19)]
      })
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="glass-card flex h-full flex-col"
    >
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <h3 className="section-title">Live Feed</h3>
          </div>
          <span className="font-mono text-[10px] text-slate-500">
            {items.length} events
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'detection', 'report', 'recovery', 'alert'] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all duration-200',
                  filter === f
                    ? 'border border-cyber/30 bg-cyber/10 text-cyber-bright'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-400'
                )}
              >
                {f}
              </button>
            )
          )}
        </div>
      </div>

      {/* Feed items */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-2 py-2"
        style={{ maxHeight: '480px' }}
      >
        <AnimatePresence initial={false}>
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className={clsx(
                'group cursor-default rounded-lg border border-transparent px-3 py-2.5 transition-all duration-200 hover:border-white/[0.06] hover:bg-white/[0.02]',
                item.type === 'alert' && 'border-threat-critical/10 bg-threat-critical/[0.03]'
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={clsx('text-xs', TYPE_COLORS[item.type])}>
                    {TYPE_ICONS[item.type]}
                  </span>
                  <span className={SEVERITY_STYLES[item.severity]}>
                    {item.severity}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-slate-600">
                  {timeAgo(item.timestamp)}
                </span>
              </div>

              <p className="mb-1.5 text-sm leading-snug text-slate-300">
                {item.message}
              </p>

              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  {item.platform}
                </span>
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  {item.category}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom scanner */}
      <div className="relative h-px">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber/20 to-transparent" />
      </div>
    </motion.div>
  )
}
