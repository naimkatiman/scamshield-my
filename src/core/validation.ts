import type { InputType } from "../types";

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const HANDLE_USERNAME_REGEX = /^@?[A-Za-z0-9._-]{3,64}$/;
const HANDLE_PHONE_REGEX = /^\+?\d{8,15}$/;
const HANDLE_URL_REGEX = /^https?:\/\/(t\.me|telegram\.me|wa\.me|whatsapp\.com|instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com)\/.+/i;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

export const SUPPORTED_CHAINS = [
  "evm",
  "ethereum",
  "bsc",
  "polygon",
  "arbitrum",
  "optimism",
  "base",
  "avalanche",
  "solana",
] as const;

function isValidHandleInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (HANDLE_USERNAME_REGEX.test(trimmed)) {
    return true;
  }

  const compactPhone = trimmed.replace(/[\s-]/g, "");
  if (HANDLE_PHONE_REGEX.test(compactPhone)) {
    return true;
  }

  if (HANDLE_URL_REGEX.test(trimmed)) {
    return true;
  }

  return false;
}

export function validateInput(type: InputType, value: string): { valid: boolean; reason?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, reason: "Value is required." };
  }

  if ((type === "contract" || type === "wallet") && !EVM_ADDRESS_REGEX.test(trimmed)) {
    return { valid: false, reason: "Invalid EVM address format." };
  }

  if (type === "handle" && !isValidHandleInput(trimmed)) {
    return {
      valid: false,
      reason:
        "Invalid handle format. Use a social handle (e.g. @user), social URL, or phone number.",
    };
  }

  return { valid: true };
}

export function validateChain(chain: string): { valid: boolean; reason?: string } {
  const lower = chain.toLowerCase().trim();
  if (!lower) {
    return { valid: false, reason: "Chain value is empty." };
  }
  if (!(SUPPORTED_CHAINS as readonly string[]).includes(lower)) {
    return { valid: false, reason: `Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(", ")}.` };
  }
  return { valid: true };
}

export function validateSlug(slug: string): { valid: boolean; reason?: string } {
  if (!SLUG_REGEX.test(slug)) {
    return { valid: false, reason: "Invalid slug format. Use 3-80 lowercase alphanumeric characters and hyphens." };
  }
  return { valid: true };
}

export function buildCacheKey(type: InputType, value: string, chain = "evm"): string {
  return `${type}:${chain}:${value.trim().toLowerCase()}`;
}

export function maskIdentifier(value: string): string {
  const cleaned = value.trim();
  if (cleaned.length <= 10) {
    return cleaned;
  }
  return `${cleaned.slice(0, 6)}...${cleaned.slice(-4)}`;
}

export function fingerprintFromIdentifiers(identifiers: Record<string, string>): string {
  const canonical = Object.entries(identifiers)
    .map(([k, v]) => `${k}:${v.trim().toLowerCase()}`)
    .sort()
    .join("|");

  let hash = 0;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = (hash << 5) - hash + canonical.charCodeAt(i);
    hash |= 0;
  }

  return `fp_${Math.abs(hash)}`;
}
