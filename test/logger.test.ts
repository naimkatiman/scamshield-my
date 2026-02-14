import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../src/core/logger";

describe("logger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("outputs structured JSON", () => {
    logger.info("test_event", { key: "value" });
    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.level).toBe("info");
    expect(output.event).toBe("test_event");
    expect(output.key).toBe("value");
    expect(output.timestamp).toBeTruthy();
  });

  it("masks EVM addresses in string values", () => {
    logger.info("test", { address: "0x1234567890abcdef1234567890abcdef12345678" });
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.address).toBe("0x1234...5678");
  });

  it("masks email addresses in string values", () => {
    logger.info("test", { email: "user@example.com" });
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.email).toContain("***@");
    expect(output.email).not.toContain("user@");
  });

  it("masks Malaysian phone numbers in string values", () => {
    logger.info("test", { phone: "0123456789" });
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.phone).toBe("012***89");
  });

  it("masks long numeric identifiers in string values", () => {
    logger.info("test", { account: "12345678901234" });
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.account).toBe("123***34");
  });

  it("preserves non-string values", () => {
    logger.info("test", { count: 42, flag: true });
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.count).toBe(42);
    expect(output.flag).toBe(true);
  });

  it("supports warn level", () => {
    logger.warn("warning_event");
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.level).toBe("warn");
  });

  it("supports error level", () => {
    logger.error("error_event", { message: "something broke" });
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.level).toBe("error");
    expect(output.message).toBe("something broke");
  });

  it("works without data argument", () => {
    logger.info("bare_event");
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.event).toBe("bare_event");
  });
});
