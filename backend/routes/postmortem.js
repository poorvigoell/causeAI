import { Router } from 'express'
import Groq from 'groq-sdk'
import {
  fetchPostmortems,
  getAnalysisById,
  getFullIncident,
  insertPostmortem,
} from '../db/supabase.js'
import { buildPostMortemPrompt } from '../agent/prompts.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const router = Router()

function normalizeAnalysis(analysisRow) {
  if (!analysisRow) return null
  return {
    id: analysisRow.id,
    incidentId: analysisRow.incident_id,
    rootCause: analysisRow.root_cause,
    rootCauseService: analysisRow.root_cause_service,
    confidenceScore: analysisRow.confidence_score,
    severity: analysisRow.severity,
    businessImpact: analysisRow.business_impact,
    timeline: analysisRow.timeline || [],
    affectedServices: analysisRow.affected_services || [],
    cascadeChain: analysisRow.cascade_chain || [],
    immediateFix: analysisRow.immediate_fix || '',
    permanentFix: analysisRow.permanent_fix || '',
    blastRadius: analysisRow.blast_radius || {},
    alternatives: analysisRow.alternatives || [],
  }
}

router.post('/:analysisId', async (req, res) => {
  const analysisId = req.params.analysisId
  if (!analysisId) return res.status(400).json({ error: 'analysisId is required' })

  try {
    const analysisRow = await getAnalysisById(analysisId)
    if (!analysisRow) return res.status(404).json({ error: 'Analysis not found' })

    const incident = await getFullIncident(analysisRow.incident_id)
    if (!incident) return res.status(404).json({ error: 'Incident not found' })

    const normalizedAnalysis = normalizeAnalysis(analysisRow)
    const prompt = buildPostMortemPrompt(normalizedAnalysis, incident)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const reportMarkdown = completion.choices?.[0]?.message?.content?.trim()
    if (!reportMarkdown) throw new Error('Post-mortem generation returned an empty response')

    const title = `Postmortem: ${normalizedAnalysis.rootCauseService || incident.scenario_name || 'Incident'} (${normalizedAnalysis.severity || 'P2'})`
    const saved = await insertPostmortem(
      incident.id,
      analysisId,
      title,
      reportMarkdown,
    )

    res.json({
      postmortemId: saved.id,
      title: saved.title || title,
      reportMarkdown: saved.report_markdown || saved.content || reportMarkdown,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { incident_id, analysis_id, title, content, report_markdown } = req.body
  const markdown = report_markdown || content
  if (!markdown) return res.status(400).json({ error: 'report markdown is required' })

  try {
    const pm = await insertPostmortem(incident_id || null, analysis_id || null, title || 'Postmortem', markdown)
    res.json(pm)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (_req, res) => {
  try {
    const postmortems = await fetchPostmortems()
    res.json(postmortems)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

