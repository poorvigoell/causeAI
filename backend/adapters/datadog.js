export function normalizeDatadog(payload) {
  return {
    source: 'datadog',
    title: payload.title || payload.alert_title || 'Datadog Alert',
    severity: mapDatadogSeverity(payload.priority),
    service: extractService(payload.tags),
    raw_logs: buildLogString(payload),
    timestamp: new Date().toISOString()
  }
}

function mapDatadogSeverity(priority) {
  const map = { 'P1': 'P0', 'P2': 'P1', 'P3': 'P2', 'P4': 'P2' }
  return map[priority] || 'P2'
}

function extractService(tags) {
  if (!tags) return 'unknown'
  const tagList = typeof tags === 'string' ? tags.split(',') : tags
  const serviceTag = tagList.find(t => t.trim().startsWith('service:'))
  return serviceTag ? serviceTag.trim().split(':')[1] : 'unknown'
}

function buildLogString(payload) {
  return [
    `[${new Date().toISOString()}] DATADOG ALERT: ${payload.title}`,
    `Host: ${payload.hostname || 'unknown'}`,
    `Metric: ${payload.alert_metric || 'unknown'}`,
    `Value: ${payload.alert_transition || 'unknown'}`,
    `Priority: ${payload.priority || 'unknown'}`,
    `Tags: ${Array.isArray(payload.tags) ? payload.tags.join(', ') : payload.tags || 'none'}`,
    `Message: ${payload.body || ''}`,
    `Link: ${payload.link || ''}`
  ].join('\n')
}
