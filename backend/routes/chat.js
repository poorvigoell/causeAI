import { Router } from 'express'
import Groq from 'groq-sdk'
import { buildChatSystemPrompt } from '../agent/prompts.js'
import { getAnalysisById } from '../db/supabase.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const router = Router()

function normalizeAnalysis(analysis) {
  if (!analysis) return null

  return {
    id: analysis.id || analysis.analysisId || null,
    incident_id: analysis.incident_id || analysis.incidentId || null,
    root_cause: analysis.root_cause || analysis.rootCause || 'Unknown',
    root_cause_service: analysis.root_cause_service || analysis.rootCauseService || 'Unknown',
    severity: analysis.severity || 'Unknown',
    confidence_score: analysis.confidence_score ?? analysis.confidenceScore ?? null,
    business_impact: analysis.business_impact || analysis.businessImpact || '',
    timeline: analysis.timeline || [],
    affected_services: analysis.affected_services || analysis.affectedServices || [],
    cascade_chain: analysis.cascade_chain || analysis.cascadeChain || [],
    immediate_fix: analysis.immediate_fix || analysis.immediateFix || '',
    permanent_fix: analysis.permanent_fix || analysis.permanentFix || '',
    blast_radius: analysis.blast_radius || analysis.blastRadius || {},
    alternatives: analysis.alternatives || [],
  }
}

router.post('/', async (req, res) => {
  const { analysisId, message, conversationHistory = [], analysis, history = [] } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  try {
    let context = null

    if (analysisId) {
      context = normalizeAnalysis(await getAnalysisById(analysisId))
      if (!context) return res.status(404).json({ error: 'Analysis not found' })
    } else if (analysis) {
      context = normalizeAnalysis(analysis)
    } else {
      return res.status(400).json({ error: 'analysisId or analysis context is required' })
    }

    const mergedHistory = Array.isArray(conversationHistory) && conversationHistory.length
      ? conversationHistory
      : history

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildChatSystemPrompt(context) },
        ...mergedHistory
          .slice(-12)
          .filter((entry) => entry?.role && entry?.content)
          .map((entry) => ({ role: entry.role, content: entry.content })),
        { role: 'user', content: message },
      ],
    })

    res.json({ reply: completion.choices?.[0]?.message?.content || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

