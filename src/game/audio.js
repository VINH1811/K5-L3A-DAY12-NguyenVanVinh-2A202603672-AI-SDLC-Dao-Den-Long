// Âm thanh tổng hợp bằng WebAudio (tự tạo, không dùng file ngoài).
export function makeAudio() {
  let ctx = null, master = null, music = null, sfx = null, musicOn = false;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  let noteIx = 0;
  let volume = 0.8;

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    music = ctx.createGain(); music.gain.value = 0.0; music.connect(comp);
    sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(comp);
    // vang nhẹ
    const delay = ctx.createDelay(); delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.25;
    sfx.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
    return ctx;
  }

  function tone(freq, { type = 'sine', dur = 0.4, gain = 0.25, attack = 0.005, at = 0, slide = 0, dest = sfx } = {}) {
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, { gain = 0.2, freq = 800, q = 1, type = 'bandpass', slide = 1, at = 0 } = {}) {
    const t0 = ctx.currentTime + at;
    const len = Math.ceil(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfx);
    src.start(t0);
  }
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function startMusic() {
    if (musicOn) return;
    musicOn = true;
    // nền: hợp âm pad chậm + gió
    const chords = [[57, 64, 69, 72], [53, 60, 65, 69], [55, 62, 67, 71], [52, 59, 64, 67]];
    let ci = 0;
    const playChord = () => {
      if (!musicOn) return;
      for (const n of chords[ci % chords.length]) {
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = midi(n - 12); o.detune.value = det;
          f.type = 'lowpass'; f.frequency.value = 520;
          const t0 = ctx.currentTime;
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.018, t0 + 2.5); g.gain.linearRampToValueAtTime(0, t0 + 8.5);
          o.connect(f); f.connect(g); g.connect(music);
          o.start(t0); o.stop(t0 + 9);
        }
      }
      // giai điệu đàn bầu mơ hồ
      const scale = [69, 72, 74, 76, 79, 81];
      for (let k = 0; k < 3; k++) if (Math.random() < 0.7) tone(midi(scale[Math.floor(Math.random() * scale.length)]), { type: 'triangle', dur: 2.2, gain: 0.03, attack: 0.08, at: 1 + k * 2.2 + Math.random() * 0.5, dest: music });
      ci++;
      setTimeout(playChord, 7000);
    };
    playChord();
    music.gain.setTargetAtTime(1, ctx.currentTime, 2);
  }

  const api = {
    unlock() { ensure(); if (ctx.state === 'suspended') ctx.resume(); startMusic(); },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    get volume() { return volume; },
    pickup() { if (!ctx) return; const n = 72 + PENTA[noteIx++ % PENTA.length]; tone(midi(n), { type: 'sine', dur: 0.5, gain: 0.16 }); tone(midi(n + 12), { type: 'sine', dur: 0.25, gain: 0.05 }); },
    deposit() { if (!ctx) return; tone(midi(64), { type: 'triangle', dur: 0.35, gain: 0.12 }); tone(midi(71), { type: 'triangle', dur: 0.35, gain: 0.1, at: 0.06 }); noteIx = 0; },
    lit() { if (!ctx) return; [60, 64, 67, 72, 76].forEach((n, i) => tone(midi(n), { type: 'sine', dur: 2.5, gain: 0.12, at: i * 0.07 })); tone(midi(48), { type: 'triangle', dur: 2.5, gain: 0.12 }); noise(1.2, { gain: 0.05, freq: 3000, slide: 0.3 }); },
    pulse() { if (!ctx) return; noise(0.6, { gain: 0.25, freq: 400, slide: 6, q: 0.8 }); [76, 79, 83, 88].forEach((n, i) => tone(midi(n), { dur: 0.7, gain: 0.06, at: i * 0.04 })); },
    hit() { if (!ctx) return; tone(110, { type: 'sawtooth', dur: 0.45, gain: 0.2, slide: 0.4 }); tone(116, { type: 'square', dur: 0.3, gain: 0.06, slide: 0.5 }); noise(0.3, { gain: 0.2, freq: 300, type: 'lowpass' }); },
    jump() { if (!ctx) return; tone(380, { type: 'sine', dur: 0.18, gain: 0.07, slide: 1.8 }); },
    dash() { if (!ctx) return; noise(0.25, { gain: 0.18, freq: 1200, slide: 0.3, q: 0.7 }); },
    spawn() { if (!ctx) return; tone(70, { type: 'sawtooth', dur: 1.2, gain: 0.07, attack: 0.3, slide: 0.7 }); noise(1.0, { gain: 0.05, freq: 200, type: 'lowpass' }); },
    tick() { if (!ctx) return; tone(1200, { type: 'square', dur: 0.06, gain: 0.04 }); },
    win() { if (!ctx) return; [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n), { type: 'triangle', dur: 1.6, gain: 0.1, at: i * 0.12 })); },
    lose() { if (!ctx) return; [64, 60, 57, 52].forEach((n, i) => tone(midi(n), { type: 'sine', dur: 1.4, gain: 0.12, at: i * 0.3 })); },
    wind() { if (!ctx) return; noise(2.6, { gain: 0.16, freq: 500, slide: 2.2, q: 0.6 }); noise(2.0, { gain: 0.08, freq: 1400, slide: 0.6, q: 1.5, at: 0.5 }); },
    charm() { if (!ctx) return; [67, 71, 74, 79, 83].forEach((n, i) => tone(midi(n), { type: 'triangle', dur: 0.6, gain: 0.08, at: i * 0.05 })); },
    steal() { if (!ctx) return; noise(0.5, { gain: 0.14, freq: 2500, slide: 0.25, q: 2 }); tone(midi(79), { dur: 0.4, gain: 0.07, slide: 0.5 }); },
    bounce() { if (!ctx) return; tone(220, { type: 'sine', dur: 0.5, gain: 0.16, slide: 3 }); noise(0.4, { gain: 0.1, freq: 800, slide: 3 }); },
    bell() { if (!ctx) return; [48, 60, 67, 76].forEach((n, i) => tone(midi(n), { type: 'sine', dur: 4, gain: 0.08 / (i + 1), attack: 0.002 })); },
  };
  return api;
}
