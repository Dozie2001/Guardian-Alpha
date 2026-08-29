import { NextResponse } from "next/server";
import { readLatestResearchContext } from "@/lib/agent/research";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";

export async function GET(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  return NextResponse.json({ research: await readLatestResearchContext() });
}
