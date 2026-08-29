import { describe, expect, it } from "vitest";
import { summarizeBarsForSymbol } from "@/lib/agent/historical-market";

describe("summarizeBarsForSymbol", () => {
  it("scores recent momentum and volatility from daily closes", () => {
    const signal = summarizeBarsForSymbol("SPY", [
      { c: 100 },
      { c: 101 },
      { c: 102 },
      { c: 103 },
      { c: 104 },
      { c: 110 }
    ]);

    expect(signal.available).toBe(true);
    expect(signal.momentumPercent).toBe(10);
    expect(signal.score).toBeGreaterThan(0);
    expect(signal.reason).toContain("SPY");
  });

  it("marks a symbol unavailable when there are too few bars", () => {
    const signal = summarizeBarsForSymbol("MSFT", [{ c: 100 }, { c: 101 }]);

    expect(signal.available).toBe(false);
    expect(signal.score).toBe(0);
  });
});
