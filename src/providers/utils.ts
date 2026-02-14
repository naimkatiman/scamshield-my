const MAX_FETCH_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 120;
const MAX_BACKOFF_MS = 1200;

type ProviderErrorKind = "timeout" | "rate_limit" | "http" | "network" | "circuit_open" | "unknown";

export class ProviderFetchError extends Error {
  kind: ProviderErrorKind;
  status?: number;
  retryable: boolean;
  retryAfterMs?: number;

  constructor(
    message: string,
    kind: ProviderErrorKind,
    options: {
      status?: number;
      retryable?: boolean;
      retryAfterMs?: number;
    } = {},
  ) {
    super(message);
    this.name = "ProviderFetchError";
    this.kind = kind;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const asSeconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(headerValue);
  if (Number.isNaN(asDate)) {
    return undefined;
  }

  const delta = asDate - Date.now();
  return delta > 0 ? delta : undefined;
}

function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelayMs(error: ProviderFetchError, attempt: number): number {
  if (typeof error.retryAfterMs === "number" && Number.isFinite(error.retryAfterMs)) {
    return Math.max(0, Math.min(error.retryAfterMs, MAX_BACKOFF_MS * 5));
  }

  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 90);
  return exponential + jitter;
}

function asProviderError(error: unknown, label: string, timeoutMs: number): ProviderFetchError {
  if (error instanceof ProviderFetchError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ProviderFetchError(`${label} fetch aborted after ${timeoutMs}ms`, "timeout", {
      retryable: true,
    });
  }

  if (error instanceof Error && error.message.includes("circuit open")) {
    return new ProviderFetchError(error.message, "circuit_open", { retryable: true });
  }

  if (error instanceof TypeError) {
    return new ProviderFetchError(`${label} network error`, "network", {
      retryable: true,
    });
  }

  const message = error instanceof Error ? error.message : `${label} failed unexpectedly`;
  return new ProviderFetchError(message, "unknown", { retryable: false });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderFetchError(`${label} timed out after ${timeoutMs}ms`, "timeout", { retryable: true }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function safeFetchJson(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<unknown> {
  const startedAt = Date.now();
  let lastError: ProviderFetchError | undefined;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const elapsed = Date.now() - startedAt;
    const remainingBudget = timeoutMs - elapsed;
    if (remainingBudget <= 75) {
      break;
    }

    const perAttemptTimeout = Math.max(150, remainingBudget);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perAttemptTimeout);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new ProviderFetchError(`${label} rate-limited (429)`, "rate_limit", {
          status: 429,
          retryable: true,
          retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
        });
      }

      if (!response.ok) {
        throw new ProviderFetchError(`${label} returned ${response.status}`, "http", {
          status: response.status,
          retryable: isRetriableStatus(response.status),
        });
      }

      return await response.json();
    } catch (error) {
      const normalized = asProviderError(error, label, perAttemptTimeout);
      lastError = normalized;

      const canRetry = normalized.retryable && attempt < MAX_FETCH_ATTEMPTS;
      if (!canRetry) {
        throw normalized;
      }

      const elapsedAfterFailure = Date.now() - startedAt;
      const remainingAfterFailure = timeoutMs - elapsedAfterFailure;
      const delayMs = Math.min(computeDelayMs(normalized, attempt), Math.max(0, remainingAfterFailure - 50));
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new ProviderFetchError(`${label} failed before response`, "unknown");
}

export function isProviderFetchError(error: unknown): error is ProviderFetchError {
  return error instanceof ProviderFetchError;
}

export function isErrorWithMessage(error: unknown): error is { message: string } {
  return typeof error === "object" && error !== null && "message" in error;
}
