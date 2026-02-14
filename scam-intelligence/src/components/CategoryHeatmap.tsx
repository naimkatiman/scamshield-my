import { motion } from 'framer-motion'
import { heatmapData } from '../data/mockData'
import clsx from 'clsx'

const platforms = ['Telegram', 'WhatsApp', 'Facebook', 'Instagram', 'Shopee', 'TikTok', 'X']
const categories = ['Investment', 'Romance', 'Job Offer', 'E-Commerce', 'Crypto', 'Phishing', 'Impersonation']

function getHeatColor(count: number): string {
  if (count >= 140) return 'bg-threat-critical/70 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]'
  if (count >= 100) return 'bg-threat-high/50 text-threat-high'
  if (count >= 60) return 'bg-threat-medium/30 text-threat-medium'
  if (count >= 30) return 'bg-cyber/15 text-cyber'
  if (count > 0) return 'bg-white/[0.04] text-slate-500'
  return 'bg-transparent text-slate-700'
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'stable') return null
  return (
    <span className={clsx(
      'ml-0.5 text-[8px]',
      trend === 'up' ? 'text-threat-critical' : 'text-safe'
    )}>
      {trend === 'up' ? '▲' : '▼'}
    </span>
  )
}

export default function CategoryHeatmap() {
  const maxCount = Math.max(...heatmapData.map((c) => c.count))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="glass-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="section-title mb-1">Platform × Category Matrix</h3>
          <p className="font-mono text-[11px] text-slate-500">
            7-day report density — {heatmapData.reduce((a, c) => a + c.count, 0).toLocaleString()} total events
          </p>
        </div>

        {/* Legend */}
        <div className="hidden items-center gap-1.5 md:flex">
          <span className="font-mono text-[9px] text-slate-600">LOW</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
              <div
                key={opacity}
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: `rgba(239, 68, 68, ${opacity})`,
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] text-slate-600">HIGH</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Column headers */}
          <div className="mb-1 grid grid-cols-[100px_repeat(7,1fr)] gap-1">
            <div /> {/* Empty corner */}
            {categories.map((cat) => (
              <div
                key={cat}
                className="px-1 text-center font-mono text-[9px] uppercase tracking-wider text-slate-500"
              >
                {cat.length > 8 ? cat.slice(0, 7) + '.' : cat}
              </div>
            ))}
          </div>

          {/* Rows */}
          {platforms.map((platform, pi) => (
            <motion.div
              key={platform}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + pi * 0.05 }}
              className="grid grid-cols-[100px_repeat(7,1fr)] gap-1 mb-1"
            >
              <div className="flex items-center px-1 font-mono text-xs text-slate-400">
                {platform}
              </div>
              {categories.map((category) => {
                const cell = heatmapData.find(
                  (c) => c.platform === platform && c.category === category
                )
                const count = cell?.count ?? 0
                const intensity = count / maxCount

                return (
                  <div
                    key={`${platform}-${category}`}
                    className={clsx(
                      'heatmap-cell h-9',
                      getHeatColor(count)
                    )}
                    title={`${platform} × ${category}: ${count} reports (${cell?.trend ?? 'stable'})`}
                  >
                    {count > 0 && (
                      <span className="flex items-center">
                        {count}
                        {cell && <TrendArrow trend={cell.trend} />}
                      </span>
                    )}
                  </div>
                )
              })}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
