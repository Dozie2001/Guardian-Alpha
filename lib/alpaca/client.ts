import type { AssetClass, PortfolioSnapshot, TradeIntent } from "@/lib/trade/types";
import { getDefaultOptionDateRange, type OptionContract, type OptionContractSearch } from "@/lib/options/contracts";

type AlpacaOrderResponse = {
  id: string;
  client_order_id?: string;
  status?: string;
  filled_qty?: string;
  filled_avg_price?: string;
  updated_at?: string;
  submitted_at?: string;
};

export type SubmitOrderResult = {
  orderId: string;
  status: string;
  mode: "mock" | "alpaca";
};

export type AlpacaOrderStatus = {
  id: string;
  status: string;
  filledQty?: string;
  averageFilledPrice?: string;
  updatedAt?: string;
};

export type AlpacaAccountSummary = {
  mode: "mock" | "alpaca";
  environment: "paper";
  accountId: string;
  status: string;
  equityUsd: number;
  cashUsd: number;
  buyingPowerUsd: number;
  tradingBlocked: boolean;
  accountBlocked: boolean;
  tradeSuspendedByUser: boolean;
  cryptoStatus?: string;
  optionsApprovedLevel?: number;
  optionsTradingLevel?: number;
  optionsBuyingPowerUsd?: number;
  multiplier?: string;
};

type AlpacaPosition = Record<string, unknown>;
type AlpacaOptionContract = Record<string, unknown>;

export type PortfolioPosition = PortfolioSnapshot["openPositions"][number];

const AlpacaRequestTimeoutMs = 10_000;

export async function submitPaperOrder(intent: TradeIntent): Promise<SubmitOrderResult> {
  const { key, secret, baseUrl } = getPaperAlpacaConfig();

  if (!key || !secret) {
    return {
      orderId: `mock-${intent.clientOrderId}`,
      status: "accepted",
      mode: "mock"
    };
  }

  const body = buildOrderBody(intent);

  const response = await alpacaFetch(`${baseUrl}/v2/orders`, {
    method: "POST",
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Alpaca order failed with ${response.status}`);
  }

  const order = await response.json() as AlpacaOrderResponse;

  return {
    orderId: order.id,
    status: order.status ?? "submitted",
    mode: "alpaca"
  };
}

export async function getPaperAccountSummary(): Promise<AlpacaAccountSummary> {
  const { key, secret, baseUrl } = getPaperAlpacaConfig();

  if (!key || !secret) {
    return {
      mode: "mock",
      environment: "paper",
      accountId: "mock-paper-account",
      status: "PAPER_ONLY",
      equityUsd: 25_000,
      cashUsd: 18_400,
      buyingPowerUsd: 18_400,
      tradingBlocked: false,
      accountBlocked: false,
      tradeSuspendedByUser: false,
      cryptoStatus: "ACTIVE",
      optionsApprovedLevel: 3,
      optionsTradingLevel: 3,
      optionsBuyingPowerUsd: 18_400,
      multiplier: "1"
    };
  }

  const response = await alpacaFetch(`${baseUrl}/v2/account`, {
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Alpaca account lookup failed with ${response.status}`);
  }

  const account = await response.json() as Record<string, unknown>;

  return {
    mode: "alpaca",
    environment: "paper",
    accountId: maskAccountId(String(account.id ?? account.account_number ?? "unknown")),
    status: String(account.status ?? "unknown"),
    equityUsd: Number(account.equity ?? 0),
    cashUsd: Number(account.cash ?? 0),
    buyingPowerUsd: Number(account.buying_power ?? 0),
    tradingBlocked: Boolean(account.trading_blocked),
    accountBlocked: Boolean(account.account_blocked),
    tradeSuspendedByUser: Boolean(account.trade_suspended_by_user),
    cryptoStatus: account.crypto_status ? String(account.crypto_status) : undefined,
    optionsApprovedLevel: toFiniteNumber(account.options_approved_level),
    optionsTradingLevel: toFiniteNumber(account.options_trading_level),
    optionsBuyingPowerUsd: toFiniteNumber(account.options_buying_power),
    multiplier: account.multiplier ? String(account.multiplier) : undefined
  };
}

export async function getPaperOrderStatus(orderId: string): Promise<AlpacaOrderStatus | null> {
  const { key, secret, baseUrl } = getPaperAlpacaConfig();

  if (!key || !secret || orderId.startsWith("mock-")) {
    return null;
  }

  const response = await alpacaFetch(`${baseUrl}/v2/orders/${orderId}`, {
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Alpaca order lookup failed with ${response.status}`);
  }

  const order = await response.json() as AlpacaOrderResponse;
  return {
    id: order.id,
    status: order.status ?? "unknown",
    filledQty: order.filled_qty,
    averageFilledPrice: order.filled_avg_price,
    updatedAt: order.updated_at ?? order.submitted_at
  };
}

export async function getPaperPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const { key, secret, baseUrl } = getPaperAlpacaConfig();

  if (!key || !secret) {
    return {
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
  }

  const [accountResponse, positionsResponse] = await Promise.all([
    alpacaFetch(`${baseUrl}/v2/account`, {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret
      },
      cache: "no-store"
    }),
    alpacaFetch(`${baseUrl}/v2/positions`, {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret
      },
      cache: "no-store"
    })
  ]);

  if (!accountResponse.ok) {
    const message = await accountResponse.text();
    throw new Error(message || `Alpaca account lookup failed with ${accountResponse.status}`);
  }

  if (!positionsResponse.ok) {
    const message = await positionsResponse.text();
    throw new Error(message || `Alpaca positions lookup failed with ${positionsResponse.status}`);
  }

  const account = await accountResponse.json() as Record<string, unknown>;
  const positions = await positionsResponse.json() as AlpacaPosition[];
  const openPositions = positions.map(mapAlpacaPositionToSnapshotPosition);
  const equityUsd = toFiniteNumber(account.equity);
  const lastEquityUsd = toFiniteNumber(account.last_equity);

  return {
    equityUsd,
    cashUsd: toFiniteNumber(account.cash),
    dailyPnlUsd: lastEquityUsd > 0 ? equityUsd - lastEquityUsd : 0,
    cryptoMarketValueUsd: openPositions
      .filter((position) => position.assetClass === "crypto")
      .reduce((sum, position) => sum + Math.abs(position.marketValueUsd), 0),
    openPositions
  };
}

export async function getPaperOptionContracts(search: OptionContractSearch): Promise<{ mode: "mock" | "alpaca"; contracts: OptionContract[] }> {
  const { key, secret, baseUrl } = getPaperAlpacaConfig();
  const normalizedSearch = normalizeOptionSearch(search);

  if (!key || !secret) {
    return {
      mode: "mock",
      contracts: getMockOptionContracts(normalizedSearch)
    };
  }

  const params = new URLSearchParams({
    underlying_symbols: normalizedSearch.underlying,
    type: normalizedSearch.type,
    status: "active",
    expiration_date_gte: normalizedSearch.expirationDateGte,
    expiration_date_lte: normalizedSearch.expirationDateLte,
    limit: String(normalizedSearch.limit)
  });

  if (normalizedSearch.strikePriceGte !== undefined) {
    params.set("strike_price_gte", String(normalizedSearch.strikePriceGte));
  }

  if (normalizedSearch.strikePriceLte !== undefined) {
    params.set("strike_price_lte", String(normalizedSearch.strikePriceLte));
  }

  const response = await alpacaFetch(`${baseUrl}/v2/options/contracts?${params.toString()}`, {
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Alpaca option contracts lookup failed with ${response.status}`);
  }

  const data = await response.json() as { option_contracts?: AlpacaOptionContract[] };

  return {
    mode: "alpaca",
    contracts: (data.option_contracts ?? []).map(mapAlpacaOptionContract)
  };
}

export function mapAlpacaPositionToSnapshotPosition(position: AlpacaPosition): PortfolioPosition {
  const assetClass = normalizeAssetClass(position.asset_class);
  const rawSymbol = String(position.symbol ?? "");

  return {
    symbol: assetClass === "crypto" ? normalizeCryptoPair(rawSymbol) : rawSymbol.toUpperCase(),
    assetClass,
    marketValueUsd: toFiniteNumber(position.market_value)
  };
}

export function assertPaperEnvironment() {
  const baseUrl = normalizeAlpacaBaseUrl(process.env.ALPACA_PAPER_BASE_URL ?? "https://paper-api.alpaca.markets");
  const liveFlag = process.env.ALPACA_LIVE_TRADE?.trim().toLowerCase();
  const paperFlag = process.env.ALPACA_PAPER_TRADE?.trim().toLowerCase();

  if (baseUrl === "https://api.alpaca.markets" || liveFlag === "true" || paperFlag === "false") {
    throw new Error("Live Alpaca trading configuration detected. Guardian only supports paper trading.");
  }

  if (!baseUrl.includes("paper-api.alpaca.markets")) {
    throw new Error("Alpaca paper endpoint could not be verified. Set ALPACA_PAPER_BASE_URL to https://paper-api.alpaca.markets.");
  }
}

function getPaperAlpacaConfig() {
  assertPaperEnvironment();

  return {
    key: process.env.ALPACA_API_KEY ?? process.env.APCA_API_KEY_ID,
    secret: process.env.ALPACA_SECRET_KEY ?? process.env.APCA_API_SECRET_KEY,
    baseUrl: normalizeAlpacaBaseUrl(process.env.ALPACA_PAPER_BASE_URL ?? "https://paper-api.alpaca.markets")
  };
}

function buildOrderBody(intent: TradeIntent) {
  const body: Record<string, string | number> = {
    symbol: intent.assetClass === "crypto" ? toAlpacaCryptoSymbol(intent.symbol) : intent.symbol,
    side: intent.side,
    type: intent.orderType,
    time_in_force: intent.timeInForce,
    client_order_id: intent.clientOrderId
  };

  if (intent.assetClass === "us_option") {
    body.qty = intent.quantity ?? 1;
  } else if (intent.quantity) {
    body.qty = intent.quantity;
  } else {
    body.notional = Number(intent.notionalUsd.toFixed(2));
  }

  if (intent.limitPrice) {
    body.limit_price = Number(intent.limitPrice.toFixed(2));
  }

  if (intent.stopPrice) {
    body.stop_price = Number(intent.stopPrice.toFixed(2));
  }

  return body;
}

function maskAccountId(value: string) {
  if (value.length <= 8) {
    return "****";
  }

  return `****-${value.slice(-4)}`;
}

function normalizeAlpacaBaseUrl(value: string) {
  return value.replace(/\/+$/, "").replace(/\/v2$/, "");
}

function normalizeAssetClass(value: unknown): AssetClass {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "crypto") {
    return "crypto";
  }

  if (normalized === "us_option" || normalized === "option") {
    return "us_option";
  }

  return "us_equity";
}

function normalizeCryptoPair(value: string) {
  const symbol = value.trim().toUpperCase().replace("-", "/");

  if (symbol.includes("/")) {
    return symbol;
  }

  if (symbol.endsWith("USD") && symbol.length > 3) {
    return `${symbol.slice(0, -3)}/USD`;
  }

  if (symbol.endsWith("USDT") && symbol.length > 4) {
    return `${symbol.slice(0, -4)}/USDT`;
  }

  return symbol;
}

function toAlpacaCryptoSymbol(value: string) {
  return value.trim().toUpperCase().replace("/", "").replace("-", "");
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function alpacaFetch(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AlpacaRequestTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Alpaca paper API request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOptionSearch(search: OptionContractSearch): Required<Pick<OptionContractSearch, "underlying" | "type" | "expirationDateGte" | "expirationDateLte" | "limit">> & Pick<OptionContractSearch, "strikePriceGte" | "strikePriceLte"> {
  const dates = getDefaultOptionDateRange();
  return {
    underlying: search.underlying.trim().toUpperCase() || "SPY",
    type: search.type,
    expirationDateGte: search.expirationDateGte || dates.expirationDateGte,
    expirationDateLte: search.expirationDateLte || dates.expirationDateLte,
    strikePriceGte: search.strikePriceGte,
    strikePriceLte: search.strikePriceLte,
    limit: Math.min(Math.max(search.limit ?? 12, 1), 50)
  };
}

function mapAlpacaOptionContract(contract: AlpacaOptionContract): OptionContract {
  return {
    id: contract.id ? String(contract.id) : undefined,
    symbol: String(contract.symbol ?? "").toUpperCase(),
    name: String(contract.name ?? contract.symbol ?? "Option contract"),
    status: String(contract.status ?? "unknown"),
    tradable: Boolean(contract.tradable),
    underlyingSymbol: String(contract.underlying_symbol ?? contract.root_symbol ?? "").toUpperCase(),
    rootSymbol: String(contract.root_symbol ?? contract.underlying_symbol ?? "").toUpperCase(),
    type: String(contract.type ?? "call").toLowerCase() === "put" ? "put" : "call",
    style: String(contract.style ?? "american"),
    expirationDate: String(contract.expiration_date ?? ""),
    strikePrice: toFiniteNumber(contract.strike_price),
    size: toFiniteNumber(contract.size) || 100,
    closePrice: contract.close_price === undefined ? undefined : toFiniteNumber(contract.close_price),
    openInterest: contract.open_interest === undefined ? undefined : toFiniteNumber(contract.open_interest)
  };
}

function getMockOptionContracts(search: Required<Pick<OptionContractSearch, "underlying" | "type" | "expirationDateGte" | "expirationDateLte" | "limit">> & Pick<OptionContractSearch, "strikePriceGte" | "strikePriceLte">): OptionContract[] {
  const expiration = search.expirationDateLte;
  const underlying = search.underlying;
  const baseStrike = search.strikePriceGte ?? 500;

  return Array.from({ length: Math.min(search.limit, 6) }, (_, index) => {
    const strike = baseStrike + index * 5;
    const strikeCode = String(Math.round(strike * 1000)).padStart(8, "0");
    const expiryCode = expiration.slice(2).replaceAll("-", "");
    const sideCode = search.type === "call" ? "C" : "P";

    return {
      id: `mock-${underlying}-${search.type}-${strike}`,
      symbol: `${underlying}${expiryCode}${sideCode}${strikeCode}`,
      name: `${underlying} ${expiration} ${strike} ${search.type}`,
      status: "active",
      tradable: true,
      underlyingSymbol: underlying,
      rootSymbol: underlying,
      type: search.type,
      style: "american",
      expirationDate: expiration,
      strikePrice: strike,
      size: 100,
      closePrice: Number((1.1 + index * 0.18).toFixed(2)),
      openInterest: 100 + index * 24
    };
  });
}
