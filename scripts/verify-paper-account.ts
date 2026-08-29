import { loadLocalEnv } from "@/lib/env/load-local-env";

loadLocalEnv();

const baseUrl = (process.env.ALPACA_PAPER_BASE_URL ?? "https://paper-api.alpaca.markets").replace(/\/+$/, "");
const key = process.env.ALPACA_API_KEY ?? process.env.APCA_API_KEY_ID;
const secret = process.env.ALPACA_SECRET_KEY ?? process.env.APCA_API_SECRET_KEY;

if (!baseUrl.includes("paper-api.alpaca.markets")) {
  throw new Error("Refusing to verify non-paper Alpaca endpoint.");
}

if (!key || !secret) {
  throw new Error("Missing Alpaca paper API credentials.");
}

const headers = {
  "APCA-API-KEY-ID": key,
  "APCA-API-SECRET-KEY": secret
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  return JSON.parse(body) as T;
}

type AlpacaAccount = {
  id: string;
  account_number: string;
  status: string;
  equity: string;
  cash: string;
  buying_power: string;
  options_approved_level?: number;
  options_trading_level?: number;
  crypto_status?: string;
  shorting_enabled?: boolean;
  trading_blocked?: boolean;
  account_blocked?: boolean;
  transfers_blocked?: boolean;
};

type AlpacaClock = {
  is_open: boolean;
  next_open: string;
  next_close: string;
};

async function main() {
  const [account, positions, orders, clock] = await Promise.all([
    getJson<AlpacaAccount>("/v2/account"),
    getJson<unknown[]>("/v2/positions"),
    getJson<unknown[]>("/v2/orders?status=all&limit=50&direction=desc"),
    getJson<AlpacaClock>("/v2/clock")
  ]);

  console.log(
    JSON.stringify(
      {
        accountId: account.id,
        accountNumber: account.account_number,
        status: account.status,
        equity: account.equity,
        cash: account.cash,
        buyingPower: account.buying_power,
        optionsApprovedLevel: account.options_approved_level,
        optionsTradingLevel: account.options_trading_level,
        cryptoStatus: account.crypto_status,
        shortingEnabled: account.shorting_enabled,
        tradingBlocked: account.trading_blocked,
        accountBlocked: account.account_blocked,
        transfersBlocked: account.transfers_blocked,
        positions: positions.length,
        recentOrders: orders.length,
        clock
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
