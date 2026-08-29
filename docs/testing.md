# Testing Guardian

## Recommended Hackathon Testing Flow

Use two tracks:

```text
Hosted demo
Judges use your allowlisted Telegram bot and web monitor against your Alpaca paper account.

Developer MCP test
Developers clone the repo and run Guardian with their own Alpaca paper keys or no keys in mock mode.
```

## Hosted Demo Test

Start the web monitor:

```bash
npm run dev -- --port 3001
```

Open:

```text
http://localhost:3001
```

Check:

- Paper account loads.
- Portfolio snapshot loads.
- Policy limits are visible.
- Receipts load.
- Running a guarded trade creates a receipt.

## Telegram Setup Test

Add the bot token:

```bash
TELEGRAM_BOT_TOKEN=your_botfather_token
TELEGRAM_ALLOWED_CHAT_IDS=
```

Start:

```bash
npm run telegram
```

Send `/start` to the bot. It should reply with your chat ID. Add that ID:

```bash
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

Restart the bot and test:

```text
/account
/portfolio
/policy
/preview buy SOL/USD 50
/confirm guardian-tg-...
```

Expected behavior:

- Unauthorized chat IDs cannot access account data.
- `/preview` shows the paper order and policy decision.
- `/confirm` is required before submission.
- Receipts appear in the web monitor.

## Developer MCP Test

Without Alpaca keys, Guardian runs in mock mode:

```bash
npm run mcp
```

With Alpaca paper keys:

```bash
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
ALPACA_PAPER_TRADE=true
npm run mcp
```

Developers should use their own paper credentials. They should not test against the hosted maintainer account.

## Final Verification

```bash
npm test
npm run build
npm audit
```
