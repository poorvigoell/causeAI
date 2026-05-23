import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  Database,
  Download,
  FileText,
  Flame,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Server,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import {
  analyzeIncident,
  fetchServiceTrend,
  generatePostmortem,
  fetchIncidents,
  fetchPostmortems,
  normalizeAnalysis,
  savePostmortem,
  sendChatMessage,
  type CauseAnalysis,
  type IncidentSummary,
  type StreamStep,
} from "@/lib/causeai-api";
import { generatePostmortemContent } from "@/lib/postmortem";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "CauseAI - Incident Workspace" },
      {
        name: "description",
        content:
          "Incident workspace with cascade tracing, blast radius, and post-mortems.",
      },
    ],
  }),
  component: AppPage,
});

const sevStyles: Record<string, string> = {
  P0: "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/60",
  P1: "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/60",
  P2: "bg-[#D8CFBC]/20 text-[#D8CFBC] border-[#D8CFBC]/60",
};

const stepTemplate: StreamStep[] = [
  { step: 0, label: "Parse Logs", detail: "Reading and structuring raw log data.", status: "pending" },
  { step: 1, label: "Correlate Services", detail: "Mapping service interactions and failures.", status: "pending" },
  { step: 2, label: "Trace Deploys", detail: "Checking rollout and upstream dependency signals.", status: "pending" },
  { step: 3, label: "Compute Blast", detail: "Estimating impact and failure propagation.", status: "pending" },
  { step: 4, label: "Generate Report", detail: "Compiling root cause and remediation output.", status: "pending" },
];

type DemoScenario = {
  id: string;
  name: string;
  description: string;
  logs: string;
};

const demoScenarios: DemoScenario[] = [
  {
    id: "redis-oom",
    name: "Redis OOM Cascade",
    description: "Redis memory saturation triggers auth fallback storm and checkout failures.",
    logs: `[2026-05-24 01:57:58] INFO  redis: memory usage at 94% (482MB/512MB)
[2026-05-24 01:58:01] ERROR redis: OOM command not allowed when used memory > maxmemory
[2026-05-24 01:58:01] ERROR redis: eviction failed maxmemory-policy is noeviction
[2026-05-24 01:58:02] ERROR auth-service: Redis cache MISS for session lookup
[2026-05-24 01:58:02] ERROR auth-service: fallback DB query initiated queue_depth=847
[2026-05-24 01:58:03] WARN  auth-service: DB connection pool at 89% capacity
[2026-05-24 01:58:04] ERROR auth-service: session verification timeout after 4800ms
[2026-05-24 01:58:04] ERROR checkout-service: upstream auth call failed timeout
[2026-05-24 01:58:05] ERROR checkout-service: order processing blocked
[2026-05-24 01:58:05] ERROR api-gateway: 503 sent to client req_id 8821
[2026-05-24 01:58:07] CRITICAL alerting: error rate crossed 40% threshold
[2026-05-24 01:58:07] ERROR api-gateway: 2847 requests failed in last 60s`,
  },
  {
    id: "bad-deploy",
    name: "Bad Deployment",
    description: "Fresh payment-service rollout introduces NullPointerException in checkout path.",
    logs: `[2026-05-24 02:15:00] INFO  deployment: payment-service v2.3.1 to v2.3.2 rollout started
[2026-05-24 02:15:02] INFO  deployment: 5/5 pods updated rollout complete
[2026-05-24 02:15:03] ERROR payment-service: NullPointerException at OrderProcessor.java:142
[2026-05-24 02:15:03] ERROR payment-service: 500 on POST /api/payments
[2026-05-24 02:15:05] ERROR order-service: payment confirmation timeout after 5000ms
[2026-05-24 02:15:15] ERROR order-service: all retries exhausted order failed
[2026-05-24 02:15:15] ERROR api-gateway: 502 Bad Gateway from payment-service
[2026-05-24 02:15:18] CRITICAL alerting: payment failure rate 94%`,
  },
  {
    id: "traffic-spike",
    name: "Traffic Spike",
    description: "Sudden load surge overwhelms product-service and propagates user-facing timeouts.",
    logs: `[2026-05-24 03:30:00] INFO  load-balancer: traffic spike 40312 req/min baseline 8200
[2026-05-24 03:30:01] WARN  product-service: CPU utilization 91%
[2026-05-24 03:30:02] WARN  product-service: response time 2100ms SLA 200ms
[2026-05-24 03:30:05] ERROR product-service: request queue full dropping connections
[2026-05-24 03:30:06] ERROR frontend: product catalog API returning 504
[2026-05-24 03:30:09] CRITICAL alerting: homepage error rate 67%
[2026-05-24 03:30:12] ERROR frontend: 504 timeout to 14200 users in last 60s`,
  },
  {
    id: "db-pool",
    name: "DB Pool Exhaustion",
    description: "Postgres slots max out, starving core services of DB connections.",
    logs: `[2026-05-24 11:22:10] WARN  postgres: connection count at 85/100
[2026-05-24 11:22:18] ERROR postgres: remaining connection slots reserved for replication
[2026-05-24 11:22:19] ERROR postgres: FATAL remaining connection slots reserved for superuser
[2026-05-24 11:22:19] ERROR user-service: failed to acquire DB connection
[2026-05-24 11:22:20] ERROR product-service: failed to acquire DB connection
[2026-05-24 11:22:21] ERROR api-gateway: 503 returned all upstream services failing
[2026-05-24 11:22:28] INFO  db-monitor: 34 idle connections held by worker-service > 10min`,
  },
  {
    id: "memory-leak",
    name: "Memory Leak",
    description: "Gradual heap growth leads to OOMKilled pod and backend unavailability.",
    logs: `[2026-05-24 08:00:00] INFO  api-service: startup complete heap 210MB
[2026-05-24 09:00:01] INFO  api-service: heap usage 380MB
[2026-05-24 10:00:03] WARN  api-service: heap usage 620MB GC pauses increasing
[2026-05-24 11:00:07] WARN  api-service: heap usage 890MB GC pause avg 800ms
[2026-05-24 11:30:12] ERROR api-service: GC overhead limit exceeded
[2026-05-24 11:30:15] ERROR api-service: OutOfMemoryError Java heap space
[2026-05-24 11:30:15] ERROR api-service: pod crash OOMKilled
[2026-05-24 11:30:17] ERROR load-balancer: no healthy backends for api-service`,
  },
  {
    id: "stripe-outage",
    name: "Stripe Outage",
    description: "Third-party payments degrade, circuit breaker opens, checkout fails globally.",
    logs: `[2026-05-24 14:10:00] ERROR payment-service: Stripe API timeout after 30000ms
[2026-05-24 14:10:03] WARN  payment-service: Stripe connectivity check FAILED
[2026-05-24 14:10:05] ERROR checkout-service: payment gateway unavailable
[2026-05-24 14:10:07] ERROR api-gateway: 503 on all POST /api/checkout
[2026-05-24 14:10:10] INFO  external-monitor: Stripe status page partial outage eu-west-1
[2026-05-24 14:10:15] WARN  payment-service: circuit breaker OPEN`,
  },
  {
    id: "crashloop",
    name: "CrashLoopBackOff",
    description: "Missing JWT secret causes auth pods to crash repeatedly after deploy.",
    logs: `[2026-05-24 16:45:00] INFO  kubernetes: auth-service deployment update triggered v1.4.2
[2026-05-24 16:45:15] ERROR auth-service: environment variable JWT_SECRET not found
[2026-05-24 16:45:15] ERROR auth-service: failed to initialize required config missing
[2026-05-24 16:45:15] INFO  kubernetes: pod auth-service-6f8d9 exited code 1
[2026-05-24 16:45:25] INFO  kubernetes: pod restarting attempt 1 CrashLoopBackOff
[2026-05-24 16:45:45] INFO  kubernetes: pod restarting attempt 2 backoff 30s
[2026-05-24 16:46:00] ERROR api-gateway: no healthy auth-service pods 401 to all users
[2026-05-24 16:46:01] CRITICAL alerting: 100% user authentication failure`,
  },
  {
    id: "disk-exhaustion",
    name: "Disk Exhaustion",
    description: "Postgres disk fills, WAL writes fail, and data services shut down.",
    logs: `[2026-05-24 19:10:00] WARN  postgres: disk usage 80% /var/lib/postgresql 40GB/50GB
[2026-05-24 21:10:00] WARN  postgres: disk usage 95% /var/lib/postgresql 47.5GB/50GB
[2026-05-24 21:45:00] ERROR postgres: could not write to file pg_wal No space left on device
[2026-05-24 21:45:00] ERROR postgres: database system is shut down
[2026-05-24 21:45:01] ERROR user-service: database connection refused
[2026-05-24 21:45:01] ERROR order-service: database connection refused
[2026-05-24 21:45:02] ERROR api-gateway: 503 all data services unavailable
[2026-05-24 21:45:05] WARN  postgres: WAL files consuming 18GB archiving disabled`,
  },
];

const sampleLogs = "";

function AppPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [incidentsError, setIncidentsError] = useState("");
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CauseAnalysis | null>(null);

  const [tab, setTab] = useState<"trend" | "postmortem" | "ask">("postmortem");
  const [showComposer, setShowComposer] = useState(false);
  const [logs, setLogs] = useState(sampleLogs);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [steps, setSteps] = useState<StreamStep[]>(stepTemplate);

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);

  const [savingPostmortem, setSavingPostmortem] = useState(false);
  const [savedPostmortem, setSavedPostmortem] = useState(false);
  const [postmortemCount, setPostmortemCount] = useState<number | null>(null);
  const [generatedPostmortem, setGeneratedPostmortem] = useState("");
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [activeScenarioName, setActiveScenarioName] = useState("Incident Analysis");

  const severityCounts = useMemo(() => {
    const buckets = { P0: 0, P1: 0, P2: 0 };
    incidents.forEach((incident) => {
      const analysis = normalizeAnalysis(incident.analysis_results?.[0]);
      const sev = analysis?.severity as keyof typeof buckets | undefined;
      if (sev && sev in buckets) buckets[sev] += 1;
    });
    return buckets;
  }, [incidents]);

  useEffect(() => {
    void refreshIncidents();
    void refreshPostmortemCount();
  }, []);

  useEffect(() => {
    if (!selectedAnalysis) {
      setChatMessages([]);
      return;
    }
    setActiveScenarioName(selectedAnalysis.rootCause || "Incident Analysis");
    setChatMessages([
      {
        role: "assistant",
        content: `Incident loaded. Root cause: ${selectedAnalysis.rootCause}. Ask anything about impact, timeline, or fixes.`,
      },
    ]);
    setSavedPostmortem(false);
    setGeneratedPostmortem("");
  }, [selectedAnalysis]);

  async function refreshIncidents(preferredId?: number | string | null) {
    try {
      setLoadingIncidents(true);
      setIncidentsError("");
      const data = await fetchIncidents(50);
      setIncidents(data);
      if (!data.length) {
        setSelectedId(null);
        setSelectedAnalysis(null);
        return;
      }
      const targetId = preferredId ?? selectedId ?? data[0].id;
      const match = data.find((incident) => incident.id === targetId) || data[0];
      setSelectedId(match.id);
      setSelectedAnalysis(normalizeAnalysis(match.analysis_results?.[0]));
    } catch (error) {
      setIncidentsError(error instanceof Error ? error.message : "Failed to load incidents");
    } finally {
      setLoadingIncidents(false);
    }
  }

  async function refreshPostmortemCount() {
    try {
      const items = await fetchPostmortems();
      setPostmortemCount(items.length);
    } catch {
      setPostmortemCount(null);
    }
  }

  async function handleAnalyzeNewIncident(overrideLogs?: string, scenarioName?: string) {
    const logsToAnalyze = (overrideLogs ?? logs).trim();
    if (!logsToAnalyze) {
      setAnalyzeError("Paste logs before running analysis.");
      return;
    }

    setActiveScenarioName(scenarioName || "Analyzing Incident");
    setAnalyzing(true);
    setAnalyzeError("");
    setSteps(stepTemplate.map((step) => ({ ...step })));
    setSavedPostmortem(false);

    try {
      const result = await analyzeIncident(logsToAnalyze, (step) => {
        setSteps((current) => {
          const next = [...current];
          const idx = Math.max(0, Math.min(4, step.step));
          const prev = next[idx] || stepTemplate[idx];
          next[idx] = {
            ...prev,
            ...step,
            step: idx,
            label: step.label || prev.label,
            detail: step.detail || prev.detail,
            status: step.status || prev.status,
          };
          return next;
        });
      }, scenarioName);
      if (!result) throw new Error("Analysis completed but no result returned.");
      setSelectedAnalysis(result);
      setShowComposer(false);
      await refreshIncidents(result.incidentId ?? null);
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSendChat() {
    if (!selectedAnalysis || !chatInput.trim() || chatLoading) return;
    const nextUserMessage = { role: "user" as const, content: chatInput.trim() };
    const nextHistory = [...chatMessages, nextUserMessage];
    setChatMessages(nextHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await sendChatMessage(selectedAnalysis, nextUserMessage.content, nextHistory.slice(-10));
      setChatMessages((current) => [...current, { role: "assistant", content: response.reply || "No response received." }]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Chat request failed.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function selectIncident(incident: IncidentSummary) {
    const analysis = normalizeAnalysis(incident.analysis_results?.[0]);
    setSelectedId(incident.id);
    setSelectedAnalysis(analysis);
    setActiveScenarioName(analysis?.rootCause || incident.scenario_name || "Incident Analysis");
    setShowHistoryPanel(false);
  }

  const selectedIncident = incidents.find((incident) => incident.id === selectedId) || null;
  const sidebarIncidents = incidents.slice(0, 5);
  const hasMoreHistory = incidents.length > 5;
  const title = getPrimaryIncidentTitle(
    selectedAnalysis?.rootCause || "",
    selectedAnalysis?.rootCauseService || "",
    selectedIncident?.scenario_name || "",
    activeScenarioName,
  );
  const descriptiveRootCause = getDescriptiveRootCause(
    selectedAnalysis?.rootCause || "",
    selectedAnalysis?.businessImpact || "",
  );
  const severity = selectedAnalysis?.severity || "P2";
  const markdown = selectedAnalysis
    ? generatedPostmortem || generatePostmortemContent(selectedAnalysis)
    : "";

  const timeline = selectedAnalysis?.timeline || [];
  const cascadeServices = selectedAnalysis?.affectedServices || [];
  const cascadeChain = selectedAnalysis?.cascadeChain || [];
  const cascadeBranches = selectedAnalysis?.cascadeBranches || [];
  const cascadeNodes = cascadeServices.length
    ? cascadeServices
    : cascadeChain.map((name) => ({ name, status: undefined, errorCount: undefined }));

  const immediateFixSteps = (selectedAnalysis?.immediateFix || "")
    .split("\n")
    .map((line) => line.replace(/^Step\s*\d+\s*:\s*/i, "").trim())
    .filter(Boolean);

  const permanentFixSteps = (selectedAnalysis?.permanentFix || "")
    .split("\n")
    .map((line) => line.replace(/^Step\s*\d+\s*:\s*/i, "").trim())
    .filter(Boolean);

  const affectedEndpoints = selectedAnalysis?.blastRadius?.affectedEndpoints || [];
  const requestsFailed = selectedAnalysis?.blastRadius?.estimatedRequestsFailed || 0;
  const messagesStuck = selectedAnalysis?.blastRadius?.estimatedMessagesStuck || 0;
  const oversoldOrders = selectedAnalysis?.blastRadius?.estimatedOversoldOrders || 0;
  const misroutedOrders = selectedAnalysis?.blastRadius?.estimatedMisroutedOrders || 0;
  const servicesAffected = cascadeNodes.length;
  const reportReady = Boolean(selectedAnalysis) && !analyzing;
  const currentStep = steps.find((step) => step.status === "running");
  const displaySteps = reportReady
    ? stepTemplate.map((step) => ({ ...step, status: "complete" as const }))
    : steps;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#11120D] text-[#FFFBF4]">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(86,84,73,0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(216,207,188,0.06),transparent_60%)]" />
        <div className="absolute inset-0 grid-lines opacity-50" />
        <div className="absolute inset-0 dot-grid opacity-80" />
        <div className="absolute inset-0 grain mix-blend-soft-light opacity-90" />
        <div className="absolute inset-0 noise mix-blend-overlay opacity-60" />
        <div className="absolute inset-0 scanlines opacity-40" />
        <div className="absolute -top-40 left-1/2 h-225 w-225 -translate-x-1/2 teal-orb opacity-70" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full">
        <aside className="fixed inset-y-0 left-0 z-20 flex w-72 shrink-0 flex-col border-r border-[#565449]/30 bg-[#11120D]/70 backdrop-blur-md">
          <div className="px-5 py-5">
            <Link to="/" className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#D8CFBC]" fill="currentColor" />
              <span className="font-bold text-[#FFFBF4]">CauseAI</span>
            </Link>
            <p className="mt-1 font-mono text-xs text-[#D8CFBC]/40">incident workspace</p>
          </div>
          <div className="mx-5 h-px bg-[#565449]/40" />
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:#565449_transparent]">
            <div className="mb-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#565449]">Incident History</p>
            </div>

            {loadingIncidents && (
              <div className="rounded-md border border-[#565449]/40 bg-[#1D1E17] p-3 text-xs text-[#D8CFBC]/60">
                Loading incidents...
              </div>
            )}

            {!loadingIncidents && incidentsError && (
              <div className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 p-3 text-xs text-[#ef4444]">
                {incidentsError}
              </div>
            )}

            <div className="space-y-2">
              {!loadingIncidents &&
                sidebarIncidents.map((incident) => {
                  const analysis = normalizeAnalysis(incident.analysis_results?.[0]);
                  const incidentSeverity = analysis?.severity || "P2";
                  const active = incident.id === selectedId;
                  const preview = analysis?.rootCause || incident.scenario_name || "No analysis yet";
                  const subPreview =
                    analysis?.businessImpact ||
                    `Root service: ${analysis?.rootCauseService || "unknown-service"}`;
                  return (
                    <button
                      key={incident.id}
                      onClick={() => selectIncident(incident)}
                      className={`relative w-full rounded-xl border px-3 py-3 text-left transition-colors ${active
                          ? "border-[#565449]/60 bg-[#1D1E17]"
                          : "border-[#565449]/30 bg-[#11120D] hover:border-[#565449]/50 hover:bg-[#1D1E17]/50"
                        }`}
                    >
                      {active && (
                        <span className="absolute bottom-3 left-0 top-3 w-0.75 rounded-r bg-[#7f7c6f]" />
                      )}
                      <div className="mb-2 text-[0.95rem] font-semibold leading-tight text-[#FFFBF4]">
                        {preview}
                      </div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${sevStyles[incidentSeverity] || sevStyles.P2}`}>
                          {incidentSeverity}
                        </span>
                        <span className="font-mono text-[10px] text-[#D8CFBC]/40">{timeAgo(incident.created_at)}</span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-[#D8CFBC]/45">
                        {subPreview}
                      </p>
                    </button>
                  );
                })}
            </div>
            {!loadingIncidents && hasMoreHistory && (
              <button
                onClick={() => setShowHistoryPanel(true)}
                className="mt-3 w-full rounded-md border border-[#565449]/50 bg-[#1D1E17] px-3 py-2 text-xs font-mono uppercase tracking-wider text-[#D8CFBC]/80 transition-colors hover:bg-[#565449]/20"
              >
                View More History ({incidents.length})
              </button>
            )}
          </div>
          <div className="mt-auto border-t border-[#565449]/30 p-5">
            <div className="flex items-center gap-2 text-xs text-[#D8CFBC]/40">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              <span className="font-mono">agent.online</span>
            </div>
          </div>
        </aside>

        <main className="ml-72 min-w-0 flex-1">
          <div className="mx-auto w-full max-w-360 space-y-6 px-4 py-8 md:px-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="max-w-2xl text-xl font-bold leading-tight text-[#FFFBF4] md:text-2xl">
                  {title}
                </h1>
                <p className="mt-1 font-mono text-xs text-[#D8CFBC]/40">
                  {analyzing
                    ? "Analyzing logs and generating report..."
                    : selectedIncident
                      ? `Analyzed ${timeAgo(selectedIncident.created_at)}`
                      : "Run an analysis to populate this workspace"}
                </p>
              </div>
              <div className="flex items-center gap-7">
                <div className="flex items-center gap-2 text-[#D8CFBC]/80">
                  <span className={`h-2.5 w-2.5 rounded-full ${analyzing ? "bg-[#f59e0b]" : "bg-[#00d084]"}`} />
                  <span className="font-mono text-sm">{analyzing ? "Agent Running" : "Agent Ready"}</span>
                </div>
                <button
                  onClick={() => {
                    setLogs("");
                    setAnalyzeError("");
                    setShowComposer(true);
                  }}
                  className="rounded-md px-3 py-1.5 text-sm text-[#D8CFBC]/80 transition-colors hover:bg-[#1D1E17] hover:text-[#FFFBF4]"
                >
                  Analyze New Incident
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#565449]/40 bg-[#1D1E17]/90 p-4">
              <div className="flex flex-wrap gap-x-3 gap-y-4 lg:flex-nowrap lg:items-center">
                {displaySteps.map((step, index) => {
                  const complete = step.status === "complete";
                  const running = step.status === "running";
                  return (
                    <div key={`${step.label}-${index}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${complete
                            ? "border-[#00d084] bg-[#00d084]/15 text-[#00d084]"
                            : running
                              ? "border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]"
                              : "border-[#565449] text-[#565449]"
                          }`}
                      >
                        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </span>
                      <p className={`min-w-0 whitespace-nowrap font-mono text-[0.9rem] ${complete ? "text-[#D8CFBC]" : running ? "text-[#FFFBF4]" : "text-[#D8CFBC]/55"}`}>
                        {step.label}
                      </p>
                      {index < displaySteps.length - 1 && (
                        <span className="hidden h-px w-14 shrink-0 bg-[#565449]/60 lg:block" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {analyzing && (
              <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
                <div className="flex items-start gap-3">
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-[#f59e0b]" />
                  <div>
                    <p className="text-lg font-semibold text-[#FFFBF4]">AI agent is analyzing logs...</p>
                    <p className="mt-1 text-sm text-[#D8CFBC]/60">
                      {currentStep?.detail || "Tracing services and generating incident report."}
                    </p>
                    <p className="mt-4 rounded-md border border-[#565449]/50 bg-[#11120D] px-3 py-2 font-mono text-xs text-[#D8CFBC]/70">
                      Report appears automatically after all five steps complete.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {reportReady && (
              <>
                <div className="relative overflow-hidden rounded-lg border border-[#565449]/40 border-l-4 border-l-[#ef4444] bg-[#1D1E17] shadow-[inset_8px_0_24px_-12px_rgba(239,68,68,0.5)]">
                  <div className="relative flex flex-col gap-8 p-7 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="mb-4 flex items-center gap-3">
                        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${sevStyles[severity] || sevStyles.P2}`}>{severity}</span>
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[#565449]">Root Cause</span>
                      </div>
                      <h2 className="text-xl font-bold leading-tight text-[#FFFBF4] md:text-2xl">
                        {descriptiveRootCause || "No analysis selected yet."}
                      </h2>
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <span className="rounded-md border border-[#565449] bg-[#565449]/40 px-2.5 py-1 font-mono text-xs text-[#D8CFBC]">
                          svc:{selectedAnalysis?.rootCauseService || "unknown-service"}
                        </span>
                        {selectedAnalysis?.businessImpact && (
                          <span className="text-xs text-[#D8CFBC]/50">{selectedAnalysis.businessImpact}</span>
                        )}
                      </div>
                    </div>
                    <ConfidenceArc value={selectedAnalysis?.confidenceScore || 0} />
                  </div>
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-2">
                  <div className="h-fit rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
                    <p className="mb-4 text-[11px] font-mono uppercase tracking-widest text-[#565449]">Blast Radius</p>
                    <div className="mb-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-mono text-4xl font-bold text-[#FFFBF4]">{servicesAffected.toLocaleString()}</p>
                        <p className="mt-1 text-xs text-[#D8CFBC]/50">services affected</p>
                      </div>
                      <div>
                        <p className="font-mono text-4xl font-bold text-[#FFFBF4]">{requestsFailed.toLocaleString()}</p>
                        <p className="mt-1 text-xs text-[#D8CFBC]/50">requests dropped</p>
                      </div>
                    </div>
                    {(messagesStuck > 0 || oversoldOrders > 0 || misroutedOrders > 0) && (
                      <div className="mb-5 grid gap-2 sm:grid-cols-2">
                        {messagesStuck > 0 && (
                          <div className="rounded-md border border-[#565449]/50 bg-[#11120D] px-3 py-2">
                            <p className="font-mono text-2xl font-bold text-[#f59e0b]">{messagesStuck.toLocaleString()}</p>
                            <p className="text-xs text-[#D8CFBC]/55">emails/messages stuck in queue</p>
                          </div>
                        )}
                        {oversoldOrders > 0 && (
                          <div className="rounded-md border border-[#565449]/50 bg-[#11120D] px-3 py-2">
                            <p className="font-mono text-2xl font-bold text-[#ef4444]">{oversoldOrders.toLocaleString()}</p>
                            <p className="text-xs text-[#D8CFBC]/55">oversold orders requiring audit</p>
                          </div>
                        )}
                        {misroutedOrders > 0 && (
                          <div className="rounded-md border border-[#565449]/50 bg-[#11120D] px-3 py-2">
                            <p className="font-mono text-2xl font-bold text-[#f59e0b]">{misroutedOrders.toLocaleString()}</p>
                            <p className="text-xs text-[#D8CFBC]/55">orders misrouted to default warehouse</p>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-[#565449]">Endpoints</p>
                    <div className="flex flex-wrap gap-2">
                      {(affectedEndpoints.length ? affectedEndpoints : ["No endpoint details"]).map((endpoint) => (
                        <span
                          key={endpoint}
                          className="rounded-md border border-[#565449] bg-[#11120D] px-2 py-1 font-mono text-xs text-[#D8CFBC]"
                        >
                          {endpoint}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
                    <p className="mb-4 text-[11px] font-mono uppercase tracking-widest text-[#565449]">Cascade Chain</p>
                    {cascadeBranches.length > 1 && (
                      <div className="mb-4 space-y-1 rounded-md border border-[#565449]/40 bg-[#11120D] p-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#565449]">Branches</p>
                        {cascadeBranches.map((branch) => (
                          <p key={branch} className="font-mono text-[11px] text-[#D8CFBC]/75">
                            {branch}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="space-y-3">
                      {cascadeNodes.map((service, index, array) => (
                        <div key={`${service.name || "service"}-${index}`}>
                          <div
                            className="flex items-center gap-3 rounded-md border border-[#565449]/40 border-l-2 bg-[#11120D] p-3"
                            style={{ borderLeftColor: getCascadeTone(service.status || "").color }}
                          >
                            <ServiceIcon index={index} />
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-[1rem] text-[#FFFBF4]">{service.name || "unknown-service"}</p>
                              <p className="font-mono text-[11px] text-[#D8CFBC]/40">
                                {getCascadeTone(service.status || "").label}
                                {service.errorCount ? ` - ${service.errorCount} errors` : " - 0 errors"}
                              </p>
                            </div>
                          </div>
                          {index < array.length - 1 && (
                            <div className="flex justify-center py-1">
                              <ChevronRight className="h-4 w-4 rotate-90 text-[#565449]" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
                  <p className="mb-5 text-[11px] font-mono uppercase tracking-widest text-[#565449]">Incident Timeline</p>
                  <div className="relative pl-8">
                    <div className="absolute bottom-1 left-3 top-1 w-px bg-[#565449]/40" />
                    {(timeline.length
                      ? timeline
                      : [{ time: "--:--:--", service: "unknown", event: "No timeline available yet." }]
                    ).map((event, index) => (
                      <div key={`${event.time || "time"}-${index}`} className="relative flex items-start gap-4 pb-5 last:pb-0">
                        <div
                          className="absolute -left-6.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-[#1D1E17]"
                          style={{ borderColor: timelineMeta(event.type, index).color }}
                        >
                          {renderTimelineIcon(event.type, index)}
                        </div>
                        <span className="mt-0.5 w-20 shrink-0 font-mono text-xs text-[#D8CFBC]/40">{event.time || "--:--:--"}</span>
                        <span
                          className="shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] text-[#D8CFBC]"
                          style={{
                            borderColor: `${timelineMeta(event.type, index).color}66`,
                            backgroundColor: `${timelineMeta(event.type, index).color}22`,
                          }}
                        >
                          {event.service || "unknown"}
                        </span>
                        <span className="text-sm text-[#FFFBF4]">{event.event || event.description || "No detail"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <FixPanel
                    accent="#ef4444"
                    title="Immediate Fix"
                    steps={immediateFixSteps.length ? immediateFixSteps : ["No immediate remediation captured yet."]}
                  />
                  <FixPanel
                    accent="#10b981"
                    title="Permanent Fix"
                    steps={permanentFixSteps.length ? permanentFixSteps : ["No long-term prevention plan captured yet."]}
                  />
                </div>

                <div className="flex items-center gap-6 border-b border-[#565449]/40">
                  {[
                    { id: "trend", label: "Trend", Icon: TrendingUp },
                    { id: "postmortem", label: "Post-Mortem", Icon: FileText },
                    { id: "ask", label: "Ask Agent", Icon: MessageSquare },
                  ].map((entry) => {
                    const active = tab === entry.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setTab(entry.id as typeof tab)}
                        className={`relative flex items-center gap-2 py-3 text-sm transition-colors ${active ? "text-[#FFFBF4]" : "text-[#D8CFBC]/50 hover:text-[#D8CFBC]"
                          }`}
                      >
                        <entry.Icon className="h-4 w-4" />
                        {entry.label}
                        {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[#D8CFBC]" />}
                      </button>
                    );
                  })}
                </div>

                {tab === "trend" && (
                  <TrendTab
                    serviceName={selectedAnalysis?.rootCauseService || ""}
                    p0={severityCounts.P0}
                    p1={severityCounts.P1}
                    p2={severityCounts.P2}
                    postmortemCount={postmortemCount}
                  />
                )}

                {tab === "postmortem" && (
                  <PostmortemTab
                    markdown={markdown}
                    disabled={!selectedAnalysis}
                    saved={savedPostmortem}
                    saving={savingPostmortem}
                    onCopy={() => void navigator.clipboard.writeText(markdown)}
                    onDownload={() => downloadMarkdown(markdown, "postmortem.md")}
                    onSave={async () => {
                      if (!selectedAnalysis) return;
                      setSavingPostmortem(true);
                      try {
                        if (selectedAnalysis.analysisId) {
                          const generated = await generatePostmortem(selectedAnalysis.analysisId);
                          if (generated.reportMarkdown) setGeneratedPostmortem(generated.reportMarkdown);
                        } else {
                          const saveTitle = `Incident: ${selectedAnalysis.rootCauseService} - ${selectedAnalysis.severity}`;
                          await savePostmortem(selectedAnalysis.incidentId || null, saveTitle, markdown);
                        }
                        setSavedPostmortem(true);
                        await refreshPostmortemCount();
                      } finally {
                        setSavingPostmortem(false);
                      }
                    }}
                  />
                )}

                {tab === "ask" && (
                  <AskTab
                    messages={chatMessages}
                    input={chatInput}
                    loading={chatLoading}
                    disabled={!selectedAnalysis}
                    onChangeInput={setChatInput}
                    onSend={() => void handleSendChat()}
                  />
                )}
              </>
            )}

            {!analyzing && !reportReady && (
              <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-8 text-center">
                <p className="font-mono text-xs uppercase tracking-widest text-[#565449]">No Active Report</p>
                <p className="mt-3 text-[#D8CFBC]/65">
                  Run a new incident analysis to generate the full root-cause report view.
                </p>
              </div>
            )}

            <div className="h-8" />
          </div>
        </main>
      </div>

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#565449]/60 bg-[#1D1E17]">
            <div className="flex items-center justify-between border-b border-[#565449]/40 px-5 py-3">
              <p className="font-mono text-xs uppercase tracking-widest text-[#D8CFBC]/60">Analyze New Incident</p>
              <button onClick={() => setShowComposer(false)} className="rounded p-1 text-[#D8CFBC]/50 hover:bg-[#11120D] hover:text-[#D8CFBC]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-5 [scrollbar-color:#565449_transparent]">
              <textarea
                value={logs}
                onChange={(event) => setLogs(event.target.value)}
                className="h-44 w-full rounded-md border border-[#565449]/60 bg-[#11120D] p-3 font-mono text-xs text-[#FFFBF4] outline-none focus:border-[#565449]"
                placeholder="Paste logs here..."
              />
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[#565449]">Demo Scenarios</p>
                  <p className="text-[11px] text-[#D8CFBC]/45">8 pre-built incidents</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {demoScenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="rounded-md border border-[#565449]/40 bg-[#11120D]/80 p-3"
                    >
                      <p className="mb-1 text-sm font-semibold text-[#FFFBF4]">{scenario.name}</p>
                      <p className="mb-3 text-xs leading-relaxed text-[#D8CFBC]/55">
                        {scenario.description}
                      </p>
                      <button
                        onClick={() => {
                          setLogs(scenario.logs);
                          void handleAnalyzeNewIncident(scenario.logs, scenario.name);
                        }}
                        disabled={analyzing}
                        className="rounded-md border border-[#565449] px-3 py-1.5 text-xs text-[#D8CFBC] transition-colors hover:bg-[#1D1E17] disabled:opacity-50"
                      >
                        Load & Analyze
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {analyzeError && <p className="text-sm text-[#ef4444]">{analyzeError}</p>}
              <div className="flex items-center justify-between">
                <div />
                <button
                  onClick={() => void handleAnalyzeNewIncident()}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 rounded-md border border-[#565449] bg-[#565449] px-3 py-1.5 text-sm text-[#FFFBF4] disabled:opacity-60"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {analyzing ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistoryPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#565449]/60 bg-[#1D1E17]">
            <div className="flex items-center justify-between border-b border-[#565449]/40 px-5 py-3">
              <p className="font-mono text-xs uppercase tracking-widest text-[#D8CFBC]/60">All Incident History</p>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="rounded p-1 text-[#D8CFBC]/50 hover:bg-[#11120D] hover:text-[#D8CFBC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-4 [scrollbar-color:#565449_transparent]">
              {incidents.map((incident) => {
                const analysis = normalizeAnalysis(incident.analysis_results?.[0]);
                const incidentSeverity = analysis?.severity || "P2";
                const active = incident.id === selectedId;
                const preview = analysis?.rootCause || incident.scenario_name || "No analysis yet";
                const subPreview =
                  analysis?.businessImpact ||
                  `Root service: ${analysis?.rootCauseService || "unknown-service"}`;

                return (
                  <button
                    key={`history-panel-${incident.id}`}
                    onClick={() => selectIncident(incident)}
                    className={`relative w-full rounded-lg border px-3 py-3 text-left transition-colors ${active
                        ? "border-[#565449]/60 bg-[#11120D]"
                        : "border-[#565449]/30 bg-[#0d0e0a] hover:border-[#565449]/50 hover:bg-[#11120D]"
                      }`}
                  >
                    {active && (
                      <span className="absolute bottom-3 left-0 top-3 w-0.75 rounded-r bg-[#7f7c6f]" />
                    )}
                    <div className="mb-2 text-[0.95rem] font-semibold text-[#FFFBF4]">{preview}</div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${sevStyles[incidentSeverity] || sevStyles.P2}`}>
                        {incidentSeverity}
                      </span>
                      <span className="font-mono text-[10px] text-[#D8CFBC]/40">{timeAgo(incident.created_at)}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-[#D8CFBC]/45">
                      {subPreview}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceIcon({ index }: { index: number }) {
  if (index % 3 === 0) return <Database className="h-4 w-4 text-[#D8CFBC]/60" />;
  if (index % 3 === 1) return <Server className="h-4 w-4 text-[#D8CFBC]/60" />;
  return <Cloud className="h-4 w-4 text-[#D8CFBC]/60" />;
}

function getCascadeTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("oom")) {
    return { color: "#ef4444", label: "OOM Killed" };
  }
  if (normalized.includes("failed") || normalized.includes("unavailable") || normalized.includes("expired") || normalized.includes("auth")) {
    return { color: "#ef4444", label: "Failed" };
  }
  if (normalized.includes("degrad") || normalized.includes("timeout") || normalized.includes("pressure") || normalized.includes("warning")) {
    return { color: "#f59e0b", label: "Degraded" };
  }
  if (normalized.includes("healthy") || normalized.includes("recover")) {
    return { color: "#00d084", label: "Healthy" };
  }
  return { color: "#D8CFBC", label: status || "Unknown" };
}

function timelineMeta(type?: string, index = 0) {
  const normalized = (type || "").toLowerCase();
  const fallbackPalette = ["#f59e0b", "#ef4444", "#f59e0b", "#ef4444", "#d8cfbc", "#00d084"];
  const fallbackColor = fallbackPalette[index % fallbackPalette.length];

  if (normalized === "root_cause") {
    return { kind: "root_cause", color: "#ef4444" };
  }
  if (normalized === "cascade") {
    return { kind: "cascade", color: "#f59e0b" };
  }
  if (normalized === "error") {
    return { kind: "error", color: "#ef4444" };
  }
  if (normalized === "impact" || normalized === "warning") {
    return { kind: "impact", color: "#facc15" };
  }
  if (normalized === "recovery" || normalized === "info") {
    return { kind: "recovery", color: "#10b981" };
  }

  return { kind: "impact", color: fallbackColor };
}

function renderTimelineIcon(type?: string, index = 0) {
  const meta = timelineMeta(type, index);
  if (meta.kind === "root_cause") return <Flame className="h-2.5 w-2.5" style={{ color: meta.color }} />;
  if (meta.kind === "cascade") return <ArrowRight className="h-2.5 w-2.5" style={{ color: meta.color }} />;
  if (meta.kind === "error") return <AlertTriangle className="h-2.5 w-2.5" style={{ color: meta.color }} />;
  if (meta.kind === "recovery") return <CheckCircle2 className="h-2.5 w-2.5" style={{ color: meta.color }} />;
  return <AlertTriangle className="h-2.5 w-2.5" style={{ color: meta.color }} />;
}

function ConfidenceArc({ value }: { value: number }) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const safeValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (safeValue / 100) * circumference;
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} stroke="#565449" strokeOpacity="0.3" strokeWidth="6" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="#D8CFBC"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-[#FFFBF4]">{safeValue}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#D8CFBC]/50">% confidence</span>
      </div>
    </div>
  );
}

function FixPanel({ accent, title, steps }: { accent: string; title: string; steps: string[] }) {
  return (
    <div className="rounded-lg border border-[#565449]/40 border-l-4 bg-[#1D1E17] p-6" style={{ borderLeftColor: accent }}>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[#565449]">{title}</p>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm text-[#D8CFBC]/80">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}66` }}
            >
              {index + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PostmortemTab({
  markdown,
  disabled,
  saved,
  saving,
  onCopy,
  onDownload,
  onSave,
}: {
  markdown: string;
  disabled: boolean;
  saved: boolean;
  saving: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onSave: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[#565449]/40 bg-[#11120D]">
      <div className="flex items-center justify-between border-b border-[#565449]/30 px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-xs text-[#D8CFBC]/50">
          <FileText className="h-3.5 w-3.5" />
          post-mortem.md
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-[#D8CFBC]/70 transition-colors hover:bg-[#1D1E17] hover:text-[#FFFBF4] disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={onDownload}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-[#D8CFBC]/70 transition-colors hover:bg-[#1D1E17] hover:text-[#FFFBF4] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Download .md
          </button>
          <button
            onClick={onSave}
            disabled={disabled || saving || saved}
            className="rounded-md border border-[#565449] px-3 py-1.5 text-xs text-[#D8CFBC] disabled:opacity-40"
          >
            {saved ? "Saved" : saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap p-6 font-mono text-xs leading-relaxed text-[#D8CFBC]">
        {disabled ? "Run or select an incident to generate a postmortem." : markdown}
      </pre>
    </div>
  );
}

function TrendTab({
  serviceName,
  p0,
  p1,
  p2,
  postmortemCount,
}: {
  serviceName: string;
  p0: number;
  p1: number;
  p2: number;
  postmortemCount: number | null;
}) {
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState("");
  const [trendData, setTrendData] = useState<Array<{ created_at: string; confidence_score: number; severity: string }>>([]);

  useEffect(() => {
    if (!serviceName) {
      setTrendData([]);
      return;
    }

    let cancelled = false;
    async function run() {
      try {
        setTrendLoading(true);
        setTrendError("");
        const rows = await fetchServiceTrend(serviceName);
        if (!cancelled) setTrendData(rows);
      } catch (error) {
        if (!cancelled) setTrendError(error instanceof Error ? error.message : "Failed to load trend");
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [serviceName]);

  const chartData = trendData.map((row) => ({
    ...row,
    date: new Date(row.created_at).toLocaleDateString(),
  }));

  const max = Math.max(1, p0, p1, p2);
  return (
    <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
      <p className="mb-4 text-[11px] font-mono uppercase tracking-widest text-[#565449]">Severity Distribution</p>
      <div className="mb-4 flex h-40 items-end gap-3">
        {[
          { label: "P0", value: p0, color: "from-[#ef4444]/95 to-[#ef4444]/40" },
          { label: "P1", value: p1, color: "from-[#f59e0b]/95 to-[#f59e0b]/40" },
          { label: "P2", value: p2, color: "from-[#D8CFBC]/95 to-[#D8CFBC]/40" },
        ].map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-t bg-linear-to-t ${item.color}`}
              style={{ height: `${Math.max(12, (item.value / max) * 100)}%` }}
            />
            <span className="font-mono text-[10px] text-[#D8CFBC]/55">
              {item.label} ({item.value})
            </span>
          </div>
        ))}
      </div>
      <p className="font-mono text-xs text-[#D8CFBC]/50">
        Saved postmortems: <span className="text-[#D8CFBC]">{postmortemCount ?? "n/a"}</span>
      </p>
      <div className="mt-6 rounded-md border border-[#565449]/40 bg-[#11120D] p-4">
        <p className="mb-3 font-mono text-xs text-[#D8CFBC]/60">
          Service confidence trend: {serviceName || "n/a"}
        </p>
        {trendLoading && <p className="text-xs text-[#D8CFBC]/50">Loading trend...</p>}
        {!trendLoading && trendError && <p className="text-xs text-[#ef4444]">{trendError}</p>}
        {!trendLoading && !trendError && chartData.length === 0 && (
          <p className="text-xs text-[#D8CFBC]/50">No historical trend data for this service.</p>
        )}
        {!trendLoading && !trendError && chartData.length > 0 && (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#7f7c6f" tick={{ fill: "#9f9a89", fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#7f7c6f" tick={{ fill: "#9f9a89", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#11120D", border: "1px solid #565449", borderRadius: 8 }}
                  labelStyle={{ color: "#D8CFBC" }}
                  formatter={(value: number, _name, context) => [
                    `${value}% (${context?.payload?.severity || "unknown"})`,
                    "confidence",
                  ]}
                />
                <Line type="monotone" dataKey="confidence_score" stroke="#D8CFBC" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function AskTab({
  messages,
  input,
  loading,
  disabled,
  onChangeInput,
  onSend,
}: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  input: string;
  loading: boolean;
  disabled: boolean;
  onChangeInput: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
      {messages.length === 0 && (
        <div className="text-sm text-[#D8CFBC]/70">Select an incident to begin Q&A with the agent.</div>
      )}
      <div className="max-h-80 space-y-3 overflow-auto">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-md border p-3 text-sm ${message.role === "assistant"
                ? "border-[#565449]/50 bg-[#11120D] text-[#D8CFBC]"
                : "border-[#565449] bg-[#565449]/20 text-[#FFFBF4]"
              }`}
          >
            {message.content}
          </div>
        ))}
        {loading && (
          <div className="inline-flex items-center gap-2 rounded-md border border-[#565449]/50 bg-[#11120D] p-3 text-xs text-[#D8CFBC]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
          </div>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#565449]" />
        <input
          value={input}
          onChange={(event) => onChangeInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          disabled={disabled}
          placeholder={disabled ? "Analyze or select an incident first..." : "Ask the agent..."}
          className="w-full rounded-md border border-[#565449]/60 bg-[#11120D] py-3 pl-9 pr-24 font-mono text-sm text-[#FFFBF4] placeholder:text-[#D8CFBC]/30 focus:outline-none focus:border-[#565449] disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || loading || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[#565449] px-3 py-1.5 text-xs text-[#D8CFBC] disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-1">
            <Send className="h-3.5 w-3.5" /> Send
          </span>
        </button>
      </div>
    </div>
  );
}

function toShortPhrase(text: string, wordLimit = 5) {
  const tokens = text
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return "";
  if (tokens.length <= wordLimit) return tokens.join(" ");
  return tokens.slice(0, wordLimit).join(" ");
}

function getPrimaryIncidentTitle(
  rootCause: string,
  rootCauseService: string,
  scenarioName: string,
  fallback: string,
) {
  const trimmedScenario = scenarioName.trim();
  if (trimmedScenario && trimmedScenario.toLowerCase() !== "manual") {
    return toShortPhrase(trimmedScenario, 4);
  }

  const shortCause = toShortPhrase(rootCause, 4);
  if (rootCauseService && shortCause) {
    const normalizedService = rootCauseService.toLowerCase();
    if (shortCause.toLowerCase().includes(normalizedService)) return shortCause;
    return `${rootCauseService}: ${shortCause}`;
  }

  return shortCause || fallback;
}

function getDescriptiveRootCause(rootCause: string, businessImpact: string) {
  const trimmedCause = rootCause.trim();
  const trimmedImpact = businessImpact.trim();

  if (!trimmedCause && !trimmedImpact) return "";
  if (!trimmedImpact) return trimmedCause;
  if (!trimmedCause) return trimmedImpact;
  if (trimmedCause.toLowerCase().includes(trimmedImpact.toLowerCase())) return trimmedCause;

  return `${trimmedCause}. ${trimmedImpact}`;
}

function downloadMarkdown(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function timeAgo(isoTimestamp: string) {
  const diffSeconds = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}
