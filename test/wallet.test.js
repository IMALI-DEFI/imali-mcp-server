import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWallet, toUnits, isAddress, CHAINS } from '../src/wallet.js';
import { buildTools } from '../src/tools.js';

const ADDR = '0x' + 'ab'.repeat(20);
const hex = n => '0x' + BigInt(n).toString(16);

// Fake RPC + price feed: 2 ETH and 1,000 USDC on Ethereum, 0.5 BNB-chain ETH; Polygon down.
function fakeFetch({ polygonDown = true } = {}) {
  return async (url, opts) => {
    if (url.includes('simple/price')) return { ok: true, json: async () => ({ ethereum: { usd: 2000 }, 'usd-coin': { usd: 1 }, binancecoin: { usd: 500 } }) };
    const chain = Object.entries(CHAINS).find(([, c]) => c.rpcs.includes(url))?.[0];
    if (chain === 'polygon' && polygonDown) throw new Error('network down');
    const batch = JSON.parse(opts.body);
    const c = CHAINS[chain];
    const res = batch.map(r => {
      if (r.method === 'eth_getBalance') return { id: r.id, result: chain === 'ethereum' ? hex(2n * 10n ** 18n) : '0x0' };
      const tok = c.tokens[r.id - 1];
      if (chain === 'ethereum' && tok.symbol === 'USDC') return { id: r.id, result: hex(1000n * 10n ** 6n) };
      if (chain === 'bsc' && tok.symbol === 'ETH') return { id: r.id, result: hex(5n * 10n ** 17n) };
      return { id: r.id, result: '0x' + '0'.repeat(64) };
    });
    return { ok: true, json: async () => res };
  };
}

test('toUnits is exact and isAddress validates', () => {
  assert.equal(toUnits(hex(1234567n), 6), 1.234567);
  assert.equal(toUnits('0x0', 18), 0);
  assert.equal(toUnits(hex(10n ** 30n), 18), 1e12);
  assert.ok(isAddress(ADDR));
  assert.ok(!isAddress('0x123'));
  assert.ok(!isAddress('vitalik.eth'));
});

test('readWallet merges ETH across chains, keeps going when one chain is down', async () => {
  const w = await readWallet(ADDR, undefined, fakeFetch());
  const eth = w.holdings.find(h => h.symbol === 'ETH');
  assert.equal(eth.value, 5000); // 2 ETH + 0.5 ETH on BNB Chain, at $2000
  assert.equal(w.holdings.find(h => h.symbol === 'USDC').value, 1000);
  assert.deepEqual(w.chains_read.sort(), ['BNB Chain', 'Ethereum']);
  assert.match(w.chain_errors[0], /Polygon/);
});

test('grade_wallet tool grades live holdings and never asks for keys', async () => {
  const tools = buildTools({ client: {}, walletReader: (a, c) => readWallet(a, c, fakeFetch()) });
  const t = tools.find(x => x.name === 'grade_wallet');
  assert.doesNotMatch(JSON.stringify(Object.keys(t.shape)), /key|seed|private|mnemonic/i);
  const r = await t.handler({ address: ADDR });
  const text = r.content[0].text;
  assert.match(text, /"grade": "[A-F]"/);
  assert.match(text, /"total_usd": 6000/);
  assert.match(text, /utm_source=mcp/);
});

test('grade_wallet: bad address and empty wallet give clean answers', async () => {
  const tools = buildTools({ client: {}, walletReader: (a, c) => readWallet(a, c, fakeFetch()) });
  const t = tools.find(x => x.name === 'grade_wallet');
  const bad = await t.handler({ address: 'not-an-address' });
  assert.equal(bad.isError, true);
  const empty = buildTools({ client: {}, walletReader: async () => ({ holdings: [], assets: [], chains_read: ['Ethereum'], chain_errors: [], unpriced: [], read_at: 'x' }) })
    .find(x => x.name === 'grade_wallet');
  assert.match((await empty.handler({ address: ADDR })).content[0].text, /No priced balances/);
});
