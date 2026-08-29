#!/usr/bin/env node
import { loadLocalEnv } from "@/lib/env/load-local-env";
import { runGuardianTelegramBot } from "@/lib/telegram/guardian-bot";

loadLocalEnv();

runGuardianTelegramBot().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
