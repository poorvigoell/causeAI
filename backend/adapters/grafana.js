export function normalizeGrafana(payload) {
  const alert = payload.alerts?.[0] || {}

  return {
    source: 'grafana',
    title: payload.title || alert.labels?.alertname || 'Grafana Alert',
    severity: mapGrafanaSeverity(payload.status, alert.labels?.severity),
    service: alert.labels?.service || alert.labels?.job || 'unknown',
    raw_logs: buildLogString(payload),
    timestamp: alert.startsAt || new Date().toISOString()
  }
}

function mapGrafanaSeverity(status, severity) {
  if (status !== 'firing') return 'P2'
  if (severity === 'critical') return 'P0'
  if (severity === 'warning') return 'P1'
  return 'P1' // change P2 to P1 as default for firing alerts
}

function buildLogString(payload) {
  const lines = [
    `[${new Date().toISOString()}] GRAFANA ALERT: ${payload.title}`,
    `Status: ${payload.status}`,
    `Message: ${payload.message || ''}`,
  ]

  if (payload.alerts?.length) {
    payload.alerts.forEach((alert, i) => {
      lines.push(`--- Alert ${i + 1} ---`)
      lines.push(`ALERT: ${alert.labels?.alertname || 'Unknown Alert'}`)
      lines.push(`Service: ${alert.labels?.service || alert.labels?.job || 'unknown'}`)
      lines.push(`Instance: ${alert.labels?.instance || 'unknown'}`)
      lines.push(`Severity: ${alert.labels?.severity || 'unknown'}`)
      lines.push(`Status: ${alert.status || payload.status}`)
      lines.push(`Metric Value: ${alert.valueString || JSON.stringify(alert.values || {}) || 'N/A'}`)
      lines.push(`Summary: ${alert.annotations?.summary || ''}`)
      lines.push(`Description: ${alert.annotations?.description || ''}`)
      lines.push(`Alert started: ${alert.startsAt || 'unknown'}`)
      lines.push(`Source: Grafana Alertmanager`)
      
      lines.push(`Alert rule: ${alert.labels?.alertname || 'unknown'}`)
      lines.push(`Affected host: ${alert.labels?.instance || 'host machine'}`)
      lines.push(`Metric exceeded threshold — resource saturation likely`)
      
      const alertname = (alert.labels?.alertname || '').toLowerCase()
      if (alertname.includes('cpu')) {
        lines.push(`ERROR: CPU saturation detected — processes may be starved`)
        lines.push(`ERROR: Request latency likely increasing due to CPU queuing`)
        lines.push(`WARN: Dependent services may experience timeouts`)
      } else if (alertname.includes('memory') || alertname.includes('mem')) {
        lines.push(`ERROR: Memory pressure detected — OOM risk elevated`)
        lines.push(`ERROR: Swap usage may be increasing`)
        lines.push(`WARN: Services may begin failing memory allocations`)
      } else if (alertname.includes('disk')) {
        lines.push(`ERROR: Disk space critical — write operations may fail`)
        lines.push(`ERROR: Database WAL writes at risk`)
      }
    })
  }

  return lines.join('\n')
}
