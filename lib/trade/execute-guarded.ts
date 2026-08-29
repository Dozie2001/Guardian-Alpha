import { appendReceipt } from "@/lib/audit/store";
import { submitPaperOrder } from "@/lib/alpaca/client";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import type { Policy } from "@/lib/policy/types";
import type { GuardedExecutionResult, PortfolioSnapshot, TradeIntent } from "./types";

type ExecuteInput = {
  intent: TradeIntent;
  policy: Policy;
  portfolio: PortfolioSnapshot;
  humanApproved?: boolean;
};

export async function executeGuardedTrade({
  intent,
  policy,
  portfolio,
  humanApproved = false
}: ExecuteInput): Promise<GuardedExecutionResult> {
  const decision = evaluatePolicy({ intent, policy, portfolio });
  const createdAt = new Date().toISOString();

  if (!decision.approved || (decision.requiresHumanApproval && !humanApproved)) {
    const receipt: GuardedExecutionResult = {
      receiptId: crypto.randomUUID(),
      status: decision.approved ? "approved" : "blocked",
      intent,
      reasons: decision.requiresHumanApproval
        ? [...decision.reasons, "Human approval is required before execution."]
        : decision.reasons,
      createdAt
    };
    await appendReceipt(receipt);
    return receipt;
  }

  try {
    const order = await submitPaperOrder(intent);
    const receipt: GuardedExecutionResult = {
      receiptId: crypto.randomUUID(),
      status: "submitted",
      intent,
      reasons: [`Submitted to ${order.mode === "mock" ? "mock Alpaca paper trading" : "Alpaca paper trading"}.`],
      alpacaOrderId: order.orderId,
      createdAt
    };
    await appendReceipt(receipt);
    return receipt;
  } catch (error) {
    const receipt: GuardedExecutionResult = {
      receiptId: crypto.randomUUID(),
      status: "failed",
      intent,
      reasons: [error instanceof Error ? error.message : "Unknown order submission failure."],
      createdAt
    };
    await appendReceipt(receipt);
    return receipt;
  }
}
