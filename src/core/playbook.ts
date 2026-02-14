export const KILLER_PITCH_LINE =
  "Most apps try to detect scams. We handle the part nobody solves: what to do after the scam happens - stop the bleeding, preserve evidence, generate reports, and contain the spread.";

export const emergencyPlaybook = {
  stopBleeding: [
    "Call your bank's fraud hotline now. Request an immediate freeze on outgoing transfers. Ask for a case reference number.",
    "Call NSRC at 997 (National Scam Response Centre, BNM). They coordinate inter-bank freezes across Malaysian banks.",
    "Call your telco. Disable SIM swap, reset PIN/PUK, require in-person verification for changes.",
    "Reset your email password first. Then rotate all linked bank, eWallet, and social media passwords. Enable app-based 2FA everywhere.",
  ],
  collectEvidence: [
    "Screenshot everything: chat messages, transfer receipts, wallet screens, scammer profiles, and payment instructions.",
    "On-chain: save transaction hashes, wallet addresses, token contract addresses, and block explorer URLs.",
    "Off-chain: record phone numbers, Telegram/WhatsApp/IG handles, domains, and recipient bank account numbers.",
    "Write a timeline with exact dates and times. List every action you took, in order.",
  ],
  reportChannels: [
    {
      type: "Bank / eWallet",
      channel: "Bank fraud hotline + in-app dispute",
      scriptHint:
        "State: unauthorized transfer under scam coercion. Provide transaction reference. Request recipient account freeze and escalation ticket number.",
    },
    {
      type: "Police",
      channel: "PDRM CCID portal or nearest police station",
      scriptHint:
        "File under online fraud category. Attach your incident timeline and full evidence bundle. Get the report number.",
    },
    {
      type: "Platform",
      channel: "Telegram / Meta / Instagram abuse report",
      scriptHint:
        "Report for impersonation or fraud. Include profile links, message screenshots, and a summary of victim impact.",
    },
  ],
  legalLine:
    "ScamShield MY does not promise fund recovery. We provide fast containment and reporting pathways.",
};

export interface RecoveryTask {
  id: string;
  label: string;
  weight: number;
  why: string;
}

export const recoveryTasks: RecoveryTask[] = [
  {
    id: "bank_freeze",
    label: "Bank freeze request submitted",
    weight: 20,
    why: "Stops additional outgoing transfers if fraud controls can still intervene.",
  },
  {
    id: "revoke_approvals",
    label: "Revoked token approvals (EVM)",
    weight: 20,
    why: "Prevents further wallet draining through existing approvals.",
  },
  {
    id: "password_rotation",
    label: "Rotated passwords + enabled 2FA",
    weight: 20,
    why: "Cuts off account takeover paths used for follow-up scams.",
  },
  {
    id: "sim_lock",
    label: "SIM lock / telco security enabled",
    weight: 15,
    why: "Reduces SIM swap risk and OTP interception.",
  },
  {
    id: "evidence_bundle",
    label: "Evidence bundle prepared",
    weight: 15,
    why: "Improves bank/police/platform action speed and consistency.",
  },
  {
    id: "warn_contacts",
    label: "Shared warning card with contacts",
    weight: 10,
    why: "Contains spread by warning likely next victims in your network.",
  },
];

export function calculateRecoveryProgress(completedTaskIds: string[]): number {
  const completed = new Set(completedTaskIds);
  const score = recoveryTasks.reduce((sum, task) => {
    return completed.has(task.id) ? sum + task.weight : sum;
  }, 0);

  return Math.min(100, score);
}