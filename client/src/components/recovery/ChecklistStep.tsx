import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Square } from 'lucide-react'
import { ProgressBar } from '../ui/Progress'
import { useLocale } from '../../context/LocaleContext'
import { useToast } from '../../context/ToastContext'
import type { PlaybookResponse } from '../../lib/api'

interface ChecklistStepProps {
  playbook: PlaybookResponse | null
  loading: boolean
}

const defaultTasks = [
  { id: 'bank-freeze', label: 'Call bank to freeze outgoing transfers', why: 'Stops further losses', weight: 25 },
  { id: 'nsrc-997', label: 'Call NSRC at 997', why: 'Inter-bank freeze coordination', weight: 20 },
  { id: 'sim-lock', label: 'Lock SIM and reset telco PIN', why: 'Prevents SIM swap', weight: 15 },
  { id: 'pwd-rotate', label: 'Rotate all passwords + enable 2FA', why: 'Account security', weight: 15 },
  { id: 'evidence', label: 'Screenshot and export chat history', why: 'Preserve evidence', weight: 10 },
  { id: 'report-pdrm', label: 'File police report at PDRM', why: 'Legal documentation', weight: 15 },
]

export function ChecklistStep({ playbook, loading }: ChecklistStepProps) {
  const { t } = useLocale()
  const { toast } = useToast()
  const tasks = playbook?.recoveryTasks ?? defaultTasks
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const progress = tasks.reduce((sum, task) => {
    return sum + (completed.has(task.id) ? task.weight : 0)
  }, 0)

  const toggle = useCallback((id: string) => {
    setCompleted(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        const newProgress = tasks.reduce((s, t) => s + (next.has(t.id) ? t.weight : 0), 0)
        if (newProgress >= 100) toast('Recovery complete! All actions taken.', 'success')
        else if (newProgress >= 75) toast('Almost there! 75% complete.', 'info')
        else if (newProgress >= 50) toast('Halfway done! Keep going.', 'info')
      }
      return next
    })
  }, [tasks, toast])

  if (loading) {
    return <div className="space-y-3 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-white/[0.03]" />)}</div>
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="data-label">{t('flow.checklist.subtitle')}</span>
          <span className="font-mono text-sm font-bold text-cyber">{progress}%</span>
        </div>
        <ProgressBar value={progress} color={progress >= 75 ? 'green' : progress >= 50 ? 'amber' : 'cyan'} />
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {tasks.map(task => {
          const isDone = completed.has(task.id)
          return (
            <motion.button
              key={task.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => toggle(task.id)}
              className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all ${
                isDone ? 'bg-safe/[0.04] border border-safe/10' : 'bg-white/[0.02] border border-transparent hover:border-white/[0.06]'
              }`}
            >
              {isDone ? (
                <CheckSquare size={16} className="text-safe mt-0.5 shrink-0" />
              ) : (
                <Square size={16} className="text-slate-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-body text-sm ${isDone ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                  {task.label}
                </p>
                <p className="font-mono text-[10px] text-slate-600 mt-0.5">{task.why}</p>
              </div>
              <span className="font-mono text-[10px] text-slate-700 shrink-0">{task.weight}%</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
