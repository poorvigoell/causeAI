import { supabase } from '../db/supabase.js'

const rooms = new Map()

function getRoom(incidentId) {
  if (!rooms.has(incidentId)) {
    rooms.set(incidentId, {
      participants: new Map(),
      timeline: [],
      ownership: {}
    })
  }
  return rooms.get(incidentId)
}

export function joinRoom(ws, incidentId, engineer, teamId) {
  const room = getRoom(incidentId)
  room.participants.set(engineer, ws)

  ws.send(JSON.stringify({
    type: 'SYNC',
    participants: [...room.participants.keys()],
    timeline: room.timeline,
    ownership: room.ownership
  }))

  broadcastToRoom(incidentId, {
    type: 'JOIN',
    actor: engineer,
    payload: { participants: [...room.participants.keys()] },
    timestamp: new Date().toISOString()
  }, engineer)

  saveEvent(incidentId, teamId, 'join', engineer, {})
  ws.on('close', () => leaveRoom(incidentId, engineer, teamId))
}

export function leaveRoom(incidentId, engineer, teamId) {
  const room = rooms.get(incidentId)
  if (!room) return
  room.participants.delete(engineer)
  broadcastToRoom(incidentId, {
    type: 'LEAVE',
    actor: engineer,
    payload: { participants: [...room.participants.keys()] },
    timestamp: new Date().toISOString()
  })
  saveEvent(incidentId, teamId, 'leave', engineer, {})
}

export function addNote(incidentId, teamId, engineer, text) {
  const room = getRoom(incidentId)
  const event = { type: 'NOTE', actor: engineer, payload: { text }, timestamp: new Date().toISOString() }
  room.timeline.push(event)
  broadcastToRoom(incidentId, event)
  saveEvent(incidentId, teamId, 'note', engineer, { text })
}

export function claimService(incidentId, teamId, engineer, service) {
  const room = getRoom(incidentId)
  room.ownership[service] = engineer
  const event = { type: 'CLAIM', actor: engineer, payload: { service, ownership: room.ownership }, timestamp: new Date().toISOString() }
  room.timeline.push(event)
  broadcastToRoom(incidentId, event)
  saveEvent(incidentId, teamId, 'claim', engineer, { service })
}

export function broadcastAgentAction(incidentId, action) {
  const event = { type: 'AGENT_ACTION', actor: 'CauseAI Agent', payload: action, timestamp: new Date().toISOString() }
  broadcastToRoom(incidentId, event)
  getRoom(incidentId).timeline.push(event)
}

export function broadcastRecovery(incidentId, summary) {
  broadcastToRoom(incidentId, {
    type: 'RECOVERY',
    actor: 'CauseAI Agent',
    payload: summary,
    timestamp: new Date().toISOString()
  })
}

export function getRoomState(incidentId) {
  const room = rooms.get(incidentId)
  if (!room) return { participants: [], timeline: [], ownership: {} }
  return {
    participants: [...room.participants.keys()],
    timeline: room.timeline,
    ownership: room.ownership
  }
}

function broadcastToRoom(incidentId, event, excludeActor = null) {
  const room = rooms.get(incidentId)
  if (!room) return
  room.participants.forEach((ws, name) => {
    if (name !== excludeActor && ws.readyState === 1) {
      ws.send(JSON.stringify(event))
    }
  })
}

async function saveEvent(incidentId, teamId, eventType, actor, content) {
  try {
    await supabase.from('war_room_events').insert({
      incident_id: incidentId,
      team_id: teamId || 'sre-team-01',
      event_type: eventType,
      actor,
      content
    })
  } catch (err) {
    console.error('[WarRoom] saveEvent error:', err.message)
  }
}
