import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { defaultPolicy } from "@/lib/policy/types";
import { demoPortfolio, demoTradeIntents } from "@/lib/trade/mock-data";

describe("evaluatePolicy", () => {
  it("approves a small allowed equity trade", () => {
    const decision = evaluatePolicy({
      intent: demoTradeIntents[0],
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(true);
    expect(decision.requiresHumanApproval).toBe(false);
  });

  it("blocks trades above the global notional cap", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[1],
        notionalUsd: 6_000,
        clientOrderId: "guardian-test-global-cap"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Trade notional exceeds the global $5000 cap.");
  });

  it("blocks crypto trades above the crypto-specific notional cap", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[2],
        notionalUsd: 1_200,
        clientOrderId: "guardian-test-crypto-cap"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Crypto trade notional exceeds the $1000 crypto cap.");
  });

  it("blocks disallowed crypto pairs", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[2],
        symbol: "DOGE/USD",
        clientOrderId: "guardian-test-disallowed"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("DOGE/USD is not in the crypto allowlist.");
  });

  it("allows crypto sells only when they reduce an existing spot position", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[2],
        id: "intent-sell-sol",
        side: "sell",
        notionalUsd: 250,
        clientOrderId: "guardian-test-crypto-exit"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(true);
  });

  it("blocks crypto sells that would open a short", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[2],
        id: "intent-short-sol",
        side: "sell",
        notionalUsd: 2_000,
        clientOrderId: "guardian-test-crypto-short"
      },
      policy: defaultPolicy,
      portfolio: {
        ...demoPortfolio,
        cryptoMarketValueUsd: 0,
        openPositions: demoPortfolio.openPositions.filter((position) => position.assetClass !== "crypto")
      }
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Crypto short selling is not allowed.");
  });

  it("requires human approval above the configured threshold", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[0],
        notionalUsd: 3_000,
        clientOrderId: "guardian-test-approval"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(true);
    expect(decision.requiresHumanApproval).toBe(true);
  });

  it("allows bounded paper shorts when short selling is enabled", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[0],
        id: "intent-short-msft",
        symbol: "MSFT",
        side: "sell",
        notionalUsd: 1_000,
        clientOrderId: "guardian-test-short-msft"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(true);
  });

  it("blocks shorts above the position exposure cap", () => {
    const decision = evaluatePolicy({
      intent: {
        ...demoTradeIntents[0],
        id: "intent-short-too-large",
        symbol: "AAPL",
        side: "sell",
        notionalUsd: 10_000,
        clientOrderId: "guardian-test-short-large"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Trade notional exceeds the global $5000 cap.");
    expect(decision.reasons).toContain("Position exposure would exceed 30% of portfolio value.");
  });

  it("blocks options while options are disabled by policy", () => {
    const decision = evaluatePolicy({
      intent: {
        id: "intent-option-disabled",
        source: "mock_ai",
        rationale: "Buy one SPY call as a paper options strategy test.",
        assetClass: "us_option",
        symbol: "SPY260116C00500000",
        side: "buy",
        orderType: "limit",
        timeInForce: "day",
        notionalUsd: 125,
        quantity: 1,
        limitPrice: 1.25,
        clientOrderId: "guardian-option-disabled"
      },
      policy: { ...defaultPolicy, allowOptions: false },
      portfolio: demoPortfolio,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Options trading is disabled by policy.");
  });

  it("approves a small allowed option when options are enabled", () => {
    const decision = evaluatePolicy({
      intent: {
        id: "intent-option-enabled",
        source: "mock_ai",
        rationale: "Buy one SPY call as a paper options strategy test.",
        assetClass: "us_option",
        symbol: "SPY260116C00500000",
        side: "buy",
        orderType: "limit",
        timeInForce: "day",
        notionalUsd: 125,
        quantity: 1,
        limitPrice: 1.25,
        clientOrderId: "guardian-option-enabled"
      },
      policy: { ...defaultPolicy, allowOptions: true },
      portfolio: demoPortfolio,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(decision.approved).toBe(true);
  });

  it("blocks malformed option symbols and near-expiry contracts", () => {
    const decision = evaluatePolicy({
      intent: {
        id: "intent-option-risky",
        source: "mock_ai",
        rationale: "Try a near-expiry option contract that should be blocked.",
        assetClass: "us_option",
        symbol: "SPY260102P00500000",
        side: "buy",
        orderType: "limit",
        timeInForce: "day",
        notionalUsd: 125,
        quantity: 1,
        limitPrice: 1.25,
        clientOrderId: "guardian-option-risky"
      },
      policy: { ...defaultPolicy, allowOptions: true },
      portfolio: demoPortfolio,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Option expires in 2 days, below the 7-day minimum.");
  });

  it("blocks option premium above the policy cap", () => {
    const decision = evaluatePolicy({
      intent: {
        id: "intent-option-large-premium",
        source: "mock_ai",
        rationale: "Buy one expensive SPY call that should exceed the option premium cap.",
        assetClass: "us_option",
        symbol: "SPY260116C00500000",
        side: "buy",
        orderType: "limit",
        timeInForce: "day",
        notionalUsd: 650,
        quantity: 1,
        limitPrice: 6.5,
        clientOrderId: "guardian-option-premium-cap"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Estimated option premium exceeds the $600 cap.");
  });

  it("blocks naked option sells even when equity shorts are enabled", () => {
    const decision = evaluatePolicy({
      intent: {
        id: "intent-option-naked-sell",
        source: "mock_ai",
        rationale: "Sell one SPY call without an existing option position.",
        assetClass: "us_option",
        symbol: "SPY260116C00500000",
        side: "sell",
        orderType: "limit",
        timeInForce: "day",
        notionalUsd: 125,
        quantity: 1,
        limitPrice: 1.25,
        clientOrderId: "guardian-option-naked-sell"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("Opening short options positions is disabled by policy.");
  });
});
