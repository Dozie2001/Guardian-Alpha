import { NextResponse } from "next/server";
import { getPaperAccountSummary } from "@/lib/alpaca/client";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";

export async function GET(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  try {
    const account = await getPaperAccountSummary();
    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify Alpaca paper account." },
      { status: 400 }
    );
  }
}
