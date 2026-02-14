import type { Env } from "../types";
import { logger } from "./logger";

const PDF_SIGNATURE = [37, 80, 68, 70]; // %PDF
const BROWSER_RENDER_TIMEOUT_MS = 12000;

export interface ReportPdfPayload {
  incidentTitle: string;
  scamType: string;
  occurredAt: string;
  channel: string;
  suspects: string[];
  losses: string;
  actionsTaken: string[];
  severitySuggestion: string;
  forBank: string;
  forPolice: string;
  forPlatform: string;
  extraNotes?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function severityColor(sev: string): { bg: string; text: string; border: string } {
  switch (sev) {
    case "critical":
      return { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" };
    case "high":
      return { bg: "#fff7ed", text: "#9a3412", border: "#fdba74" };
    case "medium":
      return { bg: "#fefce8", text: "#854d0e", border: "#fde047" };
    default:
      return { bg: "#f0fdf4", text: "#166534", border: "#86efac" };
  }
}

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

export function buildReportPdfHtml(payload: ReportPdfPayload): string {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const sev = severityColor(payload.severitySuggestion);
  const suspects = payload.suspects.filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Chakra+Petch:wght@600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "DM Sans", system-ui, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 40px 48px;
      font-size: 13px;
      line-height: 1.6;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand {
      font-family: "Chakra Petch", monospace;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 1px;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
      margin-bottom: 20px;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .meta-item {
      display: flex;
      gap: 8px;
    }
    .meta-label {
      font-weight: 600;
      color: #475569;
      min-width: 110px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 500;
    }

    .severity-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background: ${sev.bg};
      color: ${sev.text};
      border: 1px solid ${sev.border};
    }

    .suspects-list {
      margin: 0;
      padding-left: 16px;
    }
    .suspects-list li {
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
    }

    .report-section {
      margin-top: 28px;
      page-break-inside: avoid;
    }
    .report-section-title {
      font-family: "Chakra Petch", monospace;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 12px;
    }
    .report-body {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 12.5px;
      line-height: 1.7;
      color: #1e293b;
      padding: 14px 16px;
      background: #fafbfc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }

    .footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 2px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }

    .page-break { page-break-before: always; }

    .timeline {
      margin: 16px 0;
      padding-left: 20px;
    }
    .timeline li {
      font-size: 12px;
      color: #334155;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand">SCAMSHIELD MY</div>
      <div class="brand-sub">Incident Report Package</div>
    </div>
    <div class="header-right">
      <div>Generated: ${escapeHtml(timestamp)} UTC</div>
      <div>Ref: SSM-${Date.now().toString(36).toUpperCase()}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Incident</span>
      <span class="meta-value">${escapeHtml(payload.incidentTitle)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Scam Type</span>
      <span class="meta-value">${escapeHtml(payload.scamType)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Occurred At</span>
      <span class="meta-value">${escapeHtml(payload.occurredAt)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Channel</span>
      <span class="meta-value">${escapeHtml(payload.channel)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Est. Loss</span>
      <span class="meta-value">${escapeHtml(payload.losses)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Severity</span>
      <span class="severity-badge">${escapeHtml(payload.severitySuggestion)}</span>
    </div>
    <div class="meta-item" style="grid-column: span 2;">
      <span class="meta-label">Suspects</span>
      <span class="meta-value">${suspects.length > 0
        ? `<ul class="suspects-list">${suspects.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
        : "N/A"
      }</span>
    </div>
    ${payload.actionsTaken.length > 0 ? `
    <div class="meta-item" style="grid-column: span 2;">
      <span class="meta-label">Actions Taken</span>
      <span class="meta-value">${payload.actionsTaken.map(a => escapeHtml(a)).join("; ")}</span>
    </div>` : ""}
    ${payload.extraNotes ? `
    <div class="meta-item" style="grid-column: span 2;">
      <span class="meta-label">Notes</span>
      <span class="meta-value">${escapeHtml(payload.extraNotes)}</span>
    </div>` : ""}
  </div>

  <!-- Report 1: Bank -->
  <div class="report-section">
    <div class="report-section-title">Report for Bank / Financial Institution</div>
    <div class="report-body">${nl2br(payload.forBank)}</div>
  </div>

  <!-- Report 2: Police / PDRM -->
  <div class="report-section page-break">
    <div class="report-section-title">Report for Police / PDRM</div>
    <div class="report-body">${nl2br(payload.forPolice)}</div>
  </div>

  <!-- Report 3: Platform -->
  <div class="report-section">
    <div class="report-section-title">Report for Platform / Service Provider</div>
    <div class="report-body">${nl2br(payload.forPlatform)}</div>
  </div>

  <div class="footer">
    <span>ScamShield MY &mdash; Community scam response toolkit for Malaysia</span>
    <span>This is an auto-generated report. Verify all details before submission.</span>
  </div>

</body>
</html>`;
}

function browserRenderingBaseUrl(env: Env): string | null {
  const accountId = env.BROWSER_RENDERING_ACCOUNT_ID;
  if (!accountId) {
    return null;
  }
  if (env.BROWSER_RENDERING_API_BASE) {
    return env.BROWSER_RENDERING_API_BASE.replace(/\/$/, "");
  }
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering`;
}

function fromBase64(base64: string): Uint8Array {
  const sanitized = base64.replace(/^data:[^;]+;base64,/, "");
  const bufferApi = (globalThis as unknown as {
    Buffer?: {
      from(input: string, encoding: string): Uint8Array;
    };
  }).Buffer;

  if (bufferApi) {
    return Uint8Array.from(bufferApi.from(sanitized, "base64"));
  }

  const binary = atob(sanitized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extractBinaryFromJson(json: unknown): Uint8Array | null {
  if (typeof json !== "object" || json === null) {
    return null;
  }
  const record = json as Record<string, unknown>;
  const candidates = [
    typeof record.result === "string" ? record.result : null,
    typeof (record.result as Record<string, unknown> | undefined)?.data === "string"
      ? (record.result as Record<string, string>).data
      : null,
    typeof (record.result as Record<string, unknown> | undefined)?.pdf === "string"
      ? (record.result as Record<string, string>).pdf
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  if (candidates.length === 0) {
    return null;
  }
  return fromBase64(candidates[0]);
}

function hasPrefix(data: Uint8Array, prefix: number[]): boolean {
  if (data.length < prefix.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i += 1) {
    if (data[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
}

export async function renderReportPdf(env: Env, payload: ReportPdfPayload): Promise<Uint8Array> {
  const token = env.CF_BROWSER_RENDERING_TOKEN;
  const baseUrl = browserRenderingBaseUrl(env);
  if (!token || !baseUrl) {
    throw new Error("Browser Rendering is not configured for PDF export.");
  }

  const html = buildReportPdfHtml(payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BROWSER_RENDER_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        pdfOptions: {
          format: "A4",
          printBackground: true,
          margin: {
            top: "0.4in",
            right: "0.4in",
            bottom: "0.4in",
            left: "0.4in",
          },
        },
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 8000,
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("PDF generation timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error.");
    throw new Error(`PDF generation failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => null);
    const decoded = extractBinaryFromJson(json);
    if (decoded) {
      return decoded;
    }
    throw new Error("PDF API returned JSON without binary payload.");
  }

  const pdf = new Uint8Array(await response.arrayBuffer());

  if (!hasPrefix(pdf, PDF_SIGNATURE)) {
    logger.warn("report_pdf_unexpected_format", { size: pdf.length });
  }

  return pdf;
}
