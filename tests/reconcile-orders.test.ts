import { describe, expect, it, vi } from "vitest";
import { reconcileSubmittedReceipts } from "@/lib/trade/reconcile-orders";
import type { GuardedExecutionResult } from "@/lib/trade/types";

vi.mock("@/lib/audit/store", () => ({
  readReceipts: vi.fn(),
  writeReceipts: vi.fn()
}));

vi.mock("@/lib/alpaca/client", () => ({
  getPaperOrderStatus: vi.fn(async () => ({
    id: "order-1",
    status: "filled",
    filledQty: "7.5",
    averageFilledPrice: "123.45",
    updatedAt: "2026-08-28T14:30:00.000Z"
  }))
}));

function submittedReceipt(): GuardedExecutionResult {
  return {
    receiptId: "receipt-1",
    status: "submitted",
    intent: {
      id: "agent-test-1",
      source: "mock_ai",
      rationale: "Test autonomous trade for reconciliation.",
      assetClass: "us_equity",
      symbol: "NVDA",
      side: "buy",
      orderType: "market",
      timeInForce: "day",
      notionalUsd: 500,
      clientOrderId: "guardian-test-reconcile"
    },
    reasons: ["Submitted to Alpaca paper trading."],
    alpacaOrderId: "order-1",
    createdAt: "2026-08-28T14:00:00.000Z"
  };
}

describe("reconcileSubmittedReceipts", () => {
  it("updates submitted receipts from broker lifecycle state", async () => {
    const result = await reconcileSubmittedReceipts([submittedReceipt()]);

    expect(result.checked).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.receipts[0]).toMatchObject({
      status: "filled",
      alpacaOrderStatus: "filled",
      filledQty: "7.5",
      averageFilledPrice: "123.45",
      lifecycleUpdatedAt: "2026-08-28T14:30:00.000Z"
    });
    expect(result.receipts[0].reasons.join(" ")).toContain("Broker lifecycle status: filled.");
  });
});
