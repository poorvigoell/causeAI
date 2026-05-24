import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teamCode, setTeamCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await login(email, password, teamCode)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#11120D] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-[#565449]">CauseAI</p>
          <h1 className="mt-2 text-2xl font-bold text-[#FFFBF4]">Sign in</h1>
          <p className="mt-1 text-sm text-[#D8CFBC]/50">SRE Incident Response Platform</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[#565449] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="you@company.com"
              className="w-full rounded-md border border-[#565449]/40 bg-[#1D1E17] px-3 py-2 text-sm text-[#FFFBF4] placeholder-[#565449] outline-none focus:border-[#D8CFBC]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[#565449] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              className="w-full rounded-md border border-[#565449]/40 bg-[#1D1E17] px-3 py-2 text-sm text-[#FFFBF4] placeholder-[#565449] outline-none focus:border-[#D8CFBC]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-[#565449] mb-1.5">Team Code</label>
            <input
              type="text"
              value={teamCode}
              onChange={e => setTeamCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. SRE-TEAM-01"
              className="w-full rounded-md border border-[#565449]/40 bg-[#1D1E17] px-3 py-2 text-sm text-[#FFFBF4] placeholder-[#565449] outline-none focus:border-[#D8CFBC]/40 font-mono tracking-widest"
            />
            <p className="mt-1 text-xs text-[#565449]">All teammates must use the same code to collaborate</p>
          </div>

          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-md bg-[#D8CFBC]/10 border border-[#D8CFBC]/20 py-2.5 text-sm text-[#FFFBF4] transition-colors hover:bg-[#D8CFBC]/20 disabled:opacity-40 font-mono"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <p className="text-center text-xs text-[#565449]">
          Any email + password works. Team code groups you with colleagues.
        </p>
      </div>
    </div>
  )
}
