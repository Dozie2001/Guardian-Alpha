import { NextResponse } from "next/server";
import { readReceipts } from "@/lib/audit/store";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";
import { reconcileSubmittedReceipts } from "@/lib/trade/reconcile-orders";

export async function GET(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  const receipts = await reconcileSubmittedReceipts()
    .then((result) => result.receipts)
    .catch(() => readReceipts());
  return NextResponse.json({ receipts });
}
