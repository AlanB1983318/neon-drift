export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.engineOsc = null;
    this.engineGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch {
      this.enabled = false;
    }
  }

  _ensure() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.enabled;
  }

  playBeep(freq = 440, duration = 0.12, type = 'square') {
    if (!this._ensure()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  countdownBeep(num) {
    if (num === 0) {
      this.playBeep(880, 0.25, 'sawtooth');
      this.playBeep(1320, 0.15, 'sine');
    } else {
      this.playBeep(440 + num * 80, 0.1, 'square');
    }
  }

  startEngine() {
    if (!this._ensure() || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain.gain.value = 0.04;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  updateEngine(speed, nitroActive) {
    if (!this.engineOsc) return;
    const base = 60 + speed * 12;
    this.engineOsc.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(nitroActive ? 0.08 : 0.04, this.ctx.currentTime, 0.05);
  }

  stopEngine() {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  playNitroBurst() {
    if (!this._ensure()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playFinish() {
    if (!this._ensure()) return;
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => this.playBeep(f, 0.2, 'sine'), i * 120);
    });
  }
}
