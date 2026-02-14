import type { ReportGenerateRequest } from "../types";

interface GeneratedReports {
  severitySuggestion: "low" | "medium" | "high" | "critical";
  timeline: string[];
  identifiers: string[];
  category: string;
  forBank: string;
  forPolice: string;
  forPlatform: string;
}

function parseLossAmount(losses: string): number {
  const numbers = losses.replace(/[^0-9.]/g, "");
  const amount = Number.parseFloat(numbers);
  return Number.isFinite(amount) ? amount : 0;
}

function severityFromInput(losses: string, actionsTaken: string[]): GeneratedReports["severitySuggestion"] {
  const amount = parseLossAmount(losses);
  if (amount >= 10000 || actionsTaken.length === 0) {
    return "critical";
  }
  if (amount >= 3000) {
    return "high";
  }
  if (amount >= 500) {
    return "medium";
  }
  return "low";
}

export function generateIncidentReports(input: ReportGenerateRequest): GeneratedReports {
  const severitySuggestion = severityFromInput(input.losses, input.actionsTaken);
  const timeline = [
    `${input.occurredAt}: Incident started via ${input.channel}.`,
    `${input.occurredAt}: Victim engaged with suspected scam flow (${input.scamType}).`,
    `${new Date().toISOString()}: Report generated with ScamShield MY templates.`,
  ];

  const identifiers = input.suspects.map((suspect) => suspect.trim()).filter(Boolean);
  const sharedBody = [
    `Incident Title: ${input.incidentTitle}`,
    `Scam Type: ${input.scamType}`,
    `Occurred At: ${input.occurredAt}`,
    `Channel: ${input.channel}`,
    `Suspect Identifiers: ${identifiers.join(", ") || "N/A"}`,
    `Estimated Loss: ${input.losses}`,
    `Actions Taken: ${input.actionsTaken.join("; ") || "None yet"}`,
    `Severity Suggestion: ${severitySuggestion.toUpperCase()}`,
    input.extraNotes ? `Additional Notes: ${input.extraNotes}` : undefined,
  ].filter(Boolean);

  const forBank = [
    "Subject: Urgent Scam/Fraud Transaction Freeze Request",
    "",
    "I am reporting a scam-related transaction and request an urgent freeze and escalation.",
    ...sharedBody,
    "",
    "Request: Please freeze recipient account/wallet pathways where possible and issue an official case/ticket reference.",
  ].join("\n");

  const forPolice = [
    "Subject: Police Report - Online Scam Incident",
    "",
    "I am filing an online scam report and attaching supporting evidence and timeline.",
    ...sharedBody,
    "",
    "Request: Record this as an online fraud case, acknowledge receipt, and advise next legal steps.",
  ].join("\n");

  const forPlatform = [
    "Subject: Fraud/Impersonation Account Report",
    "",
    "I am reporting an account/channel used for scam activity and victim targeting.",
    ...sharedBody,
    "",
    "Request: Remove/suspend the reported account and preserve logs relevant to fraud investigation.",
  ].join("\n");

  return {
    severitySuggestion,
    timeline,
    identifiers,
    category: input.scamType,
    forBank,
    forPolice,
    forPlatform,
  };
}