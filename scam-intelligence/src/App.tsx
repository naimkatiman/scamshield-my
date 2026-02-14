import Header from './components/Header'
import StatsRow from './components/StatsRow'
import ThreatTrendChart from './components/ThreatTrendChart'
import LiveFeed from './components/LiveFeed'
import CategoryHeatmap from './components/CategoryHeatmap'
import TopThreats from './components/TopThreats'
import RecoveryStats from './components/RecoveryStats'

export default function App() {
  return (
    <div className="relative min-h-screen bg-noir-950">
      {/* Background effects */}
      <div className="grid-bg fixed inset-0 pointer-events-none" />
      <div className="noise-overlay" />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyber/[0.03] blur-[120px]" />
        <div className="absolute -right-20 top-[40%] h-[400px] w-[400px] rounded-full bg-threat-critical/[0.02] blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[600px] rounded-full bg-cyber/[0.02] blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Header />

        <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
          {/* Stats row */}
          <section className="mb-6">
            <StatsRow />
          </section>

          {/* Main grid: Trend chart + Live feed */}
          <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_380px]">
            <ThreatTrendChart />
            <LiveFeed />
          </section>

          {/* Second row: Heatmap + Recovery */}
          <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <CategoryHeatmap />
            <RecoveryStats />
          </section>

          {/* Third row: Threat campaigns (full width) */}
          <section className="mb-6">
            <TopThreats />
          </section>

          {/* Footer */}
          <footer className="border-t border-white/[0.04] py-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
              ScamShield MY Intelligence Center — Powered by Cloudflare Workers
            </p>
            <p className="mt-1 font-mono text-[9px] text-slate-700">
              Data refreshed every 30 seconds — All times in MYT (UTC+8)
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
