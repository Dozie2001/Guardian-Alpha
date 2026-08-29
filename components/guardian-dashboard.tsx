"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  Bot,
  CheckCircle2,
  ClipboardList,
  Coins,
  Database,
  ExternalLink,
  Globe2,
  LockKeyhole,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Target,
  TrendingUp
} from "lucide-react";
import { demoPolicy, demoPortfolio, demoTradeIntents } from "@/lib/trade/mock-data";
import { estimateOptionPremiumNotionalUsd, getDefaultOptionDateRange, type OptionContract } from "@/lib/options/contracts";
import type { GuardianAgentConfig } from "@/lib/agent/config";
import type { GuardianAgentState } from "@/lib/agent/state";
import type { Policy } from "@/lib/policy/types";
import type { AssetClass, GuardedExecutionResult, PortfolioSnapshot, TradeIntent } from "@/lib/trade/types";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";

type LoadState = "loading" | "ready" | "error";
type AccountSummary = {
  mode: "mock" | "alpaca";
  environment: "paper";
  accountId: string;
  status: string;
  equityUsd: number;
  cashUsd: number;
  buyingPowerUsd: number;
  tradingBlocked: boolean;
  accountBlocked: boolean;
  tradeSuspendedByUser: boolean;
  cryptoStatus?: string;
  optionsApprovedLevel?: number;
  optionsTradingLevel?: number;
  optionsBuyingPowerUsd?: number;
  multiplier?: string;
};
type ComposerState = {
  assetClass: AssetClass;
  symbol: string;
  side: "buy" | "sell";
  notionalUsd: string;
  rationale: string;
};
type OptionSearchState = {
  underlying: string;
  type: "call" | "put";
  expirationDateGte: string;
  expirationDateLte: string;
  strikePriceGte: string;
  strikePriceLte: string;
  limitPrice: string;
  contracts: string;
};
type AgentStatus = {
  state: GuardianAgentState;
  config: GuardianAgentConfig;
};
type PublicRuntime = {
  telegramBotUrl: string | null;
  judgeCommands: string[];
};

export function GuardianDashboard() {
  const defaultOptionDates = useMemo(() => getDefaultOptionDateRange(), []);
  const [selectedIntentId, setSelectedIntentId] = useState(demoTradeIntents[0].id);
  const [composer, setComposer] = useState<ComposerState>({
    assetClass: "us_equity",
    symbol: "VOO",
    side: "buy",
    notionalUsd: "90",
    rationale: "User-composed trade intent for a guarded Alpaca paper trading preview."
  });
  const [policy, setPolicy] = useState<Policy>(demoPolicy);
  const [receipts, setReceipts] = useState<GuardedExecutionResult[]>([]);
  const [optionSearch, setOptionSearch] = useState<OptionSearchState>({
    underlying: "SPY",
    type: "call",
    expirationDateGte: defaultOptionDates.expirationDateGte,
    expirationDateLte: defaultOptionDates.expirationDateLte,
    strikePriceGte: "500",
    strikePriceLte: "540",
    limitPrice: "1.25",
    contracts: "1"
  });
  const [optionContracts, setOptionContracts] = useState<OptionContract[]>([]);
  const [optionMode, setOptionMode] = useState<"mock" | "alpaca" | null>(null);
  const [optionLoading, setOptionLoading] = useState(false);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [runtime, setRuntime] = useState<PublicRuntime>({ telegramBotUrl: null, judgeCommands: ["/brief", "/scan", "/why", "/performance", "/receipts"] });
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot>(demoPortfolio);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const composedIntent = useMemo<TradeIntent>(() => {
    const normalizedSymbol = composer.assetClass === "crypto"
      ? composer.symbol.trim().toUpperCase().replace("-", "/")
      : composer.symbol.trim().toUpperCase();
    const notionalUsd = Number(composer.notionalUsd) || 0.01;

    return {
      id: "intent-composer",
      source: "dashboard",
      rationale: composer.rationale,
      assetClass: composer.assetClass,
      symbol: normalizedSymbol,
      side: composer.side,
      orderType: "market",
      timeInForce: composer.assetClass === "crypto" ? "gtc" : "day",
      notionalUsd,
      clientOrderId: `guardian-demo-${normalizedSymbol.replace("/", "-").toLowerCase()}-${Date.now().toString().slice(-6)}`
    };
  }, [composer]);

  const tradeIntents = useMemo(() => [...demoTradeIntents, composedIntent], [composedIntent]);
  const selectedIntent = tradeIntents.find((intent) => intent.id === selectedIntentId) ?? tradeIntents[0];
  const isConnected = account?.mode === "alpaca";

  useEffect(() => {
    void loadReceipts();
    void loadAccount();
    void loadPortfolio();
    void loadAgentStatus();
    void loadRuntime();
  }, []);

  async function loadReceipts() {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetch("/api/receipts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load audit receipts.");
      }
      const data = await response.json() as { receipts: GuardedExecutionResult[] };
      setReceipts(data.receipts);
      setLoadState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load audit receipts.");
      setLoadState("error");
    }
  }

  async function loadAccount() {
    try {
      const response = await fetch("/api/alpaca/account", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json() as { account: AccountSummary };
      setAccount(data.account);
    } catch {
      setAccount(null);
    }
  }

  async function loadPortfolio() {
    try {
      const response = await fetch("/api/alpaca/portfolio", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json() as { portfolio: PortfolioSnapshot };
      setPortfolio(data.portfolio);
    } catch {
      setPortfolio(demoPortfolio);
    }
  }

  async function loadAgentStatus() {
    try {
      const response = await fetch("/api/agent/status", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      setAgentStatus(await response.json() as AgentStatus);
    } catch {
      setAgentStatus(null);
    }
  }

  async function loadRuntime() {
    try {
      const response = await fetch("/api/guardian/runtime", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json() as { runtime: PublicRuntime };
      setRuntime(data.runtime);
    } catch {
      setRuntime({ telegramBotUrl: null, judgeCommands: ["/brief", "/scan", "/why", "/performance", "/receipts"] });
    }
  }

  async function refreshAll() {
    await Promise.all([loadReceipts(), loadAccount(), loadPortfolio(), loadAgentStatus(), loadRuntime()]);
  }

  async function submitIntent(intent: TradeIntent) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/guarded-trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ intent, policy })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "The trade intent could not be evaluated.");
      }

      const receipt = await response.json() as GuardedExecutionResult;
      setReceipts((current) => [receipt, ...current]);
      await loadPortfolio();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The trade intent could not be evaluated.");
    } finally {
      setSubmitting(false);
    }
  }

  async function searchOptionContracts() {
    setOptionLoading(true);
    setOptionError(null);
    try {
      const params = new URLSearchParams({
        underlying: optionSearch.underlying.trim().toUpperCase(),
        type: optionSearch.type,
        expirationDateGte: optionSearch.expirationDateGte,
        expirationDateLte: optionSearch.expirationDateLte,
        limit: "12"
      });

      if (optionSearch.strikePriceGte.trim()) {
        params.set("strikePriceGte", optionSearch.strikePriceGte.trim());
      }

      if (optionSearch.strikePriceLte.trim()) {
        params.set("strikePriceLte", optionSearch.strikePriceLte.trim());
      }

      const response = await fetch(`/api/options/contracts?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not search option contracts.");
      }

      const data = await response.json() as { mode: "mock" | "alpaca"; contracts: OptionContract[] };
      setOptionContracts(data.contracts);
      setOptionMode(data.mode);
    } catch (searchError) {
      setOptionError(searchError instanceof Error ? searchError.message : "Could not search option contracts.");
      setOptionContracts([]);
      setOptionMode(null);
    } finally {
      setOptionLoading(false);
    }
  }

  function buildOptionIntent(contract: OptionContract): TradeIntent {
    const quantity = Math.max(1, Math.floor(Number(optionSearch.contracts) || 1));
    const limitPrice = Math.max(0.01, Number(optionSearch.limitPrice) || contract.closePrice || 1);
    const notionalUsd = estimateOptionPremiumNotionalUsd(limitPrice, quantity);

    return {
      id: `option-${contract.symbol.toLowerCase()}`,
      source: "dashboard",
      rationale: `Options scout selected ${contract.underlyingSymbol} ${contract.type} contract expiring ${contract.expirationDate} at ${formatUsd(contract.strikePrice)} strike.`,
      assetClass: "us_option",
      symbol: contract.symbol,
      side: "buy",
      orderType: "limit",
      timeInForce: "day",
      notionalUsd,
      quantity,
      limitPrice,
      clientOrderId: `guardian-opt-${contract.symbol.toLowerCase().slice(-28)}`
    };
  }

  return (
    <main className="floor-texture min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <nav className="flex min-h-12 items-center justify-between border-b border-border font-mono text-xs uppercase">
          <a href="/" className="inline-flex h-10 items-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Guardian
          </a>
          <div className="hidden items-center gap-5 md:flex">
            <a href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Landing</a>
            <a href="/app/agent" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Agent</a>
            <a href="#setup" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Setup</a>
            <a href="#trade" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Trade</a>
            <a href="#policy" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Policy</a>
            <span>Paper preview</span>
            <SignOutButton />
          </div>
        </nav>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="market-panel p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <p className="section-kicker">Guardian app</p>
                <h1 className="max-w-3xl text-4xl font-extrabold leading-none tracking-[-0.03em] md:text-6xl">
                  Paper trading command center
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Connect Alpaca paper data, tune policy, preview agent trade intents, and review every approval or block from one workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-5 font-mono text-xs font-medium uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>

          <section className="market-panel p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Status</p>
                <h2 className="mt-1 text-xl font-semibold">Alpaca paper</h2>
              </div>
              <StatusPill selected={isConnected}>{isConnected ? "Connected" : "Mock"}</StatusPill>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <PolicyRow label="Account" value={account?.accountId ?? "mock-paper-account"} />
              <PolicyRow label="Status" value={account?.status ?? "PAPER_ONLY"} />
              <PolicyRow label="Crypto" value={account?.cryptoStatus ?? "Demo active"} />
              <PolicyRow label="Options" value={account?.optionsTradingLevel !== undefined ? `Level ${account.optionsTradingLevel}` : "Verify account"} />
            </div>
          </section>
        </section>

        <section id="setup" className="grid gap-4 lg:grid-cols-3">
          <SetupCard
            icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
            title="1. Sign in"
            text="The command center is protected by an operator session before paper trades can be evaluated."
            status="Secured"
          />
          <SetupCard
            icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
            title="2. Set policy"
            text="Configure trade caps, allowlists, crypto exposure, and human review thresholds."
            status="Editable"
          />
          <SetupCard
            icon={<Bot className="h-4 w-4" aria-hidden="true" />}
            title="3. Use agent surfaces"
            text="Web, Telegram, and MCP all produce the same structured TradeIntent for Guardian."
            status="Preview"
          />
        </section>

        <ConnectedSurfaces account={account} agentStatus={agentStatus} runtime={runtime} />

        <section className="grid gap-4 lg:grid-cols-4">
          <Metric label="Equity" value={formatUsd(account?.equityUsd ?? portfolio.equityUsd)} />
          <Metric label="Cash" value={formatUsd(account?.cashUsd ?? portfolio.cashUsd)} />
          <Metric label="Buying power" value={formatUsd(account?.buyingPowerUsd ?? portfolio.cashUsd)} />
          <Metric label="Crypto" value={formatUsd(portfolio.cryptoMarketValueUsd)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <section id="trade" className="market-panel p-4 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-kicker">Trade guard</p>
                  <h2 className="text-2xl font-semibold">Agent proposals</h2>
                  <p className="text-sm text-muted-foreground">Pick a sample intent or compose your own paper trade.</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="grid gap-3">
                {tradeIntents.map((intent) => (
                  <button
                    key={intent.id}
                    type="button"
                    onClick={() => setSelectedIntentId(intent.id)}
                    className={cn(
                      "min-h-20 rounded-[14px] border border-white/10 p-4 text-left transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selectedIntentId === intent.id ? "border-primary/70 bg-primary/10 text-foreground" : "bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]"
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums">{intent.symbol}</span>
                      <StatusPill selected={selectedIntentId === intent.id}>{formatAssetClass(intent.assetClass)}</StatusPill>
                      <StatusPill selected={selectedIntentId === intent.id}>{intent.side.toUpperCase()}</StatusPill>
                      <span className="ml-auto font-mono text-sm tabular-nums">{formatUsd(intent.notionalUsd)}</span>
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">{intent.rationale}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="market-panel p-4 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-kicker">Options scout</p>
                  <h2 className="text-2xl font-semibold">Find paper contracts</h2>
                  <p className="text-sm text-muted-foreground">Search Alpaca paper option contracts, then send one candidate through Guardian policy.</p>
                </div>
                <Target className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <OptionScout
                search={optionSearch}
                contracts={optionContracts}
                mode={optionMode}
                loading={optionLoading}
                error={optionError}
                onSearchChange={setOptionSearch}
                onSearch={searchOptionContracts}
                onPreview={(contract) => submitIntent(buildOptionIntent(contract))}
              />
            </section>

            <section className="market-panel p-4 md:p-6">
              <div className="mb-5 space-y-1">
                <p className="section-kicker">Compose</p>
                <h2 className="text-2xl font-semibold">Create intent</h2>
              </div>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="composer-asset-class" className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Asset class</span>
                  <select
                    id="composer-asset-class"
                    value={composer.assetClass}
                    onChange={(event) => setComposer((current) => ({
                      ...current,
                      assetClass: event.target.value as AssetClass,
                      symbol: event.target.value === "crypto" ? "SOL/USD" : "VOO"
                    }))}
                    className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="us_equity">US equity / ETF</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </label>
                <TextField id="composer-symbol" label="Symbol" value={composer.symbol} onChange={(value) => setComposer((current) => ({ ...current, symbol: value }))} />
                <label htmlFor="composer-side" className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Side</span>
                  <select
                    id="composer-side"
                    value={composer.side}
                    onChange={(event) => setComposer((current) => ({ ...current, side: event.target.value as "buy" | "sell" }))}
                    className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </label>
                <MoneyField value={composer.notionalUsd} onChange={(value) => setComposer((current) => ({ ...current, notionalUsd: value }))} />
                <label htmlFor="composer-rationale" className="block space-y-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">Rationale</span>
                  <textarea
                    id="composer-rationale"
                    value={composer.rationale}
                    onChange={(event) => setComposer((current) => ({ ...current, rationale: event.target.value }))}
                    className="min-h-24 w-full resize-y rounded-[14px] border border-white/10 bg-white/[0.035] px-3 py-2 text-sm leading-6 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedIntentId("intent-composer")}
                  className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-full border border-white/15 bg-white/[0.035] px-5 font-mono text-xs font-medium uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Use intent
                </button>
              </form>
            </section>

            <section className="market-panel p-4 md:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="section-kicker">Preview</p>
                  <h2 className="text-2xl font-semibold">Selected payload</h2>
                </div>
                <button
                  type="button"
                  onClick={() => submitIntent(selectedIntent)}
                  disabled={submitting}
                  aria-busy={submitting || undefined}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 font-mono text-xs font-medium uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  Run guard
                </button>
              </div>
              <pre className="overflow-x-auto rounded-[14px] border border-white/10 bg-white/[0.035] p-4 font-mono text-xs leading-6 text-foreground">
                {JSON.stringify(selectedIntent, null, 2)}
              </pre>
            </section>

            <section className="market-panel p-4 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-kicker">Portfolio</p>
                  <h2 className="text-2xl font-semibold">Allocation</h2>
                  <p className="text-sm text-muted-foreground">Current paper account exposure by position.</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <PortfolioGraph portfolio={portfolio} />
            </section>
          </div>

          <aside className="space-y-6">
            <section id="policy" className="market-panel p-4 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-kicker">Policy</p>
                  <h2 className="text-2xl font-semibold">Rules</h2>
                  <p className="text-sm text-muted-foreground">{policy.name}</p>
                </div>
                <ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <PolicyEditor policy={policy} onChange={setPolicy} />
            </section>

            <section id="audit" className="market-panel p-4 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-kicker">Audit</p>
                  <h2 className="text-2xl font-semibold">Receipts</h2>
                  <p className="text-sm text-muted-foreground">Approvals, blocks, and submissions.</p>
                </div>
                <Database className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <ReceiptList error={error} loadState={loadState} receipts={receipts} onRetry={loadReceipts} />
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SetupCard({ icon, title, text, status }: { icon: React.ReactNode; title: string; text: string; status: string }) {
  return (
    <div className="market-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-primary">{icon}</span>
        <StatusPill>{status}</StatusPill>
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function ConnectedSurfaces({ account, agentStatus, runtime }: { account: AccountSummary | null; agentStatus: AgentStatus | null; runtime: PublicRuntime }) {
  const agentMode = agentStatus?.config.autoSubmit
    ? "Auto-submit capped"
    : agentStatus?.config.enabled
      ? "Decision-only"
      : "Paused";
  return (
    <section className="market-panel p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="section-kicker">Connected surfaces</p>
          <h2 className="text-2xl font-semibold">One paper account, many controls</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Web, Telegram, MCP, and the worker use the same server-side Alpaca paper credentials, Guardian policy, and receipt log.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {runtime.telegramBotUrl ? (
            <a
              href={runtime.telegramBotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-4 font-mono text-[10px] font-semibold uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Open bot
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <StatusPill selected={account?.mode === "alpaca"}>{account?.mode === "alpaca" ? "Live paper data" : "Mock paper data"}</StatusPill>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard icon={<Globe2 className="h-4 w-4" aria-hidden="true" />} label="Web app" value="Active" detail="Authenticated console" />
        <SurfaceCard icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />} label="Telegram" value={runtime.telegramBotUrl ? "Linked" : "Chat-first"} detail={runtime.judgeCommands.join(" ")} />
        <SurfaceCard icon={<Bot className="h-4 w-4" aria-hidden="true" />} label="Agent worker" value={agentMode} detail={agentStatus?.state.lastScan ? `Last ${agentStatus.state.lastScan.status}` : "No scan yet"} />
        <SurfaceCard icon={<Database className="h-4 w-4" aria-hidden="true" />} label="MCP" value="Available" detail="Programmatic tools" />
        <SurfaceCard icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} label="Account source" value="Server env" detail="Browser never sees keys" />
      </div>
    </section>
  );
}

function SurfaceCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-primary">{icon}</span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{label}</span>
      </div>
      <p className="mt-4 font-mono text-sm font-semibold uppercase">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

function ReceiptList({ error, loadState, receipts, onRetry }: { error: string | null; loadState: LoadState; receipts: GuardedExecutionResult[]; onRetry: () => void }) {
  if (error) {
    return (
      <div className="rounded-[14px] border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Could not complete the request
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-4 font-mono text-xs font-medium uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="space-y-3" aria-label="Loading audit receipts">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-[14px] border border-white/10 bg-white/[0.035]" />
        ))}
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-white/15 py-10 text-center">
        <BadgeCheck className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No receipts yet</p>
          <p className="max-w-60 text-xs leading-5 text-muted-foreground">Run a trade intent to create the first audit receipt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => (
        <ReceiptItem key={receipt.receiptId} receipt={receipt} />
      ))}
    </div>
  );
}

function OptionScout({
  search,
  contracts,
  mode,
  loading,
  error,
  onSearchChange,
  onSearch,
  onPreview
}: {
  search: OptionSearchState;
  contracts: OptionContract[];
  mode: "mock" | "alpaca" | null;
  loading: boolean;
  error: string | null;
  onSearchChange: (search: OptionSearchState) => void;
  onSearch: () => void;
  onPreview: (contract: OptionContract) => void;
}) {
  function update(key: keyof OptionSearchState, value: string) {
    onSearchChange({ ...search, [key]: value });
  }

  return (
    <div className="space-y-5">
      <form
        className="grid gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <TextField id="option-underlying-search" label="Underlying" value={search.underlying} onChange={(value) => update("underlying", value.toUpperCase())} />
        <label htmlFor="option-type-search" className="block space-y-1.5">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Type</span>
          <select
            id="option-type-search"
            value={search.type}
            onChange={(event) => update("type", event.target.value)}
            className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </label>
        <TextField id="option-contracts" label="Contracts" value={search.contracts} onChange={(value) => update("contracts", value)} />
        <label htmlFor="option-expiry-start" className="block space-y-1.5">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Expiry from</span>
          <input
            id="option-expiry-start"
            type="date"
            value={search.expirationDateGte}
            onChange={(event) => update("expirationDateGte", event.target.value)}
            className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 font-mono text-sm tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </label>
        <label htmlFor="option-expiry-end" className="block space-y-1.5">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Expiry to</span>
          <input
            id="option-expiry-end"
            type="date"
            value={search.expirationDateLte}
            onChange={(event) => update("expirationDateLte", event.target.value)}
            className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 font-mono text-sm tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </label>
        <TextField id="option-limit-price" label="Limit price" value={search.limitPrice} onChange={(value) => update("limitPrice", value)} />
        <TextField id="option-strike-min" label="Strike min" value={search.strikePriceGte} onChange={(value) => update("strikePriceGte", value)} />
        <TextField id="option-strike-max" label="Strike max" value={search.strikePriceLte} onChange={(value) => update("strikePriceLte", value)} />
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading || undefined}
          className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-full border border-primary bg-primary px-5 font-mono text-xs font-medium uppercase text-primary-foreground transition-colors duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Search
        </button>
      </form>

      <div className="rounded-[14px] border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
        Options preview is policy-gated. The hackathon policy enables defined-risk long calls and puts while blocking naked option selling.
      </div>

      {error ? (
        <div className="rounded-[14px] border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Could not search options
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={onSearch}
            className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-4 font-mono text-xs font-medium uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-[14px] border border-white/10 bg-white/[0.035]" />
          ))}
        </div>
      ) : contracts.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 font-mono text-xs uppercase text-muted-foreground">
            <span>{contracts.length} candidates</span>
            <span>{mode === "alpaca" ? "Alpaca paper" : "Mock data"}</span>
          </div>
          {contracts.map((contract) => {
            const limitPrice = Math.max(0.01, Number(search.limitPrice) || contract.closePrice || 1);
            const quantity = Math.max(1, Math.floor(Number(search.contracts) || 1));
            const premium = estimateOptionPremiumNotionalUsd(limitPrice, quantity);

            return (
              <article key={contract.symbol} className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold tabular-nums">{contract.symbol}</p>
                      <StatusPill>{contract.type.toUpperCase()}</StatusPill>
                      <StatusPill selected={contract.tradable}>{contract.tradable ? "Tradable" : "Closed"}</StatusPill>
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                      <span>Expiry <span className="font-mono text-foreground">{contract.expirationDate}</span></span>
                      <span>Strike <span className="font-mono text-foreground">{formatUsd(contract.strikePrice)}</span></span>
                      <span>Limit <span className="font-mono text-foreground">{formatUsd(limitPrice)}</span></span>
                      <span>Premium <span className="font-mono text-foreground">{formatUsd(premium)}</span></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPreview(contract)}
                    disabled={!contract.tradable}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-4 font-mono text-xs font-medium uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Guard preview
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-white/15 py-10 text-center">
          <Target className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No contract search yet</p>
            <p className="max-w-72 text-xs leading-5 text-muted-foreground">Search an allowed underlying to find paper option contracts.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioGraph({ portfolio }: { portfolio: PortfolioSnapshot }) {
  const cashValue = Math.max(0, portfolio.cashUsd);
  const denominator = Math.max(portfolio.equityUsd, cashValue, 1);
  const items = [
    ...portfolio.openPositions
      .slice()
      .sort((a, b) => Math.abs(b.marketValueUsd) - Math.abs(a.marketValueUsd))
      .slice(0, 6)
      .map((position) => ({
        label: position.symbol,
        detail: formatAssetClass(position.assetClass),
        value: Math.abs(position.marketValueUsd)
      })),
    { label: "Cash", detail: "Available", value: cashValue }
  ].filter((item) => item.value > 0);

  if (items.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-[14px] border border-dashed border-white/15 text-center text-sm text-muted-foreground">
        No allocation data yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full border border-white/10 bg-white/[0.035]">
        {items.map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            className={cn("h-full", index % 3 === 0 ? "bg-primary" : index % 3 === 1 ? "bg-emerald-400" : "bg-sky-400")}
            style={{ width: `${Math.max(2, item.value / denominator * 100)}%` }}
            aria-label={`${item.label} ${formatPercent(item.value / denominator * 100)}`}
          />
        ))}
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const percent = item.value / denominator * 100;
          return (
            <div key={item.label} className="grid grid-cols-[minmax(72px,0.7fr)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <div>
                <p className="font-mono font-medium tabular-nums">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              <div className="text-right font-mono text-xs tabular-nums">
                <p>{formatUsd(item.value)}</p>
                <p className="text-muted-foreground">{formatPercent(percent)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="market-panel p-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
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

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function PolicyEditor({ policy, onChange }: { policy: Policy; onChange: (policy: Policy) => void }) {
  function updateNumber(key: keyof Pick<Policy, "maxTradeNotionalUsd" | "requireHumanApprovalAboveUsd" | "maxDailyLossPercent" | "maxPositionPercent" | "maxCryptoTradeNotionalUsd" | "maxCryptoPortfolioPercent" | "cryptoCooldownMinutes" | "maxOptionContracts" | "maxOptionPremiumUsd" | "minOptionDaysToExpiry">, value: string) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      onChange({ ...policy, [key]: parsed });
    }
  }

  function updateList(key: keyof Pick<Policy, "allowedEquitySymbols" | "allowedCryptoPairs" | "allowedOptionUnderlyings" | "blockedSymbols">, value: string) {
    onChange({
      ...policy,
      [key]: value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
    });
  }

  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Execution limits</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="max-trade" label="Max trade" value={policy.maxTradeNotionalUsd} prefix="$" onChange={(value) => updateNumber("maxTradeNotionalUsd", value)} />
          <NumberField id="human-approval" label="Review above" value={policy.requireHumanApprovalAboveUsd} prefix="$" onChange={(value) => updateNumber("requireHumanApprovalAboveUsd", value)} />
          <NumberField id="daily-loss" label="Daily loss stop" value={policy.maxDailyLossPercent} suffix="%" onChange={(value) => updateNumber("maxDailyLossPercent", value)} />
          <NumberField id="position-cap" label="Position cap" value={policy.maxPositionPercent} suffix="%" onChange={(value) => updateNumber("maxPositionPercent", value)} />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Crypto limits</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="crypto-trade" label="Max crypto trade" value={policy.maxCryptoTradeNotionalUsd} prefix="$" onChange={(value) => updateNumber("maxCryptoTradeNotionalUsd", value)} />
          <NumberField id="crypto-exposure" label="Crypto exposure" value={policy.maxCryptoPortfolioPercent} suffix="%" onChange={(value) => updateNumber("maxCryptoPortfolioPercent", value)} />
          <NumberField id="crypto-cooldown" label="Cooldown" value={policy.cryptoCooldownMinutes} suffix="m" onChange={(value) => updateNumber("cryptoCooldownMinutes", value)} />
          <div className="flex min-h-16 items-center rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm">
            <span className="text-muted-foreground">Mode</span>
            <span className="ml-auto font-medium">{policy.paperOnly ? "Paper only" : "Live disabled"}</span>
          </div>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Options readiness</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex min-h-16 items-center rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm">
            <span className="text-muted-foreground">Options</span>
            <button
              type="button"
              onClick={() => onChange({ ...policy, allowOptions: !policy.allowOptions })}
              className={cn(
                "ml-auto inline-flex h-9 items-center rounded-full border px-3 font-mono text-xs uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                policy.allowOptions ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.035] text-muted-foreground"
              )}
            >
              {policy.allowOptions ? "Enabled" : "Disabled"}
            </button>
          </div>
          <NumberField id="option-contract-cap" label="Contract cap" value={policy.maxOptionContracts} onChange={(value) => updateNumber("maxOptionContracts", value)} />
          <NumberField id="option-premium-cap" label="Premium cap" value={policy.maxOptionPremiumUsd} prefix="$" onChange={(value) => updateNumber("maxOptionPremiumUsd", value)} />
          <NumberField id="option-min-expiry" label="Min expiry" value={policy.minOptionDaysToExpiry} suffix="d" onChange={(value) => updateNumber("minOptionDaysToExpiry", value)} />
        </div>
        <TextField id="option-underlyings" label="Option underlyings" value={policy.allowedOptionUnderlyings.join(", ")} onChange={(value) => updateList("allowedOptionUnderlyings", value)} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Allowlists</legend>
        <TextField id="equity-symbols" label="Equities and ETFs" value={policy.allowedEquitySymbols.join(", ")} onChange={(value) => updateList("allowedEquitySymbols", value)} />
        <TextField id="crypto-pairs" label="Crypto pairs" value={policy.allowedCryptoPairs.join(", ")} onChange={(value) => updateList("allowedCryptoPairs", value)} />
      </fieldset>
      <button type="button" onClick={() => onChange(demoPolicy)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-4 font-mono text-xs font-medium uppercase transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Save className="h-4 w-4" aria-hidden="true" />
        Reset policy
      </button>
    </form>
  );
}

function MoneyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label htmlFor="composer-notional" className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">Notional</span>
      <span className="flex h-10 items-center rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <span className="text-muted-foreground">$</span>
        <input id="composer-notional" type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-1 font-mono tabular-nums outline-none" />
      </span>
    </label>
  );
}

function NumberField({ id, label, value, prefix, suffix, onChange }: { id: string; label: string; value: number; prefix?: string; suffix?: string; onChange: (value: string) => void }) {
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <span className="flex h-10 items-center rounded-[14px] border border-white/10 bg-white/[0.035] px-3 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
        <input id={id} type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-1 font-mono tabular-nums outline-none" />
        {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      </span>
    </label>
  );
}

function TextField({ id, label, value, type = "text", autoComplete, onChange }: { id: string; label: string; value: string; type?: "text" | "password"; autoComplete?: string; onChange: (value: string) => void }) {
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input id={id} type={type} value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} spellCheck={false} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-3 font-mono text-sm tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
    </label>
  );
}

function ReceiptItem({ receipt }: { receipt: GuardedExecutionResult }) {
  const isBad = ["blocked", "failed", "rejected", "canceled", "expired"].includes(receipt.status);
  const Icon = isBad ? Ban : receipt.status === "submitted" || receipt.status === "partially_filled" || receipt.status === "filled" ? CheckCircle2 : TrendingUp;

  return (
    <article className="rounded-[14px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045]">
          <Icon className={cn("h-4 w-4", isBad ? "text-destructive" : "text-primary")} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-sm font-semibold tabular-nums">{receipt.intent.symbol}</p>
            <span className="font-mono text-xs uppercase text-muted-foreground">{receipt.status}</span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{receipt.reasons.join(" ")}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono tabular-nums">{formatUsd(receipt.intent.notionalUsd)}</span>
            {receipt.alpacaOrderId ? <span className="font-mono">Order {receipt.alpacaOrderId}</span> : null}
            {receipt.alpacaOrderStatus ? <span className="font-mono">Broker {receipt.alpacaOrderStatus}</span> : null}
            {receipt.filledQty ? <span className="font-mono">Filled {receipt.filledQty}</span> : null}
          </div>
        </div>
      </div>
    </article>
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

function formatAssetClass(assetClass: AssetClass) {
  if (assetClass === "crypto") {
    return "Crypto";
  }

  if (assetClass === "us_option") {
    return "Option";
  }

  return "Equity";
}
