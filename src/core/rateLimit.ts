export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateCounter {
  count: number;
  resetAt: number;
}

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const raw = await kv.get(key);
  let counter: RateCounter = { count: 0, resetAt: now + windowSeconds * 1000 };

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<RateCounter>;
      if (typeof parsed.count === "number" && typeof parsed.resetAt === "number") {
        counter = {
          count: parsed.count,
          resetAt: parsed.resetAt,
        };
      }
    } catch {
      counter = { count: 0, resetAt: now + windowSeconds * 1000 };
    }
  }

  if (counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + windowSeconds * 1000 };
  }

  counter.count += 1;
  const ttl = Math.max(60, Math.ceil((counter.resetAt - now) / 1000));
  await kv.put(key, JSON.stringify(counter), { expirationTtl: ttl });

  return {
    allowed: counter.count <= limit,
    remaining: Math.max(0, limit - counter.count),
    resetAt: counter.resetAt,
  };
}