# Alpaca Skills Alignment

Guardian follows the official `alpacahq/alpaca-skills` paper-trading guidance for this hackathon build.

Reference skills:

- `alpaca-trading-paper-trading`
- `alpaca-trading-paper-trading-mcp`
- `alpaca-trading-paper-trading-cli`

## Rules Implemented

- Paper trading only.
- Live endpoint detection blocks execution.
- Credentials are read from environment variables only.
- API keys are never accepted in chat, shown in UI, or written to audit receipts.
- `client_order_id` is required on every `TradeIntent`.
- The dashboard shows a complete structured intent before execution.
- Deterministic policy checks run before Alpaca submission.
- Unsafe trades are recorded as blocked receipts instead of being submitted.
- Crypto uses Alpaca paper trading, not on-chain execution.

## Environment Variables

Guardian accepts both the project aliases and Alpaca skill aliases:

```bash
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
ALPACA_PAPER_TRADE=true

# Also supported:
APCA_API_KEY_ID=
APCA_API_SECRET_KEY=
```

The app refuses to run an order if:

- `ALPACA_PAPER_BASE_URL` is `https://api.alpaca.markets`
- `ALPACA_LIVE_TRADE=true`
- `ALPACA_PAPER_TRADE=false`
- the configured base URL is not the Alpaca paper endpoint

## Next Alpaca-Specific Work

- Fetch open positions from Alpaca instead of using demo positions.
- Fetch clock/market status before equity orders.
- Verify asset tradability before submission.
- Add order status lookup by Alpaca order ID.
- Add run folders under `runs/<timestamp>-paper-trading/` with `orders.json`, `order_log.csv`, and `portfolio_summary.md`.
- Add MCP-host setup docs for Alpaca's official MCP server and tool discovery.

## Required Disclosure

This material is for informational, educational, and research purposes only. It is not investment advice, a recommendation, an offer, or a solicitation to buy or sell securities, options, cryptocurrencies, or any other financial product. All investing and trading involve risk, including possible loss of principal. Paper trading is simulated and may differ from live trading in fills, market impact, liquidity, fees, latency, and other factors. Review Alpaca's disclosures at https://alpaca.markets/disclosures.
