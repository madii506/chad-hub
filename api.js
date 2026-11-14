// CHAD · live data straight from the source: Hyperliquid (the leaderboard, every trader's positions, fills, live mids and trades),
// Jupiter (pump.fun's live pulse, tokens, holdings and swaps) and GeckoTerminal (curve and pool candles, trades).
import { emit } from './core.js';

export const HL = 'https://api.hyperliquid.xyz';
const LB = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
export const JUP = 'https://lite-api.jup.ag', JDP = 'https://datapi.jup.ag', GT = 'https://api.geckoterminal.com/api/v2/networks/solana';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

async function j(url, opt = {}, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: c.signal });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = txt; }
    if (!r.ok) { const e = new Error((d && (d.error || d.message || d.errorMessage)) || ('HTTP ' + r.status)); e.status = r.status; e.body = d; throw e; }
    return d;
  } finally { clearTimeout(t); }
}
export const info = body => j(HL + '/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- perps (one read feeds the whole page)
export const perps = { list: [], by: {}, at: 0 };
export async function loadPerps() {
  const [meta, ctx] = await info({ type: 'metaAndAssetCtxs' });
  const list = meta.universe.map((u, i) => {
    const c = ctx[i] || {}; const mark = +c.markPx, prev = +c.prevDayPx, f = +c.funding;
    return { name: u.name, asset: i, szDec: u.szDecimals, maxLev: u.maxLeverage, delisted: !!u.isDelisted, onlyIso: !!u.onlyIsolated,
      mark, mid: +c.midPx || mark, prev, chg: prev ? (mark / prev - 1) * 100 : null, fund: f, oi: +c.openInterest * mark, vol: +c.dayNtlVlm };
  }).filter(p => !p.delisted && isFinite(p.mark) && p.mark > 0);
  perps.list = list; perps.by = Object.fromEntries(list.map(p => [p.name, p])); perps.at = Date.now();
  emit('perps', perps);
  return perps;
}

// ---------------------------------------------------------------- one websocket: mids for everything, fills for the traders we watch
export const mids = {};
const subs = new Set(), tsubs = new Set(); let ws = null, tries = 0;
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
export function live() {
  const open = () => {
    try { ws = new WebSocket('wss://api.hyperliquid.xyz/ws'); } catch { return; }
    ws.onopen = () => { tries = 0; send({ method: 'subscribe', subscription: { type: 'allMids' } }); subs.forEach(u => send({ method: 'subscribe', subscription: { type: 'userFills', user: u } })); tsubs.forEach(c => send({ method: 'subscribe', subscription: { type: 'trades', coin: c } })); };
    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        if (m.channel === 'allMids') { for (const [k, v] of Object.entries(m.data.mids)) mids[k] = +v; emit('mids', mids); }
        else if (m.channel === 'userFills' && m.data && !m.data.isSnapshot) emit('fills', { user: String(m.data.user).toLowerCase(), fills: m.data.fills || [] });
        else if (m.channel === 'trades' && Array.isArray(m.data)) emit('trades', m.data);
      } catch {}
    };
    ws.onclose = () => { if (tries++ < 30) setTimeout(open, Math.min(30000, 1500 * tries)); };
  };
  open();
  setInterval(() => send({ method: 'ping' }), 45000);
}
export function watchTrades(coins) { for (const c of coins) { if (tsubs.has(c)) continue; tsubs.add(c); send({ method: 'subscribe', subscription: { type: 'trades', coin: c } }); } }
export function watchFills(users) {
  for (const u of users.map(x => x.toLowerCase())) { if (subs.has(u)) continue; subs.add(u); send({ method: 'subscribe', subscription: { type: 'userFills', user: u } }); }
}

// ---------------------------------------------------------------- traders
export const account = user => info({ type: 'clearinghouseState', user });
export const portfolio = user => info({ type: 'portfolio', user });
export const fills = user => info({ type: 'userFills', user });
export const openOrders = user => info({ type: 'frontendOpenOrders', user });
export const spotAccount = user => info({ type: 'spotClearinghouseState', user });
export const predictedFundings = () => info({ type: 'predictedFundings' });
export const candles = (coin, interval, ms) => info({ type: 'candleSnapshot', req: { coin, interval, startTime: Date.now() - ms, endTime: Date.now() } })
  .then(a => a.map(c => ({ t: c.t, o: +c.o, h: +c.h, l: +c.l, c: +c.c, v: +c.v })));

// ---------------------------------------------------------------- the boards: our edge function, or the raw leaderboard if it is down
export const board = { data: null };
const W = { day: 'd', week: 'w', month: 'm', allTime: 't' };
function cut(lb) {
  const all = (lb.leaderboardRows || []).filter(r => +r.accountValue >= 1000), rows = [], idx = new Map();
  const add = r => { if (idx.has(r.ethAddress)) return idx.get(r.ethAddress); const p = {}; for (const [w, v] of r.windowPerformances || []) if (W[w]) p[W[w]] = [Math.round(+v.pnl), +v.roi, Math.round(+v.vlm)]; rows.push({ a: r.ethAddress, n: r.displayName || null, av: Math.round(+r.accountValue), p }); idx.set(r.ethAddress, rows.length - 1); return rows.length - 1; };
  const perf = (r, w) => { const x = (r.windowPerformances || []).find(v => v[0] === w); return x ? +x[1].pnl : 0; };
  const windows = {};
  for (const w of Object.keys(W)) { const s = [...all].sort((a, b) => perf(b, w) - perf(a, w)); windows[W[w]] = { chads: s.slice(0, 100).filter(r => perf(r, w) > 0).map(add), virgins: s.slice(-100).reverse().filter(r => perf(r, w) < 0).map(add) }; }
  const whales = [...all].sort((a, b) => +b.accountValue - +a.accountValue).slice(0, 100).map(add);
  return { at: Date.now(), total: (lb.leaderboardRows || []).length, ranked: all.length, profitable: all.filter(r => perf(r, 'month') > 0).length, named: all.filter(r => r.displayName).length, rows, windows, whales, hold: null };
}
export async function loadBoard() {
  let d = null;
  try { d = await j('/api/board', {}, 15000); if (!d || !d.rows) d = null; } catch {}
  if (!d) d = cut(await j(LB, {}, 30000));
  board.data = d; emit('board', d);
  return d;
}

// ---------------------------------------------------------------- the trenches: pump.fun's live pulse, tokens, holdings and swaps (Jupiter), candles and trades (GeckoTerminal)
export const gems = (launchpads = ['pump.fun']) => { const f = { timeframe: '24h', launchpads }; return j(JDP + '/v1/pools/gems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recent: f, aboutToGraduate: f, graduated: f }) }); };
export const search = q => j(`${JUP}/tokens/v2/search?query=${encodeURIComponent(q)}`);
export const holdings = addr => j(`${JUP}/ultra/v1/holdings/${addr}`);
export const order = p => j(`${JUP}/ultra/v1/order?` + new URLSearchParams(p).toString());
export const execute = (signedTransaction, requestId) => j(`${JUP}/ultra/v1/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedTransaction, requestId }) }, 60000);
export const gtPools = mint => j(`${GT}/tokens/${mint}/pools`).then(d => (d.data || []).map(p => ({ id: p.attributes.address, dex: p.relationships && p.relationships.dex && p.relationships.dex.data && p.relationships.dex.data.id, liq: +p.attributes.reserve_in_usd || 0 })));
export const gtCandles = (pool, tf = 'minute', agg = 1, limit = 150) => j(`${GT}/pools/${pool}/ohlcv/${tf}?aggregate=${agg}&limit=${limit}`)
  .then(d => ((d.data && d.data.attributes && d.data.attributes.ohlcv_list) || []).map(c => ({ t: c[0] * 1000, o: +c[1], h: +c[2], l: +c[3], c: +c[4], v: +c[5] })).reverse());
export const gtTrades = pool => j(`${GT}/pools/${pool}/trades`).then(d => (d.data || []).map(x => x.attributes));
