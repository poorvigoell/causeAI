const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001'

const grafanaPayload = {
  title: "🔴 CRITICAL: High Error Rate — api-gateway",
  status: "firing",
  message: "Error rate exceeded critical threshold of 5%",
  externalURL: "http://localhost:3000",
  alerts: [
    {
      labels: {
        alertname: "HighErrorRate",
        service: "api-gateway",
        severity: "critical",
        job: "api-gateway",
        env: "production"
      },
      annotations: {
        summary: "api-gateway error rate at 94.2%",
        description: "Upstream Redis connection failures causing auth timeouts. 8,400 users affected."
      },
      values: {
        error_rate: 94.2,
        request_count: 2100,
        latency_p99: 28000
      },
      startsAt: new Date().toISOString(),
      fingerprint: "abc123demo"
    }
  ]
}

async function fire() {
  console.log('🚀 Firing demo alert to CauseAI...')
  const res = await fetch(`${BASE_URL}/api/ingest/grafana`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(grafanaPayload)
  })
  const data = await res.json()
  console.log('✅ Response:', data)
  console.log('👀 Watch your CauseAI dashboard for automatic analysis')
}

fire().catch(console.error)
