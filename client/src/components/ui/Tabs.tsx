import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab?: string
  onChange?: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  const [active, setActive] = useState(activeTab ?? tabs[0]?.id)
  const current = activeTab ?? active

  const handleClick = (id: string) => {
    setActive(id)
    onChange?.(id)
  }

  return (
    <div className={cn('flex gap-1 rounded-lg bg-white/[0.03] p-1', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleClick(tab.id)}
          className={cn(
            'relative flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors',
            current === tab.id ? 'text-cyber' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {current === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 rounded-md bg-cyber/10 border border-cyber/20"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}
