import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authMe } from '../lib/api'

interface AuthUser {
  email: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  quota: { used: number; limit: number } | null
  loading: boolean
  refresh: () => Promise<void>
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await authMe()
      if (data.authenticated && data.email) {
        setUser({ email: data.email, role: data.role ?? 'user' })
        setQuota(data.usage ? { used: data.usage.used, limit: data.usage.limit } : null)
      } else {
        setUser(null)
        setQuota(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(() => {
    window.location.href = '/api/auth/login'
  }, [])

  const logout = useCallback(() => {
    window.location.href = '/api/auth/logout'
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      quota,
      loading,
      refresh,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
