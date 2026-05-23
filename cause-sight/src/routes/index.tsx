import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap, Link2, FileText, ArrowRight, Sparkles, Code2, Layers,
  Search, Fingerprint, Palette, Check, Activity, Database, Server,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CauseAI — AI-Powered Incident Analysis" },
      { name: "description", content: "Every outage has a cause. Diagnose incidents in 10 seconds with AI-driven cascade tracing and post-mortems." },
      { property: "og:title", content: "CauseAI — AI-Powered Incident Analysis" },
      { property: "og:description", content: "Diagnose incidents in 10 seconds." },
    ],
  }),
  component: Landing,
});

const scenarios = [
  { name: "Redis OOM Cascade", desc: "Memory pressure cascading across cache tier" },
  { name: "Bad Deployment", desc: "Regression introduced in latest rollout" },
  { name: "Traffic Spike", desc: "Unexpected load saturating frontend pool" },
  { name: "DB Connection Exhaustion", desc: "Pool starvation under peak concurrency" },
  { name: "Memory Leak", desc: "Slow heap growth in long-running services" },
  { name: "Stripe Outage", desc: "Upstream payment provider degradation" },
  { name: "K8s CrashLoopBackOff", desc: "Pods failing readiness in tight loop" },
  { name: "Disk Exhaustion", desc: "Log volume filling primary node disk" },
];

function Landing() {
  return (
    <div className="relative min-h-screen bg-[#11120D] text-[#FFFBF4] overflow-hidden">
      {/* GLOBAL BG TEXTURES */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* warm vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(86,84,73,0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(216,207,188,0.06),transparent_60%)]" />
        {/* structural lines */}
        <div className="absolute inset-0 grid-lines opacity-50" />
        <div className="absolute inset-0 dot-grid opacity-80" />
        {/* film grain layers */}
        <div className="absolute inset-0 grain mix-blend-soft-light opacity-90" />
        <div className="absolute inset-0 noise mix-blend-overlay opacity-60" />
        <div className="absolute inset-0 scanlines opacity-40" />
        {/* warm orbs */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-225 h-225 teal-orb opacity-70" />
        <div className="absolute top-[80vh] -left-40 w-150 h-150 teal-orb opacity-40" />
        <div className="absolute top-[140vh] -right-40 w-175 h-175 teal-orb opacity-35" />
        {/* edge vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.5))]" />
      </div>

      <div className="relative z-10">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#11120D]/70 border-b border-[#565449]/30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#D8CFBC]" fill="currentColor" />
            <span className="font-bold text-[#FFFBF4] tracking-tight">CauseAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#D8CFBC]/70">
            <a href="#features" className="hover:text-[#FFFBF4]">Features</a>
            <a href="#how" className="hover:text-[#FFFBF4]">How it works</a>
            <a href="#scenarios" className="hover:text-[#FFFBF4]">Scenarios</a>
          </div>
          <Link
            to="/app"
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#565449] bg-[#1D1E17] text-[#FFFBF4] text-sm hover-lift hover:shadow-[0_0_24px_rgba(86,84,73,0.5)]"
          >
            Open App <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        {/* Concentric glow rings behind hero */}
        <div className="pointer-events-none absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-350 h-350 rounded-full ring-glow opacity-40" />
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-250 h-250 rounded-full ring-glow opacity-50" />
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-175 h-175 rounded-full ring-glow opacity-60" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-12 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#565449] bg-[#1D1E17] text-[#D8CFBC] text-xs mb-8">
            <Sparkles className="w-3.5 h-3.5" /> AI-Powered Incident Analysis
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            <span className="block text-[#FFFBF4]">Every outage has a</span>
            <span className="block text-gradient-jade">cause.</span>
          </h1>
          <p className="mt-6 max-w-md text-[#D8CFBC]/60 text-base md:text-lg">
            An AI agent that traces incidents from symptom to root cause in seconds — across your services, deployments and dependencies.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#565449] text-[#FFFBF4] font-medium hover:bg-[#3f6f78] transition-colors shadow-[0_0_32px_rgba(86,84,73,0.4)]"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-[#565449] bg-transparent text-[#D8CFBC] font-medium hover:bg-[#1D1E17] transition-colors">
              Book a Demo
            </button>
          </div>
          <p className="mt-8 text-xs font-mono text-[#D8CFBC]/40">
            Redis · Kubernetes · Bad Deployments · DB Failures · Memory Leaks
          </p>
        </div>

        {/* APP PREVIEW MOCKUP */}
        <div className="relative max-w-6xl mx-auto px-6 pb-24">
          <AppPreview />
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-6 py-28">
        <div className="text-center mb-14">
          <p className="font-mono text-xs uppercase tracking-widest text-[#565449] mb-3">Capabilities</p>
          <h2 className="text-3xl md:text-5xl font-bold text-gradient-jade">Engineered for incident response</h2>
        </div>
        <FeatureGrid />
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="font-mono text-xs uppercase tracking-widest text-[#565449] mb-3">Workflow</p>
          <h2 className="text-3xl md:text-5xl font-bold text-gradient-jade">How it works</h2>
        </div>
        <div className="relative grid md:grid-cols-3 gap-8">
          <div className="hidden md:block absolute top-6 left-[16%] right-[16%] border-t border-dashed border-[#565449]" aria-hidden />
          {[
            { n: 1, title: "Paste Your Logs", desc: "Drop raw stack traces, metrics, or alert payloads into the agent." },
            { n: 2, title: "AI Agent Investigates", desc: "Multi-step reasoning correlates services, deployments and infra signals." },
            { n: 3, title: "Get Full Incident Report", desc: "Root cause, blast radius, fix steps, post-mortem — fully written." },
          ].map((s) => (
            <div key={s.n} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 w-12 h-12 rounded-full bg-[#565449] border-4 border-[#11120D] flex items-center justify-center font-mono font-semibold text-[#FFFBF4]">
                {s.n}
              </div>
              <h3 className="mt-5 font-semibold text-[#FFFBF4]">{s.title}</h3>
              <p className="mt-2 text-sm text-[#D8CFBC]/60 max-w-xs">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="scenarios" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-[#565449] mb-3">Coverage</p>
          <h2 className="text-3xl md:text-5xl font-bold text-[#FFFBF4]">Built for the incidents you actually see</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenarios.map((s) => (
            <div key={s.name} className="group p-5 rounded-lg bg-[#1D1E17] border border-[#565449]/40 border-l-[3px] border-l-[#565449] hover-lift cursor-pointer">
              <h4 className="font-semibold text-[#FFFBF4] mb-2">{s.name}</h4>
              <p className="text-xs text-[#D8CFBC]/55 leading-relaxed mb-4">{s.desc}</p>
              <span className="text-xs text-[#D8CFBC] font-medium inline-flex items-center gap-1">
                Analyze <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="relative overflow-hidden p-12 md:p-16 rounded-lg bg-[#1D1E17] border border-[#565449] text-center shadow-[0_0_60px_rgba(86,84,73,0.3)]">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-150 h-150 teal-orb" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold text-gradient-jade mb-4">Stop guessing. Start knowing.</h2>
            <p className="text-[#D8CFBC]/60 max-w-md mx-auto mb-8">Try CauseAI on your next incident. Ten seconds to root cause.</p>
            <Link to="/app" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#565449] text-[#FFFBF4] font-medium hover:bg-[#3f6f78] transition-colors">
              Open the App <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#565449]/30 py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-[#D8CFBC]/40">
          <span className="font-mono">© 2026 CauseAI</span>
          <span className="font-mono">v0.1.0</span>
        </div>
      </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, desc, children, className = "", iconWrapClass = "", iconClass = "",
}: {
  icon: React.ElementType; title: string; desc: string;
  children?: React.ReactNode; className?: string; iconWrapClass?: string; iconClass?: string;
}) {
  return (
    <div className={`card-top-line relative p-7 rounded-lg bg-[#1D1E17]/80 backdrop-blur-sm border border-[#565449]/40 hover-lift flex flex-col items-center text-center ${className}`}>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-5 ${iconWrapClass || "bg-[#565449]/40 border border-[#565449] glow-teal"}`}>
        <Icon className={`w-5 h-5 ${iconClass || "text-[#D8CFBC]"}`} />
      </div>
      <h3 className="font-semibold text-[#FFFBF4] mb-2 text-lg">{title}</h3>
      <p className="text-sm text-[#D8CFBC]/55 leading-relaxed max-w-xs">{desc}</p>
      {children && <div className="mt-6 w-full">{children}</div>}
    </div>
  );
}

function FeatureGrid() {
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-5">
        <FeatureCard
          icon={Code2}
          title="Expert Diagnosis"
          desc="Pinpoints root cause across logs, traces, and metrics in a single pass — with cited evidence for every claim."
          iconWrapClass="bg-[#ef4444]/20 border border-[#ef4444]/50 shadow-[0_0_28px_rgba(239,68,68,0.35)]"
          iconClass="text-[#fca5a5]"
        />
        <FeatureCard
          icon={Layers}
          title="Fast & Easy Setup"
          desc="Drop in your log stream. No agents to deploy, no schema to design. The first analysis runs in minutes."
          iconWrapClass="bg-[#f59e0b]/20 border border-[#f59e0b]/50 shadow-[0_0_28px_rgba(245,158,11,0.35)]"
          iconClass="text-[#fcd34d]"
        />
        <FeatureCard
          icon={Search}
          title="Advanced Analytics"
          desc="Spot recurring failure modes across weeks of incidents. Trends, blast radius, and SLO impact in one view."
          iconWrapClass="bg-[#10b981]/20 border border-[#10b981]/50 shadow-[0_0_28px_rgba(16,185,129,0.35)]"
          iconClass="text-[#6ee7b7]"
        />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <FeatureCard
          icon={Fingerprint}
          title="Seamless Integration"
          desc="Connects to your existing observability stack — no rip-and-replace, no new dashboards to babysit."
          iconWrapClass="bg-[#ef4444]/20 border border-[#ef4444]/50 shadow-[0_0_28px_rgba(239,68,68,0.35)]"
          iconClass="text-[#fca5a5]"
        >
          <IntegrationDiagram />
        </FeatureCard>
        <FeatureCard
          icon={Palette}
          title="Customizable Reports"
          desc="Post-mortems that match your team's voice and template, generated and ready to paste."
          iconWrapClass="bg-[#10b981]/20 border border-[#10b981]/50 shadow-[0_0_28px_rgba(16,185,129,0.35)]"
          iconClass="text-[#6ee7b7]"
        >
          <div className="flex flex-wrap gap-2 justify-center">
            {["#root-cause", "#blast", "#fix", "#timeline", "#impact"].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-md bg-[#11120D] border border-[#565449]/60 font-mono text-xs text-[#D8CFBC]">
                {t}
              </span>
            ))}
          </div>
        </FeatureCard>
      </div>
    </div>
  );
}

function IntegrationDiagram() {
  return (
    <div className="relative h-32 flex items-center justify-between px-2">
      <div className="flex flex-col gap-2 z-10">
        {["logs", "traces", "metrics"].map((t) => (
          <span key={t} className="px-3 py-1.5 rounded-md bg-[#11120D] border border-[#565449] font-mono text-xs text-[#D8CFBC]">
            {t}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 200 120" className="absolute left-[28%] right-[28%] top-0 bottom-0 w-[44%] h-full" preserveAspectRatio="none">
        {[20, 60, 100].map((y, i) => (
          <path
            key={i}
            d={`M0 ${y} Q100 ${60} 200 60`}
            stroke="#565449"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="3 4"
            opacity={0.8 - i * 0.15}
          />
        ))}
      </svg>
      <div className="relative z-10 w-12 h-12 rounded-full bg-[#565449] border border-[#D8CFBC]/40 flex items-center justify-center glow-jade">
        <Check className="w-5 h-5 text-[#FFFBF4]" />
      </div>
    </div>
  );
}

function AppPreview() {
  return (
    <div className="relative rounded-xl bg-[#1D1E17]/90 backdrop-blur-md border border-[#565449]/60 overflow-hidden shadow-[0_30px_120px_-20px_rgba(86,84,73,0.6)]">
      {/* glow behind */}
      <div className="pointer-events-none absolute -inset-20 teal-orb opacity-50" />
      {/* window chrome */}
      <div className="relative flex items-center gap-2 px-4 py-3 border-b border-[#565449]/40 bg-[#11120D]/60">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]/70" />
        <span className="ml-4 text-[11px] font-mono text-[#D8CFBC]/40">causeai · incidents / redis-oom-cascade</span>
      </div>
      <div className="relative grid grid-cols-[180px_1fr] min-h-90">
        {/* sidebar */}
        <div className="border-r border-[#565449]/40 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-[#D8CFBC]" fill="currentColor" />
            <span className="text-xs font-bold">CauseAI</span>
          </div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-[#565449]">Incidents</p>
          {[
            { n: "Redis OOM", sev: "P0", active: true },
            { n: "Kafka lag", sev: "P1", active: false },
            { n: "Auth drift", sev: "P2", active: false },
          ].map((i) => (
            <div
              key={i.n}
              className={`relative px-2 py-2 rounded-md text-xs ${i.active ? "bg-[#11120D]" : ""}`}
            >
              {i.active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#565449] rounded-r" />}
              <p className="text-[#FFFBF4] font-medium">{i.n}</p>
              <p className="text-[9px] font-mono text-[#D8CFBC]/40 mt-0.5">{i.sev} · 2m</p>
            </div>
          ))}
        </div>
        {/* main */}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#565449]">Root Cause</p>
              <p className="text-lg font-bold text-[#FFFBF4] mt-1">Checkout API 5xx</p>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded border bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/60">P0</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { v: "14.2k", l: "Affected" },
              { v: "18.2%", l: "Error" },
              { v: "6", l: "Services" },
              { v: "94%", l: "Conf." },
            ].map((s) => (
              <div key={s.l} className="p-3 rounded-md bg-[#11120D] border border-[#565449]/50">
                <p className="text-sm font-bold font-mono text-[#FFFBF4]">{s.v}</p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-[#D8CFBC]/40 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {/* mini chart */}
          <div className="relative h-24 p-3 rounded-md bg-[#11120D] border border-[#565449]/50 overflow-hidden">
            <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D8CFBC" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#565449" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 60 L30 55 L60 58 L90 50 L120 45 L150 30 L180 35 L210 22 L240 28 L270 18 L300 25 L300 80 L0 80 Z" fill="url(#g1)" />
              <path d="M0 60 L30 55 L60 58 L90 50 L120 45 L150 30 L180 35 L210 22 L240 28 L270 18 L300 25" stroke="#D8CFBC" strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { Icon: Database, name: "edge-gw", color: "#10b981" },
              { Icon: Activity, name: "orders", color: "#f59e0b" },
              { Icon: Server, name: "postgres", color: "#ef4444" },
            ].map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#11120D] border-l-2 border border-[#565449]/40"
                style={{ borderLeftColor: s.color }}
              >
                <s.Icon className="w-3 h-3 text-[#D8CFBC]/60" />
                <span className="font-mono text-[11px] text-[#D8CFBC]">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

