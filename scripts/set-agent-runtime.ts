import { writeAgentRuntimeSettings, type AgentRuntimeSettings } from "@/lib/agent/runtime-settings";

const args = process.argv.slice(2);

const next: AgentRuntimeSettings = {};

for (const arg of args) {
  const [key, rawValue] = arg.split("=");

  if (!key || rawValue === undefined) {
    throw new Error(`Invalid argument: ${arg}. Use key=value.`);
  }

  if (key === "enabled" || key === "autoSubmit") {
    next[key] = rawValue === "true";
  } else if (key === "intervalSeconds") {
    next.intervalSeconds = Number.parseInt(rawValue, 10);
  } else if (key === "maxAutoNotionalUsd") {
    next.maxAutoNotionalUsd = Number.parseFloat(rawValue);
  } else if (key === "maxDailySubmittedOrders") {
    next.maxDailySubmittedOrders = Number.parseInt(rawValue, 10);
  } else if (key === "maxDailySubmittedNotionalUsd") {
    next.maxDailySubmittedNotionalUsd = Number.parseFloat(rawValue);
  } else if (key === "modelProvider") {
    if (!["none", "groq", "featherless", "ensemble"].includes(rawValue)) {
      throw new Error(`Invalid modelProvider: ${rawValue}`);
    }
    next.modelProvider = rawValue as AgentRuntimeSettings["modelProvider"];
  } else if (key === "modelName") {
    next.modelName = rawValue;
  } else if (key === "universe") {
    next.universe = rawValue.split(",").map((symbol) => symbol.trim()).filter(Boolean);
  } else {
    throw new Error(`Unknown setting: ${key}`);
  }
}

writeAgentRuntimeSettings(next)
  .then((settings) => {
    console.log(JSON.stringify(settings, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
