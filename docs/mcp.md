# Guardian MCP Server

Guardian ships its own MCP server. This is separate from Alpaca's official MCP server.

## What We Are Making

Guardian MCP is a policy-bounded AI trading gateway for Alpaca paper trading.

The architecture is:

```text
AI client
  -> Guardian MCP tools
  -> deterministic policy checks
  -> Alpaca paper trading API
  -> audit receipt
```

The model can propose a trade, but Guardian decides whether the trade is allowed before Alpaca receives anything.

## Why Not Let The Agent Call Alpaca Directly?

The official Alpaca MCP server is useful, but it exposes powerful trading tools. Guardian is the safety layer in front:

- AI agents call Guardian tools first.
- Guardian shows a preview.
- Guardian enforces policy.
- Guardian requires confirmation.
- Guardian submits only approved paper orders.
- Guardian stores receipts.

## Available Guardian MCP Tools

- `get_paper_account` — masked paper account summary after paper-only verification
- `get_default_policy` — default stocks/ETF/crypto policy
- `check_policy` — preview a `TradeIntent` and policy decision without submitting
- `execute_guarded_order` — submit only after policy passes and `userConfirmedPreview=true`
- `list_audit_receipts` — recent approvals, blocks, submissions, and failures

## Run Locally

```bash
npm run mcp
```

## MCP Client Config Example

Use this for a local MCP host that supports stdio servers:

```json
{
  "mcpServers": {
    "guardian-mcp": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/mac/guardian-mcp",
      "env": {
        "ALPACA_API_KEY": "your-paper-key",
        "ALPACA_SECRET_KEY": "your-paper-secret",
        "ALPACA_PAPER_BASE_URL": "https://paper-api.alpaca.markets",
        "ALPACA_PAPER_TRADE": "true"
      }
    }
  }
}
```

Do not commit real keys. The app also supports `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`.

## Alpaca Official MCP Server

You can also install Alpaca's official MCP server for raw Alpaca account, asset, market-data, and order tools. Guardian should remain the preferred order path for this project because it adds policy and audit receipts.

Recommended split:

- Use Alpaca MCP for discovery/read-only data.
- Use Guardian MCP for any action that may submit an order.

## Required Disclosure

Paper trading only. Not financial advice. Past performance does not guarantee future results.
