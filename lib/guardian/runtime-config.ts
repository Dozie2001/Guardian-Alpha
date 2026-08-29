import { z } from "zod";

export const GuardianDeploymentModeSchema = z.enum(["demo", "commercial"]);

export type GuardianDeploymentMode = z.infer<typeof GuardianDeploymentModeSchema>;

export type GuardianRuntimeConfig = {
  deploymentMode: GuardianDeploymentMode;
  tradingEnvironment: "paper";
  accountModel: "server_demo_account" | "bring_your_own_account";
  headline: string;
  description: string;
  telegramBotUrl: string | null;
  judgeCommands: string[];
};

export function getGuardianRuntimeConfig(): GuardianRuntimeConfig {
  const deploymentMode = GuardianDeploymentModeSchema
    .catch("demo")
    .parse(process.env.GUARDIAN_DEPLOYMENT_MODE);

  if (deploymentMode === "commercial") {
    return {
      deploymentMode,
      tradingEnvironment: "paper",
      accountModel: "bring_your_own_account",
      headline: "Bring your own Alpaca paper account",
      description: "Commercial mode is designed for account-isolated users who connect their own Alpaca paper credentials, policy, MCP client, and Telegram chat.",
      telegramBotUrl: getPublicTelegramBotUrl(),
      judgeCommands: getJudgeCommands()
    };
  }

  return {
    deploymentMode,
    tradingEnvironment: "paper",
    accountModel: "server_demo_account",
    headline: "Hosted demo account",
    description: "Demo mode uses the server's Alpaca paper credentials so judges can see real paper execution through the protected app and Telegram bot.",
    telegramBotUrl: getPublicTelegramBotUrl(),
    judgeCommands: getJudgeCommands()
  };
}

function getPublicTelegramBotUrl() {
  const url = process.env.TELEGRAM_BOT_URL?.trim() || process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL?.trim();

  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "t.me" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function getJudgeCommands() {
  return ["/brief", "/scan", "/why", "/performance", "/receipts"];
}
