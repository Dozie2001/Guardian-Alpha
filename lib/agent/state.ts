import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentResearchContext } from "@/lib/agent/research";
import type { HistoricalMarketSignal } from "@/lib/agent/historical-market";
import type { TradeIntent } from "@/lib/trade/types";

export type AgentCandidate = {
  id: string;
  score: number;
  intent: TradeIntent;
  reasons: string[];
};

export type AgentModelSelection = {
  provider: "none" | "groq" | "featherless" | "ensemble" | "fallback";
  selectedCandidateId: string;
  confidence: number;
  reason: string;
  fallbackReason?: string;
};

export type AgentScanResult = {
  scanId: string;
  createdAt: string;
  enabled: boolean;
  autoSubmit: boolean;
  status: "idle" | "preview" | "submitted" | "partially_filled" | "filled" | "rejected" | "canceled" | "expired" | "blocked" | "skipped" | "failed";
  candidates: AgentCandidate[];
  selection?: AgentModelSelection;
  selectedIntent?: TradeIntent;
  receiptId?: string;
  research?: AgentResearchContext;
  marketHistory?: HistoricalMarketSignal[];
  reasons: string[];
};

export type GuardianAgentState = {
  running: boolean;
  updatedAt: string;
  lastScan?: AgentScanResult;
};

const stateDir = path.join(process.cwd(), "data");
const statePath = path.join(stateDir, "agent-state.json");

export async function readAgentState(): Promise<GuardianAgentState> {
  try {
    const raw = await readFile(statePath, "utf8");
    return JSON.parse(raw) as GuardianAgentState;
  } catch {
    return {
      running: false,
      updatedAt: new Date(0).toISOString()
    };
  }
}

export async function writeAgentState(state: GuardianAgentState) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
