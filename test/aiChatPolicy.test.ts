import { describe, expect, it } from "vitest";
import {
  analyzeChatInput,
  buildQuickActionResponse,
  detectQuickActionIntent,
  enforceResponsePolicy,
} from "../src/core/aiChatPolicy";
import type { VerdictResult } from "../src/types";

const HIGH_RISK_VERDICT: VerdictResult = {
  verdict: "HIGH_RISK",
  score: 93,
  reasons: [
    "Known malicious behavior on this address.",
    "Community reports indicate scam activity.",
    "Risk aggregation exceeds high-risk threshold.",
  ],
  sources: [],
  nextActions: [],
};

describe("ai chat policy", () => {
  it("detects quick action intents in english and bahasa melayu", () => {
    expect(detectQuickActionIntent("I got scammed — what now?")).toBe("scammed_now");
    expect(detectQuickActionIntent("Semak alamat dompet")).toBe("check_wallet");
    expect(detectQuickActionIntent("Generate a report")).toBe("generate_report");
    expect(detectQuickActionIntent("Nombor kecemasan")).toBe("emergency_contacts");
    expect(analyzeChatInput("Jana laporan").language).toBe("bm");
  });

  it("extracts escalation signals from user input", () => {
    const signals = analyzeChatInput(
      "I got scammed on WhatsApp and Telegram, lost RM6,200, need police and bank help.",
    );
    expect(signals.amountMyr).toBe(6200);
    expect(signals.platforms.length).toBeGreaterThan(1);
    expect(signals.mentionsBank).toBe(true);
    expect(signals.mentionsPolice).toBe(true);
  });

  it("builds urgent scammed response with NSRC coordination when loss is high", () => {
    const signals = analyzeChatInput("I got scammed, lost RM8,000 by bank transfer.");
    const reply = buildQuickActionResponse(signals);
    expect(reply).not.toBeNull();
    expect(reply?.message).toContain("FREEZE");
    expect(reply?.options).toBeDefined();
    expect(reply?.options?.length).toBeGreaterThan(0);
  });

  it("builds wallet high-risk response when verdict indicates danger", () => {
    const signals = analyzeChatInput("Check a wallet address 0x1111111111111111111111111111111111111111");
    const reply = buildQuickActionResponse(signals, HIGH_RISK_VERDICT);
    expect(reply).not.toBeNull();
    expect(reply?.message).toContain("HIGH RISK");
    expect(reply?.options).toBeDefined();
  });

  it("enforces response policy with options", () => {
    const raw = "Line one.\nLine two.\nLine three.\nLine four.\nLine five.";
    const result = enforceResponsePolicy(raw, "en");
    expect(result.message).toBeDefined();
    expect(result.options).toBeDefined();
    expect(result.options.length).toBeGreaterThan(0);
  });
});
