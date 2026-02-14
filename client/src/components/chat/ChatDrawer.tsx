import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import { useToast } from '../../context/ToastContext'
import { sendChatMessage } from '../../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatDrawerProps {
  onClose: () => void
}

const quickActions = [
  { key: 'ai.quick.scammed', icon: Sparkles },
  { key: 'ai.quick.check_wallet', icon: Sparkles },
  { key: 'ai.quick.emergency', icon: Sparkles },
]

export function ChatDrawer({ onClose }: ChatDrawerProps) {
  const { t } = useLocale()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `${t('ai.greeting.title')}\n\n${t('ai.greeting.body')}\n\n_${t('ai.greeting.hint')}_` },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async (content?: string) => {
    const text = content ?? input.trim()
    if (!text || sending) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setSending(true)

    try {
      const res = await sendChatMessage(updatedMessages.map(m => ({ role: m.role, content: m.content })))
      setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
    } catch (err) {
      toast('Chat failed. Try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed bottom-20 left-6 z-[8999] w-[360px] max-h-[520px] glass-card-glow flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <Bot size={16} className="text-cyber" />
        <span className="font-display text-sm font-semibold text-white">AI Assistant</span>
        <span className="live-dot ml-1" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[350px]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="h-6 w-6 rounded-full bg-cyber/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={12} className="text-cyber" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-cyber/10 border border-cyber/20 text-slate-200'
                : 'bg-white/[0.03] border border-white/[0.06] text-slate-300'
            }`}>
              {msg.content.split('\n').map((line, j) => (
                <p key={j} className={j > 0 ? 'mt-1.5' : ''}>
                  {line.startsWith('_') && line.endsWith('_')
                    ? <em className="text-slate-500">{line.slice(1, -1)}</em>
                    : line.startsWith('**') && line.endsWith('**')
                    ? <strong>{line.slice(2, -2)}</strong>
                    : line}
                </p>
              ))}
            </div>
            {msg.role === 'user' && (
              <div className="h-6 w-6 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                <User size={12} className="text-slate-400" />
              </div>
            )}
          </motion.div>
        ))}
        {sending && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-cyber/10 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-cyber" />
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyber/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-cyber/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-cyber/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="flex gap-1.5 px-4 pb-2 flex-wrap">
          {quickActions.map(qa => (
            <button
              key={qa.key}
              onClick={() => handleSend(t(qa.key))}
              className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-slate-500 hover:text-cyber hover:border-cyber/20 transition-all"
            >
              {t(qa.key)}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06]">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={t('ai.input.placeholder')}
          className="flex-1 bg-transparent font-body text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none"
          disabled={sending}
        />
        <Button variant="primary" size="sm" onClick={() => handleSend()} disabled={!input.trim() || sending}>
          <Send size={12} />
        </Button>
      </div>
    </motion.div>
  )
}
