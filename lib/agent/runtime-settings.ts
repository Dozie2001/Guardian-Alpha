import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const AgentRuntimeSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoSubmit: z.boolean().optional(),
  intervalSeconds: z.number().int().positive().optional(),
  maxAutoNotionalUsd: z.number().positive().optional(),
  maxDailySubmittedOrders: z.number().int().positive().optional(),
  maxDailySubmittedNotionalUsd: z.number().positive().optional(),
  universe: z.array(z.string().min(1)).optional(),
  modelProvider: z.enum(["none", "groq", "featherless", "ensemble"]).optional(),
  modelName: z.string().min(1).optional()
});

export type AgentRuntimeSettings = z.infer<typeof AgentRuntimeSettingsSchema>;

const settingsDir = path.join(process.cwd(), "data");
const settingsPath = path.join(settingsDir, "agent-settings.json");

export function readAgentRuntimeSettings(): AgentRuntimeSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }

  try {
    return AgentRuntimeSettingsSchema.parse(JSON.parse(readFileSync(settingsPath, "utf8")));
  } catch {
    return {};
  }
}

export async function writeAgentRuntimeSettings(nextSettings: AgentRuntimeSettings) {
  const current = readAgentRuntimeSettings();
  const merged = AgentRuntimeSettingsSchema.parse({
    ...current,
    ...nextSettings
  });

  await mkdir(settingsDir, { recursive: true });
  await writeFile(settingsPath, JSON.stringify(merged, null, 2));
  return merged;
}

export function normalizeRuntimeUniverse(symbols: string[]) {
  return symbols
    .map((symbol) => symbol.trim().toUpperCase().replace("-", "/"))
    .filter(Boolean)
    .slice(0, 12);
}
