import express from 'express'
import Groq from 'groq-sdk'
import { supabase } from '../db/supabase.js'

const router = express.Router()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

router.post('/generate', async (req, res) => {
  const { incidentId, analysis, executedActions } = req.body

  const prompt = `Given this incident and successful remediation, write a runbook for future on-call engineers.

Analysis: ${JSON.stringify(analysis)}
Actions executed: ${JSON.stringify(executedActions)}

Return ONLY valid JSON:
{
  "title": "runbook title",
  "trigger_pattern": "when to use this",
  "detection_signals": ["signal1", "signal2"],
  "steps": [
    {
      "order": 1,
      "action": "what to do",
      "command": "actual command if applicable",
      "verify": "how to confirm it worked"
    }
  ],
  "estimated_time_minutes": 5,
  "escalation_path": "if runbook fails, do this"
}`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })

    const text = response.choices[0].message.content
    const runbook = JSON.parse(text.replace(/```json|```/g, '').trim())

    const rootCauseService = analysis?.root_cause_service || 'unknown'

    const { data: existing } = await supabase
      .from('runbooks')
      .select('*')
      .eq('team_id', 'sre-team-01')
      .eq('root_cause_service', rootCauseService)
      .single()

    if (existing) {
      await supabase.from('runbooks')
        .update({ times_used: existing.times_used + 1, last_used_at: new Date().toISOString(), steps: runbook.steps })
        .eq('id', existing.id)
    } else {
      await supabase.from('runbooks').insert({
        team_id: 'sre-team-01',
        root_cause_service: rootCauseService,
        failure_pattern: runbook.trigger_pattern,
        steps: runbook.steps,
        last_used_at: new Date().toISOString()
      })
    }

    res.json({ success: true, runbook })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/team/:teamId', async (req, res) => {
  const { data } = await supabase
    .from('runbooks')
    .select('*')
    .eq('team_id', req.params.teamId)
    .order('times_used', { ascending: false })
  res.json(data || [])
})

router.get('/match/:incidentId', async (req, res) => {
  const { data: analysis } = await supabase
    .from('analysis_results')
    .select('root_cause_service')
    .eq('incident_id', req.params.incidentId)
    .single()

  if (!analysis) return res.json({ match: null })

  const { data: runbook } = await supabase
    .from('runbooks')
    .select('*')
    .eq('root_cause_service', analysis.root_cause_service)
    .single()

  res.json({ match: runbook || null })
})

export default router
