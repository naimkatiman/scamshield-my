import type { VerdictResult } from "../types";

export type SupportLanguage = "en" | "bm";
export type QuickActionIntent =
  | "scammed_now"
  | "check_wallet"
  | "generate_report"
  | "emergency_contacts"
  | "unknown";

export interface ChatSignals {
  language: SupportLanguage;
  intent: QuickActionIntent;
  amountMyr: number | null;
  mentionsBank: boolean;
  mentionsPolice: boolean;
  platforms: string[];
  walletAddress: string | null;
}

const MALAY_KEYWORDS = [
  "saya",
  "terkena",
  "kena",
  "semak",
  "dompet",
  "laporan",
  "nombor",
  "kecemasan",
  "seterusnya",
  "jumlah",
  "kerugian",
  "balai",
  "hubungi",
  "polis",
] as const;

const PLATFORM_KEYWORDS = [
  "whatsapp",
  "telegram",
  "facebook",
  "instagram",
  "tiktok",
  "wechat",
  "twitter",
  "sms",
  "email",
  "phone",
  "call",
] as const;

const WALLET_REGEX = /\b0x[a-fA-F0-9]{40}\b/;
const AMOUNT_REGEX = /\b(?:rm|myr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

function normalizeText(raw: string): string {
  return raw.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function containsAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function resourceLine(intent: QuickActionIntent, signals: ChatSignals): string {
  if (signals.language === "bm") {
    if (signals.platforms.length > 1) {
      return "Sumber: NSRC 997 dan PDRM CCID; platform mana kerugian paling tinggi?";
    }
    if (signals.mentionsBank && signals.mentionsPolice) {
      return "Sumber: kaunter fraud bank terdekat dan meja CCID balai polis; jumlah rugi berapa?";
    }
    if (signals.mentionsBank) {
      return "Sumber: pergi kaunter fraud bank terdekat dengan IC dan bukti; jumlah rugi berapa?";
    }
    if (signals.mentionsPolice) {
      return "Sumber: balai polis terdekat atau semakmule.rmp.gov.my; jumlah rugi berapa?";
    }
    if (intent === "generate_report") {
      return "Sumber: kaunter fraud bank dan balai polis terdekat; sedia isi tiga maklumat?";
    }
    if (intent === "emergency_contacts") {
      return "Sumber: NSRC 997, BNM 1-300-88-5465, PDRM CCID; bank anda apa?";
    }
    return "Sumber: NSRC 997, PDRM CCID semakmule.rmp.gov.my; platform apa digunakan?";
  }

  if (signals.platforms.length > 1) {
    return "Resources: NSRC 997 and PDRM CCID; which platform caused highest loss?";
  }
  if (signals.mentionsBank && signals.mentionsPolice) {
    return "Resources: nearest bank fraud desk and police CCID desk; how much lost?";
  }
  if (signals.mentionsBank) {
    return "Resources: nearest bank fraud desk with ID and proof; how much lost?";
  }
  if (signals.mentionsPolice) {
    return "Resources: nearest police station or semakmule.rmp.gov.my; how much lost?";
  }
  if (intent === "generate_report") {
    return "Resources: bank fraud desk and nearest police station; ready to fill three fields?";
  }
  if (intent === "emergency_contacts") {
    return "Resources: NSRC 997, BNM 1-300-88-5465, PDRM CCID; what bank are you using?";
  }
  return "Resources: NSRC 997, PDRM CCID semakmule.rmp.gov.my; what platform was used?";
}

function scammedNowResponse(signals: ChatSignals): string {
  if (signals.language === "bm") {
    const line3 = signals.amountMyr !== null && signals.amountMyr > 5000
      ? "- URGENT: Kerugian melebihi RM5,000, minta NSRC selaras pembekuan antara bank."
      : "- Simpan tangkapan layar chat, resit, ID dompet, dan profil scammer.";
    return [
      "BEKUKAN AKAUN BANK DAN EWALLET SEKARANG.",
      "- Hubungi hotline fraud bank, kemudian NSRC 997 SEGERA.",
      line3,
      resourceLine("scammed_now", signals),
    ].join("\n");
  }

  const line3 = signals.amountMyr !== null && signals.amountMyr > 5000
    ? "- URGENT: Loss above RM5,000, ask NSRC for inter-bank freeze coordination."
    : "- Screenshot chats, receipts, wallet IDs, and scammer profiles.";

  return [
    "FREEZE BANK AND EWALLET ACCESS NOW.",
    "- Call your bank fraud hotline, then NSRC 997 IMMEDIATELY.",
    line3,
    resourceLine("scammed_now", signals),
  ].join("\n");
}

function walletCheckNoAddressResponse(signals: ChatSignals): string {
  if (signals.language === "bm") {
    return [
      "TAMPAL ALAMAT DOMPET SEKARANG UNTUK SEMAKAN RISIKO CEPAT.",
      "- Jangan hantar dana lagi sehingga semakan selesai.",
      "- Sediakan TXID, resit exchange, dan tangkapan layar chat.",
      "Seterusnya: hantar alamat dan chain, contoh 0x... di Ethereum.",
    ].join("\n");
  }

  return [
    "PASTE THE WALLET ADDRESS NOW FOR A QUICK RISK CHECK.",
    "- Do not send more funds until review is done.",
    "- Keep TXIDs, exchange receipts, and chat screenshots ready.",
    "Next: send address and chain, like 0x... on Ethereum.",
  ].join("\n");
}

function walletCheckWithVerdictResponse(signals: ChatSignals, verdict: VerdictResult | null): string {
  if (!verdict) {
    return walletCheckNoAddressResponse(signals);
  }

  if (signals.language === "bm") {
    if (verdict.verdict === "HIGH_RISK") {
      return [
        "RISIKO TINGGI DIKESAN. PINDAHKAN BAKI DANA KE DOMPET SELAMAT SEKARANG.",
        "- Hentikan transfer dan revoke approval token segera.",
        "- Lapor alamat ini kepada exchange dan simpan TXID.",
        resourceLine("check_wallet", signals),
      ].join("\n");
    }
    if (verdict.verdict === "LEGIT") {
      return [
        "TIADA ISYARAT RISIKO TINGGI. SAHKAN PIHAK LAWAN SEBELUM TRANSFER SEKARANG.",
        "- Jika perlu, hantar jumlah ujian kecil dahulu.",
        "- Sahkan alamat dari sumber rasmi, bukan chat.",
        "Sumber: alat semakan ScamShield dan NSRC 997; perlu laporan polis?",
      ].join("\n");
    }
    return [
      "RISIKO TIDAK JELAS. ANGGAP DOMPET INI BERISIKO TINGGI SEKARANG.",
      "- Hentikan transfer dan revoke approval segera.",
      "- Kumpul TXID, resit exchange, dan tangkapan layar dompet.",
      resourceLine("check_wallet", signals),
    ].join("\n");
  }

  if (verdict.verdict === "HIGH_RISK") {
    return [
      "HIGH RISK DETECTED. MOVE REMAINING FUNDS TO A SAFE WALLET NOW.",
      "- Revoke token approvals and stop transfers to this address immediately.",
      "- Report this wallet to your exchange and keep TXIDs.",
      resourceLine("check_wallet", signals),
    ].join("\n");
  }
  if (verdict.verdict === "LEGIT") {
    return [
      "NO HIGH-RISK SIGNALS FOUND. VERIFY COUNTERPARTY BEFORE ANY TRANSFER NOW.",
      "- Send only a small test amount if unavoidable.",
      "- Confirm address from official source, never from chat.",
      "Resources: ScamShield verdict tool and NSRC 997; need a police report?",
    ].join("\n");
  }
  return [
    "RISK IS UNCLEAR. TREAT THIS WALLET AS HIGH RISK NOW.",
    "- Stop transfers and revoke approvals immediately.",
    "- Gather TXIDs, receipts, and wallet screenshots.",
    resourceLine("check_wallet", signals),
  ].join("\n");
}

function reportResponse(signals: ChatSignals): string {
  if (signals.language === "bm") {
    return [
      "MULA LAPORAN SEKARANG DENGAN TIGA MAKLUMAT SAHAJA.",
      "- Isi: masa kejadian, jumlah rugi, dan platform.",
      "- Tambah ID scammer dan bukti transaksi jika ada.",
      "Seterusnya: beritahu masa, jumlah, dan platform untuk teks auto-isi.",
    ].join("\n");
  }

  return [
    "START YOUR REPORT NOW WITH THREE FIELDS ONLY.",
    "- Fill: when incident happened, amount lost, and platform used.",
    "- Add scammer ID and transaction proof if available.",
    "Next: tell me when, amount, and platform for auto-filled text.",
  ].join("\n");
}

function emergencyContactsResponse(signals: ChatSignals): string {
  if (signals.language === "bm") {
    return [
      "HUBUNGI NSRC 997 SERTA-MERTA.",
      "- Hubungi hotline fraud bank dahulu untuk pembekuan akaun.",
      "- Kemudian buat laporan PDRM di balai terdekat atau semakmule.rmp.gov.my.",
      resourceLine("emergency_contacts", signals),
    ].join("\n");
  }

  return [
    "CALL NSRC 997 IMMEDIATELY.",
    "- Call your bank fraud hotline first for account freeze.",
    "- Then file PDRM report at nearest station or semakmule.rmp.gov.my.",
    resourceLine("emergency_contacts", signals),
  ].join("\n");
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) return [text];
  return matches.map((part) => part.trim()).filter(Boolean);
}

export function latestUserMessage(messages: { role: string; content: string }[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index].content;
    }
  }
  return "";
}

export function detectLanguage(text: string): SupportLanguage {
  const normalized = normalizeText(text);
  let hits = 0;
  for (const token of MALAY_KEYWORDS) {
    if (new RegExp(`\\b${token}\\b`, "i").test(normalized)) {
      hits += 1;
    }
  }
  const shortPrompt = normalized.split(" ").filter(Boolean).length <= 4;
  if (hits >= 2 || (hits >= 1 && shortPrompt)) {
    return "bm";
  }
  return "en";
}

export function detectQuickActionIntent(text: string): QuickActionIntent {
  const normalized = normalizeText(text);

  if (containsAny(normalized, [
    "i got scammed",
    "what now",
    "what should i do right now",
    "saya terkena scam",
    "saya kena scam",
    "apa perlu buat",
    "kena scam",
  ])) {
    return "scammed_now";
  }

  if (
    containsAny(normalized, [
      "check a wallet address",
      "check wallet",
      "suspicious wallet address",
      "semak alamat dompet",
      "semak dompet",
      "wallet address",
    ]) ||
    WALLET_REGEX.test(normalized)
  ) {
    return "check_wallet";
  }

  if (containsAny(normalized, [
    "generate a report",
    "generate report",
    "help me generate a police report",
    "jana laporan",
    "laporan polis",
    "buat laporan",
  ])) {
    return "generate_report";
  }

  if (containsAny(normalized, [
    "emergency contacts",
    "emergency contact",
    "what are the emergency contacts",
    "nombor kecemasan",
    "hotline",
  ])) {
    return "emergency_contacts";
  }

  return "unknown";
}

export function extractMyrAmount(text: string): number | null {
  const match = text.match(AMOUNT_REGEX);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function analyzeChatInput(text: string): ChatSignals {
  const normalized = normalizeText(text);
  const platforms = PLATFORM_KEYWORDS.filter((platform) => normalized.includes(platform.trim()));

  return {
    language: detectLanguage(normalized),
    intent: detectQuickActionIntent(normalized),
    amountMyr: extractMyrAmount(normalized),
    mentionsBank: normalized.includes("bank"),
    mentionsPolice: normalized.includes("police") || normalized.includes("polis") || normalized.includes("pdrm"),
    platforms,
    walletAddress: normalized.match(WALLET_REGEX)?.[0] ?? null,
  };
}

export function buildQuickActionResponse(signals: ChatSignals, verdict: VerdictResult | null = null): string | null {
  if (signals.intent === "unknown") return null;
  if (signals.intent === "scammed_now") return scammedNowResponse(signals);
  if (signals.intent === "check_wallet") {
    if (!signals.walletAddress) return walletCheckNoAddressResponse(signals);
    return walletCheckWithVerdictResponse(signals, verdict);
  }
  if (signals.intent === "generate_report") return reportResponse(signals);
  return emergencyContactsResponse(signals);
}

export function buildFallbackEmergencyResponse(signals: ChatSignals): string {
  if (signals.language === "bm") {
    const line3 = signals.amountMyr !== null && signals.amountMyr > 5000
      ? "- URGENT: Kerugian melebihi RM5,000, minta NSRC selaras pembekuan antara bank."
      : "- Simpan semua bukti sebelum scammer padam chat.";
    return [
      "ANGGAP AKAUN PERLU DIBEKUKAN SEKARANG.",
      "- Hubungi hotline fraud bank, kemudian NSRC 997 SEGERA.",
      line3,
      "Seterusnya: beritahu bila, jumlah rugi, dan platform.",
    ].join("\n");
  }

  const line3 = signals.amountMyr !== null && signals.amountMyr > 5000
    ? "- URGENT: Loss above RM5,000, ask NSRC for inter-bank coordination."
    : "- Screenshot all evidence before scammers delete chats.";
  return [
    "ASSUME ACCOUNT FREEZE IS NEEDED NOW.",
    "- Call your bank fraud hotline, then NSRC 997 IMMEDIATELY.",
    line3,
    "Next: tell me when, amount, and platform.",
  ].join("\n");
}

export function enforceResponsePolicy(rawText: string, language: SupportLanguage): string {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return language === "bm"
      ? "Seterusnya: beritahu platform, masa, dan jumlah rugi."
      : "Next: tell me platform, time, and amount lost.";
  }

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  let finalLines: string[];

  if (lines.length > 1) {
    finalLines = lines.slice(0, 4);
  } else {
    finalLines = splitSentences(normalized).slice(0, 4);
  }

  if (finalLines.length === 0) {
    finalLines = [normalized];
  }

  const lastLine = finalLines[finalLines.length - 1] ?? "";
  const hasNextStep = /\?$/.test(lastLine)
    || /^next:/i.test(lastLine)
    || /^seterusnya:/i.test(lastLine);

  if (!hasNextStep) {
    const nextStep = language === "bm"
      ? "Seterusnya: platform apa, bila, dan jumlah rugi?"
      : "Next: what platform, when, and amount lost?";

    if (finalLines.length >= 4) {
      finalLines[3] = nextStep;
    } else {
      finalLines.push(nextStep);
    }
  }

  return finalLines.slice(0, 4).join("\n");
}
