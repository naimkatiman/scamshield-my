export function Background() {
  return (
    <>
      {/* Animated grid */}
      <div className="grid-bg fixed inset-0 z-0" />

      {/* Noise texture */}
      <div className="noise-overlay" />

      {/* Ambient glow blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-cyber/[0.03] blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-[400px] w-[400px] rounded-full bg-threat-critical/[0.02] blur-[100px]" />
        <div className="absolute -bottom-20 left-1/3 h-[350px] w-[350px] rounded-full bg-cyber/[0.02] blur-[100px]" />
      </div>
    </>
  )
}
