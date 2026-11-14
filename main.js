// CHAD · boot: the wordless intro film, nav, wallet, settings, then the desk and the page
import { $, $$, on, esc, reduced, store, short, toast, CONFIG, copy } from './core.js';
import { smooth, scrollTo, revealAll, gsap, ScrollTrigger } from './motion.js';
import * as api from './api.js';
import * as W from './wallet.js';
import * as desk from './desk.js';
import * as sections from './sections.js';
import * as T from './tools.js';

const html = document.documentElement;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const soundOn = () => store.get('chad:sound', true) !== false;
html.classList.toggle('muted', !soundOn());

// ---------------------------------------------------------------- the intro: up the tower, through the panic, into his aviators
let AUD = null;
const introDone = new Promise(res => {
  const el = $('#intro'), cv = $('#introCv');
  const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  const force = /[?&]intro\b/.test(location.search);
  const skip = /[?&]nointro\b/.test(location.search) || (!force && W.settings().intro === false) || reduced() || !webgl;
  let done = false, ctrl = null;
  const end = () => { if (done) return; done = true; html.classList.remove('intro'); if (AUD) AUD.fade(1.4); res(); setTimeout(() => el.remove(), 1300); };
  if (skip || !cv) return end();
  import('./audio.js?v=1').then(m => { AUD = m.createAudio(); if (AUD && soundOn()) AUD.begin().then(() => { if (!AUD.running) $('#introSnd').classList.add('pulse'); }); }).catch(() => {});
  const sb = $('#introSnd');
  sb.addEventListener('pointerdown', e => e.stopPropagation());
  sb.addEventListener('click', e => { e.stopPropagation(); sb.classList.remove('pulse'); const v = !(soundOn() && AUD && AUD.running); store.set('chad:sound', v); html.classList.toggle('muted', !v); if (AUD) v ? AUD.begin() : AUD.mute(); });
  el.addEventListener('pointerdown', () => { if (AUD && soundOn() && !AUD.running) { AUD.begin(); sb.classList.remove('pulse'); return; } ctrl && ctrl.skip(); });
  addEventListener('keydown', e => { if (!done && /Escape|Enter| /.test(e.key)) ctrl && ctrl.skip(); });
  import('./intro3d.js?v=1').then(async m => { ctrl = await m.run({ canvas: cv, face: '/favicon-192.png?v=1', onDone: end, audio: AUD ? AUD.hooks() : null, getAudio: () => AUD }); }).catch(e => { console.error(e); end(); });
  setTimeout(end, 30000);                                       // never hold the page hostage
});

// ---------------------------------------------------------------- nav, phone sheet, X, CA
addEventListener('scroll', () => $('#nav').classList.toggle('solid', scrollY > 20), { passive: true });
const mb = $('#menuBtn'), ms = $('#mSheet');
mb.addEventListener('click', () => { ms.hidden = !ms.hidden; mb.setAttribute('aria-expanded', String(!ms.hidden)); });
ms.addEventListener('click', e => { if (e.target.closest('a')) ms.hidden = true; const b = e.target.closest('button[data-act]'); if (b) { ms.hidden = true; tools[b.dataset.act](); } });
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const id = a.getAttribute('href'); if (id.length < 2 || !$(id)) return;
  e.preventDefault(); scrollTo(id === '#top' || id === '#desk' ? 0 : id, { offset: -10 });
});
if (CONFIG.x) { const x = $('#navX'); x.hidden = false; x.href = /^https?:/.test(CONFIG.x) ? CONFIG.x : 'https://x.com/' + CONFIG.x.replace(/^@/, ''); }
if (CONFIG.ca) {
  $('#caBox').hidden = false; $('#caTxt').textContent = CONFIG.ca;
  $('#caCopy').onclick = () => copy(CONFIG.ca);
  $('#caBuy').href = 'https://pump.fun/coin/' + CONFIG.ca; $('#caChart').href = 'https://dexscreener.com/solana/' + CONFIG.ca;
}

// ---------------------------------------------------------------- wallet
const panel = (title, body, bind) => T.panel(title, body, bind);
export function openWallets() {
  const draw = () => {
    const ew = W.evm.list.length ? W.evm.list : (W.legacyEvm() ? [{ info: { uuid: 'legacy', name: 'Browser wallet', icon: '' } }] : []), ag = W.agent();
    const brand = d => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
    panel('Connect', `<div class="m-sec"><span>EVM wallet · your Hyperliquid account</span>
      ${W.evm.address ? `<button class="wbtn on" data-a="off" type="button">${W.evm.icon ? `<img src="${esc(W.evm.icon)}" alt="">` : ''}<b>${esc(W.evm.name)}</b><em>${short(W.evm.address)} · disconnect</em></button>
        ${ag ? `<button class="wbtn on" data-a="agent-off" type="button"><b>Session key</b><em>${short(ag.address)} · forget</em></button>` : `<button class="wbtn" data-a="agent" type="button"><b>Approve session key</b><em>one signature</em></button>`}`
        : ew.length ? ew.map(d => `<button class="wbtn" data-evm="${esc(d.info.uuid)}" type="button">${d.info.icon ? `<img src="${esc(d.info.icon)}" alt="">` : ''}<b>${esc(d.info.name)}</b><em>connect</em></button>`).join('')
        : [['phantom.com', 'Phantom', 'https://phantom.com/download'], ['metamask.io', 'MetaMask', 'https://metamask.io/download'], ['rabby.io', 'Rabby', 'https://rabby.io']].map(([d, n, u]) => `<a class="wbtn" href="${u}" target="_blank" rel="noopener"><img src="${brand(d)}" alt=""><b>${n}</b><em>install ↗</em></a>`).join('')}
      <a class="wbtn" href="https://app.hyperliquid.xyz/trade" target="_blank" rel="noopener"><img src="${brand('hyperliquid.xyz')}" alt=""><b>Deposit USDC on Hyperliquid</b><em>↗</em></a></div>
      <p class="m-note">The session key can place and cancel orders on your Hyperliquid account. It can never withdraw. It lives in this browser only.</p>`, b => {
      b.onclick = async e => {
        const t = e.target.closest('button'); if (!t) return;
        try {
          if (t.dataset.evm) { t.querySelector('em').textContent = 'check your wallet'; await W.connectEvm(t.dataset.evm); toast('Wallet connected', 'ok', 3000); }
          else if (t.dataset.a === 'off') W.disconnectEvm();
          else if (t.dataset.a === 'agent') { t.querySelector('em').textContent = 'sign in your wallet'; await W.approveAgent(); toast('Session key approved. Copies now sign without popups.', 'ok'); }
          else if (t.dataset.a === 'agent-off') W.forgetAgent();
        } catch (err) { toast(esc(err.message || String(err)), 'err'); }
        draw();
      };
    });
  };
  draw();
}
window.__wallets = openWallets;
$('#mClose').onclick = () => { $('#modal').hidden = true; };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.currentTarget.hidden = true; });
$('#connectBtn').onclick = () => openWallets();
const navW = () => { const b = $('#connectBtn'); b.classList.toggle('on', !!W.evm.address); b.querySelector('span').textContent = W.evm.address ? short(W.evm.address) : 'Connect'; };
on('evm', navW);
setTimeout(() => {   // quiet reconnect of the wallet this browser used before
  const e = store.get('chad:evm'); if (!e) return;
  const d = W.evm.list.find(x => x.info.uuid === e), p = d ? d.provider : W.legacyEvm();
  if (p) p.request({ method: 'eth_accounts' }).then(a => { if (a && a[0]) W.connectEvm(d ? e : 'legacy').catch(() => {}); }).catch(() => {});
}, 900);

// ---------------------------------------------------------------- tools: search, markets, compare, share, alerts, your account, keys, settings, replay, sound
const tools = {
  find: () => T.palette(), markets: () => T.markets(), compare: () => T.compare(), share: () => T.share(), alerts: () => T.alerts(), csv: () => T.exportCsv(), liqs: () => T.liqs(), watch: () => T.watch(), sizer: () => T.sizer(), roll: () => T.roll('chads'), tape: () => T.tape(), focus: () => T.focus(),
  mine: () => scrollTo('#mine', { offset: -80 }),
  keys: () => panel('Keyboard shortcuts', `<div class="keys">${[['⌘K', 'Search everything'], ['/', 'Search everything'], ['M', 'Markets'], ['H', 'Compare traders'], ['S', 'Share card'], ['A', 'Alerts'], ['L', 'Liquidation watch'], ['W', 'Watchlist'], ['Z', 'Position sizer'], ['R', 'Random chad'], ['E', 'Export the board'], ['T', 'Tail mode'], ['F', 'Fade mode'], ['C', 'Chads board'], ['V', 'Virgins board'], ['?', 'This list'], ['Esc', 'Close any panel']].map(([k, d]) => `<div><span class="kbd">${esc(k)}</span><b>${esc(d)}</b></div>`).join('')}</div>`),
  settings: () => {
    const s = W.settings();
    const seg = (k, opts) => `<div class="seg seg-sm set-seg" data-k="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(s[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    panel('Settings', `<div class="m-sec"><span>Market order slippage</span>${seg('slip', [[.01, '1%'], [.03, '3%'], [.05, '5%'], [.1, '10%']])}</div>
      <div class="m-sec"><span>Follow mode checks every</span>${seg('every', [[10, '10s'], [15, '15s'], [30, '30s'], [60, '60s']])}</div>
      <div class="m-sec"><span>Intro on load</span>${seg('intro', [[true, 'Play'], [false, 'Skip']])}</div>
      <div class="m-sec"><span>Sound</span><div class="seg seg-sm set-seg" data-k="sound"><button type="button" data-v="true" class="${soundOn() ? 'on' : ''}">On</button><button type="button" data-v="false" class="${soundOn() ? '' : 'on'}">Off</button></div></div>`, b => {
      b.onclick = e => {
        const btn = e.target.closest('.set-seg button'); if (!btn) return;
        const k = btn.parentElement.dataset.k, raw = btn.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : +raw;
        if (k === 'sound') { store.set('chad:sound', v); html.classList.toggle('muted', !v); }
        else { const cur = W.settings(); cur[k] = v; store.set('chad:set', cur); if (k === 'every') $('#cEvery').textContent = v; }
        $$('button', btn.parentElement).forEach(x => x.classList.toggle('on', x === btn));
      };
    });
  },
  replay: () => { location.href = location.pathname + '?intro'; },
  sound: () => { const v = !soundOn(); store.set('chad:sound', v); html.classList.toggle('muted', !v); toast(v ? 'Sound on for the intro.' : 'Sound off.', '', 2200); },
};
$('#navMine').onclick = tools.mine; $('#navSet').onclick = tools.settings;
T.init({ mine: tools.mine, settings: tools.settings, keys: tools.keys, replay: tools.replay, sound: tools.sound });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#modal').hidden = true; return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); T.palette(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test((document.activeElement || {}).tagName || '') || html.classList.contains('intro')) return;
  const k = e.key.toLowerCase();
  if (e.key === '/') { e.preventDefault(); tools.find(); }
  else if (e.key === '?') tools.keys();
  else if (T.keys[k] && k !== 'k' && $('#pal').hidden) T.keys[k]();
  else if (k === 't' && window.__chad) window.__chad.mode('tail');
  else if (k === 'f' && window.__chad) window.__chad.mode('fade');
  else if (k === 'c') $('#bTabs button[data-b=chads]').click();
  else if (k === 'v') $('#bTabs button[data-b=virgins]').click();
});

// ---------------------------------------------------------------- boot
smooth();
if (html.classList.contains('intro') && window.__lenis) window.__lenis.stop();
desk.init(); sections.init();
api.loadPerps().catch(() => {}); setInterval(() => api.loadPerps().catch(() => {}), 30000);
api.live();
const board = () => api.loadBoard().catch(() => { $('#bRows').innerHTML = '<p class="empty mono">Could not read Hyperliquid\'s leaderboard. Retrying…</p>'; setTimeout(board, 15000); });
board(); setInterval(board, 5 * 60000);

introDone.then(() => {
  if (window.__lenis) window.__lenis.start();
  window.scrollTo(0, 0);
  if (!reduced()) {
    gsap.from('.term', { y: 28, opacity: 0, scale: .985, duration: 1.1, ease: 'expo.out' });
    gsap.from('.tape', { y: -10, opacity: 0, duration: .8, ease: 'power3.out', delay: .1 });
    gsap.from('.mine', { y: 20, opacity: 0, duration: .9, ease: 'power3.out', delay: .25 });
  }
  revealAll();
  setTimeout(() => ScrollTrigger.refresh(), 800);
});
