import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

type WSMessage = { event: string; [key: string]: unknown }

const MAX_RETRIES    = 5
const BASE_DELAY     = 2000   // 2s → 4s → 8s → 16s → 30s cap
const PING_INTERVAL  = 25_000

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const { userId, token } = useAuthStore()

  const ws             = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const pingTimer      = useRef<ReturnType<typeof setInterval>>()
  const retryCount     = useRef(0)
  const isMounted      = useRef(false)
  const savedOnMessage = useRef(onMessage)

  useEffect(() => { savedOnMessage.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!userId || !token) return

    isMounted.current = true

    const stopPing = () => {
      if (pingTimer.current) {
        clearInterval(pingTimer.current)
        pingTimer.current = undefined
      }
    }

    const startPing = () => {
      stopPing()
      pingTimer.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send('ping')
        }
      }, PING_INTERVAL)
    }

    const connect = () => {
      // Don't open a second connection if already open or connecting
      if (
        ws.current?.readyState === WebSocket.OPEN ||
        ws.current?.readyState === WebSocket.CONNECTING
      ) return

      const wsUrl  = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
      const socket = new WebSocket(
        `${wsUrl}/ws/${userId}?token=${encodeURIComponent(token)}`
      )

      socket.onopen = () => {
        if (!isMounted.current) return
        retryCount.current = 0
        startPing()
      }

      socket.onmessage = (e) => {
        if (!isMounted.current) return
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'connected') return  // internal handshake, skip
          savedOnMessage.current(msg)
        } catch {
          // ignore malformed frames
        }
      }

      socket.onclose = (e) => {
        stopPing()
        ws.current = null

        if (!isMounted.current) return

        // Auth failure or intentional close — do not retry
        if (e.code === 4001 || e.code === 1000 || e.code === 1001) {
          console.warn(`[WS] Closed with code ${e.code}, not retrying.`)
          return
        }

        if (retryCount.current >= MAX_RETRIES) {
          console.warn('[WS] Max retries reached, giving up.')
          return
        }

        const delay = Math.min(BASE_DELAY * 2 ** retryCount.current, 30_000)
        retryCount.current += 1
        console.log(
          `[WS] Reconnecting in ${delay}ms (attempt ${retryCount.current}/${MAX_RETRIES})`
        )
        reconnectTimer.current = setTimeout(connect, delay)
      }

      socket.onerror = () => {
        stopPing()
        // onclose fires right after onerror — retry logic lives there
      }

      ws.current = socket
    }

    connect()

    return () => {
      isMounted.current = false
      stopPing()
      clearTimeout(reconnectTimer.current)
      if (ws.current) {
        ws.current.onclose = null  // prevent retry on intentional teardown
        ws.current.close(1000, 'component unmounted')
        ws.current = null
      }
    }
  }, [userId, token])
}