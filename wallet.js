// CHAD · your wallets. EVM for Hyperliquid: nothing here ever sees your wallet's key; the wallet signs typed data once to approve
// a session key born in this browser, and that key signs orders. On Hyperliquid an approved agent can trade, never withdraw.
// Solana for the trenches, through Wallet Standard (Phantom, Solflare, Backpack...): every swap is built by Jupiter for your
// address and signed in your wallet. CHAD never holds a key or a coin of yours.
import { emit, store, b64e, b64d } from './core.js';
import * as api from './api.js';
import * as H from './vendor-hl.js?v=1';

// ---------------------------------------------------------------- Solana
export const sol = { list: [], w: null, account: null, address: null };
const reg = (...ws) => {
  for (const w of ws) {
    if (!w || !w.features || !w.features['solana:signTransaction'] || !w.features['standard:connect']) continue;
    if (!(w.chains || []).some(c => String(c).startsWith('solana:'))) continue;
    if (!sol.list.find(x => x.name === w.name)) sol.list.push(w);
  }
  emit('wallets');
  return () => {};
};
const WS_API = Object.freeze({ register: reg });
try {
  window.addEventListener('wallet-standard:register-wallet', e => { try { e.detail(WS_API); } catch {} });
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: WS_API }));
} catch {}
const useAcc = (w, acc) => {
  sol.w = w; sol.account = acc; sol.address = acc.address; store.set('chad:sol', w.name);
  if (w.features['standard:events'] && !w.__chad) { w.__chad = 1; w.features['standard:events'].on('change', ({ accounts }) => { if (sol.w === w && accounts && accounts[0] && accounts[0].address !== sol.address) { sol.account = accounts[0]; sol.address = accounts[0].address; emit('sol'); } }); }
  emit('sol');
};
export async function connectSol(name) {
  const w = sol.list.find(x => x.name === name) || sol.list[0];
  if (!w) throw new Error('No Solana wallet found. Install Phantom, Solflare or Backpack.');
  const r = await w.features['standard:connect'].connect();
  const acc = (r && r.accounts && r.accounts[0]) || w.accounts[0];
  if (!acc) throw new Error('The wallet returned no account.');
  useAcc(w, acc);
  return sol.address;
}
// the wallet this browser used before, without a popup (wallets that allow a silent connect only)
export async function restoreSol() {
  const n = store.get('chad:sol'); if (!n || sol.address) return;
  const w = sol.list.find(x => x.name === n); if (!w) return;
  try { const r = await w.features['standard:connect'].connect({ silent: true }); const acc = (r && r.accounts && r.accounts[0]) || w.accounts[0]; if (acc) useAcc(w, acc); } catch {}
}
export async function disconnectSol() { try { sol.w && sol.w.features['standard:disconnect'] && await sol.w.features['standard:disconnect'].disconnect(); } catch {} sol.w = sol.account = sol.address = null; store.del('chad:sol'); emit('sol'); }
export async function signSol(txB64) {
  if (!sol.w || !sol.account) throw new Error('Connect a Solana wallet first.');
  const f = sol.w.features['solana:signTransaction'];
  const chain = (sol.account.chains || []).find(c => c === 'solana:mainnet') || 'solana:mainnet';
  const [res] = await f.signTransaction({ account: sol.account, transaction: b64d(txB64), chain });
  return b64e(res.signedTransaction);
}
// one swap through Jupiter Ultra: an order built for this wallet, signed in the wallet, landed by Jupiter, which reports back
export async function swap({ inputMint, outputMint, amount }) {
  if (!sol.address) throw new Error('Connect a Solana wallet first.');
  const o = await api.order({ inputMint, outputMint, amount: String(amount), taker: sol.address });
  if (!o.transaction) throw new Error(o.errorMessage || o.error || 'No route for this trade right now.');
  const signed = await signSol(o.transaction);
  const r = await api.execute(signed, o.requestId);
  if (r.status !== 'Success') throw Object.assign(new Error(r.error || 'The swap failed onchain.'), { sig: r.signature });
  return { sig: r.signature, inAmt: r.inputAmountResult || o.inAmount, outAmt: r.outputAmountResult || o.outAmount, order: o };
}

// ---------------------------------------------------------------- EVM (Hyperliquid)
export const evm = { list: [], p: null, name: null, icon: null, address: null, chainId: null };
try {
  window.addEventListener('eip6963:announceProvider', e => {
    const d = e.detail; if (!d || !d.provider || !d.info) return;
    if (!evm.list.find(x => x.info.uuid === d.info.uuid)) evm.list.push(d);
    emit('wallets');
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
} catch {}
export const legacyEvm = () => (typeof window.ethereum !== 'undefined' ? window.ethereum : null);
export async function connectEvm(uuid) {
  const d = evm.list.find(x => x.info.uuid === uuid) || evm.list[0];
  const p = d ? d.provider : legacyEvm();
  if (!p) throw new Error('No EVM wallet found. Phantom, MetaMask or Rabby all work.');
  const accs = await p.request({ method: 'eth_requestAccounts' });
  if (!accs || !accs[0]) throw new Error('The wallet returned no account.');
  evm.p = p; evm.name = d ? d.info.name : 'Wallet'; evm.icon = d ? d.info.icon : null; evm.address = accs[0].toLowerCase();
  evm.chainId = await p.request({ method: 'eth_chainId' });
  store.set('chad:evm', d ? d.info.uuid : 'legacy');
  try { p.on && p.on('accountsChanged', a => { evm.address = a && a[0] ? a[0].toLowerCase() : null; emit('evm'); }); p.on && p.on('chainChanged', c => { evm.chainId = c; }); } catch {}
  emit('evm');
  return evm.address;
}
export function disconnectEvm() { evm.p = evm.address = null; store.del('chad:evm'); emit('evm'); }
async function freshChain() { evm.chainId = await evm.p.request({ method: 'eth_chainId' }).catch(() => evm.chainId); return evm.chainId; }
const signTyped = typed => evm.p.request({ method: 'eth_signTypedData_v4', params: [evm.address, JSON.stringify(typed)] });

// ---------------------------------------------------------------- the session key
let lastNonce = 0;
const nonce = () => { const n = Math.max(Date.now(), lastNonce + 1); lastNonce = n; return n; };
const agentKey = () => 'chad:agent:' + evm.address;
export const agent = () => (evm.address ? store.get(agentKey()) : null);
export function forgetAgent() { if (evm.address) store.del(agentKey()); emit('evm'); }
async function post(action, signature, n) {
  const r = await fetch(api.HL + '/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, nonce: n, signature, vaultAddress: null }) });
  const d = await r.json().catch(() => ({ status: 'err', response: 'HTTP ' + r.status }));
  if (d.status !== 'ok') throw new Error(typeof d.response === 'string' ? d.response : JSON.stringify(d.response));
  return d.response;
}
export async function approveAgent() {
  if (!evm.address) throw new Error('Connect an EVM wallet first.');
  const cid = await freshChain(), k = H.newKey(), n = nonce();
  const { action, typed } = H.approveAgent(k.address, 'chad', n, cid);
  const sig = await signTyped(typed);
  await post(action, H.splitSig(sig), n);
  store.set(agentKey(), { priv: k.priv, address: k.address, at: Date.now() });
  emit('evm');
  return k.address;
}
async function l1(action) {
  const a = agent(); if (!a) throw new Error('Approve the CHAD session key first.');
  const n = nonce();
  try { return await post(action, H.signL1(a.priv, action, n), n); }
  catch (e) { if (/does not exist|not authorized|agent/i.test(e.message)) { forgetAgent(); throw new Error('Your session key expired. Approve it again.'); } throw e; }
}
const first = res => { const st = res && res.data && res.data.statuses && res.data.statuses[0]; if (st && st.error) throw new Error(st.error); return st; };

// ---------------------------------------------------------------- orders
export const settings = () => ({ slip: .03, lev: 5, copyPct: 100, maxUsd: 1000, every: 15, intro: true, ...store.get('chad:set', {}) });
export async function setLeverage(p, lev, cross = true) { return l1(H.leverageAction(p.asset, Math.max(1, Math.min(Math.round(lev), p.maxLev)), cross && !p.onlyIso)); }
// a market order = an IOC limit a few % through the mid, Hyperliquid style
export async function marketOrder(p, isBuy, size, { reduceOnly = false, lev = null, slip = settings().slip } = {}) {
  if (lev) await setLeverage(p, lev);
  const mid = api.mids[p.name] || p.mid || p.mark;
  const sz = H.szRound(size, p.szDec);
  if (!(sz > 0)) throw new Error(`${p.name}: that size rounds to zero.`);
  const st = first(await l1(H.orderAction(p.asset, isBuy, H.pxRound(mid * (isBuy ? 1 + slip : 1 - slip), p.szDec), sz, reduceOnly)));
  return st && (st.filled || st.resting) || st;
}
export async function limitOrder(p, isBuy, size, price, { reduceOnly = false, lev = null } = {}) {
  if (lev) await setLeverage(p, lev);
  const sz = H.szRound(size, p.szDec); if (!(sz > 0)) throw new Error(`${p.name}: that size rounds to zero.`);
  const st = first(await l1(H.orderAction(p.asset, isBuy, H.pxRound(price, p.szDec), sz, reduceOnly, 'Gtc')));
  return st && (st.resting || st.filled) || st;
}
export async function tpsl(p, szi, tp, sl) {
  const close = szi < 0, sz = Math.abs(szi), out = [];
  for (const [px, kind] of [[tp, 'tp'], [sl, 'sl']]) {
    if (!(px > 0)) continue;
    first(await l1(H.triggerAction(p.asset, close, H.pxRound(px * (close ? 1.1 : .9), p.szDec), H.szRound(sz, p.szDec), H.pxRound(px, p.szDec), kind)));
    out.push(kind);
  }
  return out;
}
export async function cancelAll(orders, by) {
  const cancels = orders.map(o => ({ a: by[o.coin] && by[o.coin].asset, o: o.oid })).filter(c => c.a != null);
  if (!cancels.length) return null;
  return l1({ type: 'cancel', cancels });
}
export async function moveToPerps(amount) {
  const cid = await freshChain(), n = nonce();
  const { action, typed } = H.usdClassTransfer(String(amount), true, n, cid);
  return post(action, H.splitSig(await signTyped(typed)), n);
}
