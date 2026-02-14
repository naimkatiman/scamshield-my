export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new Error(`${label} rate-limited (429)`);
    }

    if (!response.ok) {
      throw new Error(`${label} returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${label} fetch aborted after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function isErrorWithMessage(error: unknown): error is { message: string } {
  return typeof error === "object" && error !== null && "message" in error;
}
