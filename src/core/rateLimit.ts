export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateCounterRow {
  count: number;
  reset_at: number;
}

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const safeWindowMs = Math.max(1, Math.floor(windowSeconds)) * 1000;
  const resetAt = now + safeWindowMs;

  await db
    .prepare(
      `INSERT INTO rate_limit_counters (counter_key, count, reset_at)
       VALUES (?, 1, ?)
       ON CONFLICT(counter_key) DO UPDATE SET
         count = CASE
           WHEN rate_limit_counters.reset_at <= ? THEN 1
           ELSE rate_limit_counters.count + 1
         END,
         reset_at = CASE
           WHEN rate_limit_counters.reset_at <= ? THEN ?
           ELSE rate_limit_counters.reset_at
         END,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(key, resetAt, now, now, resetAt)
    .run();

  const row = await db
    .prepare("SELECT count, reset_at FROM rate_limit_counters WHERE counter_key = ?")
    .bind(key)
    .first<RateCounterRow>();

  const count = Number(row?.count ?? 1);
  const resolvedResetAt = Number(row?.reset_at ?? resetAt);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: resolvedResetAt,
  };
}
