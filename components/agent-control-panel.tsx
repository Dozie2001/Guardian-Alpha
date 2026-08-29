"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, Bot, Play, RefreshCw } from "lucide-react";
import type { GuardianAgentConfig } from "@/lib/agent/config";
import type { AgentResearchContext } from "@/lib/agent/research";
import type { AgentScanResult, GuardianAgentState } from "@/lib/agent/state";
import { cn } from "@/lib/utils";

type AgentStatusResponse = {
  state: GuardianAgentState;
  config: GuardianAgentConfig;
  research: AgentResearchContext;
};

export function AgentControlPanel() {
  const [status, setStatus] = useState<AgentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/status", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not load agent status.");
      }
      setStatus(await response.json() as AgentStatusResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load agent status.");
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/scan", { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not run agent scan.");
      }
      const data = await response.json() as { scan: AgentScanResult };
      setStatus((current) => current ? { ...current, state: { running: data.scan.enabled, updatedAt: new Date().toISOString(), lastScan: data.scan } } : current);
      await loadStatus();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not run agent scan.");
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="market-panel p-4 md:p-6">
        <div className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-8 w-56 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-20 animate-pulse rounded-[14px] bg-white/[0.06]" />
        </div>
      </div>
    );
  }

  const scan = status?.state.lastScan;
  const config = status?.config;

  return (
    <section className="market-panel p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="section-kicker">Autonomous worker</p>
          <h2 className="text-2xl font-semibold">Agent control</h2>
          <p className="text-sm text-muted-foreground">Run one scan now or start the worker with `npm run agent` on the VM.</p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          aria-busy={scanning || undefined}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 font-mono text-xs font-medium uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {scanning ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          Run scan
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-[14px] border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Agent request failed
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatusBlock icon={<Activity className="h-4 w-4" aria-hidden="true" />} label="Agent" value={config?.enabled ? "Enabled" : "Disabled"} tone={config?.enabled ? "good" : "neutral"} />
        <StatusBlock icon={<Bot className="h-4 w-4" aria-hidden="true" />} label="Reasoning" value={config?.modelProvider ?? "none"} />
        <StatusBlock icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} label="Auto-submit" value={config?.autoSubmit ? "On" : "Off"} tone={config?.autoSubmit ? "warn" : "neutral"} />
        <StatusBlock icon={<Activity className="h-4 w-4" aria-hidden="true" />} label="Daily orders" value={String(config?.maxDailySubmittedOrders ?? 0)} />
        <StatusBlock icon={<Activity className="h-4 w-4" aria-hidden="true" />} label="Daily notional" value={formatUsd(config?.maxDailySubmittedNotionalUsd ?? 0)} />
      </div>

      <div className="mt-4 rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase text-muted-foreground">Research context</p>
            <p className="text-sm font-medium">{status?.research.available ? status.research.strategyName ?? "Latest backtest" : "No backtest loaded"}</p>
          </div>
          <Pill tone={status?.research.available ? "good" : "neutral"}>{status?.research.available ? "Active" : "Optional"}</Pill>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {status?.research.available
            ? `${status.research.symbols.length} symbol signals are biasing candidate scores.`
            : "Run an Alpaca backtest into runs/*/summary.json to bias the next scan."}
        </p>
      </div>

      <div className="mt-4 rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
        {scan ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums">{scan.selectedIntent?.symbol ?? "No trade"}</span>
              <Pill tone={scan.status === "submitted" ? "good" : scan.status === "blocked" || scan.status === "failed" ? "bad" : "neutral"}>{scan.status}</Pill>
              {scan.selection ? <Pill>{scan.selection.provider}</Pill> : null}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{scan.selection?.reason ?? scan.reasons.join(" ")}</p>
            <div className="grid gap-2 font-mono text-xs text-muted-foreground sm:grid-cols-3">
              <span>Candidates: {scan.candidates.length}</span>
              <span>Confidence: {scan.selection ? `${Math.round(scan.selection.confidence * 100)}%` : "n/a"}</span>
              <span>{formatDateTime(scan.createdAt)}</span>
            </div>
          </div>
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No agent scan yet</p>
            <p className="max-w-72 text-xs leading-5 text-muted-foreground">Run a scan to create the first autonomous decision receipt.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBlock({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "neutral" | "good" | "bad" | "warn" }) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-primary", tone === "good" && "text-emerald-300", tone === "bad" && "text-destructive", tone === "warn" && "text-amber-200")}>{icon}</span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{label}</span>
      </div>
      <p className="mt-3 font-mono text-sm font-semibold uppercase">{value}</p>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "bad" }) {
  return (
    <span className={cn(
      "inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px] uppercase",
      tone === "good" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      tone === "bad" && "border-destructive/50 bg-destructive/10 text-destructive",
      tone === "neutral" && "border-white/10 bg-white/[0.035] text-muted-foreground"
    )}>
      {children}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
