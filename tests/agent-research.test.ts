import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { getResearchBias, readLatestResearchContext } from "@/lib/agent/research";

describe("readLatestResearchContext", () => {
  it("loads symbol metrics from the latest backtest summary", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "guardian-runs-"));
    const runDir = join(runsDir, "2026-08-27_momentum");
    await mkdir(runDir);
    await writeFile(join(runDir, "summary.json"), JSON.stringify({
      strategy_name: "Momentum research",
      generated_at: "2026-08-27T00:00:00.000Z",
      symbols: [
        {
          symbol: "SPY",
          total_return_pct: 12,
          max_drawdown_pct: 4,
          win_rate_pct: 58,
          trade_count: 12,
          sharpe: 1.1
        },
        {
          symbol: "NVDA",
          total_return_pct: -6,
          max_drawdown_pct: 18,
          win_rate_pct: 42,
          trade_count: 8
        }
      ]
    }));

    const research = await readLatestResearchContext(runsDir);

    expect(research.available).toBe(true);
    expect(research.strategyName).toBe("Momentum research");
    expect(research.symbols[0].symbol).toBe("SPY");
    expect(research.symbols[0].sharpe).toBe(1.1);
    expect(getResearchBias("SPY", research)).toBeGreaterThan(0);
    expect(getResearchBias("NVDA", research)).toBeLessThan(0);
  });

  it("returns unavailable context when no summary exists", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "guardian-empty-runs-"));
    const research = await readLatestResearchContext(runsDir);

    expect(research.available).toBe(false);
    expect(research.symbols).toHaveLength(0);
  });
});
