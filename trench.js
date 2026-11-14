// CHAD · the trenches. pump.fun's live pulse straight from Jupiter: brand-new coins, the ones about to fill the curve, the ones that
// just migrated to PumpSwap. Buy and sell any of them from your own Solana wallet: Jupiter Ultra builds every swap for your address
// and your wallet signs it. CHAD never holds a key or a coin of yours. Most memecoins go to zero.
import { $, $$, on, esc, usd, px, pct, cls, toast, copy, store, short, solscan } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';

const html = document.documentElement;
const COLS = [['recent', 'New pairs', 'just created on pump.fun'], ['aboutToGraduate', 'Final stretch', 'closest to filling the curve'], ['graduated', 'Migrated', 'graduated to PumpSwap']];
const QB = [0.05, 0.1, 0.25, 0.5, 1], SELL = [25, 50, 75, 100], TF = { '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1] };
const S = {
  open: false, built: false, el: {}, pulse: { recent: [], aboutToGraduate: [], graduated: [] }, by: new Map(), prev: new Map(), drawn: {},
  at: 0, err: 0, timer: null, tick: null, q: '', f: { soc: false, safe: false, top: false, ...store.get('chad:trf', {}) },
  qb: +store.get('chad:qb', 0.1) || 0.1, hover: null, tab: 'recent', solUsd: null, hold: null, holdAt: 0, holdT: null,
  mode: null, sel: null, side: 'buy', amt: null, sellPct: 50, quote: null, qT: null, qN: 0, pools: {}, tf: '1m', dT: null, pend: new Set(),
};

// ---------------------------------------------------------------- small things
const SV = {
  web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.3 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.3-3.9-8.5S9.4 5.9 12 3.5z"/></svg>',
  tg: '<svg viewBox="0 0 24 24"><path d="M21 4 3 11l6 2.5L18 7l-7 7.5V20l3.5-3.6L18 19z"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.3c1.7.6 2.7 2.2 3 4.7"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.2a1.7 1.7 0 0 0-1.7-1.7H6.2a1.7 1.7 0 0 0-1.7 1.7v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path class="fill" d="M13.2 2.5 5 13.6h5.6l-1 7.9 8.4-11.3h-5.7z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8.5h14l-1.1 11.5H6.1z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/></svg>',
  srch: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>',
};
const isCA = s => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s).trim());
const fin = v => v != null && isFinite(v);
const cmp = v => { if (!fin(v)) return '—'; const a = Math.abs(v); if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K'; return '$' + Math.round(v); };
const amt = v => { if (!fin(v)) return '—'; const a = Math.abs(v); if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; if (a >= 1) return v.toFixed(2); return a ? v.toPrecision(3) : '0'; };
const sol = v => (fin(v) ? '◎' + (v >= 100 ? v.toFixed(1) : v >= 1 ? +v.toFixed(3) : +v.toFixed(4)) : '—');
const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return Math.floor(s) + 's'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };
const ms = v => (v ? Date.parse(v) || null : null);
const url = (v, base) => (/^https?:\/\//i.test(v) ? v : base + String(v).replace(/^@/, ''));
const clamp = v => (fin(v) ? Math.max(0, Math.min(100, v)) : 0);
const errMsg = e => { const m = String((e && (e.message || e)) || 'Something went wrong.'); return /reject|denied|cancel|declin/i.test(m) || (e && e.code === 4001) ? 'You cancelled it in your wallet.' : m.length > 160 ? m.slice(0, 157) + '…' : m; };

// one shape for a token, from the pulse (a pool) or from a token search
function fromTok(b, p = {}, col = null) {
  const a = b.audit || {}, s5 = b.stats5m || {}, s24 = b.stats24h || {}, grad = ms(b.graduatedAt);
  return {
    mint: b.id, col: col || (grad ? 'graduated' : null), pool: p.id && p.id !== b.id ? p.id : b.graduatedPool || null, dex: p.dex || (grad ? 'swap.pump.fun' : b.launchpad || ''),
    name: b.name || '', sym: b.symbol || '', icon: /^https:\/\//.test(b.icon || '') ? b.icon : '', dec: b.decimals ?? 6, launchpad: b.launchpad || '',
    created: ms((b.firstPool && b.firstPool.createdAt) || b.createdAt || p.createdAt), grad, prog: p.bondingCurve != null ? +p.bondingCurve : grad ? 100 : null,
    mcap: +(b.mcap ?? b.fdv) || null, price: +b.usdPrice || null, liq: +(p.liquidity ?? b.liquidity) || null,
    vol: +p.volume24h || (s24.buyVolume || 0) + (s24.sellVolume || 0) || null, holders: b.holderCount ?? null,
    top10: a.topHoldersPercentage ?? null, mintOff: a.mintAuthorityDisabled ?? null, freezeOff: a.freezeAuthorityDisabled ?? null, devMints: a.devMints ?? null,
    bots: a.botHoldersPercentage ?? null, bundle: a.bundlerStats ? a.bundlerStats.holdingPct ?? null : null,
    tw: b.twitter || '', web: b.website || '', tg: b.telegram || '', dev: b.dev || '', fees: b.fees ?? null,
    ch5: s5.priceChange ?? null, ch24: s24.priceChange ?? null, nb5: s5.numBuys ?? null, ns5: s5.numSells ?? null,
  };
}
const merge = t => { const o = S.by.get(t.mint); if (o) { for (const k of Object.keys(t)) if (t[k] == null || t[k] === '') t[k] = o[k]; if (!t.pool && o.pool) t.pool = o.pool; } S.by.set(t.mint, t); return t; };

// ---------------------------------------------------------------- the pulse: one read feeds all three columns
async function poll() {
  clearTimeout(S.timer);
  if (!S.open) return;
  if (document.hidden) { S.timer = setTimeout(poll, 2000); return; }
  try {
    const d = await api.gems();
    for (const [k] of COLS) {
      for (const t of S.pulse[k]) if (t.mcap != null) S.prev.set(t.mint, t.mcap);
      S.pulse[k] = ((d[k] && d[k].pools) || []).filter(p => p && p.baseAsset && p.baseAsset.id).map(p => merge(fromTok(p.baseAsset, p, k)))
        .filter(t => !(t.mcap != null && t.mcap < (S.solUsd ? 15 * S.solUsd : 800)) && (t.sym || t.name));
    }
    S.at = Date.now(); S.err = 0; draw();
  } catch { S.err++; }
  status();
  S.timer = setTimeout(poll, S.err ? Math.min(30000, 3000 * 2 ** S.err) : innerWidth < 760 ? 6000 : 4000);
}
const status = () => { const s = S.el.st; if (!s) return; const age = S.at ? Math.round((Date.now() - S.at) / 1000) : null; s.textContent = S.err && (!S.at || age > 20) ? 'reconnecting…' : S.at ? (age < 2 ? 'live' : `live · ${age}s`) : 'connecting…'; s.parentElement.classList.toggle('off', !!S.err && (!S.at || age > 20)); };
async function solPrice() { try { const a = await api.search(api.SOL_MINT); const x = (a || []).find(z => z.id === api.SOL_MINT); if (x && x.usdPrice) S.solUsd = +x.usdPrice; } catch {} }

// your wallet: SOL and every token, read from Jupiter
async function holdLoad(fromBags) {
  clearTimeout(S.holdT);
  const a = W.sol.address; if (!a) { S.hold = null; walletChip(); return false; }
  let ok = false;
  try { const h = await api.holdings(a); if (W.sol.address === a) { S.hold = { sol: +h.uiAmount || 0, tok: h.tokens || {} }; S.holdAt = Date.now(); ok = true; } } catch {}
  walletChip(); if (S.mode === 'coin') boxInfo(); if (ok && !fromBags && S.mode === 'bags') bags(true);
  if (S.open) S.holdT = setTimeout(holdLoad, 20000);
  return ok;
}
const balRaw = m => { const L = (S.hold && S.hold.tok[m]) || []; let s = 0n; for (const x of L) { try { s += BigInt(x.amount || '0'); } catch {} } return s; };
const balUi = m => { const L = (S.hold && S.hold.tok[m]) || []; return L.reduce((s, x) => s + (+x.uiAmount || 0), 0); };
const decOf = m => { const L = (S.hold && S.hold.tok[m]) || []; return L.length ? L[0].decimals : (S.by.get(m) || {}).dec ?? 6; };

// what you paid, from your buys in this browser (so the drawer can show a PnL); never leaves this browser
const BAG = () => store.get('chad:bag', {});
function record(m, solIn, rawOut, side, pctSold) {
  const a = W.sol.address; if (!a) return; const all = BAG(), mine = all[a] || (all[a] = {}), r = mine[m] || { c: 0, q: '0' };
  if (side === 'buy') { r.c += solIn; r.q = (BigInt(r.q) + BigInt(rawOut || 0)).toString(); }
  else { const f = Math.max(0, 1 - pctSold / 100); r.c *= f; r.q = ((BigInt(r.q) * BigInt(Math.round(f * 1e4))) / 10000n).toString(); }
  if (r.c < 1e-9) delete mine[m]; else mine[m] = r;
  store.set('chad:bag', all);
}
const cost = m => { const a = W.sol.address; return a ? (BAG()[a] || {})[m] || null : null; };

// ---------------------------------------------------------------- trading
async function connectThen(next) {
  if (!W.sol.list.length) { toast('Install Phantom, Solflare or Backpack to trade the trenches.', 'err', 5000); window.__wallets && window.__wallets('sol'); return; }
  if (W.sol.list.length > 1) { window.__wallets && window.__wallets('sol'); return; }
  try { await W.connectSol(W.sol.list[0].name); toast('Solana wallet connected.', 'ok', 2500); next && next(); } catch (e) { toast(esc(errMsg(e)), 'err'); }
}
function busy(m, on) { S.pend[on ? 'add' : 'delete'](m); $$(`.tc-buy[data-buy="${m}"]`).forEach(b => { b.disabled = on; b.classList.toggle('wait', on); }); if (S.sel === m && S.mode === 'coin') boxInfo(); }
export async function buy(m, solAmt) {
  if (!W.sol.address) return connectThen(() => buy(m, solAmt));
  if (S.pend.has(m)) return;
  const t = S.by.get(m) || { sym: short(m), dec: 6 }, lam = Math.round(solAmt * 1e9);
  if (!(lam > 0)) return toast('Pick a buy amount first.', 'err', 3000);
  if (S.hold && S.hold.sol < solAmt + .003) return toast(`Not enough SOL. The wallet has ${sol(S.hold.sol)}; keep a little for fees.`, 'err', 5000);
  busy(m, true); toast(`Buying $${esc(t.sym)} for ${sol(solAmt)}. Confirm in your wallet.`, '', 4000);
  try {
    const r = await W.swap({ inputMint: api.SOL_MINT, outputMint: m, amount: lam });
    record(m, solAmt, r.outAmt, 'buy');
    toast(`Bought ${amt(+r.outAmt / 10 ** (t.dec ?? 6))} $${esc(t.sym)} for ${sol(solAmt)}. <a href="${solscan(r.sig)}" target="_blank" rel="noopener">View tx ↗</a>`, 'ok', 10000);
  } catch (e) { toast(esc(errMsg(e)) + (e && e.sig ? ` <a href="${solscan(e.sig)}" target="_blank" rel="noopener">tx ↗</a>` : ''), 'err', 8000); }
  finally { busy(m, false); setTimeout(holdLoad, 2500); setTimeout(holdLoad, 9000); }
}
export async function sell(m, p) {
  if (!W.sol.address) return connectThen();
  if (S.pend.has(m)) return;
  const raw = balRaw(m), t = S.by.get(m) || { sym: short(m) };
  if (raw <= 0n) return toast('You hold none of this coin.', 'err', 3000);
  const n = p >= 100 ? raw : (raw * BigInt(Math.round(p * 100))) / 10000n; if (n <= 0n) return;
  busy(m, true); toast(`Selling ${p}% of your $${esc(t.sym)}. Confirm in your wallet.`, '', 4000);
  try {
    const r = await W.swap({ inputMint: m, outputMint: api.SOL_MINT, amount: n.toString() });
    record(m, 0, 0, 'sell', p);
    toast(`Sold ${p}% of $${esc(t.sym)} for ${sol(+r.outAmt / 1e9)}. <a href="${solscan(r.sig)}" target="_blank" rel="noopener">View tx ↗</a>`, 'ok', 10000);
  } catch (e) { toast(esc(errMsg(e)) + (e && e.sig ? ` <a href="${solscan(e.sig)}" target="_blank" rel="noopener">tx ↗</a>` : ''), 'err', 8000); }
  finally { busy(m, false); setTimeout(holdLoad, 2500); setTimeout(holdLoad, 9000); }
}

// ---------------------------------------------------------------- the columns
function pass(t) {
  if (S.f.soc && !(t.tw || t.web || t.tg)) return false;
  if (S.f.safe && !(t.mintOff && t.freezeOff)) return false;
  if (S.f.top && !(fin(t.top10) && t.top10 < 30)) return false;
  const q = S.q.trim().toLowerCase();
  return !q || t.sym.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.mint.toLowerCase() === q;
}
const sorted = k => { const L = S.pulse[k].slice(); if (k === 'recent') L.sort((a, b) => (b.created || 0) - (a.created || 0)); else if (k === 'graduated') L.sort((a, b) => (b.grad || 0) - (a.grad || 0)); else L.sort((a, b) => (b.prog ?? 0) - (a.prog ?? 0)); return L; };
const iconHtml = t => (t.icon ? `<img src="${esc(t.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-l="${esc((t.sym || '?').slice(0, 2))}">` : `<b>${esc((t.sym || '?').slice(0, 2))}</b>`);
function cardBody(t, k) {
  const soc = [t.tw && `<a class="tc-so" href="${esc(url(t.tw, 'https://x.com/'))}" target="_blank" rel="noopener" title="X">𝕏</a>`, t.web && `<a class="tc-so" href="${esc(url(t.web, 'https://'))}" target="_blank" rel="noopener" title="Website">${SV.web}</a>`, t.tg && `<a class="tc-so" href="${esc(url(t.tg, 'https://t.me/'))}" target="_blank" rel="noopener" title="Telegram">${SV.tg}</a>`].filter(Boolean).join('');
  const fl = [];
  if (fin(t.top10)) fl.push(`<span class="${t.top10 >= 30 ? 'dn' : ''}" title="Share held by the top 10 holders">T10 ${t.top10.toFixed(0)}%</span>`);
  if (fin(t.devMints) && t.devMints > 0) fl.push(`<span class="${t.devMints >= 10 ? 'dn' : ''}" title="Coins this dev has launched">DEV ${t.devMints}</span>`);
  if (fin(t.bundle) && t.bundle >= 1) fl.push(`<span class="${t.bundle >= 15 ? 'dn' : ''}" title="Share held by bundled wallets">BNDL ${t.bundle.toFixed(0)}%</span>`);
  if (t.mintOff === false || t.freezeOff === false) fl.push('<span class="dn" title="Mint or freeze authority is still on">AUTH</span>');
  const tx = fin(t.nb5) ? `<span title="Buys and sells, last 5 minutes"><b class="up">${t.nb5}</b>/<b class="dn">${t.ns5 ?? 0}</b></span>` : '';
  return `<span class="tc-n"><b>${esc(t.sym)}</b><em>${esc(t.name)}</em><button type="button" class="tc-cp" data-copy="${esc(t.mint)}" title="Copy the contract address" aria-label="Copy the contract address">${SV.copy}</button></span>
    <span class="tc-m"><time data-t="${(k === 'graduated' && t.grad) || t.created || ''}"></time>${soc}<span title="Holders">${SV.users}${fin(t.holders) ? amt(t.holders).replace('.00', '') : '—'}</span>${fl.join('')}</span>
    <span class="tc-k"><span>MC <b class="mc">${cmp(t.mcap)}</b></span><span>V <b>${cmp(t.vol)}</b></span>${tx}${fin(t.ch5) ? `<span class="${cls(t.ch5)}">${pct(t.ch5, 1)}</span>` : ''}</span>`;
}
const cardSide = (t, k) => `${k === 'graduated' ? '<span class="tc-tag">PumpSwap</span>' : `<span class="tc-pg${t.prog >= 90 ? ' hot' : ''}" title="Bonding curve filled">${fin(t.prog) ? t.prog.toFixed(t.prog >= 99 && t.prog < 100 ? 1 : 0) + '%' : ''}</span>`}<button type="button" class="tc-buy${S.pend.has(t.mint) ? ' wait' : ''}" data-buy="${esc(t.mint)}"${S.pend.has(t.mint) ? ' disabled' : ''} title="Quick buy ${sol(S.qb)}">${SV.bolt}<span>${+S.qb}</span></button>`;
function cardNode(t) {
  const n = document.createElement('div'); n.className = 'tc'; n.dataset.m = t.mint; n.tabIndex = 0; n.setAttribute('role', 'button'); n.setAttribute('aria-label', `${t.sym} ${t.name}`);
  n.innerHTML = `<span class="tc-i">${iconHtml(t)}</span><span class="tc-b"></span><span class="tc-r"></span>`;
  return n;
}
function fill(n, t, k) {
  const [ic, bd, rd] = n.children, b = cardBody(t, k), r = cardSide(t, k);
  if (bd.__h !== b) { bd.innerHTML = b; bd.__h = b; const tm = bd.querySelector('time'); if (tm && tm.dataset.t) tm.textContent = ago(+tm.dataset.t); }
  if (rd.__h !== r) { rd.innerHTML = r; rd.__h = r; }
  ic.style.setProperty('--p', clamp(k === 'graduated' ? 100 : t.prog)); ic.classList.toggle('hot', k !== 'graduated' && t.prog >= 90);
  n.classList.toggle('sel', S.sel === t.mint && S.mode === 'coin');
  const pv = S.prev.get(t.mint); if (pv != null && fin(t.mcap) && Math.abs(t.mcap / pv - 1) > .002) { n.classList.remove('fu', 'fd'); void n.offsetWidth; n.classList.add(t.mcap > pv ? 'fu' : 'fd'); }
}
function drawCol(k) {
  const box = S.el.list[k]; if (!box) return;
  const L = sorted(k).filter(pass); S.el.n[k].textContent = L.length;
  const have = new Map($$('.tc', box).map(n => [n.dataset.m, n])), wait = S.el.wait[k];
  if (S.hover === k && have.size) {
    let w = 0; for (const t of L) { const n = have.get(t.mint); if (n) fill(n, t, k); else w++; }
    wait.textContent = w ? `${w} new` : 'paused'; wait.hidden = false; return;
  }
  wait.hidden = true;
  const keep = new Set(L.map(t => t.mint)); for (const [m, n] of have) if (!keep.has(m)) n.remove();
  const em = box.querySelector('.tr-empty'); if (em && L.length) em.remove();
  let prev = null;
  for (const t of L) {
    let n = have.get(t.mint); if (!n) { n = cardNode(t); if (S.drawn[k]) n.classList.add('tc-new'); }
    fill(n, t, k);
    const want = prev ? prev.nextSibling : box.firstChild; if (n !== want) box.insertBefore(n, want); prev = n;
  }
  if (!L.length && !box.querySelector('.tr-empty')) box.insertAdjacentHTML('beforeend', `<p class="tr-empty">${S.at ? 'Nothing here matches your filters.' : 'Reading pump.fun…'}</p>`);
  else if (!L.length) box.querySelector('.tr-empty').textContent = S.at ? 'Nothing here matches your filters.' : 'Reading pump.fun…';
  if (S.at) S.drawn[k] = true;
}
function draw() { for (const [k] of COLS) drawCol(k); if (S.mode === 'coin') kv(); }

// ---------------------------------------------------------------- the drawer: one coin, your bags, or search results
const D = () => S.el.d;
function closeDrawer() { S.mode = S.sel = null; clearTimeout(S.dT); clearTimeout(S.qT); D().hidden = true; D().innerHTML = ''; S.el.root.classList.remove('d-on'); $$('.tc.sel', S.el.root).forEach(n => n.classList.remove('sel')); }
function shell(inner) { const d = D(); d.hidden = false; S.el.root.classList.add('d-on'); d.innerHTML = inner; d.scrollTop = 0; }
const links = t => [
  [`https://pump.fun/coin/${t.mint}`, 'pump.fun'], [`https://dexscreener.com/solana/${t.mint}`, 'Dexscreener'], [`https://solscan.io/token/${t.mint}`, 'Solscan'],
  t.tw && [url(t.tw, 'https://x.com/'), '𝕏'], t.web && [url(t.web, 'https://'), 'Website'], t.tg && [url(t.tg, 'https://t.me/'), 'Telegram'],
].filter(Boolean).map(([u, l]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join('');
export async function openCoin(m, t0) {
  clearTimeout(S.dT); clearTimeout(S.qT);
  S.mode = 'coin'; S.sel = m; S.side = 'buy'; S.quote = null; if (S.amt == null) S.amt = S.qb;
  $$('.tc', S.el.root).forEach(n => n.classList.toggle('sel', n.dataset.m === m));
  let t = t0 || S.by.get(m);
  if (!t) {
    shell(`<div class="td-h"><button type="button" class="td-x" data-x="close" aria-label="Close">×</button></div><p class="tr-empty">Looking the coin up on Jupiter…</p>`);
    try { const a = await api.search(m); const x = (a || []).find(z => z.id === m); if (x) t = merge(fromTok(x)); } catch {}
    if (S.sel !== m) return;
    if (!t) { shell(`<div class="td-h"><b class="td-ttl">Not found</b><button type="button" class="td-x" data-x="close" aria-label="Close">×</button></div><p class="tr-empty">Jupiter has no token at that address yet.</p>`); return; }
  }
  shell(`<div class="td-h">
      <button type="button" class="td-back" data-x="close" aria-label="Back">${SV.back}</button>
      <span class="td-i">${iconHtml(t)}</span>
      <div class="td-id"><b>${esc(t.sym)}</b><span>${esc(t.name)}</span></div>
      <button type="button" class="td-ca mono" data-copy="${esc(t.mint)}" title="Copy the contract address">${short(t.mint)}${SV.copy}</button>
      <button type="button" class="td-x" data-x="close" aria-label="Close">×</button></div>
    <div class="td-l">${links(t)}</div>
    <div class="td-kv" id="tdKV"></div>
    <div class="td-tr"><div class="seg td-side" id="tdSide"><button type="button" data-side="buy" class="on">Buy</button><button type="button" data-side="sell">Sell</button></div><div id="tdBox"></div></div>
    <div class="td-ch"><div class="td-ch-h"><div class="seg seg-xs" id="tdTF">${Object.keys(TF).map(k => `<button type="button" data-tf="${k}" class="${S.tf === k ? 'on' : ''}">${k}</button>`).join('')}</div><span class="mono" id="tdChS"></span></div><div class="td-cv"><canvas id="tdCv"></canvas><p class="tr-empty" id="tdCvE">Loading the chart…</p></div></div>
    <div class="td-au" id="tdAU"></div>
    <div class="td-tx"><p class="td-sub">Latest trades</p><div id="tdTx"><p class="tr-empty">Loading trades…</p></div></div>
    <p class="td-risk">Memecoins are the riskiest thing on any chain and most go to zero. Swaps route through Jupiter Ultra and your wallet signs each one. CHAD never holds your keys or coins.</p>`);
  kv(); box(); audit(); market(true);
}
function kv() {
  const t = S.by.get(S.sel), el = $('#tdKV'); if (!t || !el) return;
  const curve = t.grad ? `<div class="td-cu"><span>Migrated</span><b>${ago(t.grad)} ago</b></div>` : fin(t.prog) ? `<div class="td-cu"><span>Bonding curve</span><b>${t.prog.toFixed(1)}%</b><i style="--p:${clamp(t.prog)}"></i></div>` : '';
  el.innerHTML = [['Price', px(t.price)], ['Market cap', cmp(t.mcap)], ['Liquidity', cmp(t.liq)], ['Volume 24h', cmp(t.vol)], ['Holders', fin(t.holders) ? t.holders.toLocaleString('en-US') : '—'], ['5m', fin(t.ch5) ? `<span class="${cls(t.ch5)}">${pct(t.ch5, 1)}</span>` : '—'], ['Age', t.created ? ago(t.created) : '—'], ['Fees paid', fin(t.fees) ? sol(t.fees) : '—']]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') + curve;
}
function audit() {
  const t = S.by.get(S.sel), el = $('#tdAU'); if (!t || !el) return;
  const chip = (good, l, title) => `<span class="${good == null ? '' : good ? 'ok' : 'bad'}" title="${esc(title)}">${l}</span>`;
  el.innerHTML = `<p class="td-sub">Checks</p><div class="td-chips">${[
    chip(t.mintOff, t.mintOff ? 'Mint off' : t.mintOff === false ? 'Mint on' : 'Mint ?', 'Whether new tokens can still be minted'),
    chip(t.freezeOff, t.freezeOff ? 'Freeze off' : t.freezeOff === false ? 'Freeze on' : 'Freeze ?', 'Whether wallets can be frozen'),
    fin(t.top10) && chip(t.top10 < 30, `Top 10 own ${t.top10.toFixed(1)}%`, 'Share of the supply held by the 10 biggest holders'),
    fin(t.devMints) && chip(t.devMints < 10, `Dev launched ${t.devMints}`, 'How many coins the creator wallet has launched'),
    fin(t.bundle) && chip(t.bundle < 15, `Bundles hold ${t.bundle.toFixed(1)}%`, 'Share held by wallets that bought in the same bundles'),
    fin(t.bots) && chip(t.bots < 40, `Bot holders ${t.bots.toFixed(0)}%`, 'Share of holders flagged as bots'),
    t.dev && `<a href="${esc(solscan(t.dev, 'account'))}" target="_blank" rel="noopener" title="The creator wallet">Dev ${short(t.dev)} ↗</a>`,
  ].filter(Boolean).join('')}</div><p class="td-note">Read live from Jupiter's token data. A clean check is not a safe coin.</p>`;
}
function box() {
  const t = S.by.get(S.sel), el = $('#tdBox'); if (!t || !el) return;
  $$('#tdSide button').forEach(b => b.classList.toggle('on', b.dataset.side === S.side));
  el.innerHTML = S.side === 'buy'
    ? `<div class="td-amts">${QB.map(v => `<button type="button" data-amt="${v}" class="${+S.amt === v ? 'on' : ''}">${sol(v)}</button>`).join('')}</div>
      <label class="td-in"><input id="tdAmt" class="inp" inputmode="decimal" autocomplete="off" value="${esc(String(S.amt ?? ''))}" aria-label="SOL to spend"><span>SOL</span></label>
      <div class="td-q mono" id="tdQ">${quoteTxt()}</div><button type="button" class="btn btn-gold td-go" id="tdGo"></button><p class="td-pos" id="tdPos" hidden></p><p class="td-bal mono" id="tdBal" hidden></p>`
    : `<p class="td-pos" id="tdPos"></p><div class="td-amts">${SELL.map(v => `<button type="button" data-pct="${v}" class="${S.sellPct === v ? 'on' : ''}">${v}%</button>`).join('')}</div>
      <div class="td-q mono" id="tdQ">${quoteTxt()}</div><button type="button" class="btn td-go td-sell" id="tdGo"></button><p class="td-bal mono" id="tdBal" hidden></p>`;
  boxInfo(); quoteSoon();
}
// the parts of the trade box that change with your wallet: what you hold, the button, the balance
function boxInfo() {
  const t = S.by.get(S.sel), go = $('#tdGo'); if (!t || !go) return;
  const have = balUi(t.mint), val = fin(t.price) ? have * t.price : null, c = cost(t.mint), pend = S.pend.has(t.mint), conn = !!W.sol.address;
  const posEl = $('#tdPos'), balEl = $('#tdBal');
  const pos = have > 0 ? `You hold <b>${amt(have)}</b> $${esc(t.sym)}${fin(val) ? ` ≈ <b>${usd(val)}</b>` : ''}${c && fin(val) && S.solUsd ? (() => { const now = val / S.solUsd, p = (now / c.c - 1) * 100; return ` · paid ${sol(c.c)} · <b class="${cls(p)}">${pct(p, 1)}</b>`; })() : ''}` : '';
  if (posEl) { const txt = pos || (S.side === 'sell' ? (conn ? `You hold no $${esc(t.sym)}${S.hold ? '' : ' (reading your wallet…)'}.` : 'Connect a Solana wallet to sell.') : ''); posEl.innerHTML = txt; posEl.hidden = !txt; }
  if (balEl) { balEl.hidden = !(conn && S.hold); if (conn && S.hold) balEl.textContent = `Wallet ${short(W.sol.address)} · ${sol(S.hold.sol)}`; }
  if (S.side === 'buy') { go.disabled = pend; go.textContent = pend ? 'Waiting for your wallet…' : conn ? `Buy ${sol(+S.amt || 0)} of $${t.sym}` : 'Connect a Solana wallet'; }
  else { go.disabled = pend || (conn && !(have > 0)); go.textContent = pend ? 'Waiting for your wallet…' : conn ? `Sell ${S.sellPct}% of $${t.sym}` : 'Connect a Solana wallet'; }
}
function quoteTxt() {
  const q = S.quote, t = S.by.get(S.sel); if (!t) return '';
  if (!q) return '<span class="muted">Getting a quote…</span>';
  if (q.err) return `<span class="dn">${esc(q.err)}</span>`;
  const imp = Math.abs(+q.priceImpactPct || 0) * 100, fee = (q.feeBps ?? 0) / 100, slip = (q.slippageBps ?? 0) / 100;
  const out = q.side === 'buy' ? `≈ <b>${amt(+q.outAmount / 10 ** (t.dec ?? 6))}</b> $${esc(t.sym)}` : `≈ <b>${sol(+q.outAmount / 1e9)}</b>`;
  return `<span>${out}${q.outUsdValue ? ` · ${usd(+q.outUsdValue)}` : ''}</span><span>impact <b class="${imp > 5 ? 'dn' : ''}">${imp.toFixed(imp < 1 ? 2 : 1)}%</b> · Jupiter fee ${fee}%${slip ? ` · slippage ${slip}% auto` : ''}</span>`;
}
function quoteSoon(now) {
  clearTimeout(S.qT);
  S.qT = setTimeout(async () => {
    const t = S.by.get(S.sel); if (!t || S.mode !== 'coin' || !S.open) return;
    const n = ++S.qN, side = S.side; let p;
    if (side === 'buy') { const v = +S.amt; if (!(v > 0)) { S.quote = { err: 'Type how much SOL to spend.' }; return paintQ(); } p = { inputMint: api.SOL_MINT, outputMint: t.mint, amount: String(Math.round(v * 1e9)) }; }
    else { const raw = balRaw(t.mint); if (raw <= 0n) { S.quote = { err: W.sol.address ? 'Nothing to sell yet.' : 'Connect a Solana wallet to sell.' }; return paintQ(); } const a = S.sellPct >= 100 ? raw : (raw * BigInt(S.sellPct * 100)) / 10000n; p = { inputMint: t.mint, outputMint: api.SOL_MINT, amount: a.toString() }; }
    try { const q = await api.order(p); if (n !== S.qN) return; S.quote = q.outAmount ? { ...q, side } : { err: q.errorMessage || q.error || 'No route for this trade right now.' }; }
    catch (e) { if (n !== S.qN) return; S.quote = { err: errMsg(e) }; }
    paintQ();
    if (S.open && S.mode === 'coin' && S.sel === t.mint) quoteSoon(false);
  }, now === false ? 12000 : now ? 0 : 320);
}
const paintQ = () => { const el = $('#tdQ'); if (el) el.innerHTML = quoteTxt(); };

// the chart (GeckoTerminal candles) and the latest trades, refreshed while the drawer is open
async function poolOf(t) {
  if (t.pool) return t.pool;
  if (S.pools[t.mint]) return S.pools[t.mint];
  const L = await api.gtPools(t.mint); const p = L.find(x => /pump/.test(x.dex || '')) || L.sort((a, b) => b.liq - a.liq)[0];
  if (p) S.pools[t.mint] = p.id; return p ? p.id : null;
}
async function market(first) {
  clearTimeout(S.dT);
  const t = S.by.get(S.sel); if (!t || S.mode !== 'coin' || !S.open) return;
  const m = t.mint;
  try {
    const pool = await poolOf(t); if (S.sel !== m) return;
    if (!pool) throw new Error('none');
    const [tf, ag] = TF[S.tf], [C, X] = await Promise.all([api.gtCandles(pool, tf, ag, 150).catch(() => null), api.gtTrades(pool).catch(() => null)]);
    if (S.sel !== m) return;
    chart(C); trades(X, t);
  } catch { if (first) { const e = $('#tdCvE'); if (e) { e.hidden = false; e.textContent = 'The chart shows up once GeckoTerminal indexes this curve, usually within a minute or two.'; } const x = $('#tdTx'); if (x) x.innerHTML = '<p class="tr-empty">No trades indexed yet.</p>'; } }
  S.dT = setTimeout(market, 15000);
}
function chart(C) {
  const cv = $('#tdCv'), e = $('#tdCvE'); if (!cv) return;
  if (!C || C.length < 2) { if (e) { e.hidden = false; e.textContent = 'Not enough trades for a chart yet.'; } cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
  if (e) e.hidden = true;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(10, r.width), h = Math.max(10, r.height);
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const L = C.slice(-90), padR = 66, top = 8, volH = h * .17, bot = h - 16, plotB = bot - volH - 4;
  let lo = Infinity, hi = -Infinity, vmax = 0; for (const c of L) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); vmax = Math.max(vmax, c.v); }
  if (!(hi > lo)) { hi = lo * 1.01 + 1e-12; lo = lo * .99; }
  const y = v => top + (plotB - top) * (1 - (v - lo) / (hi - lo)), cw = (w - padR) / L.length;
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.fillStyle = '#586070'; g.font = '10px GeistMono, ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, yy = Math.round(y(v)) + .5; g.beginPath(); g.moveTo(0, yy); g.lineTo(w - padR + 4, yy); g.stroke(); g.fillText(px(v), w - padR + 8, yy); }
  L.forEach((c, i) => {
    const x = i * cw + cw / 2, up = c.c >= c.o, col = up ? '#36d77a' : '#ff4d5a';
    g.strokeStyle = col; g.fillStyle = col; g.beginPath(); g.moveTo(Math.round(x) + .5, y(c.h)); g.lineTo(Math.round(x) + .5, y(c.l)); g.stroke();
    const bw = Math.max(1, cw * .64), y0 = y(Math.max(c.o, c.c)), y1 = y(Math.min(c.o, c.c)); g.fillRect(x - bw / 2, y0, bw, Math.max(1, y1 - y0));
    if (vmax > 0) { g.globalAlpha = .28; const vh = volH * c.v / vmax; g.fillRect(x - bw / 2, bot - vh, bw, vh); g.globalAlpha = 1; }
  });
  const last = L[L.length - 1], ly = Math.round(y(last.c)) + .5, up = last.c >= L[0].o;
  g.setLineDash([3, 3]); g.strokeStyle = up ? 'rgba(54,215,122,.7)' : 'rgba(255,77,90,.7)'; g.beginPath(); g.moveTo(0, ly); g.lineTo(w - padR + 4, ly); g.stroke(); g.setLineDash([]);
  g.fillStyle = up ? '#36d77a' : '#ff4d5a'; g.fillRect(w - padR + 4, ly - 8, padR - 4, 16); g.fillStyle = '#05070b'; g.fillText(px(last.c), w - padR + 8, ly);
  const chg = (last.c / L[0].o - 1) * 100, s = $('#tdChS'); if (s) { s.className = 'mono ' + cls(chg); s.textContent = `${pct(chg, 1)} over ${L.length} candles`; }
}
function trades(X, t) {
  const el = $('#tdTx'); if (!el) return;
  if (!X || !X.length) { el.innerHTML = '<p class="tr-empty">No trades indexed yet.</p>'; return; }
  el.innerHTML = X.slice(0, 24).map(x => {
    const buy = x.kind === 'buy', n = buy ? +x.to_token_amount : +x.from_token_amount;
    return `<a class="td-t" href="${esc(solscan(x.tx_hash))}" target="_blank" rel="noopener"><time data-t="${ms(x.block_timestamp) || ''}">${ms(x.block_timestamp) ? ago(ms(x.block_timestamp)) : ''}</time><b class="${buy ? 'up' : 'dn'}">${buy ? 'Buy' : 'Sell'}</b><span>${usd(+x.volume_in_usd)}</span><span>${amt(n)}</span><span class="mono">${short(x.tx_from_address || '')}</span></a>`;
  }).join('');
}

// your bags: every token in the connected wallet, valued live
async function bags(silent) {
  S.mode = 'bags'; S.sel = null; clearTimeout(S.dT); clearTimeout(S.qT); $$('.tc.sel', S.el.root).forEach(n => n.classList.remove('sel'));
  if (!W.sol.address) { shell(`<div class="td-h"><b class="td-ttl">Your bags</b><button type="button" class="td-x" data-x="close" aria-label="Close">×</button></div><p class="tr-empty">Connect a Solana wallet to see what you hold and sell it from here.</p><button type="button" class="btn btn-gold td-go" data-x="connect">Connect a Solana wallet</button>`); return; }
  if (!silent) shell(`<div class="td-h"><b class="td-ttl">Your bags</b><button type="button" class="td-x" data-x="close" aria-label="Close">×</button></div><div id="tdBags"><p class="tr-empty">Reading your wallet…</p></div>`);
  if (!S.hold || Date.now() - S.holdAt > 15000) await holdLoad(true);
  const el = $('#tdBags'); if (!el || S.mode !== 'bags') return;
  if (!S.hold) { el.innerHTML = '<p class="tr-empty">Could not read your wallet right now. It retries in a few seconds.</p>'; return; }
  const mints = Object.keys((S.hold && S.hold.tok) || {}).filter(m => balRaw(m) > 0n);
  const need = mints.filter(m => !S.by.has(m) || !fin(S.by.get(m).price));
  for (let i = 0; i < need.length && i < 150; i += 50) { try { const a = await api.search(need.slice(i, i + 50).join(',')); for (const x of a || []) merge(fromTok(x)); } catch {} }
  if (S.mode !== 'bags') return;
  const rows = mints.map(m => { const t = S.by.get(m) || { mint: m, sym: short(m), name: '', dec: decOf(m) }, q = balUi(m); return { t, q, v: fin(t.price) ? q * t.price : null }; })
    .filter(r => r.t.mint !== api.SOL_MINT).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const big = rows.filter(r => r.v == null || r.v >= .01), dust = rows.length - big.length, total = big.reduce((s, r) => s + (r.v || 0), 0);
  el.innerHTML = `<p class="td-pos">${short(W.sol.address)} · <b>${sol(S.hold ? S.hold.sol : null)}</b>${S.solUsd && S.hold ? ` (${usd(S.hold.sol * S.solUsd)})` : ''} · tokens ≈ <b>${usd(total)}</b></p>` + (big.length ? big.map(({ t, q, v }) => `
    <div class="td-bag" data-open="${esc(t.mint)}"><span class="td-i sm">${iconHtml(t)}</span><span class="td-bn"><b>${esc(t.sym)}</b><em>${amt(q)}</em></span><span class="td-bv"><b>${fin(v) ? usd(v) : '—'}</b>${fin(t.ch24) ? `<em class="${cls(t.ch24)}">${pct(t.ch24, 1)} 24h</em>` : ''}</span>
      <span class="td-bs"><button type="button" class="btn btn-sm btn-line" data-sell="${esc(t.mint)}" data-p="50"${S.pend.has(t.mint) ? ' disabled' : ''}>Sell 50%</button><button type="button" class="btn btn-sm btn-line" data-sell="${esc(t.mint)}" data-p="100"${S.pend.has(t.mint) ? ' disabled' : ''}>Sell all</button></span></div>`).join('')
    : '<p class="tr-empty">No tokens in this wallet yet. Buy one from the columns.</p>') + (dust ? `<p class="td-note">${dust} tiny balance${dust > 1 ? 's' : ''} under a cent hidden.</p>` : '');
}
async function results(q) {
  S.mode = 'search'; S.sel = null; clearTimeout(S.dT); clearTimeout(S.qT);
  shell(`<div class="td-h"><b class="td-ttl">“${esc(q)}”</b><button type="button" class="td-x" data-x="close" aria-label="Close">×</button></div><div id="tdRes"><p class="tr-empty">Searching Jupiter…</p></div>`);
  let a = []; try { a = await api.search(q); } catch {}
  const el = $('#tdRes'); if (!el || S.mode !== 'search') return;
  const L = (a || []).slice(0, 25).map(x => merge(fromTok(x)));
  el.innerHTML = L.length ? L.map(t => `<div class="td-bag" data-open="${esc(t.mint)}"><span class="td-i sm">${iconHtml(t)}</span><span class="td-bn"><b>${esc(t.sym)}</b><em>${esc(t.name)}</em></span><span class="td-bv"><b>${cmp(t.mcap)}</b><em>${esc(t.launchpad || (t.grad ? 'graduated' : ''))}</em></span></div>`).join('') : '<p class="tr-empty">Nothing on Jupiter matches that.</p>';
}

// ---------------------------------------------------------------- the shell
function walletChip() {
  const b = S.el.w; if (!b) return;
  b.classList.toggle('on', !!W.sol.address);
  b.innerHTML = W.sol.address ? `${SV.bag}<span>${S.hold ? sol(S.hold.sol) : '◎…'}</span><em>${short(W.sol.address)}</em>` : `${SV.bag}<span>Connect<b class="tr-sw"> Solana</b></span>`;
}
function qbPaint() { $$('#trQB button').forEach(b => b.classList.toggle('on', +b.dataset.qb === +S.qb)); const c = $('#trQBc'); if (c && document.activeElement !== c) c.value = QB.includes(+S.qb) ? '' : S.qb; }
function build() {
  if (S.built) return; S.built = true;
  const root = document.createElement('section'); root.id = 'trench'; root.className = 'tr'; root.hidden = true; root.setAttribute('aria-label', 'Trenches'); root.setAttribute('data-lenis-prevent', '');
  root.innerHTML = `<div class="tr-top">
      <div class="tr-ttl"><b>Trenches</b><span class="tr-live mono"><i></i><span class="tr-pf">pump.fun · </span><span id="trSt">connecting…</span></span></div>
      <label class="tr-q">${SV.srch}<input id="trQ" placeholder="Search or paste a CA" autocomplete="off" spellcheck="false" aria-label="Search the trenches"></label>
      <div class="tr-opts"><div class="tr-f" id="trF">${[['soc', 'Socials', 'Only coins with an X, a website or a Telegram'], ['safe', 'Auth off', 'Only coins whose mint and freeze authority are off'], ['top', 'Top 10 < 30%', 'Only coins whose 10 biggest holders own under 30%']].map(([k, l, t]) => `<button type="button" data-f="${k}" class="${S.f[k] ? 'on' : ''}" title="${t}">${l}</button>`).join('')}</div>
      <div class="tr-qb" title="Quick buy amount, in SOL"><span class="tr-qbi" aria-hidden="true">${SV.bolt}</span><div class="seg seg-xs" id="trQB">${QB.map(v => `<button type="button" data-qb="${v}">${v}</button>`).join('')}</div><input id="trQBc" class="inp" inputmode="decimal" placeholder="◎" aria-label="Custom quick buy in SOL"></div></div>
      <button type="button" class="tr-w" id="trW"></button>
      <button type="button" class="tr-x" id="trX" aria-label="Close the trenches">×</button>
    </div>
    <div class="tr-tabs" id="trTabs">${COLS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="tr-body"><div class="tr-cols">${COLS.map(([k, l, s]) => `<div class="tr-col${S.tab === k ? ' on' : ''}" data-c="${k}"><header><b>${l}</b><em class="mono" id="trN-${k}">0</em><span class="tr-sub">${s}</span><span class="tr-wait mono" id="trW-${k}" hidden>paused</span></header><div class="tr-list" id="trL-${k}"><p class="tr-empty">Reading pump.fun…</p></div></div>`).join('')}</div>
      <aside class="tr-d" id="trD" hidden></aside></div>
    <p class="tr-foot mono">Live from Jupiter's pump.fun pulse · charts and trades from GeckoTerminal · swaps by Jupiter Ultra, signed in your wallet · memecoins mostly go to zero</p>`;
  document.body.appendChild(root);
  S.el = { root, st: $('#trSt', root), w: $('#trW', root), d: $('#trD', root), list: {}, n: {}, wait: {} };
  for (const [k] of COLS) { S.el.list[k] = $(`#trL-${k}`, root); S.el.n[k] = $(`#trN-${k}`, root); S.el.wait[k] = $(`#trW-${k}`, root); }
  walletChip(); qbPaint();
  // images that fail become two letters
  root.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && !i.dataset.dead) { i.dataset.dead = 1; i.replaceWith(Object.assign(document.createElement('b'), { textContent: i.dataset.l || '?' })); } }, true);
  // hovering a column holds it still
  $$('.tr-col', root).forEach(c => { c.addEventListener('mouseenter', () => { if (matchMedia('(hover:hover)').matches) { S.hover = c.dataset.c; } }); c.addEventListener('mouseleave', () => { if (S.hover === c.dataset.c) { S.hover = null; drawCol(c.dataset.c); } }); });
  root.addEventListener('click', e => {
    const t = e.target;
    const cp = t.closest('[data-copy]'); if (cp) { e.stopPropagation(); copy(cp.dataset.copy); return; }
    if (t.closest('a[href]')) return;
    const qb = t.closest('[data-buy]'); if (qb) { buy(qb.dataset.buy, +S.qb); return; }
    const sl = t.closest('[data-sell]'); if (sl) { sell(sl.dataset.sell, +sl.dataset.p); return; }
    const card = t.closest('.tc'); if (card) { openCoin(card.dataset.m); return; }
    const op = t.closest('[data-open]'); if (op) { openCoin(op.dataset.open); return; }
    const x = t.closest('[data-x]'); if (x) { if (x.dataset.x === 'close') closeDrawer(); else connectThen(() => bags()); return; }
    const f = t.closest('[data-f]'); if (f) { S.f[f.dataset.f] = !S.f[f.dataset.f]; f.classList.toggle('on', S.f[f.dataset.f]); store.set('chad:trf', S.f); draw(); return; }
    const q = t.closest('[data-qb]'); if (q) { S.qb = +q.dataset.qb; store.set('chad:qb', S.qb); qbPaint(); draw(); return; }
    const tb = t.closest('[data-tab]'); if (tb) { S.tab = tb.dataset.tab; $$('#trTabs button', root).forEach(b => b.classList.toggle('on', b === tb)); $$('.tr-col', root).forEach(c => c.classList.toggle('on', c.dataset.c === S.tab)); return; }
    const sd = t.closest('[data-side]'); if (sd) { S.side = sd.dataset.side; S.quote = null; box(); return; }
    const am = t.closest('[data-amt]'); if (am) { S.amt = +am.dataset.amt; S.quote = null; box(); return; }
    const sp = t.closest('[data-pct]'); if (sp) { S.sellPct = +sp.dataset.pct; S.quote = null; box(); return; }
    const tf = t.closest('[data-tf]'); if (tf) { S.tf = tf.dataset.tf; $$('#tdTF button').forEach(b => b.classList.toggle('on', b === tf)); market(); return; }
    if (t.closest('#tdGo')) { const s = S.by.get(S.sel); if (!s) return; if (!W.sol.address) return connectThen(() => box()); if (S.side === 'buy') buy(s.mint, +S.amt); else sell(s.mint, S.sellPct); return; }
    if (t.closest('#trW')) { if (W.sol.address) bags(); else connectThen(() => bags()); return; }
    if (t.closest('#trX')) close();
  });
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tc')) { e.preventDefault(); openCoin(e.target.dataset.m); } });
  const q = $('#trQ', root);
  q.addEventListener('input', () => { S.q = q.value; if (!isCA(S.q)) draw(); });
  q.addEventListener('keydown', e => { if (e.key !== 'Enter') return; const v = q.value.trim(); if (!v) return; if (isCA(v)) openCoin(v); else results(v); });
  const c = $('#trQBc', root);
  c.addEventListener('input', () => { const v = parseFloat(c.value.replace(',', '.')); if (v > 0 && v <= 100) { S.qb = +v.toFixed(4); store.set('chad:qb', S.qb); $$('#trQB button').forEach(b => b.classList.toggle('on', +b.dataset.qb === S.qb)); draw(); } });
  root.addEventListener('input', e => { if (e.target.id === 'tdAmt') { const v = parseFloat(e.target.value.replace(',', '.')); S.amt = v > 0 ? +v.toFixed(4) : null; $$('#tdBox [data-amt]').forEach(b => b.classList.toggle('on', +b.dataset.amt === S.amt)); boxInfo(); S.quote = null; paintQ(); quoteSoon(); } });
  on('sol', () => { walletChip(); S.hold = null; if (S.open) holdLoad(); if (S.mode === 'coin') { S.quote = null; box(); } if (S.mode === 'bags') bags(); });
  addEventListener('resize', () => { if (S.mode === 'coin') market(); });
}

// ---------------------------------------------------------------- open, close
export function open() {
  if (html.classList.contains('intro')) return;
  build(); if (S.open) return;
  S.open = true; S.el.root.hidden = false; html.classList.add('trench-open'); const nb = $('#navTrench'); if (nb) { nb.classList.add('on'); nb.setAttribute('aria-pressed', 'true'); }
  $('#modal').hidden = true; const pal = $('#pal'); if (pal) pal.hidden = true;
  if (window.__lenis) window.__lenis.stop();
  if (location.hash !== '#trenches') history.replaceState(null, '', location.pathname + location.search + '#trenches');
  poll(); solPrice(); holdLoad(); status();
  clearInterval(S.tick); S.tick = setInterval(() => { if (document.hidden) return; $$('time[data-t]', S.el.root).forEach(el => { const v = +el.dataset.t; if (v) el.textContent = ago(v); }); status(); }, 1000);
  S.solT = setInterval(solPrice, 120000);
  if (innerWidth > 900) setTimeout(() => { const q = $('#trQ'); if (q && S.open && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) q.focus({ preventScroll: true }); }, 60);
}
export function close() {
  if (!S.open) return;
  S.open = false; S.el.root.hidden = true; html.classList.remove('trench-open'); const nb = $('#navTrench'); if (nb) { nb.classList.remove('on'); nb.setAttribute('aria-pressed', 'false'); }
  clearTimeout(S.timer); clearInterval(S.tick); clearInterval(S.solT); clearTimeout(S.holdT); clearTimeout(S.dT); clearTimeout(S.qT); S.hover = null;
  if (window.__lenis) window.__lenis.start();
  if (location.hash === '#trenches') history.replaceState(null, '', location.pathname + location.search);
}
export const toggle = () => (S.open ? close() : open());
export const isOpen = () => S.open;

export function init() {
  const nb = $('#navTrench'); if (nb) nb.onclick = toggle;
  // Esc: the drawer first, then the trenches (a modal or the palette on top closes on its own)
  addEventListener('keydown', e => {
    if (!S.open) return;
    const modal = !$('#modal').hidden || ($('#pal') && !$('#pal').hidden) || ($('#moreMenu') && !$('#moreMenu').hidden) || ($('#mSheet') && !$('#mSheet').hidden), typing = /input|textarea|select/i.test((document.activeElement || {}).tagName || '');
    if (e.key === 'Escape' && !modal) { e.stopImmediatePropagation(); if (typing) document.activeElement.blur(); else if (S.mode) closeDrawer(); else close(); return; }
    if (e.key === '/' && !typing && !modal && !e.metaKey && !e.ctrlKey) { e.preventDefault(); e.stopImmediatePropagation(); $('#trQ').focus(); }
  }, true);
  // a link to a section of the page closes the trenches first
  document.addEventListener('click', e => { if (S.open && e.target.closest('a[href^="#"]') && !e.target.closest('#trench')) close(); }, true);
  const deep = () => { if (location.hash === '#trenches') { if (html.classList.contains('intro')) setTimeout(deep, 400); else open(); } };
  deep(); addEventListener('hashchange', deep);
  setTimeout(() => W.restoreSol(), 1200);
}
