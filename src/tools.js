import { z } from 'zod';
import { ENDPOINTS } from './endpoints.js';
import { gradePortfolio } from './grader.js';

// Deliberately READ-ONLY and keyless: no tool here can place, cancel or change
// a trade, a bot, a connected exchange or a plan, and no user key is ever used.

export const DISCLAIMER = 'Educational info, not financial advice. Trading involves risk of loss.';

const out = (data, { disclaimer = true } = {}) => ({
  content: [{ type: 'text', text: (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) + (disclaimer ? `\n\n${DISCLAIMER}` : '') }],
});
const fail = e => ({ content: [{ type: 'text', text: `Error: ${e?.message || e}` }], isError: true });

const symbol = z.string().regex(/^[A-Za-z0-9.\-]{1,15}$/).describe('Ticker, e.g. BTC, ETH, AAPL');

export function buildTools({ client }) {
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
