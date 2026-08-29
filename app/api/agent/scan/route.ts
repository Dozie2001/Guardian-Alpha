import { NextResponse } from "next/server";
import { runAgentScan } from "@/lib/agent/alpha-agent";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";

export async function POST(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  const scan = await runAgentScan();
  return NextResponse.json({ scan });
}
