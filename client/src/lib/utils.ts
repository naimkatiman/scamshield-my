import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function detectInputType(raw: string): 'wallet' | 'contract' | 'handle' | null {
  const trimmed = raw.trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'wallet'
  if (/^@?[A-Za-z0-9._-]{3,64}$/.test(trimmed)) return 'handle'
  if (/^\+?\d{8,15}$/.test(trimmed.replace(/[\s-]/g, ''))) return 'handle'
  if (/^https?:\/\/(t\.me|telegram\.me|wa\.me|whatsapp\.com|instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com)\//i.test(trimmed)) return 'handle'
  return null
}

export function formatNumber(n: number, opts?: { prefix?: string; suffix?: string; decimals?: number }): string {
  const { prefix = '', suffix = '', decimals } = opts ?? {}
  let formatted: string
  if (n >= 1_000_000) {
    formatted = (n / 1_000_000).toFixed(1) + 'M'
  } else if (n >= 1_000) {
    formatted = n.toLocaleString('en-MY', { maximumFractionDigits: decimals ?? 0 })
  } else {
    formatted = decimals !== undefined ? n.toFixed(decimals) : String(n)
  }
  return `${prefix}${formatted}${suffix}`
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
