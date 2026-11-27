# IMALI MCP

Grade your portfolio inside Claude, ChatGPT or any MCP client — from [IMALI](https://imali-defi.com), all your trading in one place.

| Tool | What |
|---|---|
| `grade_wallet` | **Live:** paste a public 0x wallet address; reads balances on Ethereum, BNB Chain and Polygon right now, prices them, grades A–F |
| `grade_portfolio` | A–F grade on diversification, concentration, mix and cash, with tips. Runs locally. |
| `demo_signals` | Sample IMALI signals (demo data) |

**Read-only and keyless by design.** Wallet grading uses only the public address and public blockchain data, never a private key or seed phrase. No account, no API key, and no tool that can place, cancel or change trades, bots, exchanges or plans.

```json
{
  "mcpServers": {
    "imali": { "command": "npx", "args": ["-y", "imali-mcp"] }
  }
}
```

Try: *"Grade my wallet 0x…"* or *"Grade my portfolio: $4,000 BTC, $1,500 ETH, $500 SOL, $2,000 NVDA."*

## Routes used
`/api/public/signals/demo` (in `src/endpoints.js`). Optional `IMALI_API_URL` (default `https://api.imali-defi.com`).

Educational info, not financial advice.

## Privacy
IMALI MCP runs on your computer. Portfolio grades are computed locally. For wallet grading it sends the public wallet address to public blockchain nodes (publicnode.com, 1rpc.io, drpc.org) and coin IDs to CoinGecko for prices; IMALI receives nothing and stores nothing. Override nodes with IMALI_RPC_ETHEREUM / IMALI_RPC_BSC / IMALI_RPC_POLYGON. Contact: support via https://imali-defi.com
