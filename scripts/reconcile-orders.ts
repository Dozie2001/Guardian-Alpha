#!/usr/bin/env node
import { loadLocalEnv } from "@/lib/env/load-local-env";
import { reconcileSubmittedReceipts } from "@/lib/trade/reconcile-orders";

loadLocalEnv();

void main();

async function main() {
  const result = await reconcileSubmittedReceipts();
  console.log(JSON.stringify({
    checked: result.checked,
    updated: result.updated
  }, null, 2));
}
