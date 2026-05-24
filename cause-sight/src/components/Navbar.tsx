import { Link, useRouterState } from '@tanstack/react-router'
import { Zap, LayoutDashboard, History, Users, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'

interface OnlineUser {
  name: string
  avatarColor: string
  incidentId?: string
}

export function Navbar() {
  const { user, logout } = useAuth()
  const router = useRouterState()
  const pathname = router.location.pathname
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    if (!user) return
    const ws = new WebSocket(`ws://localhost:3001/ws`)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'PRESENCE', name: user.name, teamId: user.teamId, avatarColor: (user as any).avatarColor, page: pathname }))
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'PRESENCE_UPDATE') setOnlineUsers(msg.users.filter((u: OnlineUser) => u.name !== user.name))
      } catch {}
    }
    const interval = setInterval(() => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'PRESENCE', name: user.name, teamId: user.teamId, avatarColor: (user as any).avatarColor, page: pathname }))
    }, 5000)
    return () => { clearInterval(interval); ws.close() }
  }, [user, pathname])

  const navLinks = [
    { to: '/app', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/history', label: 'History', Icon: History },
    { to: '/team', label: 'Team', Icon: Users },
  ]

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 border-b border-[#565449]/40 bg-[#0e0f0a]/90 backdrop-blur-md flex items-center px-8">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#565449]/30 border border-[#565449]/60 flex items-center justify-center shadow-[0_0_12px_rgba(86,84,73,0.4)]">
          <Zap className="h-4 w-4 text-[#D8CFBC]" fill="currentColor" />
        </div>
        <span className="font-bold text-[#FFFBF4] text-lg tracking-tight">CauseAI</span>
      </Link>

      {/* Nav links — centered */}
      <div className="flex-1 flex items-center justify-center gap-1">
        {navLinks.map(({ to, label, Icon }) => {
          const active = pathname === to || (to === '/app' && pathname.startsWith('/app'))
          return (
            <Link
              key={to}
              to={to}
              className={`relative inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
                active
                  ? 'bg-[#565449]/25 text-[#FFFBF4] shadow-[0_0_16px_rgba(86,84,73,0.25)] border border-[#565449]/50'
                  : 'text-[#D8CFBC]/55 hover:text-[#D8CFBC] hover:bg-[#1D1E17]/60 border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[#D8CFBC]' : 'text-[#565449]'}`} />
              {label}
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#D8CFBC]/60 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Online users */}
        {onlineUsers.length > 0 && (
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs text-[#D8CFBC]/40 font-mono">{onlineUsers.length} online</span>
            <div className="flex -space-x-1.5">
              {onlineUsers.slice(0, 3).map((u, i) => (
                <div key={i} className="w-6 h-6 rounded-full border border-[#11120D] flex items-center justify-center text-[10px] font-bold text-[#11120D]" style={{ backgroundColor: u.avatarColor || '#565449' }} title={u.name}>
                  {u.name[0].toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team code badge */}
        {user && (
          <span className="font-mono text-[10px] px-2 py-1 rounded border border-[#565449]/40 text-[#565449] bg-[#1D1E17]/60 tracking-widest uppercase">
            {(user as any).teamCode || user.teamId || 'SRE'}
          </span>
        )}

        {/* User avatar */}
        {user && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#11120D] border-2 border-[#565449]/60" style={{ backgroundColor: (user as any).avatarColor || '#D8CFBC' }} title={user.email}>
            {user.name[0].toUpperCase()}
          </div>
        )}

        {/* Sign out */}
        <button onClick={logout} className="text-[#565449] hover:text-[#D8CFBC] transition-colors p-1.5 rounded hover:bg-[#1D1E17]" title="Sign out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  )
}
