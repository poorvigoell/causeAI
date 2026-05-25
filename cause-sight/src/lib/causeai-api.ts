export type StreamStep = {
  step: number;
  label: string;
  detail?: string;
  status?: "pending" | "running" | "complete";
};

export type IncidentDNA = {
  failureMode: string;
  rootCauseService: string;
  affectedServices: string[];
  severity: string;
  keywords: string[];
  cascadeDepth: number;
};

export type SimilarIncident = {
  id: string | number;
  incident_id: string | number;
  root_cause: string;
  root_cause_service: string;
  severity: string;
  immediate_fix: string;
  similarityScore: number;
  matchDetails: string[];
  created_at: string;
  scenario_name?: string;
};

type BlastRadius = {
  estimatedUsersAffected?: number;
  estimatedRequestsFailed?: number;
  estimatedMessagesStuck?: number;
  estimatedOversoldOrders?: number;
  estimatedMisroutedOrders?: number;
  affectedEndpoints?: string[];
  methodology?: string;
};

type TimelineEvent = {
  time?: string;
  service?: string;
  event?: string;
  description?: string;
  type?: string;
};

type AffectedService = {
  name?: string;
  status?: string;
  errorCount?: number;
  role?: string;
};

export type CauseAnalysis = {
  incidentId?: number | string;
  analysisId?: number | string;
  rootCause: string;
  rootCauseService: string;
  confidenceScore: number;
  severity: string;
  businessImpact: string;
  blastRadius?: BlastRadius;
  timeline: TimelineEvent[];
  affectedServices: AffectedService[];
  cascadeChain: string[];
  cascadeBranches?: string[];
  immediateFix: string;
  permanentFix: string;
  alternatives: Array<{ cause?: string; confidence?: number }>;
  similarIncidents?: SimilarIncident[];
  incidentDna?: IncidentDNA;
};

export type IncidentSummary = {
  id: number | string;
  scenario_name?: string;
  created_at: string;
  source?: string;
  analysis_results?: unknown[];
};

export type TrendPoint = {
  created_at: string;
  confidence_score: number;
  severity: string;
};

export const API_BASE = import.meta.env.VITE_CAUSEAI_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:3001/api" : "https://causeai-backend.onrender.com/api");

function getWsBaseUrl() {
  const configured = import.meta.env.VITE_CAUSEAI_WS_URL;
  if (configured) return configured;
  return import.meta.env.DEV ? "ws://localhost:3001/ws" : "wss://causeai-backend.onrender.com/ws";
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number") return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function asRecord(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function readString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function readArray<T = unknown>(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [] as T[];
}

function normalizeStepIndex(value: unknown, fallback = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value >= 1 && value <= 5) return value - 1;
  return Math.max(0, value);
}

function parseClockToSeconds(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = value.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number.parseInt(match[1], 10) * 3600
    + Number.parseInt(match[2], 10) * 60
    + Number.parseInt(match[3], 10);
}

export function normalizeAnalysis(value: unknown): CauseAnalysis | null {
  const raw = asRecord(value);
  if (!Object.keys(raw).length) return null;

  const timeline = readArray<Record<string, unknown>>(raw, "timeline").map((item) => ({
    time: readString(item, "time"),
    service: readString(item, "service"),
    event: readString(item, "event"),
    description: readString(item, "description"),
    type: readString(item, "type"),
  }))
    .sort((a, b) => parseClockToSeconds(a.time) - parseClockToSeconds(b.time));

  const timelineChain = timeline
    .map((item) => (item.service || "").trim())
    .filter(Boolean)
    .filter((service, idx, arr) => arr.indexOf(service) === idx);

  const affectedServices = readArray<Record<string, unknown>>(raw, "affectedServices", "affected_services").map((service) => ({
    name: readString(service, "name"),
    status: readString(service, "status"),
    errorCount: typeof service.errorCount === "number" ? service.errorCount : typeof service.error_count === "number" ? service.error_count : undefined,
    role: readString(service, "role"),
  }));

  const blast = asRecord(raw.blastRadius ?? raw.blast_radius);

  return {
    incidentId: (raw.incidentId ?? raw.incident_id) as number | string | undefined,
    analysisId: (raw.analysisId ?? raw.analysis_id ?? raw.id) as number | string | undefined,
    rootCause: readString(raw, "rootCause", "root_cause") || "Unknown root cause",
    rootCauseService: readString(raw, "rootCauseService", "root_cause_service") || "unknown-service",
    confidenceScore: normalizeConfidence(raw.confidenceScore ?? raw.confidence_score),
    severity: readString(raw, "severity") || "P2",
    businessImpact: readString(raw, "businessImpact", "business_impact"),
    blastRadius: {
      estimatedUsersAffected:
        typeof blast.estimatedUsersAffected === "number"
          ? blast.estimatedUsersAffected
          : typeof blast.estimated_users_affected === "number"
            ? blast.estimated_users_affected
            : undefined,
      estimatedRequestsFailed:
        typeof blast.estimatedRequestsFailed === "number"
          ? blast.estimatedRequestsFailed
          : typeof blast.estimated_requests_failed === "number"
            ? blast.estimated_requests_failed
            : undefined,
      estimatedMessagesStuck:
        typeof blast.estimatedMessagesStuck === "number"
          ? blast.estimatedMessagesStuck
          : typeof blast.estimated_messages_stuck === "number"
            ? blast.estimated_messages_stuck
            : undefined,
      estimatedOversoldOrders:
        typeof blast.estimatedOversoldOrders === "number"
          ? blast.estimatedOversoldOrders
          : typeof blast.estimated_oversold_orders === "number"
            ? blast.estimated_oversold_orders
            : undefined,
      estimatedMisroutedOrders:
        typeof blast.estimatedMisroutedOrders === "number"
          ? blast.estimatedMisroutedOrders
          : typeof blast.estimated_misrouted_orders === "number"
            ? blast.estimated_misrouted_orders
            : undefined,
      affectedEndpoints: readArray<string>(blast, "affectedEndpoints", "affected_endpoints"),
      methodology: readString(blast, "methodology"),
    },
    timeline,
    affectedServices,
    cascadeChain: readArray<string>(raw, "cascadeChain", "cascade_chain"),
    cascadeBranches: readArray<string>(raw, "cascadeBranches", "cascade_branches"),
    immediateFix: readString(raw, "immediateFix", "immediate_fix"),
    permanentFix: readString(raw, "permanentFix", "permanent_fix"),
    alternatives: readArray<Record<string, unknown>>(raw, "alternatives").map((alt) => ({
      cause: readString(alt, "cause"),
      confidence: typeof alt.confidence === "number" ? alt.confidence : undefined,
    })),
    similarIncidents: readArray<SimilarIncident>(raw, "similarIncidents", "similar_incidents"),
    incidentDna: (raw.incidentDna ?? raw.incident_dna) as IncidentDNA | undefined,
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
    throw new Error(errorBody.error || "Request failed");
  }
  return (await res.json()) as T;
}

export async function analyzeIncident(
  logs: string,
  onStep?: (step: StreamStep) => void,
  scenarioName?: string,
) {
  const clientId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  let ws: WebSocket | null = null;

  try {
    ws = new WebSocket(`${getWsBaseUrl()}?clientId=${clientId}`);
    await new Promise<void>((resolve, reject) => {
      ws?.addEventListener("open", () => resolve(), { once: true });
      ws?.addEventListener("error", () => reject(new Error("WebSocket failed")), { once: true });
      setTimeout(() => reject(new Error("WebSocket timeout")), 3000);
    });
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data) as Record<string, unknown>;
      if (payload.type === "connected" || payload.type === "done") return;
      if (!onStep) return;
      onStep({
        step: normalizeStepIndex(payload.step, 0),
        label: typeof payload.label === "string" ? payload.label : "Processing",
        detail: typeof payload.detail === "string" ? payload.detail : "",
        status:
          payload.status === "pending"
            ? "pending"
            : payload.status === "running"
              ? "running"
              : "complete",
      });
    };
  } catch {
    ws = null;
  }

  type AnalyzeResponse = { result?: unknown; steps?: StreamStep[] };
  const payload = await parseResponse<AnalyzeResponse>(
    await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs, scenarioName: scenarioName || undefined, clientId: ws ? clientId : null }),
    }),
  );

  if (!ws && payload.steps && onStep) {
    payload.steps.forEach((step, index) => {
      onStep({
        step: normalizeStepIndex(step.step, index),
        label: step.label || "Processing",
        detail: step.detail,
        status: step.status || "complete",
      });
    });
  }

  ws?.close();
  return normalizeAnalysis(payload.result) || null;
}

export async function fetchIncidents(limit = 50) {
  const data = await parseResponse<{ incidents?: IncidentSummary[] }>(
    await fetch(`${API_BASE}/incidents?limit=${limit}`),
  );
  return data.incidents || [];
}

export async function fetchIncidentById(id: number | string) {
  return parseResponse(
    await fetch(`${API_BASE}/incidents/${id}`),
  );
}

export async function fetchIncidentSimilar(incidentId: number | string) {
  return parseResponse<{ similarIncidents: SimilarIncident[]; incidentDna: IncidentDNA | null }>(
    await fetch(`${API_BASE}/incidents/${incidentId}/similar`),
  );
}

export async function fetchServiceTrend(serviceName: string) {
  return parseResponse<TrendPoint[]>(
    await fetch(`${API_BASE}/incidents/trend/${encodeURIComponent(serviceName)}`),
  );
}

export async function sendChatMessage(
  analysis: CauseAnalysis,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
) {
  return parseResponse<{ reply?: string }>(
    await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: analysis.analysisId ?? null,
        analysis,
        message,
        conversationHistory: history,
      }),
    }),
  );
}

export async function generatePostmortem(analysisId: number | string) {
  return parseResponse<{ postmortemId: string; title: string; reportMarkdown: string }>(
    await fetch(`${API_BASE}/postmortem/${analysisId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
  );
}

export async function savePostmortem(incidentId: number | string | null, title: string, content: string) {
  return parseResponse(
    await fetch(`${API_BASE}/postmortem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_id: incidentId, title, content }),
    }),
  );
}

export async function fetchPostmortems() {
  return parseResponse<Array<{ id: number | string; title?: string; content: string; created_at: string }>>(
    await fetch(`${API_BASE}/postmortem`),
  );
}

export type HeatmapDay = { date: string; count: number; worstSeverity: 'P0' | 'P1' | 'P2'; };
export type BlastPrediction = { riskLevel: 'low' | 'medium' | 'high' | 'critical'; summary: string; predictedAffectedServices: Array<{ service: string; reason: string; likelihood: 'low' | 'medium' | 'high'; }>; potentialFailureModes: string[]; recommendations: string[]; suggestedDeployWindow: string; rollbackPlan: string; };
export type OnCallBriefing = { summary: string; recurringIssues: Array<{ service: string; occurrences: number; pattern: string; }>; activeP0s: Array<{ title: string; service: string; hoursAgo: number; status: string; }>; recommendedActions: string[]; healthSignal: 'green' | 'amber' | 'red'; generatedAt: string; incidentCount: number; };

export async function fetchHeatmap(days = 90): Promise<HeatmapDay[]> {
  const data = await parseResponse<{ heatmap?: HeatmapDay[] }>(await fetch(`${API_BASE}/incidents/heatmap?days=${days}`));
  return data.heatmap || [];
}

export async function predictBlastRadius(deployDescription: string): Promise<BlastPrediction> {
  const data = await parseResponse<{ prediction?: BlastPrediction }>(await fetch(`${API_BASE}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deployDescription }) }));
  if (!data.prediction) throw new Error('No prediction returned');
  return data.prediction;
}

export async function generateOnCallBriefing(): Promise<OnCallBriefing> {
  const data = await parseResponse<{ briefing?: OnCallBriefing }>(await fetch(`${API_BASE}/briefing`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }));
  if (!data.briefing) throw new Error('No briefing returned');
  return data.briefing;
}

export type ShadowIncident = {
  title: string;
  service: string;
  riskScore: number;
  pattern: string;
  recommendedAction: string;
};

export async function scanShadowIncidents(): Promise<{ shadowIncidents: ShadowIncident[]; scannedAt: string; logLines: number }> {
  return parseResponse<{ shadowIncidents: ShadowIncident[]; scannedAt: string; logLines: number }>(
    await fetch(`${API_BASE}/incidents/shadow/scan`),
  );
}
