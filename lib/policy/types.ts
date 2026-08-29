import { z } from "zod";

export const PolicySchema = z.object({
  name: z.string().min(3),
  paperOnly: z.boolean(),
  requireHumanApprovalAboveUsd: z.number().nonnegative(),
  maxTradeNotionalUsd: z.number().positive(),
  maxDailyLossPercent: z.number().positive().max(100),
  maxPositionPercent: z.number().positive().max(100),
  allowedEquitySymbols: z.array(z.string().min(1)),
  allowedCryptoPairs: z.array(z.string().min(1)),
  allowedOptionUnderlyings: z.array(z.string().min(1)),
  blockedSymbols: z.array(z.string().min(1)),
  maxCryptoTradeNotionalUsd: z.number().positive(),
  maxCryptoPortfolioPercent: z.number().positive().max(100),
  cryptoCooldownMinutes: z.number().nonnegative(),
  maxOptionContracts: z.number().int().positive(),
  maxOptionPremiumUsd: z.number().positive(),
  minOptionDaysToExpiry: z.number().int().nonnegative(),
  allowShortSelling: z.boolean(),
  allowOptions: z.boolean()
});

export type Policy = z.infer<typeof PolicySchema>;

export type PolicyDecision = {
  approved: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
};

export const defaultPolicy: Policy = {
  name: "Conservative Paper Trading",
  paperOnly: true,
  requireHumanApprovalAboveUsd: 2_500,
  maxTradeNotionalUsd: 5_000,
  maxDailyLossPercent: 5,
  maxPositionPercent: 30,
  allowedEquitySymbols: ["SPY", "VOO", "QQQ", "AAPL", "MSFT", "NVDA"],
  allowedCryptoPairs: ["BTC/USD", "ETH/USD", "SOL/USD"],
  allowedOptionUnderlyings: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
  blockedSymbols: [],
  maxCryptoTradeNotionalUsd: 1_000,
  maxCryptoPortfolioPercent: 35,
  cryptoCooldownMinutes: 15,
  maxOptionContracts: 1,
  maxOptionPremiumUsd: 600,
  minOptionDaysToExpiry: 7,
  allowShortSelling: true,
  allowOptions: true
};
