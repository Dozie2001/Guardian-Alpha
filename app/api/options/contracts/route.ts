import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaperOptionContracts } from "@/lib/alpaca/client";
import { getDefaultOptionDateRange } from "@/lib/options/contracts";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";

const OptionContractsQuerySchema = z.object({
  underlying: z.string().trim().min(1).max(6).transform((value) => value.toUpperCase()),
  type: z.enum(["call", "put"]).default("call"),
  expirationDateGte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expirationDateLte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strikePriceGte: z.coerce.number().positive().optional(),
  strikePriceLte: z.coerce.number().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});

export async function GET(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  const url = new URL(request.url);
  const dates = getDefaultOptionDateRange();
  const parsed = OptionContractsQuerySchema.safeParse({
    underlying: url.searchParams.get("underlying") ?? "SPY",
    type: url.searchParams.get("type") ?? "call",
    expirationDateGte: url.searchParams.get("expirationDateGte") ?? dates.expirationDateGte,
    expirationDateLte: url.searchParams.get("expirationDateLte") ?? dates.expirationDateLte,
    strikePriceGte: url.searchParams.get("strikePriceGte") ?? undefined,
    strikePriceLte: url.searchParams.get("strikePriceLte") ?? undefined,
    limit: url.searchParams.get("limit") ?? 12
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Option contract search is invalid.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await getPaperOptionContracts(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load option contracts." },
      { status: 400 }
    );
  }
}
