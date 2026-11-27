// Live, read-only wallet reader for the IMALI Portfolio Grader.
// Reads PUBLIC balances for a wallet address on Ethereum, BNB Chain and Polygon,
// prices them in USD, and hands the holdings to the A–F grader.
// No private keys, no signing, no transactions: only public eth_call / eth_getBalance reads.

const RPC_TIMEOUT_MS = 10000;

const env = (k, d) => (process.env[k] ? process.env[k].split(',').map(s => s.trim()).filter(Boolean) : d);

export const CHAINS = {
  ethereum: {
    label: 'Ethereum',
    rpcs: env('IMALI_RPC_ETHEREUM', ['https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth', 'https://eth.drpc.org']),
    native: { symbol: 'ETH', decimals: 18, price: 'ethereum', type: 'crypto' },
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, price: 'tether', type: 'cash' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, price: 'usd-coin', type: 'cash' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, price: 'dai', type: 'cash' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, price: 'bitcoin', type: 'crypto' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, price: 'ethereum', type: 'crypto' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, price: 'chainlink', type: 'crypto' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, price: 'uniswap', type: 'crypto' },
    ],
  },
  bsc: {
    label: 'BNB Chain',
    rpcs: env('IMALI_RPC_BSC', ['https://bsc-rpc.publicnode.com', 'https://1rpc.io/bnb', 'https://bsc.drpc.org']),
    native: { symbol: 'BNB', decimals: 18, price: 'binancecoin', type: 'crypto' },
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, price: 'tether', type: 'cash' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, price: 'usd-coin', type: 'cash' },
      { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, price: 'bitcoin', type: 'crypto' },
      { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, price: 'ethereum', type: 'crypto' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, price: 'pancakeswap-token', type: 'crypto' },
    ],
  },
  polygon: {
    label: 'Polygon',
    rpcs: env('IMALI_RPC_POLYGON', ['https://1rpc.io/matic', 'https://polygon-bor-rpc.publicnode.com', 'https://polygon-rpc.com']),
    native: { symbol: 'POL', decimals: 18, price: 'polygon-ecosystem-token', type: 'crypto' },
    tokens: [
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, price: 'usd-coin', type: 'cash' },
      { symbol: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, price: 'usd-coin', type: 'cash' },
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, price: 'tether', type: 'cash' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, price: 'ethereum', type: 'crypto' },
      { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, price: 'bitcoin', type: 'crypto' },
    ],
  },
};

export const PRICE_URL = process.env.IMALI_PRICE_URL || 'https://api.coingecko.com/api/v3/simple/price';
export const isAddress = a => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''));

async function post(url, body, fetchImpl) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Exact integer -> decimal conversion (no float precision loss on large balances).
export function toUnits(hex, decimals) {
  if (!hex || hex === '0x') return 0;
  const v = BigInt(hex);
  if (v === 0n) return 0;
  const base = 10n ** BigInt(decimals);
  const whole = v / base, frac = v % base;
  return Number(whole) + Number(frac) / Number(base);
}

const balanceOfData = addr => '0x70a08231' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');

// One batched JSON-RPC request per chain; tries each provider until one answers.
export async function readChain(chainKey, address, fetchImpl = fetch) {
  const c = CHAINS[chainKey];
  const batch = [
    { jsonrpc: '2.0', id: 0, method: 'eth_getBalance', params: [address, 'latest'] },
    ...c.tokens.map((t, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{ to: t.address, data: balanceOfData(address) }, 'latest'] })),
  ];
  let lastErr;
  for (const url of c.rpcs) {
    try {
      const res = await post(url, batch, fetchImpl);
      if (!Array.isArray(res)) throw new Error('provider does not support batch requests');
      const byId = Object.fromEntries(res.map(r => [r.id, r]));
      if (byId[0]?.error || byId[0]?.result === undefined) throw new Error(byId[0]?.error?.message || 'no native balance');
      const items = [{ ...c.native, amount: toUnits(byId[0].result, c.native.decimals) }];
      c.tokens.forEach((t, i) => { const r = byId[i + 1]; if (r && !r.error) items.push({ ...t, amount: toUnits(r.result, t.decimals) }); });
      return { chain: c.label, ok: true, items: items.filter(x => x.amount > 0) };
    } catch (e) { lastErr = e; }
  }
  return { chain: c.label, ok: false, items: [], error: `could not read ${c.label} (${lastErr?.name === 'AbortError' ? 'timeout' : lastErr?.message})` };
}

export async function getPrices(ids, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const r = await fetchImpl(`${PRICE_URL}?ids=${[...new Set(ids)].join(',')}&vs_currencies=usd`, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(r.status === 429 ? 'price source is rate-limiting, try again in a minute' : `price source HTTP ${r.status}`);
    const d = await r.json();
    return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v?.usd)]));
  } finally { clearTimeout(t); }
}

// Returns holdings ready for gradePortfolio(), plus a per-asset breakdown.
export async function readWallet(address, chains = Object.keys(CHAINS), fetchImpl = fetch) {
  if (!isAddress(address)) throw new Error('That is not a valid wallet address (expected 0x followed by 40 hex characters).');
  const results = await Promise.all(chains.map(k => readChain(k, address, fetchImpl)));
  const items = results.flatMap(r => r.items.map(i => ({ ...i, chain: r.chain })));
  const prices = items.length ? await getPrices(items.map(i => i.price), fetchImpl) : {};
  const assets = items
    .map(i => ({ symbol: i.symbol, chain: i.chain, amount: +i.amount.toPrecision(8), price_usd: prices[i.price] ?? null, value_usd: prices[i.price] ? Math.round(i.amount * prices[i.price] * 100) / 100 : null, type: i.type }))
    .filter(a => a.value_usd === null || a.value_usd >= 0.01)
    .sort((a, b) => (b.value_usd || 0) - (a.value_usd || 0));
  // Grade real exposure: the same asset on several chains or wrapped (WETH/ETH, WBTC/BTCB, USDC.e) counts once.
  const CANON = { ethereum: 'ETH', bitcoin: 'BTC', 'usd-coin': 'USDC', tether: 'USDT', binancecoin: 'BNB', 'polygon-ecosystem-token': 'POL' };
  const merged = {};
  for (const i of items) {
    const p = prices[i.price];
    if (!p) continue;
    const key = CANON[i.price] || i.symbol;
    merged[key] = merged[key] || { symbol: key, value: 0, type: i.type };
    merged[key].value += i.amount * p;
  }
  return {
    holdings: Object.values(merged).filter(h => h.value >= 1).map(h => ({ ...h, value: Math.round(h.value * 100) / 100 })),
    assets,
    unpriced: assets.filter(a => a.value_usd === null).map(a => `${a.symbol} on ${a.chain}`),
    chains_read: results.filter(r => r.ok).map(r => r.chain),
    chain_errors: results.filter(r => !r.ok).map(r => r.error),
    read_at: new Date().toISOString(),
  };
}
