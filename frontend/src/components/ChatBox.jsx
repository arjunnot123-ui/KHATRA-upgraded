import { useState, useRef, useEffect, useCallback } from 'react'
import { askSiteAssistant } from '../lib/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAiAssistant } from '../context/AiAssistantContext.jsx'
import { langName } from '../lib/i18n.js'

const SUGGESTIONS = [
  'What is LOTO?',
  'How does certification work?',
  'Explain this machine hazard',
  'What PPE is required?',
  'How do I take an assessment?',
]

const STORAGE_KEY = 'khatra_chat_session'

export default function ChatBox() {
  const { t, lang } = useLanguage()
  const { contextPayload, selectedHazard, recentAssessment } = useAiAssistant()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Sync to sessionStorage to preserve across route navigation / refreshes in current session
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // ignore
    }
  }, [messages])

  // Initial greeting if session is empty
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: t('chat_greeting') || 'Hello! I am the KHATRA safety and operations assistant. How can I help you today?' }])
    }
  }, [open, messages.length, t])

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }, [])

  useEffect(() => {
    if (open) {
      scrollToBottom(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, scrollToBottom])

  useEffect(() => {
    scrollToBottom(true)
  }, [messages, loading, scrollToBottom])

  const sendMessage = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    setInput('')
    setLastFailedUserMessage(null)

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const history = nextMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))

      const reply = await askSiteAssistant(history, langName(lang), contextPayload)
      setMessages((m) => [...m, { role: 'assistant', content: reply || 'I received an empty response. Please try rephrasing.' }])
      setLastFailedUserMessage(null)
    } catch (e) {
      setLastFailedUserMessage(text)
      let msg = e.message
      if (e.message === 'AI_NOT_CONFIGURED') {
        msg = 'The AI service is not configured on the server. Please ask your administrator to configure an AI provider in backend/.env.'
      } else if (e.message === 'SERVER_UNAVAILABLE') {
        msg = 'Cannot reach the KHATRA server. Please verify your internet connection and backend status.'
      } else if (e.message === 'AI_REQUEST_FAILED' || !msg) {
        msg = 'The AI assistant is temporarily experiencing high demand. Please try again in a few moments.'
      }
      setMessages((m) => [...m, { role: 'assistant', content: msg, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    if (!lastFailedUserMessage || loading) return
    // Remove last error message from assistant if present
    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].isError) {
        return prev.slice(0, -1)
      }
      return prev
    })
    sendMessage(lastFailedUserMessage)
  }

  const handleClear = () => {
    const reset = [{ role: 'assistant', content: t('chat_greeting') || 'Hello! I am the KHATRA safety and operations assistant. How can I help you today?' }]
    setMessages(reset)
    setLastFailedUserMessage(null)
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reset))
    } catch {
      // ignore
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('chat_title') || 'KHATRA Assistant'}
        title="Open KHATRA AI Assistant"
        className="fixed bottom-20 md:bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-amber text-steel font-display font-bold text-2xl shadow-xl flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all"
      >
        {open ? '×' : '?'}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-36 md:bottom-24 right-5 z-30 w-[92vw] max-w-md h-[68vh] max-h-[580px] bg-steel-light border border-steel-lighter rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 border-b border-steel-lighter bg-steel flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-safe animate-pulse" />
              <div>
                <span className="font-display font-bold text-amber uppercase tracking-wide text-sm block leading-none">
                  {t('chat_title') || 'KHATRA Assistant'}
                </span>
                <span className="text-[10px] text-concrete font-mono">Safety & Operations AI</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                title="Clear conversation"
                className="text-[11px] font-mono text-concrete hover:text-hazard transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-steel-lighter"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-concrete hover:text-chalk text-xl leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm leading-relaxed rounded-xl px-3.5 py-2.5 max-w-[88%] ${
                  m.role === 'user'
                    ? 'bg-amber text-steel ml-auto font-medium shadow-sm'
                    : m.isError
                    ? 'bg-hazard/10 border border-hazard text-hazard'
                    : 'bg-steel border border-steel-lighter text-chalk shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                {m.isError && lastFailedUserMessage && (
                  <button
                    onClick={handleRetry}
                    className="mt-2 text-xs font-mono font-bold text-amber hover:underline flex items-center gap-1"
                  >
                    ↻ Retry this message
                  </button>
                )}
              </div>
            ))}

            {/* Thinking indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-concrete font-mono bg-steel border border-steel-lighter rounded-xl px-3.5 py-2 max-w-[65%]">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>{t('chat_thinking') || 'Thinking...'}</span>
              </div>
            )}

            {/* Suggested Questions (shown when conversation is short) */}
            {messages.length <= 2 && !loading && (
              <div className="pt-2 border-t border-steel-lighter/50">
                <p className="text-[10px] font-mono text-concrete uppercase tracking-wider mb-2">
                  {selectedHazard || recentAssessment ? '💡 Contextual safety suggestions:' : 'Suggested topics:'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const list = []
                    if (selectedHazard) {
                      list.push(`What does "${selectedHazard.label.slice(0, 24)}" mean?`)
                      list.push('What PPE is required for this hazard?')
                    }
                    if (recentAssessment) {
                      if (!recentAssessment.passed) {
                        list.push('Why did I fail?')
                        list.push('What should I study next?')
                      } else {
                        list.push('Am I eligible for certification?')
                      }
                    }
                    const route = contextPayload?.currentRoute || ''
                    if (route.includes('/assessment') && !list.includes('Why did I fail?')) {
                      list.push('Explain this assessment question')
                    } else if (route.includes('/scan') && !list.length) {
                      list.push('What does this hazard mean?')
                    } else if (route.includes('/dashboard')) {
                      if (!list.includes('What should I study next?')) list.push('What should I study next?')
                      list.push('How do I get certified?')
                    }
                    SUGGESTIONS.forEach((s) => {
                      if (!list.includes(s) && list.length < 5) list.push(s)
                    })
                    return list.slice(0, 5)
                  })().map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-steel hover:bg-steel-lighter border border-steel-lighter text-chalk px-2.5 py-1 rounded-full text-left transition-colors flex items-center gap-1"
                    >
                      <span className="text-amber">›</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input & Footer */}
          <div className="p-3 border-t border-steel-lighter bg-steel">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('chat_placeholder') || 'Ask about safety, procedures, or anything...'}
                className="flex-1 bg-steel-light border border-steel-lighter rounded-lg px-3.5 py-2.5 text-sm focus:border-amber outline-none text-chalk placeholder-concrete/70"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="bg-amber text-steel font-bold text-sm px-4 rounded-lg disabled:opacity-50 hover:bg-white active:scale-95 transition-all flex items-center justify-center shrink-0"
              >
                {t('chat_send') || 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
