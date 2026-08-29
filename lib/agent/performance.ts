import type { GuardedExecutionResult, PortfolioSnapshot } from "@/lib/trade/types";

export type AgentPerformanceSummary = {
  strategyName: string;
  strategyStatus: "normal" | "defensive" | "needs_data";
  competitionScore: number;
  competitionGrade: "warming_up" | "engaging" | "competitive" | "standout";
  competitionBrief: string[];
  dailyPnlUsd: number;
  dailyPnlPercent: number;
  cashPercent: number;
  totalDecisions: number;
  submittedCount: number;
  blockedCount: number;
  reviewCount: number;
  failedCount: number;
  approvalRate: number;
  submittedNotionalUsd: number;
  blockedNotionalUsd: number;
  largestPositionPercent: number;
  latestDecisionAt?: string;
};

export function summarizeAgentPerformance(
  receipts: GuardedExecutionResult[],
  portfolio: PortfolioSnapshot
): AgentPerformanceSummary {
  const totalDecisions = receipts.length;
  const submittedCount = receipts.filter((receipt) => isExecutionStatus(receipt.status)).length;
  const blockedCount = receipts.filter((receipt) => receipt.status === "blocked").length;
  const reviewCount = receipts.filter((receipt) => receipt.status === "approved").length;
  const failedCount = receipts.filter((receipt) => isFailedStatus(receipt.status)).length;
  const submittedNotionalUsd = sumExecutionNotional(receipts);
  const blockedNotionalUsd = sumNotional(receipts, "blocked");
  const resolvedCount = submittedCount + blockedCount + reviewCount + failedCount;
  const approvalRate = resolvedCount === 0 ? 0 : (submittedCount + reviewCount) / resolvedCount * 100;
  const equity = Math.max(portfolio.equityUsd, 1);
  const largestPosition = portfolio.openPositions.reduce((largest, position) => {
    return Math.max(largest, Math.abs(position.marketValueUsd));
  }, 0);
  const dailyPnlPercent = portfolio.dailyPnlUsd / equity * 100;
  const cashPercent = Math.max(0, portfolio.cashUsd) / equity * 100;
  const largestPositionPercent = largestPosition / equity * 100;
  const competitionScore = calculateCompetitionScore({
    dailyPnlPercent,
    totalDecisions,
    submittedCount,
    blockedCount,
    failedCount,
    approvalRate,
    cashPercent,
    largestPositionPercent
  });

  return {
    strategyName: "Policy-bound momentum scout",
    strategyStatus: totalDecisions === 0 ? "needs_data" : portfolio.dailyPnlUsd < 0 ? "defensive" : "normal",
    competitionScore,
    competitionGrade: gradeCompetitionScore(competitionScore),
    competitionBrief: buildCompetitionBrief({
      dailyPnlUsd: portfolio.dailyPnlUsd,
      dailyPnlPercent,
      totalDecisions,
      submittedCount,
      blockedCount,
      approvalRate,
      cashPercent,
      largestPositionPercent
    }),
    dailyPnlUsd: portfolio.dailyPnlUsd,
    dailyPnlPercent,
    cashPercent,
    totalDecisions,
    submittedCount,
    blockedCount,
    reviewCount,
    failedCount,
    approvalRate,
    submittedNotionalUsd,
    blockedNotionalUsd,
    largestPositionPercent,
    latestDecisionAt: receipts[0]?.createdAt
  };
}

function sumNotional(receipts: GuardedExecutionResult[], status: GuardedExecutionResult["status"]) {
  return receipts
    .filter((receipt) => receipt.status === status)
    .reduce((total, receipt) => total + receipt.intent.notionalUsd, 0);
}

function sumExecutionNotional(receipts: GuardedExecutionResult[]) {
  return receipts
    .filter((receipt) => isExecutionStatus(receipt.status))
    .reduce((total, receipt) => total + receipt.intent.notionalUsd, 0);
}

function isExecutionStatus(status: GuardedExecutionResult["status"]) {
  return ["submitted", "partially_filled", "filled"].includes(status);
}

function isFailedStatus(status: GuardedExecutionResult["status"]) {
  return ["failed", "rejected", "canceled", "expired"].includes(status);
}

function calculateCompetitionScore(input: {
  dailyPnlPercent: number;
  totalDecisions: number;
  submittedCount: number;
  blockedCount: number;
  failedCount: number;
  approvalRate: number;
  cashPercent: number;
  largestPositionPercent: number;
}) {
  const pnlScore = clamp(35 + input.dailyPnlPercent * 8, 0, 45);
  const engagementScore = clamp(input.totalDecisions * 4 + input.submittedCount * 6, 0, 25);
  const guardrailScore = clamp(input.approvalRate / 5 + input.blockedCount * 2 - input.failedCount * 5, 0, 20);
  const riskScore = input.cashPercent >= 10 && input.largestPositionPercent <= 35 ? 10 : 4;

  return Math.round(clamp(pnlScore + engagementScore + guardrailScore + riskScore, 0, 100));
}

function gradeCompetitionScore(score: number): AgentPerformanceSummary["competitionGrade"] {
  if (score >= 85) {
    return "standout";
  }

  if (score >= 70) {
    return "competitive";
  }

  if (score >= 45) {
    return "engaging";
  }

  return "warming_up";
}

function buildCompetitionBrief(input: {
  dailyPnlUsd: number;
  dailyPnlPercent: number;
  totalDecisions: number;
  submittedCount: number;
  blockedCount: number;
  approvalRate: number;
  cashPercent: number;
  largestPositionPercent: number;
}) {
  if (input.totalDecisions === 0) {
    return [
      "No autonomous decisions have been recorded yet.",
      "Run a decision-only scan first, then enable tiny paper auto-submit once the receipts look correct.",
      "The demo is strongest when judges can see recent decisions, policy checks, and live paper P&L together."
    ];
  }

  return [
    `${formatSignedUsd(input.dailyPnlUsd)} daily paper P&L (${formatSignedPercent(input.dailyPnlPercent)}).`,
    `${input.submittedCount} of ${input.totalDecisions} decisions reached paper execution or approval, with ${input.blockedCount} blocked by policy.`,
    `Approval rate is ${input.approvalRate.toFixed(1)}%, cash reserve is ${input.cashPercent.toFixed(1)}%, and largest position is ${input.largestPositionPercent.toFixed(1)}%.`,
    "Creative angle: the same guarded agent is usable from Telegram, web, and MCP, while deterministic policy keeps paper execution bounded."
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatSignedUsd(value: number) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatSignedPercent(value: number) {
  const formatted = `${Math.abs(value).toFixed(2)}%`;

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}
