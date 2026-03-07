import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/types'

interface AuthStore {
  token: string | null
  role: Role | null
  userId: string | null
  fullName: string | null
  wardId: number | null
  preferredLanguage: string
  isAuthenticated: boolean

  setAuth: (data: {
    token: string; role: Role; userId: string;
    fullName: string; wardId?: number; preferredLanguage?: string
  }) => void
  setLanguage: (lang: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      fullName: null,
      wardId: null,
      preferredLanguage: 'en',
      isAuthenticated: false,

      setAuth: (data) => set({
        token:             data.token,
        role:              data.role,
        userId:            data.userId,
        fullName:          data.fullName,
        wardId:            data.wardId ?? null,
        preferredLanguage: data.preferredLanguage ?? 'en',
        isAuthenticated:   true,
      }),

      setLanguage: (lang) => set({ preferredLanguage: lang }),

      logout: () => set({
        token: null, role: null, userId: null,
        fullName: null, wardId: null,
        preferredLanguage: 'en', isAuthenticated: false,
      }),
    }),
    { name: 'nagarmind-auth' }
  )
)