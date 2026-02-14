/* ── ScamShield MY — One Killer Flow ── */
import { ASCII_PATTERNS } from "./ascii-assets.js";
import { translations } from "./locales.js";

/* ── State ── */

const state = {
  phase: "hero", // hero | loading | verdict | recovery-kit | legit
  input: { raw: "", type: null, value: "", chain: "" },
  verdict: null,
  playbook: null,
  reports: null,
  warningCard: null,
  recoveryTasks: [],
  completedTaskIds: new Set(),
  auth: null,
  lang: localStorage.getItem("scamshield-lang") || "en",
};

const aiState = {
  messages: [],
  streaming: false,
};

/* ── Auth ── */

async function initAuth() {
  try {
    const data = await fetch("/api/auth/me").then((r) => r.json());
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
        quotaText.textContent = `${remaining}/${limit} left today`;
        quotaBadge.classList.remove("quota-badge--warn", "quota-badge--danger");
        if (remaining <= 3) quotaBadge.classList.add("quota-badge--danger");
        else if (remaining <= 10) quotaBadge.classList.add("quota-badge--warn");
      }

      if (data.role === "admin") {
        const adminLink = $("auth-admin-link");
        if (adminLink) adminLink.classList.remove("hidden");
      }
    } else {
      const quotaRes = await fetch("/api/quota").then((r) => r.json());
      if (quotaBadge && quotaRes) {
        quotaBadge.classList.remove("hidden");
        quotaText.textContent = `${quotaRes.remaining}/${quotaRes.limit} free today`;
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
    if (t[key]) el.innerHTML = t[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (t[key]) el.placeholder = t[key];
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

/* ── Utilities ── */

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
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

  const iconId = type === "error" ? "icon-alert-triangle" : "icon-check-circle";
  toast.innerHTML = `
    <svg class="icon toast-icon"><use href="#${iconId}"></use></svg>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showToastWithRetry(message, retryFn) {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast toast--error";
  toast.style.pointerEvents = "auto";
  toast.innerHTML = `
    <svg class="icon toast-icon"><use href="#icon-alert-triangle"></use></svg>
    <span>${escapeHtml(message)}</span>
    <button class="toast-action">Retry</button>
  `;
  const retryBtn = toast.querySelector(".toast-action");
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
  if (/^0x[a-fA-F0-9]{40,}$/.test(trimmed)) {
    return trimmed.length > 42 ? "contract" : "wallet";
  }
  if (/^@/.test(trimmed) || /^https?:\/\/(t\.me|wa\.me|instagram\.com)/i.test(trimmed)) {
    return "handle";
  }
  if (/^0x[a-fA-F0-9]+$/.test(trimmed)) {
    return "contract";
  }
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

  return {
    incidentTitle: titleMap[verdict.verdict] || `Investigation: ${input.value.substring(0, 40)}`,
    scamType: inferScamType(verdict.reasons),
    occurredAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " MYT",
    channel: channelMap[input.type] || "Unknown",
    suspects: [input.value],
    losses: $("flow-loss-input")?.value || "Unknown",
    actionsTaken: ["Scanned with ScamShield MY"],
    extraNotes: `ScamShield risk score: ${verdict.score}/100. Verdict: ${verdict.verdict}. Reasons: ${verdict.reasons.join("; ")}`,
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
  state.input = {
    raw: rawInput,
    type: detected || "handle",
    value: rawInput,
    chain: (detected === "contract" || detected === "wallet") ? "eth" : "",
  };

  // Loading state
  const submitBtn = $("flow-submit");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoader = submitBtn.querySelector(".btn-loader");
  submitBtn.disabled = true;
  btnText.classList.add("hidden");
  btnLoader.classList.remove("hidden");

  // Hide previous results
  hide("phase-verdict");
  hide("phase-recovery-kit");
  hide("phase-legit");
  hide("phase-footer-actions");
  hide("ai-fab");

  try {
    const verdictResponse = await fetchJSON("/api/verdict", {
      method: "POST",
      body: JSON.stringify({
        type: state.input.type,
        value: state.input.value,
        chain: state.input.chain || undefined,
      }),
    });

    state.verdict = verdictResponse;

    // Render verdict
    renderVerdictPhase(verdictResponse);
    await revealPhaseAnimated("phase-verdict", 100);

    // Branch based on verdict
    if (verdictResponse.verdict === "LEGIT") {
      await revealPhaseAnimated("phase-legit", 400);
      await revealPhaseAnimated("phase-footer-actions", 600);
      showAiFab();
    } else {
      // HIGH_RISK or UNKNOWN → full recovery kit
      await generateRecoveryKit(verdictResponse);
    }

  } catch (error) {
    showToastWithRetry(error.message, () => onFlowSubmit(event));
  } finally {
    submitBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnLoader.classList.add("hidden");
  }
}

/* ── Render Verdict ── */

function renderVerdictPhase(payload) {
  // Badge
  const badge = $("flow-verdict-badge");
  badge.textContent = payload.verdict;
  badge.className = verdictBadgeClass(payload.verdict);

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
    card.innerHTML = `
      <span class="reason-number">${i + 1}</span>
      <span class="reason-text">${escapeHtml(reason)}</span>
    `;
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

  // STEP 2: Reports
  if (reportResult.status === "fulfilled") {
    state.reports = reportResult.value;
    renderReportsPhase(reportResult.value);
    await revealPhaseAnimated("phase-reports", 200);
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

function initAiDrawer() {
  $("ai-fab")?.addEventListener("click", () => {
    const drawer = $("ai-chat-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      // Force reflow
      void drawer.offsetHeight;
      drawer.classList.add("ai-drawer--open");
      $("ai-chat-input")?.focus();
    }
  });

  $("flow-open-ai")?.addEventListener("click", () => {
    $("ai-fab")?.click();
  });

  $("ai-drawer-close")?.addEventListener("click", () => {
    const drawer = $("ai-chat-drawer");
    if (drawer) {
      drawer.classList.remove("ai-drawer--open");
      setTimeout(() => drawer.classList.add("hidden"), 300);
    }
  });

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

function appendAiMessage(role, content) {
  const container = $("ai-chat-messages");
  if (!container) return null;

  const msg = document.createElement("div");
  msg.className = `ai-msg ai-msg--${role}`;

  if (role === "assistant") {
    msg.innerHTML = `
      <div class="ai-msg-avatar">
        <svg class="icon"><use href="#icon-shield"></use></svg>
      </div>
      <div class="ai-msg-bubble typing-effect"><p></p></div>
    `;
    if (content) msg.querySelector("p").innerHTML = simpleMarkdown(content);
  } else {
    msg.innerHTML = `<div class="ai-msg-bubble"><p>${escapeHtml(content)}</p></div>`;
  }

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

async function sendAiMessage(userText) {
  if (aiState.streaming || !userText.trim()) return;

  const input = $("ai-chat-input");
  const sendBtn = $("ai-chat-send");
  const btnText = sendBtn?.querySelector(".btn-text");
  const btnLoader = sendBtn?.querySelector(".btn-loader");

  aiState.messages.push({ role: "user", content: userText.trim() });
  appendAiMessage("user", userText.trim());

  if (input) { input.value = ""; input.style.height = "auto"; }

  aiState.streaming = true;
  if (sendBtn) sendBtn.disabled = true;
  if (btnText) btnText.classList.add("hidden");
  if (btnLoader) btnLoader.classList.remove("hidden");

  const assistantMsg = appendAiMessage("assistant", "");
  const bubble = assistantMsg?.querySelector(".ai-msg-bubble");
  let fullContent = "";

  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: aiState.messages.map(m => ({ role: m.role, content: m.content })) }),
    });

    if (!response.ok) throw new Error(`Request failed: ${response.status}`);

    const data = await response.json();
    const assistantText = data.message || data.error || "Error processing request.";

    const p = bubble.querySelector("p");
    p.parentElement.classList.add("typing-effect");

    const words = assistantText.split(" ");
    for (let i = 0; i < words.length; i++) {
      fullContent += (i > 0 ? " " : "") + words[i];
      p.innerHTML = simpleMarkdown(fullContent);

      const container = $("ai-chat-messages");
      if (container) container.scrollTop = container.scrollHeight;

      const delay = Math.max(5, Math.random() * 20);
      if (i < words.length - 1) await new Promise(r => setTimeout(r, delay));
    }

    aiState.messages.push({ role: "assistant", content: assistantText });
    p.parentElement.classList.remove("typing-effect");

  } catch (error) {
    console.error(error);
    if (bubble) bubble.innerHTML = `<p class="error-msg">Error: ${escapeHtml(error.message)}</p>`;
    aiState.messages.push({ role: "assistant", content: `Error: ${error.message}` });
  } finally {
    aiState.streaming = false;
    if (sendBtn) sendBtn.disabled = false;
    if (btnText) btnText.classList.remove("hidden");
    if (btnLoader) btnLoader.classList.add("hidden");
    if (input) input.focus();
  }
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
    initOfflineDetection();
    initVisuals();
    initRipples();
    initAutoDetect();
    initReportTabs();
    initReportRegeneration();
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
  });
}

boot().catch((error) => {
  console.error(error);
});
