# Deployment Runbook

Guardian uses two hosting targets:

```text
Vercel
  Landing page
  Auth.js web app
  Dashboard APIs

Google VM
  Telegram bot
  Autonomous agent worker
  Optional MCP server launched by MCP clients
```

## Required Environment

Use paper trading only:

```bash
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
ALPACA_PAPER_TRADE=true
```

Never set:

```bash
ALPACA_LIVE_TRADE=true
ALPACA_PAPER_TRADE=false
ALPACA_PAPER_BASE_URL=https://api.alpaca.markets
```

## Vercel Web

Set these in Vercel project environment variables:

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
GUARDIAN_AGENT_ENABLED=true
GUARDIAN_AGENT_AUTO_SUBMIT=false
GUARDIAN_AGENT_INTERVAL_SECONDS=300
GUARDIAN_AGENT_MAX_AUTO_NOTIONAL_USD=5000
GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_ORDERS=8
GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_NOTIONAL_USD=25000
GUARDIAN_AGENT_UNIVERSE=SPY,QQQ,AAPL,MSFT,NVDA,SOL/USD
GUARDIAN_MODEL_PROVIDER=groq
GUARDIAN_MODEL_NAME=openai/gpt-oss-20b
GROQ_API_KEY=
ALPACA_DATA_BASE_URL=https://data.alpaca.markets
ALPACA_DATA_FEED=iex
TELEGRAM_PUBLIC_DEMO_MODE=true
TELEGRAM_BOT_URL=https://t.me/your_bot
```

Deploy:

```bash
npm run build
npx vercel
npx vercel --prod
```

## Google VM

Project:

```bash
gcloud config set project tough-country-506812-u0
```

Create a VM from Google Cloud Shell:

```bash
PROJECT_ID=tough-country-506812-u0 bash scripts/gcp-create-vm.sh
```

Then SSH into it:

```bash
gcloud compute ssh guardian-agent-vm --zone=us-central1-a
```

Install dependencies:

```bash
npm install
npm install -g pm2
```

Or bootstrap from the VM:

```bash
curl -fsSL https://raw.githubusercontent.com/Dozie2001/guardian-mcp/main/scripts/gcp-bootstrap-guardian.sh | bash
```

Set `.env.local` on the VM with the same paper credentials plus:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_IDS=
TELEGRAM_PUBLIC_DEMO_MODE=true
TELEGRAM_BOT_URL=https://t.me/your_bot
```

Start bot and agent:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

Logs:

```bash
pm2 logs guardian-agent
pm2 logs guardian-telegram
```

## Start Paper Trading

Phase 1, decision-only:

```bash
GUARDIAN_AGENT_AUTO_SUBMIT=false
npm run agent:scan
pm2 restart guardian-agent --update-env
```

Let it produce several preview receipts.

Phase 2, tiny paper auto-submit:

```bash
GUARDIAN_AGENT_AUTO_SUBMIT=true
GUARDIAN_AGENT_MAX_AUTO_NOTIONAL_USD=5000
GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_ORDERS=8
GUARDIAN_AGENT_MAX_DAILY_SUBMITTED_NOTIONAL_USD=25000
npm run agent:scan
pm2 restart guardian-agent --update-env
```

Watch the first scan, then stop or return to decision-only if behavior is not expected:

```bash
pm2 logs guardian-agent
```

Telegram smoke test:

```text
/start
/agent
/scan
/why
/brief
/performance
```

Operator-only controls:

```text
/settings
/pause
/resume
/autosubmit on
/autosubmit off
/setcap 5000
/setdailyorders 8
/setdailynotional 25000
/setinterval 300
/setuniverse SPY QQQ AAPL MSFT NVDA SOL/USD
```

## Judge Demo

Share:

- Telegram bot username
- Vercel dashboard URL
- GitHub repo URL
- Demo web login
- Suggested commands: `/brief`, `/scan`, `/why`, `/performance`, `/receipts`

Do not share:

- Alpaca keys
- Groq key
- Telegram bot token
- VM credentials
- `.env.local`
