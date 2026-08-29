import type { PortfolioSnapshot, TradeIntent } from "@/lib/trade/types";
import { parseOptionSymbol } from "@/lib/options/contracts";
import type { Policy, PolicyDecision } from "./types";

type EvaluationInput = {
  intent: TradeIntent;
  policy: Policy;
  portfolio: PortfolioSnapshot;
  recentCryptoTradeAt?: Date | null;
  now?: Date;
};

export function evaluatePolicy({
  intent,
  policy,
  portfolio,
  recentCryptoTradeAt,
  now = new Date()
}: EvaluationInput): PolicyDecision {
  const reasons: string[] = [];

  if (!policy.paperOnly) {
    reasons.push("Policy must remain in paper-only mode for this hackathon build.");
  }

  if (policy.blockedSymbols.includes(intent.symbol)) {
    reasons.push(`${intent.symbol} is blocked by policy.`);
  }

  if (intent.notionalUsd > policy.maxTradeNotionalUsd) {
    reasons.push(`Trade notional exceeds the global $${policy.maxTradeNotionalUsd} cap.`);
  }

  const dailyLossPercent = portfolio.equityUsd > 0 ? Math.abs(Math.min(0, portfolio.dailyPnlUsd)) / portfolio.equityUsd * 100 : 0;
  if (dailyLossPercent >= policy.maxDailyLossPercent) {
    reasons.push(`Daily loss limit of ${policy.maxDailyLossPercent}% has been reached.`);
  }

  if (intent.side === "sell" && !policy.allowShortSelling) {
    const position = portfolio.openPositions.find((item) => item.symbol === intent.symbol);
    if (!position || position.marketValueUsd < intent.notionalUsd) {
      reasons.push("Short selling is disabled and the account does not hold enough of this asset.");
    }
  }

  if (intent.assetClass === "us_equity") {
    if (!policy.allowedEquitySymbols.includes(intent.symbol)) {
      reasons.push(`${intent.symbol} is not in the equity allowlist.`);
    }

    if (intent.timeInForce === "gtc" && intent.orderType === "market") {
      reasons.push("Market equity orders should use day time-in-force.");
    }
  }

  if (intent.assetClass === "crypto") {
    if (!policy.allowedCryptoPairs.includes(intent.symbol)) {
      reasons.push(`${intent.symbol} is not in the crypto allowlist.`);
    }

    if (intent.notionalUsd > policy.maxCryptoTradeNotionalUsd) {
      reasons.push(`Crypto trade notional exceeds the $${policy.maxCryptoTradeNotionalUsd} crypto cap.`);
    }

    const nextCryptoValue = intent.side === "buy"
      ? portfolio.cryptoMarketValueUsd + intent.notionalUsd
      : Math.max(0, portfolio.cryptoMarketValueUsd - intent.notionalUsd);
    const nextCryptoPercent = portfolio.equityUsd > 0 ? nextCryptoValue / portfolio.equityUsd * 100 : 0;

    if (nextCryptoPercent > policy.maxCryptoPortfolioPercent) {
      reasons.push(`Crypto exposure would exceed ${policy.maxCryptoPortfolioPercent}% of portfolio value.`);
    }

    if (recentCryptoTradeAt) {
      const minutesSinceLastCryptoTrade = (now.getTime() - recentCryptoTradeAt.getTime()) / 60_000;
      if (minutesSinceLastCryptoTrade < policy.cryptoCooldownMinutes) {
        reasons.push(`Crypto cooldown is active for ${Math.ceil(policy.cryptoCooldownMinutes - minutesSinceLastCryptoTrade)} more minutes.`);
      }
    }

    if (intent.side === "sell") {
      const position = portfolio.openPositions.find((item) => item.symbol === intent.symbol && item.assetClass === "crypto");
      if (!position || position.marketValueUsd < intent.notionalUsd) {
        reasons.push("Crypto short selling is not allowed.");
      }
    }
  }

  if (intent.assetClass === "us_option") {
    const contract = parseOptionSymbol(intent.symbol, now);
    const contracts = intent.quantity ?? 0;

    if (!policy.allowOptions) {
      reasons.push("Options trading is disabled by policy.");
    }

    if (!contract) {
      reasons.push("Option symbol must use OCC format, for example SPY260116C00500000.");
    } else {
      if (!policy.allowedOptionUnderlyings.includes(contract.underlying)) {
        reasons.push(`${contract.underlying} is not in the options underlying allowlist.`);
      }

      if (contract.daysToExpiry < policy.minOptionDaysToExpiry) {
        reasons.push(`Option expires in ${contract.daysToExpiry} days, below the ${policy.minOptionDaysToExpiry}-day minimum.`);
      }
    }

    if (!intent.quantity || !Number.isInteger(intent.quantity)) {
      reasons.push("Options require a whole-number contract quantity.");
    } else if (contracts > policy.maxOptionContracts) {
      reasons.push(`Option contract quantity exceeds the ${policy.maxOptionContracts}-contract cap.`);
    }

    if (intent.notionalUsd > policy.maxOptionPremiumUsd) {
      reasons.push(`Estimated option premium exceeds the $${policy.maxOptionPremiumUsd} cap.`);
    }

    if (intent.orderType !== "market" && intent.orderType !== "limit") {
      reasons.push("Options support market or limit orders in this module.");
    }

    if (intent.timeInForce !== "day") {
      reasons.push("Options orders use day time-in-force in this module.");
    }

    if (intent.side === "sell") {
      const position = portfolio.openPositions.find((item) => item.symbol === intent.symbol && item.assetClass === "us_option");
      if (!position || position.marketValueUsd < intent.notionalUsd) {
        reasons.push("Opening short options positions is disabled by policy.");
      }
    }
  }

  const nextPositionValue = getProjectedAbsolutePositionValue(portfolio, intent);
  const nextPositionPercent = portfolio.equityUsd > 0 ? nextPositionValue / portfolio.equityUsd * 100 : 0;
  if (nextPositionPercent > policy.maxPositionPercent) {
    reasons.push(`Position exposure would exceed ${policy.maxPositionPercent}% of portfolio value.`);
  }

  return {
    approved: reasons.length === 0,
    requiresHumanApproval: intent.notionalUsd > policy.requireHumanApprovalAboveUsd,
    reasons: reasons.length === 0 ? ["All deterministic policy checks passed."] : reasons
  };
}

function getCurrentPositionValue(portfolio: PortfolioSnapshot, symbol: string) {
  return portfolio.openPositions.find((item) => item.symbol === symbol)?.marketValueUsd ?? 0;
}

function getProjectedAbsolutePositionValue(portfolio: PortfolioSnapshot, intent: TradeIntent) {
  const currentValue = getCurrentPositionValue(portfolio, intent.symbol);

  if (intent.side === "buy") {
    return Math.abs(currentValue + intent.notionalUsd);
  }

  return Math.abs(currentValue - intent.notionalUsd);
}
