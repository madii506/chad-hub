// CHAD · the intro's sound, synthesized: an elevator hum and a ding, then a slow, sure beat across the trading floor,
// a warm chord at the window, a click of the shades and a rise into the lens. Starts quiet; one tap mutes it.
export function createAudio() {
  let ctx = null, out = null, running = false, beat = null, pad = null;
  const now = () => ctx.currentTime;
  const env = (g, t, a, d, peak) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  const noise = (len = 1) => { const b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  let NB = null;
  const tone = (f, t, d, peak, type = 'sine', dest = out) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(dest); env(g, t, .005, d, peak); o.start(t); o.stop(t + d + .05); return o; };
  const burst = (t, d, peak, hp = 0, lp = 0, dest = out) => { const s = ctx.createBufferSource(); s.buffer = NB; let n = s; if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; n.connect(f); n = f; } if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n.connect(f); n = f; } const g = ctx.createGain(); n.connect(g); g.connect(dest); env(g, t, .002, d, peak); s.start(t); s.stop(t + d + .05); };
  const kick = t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .16); o.connect(g); g.connect(out); env(g, t, .004, .32, .9); o.start(t); o.stop(t + .4); };
  const bass = (f, t, d) => { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(140, t + d); o.connect(lp); lp.connect(g); g.connect(out); env(g, t, .01, d, .22); o.start(t); o.stop(t + d + .05); };
  const BPM = 92, B = 60 / BPM;
  function startBeat() {
    if (beat) return; let next = now() + .05, n = 0;
    const roots = [55, 55, 49, 61.74];
    beat = setInterval(() => {
      while (next < now() + .25) {
        const bar = Math.floor(n / 8) % 4, s = n % 8;
        if (s === 0 || s === 4 || s === 6 && bar % 2) kick(next);
        if (s === 2 || s === 6) burst(next, .14, .16, 1400, 6000);
        burst(next + B / 4, .03, .045, 7000);
        if (s % 2 === 0) bass(roots[bar], next, B * .9);
        next += B / 2; n++;
      }
    }, 60);
  }
  function stopBeat() { if (beat) { clearInterval(beat); beat = null; } }
  function chord() {
    const t = now(), g = ctx.createGain(); g.connect(out); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.09, t + 1.2); g.gain.exponentialRampToValueAtTime(.0001, t + 6);
    [220, 277.18, 329.63, 415.3].forEach(f => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 8; o.connect(g); o.start(t); o.stop(t + 6.2); });
    pad = g;
  }
  return {
    get running() { return running; },
    async begin() {
      try {
        if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = .55; out.connect(ctx.destination); NB = noise(1.5);
          const hum = ctx.createOscillator(), hg = ctx.createGain(); hum.frequency.value = 58; hum.connect(hg); hg.connect(out); hg.gain.setValueAtTime(.0001, now()); hg.gain.exponentialRampToValueAtTime(.05, now() + .6); hg.gain.exponentialRampToValueAtTime(.0001, now() + 3.2); hum.start(); hum.stop(now() + 3.4); }
        if (ctx.state !== 'running') await ctx.resume();
        running = ctx.state === 'running';
      } catch { running = false; }
    },
    hooks() {
      return {
        ding: () => { if (!running) return; const t = now(); tone(1046.5, t, 1.4, .12); tone(1318.5, t + .02, 1.6, .09); tone(2093, t, .5, .03); },
        doors: () => { if (!running) return; burst(now(), .7, .08, 300, 2400); startBeat(); },
        step: k => { if (!running) return; burst(now(), .05, .05 * (k || 1), 800, 3000); },
        sit: () => { if (!running) return; stopBeat(); chord(); burst(now(), .5, .05, 600, 3000); },
        shades: () => { if (!running) return; const t = now(); tone(2600, t, .05, .06, 'square'); tone(3400, t + .03, .05, .04, 'square'); },
        dive: () => { if (!running) return; const t = now(), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = NB; f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + 1.1); s.connect(f); f.connect(g); g.connect(out); env(g, t, .9, .4, .14); s.start(t); s.stop(t + 1.4); kick(t + 1.15); },
      };
    },
    fade(sec = 1.2) { stopBeat(); if (!ctx || !out) return; const t = now(); out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + sec); setTimeout(() => { try { ctx.close(); } catch {} }, sec * 1000 + 200); },
    mute() { stopBeat(); if (out) out.gain.value = 0; running = false; },
  };
}
