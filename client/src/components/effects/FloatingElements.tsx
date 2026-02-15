import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface FloatingElementsProps {
  count?: number
  className?: string
}

export function FloatingElements({ count = 20, className = '' }: FloatingElementsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const elements = containerRef.current.children

    Array.from(elements).forEach((element, i) => {
      const duration = 3 + Math.random() * 2
      const delay = Math.random() * 2
      const xMove = (Math.random() - 0.5) * 100
      const yMove = (Math.random() - 0.5) * 100

      gsap.to(element, {
        x: `+=${xMove}`,
        y: `+=${yMove}`,
        duration,
        delay,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })

      gsap.to(element, {
        rotation: 360,
        duration: duration * 2,
        delay,
        repeat: -1,
        ease: 'none',
      })
    })
  }, [count])

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${20 + Math.random() * 60}px`,
            height: `${20 + Math.random() * 60}px`,
          }}
        />
      ))}
    </div>
  )
}
