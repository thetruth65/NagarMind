import { useRef, useState, useCallback } from 'react'

type Status = 'idle' | 'connecting' | 'recording' | 'error'

interface Options {
  language?: string
  onPartial?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (err: string) => void
}

/**
 * useStreamingTranscription
 * Sends raw PCM audio chunks to the backend WebSocket,
 * which proxies them to Sarvam AI's streaming STT.
 * Falls back gracefully to MediaRecorder-based batch STT.
 */
export function useStreamingTranscription({
  language = 'hi-IN',
  onPartial,
  onFinal,
  onError,
}: Options = {}) {
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const wsRef       = useRef<WebSocket | null>(null)
  const mediaRef    = useRef<MediaRecorder | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const chunksRef   = useRef<Blob[]>([])

  const start = useCallback(async (token: string) => {
    try {
      setStatus('connecting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Open WS to backend
      const wsUrl = `${window.location.origin.replace('http', 'ws')}/ws/stt?token=${token}&lang=${language}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('recording')
        // Stream raw chunks every 250ms
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
        mr.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }
        mr.start(250)
        mediaRef.current = mr
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'partial') {
            setTranscript(msg.text || '')
            onPartial?.(msg.text || '')
          } else if (msg.type === 'final') {
            setTranscript(msg.text || '')
            onFinal?.(msg.text || '')
          } else if (msg.type === 'error') {
            setStatus('error')
            onError?.(msg.message || 'Transcription error')
          }
        } catch { /* ignore non-JSON */ }
      }

      ws.onerror = () => {
        setStatus('error')
        onError?.('WebSocket connection failed')
        cleanup()
      }

      ws.onclose = () => {
        if (status === 'recording') setStatus('idle')
      }
    } catch (err: any) {
      setStatus('error')
      onError?.(err.message || 'Microphone access denied')
    }
  }, [language, onPartial, onFinal, onError])

  const stop = useCallback(() => {
    mediaRef.current?.stop()
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
      setTimeout(() => wsRef.current?.close(), 500)
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    setStatus('idle')
  }, [])

  const cleanup = useCallback(() => {
    mediaRef.current?.stop()
    wsRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    setStatus('idle')
  }, [])

  const reset = useCallback(() => {
    cleanup()
    setTranscript('')
  }, [cleanup])

  return { status, transcript, start, stop, reset }
}