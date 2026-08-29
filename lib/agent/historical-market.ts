export type HistoricalMarketSignal = {
  symbol: string;
  available: boolean;
  lookbackDays: number;
  latestClose?: number;
  momentumPercent?: number;
  volatilityPercent?: number;
  score: number;
  reason: string;
};

type AlpacaBarsResponse = {
  bars?: Record<string, Array<{ c?: number | string; t?: string }>>;
};

const DataRequestTimeoutMs = 10_000;

export async function readHistoricalMarketSignals(symbols: string[]): Promise<HistoricalMarketSignal[]> {
  const equitySymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol && !symbol.includes("/"));

  if (equitySymbols.length === 0) {
    return [];
  }

  const key = process.env.ALPACA_API_KEY?.trim() || process.env.APCA_API_KEY_ID?.trim();
  const secret = process.env.ALPACA_SECRET_KEY?.trim() || process.env.APCA_API_SECRET_KEY?.trim();
  if (!key || !secret) {
    return equitySymbols.map((symbol) => unavailableSignal(symbol, "Historical bars unavailable because Alpaca keys are missing."));
  }

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 45);

  const baseUrl = (process.env.ALPACA_DATA_BASE_URL?.trim() || "https://data.alpaca.markets").replace(/\/+$/, "");
  const params = new URLSearchParams({
    symbols: equitySymbols.join(","),
    timeframe: "1Day",
    start: start.toISOString(),
    end: end.toISOString(),
    adjustment: "split",
    feed: process.env.ALPACA_DATA_FEED?.trim() || "iex"
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DataRequestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/v2/stocks/bars?${params.toString()}`, {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const message = await response.text();
      return equitySymbols.map((symbol) => unavailableSignal(symbol, message || `Historical bars failed with ${response.status}.`));
    }

    const data = await response.json() as AlpacaBarsResponse;
    return equitySymbols.map((symbol) => summarizeBarsForSymbol(symbol, data.bars?.[symbol] ?? []));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Historical bars request failed.";
    return equitySymbols.map((symbol) => unavailableSignal(symbol, message));
  } finally {
    clearTimeout(timeout);
  }
}

export function summarizeBarsForSymbol(symbol: string, bars: Array<{ c?: number | string; t?: string }>): HistoricalMarketSignal {
  const closes = bars
    .map((bar) => Number(bar.c))
    .filter((close) => Number.isFinite(close) && close > 0);

  if (closes.length < 6) {
    return unavailableSignal(symbol, "Not enough historical bars to score recent momentum.");
  }

  const latestClose = closes[closes.length - 1];
  const previousClose = closes[closes.length - 6];
  const momentumPercent = (latestClose - previousClose) / previousClose * 100;
  const returns = closes.slice(1).map((close, index) => (close - closes[index]) / closes[index] * 100);
  const meanReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / returns.length;
  const volatilityPercent = Math.sqrt(variance);
  const score = Number(Math.max(-0.25, Math.min(0.35, momentumPercent / 25 - volatilityPercent / 100)).toFixed(4));

  return {
    symbol,
    available: true,
    lookbackDays: closes.length,
    latestClose,
    momentumPercent,
    volatilityPercent,
    score,
    reason: `${symbol} ${closes.length}-bar signal: ${formatSignedPercent(momentumPercent)} momentum, ${volatilityPercent.toFixed(2)}% daily volatility.`
  };
}

function unavailableSignal(symbol: string, reason: string): HistoricalMarketSignal {
  return {
    symbol,
    available: false,
    lookbackDays: 0,
    score: 0,
    reason
  };
}

function formatSignedPercent(value: number) {
  const formatted = `${Math.abs(value).toFixed(2)}%`;
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
}
