import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export type AgentResearchSymbol = {
  symbol: string;
  score: number;
  totalReturnPercent?: number;
  maxDrawdownPercent?: number;
  winRatePercent?: number;
  tradeCount?: number;
  sharpe?: number;
};

export type AgentResearchContext = {
  available: boolean;
  sourcePath?: string;
  strategyName?: string;
  generatedAt?: string;
  disclosure: string;
  symbols: AgentResearchSymbol[];
};

const ResearchDisclosure = "Backtest research is hypothetical historical simulation, not actual performance or investment advice. Backtested results do not guarantee future results.";

const LooseSummarySchema = z.record(z.unknown());

export async function readLatestResearchContext(runsDir = path.join(process.cwd(), "runs")): Promise<AgentResearchContext> {
  const summaries = await findSummaryFiles(runsDir);
  if (summaries.length === 0) {
    return {
      available: false,
      disclosure: ResearchDisclosure,
      symbols: []
    };
  }

  const latest = summaries.sort((a, b) => b.localeCompare(a))[0];
  try {
    const raw = await readFile(latest, "utf8");
    const summary = LooseSummarySchema.parse(JSON.parse(raw));
    const symbols = extractResearchSymbols(summary);

    return {
      available: symbols.length > 0,
      sourcePath: latest,
      strategyName: stringFrom(summary.strategy_name) ?? stringFrom(summary.strategyName) ?? path.basename(path.dirname(latest)),
      generatedAt: stringFrom(summary.generated_at) ?? stringFrom(summary.generatedAt) ?? stringFrom(summary.created_at),
      disclosure: ResearchDisclosure,
      symbols
    };
  } catch {
    return {
      available: false,
      sourcePath: latest,
      disclosure: ResearchDisclosure,
      symbols: []
    };
  }
}

export function getResearchBias(symbol: string, research: AgentResearchContext | undefined) {
  const match = research?.symbols.find((item) => item.symbol === symbol.toUpperCase());
  return match?.score ?? 0;
}

async function findSummaryFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findSummaryFiles(entryPath);
      }

      return entry.isFile() && entry.name === "summary.json" ? [entryPath] : [];
    }));

    return nested.flat();
  } catch {
    return [];
  }
}

function extractResearchSymbols(summary: Record<string, unknown>): AgentResearchSymbol[] {
  const candidates = [
    summary.symbols,
    summary.symbol_metrics,
    summary.metrics_by_symbol,
    summary.by_symbol,
    summary.leaderboard
  ];

  for (const candidate of candidates) {
    const extracted = parseSymbolCollection(candidate);
    if (extracted.length > 0) {
      return extracted.sort((a, b) => b.score - a.score);
    }
  }

  const symbol = stringFrom(summary.symbol);
  if (!symbol) {
    return [];
  }

  const singleSymbol = buildResearchSymbol(symbol, summary);
  return singleSymbol ? [singleSymbol] : [];
}

function parseSymbolCollection(value: unknown): AgentResearchSymbol[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "object" && item ? buildResearchSymbol(stringFrom((item as Record<string, unknown>).symbol), item as Record<string, unknown>) : null)
      .filter((item): item is AgentResearchSymbol => Boolean(item));
  }

  if (typeof value === "object" && value) {
    return Object.entries(value)
      .map(([symbol, metrics]) => typeof metrics === "object" && metrics
        ? buildResearchSymbol(symbol, metrics as Record<string, unknown>)
        : null)
      .filter((item): item is AgentResearchSymbol => Boolean(item));
  }

  return [];
}

function buildResearchSymbol(symbolInput: string | undefined, metrics: Record<string, unknown>): AgentResearchSymbol | null {
  const symbol = symbolInput?.trim().toUpperCase();
  if (!symbol) {
    return null;
  }

  const totalReturnPercent = numberFrom(metrics.total_return_pct) ?? numberFrom(metrics.totalReturnPercent) ?? numberFrom(metrics.return_pct);
  const maxDrawdownPercent = numberFrom(metrics.max_drawdown_pct) ?? numberFrom(metrics.maxDrawdownPercent) ?? numberFrom(metrics.max_drawdown);
  const winRatePercent = numberFrom(metrics.win_rate_pct) ?? numberFrom(metrics.winRatePercent) ?? numberFrom(metrics.win_rate);
  const tradeCount = numberFrom(metrics.trade_count) ?? numberFrom(metrics.trades);
  const sharpe = numberFrom(metrics.sharpe) ?? numberFrom(metrics.sharpe_ratio);
  const explicitScore = numberFrom(metrics.score);

  const score = explicitScore ?? calculateResearchScore({
    totalReturnPercent,
    maxDrawdownPercent,
    winRatePercent,
    tradeCount,
    sharpe
  });

  return {
    symbol,
    score: Number(score.toFixed(4)),
    totalReturnPercent,
    maxDrawdownPercent,
    winRatePercent,
    tradeCount,
    sharpe
  };
}

function calculateResearchScore({
  totalReturnPercent = 0,
  maxDrawdownPercent = 0,
  winRatePercent = 50,
  tradeCount = 0,
  sharpe = 0
}: {
  totalReturnPercent?: number;
  maxDrawdownPercent?: number;
  winRatePercent?: number;
  tradeCount?: number;
  sharpe?: number;
}) {
  const returnComponent = Math.max(-0.2, Math.min(0.35, totalReturnPercent / 100));
  const drawdownPenalty = Math.max(0, Math.min(0.25, Math.abs(maxDrawdownPercent) / 100));
  const winRateComponent = Math.max(-0.1, Math.min(0.15, (winRatePercent - 50) / 200));
  const tradeCountPenalty = tradeCount < 3 ? 0.05 : 0;
  const sharpeComponent = Math.max(-0.1, Math.min(0.2, sharpe / 10));

  return returnComponent + winRateComponent + sharpeComponent - drawdownPenalty - tradeCountPenalty;
}

function numberFrom(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
