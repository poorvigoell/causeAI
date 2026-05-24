import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  name: string
  teamId: string
  teamCode: string
  avatarColor: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, teamCode: string) => Promise<void>
  logout: () => void
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('causeai_user')
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (email: string, password: string, teamCode: string) => {
    if (!email || !password) throw new Error('Email and password required')
    if (!teamCode) throw new Error('Team code required')
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      teamId: teamCode.toLowerCase().replace(/\s+/g, '-'),
      teamCode: teamCode.toUpperCase(),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)]
    }
    sessionStorage.setItem('causeai_user', JSON.stringify(user))
    setUser(user)
  }

  const logout = () => {
    sessionStorage.removeItem('causeai_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
