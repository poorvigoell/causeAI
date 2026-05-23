import { Router } from 'express'
import { runAnalysisPipeline } from '../agent/pipeline.js'
import { emitStep, emitDone } from '../websocket/streamHandler.js'

const router = Router()

router.post('/', async (req, res) => {
  const { logs, scenarioName, clientId } = req.body
  if (!logs) return res.status(400).json({ error: 'logs are required' })
  const steps = []
  try {
    const result = await runAnalysisPipeline(logs, scenarioName, async (step) => {
      steps.push(step)
      if (clientId) emitStep(clientId, step)
    })
    if (clientId) emitDone(clientId)
    res.json({ success: true, result, steps })
  } catch (err) {
    console.error('[ANALYZE]', err.message)
    res.status(500).json({ error: err.message, steps })
  }
})

export default router
