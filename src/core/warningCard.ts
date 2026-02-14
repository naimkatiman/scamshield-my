import type { Env, WarningCardPayload } from "../types";
import { maskIdentifier } from "./validation";

export function generateSlug(seed: string): string {
  const cleaned = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${cleaned || "warning"}-${suffix}`;
}

interface CardPalette {
  bgStart: string;
  bgEnd: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  panelBg: string;
  panelStroke: string;
  accent: string;
}

function cardPalette(verdict: WarningCardPayload["verdict"]): CardPalette {
  if (verdict === "HIGH_RISK") {
    return {
      bgStart: "#220B0B",
      bgEnd: "#451313",
      border: "#FCA5A5",
      badgeBg: "#B91C1C",
      badgeText: "#FEE2E2",
      panelBg: "rgba(127, 29, 29, 0.34)",
      panelStroke: "rgba(254, 202, 202, 0.35)",
      accent: "#F97316",
    };
  }

  if (verdict === "LEGIT") {
    return {
      bgStart: "#0A2E1F",
      bgEnd: "#0C4A35",
      border: "#86EFAC",
      badgeBg: "#166534",
      badgeText: "#DCFCE7",
      panelBg: "rgba(6, 78, 59, 0.34)",
      panelStroke: "rgba(167, 243, 208, 0.34)",
      accent: "#10B981",
    };
  }

  return {
    bgStart: "#0F172A",
    bgEnd: "#1E293B",
    border: "#93C5FD",
    badgeBg: "#334155",
    badgeText: "#E2E8F0",
    panelBg: "rgba(15, 23, 42, 0.34)",
    panelStroke: "rgba(148, 163, 184, 0.35)",
    accent: "#0EA5E9",
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = word.slice(maxChars);
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  const exceeded = words.join(" ").length > lines.join(" ").length;
  if (exceeded && lines.length > 0) {
    const last = lines[lines.length - 1] ?? "";
    lines[lines.length - 1] = truncate(last, Math.max(1, maxChars - 1));
  }

  return lines;
}

function verdictSummary(verdict: WarningCardPayload["verdict"]): string {
  if (verdict === "HIGH_RISK") {
    return "Escalate now. Freeze transfers and report immediately.";
  }
  if (verdict === "LEGIT") {
    return "No immediate high-risk signal. Continue verification.";
  }
  return "Signals are inconclusive. Treat as unverified and share caution notice.";
}

export function renderWarningCardSvg(payload: WarningCardPayload): string {
  const palette = cardPalette(payload.verdict);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const headlineLines = wrapText(payload.headline, 38, 2);
  const summary = escapeXml(verdictSummary(payload.verdict));

  const identifierRows = Object.entries(payload.identifiers)
    .slice(0, 3)
    .map(([key, value], index) => {
      const y = 356 + index * 68;
      const safeKey = escapeXml(truncate(key.toUpperCase(), 24));
      const safeValue = escapeXml(truncate(maskIdentifier(value), 34));
      return `
  <line x1="86" y1="${y - 14}" x2="536" y2="${y - 14}" stroke="rgba(148,163,184,0.28)" stroke-width="1"/>
  <text x="86" y="${y}" fill="#94A3B8" font-size="14" font-family="'DM Sans','Arial',sans-serif" letter-spacing="1.1">${safeKey}</text>
  <text x="86" y="${y + 26}" fill="#E2E8F0" font-size="27" font-weight="600" font-family="'DM Sans','Arial',sans-serif">${safeValue}</text>`;
    })
    .join("");

  const reasons = payload.reasons.slice(0, 3).map((reason, index) => {
    const y = 334 + index * 88;
    const reasonLines = wrapText(reason, 47, 2);
    const line1 = escapeXml(reasonLines[0] ?? "");
    const line2 = escapeXml(reasonLines[1] ?? "");
    const hasSecondLine = line2.length > 0;
    return `
  <rect x="610" y="${y}" width="518" height="74" rx="14" fill="rgba(15,23,42,0.5)" stroke="rgba(148,163,184,0.34)" stroke-width="1"/>
  <circle cx="644" cy="${y + 36}" r="16" fill="${palette.accent}" opacity="0.92"/>
  <text x="639" y="${y + 42}" fill="#FFFFFF" font-size="18" font-weight="700" font-family="'Chakra Petch','Arial',sans-serif">${index + 1}</text>
  <text x="672" y="${y + 33}" fill="#E2E8F0" font-size="23" font-weight="500" font-family="'DM Sans','Arial',sans-serif">${line1}</text>
  ${hasSecondLine ? `<text x="672" y="${y + 57}" fill="#CBD5E1" font-size="21" font-family="'DM Sans','Arial',sans-serif">${line2}</text>` : ""}`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.bgStart}"/>
      <stop offset="1" stop-color="${palette.bgEnd}"/>
    </linearGradient>
    <radialGradient id="spot" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1140 88) rotate(130) scale(620 620)">
      <stop stop-color="${palette.accent}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0B1120"/>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#spot)"/>
  <rect x="24" y="24" width="1152" height="582" rx="24" stroke="${palette.border}" stroke-width="3"/>
  <line x1="24" y1="102" x2="1176" y2="102" stroke="rgba(226,232,240,0.14)" stroke-width="2"/>

  <text x="56" y="72" fill="#E2E8F0" font-size="22" font-weight="700" font-family="'Chakra Petch','Arial',sans-serif" letter-spacing="1">SCAMSHIELD MY</text>
  <text x="272" y="72" fill="#94A3B8" font-size="16" font-weight="500" font-family="'DM Sans','Arial',sans-serif" letter-spacing="1.2">COMMUNITY WARNING BULLETIN</text>
  <text x="848" y="72" fill="#CBD5E1" font-size="14" font-family="'DM Sans','Arial',sans-serif">Generated ${timestamp} UTC</text>

  <rect x="56" y="124" width="228" height="62" rx="31" fill="${palette.badgeBg}" stroke="rgba(248,250,252,0.28)" stroke-width="2"/>
  <text x="86" y="164" fill="${palette.badgeText}" font-size="31" font-weight="700" font-family="'Chakra Petch','Arial',sans-serif">${escapeXml(payload.verdict)}</text>
  <text x="308" y="163" fill="#E2E8F0" font-size="20" font-family="'DM Sans','Arial',sans-serif">${summary}</text>

  <text x="56" y="236" fill="#F8FAFC" font-size="50" font-weight="700" font-family="'Chakra Petch','Arial',sans-serif">${escapeXml(headlineLines[0] ?? "")}</text>
  <text x="56" y="288" fill="#E2E8F0" font-size="42" font-weight="600" font-family="'Chakra Petch','Arial',sans-serif">${escapeXml(headlineLines[1] ?? "")}</text>

  <rect x="56" y="306" width="500" height="250" rx="18" fill="${palette.panelBg}" stroke="${palette.panelStroke}" stroke-width="2"/>
  <rect x="580" y="306" width="564" height="250" rx="18" fill="${palette.panelBg}" stroke="${palette.panelStroke}" stroke-width="2"/>
  <text x="86" y="334" fill="#E2E8F0" font-size="16" font-weight="600" font-family="'DM Sans','Arial',sans-serif" letter-spacing="1.4">FLAGGED IDENTIFIERS</text>
  <text x="610" y="334" fill="#E2E8F0" font-size="16" font-weight="600" font-family="'DM Sans','Arial',sans-serif" letter-spacing="1.4">EVIDENCE SNAPSHOT</text>

  ${identifierRows}
  ${reasons}

  <line x1="24" y1="578" x2="1176" y2="578" stroke="rgba(226,232,240,0.14)" stroke-width="2"/>
  <text x="56" y="604" fill="#CBD5E1" font-size="14" font-family="'DM Sans','Arial',sans-serif">Use the linked warning page to report, preserve evidence, and coordinate containment.</text>
  <text x="1032" y="604" fill="#E2E8F0" font-size="16" font-weight="700" font-family="'Chakra Petch','Arial',sans-serif">ScamShield MY</text>
</svg>`;
}

export async function storeWarningCard(
  env: Env,
  slug: string,
  payload: WarningCardPayload,
): Promise<string> {
  // NOTE: Storing as SVG for now. True PNG rasterization is a future enhancement.
  const key = `warning-cards/${slug}.svg`;
  const svg = renderWarningCardSvg(payload);

  await env.FILES_BUCKET.put(key, svg, {
    httpMetadata: {
      contentType: "image/svg+xml",
    },
    customMetadata: {
      verdict: payload.verdict,
      headline: payload.headline,
    },
  });

  await env.CACHE_KV.put(
    `warning-card:${slug}`,
    JSON.stringify({ key, verdict: payload.verdict }),
    { expirationTtl: 60 * 60 * 24 },
  );

  return key;
}
