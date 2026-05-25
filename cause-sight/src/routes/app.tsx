import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";
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
  Eye,
  FileText,
  Flame,
  Loader2,
  MessageSquare,
  Radar,
  Search,
  Send,
  Server,
  Shield,
  TrendingUp,
  X,
  Zap,
  Activity,
  Clock,
  Target,
  Crosshair,
  BarChart3,
  Layers,
} from "lucide-react";

import {
  API_BASE,
  analyzeIncident,
  fetchServiceTrend,
  generatePostmortem,
  fetchIncidents,
  fetchPostmortems,
  normalizeAnalysis,
  savePostmortem,
  sendChatMessage,
  fetchHeatmap,
  predictBlastRadius,
  generateOnCallBriefing,
  type HeatmapDay,
  type BlastPrediction,
  type OnCallBriefing,
  type CauseAnalysis,
  type IncidentSummary,
  type StreamStep,
  type SimilarIncident,
  type IncidentDNA,
  fetchIncidentSimilar,
  scanShadowIncidents,
  type ShadowIncident,
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

function LogOutButton() {
  const { logout } = useAuth()
  return (
    <button
      onClick={logout}
      className="font-mono text-[10px] uppercase tracking-widest hover: transition-colors font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}
    >
      sign out
    </button>
  )
}

function AppPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [incidentsError, setIncidentsError] = useState("");
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const searchParams = new URLSearchParams(window.location.search);
  const urlIncidentId = searchParams.get('incident');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CauseAnalysis | null>(null);

  const [tab, setTab] = useState<'trend' | 'postmortem' | 'ask' | 'remediate'>("postmortem");
  const [showRemediate, setShowRemediate] = useState(false);
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
  const [showAgentDrawer, setShowAgentDrawer] = useState(false);
  const [showPredictModal, setShowPredictModal] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [predictInput, setPredictInput] = useState('');
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictResult, setPredictResult] = useState<BlastPrediction | null>(null);
  const [predictError, setPredictError] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingResult, setBriefingResult] = useState<OnCallBriefing | null>(null);
  const [briefingError, setBriefingError] = useState('');
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [activeScenarioName, setActiveScenarioName] = useState("Incident Analysis");
  const [shadowIncidents, setShadowIncidents] = useState<ShadowIncident[]>([]);
  const [shadowScanning, setShadowScanning] = useState(false);
  const [shadowError, setShadowError] = useState('');
  const [shadowScannedAt, setShadowScannedAt] = useState<string | null>(null);
  const [activeSidebarSection, setActiveSidebarSection] = useState('root-cause');

  const severityCounts = useMemo(() => {
    const buckets = { P0: 0, P1: 0, P2: 0 };
    incidents.forEach((incident) => {
      const sev = ((incident as any).severity || normalizeAnalysis(incident.analysis_results?.[0])?.severity) as keyof typeof buckets | undefined;
      if (sev && sev in buckets) buckets[sev] += 1;
    });
    return buckets;
  }, [incidents]);

  useEffect(() => {
    void refreshIncidents();
    void refreshPostmortemCount();
    fetchHeatmap(365).then(setHeatmapData).catch(() => {}).finally(() => setHeatmapLoading(false));

    const handleNewIncident = (e: any) => {
      const newId = e.detail?.incidentId;
      void refreshIncidents(newId);
    };
    window.addEventListener('causeai:new-incident', handleNewIncident);
    return () => window.removeEventListener('causeai:new-incident', handleNewIncident);
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

  useEffect(() => {
    const handler = () => setShowRemediate(true)
    window.addEventListener('open-remediate', handler)
    return () => window.removeEventListener('open-remediate', handler)
  }, [])

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
      const firstAnalyzed = data.find((incident) => Array.isArray(incident.analysis_results) && incident.analysis_results.length > 0);
      const defaultId = firstAnalyzed ? firstAnalyzed.id : data[0].id;
      const targetId = preferredId ?? (urlIncidentId ? (isNaN(Number(urlIncidentId)) ? urlIncidentId : Number(urlIncidentId)) : null) ?? selectedId ?? defaultId;
      const match = data.find((incident) => incident.id === targetId) || data[0];
      setSelectedId(match.id);
      
      let analysis = normalizeAnalysis(match.analysis_results?.[0]);
      setSelectedAnalysis(analysis);

      if (match.id) {
        fetchIncidentSimilar(match.id).then(simData => {
          setSelectedAnalysis(prev => prev ? {
            ...prev,
            similarIncidents: simData.similarIncidents || prev.similarIncidents,
            incidentDna: simData.incidentDna || prev.incidentDna
          } : null);
        }).catch(err => console.error(err));
      }
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
    let analysis = normalizeAnalysis(incident.analysis_results?.[0]);
    setSelectedId(incident.id);
    setSelectedAnalysis(analysis);
    setActiveScenarioName(analysis?.rootCause || incident.scenario_name || "Incident Analysis");
    setShowHistoryPanel(false);

    if (incident.id) {
      fetchIncidentSimilar(incident.id).then(simData => {
        setSelectedAnalysis(prev => prev ? {
          ...prev,
          similarIncidents: simData.similarIncidents || prev.similarIncidents,
          incidentDna: simData.incidentDna || prev.incidentDna
        } : null);
      }).catch(err => console.error(err));
    }
  }

  async function handleShadowScan() {
    if (shadowScanning) return;
    setShadowScanning(true);
    setShadowError('');
    try {
      const result = await scanShadowIncidents();
      setShadowIncidents(result.shadowIncidents || []);
      setShadowScannedAt(result.scannedAt);
    } catch (err) {
      setShadowError(err instanceof Error ? err.message : 'Shadow scan failed');
    } finally {
      setShadowScanning(false);
    }
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

  const splitSteps = (text: string) => text
    .split(/\n|(?=\s*\d+\.\s)|(?=\s*Step\s*\d+)/i)
    .map((line) => line.replace(/^(Step\s*\d+\s*[:\-\.]*\s*|\d+\.\s*)/i, "").trim())
    .filter((line) => line.length > 10);

  const immediateFixSteps = splitSteps(selectedAnalysis?.immediateFix || "");
  const permanentFixSteps = splitSteps(selectedAnalysis?.permanentFix || "");

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
      <Navbar />

        <main className="mt-14 min-w-0 flex-1 flex h-[calc(100vh-3.5rem)]">
          {reportReady && (
            <aside className="sticky top-0 hidden w-64 flex-col border-r border-[#565449]/40 bg-[#11120D] p-6 lg:flex overflow-y-auto">
              <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-[#565449] font-bold">Dashboard</p>
              <nav className="flex flex-col gap-2">
                {[
                  { id: 'root-cause', label: 'Root Cause', icon: Target },
                  { id: 'shadow', label: 'Shadow Incidents', icon: Shield },
                  { id: 'blast-radius', label: 'Blast Radius', icon: Crosshair },
                  { id: 'timeline', label: 'Incident Timeline', icon: Clock },
                  { id: 'fixes', label: 'Remediation', icon: CheckCircle2 },
                  { id: 'dna', label: 'Incident DNA', icon: Database },
                  { id: 'heatmap', label: 'Incident Heatmap', icon: BarChart3 },
                ].map(item => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                       e.preventDefault();
                       document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                       setActiveSidebarSection(item.id);
                    }}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${activeSidebarSection === item.id ? 'bg-[#565449]/30 text-[#FFFBF4] border border-[#565449]/50' : 'text-[#D8CFBC]/60 hover:bg-[#1D1E17] hover:text-[#D8CFBC] border border-transparent'}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>
          )}

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <div className="mx-auto w-full max-w-360 space-y-6 px-4 py-8 md:px-5 pb-32">
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
                {selectedIncident && !analyzing && (
                  <p className={`mt-1.5 text-xs font-semibold ${selectedIncident.source && selectedIncident.source !== 'manual' ? 'text-green-400 font-bold' : 'text-[#FFFBF4]'}`}>
                    {selectedIncident.source && selectedIncident.source !== 'manual'
                      ? `Generated from ${selectedIncident.source.charAt(0).toUpperCase() + selectedIncident.source.slice(1)} alert`
                      : 'Source: Manual Log Entry'}
                  </p>
                )}
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
                  className="inline-flex items-center gap-2 rounded-md border border-[#565449]/60 bg-[#1D1E17] px-3 py-1.5 text-sm text-[#D8CFBC]/80 transition-all hover:bg-[#565449]/20 hover:text-[#FFFBF4]"
                >
                  Analyze New Incident
                </button>
                <button
                  onClick={() => { setBriefingResult(null); setBriefingError(''); setShowBriefingModal(true); }}
                  className="inline-flex items-center gap-2 rounded-md border border-[#565449]/60 bg-[#1D1E17] px-3 py-1.5 text-sm text-[#D8CFBC]/80 transition-all hover:bg-[#565449]/20 hover:text-[#FFFBF4]"
                >
                  <FileText className="h-4 w-4" />
                  On-Call Briefing
                </button>
                <button
                  onClick={() => { setPredictResult(null); setPredictError(''); setPredictInput(''); setShowPredictModal(true); }}
                  className="inline-flex items-center gap-2 rounded-md border border-[#10b981]/50 bg-[#10b981]/10 px-3 py-1.5 text-sm text-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all hover:bg-[#10b981]/20"
                >
                  <Zap className="h-4 w-4" />
                  Predict Blast Radius
                </button>
                <button
                  onClick={() => setShowAgentDrawer(true)}
                  disabled={!reportReady}
                  className="inline-flex items-center gap-2 rounded-md border border-[#f59e0b]/60 bg-[#f59e0b]/10 px-3 py-1.5 text-sm text-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all hover:bg-[#f59e0b]/20 hover:shadow-[0_0_18px_rgba(245,158,11,0.35)] disabled:opacity-40"
                >
                  <MessageSquare className="h-4 w-4" />
                  Ask Agent
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
                <div id="root-cause" className="relative overflow-hidden rounded-lg border border-[#565449]/40 border-l-4 border-l-[#ef4444] bg-[#1D1E17] shadow-[inset_8px_0_24px_-12px_rgba(239,68,68,0.5)]">
                  <div className="relative flex flex-col gap-8 p-7 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="mb-4 flex items-center gap-3">
                        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${sevStyles[severity] || sevStyles.P2}`}>{severity}</span>
                        <span className="text-[11px] font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Root Cause</span>
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

                <div id="shadow" className="rounded-lg border border-[#f59e0b]/40 bg-[#1D1E17] p-6 shadow-[inset_0_2px_15px_-5px_rgba(245,158,11,0.15)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#f59e0b]" />
                      <p className="text-[11px] font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#f59e0b" }}>Shadow Incidents (Near-misses)</p>
                    </div>
                    <button
                      onClick={handleShadowScan}
                      disabled={shadowScanning}
                      className="inline-flex items-center gap-2 rounded-md border border-[#f59e0b]/40 bg-[#11120D] px-3 py-1.5 text-xs text-[#f59e0b] hover:bg-[#f59e0b]/10 disabled:opacity-50 transition-colors"
                    >
                      {shadowScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
                      {shadowScanning ? "Scanning logs..." : "Scan for near-misses"}
                    </button>
                  </div>
                  {shadowError && (
                    <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                      {shadowError}
                    </div>
                  )}
                  {shadowIncidents.length > 0 ? (
                    <div className="space-y-3">
                      {shadowIncidents.map((inc, i) => (
                        <div key={i} className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center rounded-md border border-[#565449]/40 bg-[#11120D] p-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="rounded border border-[#f59e0b]/50 px-1.5 py-0.5 font-mono text-[9px] text-[#f59e0b]">Risk: {inc.riskScore}</span>
                              <span className="font-mono text-xs font-bold text-[#D8CFBC]">{inc.service}</span>
                            </div>
                            <p className="mt-1 text-sm text-[#FFFBF4]">{inc.title}</p>
                            <p className="mt-1 font-mono text-[10px] text-[#D8CFBC]/50">Pattern: {inc.pattern}</p>
                          </div>
                          <span className="shrink-0 rounded bg-[#f59e0b]/10 px-2 py-1 font-mono text-[10px] text-[#f59e0b]">
                            {inc.recommendedAction}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : shadowScannedAt ? (
                    <div className="rounded border border-[#00d084]/20 bg-[#00d084]/5 p-4 text-center">
                      <CheckCircle2 className="mx-auto h-5 w-5 text-[#00d084] opacity-80" />
                      <p className="mt-2 text-sm text-[#00d084]/80">No shadow incidents detected in recent logs.</p>
                      <p className="mt-1 font-mono text-[10px] text-[#D8CFBC]/40">Last scanned: {new Date(shadowScannedAt).toLocaleTimeString()}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#D8CFBC]/50">Scan proactive logs to detect patterns of incidents before they break SLAs.</p>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <div id="blast-radius" className="h-fit rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
                    <p className="mb-4 text-[11px] font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Blast Radius</p>
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
                    <p className="mb-2 text-[10px] font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Endpoints</p>
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

                  <CascadeGraph nodes={cascadeNodes} />
                </div>

                <div id="timeline" className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
                  <p className="mb-5 text-[11px] font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Incident Timeline</p>
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

                <div id="fixes" className="grid gap-6 lg:grid-cols-2">
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


                {/* Incident DNA & Similar Incidents */}
                {((selectedAnalysis?.similarIncidents && selectedAnalysis.similarIncidents.length > 0) || selectedAnalysis?.incidentDna) && (
                  <div id="dna" className="rounded-lg border border-[#3b82f6]/30 bg-[#11120D] overflow-hidden">
                    {/* DNA Header */}
                    <div className="border-b border-[#3b82f6]/20 bg-[#1D1E17] p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Database className="h-4 w-4 text-[#3b82f6]" />
                        <p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]">Incident DNA Profile</p>
                      </div>
                      
                      {selectedAnalysis?.incidentDna ? (
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="rounded border border-[#565449]/40 bg-[#11120D] px-3 py-2">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-[#565449] mb-1">Failure Mode</p>
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                              <span className="font-mono text-xs text-[#FFFBF4] capitalize">{selectedAnalysis.incidentDna.failureMode}</span>
                            </div>
                          </div>
                          
                          <div className="rounded border border-[#565449]/40 bg-[#11120D] px-3 py-2">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-[#565449] mb-1">Root Service</p>
                            <span className="font-mono text-xs text-[#FFFBF4]">{selectedAnalysis.incidentDna.rootCauseService}</span>
                          </div>
                          
                          <div className="rounded border border-[#565449]/40 bg-[#11120D] px-3 py-2">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-[#565449] mb-1">Cascade Depth</p>
                            <div className="flex gap-0.5 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className={`h-3 w-1.5 rounded-sm ${i < (selectedAnalysis?.incidentDna?.cascadeDepth || 0) ? 'bg-[#ef4444]' : 'bg-[#565449]/20'}`} />
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-[#565449] mb-1.5">Key Signals</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedAnalysis.incidentDna.keywords.slice(0, 5).map((kw, i) => (
                                <span key={i} className="rounded-sm bg-[#3b82f6]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#3b82f6]">
                                  {kw}
                                </span>
                              ))}
                              {selectedAnalysis.incidentDna.keywords.length > 5 && (
                                <span className="rounded-sm bg-[#565449]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#565449]">
                                  +{selectedAnalysis.incidentDna.keywords.length - 5}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[#D8CFBC]/60">Generating fingerprint...</p>
                      )}
                    </div>

                    {/* Similar Incidents */}
                    {selectedAnalysis?.similarIncidents && selectedAnalysis.similarIncidents.length > 0 && (
                      <div className="p-5">
                        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[#565449]">
                          Historical Matches ({selectedAnalysis.similarIncidents.length})
                        </p>
                        <div className="flex flex-col gap-4">
                          {selectedAnalysis.similarIncidents.map((inc: any, i: number) => (
                            <div key={i} className="group relative rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-5 transition-all hover:border-[#3b82f6]/50 hover:bg-[#1D1E17]/80 hover:shadow-[0_4px_20px_rgba(59,130,246,0.05)]">
                              
                              <div className="flex items-start gap-5">
                                {/* Score Ring */}
                                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#11120D]">
                                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="#565449" strokeWidth="6" strokeOpacity="0.2" />
                                    <circle cx="50" cy="50" r="46" fill="none" stroke={inc.similarityScore >= 75 ? '#10b981' : inc.similarityScore >= 50 ? '#f59e0b' : '#3b82f6'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${inc.similarityScore * 2.89} 289`} className="transition-all duration-1000 ease-out" />
                                  </svg>
                                  <div className="flex flex-col items-center">
                                    <span className="font-mono text-sm font-bold text-[#FFFBF4]">{inc.similarityScore}</span>
                                    <span className="font-mono text-[8px] text-[#565449]">MATCH</span>
                                  </div>
                                </div>
                                
                                {/* Match Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-semibold text-[#FFFBF4] truncate max-w-[200px]">
                                        {inc.root_cause_service}
                                      </span>
                                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${sevStyles[inc.severity] || sevStyles.P2}`}>
                                        {inc.severity}
                                      </span>
                                      <span className="font-mono text-[10px] text-[#565449]">
                                        {new Date(inc.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <Link 
                                      to="/app" 
                                      search={{ incident: inc.incident_id }}
                                      className="flex items-center gap-1 font-mono text-[10px] text-[#3b82f6] opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      View Report <ArrowRight className="h-3 w-3" />
                                    </Link>
                                  </div>
                                  
                                  <p className="mb-3 text-sm text-[#D8CFBC]/70 line-clamp-2">{inc.root_cause}</p>
                                  
                                  {/* Match Factors */}
                                  {inc.matchDetails && inc.matchDetails.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                      {inc.matchDetails.map((match: string) => (
                                        <span key={match} className="rounded-sm border border-[#565449]/40 bg-[#11120D] px-1.5 py-0.5 font-mono text-[9px] text-[#565449] capitalize">
                                          {match.replace('_', ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Fix */}
                                  {inc.immediate_fix && (
                                    <div className="relative rounded border border-[#10b981]/20 bg-[#10b981]/5 p-3 group/fix">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#10b981] font-bold flex items-center gap-1.5">
                                          <CheckCircle2 className="h-3 w-3" /> What Fixed It
                                        </p>
                                        <button 
                                          onClick={() => navigator.clipboard.writeText(inc.immediate_fix)}
                                          className="flex items-center gap-1 rounded bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#10b981] opacity-0 transition-opacity hover:bg-[#10b981]/20 group-hover/fix:opacity-100"
                                        >
                                          <Copy className="h-2.5 w-2.5" /> Copy Fix
                                        </button>
                                      </div>
                                      <p className="text-xs text-[#D8CFBC]/80 leading-relaxed line-clamp-2">{inc.immediate_fix}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div id="heatmap">
                  <HeatmapWidget data={heatmapData} loading={heatmapLoading} />
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
                        key={String(entry.id)}
                        onClick={() => setTab(entry.id as any)}
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
                <p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>No Active Report</p>
                <p className="mt-3 text-[#D8CFBC]/65">
                  Run a new incident analysis to generate the full root-cause report view.
                </p>
              </div>
            )}

            <div className="h-8" />
          </div>
          </div>
        </main>
      </div>

      {showAgentDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAgentDrawer(false)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#f59e0b]/30 bg-[#11120D] shadow-[0_0_40px_rgba(245,158,11,0.15)]">
            <div className="flex items-center justify-between border-b border-[#f59e0b]/20 px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#f59e0b]" />
                <p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]">Ask Agent</p>
              </div>
              <button onClick={() => setShowAgentDrawer(false)} className="rounded p-1 text-[#D8CFBC]/50 hover:bg-[#1D1E17] hover:text-[#D8CFBC]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="mb-3 rounded-md border border-[#565449]/30 bg-[#1D1E17] px-3 py-2">
                <p className="font-mono text-[11px] text-[#D8CFBC]/50">incident: {selectedAnalysis?.rootCauseService || 'none'}</p>
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto [scrollbar-color:#565449_transparent]">
                {chatMessages.length === 0 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-[#D8CFBC]/40">Ask anything about this incident</p>
                    <div className="mt-3 space-y-2">
                      {['What caused this?', 'How long did it last?', 'How do I prevent this?'].map((q) => (
                        <button key={q} onClick={() => setChatInput(q)} className="block w-full rounded-md border border-[#565449]/40 bg-[#1D1E17] px-3 py-2 text-left text-xs text-[#D8CFBC]/60 hover:border-[#565449] hover:text-[#D8CFBC] transition-colors">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((message, index) => (
                  <div key={index} className={`rounded-md border p-3 text-sm ${message.role === 'assistant' ? 'border-[#565449]/50 bg-[#1D1E17] text-[#D8CFBC]' : 'border-[#565449] bg-[#565449]/20 text-[#FFFBF4]'}`}>
                    {message.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="inline-flex items-center gap-2 rounded-md border border-[#565449]/50 bg-[#1D1E17] p-3 text-xs text-[#D8CFBC]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                  </div>
                )}
              </div>
              <div className="relative mt-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendChat(); } }}
                  disabled={!selectedAnalysis}
                  placeholder="Ask the agent..."
                  className="w-full rounded-md border border-[#565449]/60 bg-[#1D1E17] py-3 pl-4 pr-16 font-mono text-sm text-[#FFFBF4] placeholder:text-[#D8CFBC]/30 focus:outline-none focus:border-[#565449] disabled:opacity-50"
                />
                <button
                  onClick={() => void handleSendChat()}
                  disabled={!selectedAnalysis || chatLoading || !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[#565449] px-3 py-1.5 text-xs text-[#D8CFBC] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRemediate && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowRemediate(false)}>
          <div className="relative w-full max-w-2xl mx-4 rounded-xl border border-[#a855f7]/30 bg-[#11120D] shadow-[0_0_40px_rgba(168,85,247,0.15)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#a855f7]/20">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#c084fc" }}>Remediation Agent</span>
                <span className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc" }}>beta</span>
              </div>
              <button onClick={() => setShowRemediate(false)} style={{ color: "#565449" }} className="hover:text-[#D8CFBC] transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <RemediatePanel incidentId={String(selectedIncident.id)} />
            </div>
          </div>
        </div>
      )}

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#565449]/60 bg-[#1D1E17]">
            <div className="flex items-center justify-between border-b border-[#565449]/40 px-5 py-3">
              <p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]">Analyze New Incident</p>
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
                  <p className="font-mono text-[11px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Demo Scenarios</p>
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

      {showPredictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[#10b981]/40 bg-[#1D1E17]">
            <div className="flex items-center justify-between border-b border-[#565449]/40 px-5 py-3">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-[#10b981]" /><p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]">Predict Blast Radius</p></div>
              <button onClick={() => setShowPredictModal(false)} className="rounded p-1 text-[#D8CFBC]/50 hover:bg-[#11120D] hover:text-[#D8CFBC]"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-sm text-[#D8CFBC]/60">Describe your planned deploy or config change. The agent will predict which services could break before anything goes wrong.</p>
              <textarea value={predictInput} onChange={e => setPredictInput(e.target.value)} placeholder="e.g. Deploying payment-service v2.4.0 which migrates the orders table schema and changes the Stripe webhook endpoint..." className="h-32 w-full rounded-md border border-[#565449]/60 bg-[#11120D] p-3 font-mono text-xs text-[#FFFBF4] outline-none focus:border-[#565449] placeholder:text-[#D8CFBC]/30" />
              {predictError && <p className="text-sm text-[#ef4444]">{predictError}</p>}
              {predictResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`rounded border px-2 py-0.5 font-mono text-xs ${predictResult.riskLevel === 'critical' || predictResult.riskLevel === 'high' ? 'border-[#ef4444]/60 bg-[#ef4444]/20 text-[#ef4444]' : predictResult.riskLevel === 'medium' ? 'border-[#f59e0b]/60 bg-[#f59e0b]/20 text-[#f59e0b]' : 'border-[#10b981]/60 bg-[#10b981]/20 text-[#10b981]'}`}>{predictResult.riskLevel.toUpperCase()}</span>
                    <p className="text-sm text-[#D8CFBC]">{predictResult.summary}</p>
                  </div>
                  <div><p className="mb-2 font-mono text-[10px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Predicted Affected Services</p><div className="space-y-2">{predictResult.predictedAffectedServices.map(s => (<div key={s.service} className="rounded-md border border-[#565449]/40 bg-[#11120D] p-3"><div className="flex items-center justify-between mb-1"><span className="font-mono text-sm text-[#FFFBF4]">{s.service}</span><span className={`font-mono text-[10px] ${s.likelihood === 'high' ? 'text-[#ef4444]' : s.likelihood === 'medium' ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>{s.likelihood} likelihood</span></div><p className="text-xs text-[#D8CFBC]/60">{s.reason}</p></div>))}</div></div>
                  <div><p className="mb-2 font-mono text-[10px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Recommendations</p><ol className="space-y-1">{predictResult.recommendations.map((r, i) => (<li key={i} className="flex gap-2 text-sm text-[#D8CFBC]/80"><span className="text-[#10b981] font-mono shrink-0">{i + 1}.</span>{r}</li>))}</ol></div>
                  <div className="rounded-md border border-[#565449]/40 bg-[#11120D] p-3"><p className="font-mono text-[10px] uppercase tracking-widest mb-1 font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Rollback Plan</p><p className="text-sm text-[#D8CFBC]/80">{predictResult.rollbackPlan}</p></div>
                  <div className="rounded-md border border-[#565449]/40 bg-[#11120D] p-3"><p className="font-mono text-[10px] uppercase tracking-widest mb-1 font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Suggested Deploy Window</p><p className="text-sm text-[#D8CFBC]/80">{predictResult.suggestedDeployWindow}</p></div>
                </div>
              )}
            </div>
            <div className="border-t border-[#565449]/40 px-5 py-3 flex justify-end gap-3">
              <button onClick={() => setShowPredictModal(false)} className="px-3 py-1.5 text-sm text-[#D8CFBC]/60 hover:text-[#D8CFBC]">Close</button>
              <button onClick={async () => { if (!predictInput.trim()) return; setPredictLoading(true); setPredictError(''); setPredictResult(null); try { const r = await predictBlastRadius(predictInput); setPredictResult(r); } catch(e) { setPredictError(e instanceof Error ? e.message : 'Failed'); } finally { setPredictLoading(false); } }} disabled={predictLoading || !predictInput.trim()} className="inline-flex items-center gap-2 rounded-md border border-[#10b981]/60 bg-[#10b981]/10 px-3 py-1.5 text-sm text-[#10b981] disabled:opacity-40">
                {predictLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{predictLoading ? 'Predicting...' : 'Predict'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBriefingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[#D8CFBC]/20 bg-[#1D1E17]">
            <div className="flex items-center justify-between border-b border-[#565449]/40 px-5 py-3">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#D8CFBC]" /><p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]">On-Call Briefing</p></div>
              <button onClick={() => setShowBriefingModal(false)} className="rounded p-1 text-[#D8CFBC]/50 hover:bg-[#11120D] hover:text-[#D8CFBC]"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!briefingResult && !briefingLoading && !briefingError && (<div className="text-center py-8"><p className="text-[#D8CFBC]/60 text-sm mb-4">Pulls all recent incidents, finds patterns, and writes your shift handoff. No input needed.</p><button onClick={async () => { setBriefingLoading(true); setBriefingError(''); try { const r = await generateOnCallBriefing(); setBriefingResult(r); } catch(e) { setBriefingError(e instanceof Error ? e.message : 'Failed'); } finally { setBriefingLoading(false); } }} className="inline-flex items-center gap-2 rounded-md border border-[#D8CFBC]/40 bg-[#D8CFBC]/10 px-4 py-2 text-sm text-[#D8CFBC]"><FileText className="h-4 w-4" />Generate Briefing</button></div>)}
              {briefingLoading && (<div className="flex items-center gap-3 py-8 justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#D8CFBC]" /><p className="text-sm text-[#D8CFBC]/60">Analyzing recent incidents...</p></div>)}
              {briefingError && <p className="text-sm text-[#ef4444]">{briefingError}</p>}
              {briefingResult && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`rounded border px-2 py-0.5 font-mono text-xs ${briefingResult.healthSignal === 'red' ? 'border-[#ef4444]/60 bg-[#ef4444]/20 text-[#ef4444]' : briefingResult.healthSignal === 'amber' ? 'border-[#f59e0b]/60 bg-[#f59e0b]/20 text-[#f59e0b]' : 'border-[#10b981]/60 bg-[#10b981]/20 text-[#10b981]'}`}>{briefingResult.healthSignal.toUpperCase()}</span>
                    <span className="font-mono text-[10px] text-[#565449]">{briefingResult.incidentCount} incidents analyzed · {new Date(briefingResult.generatedAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="rounded-md border border-[#565449]/40 bg-[#11120D] p-4"><p className="font-mono text-[10px] uppercase tracking-widest mb-2 font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Summary</p><p className="text-sm text-[#D8CFBC]/80 leading-relaxed">{briefingResult.summary}</p></div>
                  {briefingResult.activeP0s.length > 0 && (<div><p className="mb-2 font-mono text-[10px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Active P0s</p><div className="space-y-2">{briefingResult.activeP0s.map((p, i) => (<div key={i} className="rounded-md border border-[#ef4444]/30 bg-[#ef4444]/10 p-3"><div className="flex justify-between"><span className="font-mono text-sm text-[#FFFBF4]">{p.title}</span><span className="font-mono text-[10px] text-[#ef4444]">{p.hoursAgo}h ago</span></div><p className="text-xs text-[#D8CFBC]/60 mt-1">svc:{p.service} · {p.status}</p></div>))}</div></div>)}
                  {briefingResult.recurringIssues.length > 0 && (<div><p className="mb-2 font-mono text-[10px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Recurring Issues</p><div className="space-y-2">{briefingResult.recurringIssues.map((r, i) => (<div key={i} className="rounded-md border border-[#565449]/40 bg-[#11120D] p-3"><div className="flex justify-between mb-1"><span className="font-mono text-sm text-[#FFFBF4]">{r.service}</span><span className="font-mono text-[10px] text-[#f59e0b]">{r.occurrences}x</span></div><p className="text-xs text-[#D8CFBC]/60">{r.pattern}</p></div>))}</div></div>)}
                  <div><p className="mb-2 font-mono text-[10px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Recommended Actions</p><ol className="space-y-1">{briefingResult.recommendedActions.map((a, i) => (<li key={i} className="flex gap-2 text-sm text-[#D8CFBC]/80"><span className="text-[#D8CFBC] font-mono shrink-0">{i + 1}.</span>{a}</li>))}</ol></div>
                  <div className="flex justify-end"><button onClick={() => navigator.clipboard.writeText(JSON.stringify(briefingResult, null, 2))} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-[#D8CFBC]/70 hover:bg-[#1D1E17] hover:text-[#FFFBF4]"><Copy className="h-3.5 w-3.5" />Copy</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showHistoryPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#565449]/60 bg-[#1D1E17]">
            <div className="flex items-center justify-between border-b border-[#565449]/40 px-5 py-3">
              <p className="font-mono text-xs uppercase tracking-widest font-bold text-[#FFFBF4]">All Incident History</p>
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


function HeatmapWidget({ data, loading }: { data: HeatmapDay[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<90 | 180 | 365>(90);

  const today = new Date();
  const dataMap: Record<string, { count: number; worstSeverity: string }> = {};
  for (const d of data) dataMap[d.date] = { count: d.count, worstSeverity: d.worstSeverity };

  const start = new Date(today);
  start.setDate(start.getDate() - (range - 1));
  start.setDate(start.getDate() - start.getDay()); // rewind to Sunday

  const weeks: Array<Array<{ date: string; count: number; worstSeverity: string; inRange: boolean }>> = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const week: { date: string; count: number; worstSeverity: string; inRange: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const daysAgo = Math.floor((today.getTime() - cursor.getTime()) / 86400000);
      const inRange = daysAgo <= range - 1;
      const found = dataMap[dateStr];
      week.push({ date: dateStr, count: found?.count ?? 0, worstSeverity: found?.worstSeverity ?? 'none', inRange });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels: Array<{ label: string; weekIndex: number }> = [];
  weeks.forEach((week, wi) => {
    const firstInRange = week.find(c => c.inRange);
    if (!firstInRange) return;
    const d = new Date(firstInRange.date);
    if (d.getDate() <= 7) {
      const label = d.toLocaleString('default', { month: 'short' });
      if (!monthLabels.length || monthLabels[monthLabels.length - 1].label !== label)
        monthLabels.push({ label, weekIndex: wi });
    }
  });

  const getColor = (cell: { count: number; worstSeverity: string; inRange: boolean }) => {
    if (!cell.inRange) return 'transparent';
    if (cell.count === 0) return '#2a2b22';
    if (cell.worstSeverity === 'P0') return cell.count >= 2 ? '#ef4444' : '#f87171';
    if (cell.worstSeverity === 'P1') return cell.count >= 2 ? '#f59e0b' : '#fbbf24';
    return '#4ade80';
  };

  const totalIncidents = data.filter(d => {
    const daysAgo = Math.floor((today.getTime() - new Date(d.date).getTime()) / 86400000);
    return daysAgo <= range - 1;
  }).reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17]">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-[#11120D] transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Incident Heatmap</p>
          {!open && totalIncidents > 0 && (
            <span className="font-mono text-[10px] text-[#D8CFBC]/40">{totalIncidents} incidents · last {range === 365 ? '12 months' : range === 180 ? '6 months' : '3 months'}</span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-[#565449] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* Range selector */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {([90, 180, 365] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 font-mono text-[10px] rounded-md border transition-colors ${range === r ? 'border-[#D8CFBC]/40 bg-[#D8CFBC]/10 text-[#D8CFBC]' : 'border-[#565449]/40 text-[#565449] hover:text-[#D8CFBC]/60'}`}
                >
                  {r === 90 ? '3 months' : r === 180 ? '6 months' : '1 year'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-[#565449]">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4ade80]" />P2</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />P1</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#ef4444]" />P0</span>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-1">{Array.from({ length: 20 }).map((_, i) => (<div key={i} className="flex flex-col gap-1">{Array.from({ length: 7 }).map((_, j) => (<div key={j} className="h-3 w-3 rounded-sm bg-[#565449]/20" />))}</div>))}</div>
          ) : (
            <div className="overflow-x-auto">
              {/* Month labels */}
              <div className="flex mb-1" style={{ paddingLeft: '28px' }}>
                {weeks.map((_, wi) => {
                  const ml = monthLabels.find(m => m.weekIndex === wi);
                  return <div key={wi} className="font-mono text-[9px] text-[#565449]" style={{ width: '16px', marginRight: '2px', flexShrink: 0 }}>{ml ? ml.label : ''}</div>;
                })}
              </div>
              <div className="flex gap-0.5">
                {/* Day labels */}
                <div className="flex flex-col gap-0.5 mr-1" style={{ paddingTop: '1px' }}>
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="font-mono text-[9px] text-[#565449] flex items-center justify-end pr-1" style={{ height: '14px' }}>{i % 2 === 1 ? d : ''}</div>
                  ))}
                </div>
                {/* Grid */}
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-0.5">
                    {week.map((cell, di) => (
                      <div
                        key={di}
                        title={cell.inRange && cell.count > 0 ? `${cell.date}: ${cell.count} incident${cell.count !== 1 ? 's' : ''} · ${cell.worstSeverity}` : cell.inRange ? cell.date : ''}
                        className="rounded-sm border border-[#565449]/10 transition-transform hover:scale-125 cursor-pointer"
                        style={{ width: '14px', height: '14px', backgroundColor: getColor(cell), flexShrink: 0 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="font-mono text-[10px] text-[#565449]">{totalIncidents} total incidents in the last {range === 365 ? '12 months' : range === 180 ? '6 months' : '3 months'}</p>
        </div>
      )}
    </div>
  );
}


function RemediatePanel({ incidentId }: { incidentId: string }) {
  const [status, setStatus] = useState<string>('idle')
  const [plan, setPlan] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const startAgent = async () => {
    setLoading(true)
    setEvents([])
    setPlan(null)
    setStatus('running')
    const res = await fetch(`${API_BASE}/remediate/${incidentId}/start`, { method: 'POST' })
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((l: string) => l.startsWith('data: '))
      for (const line of lines) {
        try {
          const event = JSON.parse(line.replace('data: ', ''))
          setEvents((prev: any[]) => [...prev, event])
          if (event.type === 'PLAN_READY') setPlan(event.plan)
          if (event.type === 'COMPLETE') setStatus('complete')
          if (event.type === 'REJECTED') setStatus('rejected')
        } catch {}
      }
    }
    setLoading(false)
  }

  const approve = async () => {
    await fetch(`${API_BASE}/remediate/${incidentId}/approve`, { method: 'POST' })
  }

  const reject = async () => {
    await fetch(`${API_BASE}/remediate/${incidentId}/reject`, { method: 'POST' })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Remediation Agent</p>
        {status === 'idle' && (
          <button onClick={startAgent} disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-red-500/20 border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40">
            <Zap className="h-3.5 w-3.5" /> Start Agent
          </button>
        )}
        {status === 'complete' && <span className="text-xs text-green-400 font-mono">All actions complete</span>}
      </div>

      {plan && status === 'running' && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
          <p className="text-xs font-mono text-yellow-400 uppercase tracking-widest font-bold text-[#FFFBF4]">Plan Ready — Awaiting Approval</p>
          <p className="text-sm text-[#D8CFBC]/70">{plan.overall_strategy}</p>
          <div className="space-y-2">
            {plan.actions.map((action: any, i: number) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-[#565449]/30 bg-[#11120D] px-3 py-2">
                <span className="text-xs font-mono text-[#565449] mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#FFFBF4] font-mono">{action.type} on {action.target_service}</p>
                  <p className="text-xs text-[#D8CFBC]/50 mt-0.5">{action.reason}</p>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-yellow-500/20 text-yellow-400">{action.risk_level}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={approve} className="flex-1 rounded-md bg-green-500/20 border border-green-500/40 py-2 text-sm text-green-400 hover:bg-green-500/30 transition-colors">Approve and Execute</button>
            <button onClick={reject} className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors">Reject</button>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono">
          {events.map((event: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-[#565449] shrink-0">&gt;</span>
              <span className={event.type === 'COMPLETE' ? 'text-green-400' : event.type === 'EXECUTING' ? 'text-blue-400' : event.type === 'VERIFIED' ? 'text-emerald-400' : event.type === 'AWAITING_APPROVAL' ? 'text-yellow-400' : 'text-[#D8CFBC]/70'}>{event.message}</span>
            </div>
          ))}
        </div>
      )}

      {status === 'idle' && events.length === 0 && (
        <p className="text-sm text-[#D8CFBC]/40 text-center py-8">Start the agent to generate and execute a remediation plan.</p>
      )}
    </div>
  )
}


function CascadeGraph({ nodes }: { nodes: { name?: string; status?: string; errorCount?: number }[] }) {
  if (!nodes.length) return null

  // Layout: stagger nodes in a zigzag across full width
  const positions = nodes.map((_, i) => {
    const cols = Math.min(nodes.length, 4)
    const col = i % cols
    const row = Math.floor(i / cols)
    const xBase = (col / (cols - 1 || 1)) * 80 + 10
    const xJitter = (i % 2 === 0 ? 0 : 8) + (i % 3 === 0 ? -5 : 0)
    const x = Math.max(8, Math.min(88, xBase + xJitter))
    const y = row * 140 + 40
    return { x, y }
  })

  const totalHeight = (Math.ceil(nodes.length / 4)) * 140 + 60

  return (
    <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
      <p className="mb-4 text-[11px] font-mono uppercase tracking-widest font-bold text-[#FFFBF4]" style={{ color: "#9a9080" }}>Cascade Chain — {nodes.length} services affected</p>
      <div className="relative w-full overflow-x-auto" style={{ height: totalHeight }}>
        <svg className="absolute inset-0 pointer-events-none" width="100%" height={totalHeight} viewBox={`0 0 1000 ${totalHeight}`} preserveAspectRatio="none">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="rgba(255,251,244,0.7)" />
            </marker>
          </defs>
          {nodes.map((_, i) => {
            if (i === nodes.length - 1) return null
            const from = positions[i]
            const to = positions[i + 1]
            // Convert % to viewBox units (use 1000 wide viewBox)
            const W = 1000
            const fromX = (from.x / 100) * W
            const fromY = from.y + 38
            const toX = (to.x / 100) * W
            const toY = to.y + 2
            // from bottom-center of source node, to top-center of target node
            const nodeH = 52
            const fx = fromX
            const fy = from.y + nodeH
            const tx = toX
            const ty = to.y
            const midy = (fy + ty) / 2
            return (
              <path
                key={i}
                d={`M ${fx} ${fy} C ${fx} ${midy}, ${tx} ${midy}, ${tx} ${ty}`}
                stroke="rgba(255,251,244,0.55)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                fill="none"
                markerEnd="url(#arrow)"
              />
            )
          })}
        </svg>
        {nodes.map((service, i) => {
          const tone = (() => {
            const s = (service.status || '').toLowerCase()
            if (s.includes('fail') || s.includes('crash') || s.includes('down') || s.includes('critical')) return { color: '#ef4444', label: 'Failed' }
            if (s.includes('degrad') || s.includes('warn') || s.includes('slow')) return { color: '#f59e0b', label: 'Degraded' }
            if (s.includes('healthy') || s.includes('ok') || s.includes('up')) return { color: '#10b981', label: 'Healthy' }
            return { color: '#565449', label: service.status || 'Affected' }
          })()
          const pos = positions[i]
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `calc(${pos.x}% - 72px)`,
                top: pos.y,
                width: 144,
              }}
            >
              <div
                className="rounded-lg border bg-[#11120D] px-3 py-2.5 shadow-lg transition-transform hover:scale-105 cursor-default"
                style={{ borderColor: `${tone.color}55`, borderLeftColor: tone.color, borderLeftWidth: 3 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tone.color }} />
                  <p className="font-mono text-xs text-[#FFFBF4] font-medium truncate">{service.name || 'unknown'}</p>
                </div>
                <p className="font-mono text-[10px] pl-3.5" style={{ color: tone.color }}>
                  {tone.label}{service.errorCount ? ` · ${service.errorCount} err` : ''}
                </p>
              </div>
              <div className="mt-1 text-center font-mono text-[9px] text-[#565449]">#{i + 1}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
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
        <span className="font-mono text-2xl font-bold text-[#FFFBF4]">{safeValue}%</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#D8CFBC]/50">confidence</span>
        
      </div>
    </div>
  );
}

function FixPanel({ accent, title, steps }: { accent: string; title: string; steps: string[] }) {
  return (
    <div className="rounded-lg border border-[#565449]/40 border-l-4 bg-[#1D1E17] p-6" style={{ borderLeftColor: accent }}>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-widest font-bold text-[#FFFBF4]">{title}</p>
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

  const allSameDay = trendData.length > 1 && trendData.every(
    (r) => new Date(r.created_at).toDateString() === new Date(trendData[0].created_at).toDateString()
  );
  const sevToNum: Record<string, number> = { P0: 3, P1: 2, P2: 1 };
  const chartData = trendData.map((row) => ({
    ...row,
    date: allSameDay
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(row.created_at).toLocaleDateString(),
    sevValue: sevToNum[row.severity] ?? 1,
  }));

  return (
    <div className="rounded-lg border border-[#565449]/40 bg-[#1D1E17] p-6">
      <p className="font-mono text-xs text-[#D8CFBC]/50 mb-4">
        Saved postmortems: <span className="text-[#D8CFBC]">{postmortemCount ?? "n/a"}</span>
      </p>
      <div className="rounded-md border border-[#565449]/40 bg-[#11120D] p-4">
        <p className="mb-3 font-mono text-xs text-[#D8CFBC]/60">
          Severity timeline: {serviceName || "n/a"}
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
                <YAxis
                  domain={[0.5, 3.5]}
                  ticks={[1, 2, 3]}
                  tickFormatter={(v) => v === 3 ? "P0" : v === 2 ? "P1" : "P2"}
                  stroke="#7f7c6f"
                  tick={{ fill: "#9f9a89", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: "#11120D", border: "1px solid #565449", borderRadius: 8 }}
                  labelStyle={{ color: "#D8CFBC" }}
                  formatter={((_value: number, _name: any, context: any) => [
                    context?.payload?.severity || "unknown",
                    "severity",
                  ]) as any}
                />
                <Line
                  type="stepAfter"
                  dataKey="sevValue"
                  stroke="#565449"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={(props: any) => {
                    const sev = props.payload?.severity;
                    const color = sev === "P0" ? "#ef4444" : sev === "P1" ? "#f59e0b" : "#D8CFBC";
                    return <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill={color} stroke={color} strokeWidth={1} />;
                  }}
                />
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
