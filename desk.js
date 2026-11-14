// CHAD · the desk: the board (chads, virgins, whales), one trader's live book, the copy ticket (tail or fade), follow mode, your account
import { $, $$, on, esc, px, usd, pct, cls, num, toast, copy, store, short, parseNum, coinIcon } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';

const S = { tab: 'chads', win: 'm', q: '', sel: null, mode: 'tail', eqWin: 'month', eqKind: 'av', tTab: 'pos', lead: null, me: null, follow: null };
const WIN_L = { d: '24h', w: '7d', m: '30d', t: 'all-time' };
const name = r => (r && r.n) || short(r ? r.a : '');
const stars = () => store.get('chad:stars', []);
const rowOf = a => { const d = api.board.data; if (!d) return null; const i = d.rows.findIndex(r => r.a.toLowerCase() === String(a).toLowerCase()); return i >= 0 ? d.rows[i] : null; };
const rankOf = a => { const d = api.board.data; if (!d) return null; for (const k of ['chads', 'virgins']) { const L = d.windows[S.win][k], i = L.findIndex(n => d.rows[n].a.toLowerCase() === String(a).toLowerCase()); if (i >= 0) return { k, i: i + 1 }; } return null; };
const hlLink = a => 'https://app.hyperliquid.xyz/explorer/address/' + a;
const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };

export function init() {
  bindBoard(); bindTrader(); bindCopy(); bindMine();
  on('board', d => { drawBoard(); tapeWatch(d); if (!S.sel) { const want = new URLSearchParams(location.search).get('a'); const L = d.windows.m.chads; select(want || (L.length ? d.rows[L[0]].a : d.whales.length ? d.rows[d.whales[0]].a : null)); } });
  on('mids', () => { if (S.tTab === 'pos' && S.lead) drawBody(); });
  on('evm', () => { loadMe(); drawCopy(); });
  on('fills', ev => { tapeAdd(ev); if (S.lead && ev.user === S.lead.a.toLowerCase()) { S.lead.fills = [...ev.fills, ...(S.lead.fills || [])].slice(0, 200); refreshLead(); } });
  setInterval(() => { if (S.lead && document.visibilityState === 'visible') refreshLead(); }, 20000);
  setInterval(() => { if (W.evm.address && document.visibilityState === 'visible') loadMe(); }, 20000);
  window.__chad = { select, mode: m => setMode(m), sel: () => S.sel };
}

// ---------------------------------------------------------------- the board
function bindBoard() {
  $('#bTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.tab = b.dataset.b; $$('#bTabs button').forEach(x => x.classList.toggle('on', x === b)); drawBoard(); };
  $('#bWin').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.win = b.dataset.w; $$('#bWin button').forEach(x => x.classList.toggle('on', x === b)); drawBoard(); if (S.lead) drawStats(); };
  $('#bQ').addEventListener('input', () => { S.q = $('#bQ').value.trim().toLowerCase(); drawBoard(); });
  $('#bQ').addEventListener('keydown', e => { if (e.key === 'Enter' && /^0x[0-9a-fA-F]{40}$/.test($('#bQ').value.trim())) select($('#bQ').value.trim()); });
  $('#bRows').onclick = e => { const b = e.target.closest('.br'); if (b) select(b.dataset.a); };
}
function drawBoard() {
  const d = api.board.data, box = $('#bRows'); if (!d) return;
  let idx;
  if (S.tab === 'chads') idx = d.windows[S.win].chads; else if (S.tab === 'virgins') idx = d.windows[S.win].virgins; else if (S.tab === 'whales') idx = d.whales; else idx = null;
  let rows = idx ? idx.map(i => d.rows[i]) : stars().map(a => rowOf(a) || { a, n: null, av: null, p: {} });
  if (S.q) rows = rows.filter(r => (r.n || '').toLowerCase().includes(S.q) || r.a.toLowerCase().includes(S.q));
  $('#bCol').textContent = S.tab === 'whales' ? 'Account' : 'PnL ' + WIN_L[S.win];
  box.innerHTML = rows.length ? rows.map((r, i) => {
    const p = r.p[S.win] || [], pnl = p[0], roi = p[1];
    const val = S.tab === 'whales' ? `<div class="val">${usd(r.av)}<span class="${cls(pnl)}">${pnl != null ? (pnl >= 0 ? '+' : '') + usd(pnl) : ''}</span></div>` : `<div class="val ${cls(pnl)}">${pnl != null ? (pnl >= 0 ? '+' : '') + usd(pnl) : '—'}<span>${roi != null ? pct(roi * 100, 1) : ''}</span></div>`;
    return `<button class="br ${S.sel && S.sel.toLowerCase() === r.a.toLowerCase() ? 'on' : ''}" data-a="${esc(r.a)}" type="button"><span class="rk">${S.tab === 'follow' ? '★' : i + 1}</span><div class="who"><b>${esc(name(r))}</b><span>${r.av != null ? usd(r.av) + ' account' : short(r.a)}</span></div>${val}</button>`;
  }).join('') : `<p class="empty mono">${S.tab === 'follow' ? 'Star a trader (☆ next to his name) to keep him here.' : 'Nobody matches that.'}</p>`;
  $('#bMeta').textContent = `${d.total.toLocaleString('en-US')} traders on Hyperliquid's leaderboard · ${d.profitable.toLocaleString('en-US')} up over 30 days · updated ${ago(d.at)} ago`;
}

// ---------------------------------------------------------------- one trader
function bindTrader() {
  $('#tStar').onclick = () => { if (!S.sel) return; const s = stars(), i = s.findIndex(a => a.toLowerCase() === S.sel.toLowerCase()); i >= 0 ? s.splice(i, 1) : s.unshift(S.sel); store.set('chad:stars', s.slice(0, 50)); starBtn(); if (S.tab === 'follow') drawBoard(); };
  $('#tCopyA').onclick = () => S.sel && copy(S.sel);
  $('#eqWin').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.eqWin = b.dataset.w; $$('#eqWin button').forEach(x => x.classList.toggle('on', x === b)); drawEq(); };
  $('#eqKind').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.eqKind = b.dataset.k; $$('#eqKind button').forEach(x => x.classList.toggle('on', x === b)); drawEq(); };
  $('#tTab').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.tTab = b.dataset.t; $$('#tTab button').forEach(x => x.classList.toggle('on', x === b)); drawBody(); };
  const cv = $('#eqCv');
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); S.eqHover = (e.clientX - r.left) / r.width; drawEq(); });
  cv.addEventListener('pointerleave', () => { S.eqHover = null; drawEq(); });
  addEventListener('resize', () => drawEq());
}
function starBtn() { const b = $('#tStar'), on = S.sel && stars().some(a => a.toLowerCase() === S.sel.toLowerCase()); b.classList.toggle('on', !!on); b.textContent = on ? '★' : '☆'; }
export async function select(a) {
  if (!a) return;
  S.sel = a; const r = rowOf(a) || { a, n: null, av: null, p: {} }, rk = rankOf(a);
  S.lead = { a, row: r, st: null, pf: null, fills: null, oo: null };
  $('#tName').textContent = name(r); $('#tAddr').textContent = a; $('#tOpen').href = hlLink(a);
  const tr = $('#tRank'); tr.textContent = rk ? '#' + rk.i : '—'; tr.classList.toggle('v', !!rk && rk.k === 'virgins'); tr.title = rk ? (rk.k === 'chads' ? 'chad' : 'virgin') + ' #' + rk.i + ' over ' + WIN_L[S.win] : '';
  $$('#bRows .br').forEach(b => b.classList.toggle('on', b.dataset.a.toLowerCase() === a.toLowerCase()));
  if (rk && rk.k === 'virgins' && S.mode === 'tail') setMode('fade'); else if (rk && rk.k === 'chads' && S.mode === 'fade') setMode('tail');
  starBtn(); drawStats(); drawEq(); $('#tBody').innerHTML = '<p class="empty mono">Reading his book…</p>'; drawCopy();
  api.watchFills([a]);
  const [st, pf, fl, oo] = await Promise.all([api.account(a).catch(() => null), api.portfolio(a).catch(() => null), api.fills(a).catch(() => []), api.openOrders(a).catch(() => [])]);
  if (S.sel !== a) return;
  Object.assign(S.lead, { st, pf, fills: fl, oo, at: Date.now() });
  drawStats(); drawEq(); drawBody(); drawCopy();
}
async function refreshLead() {
  const L = S.lead; if (!L) return;
  const st = await api.account(L.a).catch(() => null); if (!st || S.lead !== L) return;
  L.st = st; L.at = Date.now(); drawStats(); drawBody(); drawCopy();
}
const posOf = st => (st && st.assetPositions || []).map(x => x.position).filter(p => +p.szi).map(p => ({ coin: p.coin, szi: +p.szi, entry: +p.entryPx, val: Math.abs(+p.positionValue), upnl: +p.unrealizedPnl, liq: p.liquidationPx ? +p.liquidationPx : null, lev: p.leverage ? +p.leverage.value : null, type: p.leverage ? p.leverage.type : '' }));
function drawStats() {
  const L = S.lead; if (!L) return;
  const r = L.row, p = r.p[S.win] || [], st = L.st, eq = st ? +st.marginSummary.accountValue : r.av, pos = posOf(st), gross = pos.reduce((s, x) => s + x.val, 0);
  const k = [['Account', eq != null ? usd(eq) : '—'], [`PnL ${WIN_L[S.win]}`, p[0] != null ? `<span class="${cls(p[0])}">${p[0] >= 0 ? '+' : ''}${usd(p[0])}</span>` : '—'], [`ROI ${WIN_L[S.win]}`, p[1] != null ? `<span class="${cls(p[1])}">${pct(p[1] * 100, 1)}</span>` : '—'],
    [`Exposure${st && eq ? ' · ' + (gross / eq).toFixed(1) + 'x' : ''}`, st ? usd(gross) : '—'], [`Volume ${WIN_L[S.win]}`, p[2] != null ? usd(p[2]) : '—']];
  $('#tStats').innerHTML = k.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('#tPosN').textContent = st ? pos.length : ''; $('#tOrdN').textContent = L.oo ? L.oo.length : '';
  $('#tLive').textContent = L.at ? 'live · ' + new Date(L.at).toLocaleTimeString('en-US', { hour12: false }) : '';
}
function series() {
  const L = S.lead; if (!L || !L.pf) return null;
  const w = (L.pf.find(x => x[0] === S.eqWin) || [])[1]; if (!w) return null;
  const pts = (S.eqKind === 'av' ? w.accountValueHistory : w.pnlHistory) || [];
  return pts.map(([t, v]) => ({ t: +t, v: +v })).filter(x => isFinite(x.v));
}
function drawEq() {
  const cv = $('#eqCv'), box = cv.parentElement, dpr = Math.min(2, devicePixelRatio || 1), Wd = box.clientWidth, Hd = box.clientHeight;
  if (!Wd || !Hd) return;
  cv.width = Wd * dpr; cv.height = Hd * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, Wd, Hd);
  const pts = series(), empty = $('#eqEmpty'), tip = $('#eqTip');
  $('#eqLbl').textContent = S.eqKind === 'av' ? 'Account value' : 'PnL';
  if (!pts || pts.length < 2) { empty.hidden = false; empty.textContent = S.lead && S.lead.pf ? 'No history for this window.' : S.lead ? 'Reading his equity…' : ''; tip.hidden = true; return; }
  empty.hidden = true;
  const P = { l: 18, r: 64, t: 14, b: 22 }, w = Wd - P.l - P.r, h = Hd - P.t - P.b;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v)); if (S.eqKind === 'pnl') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, X = t => P.l + (t - t0) / Math.max(1, t1 - t0) * w, Y = v => P.t + (1 - (v - lo) / (hi - lo)) * h;
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.font = '10.5px GeistMono, monospace'; g.fillStyle = '#586070'; g.textAlign = 'left';
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); g.beginPath(); g.moveTo(P.l, y); g.lineTo(P.l + w, y); g.stroke(); g.fillText(usd(v), P.l + w + 8, y + 3); }
  if (S.eqKind === 'pnl') { g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(P.l, Y(0)); g.lineTo(P.l + w, Y(0)); g.stroke(); g.setLineDash([]); }
  const up = pts[pts.length - 1].v >= pts[0].v, col = up ? '#36d77a' : '#ff4d5a';
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.v)) : g.moveTo(X(p.t), Y(p.v)));
  const line = new Path2D(); pts.forEach((p, i) => i ? line.lineTo(X(p.t), Y(p.v)) : line.moveTo(X(p.t), Y(p.v)));
  g.lineTo(X(t1), P.t + h); g.lineTo(X(t0), P.t + h); g.closePath(); g.fillStyle = up ? 'rgba(54,215,122,.08)' : 'rgba(255,77,90,.08)'; g.fill();
  g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(line);
  const last = pts[pts.length - 1]; g.fillStyle = col; g.beginPath(); g.arc(X(last.t), Y(last.v), 3.5, 0, 7); g.fill();
  g.fillStyle = '#586070'; g.textAlign = 'left'; g.fillText(new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), P.l, Hd - 6); g.textAlign = 'right'; g.fillText(new Date(t1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), P.l + w, Hd - 6);
  if (S.eqHover != null) {
    const t = t0 + (t1 - t0) * Math.max(0, Math.min(1, (S.eqHover * Wd - P.l) / w)); let best = pts[0]; for (const p of pts) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    g.strokeStyle = 'rgba(226,192,107,.5)'; g.beginPath(); g.moveTo(X(best.t), P.t); g.lineTo(X(best.t), P.t + h); g.stroke();
    g.fillStyle = '#e2c06b'; g.beginPath(); g.arc(X(best.t), Y(best.v), 4, 0, 7); g.fill();
    tip.hidden = false; tip.textContent = `${new Date(best.t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} · ${usd(best.v)}`;
  } else tip.hidden = true;
}
function drawBody() {
  const L = S.lead, box = $('#tBody'); if (!L) return;
  if (S.tTab === 'pos') {
    if (!L.st) { box.innerHTML = `<p class="empty mono">${L.at ? 'Could not read his positions.' : 'Reading his book…'}</p>`; return; }
    const pos = posOf(L.st).sort((a, b) => b.val - a.val);
    box.innerHTML = pos.length ? `<table class="tb"><thead><tr><th>Coin</th><th>Size</th><th>Value</th><th class="hx">Entry</th><th>Mark</th><th>PnL</th><th class="hx">Liq.</th></tr></thead><tbody>${pos.map(p => {
      const m = api.mids[p.coin] || (api.perps.by[p.coin] || {}).mark, up = m ? (m - p.entry) * p.szi : p.upnl;
      return `<tr><td><span class="cn">${coinIcon(p.coin, 'ci')}<span class="side ${p.szi > 0 ? 'l' : 's'}">${p.szi > 0 ? 'LONG' : 'SHORT'}</span>${esc(p.coin)}${p.lev ? `<span class="muted" style="font-weight:400">${p.lev}x</span>` : ''}</span></td><td>${num(Math.abs(p.szi), 4)}</td><td>${usd(m ? Math.abs(p.szi) * m : p.val)}</td><td class="hx">${px(p.entry)}</td><td>${m ? px(m) : '—'}</td><td class="${cls(up)}">${up >= 0 ? '+' : ''}${usd(up)}</td><td class="muted hx">${p.liq ? px(p.liq) : '—'}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="empty mono">Flat. No open positions right now.</p>';
  } else if (S.tTab === 'fills') {
    const f = (L.fills || []).slice(0, 60);
    box.innerHTML = f.length ? `<table class="tb"><thead><tr><th>Coin</th><th>Action</th><th>Size</th><th>Price</th><th>Value</th><th>Closed PnL</th><th>When</th></tr></thead><tbody>${f.map(x => `<tr><td><span class="cn">${coinIcon(x.coin, 'ci')}${esc(x.coin)}</span></td><td class="${/Long|Buy/.test(x.dir) ? (/Close/.test(x.dir) ? 'dn' : 'up') : (/Close/.test(x.dir) ? 'up' : 'dn')}">${esc(x.dir || (x.side === 'B' ? 'Buy' : 'Sell'))}</td><td>${num(+x.sz, 4)}</td><td>${px(+x.px)}</td><td>${usd(+x.sz * +x.px)}</td><td class="${cls(+x.closedPnl)}">${+x.closedPnl ? usd(+x.closedPnl) : ''}</td><td class="muted">${ago(x.time)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty mono">No recent trades.</p>';
  } else {
    const o = L.oo || [];
    box.innerHTML = o.length ? `<table class="tb"><thead><tr><th>Coin</th><th>Side</th><th>Type</th><th>Size</th><th>Price</th><th>Placed</th></tr></thead><tbody>${o.map(x => `<tr><td><span class="cn">${coinIcon(x.coin, 'ci')}${esc(x.coin)}</span></td><td class="${x.side === 'B' ? 'up' : 'dn'}">${x.side === 'B' ? 'BUY' : 'SELL'}</td><td>${esc(x.orderType || 'Limit')}</td><td>${num(+x.sz, 4)}</td><td>${px(+(x.isTrigger ? x.triggerPx : x.limitPx))}</td><td class="muted">${ago(x.timestamp)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty mono">No open orders.</p>';
  }
}

// ---------------------------------------------------------------- the copy ticket
function bindCopy() {
  const s = W.settings();
  $('#cPct').value = s.copyPct; $('#cMax').value = s.maxUsd; $('#cLev').value = s.lev; $('#cEvery').textContent = s.every;
  $('#cMode').onclick = e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); };
  for (const id of ['#cPct', '#cMax', '#cLev']) $(id).addEventListener('input', () => { const cur = W.settings(); cur.copyPct = +$('#cPct').value; cur.maxUsd = parseNum($('#cMax').value) || cur.maxUsd; cur.lev = parseNum($('#cLev').value) || cur.lev; store.set('chad:set', cur); drawCopy(); });
  $('#cGo').onclick = goCopy;
  $('#cFollow').onchange = e => (e.target.checked ? followOn() : followOff());
}
function setMode(m) { S.mode = m; $$('#cMode button').forEach(x => x.classList.toggle('on', x.dataset.m === m)); drawCopy(); }
// what we would send: his positions scaled by our equity against his, then the slider, capped per position and by leverage
function plan(L = S.lead, mode = S.mode) {
  if (!L || !L.st) return null;
  const his = posOf(L.st), hisEq = +L.st.marginSummary.accountValue || 0;
  const meSt = S.me && S.me.st, myEq = meSt ? +meSt.marginSummary.accountValue : 0, mine = Object.fromEntries(posOf(meSt).map(p => [p.coin, p]));
  const pc = (+$('#cPct').value || 100) / 100, cap = parseNum($('#cMax').value) || 1000, levCap = Math.max(1, parseNum($('#cLev').value) || 5), sign = mode === 'fade' ? -1 : 1;
  const k = hisEq > 0 && myEq > 0 ? myEq / hisEq * pc : 0;
  let rows = his.map(p => {
    const pp = api.perps.by[p.coin], m = api.mids[p.coin] || (pp || {}).mark || p.entry;
    let tgt = sign * p.szi * k, ntl = Math.abs(tgt) * m;
    if (ntl > cap) { tgt *= cap / ntl; ntl = cap; }
    const cur = mine[p.coin] ? mine[p.coin].szi : 0, delta = tgt - cur, dn = Math.abs(delta) * m;
    const lev = Math.max(1, Math.min(levCap, p.lev || levCap, pp ? pp.maxLev : levCap));
    return { coin: p.coin, p: pp, m, tgt, cur, delta, dn, ntl, lev, hisVal: p.val, side: tgt > 0 ? 'LONG' : 'SHORT', ok: !!pp && dn >= 10 };
  }).sort((a, b) => b.hisVal - a.hisVal);
  // the whole copy may not use more margin than you have
  const margin = rows.filter(r => r.ok).reduce((s, r) => s + r.dn / r.lev, 0);
  if (myEq > 0 && margin > myEq * .9) { const f = myEq * .9 / margin; rows = rows.map(r => ({ ...r, tgt: r.cur + r.delta * f, delta: r.delta * f, dn: r.dn * f, ntl: r.ntl * f, ok: r.ok && r.dn * f >= 10 })); }
  return { rows, k, myEq, hisEq };
}
function drawCopy() {
  const box = $('#cPrev'), b = $('#cGo'), pl = plan();
  $('#cPctV').textContent = (+$('#cPct').value) + '%';
  b.classList.toggle('fade', S.mode === 'fade');
  if (!S.lead) { box.innerHTML = '<p class="empty mono">Pick a trader to preview the orders.</p>'; }
  else if (!pl) { box.innerHTML = '<p class="empty mono">Reading his positions…</p>'; }
  else if (!pl.rows.length) { box.innerHTML = '<p class="empty mono">He is flat right now. Nothing to copy. Follow mode would copy his next trade.</p>'; }
  else {
    const sum = pl.rows.filter(r => r.ok).reduce((s, r) => s + r.dn, 0), n = pl.rows.filter(r => r.ok).length;
    box.innerHTML = pl.rows.map(r => `<div class="pv ${r.ok ? '' : 'skip'}">${coinIcon(r.coin, 'ci')}<div><b class="${r.side === 'LONG' ? 'up' : 'dn'}">${r.side}</b> ${esc(r.coin)} <em>${W.evm.address ? (r.ok ? `${num(Math.abs(r.delta), 4)} · ${r.lev}x${r.cur ? ' · you hold ' + num(r.cur, 4) : ''}` : (r.p ? 'under $10, skipped' : 'not listed')) : 'his ' + usd(r.hisVal)}</em></div><b>${W.evm.address ? usd(r.dn) : ''}</b></div>`).join('')
      + (W.evm.address ? `<div class="pv-sum"><span>${n} order${n === 1 ? '' : 's'} · scale ${(pl.k * 100).toFixed(pl.k < .01 ? 3 : 1)}% of him</span><span>${usd(sum)}</span></div>` : `<div class="pv-sum"><span>Connect to size it to your account</span><span>${pl.rows.length} positions</span></div>`);
  }
  const who = S.lead ? name(S.lead.row) : '';
  b.textContent = !W.evm.address ? 'Connect for Hyperliquid' : !W.agent() ? 'Approve session key (once)' : S.mode === 'fade' ? `Fade ${who}` : `Tail ${who}`;
  b.disabled = !!S.busy;
}
async function goCopy() {
  if (!W.evm.address) return window.__wallets();
  const b = $('#cGo');
  try {
    if (!W.agent()) { b.textContent = 'Sign in your wallet…'; await W.approveAgent(); toast('Session key approved. Copies now sign without popups.', 'ok'); drawCopy(); return; }
    await loadMe();
    const pl = plan(), rows = pl ? pl.rows.filter(r => r.ok) : [];
    if (!pl || !pl.myEq) throw new Error('No USDC in your Hyperliquid perps account yet.');
    if (!rows.length) throw new Error('Nothing to send: every position is under the $10 minimum at this size.');
    S.busy = true; drawCopy(); b.textContent = 'Sending…';
    const r = await execute(rows, S.mode === 'fade' ? 'Fade' : 'Tail');
    toast(`${S.mode === 'fade' ? 'Faded' : 'Tailed'} ${esc(name(S.lead.row))}: ${r.done} of ${rows.length} orders filled.${r.errs.length ? ' ' + esc(r.errs.join(' · ')) : ''}`, r.errs.length ? 'err' : 'ok', 9000);
    store.set('chad:mirror:' + S.lead.a.toLowerCase(), [...new Set([...(store.get('chad:mirror:' + S.lead.a.toLowerCase(), [])), ...rows.map(x => x.coin)])]);
  } catch (e) { toast(esc(e.message || String(e)), 'err', 9000); }
  S.busy = false; drawCopy(); setTimeout(loadMe, 1200);
}
async function execute(rows, label) {
  let done = 0; const errs = [];
  for (const r of rows) {
    try {
      const reduce = r.cur && Math.sign(r.delta) !== Math.sign(r.cur) && Math.abs(r.delta) <= Math.abs(r.cur) + 1e-12;
      await W.marketOrder(r.p, r.delta > 0, Math.abs(r.delta), { reduceOnly: !!reduce, lev: reduce ? null : r.lev });
      done++; logLine(`${label} ${r.delta > 0 ? 'buy' : 'sell'} ${num(Math.abs(r.delta), 4)} ${r.coin} · ${usd(r.dn)}`);
    } catch (e) { errs.push(r.coin + ': ' + e.message); logLine(`${r.coin} failed: ${e.message}`); }
  }
  return { done, errs };
}
function logLine(t) { const el = document.createElement('div'); el.innerHTML = `<time>${new Date().toLocaleTimeString('en-US', { hour12: false })}</time><span>${esc(t)}</span>`; $('#cLog').prepend(el); while ($('#cLog').children.length > 40) $('#cLog').lastChild.remove(); }

// ---------------------------------------------------------------- follow mode: keep the copy in sync while this tab is open
async function followOn() {
  const box = $('#cFollow');
  if (!S.lead) { box.checked = false; return toast('Pick a trader first.', 'err', 3000); }
  if (!W.evm.address) { box.checked = false; return window.__wallets(); }
  if (!W.agent()) { try { await W.approveAgent(); } catch (e) { box.checked = false; return toast(esc(e.message), 'err'); } }
  S.follow = { a: S.lead.a, row: S.lead.row, mode: S.mode, timer: null };
  logLine(`Following ${name(S.lead.row)} (${S.mode}) every ${W.settings().every}s`);
  toast(`Following ${esc(name(S.lead.row))}. Keep this tab open.`, 'ok', 5000);
  const tick = async () => {
    const F = S.follow; if (!F) return;
    try {
      const [st] = await Promise.all([api.account(F.a), loadMe()]);
      const pl = plan({ a: F.a, row: F.row, st }, F.mode); if (!pl) throw new Error('could not read his positions');
      const key = 'chad:mirror:' + F.a.toLowerCase(), mirrored = new Set(store.get(key, []));
      const want = new Set(pl.rows.map(r => r.coin));
      // open, cut or grow where the gap is real (over $10 and over 5% of the target)
      const todo = pl.rows.filter(r => r.ok && r.dn >= Math.max(10, Math.abs(r.ntl) * .05));
      // close what he closed
      const mine = posOf(S.me && S.me.st);
      for (const c of mirrored) if (!want.has(c)) { const m = mine.find(x => x.coin === c), pp = api.perps.by[c]; if (m && pp) todo.push({ coin: c, p: pp, cur: m.szi, delta: -m.szi, dn: m.val, lev: null }); mirrored.delete(c); }
      if (todo.length) { const r = await execute(todo, 'Follow'); if (r.errs.length) toast(esc(r.errs.join(' · ')), 'err', 6000); }
      todo.forEach(r => { if (want.has(r.coin)) mirrored.add(r.coin); });
      store.set(key, [...mirrored]);
    } catch (e) { logLine('follow: ' + e.message); }
    if (S.follow) S.follow.timer = setTimeout(tick, W.settings().every * 1000);
  };
  tick();
}
function followOff() { if (S.follow) { clearTimeout(S.follow.timer); logLine(`Stopped following ${name(S.follow.row)}`); } S.follow = null; }

// ---------------------------------------------------------------- your account
function bindMine() {
  $('#closeAll').onclick = closeAll; $('#cancelAll').onclick = cancelAll; $('#refreshMe').onclick = () => loadMe();
}
export async function loadMe() {
  if (!W.evm.address) { S.me = null; $('#myRows').innerHTML = '<p class="empty mono">Connect an EVM wallet to see your positions.</p>'; $('#myEq').textContent = '—'; return null; }
  try {
    const [st, oo, fl] = await Promise.all([api.account(W.evm.address), api.openOrders(W.evm.address).catch(() => []), api.fills(W.evm.address).catch(() => [])]);
    S.me = { st, oo, fl }; drawMe(); drawCopy(); return S.me;
  } catch { $('#myRows').innerHTML = '<p class="empty mono">Could not read Hyperliquid right now.</p>'; return null; }
}
function drawMe() {
  const me = S.me; if (!me) return;
  const eq = +me.st.marginSummary.accountValue, pos = posOf(me.st);
  $('#myEq').textContent = usd(eq) + ' equity';
  $('#myRows').innerHTML = pos.length ? pos.map(p => { const m = api.mids[p.coin], up = m ? (m - p.entry) * p.szi : p.upnl; return `<div class="drow"><b>${coinIcon(p.coin, 'ci')}<span class="side ${p.szi > 0 ? 'l' : 's'}">${p.szi > 0 ? 'LONG' : 'SHORT'}</span>${esc(p.coin)}</b><span>${usd(p.val)}${p.lev ? ' · ' + p.lev + 'x' : ''}</span><span class="${cls(up)}">${usd(up)}</span><span class="acts"><button data-tp="${esc(p.coin)}" type="button">TP/SL</button><button data-c="${esc(p.coin)}" type="button">Close</button></span></div>`; }).join('')
    : eq < 1 ? '<p class="empty mono">No USDC in your perps account. <a href="https://app.hyperliquid.xyz/trade" target="_blank" rel="noopener" style="text-decoration:underline">Deposit on Hyperliquid</a>, then come back.</p>' : '<p class="empty mono">No open positions.</p>';
  $('#myRows').onclick = async e => {
    const tp = e.target.closest('[data-tp]'), c = e.target.closest('[data-c]');
    if (tp) return openTpsl(tp.dataset.tp);
    if (!c) return; const p = api.perps.by[c.dataset.c], ps = posOf(me.st).find(x => x.coin === c.dataset.c); if (!p || !ps) return;
    c.disabled = true; c.textContent = '…';
    try { if (!W.agent()) await W.approveAgent(); await W.marketOrder(p, ps.szi < 0, Math.abs(ps.szi), { reduceOnly: true }); toast(`Closed ${esc(p.name)}.`, 'ok'); setTimeout(loadMe, 1000); }
    catch (err) { toast(esc(err.message), 'err'); c.disabled = false; c.textContent = 'Close'; }
  };
  const oo = me.oo || [];
  $('#myOoN').textContent = oo.length ? oo.length + ' open' : '';
  $('#myOo').innerHTML = oo.length ? oo.slice(0, 12).map(o => `<div class="drow"><b>${coinIcon(o.coin, 'ci')}<span class="${o.side === 'B' ? 'up' : 'dn'}">${o.side === 'B' ? 'BUY' : 'SELL'}</span> ${esc(o.coin)}</b><span>${num(+o.sz, 4)} @ ${px(+(o.isTrigger ? o.triggerPx : o.limitPx))}</span><span>${esc(o.isTrigger ? (/take/i.test(o.orderType || '') ? 'TP' : 'SL') : (o.orderType || 'Limit'))}</span><span class="acts"></span></div>`).join('') : '<p class="empty mono">No open orders.</p>';
  $('#myFills').innerHTML = (me.fl || []).slice(0, 8).map(x => `<div class="drow"><b class="${x.side === 'B' ? 'up' : 'dn'}">${coinIcon(x.coin, 'ci')}${x.side === 'B' ? 'BUY' : 'SELL'} ${esc(x.coin)}</b><span>${num(+x.sz, 4)} @ ${px(+x.px)}</span><span class="${cls(+x.closedPnl)}">${+x.closedPnl ? usd(+x.closedPnl) : ''}</span><span class="muted">${ago(x.time)}</span></div>`).join('') || '<p class="empty mono">No fills yet.</p>';
}
function armed(b, idle, label) {
  if (b.dataset.arm === '1') { clearTimeout(b._t); b.dataset.arm = ''; b.classList.remove('arm'); return true; }
  b.dataset.arm = '1'; b.classList.add('arm'); b.textContent = label;
  b._t = setTimeout(() => { b.dataset.arm = ''; b.classList.remove('arm'); b.textContent = idle; }, 4000);
  return false;
}
async function closeAll() {
  const b = $('#closeAll'); if (!W.evm.address) return window.__wallets();
  const L = posOf(S.me && S.me.st); if (!L.length) return toast('No open positions.', '', 2500);
  if (!armed(b, 'Close all', `Confirm: close ${L.length}`)) return;
  b.disabled = true; b.textContent = 'Closing…';
  try { if (!W.agent()) await W.approveAgent(); const r = await execute(L.map(p => ({ coin: p.coin, p: api.perps.by[p.coin], cur: p.szi, delta: -p.szi, dn: p.val })).filter(x => x.p), 'Close'); toast(`Closed ${r.done} of ${L.length}.${r.errs.length ? ' ' + esc(r.errs.join(' · ')) : ''}`, r.errs.length ? 'err' : 'ok', 8000); }
  catch (e) { toast(esc(e.message), 'err'); }
  b.disabled = false; b.textContent = 'Close all'; setTimeout(loadMe, 1200);
}
async function cancelAll() {
  const b = $('#cancelAll'); if (!W.evm.address) return window.__wallets();
  const L = (S.me && S.me.oo) || []; if (!L.length) return toast('No open orders.', '', 2500);
  if (!armed(b, 'Cancel all orders', `Confirm: cancel ${L.length}`)) return;
  b.disabled = true; b.textContent = 'Cancelling…';
  try { if (!W.agent()) await W.approveAgent(); const r = await W.cancelAll(L, api.perps.by), st = (r && r.data && r.data.statuses) || [], bad = st.filter(x => x && x.error); toast(bad.length ? `Cancelled ${st.length - bad.length}. ${esc(bad[0].error)}` : `Cancelled ${st.length || L.length}.`, bad.length ? 'err' : 'ok', 6000); }
  catch (e) { toast(esc(e.message), 'err'); }
  b.disabled = false; b.textContent = 'Cancel all orders'; setTimeout(loadMe, 900);
}
function openTpsl(coin) {
  const pos = posOf(S.me && S.me.st).find(x => x.coin === coin), p = api.perps.by[coin]; if (!pos || !p) return;
  const long = pos.szi > 0, mark = api.mids[coin] || p.mark, sug = k => +(mark * (1 + k)).toPrecision(5);
  $('#mTitle').textContent = `TP / SL · ${coin}`;
  const box = $('#mBody');
  box.innerHTML = `<div class="m-sec"><span>${long ? 'Long' : 'Short'} ${num(Math.abs(pos.szi), 4)} ${esc(coin)} · entry ${px(pos.entry)} · mark ${px(mark)}${pos.liq ? ' · liq ' + px(pos.liq) : ''}</span>
    <label class="tp-f"><em>Take profit</em><input id="tpPx" type="text" inputmode="decimal" value="${sug(long ? .1 : -.1)}"><b id="tpPnl">—</b></label>
    <label class="tp-f"><em>Stop loss</em><input id="slPx" type="text" inputmode="decimal" value="${sug(long ? -.05 : .05)}"><b id="slPnl">—</b></label>
    <p class="m-note">Each closes the whole position at market when the mark touches it. Leave one empty to skip it.</p>
    <button class="btn btn-gold" id="tpGo" type="button" style="width:100%">Set on Hyperliquid</button></div>`;
  const calc = () => { for (const [i, o] of [['#tpPx', '#tpPnl'], ['#slPx', '#slPnl']]) { const v = parseNum($(i).value), pl = (v - pos.entry) * pos.szi; $(o).innerHTML = v > 0 ? `<span class="${cls(pl)}">${pl >= 0 ? '+' : ''}${usd(pl)}</span>` : '—'; } };
  box.oninput = calc; calc();
  box.onclick = async e => {
    if (!e.target.closest('#tpGo')) return;
    const tp = parseNum($('#tpPx').value), sl = parseNum($('#slPx').value), now = api.mids[coin] || p.mark;
    if (tp > 0 && (long ? tp <= now : tp >= now)) return toast(`Take profit has to be ${long ? 'above' : 'below'} the mark.`, 'err', 5000);
    if (sl > 0 && (long ? sl >= now : sl <= now)) return toast(`Stop loss has to be ${long ? 'below' : 'above'} the mark.`, 'err', 5000);
    const go = $('#tpGo'); go.disabled = true; go.textContent = 'Sending…';
    try { if (!W.agent()) await W.approveAgent(); const d = await W.tpsl(p, pos.szi, tp, sl); toast(`${esc(coin)}: ${d.map(k => k.toUpperCase()).join(' and ')} set.`, 'ok'); $('#modal').hidden = true; setTimeout(loadMe, 900); }
    catch (err) { toast(esc(err.message), 'err'); go.disabled = false; go.textContent = 'Set on Hyperliquid'; }
  };
  $('#modal').hidden = false;
}

// ---------------------------------------------------------------- the tape: the top chads' fills, live
let tapeN = 0;
function tapeWatch(d) {
  const top = d.windows.m.chads.slice(0, 12).map(i => d.rows[i].a), bot = d.windows.m.virgins.slice(0, 6).map(i => d.rows[i].a);
  api.watchFills([...top, ...bot]);
  $('#navTape').classList.add('on');
}
function tapeAdd(ev) {
  const d = api.board.data; if (!d) return;
  const rk = rankOf(ev.user), r = rowOf(ev.user); if (!rk && !(S.lead && S.lead.a.toLowerCase() === ev.user)) return;
  // one line per order: fills of the same order and direction are summed
  const by = {};
  for (const f of ev.fills) { const k = f.oid + f.dir; const x = by[k] || (by[k] = { coin: f.coin, dir: f.dir, sz: 0, ntl: 0, px: +f.px }); x.sz += +f.sz; x.ntl += +f.sz * +f.px; }
  const box = $('#tapeIn'), em = box.querySelector('.tape-empty');
  for (const x of Object.values(by)) {
    if (x.ntl < 10000) continue;
    if (em) em.remove();
    const el = document.createElement('span'); el.className = 'tp'; el.dataset.a = ev.user;
    const longish = /Open Long|Close Short|Buy/.test(x.dir);
    el.innerHTML = `<b style="color:${rk && rk.k === 'virgins' ? 'var(--r)' : 'var(--gold)'}">${rk ? (rk.k === 'virgins' ? 'virgin' : 'chad') + ' #' + rk.i : ''}</b>${esc(name(r || { a: ev.user }))}${coinIcon(x.coin, 'ci')}<em class="${longish ? 'up' : 'dn'}">${esc(x.dir)}</em><b>${esc(x.coin)}</b>${usd(x.ntl)} @ ${px(x.px)}`;
    box.prepend(el); tapeN++;
    while (box.children.length > 30) box.lastChild.remove();
  }
  $('#navTapeN').textContent = tapeN;
  box.onclick = e => { const t = e.target.closest('.tp'); if (t) select(t.dataset.a); };
}
