import { useEffect } from 'react'
import Lenis from 'lenis'

interface LenisOptions {
  duration?: number
  easing?: (t: number) => number
  smoothWheel?: boolean
}

export function useLenis(options: LenisOptions = {}) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: options.duration || 1.2,
      easing: options.easing || ((t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))),
      smoothWheel: options.smoothWheel ?? true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [options.duration, options.easing, options.smoothWheel])
}
