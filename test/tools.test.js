import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startMock } from './mock.js';
import { createClient } from '../src/client.js';
import { buildTools } from '../src/tools.js';
import { gradePortfolio } from '../src/grader.js';

const find = (t, n) => t.find(x => x.name === n);

test('no trading tools exist', () => {
  const names = buildTools({ client: {} }).map(t => t.name).join(' ');
  assert.doesNotMatch(names, /trade|order|buy|sell|cancel|start|stop|withdraw|connect|upgrade|bot/i);
});

test('grader: one-coin portfolio scores low, balanced one scores high', () => {
  const bad = gradePortfolio([{ symbol: 'PEPE', value: 5000, type: 'crypto' }]);
  assert.equal(bad.grade, 'F');
  assert.match(bad.tips.join(' '), /PEPE is 100%/);
  const good = gradePortfolio([
    { symbol: 'BTC', value: 2000 }, { symbol: 'ETH', value: 1500 }, { symbol: 'SOL', value: 800 },
    { symbol: 'VOO', value: 2000, type: 'etf' }, { symbol: 'AAPL', value: 900 }, { symbol: 'NVDA', value: 900 },
    { symbol: 'MSFT', value: 900 }, { symbol: 'JNJ', value: 700 }, { symbol: 'USDC', value: 1000 },
  ]);
  assert.ok(['A', 'B'].includes(good.grade), `got ${good.grade} ${good.score}`);
  assert.equal(good.allocation.cash, '9.3%');
});

test('grader: zero total is a clean error via the tool', async () => {
  const r = await find(buildTools({ client: {} }), 'grade_portfolio').handler({ holdings: [{ symbol: 'BTC', value: 0 }] });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /\$0/);
});

test('demo signals call the public route with no auth', async () => {
  const api = await startMock({ 'GET /api/public/signals/demo': () => [200, { success: true, execution: false, signals: [] }] });
  const r = await find(buildTools({ client: createClient({ baseUrl: api.url }) }), 'demo_signals').handler({});
  assert.match(r.content[0].text, /"execution": false/);
  assert.equal(api.calls[0].auth, undefined);
  await api.close();
});
