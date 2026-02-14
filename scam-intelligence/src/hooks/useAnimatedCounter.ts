import { useState, useEffect, useRef } from 'react'

export function useAnimatedCounter(
  target: number,
  duration: number = 1500,
  decimals: number = 0
): number {
  const [current, setCurrent] = useState(0)
  const startTime = useRef<number | null>(null)
  const rafId = useRef<number>(0)

  useEffect(() => {
    startTime.current = null

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const elapsed = timestamp - startTime.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = eased * target

      setCurrent(Number(value.toFixed(decimals)))

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate)
      }
    }

    rafId.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(rafId.current)
  }, [target, duration, decimals])

  return current
}

export function useRelativeClock(): string {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  )

  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('en-MY', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}
