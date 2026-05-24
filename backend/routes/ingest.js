import express from 'express'
import { normalizeDatadog } from '../adapters/datadog.js'
import { normalizeGrafana } from '../adapters/grafana.js'
import { normalizeNewRelic } from '../adapters/newrelic.js'
import { supabase } from '../db/supabase.js'

const router = express.Router()

router.post('/datadog', async (req, res) => {
  console.log('📥 Datadog webhook received:', JSON.stringify(req.body, null, 2))
  try {
    const normalized = normalizeDatadog(req.body)
    const incident = await triggerAnalysis(normalized)
    res.status(200).json({ received: true, incidentId: incident.id })
  } catch (err) {
    console.error('Datadog ingest error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/grafana', async (req, res) => {
  console.log('📥 Grafana webhook received:', JSON.stringify(req.body, null, 2))
  try {
    const normalized = normalizeGrafana(req.body)
    const incident = await triggerAnalysis(normalized)
    res.status(200).json({ received: true, incidentId: incident.id })
  } catch (err) {
    console.error('Grafana ingest error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/newrelic', async (req, res) => {
  console.log('📥 New Relic webhook received:', JSON.stringify(req.body, null, 2))
  try {
    const normalized = normalizeNewRelic(req.body)
    const incident = await triggerAnalysis(normalized)
    res.status(200).json({ received: true, incidentId: incident.id })
  } catch (err) {
    console.error('New Relic ingest error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/test', async (req, res) => {
  const normalized = {
    source: 'test',
    title: 'Test Alert — High Error Rate on api-gateway',
    severity: 'P0',
    service: 'api-gateway',
    raw_logs: [
      `[${new Date().toISOString()}] ERROR: Connection refused redis:6379`,
      `[${new Date().toISOString()}] ERROR: auth-service timeout after 30000ms`,
      `[${new Date().toISOString()}] ERROR: api-gateway returning 503`,
      `[${new Date().toISOString()}] WARN: Error rate at 94.2%`,
      `[${new Date().toISOString()}] ERROR: Redis maxmemory reached, eviction failed`
    ].join('\n'),
    timestamp: new Date().toISOString()
  }

  try {
    const incident = await triggerAnalysis(normalized)
    res.json({ success: true, incidentId: incident.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Ping — so Aayush can verify route is registered
router.get('/ping', (req, res) => {
  res.json({ status: 'ingest route live' })
})

async function triggerAnalysis(normalized) {
  const { data: incident, error } = await supabase
    .from('incidents')
    .insert({
      scenario_name: normalized.title,
      raw_logs: normalized.raw_logs,
      log_line_count: normalized.raw_logs.split('\n').length,
      source: normalized.source,
      severity: normalized.severity,
      auto_triggered: true,
      team_id: 'sre-team-01'
    })
    .select()
    .single()

  if (error) throw error

  console.log(`✅ Incident created: ${incident.id}`)

  // Kick off AI analysis
  try {
    await fetch('http://localhost:3001/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: incident.id,
        logs: normalized.raw_logs
      })
    })
  } catch (err) {
    console.error('Analysis pipeline call failed:', err.message)
  }

  // JOIN POINT — kick off remediation agent for P0 alerts
  if (normalized.severity === 'P0') {
    try {
      await fetch(`http://localhost:3001/api/remediate/${incident.id}/start`, {
        method: 'POST'
      })
      console.log(`🤖 Remediation agent started for incident ${incident.id}`)
    } catch (err) {
      console.error('Remediation agent call failed:', err.message)
    }
  }

  return incident
}

export default router