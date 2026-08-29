import { z } from "zod";
import type { GuardianAgentConfig } from "@/lib/agent/config";
import type { HistoricalMarketSignal } from "@/lib/agent/historical-market";
import type { AgentResearchContext } from "@/lib/agent/research";
import type { AgentCandidate, AgentModelSelection } from "@/lib/agent/state";
import type { PortfolioSnapshot } from "@/lib/trade/types";

const ModelSelectionSchema = z.object({
  selectedCandidateId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(12).max(500)
});

export async function selectAgentCandidate({
  candidates,
  portfolio,
  config,
  research,
  marketHistory
}: {
  candidates: AgentCandidate[];
  portfolio: PortfolioSnapshot;
  config: GuardianAgentConfig;
  research?: AgentResearchContext;
  marketHistory?: HistoricalMarketSignal[];
}): Promise<AgentModelSelection> {
  const topCandidate = candidates[0];

  if (!topCandidate) {
    throw new Error("No agent candidates were available.");
  }

  if (config.modelProvider === "none") {
    return {
      provider: "none",
      selectedCandidateId: topCandidate.id,
      confidence: 0.55,
      reason: "Deterministic rules selected the highest-scoring candidate."
    };
  }

  try {
    if (config.modelProvider === "ensemble") {
      return await selectWithEnsemble({ candidates, portfolio, config, research, marketHistory });
    }

    return await selectWithModelProvider({ candidates, portfolio, config, research, marketHistory });
  } catch (error) {
    return {
      provider: "fallback",
      selectedCandidateId: topCandidate.id,
      confidence: 0.5,
      reason: "Model selection was unavailable, so deterministic rules selected the highest-scoring candidate.",
      fallbackReason: error instanceof Error ? error.message : "Unknown model error."
    };
  }
}

async function selectWithModelProvider({
  candidates,
  portfolio,
  config,
  research,
  marketHistory
}: {
  candidates: AgentCandidate[];
  portfolio: PortfolioSnapshot;
  config: GuardianAgentConfig;
  research?: AgentResearchContext;
  marketHistory?: HistoricalMarketSignal[];
}): Promise<AgentModelSelection> {
  const provider = getProviderConfig(config);
  const apiKey = provider.apiKey;
  if (!apiKey) {
    throw new Error(`${provider.apiKeyName} is not configured.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(provider.chatCompletionsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://guardian-mcp-eta.vercel.app",
        "X-Title": "Guardian Alpha",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        temperature: 0.1,
        max_tokens: 500,
        ...(provider.supportsJsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: buildSelectionMessages({ candidates, portfolio, research, marketHistory })
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `${provider.name} selection failed with ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${provider.name} returned an empty selection.`);
    }

    const parsed = ModelSelectionSchema.parse(parseJsonObject(content));
    const selected = candidates.find((candidate) => candidate.id === parsed.selectedCandidateId);
    if (!selected) {
      throw new Error(`${provider.name} selected a candidate that was not offered.`);
    }

    return {
      provider: config.modelProvider,
      selectedCandidateId: parsed.selectedCandidateId,
      confidence: parsed.confidence,
      reason: parsed.reason
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function selectWithEnsemble({
  candidates,
  portfolio,
  config,
  research,
  marketHistory
}: {
  candidates: AgentCandidate[];
  portfolio: PortfolioSnapshot;
  config: GuardianAgentConfig;
  research?: AgentResearchContext;
  marketHistory?: HistoricalMarketSignal[];
}): Promise<AgentModelSelection> {
  const [groq, featherless] = await Promise.allSettled([
    selectWithModelProvider({
      candidates,
      portfolio,
      config: { ...config, modelProvider: "groq", modelName: process.env.GROQ_MODEL_NAME?.trim() || "openai/gpt-oss-20b" },
      research,
      marketHistory
    }),
    selectWithModelProvider({
      candidates,
      portfolio,
      config: { ...config, modelProvider: "featherless", modelName: process.env.FEATHERLESS_MODEL_NAME?.trim() || "Qwen/Qwen2.5-7B-Instruct" },
      research,
      marketHistory
    })
  ]);
  const selections = [groq, featherless]
    .filter((result): result is PromiseFulfilledResult<AgentModelSelection> => result.status === "fulfilled")
    .map((result) => result.value);

  if (selections.length === 0) {
    const errors = [groq, featherless]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : "Unknown provider error.");
    throw new Error(`Groq and Featherless were unavailable: ${errors.join(" | ")}`);
  }

  const [first, second] = selections;
  if (second && first.selectedCandidateId === second.selectedCandidateId) {
    return {
      provider: "ensemble",
      selectedCandidateId: first.selectedCandidateId,
      confidence: Number(Math.min(0.99, Math.max(first.confidence, second.confidence) + 0.05).toFixed(2)),
      reason: `Groq and Featherless agreed. ${first.reason}`
    };
  }

  const ranked = selections.sort((a, b) => {
    const scoreDelta = getCandidateScore(candidates, b.selectedCandidateId) - getCandidateScore(candidates, a.selectedCandidateId);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return b.confidence - a.confidence;
  });
  const selected = ranked[0];

  return {
    provider: "ensemble",
    selectedCandidateId: selected.selectedCandidateId,
    confidence: Number(Math.max(0.55, selected.confidence - 0.05).toFixed(2)),
    reason: second
      ? `Groq and Featherless disagreed, so Guardian chose the higher-scoring policy candidate among model picks. Selected: ${selected.reason}`
      : `One reasoning provider was unavailable, so Guardian used ${selected.provider}. ${selected.reason}`,
    fallbackReason: [groq, featherless]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : "Unknown provider error.")
      .join(" | ") || undefined
  };
}

function getProviderConfig(config: GuardianAgentConfig) {
  if (config.modelProvider === "featherless") {
    return {
      name: "Featherless",
      chatCompletionsUrl: "https://api.featherless.ai/v1/chat/completions",
      apiKeyName: "FEATHERLESS_API_KEY",
      apiKey: process.env.FEATHERLESS_API_KEY?.trim() || process.env.FEATHERLESSS_API_KEY?.trim(),
      supportsJsonMode: false
    };
  }

  return {
    name: "Groq",
    chatCompletionsUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKeyName: "GROQ_API_KEY",
    apiKey: process.env.GROQ_API_KEY?.trim(),
    supportsJsonMode: true
  };
}

function getCandidateScore(candidates: AgentCandidate[], candidateId: string) {
  return candidates.find((candidate) => candidate.id === candidateId)?.score ?? Number.NEGATIVE_INFINITY;
}

function buildSelectionMessages({
  candidates,
  portfolio,
  research,
  marketHistory
}: {
  candidates: AgentCandidate[];
  portfolio: PortfolioSnapshot;
  research?: AgentResearchContext;
  marketHistory?: HistoricalMarketSignal[];
}) {
  return [
    {
      role: "system",
      content: "You rank already-constructed Alpaca paper-trading candidates. Return only JSON with selectedCandidateId, confidence, and reason. Do not invent symbols, prices, or orders."
    },
    {
      role: "user",
      content: JSON.stringify({
        instruction: "Choose one candidate for an Alpaca paper-trading alpha agent. Prefer positive expected value, but never choose a candidate whose reasons imply policy risk.",
        portfolio: {
          equityUsd: portfolio.equityUsd,
          cashUsd: portfolio.cashUsd,
          dailyPnlUsd: portfolio.dailyPnlUsd,
          cryptoMarketValueUsd: portfolio.cryptoMarketValueUsd
        },
        historicalResearch: research?.available
          ? {
            strategyName: research.strategyName ?? "Latest backtest",
            generatedAt: research.generatedAt ?? null,
            disclosure: research.disclosure,
            symbols: research.symbols.slice(0, 10).map((symbol) => ({
              symbol: symbol.symbol,
              score: symbol.score,
              totalReturnPercent: symbol.totalReturnPercent ?? null,
              maxDrawdownPercent: symbol.maxDrawdownPercent ?? null,
              winRatePercent: symbol.winRatePercent ?? null,
              tradeCount: symbol.tradeCount ?? null,
              sharpe: symbol.sharpe ?? null
            }))
          }
          : {
            available: false,
            disclosure: "No historical backtest artifact was found. Treat candidate scores as rule-only signals."
          },
        recentMarketHistory: (marketHistory ?? []).map((signal) => ({
          symbol: signal.symbol,
          available: signal.available,
          lookbackDays: signal.lookbackDays,
          latestClose: signal.latestClose ?? null,
          momentumPercent: signal.momentumPercent ?? null,
          volatilityPercent: signal.volatilityPercent ?? null,
          score: signal.score,
          reason: signal.reason
        })),
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          score: candidate.score,
          symbol: candidate.intent.symbol,
          assetClass: candidate.intent.assetClass,
          side: candidate.intent.side,
          notionalUsd: candidate.intent.notionalUsd,
          reasons: candidate.reasons
        }))
      })
    }
  ];
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model did not return valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}
