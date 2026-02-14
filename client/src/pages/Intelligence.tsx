import { IntelHeader } from '../components/intelligence/IntelHeader'
import { StatsRow } from '../components/intelligence/StatsRow'
import { ThreatTrendChart } from '../components/intelligence/ThreatTrendChart'
import { LiveFeed } from '../components/intelligence/LiveFeed'
import { CategoryHeatmap } from '../components/intelligence/CategoryHeatmap'
import { TopThreats } from '../components/intelligence/TopThreats'
import { RecoveryStats } from '../components/intelligence/RecoveryStats'

export function Intelligence() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <IntelHeader />
      <StatsRow />

      {/* Trend + Live Feed */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <ThreatTrendChart />
        <LiveFeed />
      </div>

      {/* Heatmap + Recovery */}
      <div className="grid lg:grid-cols-2 gap-6">
        <CategoryHeatmap />
        <RecoveryStats />
      </div>

      {/* Threats */}
      <TopThreats />
    </div>
  )
}
