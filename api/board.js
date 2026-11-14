// CHAD · the boards. Hyperliquid's public leaderboard (~48K traders) cut down to what the page needs:
// the chads (top PnL) and the virgins (worst PnL) for each window, the whales, and what the top 25 of each side hold right now.
// Cached at the edge for 5 minutes, so the page never pulls 20 MB of JSON itself.
const LB = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const INFO = 'https://api.hyperliquid.xyz/info';
const WIN = { day: 'd', week: 'w', month: 'm', allTime: 't' };
const N = 100, HOLD = 25;

async function json(url, opt = {}, ms = 9000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...opt, signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const info = body => json(INFO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 6000);

async function pool(items, k, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: k }, async () => { while (i < items.length) { const n = i++; try { out[n] = await fn(items[n]); } catch { out[n] = null; } } }));
  return out;
}

// what a group of traders holds: per coin, how many are long and short, and the net notional
function holdings(states) {
  const by = {};
  for (const st of states) {
    if (!st) continue;
    for (const ap of st.assetPositions || []) {
      const p = ap.position || {}, szi = +p.szi, v = Math.abs(+p.positionValue || 0); if (!szi || !v) continue;
      const c = by[p.coin] || (by[p.coin] = { coin: p.coin, long: 0, short: 0, ntl: 0, gross: 0 });
      if (szi > 0) c.long++; else c.short++;
      c.ntl += szi > 0 ? v : -v; c.gross += v;
    }
  }
  return Object.values(by).sort((a, b) => b.gross - a.gross).slice(0, 16).map(c => ({ ...c, ntl: Math.round(c.ntl), gross: Math.round(c.gross) }));
}

module.exports = async (req, res) => {
  try {
    const lb = await json(LB, {}, 12000);
    const all = (lb.leaderboardRows || []).filter(r => +r.accountValue >= 1000);
    const rows = [], idx = new Map();
    const add = r => {
      if (idx.has(r.ethAddress)) return idx.get(r.ethAddress);
      const p = {};
      for (const [w, v] of r.windowPerformances || []) if (WIN[w]) p[WIN[w]] = [Math.round(+v.pnl), +(+v.roi).toFixed(5), Math.round(+v.vlm)];
      rows.push({ a: r.ethAddress, n: r.displayName || null, av: Math.round(+r.accountValue), p });
      idx.set(r.ethAddress, rows.length - 1); return rows.length - 1;
    };
    const perf = (r, w) => { const x = (r.windowPerformances || []).find(v => v[0] === w); return x ? +x[1].pnl : 0; };
    const windows = {};
    for (const w of Object.keys(WIN)) {
      const s = [...all].sort((a, b) => perf(b, w) - perf(a, w));
      windows[WIN[w]] = { chads: s.slice(0, N).filter(r => perf(r, w) > 0).map(add), virgins: s.slice(-N).reverse().filter(r => perf(r, w) < 0).map(add) };
    }
    const whales = [...all].sort((a, b) => +b.accountValue - +a.accountValue).slice(0, N).map(add);
    const profitable = all.filter(r => perf(r, 'month') > 0).length;
    // what the month's top 25 and bottom 25 hold right now
    const top = windows.m.chads.slice(0, HOLD).map(i => rows[i].a), bot = windows.m.virgins.slice(0, HOLD).map(i => rows[i].a);
    const [hc, hv] = await Promise.all([pool(top, 8, a => info({ type: 'clearinghouseState', user: a })), pool(bot, 8, a => info({ type: 'clearinghouseState', user: a }))]);
    const body = { at: Date.now(), total: (lb.leaderboardRows || []).length, ranked: all.length, profitable, named: all.filter(r => r.displayName).length, rows, windows, whales, hold: { chads: holdings(hc), virgins: holdings(hv) } };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=900');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(body));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=30');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(e && e.message || e) }));
  }
};
