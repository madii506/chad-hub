// CHAD · the page under the desk: virgin vs chad (real numbers), what each side holds, the FAQ
import { $, $$, on, esc, usd, pct, cls, num, short, coinIcon } from './core.js';
import * as api from './api.js';

export function init() {
  on('board', d => { vs(d); hold(d); });
  $$('#faqList details').forEach(x => x.addEventListener('toggle', () => { if (x.open) $$('#faqList details').forEach(o => { if (o !== x) o.open = false; }); }));
}
const posOf = st => (st && st.assetPositions || []).map(x => x.position).filter(p => +p.szi).map(p => ({ coin: p.coin, szi: +p.szi, val: Math.abs(+p.positionValue) })).sort((a, b) => b.val - a.val);

async function vs(d) {
  const c = d.windows.m.chads[0], v = d.windows.m.virgins[0]; if (c == null || v == null) return;
  const C = d.rows[c], V = d.rows[v];
  const card = (r, k) => { const p = r.p.m || [];
    return `<div class="vs-card ${k}"><span class="vs-tag">${k === 'c' ? 'THE CHAD · #1 OVER 30 DAYS' : 'THE VIRGIN · LAST OVER 30 DAYS'}</span>
      <div class="vs-who"><b>${esc(r.n || short(r.a))}</b><span>${esc(r.a)}</span></div>
      <div class="vs-big ${cls(p[0])}">${p[0] >= 0 ? '+' : ''}${usd(p[0])}</div>
      <div class="vs-kv"><div><span>ROI 30d</span><b class="${cls(p[1])}">${pct(p[1] * 100, 1)}</b></div><div><span>Volume 30d</span><b>${usd(p[2])}</b></div><div><span>Account</span><b>${usd(r.av)}</b></div></div>
      <div class="vs-pos" data-a="${esc(r.a)}"><span class="muted" style="border:0">Reading what he holds…</span></div>
      <button class="btn ${k === 'c' ? 'btn-gold' : 'btn-line'}" data-go="${esc(r.a)}" data-m="${k === 'c' ? 'tail' : 'fade'}" type="button">${k === 'c' ? 'Tail him' : 'Fade him'}</button></div>`; };
  $('#vsCards').innerHTML = card(C, 'c') + card(V, 'v');
  $('#vsLede').textContent = `The best and the worst trader on Hyperliquid over the last 30 days, out of ${d.total.toLocaleString('en-US')} on its public leaderboard. ${d.profitable.toLocaleString('en-US')} of them are up this month.`;
  $('#vsCards').onclick = e => { const b = e.target.closest('[data-go]'); if (!b || !window.__chad) return; window.__chad.select(b.dataset.go).then(() => window.__chad.mode(b.dataset.m)); document.getElementById('desk').scrollIntoView({ behavior: 'smooth' }); };
  for (const r of [C, V]) api.account(r.a).then(st => {
    const box = document.querySelector(`.vs-pos[data-a="${r.a}"]`); if (!box) return; const P = posOf(st).slice(0, 5);
    box.innerHTML = P.length ? P.map(p => `<span>${coinIcon(p.coin, 'ci')}<b class="${p.szi > 0 ? 'up' : 'dn'}">${p.szi > 0 ? 'LONG' : 'SHORT'}</b> ${esc(p.coin)} ${usd(p.val)}</span>`).join('') : '<span class="muted" style="border:0">Flat right now.</span>';
  }).catch(() => {});
}

async function hold(d) {
  let h = d.hold;
  if (!h) {   // the edge function was down: read the top and bottom 10 from here
    const top = d.windows.m.chads.slice(0, 10).map(i => d.rows[i].a), bot = d.windows.m.virgins.slice(0, 10).map(i => d.rows[i].a);
    const read = L => Promise.all(L.map(a => api.account(a).catch(() => null)));
    const [a, b] = await Promise.all([read(top), read(bot)]);
    const agg = sts => { const by = {}; for (const st of sts) for (const p of posOf(st)) { const c = by[p.coin] || (by[p.coin] = { coin: p.coin, long: 0, short: 0, ntl: 0, gross: 0 }); p.szi > 0 ? c.long++ : c.short++; c.ntl += p.szi > 0 ? p.val : -p.val; c.gross += p.val; } return Object.values(by).sort((x, y) => y.gross - x.gross).slice(0, 16); };
    h = { chads: agg(a), virgins: agg(b) };
  }
  const draw = (L, el) => { const mx = Math.max(1, ...L.map(x => x.long + x.short));
    el.innerHTML = L.length ? L.map(x => `<div class="hr"><span class="cn">${coinIcon(x.coin, 'ci')}${esc(x.coin)}</span><div><div class="bar" style="width:${Math.max(18, (x.long + x.short) / mx * 100)}%"><i class="l" style="width:${x.long / (x.long + x.short) * 100}%"></i><i class="s" style="width:${x.short / (x.long + x.short) * 100}%"></i></div><div class="ls"><span>${x.long} long</span><span>${x.short} short</span></div></div><span class="nt ${cls(x.ntl)}">${x.ntl >= 0 ? 'net long' : 'net short'}<br>${usd(Math.abs(x.ntl))}</span></div>`).join('') : '<p class="empty mono">Nobody holds anything right now.</p>'; };
  draw(h.chads, $('#holdC')); draw(h.virgins, $('#holdV'));
}
