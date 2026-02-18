import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Sparkles, Shield, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { TelegramIcon } from '../ui/BrandIcons'
import { useLocale } from '../../context/LocaleContext'
import { useToast } from '../../context/ToastContext'
import { sendChatMessage } from '../../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  typing?: boolean
  options?: Array<{ text: string; action: string }>
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
  const { t, locale } = useLocale()
  const { toast } = useToast()
  const initialMessage: Message = {
    role: 'assistant',
    content: `**${t('ai.greeting.title')}**\n\n${t('ai.greeting.body')}\n\n*Join our Telegram support group for immediate help: https://t.me/ScamShieldMY*`,
  }
  const [messages, setMessages] = useState<Message[]>([
    initialMessage,
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messageHistoryRef = useRef<Message[]>([initialMessage])

  const journeySteps = locale === 'bm'
    ? ['Terangkan situasi', 'Bendung kerugian', 'Selesaikan laporan']
    : ['Describe incident', 'Contain losses', 'Complete reports']

  const completedSteps = Math.min(3, Math.max(1, Math.floor(messages.length / 2) + (sending ? 1 : 0)))

  const resetChat = () => {
    setMessages([initialMessage])
    messageHistoryRef.current = [initialMessage]
    setInput('')
    setShowQuickActions(true)
    inputRef.current?.focus()
  }

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
        messageHistoryRef.current = updated
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
      messageHistoryRef.current = updated
      return updated
    })
  }, [])

  const handleSend = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || sending) return
    setInput('')
    setShowQuickActions(false)

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => {
      const updated = [...prev, userMsg]
      messageHistoryRef.current = updated
      return updated
    })
    setSending(true)

    // Add empty assistant message for typing effect
    setMessages(prev => {
      const updated = [...prev, { role: 'assistant' as const, content: '', typing: true }]
      messageHistoryRef.current = updated
      return updated
    })

    try {
      const allMessages = [...messageHistoryRef.current]
      const res = await sendChatMessage(
        allMessages.map(m => ({ role: m.role, content: m.content }))
      )
      const responseText = res.message || res.error || 'Error processing request.'
      await typeWords(responseText)
      // Add options to the message after typing completes
      if (res.options && res.options.length > 0) {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, options: res.options }
          }
          messageHistoryRef.current = updated
          return updated
        })
      }
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
        messageHistoryRef.current = updated
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
    <div className="glass-card-glow w-full max-w-2xl mx-auto flex flex-col overflow-hidden" style={{ maxHeight: '580px' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyber/10 border border-cyber/20">
          <Shield size={14} className="text-cyber" />
        </div>
        <div className="flex-1">
          <span className="font-display text-sm font-semibold text-white">ScamShield Support</span>
          <span className="live-dot ml-2" />
        </div>
        <a
          href="https://t.me/ScamShieldMY"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0088cc]/10 border border-[#0088cc]/20 hover:bg-[#0088cc]/20 transition-all group"
        >
          <TelegramIcon size={14} className="text-[#0088cc] group-hover:text-white" />
          <span className="font-mono text-[10px] text-[#0088cc] group-hover:text-white">JOIN</span>
        </a>
      </div>

      <div className="px-4 pt-3 pb-2 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {journeySteps.map((step, index) => {
              const stepNumber = index + 1
              const complete = completedSteps >= stepNumber
              return (
                <span
                  key={step}
                  className={`rounded-full border px-2 py-1 text-[10px] font-mono ${
                    complete
                      ? 'border-cyber/30 bg-cyber/[0.08] text-cyber'
                      : 'border-white/[0.08] bg-white/[0.02] text-slate-500'
                  }`}
                >
                  {stepNumber}. {step}
                </span>
              )
            })}
          </div>
          <button
            type="button"
            onClick={resetChat}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] font-mono text-slate-500 hover:text-white hover:border-white/20 transition-colors"
          >
            <RotateCcw size={10} />
            {locale === 'bm' ? 'Mula semula' : 'Restart'}
          </button>
        </div>
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
                
                {/* Render clickable options inside the bubble */}
                {msg.role === 'assistant' && msg.options && msg.options.length > 0 && !msg.typing && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/[0.08]"
                  >
                    {msg.options.map((opt, idx) => (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.08 }}
                        whileHover={{ x: 3, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSend(opt.action)}
                        disabled={sending}
                        className="text-left px-3 py-2.5 rounded-lg border border-cyber/20 bg-cyber/[0.04] text-[12px] font-medium text-slate-300 hover:text-white hover:bg-cyber/10 hover:border-cyber/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {opt.text}
                      </motion.button>
                    ))}
                  </motion.div>
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
      <div className="flex flex-col gap-1.5 px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-2">
          <textarea
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value.slice(0, 500))
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
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 px-0.5">
          <span>{locale === 'bm' ? 'Petua: guna tindakan pantas untuk respon lebih cepat.' : 'Tip: use quick actions for faster response.'}</span>
          <span>{input.length}/500</span>
        </div>
      </div>
    </div>
  )
}
