// All sound is synthesized with WebAudio — no audio files. Short oscillator
// and noise blips cover the effects, and a tiny step sequencer loops a
// bass-and-arp pattern underneath. Everything is created lazily on the
// first user gesture, and M toggles a master mute that persists in memory
// only (the world and the renderer never know sound exists).

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let stepIndex = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  const sfx = {
    bounce() { tone(220, 0.05, 'square', 0.10, 180); },
    paddle() { tone(330, 0.06, 'square', 0.12, 420); },
    hit() { tone(160, 0.05, 'square', 0.12, 120); },
    break() { tone(520, 0.09, 'triangle', 0.16, 880); noise(0.08, 0.10, 2400); },
    armorBreak() { tone(190, 0.14, 'sawtooth', 0.16, 60); noise(0.14, 0.14, 1200); },
    explode() { noise(0.32, 0.30, 700); tone(120, 0.3, 'sine', 0.28, 38); },
    laser() { tone(920, 0.08, 'sawtooth', 0.07, 240); },
    power() { tone(520, 0.09, 'sine', 0.16); tone(660, 0.09, 'sine', 0.16, null, 0.07); tone(880, 0.14, 'sine', 0.16, null, 0.14); },
    lose() { tone(320, 0.4, 'sawtooth', 0.14, 70); },
    clear() { tone(523, 0.1, 'triangle', 0.16); tone(659, 0.1, 'triangle', 0.16, null, 0.09); tone(784, 0.18, 'triangle', 0.16, null, 0.18); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, null, i * 0.11)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, null, i * 0.13)); },
  };

  // A minor-key loop: a pulsing bass line with a sparse arp on top.
  const BASS = [55, 0, 55, 55, 0, 55, 0, 65.4, 0, 49, 0, 49, 58.3, 0, 73.4, 0];
  const ARP = [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 246.9, 0];

  function musicStep() {
    if (!ctx || muted) return;
    const i = stepIndex % 16;
    stepIndex += 1;
    const t0 = ctx.currentTime;
    if (BASS[i]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = BASS[i];
      gain.gain.setValueAtTime(0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.21);
      osc.connect(gain).connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.23);
    }
    if (ARP[i]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = ARP[i];
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(gain).connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }
  }

  return {
    unlock() {
      if (ensure() && !musicTimer) musicTimer = setInterval(musicStep, 214);
    },
    play(name) {
      if (muted || !ctx) return;
      if (sfx[name]) sfx[name]();
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
      return muted;
    },
    isMuted() { return muted; },
  };
}
