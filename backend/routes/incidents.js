import { Router } from 'express'
import { fetchIncidentHistory, fetchServiceTrend, getFullIncident } from '../db/supabase.js'

const router = Router()

router.get('/', async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 50
  try {
    const incidents = await fetchIncidentHistory(Math.max(1, Math.min(limit, 200)))
    res.json({ incidents, total: incidents.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/trend/:serviceName', async (req, res) => {
  const serviceName = req.params.serviceName?.trim()
  if (!serviceName) return res.status(400).json({ error: 'serviceName is required' })

  try {
    const trend = await fetchServiceTrend(serviceName)
    res.json(trend)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const incident = await getFullIncident(req.params.id)
    if (!incident) return res.status(404).json({ error: 'Incident not found' })
    res.json(incident)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

