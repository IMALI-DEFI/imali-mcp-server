// IMALI Portfolio Grader, computed locally (no API call, nothing leaves the machine).
// Scores 0–100 on diversification, concentration, asset mix and cash buffer → A–F.

const STABLE = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'PYUSD', 'USD', 'CASH']);
const CRYPTO = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'POL', 'LINK', 'LTC', 'TRX', 'SHIB',
  'TON', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'PEPE', 'UNI', 'AAVE', 'XLM', 'HBAR', 'ETC', 'FIL', 'INJ',
]);

export function classify({ symbol, type }) {
  if (type) return type === 'etf' ? 'stock' : type;
  const s = symbol.toUpperCase();
  if (STABLE.has(s)) return 'cash';
  if (CRYPTO.has(s)) return 'crypto';
  return 'stock';
}

export function gradePortfolio(holdings) {
  const rows = holdings.filter(h => h.value > 0).map(h => ({ ...h, symbol: h.symbol.toUpperCase(), kind: classify(h) }));
  const total = rows.reduce((a, h) => a + h.value, 0);
  if (!total) throw new Error('Portfolio total is $0 — add positions with a value above zero.');

  const weights = rows.map(h => ({ ...h, w: h.value / total })).sort((a, b) => b.w - a.w);
  const effective = 1 / weights.reduce((a, h) => a + h.w * h.w, 0); // effective number of positions
  const top = weights[0];
  const byKind = { crypto: 0, stock: 0, cash: 0 };
  for (const h of weights) byKind[h.kind] += h.w;
  const riskKinds = ['crypto', 'stock'].filter(k => byKind[k] > 0.05).length;

  const diversification = effective >= 8 ? 40 : effective >= 5 ? 32 : effective >= 3 ? 22 : effective >= 2 ? 12 : 5;
  const concentration = top.w <= 0.25 ? 30 : top.w <= 0.4 ? 22 : top.w <= 0.6 ? 12 : 4;
  const mix = riskKinds >= 2 ? 15 : 8;
  const cash = byKind.cash >= 0.05 && byKind.cash <= 0.3 ? 15 : (byKind.cash > 0.01 && byKind.cash < 0.5) ? 8 : 3;
  const score = diversification + concentration + mix + cash;
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  const tips = [];
  if (top.w > 0.4) tips.push(`${top.symbol} is ${pct(top.w)} of your portfolio. One bad week there hits everything — consider trimming toward 25–40%.`);
  if (effective < 3) tips.push(`You effectively hold ${effective.toFixed(1)} positions. Spreading across more assets lowers the damage from any single drop.`);
  if (riskKinds < 2) tips.push(byKind.crypto > byKind.stock ? 'All crypto: adding some stocks or ETFs can smooth the swings.' : 'All stocks: a small crypto slice is optional, but a mix of sectors or an index ETF helps.');
  if (byKind.cash < 0.05) tips.push('Little to no cash/stablecoins. A 5–15% buffer lets you buy dips without selling.');
  if (byKind.cash > 0.5) tips.push(`${pct(byKind.cash)} is sitting in cash — fine if you're waiting, but it isn't working for you.`);
  if (!tips.length) tips.push('Well balanced. Keep rebalancing when any position drifts far from its target.');

  return {
    grade,
    score,
    total_usd: Math.round(total * 100) / 100,
    breakdown: { diversification: `${diversification}/40`, concentration: `${concentration}/30`, asset_mix: `${mix}/15`, cash_buffer: `${cash}/15` },
    effective_positions: Math.round(effective * 10) / 10,
    largest_position: { symbol: top.symbol, weight: pct(top.w) },
    allocation: { crypto: pct(byKind.crypto), stocks: pct(byKind.stock), cash: pct(byKind.cash) },
    tips,
    next_step: 'Want this automated and rebalanced across all your exchanges in one place? Try IMALI free: https://imali-defi.com/?utm_source=mcp&utm_medium=imali-mcp&utm_campaign=portfolio_grader',
  };
}

const pct = x => `${Math.round(x * 1000) / 10}%`;
