import { getPaperAccountSummary, getPaperPortfolioSnapshot } from "@/lib/alpaca/client";
import { getGuardianAgentConfig } from "@/lib/agent/config";
import { normalizeRuntimeUniverse, writeAgentRuntimeSettings } from "@/lib/agent/runtime-settings";
import { runAgentScan } from "@/lib/agent/alpha-agent";
import { readAgentState, type AgentScanResult } from "@/lib/agent/state";
import { summarizeAgentPerformance } from "@/lib/agent/performance";
import { readLatestResearchContext, type AgentResearchContext } from "@/lib/agent/research";
import { readReceipts } from "@/lib/audit/store";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { defaultPolicy } from "@/lib/policy/types";
import { executeGuardedTrade } from "@/lib/trade/execute-guarded";
import { reconcileSubmittedReceipts } from "@/lib/trade/reconcile-orders";
import type { AssetClass, TradeIntent } from "@/lib/trade/types";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
};

type TelegramResponse<T> = {
  ok: boolean;
  result: T;
  description?: string;
};

type PendingPreview = {
  intent: TradeIntent;
  createdAt: string;
};

const pendingPreviews = new Map<string, PendingPreview>();
const PublicDemoCommands = new Set(["/start", "/help", "/agent", "/scan", "/why", "/performance", "/brief", "/research", "/receipts"]);

export async function runGuardianTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  }

  const allowedChatIds = getAllowedChatIds();
  const publicDemoMode = isPublicDemoMode();

  let offset = 0;
  console.log("Guardian Telegram bot running in paper-only mode.");

  for (;;) {
    try {
      const updates = await getUpdates(token, offset);

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(token, update, allowedChatIds, publicDemoMode);
      }
    } catch (error) {
      console.error("Telegram polling error:", error instanceof Error ? error.message : error);
      await wait(2_500);
    }
  }
}

async function handleUpdate(token: string, update: TelegramUpdate, allowedChatIds: Set<number>, publicDemoMode: boolean) {
  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim();

  if (!chatId || !text) {
    return;
  }

  const isOperator = allowedChatIds.has(chatId);
  const command = text.split(/\s+/)[0] ?? text;
  const canUsePublicDemo = publicDemoMode && PublicDemoCommands.has(command);

  if (!isOperator && !canUsePublicDemo) {
    await sendMessage(token, chatId, [
      "Unauthorized chat.",
      "",
      `Your chat ID is ${chatId}. Add it to TELEGRAM_ALLOWED_CHAT_IDS on the server to enable operator access.`,
      publicDemoMode ? "" : null,
      publicDemoMode ? "Public demo commands are unavailable for this command." : null
    ].filter(Boolean).join("\n"));
    return;
  }

  try {
    if (text === "/start" || text === "/help") {
      await sendMessage(token, chatId, helpText({ publicDemoMode, isOperator }));
      return;
    }

    if (text === "/account") {
      const account = await getPaperAccountSummary();
      await sendMessage(token, chatId, [
        "PAPER ACCOUNT",
        `Mode: ${account.mode === "alpaca" ? "Connected" : "Mock"}`,
        `Status: ${account.status}`,
        `Equity: ${formatUsd(account.equityUsd)}`,
        `Cash: ${formatUsd(account.cashUsd)}`,
        `Buying power: ${formatUsd(account.buyingPowerUsd)}`,
        `Crypto: ${account.cryptoStatus ?? "unknown"}`
      ].join("\n"));
      return;
    }

    if (text === "/portfolio") {
      const portfolio = await getPaperPortfolioSnapshot();
      await sendMessage(token, chatId, formatPortfolio(portfolio));
      return;
    }

    if (text === "/policy") {
      await sendMessage(token, chatId, [
        "GUARDIAN POLICY",
        `Paper only: ${defaultPolicy.paperOnly ? "yes" : "no"}`,
        `Max trade: ${formatUsd(defaultPolicy.maxTradeNotionalUsd)}`,
        `Human review above: ${formatUsd(defaultPolicy.requireHumanApprovalAboveUsd)}`,
        `Daily loss stop: ${defaultPolicy.maxDailyLossPercent}%`,
        `Position cap: ${defaultPolicy.maxPositionPercent}%`,
        `Crypto trade cap: ${formatUsd(defaultPolicy.maxCryptoTradeNotionalUsd)}`,
        `Crypto exposure cap: ${defaultPolicy.maxCryptoPortfolioPercent}%`,
        `Options: ${defaultPolicy.allowOptions ? "enabled" : "disabled"}`,
        `Option premium cap: ${formatUsd(defaultPolicy.maxOptionPremiumUsd)}`,
        `Option contract cap: ${defaultPolicy.maxOptionContracts}`,
        `Option min expiry: ${defaultPolicy.minOptionDaysToExpiry} days`,
        `Equities: ${defaultPolicy.allowedEquitySymbols.join(", ")}`,
        `Crypto: ${defaultPolicy.allowedCryptoPairs.join(", ")}`,
        `Option underlyings: ${defaultPolicy.allowedOptionUnderlyings.join(", ")}`,
        "Blocked: naked option sells, crypto shorts, live trading"
      ].join("\n"));
      return;
    }

    if (text === "/risk") {
      const portfolio = await getPaperPortfolioSnapshot();
      await sendMessage(token, chatId, formatRisk(portfolio));
      return;
    }

    if (text === "/receipts") {
      const receipts = await reconcileSubmittedReceipts()
        .then((result) => result.receipts.slice(0, 5))
        .catch(async () => (await readReceipts()).slice(0, 5));
      await sendMessage(token, chatId, formatReceipts(receipts));
      return;
    }

    if (text === "/agent") {
      const [state, config] = await Promise.all([
        readAgentState(),
        Promise.resolve(getGuardianAgentConfig())
      ]);
      await sendMessage(token, chatId, [
        "GUARDIAN ALPHA AGENT",
        `Enabled: ${config.enabled ? "yes" : "no"}`,
        `Auto-submit: ${config.autoSubmit ? "yes" : "no"}`,
        `Max auto notional: ${formatUsd(config.maxAutoNotionalUsd)}`,
        `Interval: ${config.intervalSeconds}s`,
        `Reasoning: ${config.modelProvider}`,
        state.lastScan ? `Last scan: ${state.lastScan.status.toUpperCase()} ${state.lastScan.selectedIntent?.symbol ?? "no trade"}` : "Last scan: none",
        state.lastScan?.selection ? `Reason: ${state.lastScan.selection.reason}` : null,
        "",
        disclosure()
      ].filter(Boolean).join("\n"));
      return;
    }

    if (text === "/scan") {
      const config = getGuardianAgentConfig();
      const scan = await runAgentScan(isOperator ? config : { ...config, autoSubmit: false });
      await sendMessage(token, chatId, [
        "AGENT SCAN",
        `Status: ${scan.status.toUpperCase()}`,
        `Auto-submit: ${scan.autoSubmit ? "yes" : "no"}`,
        `Candidates: ${scan.candidates.length}`,
        scan.selectedIntent ? `Selected: ${scan.selectedIntent.symbol} ${scan.selectedIntent.side.toUpperCase()} ${formatUsd(scan.selectedIntent.notionalUsd)}` : "Selected: none",
        scan.selection ? `Reasoning: ${scan.selection.provider} ${Math.round(scan.selection.confidence * 100)}%` : null,
        scan.selection ? `Reason: ${scan.selection.reason}` : null,
        ...scan.reasons.slice(0, 3).map((reason) => `- ${reason}`),
        "",
        disclosure()
      ].filter(Boolean).join("\n"));
      return;
    }

    if (text === "/why") {
      const state = await readAgentState();
      await sendMessage(token, chatId, formatLatestAgentReason(state.lastScan));
      return;
    }

    if (text === "/performance") {
      const [receipts, portfolio] = await Promise.all([
        readReceipts(),
        getPaperPortfolioSnapshot()
      ]);
      await sendMessage(token, chatId, formatPerformance(receipts, portfolio));
      return;
    }

    if (text === "/brief") {
      const [receipts, portfolio, state, research] = await Promise.all([
        readReceipts(),
        getPaperPortfolioSnapshot(),
        readAgentState(),
        readLatestResearchContext()
      ]);
      await sendMessage(token, chatId, formatCompetitionBrief(receipts, portfolio, state.lastScan, research));
      return;
    }

    if (text === "/research") {
      await sendMessage(token, chatId, formatResearch(await readLatestResearchContext()));
      return;
    }

    if (text === "/settings") {
      assertOperatorCommand(isOperator);
      await sendMessage(token, chatId, formatAgentSettings(getGuardianAgentConfig()));
      return;
    }

    if (text === "/pause") {
      assertOperatorCommand(isOperator);
      await writeAgentRuntimeSettings({ enabled: false });
      await sendMessage(token, chatId, "Agent paused. The worker will stay online but future scans will skip until /resume.");
      return;
    }

    if (text === "/resume") {
      assertOperatorCommand(isOperator);
      await writeAgentRuntimeSettings({ enabled: true });
      await sendMessage(token, chatId, "Agent resumed. The worker will use the current strategy settings on the next scan.");
      return;
    }

    if (text.startsWith("/autosubmit ")) {
      assertOperatorCommand(isOperator);
      const value = parseOnOff(text.replace("/autosubmit", "").trim());
      await writeAgentRuntimeSettings({ autoSubmit: value });
      await sendMessage(token, chatId, `Auto-submit ${value ? "enabled" : "disabled"}.`);
      return;
    }

    if (text.startsWith("/setcap ")) {
      assertOperatorCommand(isOperator);
      const value = parseBoundedNumber(text.replace("/setcap", "").trim(), 1, 10_000, "cap");
      await writeAgentRuntimeSettings({ maxAutoNotionalUsd: value });
      await sendMessage(token, chatId, `Max autonomous order notional set to ${formatUsd(value)}.`);
      return;
    }

    if (text.startsWith("/setdailyorders ")) {
      assertOperatorCommand(isOperator);
      const value = Math.floor(parseBoundedNumber(text.replace("/setdailyorders", "").trim(), 1, 25, "daily order cap"));
      await writeAgentRuntimeSettings({ maxDailySubmittedOrders: value });
      await sendMessage(token, chatId, `Daily autonomous submitted-order cap set to ${value}.`);
      return;
    }

    if (text.startsWith("/setdailynotional ")) {
      assertOperatorCommand(isOperator);
      const value = parseBoundedNumber(text.replace("/setdailynotional", "").trim(), 1, 75_000, "daily notional cap");
      await writeAgentRuntimeSettings({ maxDailySubmittedNotionalUsd: value });
      await sendMessage(token, chatId, `Daily autonomous notional cap set to ${formatUsd(value)}.`);
      return;
    }

    if (text.startsWith("/setinterval ")) {
      assertOperatorCommand(isOperator);
      const value = Math.floor(parseBoundedNumber(text.replace("/setinterval", "").trim(), 60, 3600, "scan interval"));
      await writeAgentRuntimeSettings({ intervalSeconds: value });
      await sendMessage(token, chatId, `Scan interval set to ${value} seconds.`);
      return;
    }

    if (text.startsWith("/setuniverse ")) {
      assertOperatorCommand(isOperator);
      const symbols = normalizeRuntimeUniverse(text.replace("/setuniverse", "").trim().split(/[\s,]+/));
      if (symbols.length === 0) {
        throw new Error("Use: /setuniverse SPY QQQ AAPL MSFT NVDA BTC/USD ETH/USD SOL/USD");
      }
      await writeAgentRuntimeSettings({ universe: symbols });
      await sendMessage(token, chatId, `Universe set to: ${symbols.join(", ")}`);
      return;
    }

    if (text.startsWith("/setmodel ")) {
      assertOperatorCommand(isOperator);
      const [, provider, ...modelParts] = text.split(/\s+/);
      if (!provider || !["none", "groq", "featherless", "ensemble"].includes(provider)) {
        throw new Error("Use: /setmodel groq|featherless|ensemble|none [model_name]");
      }
      const modelName = modelParts.join(" ").trim();
      await writeAgentRuntimeSettings({
        modelProvider: provider as "none" | "groq" | "featherless" | "ensemble",
        ...(modelName ? { modelName } : {})
      });
      await sendMessage(token, chatId, `Reasoning set to ${provider}${modelName ? ` with ${modelName}` : ""}.`);
      return;
    }

    if (text.startsWith("/cancel ")) {
      const previewId = text.replace("/cancel", "").trim();

      if (!pendingPreviews.delete(previewId)) {
        await sendMessage(token, chatId, "No pending preview found for that ID.");
        return;
      }

      await sendMessage(token, chatId, `Canceled preview ${previewId}. No paper order was submitted.`);
      return;
    }

    if (text.startsWith("/preview ")) {
      const intent = parsePreviewCommand(text);
      const portfolio = await getPaperPortfolioSnapshot();
      const decision = evaluatePolicy({ intent, policy: defaultPolicy, portfolio });
      pendingPreviews.set(intent.clientOrderId, { intent, createdAt: new Date().toISOString() });

      await sendMessage(token, chatId, [
        "ORDER PREVIEW - PAPER ONLY",
        `Preview ID: ${intent.clientOrderId}`,
        `Symbol: ${intent.symbol}`,
        `Asset: ${intent.assetClass === "crypto" ? "Crypto" : "US equity / ETF"}`,
        `Side: ${intent.side.toUpperCase()}`,
        `Type: ${intent.orderType}`,
        `TIF: ${intent.timeInForce}`,
        `Notional: ${formatUsd(intent.notionalUsd)}`,
        "",
        `Policy: ${decision.approved ? "APPROVED" : "BLOCKED"}`,
        `Human approval: ${decision.requiresHumanApproval ? "required" : "still required by Telegram"}`,
        ...decision.reasons.map((reason) => `- ${reason}`),
        "",
        decision.approved
          ? `Reply /confirm ${intent.clientOrderId} to submit this paper order.`
          : "This order cannot be submitted until the policy issue is fixed.",
        `Reply /cancel ${intent.clientOrderId} to discard this preview.`,
        "",
        disclosure()
      ].join("\n"));
      return;
    }

    if (text.startsWith("/confirm ")) {
      const previewId = text.replace("/confirm", "").trim();
      const pending = pendingPreviews.get(previewId);

      if (!pending) {
        await sendMessage(token, chatId, "No pending preview found for that ID. Run /preview first.");
        return;
      }

      const portfolio = await getPaperPortfolioSnapshot();
      const receipt = await executeGuardedTrade({
        intent: pending.intent,
        policy: defaultPolicy,
        portfolio,
        humanApproved: true
      });

      pendingPreviews.delete(previewId);
      await sendMessage(token, chatId, [
        `Receipt: ${receipt.status.toUpperCase()}`,
        `Symbol: ${receipt.intent.symbol}`,
        `Side: ${receipt.intent.side.toUpperCase()}`,
        `Notional: ${formatUsd(receipt.intent.notionalUsd)}`,
        receipt.alpacaOrderId ? `Alpaca order: ${receipt.alpacaOrderId}` : null,
        ...receipt.reasons.map((reason) => `- ${reason}`),
        "",
        disclosure()
      ].filter(Boolean).join("\n"));
      return;
    }

    await sendMessage(token, chatId, `Unknown command.\n\n${helpText({ publicDemoMode, isOperator })}`);
  } catch (error) {
    await sendMessage(token, chatId, error instanceof Error ? error.message : "Guardian could not complete that request.");
  }
}

function parsePreviewCommand(text: string): TradeIntent {
  const [, sideInput, symbolInput, notionalInput] = text.split(/\s+/);
  const side = sideInput?.toLowerCase();
  const notionalUsd = Number(notionalInput);

  if (side !== "buy" && side !== "sell") {
    throw new Error("Use: /preview buy|sell SYMBOL AMOUNT. Example: /preview buy SOL/USD 50");
  }

  if (!symbolInput || !Number.isFinite(notionalUsd) || notionalUsd <= 0) {
    throw new Error("Use: /preview buy|sell SYMBOL AMOUNT. Example: /preview buy SOL/USD 50");
  }

  const symbol = normalizeSymbol(symbolInput);
  const assetClass: AssetClass = symbol.includes("/") ? "crypto" : "us_equity";

  return {
    id: `telegram-${Date.now()}`,
    source: "mcp",
    rationale: "Telegram user requested a guarded Alpaca paper-trading preview.",
    assetClass,
    symbol,
    side,
    orderType: "market",
    timeInForce: assetClass === "crypto" ? "gtc" : "day",
    notionalUsd,
    clientOrderId: `guardian-tg-${Date.now()}`
  };
}

async function getUpdates(token: string, offset: number) {
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set("timeout", "25");
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url);
  const data = await response.json() as TelegramResponse<TelegramUpdate[]>;

  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram getUpdates failed with ${response.status}`);
  }

  return data.result;
}

async function sendMessage(token: string, chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Telegram sendMessage failed with ${response.status}`);
  }
}

function formatPortfolio(portfolio: Awaited<ReturnType<typeof getPaperPortfolioSnapshot>>) {
  const positions = portfolio.openPositions.length > 0
    ? portfolio.openPositions
      .slice(0, 8)
      .map((position) => `- ${position.symbol}: ${formatUsd(position.marketValueUsd)} (${position.assetClass})`)
    : ["- No open positions"];

  return [
    "PORTFOLIO SNAPSHOT",
    `Equity: ${formatUsd(portfolio.equityUsd)}`,
    `Cash: ${formatUsd(portfolio.cashUsd)}`,
    `Daily PnL: ${formatUsd(portfolio.dailyPnlUsd)}`,
    `Crypto value: ${formatUsd(portfolio.cryptoMarketValueUsd)}`,
    "",
    "Positions:",
    ...positions,
    "",
    disclosure()
  ].join("\n");
}

function formatRisk(portfolio: Awaited<ReturnType<typeof getPaperPortfolioSnapshot>>) {
  const largestPosition = portfolio.openPositions
    .slice()
    .sort((a, b) => Math.abs(b.marketValueUsd) - Math.abs(a.marketValueUsd))[0];
  const largestPositionPercent = largestPosition && portfolio.equityUsd > 0
    ? Math.abs(largestPosition.marketValueUsd) / portfolio.equityUsd * 100
    : 0;
  const cryptoPercent = portfolio.equityUsd > 0
    ? portfolio.cryptoMarketValueUsd / portfolio.equityUsd * 100
    : 0;
  const dailyLossPercent = portfolio.equityUsd > 0
    ? Math.abs(Math.min(0, portfolio.dailyPnlUsd)) / portfolio.equityUsd * 100
    : 0;

  return [
    "RISK SUMMARY",
    `Equity: ${formatUsd(portfolio.equityUsd)}`,
    `Daily PnL: ${formatUsd(portfolio.dailyPnlUsd)} (${formatPercent(dailyLossPercent)} loss used)`,
    `Crypto exposure: ${formatUsd(portfolio.cryptoMarketValueUsd)} (${formatPercent(cryptoPercent)})`,
    largestPosition
      ? `Largest position: ${largestPosition.symbol} ${formatUsd(Math.abs(largestPosition.marketValueUsd))} (${formatPercent(largestPositionPercent)})`
      : "Largest position: none",
    `Policy max position: ${defaultPolicy.maxPositionPercent}%`,
    `Policy max crypto: ${defaultPolicy.maxCryptoPortfolioPercent}%`,
    `Policy daily loss stop: ${defaultPolicy.maxDailyLossPercent}%`,
    "",
    disclosure()
  ].join("\n");
}

function formatReceipts(receipts: Awaited<ReturnType<typeof readReceipts>>) {
  if (receipts.length === 0) {
    return "No audit receipts yet.";
  }

  return [
    "LATEST RECEIPTS",
    ...receipts.map((receipt) => [
      `${receipt.status.toUpperCase()} ${receipt.intent.symbol} ${receipt.intent.side.toUpperCase()} ${formatUsd(receipt.intent.notionalUsd)}`,
      `- ${receipt.createdAt}`,
      ...receipt.reasons.slice(0, 2).map((reason) => `- ${reason}`),
      receipt.alpacaOrderStatus ? `- Broker: ${receipt.alpacaOrderStatus}${receipt.filledQty ? `, filled ${receipt.filledQty}` : ""}` : null
    ].filter(Boolean).join("\n")),
    "",
    disclosure()
  ].join("\n\n");
}

function formatLatestAgentReason(scan: AgentScanResult | undefined) {
  if (!scan) {
    return [
      "No agent scan yet.",
      "Run /scan to create the first decision.",
      "",
      disclosure()
    ].join("\n");
  }

  const candidates = scan.candidates.slice(0, 5).map((candidate) => (
    `- ${candidate.intent.symbol}: score ${candidate.score} (${candidate.reasons.join(" ")})`
  ));

  return [
    "LATEST AGENT REASON",
    `Status: ${scan.status.toUpperCase()}`,
    scan.selectedIntent ? `Selected: ${scan.selectedIntent.symbol} ${scan.selectedIntent.side.toUpperCase()} ${formatUsd(scan.selectedIntent.notionalUsd)}` : "Selected: none",
    scan.selection ? `Reasoning: ${scan.selection.provider} ${Math.round(scan.selection.confidence * 100)}%` : null,
    scan.selection ? `Reason: ${scan.selection.reason}` : null,
    scan.selection?.fallbackReason ? `Fallback: ${scan.selection.fallbackReason}` : null,
    "",
    "Candidates:",
    ...(candidates.length > 0 ? candidates : ["- none"]),
    "",
    disclosure()
  ].filter(Boolean).join("\n");
}

function formatPerformance(receipts: Awaited<ReturnType<typeof readReceipts>>, portfolio: Awaited<ReturnType<typeof getPaperPortfolioSnapshot>>) {
  const summary = summarizeAgentPerformance(receipts, portfolio);

  return [
    "AGENT PERFORMANCE",
    `Daily PnL: ${formatUsd(summary.dailyPnlUsd)} (${formatPercent(summary.dailyPnlPercent)})`,
    `Decisions: ${summary.totalDecisions}`,
    `Submitted: ${summary.submittedCount}`,
    `Blocked: ${summary.blockedCount}`,
    `Approval rate: ${formatPercent(summary.approvalRate)}`,
    `Submitted notional: ${formatUsd(summary.submittedNotionalUsd)}`,
    `Blocked notional: ${formatUsd(summary.blockedNotionalUsd)}`,
    `Cash reserve: ${formatPercent(summary.cashPercent)}`,
    "",
    disclosure()
  ].join("\n");
}

function formatCompetitionBrief(
  receipts: Awaited<ReturnType<typeof readReceipts>>,
  portfolio: Awaited<ReturnType<typeof getPaperPortfolioSnapshot>>,
  scan: AgentScanResult | undefined,
  research: AgentResearchContext
) {
  const summary = summarizeAgentPerformance(receipts, portfolio);

  return [
    "GUARDIAN JUDGE BRIEF",
    `Score: ${summary.competitionScore}/100 (${summary.competitionGrade.replace("_", " ")})`,
    `Daily PnL: ${formatUsd(summary.dailyPnlUsd)} (${formatPercent(summary.dailyPnlPercent)})`,
    `Decisions: ${summary.totalDecisions} total, ${summary.submittedCount} submitted, ${summary.blockedCount} blocked`,
    `Research: ${research.available ? `${research.symbols.length} backtest signals active` : "no backtest loaded"}`,
    scan?.selectedIntent ? `Latest: ${scan.status.toUpperCase()} ${scan.selectedIntent.symbol} ${scan.selectedIntent.side.toUpperCase()} ${formatUsd(scan.selectedIntent.notionalUsd)}` : "Latest: no agent scan yet",
    scan?.selection ? `Why: ${scan.selection.reason}` : null,
    "",
    ...summary.competitionBrief.map((line) => `- ${line}`),
    "",
    disclosure()
  ].filter(Boolean).join("\n");
}

function formatResearch(research: AgentResearchContext) {
  if (!research.available) {
    return [
      "RESEARCH CONTEXT",
      "No backtest summary is loaded yet.",
      "Add a run artifact at runs/<run-name>/summary.json, then run /scan again.",
      "",
      research.disclosure
    ].join("\n");
  }

  return [
    "RESEARCH CONTEXT",
    `Strategy: ${research.strategyName ?? "Latest backtest"}`,
    research.generatedAt ? `Generated: ${research.generatedAt}` : null,
    `Symbols: ${research.symbols.length}`,
    "",
    ...research.symbols.slice(0, 5).map((symbol) => [
      `${symbol.symbol}: score ${symbol.score}`,
      symbol.totalReturnPercent !== undefined ? `return ${formatPercent(symbol.totalReturnPercent)}` : null,
      symbol.maxDrawdownPercent !== undefined ? `drawdown ${formatPercent(symbol.maxDrawdownPercent)}` : null,
      symbol.winRatePercent !== undefined ? `win ${formatPercent(symbol.winRatePercent)}` : null
    ].filter(Boolean).join(" | ")),
    "",
    research.disclosure
  ].filter(Boolean).join("\n");
}

function formatAgentSettings(config: ReturnType<typeof getGuardianAgentConfig>) {
  return [
    "AGENT SETTINGS",
    `Enabled: ${config.enabled ? "yes" : "no"}`,
    `Auto-submit: ${config.autoSubmit ? "yes" : "no"}`,
    `Max order: ${formatUsd(config.maxAutoNotionalUsd)}`,
    `Daily orders: ${config.maxDailySubmittedOrders}`,
    `Daily notional: ${formatUsd(config.maxDailySubmittedNotionalUsd)}`,
    `Interval: ${config.intervalSeconds}s`,
    `Reasoning: ${config.modelProvider}`,
    `Universe: ${config.universe.join(", ")}`,
    "Options alpha: enabled for defined-risk long calls and puts up to the policy premium cap.",
    "Sell mode: existing equity and spot crypto exits plus bounded US equity shorts; no crypto or options shorts.",
    "",
    "Operator commands:",
    "/pause",
    "/resume",
    "/autosubmit on|off",
    "/setcap 5000",
    "/setdailyorders 8",
    "/setdailynotional 25000",
    "/setinterval 300",
    "/setmodel ensemble",
    "/setuniverse SPY QQQ AAPL MSFT NVDA BTC/USD ETH/USD SOL/USD"
  ].join("\n");
}

function assertOperatorCommand(isOperator: boolean) {
  if (!isOperator) {
    throw new Error("This command is operator-only.");
  }
}

function parseOnOff(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "yes", "1"].includes(normalized)) {
    return true;
  }

  if (["off", "false", "no", "0"].includes(normalized)) {
    return false;
  }

  throw new Error("Use on or off.");
}

function parseBoundedNumber(value: string, min: number, max: number, label: string) {
  const parsed = Number(value.replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${label}. Use a number from ${min} to ${max}.`);
  }

  return parsed;
}

function normalizeSymbol(value: string) {
  const symbol = value.trim().toUpperCase().replace("-", "/");

  if (["BTC", "ETH", "SOL"].includes(symbol)) {
    return `${symbol}/USD`;
  }

  if (!symbol.includes("/") && symbol.endsWith("USD") && symbol.length > 3) {
    return `${symbol.slice(0, -3)}/USD`;
  }

  return symbol;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function helpText({ publicDemoMode, isOperator }: { publicDemoMode: boolean; isOperator: boolean }) {
  return [
    "Guardian Telegram - Alpaca paper trading only",
    publicDemoMode && !isOperator ? "Public demo mode: scans are decision-only and confirmations are restricted." : null,
    "",
    "Commands:",
    "/start - show help",
    "/agent - show autonomous agent status",
    "/scan - run one guarded agent scan",
    "/why - explain the latest agent decision",
    "/performance - show paper performance metrics",
    "/brief - show the judge-ready P&L and creativity summary",
    "/research - show latest backtest context",
    "/receipts - show latest audit receipts",
    isOperator ? "/account - show paper account" : null,
    isOperator ? "/portfolio - show current positions" : null,
    isOperator ? "/policy - show deterministic limits" : null,
    isOperator ? "/risk - show current risk summary" : null,
    isOperator ? "/settings - show operator strategy controls" : null,
    isOperator ? "/pause or /resume - stop or start autonomous scans" : null,
    isOperator ? "/autosubmit on|off - toggle autonomous paper execution" : null,
    isOperator ? "/setcap 5000 - change max autonomous order size" : null,
    isOperator ? "/setdailyorders 8 - change daily order limit" : null,
    isOperator ? "/setdailynotional 25000 - change daily notional limit" : null,
    isOperator ? "/setinterval 300 - change scan interval" : null,
    isOperator ? "/setmodel ensemble - use Groq plus Featherless reasoning" : null,
    isOperator ? "/setuniverse SPY QQQ AAPL MSFT NVDA BTC/USD ETH/USD SOL/USD - change symbols" : null,
    isOperator ? "/preview buy SOL/USD 50 - preview a paper trade" : null,
    isOperator ? "/confirm PREVIEW_ID - submit after preview" : null,
    isOperator ? "/cancel PREVIEW_ID - discard a preview" : null,
    "",
    isOperator ? "Operator mode: confirmations are enabled after preview." : "Trading confirmations are operator-only."
  ].filter(Boolean).join("\n");
}

function isPublicDemoMode() {
  const value = process.env.TELEGRAM_PUBLIC_DEMO_MODE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function getAllowedChatIds() {
  const rawValue = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim();

  if (!rawValue) {
    console.warn("TELEGRAM_ALLOWED_CHAT_IDS is missing. The bot will only reply with setup instructions until it is configured.");
    return new Set<number>();
  }

  const chatIds = rawValue
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isSafeInteger(item));

  if (chatIds.length === 0) {
    throw new Error("TELEGRAM_ALLOWED_CHAT_IDS must contain at least one numeric Telegram chat ID.");
  }

  return new Set(chatIds);
}

function disclosure() {
  return "Educational paper-trading demo only. Not investment advice.";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
