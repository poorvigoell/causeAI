import express from 'express'
import { addNote, claimService, getRoomState } from '../websocket/warRoom.js'

const router = express.Router()

router.post('/:incidentId/note', (req, res) => {
  const { engineer, text, teamId } = req.body
  addNote(req.params.incidentId, teamId, engineer, text)
  res.json({ success: true })
})

router.post('/:incidentId/claim', (req, res) => {
  const { engineer, service, teamId } = req.body
  claimService(req.params.incidentId, teamId, engineer, service)
  res.json({ success: true })
})

router.get('/:incidentId/state', (req, res) => {
  res.json(getRoomState(req.params.incidentId))
})

export default router
