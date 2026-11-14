// CHAD · the nav tools: the ⌘K palette, markets, compare, the share card, alerts and a board export.
// Everything reads Hyperliquid's public data live. Nothing here needs an account with us.
import { $, $$, on, esc, usd, px, pct, cls, toast, copy, store, short, coinIcon } from './core.js';
import * as api from './api.js';
import { scrollTo } from './motion.js';

const WIN = { d: '24h', w: '7d', m: '30d', t: 'all-time' };
const lc = a => String(a || '').toLowerCase();
const nameOf = r => (r && r.n) || short(r ? r.a : '');
const rowOf = a => { const d = api.board.data; return d && a ? d.rows.find(r => lc(r.a) === lc(a)) || null : null; };
const rankOf = (a, w = 'm') => { const d = api.board.data; if (!d || !a) return null; for (const k of ['chads', 'virgins']) { const i = d.windows[w][k].findIndex(n => lc(d.rows[n].a) === lc(a)); if (i >= 0) return { k, i: i + 1 }; } return null; };
const sel = () => (window.__chad ? window.__chad.sel() : null);
const pick = a => { if (window.__chad) window.__chad.select(a); $('#modal').hidden = true; scrollTo(0); };
const stars = () => store.get('chad:stars', []);
const signed = v => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + usd(v));
const isAddr = s => /^0x[0-9a-fA-F]{40}$/.test(String(s).trim());
const rkTag = rk => (rk ? `<em class="rk-tag ${rk.k === 'virgins' ? 'v' : ''}">${rk.k === 'virgins' ? 'virgin' : 'chad'} #${rk.i}</em>` : '');
let BASE = {};

// ---------------------------------------------------------------- the shared modal (wide when a panel needs room), with a hook for when it closes
let closeHook = null;
const H = { mids: null, perps: null };
on('mids', v => H.mids && H.mids(v)); on('perps', v => H.perps && H.perps(v));
export function panel(title, body, bind, wide = false) {
  if (closeHook) { const f = closeHook; closeHook = null; try { f(); } catch {} }
  $('#mTitle').textContent = title; const b = $('#mBody'); b.innerHTML = body; b.onclick = null; b.oninput = null; b.onchange = null; b.onkeydown = null;
  $('.modal-in').classList.toggle('wide', !!wide);
  $('#modal').hidden = false; bind && bind(b);
}
const whenClosed = f => { closeHook = f; };
new MutationObserver(() => { if ($('#modal').hidden && closeHook) { const f = closeHook; closeHook = null; try { f(); } catch {} } }).observe($('#modal'), { attributes: true, attributeFilter: ['hidden'] });

// a small line chart on a canvas, sized to its box
function line(cv, series, opt = {}) {
  const box = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), Wd = Math.max(10, box.width), Hd = Math.max(10, box.height);
  cv.width = Wd * dpr; cv.height = Hd * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, Wd, Hd);
  const all = series.flatMap(s => s.pts).filter(p => isFinite(p.v)); if (all.length < 2) return false;
  const P = opt.pad || { l: 6, r: opt.axis ? 64 : 6, t: 8, b: opt.axis ? 20 : 6 }, w = Wd - P.l - P.r, h = Hd - P.t - P.b;
  let lo = Math.min(...all.map(p => p.v)), hi = Math.max(...all.map(p => p.v)); if (opt.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const t0 = Math.min(...all.map(p => p.t)), t1 = Math.max(...all.map(p => p.t)), X = t => P.l + (t - t0) / Math.max(1, t1 - t0) * w, Y = v => P.t + (1 - (v - lo) / (hi - lo)) * h;
  if (opt.axis) {
    g.font = '10.5px GeistMono, monospace'; g.fillStyle = '#586070'; g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); g.beginPath(); g.moveTo(P.l, y); g.lineTo(P.l + w, y); g.stroke(); g.textAlign = 'left'; g.fillText(usd(v), P.l + w + 8, y + 3); }
    g.textAlign = 'left'; g.fillText(new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), P.l, Hd - 5); g.textAlign = 'right'; g.fillText(new Date(t1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), P.l + w, Hd - 5);
  }
  if (opt.zero) { g.strokeStyle = 'rgba(255,255,255,.16)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(P.l, Y(0)); g.lineTo(P.l + w, Y(0)); g.stroke(); g.setLineDash([]); }
  for (const s of series) {
    const pts = s.pts.filter(p => isFinite(p.v)); if (pts.length < 2) continue;
    if (s.fill) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(p.v)) : g.moveTo(X(p.t), Y(p.v)))); g.lineTo(X(pts[pts.length - 1].t), P.t + h); g.lineTo(X(pts[0].t), P.t + h); g.closePath(); g.fillStyle = s.fill; g.fill(); }
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(p.v)) : g.moveTo(X(p.t), Y(p.v)))); g.strokeStyle = s.col; g.lineWidth = s.w || 2; g.lineJoin = 'round'; g.stroke();
    const l = pts[pts.length - 1]; g.fillStyle = s.col; g.beginPath(); g.arc(X(l.t), Y(l.v), 3, 0, 7); g.fill();
  }
  return true;
}

// ---------------------------------------------------------------- markets: every perp, live prices, funding, open interest, who on the board holds it
const MK = { tab: 'vol', q: '', col: null, dir: -1, open: null };
const MTABS = [['vol', 'Top volume'], ['up', 'Gainers'], ['dn', 'Losers'], ['fp', 'Funding +'], ['fn', 'Funding −'], ['oi', 'Open interest']];
const SPC = {};
function mkRows() {
  let L = api.perps.list.slice(); const q = MK.q.trim().toUpperCase(); if (q) L = L.filter(p => p.name.toUpperCase().includes(q));
  const tabKey = { vol: p => p.vol, up: p => p.chg ?? -1e9, dn: p => -(p.chg ?? 1e9), fp: p => p.fund, fn: p => -p.fund, oi: p => p.oi };
  const colKey = { coin: p => p.name, px: p => p.mark, chg: p => p.chg ?? -1e9, fund: p => p.fund, oi: p => p.oi, vol: p => p.vol };
  if (MK.col) { const k = colKey[MK.col]; L.sort((a, b) => { const x = k(a), y = k(b); return (x > y ? 1 : x < y ? -1 : 0) * MK.dir; }); }
  else { const k = tabKey[MK.tab]; L.sort((a, b) => k(b) - k(a)); }
  return L.slice(0, 60);
}
function holdLine(coin) {
  const h = api.board.data && api.board.data.hold; if (!h) return '<span class="muted">Board holdings load with the board.</span>';
  const one = (L, who) => { const c = (L || []).find(x => x.coin === coin); return `<span><b class="${who === 'chads' ? 'gold' : 'dn'}">${who === 'chads' ? 'Top 25 chads' : 'Top 25 virgins'}</b>${c ? `${c.long} long · ${c.short} short · net ${c.ntl >= 0 ? 'long' : 'short'} ${usd(Math.abs(c.ntl))}` : 'none of them hold it'}</span>`; };
  return one(h.chads, 'chads') + one(h.virgins, 'virgins');
}
async function spark(coin) {
  let c = SPC[coin];
  if (!c || Date.now() - c.at > 120000) { try { c = SPC[coin] = { at: Date.now(), d: await api.candles(coin, '1h', 48 * 3600e3) }; } catch { return; } }
  const cv = $$('canvas.mk-sp').find(x => x.dataset.sp === coin); if (!cv || !c.d || c.d.length < 2) return;
  const up = c.d[c.d.length - 1].c >= c.d[0].c;
  line(cv, [{ pts: c.d.map(x => ({ t: x.t, v: x.c })), col: up ? '#36d77a' : '#ff4d5a', fill: up ? 'rgba(54,215,122,.08)' : 'rgba(255,77,90,.08)' }]);
}
export function markets(q) {
  if (q != null) { MK.q = q; MK.col = null; MK.open = q && api.perps.by[q] ? q : MK.open; }
  const draw = b => {
    const T = $('#mkT', b); if (!T) return;
    if (!api.perps.list.length) { T.innerHTML = '<p class="empty mono">Reading Hyperliquid…</p>'; return; }
    const L = mkRows(), th = (k, l, r) => `<button type="button" data-col="${k}" class="${MK.col === k ? 'on' : ''}${r ? ' r' : ''}">${l}${MK.col === k ? (MK.dir > 0 ? ' ↑' : ' ↓') : ''}</button>`;
    T.innerHTML = `<div class="mk-h">${th('coin', 'Coin')}${th('px', 'Price', 1)}${th('chg', '24h', 1)}${th('fund', 'Funding 1h · APR', 1)}${th('oi', 'Open interest', 1)}${th('vol', 'Volume 24h', 1)}</div>` + (L.length ? L.map(p => `
      <button type="button" class="mk-r${MK.open === p.name ? ' open' : ''}" data-coin="${esc(p.name)}"><span class="mk-c">${coinIcon(p.name, 'ci')}<b>${esc(p.name)}</b><em>${p.maxLev}x</em></span><span class="r" data-px="${esc(p.name)}">${px(api.mids[p.name] || p.mark)}</span><span class="r ${cls(p.chg)}">${pct(p.chg, 2)}</span><span class="r ${cls(p.fund)}">${(p.fund * 100).toFixed(4)}% · ${(p.fund * 24 * 365 * 100).toFixed(1)}%</span><span class="r">${usd(p.oi)}</span><span class="r">${usd(p.vol)}</span></button>
      ${MK.open === p.name ? `<div class="mk-x"><div class="mk-sp-w"><span class="mono">48h</span><canvas class="mk-sp" data-sp="${esc(p.name)}"></canvas></div><div class="mk-hold">${holdLine(p.name)}</div><a class="btn btn-sm btn-line" href="https://app.hyperliquid.xyz/trade/${encodeURIComponent(p.name)}" target="_blank" rel="noopener">Trade on Hyperliquid ↗</a></div>` : ''}`).join('') : '<p class="empty mono">No perp matches that.</p>');
    if (MK.open) spark(MK.open);
  };
  const tabs = MTABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${!MK.col && MK.tab === k ? 'on' : ''}">${l}</button>`).join('');
  panel('Markets', `<div class="mk-top"><div class="seg seg-sm mk-tabs">${tabs}</div><input class="inp mk-q" id="mkQ" placeholder="Filter coins" value="${esc(MK.q)}" autocomplete="off" spellcheck="false"></div>
    <div class="mk-t" id="mkT"></div><p class="m-note">Every Hyperliquid perp, read live from its public API. Funding is the hourly rate and its yearly pace; positive means longs pay shorts. Open a coin for its 48h chart and what the board's top traders hold in it.</p>`, b => {
    draw(b);
    b.onclick = e => {
      const t = e.target.closest('[data-tab]'); if (t) { MK.tab = t.dataset.tab; MK.col = null; $$('.mk-tabs button', b).forEach(x => x.classList.toggle('on', x === t)); return draw(b); }
      const c = e.target.closest('[data-col]'); if (c) { if (MK.col === c.dataset.col) MK.dir = -MK.dir; else { MK.col = c.dataset.col; MK.dir = c.dataset.col === 'coin' ? 1 : -1; } $$('.mk-tabs button', b).forEach(x => x.classList.remove('on')); return draw(b); }
      const r = e.target.closest('.mk-r'); if (r) { MK.open = MK.open === r.dataset.coin ? null : r.dataset.coin; draw(b); }
    };
    b.oninput = e => { if (e.target.id === 'mkQ') { MK.q = e.target.value; draw(b); } };
    let last = 0;
    H.mids = () => { if (Date.now() - last < 900) return; last = Date.now(); $$('[data-px]', b).forEach(el => { const v = api.mids[el.dataset.px]; if (!v) return; const nv = px(v); if (el.textContent !== nv) { el.textContent = nv; el.classList.remove('fl'); void el.offsetWidth; el.classList.add('fl'); } }); };
    H.perps = () => draw(b);
    whenClosed(() => { H.mids = H.perps = null; });
    if (!api.perps.list.length) api.loadPerps().catch(() => { const T = $('#mkT', b); if (T) T.innerHTML = '<p class="empty mono">Could not reach Hyperliquid. It retries every 30 seconds.</p>'; });
  }, true);
}

// ---------------------------------------------------------------- compare: two traders, head to head
const CMP = { a: null, b: null, w: 'month', pf: {}, st: {} };
function options(cur) {
  const d = api.board.data; if (!d) return '';
  const o = (a, l) => `<option value="${esc(a)}"${lc(a) === lc(cur) ? ' selected' : ''}>${esc(l)}</option>`;
  const grp = (label, L) => (L.length ? `<optgroup label="${label}">${L.join('')}</optgroup>` : '');
  const ch = d.windows.m.chads.slice(0, 25), vg = d.windows.m.virgins.slice(0, 25), wh = d.whales.slice(0, 15), st = stars();
  const known = [...ch, ...vg, ...wh].some(i => lc(d.rows[i].a) === lc(cur)) || st.some(a => lc(a) === lc(cur));
  return (cur && !known ? o(cur, nameOf(rowOf(cur) || { a: cur })) : '') + grp('Chads · 30d', ch.map((i, k) => o(d.rows[i].a, `#${k + 1} ${nameOf(d.rows[i])}`))) + grp('Virgins · 30d', vg.map((i, k) => o(d.rows[i].a, `#${k + 1} ${nameOf(d.rows[i])}`)))
    + grp('Whales', wh.map(i => o(d.rows[i].a, `${nameOf(d.rows[i])} · ${usd(d.rows[i].av)}`))) + grp('Starred', st.map(a => o(a, nameOf(rowOf(a) || { a }))));
}
export function compare(a, b) {
  const d = api.board.data; if (!d) return toast('The board is still loading.', 'err', 3000);
  const first = L => (L.length ? d.rows[L[0]].a : null);
  CMP.a = a || sel() || first(d.windows.m.chads);
  if (b) CMP.b = b;
  else { const rk = rankOf(CMP.a), L = rk && rk.k === 'chads' ? d.windows.m.virgins : d.windows.m.chads; CMP.b = first(L); if (lc(CMP.b) === lc(CMP.a)) CMP.b = L.length > 1 ? d.rows[L[1]].a : first(d.whales); }
  panel('Compare', `<div class="cmp-pick"><div class="cmp-side"><i class="cmp-dot a"></i><select id="cmpA">${options(CMP.a)}</select><input class="inp" id="cmpAq" placeholder="or paste 0x…" spellcheck="false" autocomplete="off"></div>
      <button class="btn btn-sm btn-line cmp-sw" id="cmpSw" type="button" aria-label="Swap">⇄</button>
      <div class="cmp-side"><i class="cmp-dot b"></i><select id="cmpB">${options(CMP.b)}</select><input class="inp" id="cmpBq" placeholder="or paste 0x…" spellcheck="false" autocomplete="off"></div></div>
    <div class="cmp-t" id="cmpT"></div>
    <div class="cmp-ch"><div class="cmp-ch-h"><span class="mono">PnL over the window</span><div class="seg seg-sm" id="cmpW">${[['week', '7d'], ['month', '30d'], ['allTime', 'All']].map(([k, l]) => `<button type="button" data-w="${k}" class="${CMP.w === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="cmp-cv"><canvas id="cmpCv"></canvas><p class="empty mono" id="cmpEmpty">Reading both books…</p></div></div>
    <div class="cmp-acts"><button class="btn btn-sm btn-line" type="button" data-open="a">Open A on the desk</button><button class="btn btn-sm btn-line" type="button" data-open="b">Open B on the desk</button></div>`, bx => {
    const load = async () => {
      drawCmp();
      const need = [CMP.a, CMP.b].filter(x => x && !CMP.pf[lc(x)]);
      await Promise.all(need.map(async x => { const [pf, st] = await Promise.all([api.portfolio(x).catch(() => null), api.account(x).catch(() => null)]); CMP.pf[lc(x)] = pf || []; CMP.st[lc(x)] = st; }));
      drawCmp();
    };
    bx.onchange = e => { if (e.target.id === 'cmpA') CMP.a = e.target.value; if (e.target.id === 'cmpB') CMP.b = e.target.value; load(); };
    bx.onkeydown = e => { if (e.key !== 'Enter') return; const v = e.target.value.trim(); if (!isAddr(v)) return toast('That is not a Hyperliquid address.', 'err', 3000); if (e.target.id === 'cmpAq') CMP.a = v; if (e.target.id === 'cmpBq') CMP.b = v; $('#cmpA').innerHTML = options(CMP.a); $('#cmpB').innerHTML = options(CMP.b); e.target.value = ''; load(); };
    bx.onclick = e => {
      if (e.target.closest('#cmpSw')) { [CMP.a, CMP.b] = [CMP.b, CMP.a]; $('#cmpA').innerHTML = options(CMP.a); $('#cmpB').innerHTML = options(CMP.b); return drawCmp(); }
      const w = e.target.closest('#cmpW button'); if (w) { CMP.w = w.dataset.w; $$('#cmpW button').forEach(x => x.classList.toggle('on', x === w)); return drawCmp(); }
      const o = e.target.closest('[data-open]'); if (o) pick(o.dataset.open === 'a' ? CMP.a : CMP.b);
    };
    load();
  }, true);
}
function drawCmp() {
  const T = $('#cmpT'); if (!T) return;
  const side = a => { const r = rowOf(a) || { a, n: null, av: null, p: {} }, st = CMP.st[lc(a)], pos = st ? (st.assetPositions || []).map(x => x.position).filter(p => +p.szi) : null; return { a, r, rk: rankOf(a), eq: st ? +st.marginSummary.accountValue : r.av, pos, gross: pos ? pos.reduce((s, p) => s + Math.abs(+p.positionValue || 0), 0) : null }; };
  const A = side(CMP.a), B = side(CMP.b);
  const pnl = (s, w) => (s.r.p[w] || [])[0], roi = (s, w) => (s.r.p[w] || [])[1], vol = (s, w) => (s.r.p[w] || [])[2];
  const row = (label, fa, fb, f = signed, better = 'hi') => { const x = fa, y = fb, bx = x != null && y != null && x !== y ? (better === 'hi' ? (x > y ? 'a' : 'b') : null) : null; return `<div class="cmp-r"><span>${label}</span><b class="${cls(f === signed ? x : null)} ${bx === 'a' ? 'win' : ''}">${x == null ? '—' : f(x)}</b><b class="${cls(f === signed ? y : null)} ${bx === 'b' ? 'win' : ''}">${y == null ? '—' : f(y)}</b></div>`; };
  const head = s => `<div class="cmp-who"><b>${esc(nameOf(s.r))}</b>${rkTag(s.rk)}<span class="mono">${short(s.a)}</span></div>`;
  T.innerHTML = `<div class="cmp-r cmp-hd"><span></span>${head(A)}${head(B)}</div>`
    + row('Account', A.eq, B.eq, usd, 'none')
    + ['d', 'w', 'm', 't'].map(w => row(`PnL ${WIN[w]}`, pnl(A, w), pnl(B, w))).join('')
    + row('ROI 30d', roi(A, 'm'), roi(B, 'm'), v => pct(v * 100, 1))
    + row('Volume 30d', vol(A, 'm'), vol(B, 'm'), usd, 'none')
    + `<div class="cmp-r"><span>Open now</span><b>${A.pos ? `${A.pos.length} positions · ${usd(A.gross)}` : '…'}</b><b>${B.pos ? `${B.pos.length} positions · ${usd(B.gross)}` : '…'}</b></div>`;
  const cv = $('#cmpCv'), em = $('#cmpEmpty'); if (!cv) return;
  const ser = a => { const pf = CMP.pf[lc(a)]; if (!pf) return null; const w = (pf.find(x => x[0] === CMP.w) || [])[1]; const pts = ((w && w.pnlHistory) || []).map(([t, v]) => ({ t: +t, v: +v })); if (pts.length < 2) return []; const z = pts[0].v; return pts.map(p => ({ t: p.t, v: p.v - z })); };
  const sa = ser(CMP.a), sb = ser(CMP.b);
  if (!sa || !sb) { em.hidden = false; em.textContent = 'Reading both books…'; return; }
  const ok = line(cv, [{ pts: sb, col: '#9aa6b8' }, { pts: sa, col: '#e2c06b', w: 2.4 }], { axis: true, zero: true });
  em.hidden = ok; if (!ok) em.textContent = 'No history for this window.';
}

// ---------------------------------------------------------------- the share card: the trader on the desk as a picture to post
const fontsReady = () => Promise.all(['800 64px Outfit', '400 64px Serif', 'italic 400 44px Serif', '500 20px GeistMono', '600 20px Geist'].map(f => document.fonts.load(f).catch(() => null)));
const img = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fit(g, text, max) { let t = text; while (g.measureText(t).width > max && t.length > 4) t = t.slice(0, -2); return t === text ? t : t + '…'; }
async function drawCard(cv, a, pf) {
  await fontsReady();
  const g = cv.getContext('2d'), W = 1200, Hh = 675, r = rowOf(a) || { a, n: null, av: null, p: {} }, rk = rankOf(a), m = r.p.m || [];
  const tone = rk ? (rk.k === 'virgins' ? '#ff4d5a' : '#36d77a') : '#e2c06b';
  g.fillStyle = '#05070b'; g.fillRect(0, 0, W, Hh);
  const gr = g.createRadialGradient(900, 250, 10, 900, 250, 560); gr.addColorStop(0, rk && rk.k === 'virgins' ? 'rgba(255,77,90,.11)' : 'rgba(54,215,122,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1.5; rr(g, 18, 18, W - 36, Hh - 36, 26); g.stroke();
  const sh = await img('/brand-shades.png?v=2'); if (sh) { g.imageSmoothingEnabled = false; g.drawImage(sh, 64, 64, 92, 32); g.imageSmoothingEnabled = true; }
  g.fillStyle = '#f2efe7'; g.font = '800 34px Outfit, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('CHAD', 170, 93);
  g.fillStyle = '#8b93a1'; g.font = '500 17px GeistMono, monospace'; g.textAlign = 'right'; g.fillText('the onchain hub for chads', W - 64, 88);
  // the rank chip
  g.textAlign = 'left'; g.font = '500 16px GeistMono, monospace';
  const chip = rk ? `${rk.k === 'virgins' ? 'VIRGIN' : 'CHAD'} #${rk.i} · 30D` : 'ON HYPERLIQUID', cw = g.measureText(chip).width + 32;
  g.fillStyle = rk && rk.k === 'virgins' ? 'rgba(255,77,90,.12)' : 'rgba(226,192,107,.12)'; rr(g, 64, 150, cw, 38, 10); g.fill(); g.strokeStyle = rk && rk.k === 'virgins' ? 'rgba(255,77,90,.5)' : 'rgba(226,192,107,.5)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = rk && rk.k === 'virgins' ? '#ff4d5a' : '#e2c06b'; g.fillText(chip, 80, 175);
  // who
  g.fillStyle = '#eef0f3'; g.font = '400 80px Serif, Georgia, serif'; g.fillText(fit(g, nameOf(r), 540), 60, 272);
  g.fillStyle = '#586070'; g.font = '500 16px GeistMono, monospace'; g.fillText(a, 64, 308);
  // the number
  g.fillStyle = '#8b93a1'; g.font = '500 16px GeistMono, monospace'; g.fillText('PNL · 30 DAYS', 64, 372);
  g.fillStyle = m[0] == null ? '#eef0f3' : m[0] >= 0 ? '#36d77a' : '#ff4d5a'; g.font = '800 104px Outfit, sans-serif'; g.fillText(fit(g, signed(m[0]), 560), 58, 470);
  const kv = [['ROI', m[1] != null ? pct(m[1] * 100, 1) : '—'], ['ACCOUNT', r.av != null ? usd(r.av) : '—'], ['VOLUME', m[2] != null ? usd(m[2]) : '—']];
  let x = 64; for (const [k, v] of kv) { g.font = '500 14px GeistMono, monospace'; g.fillStyle = '#586070'; g.fillText(k, x, 528); g.font = '600 24px Geist, sans-serif'; g.fillStyle = '#eef0f3'; g.fillText(v, x, 560); x += Math.max(150, g.measureText(v).width + 48); }
  // the chart: his PnL over the month
  const wk = pf && (pf.find(p => p[0] === 'month') || [])[1], pts = wk ? (wk.pnlHistory || []).map(([t, v]) => ({ t: +t, v: +v })) : [];
  const CX = 660, CY = 150, CW = 476, CH = 360;
  g.fillStyle = 'rgba(255,255,255,.025)'; rr(g, CX - 16, CY - 16, CW + 32, CH + 48, 18); g.fill();
  if (pts.length > 1) {
    const z = pts[0].v, v = pts.map(p => p.v - z), lo = Math.min(0, ...v), hi = Math.max(0, ...v), t0 = pts[0].t, t1 = pts[pts.length - 1].t, pad = (hi - lo) * .1 || 1;
    const X = t => CX + (t - t0) / Math.max(1, t1 - t0) * CW, Y = y => CY + (1 - (y - (lo - pad)) / (hi - lo + 2 * pad)) * CH;
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(CX, Y(0)); g.lineTo(CX + CW, Y(0)); g.stroke(); g.setLineDash([]);
    const up = v[v.length - 1] >= 0, col = up ? '#36d77a' : '#ff4d5a';
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(v[i])) : g.moveTo(X(p.t), Y(v[i])))); g.lineTo(X(t1), Y(0)); g.lineTo(X(t0), Y(0)); g.closePath(); g.fillStyle = up ? 'rgba(54,215,122,.14)' : 'rgba(255,77,90,.14)'; g.fill();
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(v[i])) : g.moveTo(X(p.t), Y(v[i])))); g.strokeStyle = col; g.lineWidth = 3.5; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(X(t1), Y(v[v.length - 1]), 6, 0, 7); g.fill();
    g.fillStyle = '#586070'; g.font = '500 14px GeistMono, monospace'; g.textAlign = 'left'; g.fillText(new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), CX, CY + CH + 24); g.textAlign = 'right'; g.fillText(new Date(t1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), CX + CW, CY + CH + 24);
  } else { g.fillStyle = '#586070'; g.font = '500 16px GeistMono, monospace'; g.textAlign = 'center'; g.fillText('no 30-day history', CX + CW / 2, CY + CH / 2); }
  // the verdict and where
  g.textAlign = 'left'; g.fillStyle = tone; g.font = 'italic 400 46px Serif, Georgia, serif'; g.fillText(rk ? (rk.k === 'virgins' ? 'fade him.' : 'tail him.') : 'watch him.', 62, 628);
  g.textAlign = 'right'; g.fillStyle = '#8b93a1'; g.font = '500 17px GeistMono, monospace'; g.fillText(location.host || 'chad', W - 64, 624);
}
export async function share(a0) {
  const a = a0 || sel(); if (!a) return toast('Pick a trader on the desk first.', 'err', 3000);
  const r = rowOf(a) || { a, n: null, p: {} }, rk = rankOf(a), m = r.p.m || [];
  panel('Share card', `<div class="sh-w"><canvas id="shCv" width="1200" height="675"></canvas><p class="empty mono" id="shWait">Drawing his card…</p></div>
    <div class="sh-acts"><button class="btn btn-sm btn-gold" type="button" data-sh="x">Post on X</button><button class="btn btn-sm btn-line" type="button" data-sh="copy">Copy image</button><button class="btn btn-sm btn-line" type="button" data-sh="png">Download PNG</button><button class="btn btn-sm btn-line" type="button" data-sh="link">Copy link</button></div>
    <p class="m-note">Numbers are his, from Hyperliquid's public leaderboard and his own PnL history. X can't attach a picture from a link, so copy or download the card and drop it into the post.</p>`, b => {
    const cv = $('#shCv', b), link = location.origin + location.pathname + '?a=' + a;
    api.portfolio(a).catch(() => null).then(pf => drawCard(cv, a, pf)).then(() => { const w = $('#shWait', b); if (w) w.remove(); });
    const verb = rk ? (rk.k === 'virgins' ? 'Fading' : 'Tailing') : 'Watching';
    b.onclick = async e => {
      const t = e.target.closest('[data-sh]'); if (!t) return;
      const k = t.dataset.sh, blob = () => new Promise(res => cv.toBlob(res, 'image/png'));
      if (k === 'x') window.open('https://x.com/intent/post?text=' + encodeURIComponent(`${verb} ${nameOf(r)} on CHAD. ${signed(m[0])} in 30 days.`) + '&url=' + encodeURIComponent(link), '_blank', 'noopener');
      else if (k === 'png') { const bl = await blob(), u = URL.createObjectURL(bl), el = Object.assign(document.createElement('a'), { href: u, download: `chad-${(r.n || a.slice(0, 8)).replace(/[^\w-]+/g, '_')}.png` }); document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
      else if (k === 'copy') { try { const bl = await blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': bl })]); toast('Card copied. Paste it into your post.', 'ok', 3000); } catch { toast('This browser cannot copy images. Use Download.', 'err', 4000); } }
      else if (k === 'link') copy(link);
    };
  }, true);
}

// ---------------------------------------------------------------- alerts: a ping when a starred trader trades, while this tab is open
const AL = () => ({ on: false, min: 50000, sound: true, ...store.get('chad:alerts', {}) });
const setAL = p => store.set('chad:alerts', { ...AL(), ...p });
const LOG = []; let unseen = 0, actx = null;
function ping() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    [880, 1320].forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(), s = t + i * .09; o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.1, s + .012); g.gain.exponentialRampToValueAtTime(.0001, s + .24); o.connect(g).connect(actx.destination); o.start(s); o.stop(s + .26); });
  } catch {}
}
function bell() { const b = $('#navAlerts'); if (!b) return; b.classList.toggle('on', AL().on); const n = $('#navAlertsN'); if (n) { n.textContent = unseen > 9 ? '9+' : unseen; n.hidden = !unseen; } }
function onFills(ev) {
  const s = AL(); if (!s.on || !stars().some(a => lc(a) === ev.user)) return;
  const by = {};
  for (const f of ev.fills) { const k = f.oid + f.dir; const x = by[k] || (by[k] = { coin: f.coin, dir: f.dir, ntl: 0, px: +f.px }); x.ntl += +f.sz * +f.px; }
  for (const x of Object.values(by)) {
    if (x.ntl < s.min) continue;
    const nm = nameOf(rowOf(ev.user) || { a: ev.user }), longish = /Open Long|Close Short|Buy/.test(x.dir);
    LOG.unshift({ a: ev.user, nm, coin: x.coin, dir: x.dir, ntl: x.ntl, px: x.px, t: Date.now() }); LOG.length = Math.min(LOG.length, 30); unseen++;
    toast(`<button class="al-t" data-a="${esc(ev.user)}" type="button"><b>★ ${esc(nm)}</b> <em class="${longish ? 'up' : 'dn'}">${esc(x.dir)}</em> ${esc(x.coin)} · ${usd(x.ntl)} @ ${px(x.px)}</button>`, '', 9000);
    if (s.sound && !document.hidden) ping();
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(`★ ${nm}: ${x.dir} ${x.coin}`, { body: `${usd(x.ntl)} @ ${px(x.px)}`, icon: '/favicon-192.png', tag: 'chad-' + ev.user + x.coin }); } catch {} }
  }
  bell(); if ($('#alLog')) drawAlerts();
}
function drawAlerts() {
  const b = $('#mBody'); if (!b || !$('#alLog', b)) return;
  const s = AL(), st = stars(), perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const seg = (k, opts) => `<div class="seg seg-sm" data-al="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(s[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  $('#alSet', b).innerHTML = `<div class="m-sec"><span>Alerts</span>${seg('on', [[true, 'On'], [false, 'Off']])}</div>
    <div class="m-sec"><span>Only orders bigger than</span>${seg('min', [[10000, '$10K'], [50000, '$50K'], [250000, '$250K'], [1000000, '$1M']])}</div>
    <div class="m-sec"><span>Sound</span>${seg('sound', [[true, 'On'], [false, 'Off']])}</div>
    <div class="m-sec"><span>Desktop notifications when the tab is in the background</span>${perm === 'granted' ? '<p class="mono al-ok">allowed</p>' : perm === 'denied' ? '<p class="mono muted">blocked in this browser\'s site settings</p>' : perm === 'unsupported' ? '<p class="mono muted">not supported here</p>' : '<button class="btn btn-sm btn-line" type="button" data-al-perm="1">Allow notifications</button>'}</div>`;
  $('#alWho', b).innerHTML = st.length ? st.map(a => { const r = rowOf(a) || { a }; return `<div class="al-w"><button type="button" class="al-pick" data-a="${esc(a)}"><b>${esc(nameOf(r))}</b>${rkTag(rankOf(a))}</button><button type="button" class="al-x" data-unstar="${esc(a)}" aria-label="Stop watching">×</button></div>`; }).join('')
    : `<p class="mono muted">Nobody yet. Star a trader with ☆ on the desk, or start with the board's best.</p><button class="btn btn-sm btn-line" type="button" data-al-top="1">Watch the top 5 chads</button>`;
  $('#alLog', b).innerHTML = LOG.length ? LOG.map(x => `<button type="button" class="al-l" data-a="${esc(x.a)}"><time>${new Date(x.t).toLocaleTimeString('en-US', { hour12: false })}</time><b>${esc(x.nm)}</b><em class="${/Open Long|Close Short|Buy/.test(x.dir) ? 'up' : 'dn'}">${esc(x.dir)}</em><span>${esc(x.coin)} · ${usd(x.ntl)}</span></button>`).join('') : '<p class="mono muted">No alerts yet this session.</p>';
}
export function alerts() {
  unseen = 0; bell();
  panel('Alerts', `<div class="al-g"><div id="alSet" class="al-set"></div><div><p class="eyebrow mono">Watching · your starred traders</p><div id="alWho" class="al-who"></div><p class="eyebrow mono al-h">This session</p><div id="alLog" class="al-log"></div></div></div>
    <p class="m-note">Alerts come from Hyperliquid's live feed of each trader's fills. They work while this tab is open, in the background too. CHAD has no server that watches for you.</p>`, b => {
    drawAlerts();
    b.onclick = async e => {
      const sg = e.target.closest('[data-al] button');
      if (sg) { const k = sg.parentElement.dataset.al, raw = sg.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : +raw; setAL({ [k]: v }); if (k === 'on' && v) { api.watchFills(stars()); ping(); } bell(); return drawAlerts(); }
      if (e.target.closest('[data-al-perm]')) { try { await Notification.requestPermission(); } catch {} return drawAlerts(); }
      if (e.target.closest('[data-al-top]')) { const d = api.board.data; if (!d) return; const top = d.windows.m.chads.slice(0, 5).map(i => d.rows[i].a); store.set('chad:stars', [...new Set([...stars(), ...top])].slice(0, 50)); api.watchFills(top); setAL({ on: true }); bell(); toast('Watching the top 5 chads.', 'ok', 2500); return drawAlerts(); }
      const un = e.target.closest('[data-unstar]'); if (un) { store.set('chad:stars', stars().filter(a => lc(a) !== lc(un.dataset.unstar))); return drawAlerts(); }
      const p = e.target.closest('[data-a]'); if (p) pick(p.dataset.a);
    };
  }, true);
}

// ---------------------------------------------------------------- the board as a CSV, the trader as a link
export function exportCsv() {
  const d = api.board.data; if (!d) return toast('The board is still loading.', 'err', 3000);
  const tb = $('#bTabs button.on'), wb = $('#bWin button.on'), tab = tb ? tb.dataset.b : 'chads', w = wb ? wb.dataset.w : 'm';
  const idx = tab === 'chads' ? d.windows[w].chads : tab === 'virgins' ? d.windows[w].virgins : tab === 'whales' ? d.whales : null;
  const rows = idx ? idx.map(i => d.rows[i]) : stars().map(a => rowOf(a) || { a, n: '', av: '', p: {} });
  const q = v => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const head = ['rank', 'name', 'address', 'account_usd', ...['d', 'w', 'm', 't'].flatMap(k => [`pnl_${WIN[k]}`, `roi_${WIN[k]}`, `volume_${WIN[k]}`])];
  const body = rows.map((r, i) => [i + 1, r.n || '', r.a, r.av, ...['d', 'w', 'm', 't'].flatMap(k => r.p[k] || ['', '', ''])].map(q).join(','));
  const u = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' }));
  const el = Object.assign(document.createElement('a'), { href: u, download: `chad-${tab === 'follow' ? 'starred' : tab}-${WIN[w]}-${new Date().toISOString().slice(0, 10)}.csv` }); document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  toast(`Saved ${rows.length} rows.`, 'ok', 2500);
}
const copyLink = () => { const a = sel(); copy(location.origin + location.pathname + (a ? '?a=' + a : '')); };
const openHl = () => { const a = sel(); if (a) window.open('https://app.hyperliquid.xyz/explorer/address/' + a, '_blank', 'noopener'); };

// ---------------------------------------------------------------- ⌘K: traders, coins and every action from one box
const PAL = { i: 0, items: [] };
const clickTab = k => { const b = $(`#bTabs button[data-b=${k}]`); if (b) b.click(); scrollTo(0); };
const ACTS = () => [
  ['Markets', 'every Hyperliquid perp, live', 'M', () => markets()], ['Compare traders', 'two traders, head to head', 'H', () => compare()],
  ['Share card', 'the trader on the desk, as a picture to post', 'S', () => share()], ['Alerts', 'a ping when a starred trader trades', 'A', alerts],
  ['Tail mode', 'copy the trader on the desk', 'T', () => { window.__chad && window.__chad.mode('tail'); scrollTo(0); }], ['Fade mode', 'bet against him', 'F', () => { window.__chad && window.__chad.mode('fade'); scrollTo(0); }],
  ['Chads board', 'the best PnL on Hyperliquid', 'C', () => clickTab('chads')], ['Virgins board', 'the worst PnL', 'V', () => clickTab('virgins')], ['Whales board', 'the biggest accounts', '', () => clickTab('whales')], ['Starred traders', 'the ones you keep', '', () => clickTab('follow')],
  ['Your account', 'positions, orders, TP/SL, close all', '', () => BASE.mine && BASE.mine()], ['Export the board as CSV', 'the board and window you are looking at', 'E', exportCsv],
  ['Copy link to this trader', 'opens the desk on him', '', copyLink], ['Open him on Hyperliquid', 'the explorer page of the trader on the desk', '', openHl],
  ['Settings', 'slippage, follow interval, intro, sound', '', () => BASE.settings && BASE.settings()], ['Keyboard shortcuts', 'every key', '?', () => BASE.keys && BASE.keys()],
  ['Replay the intro', 'the elevator, once more', '', () => BASE.replay && BASE.replay()], ['Sound on or off', 'for the intro', '', () => BASE.sound && BASE.sound()],
];
function palItems(q) {
  q = q.trim(); const ql = q.toLowerCase(), out = [], d = api.board.data;
  if (isAddr(q)) out.push({ g: 'Trader', l: short(q), s: 'open this address on the desk', run: () => pick(q) });
  if (d && ql) { for (const r of d.rows) { if (out.length >= 7) break; if ((r.n || '').toLowerCase().includes(ql) || (ql.startsWith('0x') && lc(r.a).includes(ql))) { const rk = rankOf(r.a); out.push({ g: 'Traders', l: nameOf(r), s: `${rk ? (rk.k === 'virgins' ? 'virgin' : 'chad') + ' #' + rk.i + ' · ' : ''}${r.av != null ? usd(r.av) + ' account' : short(r.a)}`, run: () => pick(r.a) }); } } }
  else if (d) { const sug = (L, g, n) => L.slice(0, n).forEach(i => { const r = d.rows[i]; out.push({ g, l: nameOf(r), s: signed((r.p.m || [])[0]) + ' · 30d', run: () => pick(r.a) }); }); sug(d.windows.m.chads, 'Top chads · 30d', 3); sug(d.windows.m.virgins, 'Top virgins · 30d', 2); }
  if (ql && api.perps.list.length) api.perps.list.filter(p => p.name.toLowerCase().startsWith(ql)).sort((a, b) => b.vol - a.vol).slice(0, 4).forEach(p => out.push({ g: 'Coins', l: p.name, s: `${px(api.mids[p.name] || p.mark)} · ${pct(p.chg, 2)} · open in Markets`, run: () => markets(p.name) }));
  ACTS().filter(([l, s]) => !ql || (l + ' ' + s).toLowerCase().includes(ql)).forEach(([l, s, k, run]) => out.push({ g: 'Actions', l, s, k, run }));
  return out.slice(0, 20);
}
function palDraw() {
  const box = $('#palR'); PAL.items = palItems($('#palQ').value); PAL.i = Math.min(PAL.i, Math.max(0, PAL.items.length - 1));
  let g = null;
  box.innerHTML = PAL.items.length ? PAL.items.map((it, i) => `${it.g !== g ? `<p class="pal-g">${esc((g = it.g))}</p>` : ''}<button type="button" class="pal-i${i === PAL.i ? ' on' : ''}" data-i="${i}"><b>${esc(it.l)}</b><span>${esc(it.s || '')}</span>${it.k ? `<kbd>${esc(it.k)}</kbd>` : ''}</button>`).join('') : '<p class="pal-none mono">Nothing matches. Paste a 0x address to open any trader.</p>';
  const on = $('.pal-i.on', box); if (on) on.scrollIntoView({ block: 'nearest' });
}
export function palette() {
  if (document.documentElement.classList.contains('intro')) return;
  const p = $('#pal'); p.hidden = false; $('#modal').hidden = true; const q = $('#palQ'); q.value = ''; PAL.i = 0; palDraw(); q.focus(); setTimeout(() => q.focus(), 30);
}
const palClose = () => { $('#pal').hidden = true; };
const palRun = i => { const it = PAL.items[i]; if (!it) return; palClose(); setTimeout(() => it.run(), 10); };

// ---------------------------------------------------------------- wiring: nav buttons, the more menu, hotkeys, the active section, scroll progress
export function init(base) {
  BASE = base || {};
  $('#palQ').addEventListener('input', () => { PAL.i = 0; palDraw(); });
  $('#palQ').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); PAL.i = Math.min(PAL.items.length - 1, PAL.i + 1); palDraw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); PAL.i = Math.max(0, PAL.i - 1); palDraw(); }
    else if (e.key === 'Enter') { e.preventDefault(); palRun(PAL.i); }
    else if (e.key === 'Escape') { e.preventDefault(); palClose(); }
  });
  $('#palR').addEventListener('click', e => { const b = e.target.closest('.pal-i'); if (b) palRun(+b.dataset.i); });
  $('#palR').addEventListener('mousemove', e => { const b = e.target.closest('.pal-i'); if (b && +b.dataset.i !== PAL.i) { PAL.i = +b.dataset.i; $$('.pal-i', $('#palR')).forEach(x => x.classList.toggle('on', x === b)); } });
  $('#pal').addEventListener('click', e => { if (e.target.id === 'pal') palClose(); });
  $('#navPal').onclick = palette; $('#navMkt').onclick = () => markets(); $('#navCmp').onclick = () => compare(); $('#navShare').onclick = () => share(); $('#navAlerts').onclick = alerts;
  // the more menu
  const mb = $('#navMore'), mm = $('#moreMenu');
  const mClose = () => { mm.hidden = true; mb.setAttribute('aria-expanded', 'false'); };
  mb.onclick = e => { e.stopPropagation(); mm.hidden = !mm.hidden; mb.setAttribute('aria-expanded', String(!mm.hidden)); };
  mm.onclick = e => { const b = e.target.closest('button[data-m]'); if (!b) return; mClose(); ({ keys: BASE.keys, csv: exportCsv, link: copyLink, hl: openHl, replay: BASE.replay, sound: BASE.sound, settings: BASE.settings }[b.dataset.m] || (() => {}))(); };
  document.addEventListener('click', e => { if (!mm.hidden && !e.target.closest('#moreMenu')) mClose(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { mClose(); if (!$('#pal').hidden) palClose(); } });
  // toasts from alerts open the trader
  $('#toasts').addEventListener('click', e => { const t = e.target.closest('.al-t'); if (t) pick(t.dataset.a); });
  // alerts run off the same live feed as the tape
  on('fills', onFills);
  const keep = () => { if (AL().on && stars().length) api.watchFills(stars()); };
  on('board', keep); setInterval(keep, 60000); bell();
  // the nav knows where you are
  const links = $$('#nav .links a'), ids = links.map(a => a.getAttribute('href').slice(1));
  const io = new IntersectionObserver(es => { for (const en of es) if (en.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id)); }, { rootMargin: '-42% 0px -55% 0px' });
  ids.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  const nav = $('#nav'), prog = () => { const h = document.documentElement.scrollHeight - innerHeight; nav.style.setProperty('--sp', h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0); };
  addEventListener('scroll', prog, { passive: true }); prog();
}
export const keys = { k: palette, m: () => markets(), h: () => compare(), s: () => share(), a: alerts, e: exportCsv };
