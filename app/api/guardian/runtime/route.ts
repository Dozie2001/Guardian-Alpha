import { NextResponse } from "next/server";
import { getGuardianRuntimeConfig } from "@/lib/guardian/runtime-config";

export async function GET() {
  return NextResponse.json({ runtime: getGuardianRuntimeConfig() });
}
