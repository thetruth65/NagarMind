/**
 * NagarMind v2 — ChatIntakePage.tsx
 * Replaces SubmitComplaintPage with a conversational AI chatbot.
 *
 * Place at: frontend/src/pages/citizen/ChatIntakePage.tsx
 *
 * In App.tsx, change:
 *   <Route path="/citizen/submit" element={<CitizenGuard><SubmitComplaintPage /></CitizenGuard>} />
 * to:
 *   <Route path="/citizen/submit" element={<CitizenGuard><ChatIntakePage /></CitizenGuard>} />
 *   <Route path="/citizen/submit-form" element={<CitizenGuard><SubmitComplaintPage /></CitizenGuard>} />
 *
 * Also update the lazy import:
 *   const ChatIntakePage = lazy(() => import('@/pages/citizen/ChatIntakePage').then(m => ({ default: m.ChatIntakePage })))
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Mic, MicOff, Send, Loader2, Plus, FileText, Globe } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { AppShell } from '@/components/common/AppShell'
import { api } from '@/lib/api'
import { uploadAPI } from '@/lib/api'
import { SUPPORTED_LANGUAGES } from '@/types'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

interface Message {
  id: string
  role: 'user' | 'bot'
  text: string
  ts: Date
}

export function ChatIntakePage() {
  const navigate = useNavigate()
  const [messages, setMessages]     = useState<Message[]>([])
  const [inputText, setInputText]   = useState('')
  const [language, setLanguage]     = useState('en')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [stage, setStage]           = useState('greet')
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [threadId] = useState(() => uuidv4())

  const bottomRef        = useRef<HTMLDivElement>(null)
  const inputRef         = useRef<HTMLTextAreaElement>(null)
  const mediaRecRef      = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const hasInitialized   = useRef(false)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send initial empty message to get greeting
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    sendToAgent('', true)
  }, [])

  const addBotMsg = (text: string) => {
    setMessages(prev => [...prev, { id: uuidv4(), role: 'bot', text, ts: new Date() }])
  }

  const addUserMsg = (text: string) => {
    setMessages(prev => [...prev, { id: uuidv4(), role: 'user', text, ts: new Date() }])
  }

  const sendToAgent = useCallback(async (userMessage: string, isInit = false) => {
    if (loading) return
    if (!isInit && !userMessage.trim()) return

    if (!isInit && userMessage.trim()) {
      addUserMsg(userMessage)
    }

    setInputText('')
    setLoading(true)

    try {
      const { data } = await api.post('/api/chatbot/message', {
        message: userMessage || '',
        thread_id: threadId,
        language,
        latitude: 28.6139,
        longitude: 77.2090,
      })

      addBotMsg(data.reply)
      setStage(data.stage)

      if (data.stage === 'submitted' && data.complaint_id) {
        toast.success('Complaint submitted!')
        setTimeout(() => {
          navigate(`/citizen/track/${data.complaint_id}`)
        }, 2000)
      }
    } catch (e: any) {
      addBotMsg('Sorry, something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [loading, language, threadId, navigate])

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 500) { toast.error('Too short — please speak for at least 1 second'); return }
        setTranscribing(true)
        try {
          const { data } = await uploadAPI.uploadAudioAndTranscribe(blob, language)
          if (data.transcript?.trim()) {
            sendToAgent(data.transcript.trim())
          } else {
            toast.error('Could not transcribe. Please type your message.')
          }
        } catch {
          toast.error('Transcription failed. Please type your message.')
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      mediaRecRef.current = recorder
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecRef.current?.stop()
    setIsRecording(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendToAgent(inputText)
    }
  }

  const quickReplies = stage === 'confirm'
    ? ['Yes, submit it', 'No, let me change something']
    : []

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="flex flex-col h-[calc(100dvh-64px)] max-w-2xl mx-auto -mx-4 sm:mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button onClick={() => navigate('/citizen/dashboard')}
            className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700">
            <ArrowLeft size={16} className="text-slate-300" />
          </button>
          <div className="flex-1">
            <p className="font-semibold text-white text-sm font-body">Report an Issue</p>
            <p className="text-slate-400 text-xs font-body">Chat with NagarMind AI</p>
          </div>

          {/* Language picker */}
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700
                         rounded-xl text-slate-300 text-xs font-body hover:bg-slate-700 transition-colors">
              <Globe size={12} />
              {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName || 'English'}
              <span className="text-slate-500">▾</span>
            </button>
            <AnimatePresence>
              {showLangPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 top-full mt-1 z-50 w-44 bg-slate-800 border border-slate-700
                             rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map(l => (
                    <button key={l.code}
                      onClick={() => { setLanguage(l.code); setShowLangPicker(false) }}
                      className={`w-full text-left px-3 py-2 text-sm font-body flex items-center justify-between
                        ${l.code === language ? 'bg-primary-600/20 text-primary-400' : 'text-slate-300 hover:bg-slate-700'}`}>
                      <span>{l.nativeName}</span>
                      <span className="text-slate-500 text-xs">{l.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Switch to form */}
          <button
            onClick={() => navigate('/citizen/submit-form')}
            title="Use the form instead"
            className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700
                       text-slate-400 hover:text-slate-200 transition-colors">
            <FileText size={15} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-950">
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
            >
              {msg.role === 'bot' && (
                <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30
                                flex items-center justify-center shrink-0 mb-0.5 text-base">
                  🏙️
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 text-sm font-body leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-2xl rounded-br-md'
                    : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-bl-md'}`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {(loading || transcribing) && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30
                              flex items-center justify-center shrink-0 text-base">
                🏙️
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                      className="w-2 h-2 bg-slate-400 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Success state */}
          {stage === 'submitted' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center">
              <div className="bg-green-900/30 border border-green-700/40 rounded-2xl px-6 py-4 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-green-300 font-semibold font-body text-sm">Complaint Submitted!</p>
                <p className="text-green-400/70 text-xs font-body mt-1">Redirecting to tracking...</p>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        {quickReplies.length > 0 && stage !== 'submitted' && (
          <div className="flex gap-2 px-4 py-2 bg-slate-950 overflow-x-auto scrollbar-hide">
            {quickReplies.map(r => (
              <button key={r}
                onClick={() => sendToAgent(r)}
                className="shrink-0 px-4 py-2 bg-slate-800 border border-slate-700 rounded-full
                           text-sm text-slate-300 hover:border-primary-500 hover:text-primary-400
                           font-body transition-all whitespace-nowrap">
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        {stage !== 'submitted' && (
          <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  language === 'hi' ? 'अपनी समस्या यहाँ लिखें...' :
                  language === 'bn' ? 'এখানে লিখুন...' :
                  'Type your message...'
                }
                rows={1}
                disabled={loading || transcribing || isRecording}
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-2xl
                           px-4 py-3 text-sm font-body resize-none outline-none
                           focus:border-primary-500 placeholder:text-slate-500
                           disabled:opacity-50 transition-colors"
                style={{ maxHeight: 120, overflowY: 'auto' }}
              />

              {/* Voice button */}
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={loading || transcribing}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-lg
                  transition-all disabled:opacity-40
                  ${isRecording
                    ? 'bg-red-600 border-2 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
                    : 'bg-slate-800 border border-slate-700 hover:border-slate-500'}`}
                title="Hold to speak"
              >
                {transcribing
                  ? <Loader2 size={16} className="animate-spin text-primary-400" />
                  : isRecording ? <MicOff size={16} className="text-white" />
                  : <Mic size={16} className="text-slate-400" />}
              </button>

              {/* Send button */}
              <button
                onClick={() => sendToAgent(inputText)}
                disabled={!inputText.trim() || loading || transcribing}
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
                           bg-primary-600 hover:bg-primary-500 text-white transition-all
                           disabled:opacity-40 disabled:cursor-default shadow-glow-blue
                           disabled:shadow-none"
              >
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Send size={16} />}
              </button>
            </div>

            <p className="text-center text-slate-600 text-xs font-body mt-2">
              Hold mic to speak • Enter to send • Supports 11 Indian languages
            </p>
          </div>
        )}
      </div>
    </AppShell>
  )
}