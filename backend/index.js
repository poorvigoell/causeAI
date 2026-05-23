import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import { WebSocketServer } from 'ws'

import analyzeRouter from './routes/analyze.js'
import incidentsRouter from './routes/incidents.js'
import postmortemRouter from './routes/postmortem.js'
import chatRouter from './routes/chat.js'
import webhookRouter from './routes/webhook.js'
import { handleConnection } from './websocket/streamHandler.js'

const app = express()

const defaultFrontendOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
]

const envOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(','),
]
  .map((origin) => origin?.trim())
  .filter(Boolean)

const allowedOrigins = new Set([...defaultFrontendOrigins, ...envOrigins])

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'causeai-backend', timestamp: new Date().toISOString() }))

app.use('/api/analyze', analyzeRouter)
app.use('/api/incidents', incidentsRouter)
app.use('/api/postmortem', postmortemRouter)
app.use('/api/chat', chatRouter)
app.use('/api/webhook', webhookRouter)

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (socket, request) => {
  handleConnection(socket, request, wss)
})

wss.on('error', (err) => console.error('[WS] Server error:', err.message))

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log('')
  console.log('┌─────────────────────────────────────────────┐')
  console.log('│         CauseAI Backend is running           │')
  console.log('├─────────────────────────────────────────────┤')
  console.log(`│  REST  →  http://localhost:${PORT}             │`)
  console.log(`│  WS    →  ws://localhost:${PORT}/ws            │`)
  console.log('└─────────────────────────────────────────────┘')
  console.log('')
})

process.on('SIGTERM', () => {
  wss.close(() => console.log('[WS] Server closed'))
  server.close(() => { console.log('[HTTP] Server closed'); process.exit(0) })
})

export { app, server, wss }
