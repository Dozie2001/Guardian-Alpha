# Security Model

Guardian currently supports a protected single-operator hosted demo and a bring-your-own-account local developer mode.

`GUARDIAN_DEPLOYMENT_MODE` controls the product/account model:

```bash
GUARDIAN_DEPLOYMENT_MODE=demo        # server-owned paper demo account
GUARDIAN_DEPLOYMENT_MODE=commercial  # bring-your-own-account product framing
```

This variable does not enable live trading. Guardian still requires the Alpaca paper endpoint.

## Alpaca Account Access

In the hosted demo, the app does not let visitors log in with an Alpaca account ID or connect their own brokerage account. Alpaca access is hard-wired to the paper API credentials configured on the server:

```bash
GUARDIAN_DEPLOYMENT_MODE=demo
AUTH_SECRET=
AUTH_TRUST_HOST=true
AUTH_DEBUG=false
GUARDIAN_AUTH_EMAIL=
GUARDIAN_AUTH_PASSWORD=
GUARDIAN_WEB_ADMIN_KEY=
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
ALPACA_PAPER_TRADE=true
```

Anyone using that hosted deployment is interacting with the one server-side paper account. The `/app` command center is protected by Auth.js credentials from environment variables. Do not share the operator credentials with public testers.

For public testing, developers should clone the repo, add their own Alpaca paper credentials, and run the MCP server or Telegram bot locally. In that mode, orders go to their own paper account, not the maintainer demo account.

## Commercial Product Direction

The intended commercial model is multi-user and account-isolated:

- Each user signs in.
- Each user connects their own Alpaca paper account credentials.
- Each user defines their own Guardian policy.
- Each user links their own Telegram chat ID.
- Receipts are stored per user.
- MCP tools execute only against that user's configured paper account.

That full multi-user auth and credential storage layer is not implemented in the current hackathon demo.

## Current Protections

- Paper-only endpoint verification before account reads and order submission.
- Live endpoint and live-trading flags are blocked.
- Web order execution requires either an Auth.js operator session or the optional `GUARDIAN_WEB_ADMIN_KEY` API fallback.
- Telegram bot access is restricted with `TELEGRAM_ALLOWED_CHAT_IDS`.
- Telegram requires `/preview` before `/confirm`.
- Guardian policy evaluates every trade before submission.
- Local audit receipts are written for approvals, blocks, submissions, and failures.
- Account IDs are masked in summaries.
- API keys and secrets are read from environment variables only.

## Known Gaps Before Public Launch

- The web app has single-operator auth, not full multi-user account isolation.
- Local JSON audit storage is not durable on serverless hosts.
- Telegram preview state is in memory and resets if the process restarts.
- Hosted multi-user account isolation is not implemented yet.
- This is paper trading only and not suitable for live trading.
