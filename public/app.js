/* ── ScamShield MY — One Killer Flow ── */
import { ASCII_PATTERNS } from "./ascii-assets.js";
import { translations } from "./locales.js";
import { AnimationManager } from "./animations.js";

/* ── State ── */

const state = {
  phase: "hero", // hero | loading | verdict | recovery-kit | legit
  mode: localStorage.getItem("scamshield-mode") || "ai", // "ai" | "manual"
  input: { raw: "", type: null, value: "", chain: "" },
  verdict: null,
  playbook: null,
  reports: null,
  reportMode: "ai", // "ai" | "template"
  templateReports: null, // keep template reports as fallback
  warningCard: null,
  recoveryTasks: [],
  completedTaskIds: new Set(),
  auth: null,
  lang: localStorage.getItem("scamshield-lang") || "en",
  activeFlowRequestController: null,
};

const aiState = {
  messages: [],
  streaming: false,
  inlineMessages: [],
  inlineStreaming: false,
};

const REQUEST_TIMEOUT_MS = 15_000;
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

function getCookieValue(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/* ── Auth ── */

async function initAuth() {
  try {
    const data = await fetchJSON("/api/auth/me", { method: "GET" });
    state.auth = data;

    const loginEl = $("auth-login");
    const userEl = $("auth-user");
    const emailEl = $("auth-email");
    const quotaBadge = $("quota-badge");
    const quotaText = $("quota-text");

    if (data.authenticated) {
      if (loginEl) loginEl.classList.add("hidden");
      if (userEl) userEl.classList.remove("hidden");
      if (emailEl) emailEl.textContent = data.email;

      if (quotaBadge && data.usage) {
        quotaBadge.classList.remove("hidden");
        const { remaining, limit } = data.usage;
        const points = Number(data.gamification?.totalPoints ?? 0);
        quotaText.textContent = `${remaining}/${limit} left today • ${points} pts`;
        quotaBadge.classList.remove("quota-badge--warn", "quota-badge--danger");
        if (remaining <= 3) quotaBadge.classList.add("quota-badge--danger");
        else if (remaining <= 10) quotaBadge.classList.add("quota-badge--warn");
      }

      if (data.role === "admin") {
        const adminLink = $("auth-admin-link");
        if (adminLink) adminLink.classList.remove("hidden");
      }

      // Hide sign-in CTA links when authenticated
      document.querySelectorAll(".hero-signin-link").forEach(el => el.classList.add("hidden"));
    } else {
      const quotaRes = await fetchJSON("/api/quota", { method: "GET" });
      if (quotaBadge && quotaRes) {
        quotaBadge.classList.remove("hidden");
        quotaText.textContent = `${quotaRes.remaining}/${quotaRes.limit} free — Sign in for 30/day`;
        quotaBadge.classList.remove("quota-badge--warn", "quota-badge--danger");
        if (quotaRes.remaining <= 1) quotaBadge.classList.add("quota-badge--danger");
        else if (quotaRes.remaining <= 2) quotaBadge.classList.add("quota-badge--warn");
      }
    }
  } catch {
    // Silently fail — auth is non-blocking
  }
}

/* ── Localization ── */

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("scamshield-lang", lang);

  const t = translations[lang];
  const toggleBtn = $("lang-toggle");
  if (toggleBtn) toggleBtn.textContent = lang === "en" ? "BM" : "EN";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!t[key]) return;
    const value = t[key];
    if (value.includes("<")) {
      // Markup is sourced from local translation bundles only.
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (t[key]) el.placeholder = t[key];
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.dataset.i18nAriaLabel;
    if (t[key]) el.setAttribute("aria-label", t[key]);
  });
}

function initLocalization() {
  const toggle = $("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const newLang = state.lang === "en" ? "bm" : "en";
      setLanguage(newLang);
    });
  }
  setLanguage(state.lang);
}

/* ── Mode Toggle (AI / Manual) ── */

function setMode(mode) {
  state.mode = mode;
  localStorage.setItem("scamshield-mode", mode);

  const aiBtn = $("mode-ai");
  const manualBtn = $("mode-manual");
  const heroAi = $("phase-hero-ai");
  const heroManual = $("phase-hero");

  if (mode === "ai") {
    aiBtn?.classList.add("mode-toggle-btn--active");
    manualBtn?.classList.remove("mode-toggle-btn--active");
    if (heroAi) heroAi.classList.remove("hidden");
    if (heroManual) heroManual.classList.add("hidden");
    // Focus AI input
    setTimeout(() => $("ai-chat-input-inline")?.focus(), 200);
  } else {
    manualBtn?.classList.add("mode-toggle-btn--active");
    aiBtn?.classList.remove("mode-toggle-btn--active");
    if (heroManual) heroManual.classList.remove("hidden");
    if (heroAi) heroAi.classList.add("hidden");
    setTimeout(() => $("flow-input")?.focus(), 200);
  }
}

function initModeToggle() {
  $("mode-ai")?.addEventListener("click", () => setMode("ai"));
  $("mode-manual")?.addEventListener("click", () => setMode("manual"));
  setMode(state.mode);
}

/* ── Inline AI Chat (AI Mode) ── */

function appendAiMessageToContainer(containerId, role, content) {
  const container = $(containerId);
  if (!container) return null;

  const msg = document.createElement("div");
  msg.className = `ai-msg ai-msg--${role}`;

  const bubble = document.createElement("div");
  bubble.className = "ai-msg-bubble";
  const paragraph = document.createElement("p");
  bubble.appendChild(paragraph);

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "ai-msg-avatar";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "icon");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-shield");
    icon.appendChild(use);
    avatar.appendChild(icon);
    bubble.classList.add("typing-effect");
    if (content) paragraph.innerHTML = simpleMarkdown(content);
    msg.append(avatar, bubble);
  } else {
    paragraph.textContent = content;
    msg.appendChild(bubble);
  }

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

async function sendAiMessageFlow(userText, config) {
  const text = String(userText || "").trim();
  if (!text || aiState[config.streamingKey]) return;

  const messages = aiState[config.messagesKey];
  const input = $(config.inputId);
  const sendBtn = $(config.sendBtnId);
  const btnText = sendBtn?.querySelector(".btn-text");
  const btnLoader = sendBtn?.querySelector(".btn-loader");

  if (config.quickActionsId) {
    const quickActions = $(config.quickActionsId);
    if (quickActions) quickActions.classList.add("hidden");
  }

  messages.push({ role: "user", content: text });
  appendAiMessageToContainer(config.containerId, "user", text);

  if (input) { input.value = ""; input.style.height = "auto"; }

  aiState[config.streamingKey] = true;
  if (sendBtn) sendBtn.disabled = true;
  if (btnText) btnText.classList.add("hidden");
  if (btnLoader) btnLoader.classList.remove("hidden");

  const assistantMsg = appendAiMessageToContainer(config.containerId, "assistant", "");
  const bubble = assistantMsg?.querySelector(".ai-msg-bubble");
  const bubbleParagraph = bubble?.querySelector("p");
  let fullContent = "";

  try {
    const data = await fetchJSON("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    });
    const assistantText = data.message || data.error || "Error processing request.";
    const options = data.options || [];

    bubble?.classList.add("typing-effect");

    const words = assistantText.split(" ");
    for (let i = 0; i < words.length; i++) {
      fullContent += (i > 0 ? " " : "") + words[i];
      if (bubbleParagraph) {
        bubbleParagraph.innerHTML = simpleMarkdown(fullContent);
      }

      const container = $(config.containerId);
      if (container) container.scrollTop = container.scrollHeight;

      const delay = Math.max(5, Math.random() * 20);
      if (i < words.length - 1) await new Promise(r => setTimeout(r, delay));
    }

    messages.push({ role: "assistant", content: assistantText });
    bubble?.classList.remove("typing-effect");

    // Render clickable options if provided
    if (options.length > 0 && bubble) {
      const optionsContainer = document.createElement("div");
      optionsContainer.className = "ai-options";

      options.forEach(option => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.type = "button";
        btn.textContent = option.text;
        btn.onclick = async () => {
          // Disable all option buttons after click
          optionsContainer.querySelectorAll("button").forEach(b => b.disabled = true);
          // Send the option action as the next user message
          if (config.messagesKey === "inlineMessages") {
            await sendInlineAiMessage(option.action);
          } else {
            await sendDrawerAiMessage(option.action);
          }
        };
        optionsContainer.appendChild(btn);
      });

      bubble.appendChild(optionsContainer);
    }

    const container = $(config.containerId);
    if (container) container.scrollTop = container.scrollHeight;

  } catch (error) {
    console.error(error);
    if (bubble) {
      bubble.innerHTML = "";
      const p = document.createElement("p");
      p.className = "error-msg";
      p.textContent = `Error: ${error.message}`;
      bubble.appendChild(p);
    }
    messages.push({ role: "assistant", content: `Error: ${error.message}` });
  } finally {
    aiState[config.streamingKey] = false;
    if (sendBtn) sendBtn.disabled = false;
    if (btnText) btnText.classList.remove("hidden");
    if (btnLoader) btnLoader.classList.add("hidden");
    if (input) input.focus();
  }
}

async function sendInlineAiMessage(userText) {
  return sendAiMessageFlow(userText, {
    messagesKey: "inlineMessages",
    streamingKey: "inlineStreaming",
    inputId: "ai-chat-input-inline",
    sendBtnId: "ai-chat-send-inline",
    containerId: "ai-chat-messages-inline",
    quickActionsId: "ai-quick-actions",
  });
}

function initInlineAiChat() {
  const form = $("ai-chat-form-inline");
  const input = $("ai-chat-input-inline");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendInlineAiMessage(input?.value || "");
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendInlineAiMessage(input.value);
    }
  });

  input?.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  // Quick action buttons
  document.querySelectorAll(".ai-quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      if (prompt) sendInlineAiMessage(prompt);
    });
  });
}

/* ── Report Mode Toggle (AI / Template) ── */

function initReportModeToggle() {
  const aiBtn = $("report-mode-ai");
  const templateBtn = $("report-mode-template");

  aiBtn?.addEventListener("click", async () => {
    if (state.reportMode === "ai") return;
    state.reportMode = "ai";
    aiBtn.classList.add("report-mode-btn--active");
    templateBtn.classList.remove("report-mode-btn--active");
    await generateAiReports();
  });

  templateBtn?.addEventListener("click", () => {
    if (state.reportMode === "template") return;
    state.reportMode = "template";
    templateBtn.classList.add("report-mode-btn--active");
    aiBtn.classList.remove("report-mode-btn--active");
    if (state.templateReports) {
      renderReportsPhase(state.templateReports);
      showReportModeBadge("Template", "");
    }
  });
}

async function generateAiReports() {
  if (!state.verdict) return;

  const badge = $("report-mode-badge");
  if (badge) {
    badge.textContent = "Generating AI reports...";
    badge.className = "report-mode-badge";
  }

  // Disable report textareas temporarily
  ["flow-report-bank", "flow-report-police", "flow-report-platform"].forEach(id => {
    const el = $(id);
    if (el) el.value = "Generating AI-enhanced report...";
  });

  const payload = buildReportPayloadFromVerdict(state.verdict, state.input);
  payload.losses = $("flow-loss-input")?.value?.trim() || "Unknown";

  try {
    const result = await fetchJSON("/api/report/generate-ai", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.reports = result;
    renderReportsPhase(result);

    if (result.fallback) {
      showReportModeBadge("Template (AI unavailable)", "warn");
    } else {
      showReportModeBadge("AI Generated", "success");
    }
  } catch (err) {
    showToast("AI report generation failed. Using template.", "error");
    // Fall back to template
    if (state.templateReports) {
      renderReportsPhase(state.templateReports);
      showReportModeBadge("Template (fallback)", "warn");
    }
  }
}

function showReportModeBadge(text, type) {
  const badge = $("report-mode-badge");
  if (!badge) return;
  badge.textContent = text;
  badge.className = `report-mode-badge ${type ? `report-mode-badge--${type}` : ""}`;
  badge.classList.remove("hidden");
}

/* ── Utilities ── */

async function fetchJSON(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

async function fetchWithTimeout(url, options = {}) {
  const {
    timeoutMs = REQUEST_TIMEOUT_MS,
    signal: externalSignal,
    headers: inputHeaders,
    method: methodRaw,
    ...rest
  } = options;

  const method = (methodRaw || "GET").toUpperCase();
  const headers = new Headers({
    "Content-Type": "application/json",
    ...(inputHeaders || {}),
  });

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getCookieValue("scamshield_csrf");
    if (csrfToken && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const controller = new AbortController();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, {
      ...rest,
      method,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function show(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

function hide(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}

function showToast(message, type = "success") {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "status");

  const iconId = type === "error" ? "icon-alert-triangle" : "icon-check-circle";
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "icon toast-icon");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${iconId}`);
  icon.appendChild(use);

  const text = document.createElement("span");
  text.textContent = String(message);

  toast.append(icon, text);

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showToastWithRetry(message, retryFn) {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast toast--error";
  toast.style.pointerEvents = "auto";
  toast.setAttribute("role", "alert");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "icon toast-icon");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#icon-alert-triangle");
  icon.appendChild(use);

  const text = document.createElement("span");
  text.textContent = String(message);

  const retryBtn = document.createElement("button");
  retryBtn.className = "toast-action";
  retryBtn.type = "button";
  retryBtn.textContent = "Retry";

  toast.append(icon, text, retryBtn);
  retryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toast.remove();
    if (retryFn) retryFn();
  });
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 8000);
}

function copyText(text, label) {
  navigator.clipboard.writeText(text).then(
    () => showToast(`${label || "Text"} copied to clipboard`),
    () => showToast("Failed to copy", "error"),
  );
}

function copyFromTextarea(id, label) {
  const field = $(id);
  if (!field || !field.value) return;
  copyText(field.value, label);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ── Ripple Effect ── */

function addRipple(event) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height);
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = (event.clientX - rect.left - size / 2) + "px";
  ripple.style.top = (event.clientY - rect.top - size / 2) + "px";
  el.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function initRipples() {
  document.querySelectorAll(".btn, .cta-btn, .flow-share-btn").forEach((el) => {
    el.addEventListener("click", addRipple);
  });
}

/* ── Auto-detect Input Type ── */

function detectInputType(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return "wallet";
  }
  if (/^0x[a-fA-F0-9]{41,}$/.test(trimmed)) {
    return "contract";
  }
  if (/^@/.test(trimmed) || /^https?:\/\/(t\.me|wa\.me|instagram\.com)/i.test(trimmed)) {
    return "handle";
  }
  // Don't default to handle for unknown inputs - let backend handle it
  return null;
}

function initAutoDetect() {
  const input = $("flow-input");
  const badge = $("flow-detect-badge");
  if (!input || !badge) return;

  const labels = { contract: "Contract detected", wallet: "Wallet detected", handle: "Handle detected" };

  const detect = () => {
    const detected = detectInputType(input.value);
    if (detected) {
      badge.textContent = labels[detected];
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  };

  input.addEventListener("input", detect);
  input.addEventListener("paste", () => setTimeout(detect, 10));
}

/* ── Offline Detection ── */

function initOfflineDetection() {
  const banner = $("offline-banner");
  if (!banner) return;

  function goOffline() {
    banner.classList.remove("hidden", "reconnected");
    banner.querySelector("span").textContent = "You're offline. Some features may not work.";
  }

  function goOnline() {
    banner.classList.remove("hidden");
    banner.classList.add("reconnected");
    banner.querySelector("span").textContent = "Back online!";
    setTimeout(() => banner.classList.add("hidden"), 2500);
  }

  window.addEventListener("offline", goOffline);
  window.addEventListener("online", goOnline);
  if (!navigator.onLine) goOffline();
}

/* ── Progress Milestones ── */

let lastMilestone = 0;

function checkProgressMilestone(progress) {
  const milestones = [25, 50, 75, 100];
  const messages = {
    25: "Good start — keep going!",
    50: "Halfway there!",
    75: "Almost fully contained!",
    100: "All actions complete!",
  };

  const bar = $("flow-progress-bar");
  for (const m of milestones) {
    if (progress >= m && lastMilestone < m) {
      lastMilestone = m;

      if (bar) {
        bar.classList.add("milestone-hit");
        setTimeout(() => bar.classList.remove("milestone-hit"), 600);
      }

      showToast(messages[m]);
      break;
    }
  }
}

/* ── Verdict Helpers ── */

function verdictBadgeClass(verdict) {
  if (verdict === "HIGH_RISK") return "verdict-badge high";
  if (verdict === "LEGIT") return "verdict-badge legit";
  return "verdict-badge";
}

function verdictStateCopy(verdict, pendingEnrichment, providerErrors = []) {
  const degraded = Boolean(pendingEnrichment) || providerErrors.length > 0;

  if (verdict === "HIGH_RISK") {
    return {
      tone: "high",
      text: degraded
        ? "High-risk indicators are present and some live checks are still catching up. Treat this as active risk and start containment now."
        : "High-risk indicators are present. Freeze exposure immediately and move to reporting and warning steps.",
    };
  }

  if (verdict === "LEGIT") {
    return {
      tone: "legit",
      text: degraded
        ? "No high-risk signal yet. Verification is active. Confirm details through official channels while we finalize checks."
        : "No high-risk signal detected. This does not guarantee safety—always verify payment requests through official channels.",
    };
  }

  return {
    tone: "unknown",
    text: degraded
      ? "Result UNKNOWN. Live systems are syncing. Treat as unverified: do not send funds and follow the emergency steps."
      : "Result UNKNOWN. Signals are inconclusive. Treat as unverified and proceed with caution.",
  };
}

/* ── Progressive Reveal ── */

function revealPhaseAnimated(phaseId, delayMs = 0) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const el = $(phaseId);
      if (!el) { resolve(); return; }

      el.classList.remove("hidden");
      // Force reflow so the animation triggers
      void el.offsetHeight;
      el.classList.add("flow-reveal");

      el.scrollIntoView({ behavior: "smooth", block: "start" });

      requestAnimationFrame(() => {
        el.classList.add("in-view");
        resolve();
      });
    }, delayMs);
  });
}

function markKitStep(stepId, status) {
  const el = $(stepId);
  if (el) el.classList.add(status);
}

/* ── Auto-populate Helpers ── */

function inferScamType(reasons) {
  const text = reasons.join(" ").toLowerCase();
  if (text.includes("honeypot")) return "Honeypot / Token Scam";
  if (text.includes("impersonat")) return "Impersonation";
  if (text.includes("investment") || text.includes("ponzi")) return "Investment Scam";
  if (text.includes("phish")) return "Phishing";
  if (text.includes("rug") || text.includes("liquidity")) return "Rug Pull / DeFi Scam";
  if (text.includes("community") || text.includes("reports")) return "Community-Reported Scam";
  return "Suspected Online Fraud";
}

function buildReportPayloadFromVerdict(verdict, input) {
  const channelMap = {
    contract: "Blockchain / DeFi",
    wallet: "Blockchain / Wallet Transfer",
    handle: "Social Media / Messaging",
  };

  const titleMap = {
    HIGH_RISK: `High-risk scam detected: ${input.value.substring(0, 30)}`,
    UNKNOWN: `Suspicious activity flagged: ${input.value.substring(0, 30)}`,
  };

  const sources = Array.isArray(verdict.sources) && verdict.sources.length > 0
    ? verdict.sources.join(", ")
    : "none";

  return {
    incidentTitle: titleMap[verdict.verdict] || `Investigation: ${input.value.substring(0, 40)}`,
    scamType: inferScamType(verdict.reasons),
    occurredAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " MYT",
    channel: channelMap[input.type] || "Unknown",
    suspects: [input.value],
    losses: $("flow-loss-input")?.value || "Unknown",
    actionsTaken: ["Scanned with ScamShield MY"],
    extraNotes: `ScamShield risk score: ${verdict.score}/100. Verdict: ${verdict.verdict}. Sources: ${sources}. Reasons: ${verdict.reasons.join("; ")}`,
  };
}

function buildWarningPayloadFromVerdict(verdict, input) {
  const headlineMap = {
    HIGH_RISK: "High-risk scam indicator detected",
    UNKNOWN: "Unverified identifier under review",
  };

  return {
    verdict: verdict.verdict,
    headline: headlineMap[verdict.verdict] || headlineMap.UNKNOWN,
    identifiers: { target: input.value },
    reasons: verdict.reasons.slice(0, 3),
  };
}

/* ══════════════════════════════════════════════════════════════════
   CORE FLOW: Single submit → verdict → recovery kit
   ══════════════════════════════════════════════════════════════════ */

async function onFlowSubmit(event) {
  event.preventDefault();

  const rawInput = $("flow-input").value.trim();
  if (!rawInput) return;

  // Detect input type
  const detected = detectInputType(rawInput);
  if (!detected) {
    showToast("Please enter a valid wallet address (0x...), contract address, or social handle (@username, t.me/, etc.)", "error");
    return;
  }

  state.input = {
    raw: rawInput,
    type: detected,
    value: rawInput,
    chain: (detected === "contract" || detected === "wallet") ? "eth" : "",
  };

  // Loading state with progressive updates
  const submitBtn = $("flow-submit");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoader = submitBtn.querySelector(".btn-loader");
  submitBtn.disabled = true;

  if (!btnText.dataset.original) btnText.dataset.original = btnText.textContent;

  btnText.classList.add("hidden");
  btnLoader.classList.remove("hidden");

  // Simulate "Deep Scan" effect
  const loadingTexts = ["Connecting...", "Scanning databases...", "Analyzing patterns...", "Verifying..."];
  let loadStep = 0;
  const loadInterval = setInterval(() => {
    // Optional: update some loading badge if it exists
  }, 800);

  // Hide previous results
  hide("phase-verdict");
  hide("phase-recovery-kit");
  hide("phase-legit");
  hide("phase-footer-actions");
  hide("ai-fab");

  if (state.activeFlowRequestController) {
    state.activeFlowRequestController.abort("replaced");
  }
  const controller = new AbortController();
  state.activeFlowRequestController = controller;

  try {
    const verdictResponse = await fetchJSON("/api/verdict", {
      method: "POST",
      body: JSON.stringify({
        type: state.input.type,
        value: state.input.value,
        chain: state.input.chain || undefined,
      }),
      signal: controller.signal,
    });

    state.verdict = verdictResponse;

    // Render verdict
    renderVerdictPhase(verdictResponse);
    await revealPhaseAnimated("phase-verdict", 100);

    // Branch based on verdict
    // Branch based on verdict
    if (verdictResponse.verdict === "LEGIT") {
      await revealPhaseAnimated("phase-legit", 400);
      await revealPhaseAnimated("phase-footer-actions", 600);
      showAiFab();
      // Safe sound effect (optional)
    } else {
      // HIGH_RISK or UNKNOWN → full recovery kit
      await generateRecoveryKit(verdictResponse);
    }

  } catch (error) {
    showToastWithRetry(error.message, () => onFlowSubmit(event));
  } finally {
    if (state.activeFlowRequestController === controller) {
      state.activeFlowRequestController = null;
    }
    clearInterval(loadInterval);
    submitBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnLoader.classList.add("hidden");
    // Restore original text
    if (btnText.dataset.original) btnText.textContent = btnText.dataset.original;
  }
}

/* ── Render Verdict ── */

function renderVerdictPhase(payload) {
  // Badge
  const badge = $("flow-verdict-badge");
  badge.textContent = payload.verdict;
  badge.className = verdictBadgeClass(payload.verdict);

  // Haptics for HIGH_RISK (Official/Tactile feel)
  if (navigator.vibrate) {
    if (payload.verdict === "HIGH_RISK") navigator.vibrate([100, 50, 100, 50, 300]);
    else if (payload.verdict === "LEGIT") navigator.vibrate([50, 50, 100]);
    else navigator.vibrate(200);
  }

  // Score bar
  const scoreBar = $("flow-score-bar");
  scoreBar.style.width = "0%";
  requestAnimationFrame(() => {
    scoreBar.style.width = `${Math.min(100, payload.score)}%`;
  });
  setText("flow-score-value", `${payload.score} / 100`);

  // Reasons
  const reasonsContainer = $("flow-reasons");
  reasonsContainer.innerHTML = "";
  payload.reasons.slice(0, 3).forEach((reason, i) => {
    const card = document.createElement("div");
    card.className = "reason-card";
    const number = document.createElement("span");
    number.className = "reason-number";
    number.textContent = `${i + 1}`;
    const text = document.createElement("span");
    text.className = "reason-text";
    text.textContent = reason;
    card.append(number, text);
    reasonsContainer.appendChild(card);
  });

  // State copy
  const el = $("flow-state-copy");
  if (el) {
    const copy = verdictStateCopy(payload.verdict, payload.pendingEnrichment, payload.providerErrors || []);
    el.textContent = copy.text;
    el.className = `verdict-state-copy verdict-state-copy--${copy.tone}`;
  }

  // Meta
  const sourceSummary = payload.sources.join(", ") || "none";
  const degraded = payload.pendingEnrichment || (payload.providerErrors || []).length > 0;
  const modeSummary = degraded
    ? "Preliminary result. Live enrichment is still running."
    : "Result based on currently available provider signals.";
  setText("flow-meta", `Sources: ${sourceSummary}. ${modeSummary}`);
}

/* ── Generate Recovery Kit (Parallel APIs) ── */

async function generateRecoveryKit(verdict) {
  show("phase-recovery-kit");
  show("recovery-kit-loading");

  // Reset step indicators
  ["kit-step-emergency", "kit-step-reports", "kit-step-warning"].forEach(id => {
    $(id)?.classList.remove("done");
  });

  const reportPayload = buildReportPayloadFromVerdict(verdict, state.input);
  const warningPayload = buildWarningPayloadFromVerdict(verdict, state.input);

  // Fire all 3 APIs in parallel
  const [playbookResult, reportResult, warningResult] = await Promise.allSettled([
    fetchJSON("/api/playbook").then(data => {
      markKitStep("kit-step-emergency", "done");
      return data;
    }),
    fetchJSON("/api/report/generate", {
      method: "POST",
      body: JSON.stringify(reportPayload),
    }).then(data => {
      markKitStep("kit-step-reports", "done");
      return data;
    }),
    fetchJSON("/api/warning-card", {
      method: "POST",
      body: JSON.stringify(warningPayload),
    }).then(data => {
      markKitStep("kit-step-warning", "done");
      return data;
    }),
  ]);

  // Hide loading
  hide("recovery-kit-loading");

  // STEP 1: Emergency actions (from playbook)
  if (playbookResult.status === "fulfilled") {
    state.playbook = playbookResult.value.playbook;
    state.recoveryTasks = playbookResult.value.recoveryTasks || [];
    renderEmergencyPhase(playbookResult.value);
    await revealPhaseAnimated("phase-emergency", 0);

    // STEP 3: Recovery checklist (comes from playbook data)
    renderRecoveryChecklist(state.recoveryTasks);
  }

  // STEP 2: Reports (template first, then try AI)
  if (reportResult.status === "fulfilled") {
    state.templateReports = reportResult.value;
    state.reports = reportResult.value;
    renderReportsPhase(reportResult.value);
    await revealPhaseAnimated("phase-reports", 200);

    // Auto-try AI reports in background (upgrade from template)
    generateAiReports().catch(() => {
      // AI failed silently — template already shown
      showReportModeBadge("Template", "");
    });
  } else {
    // Show reports section with error state
    show("phase-reports");
    $("flow-report-severity").innerHTML = `<span class="severity-badge severity-badge--medium">Could not auto-generate reports. Try the Update button below.</span>`;
    $("phase-reports").classList.add("flow-reveal", "in-view");
  }

  // STEP 3: Checklist
  await revealPhaseAnimated("phase-checklist", 400);

  // STEP 4: Warning card
  if (warningResult.status === "fulfilled") {
    state.warningCard = warningResult.value;
    renderSharePhase(warningResult.value, verdict);
    await revealPhaseAnimated("phase-share", 600);
  }

  // Footer actions
  await revealPhaseAnimated("phase-footer-actions", 800);
  showAiFab();
}

/* ── Render Emergency Phase ── */

function renderEmergencyPhase(playbookData) {
  const t = translations[state.lang];
  const container = $("flow-emergency-actions");
  if (!container) return;
  container.innerHTML = "";

  const stopItems = [
    t["playbook.stop.bank"],
    t["playbook.stop.nsrc"],
    t["playbook.stop.telco"],
    t["playbook.stop.pwd"],
  ];

  stopItems.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "emergency-action-card";
    card.innerHTML = `
      <span class="emergency-action-num">${i + 1}</span>
      <div class="emergency-action-body">
        <p>${escapeHtml(item)}</p>
      </div>
    `;
    container.appendChild(card);
  });

  // Report channels
  const channelContainer = $("flow-report-channels");
  if (channelContainer && playbookData.playbook && playbookData.playbook.reportChannels) {
    channelContainer.innerHTML = "";
    playbookData.playbook.reportChannels.forEach(ch => {
      const card = document.createElement("div");
      card.className = "report-channel";
      card.innerHTML = `
        <span class="channel-type">${escapeHtml(ch.type)}</span>
        <div class="channel-body">
          <p class="channel-target">${escapeHtml(ch.channel)}</p>
          <p class="channel-hint">${escapeHtml(ch.scriptHint)}</p>
        </div>
      `;
      channelContainer.appendChild(card);
    });
  }
}

/* ── Render Reports Phase ── */

function renderReportsPhase(reportData) {
  const severityDiv = $("flow-report-severity");
  const sev = reportData.severitySuggestion;
  severityDiv.innerHTML = `<span class="severity-badge severity-badge--${sev}">Severity: ${sev.toUpperCase()}</span>`;

  $("flow-report-bank").value = reportData.forBank;
  $("flow-report-police").value = reportData.forPolice;
  $("flow-report-platform").value = reportData.forPlatform;
}

/* ── Render Recovery Checklist ── */

function renderRecoveryChecklist(tasks) {
  const list = $("flow-task-list");
  if (!list) return;
  list.innerHTML = "";

  tasks.forEach((task) => {
    const li = document.createElement("li");
    const checked = state.completedTaskIds.has(task.id);
    li.className = `task-item${checked ? " completed" : ""}`;

    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${checked ? "checked" : ""}>
      <div class="task-content">
        <span class="task-label">${escapeHtml(task.label)}</span>
        <p class="task-why">${escapeHtml(task.why)}</p>
      </div>
      <span class="task-weight">+${task.weight}%</span>
    `;

    list.appendChild(li);
  });

  list.querySelectorAll(".task-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const target = event.target;
      const taskId = target.dataset.taskId;
      if (!taskId) return;

      const taskItem = target.closest(".task-item");

      if (target.checked) {
        state.completedTaskIds.add(taskId);
        taskItem?.classList.add("completed", "just-checked");
        setTimeout(() => taskItem?.classList.remove("just-checked"), 400);
      } else {
        state.completedTaskIds.delete(taskId);
        taskItem?.classList.remove("completed");
      }

      await refreshRecoveryProgress();
    });
  });

  refreshRecoveryProgress().catch(console.error);
}

async function refreshRecoveryProgress() {
  const payload = await fetchJSON("/api/recovery-progress", {
    method: "POST",
    body: JSON.stringify({
      completedTaskIds: Array.from(state.completedTaskIds),
    }),
  });

  const progress = payload.progress || 0;
  const bar = $("flow-progress-bar");
  if (bar) bar.style.width = `${progress}%`;

  const completedCount = state.completedTaskIds.size;
  const totalCount = state.recoveryTasks.length;

  setText("flow-progress-label", `${progress}% contained`);
  setText("flow-progress-count", `${completedCount} / ${totalCount} actions`);

  checkProgressMilestone(progress);
}

/* ── Render Share Phase ── */

function renderSharePhase(warningData, verdict) {
  const pageLink = $("flow-warning-link");
  if (pageLink) {
    pageLink.href = warningData.warningPageUrl;
    pageLink.textContent = warningData.warningPageUrl;
  }

  const preview = $("flow-warning-preview");
  if (preview) preview.src = `${warningData.imageUrl}?t=${Date.now()}`;

  const shell = $("flow-warning-preview-shell");
  const status = $("flow-warning-status");
  if (shell && status) {
    shell.classList.remove("warning-preview-shell--high", "warning-preview-shell--legit");
    status.textContent = verdict.verdict;
    if (verdict.verdict === "HIGH_RISK") shell.classList.add("warning-preview-shell--high");
    if (verdict.verdict === "LEGIT") shell.classList.add("warning-preview-shell--legit");
  }
}

/* ── Report Tabs ── */

function initReportTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;

      // Update active tab button (within same parent)
      const tabContainer = btn.closest(".report-tabs");
      tabContainer?.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update active panel (within same card)
      const cardEl = btn.closest(".card");
      cardEl?.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      cardEl?.querySelector(`[data-panel="${tab}"]`)?.classList.add("active");
    });
  });
}

/* ── Report Regeneration (inline loss edit) ── */

function initReportRegeneration() {
  const btn = $("flow-regenerate-reports");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!state.verdict) return;

    const payload = buildReportPayloadFromVerdict(state.verdict, state.input);
    payload.losses = $("flow-loss-input")?.value?.trim() || "Unknown";

    btn.disabled = true;
    try {
      const reports = await fetchJSON("/api/report/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.reports = reports;
      renderReportsPhase(reports);
      showToast("Reports updated with loss amount.");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });
}

/* ── PDF Export for Reports ── */

function initPdfExport() {
  const btn = $("flow-export-pdf");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!state.reports || !state.verdict) {
      showToast("No reports to export. Generate reports first.", "error");
      return;
    }

    const reportPayload = buildReportPayloadFromVerdict(state.verdict, state.input);
    reportPayload.losses = $("flow-loss-input")?.value?.trim() || "Unknown";

    const pdfPayload = {
      ...reportPayload,
      severitySuggestion: state.reports.severitySuggestion || "medium",
      forBank: state.reports.forBank,
      forPolice: state.reports.forPolice,
      forPlatform: state.reports.forPlatform,
    };

    btn.disabled = true;
    const btnText = btn.querySelector("span");
    const originalText = btnText?.textContent;
    if (btnText) btnText.textContent = "Generating...";

    try {
      const response = await fetchWithTimeout("/api/report/export-pdf", {
        method: "POST",
        body: JSON.stringify(pdfPayload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "PDF generation failed" }));
        throw new Error(err.error || "PDF generation failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ScamShield-Report-${Date.now().toString(36)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("PDF report downloaded.");
    } catch (err) {
      showToast(err.message || "PDF export failed", "error");
    } finally {
      btn.disabled = false;
      if (btnText) btnText.textContent = originalText;
    }
  });
}

/* ── Warning Card Customization ── */

function initWarningCardCustomization() {
  const customizeState = {
    theme: "auto",
    language: "en",
    headline: "",
    footerText: "",
    showIdentifiers: true,
  };

  // Theme picker
  const themePicker = $("customize-theme-picker");
  if (themePicker) {
    themePicker.addEventListener("click", (e) => {
      const swatch = e.target.closest("[data-theme]");
      if (!swatch) return;
      customizeState.theme = swatch.dataset.theme;
      themePicker.querySelectorAll(".theme-swatch").forEach(s => s.classList.remove("theme-swatch--active"));
      swatch.classList.add("theme-swatch--active");
    });
  }

  // Language picker
  const langPicker = $("customize-lang-picker");
  if (langPicker) {
    langPicker.addEventListener("click", (e) => {
      const option = e.target.closest("[data-lang]");
      if (!option) return;
      customizeState.language = option.dataset.lang;
      langPicker.querySelectorAll(".lang-option").forEach(o => o.classList.remove("lang-option--active"));
      option.classList.add("lang-option--active");
    });
  }

  // Identifier toggle
  const idToggle = $("customize-show-identifiers");
  if (idToggle) {
    idToggle.addEventListener("change", () => {
      customizeState.showIdentifiers = idToggle.checked;
    });
  }

  function getCustomPayload() {
    if (!state.warningCard || !state.verdict) return null;

    const headlineInput = $("customize-headline")?.value?.trim();
    const footerInput = $("customize-footer")?.value?.trim();

    const warningBase = buildWarningPayloadFromVerdict(state.verdict, state.input);

    return {
      verdict: warningBase.verdict,
      headline: headlineInput || warningBase.headline,
      identifiers: warningBase.identifiers,
      reasons: warningBase.reasons,
      theme: customizeState.theme,
      language: customizeState.language,
      footerText: footerInput || undefined,
      showIdentifiers: customizeState.showIdentifiers,
    };
  }

  // Preview (SVG only, no save)
  $("customize-preview-btn")?.addEventListener("click", async () => {
    const payload = getCustomPayload();
    if (!payload) {
      showToast("No warning card data available.", "error");
      return;
    }

    const btn = $("customize-preview-btn");
    btn.disabled = true;

    try {
      const response = await fetchWithTimeout("/api/warning-card/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Preview failed");

      const svgText = await response.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      const preview = $("flow-warning-preview");
      if (preview) {
        preview.src = url;
        // Clean up old blob URL after load
        preview.onload = () => {
          if (preview._prevBlobUrl) URL.revokeObjectURL(preview._prevBlobUrl);
          preview._prevBlobUrl = url;
        };
      }
      showToast("Preview updated.");
    } catch (err) {
      showToast(err.message || "Preview failed", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // Apply & Regenerate (saves to R2 + DB)
  $("customize-apply-btn")?.addEventListener("click", async () => {
    const payload = getCustomPayload();
    if (!payload) {
      showToast("No warning card data available.", "error");
      return;
    }

    const btn = $("customize-apply-btn");
    btn.disabled = true;
    const btnText = btn.querySelector("span");
    const originalText = btnText?.textContent;
    if (btnText) btnText.textContent = "Generating...";

    try {
      const result = await fetchJSON("/api/warning-card/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      state.warningCard = result;
      renderSharePhase(result, state.verdict);
      showToast("Custom warning card generated!");

      // Close the panel
      const panel = $("warning-customize-panel");
      if (panel) panel.open = false;
    } catch (err) {
      showToast(err.message || "Customization failed", "error");
    } finally {
      btn.disabled = false;
      if (btnText) btnText.textContent = originalText;
    }
  });
}

/* ── Share Buttons ── */

function initShareButtons() {
  $("flow-share-whatsapp")?.addEventListener("click", () => {
    if (!state.warningCard) return;
    const url = window.location.origin + state.warningCard.warningPageUrl;
    const text = `ScamShield Warning: ${state.verdict?.verdict || "CHECK"}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  });

  $("flow-share-telegram")?.addEventListener("click", () => {
    if (!state.warningCard) return;
    const url = window.location.origin + state.warningCard.warningPageUrl;
    const text = `ScamShield Warning: ${state.verdict?.verdict || "CHECK"}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
  });

  $("flow-share-native")?.addEventListener("click", async () => {
    if (!state.warningCard) return;
    const url = window.location.origin + state.warningCard.warningPageUrl;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ScamShield MY Warning",
          text: `Verdict: ${state.verdict?.verdict || "CHECK"}`,
          url: url,
        });
      } catch { /* user cancelled */ }
    } else {
      copyText(url, "Warning link");
    }
  });

  // Copy warning link
  $("flow-copy-warning")?.addEventListener("click", (e) => {
    e.preventDefault();
    const link = $("flow-warning-link");
    if (link?.href && link.href !== "#") {
      copyText(link.href, "Warning page link");
      flashCopied(e.currentTarget);
    }
  });
}

/* ── Check Another (Reset Flow) ── */

function initCheckAnother() {
  $("flow-check-another")?.addEventListener("click", resetFlow);

  // Also allow re-submitting from the hero
  const hero = $("phase-hero");
  if (hero) {
    hero.addEventListener("click", (e) => {
      if (e.target.id === "flow-check-another-top") resetFlow();
    });
  }
}

function resetFlow() {
  state.phase = "hero";
  state.verdict = null;
  state.reports = null;
  state.warningCard = null;
  state.completedTaskIds.clear();
  lastMilestone = 0;

  // Hide all phases except hero
  ["phase-verdict", "phase-recovery-kit", "phase-legit", "phase-footer-actions"].forEach(hide);

  // Also hide inner recovery phases
  ["phase-emergency", "phase-reports", "phase-checklist", "phase-share", "recovery-kit-loading"].forEach(id => {
    const el = $(id);
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("flow-reveal", "in-view");
    }
  });

  // Reset verdict phase animation state
  const verdictPhase = $("phase-verdict");
  if (verdictPhase) {
    verdictPhase.classList.remove("flow-reveal", "in-view");
  }

  hide("ai-fab");

  const input = $("flow-input");
  if (input) {
    input.value = "";
    input.focus();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── Copy Button Wiring ── */

function wireCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = btn.dataset.copy;
      const labels = {
        "flow-report-bank": "Bank report",
        "flow-report-police": "Police report",
        "flow-report-platform": "Platform report",
      };
      copyFromTextarea(targetId, labels[targetId] || "Report");
      flashCopied(btn);
    });
  });
}

function flashCopied(btn) {
  btn.classList.add("copied");
  const label = btn.querySelector(".copy-label");
  const original = label?.textContent;
  if (label) label.textContent = "Copied!";

  setTimeout(() => {
    btn.classList.remove("copied");
    if (label && original) label.textContent = original;
  }, 1500);
}

/* ── AI Chat Drawer ── */

function showAiFab() {
  $("ai-fab")?.classList.remove("hidden");
}

let drawerPreviouslyFocused = null;

function closeAiDrawer() {
  const drawer = $("ai-chat-drawer");
  if (!drawer || drawer.classList.contains("hidden")) return;
  drawer.classList.remove("ai-drawer--open");
  drawer.removeEventListener("keydown", onAiDrawerKeydown);
  setTimeout(() => drawer.classList.add("hidden"), 300);
  if (drawerPreviouslyFocused && typeof drawerPreviouslyFocused.focus === "function") {
    drawerPreviouslyFocused.focus();
  }
}

function onAiDrawerKeydown(event) {
  const drawer = $("ai-chat-drawer");
  if (!drawer || drawer.classList.contains("hidden")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeAiDrawer();
    return;
  }

  if (event.key !== "Tab") return;
  const focusables = Array.from(drawer.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function openAiDrawer(triggerElement) {
  const drawer = $("ai-chat-drawer");
  if (!drawer) return;
  drawerPreviouslyFocused = triggerElement || document.activeElement;
  drawer.classList.remove("hidden");
  // Force reflow
  void drawer.offsetHeight;
  drawer.classList.add("ai-drawer--open");
  drawer.addEventListener("keydown", onAiDrawerKeydown);
  $("ai-chat-input")?.focus();
}

function initAiDrawer() {
  $("ai-fab")?.addEventListener("click", (event) => {
    openAiDrawer(event.currentTarget);
  });

  $("flow-open-ai")?.addEventListener("click", () => {
    $("ai-fab")?.click();
  });

  $("ai-drawer-close")?.addEventListener("click", closeAiDrawer);

  // AI Chat form
  const form = $("ai-chat-form");
  const input = $("ai-chat-input");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendAiMessage(input?.value || "");
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiMessage(input.value);
    }
  });

  input?.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });
}

function simpleMarkdown(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, '<h4 class="ai-md-h3">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-md-h2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="ai-md-h1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ai-md-li">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="ai-md-ul">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li class="ai-md-oli">$1</li>')
    .replace(/(<li class="ai-md-oli">.*<\/li>\n?)+/g, (m) => `<ol class="ai-md-ol">${m}</ol>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

async function sendAiMessage(userText) {
  return sendAiMessageFlow(userText, {
    messagesKey: "messages",
    streamingKey: "streaming",
    inputId: "ai-chat-input",
    sendBtnId: "ai-chat-send",
    containerId: "ai-chat-messages",
  });
}

/* ── Visuals ── */

function initVisuals() {
  const asciiBg = $("ascii-bg");
  if (asciiBg) {
    const chars = "01010101010011     ..........     ::::::     |||||";
    const rows = 30;
    const cols = 60;
    let art = "";
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        art += chars[Math.floor(Math.random() * chars.length)];
      }
      art += "\n";
    }
    asciiBg.textContent = art;
  }

  const wrapper = document.querySelector(".parallax-wrapper");
  if (wrapper) {
    wrapper.addEventListener("scroll", () => {
      const scrollTop = wrapper.scrollTop;
      document.body.style.setProperty("--scroll-y", `${scrollTop}px`);
    }, { passive: true });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });

  document.querySelectorAll("[data-animate]").forEach(el => observer.observe(el));

  console.log("%c" + ASCII_PATTERNS.header, "color: #2563eb; font-weight: bold;");
}

/* ── Boot ── */

async function boot() {
  document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initLocalization();
    initModeToggle();
    initInlineAiChat();
    initReportModeToggle();
    initOfflineDetection();
    initVisuals();
    initRipples();
    initAutoDetect();
    initReportTabs();
    initReportRegeneration();
    initPdfExport();
    initWarningCardCustomization();
    initShareButtons();
    initAiDrawer();
    initCheckAnother();
    wireCopyButtons();

    // Validation for required input
    const input = $("flow-input");
    if (input) {
      const errorMsg = document.createElement("span");
      errorMsg.className = "error-msg hidden";
      input.parentNode.appendChild(errorMsg);

      input.addEventListener("blur", () => {
        if (!input.checkValidity()) {
          input.classList.add("input-error");
          errorMsg.textContent = input.validationMessage;
          errorMsg.classList.remove("hidden");
        } else {
          input.classList.remove("input-error");
          errorMsg.classList.add("hidden");
        }
      });
    }

    // Wire flow submit
    const form = $("flow-input-form");
    if (form) form.addEventListener("submit", onFlowSubmit);

    // Auto-focus input
    setTimeout(() => $("flow-input")?.focus(), 300);

    // Mobile viewport fix
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);

    // Initialize animation system
    const animManager = new AnimationManager();
    animManager.initAll();
    
    // Store globally for cleanup if needed
    window.scamshieldAnimations = animManager;
  });
}

boot().catch((error) => {
  console.error(error);
});
