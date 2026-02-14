import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'danger' | 'safe'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

const variants = {
  primary: 'bg-cyber text-noir-950 hover:bg-cyber-bright font-semibold shadow-lg shadow-cyber/20',
  ghost: 'bg-white/[0.04] border border-white/10 text-slate-200 hover:bg-white/[0.08] hover:border-white/20',
  danger: 'bg-threat-critical/10 border border-threat-critical/30 text-threat-critical hover:bg-threat-critical/20',
  safe: 'bg-safe/10 border border-safe/30 text-safe hover:bg-safe/20',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
}

export function Button({ className, variant = 'ghost', size = 'md', children, disabled, type = 'button', onClick }: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center font-mono tracking-wide transition-all duration-200',
        variants[variant],
        sizes[size],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
