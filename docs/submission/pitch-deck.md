# Guardian Alpha Pitch Deck

Audience: Alpaca AI Trading Agents Hackathon judges

Primary story: chat-first autonomous trading agent with Alpaca execution, options alpha, MCP/CLI alignment, and deterministic risk gates.

## Slide 1: Title

**Guardian Alpha**

Autonomous paper trading on Alpaca, with policy-gated execution.

Speaker notes:

> Guardian Alpha is an AI trading agent for Alpaca paper trading. The agent can scan markets, reason about candidates, and place paper orders, but it cannot bypass deterministic risk policy.

## Slide 2: Problem

**Most AI trading agents are either powerless or dangerous**

- Chat-only agents do not trade.
- Key-holding agents can overreach.
- Trading demos often hide risk.
- Options make bad autonomy expensive.

Speaker notes:

> The interesting problem is not whether an LLM can say "buy SPY." The hard problem is giving an agent real execution ability while keeping it bounded when the model is wrong, rate-limited, stale, or overconfident.

## Slide 3: Solution

**AI proposes. Guardian checks. Alpaca executes.**

Flow:

```text
Market data and backtest context
        ↓
AI reasoning ranks candidates
        ↓
Guardian policy validates intent
        ↓
Alpaca paper order submission
        ↓
Broker reconciliation and receipts
```

Speaker notes:

> Guardian turns model output into a structured trade intent. The policy engine checks the intent before execution. Alpaca receives only orders that pass the rules.

## Slide 4: Product

**Telegram is the main operator interface**

- `/agent`: worker status
- `/scan`: trigger one decision cycle
- `/why`: explain latest decision
- `/policy`: show hard limits
- `/receipts`: reconcile broker status
- `/brief`: judge-ready summary

Speaker notes:

> The demo is intentionally chat-first because agentic trading should feel like directing an operator, not clicking through a heavy admin panel. The web app is still there for monitoring, portfolio review, and audit history.

## Slide 5: Autonomous Strategy

**A bounded multi-asset alpha agent**

- ETFs and large-cap equities
- Spot crypto on Alpaca
- Long calls and puts
- Bounded equity shorts
- Historical data signals
- Groq plus Featherless reasoning

Speaker notes:

> The agent builds candidates from historical price movement, volatility, position state, cash, and policy limits. Model reasoning ranks the policy-created candidates rather than inventing arbitrary trades from free text.

## Slide 6: Options Alpha

**Options are incorporated, not bolted on**

- Bullish signals can create calls.
- Bearish signals can create puts.
- Premium is treated as risk.
- Contract count is capped.
- Naked option selling is blocked.

Speaker notes:

> The challenge requires options trading, so Guardian includes an options-ready path. It uses long calls and puts because the maximum loss is the premium paid. More advanced defined-risk spreads are the next logical extension.

## Slide 7: Risk Gates

**The model never owns the enforcement path**

- Paper-only Alpaca endpoint
- Max trade size
- Daily order cap
- Daily notional cap
- Position exposure cap
- Crypto exposure cap
- Option premium cap
- Broker status reconciliation

Speaker notes:

> This is the core product argument. Guardian does not trust prompts for safety. The model can be creative, but the final order path is deterministic and auditable.

## Slide 8: Alpaca Infrastructure

**Built on the Alpaca stack**

- Trading API for orders
- Paper account for execution
- Market data for signals
- Options contracts API
- Portfolio and positions API
- CLI report for judging evidence
- MCP server for agent tools

Speaker notes:

> Alpaca is not incidental here. Guardian uses Alpaca as the broker, data source, options source, portfolio source, and final record for judging P&L.

## Slide 9: Demo Flow

**What judges can verify**

1. Open Telegram bot.
2. Run `/agent` and `/policy`.
3. Run `/scan`.
4. Inspect `/why`.
5. Inspect `/receipts`.
6. Open dashboard.
7. Check paper account P&L.

Speaker notes:

> The demo should show a complete loop: agent decision, policy approval or block, Alpaca paper execution, and receipt reconciliation.

## Slide 10: Why It Is Creative

**A trading agent with an operating system**

- Chat-first controls
- Web monitoring
- MCP tools
- Alpaca CLI evidence
- Model ensemble fallback
- Explainable receipts
- Policy as product

Speaker notes:

> The creative angle is not only the strategy. It is the complete operating surface around the agent: Telegram, web, MCP, CLI evidence, policy, reconciliation, and audit receipts.

## Slide 11: Current Status

**Live paper-trading system**

- Web app deployed
- Telegram bot live
- VM worker running
- Dedicated paper account connected
- Options module enabled
- Fresh public repo created
- One-page write-up ready

Speaker notes:

> This is not just a mockup. The agent and bot are running against Alpaca paper trading. The repo is fresh for the hackathon window and the paper account is dedicated to judging.

## Slide 12: Roadmap

**From hackathon agent to product**

- User-owned Alpaca connection
- Per-user policies
- Telegram chat linking
- Defined-risk option spreads
- Better backtest comparison
- Broker event streaming
- Hosted MCP with auth

Speaker notes:

> The hackathon version is a protected single-operator paper deployment. The product direction is multi-user: every user brings their Alpaca paper account, owns their policy, links their Telegram chat, and gets isolated receipts.

## Slide 13: Close

**Guardian Alpha**

AI can search for alpha. Policy decides what reaches Alpaca.

Links to include:

- App: `https://guardian-mcp-eta.vercel.app`
- Telegram: `https://t.me/AlpacaGuardBot`
- GitHub: `https://github.com/Dozie2001/Guardian-Alpha.git`
- Paper account ID: paste dedicated Alpaca paper account ID in submission form

Speaker notes:

> The key message for judges: Guardian Alpha is autonomous, uses Alpaca directly, incorporates options, uses MCP or CLI tooling, and produces a clear audit trail for P&L and decisions.

## Hard Questions And Answers

### Is the LLM actually trading?

Yes. The agent creates candidates, uses reasoning to select one, and can auto-submit approved orders. The LLM does not get unchecked account authority because Guardian policy validates every intent before Alpaca receives it.

### Why not allow naked options?

Because unlimited-loss option selling weakens the product story. Guardian supports options alpha through long calls and puts today, with defined-risk spreads as the next extension.

### What happens if the model fails?

The system falls back to deterministic candidate ranking or abstains. Invalid JSON, provider failure, stale inputs, and policy violations do not bypass the execution gate.

### What counts for P&L?

The dedicated Alpaca paper account is the final source of truth. Guardian reconciles order lifecycle state from Alpaca and uses the paper account for competition evidence.

