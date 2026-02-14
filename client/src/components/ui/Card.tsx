import { type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glow' | 'threat' | 'safe'
  hover?: boolean
  children: ReactNode
}

const cardVariants = {
  default: 'glass-card',
  glow: 'glass-card-glow',
  threat: 'glass-card-threat',
  safe: 'glass-card-safe',
}

export function Card({ variant = 'default', hover = false, className, children, ...props }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={cn(cardVariants[variant], 'p-5', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
