# IMALI MCP

Grade your portfolio inside Claude, ChatGPT or any MCP client — from [IMALI](https://imali-defi.com), all your trading in one place.

| Tool | What |
|---|---|
| `grade_portfolio` | A–F grade on diversification, concentration, mix and cash, with tips. Runs locally. |
| `demo_signals` | Sample IMALI signals (demo data) |

**Read-only and keyless by design.** No account, no API key, and no tool that can place, cancel or change trades, bots, exchanges or plans.

```json
{
  "mcpServers": {
    "imali": { "command": "npx", "args": ["-y", "imali-mcp"] }
  }
}
```

Try: *"Grade my portfolio: $4,000 BTC, $1,500 ETH, $500 SOL, $2,000 NVDA."*

## Routes used
`/api/public/signals/demo` (in `src/endpoints.js`). Optional `IMALI_API_URL` (default `https://api.imali-defi.com`).

Educational info, not financial advice.
