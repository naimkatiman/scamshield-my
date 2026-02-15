import { useEffect, useRef, ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface GSAPRevealProps {
  children: ReactNode
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade'
  delay?: number
  duration?: number
  stagger?: number
  className?: string
}

export function GSAPReveal({ 
  children, 
  direction = 'up',
  delay = 0,
  duration = 1,
  stagger = 0,
  className = ''
}: GSAPRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!elementRef.current) return

    const element = elementRef.current
    const children = element.children

    let fromVars: gsap.TweenVars = { opacity: 0 }
    
    switch (direction) {
      case 'up':
        fromVars.y = 60
        break
      case 'down':
        fromVars.y = -60
        break
      case 'left':
        fromVars.x = 60
        break
      case 'right':
        fromVars.x = -60
        break
      case 'fade':
        break
    }

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: element,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      }
    })

    if (children.length > 1 && stagger > 0) {
      timeline.fromTo(
        children,
        fromVars,
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration,
          delay,
          stagger,
          ease: 'power3.out'
        }
      )
    } else {
      timeline.fromTo(
        element,
        fromVars,
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration,
          delay,
          ease: 'power3.out'
        }
      )
    }

    return () => {
      timeline.kill()
    }
  }, [direction, delay, duration, stagger])

  return (
    <div ref={elementRef} className={className}>
      {children}
    </div>
  )
}
