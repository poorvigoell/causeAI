import { supabase } from '../db/supabase.js'

const rooms = new Map()
const presenceMap = new Map() // teamId -> Map(name -> user info)

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

function getTeamPresence(teamId) {
  if (!presenceMap.has(teamId)) {
    presenceMap.set(teamId, new Map())
  }
  return presenceMap.get(teamId)
}

export function handlePresence(ws, data) {
  const { name, teamId, avatarColor, page, incidentId } = data
  const team = getTeamPresence(teamId)

  team.set(name, {
    name,
    avatarColor,
    page,
    incidentId: incidentId || null,
    lastSeen: Date.now(),
    ws
  })

  // Broadcast presence update to all teammates
  const users = [...team.values()]
    .filter(u => Date.now() - u.lastSeen < 30000)
    .map(u => ({ name: u.name, avatarColor: u.avatarColor, page: u.page, incidentId: u.incidentId }))

  team.forEach((u) => {
    if (u.ws && u.ws.readyState === 1) {
      u.ws.send(JSON.stringify({ type: 'PRESENCE_UPDATE', users }))
    }
  })

  // Also send viewer counts for the history page
  broadcastViewerCounts(teamId)

  ws.on('close', () => {
    team.delete(name)
    const remaining = [...team.values()]
      .filter(u => Date.now() - u.lastSeen < 30000)
      .map(u => ({ name: u.name, avatarColor: u.avatarColor, page: u.page, incidentId: u.incidentId }))
    team.forEach((u) => {
      if (u.ws && u.ws.readyState === 1) {
        u.ws.send(JSON.stringify({ type: 'PRESENCE_UPDATE', users: remaining }))
      }
    })
    broadcastViewerCounts(teamId)
  })
}

function broadcastViewerCounts(teamId) {
  const team = getTeamPresence(teamId)
  const counts = {}
  team.forEach((u) => {
    if (u.incidentId) {
      counts[u.incidentId] = (counts[u.incidentId] || 0) + 1
    }
  })
  team.forEach((u) => {
    if (u.ws && u.ws.readyState === 1) {
      u.ws.send(JSON.stringify({ type: 'VIEWER_COUNTS', counts }))
    }
  })
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
