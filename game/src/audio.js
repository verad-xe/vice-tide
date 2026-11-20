// Vice Tide — all sound is synthesized with WebAudio: no audio files.
// A tiny synth plays gunshots, crashes, sirens, pickups and a lazy
// bass-and-keys loop that fits a sun-soaked coastal city.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
  }

  // Browsers only allow audio after a gesture, so this is called from the
  // first key press or click. Safe to call again and in headless scenes.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch (err) {
      this.ctx = null;
    }
  }

  tone(freq, seconds, type = 'sine', volume = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  noise(seconds, volume = 0.25, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shoot() { this.noise(0.09, 0.3); this.tone(160, 0.08, 'square', 0.12, 60); }
  reload() { this.tone(300, 0.05, 'square', 0.1); this.tone(420, 0.05, 'square', 0.1, null, 0.12); }
  crash(strength = 1) { this.noise(0.22, 0.22 * strength); this.tone(90, 0.2, 'triangle', 0.2 * strength, 45); }
  pickup() { this.tone(660, 0.09, 'sine', 0.18); this.tone(990, 0.14, 'sine', 0.18, null, 0.08); }
  cash() { this.tone(880, 0.07, 'triangle', 0.16); this.tone(1320, 0.12, 'triangle', 0.16, null, 0.06); }
  uiClick() { this.tone(520, 0.05, 'sine', 0.12); }
  door() { this.tone(140, 0.09, 'triangle', 0.16, 90); }
  hurt() { this.tone(220, 0.12, 'sawtooth', 0.14, 110); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.16, null, i * 0.09));
  }
  busted() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.16, null, i * 0.13));
  }

  // Looping engine hum whose pitch follows the player's speed.
  setEngine(speedRatio, active) {
    if (!this.ctx) return;
    if (active && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      const target = active ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 130, this.ctx.currentTime, 0.08);
    }
  }

  // Two-tone siren that exists only while the wanted level is up.
  setSiren(active) {
    if (!this.ctx) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    }
    if (this.sirenOsc) {
      const t = this.ctx.currentTime;
      this.sirenGain.gain.setTargetAtTime(active && !this.muted ? 0.035 : 0, t, 0.2);
      if (active) this.sirenOsc.frequency.setValueAtTime(Math.sin(t * 4.4) > 0 ? 760 : 570, t);
    }
  }

  // A slow four-bar loop: soft bass notes under a Rhodes-ish chord stab.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 110, 130.8, 98];
    const chords = [[220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const bar = Math.floor(this.musicStep / 2) % 4;
      if (this.musicStep % 2 === 0) {
        this.tone(bass[bar], 0.5, 'triangle', 0.11);
        chords[bar].forEach((f) => this.tone(f, 0.7, 'sine', 0.045));
      }
      this.musicStep += 1;
    }, 460);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
