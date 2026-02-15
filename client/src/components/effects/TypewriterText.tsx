import { useState, useEffect } from 'react'

interface TypewriterTextProps {
  text: string
  speed?: number
  delay?: number
  className?: string
  onComplete?: () => void
}

export function TypewriterText({ 
  text, 
  speed = 50, 
  delay = 0,
  className = '',
  onComplete 
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (currentIndex >= text.length) {
      if (!isComplete) {
        setIsComplete(true)
        onComplete?.()
      }
      return
    }

    const timer = setTimeout(() => {
      setDisplayText((prev) => prev + text[currentIndex])
      setCurrentIndex((i) => i + 1)
    }, currentIndex === 0 ? delay : speed + Math.random() * 30)

    return () => clearTimeout(timer)
  }, [currentIndex, text, speed, delay, onComplete, isComplete])

  return (
    <span className={className}>
      {displayText}
      {!isComplete && <span className="inline-block animate-pulse ml-1">▋</span>}
    </span>
  )
}
