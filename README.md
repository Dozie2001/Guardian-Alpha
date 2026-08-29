# Guardian Alpha

Guardian Alpha is a policy-bounded AI trading gateway for Alpaca paper trading. AI agents can propose stock, ETF, crypto, and defined-risk options trades, but deterministic rules decide whether the trade is blocked, approved for human review, or submitted to Alpaca paper trading.

## Why this exists

Most AI trading demos give the model too much authority. Guardian separates the workflow:

```text
AI proposes a TradeIntent
Guardian validates the intent
Policy engine approves or blocks
Alpaca paper trading receives only approved low-risk orders
Every decision becomes an audit receipt
```

## Current scope

- US equities and ETFs
- Crypto pairs on Alpaca, including `BTC/USD`, `ETH/USD`, and `SOL/USD`
- Paper trading only
- Mock Alpaca execution when API keys are missing
- Local JSON audit log for the first demo
- Official Alpaca Skills alignment for paper-only safety gates

## Product model

Guardian has two operating modes:

```text
Hosted demo
Your protected deployment uses one maintainer-owned Alpaca paper account so judges can see real paper orders, receipts, and monitoring.

Bring-your-own-account
Developers clone the repo, add their own Alpaca paper keys, run the MCP server or Telegram bot, and trade only against their own paper account.
```

The commercial product direction is multi-user Guardian: each user connects their own Alpaca paper account, owns their policy, links their Telegram chat, and gets isolated receipts. The current hosted demo does not let public users trade through their own credentials yet.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

To connect Alpaca paper trading, create `.env.local`:

```bash
GUARDIAN_DEPLOYMENT_MODE=demo
AUTH_SECRET=your_long_random_auth_secret
AUTH_TRUST_HOST=true
AUTH_DEBUG=false
GUARDIAN_AUTH_EMAIL=operator@example.com
GUARDIAN_AUTH_PASSWORD=choose_a_strong_password
GUARDIAN_WEB_ADMIN_KEY=optional_long_random_api_fallback_key
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
ALPACA_PAPER_TRADE=true
TELEGRAM_BOT_TOKEN=your_botfather_token
TELEGRAM_ALLOWED_CHAT_IDS=123456789
TELEGRAM_BOT_URL=https://t.me/your_bot
TELEGRAM_PUBLIC_DEMO_MODE=false
```

Alpaca's official skills also use `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`; Guardian supports those names too.

Do not paste API keys into chat or commit them. Guardian blocks live Alpaca configuration and only supports paper trading.

`AUTH_SECRET` is required by Auth.js. Generate one with:

```bash
npx auth secret
```

Set `GUARDIAN_AUTH_EMAIL` and `GUARDIAN_AUTH_PASSWORD` for the operator login at `/login`. Keep `AUTH_DEBUG=false` outside local debugging because auth debug logs can include sensitive request details.

`GUARDIAN_DEPLOYMENT_MODE` controls product framing, not live trading:

```bash
# Local / hackathon demo
GUARDIAN_DEPLOYMENT_MODE=demo

# Product-style deployment
GUARDIAN_DEPLOYMENT_MODE=commercial
```

Both modes still use Alpaca paper trading only. In `demo`, server environment variables point to the maintainer paper account. In `commercial`, the product is framed as bring-your-own-account; full hosted multi-user credential storage is listed as future work.

Auth.js protects the web command center at `/app`. `POST /api/guarded-trade` accepts a signed-in operator session. `GUARDIAN_WEB_ADMIN_KEY` is still supported as an optional `x-guardian-admin-key` fallback for scripts and manual API tests.

## Demo flow

1. Sign in at `/login`.
2. Open `/app` to view account, policy, positions, and receipts.
3. Open `/app/agent` to show the alpha-agent scoreboard: strategy, worker controls, daily paper P&L, exposure, approval rate, judge brief, and decision journal.
4. Use Telegram or the web composer to preview a paper trade.
5. Guardian evaluates the intent against deterministic policy.
6. See allowed trades submitted to Alpaca paper trading and blocked trades recorded with exact reasons.
7. In Telegram, run `/brief` to show the judge-ready P&L and creativity summary.

## Autonomous agent

Guardian Alpha can run as a scheduled worker or as a manual scan from `/app/agent`.

```bash
GUARDIAN_AGENT_ENABLED=true
GUARDIAN_AGENT_AUTO_SUBMIT=false
GUARDIAN_AGENT_INTERVAL_SECONDS=300
GUARDIAN_AGENT_MAX_AUTO_NOTIONAL_USD=5000
GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_ORDERS=8
GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_NOTIONAL_USD=25000
GUARDIAN_AGENT_UNIVERSE=SPY,QQQ,AAPL,MSFT,NVDA,BTC/USD,ETH/USD,SOL/USD
GUARDIAN_MODEL_PROVIDER=ensemble
GUARDIAN_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
GROQ_MODEL_NAME=openai/gpt-oss-20b
FEATHERLESS_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
GROQ_API_KEY=your_groq_key
FEATHERLESS_API_KEY=your_featherless_key
ALPACA_DATA_BASE_URL=https://data.alpaca.markets
ALPACA_DATA_FEED=iex
```

Run the worker:

```bash
npm run agent:scan
npm run agent
```

Use `npm run agent:scan` for a single smoke test before running the always-on worker. With `GUARDIAN_AGENT_AUTO_SUBMIT=false`, scans create approved or blocked decision receipts but do not submit paper orders. With `GUARDIAN_AGENT_AUTO_SUBMIT=true`, the agent can submit only if Guardian policy approves, the trade is at or below `GUARDIAN_AGENT_MAX_AUTO_NOTIONAL_USD`, and the day has not exceeded `GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_ORDERS` or `GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_NOTIONAL_USD`.

The recommended hackathon competition profile is `$5,000` max per autonomous order, `8` autonomous submissions per day, and `$25,000` max autonomous notional per day. That gives the paper account enough exposure to produce visible P&L without letting the worker deploy the whole account.

The model provider is an internal ranking layer. Set `GUARDIAN_MODEL_PROVIDER=groq`, `featherless`, `ensemble`, or `none`. In ensemble mode, Guardian asks both Groq and Featherless to rank the same policy-constructed candidates; if they agree, confidence increases, and if they disagree Guardian chooses the higher-scoring policy candidate among model picks. If inference fails, times out, or returns invalid JSON, Guardian falls back to the deterministic top candidate. Each scan can use Alpaca historical daily bars for recent momentum/volatility, plus optional backtest artifacts under `runs/<run-name>/summary.json`. The agent can buy allowed equities and crypto, buy defined-risk calls or puts, sell existing equity or spot crypto positions to take risk down, and open bounded paper equity shorts when historical signals are weak. It does not short crypto or options.

### Alpaca CLI proof

Guardian uses Alpaca's Trading API for execution and includes a read-only Alpaca CLI reporting path for the hackathon MCP/CLI requirement. The report script calls the official `alpaca` CLI to verify the paper environment and export the competition account, positions, orders, and portfolio history:

```bash
npm run alpaca:competition-report
```

Install and authenticate the CLI first if needed:

```bash
brew install alpacahq/tap/cli
alpaca profile login --api-key
alpaca doctor
```

The script does not submit, cancel, replace, or close orders.

### Backtest research context

Guardian Alpha can consume the latest Alpaca backtest artifact at:

```text
runs/<run-name>/summary.json
```

When a summary includes symbol-level metrics, the next agent scan applies a research bias to candidate scores before model ranking:

```json
{
  "strategy_name": "Momentum research",
  "generated_at": "2026-08-27T00:00:00.000Z",
  "symbols": [
    {
      "symbol": "SPY",
      "total_return_pct": 12,
      "max_drawdown_pct": 4,
      "win_rate_pct": 58,
      "trade_count": 12,
      "sharpe": 1.1
    }
  ]
}
```

The research context is visible in `/app/agent`, Telegram `/research`, and MCP `get_research_context`. The live historical-bar signal appears in the candidate reasons and Groq ranking context. The competition readout is visible in `/app/agent`, Telegram `/brief`, and MCP `get_competition_brief`. Backtests are hypothetical research only and do not guarantee paper or live trading results.

### Broker reconciliation

Guardian treats the Alpaca broker response as final state. Agent plans are stored as intent, but orders, fills, rejections, cancellations, and expirations are reconciled from Alpaca order lifecycle status. The autonomous worker reconciles open receipts before each scan, and `/api/receipts` plus Telegram `/receipts` refresh broker state before displaying the journal.

Manual reconciliation:

```bash
npm run agent:reconcile
```

Open receipts can move from `submitted` to `partially_filled`, `filled`, `rejected`, `canceled`, or `expired`.

## Options readiness

Alpaca paper accounts should expose options fields on `GET /v2/account`:

```text
options_approved_level
options_trading_level
options_buying_power
```

The dashboard shows the current paper options level in `/app` and `/app/agent`. If your paper account does not show options access, check Alpaca Dashboard > Account > Configure while the paper account is selected. For live trading, Alpaca requires an options approval application from the dashboard; Guardian does not enable live trading.

Guardian's options module is policy-gated:

- `allowOptions=true` for the hackathon track
- contract symbols must use OCC format, for example `SPY270115C00500000`
- options require whole contract quantity
- options use estimated premium risk, not notional share value
- options are limited by underlying allowlist, 1-contract cap, `$600` premium cap, and minimum days to expiry
- autonomous options are buy-to-open calls or puts only
- naked option selling is blocked by policy

Manual options test:

1. Sign in and open `/app`.
2. Use **Options scout** to search `SPY` calls.
3. Pick a contract and click **Guard preview**.
4. Guardian records an approved or blocked receipt using the same policy engine as the autonomous worker.

## Telegram bot

Guardian can also run as a Telegram bot for the chat-first demo:

```bash
npm run telegram
```

Bot commands:

```text
/account
/portfolio
/policy
/risk
/receipts
/agent
/scan
/why
/performance
/brief
/research
/preview buy SOL/USD 50
/confirm guardian-tg-...
/cancel guardian-tg-...
```

The bot uses long polling, so it should run on your Google VM, not Vercel. It never submits silently: `/preview` creates the paper order preview and `/confirm` is required before Guardian can submit to Alpaca paper trading.

Set `TELEGRAM_BOT_URL=https://t.me/<bot_username>` so the landing page and authenticated app can direct judges to the bot.

Telegram access is allowlisted. To find your chat ID, start the bot without `TELEGRAM_ALLOWED_CHAT_IDS`, send `/start`, then copy the numeric chat ID from the unauthorized reply into `.env.local`:

```bash
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

For multiple testers, separate IDs with commas:

```bash
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321
```

For a judge-friendly public demo, set:

```bash
TELEGRAM_PUBLIC_DEMO_MODE=true
```

Public demo mode lets anyone use safe commands:

```text
/start
/agent
/scan
/why
/performance
/brief
/research
/receipts
```

Operator-only commands still require `TELEGRAM_ALLOWED_CHAT_IDS`:

```text
/account
/portfolio
/policy
/risk
/settings
/pause
/resume
/autosubmit on|off
/setcap 2000
/setdailyorders 6
/setdailynotional 10000
/setinterval 300
/setuniverse SPY QQQ AAPL MSFT NVDA BTC/USD ETH/USD SOL/USD
/preview
/confirm
/cancel
```

Public `/scan` is forced into decision-only mode, so it cannot submit a paper order even if the worker is configured for auto-submit.

Operator strategy changes are saved to `data/agent-settings.json` and picked up by the worker on the next scan. This changes the running paper-trading behavior without exposing Alpaca or Groq keys in Telegram.

To run beside another process on the VM:

```bash
pm2 start npm --name guardian-telegram -- run telegram
pm2 save
```

## Policy defaults

- Paper-only mode
- Max trade notional: `$5,000`
- Human approval above: `$2,500`
- Max daily loss: `5%`
- Max position exposure: `30%`
- Max crypto trade notional: `$1,000`
- Max crypto portfolio exposure: `35%`
- Max option premium: `$600`
- Max option contracts: `1`
- Equity short selling: enabled for bounded paper shorts
- Spot crypto exits: enabled for existing holdings only
- Options: enabled for defined-risk long calls and puts
- Crypto cooldown: `15 minutes`

## Self-host quickstart

For someone to run Guardian against their own Alpaca paper account:

```bash
git clone <repo-url>
cd guardian-mcp
npm install
cp .env.example .env.local
```

They add their own:

- Auth.js secret and operator login
- Alpaca paper API key and secret
- Telegram bot token and chat ID
- Groq key if they want model-assisted ranking
- Optional backtest artifacts under `runs/<run-name>/summary.json`

Then run:

```bash
npm run dev
npm run telegram
npm run agent:scan
npm run agent
npm run mcp
```

The hosted demo does not accept visitor Alpaca keys. Self-hosting is the current safe path for external users who want their own paper account, policy, Telegram bot, receipts, and MCP tools.

## Hackathon pitch

Guardian MCP lets AI trading agents operate through Alpaca without giving the model unchecked control over an account. The model can research and propose trades; Guardian enforces deterministic user policy before execution and records every decision in a replayable audit trail.

## Alpaca Skills

This repo is aligned with Alpaca's official agent skills. See `docs/alpaca-skills.md` for the paper-trading guardrails and the remaining Alpaca-specific work.

## MCP Server

Guardian includes its own MCP server:

```bash
npm run mcp
```

See `docs/mcp.md` for tool names and MCP client configuration.

Core MCP tools:

- `get_paper_account`
- `get_default_policy`
- `get_agent_status`
- `run_agent_scan`
- `get_research_context`
- `get_competition_brief`
- `check_policy`
- `execute_guarded_order`
- `list_audit_receipts`

For public testing, users should clone this repo and run the MCP server with their own Alpaca paper credentials. Do not expose a hosted MCP server backed by your personal paper account unless it is authenticated and allowlisted.
