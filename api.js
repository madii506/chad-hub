// CHAD · live data straight from Hyperliquid: the leaderboard, every trader's positions, fills and equity, live mids and fills
import { emit } from './core.js';

export const HL = 'https://api.hyperliquid.xyz';
const LB = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';

async function j(url, opt = {}, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: c.signal });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = txt; }
    if (!r.ok) { const e = new Error((d && (d.error || d.message)) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
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
const subs = new Set(); let ws = null, tries = 0;
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
export function live() {
  const open = () => {
    try { ws = new WebSocket('wss://api.hyperliquid.xyz/ws'); } catch { return; }
    ws.onopen = () => { tries = 0; send({ method: 'subscribe', subscription: { type: 'allMids' } }); subs.forEach(u => send({ method: 'subscribe', subscription: { type: 'userFills', user: u } })); };
    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        if (m.channel === 'allMids') { for (const [k, v] of Object.entries(m.data.mids)) mids[k] = +v; emit('mids', mids); }
        else if (m.channel === 'userFills' && m.data && !m.data.isSnapshot) emit('fills', { user: String(m.data.user).toLowerCase(), fills: m.data.fills || [] });
      } catch {}
    };
    ws.onclose = () => { if (tries++ < 30) setTimeout(open, Math.min(30000, 1500 * tries)); };
  };
  open();
  setInterval(() => send({ method: 'ping' }), 45000);
}
export function watchFills(users) {
  for (const u of users.map(x => x.toLowerCase())) { if (subs.has(u)) continue; subs.add(u); send({ method: 'subscribe', subscription: { type: 'userFills', user: u } }); }
}

// ---------------------------------------------------------------- traders
export const account = user => info({ type: 'clearinghouseState', user });
export const portfolio = user => info({ type: 'portfolio', user });
export const fills = user => info({ type: 'userFills', user });
export const openOrders = user => info({ type: 'frontendOpenOrders', user });
export const spotAccount = user => info({ type: 'spotClearinghouseState', user });
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
