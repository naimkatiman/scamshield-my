import { useRelativeClock } from '../hooks/useAnimatedCounter'

const THREAT_LEVEL = 'ELEVATED' as const
const THREAT_COLOR = {
  CRITICAL: 'text-threat-critical animate-threat-pulse',
  ELEVATED: 'text-threat-high',
  GUARDED: 'text-threat-medium',
  LOW: 'text-safe',
}

export default function Header() {
  const clock = useRelativeClock()

  return (
    <header className="relative border-b border-white/[0.06] bg-noir-900/80 backdrop-blur-xl">
      <div className="scan-line" />

      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Shield icon */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-cyber/20 bg-cyber/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyber-bright">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-noir-900 bg-safe" />
            </div>

            <div>
              <h1 className="font-display text-lg font-bold tracking-wide text-slate-100">
                SCAM<span className="text-cyber-bright">SHIELD</span>
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
                Intelligence Center
              </p>
            </div>
          </div>

          <div className="ml-4 hidden h-8 w-px bg-white/[0.06] md:block" />

          {/* Threat Level */}
          <div className="hidden items-center gap-3 md:flex">
            <span className="data-label">Threat Level</span>
            <span className={`font-display text-sm font-bold tracking-wider ${THREAT_COLOR[THREAT_LEVEL]}`}>
              {THREAT_LEVEL}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-3 w-1.5 rounded-sm ${
                    i <= 3
                      ? 'bg-threat-high shadow-[0_0_6px_rgba(249,115,22,0.4)]'
                      : 'bg-white/[0.08]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-6">
          {/* Connection Status */}
          <div className="hidden items-center gap-2 lg:flex">
            <span className="live-dot" />
            <span className="font-mono text-xs text-safe">ONLINE</span>
          </div>

          <div className="hidden h-8 w-px bg-white/[0.06] lg:block" />

          {/* Region */}
          <div className="hidden items-center gap-2 lg:flex">
            <span className="font-mono text-xs text-slate-500">REGION</span>
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-xs text-slate-300">
              MY-KUL
            </span>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">MYT</span>
            <span className="font-mono text-sm tabular-nums text-cyber-bright text-glow-cyan">
              {clock}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber/30 to-transparent" />
    </header>
  )
}
