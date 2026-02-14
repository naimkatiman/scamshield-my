export type InputType = "contract" | "wallet" | "handle";

export type Verdict = "LEGIT" | "HIGH_RISK" | "UNKNOWN";

export interface ProviderSignal {
  source: string;
  score: number;
  confidence: "low" | "medium" | "high";
  evidence: string;
  tags: string[];
  category: "identity" | "scanner" | "reputation" | "community";
  critical?: boolean;
  canonicalMatch?: boolean;
  canonicalMismatch?: boolean;
  honeypot?: boolean;
}

export interface NormalizedSignal {
  source: string;
  risk: number;
  confidence: number;
  evidence: string;
  category: "identity" | "scanner" | "reputation" | "community" | "fallback";
  critical: boolean;
  tags: string[];
  canonicalMatch: boolean;
  canonicalMismatch: boolean;
  honeypot: boolean;
}

export interface VerdictResult {
  verdict: Verdict;
  score: number;
  reasons: [string, string, string];
  sources: string[];
  nextActions: string[];
}

export interface VerdictRequest {
  type: InputType;
  value: string;
  chain?: string;
}

export interface WarningCardCustomization {
  theme?: "danger" | "caution" | "safe" | "neutral";
  footerText?: string;
  language?: "en" | "bm";
}

export interface WarningCardPayload {
  verdict: Verdict;
  headline: string;
  identifiers: Record<string, string>;
  reasons: string[];
  customization?: WarningCardCustomization;
}

export interface ReportRequest {
  reporterSession: string;
  platform: string;
  category: string;
  severity: string;
  identifiers: Record<string, string>;
  narrative: string;
  evidenceKeys: string[];
}

export interface ReportGenerateRequest {
  incidentTitle: string;
  scamType: string;
  occurredAt: string;
  channel: string;
  suspects: string[];
  losses: string;
  actionsTaken: string[];
  extraNotes?: string;
}

export interface HeatmapCell {
  platform: string;
  category: string;
  count: number;
  trend: "↑" | "↓" | "→";
}

export interface QueueMessage {
  type: "enrich_verdict" | "render_card" | "rollup_heatmap";
  payload: Record<string, unknown>;
  /** Retry attempt counter (managed by producer; 0-indexed) */
  attempt?: number;
}

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  FILES_BUCKET: R2Bucket;
  SCAMSHIELD_METRICS?: AnalyticsEngineDataset;
  ENRICHMENT_QUEUE: Queue<QueueMessage>;
  ASSETS: Fetcher;
  APP_NAME: string;
  REGION: string;
  PROVIDER_MODE?: "mock" | "live";
  WARNING_CARD_RENDER_MODE?: "png" | "svg";
  BROWSER_RENDERING_ACCOUNT_ID?: string;
  CF_BROWSER_RENDERING_TOKEN?: string;
  BROWSER_RENDERING_API_BASE?: string;
  COINGECKO_API_KEY?: string;
  GOPLUS_API_BASE?: string;
  HONEYPOT_API_BASE?: string;
  CHAINABUSE_API_BASE?: string;
  CRYPTOSCAMDB_API_BASE?: string;
  OPENROUTER_API_KEY?: string;
  GOPLUS_APP_KEY?: string;
  GOPLUS_APP_SECRET?: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
}

export interface User {
  id: string;
  email: string;
  role: "user" | "admin" | "beta";
  created_at: string;
}

export interface Session {
  userId: string;
  email: string;
  role: string;
  exp: number;
}
