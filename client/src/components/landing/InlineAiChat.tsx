import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Sparkles, Shield } from 'lucide-react'
import { Button } from '../ui/Button'
import { useLocale } from '../../context/LocaleContext'
import { useToast } from '../../context/ToastContext'
import { sendChatMessage } from '../../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  typing?: boolean
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 rounded text-cyber text-[11px]">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-3">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="list-disc list-inside space-y-0.5 my-1">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-3">$1</li>')
    .replace(/(<li class="ml-3">.*<\/li>\n?)+/g, (m) => `<ol class="list-decimal list-inside space-y-0.5 my-1">${m}</ol>`)
    .replace(/\n{2,}/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br>')
}

const quickActions = [
  { key: 'ai.quick.scammed', icon: Sparkles },
  { key: 'ai.quick.check_wallet', icon: Sparkles },
  { key: 'ai.quick.report', icon: Sparkles },
  { key: 'ai.quick.emergency', icon: Sparkles },
]

export function InlineAiChat() {
  const { t } = useLocale()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `**${t('ai.greeting.title')}**\n\n${t('ai.greeting.body')}\n\n*${t('ai.greeting.hint')}*`,
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const typeWords = useCallback(async (fullText: string) => {
    const words = fullText.split(' ')
    let accumulated = ''
    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + words[i]
      const snapshot = accumulated
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant' && last.typing) {
          updated[updated.length - 1] = { ...last, content: snapshot }
        }
        return updated
      })
      if (i < words.length - 1) {
        await new Promise(r => setTimeout(r, Math.max(8, Math.random() * 25)))
      }
    }
    // Mark typing done
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last && last.typing) {
        updated[updated.length - 1] = { ...last, typing: false }
      }
      return updated
    })
  }, [])

  const handleSend = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || sending) return
    setInput('')
    setShowQuickActions(false)

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    // Add empty assistant message for typing effect
    setMessages(prev => [...prev, { role: 'assistant', content: '', typing: true }])

    try {
      const allMessages = [...messages, userMsg]
      const res = await sendChatMessage(
        allMessages.map(m => ({ role: m.role, content: m.content }))
      )
      const responseText = res.message || res.error || 'Error processing request.'
      await typeWords(responseText)
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.typing) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Error: ${(err as Error).message || 'Chat failed. Try again.'}`,
            typing: false,
          }
        }
        return updated
      })
      toast('Chat failed. Try again.', 'error')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending, messages, typeWords, toast])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="glass-card-glow w-full max-w-2xl mx-auto flex flex-col overflow-hidden" style={{ maxHeight: '520px' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyber/10 border border-cyber/20">
          <Shield size={14} className="text-cyber" />
        </div>
        <div className="flex-1">
          <span className="font-display text-sm font-semibold text-white">ScamShield AI</span>
          <span className="live-dot ml-2" />
        </div>
        <span className="font-mono text-[10px] text-slate-600 tracking-wider">ACTIVE</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[360px]">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-cyber/10 border border-cyber/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-cyber" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyber/10 border border-cyber/20 text-slate-200'
                    : 'bg-white/[0.03] border border-white/[0.06] text-slate-300'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div
                    className="prose-sm [&_strong]:text-white [&_em]:text-slate-500 [&_code]:text-cyber"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.content) }}
                  />
                ) : (
                  <p>{msg.content}</p>
                )}
                {msg.typing && msg.content === '' && (
                  <div className="flex gap-1 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyber/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyber/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyber/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-7 w-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} className="text-slate-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <AnimatePresence>
        {showQuickActions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-1.5 px-4 pb-2 flex-wrap"
          >
            {quickActions.map(qa => (
              <button
                key={qa.key}
                onClick={() => handleSend(t(qa.key))}
                disabled={sending}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] text-slate-500 hover:text-cyber hover:border-cyber/20 hover:bg-cyber/[0.04] transition-all disabled:opacity-40"
              >
                {t(qa.key)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.06]">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('ai.input.placeholder')}
          rows={1}
          className="flex-1 resize-none bg-transparent font-body text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none leading-relaxed"
          disabled={sending}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSend()}
          disabled={!input.trim() || sending}
        >
          <Send size={14} />
          <span className="hidden sm:inline">{t('ai.btn.send')}</span>
        </Button>
      </div>
    </div>
  )
}
