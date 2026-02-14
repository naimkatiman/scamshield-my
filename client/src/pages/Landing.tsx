import { HeroSection } from '../components/landing/HeroSection'
import { StatsPreview } from '../components/landing/StatsPreview'
import { FeatureCards } from '../components/landing/FeatureCards'

export function Landing() {
  return (
    <div className="pb-16">
      <HeroSection />
      <StatsPreview />
      <FeatureCards />
    </div>
  )
}
