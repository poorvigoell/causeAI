export function normalizeNewRelic(payload) {
  const target = payload.targets?.[0] || {}

  return {
    source: 'newrelic',
    title: payload.condition_name || 'New Relic Alert',
    severity: mapNewRelicSeverity(payload.severity),
    service: target.name || 'unknown',
    raw_logs: buildLogString(payload, target),
    timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString()
  }
}

function mapNewRelicSeverity(severity) {
  if (!severity) return 'P2'
  const s = severity.toLowerCase()
  if (s === 'critical') return 'P0'
  if (s === 'warning') return 'P1'
  return 'P2'
}

function buildLogString(payload, target) {
  const lines = [
    `[${new Date().toISOString()}] NEW RELIC ALERT: ${payload.condition_name || 'unknown'}`,
    `Status: ${payload.current_state || 'unknown'}`,
    `Severity: ${payload.severity || 'unknown'}`,
    `Affected target: ${target.name || 'unknown'}`,
    `Target link: ${target.link || 'none'}`,
    `Details: ${payload.details || 'none'}`,
    `Source: New Relic Alerts`
  ]

  const conditionName = (payload.condition_name || '').toLowerCase()
  if (conditionName.includes('cpu')) {
    lines.push(`ERROR: CPU saturation detected — processes may be starved`)
    lines.push(`ERROR: Request latency likely increasing due to CPU queuing`)
    lines.push(`WARN: Dependent services may experience timeouts`)
  } else if (conditionName.includes('memory') || conditionName.includes('mem')) {
    lines.push(`ERROR: Memory pressure detected — OOM risk elevated`)
    lines.push(`ERROR: Swap usage may be increasing`)
    lines.push(`WARN: Services may begin failing memory allocations`)
  } else if (conditionName.includes('disk')) {
    lines.push(`ERROR: Disk space critical — write operations may fail`)
    lines.push(`ERROR: Database WAL writes at risk`)
  }

  return lines.join('\n')
}
