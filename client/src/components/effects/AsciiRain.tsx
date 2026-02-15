import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  speed: number
  char: string
  opacity: number
}

export function AsciiRain() {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const frameRef = useRef<number>()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chars = ['█', '▓', '▒', '░', '▄', '▀', '■', '□', '▪', '▫', '0', '1']
    const particleCount = 40

    // Initialize particles
    const initParticles = () => {
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight - window.innerHeight,
        speed: 1 + Math.random() * 3,
        char: chars[Math.floor(Math.random() * chars.length)],
        opacity: 0.1 + Math.random() * 0.3,
      }))

      // Create DOM elements
      container.innerHTML = particlesRef.current
        .map((_, i) => `<span class="ascii-particle" data-idx="${i}"></span>`)
        .join('')
    }

    // Animation loop
    const animate = () => {
      particlesRef.current.forEach((particle, i) => {
        particle.y += particle.speed

        if (particle.y > window.innerHeight) {
          particle.y = -20
          particle.x = Math.random() * window.innerWidth
          particle.char = chars[Math.floor(Math.random() * chars.length)]
        }

        const el = container.querySelector(`[data-idx="${i}"]`) as HTMLElement
        if (el) {
          el.textContent = particle.char
          el.style.left = `${particle.x}px`
          el.style.top = `${particle.y}px`
          el.style.opacity = `${particle.opacity}`
        }
      })

      frameRef.current = requestAnimationFrame(animate)
    }

    initParticles()
    animate()

    const handleResize = () => {
      initParticles()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.03]"
      aria-hidden="true"
    />
  )
}
