import { appendReceipt } from "@/lib/audit/store";
import { getPaperAccountSummary, getPaperOptionContracts, getPaperPortfolioSnapshot } from "@/lib/alpaca/client";
import { getGuardianAgentConfig, type GuardianAgentConfig } from "@/lib/agent/config";
import { readHistoricalMarketSignals, type HistoricalMarketSignal } from "@/lib/agent/historical-market";
import type { OptionContract } from "@/lib/options/contracts";
import { selectAgentCandidate } from "@/lib/agent/model-provider";
import { getResearchBias, readLatestResearchContext, type AgentResearchContext } from "@/lib/agent/research";
import { readAgentState, writeAgentState, type AgentCandidate, type AgentScanResult } from "@/lib/agent/state";
import { readReceipts } from "@/lib/audit/store";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { reconcileSubmittedReceipts } from "@/lib/trade/reconcile-orders";
import { demoPolicy } from "@/lib/trade/mock-data";
import { executeGuardedTrade } from "@/lib/trade/execute-guarded";
import type { AssetClass, GuardedExecutionResult, PortfolioSnapshot, TradeIntent } from "@/lib/trade/types";

export async function runAgentScan(config: GuardianAgentConfig = getGuardianAgentConfig()): Promise<AgentScanResult> {
  const scanId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (!config.enabled) {
    const skipped = buildScanResult({
      scanId,
      createdAt,
      config,
      status: "skipped",
      candidates: [],
      reasons: ["Agent is disabled. Set GUARDIAN_AGENT_ENABLED=true to run scans."]
    });
    await persistScan(skipped);
    return skipped;
  }

  try {
    const [account, portfolio, state, research, receipts, marketHistory] = await Promise.all([
      getPaperAccountSummary(),
      getPaperPortfolioSnapshot(),
      readAgentState(),
      readLatestResearchContext(),
      readReceipts(),
      readHistoricalMarketSignals(config.universe)
    ]);
    const reconciledReceipts = await reconcileSubmittedReceipts(receipts)
      .then((result) => result.receipts)
      .catch(() => receipts);

    if (account.tradingBlocked || account.accountBlocked || account.tradeSuspendedByUser) {
      const blocked = buildScanResult({
        scanId,
        createdAt,
        config,
        status: "blocked",
        candidates: [],
        reasons: ["Alpaca paper account is blocked or trade-suspended."]
      });
      await persistScan(blocked);
      return blocked;
    }

    const optionContracts = account.optionsTradingLevel && account.optionsTradingLevel > 0
      ? await readAlphaOptionContracts(config.universe, marketHistory)
      : [];
    const candidates = generateTradeCandidates({
      config,
      portfolio,
      lastScan: state.lastScan,
      research,
      marketHistory,
      optionContracts
    });

    if (candidates.length === 0) {
      const skipped = buildScanResult({
        scanId,
        createdAt,
        config,
        status: "skipped",
        candidates,
        research,
        marketHistory,
        reasons: ["No eligible trade candidates passed the agent's pre-policy filters."]
      });
      await persistScan(skipped);
      return skipped;
    }

    const selection = await selectAgentCandidate({ candidates, portfolio, config, research, marketHistory });
    const selected = candidates.find((candidate) => candidate.id === selection.selectedCandidateId) ?? candidates[0];
    const decision = evaluatePolicy({ intent: selected.intent, policy: demoPolicy, portfolio });
    const dailyLimits = evaluateDailyAutonomyLimits(selected.intent.notionalUsd, reconciledReceipts, config, createdAt);
    const canAutoSubmit = config.autoSubmit && selected.intent.notionalUsd <= config.maxAutoNotionalUsd && dailyLimits.approved;

    if (!decision.approved) {
      const receipt = await appendAgentReceipt("blocked", selected.intent, decision.reasons);
      const blocked = buildScanResult({
        scanId,
        createdAt,
        config,
        status: "blocked",
        candidates,
        selection,
        selectedIntent: selected.intent,
        receiptId: receipt.receiptId,
        research,
        marketHistory,
        reasons: decision.reasons
      });
      await persistScan(blocked);
      return blocked;
    }

    if (!canAutoSubmit) {
      const receipt = await appendAgentReceipt("approved", selected.intent, [
        ...decision.reasons,
        config.autoSubmit
          ? `Auto-submit skipped because ${dailyLimits.reason ?? `notional exceeds the $${config.maxAutoNotionalUsd} agent cap`}.`
          : "Agent is running in decision-only mode. No paper order was submitted."
      ]);
      const preview = buildScanResult({
        scanId,
        createdAt,
        config,
        status: "preview",
        candidates,
        selection,
        selectedIntent: selected.intent,
        receiptId: receipt.receiptId,
        research,
        marketHistory,
        reasons: receipt.reasons
      });
      await persistScan(preview);
      return preview;
    }

    const receipt = await executeGuardedTrade({
      intent: selected.intent,
      policy: demoPolicy,
      portfolio,
      humanApproved: true
    });
    const status = receipt.status === "approved" ? "preview" : receipt.status;
    const submitted = buildScanResult({
      scanId,
      createdAt,
      config,
      status,
      candidates,
      selection,
      selectedIntent: selected.intent,
      receiptId: receipt.receiptId,
      research,
      marketHistory,
      reasons: receipt.reasons
    });
    await persistScan(submitted);
    return submitted;
  } catch (error) {
    const failed = buildScanResult({
      scanId,
      createdAt,
      config,
      status: "failed",
      candidates: [],
      reasons: [error instanceof Error ? error.message : "Agent scan failed."]
    });
    await persistScan(failed);
    return failed;
  }
}

export function evaluateDailyAutonomyLimits(
  nextNotionalUsd: number,
  receipts: GuardedExecutionResult[],
  config: Pick<GuardianAgentConfig, "maxDailySubmittedOrders" | "maxDailySubmittedNotionalUsd">,
  nowIso: string
) {
  const today = nowIso.slice(0, 10);
  const submittedToday = receipts.filter((receipt) => (
    isAutonomousExecutionStatus(receipt.status) &&
    receipt.intent.id.startsWith("agent-") &&
    receipt.createdAt.slice(0, 10) === today
  ));
  const submittedNotionalToday = submittedToday.reduce((total, receipt) => total + receipt.intent.notionalUsd, 0);

  if (submittedToday.length >= config.maxDailySubmittedOrders) {
    return {
      approved: false,
      reason: `the daily autonomous order cap of ${config.maxDailySubmittedOrders} has been reached`
    };
  }

  if (submittedNotionalToday + nextNotionalUsd > config.maxDailySubmittedNotionalUsd) {
    return {
      approved: false,
      reason: `the daily autonomous notional cap of $${config.maxDailySubmittedNotionalUsd} would be exceeded`
    };
  }

  return {
    approved: true,
    reason: null
  };
}

function isAutonomousExecutionStatus(status: GuardedExecutionResult["status"]) {
  return ["submitted", "partially_filled", "filled"].includes(status);
}

export function generateTradeCandidates({
  config,
  portfolio,
  lastScan,
  research,
  marketHistory,
  optionContracts
}: {
  config: Pick<GuardianAgentConfig, "universe" | "maxAutoNotionalUsd">;
  portfolio: PortfolioSnapshot;
  lastScan?: AgentScanResult;
  research?: AgentResearchContext;
  marketHistory?: HistoricalMarketSignal[];
  optionContracts?: OptionContract[];
}): AgentCandidate[] {
  const dailyLossPercent = portfolio.equityUsd > 0 ? Math.abs(Math.min(0, portfolio.dailyPnlUsd)) / portfolio.equityUsd * 100 : 0;
  const sellCandidates = config.universe
    .map((symbol, index) => buildSellCandidate(symbol, index, portfolio, lastScan, config.maxAutoNotionalUsd, research, marketHistory))
    .filter((candidate): candidate is AgentCandidate => Boolean(candidate));

  if (dailyLossPercent >= demoPolicy.maxDailyLossPercent) {
    return sellCandidates.sort((a, b) => b.score - a.score);
  }

  const buyCandidates = portfolio.cashUsd / Math.max(portfolio.equityUsd, 1) < 0.1
    ? []
    : config.universe
    .map((symbol, index) => buildBuyCandidate(symbol, index, portfolio, lastScan, config.maxAutoNotionalUsd, research, marketHistory))
    .filter((candidate): candidate is AgentCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score);

  const optionCandidates = portfolio.cashUsd / Math.max(portfolio.equityUsd, 1) < 0.1
    ? []
    : buildOptionCandidates(config.universe, portfolio, lastScan, config.maxAutoNotionalUsd, research, marketHistory, optionContracts ?? []);

  return [...sellCandidates, ...optionCandidates, ...buyCandidates].sort((a, b) => b.score - a.score);
}

async function readAlphaOptionContracts(universe: string[], marketHistory: HistoricalMarketSignal[]) {
  const underlyings = [...new Set(universe
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => !symbol.includes("/") && demoPolicy.allowedOptionUnderlyings.includes(symbol)))];
  const signals = new Map(marketHistory.map((signal) => [signal.symbol, signal]));
  const searches = underlyings.flatMap((underlying) => {
    const signal = signals.get(underlying);
    const score = signal?.score ?? 0;
    const types: Array<"call" | "put"> = score < -0.06 ? ["put"] : score > 0.06 ? ["call"] : ["call", "put"];
    return types.map((type) => getPaperOptionContracts({
      underlying,
      type,
      ...getOptionStrikeBand(type, signal?.latestClose),
      limit: 20
    }));
  });

  const results = await Promise.allSettled(searches);
  return results.flatMap((result) => result.status === "fulfilled" ? result.value.contracts : []);
}

function getOptionStrikeBand(type: "call" | "put", latestClose: number | undefined) {
  if (!latestClose || latestClose <= 0) {
    return {};
  }

  if (type === "call") {
    return {
      strikePriceGte: roundStrike(latestClose * 1.01),
      strikePriceLte: roundStrike(latestClose * 1.1)
    };
  }

  return {
    strikePriceGte: roundStrike(latestClose * 0.9),
    strikePriceLte: roundStrike(latestClose * 0.99)
  };
}

function roundStrike(value: number) {
  return Math.max(1, Math.round(value / 5) * 5);
}

function buildOptionCandidates(
  universe: string[],
  portfolio: PortfolioSnapshot,
  lastScan: AgentScanResult | undefined,
  maxAutoNotionalUsd: number,
  research: AgentResearchContext | undefined,
  marketHistory: HistoricalMarketSignal[] | undefined,
  optionContracts: OptionContract[]
): AgentCandidate[] {
  const allowedUnderlyings = universe
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => !symbol.includes("/") && demoPolicy.allowedOptionUnderlyings.includes(symbol));

  return allowedUnderlyings
    .map((underlying, index) => buildOptionCandidate(underlying, index, portfolio, lastScan, maxAutoNotionalUsd, research, marketHistory, optionContracts))
    .filter((candidate): candidate is AgentCandidate => Boolean(candidate));
}

function buildOptionCandidate(
  underlying: string,
  index: number,
  portfolio: PortfolioSnapshot,
  lastScan: AgentScanResult | undefined,
  maxAutoNotionalUsd: number,
  research: AgentResearchContext | undefined,
  marketHistory: HistoricalMarketSignal[] | undefined,
  optionContracts: OptionContract[]
): AgentCandidate | null {
  const researchBias = getResearchBias(underlying, research);
  const historicalSignal = marketHistory?.find((signal) => signal.symbol === underlying);
  const marketBias = historicalSignal?.score ?? 0;
  const combinedBias = marketBias + researchBias;

  if (Math.abs(combinedBias) < 0.08) {
    return null;
  }

  const type: "call" | "put" = combinedBias >= 0 ? "call" : "put";
  const contract = selectOptionContract(underlying, type, optionContracts);
  if (!contract) {
    return null;
  }

  if (lastScan?.selectedIntent?.symbol === contract.symbol) {
    return null;
  }

  const limitPrice = Math.min(
    contract.closePrice && contract.closePrice > 0 ? contract.closePrice : 3,
    demoPolicy.maxOptionPremiumUsd / 100,
    maxAutoNotionalUsd / 100
  );
  const notionalUsd = Number((limitPrice * 100).toFixed(2));
  if (notionalUsd <= 0 || notionalUsd > demoPolicy.maxOptionPremiumUsd) {
    return null;
  }

  const direction = type === "call" ? "bullish" : "bearish";
  const score = Number((0.7 + Math.abs(combinedBias) + Math.min((contract.openInterest ?? 0) / 10_000, 0.05) - index * 0.015).toFixed(4));
  const intent: TradeIntent = {
    id: `agent-option-${underlying.toLowerCase()}-${type}-${Date.now()}`,
    source: "mock_ai",
    rationale: `${underlying} ${type} option candidate expresses a ${direction} paper view with defined-risk premium capped by Guardian policy.`,
    assetClass: "us_option",
    symbol: contract.symbol,
    side: "buy",
    orderType: "limit",
    timeInForce: "day",
    notionalUsd,
    quantity: 1,
    limitPrice: Number(limitPrice.toFixed(2)),
    clientOrderId: `guardian-agent-option-${underlying.toLowerCase()}-${type}-${Date.now()}`
  };

  return {
    id: `candidate-option-${underlying.toLowerCase()}-${type}`,
    score,
    intent,
    reasons: [
      `Options alpha score ${score}.`,
      `${underlying} combined signal ${combinedBias.toFixed(3)} selected a ${type}.`,
      historicalSignal?.available ? historicalSignal.reason : "No recent historical bar signal applied.",
      `Contract ${contract.symbol}, ${contract.expirationDate}, strike $${contract.strikePrice}.`,
      `Defined-risk premium $${intent.notionalUsd} for 1 contract.`
    ]
  };
}

function selectOptionContract(underlying: string, type: "call" | "put", optionContracts: OptionContract[]) {
  return optionContracts
    .filter((contract) => (
      contract.tradable &&
      contract.underlyingSymbol === underlying &&
      contract.type === type &&
      (contract.closePrice ?? 0) > 0 &&
      (contract.closePrice ?? 0) * 100 <= demoPolicy.maxOptionPremiumUsd
    ))
    .sort((a, b) => {
      const openInterestDelta = (b.openInterest ?? 0) - (a.openInterest ?? 0);
      if (openInterestDelta !== 0) {
        return openInterestDelta;
      }
      return Math.abs(a.closePrice ?? 0) - Math.abs(b.closePrice ?? 0);
    })[0] ?? null;
}

function buildBuyCandidate(
  symbol: string,
  index: number,
  portfolio: PortfolioSnapshot,
  lastScan: AgentScanResult | undefined,
  maxAutoNotionalUsd: number,
  research: AgentResearchContext | undefined,
  marketHistory: HistoricalMarketSignal[] | undefined
): AgentCandidate | null {
  const assetClass = inferAssetClass(symbol);
  if (assetClass === "us_option") {
    return null;
  }

  const currentPositionValue = portfolio.openPositions.find((position) => position.symbol === symbol)?.marketValueUsd ?? 0;
  const currentPositionPercent = Math.abs(currentPositionValue) / Math.max(portfolio.equityUsd, 1) * 100;
  if (currentPositionPercent >= demoPolicy.maxPositionPercent) {
    return null;
  }

  if (lastScan?.selectedIntent?.symbol === symbol) {
    return null;
  }

  const notionalUsd = Math.min(
    maxAutoNotionalUsd,
    assetClass === "crypto" ? demoPolicy.maxCryptoTradeNotionalUsd : demoPolicy.maxTradeNotionalUsd,
    Math.max(1, portfolio.cashUsd * 0.04)
  );
  const momentumScore = stableScore(symbol);
  const researchBias = getResearchBias(symbol, research);
  const historicalSignal = marketHistory?.find((signal) => signal.symbol === symbol);
  const marketBias = historicalSignal?.score ?? 0;
  const exposurePenalty = currentPositionPercent / Math.max(demoPolicy.maxPositionPercent, 1);
  const cryptoPenalty = assetClass === "crypto" ? 0.08 : 0;
  const score = Number((momentumScore + researchBias + marketBias - exposurePenalty - cryptoPenalty - index * 0.015).toFixed(4));

  const intent: TradeIntent = {
    id: `agent-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    source: "mock_ai",
    rationale: `${symbol} passed the agent pre-checks with healthy cash reserve, available position capacity, and a positive rules score.`,
    assetClass,
    symbol,
    side: "buy",
    orderType: "market",
    timeInForce: assetClass === "crypto" ? "gtc" : "day",
    notionalUsd: Number(notionalUsd.toFixed(2)),
    clientOrderId: `guardian-agent-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`
  };

  return {
    id: `candidate-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    score,
    intent,
    reasons: [
      `Rules score ${score}.`,
      researchBias !== 0 ? `Backtest research bias ${researchBias.toFixed(3)}.` : "No backtest bias applied.",
      historicalSignal?.available ? historicalSignal.reason : "No recent historical bar signal applied.",
      `Position exposure ${currentPositionPercent.toFixed(1)}%.`,
      `Proposed paper notional $${intent.notionalUsd}.`
    ]
  };
}

function buildSellCandidate(
  symbol: string,
  index: number,
  portfolio: PortfolioSnapshot,
  lastScan: AgentScanResult | undefined,
  maxAutoNotionalUsd: number,
  research: AgentResearchContext | undefined,
  marketHistory: HistoricalMarketSignal[] | undefined
): AgentCandidate | null {
  const assetClass = inferAssetClass(symbol);
  if (assetClass === "us_option") {
    return null;
  }

  const position = portfolio.openPositions.find((item) => item.symbol === symbol && item.marketValueUsd > 0);
  if (!position) {
    return buildShortCandidate(symbol, index, assetClass, portfolio, lastScan, maxAutoNotionalUsd, research, marketHistory);
  }

  if (lastScan?.selectedIntent?.symbol === symbol) {
    return null;
  }

  const currentPositionPercent = Math.abs(position.marketValueUsd) / Math.max(portfolio.equityUsd, 1) * 100;
  const researchBias = getResearchBias(symbol, research);
  const historicalSignal = marketHistory?.find((signal) => signal.symbol === symbol);
  const marketBias = historicalSignal?.score ?? 0;
  const isOverexposed = currentPositionPercent >= demoPolicy.maxPositionPercent * 0.8;
  const hasWeakRecentHistory = historicalSignal?.available === true && marketBias <= -0.05;
  const hasWeakBacktest = researchBias <= -0.1;

  if (!isOverexposed && !hasWeakRecentHistory && !hasWeakBacktest) {
    return null;
  }

  const notionalUsd = Math.min(
    maxAutoNotionalUsd,
    assetClass === "crypto" ? demoPolicy.maxCryptoTradeNotionalUsd : demoPolicy.maxTradeNotionalUsd,
    Math.max(1, position.marketValueUsd * (isOverexposed ? 0.5 : 0.35))
  );
  const riskReductionScore = currentPositionPercent / Math.max(demoPolicy.maxPositionPercent, 1);
  const weaknessScore = Math.max(0, -marketBias) + Math.max(0, -researchBias);
  const score = Number((0.62 + riskReductionScore + weaknessScore - index * 0.01).toFixed(4));

  const intent: TradeIntent = {
    id: `agent-sell-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    source: "mock_ai",
    rationale: `${symbol} sell candidate reduces an existing paper position because exposure or historical signals weakened. This is not a short sale.`,
    assetClass,
    symbol,
    side: "sell",
    orderType: "market",
    timeInForce: assetClass === "crypto" ? "gtc" : "day",
    notionalUsd: Number(notionalUsd.toFixed(2)),
    clientOrderId: `guardian-agent-sell-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`
  };

  return {
    id: `candidate-sell-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    score,
    intent,
    reasons: [
      `Sell score ${score}.`,
      isOverexposed ? `Position exposure ${currentPositionPercent.toFixed(1)}% is near the ${demoPolicy.maxPositionPercent}% cap.` : `Position exposure ${currentPositionPercent.toFixed(1)}%.`,
      hasWeakBacktest ? `Backtest research bias ${researchBias.toFixed(3)} is negative.` : "No negative backtest exit signal.",
      historicalSignal?.available ? historicalSignal.reason : "No recent historical bar signal applied.",
      `Proposed paper sell notional $${intent.notionalUsd}.`
    ]
  };
}

function buildShortCandidate(
  symbol: string,
  index: number,
  assetClass: AssetClass,
  portfolio: PortfolioSnapshot,
  lastScan: AgentScanResult | undefined,
  maxAutoNotionalUsd: number,
  research: AgentResearchContext | undefined,
  marketHistory: HistoricalMarketSignal[] | undefined
): AgentCandidate | null {
  if (!demoPolicy.allowShortSelling || assetClass !== "us_equity") {
    return null;
  }

  if (lastScan?.selectedIntent?.symbol === symbol) {
    return null;
  }

  const researchBias = getResearchBias(symbol, research);
  const historicalSignal = marketHistory?.find((signal) => signal.symbol === symbol);
  const marketBias = historicalSignal?.score ?? 0;
  const hasWeakRecentHistory = historicalSignal?.available === true && marketBias <= -0.08;
  const hasWeakBacktest = researchBias <= -0.15;

  if (!hasWeakRecentHistory && !hasWeakBacktest) {
    return null;
  }

  const notionalUsd = Math.min(
    maxAutoNotionalUsd,
    demoPolicy.maxTradeNotionalUsd,
    Math.max(1, portfolio.equityUsd * 0.025)
  );
  const score = Number((0.58 + Math.max(0, -marketBias) + Math.max(0, -researchBias) - index * 0.01).toFixed(4));

  const intent: TradeIntent = {
    id: `agent-short-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    source: "mock_ai",
    rationale: `${symbol} short candidate opens a bounded paper short because recent historical or backtest signals are weak.`,
    assetClass,
    symbol,
    side: "sell",
    orderType: "market",
    timeInForce: "day",
    notionalUsd: Number(notionalUsd.toFixed(2)),
    clientOrderId: `guardian-agent-short-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`
  };

  return {
    id: `candidate-short-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    score,
    intent,
    reasons: [
      `Short score ${score}.`,
      hasWeakBacktest ? `Backtest research bias ${researchBias.toFixed(3)} is negative.` : "No negative backtest short signal.",
      historicalSignal?.available ? historicalSignal.reason : "No recent historical bar signal applied.",
      `Proposed bounded paper short notional $${intent.notionalUsd}.`
    ]
  };
}

async function appendAgentReceipt(
  status: GuardedExecutionResult["status"],
  intent: TradeIntent,
  reasons: string[]
) {
  const receipt: GuardedExecutionResult = {
    receiptId: crypto.randomUUID(),
    status,
    intent,
    reasons,
    createdAt: new Date().toISOString()
  };
  await appendReceipt(receipt);
  return receipt;
}

function buildScanResult(input: Omit<AgentScanResult, "enabled" | "autoSubmit"> & { config: GuardianAgentConfig }): AgentScanResult {
  const { config, ...scan } = input;
  return {
    ...scan,
    enabled: config.enabled,
    autoSubmit: config.autoSubmit
  };
}

async function persistScan(scan: AgentScanResult) {
  await writeAgentState({
    running: scan.enabled,
    updatedAt: new Date().toISOString(),
    lastScan: scan
  });
}

function inferAssetClass(symbol: string): AssetClass {
  if (symbol.includes("/")) {
    return "crypto";
  }

  if (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(symbol)) {
    return "us_option";
  }

  return "us_equity";
}

function stableScore(symbol: string) {
  const total = symbol.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return 0.45 + total % 45 / 100;
}
