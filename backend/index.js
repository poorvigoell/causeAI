import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';

import analyzeRouter from './routes/analyze.js';
import incidentsRouter from './routes/incidents.js';
import postmortemRouter from './routes/postmortem.js';
import chatRouter from './routes/chat.js';
import remediateRouter from './routes/remediate.js';
import warRoomRouter from './routes/warroom.js';
import runbookRouter from './routes/runbook.js';
import ingestRouter from './routes/ingest.js';
import predictRouter from './routes/predict.js';
import briefingRouter from './routes/briefing.js';
import { handleConnection } from './websocket/streamHandler.js';

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'causeai-backend', timestamp: new Date().toISOString() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/postmortem', postmortemRouter);
app.use('/api/chat', chatRouter);
app.use('/api/remediate', remediateRouter);
app.use('/api/warroom', warRoomRouter);
app.use('/api/runbook', runbookRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/predict', predictRouter);
app.use('/api/briefing', briefingRouter);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket, request) => {
  console.log(`[WS] New connection from ${request.socket.remoteAddress}`);
  handleConnection(socket, request, wss);
});

wss.on('error', (err) => console.error('[WS] Server error:', err.message));

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('');
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│         CauseAI Backend is running           │');
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│  REST  →  http://localhost:${PORT}             │`);
  console.log(`│  WS    →  ws://localhost:${PORT}/ws            │`);
  console.log('└─────────────────────────────────────────────┘');
  console.log('');
});

process.on('SIGTERM', () => {
  wss.close(() => console.log('[WS] Server closed'));
  server.close(() => { console.log('[HTTP] Server closed'); process.exit(0); });
});

export { app, server, wss };
