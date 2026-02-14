import type { Env, WarningCardPayload } from "../types";
import { maskIdentifier } from "./validation";

export function generateSlug(seed: string): string {
  const cleaned = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${cleaned || "warning"}-${suffix}`;
}

function cardPalette(verdict: WarningCardPayload["verdict"]): { bg: string; badge: string; border: string } {
  if (verdict === "HIGH_RISK") {
    return { bg: "#120E0A", badge: "#D9480F", border: "#FDBA74" };
  }

  if (verdict === "LEGIT") {
    return { bg: "#0A120D", badge: "#1C7C54", border: "#86EFAC" };
  }

  return { bg: "#0D1020", badge: "#334155", border: "#93C5FD" };
}

export function renderWarningCardSvg(payload: WarningCardPayload): string {
  const palette = cardPalette(payload.verdict);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const identifierLines = Object.entries(payload.identifiers)
    .slice(0, 2)
    .map(([key, value], index) => {
      const y = 165 + index * 24;
      return `<text x="40" y="${y}" fill="#E2E8F0" font-size="18" font-family="Verdana">${key}: ${maskIdentifier(value)}</text>`;
    })
    .join("");

  const reasons = payload.reasons.slice(0, 3).map((reason, index) => {
    const y = 255 + index * 30;
    const safeReason = reason.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 86);
    return `<text x="52" y="${y}" fill="#E2E8F0" font-size="18" font-family="Verdana">- ${safeReason}</text>`;
  }).join("");

  const headline = payload.headline.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 72);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.bg}"/>
      <stop offset="1" stop-color="#0B1120"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="28" fill="url(#bg)"/>
  <rect x="24" y="24" width="1152" height="582" rx="24" stroke="${palette.border}" stroke-width="3"/>
  <rect x="40" y="40" width="250" height="58" rx="29" fill="${palette.badge}"/>
  <text x="64" y="77" fill="#FFFFFF" font-size="28" font-weight="700" font-family="Verdana">${payload.verdict}</text>

  <text x="40" y="138" fill="#F8FAFC" font-size="42" font-weight="700" font-family="Verdana">${headline}</text>
  ${identifierLines}
  ${reasons}

  <text x="40" y="584" fill="#94A3B8" font-size="18" font-family="Verdana">Generated: ${timestamp} UTC</text>
  <text x="975" y="584" fill="#94A3B8" font-size="22" font-family="Verdana">ScamShield MY</text>
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