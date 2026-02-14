import { describe, it, expect } from "vitest";
import {
  validateInput,
  validateChain,
  validateSlug,
  buildCacheKey,
  maskIdentifier,
  fingerprintFromIdentifiers,
  SUPPORTED_CHAINS,
} from "../src/core/validation";

/* ------------------------------------------------------------------ */
/*  validateInput                                                      */
/* ------------------------------------------------------------------ */

describe("validateInput", () => {
  it("accepts a valid EVM address for contract type", () => {
    expect(validateInput("contract", "0x1234567890abcdef1234567890abcdef12345678").valid).toBe(true);
  });

  it("accepts a valid EVM address for wallet type", () => {
    expect(validateInput("wallet", "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12").valid).toBe(true);
  });

  it("rejects EVM address without 0x prefix", () => {
    const result = validateInput("contract", "1234567890abcdef1234567890abcdef12345678");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("EVM");
  });

  it("rejects EVM address with wrong length", () => {
    expect(validateInput("wallet", "0x1234").valid).toBe(false);
  });

  it("rejects EVM address with non-hex characters", () => {
    expect(validateInput("contract", "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG").valid).toBe(false);
  });

  it("accepts a valid handle", () => {
    expect(validateInput("handle", "user_name.123").valid).toBe(true);
  });

  it("accepts handle with @ symbol", () => {
    expect(validateInput("handle", "@crypto_trader").valid).toBe(true);
  });

  it("rejects handle shorter than 3 chars", () => {
    expect(validateInput("handle", "ab").valid).toBe(false);
  });

  it("rejects handle longer than 64 chars", () => {
    expect(validateInput("handle", "a".repeat(65)).valid).toBe(false);
  });

  it("rejects handle with special characters", () => {
    expect(validateInput("handle", "user name!").valid).toBe(false);
  });

  it("rejects empty value", () => {
    const result = validateInput("contract", "");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("required");
  });

  it("rejects whitespace-only value", () => {
    expect(validateInput("handle", "   ").valid).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  validateChain                                                      */
/* ------------------------------------------------------------------ */

describe("validateChain", () => {
  it("accepts all supported chains", () => {
    for (const chain of SUPPORTED_CHAINS) {
      expect(validateChain(chain).valid).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(validateChain("EVM").valid).toBe(true);
    expect(validateChain("Polygon").valid).toBe(true);
  });

  it("rejects unsupported chain", () => {
    const result = validateChain("fantom");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Unsupported");
  });

  it("rejects empty chain", () => {
    expect(validateChain("").valid).toBe(false);
  });

  it("trims whitespace", () => {
    expect(validateChain("  evm  ").valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  validateSlug                                                       */
/* ------------------------------------------------------------------ */

describe("validateSlug", () => {
  it("accepts valid slug", () => {
    expect(validateSlug("high-risk-warning-abc123").valid).toBe(true);
  });

  it("rejects slug with uppercase", () => {
    expect(validateSlug("HIGH-RISK").valid).toBe(false);
  });

  it("rejects slug shorter than 3 chars", () => {
    expect(validateSlug("ab").valid).toBe(false);
  });

  it("rejects slug starting with hyphen", () => {
    expect(validateSlug("-abc").valid).toBe(false);
  });

  it("rejects slug ending with hyphen", () => {
    expect(validateSlug("abc-").valid).toBe(false);
  });

  it("rejects slug with special characters", () => {
    expect(validateSlug("abc!@#").valid).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  buildCacheKey                                                      */
/* ------------------------------------------------------------------ */

describe("buildCacheKey", () => {
  it("normalizes to lowercase", () => {
    expect(buildCacheKey("contract", "0xABCD", "evm")).toBe("contract:evm:0xabcd");
  });

  it("trims whitespace", () => {
    expect(buildCacheKey("wallet", "  0xabc  ", "bsc")).toBe("wallet:bsc:0xabc");
  });

  it("defaults chain to evm", () => {
    expect(buildCacheKey("handle", "user123")).toBe("handle:evm:user123");
  });
});

/* ------------------------------------------------------------------ */
/*  maskIdentifier                                                     */
/* ------------------------------------------------------------------ */

describe("maskIdentifier", () => {
  it("masks long values", () => {
    const result = maskIdentifier("0x1234567890abcdef1234567890abcdef12345678");
    expect(result).toBe("0x1234...5678");
  });

  it("preserves short values (<= 10 chars)", () => {
    expect(maskIdentifier("short")).toBe("short");
    expect(maskIdentifier("1234567890")).toBe("1234567890");
  });

  it("trims input", () => {
    expect(maskIdentifier("  short  ")).toBe("short");
  });
});

/* ------------------------------------------------------------------ */
/*  fingerprintFromIdentifiers                                         */
/* ------------------------------------------------------------------ */

describe("fingerprintFromIdentifiers", () => {
  it("is deterministic", () => {
    const ids = { wallet: "0xABC", platform: "Telegram" };
    const fp1 = fingerprintFromIdentifiers(ids);
    const fp2 = fingerprintFromIdentifiers(ids);
    expect(fp1).toBe(fp2);
  });

  it("is order-independent", () => {
    const fp1 = fingerprintFromIdentifiers({ a: "1", b: "2" });
    const fp2 = fingerprintFromIdentifiers({ b: "2", a: "1" });
    expect(fp1).toBe(fp2);
  });

  it("starts with fp_ prefix", () => {
    const fp = fingerprintFromIdentifiers({ key: "value" });
    expect(fp).toMatch(/^fp_\d+$/);
  });

  it("produces different fingerprints for different inputs", () => {
    const fp1 = fingerprintFromIdentifiers({ a: "1" });
    const fp2 = fingerprintFromIdentifiers({ a: "2" });
    expect(fp1).not.toBe(fp2);
  });
});
