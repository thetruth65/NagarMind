import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

type WSMessage = { event: string; [key: string]: any }

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const { userId, token } = useAuthStore()
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const savedOnMessage = useRef(onMessage)

  useEffect(() => {
    savedOnMessage.current = onMessage
  },[onMessage])

  useEffect(() => {
    if (!userId || !token) return

    let isMounted = true

    const connect = () => {
      if (ws.current?.readyState === WebSocket.OPEN) return

      let wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
      const socket = new WebSocket(`${wsUrl}/ws/${userId}?token=${token}`)

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          savedOnMessage.current(data)
        } catch (err) {}
      }

      socket.onclose = (e) => {
        // ✅ FIX: 4001 means server explicitly rejected auth. Don't spam reconnect.
        if (isMounted && e.code !== 4001 && e.code !== 1000) {
          reconnectTimer.current = setTimeout(connect, 5000)
        }
      }

      ws.current = socket
    }

    connect()

    const ping = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.send('ping')
    }, 25000)

    return () => {
      isMounted = false
      clearInterval(ping)
      clearTimeout(reconnectTimer.current)
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [userId, token])
}