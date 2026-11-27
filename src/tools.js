import { z } from 'zod';
import { ENDPOINTS } from './endpoints.js';
import { gradePortfolio } from './grader.js';
import { readWallet, isAddress, CHAINS } from './wallet.js';

// Deliberately READ-ONLY and keyless: no tool here can place, cancel or change
// a trade, a bot, a connected exchange or a plan, and no user key is ever used.

export const DISCLAIMER = 'Educational info, not financial advice. Trading involves risk of loss.';

const out = (data, { disclaimer = true } = {}) => ({
  content: [{ type: 'text', text: (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) + (disclaimer ? `\n\n${DISCLAIMER}` : '') }],
});
const fail = e => ({ content: [{ type: 'text', text: `Error: ${e?.message || e}` }], isError: true });

const symbol = z.string().regex(/^[A-Za-z0-9.\-]{1,15}$/).describe('Ticker, e.g. BTC, ETH, AAPL');

export function buildTools({ client, walletReader = readWallet }) {
  return [
    {
      name: 'grade_portfolio',
      description:
        'Free IMALI Portfolio Grader: grades a crypto/stock portfolio A–F on diversification, concentration, asset mix ' +
        'and cash buffer, with plain-English tips. Pass each holding as symbol + current USD value. Runs locally; no account needed.',
      shape: {
        holdings: z.array(z.object({
          symbol,
          value: z.number().nonnegative().describe('Current USD value of the position'),
          type: z.enum(['crypto', 'stock', 'etf', 'cash']).optional().describe('Optional; guessed from the ticker if left out'),
        })).min(1).max(100),
      },
      handler: async ({ holdings }) => out(gradePortfolio(holdings)),
    },
    {
      name: 'grade_wallet',
      description:
        'Live IMALI Portfolio Grader for a crypto wallet: reads the PUBLIC balances of a wallet address on Ethereum, ' +
        'BNB Chain and Polygon right now, prices them in USD and grades the portfolio A–F with tips. Read-only: it only ' +
        'needs the public 0x address, never a private key or seed phrase. Covers major coins and stablecoins on those chains.',
      shape: {
        address: z.string().refine(isAddress, 'Expected a 0x wallet address (42 characters)').describe('Public wallet address, 0x…'),
        chains: z.array(z.enum(Object.keys(CHAINS))).min(1).optional().describe('Chains to read (default: ethereum, bsc, polygon)'),
      },
      handler: async ({ address, chains }) => {
        const w = await walletReader(address, chains);
        if (!w.holdings.length) {
          const why = w.chain_errors.length ? ` Could not read: ${w.chain_errors.join('; ')}.` : '';
          return out({ address, message: 'No priced balances of $1 or more found for the supported coins on these chains.' + why, chains_read: w.chains_read, read_at: w.read_at });
        }
        return out({ address, ...gradePortfolio(w.holdings), live_balances: w.assets, chains_read: w.chains_read, chain_errors: w.chain_errors, unpriced: w.unpriced, read_at: w.read_at,
          note: 'On-chain balances only: coins held on exchanges or other chains are not included.' });
      },
    },
    {
      name: 'demo_signals',
      description: 'Sample IMALI trading signals, to show how the signal feed works. Demo data, not live trade calls.',
      shape: {},
      handler: async () => out(await client.get(ENDPOINTS.demoSignals)),
    },
  ].map(t => ({ ...t, handler: wrap(t.handler) }));
}

function wrap(h) {
  return async a => { try { return await h(a); } catch (e) { return fail(e); } };
}
