import { z } from "zod";

export const AssetClassSchema = z.enum(["us_equity", "crypto", "us_option"]);
export const OrderSideSchema = z.enum(["buy", "sell"]);
export const OrderTypeSchema = z.enum(["market", "limit", "stop_limit"]);
export const TimeInForceSchema = z.enum(["day", "gtc", "ioc"]);

export const TradeIntentSchema = z.object({
  id: z.string().min(8),
  source: z.enum(["mock_ai", "mcp", "dashboard"]),
  rationale: z.string().min(12),
  assetClass: AssetClassSchema,
  symbol: z.string().min(1).max(32),
  side: OrderSideSchema,
  orderType: OrderTypeSchema,
  timeInForce: TimeInForceSchema,
  notionalUsd: z.number().positive().max(1_000_000),
  quantity: z.number().positive().optional(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  clientOrderId: z.string().min(8).max(48)
});

export type AssetClass = z.infer<typeof AssetClassSchema>;
export type TradeIntent = z.infer<typeof TradeIntentSchema>;

export type MarketSnapshot = {
  symbol: string;
  assetClass: AssetClass;
  lastPrice: number;
  isMarketOpen: boolean;
};

export type PortfolioSnapshot = {
  equityUsd: number;
  cashUsd: number;
  dailyPnlUsd: number;
  cryptoMarketValueUsd: number;
  openPositions: Array<{
    symbol: string;
    assetClass: AssetClass;
    marketValueUsd: number;
  }>;
};

export type GuardedExecutionResult = {
  receiptId: string;
  status: "approved" | "blocked" | "submitted" | "partially_filled" | "filled" | "rejected" | "canceled" | "expired" | "failed";
  intent: TradeIntent;
  reasons: string[];
  alpacaOrderId?: string;
  alpacaOrderStatus?: string;
  filledQty?: string;
  averageFilledPrice?: string;
  lifecycleUpdatedAt?: string;
  createdAt: string;
};
