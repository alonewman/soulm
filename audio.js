'use strict';
// ===== ÁUDIO sintetizado (WebAudio) =====
const AU = { v: 1, ctx: null, master: null, nb: null, drone: null, hum: null, on: true };

function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    const c = AU.ctx = new C();
    AU.master = c.createGain(); AU.master.gain.value = 0.85; AU.master.connect(c.destination);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.nb = b;
    // drone grave
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = 43; o2.type = 'sine'; o2.frequency.value = 86.7;
    f.type = 'lowpass'; f.frequency.value = 170; g.gain.value = 0.06;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(AU.master); o1.start(); o2.start();
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 0.09; lg.gain.value = 70;
    l.connect(lg); lg.connect(f.frequency); l.start();
    AU.drone = { o1, o2, g, f };
    // zumbido de proximidade do objetivo (backrooms)
    const h = c.createOscillator(), h2 = c.createOscillator(), hg = c.createGain(), hf = c.createBiquadFilter();
    h.type = 'sawtooth'; h.frequency.value = 118; h2.type = 'sawtooth'; h2.frequency.value = 119.6;
    hf.type = 'lowpass'; hf.frequency.value = 420; hg.gain.value = 0;
    h.connect(hf); h2.connect(hf); hf.connect(hg); hg.connect(AU.master); h.start(); h2.start();
    AU.hum = { h, h2, hg, hf };
  } catch (e) { AU.ctx = null; }
}

function noise(dur, f0, f1, vol, type, q, delay) {
  if (!AU.ctx) return;
  const c = AU.ctx, t = c.currentTime + (delay || 0);
  const s = c.createBufferSource(); s.buffer = AU.nb; s.loop = true;
  const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol * AU.v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(f0, f1, dur, vol, type, delay) {
  if (!AU.ctx) return;
  const c = AU.ctx, t = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol * AU.v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
}

const SFX = {
  shoot() { noise(0.32, 3800, 140, 0.9, 'lowpass', 0.7); noise(0.07, 7000, 1500, 0.5, 'highpass', 0.5); tone(160, 45, 0.18, 0.5, 'square'); },
  click() { noise(0.04, 2800, 1800, 0.35, 'bandpass', 2); },
  reload() { noise(0.05, 2400, 1600, 0.4, 'bandpass', 3); noise(0.06, 1800, 900, 0.4, 'bandpass', 3, 0.5); noise(0.07, 2600, 1400, 0.45, 'bandpass', 3, 1.05); noise(0.05, 1500, 900, 0.5, 'bandpass', 3, 1.3); },
  step(run) { noise(0.09, run ? 520 : 330, 120, run ? 0.34 : 0.18, 'lowpass', 1); },
  splash() { noise(0.16, 1600, 400, 0.12, 'bandpass', 1.2); },
  door() { tone(70, 150, 0.7, 0.14, 'sawtooth'); noise(0.7, 900, 300, 0.1, 'bandpass', 6); },
  hurt() { noise(0.25, 900, 120, 0.7, 'lowpass', 1); tone(220, 70, 0.3, 0.3, 'sawtooth'); },
  growl(big) { const b = big ? 0.6 : 1; tone(120 * b, 55 * b, 0.55, 0.22, 'sawtooth'); noise(0.5, 700, 200, 0.14, 'bandpass', 4); },
  shriek() { tone(900, 380, 0.4, 0.12, 'sawtooth'); tone(1300, 500, 0.4, 0.07, 'square'); },
  hit() { noise(0.08, 1400, 300, 0.35, 'lowpass', 1); },
  die() { tone(160, 40, 0.6, 0.3, 'sawtooth'); noise(0.5, 600, 90, 0.25, 'lowpass', 1); },
  pick() { tone(660, 990, 0.12, 0.2, 'triangle'); tone(990, 1320, 0.2, 0.16, 'triangle', 0.1); },
  key() { tone(520, 780, 0.15, 0.22, 'triangle'); tone(780, 1170, 0.2, 0.2, 'triangle', 0.12); tone(1170, 1560, 0.35, 0.18, 'triangle', 0.26); },
  note() { noise(0.2, 2400, 900, 0.18, 'bandpass', 1); },
  candle() { noise(0.4, 500, 1200, 0.16, 'bandpass', 2); tone(330, 440, 0.8, 0.1, 'sine'); },
  heart() { tone(62, 40, 0.14, 0.5, 'sine'); tone(55, 36, 0.16, 0.4, 'sine', 0.2); },
  portal() { tone(300, 40, 0.9, 0.22, 'sawtooth'); noise(0.9, 2000, 80, 0.2, 'lowpass', 1); },
  roar() { tone(95, 38, 1.4, 0.45, 'sawtooth'); tone(140, 50, 1.2, 0.25, 'square'); noise(1.3, 900, 120, 0.35, 'lowpass', 1); },
  fire() { noise(0.5, 2200, 500, 0.3, 'bandpass', 1.5); tone(240, 120, 0.4, 0.15, 'sawtooth'); },
  boom() { noise(0.6, 900, 60, 0.7, 'lowpass', 1); tone(90, 30, 0.5, 0.5, 'sine'); },
  knife() { noise(0.12, 3000, 900, 0.25, 'highpass', 1); },
  open() { tone(110, 330, 1.2, 0.3, 'sine'); tone(165, 495, 1.2, 0.2, 'triangle'); noise(1.2, 400, 1800, 0.12, 'bandpass', 2); },
  win() { tone(330, 330, 0.8, 0.18, 'triangle'); tone(415, 415, 0.8, 0.16, 'triangle', 0.25); tone(495, 495, 1.4, 0.16, 'triangle', 0.5); tone(660, 660, 2, 0.14, 'triangle', 0.8); },
};

// zumbido: 0 longe .. 1 perto do objetivo; muda o tom do drone com o medo
function audioUpdate(prox, fear) {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  AU.hum.hg.gain.setTargetAtTime(0.018 + prox * 0.1, t, 0.2);
  AU.hum.h.frequency.setTargetAtTime(110 + prox * 40, t, 0.4);
  AU.hum.h2.frequency.setTargetAtTime(111.6 + prox * 40 + fear * 3, t, 0.4);
  AU.hum.hf.frequency.setTargetAtTime(300 + prox * 900, t, 0.3);
  AU.drone.g.gain.setTargetAtTime(0.05 + fear * 0.07, t, 0.5);
  AU.drone.f.frequency.setTargetAtTime(150 + fear * 160, t, 0.5);
}
