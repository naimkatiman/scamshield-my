import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'
import { trendData } from '../data/mockData'

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-white/10 bg-noir-900/95 px-4 py-3 shadow-xl backdrop-blur-xl">
      <p className="mb-2 font-mono text-xs text-slate-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-mono text-xs text-slate-400 capitalize">
            {entry.name}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-200">
            {entry.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ThreatTrendChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="glass-card-glow p-5"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="section-title mb-1">Threat Activity — 30 Day</h3>
          <p className="font-mono text-[11px] text-slate-500">
            Scam detections, reports filed, and funds recovered
          </p>
        </div>
        <div className="flex gap-4">
          {[
            { color: '#06b6d4', label: 'Detected' },
            { color: '#f97316', label: 'Reports' },
            { color: '#10b981', label: 'Recovered' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-mono text-[10px] text-slate-500">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={trendData}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradScams" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradReports" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradRecovered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              interval={4}
            />

            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="scams"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#gradScams)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#06b6d4',
                stroke: '#030712',
                strokeWidth: 2,
              }}
            />

            <Area
              type="monotone"
              dataKey="reports"
              stroke="#f97316"
              strokeWidth={1.5}
              fill="url(#gradReports)"
              dot={false}
              activeDot={{
                r: 3,
                fill: '#f97316',
                stroke: '#030712',
                strokeWidth: 2,
              }}
            />

            <Area
              type="monotone"
              dataKey="recovered"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#gradRecovered)"
              dot={false}
              activeDot={{
                r: 3,
                fill: '#10b981',
                stroke: '#030712',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
