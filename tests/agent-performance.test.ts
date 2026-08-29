import { describe, expect, it } from "vitest";
import { summarizeAgentPerformance } from "@/lib/agent/performance";
import type { GuardedExecutionResult, PortfolioSnapshot } from "@/lib/trade/types";

const portfolio: PortfolioSnapshot = {
  equityUsd: 10_000,
  cashUsd: 6_000,
  dailyPnlUsd: 125,
  cryptoMarketValueUsd: 500,
  openPositions: [
    { symbol: "VOO", assetClass: "us_equity", marketValueUsd: 2_500 },
    { symbol: "SOL/USD", assetClass: "crypto", marketValueUsd: 500 }
  ]
};

function receipt(status: GuardedExecutionResult["status"], notionalUsd: number): GuardedExecutionResult {
  return {
    receiptId: `receipt-${status}-${notionalUsd}`,
    status,
    intent: {
      id: `intent-${status}-${notionalUsd}`,
      source: "mock_ai",
      rationale: "Test signal generated for performance summary coverage.",
      assetClass: "us_equity",
      symbol: "VOO",
      side: "buy",
      orderType: "market",
      timeInForce: "day",
      notionalUsd,
      clientOrderId: `client-${status}-${notionalUsd}`
    },
    reasons: ["Test reason."],
    createdAt: "2026-08-26T19:00:00.000Z"
  };
}

describe("summarizeAgentPerformance", () => {
  it("summarizes P&L, decisions, notional, and exposure", () => {
    const summary = summarizeAgentPerformance([
      receipt("submitted", 100),
      receipt("blocked", 250),
      receipt("approved", 50)
    ], portfolio);

    expect(summary.totalDecisions).toBe(3);
    expect(summary.submittedCount).toBe(1);
    expect(summary.blockedCount).toBe(1);
    expect(summary.reviewCount).toBe(1);
    expect(summary.approvalRate).toBeCloseTo(66.666, 2);
    expect(summary.submittedNotionalUsd).toBe(100);
    expect(summary.blockedNotionalUsd).toBe(250);
    expect(summary.dailyPnlPercent).toBe(1.25);
    expect(summary.cashPercent).toBe(60);
    expect(summary.largestPositionPercent).toBe(25);
    expect(summary.strategyStatus).toBe("normal");
    expect(summary.competitionScore).toBeGreaterThan(0);
    expect(summary.competitionGrade).toBe("standout");
    expect(summary.competitionBrief.some((line) => line.includes("paper P&L"))).toBe(true);
  });

  it("marks the strategy as needing data before the first receipt", () => {
    const summary = summarizeAgentPerformance([], portfolio);

    expect(summary.strategyStatus).toBe("needs_data");
    expect(summary.approvalRate).toBe(0);
    expect(summary.totalDecisions).toBe(0);
    expect(summary.competitionGrade).toBe("engaging");
    expect(summary.competitionBrief[0]).toContain("No autonomous decisions");
  });
});
