import { describe, expect, it } from "vitest";
import { estimateOptionPremiumNotionalUsd, parseOptionSymbol } from "@/lib/options/contracts";

describe("parseOptionSymbol", () => {
  it("parses OCC option symbols", () => {
    const contract = parseOptionSymbol("SPY260116C00500000", new Date("2026-01-01T00:00:00.000Z"));

    expect(contract).toMatchObject({
      symbol: "SPY260116C00500000",
      underlying: "SPY",
      expirationIso: "2026-01-16",
      side: "call",
      strikePrice: 500
    });
    expect(contract?.daysToExpiry).toBe(16);
  });

  it("rejects malformed symbols", () => {
    expect(parseOptionSymbol("SPY-CALL-500")).toBeNull();
  });
});

describe("estimateOptionPremiumNotionalUsd", () => {
  it("uses the standard 100-share options multiplier", () => {
    expect(estimateOptionPremiumNotionalUsd(1.25, 2)).toBe(250);
  });
});
