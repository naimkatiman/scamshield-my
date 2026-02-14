import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { trendData } from '../../data/mockIntelligence'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="glass-card !p-3 !rounded-lg text-xs">
      <p className="font-mono text-slate-500 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-mono font-semibold text-slate-200">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export function ThreatTrendChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp size={14} className="text-cyber/70" />
        <span className="section-title">30-Day Threat Trend</span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-scams" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-reports" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-recovered" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={3} />
          <YAxis tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="scams" stroke="#06b6d4" strokeWidth={2} fill="url(#grad-scams)" name="Detected" />
          <Area type="monotone" dataKey="reports" stroke="#f97316" strokeWidth={1.5} fill="url(#grad-reports)" name="Reports" />
          <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={1.5} fill="url(#grad-recovered)" name="Recovered" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
