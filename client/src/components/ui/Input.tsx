import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, badge, ...props }, ref) => (
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-white/10 bg-noir-800/60 px-4 py-3.5 font-mono text-sm text-slate-200',
          'placeholder:text-slate-600 focus:border-cyber/40 focus:outline-none focus:ring-1 focus:ring-cyber/20',
          'backdrop-blur-sm transition-all duration-200',
          icon && 'pl-11',
          badge && 'pr-28',
          className
        )}
        {...props}
      />
      {badge && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {badge}
        </div>
      )}
    </div>
  )
)
Input.displayName = 'Input'
