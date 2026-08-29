import { loadLocalEnv } from "@/lib/env/load-local-env";
import { getGuardianAgentConfig } from "@/lib/agent/config";
import { runAgentScan } from "@/lib/agent/alpha-agent";

loadLocalEnv();

async function main() {
  const config = getGuardianAgentConfig();
  const scan = await runAgentScan(config);

  console.log(JSON.stringify({
    status: scan.status,
    autoSubmit: scan.autoSubmit,
    selected: scan.selectedIntent
      ? {
        symbol: scan.selectedIntent.symbol,
        side: scan.selectedIntent.side,
        notionalUsd: scan.selectedIntent.notionalUsd,
        assetClass: scan.selectedIntent.assetClass
      }
      : null,
    provider: scan.selection?.provider ?? null,
    confidence: scan.selection?.confidence ?? null,
    receiptId: scan.receiptId ?? null,
    reasons: scan.reasons
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
