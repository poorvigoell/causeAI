import { runAnalysisPipeline } from '../agent/pipeline.js'

const clients = new Map()

function safeSend(socket, payload) {
  if (socket?.readyState === 1) {
    socket.send(JSON.stringify(payload))
  }
}

export function registerClient(clientId, ws) {
  clients.set(clientId, ws)
  ws.on('close', () => clients.delete(clientId))
  ws.on('error', () => clients.delete(clientId))
}

export function emitStep(clientId, payload) {
  const ws = clients.get(clientId)
  safeSend(ws, payload)
}

export function emitDone(clientId) {
  const ws = clients.get(clientId)
  safeSend(ws, { type: 'done' })
}

export function handleConnection(socket, request, _wss) {
  const state = {
    scenarioName: 'manual',
    lines: [],
  }

  const params = new URL(request.url, 'http://localhost').searchParams
  const clientId = params.get('clientId')
  if (clientId) registerClient(clientId, socket)

  safeSend(socket, { type: 'connected' })

  socket.on('message', async (raw) => {
    try {
      const payload = JSON.parse(raw.toString())
      const messageType = payload?.type

      if (messageType === 'START_STREAM') {
        state.scenarioName = payload.scenarioName || 'manual'
        state.lines = []
        safeSend(socket, { type: 'STREAM_STARTED', scenarioName: state.scenarioName })
        return
      }

      if (messageType === 'LOG_LINE') {
        if (typeof payload.line === 'string' && payload.line.trim()) {
          state.lines.push(payload.line)
        }
        safeSend(socket, { type: 'LINE_RECEIVED', count: state.lines.length })
        return
      }

      if (messageType === 'END_STREAM') {
        const logs = state.lines.join('\n')
        if (!logs.trim()) {
          safeSend(socket, { type: 'ERROR', message: 'No log lines received before END_STREAM' })
          return
        }

        const result = await runAnalysisPipeline(logs, state.scenarioName, async (step) => {
          safeSend(socket, { type: 'AGENT_STEP', ...step })
        })

        safeSend(socket, { type: 'ANALYSIS_COMPLETE', result })
        return
      }

      if (messageType === 'ANALYZE_BATCH') {
        const logs = typeof payload.logs === 'string' ? payload.logs : ''
        if (!logs.trim()) {
          safeSend(socket, { type: 'ERROR', message: 'logs are required for ANALYZE_BATCH' })
          return
        }

        const result = await runAnalysisPipeline(logs, payload.scenarioName || 'manual', async (step) => {
          safeSend(socket, { type: 'AGENT_STEP', ...step })
        })

        safeSend(socket, { type: 'ANALYSIS_COMPLETE', result })
        return
      }
    } catch (err) {
      safeSend(socket, { type: 'ERROR', message: err.message || 'Invalid WebSocket payload' })
    }
  })

  socket.on('error', (err) => {
    console.error('[WS] Socket error:', err.message)
  })
}

