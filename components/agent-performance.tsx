import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Ban,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LineChart,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy
} from "lucide-react";
import { getPaperAccountSummary, getPaperPortfolioSnapshot } from "@/lib/alpaca/client";
import { readReceipts } from "@/lib/audit/store";
import { summarizeAgentPerformance } from "@/lib/agent/performance";
import { demoPortfolio } from "@/lib/trade/mock-data";
import type { GuardedExecutionResult, PortfolioSnapshot } from "@/lib/trade/types";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { AgentControlPanel } from "@/components/agent-control-panel";

export async function AgentPerformance() {
  const receipts = await readReceipts();
  const portfolio = await loadPortfolio();
  const account = await loadAccount();
  const summary = summarizeAgentPerformance(receipts, portfolio);
  const recentReceipts = receipts.slice(0, 8);

  return (
    <main className="floor-texture min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <nav className="flex min-h-12 items-center justify-between border-b border-border font-mono text-xs uppercase">
          <Link href="/" className="inline-flex h-10 items-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Guardian
          </Link>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/app" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Console</Link>
            <a href="#strategy" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Strategy</a>
            <a href="#performance" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Performance</a>
            <a href="#decisions" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Decisions</a>
            <SignOutButton />
          </div>
        </nav>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="market-panel p-4 md:p-6">
            <Link
              href="/app"
              className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-4 font-mono text-xs uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Console
            </Link>
            <div className="space-y-3">
              <p className="section-kicker">Options Alpha Agents track</p>
              <h1 className="max-w-4xl text-4xl font-extrabold leading-none tracking-[-0.03em] md:text-6xl">
                Alpha agent scoreboard
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Guardian turns agent ideas into paper-trading decisions with a visible strategy, policy checks, position limits, and measurable performance.
              </p>
            </div>
          </div>

          <section className="market-panel p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Agent state</p>
                <h2 className="mt-1 text-xl font-semibold">{summary.strategyName}</h2>
              </div>
              <StatusPill tone={summary.strategyStatus === "defensive" ? "warn" : summary.strategyStatus === "needs_data" ? "neutral" : "good"}>
                {summary.strategyStatus === "needs_data" ? "Needs data" : summary.strategyStatus}
              </StatusPill>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <InfoRow label="Mode" value="Alpaca paper" />
              <InfoRow label="Universe" value="ETFs, large caps, crypto, options" />
              <InfoRow label="Options" value={account.optionsTradingLevel !== undefined ? `Level ${account.optionsTradingLevel}` : "Verify account"} />
              <InfoRow label="Module" value="Options alpha enabled" />
            </div>
          </section>
        </section>

        <section id="performance" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<LineChart className="h-4 w-4" aria-hidden="true" />} label="Daily P&L" value={formatUsd(summary.dailyPnlUsd)} detail={formatPercent(summary.dailyPnlPercent)} tone={summary.dailyPnlUsd < 0 ? "bad" : "good"} />
          <MetricCard icon={<Activity className="h-4 w-4" aria-hidden="true" />} label="Decisions" value={String(summary.totalDecisions)} detail={`${summary.submittedCount} submitted`} />
          <MetricCard icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} label="Approval rate" value={formatPercent(summary.approvalRate)} detail={`${summary.blockedCount} blocked`} />
          <MetricCard icon={<Gauge className="h-4 w-4" aria-hidden="true" />} label="Cash reserve" value={formatPercent(summary.cashPercent)} detail={`${formatPercent(summary.largestPositionPercent)} largest position`} />
        </section>

        <AgentControlPanel />

        <section className="market-panel p-4 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <div className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between gap-3">
                <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-mono text-xs uppercase text-muted-foreground">Judge brief</span>
              </div>
              <p className="mt-5 font-mono text-4xl font-semibold tabular-nums">{summary.competitionScore}</p>
              <p className="mt-1 font-mono text-xs uppercase text-muted-foreground">{formatGrade(summary.competitionGrade)}</p>
            </div>
            <div>
              <p className="section-kicker">P&L plus creativity</p>
              <h2 className="mt-1 text-2xl font-semibold">Competition readout</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {summary.competitionBrief.map((line) => (
                  <div key={line} className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-muted-foreground">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section id="strategy" className="market-panel p-4 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="section-kicker">Strategy</p>
                <h2 className="text-2xl font-semibold">How the agent trades</h2>
              </div>
              <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="grid gap-3">
              <StrategyStep
                icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
                title="Identify"
                text="Scan the allowed universe for trend continuation, cash level, current exposure, and option contracts before creating a trade intent."
              />
              <StrategyStep
                icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                title="Decide"
                text="Convert the signal into an equity or crypto buy, spot exit, defined-risk call or put, or bounded equity short with symbol, side, size, order type, and rationale."
              />
              <StrategyStep
                icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
                title="Constrain"
                text="Guardian checks max notional, allowlists, crypto exposure, option premium, daily loss, position concentration, and paper-only routing."
              />
              <StrategyStep
                icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                title="Measure"
                text="Receipts, Alpaca account data, and portfolio P&L become the audit trail for competition performance."
              />
            </div>
          </section>

          <section className="market-panel p-4 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="section-kicker">Position management</p>
                <h2 className="text-2xl font-semibold">Current exposure</h2>
              </div>
              <RefreshCw className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <ExposurePanel portfolio={portfolio} />
          </section>
        </section>

        <section id="decisions" className="market-panel p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="section-kicker">Decision journal</p>
              <h2 className="text-2xl font-semibold">What the agent tried</h2>
              <p className="text-sm text-muted-foreground">Each row links the opportunity, proposed action, policy result, and execution status.</p>
            </div>
            <div className="font-mono text-xs uppercase text-muted-foreground">
              {summary.latestDecisionAt ? formatDateTime(summary.latestDecisionAt) : "No decisions yet"}
            </div>
          </div>
          <DecisionJournal receipts={recentReceipts} />
        </section>
      </div>
    </main>
  );
}

async function loadPortfolio(): Promise<PortfolioSnapshot> {
  try {
    return await getPaperPortfolioSnapshot();
  } catch {
    return demoPortfolio;
  }
}

async function loadAccount() {
  try {
    return await getPaperAccountSummary();
  } catch {
    return {
      optionsTradingLevel: undefined
    };
  }
}

function ExposurePanel({ portfolio }: { portfolio: PortfolioSnapshot }) {
  const items = [
    ...portfolio.openPositions
      .slice()
      .sort((a, b) => Math.abs(b.marketValueUsd) - Math.abs(a.marketValueUsd)),
    { symbol: "Cash", assetClass: "us_equity" as const, marketValueUsd: Math.max(0, portfolio.cashUsd) }
  ].filter((item) => Math.abs(item.marketValueUsd) > 0);
  const denominator = Math.max(portfolio.equityUsd, 1);

  if (items.length === 0) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-white/15 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No exposure yet</p>
          <p className="max-w-72 text-xs leading-5 text-muted-foreground">Run a guarded paper trade to start measuring position impact.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full border border-white/10 bg-white/[0.035]">
        {items.slice(0, 7).map((item, index) => (
          <span
            key={`${item.symbol}-${index}`}
            className={cn("h-full", index % 3 === 0 ? "bg-primary" : index % 3 === 1 ? "bg-emerald-400" : "bg-sky-400")}
            style={{ width: `${Math.max(3, Math.abs(item.marketValueUsd) / denominator * 100)}%` }}
            aria-label={`${item.symbol} ${formatPercent(Math.abs(item.marketValueUsd) / denominator * 100)}`}
          />
        ))}
      </div>
      <div className="space-y-3">
        {items.slice(0, 7).map((item) => {
          const percent = Math.abs(item.marketValueUsd) / denominator * 100;
          return (
            <div key={item.symbol} className="grid grid-cols-[minmax(72px,0.7fr)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <div>
                <p className="font-mono font-medium tabular-nums">{item.symbol}</p>
                <p className="text-xs text-muted-foreground">{item.symbol === "Cash" ? "Reserve" : formatAssetClass(item.assetClass)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              <div className="text-right font-mono text-xs tabular-nums">
                <p>{formatUsd(Math.abs(item.marketValueUsd))}</p>
                <p className="text-muted-foreground">{formatPercent(percent)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DecisionJournal({ receipts }: { receipts: GuardedExecutionResult[] }) {
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-white/15 py-12 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No decisions recorded</p>
          <p className="max-w-72 text-xs leading-5 text-muted-foreground">Use the console or Telegram bot to create the first paper-trading receipt.</p>
        </div>
        <Link
          href="/app#trade"
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.035] px-4 font-mono text-xs uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Open trade guard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => (
        <DecisionRow key={receipt.receiptId} receipt={receipt} />
      ))}
    </div>
  );
}

function DecisionRow({ receipt }: { receipt: GuardedExecutionResult }) {
  const isBad = ["blocked", "failed", "rejected", "canceled", "expired"].includes(receipt.status);
  const Icon = isBad ? receipt.status === "blocked" ? Ban : TrendingDown : CheckCircle2;

  return (
    <article className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
      <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045]">
          <Icon className={cn("h-4 w-4", isBad ? "text-destructive" : "text-primary")} aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold tabular-nums">{receipt.intent.side.toUpperCase()} {receipt.intent.symbol}</p>
            <StatusPill tone={isBad ? "bad" : "good"}>{receipt.status}</StatusPill>
            <StatusPill>{formatAssetClass(receipt.intent.assetClass)}</StatusPill>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{receipt.intent.rationale}</p>
          <p className="text-xs leading-5 text-muted-foreground">{receipt.reasons.join(" ")}</p>
          {receipt.alpacaOrderStatus ? (
            <p className="font-mono text-xs uppercase text-muted-foreground">
              Broker {receipt.alpacaOrderStatus}{receipt.filledQty ? ` | filled ${receipt.filledQty}` : ""}
            </p>
          ) : null}
        </div>
        <div className="font-mono text-xs tabular-nums text-muted-foreground md:text-right">
          <p className="text-foreground">{formatUsd(receipt.intent.notionalUsd)}</p>
          <p>{formatDateTime(receipt.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}

function StrategyStep({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-primary">{icon}</span>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{text}</p>
        </div>
      </div>
    </article>
  );
}

function MetricCard({ icon, label, value, detail, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="market-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035]",
          tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-destructive" : "text-primary"
        )}>
          {icon}
        </span>
        <span className="font-mono text-xs uppercase text-muted-foreground">{label}</span>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs uppercase tabular-nums">{value}</span>
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  return (
    <span className={cn(
      "inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px] uppercase",
      tone === "good" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      tone === "bad" && "border-destructive/50 bg-destructive/10 text-destructive",
      tone === "warn" && "border-amber-300/40 bg-amber-300/10 text-amber-200",
      tone === "neutral" && "border-white/10 bg-white/[0.035] text-muted-foreground"
    )}>
      {children}
    </span>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatAssetClass(assetClass: GuardedExecutionResult["intent"]["assetClass"]) {
  if (assetClass === "crypto") {
    return "Crypto";
  }

  if (assetClass === "us_option") {
    return "Option";
  }

  return "Equity";
}

function formatGrade(value: "warming_up" | "engaging" | "competitive" | "standout") {
  return value.replace("_", " ");
}
