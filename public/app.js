/* ── ScamShield MY — Agent 3 Interaction Polish ── */

const state = {
  playbook: null,
  recoveryTasks: [],
  completedTaskIds: new Set(),
  latestWarning: null,
};

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

function showToast(message, type = "success") {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
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

/* ── Verdict ── */

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
        ? "No high-risk signal yet, but live enrichment is still in progress. Stay cautious and verify through official channels."
        : "No high-risk signal is currently detected. Keep monitoring and verify all payment requests through official channels.",
    };
  }

  return {
    tone: "unknown",
    text: degraded
      ? "Result is UNKNOWN because provider signals are delayed or incomplete. Treat as unverified and run the emergency steps now."
      : "Result is UNKNOWN because signals are inconclusive. Treat as unverified and proceed with reporting and safety checks.",
  };
}

function renderVerdictStateCopy(verdict, pendingEnrichment, providerErrors = []) {
  const el = $("verdict-state-copy");
  if (!el) return;

  const copy = verdictStateCopy(verdict, pendingEnrichment, providerErrors);
  el.textContent = copy.text;
  el.className = `verdict-state-copy verdict-state-copy--${copy.tone}`;
}

const ACTION_SCROLL_MAP = {
  "Emergency Playbook": "#emergency-playbook",
  "Generate Reports": "#report-generator",
  "Create Warning Card": "#warning-card",
  "Report It": "#report-generator",
  "Generate Warning Card": "#warning-card",
  "Safety Checklist": "#recovery-checklist",
  "Verify Official Channels": null,
  "Monitor Activity": null,
};

async function onVerdictSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = $("verdict-submit");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoader = submitBtn.querySelector(".btn-loader");

  const type = $("verdict-type").value;
  const value = $("verdict-value").value.trim();
  const chain = $("verdict-chain").value.trim();

  // Loading state
  submitBtn.disabled = true;
  btnText.classList.add("hidden");
  btnLoader.classList.remove("hidden");

  try {
    const payload = await fetchJSON("/api/verdict", {
      method: "POST",
      body: JSON.stringify({ type, value, chain: chain || undefined }),
    });

    const panel = $("verdict-result");
    panel.classList.remove("hidden");

    // Badge
    const badge = $("verdict-badge");
    badge.textContent = payload.verdict;
    badge.className = verdictBadgeClass(payload.verdict);

    // Score bar
    const scoreBar = $("verdict-score-bar");
    scoreBar.style.width = `${Math.min(100, payload.score)}%`;
    setText("verdict-score", `${payload.score} / 100`);

    // Reasons as styled cards
    const reasonsContainer = $("verdict-reasons");
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

    renderVerdictStateCopy(payload.verdict, payload.pendingEnrichment, payload.providerErrors || []);

    // CTA buttons that scroll to relevant sections
    const ctaRow = $("verdict-next-actions");
    ctaRow.innerHTML = "";
    payload.nextActions.forEach((action, i) => {
      const btn = document.createElement("button");
      btn.className = i === 0 ? "cta-btn" : "cta-btn cta-btn--secondary";
      btn.textContent = action;
      const scrollTarget = ACTION_SCROLL_MAP[action];
      if (scrollTarget) {
        btn.addEventListener("click", () => {
          document.querySelector(scrollTarget)?.scrollIntoView({ behavior: "smooth" });
        });
      }
      ctaRow.appendChild(btn);
    });

    const sourceSummary = payload.sources.join(", ") || "none";
    const degraded = payload.pendingEnrichment || (payload.providerErrors || []).length > 0;
    const modeSummary = degraded
      ? "Preliminary result. Live enrichment is still running."
      : "Result based on currently available provider signals.";
    setText("verdict-meta", `Sources: ${sourceSummary}. ${modeSummary}`);

    autoFillWarningForm(payload, value);

    // Scroll result into view
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showToast(error.message, "error");
    setText("verdict-meta", error.message);
    $("verdict-state-copy")?.classList.add("hidden");
  } finally {
    submitBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnLoader.classList.add("hidden");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function autoFillWarningForm(verdictPayload, identifierValue) {
  const warningForm = $("warning-form");
  const headlineByVerdict = {
    HIGH_RISK: "High-risk scam indicator detected",
    UNKNOWN: "Unverified identifier under review",
    LEGIT: "No high-risk signal detected - verify before sending funds",
  };

  warningForm.querySelector("select[name='verdict']").value = verdictPayload.verdict;
  warningForm.querySelector("input[name='headline']").value = headlineByVerdict[verdictPayload.verdict] || headlineByVerdict.UNKNOWN;
  warningForm.querySelector("input[name='identifier']").value = identifierValue;
  warningForm.querySelector("input[name='reasons']").value = verdictPayload.reasons.slice(0, 3).join(" | ");
}

/* ── Playbook ── */

async function loadPlaybook() {
  const payload = await fetchJSON("/api/playbook");
  state.playbook = payload.playbook;
  state.recoveryTasks = payload.recoveryTasks || [];

  setText("killer-line", payload.killerPitch);
  setText("legal-line", payload.playbook.legalLine);

  // Stop the Bleeding - numbered list
  renderPlaybookList("playbook-stop", payload.playbook.stopBleeding);

  // Collect Evidence - numbered list
  renderPlaybookList("playbook-evidence", payload.playbook.collectEvidence);

  // Report Channels - styled cards
  renderReportChannels(payload.playbook.reportChannels);

  // Pre-written script
  const starterText = [
    "I am reporting a suspected scam incident and need urgent containment support.",
    "I can provide transaction references, screenshots, identifiers, and timeline upon request.",
    "Please escalate this case under fraud handling and provide a case/ticket reference.",
  ].join("\n");

  const scriptBox = $("playbook-script");
  if (scriptBox) scriptBox.value = starterText;

  renderRecoveryChecklist(state.recoveryTasks);
}

function renderPlaybookList(id, items) {
  const list = $(id);
  if (!list) return;
  list.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "step-item";
    // Check if item has title/desc structure (if string, treat as desc)
    li.innerHTML = `<span class="step-desc">${escapeHtml(item)}</span>`;
    list.appendChild(li);
  });
}

function renderReportChannels(channels) {
  const container = $("playbook-report");
  if (!container) return;
  container.innerHTML = "";
  channels.forEach((ch) => {
    const card = document.createElement("div");
    card.className = "report-channel";
    card.innerHTML = `
      <span class="channel-type">${escapeHtml(ch.type)}</span>
      <div class="channel-body">
        <p class="channel-target">${escapeHtml(ch.channel)}</p>
        <p class="channel-hint">${escapeHtml(ch.scriptHint)}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ── Recovery Checklist ── */

function renderRecoveryChecklist(tasks) {
  const list = $("recovery-task-list");
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
        taskItem?.classList.add("completed");
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
  const bar = $("recovery-progress-bar");
  if (bar) bar.style.width = `${progress}%`;

  const completedCount = state.completedTaskIds.size;
  const totalCount = state.recoveryTasks.length;

  setText("recovery-progress-label", `${progress}% contained`);
  setText("recovery-progress-count", `${completedCount} / ${totalCount} actions`);
}

/* ── Heatmap ── */

function heatClass(count) {
  if (count >= 10) return "heat-high";
  if (count >= 5) return "heat-medium";
  return "heat-low";
}

function trendDisplay(trend) {
  if (trend === "\u2191") return `<span class="trend-up" title="Increasing">\u2191</span>`;
  if (trend === "\u2193") return `<span class="trend-down" title="Decreasing">\u2193</span>`;
  return `<span class="trend-flat" title="Stable">\u2192</span>`;
}

async function loadHeatmap() {
  const payload = await fetchJSON("/api/heatmap");
  const tbody = $("heatmap-body");
  if (!tbody) return;

  // Sort by count descending for sensible ordering
  const sorted = [...payload.grid].sort((a, b) => b.count - a.count);

  tbody.innerHTML = "";
  sorted.forEach((cell) => {
    const row = document.createElement("tr");
    row.className = heatClass(cell.count);
    row.innerHTML = `
      <td><span class="heatmap-platform">${escapeHtml(cell.platform)}</span></td>
      <td><span class="heatmap-category">${escapeHtml(cell.category)}</span></td>
      <td class="td-count"><span class="heatmap-count">${cell.count}</span></td>
      <td class="td-trend">${trendDisplay(cell.trend)}</td>
    `;
    tbody.appendChild(row);
  });
}

/* ── Report Generator ── */

async function onReportGenerateSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  const body = {
    incidentTitle: form.incidentTitle.value,
    scamType: form.scamType.value,
    occurredAt: form.occurredAt.value,
    channel: form.channel.value,
    suspects: form.suspects.value ? form.suspects.value.split(",").map((v) => v.trim()).filter(Boolean) : [],
    losses: form.losses.value,
    actionsTaken: form.actionsTaken.value ? form.actionsTaken.value.split(",").map((v) => v.trim()).filter(Boolean) : [],
    extraNotes: form.extraNotes.value || undefined,
  };

  try {
    const payload = await fetchJSON("/api/report/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // Show output
    const output = $("report-output");
    output.classList.remove("hidden");

    // Severity badge
    const severityDiv = $("report-severity-badge");
    const sev = payload.severitySuggestion;
    severityDiv.innerHTML = `<span class="severity-badge severity-badge--${sev}">Severity: ${sev.toUpperCase()}</span>`;

    // Fill textareas
    $("report-bank").value = payload.forBank;
    $("report-police").value = payload.forPolice;
    $("report-platform").value = payload.forPlatform;

    setText("report-meta", `Timeline steps: ${payload.timeline.length} | Category: ${payload.category}`);

    showToast("Reports generated. Copy and send.");
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showToast(error.message, "error");
    setText("report-meta", error.message);
  }
}

/* ── Report Tabs ── */

function initReportTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;

      // Update active tab button
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update active panel
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.querySelector(`[data-panel="${tab}"]`)?.classList.add("active");
    });
  });
}

/* ── Warning Card ── */

function setWarningPreviewTone(verdict) {
  const shell = $("warning-preview-shell");
  const status = $("warning-preview-status");
  if (!shell || !status) return;

  shell.classList.remove("warning-preview-shell--high", "warning-preview-shell--legit");
  status.textContent = verdict;

  if (verdict === "HIGH_RISK") {
    shell.classList.add("warning-preview-shell--high");
    return;
  }

  if (verdict === "LEGIT") {
    shell.classList.add("warning-preview-shell--legit");
  }
}

function warningMetaCopy(verdict) {
  if (verdict === "HIGH_RISK") {
    return "High-risk bulletin generated. Prioritize forwarding to affected chats and support channels.";
  }
  if (verdict === "LEGIT") {
    return "Verification bulletin generated. Share to prevent confusion while monitoring new signals.";
  }
  return "Unknown-state bulletin generated. Share as precaution while additional signals are still being verified.";
}

async function onWarningSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  const reasons = form.reasons.value
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 3);

  try {
    const payload = await fetchJSON("/api/warning-card", {
      method: "POST",
      body: JSON.stringify({
        verdict: form.verdict.value,
        headline: form.headline.value,
        identifiers: { target: form.identifier.value },
        reasons,
      }),
    });

    const output = $("warning-output");
    output.classList.remove("hidden");

    const pageLink = $("warning-page-link");
    pageLink.href = payload.warningPageUrl;
    pageLink.textContent = payload.warningPageUrl;

    const openPage = $("open-warning-page");
    if (openPage) openPage.href = payload.warningPageUrl;

    const openImage = $("open-warning-image");
    if (openImage) openImage.href = payload.imageUrl;

    const preview = $("warning-preview");
    preview.src = `${payload.imageUrl}?t=${Date.now()}`;

    const verdict = form.verdict.value;
    setWarningPreviewTone(verdict);
    setText("warning-meta", warningMetaCopy(verdict));

    state.latestWarning = {
      pageUrl: payload.warningPageUrl,
      imageUrl: payload.imageUrl,
      verdict,
      headline: form.headline.value,
    };

    showToast("Warning card generated. Share the link.");
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showToast(error.message, "error");
  }
}

/* ── Copy Button Wiring ── */

function wireCopyButtons() {
  // Playbook script copy
  $("copy-playbook-script")?.addEventListener("click", (e) => {
    e.preventDefault();
    copyFromTextarea("playbook-script", "Report starter");
    flashCopied(e.currentTarget);
  });

  // Report copy buttons (data-copy attribute)
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = btn.dataset.copy;
      const labels = { "report-bank": "Bank report", "report-police": "Police report", "report-platform": "Platform report" };
      copyFromTextarea(targetId, labels[targetId] || "Report");
      flashCopied(btn);
    });
  });

  // Warning URL copy
  $("copy-warning-url")?.addEventListener("click", (e) => {
    e.preventDefault();
    const link = $("warning-page-link");
    if (link?.href) {
      copyText(link.href, "Warning page link");
      flashCopied(e.currentTarget);
    }
  });

  $("share-warning")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!state.latestWarning?.pageUrl) {
      showToast("Generate a warning card first.", "error");
      return;
    }

    const shareText = `${state.latestWarning.headline}\nVerdict: ${state.latestWarning.verdict}\n${state.latestWarning.pageUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "ScamShield MY Warning",
          text: shareText,
          url: state.latestWarning.pageUrl,
        });
        showToast("Share sheet opened");
        return;
      } catch (error) {
        if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
          return;
        }
      }
    }

    copyText(shareText, "Warning summary");
  });

  // Heatmap refresh
  $("refresh-heatmap")?.addEventListener("click", () => {
    loadHeatmap().catch(console.error);
    showToast("Heatmap refreshed");
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

/* ── Smooth Scroll for Nav Pills ── */

function initSmoothScroll() {
  document.querySelectorAll("[data-scroll]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      target?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ── Boot ── */

async function boot() {
  initSmoothScroll();
  initReportTabs();
  wireCopyButtons();

  $("verdict-form")?.addEventListener("submit", onVerdictSubmit);
  $("report-generate-form")?.addEventListener("submit", onReportGenerateSubmit);
  $("warning-form")?.addEventListener("submit", onWarningSubmit);

  const warningVerdictSelect = document.querySelector("#warning-form select[name='verdict']");
  warningVerdictSelect?.addEventListener("change", (event) => {
    const nextVerdict = event.target.value || "UNKNOWN";
    setWarningPreviewTone(nextVerdict);
    setText("warning-meta", warningMetaCopy(nextVerdict));
  });
  setWarningPreviewTone(warningVerdictSelect?.value || "UNKNOWN");
  setText("warning-meta", warningMetaCopy(warningVerdictSelect?.value || "UNKNOWN"));

  await Promise.all([loadPlaybook(), loadHeatmap()]);
}

boot().catch((error) => {
  console.error(error);
  setText("killer-line", "Failed to load. Please refresh the page.");
});
