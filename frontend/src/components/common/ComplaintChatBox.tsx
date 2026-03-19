/**
 * NagarMind v2 — ComplaintChatBox.tsx
 * Reusable chat component for officer ↔ citizen messaging.
 *
 * Place at: frontend/src/components/common/ComplaintChatBox.tsx
 *
 * Used in:
 *   - TrackComplaintPage (citizen side)
 *   - OfficerComplaintDetailPage (officer side)
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import toast from 'react-hot-toast'

interface ChatMessage {
  message_id: string
  complaint_id: string
  sender_id: string
  sender_role: string
  sender_name: string
  message_text: string
  is_read: boolean
  created_at: string
}

interface Props {
  complaintId: string
  officerName?: string
  citizenName?: string
}

function timeAgo(dt: string): string {
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function ComplaintChatBox({ complaintId, officerName, citizenName }: Props) {
  const { userId, role, fullName } = useAuthStore()
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const [input, setInput]         = useState('')
  const [open, setOpen]           = useState(false)
  const [unread, setUnread]       = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    try {
      const { data } = await api.get(`/api/complaints/${complaintId}/messages`)
      setMessages(data.messages || [])
      setUnread(0)
    } catch {
      // silently fail — chat is optional
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchMessages()
    }
  }, [open, complaintId])

  // Real-time: listen for new_message WS events
  useWebSocket((msg) => {
    if (msg.event === 'new_message' && msg.complaint_id === complaintId) {
      const newMsg = msg as any as ChatMessage
      setMessages(prev => {
        if (prev.find(m => m.message_id === newMsg.message_id)) return prev
        return [...prev, newMsg]
      })
      if (!open) setUnread(u => u + 1)
    }
  })

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const { data } = await api.post(`/api/complaints/${complaintId}/messages`, {
        message: text,
      })
      // Optimistically add to UI
      setMessages(prev => [...prev, {
        message_id: data.message_id,
        complaint_id: complaintId,
        sender_id: userId || '',
        sender_role: role || 'citizen',
        sender_name: data.sender_name || fullName || role || '',
        message_text: text,
        is_read: true,
        created_at: new Date().toISOString(),
      }])
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to send message')
      setInput(text) // restore on error
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const otherName = role === 'citizen' ? (officerName || 'Officer') : (citizenName || 'Citizen')

  return (
    <div className="mt-4">
      {/* Toggle button */}
      <button
        onClick={() => { setOpen(o => !o); setUnread(0) }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
          ${open
            ? 'bg-primary-600/10 border-primary-500/40 text-primary-300'
            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'}`}
      >
        <MessageSquare size={16} />
        <span className="font-semibold text-sm font-body flex-1 text-left">
          {role === 'citizen' ? `Chat with Officer` : `Chat with Citizen`}
        </span>
        {messages.length > 0 && (
          <span className="text-xs text-slate-400 font-body">{messages.length} messages</span>
        )}
        {unread > 0 && (
          <span className="w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 border border-slate-800 border-t-0 rounded-b-2xl">
              {/* Messages area */}
              <div className="h-64 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="animate-spin text-slate-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare size={28} className="text-slate-700 mb-2" />
                    <p className="text-slate-500 text-sm font-body">No messages yet</p>
                    <p className="text-slate-600 text-xs font-body mt-1">
                      Start a conversation with {otherName}
                    </p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === userId
                    return (
                      <div key={msg.message_id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                        {!isMe && (
                          <div className="w-7 h-7 rounded-xl bg-slate-700 flex items-center justify-center
                                          text-xs shrink-0 mt-0.5">
                            {msg.sender_role === 'officer' ? '👷' : '👤'}
                          </div>
                        )}
                        <div className={`max-w-[75%] ${isMe ? '' : ''}`}>
                          {!isMe && (
                            <p className="text-xs text-slate-500 font-body mb-1 ml-1">{msg.sender_name}</p>
                          )}
                          <div className={`px-3 py-2 rounded-xl text-sm font-body leading-relaxed
                            ${isMe
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm'}`}>
                            {msg.message_text}
                          </div>
                          <p className={`text-xs text-slate-600 font-body mt-1 ${isMe ? 'text-right' : 'ml-1'}`}>
                            {timeAgo(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 p-3 border-t border-slate-800">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={`Message ${otherName}...`}
                  rows={1}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl
                             px-3 py-2 text-sm font-body resize-none outline-none
                             focus:border-primary-500 placeholder:text-slate-600 transition-colors"
                  style={{ maxHeight: 80, overflowY: 'auto' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-9 h-9 rounded-xl bg-primary-600 hover:bg-primary-500 text-white
                             flex items-center justify-center shrink-0 transition-all
                             disabled:opacity-40 disabled:cursor-default self-end"
                >
                  {sending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}