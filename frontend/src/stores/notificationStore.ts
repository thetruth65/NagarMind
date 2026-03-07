import { create } from 'zustand'
import type { Notification } from '@/types'

interface NotifStore {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifs: Notification[], unread: number) => void
  addNotification: (n: Notification) => void
  markAllRead: () => void
}

export const useNotifStore = create<NotifStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),

  addNotification: (n) => set((s) => ({
    notifications: [n, ...s.notifications].slice(0, 50),
    unreadCount: s.unreadCount + 1,
  })),

  markAllRead: () => set((s) => ({
    notifications: s.notifications.map(n => ({ ...n, is_read: true })),
    unreadCount: 0,
  })),
}))