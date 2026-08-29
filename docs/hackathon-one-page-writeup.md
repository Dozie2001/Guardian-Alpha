# Guardian Alpha Hackathon Write-Up

## Project

Guardian Alpha is an autonomous AI trading agent for Alpaca paper trading. It runs against a dedicated hackathon paper account, scans a bounded universe of ETFs, large-cap equities, crypto pairs, and option contracts, then creates structured trade intents that must pass Guardian's deterministic policy engine before any order reaches Alpaca.

Paper account ID for submission: `<paste dedicated Alpaca paper account ID here>`

## AI Logic

Guardian combines three decision layers:

1. Historical market signals from Alpaca market data: recent momentum, volatility, and latest close.
2. Optional backtest research artifacts under `runs/<run-name>/summary.json`.
3. Groq model ranking, which receives the candidate list and chooses the best risk-adjusted action.

The agent can produce:

- Equity and ETF buys.
- Spot crypto buys on supported Alpaca pairs.
- Risk-reducing sells for existing equity and crypto holdings.
- Bounded US equity shorts when signals are bearish.
- Defined-risk long call or put options when the underlying signal is strong enough.

Options are incorporated directly into the autonomous candidate generator. Bullish underlying signals can create call candidates; bearish signals can create put candidates. The agent uses recent underlying prices to target out-of-the-money contracts and caps risk to the premium paid.

## Risk Gates

Guardian separates model reasoning from execution authority. The model can rank candidates, but it cannot bypass policy. Every trade passes through `evaluatePolicy` before execution.

Current hackathon policy:

- Paper trading only.
- Max autonomous order: `$5,000`.
- Max daily autonomous orders: `8`.
- Max daily autonomous notional: `$25,000`.
- Max single-position exposure: `30%`.
- Max crypto trade: `$1,000`.
- Max crypto portfolio exposure: `35%`.
- Crypto cooldown: `15 minutes`.
- Options enabled for long calls and puts only.
- Max option contracts: `1`.
- Max option premium: `$600`.
- Naked option selling blocked.
- Crypto shorting blocked.
- Live Alpaca endpoints blocked.

## Alpaca Infrastructure

Guardian uses Alpaca's paper Trading API for account state, positions, option contract discovery, order submission, and paper execution. The system runs as:

- Next.js web app on Vercel for the landing page, authenticated dashboard, policy preview, options scout, receipts, and agent scoreboard.
- Telegram bot on a Google VM for chat-first monitoring and operator controls.
- Autonomous worker on the same Google VM using PM2.
- Local JSON audit receipts for the hackathon demo.
- Read-only Alpaca CLI competition report script for account, order, position, and portfolio evidence.

Submission evidence should include the dedicated paper account ID, demo video, project URL, GitHub repo, Telegram bot link, and exported account/order evidence from the competition paper account.
