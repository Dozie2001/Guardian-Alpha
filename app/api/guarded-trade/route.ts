import { NextResponse } from "next/server";
import { getPaperPortfolioSnapshot } from "@/lib/alpaca/client";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";
import { demoPolicy } from "@/lib/trade/mock-data";
import { executeGuardedTrade } from "@/lib/trade/execute-guarded";
import { TradeIntentSchema } from "@/lib/trade/types";
import { PolicySchema } from "@/lib/policy/types";
import { z } from "zod";

const GuardedTradeRequestSchema = z.union([
  TradeIntentSchema,
  z.object({
    intent: TradeIntentSchema,
    policy: PolicySchema.optional()
  })
]);

export async function POST(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  const body = await request.json();
  const parsed = GuardedTradeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Guarded trade request is invalid.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const requestData = "intent" in parsed.data
    ? parsed.data
    : { intent: parsed.data, policy: demoPolicy };

  const portfolio = await getPaperPortfolioSnapshot();
  const result = await executeGuardedTrade({
    intent: requestData.intent,
    policy: requestData.policy ?? demoPolicy,
    portfolio
  });

  return NextResponse.json(result);
}
