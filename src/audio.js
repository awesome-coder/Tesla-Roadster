/* =========================================================================
   ROADSTER // ROCKET — procedural audio (no assets, Web Audio API)
   ========================================================================= */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.wind = null;
    this.muted = localStorage.getItem('rr-muted') === '1';
    this.started = false;
  }

  unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.52;

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.28;

      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer();
      this.createEngineLoop();
      this.createWindLoop();
      this.started = true;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* resumed on the next gesture */ });
    }
  }

  createNoiseBuffer() {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  createEngineLoop() {
    const ctx = this.ctx;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.6;
    filter.connect(engineGain);

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 48;
    const gainA = ctx.createGain();
    gainA.gain.value = 0.055;
    oscA.connect(gainA);
    gainA.connect(filter);
    oscA.start();

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 96;
    const gainB = ctx.createGain();
    gainB.gain.value = 0.032;
    oscB.connect(gainB);
    gainB.connect(filter);
    oscB.start();

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 2.2;
    lfo.connect(lfoGain);
    lfoGain.connect(oscA.frequency);
    lfo.start();

    this.engine = { engineGain, filter, oscA, oscB, gainA, gainB };
  }

  createWindLoop() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.42;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();

    this.wind = { gain, filter };
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('rr-muted', muted ? '1' : '0');
    if (!this.ctx) return;
    const target = muted ? 0 : 0.52;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.18);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  update({ active, speed = 0, flight = false, ready = false }) {
    if (!this.ctx || !this.started || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const targetEngine = active ? (flight ? 0.23 : 0.32) : 0.06;
    this.engine.engineGain.gain.setTargetAtTime(targetEngine, now, 0.12);
    this.engine.oscA.frequency.setTargetAtTime(42 + speed * 0.52 + (flight ? 18 : 0), now, 0.2);
    this.engine.oscB.frequency.setTargetAtTime(84 + speed * 1.04 + (flight ? 32 : 0), now, 0.2);
    this.engine.filter.frequency.setTargetAtTime(300 + speed * 5 + (flight ? 480 : 0), now, 0.25);

    const targetWind = active ? (flight ? 0.14 : 0.045 + Math.min(speed / 1000, 0.045)) : 0;
    this.wind.gain.gain.setTargetAtTime(targetWind, now, 0.3);
    this.wind.filter.frequency.setTargetAtTime(flight ? 950 : 420 + speed * 5, now, 0.35);

    if (ready && !this._readyPlayed) {
      this._readyPlayed = true;
      this.chime();
    } else if (!ready) {
      this._readyPlayed = false;
    }
  }

  tone(frequency, duration = 0.2, gain = 0.045, type = 'sine', endFrequency = null) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noiseBurst({ duration = 0.5, gain = 0.12, startFreq = 400, endFreq = 2000, type = 'bandpass', q = 0.7 }) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.03);
  }

  laneChange(direction = 1) {
    this.noiseBurst({
      duration: 0.18,
      gain: 0.035,
      startFreq: direction > 0 ? 320 : 520,
      endFreq: direction > 0 ? 900 : 260,
      q: 1.4,
    });
  }

  chime() {
    this.tone(660, 0.16, 0.035, 'sine');
    window.setTimeout(() => this.tone(990, 0.28, 0.032, 'sine'), 90);
  }

  takeoff() {
    this.noiseBurst({ duration: 1.25, gain: 0.14, startFreq: 180, endFreq: 2600, q: 0.5 });
    this.tone(52, 0.8, 0.07, 'sine', 28);
    this.tone(220, 0.9, 0.025, 'triangle', 660);
  }

  land() {
    this.tone(74, 0.26, 0.085, 'sine', 42);
    this.noiseBurst({ duration: 0.3, gain: 0.06, startFreq: 260, endFreq: 90, q: 0.6 });
  }

  crash() {
    this.noiseBurst({ duration: 1.4, gain: 0.35, startFreq: 1200, endFreq: 50, q: 0.4, type: 'lowpass' });
    this.tone(92, 1.0, 0.2, 'sawtooth', 22);
    this.tone(43, 1.4, 0.16, 'sine', 18);
  }

  nearMiss() {
    this.noiseBurst({ duration: 0.2, gain: 0.045, startFreq: 1400, endFreq: 300, q: 1.2 });
  }
}
