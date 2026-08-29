export type OptionContractDetails = {
  symbol: string;
  underlying: string;
  expiration: Date;
  expirationIso: string;
  side: "call" | "put";
  strikePrice: number;
  daysToExpiry: number;
};

export type OptionContractSearch = {
  underlying: string;
  type: "call" | "put";
  expirationDateGte?: string;
  expirationDateLte?: string;
  strikePriceGte?: number;
  strikePriceLte?: number;
  limit?: number;
};

export type OptionContract = {
  id?: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  underlyingSymbol: string;
  rootSymbol: string;
  type: "call" | "put";
  style: string;
  expirationDate: string;
  strikePrice: number;
  size: number;
  closePrice?: number;
  openInterest?: number;
};

const OptionSymbolRegex = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

export function parseOptionSymbol(symbol: string, now = new Date()): OptionContractDetails | null {
  const normalized = symbol.trim().toUpperCase();
  const match = normalized.match(OptionSymbolRegex);
  if (!match) {
    return null;
  }

  const [, underlying, year, month, day, side, strike] = match;
  const fullYear = 2000 + Number(year);
  const monthIndex = Number(month) - 1;
  const dayOfMonth = Number(day);
  const expiration = new Date(Date.UTC(fullYear, monthIndex, dayOfMonth, 20, 0, 0));

  if (
    expiration.getUTCFullYear() !== fullYear ||
    expiration.getUTCMonth() !== monthIndex ||
    expiration.getUTCDate() !== dayOfMonth
  ) {
    return null;
  }

  const strikePrice = Number(strike) / 1000;
  const daysToExpiry = Math.ceil((expiration.getTime() - now.getTime()) / 86_400_000);

  return {
    symbol: normalized,
    underlying,
    expiration,
    expirationIso: expiration.toISOString().slice(0, 10),
    side: side === "C" ? "call" : "put",
    strikePrice,
    daysToExpiry
  };
}

export function estimateOptionPremiumNotionalUsd(contractLimitPrice: number, contracts: number) {
  return contractLimitPrice * contracts * 100;
}

export function getDefaultOptionDateRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 45));

  return {
    expirationDateGte: start.toISOString().slice(0, 10),
    expirationDateLte: end.toISOString().slice(0, 10)
  };
}
