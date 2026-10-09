// Tiny WebAudio synth for ZX-Spectrum-flavoured beeps. No audio files needed.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.suppressed = false; // muted attract mode
    this.volume = 0.18;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', to = null, vol = 1, delay = 0 } = {}) {
    if (this.muted || this.suppressed || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 1, delay = 0, lowpass = 3000 } = {}) {
    if (this.muted || this.suppressed || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  play(name) {
    switch (name) {
      case 'bat': this.tone(440, 0.07, { to: 660 }); break;
      case 'wall': this.tone(220, 0.04, { vol: 0.6 }); break;
      case 'hit': this.tone(880, 0.05, { vol: 0.7 }); break;
      case 'break': this.tone(1200, 0.08, { to: 300, vol: 0.7 }); break;
      case 'steel': this.tone(1800, 0.06, { type: 'triangle', vol: 0.8 }); this.tone(2400, 0.08, { type: 'triangle', vol: 0.4, delay: 0.02 }); break;
      case 'explode': this.noise(0.45, { vol: 1.4, lowpass: 900 }); this.tone(120, 0.4, { to: 40, vol: 0.8 }); break;
      case 'laser': this.tone(1600, 0.09, { type: 'sawtooth', to: 400, vol: 0.35 }); break;
      case 'bonus': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.08, { delay: i * 0.06, vol: 0.6 })); break;
      case 'life': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.09, { delay: i * 0.07, vol: 0.6 })); break;
      case 'critter': this.tone(150, 0.25, { type: 'sawtooth', to: 600, vol: 0.5 }); this.tone(600, 0.2, { type: 'sawtooth', to: 200, vol: 0.4, delay: 0.25 }); break;
      case 'squash': this.noise(0.15, { vol: 0.8, lowpass: 1600 }); this.tone(300, 0.15, { to: 80, vol: 0.6 }); break;
      case 'lost': [440, 370, 311, 262, 196].forEach((f, i) => this.tone(f, 0.14, { delay: i * 0.12, vol: 0.6 })); break;
      case 'eaten': this.noise(0.6, { vol: 1, lowpass: 600 }); [300, 250, 200, 150, 100].forEach((f, i) => this.tone(f, 0.18, { type: 'sawtooth', delay: i * 0.15, vol: 0.5 })); break;
      case 'launch': this.tone(330, 0.1, { to: 990, vol: 0.5 }); break;
      case 'clear': [523, 523, 784, 784, 1046].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.11, vol: 0.6 })); break;
      case 'start': [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.1, { delay: i * 0.09, vol: 0.5 })); break;
      default: break;
    }
  }
}
