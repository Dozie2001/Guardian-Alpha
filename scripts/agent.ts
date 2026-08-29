#!/usr/bin/env node
import { loadLocalEnv } from "@/lib/env/load-local-env";
import { getGuardianAgentConfig } from "@/lib/agent/config";
import { runAgentScan } from "@/lib/agent/alpha-agent";

loadLocalEnv();

const config = getGuardianAgentConfig();

console.log([
  "Guardian Alpha agent running in Alpaca paper mode.",
  `enabled=${config.enabled}`,
  `autoSubmit=${config.autoSubmit}`,
  `interval=${config.intervalSeconds}s`,
  `model=${config.modelProvider}`
].join(" "));

async function loop() {
  for (;;) {
    const scan = await runAgentScan(getGuardianAgentConfig());
    console.log(JSON.stringify({
      scanId: scan.scanId,
      status: scan.status,
      selectedSymbol: scan.selectedIntent?.symbol ?? null,
      modelProvider: scan.selection?.provider ?? null,
      reason: scan.reasons[0] ?? null
    }));
    await wait(getGuardianAgentConfig().intervalSeconds * 1000);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

loop().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
