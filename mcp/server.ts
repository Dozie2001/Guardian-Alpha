#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getGuardianAgentConfig } from "../lib/agent/config";
import { runAgentScan } from "../lib/agent/alpha-agent";
import { summarizeAgentPerformance } from "../lib/agent/performance";
import { readLatestResearchContext } from "../lib/agent/research";
import { readAgentState } from "../lib/agent/state";
import { getPaperAccountSummary, getPaperPortfolioSnapshot } from "../lib/alpaca/client";
import { readReceipts } from "../lib/audit/store";
import { evaluatePolicy } from "../lib/policy/evaluate-policy";
import { PolicySchema } from "../lib/policy/types";
import { demoPolicy } from "../lib/trade/mock-data";
import { executeGuardedTrade } from "../lib/trade/execute-guarded";
import { TradeIntentSchema } from "../lib/trade/types";

const server = new McpServer({
  name: "guardian-mcp",
  version: "0.1.0"
});

server.registerTool(
  "get_paper_account",
  {
    title: "Get Alpaca paper account",
    description: "Return a masked Alpaca paper account summary after Guardian verifies paper-only configuration.",
    inputSchema: {}
  },
  async () => {
    const account = await getPaperAccountSummary();

    return {
      content: [{ type: "text", text: JSON.stringify(account, null, 2) }],
      structuredContent: account
    };
  }
);

server.registerTool(
  "get_default_policy",
  {
    title: "Get Guardian default policy",
    description: "Return Guardian's default deterministic paper-trading policy for stocks, ETFs, and crypto.",
    inputSchema: {}
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(demoPolicy, null, 2) }],
    structuredContent: demoPolicy
  })
);

server.registerTool(
  "check_policy",
  {
    title: "Check Guardian policy",
    description: "Validate a proposed Alpaca stock, ETF, or crypto trade against Guardian's deterministic paper-trading policy without submitting an order.",
    inputSchema: {
      intent: TradeIntentSchema,
      policy: PolicySchema.optional()
    }
  },
  async ({ intent, policy }) => {
    const portfolio = await getPaperPortfolioSnapshot();
    const decision = evaluatePolicy({
      intent,
      policy: policy ?? demoPolicy,
      portfolio
    });

    const preview = {
      disclosure: "Paper trading only. Not financial advice. Past performance does not guarantee future results.",
      environment: "paper",
      orderPreview: {
        symbol: intent.symbol,
        side: intent.side,
        assetClass: intent.assetClass,
        type: intent.orderType,
        timeInForce: intent.timeInForce,
        notionalUsd: intent.notionalUsd,
        quantity: intent.quantity ?? null,
        limitPrice: intent.limitPrice ?? null,
        stopPrice: intent.stopPrice ?? null,
        clientOrderId: intent.clientOrderId
      },
      portfolio,
      decision
    };

    return {
      content: [{ type: "text", text: JSON.stringify(preview, null, 2) }],
      structuredContent: preview
    };
  }
);

server.registerTool(
  "execute_guarded_order",
  {
    title: "Execute guarded Alpaca order",
    description: "Run a trade intent through Guardian and submit only approved low-risk orders to Alpaca paper trading or mock mode.",
    inputSchema: {
      intent: TradeIntentSchema,
      policy: PolicySchema.optional(),
      userConfirmedPreview: z.boolean().describe("Must be true only after the user has seen and approved the order preview.")
    }
  },
  async ({ intent, policy, userConfirmedPreview }) => {
    if (!userConfirmedPreview) {
      const blocked = {
        status: "blocked",
        reasons: ["User confirmation is required before guarded execution."],
        disclosure: "Paper trading only. Not financial advice. Past performance does not guarantee future results."
      };

      return {
        content: [{ type: "text", text: JSON.stringify(blocked, null, 2) }],
        structuredContent: blocked
      };
    }

    const receipt = await executeGuardedTrade({
      intent,
      policy: policy ?? demoPolicy,
      portfolio: await getPaperPortfolioSnapshot(),
      humanApproved: true
    });

    return {
      content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }],
      structuredContent: receipt
    };
  }
);

server.registerTool(
  "get_agent_status",
  {
    title: "Get Guardian Alpha agent status",
    description: "Return the current Guardian Alpha worker config and last scan state.",
    inputSchema: {}
  },
  async () => {
    const status = {
      config: getGuardianAgentConfig(),
      state: await readAgentState(),
      disclosure: "Paper trading only. Not financial advice. Past performance does not guarantee future results."
    };

    return {
      content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      structuredContent: status
    };
  }
);

server.registerTool(
  "run_agent_scan",
  {
    title: "Run Guardian Alpha scan",
    description: "Run one autonomous paper-trading scan through the model/rules selector and Guardian policy.",
    inputSchema: {}
  },
  async () => {
    const scan = await runAgentScan();

    return {
      content: [{ type: "text", text: JSON.stringify(scan, null, 2) }],
      structuredContent: scan
    };
  }
);

server.registerTool(
  "get_research_context",
  {
    title: "Get Guardian backtest research context",
    description: "Return the latest backtest summary context that biases Guardian Alpha candidate scoring.",
    inputSchema: {}
  },
  async () => {
    const research = await readLatestResearchContext();

    return {
      content: [{ type: "text", text: JSON.stringify(research, null, 2) }],
      structuredContent: research
    };
  }
);

server.registerTool(
  "get_competition_brief",
  {
    title: "Get Guardian competition brief",
    description: "Return a judge-ready summary of Guardian's paper P&L, autonomous decisions, safety blocks, latest scan, and research context.",
    inputSchema: {}
  },
  async () => {
    const [receipts, portfolio, state, research] = await Promise.all([
      readReceipts(),
      getPaperPortfolioSnapshot(),
      readAgentState(),
      readLatestResearchContext()
    ]);
    const summary = summarizeAgentPerformance(receipts, portfolio);
    const brief = {
      disclosure: "Paper trading only. Not financial advice. Past performance does not guarantee future results.",
      score: summary.competitionScore,
      grade: summary.competitionGrade,
      dailyPnlUsd: summary.dailyPnlUsd,
      dailyPnlPercent: summary.dailyPnlPercent,
      totalDecisions: summary.totalDecisions,
      submittedCount: summary.submittedCount,
      blockedCount: summary.blockedCount,
      latestScan: state.lastScan ?? null,
      research,
      brief: summary.competitionBrief
    };

    return {
      content: [{ type: "text", text: JSON.stringify(brief, null, 2) }],
      structuredContent: brief
    };
  }
);

server.registerTool(
  "list_audit_receipts",
  {
    title: "List audit receipts",
    description: "Read the latest Guardian approvals, blocks, submissions, and failed execution receipts.",
    inputSchema: {
      limit: z.number().int().positive().max(50).default(10)
    }
  },
  async ({ limit }) => {
    const receipts = (await readReceipts()).slice(0, limit);

    return {
      content: [{ type: "text", text: JSON.stringify({ receipts }, null, 2) }],
      structuredContent: { receipts }
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Guardian MCP server running on stdio");
}

main().catch((error) => {
  console.error("Guardian MCP server failed:", error);
  process.exit(1);
});
