import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import { useEffect, useState } from 'react'
import { Shield, Zap, Clock, Activity } from 'lucide-react'

export const Route = createFileRoute('/team')({
  component: TeamPage,
})

interface OnlineUser {
  name: string
  avatarColor: string
  page: string
  lastSeen: number
}

function TeamPage() {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    if (!user) return
    const ws = new WebSocket('ws://localhost:3001/ws')

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'PRESENCE',
        name: user.name,
        teamId: user.teamId,
        avatarColor: user.avatarColor,
        page: '/team'
      }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'PRESENCE_UPDATE') {
          setOnlineUsers(msg.users)
        }
      } catch {}
    }

    return () => ws.close()
  }, [user])

  const pageLabel = (page: string) => {
    if (page === '/app') return 'Dashboard'
    if (page === '/history') return 'History'
    if (page === '/team') return 'Team'
    if (page?.startsWith('/app')) return 'Viewing incident'
    return page
  }

  return (
    <div className="min-h-screen bg-[#11120D] text-[#FFFBF4]">
      <Navbar />
      <div className="pt-14">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

          {/* Header */}
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-[#565449]">Collaborative</p>
            <h1 className="mt-1 text-2xl font-bold text-[#FFFBF4]">Team</h1>
          </div>

          {/* Team code card */}
          {user && (
            <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#565449] mb-1">Your Team Code</p>
                <p className="font-mono text-3xl font-bold text-[#FFFBF4] tracking-widest">{user.teamCode}</p>
                <p className="text-xs text-[#D8CFBC]/40 mt-2">Share this code with teammates so they can join your session</p>
              </div>
              <Shield className="h-12 w-12 text-[#565449]/40" />
            </div>
          )}

          {/* Online now */}
          <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#565449]">Online Now</p>
              <span className="font-mono text-[10px] text-[#565449]">— {onlineUsers.length} teammate{onlineUsers.length !== 1 ? 's' : ''}</span>
            </div>

            {onlineUsers.length === 0 ? (
              <p className="text-sm text-[#D8CFBC]/30 font-mono">No teammates online. Share your team code to collaborate.</p>
            ) : (
              <div className="space-y-3">
                {onlineUsers.map((u, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-[#11120D] shrink-0"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#FFFBF4] font-medium">{u.name}</p>
                      <p className="text-xs text-[#D8CFBC]/40 font-mono">{pageLabel(u.page)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#10b981] font-mono">
                      <Activity className="h-3 w-3" />
                      live
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* You */}
          {user && (
            <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#565449] mb-4">You</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#11120D]"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-[#FFFBF4] font-medium">{user.name}</p>
                  <p className="text-xs text-[#D8CFBC]/40 font-mono">{user.email}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-[#10b981]" />
                  <span className="text-xs text-[#10b981] font-mono">active</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
