# Guardian Alpha Demo Video Script

Target length: 2:45 to 3:00

## Recording Setup

- Use the deployed web app: `https://guardian-mcp-eta.vercel.app`
- Use Telegram: `https://t.me/AlpacaGuardBot`
- Use the dedicated hackathon Alpaca paper account.
- Keep `.env.local`, API keys, Vercel settings, and terminal secrets off-screen.
- Record at 1080p. Use a clean browser window and increase zoom to 110% if text is small.

## What To Show

1. Telegram bot as the main interface.
2. Autonomous scan and latest reasoning.
3. Policy limits and options readiness.
4. Alpaca paper order or receipt evidence.
5. Web dashboard as the command center and audit view.
6. Repo docs showing MCP/CLI and one-page write-up.

## 0:00-0:15 Hook

Screen: Telegram chat with Guardian Alpha open.

Say:

> Most trading agents fail in one of two ways. Either they only chat and never trade, or they can trade but the model has too much control. Guardian Alpha is my answer: an autonomous Alpaca paper-trading agent where AI can propose trades, but deterministic policy decides what is allowed.

## 0:15-0:35 Product Summary

Screen: Web landing page, then quickly switch to `/app/agent`.

Say:

> Guardian Alpha scans equities, ETFs, crypto, and options on Alpaca. It uses historical market data, optional backtest context, and model reasoning from Groq and Featherless to rank trade candidates. But before any order reaches Alpaca, the Guardian policy engine checks size, account exposure, daily limits, option premium risk, crypto exposure, and paper-only mode.

## 0:35-1:35 Main Demo: Telegram Agent

Screen: Telegram bot.

Run:

```text
/agent
/settings
/policy
/scan
/why
/receipts
```

Say while showing `/agent`:

> This is the chat-first control surface. I can see whether the autonomous worker is enabled, whether auto-submit is on, which model provider is being used, and what the latest scan selected.

Say while showing `/settings` and `/policy`:

> The agent is not free to do anything it wants. These are the hard limits: paper trading only, single-trade cap, daily order cap, daily notional cap, options premium cap, crypto exposure cap, and blocked naked option selling. The model does not enforce this. Code does.

Say while showing `/scan`:

> Now I run a manual scan. In production mode the worker runs on the VM, but for the demo I can trigger one from Telegram. Guardian builds candidates, asks the reasoning layer to rank them, checks the chosen intent against policy, and only then submits or records the decision.

Say while showing `/why`:

> This is the explainability layer. The judge can see why the agent preferred this trade, what market signal it used, and whether Alpaca execution happened.

Say while showing `/receipts`:

> Receipts are important because the final state belongs to Alpaca, not the model. Guardian reconciles submitted orders back from Alpaca, so fills, rejects, cancels, and partial fills are reflected in the decision journal.

## 1:35-2:15 Web Dashboard

Screen: `/app/agent`, then `/app`.

Say:

> The dashboard is the add-on for monitoring. The Telegram bot is the fastest interface, while the web app gives the full picture: account status, positions, portfolio performance, decision journal, option scouting, and policy previews.

Show:

- Agent status card.
- Daily paper P&L.
- Recent decisions.
- Portfolio or positions.
- Options scout if visible.
- Receipts table.

Say:

> The options module matters for this challenge. Guardian can incorporate long calls and puts into the autonomous strategy, while blocking naked option selling. That gives options alpha exposure without letting a model create unlimited-loss trades.

## 2:15-2:40 Technical Highlight

Screen: Repo or architecture doc.

Open:

- `docs/hackathon-one-page-writeup.md`
- `docs/mcp.md`
- `README.md`

Say:

> Under the hood, Guardian is split into three layers. Alpaca is the brokerage and market-data rail. Guardian is the policy and audit layer. Telegram, web, MCP, and CLI evidence all point into the same decision flow. The AI proposes a structured trade intent. Guardian validates it. Alpaca executes only approved paper orders.

## 2:40-2:55 Submission Proof

Screen: README or one-page write-up.

Say:

> For submission, I am using a brand-new dedicated Alpaca paper account with a 100,000 dollar starting balance. The repo is public, the app is deployed, the bot is live, and the one-page write-up explains the AI logic, risk gates, and Alpaca infrastructure.

## 2:55-3:00 Close

Screen: Telegram `/brief` or dashboard P&L.

Say:

> Guardian Alpha is an autonomous trading agent with a boring enforcement layer. The AI can search for alpha. The policy engine decides what is allowed.

## Backup Demo If Market Is Closed

If no order fills during recording:

Say:

> The market is closed, so the order can be accepted or queued instead of filled. Guardian still demonstrates the important path: candidate generation, reasoning, policy approval, Alpaca submission, and broker reconciliation.

Show:

- `/receipts`
- Alpaca order status
- Dashboard decision journal

## Do Not Show

- API keys
- `.env.local`
- Vercel environment variables
- Telegram bot token
- GitHub token
- Any private account settings unrelated to the paper account

