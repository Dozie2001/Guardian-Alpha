import { z } from "zod";
import { readAgentRuntimeSettings } from "@/lib/agent/runtime-settings";

const AgentModelProviderSchema = z.enum(["none", "groq", "featherless", "ensemble"]);

export type GuardianAgentConfig = {
  enabled: boolean;
  autoSubmit: boolean;
  intervalSeconds: number;
  maxAutoNotionalUsd: number;
  maxDailySubmittedOrders: number;
  maxDailySubmittedNotionalUsd: number;
  universe: string[];
  modelProvider: z.infer<typeof AgentModelProviderSchema>;
  modelName: string;
};

export function getGuardianAgentConfig(): GuardianAgentConfig {
  const envConfig: GuardianAgentConfig = {
    enabled: parseBoolean(process.env.GUARDIAN_AGENT_ENABLED, false),
    autoSubmit: parseBoolean(process.env.GUARDIAN_AGENT_AUTO_SUBMIT, false),
    intervalSeconds: parsePositiveInt(process.env.GUARDIAN_AGENT_INTERVAL_SECONDS, 60),
    maxAutoNotionalUsd: parsePositiveNumber(process.env.GUARDIAN_AGENT_MAX_AUTO_NOTIONAL_USD, 5_000),
    maxDailySubmittedOrders: parsePositiveInt(process.env.GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_ORDERS, 8),
    maxDailySubmittedNotionalUsd: parsePositiveNumber(process.env.GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_NOTIONAL_USD, 25_000),
    universe: parseUniverse(process.env.GUARDIAN_AGENT_UNIVERSE),
    modelProvider: AgentModelProviderSchema.catch("none").parse(process.env.GUARDIAN_MODEL_PROVIDER),
    modelName: parseModelName(process.env.GUARDIAN_MODEL_PROVIDER, process.env.GUARDIAN_MODEL_NAME)
  };
  const runtimeSettings = readAgentRuntimeSettings();

  return {
    ...envConfig,
    ...runtimeSettings,
    universe: runtimeSettings.universe?.length ? runtimeSettings.universe : envConfig.universe
  };
}

function parseModelName(provider: string | undefined, value: string | undefined) {
  const normalizedProvider = provider?.trim().toLowerCase();
  if (normalizedProvider === "groq") {
    return process.env.GROQ_MODEL_NAME?.trim() || value?.trim() || "openai/gpt-oss-20b";
  }

  if (normalizedProvider === "featherless") {
    return process.env.FEATHERLESS_MODEL_NAME?.trim() || value?.trim() || "Qwen/Qwen2.5-7B-Instruct";
  }

  const configured = value?.trim();
  if (configured) {
    return configured;
  }

  if (normalizedProvider === "featherless" || normalizedProvider === "ensemble") {
    return process.env.FEATHERLESS_MODEL_NAME?.trim() || "Qwen/Qwen2.5-7B-Instruct";
  }

  return "openai/gpt-oss-20b";
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseUniverse(value: string | undefined) {
  const symbols = (value || "SPY,QQQ,AAPL,MSFT,NVDA,BTC/USD,ETH/USD,SOL/USD")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  return symbols.length > 0 ? symbols : ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "BTC/USD", "ETH/USD", "SOL/USD"];
}
