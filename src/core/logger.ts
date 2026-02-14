const EVM_PATTERN = /0x[a-fA-F0-9]{40}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function maskValue(value: string): string {
  return value
    .replace(EVM_PATTERN, (match) => `${match.slice(0, 6)}...${match.slice(-4)}`)
    .replace(EMAIL_PATTERN, (match) => {
      const [local, domain] = match.split("@");
      return `${local.slice(0, 2)}***@${domain}`;
    });
}

function sanitize(data: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return data; // prevent stack overflow on deeply nested data
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      result[key] = maskValue(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? maskValue(item)
          : typeof item === "object" && item !== null
            ? sanitize(item as Record<string, unknown>, depth + 1)
            : item,
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitize(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, data: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(data),
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};
