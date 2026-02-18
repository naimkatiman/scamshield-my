import type { VerdictResult } from "../types";
import { getBankHotlinesMessage, getPoliceGuideMessage, getNSRCGuideMessage } from "./emergencyContacts";

export interface ChatOption {
  text: string;
  action: string;
}

export interface ChatResponse {
  message: string;
  options: ChatOption[];
}

export type SupportLanguage = "en" | "bm";
export type QuickActionIntent =
  | "scammed_now"
  | "check_wallet"
  | "generate_report"
  | "emergency_contacts"
  | "bank_hotlines"
  | "police_guide"
  | "nsrc_info"
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

function scammedNowResponse(signals: ChatSignals): ChatResponse {
  if (signals.language === "bm") {
    return {
      message: "BEKUKAN AKAUN BANK SEKARANG. Hubungi hotline fraud bank, kemudian NSRC 997.",
      options: [
        { text: "Saya perlukan nombor hotline bank", action: "Apakah nombor hotline fraud bank di Malaysia?" },
        { text: "Saya sudah hubungi bank", action: "Saya hubungi bank, apa langkah seterusnya?" },
        { text: "Berapa kerugian saya?", action: `Saya rugi RM${signals.amountMyr || '[jumlah]'} dalam scam ini` }
      ]
    };
  }

  return {
    message: "FREEZE YOUR BANK ACCOUNTS NOW. Call your bank fraud hotline immediately, then NSRC at 997.",
    options: [
      { text: "I need bank emergency numbers", action: "What are the bank fraud hotline numbers in Malaysia?" },
      { text: "I already called the bank", action: "I called my bank, what's next?" },
      { text: "How much did I lose?", action: `I lost RM${signals.amountMyr || '[amount]'} to this scam` }
    ]
  };
}

function walletCheckNoAddressResponse(signals: ChatSignals): ChatResponse {
  if (signals.language === "bm") {
    return {
      message: "Sila hantar alamat dompet untuk semakan risiko. Jangan hantar dana lagi sehingga semakan selesai.",
      options: [
        { text: "Hantar alamat dompet", action: "Semak alamat dompet ini: 0x..." },
        { text: "Apa itu alamat dompet?", action: "Bagaimana untuk dapatkan alamat dompet?" },
        { text: "Laporan polis", action: "Jana laporan polis" }
      ]
    };
  }

  return {
    message: "Please send the wallet address for a risk check. Do not send more funds until review is complete.",
    options: [
      { text: "Send wallet address", action: "Check wallet address: 0x..." },
      { text: "What is a wallet address?", action: "How do I find the wallet address?" },
      { text: "Police report", action: "Generate a police report" }
    ]
  };
}

function walletCheckWithVerdictResponse(signals: ChatSignals, verdict: VerdictResult | null): ChatResponse {
  if (!verdict) {
    return walletCheckNoAddressResponse(signals);
  }

  if (signals.language === "bm") {
    if (verdict.verdict === "HIGH_RISK") {
      return {
        message: "RISIKO TINGGI DIKESAN. Alamat ini dilaporkan sebagai scam. Pindahkan baki dana ke dompet selamat.",
        options: [
          { text: "Bagaimana pindahkan dana dengan selamat?", action: "Bagaimana cara pindahkan dana dari dompet ini dengan selamat?" },
          { text: "Lapor dompet ini", action: "Jana laporan polis untuk alamat dompet ini" },
          { text: "Semak alamat lain", action: "Saya nak semak alamat dompet lain" }
        ]
      };
    }
    if (verdict.verdict === "LEGIT") {
      return {
        message: "Tiada isyarat risiko tinggi. Sahkan pihak lawan dari sumber rasmi sebelum transfer.",
        options: [
          { text: "Bagaimana sahkan alamat?", action: "Bagaimana cara sahkan alamat dompet ini selamat?" },
          { text: "Semak alamat lain", action: "Saya nak semak alamat dompet lain" },
          { text: "Laporan kecemasan", action: "Nombor kecemasan" }
        ]
      };
    }
    return {
      message: "Risiko tidak jelas. Anggap dompet ini berisiko tinggi. Hentikan transfer.",
      options: [
        { text: "Bagaimana pindahkan dana?", action: "Bagaimana cara pindahkan dana dengan selamat?" },
        { text: "Lapor dompet ini", action: "Jana laporan polis untuk alamat ini" },
        { text: "Semak alamat lain", action: "Saya nak semak alamat lain" }
      ]
    };
  }

  if (verdict.verdict === "HIGH_RISK") {
    return {
      message: "HIGH RISK DETECTED. This address shows multiple scam reports. Move any remaining funds immediately.",
      options: [
        { text: "How to move funds safely?", action: "How do I safely move my funds from this wallet?" },
        { text: "Report this wallet", action: "Generate a police report for this wallet address" },
        { text: "Check another address", action: "I want to check another wallet address" }
      ]
    };
  }
  if (verdict.verdict === "LEGIT") {
    return {
      message: "No high-risk signals found. Verify counterparty from official sources before any transfer.",
      options: [
        { text: "How to verify address?", action: "How do I verify this wallet address is safe?" },
        { text: "Check another address", action: "I want to check another wallet address" },
        { text: "Emergency contacts", action: "Emergency contacts" }
      ]
    };
  }
  return {
    message: "Risk is unclear. Treat this wallet as high risk. Stop all transfers.",
    options: [
      { text: "How to move funds?", action: "How do I safely move my funds?" },
      { text: "Report this wallet", action: "Generate a police report for this address" },
      { text: "Check another address", action: "I want to check another address" }
    ]
  };
}

function reportResponse(signals: ChatSignals): ChatResponse {
  const message = getPoliceGuideMessage(signals.language);
  
  if (signals.language === "bm") {
    return {
      message,
      options: [
        { text: "Nombor kecemasan", action: "Tunjuk nombor hotline fraud bank dan NSRC" },
        { text: "Apa fungsi NSRC 997?", action: "NSRC 997 bantu apa?" },
        { text: "Saya sudah buat laporan", action: "Saya sudah failkan laporan polis, apa seterusnya?" }
      ]
    };
  }

  return {
    message,
    options: [
      { text: "Emergency contacts", action: "Show me bank fraud hotlines and NSRC" },
      { text: "NSRC coordination", action: "What does NSRC 997 help with?" },
      { text: "I filed the report", action: "I already filed a police report, what's next?" }
    ]
  };
}

function emergencyContactsResponse(signals: ChatSignals): ChatResponse {
  const message = getBankHotlinesMessage(signals.language);
  
  if (signals.language === "bm") {
    return {
      message,
      options: [
        { text: "Panduan laporan polis", action: "Bagaimana cara buat laporan polis untuk scam online?" },
        { text: "Apa fungsi NSRC 997?", action: "NSRC 997 bantu apa?" },
        { text: "Jana laporan", action: "Saya nak jana laporan polis sekarang" }
      ]
    };
  }

  return {
    message,
    options: [
      { text: "Police reporting guide", action: "How do I file a police report for online scams?" },
      { text: "NSRC coordination", action: "What does NSRC 997 help with?" },
      { text: "Generate report", action: "I want to generate a police report now" }
    ]
  };
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
    "bank fraud hotline",
    "bank hotline",
    "bank emergency number",
    "hotline fraud bank",
    "nombor hotline bank",
    "nombor bank",
    "tunjuk nombor",
    "show me bank",
    "show me all bank",
  ])) {
    return "bank_hotlines";
  }

  if (containsAny(normalized, [
    "police report",
    "file a police report",
    "how do i file",
    "police reporting guide",
    "panduan laporan polis",
    "cara buat laporan",
    "bagaimana cara buat laporan polis",
  ])) {
    return "police_guide";
  }

  if (containsAny(normalized, [
    "nsrc",
    "997",
    "what does nsrc",
    "nsrc 997",
    "nsrc bantu",
    "what is nsrc",
    "apa fungsi nsrc",
  ])) {
    return "nsrc_info";
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

function bankHotlinesResponse(signals: ChatSignals): ChatResponse {
  const message = getBankHotlinesMessage(signals.language);
  
  if (signals.language === "bm") {
    return {
      message,
      options: [
        { text: "Panduan laporan polis", action: "Bagaimana cara buat laporan polis untuk scam online?" },
        { text: "Apa fungsi NSRC 997?", action: "NSRC 997 bantu apa?" },
        { text: "Saya terkena scam", action: "Saya kena scam — apa perlu buat?" }
      ]
    };
  }

  return {
    message,
    options: [
      { text: "Police reporting guide", action: "How do I file a police report for online scams?" },
      { text: "NSRC coordination", action: "What does NSRC 997 help with?" },
      { text: "I got scammed", action: "I got scammed — what now?" }
    ]
  };
}

function policeGuideResponse(signals: ChatSignals): ChatResponse {
  const message = getPoliceGuideMessage(signals.language);
  
  if (signals.language === "bm") {
    return {
      message,
      options: [
        { text: "Nombor kecemasan", action: "Tunjuk nombor hotline fraud bank dan NSRC" },
        { text: "Apa fungsi NSRC 997?", action: "NSRC 997 bantu apa?" },
        { text: "Saya sudah buat laporan", action: "Saya sudah failkan laporan polis, apa seterusnya?" }
      ]
    };
  }

  return {
    message,
    options: [
      { text: "Emergency contacts", action: "Show me bank fraud hotlines and NSRC" },
      { text: "NSRC coordination", action: "What does NSRC 997 help with?" },
      { text: "I filed the report", action: "I already filed a police report, what's next?" }
    ]
  };
}

function nsrcInfoResponse(signals: ChatSignals): ChatResponse {
  const message = getNSRCGuideMessage(signals.language);
  
  if (signals.language === "bm") {
    return {
      message,
      options: [
        { text: "Nombor hotline bank", action: "Tunjuk semua nombor hotline fraud bank" },
        { text: "Panduan laporan polis", action: "Bagaimana cara buat laporan polis untuk scam online?" },
        { text: "Saya terkena scam", action: "Saya kena scam — apa perlu buat?" }
      ]
    };
  }

  return {
    message,
    options: [
      { text: "Bank fraud hotlines", action: "Show me all bank fraud hotline numbers" },
      { text: "Police reporting guide", action: "How do I file a police report for online scams?" },
      { text: "I got scammed", action: "I got scammed — what now?" }
    ]
  };
}

export function buildQuickActionResponse(signals: ChatSignals, verdict: VerdictResult | null = null): ChatResponse | null {
  if (signals.intent === "unknown") return null;
  if (signals.intent === "scammed_now") return scammedNowResponse(signals);
  if (signals.intent === "check_wallet") {
    if (!signals.walletAddress) return walletCheckNoAddressResponse(signals);
    return walletCheckWithVerdictResponse(signals, verdict);
  }
  if (signals.intent === "bank_hotlines") return bankHotlinesResponse(signals);
  if (signals.intent === "police_guide") return policeGuideResponse(signals);
  if (signals.intent === "nsrc_info") return nsrcInfoResponse(signals);
  if (signals.intent === "generate_report") return reportResponse(signals);
  return emergencyContactsResponse(signals);
}

export function buildFallbackEmergencyResponse(signals: ChatSignals): ChatResponse {
  if (signals.language === "bm") {
    return {
      message: "Hubungi hotline fraud bank, kemudian NSRC 997 SEGERA untuk bekukan akaun.",
      options: [
        { text: "Nombor hotline bank", action: "Apakah nombor hotline fraud bank di Malaysia?" },
        { text: "Langkah seterusnya", action: "Saya hubungi bank, apa langkah seterusnya?" },
        { text: "Berapa kerugian?", action: `Saya rugi RM${signals.amountMyr || '[jumlah]'} dalam scam` }
      ]
    };
  }

  return {
    message: "Call your bank fraud hotline, then NSRC 997 IMMEDIATELY to freeze accounts.",
    options: [
      { text: "Bank emergency numbers", action: "What are the bank fraud hotline numbers in Malaysia?" },
      { text: "What's next", action: "I called my bank, what's next?" },
      { text: "How much lost?", action: `I lost RM${signals.amountMyr || '[amount]'} to this scam` }
    ]
  };
}

export function enforceResponsePolicy(rawText: string, language: SupportLanguage): ChatResponse {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  
  if (!normalized) {
    return {
      message: language === "bm" 
        ? "Sila beritahu platform, masa, dan jumlah rugi."
        : "Please tell me platform, time, and amount lost.",
      options: language === "bm" ? [
        { text: "Saya kena scam", action: "Saya kena scam — apa perlu buat?" },
        { text: "Nombor kecemasan", action: "Nombor kecemasan" },
        { text: "Jana laporan", action: "Jana laporan" }
      ] : [
        { text: "I got scammed", action: "I got scammed — what now?" },
        { text: "Emergency contacts", action: "Emergency contacts" },
        { text: "Generate report", action: "Generate a report" }
      ]
    };
  }

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const message = lines.slice(0, 3).join(" ");

  return {
    message,
    options: language === "bm" ? [
      { text: "Langkah seterusnya", action: "Apa langkah seterusnya?" },
      { text: "Nombor kecemasan", action: "Nombor kecemasan" },
      { text: "Jana laporan polis", action: "Jana laporan polis" }
    ] : [
      { text: "What's next?", action: "What should I do next?" },
      { text: "Emergency contacts", action: "Emergency contacts" },
      { text: "Generate police report", action: "Generate a police report" }
    ]
  };
}
