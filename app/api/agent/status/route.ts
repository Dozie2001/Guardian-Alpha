import { NextResponse } from "next/server";
import { getGuardianAgentConfig } from "@/lib/agent/config";
import { readLatestResearchContext } from "@/lib/agent/research";
import { readAgentState } from "@/lib/agent/state";
import { verifyGuardianWebAccess } from "@/lib/guardian/web-auth";

export async function GET(request: Request) {
  const access = await verifyGuardianWebAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  const [state, config, research] = await Promise.all([
    readAgentState(),
    Promise.resolve(getGuardianAgentConfig()),
    readLatestResearchContext()
  ]);

  return NextResponse.json({ state, config, research });
}
