# CauseAI
**AI-powered incident response and root cause analysis platform for SRE and DevOps teams.**
CauseAI automatically ingests monitoring alerts from Grafana, Datadog, and New Relic, runs an AI agent over the raw logs, and produces a structured incident report in real time — including root cause, cascade chain, blast radius, and a full postmortem — without any manual effort.
---
## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Running Locally](#running-locally)
8. [Webhook Integrations](#webhook-integrations)
9. [Core Features](#core-features)
10. [API Reference](#api-reference)
11. [WebSocket Events](#websocket-events)
12. [Changelog](#changelog)
---
## Overview
When an alert fires in your monitoring stack, CauseAI:
1. Receives the webhook payload and normalizes it into a standard format.
2. Saves the raw incident to Supabase.
3. Kicks off a 6-step AI analysis pipeline (powered by **Llama 3.3 70B via Groq**).
4. Streams progress updates to any connected browser in real time over WebSockets.
5. Saves the structured analysis (root cause, blast radius, cascade chain, timeline) back to Supabase.
6. Broadcasts a refresh event so all open dashboards update instantly — no reload required.
---
## Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TanStack Router |
| **Styling** | TailwindCSS v4, custom dark-mode design system |
| **Backend** | Node.js 18+, Express 4, ES Modules |
| **Real-time** | WebSockets (`ws` library) |
| **AI Model** | Llama 3.3 70B via Groq SDK |
| **Database** | Supabase (PostgreSQL) |
| **Monitoring Stack** | Prometheus + Grafana (via `monitoring/docker-compose.yml`) |
---
## Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (cause-sight)                    │
│                                                                 │
│  ┌──────────────┐   REST API    ┌──────────────────────────┐   │
│  │  Dashboard   │ ◄──────────── │  Backend (Express)       │   │
│  │  (app.tsx)   │               │  :3001                   │   │
│  │              │   WebSocket   │                          │   │
│  │              │ ◄─────────── │  /ws  (stream handler)   │   │
│  └──────────────┘               └────────────┬─────────────┘   │
└──────────────────────────────────────────────┼─────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────┐
                    │                          │                  │
             ┌──────▼──────┐          ┌────────▼───────┐  ┌──────┴──────┐
             │   Groq AI   │          │   Supabase DB  │  │  Grafana /  │
             │ (Llama 3.3) │          │  (PostgreSQL)  │  │  Datadog /  │
             └─────────────┘          └────────────────┘  │  New Relic  │
                                                           └─────────────┘
```
**Data flow for an incoming alert:**
```
Grafana Webhook → POST /api/ingest/grafana
  → normalize payload
  → INSERT incident into Supabase
  → broadcast REFRESH_INCIDENTS to all WebSocket clients
  → POST /api/analyze (async, non-blocking to HTTP response)
    → runAnalysisPipeline (6 steps, streamed via WS)
    → INSERT analysis_results into Supabase
    → broadcast REFRESH_INCIDENTS again (analysis now complete)
```
---
## Project Structure
```
causeai/
├── backend/                    # Node.js/Express API server
│   ├── adapters/               # Normalize incoming webhook payloads
│   │   ├── grafana.js
│   │   ├── datadog.js
│   │   └── newrelic.js
│   ├── agent/                  # AI pipeline
│   │   ├── pipeline.js         # 6-step analysis orchestrator
│   │   ├── prompts.js          # System + user prompts for Llama
│   │   ├── remediationAgent.js # Auto-remediation for P0 incidents
│   │   └── remediationPrompts.js
│   ├── db/
│   │   └── supabase.js         # All database reads/writes
│   ├── middleware/             # Express middleware (auth, etc.)
│   ├── routes/                 # API route handlers
│   │   ├── analyze.js          # POST /api/analyze
│   │   ├── briefing.js         # On-call briefing generation
│   │   ├── chat.js             # AI chat about an incident
│   │   ├── incidents.js        # GET /api/incidents
│   │   ├── ingest.js           # Webhook ingestion endpoints
│   │   ├── postmortem.js       # Postmortem CRUD
│   │   ├── predict.js          # Predictive blast radius
│   │   ├── remediate.js        # Remediation agent control
│   │   ├── runbook.js          # Runbook generation
│   │   ├── warroom.js          # War room session management
│   │   └── webhook.js          # Generic webhook handler
│   ├── tools/                  # Utility helpers
│   ├── websocket/
│   │   └── streamHandler.js    # WebSocket connection + broadcast logic
│   ├── index.js                # Server entry point
│   ├── .env.example
│   └── package.json
│
├── cause-sight/                # React frontend (Vite + TanStack Router)
│   └── src/
│       ├── components/
│       │   ├── Navbar.tsx
│       │   └── ui/             # Shared UI primitives
│       ├── context/
│       │   └── AuthContext.tsx
│       ├── hooks/              # Custom React hooks
│       ├── lib/
│       │   ├── causeai-api.ts  # All API/WebSocket client functions + types
│       │   └── postmortem.ts   # Postmortem generation helpers
│       └── routes/
│           ├── index.tsx       # Landing / marketing page
│           ├── app.tsx         # Main incident workspace (primary dashboard)
│           ├── history.tsx     # Full incident history page
│           ├── team.tsx        # Team presence page
│           └── -login.tsx      # Login page
│
└── monitoring/                 # Local observability stack
    ├── docker-compose.yml      # Runs Prometheus + Grafana locally
    └── prometheus.yml          # Prometheus scrape config
```
---
## Getting Started
### Prerequisites
- Node.js 18 or later
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Groq](https://console.groq.com) API key (free tier is fine)
### Installation
```bash
# 1. Clone the repo
git clone https://github.com/your-org/causeai.git
cd causeai
# 2. Install backend dependencies
cd backend && npm install
# 3. Install frontend dependencies
cd ../cause-sight && npm install
```
---
## Environment Variables
### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and fill in:
```env
GROQ_API_KEY=gsk_...          # Your Groq API key
SUPABASE_URL=https://...      # Your Supabase project URL
SUPABASE_ANON_KEY=eyJ...      # Your Supabase anon public key
PORT=3001                     # Port the backend listens on
FRONTEND_URL=http://localhost:5173  # Allowed CORS origin
NODE_ENV=development
```
### Frontend (`cause-sight/.env`)
```env
VITE_CAUSEAI_API_BASE_URL=http://localhost:3001/api
VITE_CAUSEAI_WS_URL=ws://localhost:3001/ws
```
> In production, point these to your deployed backend URL (e.g., Render, Railway, Fly.io).
---
## Running Locally
Open two terminals:
```bash
# Terminal 1 — Backend
cd backend
npm run dev
# → Running at http://localhost:3001
# → WebSocket at ws://localhost:3001/ws
```
```bash
# Terminal 2 — Frontend
cd cause-sight
npm run dev
# → Running at http://localhost:5173
```
### Optional: Local Monitoring Stack (Prometheus + Grafana)
```bash
cd monitoring
docker-compose up -d
# Grafana → http://localhost:3000 (admin / admin)
# Prometheus → http://localhost:9090
```
---
## Webhook Integrations
### Grafana
1. Go to your Grafana instance → **Alerting → Contact Points → Add Contact Point**.
2. Choose **Webhook**.
3. Set URL to: `http://your-backend:3001/api/ingest/grafana`
4. Method: `POST`
5. Save and link to an alert rule.
### Datadog
Configure a **Webhook Integration** in Datadog settings:
- URL: `http://your-backend:3001/api/ingest/datadog`
### New Relic
Use **New Relic Alerts → Notification Channels → Webhook**:
- URL: `http://your-backend:3001/api/ingest/newrelic`
### Test Endpoint
Send a built-in synthetic P0 alert for local testing:
```bash
curl -X POST http://localhost:3001/api/ingest/test
```
---
## Core Features
### 🔍 Root Cause Analysis
The AI pipeline processes raw logs through 6 streaming steps:
1. Parse log structure (services detected, line count)
2. Query incident history for pattern matching
3. Identify root cause via Llama 3.3 70B
4. Trace the failure cascade chain
5. Save incident and analysis to Supabase
6. Find similar past incidents
Output includes: root cause description, root cause service, severity (P0–P2), cascade chain, timeline, and affected services with health statuses.
### 💥 Blast Radius Estimation
Automatically calculates business impact from log patterns:
- Estimated users affected
- Failed API requests
- Stuck messages/webhooks
- Oversold and misrouted orders
- Affected endpoints
### 📡 Real-Time Streaming
As the AI processes an incident, each of the 6 pipeline steps is streamed live to the browser via WebSocket, showing the current step label and detail text.
### 🔄 Auto-Refresh Dashboard
The dashboard maintains a persistent WebSocket connection. The backend broadcasts a `REFRESH_INCIDENTS` event when:
- A new webhook alert is ingested
- An AI analysis completes
All connected clients update automatically — no browser reload required.
### 🏷️ Source Tracking
Every incident is tagged with its origin:
- `grafana` — Grafana alert webhook
- `datadog` — Datadog webhook
- `newrelic` — New Relic webhook
- `manual` — Manually pasted log entry via the UI composer
- `test` — Test alert
The source is displayed as a color-coded badge in the dashboard sidebar and incident header.
### 📝 Postmortem Generation
One-click generation of a structured postmortem document from the AI analysis, formatted in Markdown for easy copy-paste into Notion, Confluence, or Jira.
### 🤖 On-Call Briefing
Generates a concise on-call handoff brief for the incident, summarising what happened, what's affected, and what's been done.
### 💬 AI Chat
Context-aware chat interface scoped to the selected incident — ask follow-up questions about the root cause, remediation steps, or impact.
### 📚 Runbook Generation
Auto-generates a service-specific runbook based on the incident's root cause service and failure mode.
### 🛠️ Auto-Remediation Agent (P0)
For P0 severity incidents, a remediation agent is automatically triggered after ingest to propose and (optionally) execute fix steps.
### 📊 Incident Heatmap
A GitHub-style contribution heatmap showing incident frequency and severity over the past 365 days.
### 👥 Team Presence
Real-time team presence shown in the UI — see which teammates are viewing the same incident using the WebSocket presence system.
### 🔮 Shadow Incident Scanner
Scans for "shadow incidents" — incidents that are structurally similar to the current one and may indicate a recurring systemic issue.
---
## API Reference
### Ingestion
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingest/grafana` | Receive Grafana webhook alert |
| `POST` | `/api/ingest/datadog` | Receive Datadog webhook alert |
| `POST` | `/api/ingest/newrelic` | Receive New Relic webhook alert |
| `POST` | `/api/ingest/test` | Send a synthetic P0 test alert |
| `GET`  | `/api/ingest/ping` | Check ingest route is live |
### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Analyze raw logs (body: `{ logs, scenarioName, clientId }`) |
### Incidents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/incidents` | List incidents (query: `?limit=50`) |
| `GET` | `/api/incidents/:id` | Get single incident with analysis |
### Other Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/postmortem` | Generate or save a postmortem |
| `POST` | `/api/chat` | AI chat about an incident |
| `POST` | `/api/briefing/:id` | Generate on-call briefing |
| `POST` | `/api/runbook/:id` | Generate runbook |
| `POST` | `/api/predict` | Predict blast radius |
| `POST` | `/api/remediate/:id/start` | Start remediation agent |
| `GET`  | `/health` | Backend health check |
---
## WebSocket Events
The WebSocket server runs at `ws://localhost:3001/ws`.
Connect with a `clientId` query param: `ws://localhost:3001/ws?clientId=<uuid>`
### Server → Client Events
| Event type | Payload | Description |
|---|---|---|
| `connected` | — | Sent on successful connection |
| `AGENT_STEP` | `{ step, label, detail, status }` | Analysis pipeline progress update |
| `ANALYSIS_COMPLETE` | `{ result }` | Full analysis result |
| `REFRESH_INCIDENTS` | — | Broadcast to all clients: fetch latest incidents |
| `PRESENCE_UPDATE` | `{ users[] }` | Live team presence update |
| `done` | — | Analysis stream finished |
| `ERROR` | `{ message }` | Error during processing |
### Client → Server Events
| Event type | Payload | Description |
|---|---|---|
| `ANALYZE_BATCH` | `{ logs, scenarioName }` | Run analysis on a batch of logs |
| `START_STREAM` | `{ scenarioName }` | Begin a log streaming session |
| `LOG_LINE` | `{ line }` | Send a single log line |
| `END_STREAM` | — | End stream and trigger analysis |
| `PRESENCE` | `{ name, teamId, avatarColor, page }` | Broadcast user presence |
---
## Changelog
### 2026-05-25
- **Auto-Refresh via WebSocket**: Backend now broadcasts `REFRESH_INCIDENTS` to all connected clients when a new incident is ingested or an analysis completes. Frontend maintains a persistent background WebSocket to receive this event without polling.
- **Source Tracking**: Added `source` column to the incidents database table. All ingest adapters tag the source correctly. A `SourceBadge` component in the UI displays the origin of each incident (Grafana, Datadog, New Relic, Manual, Test).
- **Smart Initial Load**: Dashboard now auto-selects the most recently *analyzed* incident on first load, avoiding a blank workspace state if the newest incident is still being analyzed. Added an "Analysis Pending ⏳" placeholder state for incidents awaiting analysis.
- **Empty State Handling**: If the database has zero incidents, the log composer opens automatically.
- **Visibility Improvements**: Timestamps ("Analyzed 2s ago") and the Manual Log Entry badge text are now rendered in high-contrast white for better readability.
