export interface StatCard {
  label: string
  value: number
  prefix?: string
  suffix?: string
  change: number
  changeLabel: string
  icon: string
}

export interface TrendPoint {
  date: string
  scams: number
  recovered: number
  reports: number
}

export interface LiveFeedItem {
  id: string
  timestamp: Date
  type: 'detection' | 'report' | 'recovery' | 'alert'
  platform: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  value?: string
}

export interface HeatmapCell {
  platform: string
  category: string
  count: number
  trend: 'up' | 'down' | 'stable'
}

export interface ThreatCampaign {
  id: string
  name: string
  platform: string
  category: string
  severity: 'critical' | 'high' | 'medium'
  victims: number
  totalLoss: number
  firstSeen: string
  status: 'active' | 'monitoring' | 'contained'
  description: string
}

export interface RecoveryMetric {
  label: string
  value: number
  total: number
  color: string
}

export const statsCards: StatCard[] = [
  { label: 'Scams Detected', value: 14_892, change: 12.4, changeLabel: 'vs last month', icon: 'shield' },
  { label: 'Active Threats', value: 247, change: -8.2, changeLabel: 'vs last week', icon: 'alert-triangle' },
  { label: 'Reports Filed', value: 3_461, change: 23.1, changeLabel: 'vs last month', icon: 'file-text' },
  { label: 'Amount at Risk', value: 2_847_500, prefix: 'RM', change: 15.7, changeLabel: 'vs last month', icon: 'banknote' },
  { label: 'Recovery Rate', value: 34.2, suffix: '%', change: 4.8, changeLabel: 'improvement', icon: 'trending-up' },
  { label: 'Avg Response', value: 1.8, suffix: 's', change: -22.0, changeLabel: 'faster', icon: 'zap' },
]

function generateTrendData(): TrendPoint[] {
  const data: TrendPoint[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const base = 350 + Math.sin(i * 0.3) * 80
    const spike = i === 7 || i === 15 ? 120 : 0
    data.push({
      date: d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      scams: Math.round(base + spike + Math.random() * 60),
      recovered: Math.round(base * 0.34 + Math.random() * 30),
      reports: Math.round(base * 0.25 + Math.random() * 40),
    })
  }
  return data
}

export const trendData: TrendPoint[] = generateTrendData()

const platforms = ['Telegram', 'WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'Shopee', 'Carousell', 'X']
const categories = ['Investment', 'Romance', 'Job Offer', 'E-Commerce', 'Crypto', 'Phishing', 'Impersonation', 'Loan']
const severities: LiveFeedItem['severity'][] = ['critical', 'high', 'medium', 'low']

const feedTemplates: Record<LiveFeedItem['type'], string[]> = {
  detection: [
    'Suspicious wallet {value} flagged on {platform}',
    'Phishing domain detected targeting {platform} users',
    'Known scam pattern identified in {category} scheme',
    'Automated detection: {category} scam cluster on {platform}',
  ],
  report: [
    'User reported {category} scam via {platform}',
    'Community report: {category} scheme on {platform}',
    'Victim report filed — {category} loss on {platform}',
  ],
  recovery: [
    'Recovery initiated — {value} traced on {platform}',
    'Bank freeze request submitted for {category} case',
    'Evidence package generated for {platform} report',
  ],
  alert: [
    'ALERT: Spike in {category} scams on {platform}',
    'WARNING: New {category} campaign targeting MY users',
    'URGENT: {platform} account compromise wave detected',
  ],
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateFeedItem(index: number): LiveFeedItem {
  const type = randomChoice<LiveFeedItem['type']>(['detection', 'detection', 'report', 'report', 'recovery', 'alert'])
  const platform = randomChoice(platforms)
  const category = randomChoice(categories)
  const severity = type === 'alert' ? randomChoice(['critical', 'high'] as const) : randomChoice(severities)
  const template = randomChoice(feedTemplates[type])
  const walletValue = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`
  const rmValue = `RM ${(Math.random() * 50000 + 500).toLocaleString('en-MY', { maximumFractionDigits: 0 })}`

  const message = template
    .replace('{platform}', platform)
    .replace('{category}', category)
    .replace('{value}', type === 'recovery' ? rmValue : walletValue)

  const ts = new Date()
  ts.setMinutes(ts.getMinutes() - index * 3 - Math.random() * 5)

  return { id: `feed-${index}-${Date.now()}`, timestamp: ts, type, platform, category, severity, message, value: type === 'recovery' ? rmValue : undefined }
}

export function generateLiveFeed(count: number = 20): LiveFeedItem[] {
  return Array.from({ length: count }, (_, i) => generateFeedItem(i))
}

const heatmapPlatforms = ['Telegram', 'WhatsApp', 'Facebook', 'Instagram', 'Shopee', 'TikTok', 'X']
const heatmapCategories = ['Investment', 'Romance', 'Job Offer', 'E-Commerce', 'Crypto', 'Phishing', 'Impersonation']

export function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = []
  const hotspots: Record<string, Record<string, number>> = {
    Telegram: { Investment: 0.9, Crypto: 0.95, 'Job Offer': 0.6 },
    WhatsApp: { Investment: 0.85, Romance: 0.7, Impersonation: 0.8 },
    Facebook: { Romance: 0.9, 'E-Commerce': 0.75, Phishing: 0.6 },
    Instagram: { 'E-Commerce': 0.8, Investment: 0.5, Romance: 0.55 },
    Shopee: { 'E-Commerce': 0.92, Phishing: 0.65 },
    TikTok: { 'Job Offer': 0.7, Investment: 0.6 },
    X: { Crypto: 0.75, Phishing: 0.5 },
  }
  for (const platform of heatmapPlatforms) {
    for (const category of heatmapCategories) {
      const hotspot = hotspots[platform]?.[category] ?? 0.15
      const intensity = hotspot + (Math.random() * 0.15 - 0.075)
      const count = Math.round(intensity * 180)
      const trendWeights = intensity > 0.6 ? [0.6, 0.15, 0.25] : [0.2, 0.4, 0.4]
      const r = Math.random()
      const trend: HeatmapCell['trend'] = r < trendWeights[0] ? 'up' : r < trendWeights[0] + trendWeights[1] ? 'down' : 'stable'
      cells.push({ platform, category, count: Math.max(0, count), trend })
    }
  }
  return cells
}

export const heatmapData: HeatmapCell[] = generateHeatmap()

export const threatCampaigns: ThreatCampaign[] = [
  { id: 'tc-001', name: 'MACAU SCAM 4.0', platform: 'WhatsApp', category: 'Impersonation', severity: 'critical', victims: 342, totalLoss: 1_245_000, firstSeen: '2026-01-08', status: 'active', description: 'Impersonating LHDN officers with spoofed caller ID. Demands immediate payment via crypto transfer.' },
  { id: 'tc-002', name: 'GOLDMINE INVEST', platform: 'Telegram', category: 'Investment', severity: 'critical', victims: 891, totalLoss: 3_780_000, firstSeen: '2025-12-15', status: 'active', description: 'Fake gold trading platform promising 15% weekly returns. Uses celebrity deepfakes for promotion.' },
  { id: 'tc-003', name: 'SHOPEE PHANTOM', platform: 'Shopee', category: 'E-Commerce', severity: 'high', victims: 156, totalLoss: 234_500, firstSeen: '2026-01-22', status: 'active', description: 'Clone stores selling electronics at 70% discount. Products never delivered. Uses stolen merchant identities.' },
  { id: 'tc-004', name: 'PART-TIME KING', platform: 'TikTok', category: 'Job Offer', severity: 'high', victims: 2_100, totalLoss: 890_000, firstSeen: '2026-01-03', status: 'monitoring', description: 'Fake part-time job ads requiring upfront "training deposit". Targets students and gig workers.' },
  { id: 'tc-005', name: 'LOVE TRAP MY', platform: 'Facebook', category: 'Romance', severity: 'medium', victims: 67, totalLoss: 567_000, firstSeen: '2025-11-20', status: 'monitoring', description: 'Romance scam network using AI-generated profiles. Targets divorced individuals aged 40-60.' },
]

export const recoveryMetrics: RecoveryMetric[] = [
  { label: 'Funds Frozen', value: 1_234_000, total: 3_500_000, color: '#06b6d4' },
  { label: 'Reports Filed', value: 2_890, total: 3_461, color: '#10b981' },
  { label: 'Accounts Flagged', value: 1_567, total: 2_100, color: '#eab308' },
  { label: 'Cases Resolved', value: 892, total: 1_450, color: '#8b5cf6' },
]

export const recoveryTimeline = {
  avgFreezeTime: '4.2 hours',
  avgReportTime: '12 minutes',
  avgResolutionDays: 14,
  totalRecovered: 2_456_000,
  successRate: 34.2,
}
