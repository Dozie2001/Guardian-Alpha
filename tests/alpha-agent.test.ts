import { describe, expect, it } from "vitest";
import { evaluateDailyAutonomyLimits, generateTradeCandidates } from "@/lib/agent/alpha-agent";
import type { GuardedExecutionResult, PortfolioSnapshot } from "@/lib/trade/types";

const portfolio: PortfolioSnapshot = {
  equityUsd: 10_000,
  cashUsd: 5_000,
  dailyPnlUsd: 20,
  cryptoMarketValueUsd: 0,
  openPositions: [
    { symbol: "SPY", assetClass: "us_equity", marketValueUsd: 3_100 }
  ]
};

describe("generateTradeCandidates", () => {
  it("creates small paper trade candidates from the configured universe", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["QQQ", "AAPL", "SOL/USD"],
        maxAutoNotionalUsd: 25
      },
      portfolio
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].intent.notionalUsd).toBeLessThanOrEqual(25);
    expect(candidates.map((candidate) => candidate.intent.symbol)).toContain("SOL/USD");
  });

  it("applies backtest research bias to candidate scores", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["QQQ", "AAPL"],
        maxAutoNotionalUsd: 25
      },
      portfolio,
      research: {
        available: true,
        disclosure: "Backtest disclosure.",
        symbols: [
          { symbol: "AAPL", score: 0.4 },
          { symbol: "QQQ", score: -0.2 }
        ]
      }
    });

    expect(candidates[0].intent.symbol).toBe("AAPL");
    expect(candidates[0].reasons).toContain("Backtest research bias 0.400.");
  });

  it("creates sell candidates for overexposed existing positions and skips just-traded symbols", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["SPY", "QQQ"],
        maxAutoNotionalUsd: 25
      },
      portfolio,
      lastScan: {
        scanId: "scan-1",
        createdAt: "2026-08-26T20:00:00.000Z",
        enabled: true,
        autoSubmit: false,
        status: "preview",
        candidates: [],
        selectedIntent: {
          id: "intent-qqq",
          source: "mock_ai",
          rationale: "Previously selected candidate.",
          assetClass: "us_equity",
          symbol: "QQQ",
          side: "buy",
          orderType: "market",
          timeInForce: "day",
          notionalUsd: 25,
          clientOrderId: "client-qqq"
        },
        reasons: []
      }
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].intent.symbol).toBe("SPY");
    expect(candidates[0].intent.side).toBe("sell");
    expect(candidates[0].intent.notionalUsd).toBeLessThanOrEqual(portfolio.openPositions[0].marketValueUsd);
  });

  it("stops generating buy candidates after the daily loss guard is reached", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["QQQ", "AAPL"],
        maxAutoNotionalUsd: 25
      },
      portfolio: {
        ...portfolio,
        dailyPnlUsd: -550
      }
    });

    expect(candidates).toHaveLength(0);
  });

  it("still allows risk-reducing sell candidates after the daily loss guard is reached", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["SPY"],
        maxAutoNotionalUsd: 1_000
      },
      portfolio: {
        ...portfolio,
        dailyPnlUsd: -550
      }
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].intent.side).toBe("sell");
  });

  it("creates sell candidates for weak recent historical signals", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["MSFT"],
        maxAutoNotionalUsd: 1_000
      },
      portfolio: {
        ...portfolio,
        openPositions: [
          { symbol: "MSFT", assetClass: "us_equity", marketValueUsd: 1_200 }
        ]
      },
      marketHistory: [
        {
          symbol: "MSFT",
          available: true,
          lookbackDays: 12,
          score: -0.12,
          momentumPercent: -4,
          volatilityPercent: 1.2,
          reason: "MSFT 12-bar signal: -4.00% momentum, 1.20% daily volatility."
        }
      ]
    });

    expect(candidates.some((candidate) => candidate.intent.symbol === "MSFT" && candidate.intent.side === "sell")).toBe(true);
  });

  it("creates bounded short candidates for weak equities without an existing position", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["AAPL"],
        maxAutoNotionalUsd: 1_000
      },
      portfolio: {
        ...portfolio,
        openPositions: []
      },
      marketHistory: [
        {
          symbol: "AAPL",
          available: true,
          lookbackDays: 12,
          score: -0.1,
          momentumPercent: -6,
          volatilityPercent: 1.4,
          reason: "AAPL 12-bar signal: -6.00% momentum, 1.40% daily volatility."
        }
      ]
    });

    const shortCandidate = candidates.find((candidate) => candidate.intent.symbol === "AAPL" && candidate.intent.side === "sell");
    expect(shortCandidate).toBeDefined();
    expect(shortCandidate?.intent.rationale).toContain("short");
  });

  it("does not create short candidates for crypto", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["SOL/USD"],
        maxAutoNotionalUsd: 1_000
      },
      portfolio: {
        ...portfolio,
        openPositions: []
      },
      marketHistory: [
        {
          symbol: "SOL/USD",
          available: true,
          lookbackDays: 12,
          score: -0.2,
          reason: "Weak crypto signal."
        }
      ]
    });

    expect(candidates.every((candidate) => candidate.intent.side !== "sell")).toBe(true);
  });

  it("creates crypto sell candidates only for existing weak spot positions", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["SOL/USD"],
        maxAutoNotionalUsd: 1_000
      },
      portfolio: {
        ...portfolio,
        cryptoMarketValueUsd: 900,
        openPositions: [
          { symbol: "SOL/USD", assetClass: "crypto", marketValueUsd: 900 }
        ]
      },
      marketHistory: [
        {
          symbol: "SOL/USD",
          available: true,
          lookbackDays: 12,
          score: -0.12,
          momentumPercent: -5,
          volatilityPercent: 2.2,
          reason: "SOL/USD 12-bar signal: -5.00% momentum, 2.20% daily volatility."
        }
      ]
    });

    const cryptoExit = candidates.find((candidate) => candidate.intent.symbol === "SOL/USD" && candidate.intent.side === "sell");
    expect(cryptoExit).toBeDefined();
    expect(cryptoExit?.intent.assetClass).toBe("crypto");
    expect(cryptoExit?.intent.timeInForce).toBe("gtc");
    expect(cryptoExit?.intent.notionalUsd).toBeLessThanOrEqual(900);
  });

  it("creates defined-risk option candidates from strong underlying signals", () => {
    const candidates = generateTradeCandidates({
      config: {
        universe: ["AAPL"],
        maxAutoNotionalUsd: 1_000
      },
      portfolio,
      marketHistory: [
        {
          symbol: "AAPL",
          available: true,
          lookbackDays: 12,
          score: 0.12,
          momentumPercent: 5,
          volatilityPercent: 1.6,
          reason: "AAPL 12-bar signal: 5.00% momentum, 1.60% daily volatility."
        }
      ],
      optionContracts: [
        {
          id: "aapl-call",
          symbol: "AAPL260116C00200000",
          name: "AAPL 2026-01-16 200 call",
          status: "active",
          tradable: true,
          underlyingSymbol: "AAPL",
          rootSymbol: "AAPL",
          type: "call",
          style: "american",
          expirationDate: "2026-01-16",
          strikePrice: 200,
          size: 100,
          closePrice: 4.5,
          openInterest: 1200
        }
      ]
    });

    const optionCandidate = candidates.find((candidate) => candidate.intent.assetClass === "us_option");
    expect(optionCandidate).toBeDefined();
    expect(optionCandidate?.intent.side).toBe("buy");
    expect(optionCandidate?.intent.quantity).toBe(1);
    expect(optionCandidate?.intent.notionalUsd).toBeLessThanOrEqual(600);
  });
});

describe("evaluateDailyAutonomyLimits", () => {
  it("blocks auto-submit after the daily autonomous order cap", () => {
    const receipts = Array.from({ length: 5 }, (_, index): GuardedExecutionResult => ({
      receiptId: `receipt-${index}`,
      status: "submitted",
      intent: {
        id: `agent-msft-${index}`,
        source: "mock_ai",
        rationale: "Autonomous paper trade for daily limit coverage.",
        assetClass: "us_equity",
        symbol: "MSFT",
        side: "buy",
        orderType: "market",
        timeInForce: "day",
        notionalUsd: 250,
        clientOrderId: `guardian-agent-msft-${index}`
      },
      reasons: ["Submitted to Alpaca paper trading."],
      createdAt: "2026-08-27T12:00:00.000Z"
    }));

    const result = evaluateDailyAutonomyLimits(250, receipts, {
      maxDailySubmittedOrders: 5,
      maxDailySubmittedNotionalUsd: 1_250
    }, "2026-08-27T14:00:00.000Z");

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("daily autonomous order cap");
  });

  it("blocks auto-submit when the next order would exceed daily notional", () => {
    const receipts: GuardedExecutionResult[] = [
      {
        receiptId: "receipt-1",
        status: "submitted",
        intent: {
          id: "agent-msft-1",
          source: "mock_ai",
          rationale: "Autonomous paper trade for daily notional coverage.",
          assetClass: "us_equity",
          symbol: "MSFT",
          side: "buy",
          orderType: "market",
          timeInForce: "day",
          notionalUsd: 1_100,
          clientOrderId: "guardian-agent-msft-1"
        },
        reasons: ["Submitted to Alpaca paper trading."],
        createdAt: "2026-08-27T12:00:00.000Z"
      }
    ];

    const result = evaluateDailyAutonomyLimits(250, receipts, {
      maxDailySubmittedOrders: 5,
      maxDailySubmittedNotionalUsd: 1_250
    }, "2026-08-27T14:00:00.000Z");

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("daily autonomous notional cap");
  });
});
