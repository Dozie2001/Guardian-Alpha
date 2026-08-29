import { defaultPolicy } from "@/lib/policy/types";
import type { PortfolioSnapshot, TradeIntent } from "./types";

export const demoPortfolio: PortfolioSnapshot = {
  equityUsd: 25_000,
  cashUsd: 18_400,
  dailyPnlUsd: -86,
  cryptoMarketValueUsd: 1_250,
  openPositions: [
    { symbol: "VOO", assetClass: "us_equity", marketValueUsd: 2_900 },
    { symbol: "MSFT", assetClass: "us_equity", marketValueUsd: 1_450 },
    { symbol: "ETH/USD", assetClass: "crypto", marketValueUsd: 800 },
    { symbol: "SOL/USD", assetClass: "crypto", marketValueUsd: 450 }
  ]
};

export const demoPolicy = defaultPolicy;

export const demoTradeIntents: TradeIntent[] = [
  {
    id: "intent-safe-voo",
    source: "mock_ai",
    rationale: "Increase broad-market ETF exposure while staying under the conservative trade cap.",
    assetClass: "us_equity",
    symbol: "VOO",
    side: "buy",
    orderType: "market",
    timeInForce: "day",
    notionalUsd: 90,
    clientOrderId: "guardian-demo-voo-001"
  },
  {
    id: "intent-block-nvda",
    source: "mock_ai",
    rationale: "Add more semiconductor exposure after strong momentum, but the size is too aggressive.",
    assetClass: "us_equity",
    symbol: "NVDA",
    side: "buy",
    orderType: "market",
    timeInForce: "day",
    notionalUsd: 1_200,
    clientOrderId: "guardian-demo-nvda-001"
  },
  {
    id: "intent-crypto-sol",
    source: "mock_ai",
    rationale: "Add a small SOL position because crypto trades continuously and current exposure is below limit.",
    assetClass: "crypto",
    symbol: "SOL/USD",
    side: "buy",
    orderType: "limit",
    timeInForce: "gtc",
    notionalUsd: 75,
    limitPrice: 145,
    clientOrderId: "guardian-demo-sol-001"
  },
  {
    id: "intent-option-spy",
    source: "mock_ai",
    rationale: "Test one SPY call contract as an options alpha candidate, gated by the options policy module.",
    assetClass: "us_option",
    symbol: "SPY270115C00500000",
    side: "buy",
    orderType: "limit",
    timeInForce: "day",
    notionalUsd: 125,
    quantity: 1,
    limitPrice: 1.25,
    clientOrderId: "guardian-demo-spy-call"
  }
];
