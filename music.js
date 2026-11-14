// CHAD · the theme. Original, written in code: a sub-heavy swagger walk, then the drop when the shades land
// (a deep boom, a choir that takes itself too seriously, a cowbell riff, 808 slides). It plays on through the site
// at a lower level; the ♪ button in the nav stops it. Pauses while the tab is hidden.
export function createMusic() {
  let ctx = null, bus = null, master = null, crush = null, NB = null, timer = null;
  let step = 0, nextT = 0, section = 'walk', playing = false, dropped = false, level = .5, skipKick = false;
  const BPM = 128, SPB = 60 / BPM / 4;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // four bars, D minor: Dm, Bb, Gm, A
  const ROOT = [38, 34, 31, 33], CHORD = [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]];
  const _ = null;
  const RIFF = [
    [74, _, 74, _, 77, _, 74, 81, _, 79, _, 77, 74, _, 72, _],
    [74, _, 74, _, 77, _, 79, _, 81, _, 79, _, 77, _, 76, _],
    [79, _, 79, _, 82, _, 79, 86, _, 84, _, 82, 79, _, 77, _],
    [81, _, 81, _, 85, _, 81, _, 76, _, 77, _, 79, _, 81, _],
  ];
  const env = (g, t, a, d, peak) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  function noiseHit(t, d, peak, type, f, q = .7, dest = bus) { const s = ctx.createBufferSource(); s.buffer = NB; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); s.connect(fl); fl.connect(g); g.connect(dest); env(g, t, .001, d, peak); s.start(t, Math.random() * .8); s.stop(t + d + .05); }
  function cowbell(t, m, vel = 1) {
    const f = mtof(m), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * 1.3; bp.Q.value = 2.4;
    [1, 1.48].forEach(r => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * r; o.connect(bp); o.start(t); o.stop(t + .3); });
    bp.connect(g); g.connect(bus); env(g, t, .002, .2, .19 * vel);
  }
  function bass(t, m, dur, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = mtof(m); o.type = 'sine';
    o.frequency.setValueAtTime(f * 2.4, t); o.frequency.exponentialRampToValueAtTime(f, t + .055);
    if (slideTo) { o.frequency.setValueAtTime(f, t + dur * .55); o.frequency.exponentialRampToValueAtTime(mtof(slideTo), t + dur * .9); }
    o.connect(g); g.connect(crush); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .008); g.gain.setValueAtTime(.5, t + dur * .75); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.start(t); o.stop(t + dur + .05);
  }
  function kick(t, vel = 1) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + .11); o.connect(g); g.connect(bus); env(g, t, .002, .26, .75 * vel); o.start(t); o.stop(t + .32); }
  function clap(t, vel = 1) { [0, .011, .023].forEach((d, i) => noiseHit(t + d, i < 2 ? .018 : .2, .38 * vel, 'bandpass', 1450, 1.1)); }
  function hat(t, vel = .5, open = false) { noiseHit(t, open ? .16 : .03, .07 * vel, 'highpass', 8200); }
  function snap(t) { noiseHit(t, .05, .12, 'bandpass', 2600, 3); }
  function choir(t, notes, dur, vel = 1) {
    const g = ctx.createGain(), mix = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    g.connect(bus); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.085 * vel, t + .3); g.gain.setValueAtTime(.085 * vel, t + Math.max(.35, dur - .5)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    f1.type = f2.type = 'bandpass'; f1.frequency.value = 760; f2.frequency.value = 1180; f1.Q.value = f2.Q.value = 5; mix.connect(f1); mix.connect(f2); f1.connect(g); f2.connect(g);
    notes.forEach(m => [-9, 0, 8].forEach(dt => { const o = ctx.createOscillator(), v = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt; v.gain.value = .28; o.connect(v); v.connect(mix); o.start(t); o.stop(t + dur + .1); }));
  }
  function boom(t) {                                                    // the drop: a deep hit and two echoes
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(31, t + 1); o.connect(g); g.connect(bus);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(1, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4); o.start(t); o.stop(t + 2.5);
    noiseHit(t, .45, .45, 'lowpass', 900);
    [.2, .42].forEach((d, i) => { const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.frequency.setValueAtTime(82, t + d); o2.frequency.exponentialRampToValueAtTime(33, t + d + .6); o2.connect(g2); g2.connect(bus); env(g2, t + d, .01, .9, .3 / (i + 1.4)); o2.start(t + d); o2.stop(t + d + 1); });
  }
  function play(s, t) {
    const bar = Math.floor(s / 16), st = s % 16, b4 = bar % 4, b8 = bar % 8;
    if (section === 'walk') {                                           // the walk: sub, soft hats, snaps on 2 and 4, a low choir now and then
      if (st === 0) bass(t, ROOT[b4], SPB * 15.5);
      if (st % 2 === 0) hat(t, st % 4 === 0 ? .55 : .35);
      if (st === 4 || st === 12) snap(t);
      if (st === 0 && b4 === 0) choir(t, CHORD[0].map(m => m - 12), SPB * 32, .55);
      return;
    }
    // the drop: half-time kick and clap, hats with rolls, 808 with slides, the cowbell riff, the choir on the one
    if (st === 0 && !skipKick) kick(t); if (st === 0) skipKick = false;
    if (st === 10 || (st === 3 && b8 % 2) || (st === 14 && b4 === 3)) kick(t, .8);
    if (st === 8) clap(t); if (st === 15 && b8 === 7) clap(t, .5);
    const roll = b4 === 3 && st >= 12;
    if (roll) { hat(t, .45); hat(t + SPB / 3, .35); hat(t + SPB * 2 / 3, .4); } else if (st % 2 === 0) hat(t, st % 4 === 2 ? .6 : .4); else if (b8 % 2 && (st === 7 || st === 15)) hat(t, .3);
    if (st === 0) bass(t, ROOT[b4], SPB * (b4 === 1 ? 9 : 15), b4 === 3 ? ROOT[0] + 12 : null);
    if (st === 10 && b4 === 1) bass(t, ROOT[b4] + 12, SPB * 5, ROOT[b4]);
    const n = RIFF[b4][st]; if (n != null && !(b8 >= 4 && b4 === 3 && st > 8)) cowbell(t, n, st % 4 === 0 ? 1 : .8);
    if (st === 0 && b4 === 0) choir(t, CHORD[0], SPB * 28, .8);
    if (st === 0 && b4 === 2 && b8 === 6) choir(t, CHORD[2], SPB * 28, .6);
  }
  function sched() { if (!ctx) return; while (nextT < ctx.currentTime + .16) { play(step, nextT); step++; nextT += SPB; } }
  const vis = () => { if (!ctx || !playing) return; if (document.hidden) { clearInterval(timer); timer = null; ctx.suspend(); } else { ctx.resume().then(() => { nextT = ctx.currentTime + .05; if (!timer) timer = setInterval(sched, 25); }); } };
  async function boot() {
    if (ctx) { if (ctx.state === 'suspended') try { await ctx.resume(); } catch {} return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    bus = ctx.createGain(); bus.gain.value = .9; bus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    crush = ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * 2.2) * .8; } crush.curve = c; crush.connect(bus);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; NB = buf;
    document.addEventListener('visibilitychange', vis);
    try { await ctx.resume(); } catch {}
  }
  const ramp = (v, sec = .6) => { if (!ctx) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); };
  return {
    get playing() { return playing; }, get dropped() { return dropped; },
    async start({ drop = false, vol } = {}) {
      if (vol != null) level = vol;
      await boot(); if (playing) { ramp(level); return; }
      playing = true; step = 0; nextT = ctx.currentTime + .08; section = 'walk'; dropped = false;
      ramp(level, .8); if (!timer) timer = setInterval(sched, 25);
      if (drop) this.drop();
    },
    unlock() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    drop() {
      if (!ctx || !playing || dropped) return;
      dropped = true; const t = ctx.currentTime + .03; boom(t); choir(t, CHORD[0], 2.6, 1.1);
      section = 'main'; step = 0; nextT = t; skipKick = true;
    },
    level(v, sec = 1.2) { level = v; if (playing) ramp(v, sec); },
    stop() { if (!ctx || !playing) return; playing = false; ramp(0, .5); setTimeout(() => { if (!playing) { clearInterval(timer); timer = null; ctx.suspend().catch(() => {}); } }, 650); },
  };
}
