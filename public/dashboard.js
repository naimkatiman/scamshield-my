/* ── ScamShield MY — Dashboard JS ── */

function $(id) { return document.getElementById(id); }

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

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

/* ── Detect which dashboard page we're on ── */
const isAdmin = location.pathname.includes("admin");

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

        // Gauge arc animation
        const arc = $("dash-gauge-arc");
        if (arc) {
            const circumference = 327; // 2 * PI * 52
            const offset = circumference * (1 - pct);
            arc.style.transition = "stroke-dashoffset 1s ease, stroke 0.5s ease";
            requestAnimationFrame(() => {
                arc.setAttribute("stroke-dashoffset", offset.toString());
                if (pct <= 0.1) arc.setAttribute("stroke", "var(--verdict-high)");
                else if (pct <= 0.33) arc.setAttribute("stroke", "var(--verdict-unknown)");
                else arc.setAttribute("stroke", "var(--verdict-safe)");
            });
        }

        // History
        const history = data.history || [];
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
                    tr.innerHTML = `
            <td><span class="dash-action-badge ${actionClass}">${escapeHtml(item.action)}</span></td>
            <td>${formatDate(item.timestamp)}</td>
            <td>${formatTime(item.timestamp)}</td>
          `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (err) {
        loading?.classList.add("hidden");
        showToast(err.message || "Failed to load dashboard", "error");
    }
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

        // Stats row
        setText("admin-total-users", data.totalUsers ?? 0);
        setText("admin-today-usage", data.todayUsage ?? 0);
        setText("admin-day-label", data.day || new Date().toISOString().slice(0, 10));

        // Scam stats
        const scam = data.scamStats || {};
        setText("admin-total-verdicts", scam.cachedVerdicts ?? 0);
        setText("admin-total-reports", scam.totalReports ?? 0);
        setText("admin-high-risk", scam.openReports ?? 0);
        setText("admin-cached", scam.cachedVerdicts ?? 0);
        setText("admin-warnings", scam.warningPages ?? 0);

        // Top users
        const topUsers = data.topUsers || [];
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

        // Heatmap
        const heatmap = data.heatmap || [];
        const heatBody = $("admin-heatmap-body");
        if (heatBody && heatmap.length > 0) {
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
