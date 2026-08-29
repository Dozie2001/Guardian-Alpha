import {
  Ban,
  Bot,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  ShieldCheck
} from "lucide-react";
import { getGuardianRuntimeConfig } from "@/lib/guardian/runtime-config";
import { cn } from "@/lib/utils";

export function GuardianLanding() {
  const runtime = getGuardianRuntimeConfig();

  return (
    <main className="floor-texture min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-6 lg:px-8">
        <nav className="flex min-h-12 items-center justify-between border-b border-border font-mono text-xs uppercase">
          <a href="/" className="inline-flex h-10 items-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Guardian
          </a>
          <div className="hidden items-center gap-5 md:flex">
            <a className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="#product">Product</a>
            <a className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="#how">How it works</a>
            <a className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="/app">Open app</a>
            <span>Paper preview</span>
          </div>
        </nav>

        <header className="guardian-hero relative grid min-h-[78dvh] items-center gap-8 overflow-hidden border-b border-white/10 py-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-16">
          <div aria-hidden="true" className="guardian-grid" />
          <div aria-hidden="true" className="guardian-stars" />
          <div aria-hidden="true" className="guardian-stars guardian-stars-b" />
          <div aria-hidden="true" className="guardian-orbit">
            <span />
            <span />
            <span />
          </div>

          <div className="relative z-10 max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase">
              <HeroTag>Paper trading preview</HeroTag>
              <HeroTag>Alpaca powered</HeroTag>
              <HeroTag>Live trading planned</HeroTag>
            </div>
            <div className="space-y-4">
              <p className="section-kicker">AI trading guardrails</p>
              <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] md:text-7xl">
                Trade with agents that have to ask first.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Guardian is a policy layer for Alpaca trading agents. It turns a model's idea into a structured paper-trading preview, checks it against user limits, and records the result before any order is submitted.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/app"
                className="inline-flex h-12 items-center justify-center rounded-full border border-primary bg-primary px-6 font-mono text-xs font-semibold uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Open app
              </a>
              <a
                href="#product"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.035] px-6 font-mono text-xs font-semibold uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                See why
              </a>
              {runtime.telegramBotUrl ? (
                <a
                  href={runtime.telegramBotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-6 font-mono text-xs font-semibold uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Try bot
                </a>
              ) : null}
            </div>
          </div>

          <div className="relative z-10 space-y-3">
            <div className="market-panel overflow-hidden p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Guarded preview</p>
                  <h2 className="mt-1 text-lg font-semibold">SOL/USD paper order</h2>
                </div>
                <StatusPill selected>Policy check</StatusPill>
              </div>
              <div className="mt-5 grid gap-3">
                <PreviewRow label="Intent" value="Buy $50 SOL/USD" />
                <PreviewRow label="Max trade" value="$5,000" />
                <PreviewRow label="Crypto cap" value="20%" />
                <PreviewRow label="Confirmation" value="Required" />
              </div>
              <div className="mt-5 rounded-[14px] border border-primary/30 bg-primary/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approved for paper preview
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">The model proposes. Guardian checks. The user confirms.</p>
              </div>
            </div>
            <div className="market-panel grid grid-cols-3 gap-px overflow-hidden bg-white/10 p-px">
              <Metric label="Equity" value="$100K" />
              <Metric label="Cash" value="$100K" />
              <Metric label="Crypto" value="$0" />
            </div>
          </div>

          <HeroTicker />
        </header>

        <section id="product" className="market-panel p-4 md:p-6">
          <div className="mb-6 space-y-1">
            <p className="section-kicker">Why Guardian</p>
            <h2 className="text-2xl font-semibold">Alpaca supplies the trading rail. Guardian supplies the control layer.</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Alpaca is the trading rail: account data, portfolio state, and paper order execution. Guardian is the control layer around it: policy, confirmation, and receipts.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <ComparisonColumn
              title="Without Alpaca + Guardian"
              items={[
                "The assistant can discuss trades but has no clean execution path",
                "Risk limits are hard to inspect before an order is sent",
                "Portfolio context is usually stale or manually entered",
                "Chat interfaces become scripts with no audit trail",
                "A malformed instruction can become an unsafe workflow"
              ]}
            />
            <ComparisonColumn
              title="With Alpaca + Guardian"
              highlighted
              items={[
                "Alpaca provides live paper account, portfolio, and order APIs",
                "Guardian checks every structured TradeIntent against policy",
                "Web, MCP, and Telegram all share the same guardrail engine",
                "Preview and confirmation are separated before paper execution",
                "Each approval, block, or submission becomes a receipt"
              ]}
            />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <ProofPoint label="Release stage" value="Paper preview" text="This version uses Alpaca paper trading with simulated funds. Live trading support is planned after stronger account isolation." />
          <ProofPoint label="Agent proof" value="3 surfaces" text="The web console, Telegram bot, and MCP server all use the same policy engine." />
          <ProofPoint label="Audit proof" value="Receipts" text="Every policy decision is recorded so the flow can be reviewed after the fact." />
        </section>

        <section id="how" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="market-panel p-4 md:p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="section-kicker">How it works</p>
                <h2 className="text-2xl font-semibold">One paper-trading loop, three controlled surfaces</h2>
              </div>
              <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FlowStep step="01" title="Agent proposes" text="A user or AI assistant turns an idea into a structured TradeIntent." />
              <FlowStep step="02" title="Policy decides" text="Guardian checks size, symbols, crypto exposure, position caps, and paper-only mode." />
              <FlowStep step="03" title="Human confirms" text="Approved orders still need confirmation before Alpaca paper execution." />
            </div>
          </section>

          <section className="market-panel p-4 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="section-kicker">Chat bot</p>
                <h2 className="text-2xl font-semibold">Telegram commands</h2>
              </div>
              <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-2 font-mono text-xs text-muted-foreground">
              {runtime.judgeCommands.map((command) => (
                <div key={command} className="rounded-[14px] border border-white/10 bg-white/[0.035] px-3 py-2 text-foreground">
                  {command}
                </div>
              ))}
            </div>
            {runtime.telegramBotUrl ? (
              <a
                href={runtime.telegramBotUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 font-mono text-xs font-semibold uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Open Telegram
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Bot access appears here when the hosted demo is online.
              </p>
            )}
          </section>
        </section>

        <section className="border-t border-white/10 py-12 text-center">
          <p className="section-kicker">Open the preview</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Test Guardian against Alpaca paper trading.</h2>
          <div className="mt-8">
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="/app"
                className="inline-flex h-12 items-center justify-center rounded-full border border-primary bg-primary px-6 font-mono text-xs font-semibold uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Open app
              </a>
              {runtime.telegramBotUrl ? (
                <a
                  href={runtime.telegramBotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-6 font-mono text-xs font-semibold uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Open bot
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FlowStep({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="min-h-40 rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{step}</p>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function HeroTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/[0.035] px-3 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function HeroTicker() {
  const items = [
    "Alpaca paper account",
    "MCP trade tools",
    "Telegram confirmation",
    "Deterministic policy",
    "Portfolio snapshot",
    "Audit receipts",
    "Live trading planned",
    "Paper preview"
  ];
  const tickerItems = [...items, ...items];

  return (
    <div className="guardian-marquee absolute inset-x-0 bottom-0 z-20 overflow-hidden border-t border-white/10 py-4">
      <div className="guardian-ticker flex w-max items-center gap-10 pr-10 whitespace-nowrap">
        {tickerItems.map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-center gap-10 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span>{item}</span>
            <span aria-hidden="true" className="text-primary/50">◇</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function ComparisonColumn({
  title,
  items,
  highlighted = false
}: {
  title: string;
  items: string[];
  highlighted?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-[14px] border p-4",
      highlighted ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/[0.035]"
    )}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6">
            {highlighted ? (
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Ban className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={highlighted ? "text-foreground" : "text-muted-foreground"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProofPoint({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div className="market-panel min-h-32 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-4 font-mono text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums md:text-base">{value}</p>
    </div>
  );
}

function StatusPill({ children, selected = false }: { children: React.ReactNode; selected?: boolean }) {
  return (
    <span className={cn(
      "inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px] uppercase",
      selected ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.035] text-muted-foreground"
    )}>
      {children}
    </span>
  );
}
