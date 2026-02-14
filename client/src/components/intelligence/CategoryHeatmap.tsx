import { motion } from 'framer-motion'
import { Grid3X3 } from 'lucide-react'
import { heatmapData } from '../../data/mockIntelligence'

const platforms = ['Telegram', 'WhatsApp', 'Facebook', 'Instagram', 'Shopee', 'TikTok', 'X']
const categories = ['Investment', 'Romance', 'Job Offer', 'E-Commerce', 'Crypto', 'Phishing', 'Impersonation']

function getCellColor(count: number): string {
  if (count <= 30) return 'bg-white/[0.04]'
  if (count <= 60) return 'bg-cyber/[0.15]'
  if (count <= 100) return 'bg-threat-medium/[0.2]'
  if (count <= 140) return 'bg-threat-high/[0.25]'
  return 'bg-threat-critical/[0.3]'
}

function getTrendArrow(trend: string): { symbol: string; color: string } {
  if (trend === 'up') return { symbol: '▲', color: 'text-threat-critical' }
  if (trend === 'down') return { symbol: '▼', color: 'text-safe' }
  return { symbol: '', color: '' }
}

export function CategoryHeatmap() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-5">
        <Grid3X3 size={14} className="text-cyber/70" />
        <span className="section-title">Platform x Category Heatmap</span>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <div className="min-w-[600px]">
          {/* Header row */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${categories.length}, 1fr)` }}>
            <div />
            {categories.map(cat => (
              <div key={cat} className="text-center font-mono text-[9px] text-slate-600 truncate px-1 py-2">
                {cat}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {platforms.map(platform => (
            <div key={platform} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${categories.length}, 1fr)` }}>
              <div className="flex items-center font-mono text-[10px] text-slate-400 pr-2">
                {platform}
              </div>
              {categories.map(category => {
                const cell = heatmapData.find(c => c.platform === platform && c.category === category)
                const count = cell?.count ?? 0
                const trend = getTrendArrow(cell?.trend ?? 'stable')
                return (
                  <div
                    key={category}
                    className={`heatmap-cell h-9 ${getCellColor(count)}`}
                    title={`${platform} × ${category}: ${count} reports`}
                  >
                    <span className="text-[10px] text-slate-400">{count}</span>
                    {trend.symbol && (
                      <span className={`text-[8px] ml-0.5 ${trend.color}`}>{trend.symbol}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="font-mono text-[9px] text-slate-700">LOW</span>
        {['bg-white/[0.04]', 'bg-cyber/[0.15]', 'bg-threat-medium/[0.2]', 'bg-threat-high/[0.25]', 'bg-threat-critical/[0.3]'].map((bg, i) => (
          <div key={i} className={`h-3 w-6 rounded-sm ${bg}`} />
        ))}
        <span className="font-mono text-[9px] text-slate-700">HIGH</span>
      </div>
    </motion.div>
  )
}
