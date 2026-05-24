import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fetchIncidents as fetchIncidentHistory, fetchHeatmap, type IncidentSummary, type HeatmapDay } from '../lib/causeai-api'
import { Navbar } from '../components/Navbar'
import { AlertTriangle, ChevronRight, Users } from 'lucide-react'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

function severityColor(sev: string) {
  if (sev === 'P0') return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' }
  if (sev === 'P1') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' }
  return { bg: 'bg-[#565449]/20', text: 'text-[#D8CFBC]/60', border: 'border-[#565449]/40' }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return `${m}m ago`
}

function getHeatColor(count: number, sev: string) {
  if (count === 0) return '#1D1E17'
  if (sev === 'P0') return count > 3 ? '#ef4444' : '#f87171'
  if (sev === 'P1') return count > 3 ? '#f59e0b' : '#fcd34d'
  return '#565449'
}


function CalendarHeatmap({ cells }: { cells: { date: string; count: number; sev: string }[] }) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAYS = ['S','M','T','W','T','F','S']

  // Pad start to Sunday
  const padded: { date: string; count: number; sev: string }[] = [...cells]
  if (padded.length > 0) {
    const firstDow = new Date(padded[0].date + 'T00:00:00').getDay()
    for (let i = 0; i < firstDow; i++) padded.unshift({ date: '', count: -1, sev: '' })
  }
  while (padded.length % 7 !== 0) padded.push({ date: '', count: -1, sev: '' })
  const numWeeks = padded.length / 7

  // Month labels: find first week where month changes
  const monthLabels: { wk: number; label: string }[] = []
  let lastMonth = -1
  for (let wk = 0; wk < numWeeks; wk++) {
    for (let dow = 0; dow < 7; dow++) {
      const cell = padded[wk * 7 + dow]
      if (cell.date) {
        const m = new Date(cell.date + 'T00:00:00').getMonth()
        if (m !== lastMonth) { monthLabels.push({ wk, label: MONTHS[m] }); lastMonth = m }
        break
      }
    }
  }

  const getColor = (c: { date: string; count: number; sev: string }) => {
    if (c.count <= 0 || !c.date) return c.count === 0 ? '#2a2b22' : 'transparent'
    if (c.sev === 'P0') return c.count > 2 ? '#ef4444' : '#f87171'
    if (c.sev === 'P1') return c.count > 2 ? '#f59e0b' : '#fcd34d'
    return '#565449'
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: numWeeks * 14 + 24 }}>
        {/* Month labels */}
        <div className="flex mb-1 ml-6">
          {Array.from({ length: numWeeks }, (_, wk) => {
            const ml = monthLabels.find(m => m.wk === wk)
            return (
              <div key={wk} className="font-mono text-[9px] text-[#565449]" style={{ width: 14, flexShrink: 0 }}>
                {ml ? ml.label : ''}
              </div>
            )
          })}
        </div>
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col mr-1" style={{ gap: 3 }}>
            {DAYS.map((d, i) => (
              <div key={i} className="font-mono text-[9px] text-[#565449] text-right" style={{ width: 16, height: 11, lineHeight: '11px' }}>
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>
          {/* Grid: col per week, row per day */}
          <div className="flex" style={{ gap: 3 }}>
            {Array.from({ length: numWeeks }, (_, wk) => (
              <div key={wk} className="flex flex-col" style={{ gap: 3 }}>
                {Array.from({ length: 7 }, (_, dow) => {
                  const cell = padded[wk * 7 + dow]
                  return (
                    <div
                      key={dow}
                      title={cell.date && cell.count > 0 ? `${cell.date}: ${cell.count} incident${cell.count !== 1 ? 's' : ''} · ${cell.sev}` : cell.date || ''}
                      style={{
                        width: 11, height: 11, borderRadius: 2, flexShrink: 0,
                        backgroundColor: getColor(cell),
                        border: cell.count >= 0 ? '1px solid rgba(86,84,73,0.25)' : 'none',
                        transition: 'transform 0.1s',
                        cursor: cell.date ? 'pointer' : 'default'
                      }}
                      onMouseEnter={e => { if(cell.date)(e.target as HTMLElement).style.transform='scale(1.4)' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.transform='scale(1)' }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([])
  const [heatRange, setHeatRange] = useState<90 | 180 | 365>(365)

  // Generate calendar cells for the selected range
  const calendarCells = (() => {
    const today = new Date()
    const days: { date: string; count: number; sev: string }[] = []
    
    // Dummy incidents for last 90 days (remove when real data fills in)
    const dummyDates = new Set<string>()
    const dummySevs: Record<string, string> = {}
    const seed = [2,5,7,11,14,16,19,22,25,28,31,34,37,40,43,46,49,52,55,58,61,64,67,70,73,76,79,82,85,88]
    seed.forEach((d, i) => {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - d)
      const key = dt.toISOString().slice(0,10)
      dummyDates.add(key)
      dummySevs[key] = i % 3 === 0 ? 'P0' : i % 3 === 1 ? 'P1' : 'P2'
    })

    // Build real data map from heatmap API
    const realMap: Record<string, { count: number; sev: string }> = {}
    heatmap.forEach(d => { realMap[d.date] = { count: d.count, sev: d.worstSeverity } })

    for (let i = heatRange - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0,10)
      if (realMap[key]) {
        days.push({ date: key, count: realMap[key].count, sev: realMap[key].sev })
      } else if (dummyDates.has(key)) {
        days.push({ date: key, count: 1, sev: dummySevs[key] })
      } else {
        days.push({ date: key, count: 0, sev: '' })
      }
    }
    return days
  })()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'P0' | 'P1' | 'P2'>('all')
  const [viewers, setViewers] = useState<Record<string, number>>({})

  useEffect(() => {
    Promise.all([
      fetchIncidentHistory(50),
      fetchHeatmap(365)
    ]).then(([inc, heat]) => {
      setIncidents(inc)
      setHeatmap(heat)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws')
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'VIEWER_COUNTS') setViewers(msg.counts)
      } catch {}
    }
    return () => ws.close()
  }, [])

  const filtered = incidents.filter(i => {
    if (filter === 'all') return true
    const sev = (i as any).severity || 'P2'
    return sev === filter
  })

  return (
    <div className="min-h-screen bg-[#11120D] text-[#FFFBF4]">
      <Navbar />
      <div className="pt-14">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Header */}
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-[#565449]">Incident History</p>
            <h1 className="mt-1 text-2xl font-bold text-[#FFFBF4]">All Incidents</h1>
          </div>

          {/* Heatmap */}
          <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#565449]">Activity — Incident Calendar</p>
              <div className="flex gap-1">
                {([90, 180, 365] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => { setHeatRange(d); fetchHeatmap(d).then(setHeatmap) }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${heatRange === d ? 'border-[#565449] text-[#D8CFBC] bg-[#565449]/20' : 'border-[#565449]/40 text-[#565449] hover:text-[#D8CFBC]'}`}
                  >
                    {d === 90 ? '3m' : d === 180 ? '6m' : '12m'}
                  </button>
                ))}
              </div>
            </div>
            <CalendarHeatmap cells={calendarCells} />
            <div className="mt-3 flex items-center justify-between">
              <p className="font-mono text-[10px] text-[#565449]">{calendarCells.filter(d => d.count > 0).length} active days · {calendarCells.reduce((a,d) => a + d.count, 0)} total incidents</p>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#565449]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{backgroundColor:'#2a2b22',border:'1px solid rgba(86,84,73,0.3)'}} /> none</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#565449]" /> P2</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#fcd34d]" /> P1</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#ef4444]" /> P0</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {(['all', 'P0', 'P1', 'P2'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                  filter === f
                    ? 'bg-[#565449] border-[#565449] text-[#FFFBF4]'
                    : 'border-[#565449]/40 text-[#D8CFBC]/50 hover:text-[#D8CFBC]'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
            <span className="ml-2 text-xs text-[#565449] font-mono">{filtered.length} incidents</span>
          </div>

          {/* Incident list */}
          {loading ? (
            <div className="text-sm text-[#D8CFBC]/40 font-mono">Loading incidents...</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((inc) => {
                const sev = (inc as any).severity || 'P2'
                const colors = severityColor(sev)
                const viewerCount = viewers[inc.id] || 0
                return (
                  <Link
                    key={inc.id}
                    to="/app"
                    search={{ incident: inc.id } as any}
                    className="group flex items-center gap-4 rounded-lg border border-[#565449]/30 bg-[#1D1E17] px-4 py-3 hover:border-[#565449]/60 hover:bg-[#1D1E17]/80 transition-all"
                  >
                    {/* Severity badge */}
                    <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {sev}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#FFFBF4] font-medium truncate">
                        {inc.scenario_name || 'Unknown incident'}
                      </p>
                      <p className="text-xs text-[#D8CFBC]/40 mt-0.5 font-mono">
                        {timeAgo(inc.created_at)}
                      </p>
                    </div>

                    {/* Viewers */}
                    {viewerCount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-[#10b981] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                        <Users className="h-3 w-3" />
                        {viewerCount}
                      </div>
                    )}

                    <ChevronRight className="h-4 w-4 text-[#565449] group-hover:text-[#D8CFBC] transition-colors shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
