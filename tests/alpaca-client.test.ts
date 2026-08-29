import { afterEach, describe, expect, it } from "vitest";
import { assertPaperEnvironment, mapAlpacaPositionToSnapshotPosition } from "@/lib/alpaca/client";

const originalEnv = { ...process.env };

describe("assertPaperEnvironment", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows the default paper endpoint", () => {
    delete process.env.ALPACA_PAPER_BASE_URL;
    delete process.env.ALPACA_LIVE_TRADE;
    delete process.env.ALPACA_PAPER_TRADE;

    expect(() => assertPaperEnvironment()).not.toThrow();
  });

  it("blocks the live Alpaca endpoint", () => {
    process.env.ALPACA_PAPER_BASE_URL = "https://api.alpaca.markets";

    expect(() => assertPaperEnvironment()).toThrow("Live Alpaca trading configuration detected.");
  });

  it("blocks live trading flags", () => {
    process.env.ALPACA_LIVE_TRADE = "true";

    expect(() => assertPaperEnvironment()).toThrow("Live Alpaca trading configuration detected.");
  });

  it("blocks explicit paper false", () => {
    process.env.ALPACA_PAPER_TRADE = "false";

    expect(() => assertPaperEnvironment()).toThrow("Live Alpaca trading configuration detected.");
  });
});

describe("mapAlpacaPositionToSnapshotPosition", () => {
  it("normalizes Alpaca crypto symbols into readable pairs", () => {
    expect(mapAlpacaPositionToSnapshotPosition({
      symbol: "SOLUSD",
      asset_class: "crypto",
      market_value: "123.45"
    })).toEqual({
      symbol: "SOL/USD",
      assetClass: "crypto",
      marketValueUsd: 123.45
    });
  });

  it("keeps equity symbols uppercase", () => {
    expect(mapAlpacaPositionToSnapshotPosition({
      symbol: "voo",
      asset_class: "us_equity",
      market_value: "2500"
    })).toEqual({
      symbol: "VOO",
      assetClass: "us_equity",
      marketValueUsd: 2500
    });
  });
});
