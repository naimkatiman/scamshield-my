/* ── ScamShield MY — Dashboard JS ── */

function $(id) { return document.getElementById(id); }

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = String(text);
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrencyFromCents(cents, currency = "USD") {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-MY", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function appendCell(row, text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = String(text);
  row.appendChild(cell);
  return cell;
}

function createPill(text, className) {
  const pill = document.createElement("span");
  pill.className = className;
  pill.textContent = text;
  return pill;
}

/* ── Detect which dashboard page we're on ── */
const isAdmin = location.pathname.includes("admin");

function renderClientGamification(data) {
  const gamification = data.gamification || {};
  setText("dash-points", gamification.totalPoints ?? 0);
  setText("dash-streak", `${gamification.currentStreakDays ?? 0}d`);
  setText("dash-reports-count", gamification.reportsSubmitted ?? 0);
  setText("dash-premium-status", gamification.premiumUnlocked ? "Unlocked" : "Locked");

  const premiumCopy = $("dash-premium-copy");
  if (premiumCopy) {
    const reason = gamification.premium?.reasons?.[0] || "Premium unlocks at 500 points or a 7-day streak.";
    premiumCopy.textContent = reason;
  }

  const premiumFeatures = $("dash-premium-features");
  if (premiumFeatures) {
    premiumFeatures.innerHTML = "";
    const features = safeArray(gamification.premiumFeatures);
    features.forEach((feature) => {
      const span = document.createElement("span");
      span.className = `dash-pill ${gamification.premiumUnlocked ? "dash-pill--on" : "dash-pill--off"}`;
      span.textContent = feature;
      premiumFeatures.appendChild(span);
    });
  }

  const achievementList = $("dash-achievements-list");
  const achievementEmpty = $("dash-achievements-empty");
  const achievements = safeArray(gamification.achievements);
  if (achievementList) {
    achievementList.innerHTML = "";
    if (achievements.length === 0) {
      achievementEmpty?.classList.remove("hidden");
    } else {
      achievementEmpty?.classList.add("hidden");
      achievements.forEach((achievement) => {
        const li = document.createElement("li");
        li.className = "dash-achievement-item";
        const title = document.createElement("div");
        title.className = "dash-achievement-title";
        title.textContent = achievement.title || achievement.code || "";
        const desc = document.createElement("div");
        desc.className = "dash-achievement-desc";
        desc.textContent = achievement.description || "";
        const date = document.createElement("div");
        date.className = "dash-achievement-date";
        date.textContent = formatDate(achievement.awardedAt);
        li.append(title, desc, date);
        achievementList.appendChild(li);
      });
    }
  }

  const referrals = data.referrals || {};
  setText("dash-referral-code", referrals.referralCode || "—");
  setText("dash-referral-count", referrals.totalReferrals ?? 0);
  setText("dash-referral-points", referrals.rewardedPoints ?? 0);

  const competition = data.competition || {};
  setText("dash-competition-name", competition.competition?.name || "No monthly competition configured");
  setText(
    "dash-competition-subtitle",
    competition.competition
      ? `${competition.competition.monthKey} • ${competition.competition.status} • pool ${formatCurrencyFromCents(competition.competition.prizePoolCents, competition.competition.currency)}`
      : "No active monthly competition",
  );

  const competitionBody = $("dash-competition-body");
  if (competitionBody) {
    competitionBody.innerHTML = "";
    const rows = safeArray(competition.leaderboard);
    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.className = "dash-empty-cell";
      td.textContent = "No entries yet.";
      tr.appendChild(td);
      competitionBody.appendChild(tr);
    } else {
      rows.forEach((entry) => {
        const tr = document.createElement("tr");
        appendCell(tr, entry.rank);
        appendCell(tr, entry.displayName || "anonymous");
        const countCell = appendCell(tr, "", "td-count");
        countCell.appendChild(createPill(String(Number(entry.points || 0)), "dash-count-badge"));
        competitionBody.appendChild(tr);
      });
    }
  }

  const bountiesBody = $("dash-bounties-body");
  if (bountiesBody) {
    bountiesBody.innerHTML = "";
    const bounties = safeArray(data.bounties);
    if (bounties.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.className = "dash-empty-cell";
      td.textContent = "No open bounties.";
      tr.appendChild(td);
      bountiesBody.appendChild(tr);
    } else {
      bounties.forEach((bounty) => {
        const tr = document.createElement("tr");
        appendCell(tr, bounty.targetIdentifier || bounty.title || "-");
        const priorityCell = appendCell(tr, "");
        const normalizedPriority = String(bounty.priority || "medium").toLowerCase().replace(/[^a-z]/g, "");
        priorityCell.appendChild(createPill(String(bounty.priority || "medium"), `dash-pill dash-pill--${normalizedPriority}`));
        const rewardCell = appendCell(tr, "", "td-count");
        rewardCell.appendChild(createPill(`${Number(bounty.rewardPoints || 0)} pts`, "dash-count-badge"));
        bountiesBody.appendChild(tr);
      });
    }
  }

  const prizesBody = $("dash-prizes-body");
  if (prizesBody) {
    prizesBody.innerHTML = "";
    const prizes = safeArray(data.prizes);
    if (prizes.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "dash-empty-cell";
      td.textContent = "No cash prize records yet.";
      tr.appendChild(td);
      prizesBody.appendChild(tr);
    } else {
      prizes.forEach((prize) => {
        const tr = document.createElement("tr");
        const statusCell = appendCell(tr, "");
        const normalizedStatus = String(prize.status || "pending").toLowerCase().replace(/[^a-z]/g, "");
        statusCell.appendChild(createPill(String(prize.status || "pending"), `dash-pill dash-pill--${normalizedStatus}`));
        appendCell(tr, formatCurrencyFromCents(prize.amountCents || 0, prize.currency || "USD"));
        appendCell(tr, prize.partnerName || "-");
        appendCell(tr, formatDate(prize.createdAt));
        prizesBody.appendChild(tr);
      });
    }
  }
}

/* ── Client Dashboard ── */
async function loadClientDashboard() {
  const loading = $("dash-loading");
  const content = $("dash-content");
  const authRequired = $("dash-auth-required");

  try {
    const res = await fetch("/api/dashboard/client");
    if (res.status === 401) {
      loading?.classList.add("hidden");
      authRequired?.classList.remove("hidden");
      return;
    }
    if (!res.ok) throw new Error("Failed to load dashboard");

    const data = await res.json();
    loading?.classList.add("hidden");
    content?.classList.remove("hidden");

    // Account
    const initial = (data.email || "?")[0].toUpperCase();
    setText("dash-avatar", initial);
    setText("dash-email", data.email || "Unknown");
    const roleBadge = $("dash-role");
    if (roleBadge) {
      roleBadge.textContent = data.role || "user";
      if (data.role === "admin") roleBadge.classList.add("dash-role-badge--admin");
    }

    // Quota
    const quota = data.quota || {};
    const used = quota.used || 0;
    const limit = quota.limit || 0;
    const remaining = Math.max(0, limit - used);
    const pct = limit > 0 ? (remaining / limit) : 0;

    setText("dash-stat-used", used);
    setText("dash-stat-limit", limit);
    setText("dash-stat-remaining", remaining);
    setText("dash-gauge-remaining", remaining);
    setText("dash-quota-day", quota.day || new Date().toISOString().slice(0, 10));

    const arc = $("dash-gauge-arc");
    if (arc) {
      const circumference = 327;
      const offset = circumference * (1 - pct);
      arc.style.transition = "stroke-dashoffset 1s ease, stroke 0.5s ease";
      requestAnimationFrame(() => {
        arc.setAttribute("stroke-dashoffset", offset.toString());
        if (pct <= 0.1) arc.setAttribute("stroke", "var(--verdict-high)");
        else if (pct <= 0.33) arc.setAttribute("stroke", "var(--verdict-unknown)");
        else arc.setAttribute("stroke", "var(--verdict-safe)");
      });
    }

    renderClientGamification(data);

    const history = safeArray(data.history);
    const tbody = $("dash-history-body");
    const emptyMsg = $("dash-history-empty");

    if (history.length === 0) {
      emptyMsg?.classList.remove("hidden");
      $("dash-history-table")?.classList.add("hidden");
    } else {
      emptyMsg?.classList.add("hidden");
      if (tbody) {
        tbody.innerHTML = "";
        history.forEach((item) => {
          const tr = document.createElement("tr");
          const actionClass = item.action === "verdict" ? "action-verdict" : "action-chat";
          const actionCell = appendCell(tr, "");
          const actionBadge = createPill(String(item.action || "-"), `dash-action-badge ${actionClass}`);
          actionCell.appendChild(actionBadge);
          appendCell(tr, formatDate(item.timestamp));
          appendCell(tr, formatTime(item.timestamp));
          tbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    loading?.classList.add("hidden");
    showToast(err.message || "Failed to load dashboard", "error");
  }
}

function renderAdminLeaderboard(rows) {
  const body = $("admin-leaderboard-body");
  if (!body) return;
  body.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="dash-empty-cell">No leaderboard entries yet.</td>`;
    body.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.rank}</td>
      <td>${escapeHtml(row.displayName || "anonymous")}</td>
      <td class="td-count"><span class="dash-count-badge">${Number(row.totalPoints || 0)}</span></td>
      <td class="td-count">${Number(row.currentStreakDays || 0)}d</td>
    `;
    body.appendChild(tr);
  });
}

function renderAdminBounties(rows) {
  const body = $("admin-bounties-body");
  if (!body) return;
  body.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="dash-empty-cell">No bounties available.</td>`;
    body.appendChild(tr);
    return;
  }

  rows.forEach((bounty) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(bounty.targetIdentifier || bounty.title || "-")}</td>
      <td><span class="dash-pill dash-pill--${escapeHtml((bounty.status || "open").toLowerCase())}">${escapeHtml(bounty.status || "open")}</span></td>
      <td><span class="dash-pill dash-pill--${escapeHtml((bounty.priority || "medium").toLowerCase())}">${escapeHtml(bounty.priority || "medium")}</span></td>
      <td class="td-count"><span class="dash-count-badge">${Number(bounty.rewardPoints || 0)} pts</span></td>
    `;
    body.appendChild(tr);
  });
}

function renderAdminPrizes(rows) {
  const body = $("admin-prizes-body");
  if (!body) return;
  body.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="dash-empty-cell">No cash prize entries.</td>`;
    body.appendChild(tr);
    return;
  }

  rows.forEach((prize) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(prize.displayName || "anonymous")}</td>
      <td><span class="dash-pill dash-pill--${escapeHtml((prize.status || "pending").toLowerCase())}">${escapeHtml(prize.status || "pending")}</span></td>
      <td class="td-count">${formatCurrencyFromCents(prize.amountCents || 0, prize.currency || "USD")}</td>
      <td>${escapeHtml(prize.partnerName || "-")}</td>
    `;
    body.appendChild(tr);
  });
}

function renderAdminPartnerships(rows) {
  const body = $("admin-partnerships-body");
  if (!body) return;
  body.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="dash-empty-cell">No brand partnerships added yet.</td>`;
    body.appendChild(tr);
    return;
  }

  rows.forEach((partnership) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(partnership.brandName || "-")}</td>
      <td>${escapeHtml(partnership.prizeType || "-")}</td>
      <td><span class="dash-pill dash-pill--${escapeHtml((partnership.status || "pipeline").toLowerCase())}">${escapeHtml(partnership.status || "pipeline")}</span></td>
      <td class="td-count">${formatCurrencyFromCents(partnership.contributionCents || 0, partnership.currency || "USD")}</td>
    `;
    body.appendChild(tr);
  });
}

/* ── Admin Dashboard ── */
async function loadAdminDashboard() {
  const loading = $("dash-loading");
  const content = $("dash-content");
  const denied = $("dash-denied");

  try {
    const res = await fetch("/api/dashboard/admin");
    if (res.status === 401 || res.status === 403) {
      loading?.classList.add("hidden");
      denied?.classList.remove("hidden");
      return;
    }
    if (!res.ok) throw new Error("Failed to load admin dashboard");

    const data = await res.json();
    loading?.classList.add("hidden");
    content?.classList.remove("hidden");

    setText("admin-total-users", data.totalUsers ?? 0);
    setText("admin-today-usage", data.todayUsage ?? 0);
    setText("admin-day-label", data.day || new Date().toISOString().slice(0, 10));

    const scam = data.scamStats || {};
    setText("admin-total-verdicts", scam.cachedVerdicts ?? 0);
    setText("admin-total-reports", scam.totalReports ?? 0);
    setText("admin-high-risk", scam.openReports ?? 0);
    setText("admin-cached", scam.cachedVerdicts ?? 0);
    setText("admin-warnings", scam.warningPages ?? 0);

    const gamification = data.gamification || {};
    setText("admin-total-points", gamification.totalPointsAwarded ?? 0);
    setText("admin-premium-users", gamification.premiumUsers ?? 0);
    setText("admin-open-bounties", gamification.openBounties ?? 0);
    setText("admin-pending-prizes", gamification.pendingCashPrizes ?? 0);

    const topUsers = safeArray(data.topUsers);
    const topBody = $("admin-top-body");
    const topEmpty = $("admin-top-empty");

    if (topUsers.length === 0) {
      topEmpty?.classList.remove("hidden");
      $("admin-top-table")?.classList.add("hidden");
    } else {
      topEmpty?.classList.add("hidden");
      if (topBody) {
        topBody.innerHTML = "";
        topUsers.forEach((user, i) => {
          const tr = document.createElement("tr");
          const medal = i === 0 ? "&#x1F947;" : i === 1 ? "&#x1F948;" : i === 2 ? "&#x1F949;" : `${i + 1}`;
          tr.innerHTML = `
            <td class="td-rank">${medal}</td>
            <td>${escapeHtml(user.email || user.ip || "anonymous")}</td>
            <td class="td-count"><span class="dash-count-badge">${user.usage_count}</span></td>
          `;
          topBody.appendChild(tr);
        });
      }
    }

    const heatmap = safeArray(data.heatmap);
    const heatBody = $("admin-heatmap-body");
    if (heatBody) {
      if (heatmap.length === 0) {
        heatBody.innerHTML = `<tr><td colspan="4" class="dash-empty-cell">No heatmap data available.</td></tr>`;
      } else {
        const sorted = [...heatmap].sort((a, b) => b.count - a.count);
        heatBody.innerHTML = "";
        sorted.forEach((cell) => {
          const row = document.createElement("tr");
          const heatLevel = cell.count >= 10 ? "heat-high" : cell.count >= 5 ? "heat-medium" : "heat-low";
          row.className = heatLevel;

          const trendHtml = cell.trend === "↑"
            ? '<span class="trend-up" title="Increasing">↑</span>'
            : cell.trend === "↓"
              ? '<span class="trend-down" title="Decreasing">↓</span>'
              : '<span class="trend-flat" title="Stable">→</span>';

          row.innerHTML = `
            <td><span class="heatmap-platform">${escapeHtml(cell.platform)}</span></td>
            <td><span class="heatmap-category">${escapeHtml(cell.category)}</span></td>
            <td class="td-count"><span class="heatmap-count">${cell.count}</span></td>
            <td class="td-trend">${trendHtml}</td>
          `;
          heatBody.appendChild(row);
        });
      }
    }

    renderAdminLeaderboard(safeArray(gamification.leaderboard));
    renderAdminBounties(safeArray(data.bounties));
    renderAdminPrizes(safeArray(gamification.recentCashPrizes));
    renderAdminPartnerships(safeArray(data.partnerships));

  } catch (err) {
    loading?.classList.add("hidden");
    showToast(err.message || "Failed to load admin dashboard", "error");
  }
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  if (isAdmin) {
    loadAdminDashboard();
  } else {
    loadClientDashboard();
  }
});
