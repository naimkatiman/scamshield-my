const API_BASE = ''

function getCsrfToken(): string | null {
  const match = document.cookie.match(/scamshield_csrf=([^;]+)/)
  return match ? match[1] : null
}

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const csrf = getCsrfToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`)
  return data as T
}

// Auth
export interface AuthMeResponse {
  authenticated: boolean
  email?: string
  role?: string
  usage?: { used: number; limit: number; remaining: number }
  gamification?: { totalPoints: number; currentStreakDays: number; premiumUnlocked: boolean } | null
}

export const authMe = () => fetchJSON<AuthMeResponse>('/api/auth/me')
export const authLogout = () => fetch('/api/auth/logout', { credentials: 'same-origin' })

// Verdict
export interface VerdictResponse {
  key: string
  verdict: 'LEGIT' | 'HIGH_RISK' | 'UNKNOWN'
  score: number
  reasons: string[]
  sources: string[]
  nextActions: string[]
  pendingEnrichment?: boolean
  cached?: boolean
}

export const submitVerdict = (type: string, value: string, chain?: string) =>
  fetchJSON<VerdictResponse>('/api/verdict', {
    method: 'POST',
    body: JSON.stringify({ type, value, chain }),
  })

// Playbook
export interface PlaybookResponse {
  killerPitch: string
  playbook: { reportChannels: { name: string; action: string; url?: string }[] }
  recoveryTasks: { id: string; label: string; why: string; weight: number }[]
}

export const getPlaybook = () => fetchJSON<PlaybookResponse>('/api/playbook')

// Reports
export interface ReportPayload {
  incidentTitle: string
  scamType: string
  occurredAt: string
  channel: string
  suspects: string[]
  losses: string
  actionsTaken: string[]
  extraNotes: string
}

export interface ReportsResponse {
  forBank: string
  forPolice: string
  forPlatform: string
  mode?: string
  fallback?: boolean
}

export const generateReports = (payload: ReportPayload) =>
  fetchJSON<ReportsResponse>('/api/report/generate', { method: 'POST', body: JSON.stringify(payload) })

export const generateAIReports = (payload: ReportPayload) =>
  fetchJSON<ReportsResponse>('/api/report/generate-ai', { method: 'POST', body: JSON.stringify(payload) })

// Warning Card
export interface WarningCardResponse {
  warningPageUrl: string
  imageUrl: string
  slug: string
}

export const createWarningCard = (data: { verdict: string; headline: string; identifiers: Record<string, string>; reasons: string[] }) =>
  fetchJSON<WarningCardResponse>('/api/warning-card', { method: 'POST', body: JSON.stringify(data) })

// AI Chat
export interface ChatResponse {
  message: string
  error?: string
}

export const sendChatMessage = (messages: { role: string; content: string }[]) =>
  fetchJSON<ChatResponse>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) })

// Recovery
export const updateRecoveryProgress = (completedTaskIds: string[]) =>
  fetchJSON<{ progress: number }>('/api/recovery-progress', { method: 'POST', body: JSON.stringify({ completedTaskIds }) })

// Heatmap
export const getHeatmap = () => fetchJSON<{ grid: { platform: string; category: string; count: number; trend: string }[] }>('/api/heatmap')

// Dashboard
export const getDashboardClient = () => fetchJSON<Record<string, unknown>>('/api/dashboard/client')
export const getDashboardAdmin = () => fetchJSON<Record<string, unknown>>('/api/dashboard/admin')
