import { ParticleField3D } from '../effects/ParticleField3D'
import { FloatingElements } from '../effects/FloatingElements'
import { GSAPReveal } from '../animations/GSAPReveal'
import { MagneticButton } from '../animations/MagneticButton'
import { useLenis } from '../../hooks/useLenis'
import { Shield, Zap, Lock, Eye } from 'lucide-react'

export function CreativeShowcase() {
  useLenis({ duration: 1.2, smoothWheel: true })

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      <ParticleField3D count={2000} color="#818cf8" speed={0.4} spread={12} />
      <FloatingElements count={15} />

      <div className="relative z-10 container mx-auto px-4 py-20">
        <GSAPReveal direction="up" delay={0.2} duration={1.2}>
          <div className="text-center mb-20">
            <h1 className="text-7xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              ScamShield Malaysia
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Experience next-generation scam protection with cutting-edge technology
            </p>
          </div>
        </GSAPReveal>

        <GSAPReveal direction="up" delay={0.4} stagger={0.2}>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            <FeatureCard
              icon={<Shield className="w-12 h-12" />}
              title="Real-time Protection"
              description="Advanced AI detection protecting you 24/7"
            />
            <FeatureCard
              icon={<Zap className="w-12 h-12" />}
              title="Lightning Fast"
              description="Instant scam verification in milliseconds"
            />
            <FeatureCard
              icon={<Lock className="w-12 h-12" />}
              title="Secure & Private"
              description="Your data encrypted end-to-end"
            />
            <FeatureCard
              icon={<Eye className="w-12 h-12" />}
              title="Community Driven"
              description="Powered by millions of reports"
            />
          </div>
        </GSAPReveal>

        <GSAPReveal direction="up" delay={0.6}>
          <div className="flex justify-center gap-6">
            <MagneticButton
              strength={0.4}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-semibold text-lg shadow-2xl hover:shadow-indigo-500/50 transition-shadow"
            >
              Get Started
            </MagneticButton>
            <MagneticButton
              strength={0.4}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-full font-semibold text-lg border border-white/20 hover:bg-white/20 transition-colors"
            >
              Learn More
            </MagneticButton>
          </div>
        </GSAPReveal>

        <GSAPReveal direction="up" delay={0.8}>
          <div className="mt-32 p-12 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-white/10">
            <h2 className="text-4xl font-bold text-white mb-6 text-center">
              Technology Stack
            </h2>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <TechBadge name="React 18" />
              <TechBadge name="TypeScript 5" />
              <TechBadge name="Tailwind CSS 4" />
              <TechBadge name="Three.js" />
              <TechBadge name="GSAP" />
              <TechBadge name="Framer Motion" />
              <TechBadge name="Lenis Smooth Scroll" />
              <TechBadge name="WebGL" />
              <TechBadge name="Cloudflare Workers" />
            </div>
          </div>
        </GSAPReveal>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 transition-all duration-300 group">
      <div className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}

function TechBadge({ name }: { name: string }) {
  return (
    <div className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-400/30 text-indigo-300 font-medium">
      {name}
    </div>
  )
}
