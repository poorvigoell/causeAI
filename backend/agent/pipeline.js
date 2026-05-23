import Groq from 'groq-sdk'
import { getAnalysisSystemPrompt, buildAnalysisUserPrompt } from './prompts.js'
import { insertIncident, insertAnalysisResult, fetchRecentAnalyses } from '../db/supabase.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function parseClockToSeconds(value) {
  if (typeof value !== 'string') return Number.POSITIVE_INFINITY
  const match = value.match(/(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return Number.POSITIVE_INFINITY
  const hh = Number.parseInt(match[1], 10)
  const mm = Number.parseInt(match[2], 10)
  const ss = Number.parseInt(match[3], 10)
  if ([hh, mm, ss].some((n) => Number.isNaN(n))) return Number.POSITIVE_INFINITY
  return hh * 3600 + mm * 60 + ss
}

function sortTimeline(timeline) {
  if (!Array.isArray(timeline)) return []
  return [...timeline].sort((a, b) => parseClockToSeconds(a?.time) - parseClockToSeconds(b?.time))
}

function normalizeEventForCompare(value) {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s:/.-]/g, '')
    .trim()
}

function eventContainsFailureSignal(level, event) {
  const normalizedLevel = (level || '').toUpperCase()
  if (normalizedLevel === 'ERROR' || normalizedLevel === 'CRITICAL' || normalizedLevel === 'FATAL') return true
  const normalizedEvent = (event || '').toLowerCase()
  return /failed|failure|unavailable|timeout|timed out|degraded|crashed|exception|fatal|oom|out of memory|cannot|denied|disabled|stale|exceed/.test(normalizedEvent)
}

function isStartupNoiseEvent(entry) {
  const normalizedType = (entry?.type || '').toLowerCase()
  const normalizedEvent = (entry?.event || '').toLowerCase()
  if (normalizedType !== 'info' && normalizedType !== 'recovery') return false
  // return /\b(startup complete|connected to|watching=\d+|health check ok|ready to serve|boot complete)\b/.test(normalizedEvent)
  return /\b(startup complete|connected to|watching=\d+|health check ok|ready to serve|boot complete|tracing initialized|secrets engine initialized|cluster ready|startup|initialized|initialization complete)\b/.test(normalizedEvent)
}

function inferTimelineType(level, message) {
  const normalizedLevel = (level || '').toUpperCase()
  const normalizedMessage = (message || '').toLowerCase()
  if (/oomkilled|oom killed|outofmemory|out of memory|kernel oom/i.test(normalizedMessage)) return 'root_cause'
  if (normalizedLevel === 'CRITICAL' || normalizedLevel === 'FATAL') return 'impact'
  if (normalizedLevel === 'ERROR') return 'error'
  if (normalizedLevel === 'WARN' || normalizedLevel === 'WARNING') return 'warning'
  return 'info'
}

function parseStructuredLogEntries(logs) {
  if (typeof logs !== 'string' || !logs.trim()) return []

  const entries = []
  for (const rawLine of logs.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(
      /(?:\[(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2})\]|\b(\d{2}:\d{2}:\d{2})\b)\s*(INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)?\s*([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\s*:\s*(.+)$/i,
    )
    if (!match) continue

    const time = match[1] || match[2] || '--:--:--'
    const level = (match[3] || 'INFO').toUpperCase()
    const service = (match[4] || '').trim()
    const event = (match[5] || '').trim()
    if (!service || !event) continue

    entries.push({
      time,
      level,
      service,
      event,
      type: inferTimelineType(level, event),
    })
  }

  return entries
}

function mergeTimelines(modelTimeline, logEntries) {
  const merged = []

  const pushNormalized = (entry) => {
    // const time = typeof entry?.time === 'string' ? entry.time : '--:--:--'
    const rawTime = typeof entry?.time === 'string' ? entry.time : '--:--:--'
    const timeMatch = rawTime.match(/(\d{2}:\d{2}:\d{2})/)
    const time = timeMatch ? timeMatch[1] : '--:--:--'

    const service = typeof entry?.service === 'string' ? entry.service.trim() : ''
    const event = typeof entry?.event === 'string'
      ? entry.event.trim()
      : typeof entry?.description === 'string'
        ? entry.description.trim()
        : ''
    if (!service || !event) return

    merged.push({
      time,
      service,
      event,
      type: entry?.type || 'info',
    })
  }

  if (Array.isArray(modelTimeline)) {
    for (const item of modelTimeline) pushNormalized(item)
  }
  for (const item of logEntries) pushNormalized(item)

  const sorted = sortTimeline(merged)
  const deduped = []
  for (const entry of sorted) {
    const time = entry.time || '--:--:--'
    const service = entry.service || ''
    const normalizedEvent = normalizeEventForCompare(entry.event)

    let mergedIntoExisting = false
    for (let i = 0; i < deduped.length; i += 1) {
      const existing = deduped[i]
      if ((existing.time || '--:--:--') !== time) continue
      if ((existing.service || '') !== service) continue

      const existingNormalized = normalizeEventForCompare(existing.event)
      if (!existingNormalized || !normalizedEvent) continue

      if (existingNormalized === normalizedEvent) {
        mergedIntoExisting = true
        break
      }

      if (existingNormalized.includes(normalizedEvent) || normalizedEvent.includes(existingNormalized)) {
        const shouldReplace = normalizedEvent.length > existingNormalized.length
        if (shouldReplace) {
          deduped[i] = {
            ...existing,
            ...entry,
            type: existing.type !== 'info' ? existing.type : entry.type,
          }
        }
        mergedIntoExisting = true
        break
      }
    }

    if (!mergedIntoExisting) deduped.push(entry)
  }

  return deduped
}

function filterPreIncidentStartupNoise(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return []

  const firstIncidentSecond = timeline.reduce((acc, entry) => {
    const seconds = parseClockToSeconds(entry?.time)
    if (!Number.isFinite(seconds)) return acc
    const isIncidentSignal = (entry?.type || '').toLowerCase() !== 'info' || eventContainsFailureSignal(null, entry?.event)
    if (!isIncidentSignal) return acc
    return Math.min(acc, seconds)
  }, Number.POSITIVE_INFINITY)

  if (!Number.isFinite(firstIncidentSecond)) return timeline

  const noiseCutoff = firstIncidentSecond - 300
  return timeline.filter((entry) => {
    const seconds = parseClockToSeconds(entry?.time)
    if (!Number.isFinite(seconds)) return true
    if (seconds >= noiseCutoff) return true
    return !isStartupNoiseEvent(entry)
  })
}

function inferServiceStatus(messages) {
  const joined = messages.join('\n').toLowerCase()
  if (/oomkilled|oom killed|outofmemory|out of memory|kernel oom|killed process .*out of memory/i.test(joined)) {
    return 'OOMKilled'
  }
  // if (/consumer stopped|authentication failed|token expired|failed|failure|fatal|refused|denied|no healthy|unavailable|stopped/i.test(joined)) {
  //   return 'Failed'
  // }

  if (/consumer stopped|authentication failed|token expired|failed|failure|fatal|refused|denied|no healthy|unavailable|stopped/i.test(joined)) {
    // If service successfully fell back to degraded mode, it's Degraded not Failed
    if (/falling back|fallback|using default|bypass|in-memory mode|degraded mode/i.test(joined)) {
      return 'Degraded'
    }
    return 'Failed'
  }

  if (/degrad|timeout|latency|lag|pending|backlog|pressure|warn|warning|retry/i.test(joined)) {
    return 'Degraded'
  }
  if (/healthy|recovered|returned to baseline|resolved|success/i.test(joined)) {
    return 'Healthy'
  }
  return 'Unknown'
}

function buildServiceFacts(logEntries, rootCauseService) {
  const serviceOrder = []
  const byService = new Map()

  for (const entry of logEntries) {
    if (!byService.has(entry.service)) {
      byService.set(entry.service, { messages: [], errorCount: 0 })
      serviceOrder.push(entry.service)
    }

    const bucket = byService.get(entry.service)
    bucket.messages.push(entry.event)
    if (entry.level === 'ERROR' || entry.level === 'CRITICAL' || entry.level === 'FATAL') {
      bucket.errorCount += 1
    }
  }

  return serviceOrder.map((service) => {
    const stats = byService.get(service)
    return {
      name: service,
      status: inferServiceStatus(stats.messages),
      errorCount: stats.errorCount,
      role: service === rootCauseService ? 'root cause' : 'affected',
    }
  })
}

function deriveCascadeBranchesFromTimeline(timeline, rootCauseService) {
  const services = timeline
    .map((entry) => (typeof entry?.service === 'string' ? entry.service.trim() : ''))
    .filter(Boolean)
  if (!services.length) return []

  const root = rootCauseService && services.includes(rootCauseService)
    ? rootCauseService
    : services[0]

  const adjacency = new Map()
  const addEdge = (from, to) => {
    if (!from || !to || from === to) return
    if (!adjacency.has(from)) adjacency.set(from, new Set())
    adjacency.get(from).add(to)
  }

  for (let index = 0; index < timeline.length - 1; index += 1) {
    const from = timeline[index]?.service?.trim()
    const to = timeline[index + 1]?.service?.trim()
    addEdge(from, to)
  }

  const branches = []
  const visitedPath = new Set()
  const dfs = (node, path, depth) => {
    if (depth > 8) return
    const nextNodes = Array.from(adjacency.get(node) || [])
    if (!nextNodes.length) {
      if (path.length > 1) branches.push(path.join(' -> '))
      return
    }

    for (const nextNode of nextNodes) {
      const edgeKey = `${node}->${nextNode}`
      if (visitedPath.has(edgeKey)) continue
      visitedPath.add(edgeKey)
      dfs(nextNode, [...path, nextNode], depth + 1)
      visitedPath.delete(edgeKey)
    }
  }

  dfs(root, [root], 0)
  if (!branches.length) {
    const linear = [...new Set(services)]
    if (linear.length > 1) branches.push(linear.join(' -> '))
  }

  return [...new Set(branches)]
}

function flattenCascadeBranches(branches) {
  const ordered = []
  const seen = new Set()
  for (const branch of branches) {
    for (const segment of branch.split('->').map((item) => item.trim()).filter(Boolean)) {
      if (seen.has(segment)) continue
      seen.add(segment)
      ordered.push(segment)
    }
  }
  return ordered
}

function deriveCascadeChainFromTimeline(timeline, rootCauseService) {
  const branches = deriveCascadeBranchesFromTimeline(timeline, rootCauseService)
  return {
    branches,
    chain: flattenCascadeBranches(branches),
  }
}

function alignAffectedServices(affectedServices, chain) {
  if (!Array.isArray(affectedServices) || affectedServices.length === 0) return []
  if (!Array.isArray(chain) || chain.length === 0) return affectedServices

  const byName = new Map(
    affectedServices
      .filter((service) => typeof service?.name === 'string')
      .map((service) => [service.name, service]),
  )

  const ordered = []
  for (const serviceName of chain) {
    if (byName.has(serviceName)) {
      ordered.push(byName.get(serviceName))
      byName.delete(serviceName)
    }
  }

  return [...ordered, ...Array.from(byName.values())]
}

function hasUserCountEvidence(logs) {
  if (typeof logs !== 'string' || !logs.trim()) return false
  return /(users?|customers?|sessions?|accounts?)/i.test(logs)
}

function extractEstimatedRequestsFailed(logs) {
  if (typeof logs !== 'string') return 0
  const pattern = /(\d[\d,]*)\s+(?:requests?|payments?)\s+(?:failed|dropped|timed?\s*out|timeouts?)/gi
  let match
  let maxValue = 0
  while ((match = pattern.exec(logs))) {
    const value = Number.parseInt(match[1].replaceAll(',', ''), 10)
    if (!Number.isNaN(value)) maxValue = Math.max(maxValue, value)
  }
  return maxValue
}

function extractEstimatedMessagesStuck(logs) {
  if (typeof logs !== 'string') return 0
  const pattern = /(\d[\d,]*)\s+(?:emails?|messages?)\s+(?:pending|stuck|queued|backlogged)/gi
  let match
  let maxValue = 0
  while ((match = pattern.exec(logs))) {
    const value = Number.parseInt(match[1].replaceAll(',', ''), 10)
    if (!Number.isNaN(value)) maxValue = Math.max(maxValue, value)
  }
  return maxValue
}

function extractEstimatedOversoldOrders(logs) {
  if (typeof logs !== 'string') return 0
  const patterns = [
    /(\d[\d,]*)\s+oversold\s+orders?/gi,
    /(\d[\d,]*)\s+orders?\s+processed\s+without\s+stock\s+validation/gi,
  ]

  let maxValue = 0
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(logs))) {
      const value = Number.parseInt(match[1].replaceAll(',', ''), 10)
      if (!Number.isNaN(value)) maxValue = Math.max(maxValue, value)
    }
  }
  return maxValue
}

function extractEstimatedMisroutedOrders(logs) {
  if (typeof logs !== 'string') return 0
  const patterns = [
    /(\d[\d,]*)\s+orders?\s+routed\s+to\s+default/gi,
    /(\d[\d,]*)\s+orders?\s+misrouted/gi,
    /(\d[\d,]*)\s+orders?\s+(?:processed|handled)\s+without\s+(?:regional|routing)/gi,
  ]
  let maxValue = 0
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(logs))) {
      const value = Number.parseInt(match[1].replaceAll(',', ''), 10)
      if (!Number.isNaN(value)) maxValue = Math.max(maxValue, value)
    }
  }
  return maxValue
}

function normalizeBlastRadius(blastRadius, logs, affectedServices) {
  const radius = blastRadius && typeof blastRadius === 'object' ? { ...blastRadius } : {}
  const hasEvidence = hasUserCountEvidence(logs)
  const requestsFromLogs = extractEstimatedRequestsFailed(logs)
  const messagesFromLogs = extractEstimatedMessagesStuck(logs)
  // const oversoldFromLogs = extractEstimatedOversoldOrders(logs)

  const oversoldFromLogs = extractEstimatedOversoldOrders(logs)
  const misroutedFromLogs = extractEstimatedMisroutedOrders(logs)

  const normalizedRequests = Number.isFinite(Number(radius.estimatedRequestsFailed))
    ? Math.max(Number(radius.estimatedRequestsFailed) || 0, requestsFromLogs)
    : requestsFromLogs
  const normalizedMessages = Number.isFinite(Number(radius.estimatedMessagesStuck))
    ? Math.max(Number(radius.estimatedMessagesStuck) || 0, messagesFromLogs)
    : messagesFromLogs
  const normalizedOversold = Number.isFinite(Number(radius.estimatedOversoldOrders))
    ? Math.max(Number(radius.estimatedOversoldOrders) || 0, oversoldFromLogs)
    : oversoldFromLogs

  radius.estimatedRequestsFailed = normalizedRequests
  radius.estimatedMessagesStuck = normalizedMessages
  // radius.estimatedOversoldOrders = normalizedOversold
  radius.estimatedOversoldOrders = normalizedOversold
  radius.estimatedMisroutedOrders = Math.max(
    Number.isFinite(Number(radius.estimatedMisroutedOrders)) ? Number(radius.estimatedMisroutedOrders) : 0,
    misroutedFromLogs
  )

  radius.servicesAffected = Array.isArray(affectedServices) ? affectedServices.length : 0

  if (!hasEvidence) {
    radius.estimatedUsersAffected = null
    const note = 'No direct user-count evidence found in logs; estimatedUsersAffected set to null.'
    radius.methodology = radius.methodology
      ? `${radius.methodology} ${note}`.trim()
      : note
  }

  return radius
}

function deriveRootCauseService(parsed, logEntries) {
  const parsedRoot = (parsed?.rootCauseService || parsed?.root_cause_service || '').trim()
  if (!Array.isArray(logEntries) || logEntries.length === 0) return parsedRoot

  const serviceFacts = new Map()
  for (const entry of logEntries) {
    const service = entry?.service?.trim()
    if (!service) continue
    const seconds = parseClockToSeconds(entry.time)
    if (!serviceFacts.has(service)) {
      serviceFacts.set(service, {
        firstSeen: seconds,
        firstFailure: Number.POSITIVE_INFINITY,
        hasFailure: false,
      })
    }
    const facts = serviceFacts.get(service)
    if (eventContainsFailureSignal(entry.level, entry.event)) {
      facts.hasFailure = true
      facts.firstFailure = Math.min(facts.firstFailure, seconds)
    }
  }

  const failingCandidates = Array.from(serviceFacts.entries())
    .filter(([, facts]) => facts.hasFailure)
    .sort((a, b) => a[1].firstFailure - b[1].firstFailure)

  if (!failingCandidates.length) return parsedRoot || logEntries[0]?.service || 'unknown-service'

  if (parsedRoot) {
    const parsedFacts = serviceFacts.get(parsedRoot)
    if (parsedFacts?.hasFailure) return parsedRoot
  }

  return failingCandidates[0][0]
}

function normalizeParsedAnalysis(parsed, logs) {
  const logEntries = parseStructuredLogEntries(logs)
  const rootCauseService = deriveRootCauseService(parsed, logEntries)
  const timeline = filterPreIncidentStartupNoise(mergeTimelines(parsed.timeline, logEntries))
  const derived = deriveCascadeChainFromTimeline(timeline, rootCauseService)
  const parsedChain = Array.isArray(parsed.cascadeChain) ? parsed.cascadeChain : []
  const parsedBranches = parsedChain.filter((entry) => typeof entry === 'string' && entry.includes('->'))
  const cascadeBranches = derived.branches.length ? derived.branches : parsedBranches
  const chain = derived.chain.length ? derived.chain : parsedChain
  const serviceFacts = buildServiceFacts(logEntries, rootCauseService)

  const mergedAffectedServices = (() => {
    const byName = new Map()

    for (const service of Array.isArray(parsed.affectedServices) ? parsed.affectedServices : []) {
      const name = typeof service?.name === 'string' ? service.name.trim() : ''
      if (!name) continue
      byName.set(name, {
        ...service,
        name,
      })
    }

    for (const service of serviceFacts) {
      const existing = byName.get(service.name) || {}
      byName.set(service.name, {
        ...existing,
        ...service,
        errorCount: Math.max(existing.errorCount || 0, service.errorCount || 0),
        role: service.role || existing.role || 'affected',
      })
    }

    const merged = Array.from(byName.values())
    return alignAffectedServices(merged, chain)
  })()

  return {
    ...parsed,
    rootCauseService,
    root_cause_service: rootCauseService,
    timeline,
    cascadeChain: chain,
    cascadeBranches,
    affectedServices: mergedAffectedServices,
    blastRadius: normalizeBlastRadius(parsed.blastRadius, logs, mergedAffectedServices),
  }
}

export async function runAnalysisPipeline(logs, scenarioName, onStep) {
  const lines = logs.split('\n').filter((line) => line.trim())
  const services = [
    ...new Set(
      lines
        .map((line) => {
          const match = line.match(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/)
          return match ? match[1] : null
        })
        .filter(Boolean),
    ),
  ]

  await onStep({
    step: 1,
    label: 'Parsing log structure',
    detail: `Found ${lines.length} log lines across ${services.length} services: ${services.join(', ')}`,
    status: 'complete',
  })

  const pastIncidents = await fetchRecentAnalyses(20)
  await onStep({
    step: 2,
    label: 'Querying incident history',
    detail: `Found ${pastIncidents.length} historical incidents for pattern matching`,
    status: 'complete',
  })

  await onStep({
    step: 3,
    label: 'Identifying root cause',
    detail: 'AI agent analyzing failure cascade...',
    status: 'running',
  })

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 4000,
    temperature: 0.1,
    messages: [
      { role: 'system', content: getAnalysisSystemPrompt() },
      { role: 'user', content: buildAnalysisUserPrompt(logs, pastIncidents) },
    ],
  })

  const rawResponse = completion.choices[0].message.content
  await onStep({
    step: 3,
    label: 'Identifying root cause',
    detail: 'Root cause identified',
    status: 'complete',
  })

  let parsed
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    parsed = JSON.parse(jsonMatch[0])
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err.message}`)
  }

  const normalized = normalizeParsedAnalysis(parsed, logs)

  await onStep({
    step: 4,
    label: 'Tracing failure cascade',
    detail: `Cascade: ${(normalized.cascadeChain || []).join(' -> ')}`,
    status: 'complete',
  })

  await onStep({
    step: 5,
    label: 'Saving to incident history',
    detail: 'Writing to database...',
    status: 'running',
  })

  const incident = await insertIncident(logs, scenarioName || 'manual')
  const analysis = await insertAnalysisResult(incident.id, normalized)

  await onStep({
    step: 5,
    label: 'Saving to incident history',
    detail: 'Incident saved successfully',
    status: 'complete',
  })

  return { ...normalized, incidentId: incident.id, analysisId: analysis.id }
}
