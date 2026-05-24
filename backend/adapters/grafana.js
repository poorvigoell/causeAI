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
  return 'P2'
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
      lines.push(`Name: ${alert.labels?.alertname || 'unknown'}`)
      lines.push(`Service: ${alert.labels?.service || alert.labels?.job || 'unknown'}`)
      lines.push(`Severity: ${alert.labels?.severity || 'unknown'}`)
      lines.push(`Summary: ${alert.annotations?.summary || ''}`)
      lines.push(`Values: ${JSON.stringify(alert.values || {})}`)
      lines.push(`Started: ${alert.startsAt || 'unknown'}`)
    })
  }

  return lines.join('\n')
}
