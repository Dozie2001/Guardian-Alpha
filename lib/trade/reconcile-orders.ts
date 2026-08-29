import { readReceipts, writeReceipts } from "@/lib/audit/store";
import { getPaperOrderStatus } from "@/lib/alpaca/client";
import type { GuardedExecutionResult } from "@/lib/trade/types";

const openReceiptStatuses = new Set<GuardedExecutionResult["status"]>(["submitted", "partially_filled"]);

export type ReconcileResult = {
  checked: number;
  updated: number;
  receipts: GuardedExecutionResult[];
};

export async function reconcileSubmittedReceipts(inputReceipts?: GuardedExecutionResult[]): Promise<ReconcileResult> {
  const receipts = inputReceipts ?? await readReceipts();
  let updated = 0;
  const reconciled: GuardedExecutionResult[] = [];

  for (const receipt of receipts) {
    if (!receipt.alpacaOrderId || !openReceiptStatuses.has(receipt.status)) {
      reconciled.push(receipt);
      continue;
    }

    const order = await getPaperOrderStatus(receipt.alpacaOrderId);
    if (!order) {
      reconciled.push(receipt);
      continue;
    }

    const nextStatus = mapAlpacaStatus(order.status);
    const nextReceipt: GuardedExecutionResult = {
      ...receipt,
      status: nextStatus,
      alpacaOrderStatus: order.status,
      filledQty: order.filledQty,
      averageFilledPrice: order.averageFilledPrice,
      lifecycleUpdatedAt: order.updatedAt ?? new Date().toISOString(),
      reasons: mergeLifecycleReason(receipt.reasons, order.status, nextStatus, order.filledQty, order.averageFilledPrice)
    };

    if (hasReceiptChanged(receipt, nextReceipt)) {
      updated += 1;
    }

    reconciled.push(nextReceipt);
  }

  if (updated > 0 || inputReceipts === undefined) {
    await writeReceipts(reconciled);
  }

  return {
    checked: receipts.filter((receipt) => receipt.alpacaOrderId && openReceiptStatuses.has(receipt.status)).length,
    updated,
    receipts: reconciled
  };
}

function mapAlpacaStatus(status: string): GuardedExecutionResult["status"] {
  switch (status) {
    case "filled":
      return "filled";
    case "partially_filled":
      return "partially_filled";
    case "rejected":
      return "rejected";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    default:
      return "submitted";
  }
}

function mergeLifecycleReason(
  reasons: string[],
  alpacaStatus: string,
  receiptStatus: GuardedExecutionResult["status"],
  filledQty: string | undefined,
  averageFilledPrice: string | undefined
) {
  const lifecycleReason = [
    `Broker lifecycle status: ${alpacaStatus}.`,
    filledQty && filledQty !== "0" ? `Filled quantity: ${filledQty}.` : null,
    averageFilledPrice ? `Average fill price: ${averageFilledPrice}.` : null
  ].filter(Boolean).join(" ");

  const withoutOldLifecycle = reasons.filter((reason) => !reason.startsWith("Broker lifecycle status:"));
  if (receiptStatus === "submitted" && !filledQty) {
    return withoutOldLifecycle;
  }

  return [...withoutOldLifecycle, lifecycleReason];
}

function hasReceiptChanged(previous: GuardedExecutionResult, next: GuardedExecutionResult) {
  return previous.status !== next.status ||
    previous.alpacaOrderStatus !== next.alpacaOrderStatus ||
    previous.filledQty !== next.filledQty ||
    previous.averageFilledPrice !== next.averageFilledPrice;
}
