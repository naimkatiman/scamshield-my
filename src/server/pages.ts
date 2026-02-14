import type { CommunityReportListItem, DashboardStats } from "../db/repository";
import type { HeatmapCell } from "../types";

type ActivePage = "dashboard" | "reports";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function trendLabel(trend: HeatmapCell["trend"]): string {
  if (trend === "↑") {
    return "Rising";
  }
  if (trend === "↓") {
    return "Cooling";
  }
  return "Stable";
}

function renderShell(
  title: string,
  description: string,
  appName: string,
  region: string,
  active: ActivePage,
  content: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    :root {
      --bg: #f5f7fb;
      --card: #ffffff;
      --text: #10233f;
      --muted: #5b6d8a;
      --border: #dbe4f3;
      --accent: #005f73;
      --accent-soft: #d8f0f5;
      --danger: #b42318;
      --warn: #b54708;
      --ok: #10754f;
      --shadow: 0 8px 22px rgba(16, 35, 63, 0.08);
      --radius: 12px;
      --font: "DM Sans", "Segoe UI", sans-serif;
      --mono: "Chakra Petch", "Courier New", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      color: var(--text);
      background: radial-gradient(circle at 15% 15%, #eef7ff 0%, var(--bg) 50%, #eef3ff 100%);
      min-height: 100vh;
    }
    .shell {
      width: min(1100px, 100% - 2rem);
      margin: 2rem auto;
      display: grid;
      gap: 1rem;
    }
    .topbar {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1rem 1.2rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .brand {
      display: grid;
      gap: 0.1rem;
    }
    .brand h1 {
      margin: 0;
      font-size: 1.1rem;
      font-family: var(--mono);
      letter-spacing: 0.03em;
    }
    .brand p {
      margin: 0;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .nav a {
      text-decoration: none;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.45rem 0.75rem;
      color: var(--text);
      font-size: 0.82rem;
      font-weight: 600;
      background: #fff;
    }
    .nav a[data-active="true"] {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-soft);
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1.2rem;
    }
    .meta {
      margin: 0 0 0.9rem;
      color: var(--muted);
      font-size: 0.84rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .kpi {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.85rem 0.9rem;
      background: linear-gradient(180deg, #fff 0%, #f7fbff 100%);
    }
    .kpi-label {
      margin: 0;
      font-size: 0.76rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .kpi-value {
      margin: 0.25rem 0 0;
      font-size: 1.5rem;
      line-height: 1;
      font-family: var(--mono);
      color: var(--accent);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 680px;
    }
    th, td {
      text-align: left;
      padding: 0.7rem 0.75rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.85rem;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.73rem;
    }
    .table-shell {
      overflow: auto;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      border: 1px solid transparent;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .badge-high { background: #ffebe8; border-color: #fecdc7; color: var(--danger); }
    .badge-medium { background: #fff6e8; border-color: #ffe0b2; color: var(--warn); }
    .badge-low { background: #ecfdf3; border-color: #c6f2da; color: var(--ok); }
    .badge-open { background: #edf5ff; border-color: #cfe3ff; color: #2457a7; }
    .badge-closed { background: #f5f5f6; border-color: #e2e2e5; color: #5f6677; }
    .trend {
      font-size: 0.76rem;
      font-weight: 700;
      border-radius: 999px;
      padding: 0.2rem 0.5rem;
      background: #f4f6fb;
      border: 1px solid #dde4f3;
      color: #46556f;
    }
    .empty {
      margin: 0;
      color: var(--muted);
      font-size: 0.88rem;
      padding: 0.7rem;
      border: 1px dashed var(--border);
      border-radius: 8px;
      background: #fafcff;
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 600px) {
      .shell { width: min(1100px, 100% - 1rem); margin: 1rem auto; }
      .grid { grid-template-columns: 1fr; }
      .topbar, .panel { padding: 1rem; }
    }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <h1>${escapeHtml(appName)} Server Console</h1>
        <p>Region: ${escapeHtml(region)} | Edge runtime pages rendered by Workers</p>
      </div>
      <nav class="nav">
        <a href="/app">Response App</a>
        <a href="/dashboard" data-active="${active === "dashboard" ? "true" : "false"}">Dashboard</a>
        <a href="/reports" data-active="${active === "reports" ? "true" : "false"}">Reports</a>
        <a href="/api/health">API Health</a>
      </nav>
    </header>
    ${content}
  </div>
</body>
</html>`;
}

function severityBadge(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "high") {
    return "badge badge-high";
  }
  if (normalized === "medium") {
    return "badge badge-medium";
  }
  return "badge badge-low";
}

function statusBadge(status: string): string {
  if (status.toLowerCase() === "closed") {
    return "badge badge-closed";
  }
  return "badge badge-open";
}

export function renderDashboardPage(
  appName: string,
  region: string,
  stats: DashboardStats,
  heatmap: HeatmapCell[],
): string {
  const rows = heatmap
    .slice(0, 10)
    .map(
      (cell) => `<tr>
        <td>${escapeHtml(cell.platform)}</td>
        <td>${escapeHtml(cell.category)}</td>
        <td>${formatCount(cell.count)}</td>
        <td><span class="trend">${escapeHtml(trendLabel(cell.trend))}</span></td>
      </tr>`,
    )
    .join("");

  const table = rows
    ? `<div class="table-shell"><table>
         <thead>
           <tr>
             <th>Platform</th>
             <th>Category</th>
             <th>Reports (7d)</th>
             <th>Trend</th>
           </tr>
         </thead>
         <tbody>${rows}</tbody>
       </table></div>`
    : `<p class="empty">No heatmap data yet. Submit reports in the app to populate this view.</p>`;

  const content = `<section class="panel">
      <p class="meta">Operational dashboard for live report volume and containment activity.</p>
      <div class="grid">
        <article class="kpi">
          <p class="kpi-label">Total Reports</p>
          <p class="kpi-value">${formatCount(stats.totalReports)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Open Cases</p>
          <p class="kpi-value">${formatCount(stats.openReports)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Warning Pages</p>
          <p class="kpi-value">${formatCount(stats.warningPages)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Cached Verdicts</p>
          <p class="kpi-value">${formatCount(stats.cachedVerdicts)}</p>
        </article>
      </div>
    </section>
    <section class="panel">
      <p class="meta">Top platform/category combinations over the last 7 days.</p>
      ${table}
    </section>`;

  return renderShell(
    `${appName} Dashboard`,
    "Live scam operation metrics rendered from the server.",
    appName,
    region,
    "dashboard",
    content,
  );
}

export function renderReportsPage(
  appName: string,
  region: string,
  stats: DashboardStats,
  reports: CommunityReportListItem[],
): string {
  const rows = reports
    .map(
      (report) => `<tr>
        <td>#${report.id}</td>
        <td>${escapeHtml(report.createdAt)}</td>
        <td>${escapeHtml(report.platform)}</td>
        <td>${escapeHtml(report.category)}</td>
        <td><span class="${severityBadge(report.severity)}">${escapeHtml(report.severity)}</span></td>
        <td><span class="${statusBadge(report.status)}">${escapeHtml(report.status)}</span></td>
        <td>${escapeHtml(truncate(report.narrativePreview, 100))}</td>
      </tr>`,
    )
    .join("");

  const table = rows
    ? `<div class="table-shell"><table>
         <thead>
           <tr>
             <th>ID</th>
             <th>Created</th>
             <th>Platform</th>
             <th>Category</th>
             <th>Severity</th>
             <th>Status</th>
             <th>Narrative Preview</th>
           </tr>
         </thead>
         <tbody>${rows}</tbody>
       </table></div>`
    : `<p class="empty">No community reports captured yet. Use the Response App to create one.</p>`;

  const content = `<section class="panel">
      <p class="meta">Recent reports list from D1, useful for triage and follow-up.</p>
      <div class="grid">
        <article class="kpi">
          <p class="kpi-label">Total Reports</p>
          <p class="kpi-value">${formatCount(stats.totalReports)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Open Cases</p>
          <p class="kpi-value">${formatCount(stats.openReports)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Warning Pages</p>
          <p class="kpi-value">${formatCount(stats.warningPages)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Cached Verdicts</p>
          <p class="kpi-value">${formatCount(stats.cachedVerdicts)}</p>
        </article>
      </div>
    </section>
    <section class="panel">
      <p class="meta">Most recent 25 submissions from the incident intake stream.</p>
      ${table}
    </section>`;

  return renderShell(
    `${appName} Reports`,
    "Server-rendered reports list backed by Cloudflare D1.",
    appName,
    region,
    "reports",
    content,
  );
}
