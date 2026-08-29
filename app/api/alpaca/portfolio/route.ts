import { NextResponse } from "next/server";
import { getPaperPortfolioSnapshot } from "@/lib/alpaca/client";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";

export async function GET(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  try {
    const portfolio = await getPaperPortfolioSnapshot();
    return NextResponse.json({ portfolio });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Alpaca paper portfolio." },
      { status: 400 }
    );
  }
}
