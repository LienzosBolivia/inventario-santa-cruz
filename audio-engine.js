// Motor de audio: micrófono sin filtros de voz, emisión de acordes y detección por canal.
export const STEP = 75; // Hz entre canales (fftSize 8192 => ~5.9 Hz/bin)
export const NCH = 22;  // 1 sync + 4 nonce + 1 libre + 16 datos
export const BANDS = { audible: 3000, casi: 15000, ultra: 17200 };

export class AudioEngine {
  base = BANDS.ultra;
  marginDb = 12;
  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0.2;
    this.ctx.createMediaStreamSource(stream).connect(this.analyser);
    this.buf = new Float32Array(this.analyser.frequencyBinCount);
    await this.ctx.resume();
  }
  freq(ch) { return this.base + ch * STEP; }
  // Lee dB por canal y devuelve {on:[bool], db:[...], floor}
  read() {
    this.analyser.getFloatFrequencyData(this.buf);
    const hz = this.ctx.sampleRate / this.analyser.fftSize;
    const bin = f => Math.round(f / hz);
    const lo = bin(this.base - 500), hi = bin(this.freq(NCH) + 500);
    const sorted = Array.from(this.buf.slice(lo, hi)).sort((a, b) => a - b);
    const floor = sorted[sorted.length >> 1]; // mediana: robusta ante los tonos
    const db = [], on = [];
    for (let c = 0; c < NCH; c++) {
      const b = bin(this.freq(c));
      const v = Math.max(this.buf[b - 1], this.buf[b], this.buf[b + 1]);
      db.push(v); on.push(v > floor + this.marginDb);
    }
    return { on, db, floor };
  }
  // plan: [{chs:[canales], startMs, durMs}] -> Promise al terminar
  play(plan) {
    const t0 = this.ctx.currentTime + 0.05;
    let end = 0;
    for (const s of plan) {
      if (!s.chs.length) continue;
      const g = this.ctx.createGain();
      const peak = 0.9 / s.chs.length; // evita clipping
      const a = t0 + s.startMs / 1000, b = a + s.durMs / 1000;
      g.gain.setValueAtTime(0, a);
      g.gain.linearRampToValueAtTime(peak, a + 0.02);
      g.gain.setValueAtTime(peak, b - 0.02);
      g.gain.linearRampToValueAtTime(0, b);
      g.connect(this.ctx.destination);
      for (const ch of s.chs) {
        const o = this.ctx.createOscillator();
        o.frequency.value = this.freq(ch);
        o.connect(g); o.start(a); o.stop(b + 0.02);
      }
      end = Math.max(end, s.startMs + s.durMs);
    }
    return new Promise(r => setTimeout(r, end + 80));
  }
}
