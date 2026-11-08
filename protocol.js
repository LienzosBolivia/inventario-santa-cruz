// Trama: Faro(300ms: sync + nonce 4 bits) + 4 ranuras de 250ms con 16 canales de datos.
// Canales: 0 sync | 1-4 nonce | 6-21 datos
import { NCH } from './audio-engine.js';
export const BEACON = 300, SLOT = 250, SLOTS = 4, PER = 16, FRAME = BEACON + SLOT * SLOTS;
const bitsToChs = (m, off) => { const r = []; for (let i = 0; i < 16; i++) if (m >> i & 1) r.push(off + i); return r; };

export function rotation(key, nonce) { // FNV-1a
  let h = 2166136261;
  for (const c of `${key}:${nonce}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 64;
}
export const idToPos = (id, rot) => (id - 1 + rot) % 64;
export const posToId = (pos, rot) => (((pos - rot) % 64) + 64) % 64 + 1;

export class Protocol {
  constructor(engine, onUpdate) {
    this.e = engine; this.onUpdate = onUpdate;
    this.role = 'participant'; this.id = 1; this.key = '';
    this.nonce = null; this.state = [0, 0, 0, 0]; this.sentOwn = false;
    this.mode = 'idle'; this.ignoreUntil = 0; this.running = false;
  }
  start() { this.running = true; this.timer = setInterval(() => this.tick(), 40); }
  stop() { clearInterval(this.timer); this.running = false; }

  newSession() { // sólo anfitrión
    this.nonce = Math.floor(Math.random() * 16);
    this.state = [0, 0, 0, 0]; this.sentOwn = false;
    this.markOwn(); this.emit(0); this.onUpdate();
  }
  markOwn() {
    if (this.nonce === null || !this.id) return;
    const p = idToPos(this.id, rotation(this.key, this.nonce));
    this.state[p >> 4] |= 1 << (p & 15);
  }
  presentIds() {
    if (this.nonce === null) return [];
    const rot = rotation(this.key, this.nonce), r = [];
    for (let p = 0; p < 64; p++) if (this.state[p >> 4] >> (p & 15) & 1) r.push(posToId(p, rot));
    return r.sort((a, b) => a - b);
  }
  async emit(jitter = 100 + Math.random() * 400) {
    this.mode = 'emit';
    await new Promise(r => setTimeout(r, jitter));
    const plan = [{ chs: [0, ...bitsToChs(this.nonce, 1).filter(c => c <= 4)], startMs: 0, durMs: BEACON }];
    for (let k = 0; k < SLOTS; k++)
      plan.push({ chs: bitsToChs(this.state[k], 6), startMs: BEACON + k * SLOT, durMs: SLOT });
    await this.e.play(plan);
    this.sentOwn = true; this.ignoreUntil = performance.now() + 400; this.mode = 'idle';
  }
  tick() {
    const now = performance.now();
    if (this.mode === 'emit' || now < this.ignoreUntil) return;
    const { on } = this.e.read();
    this.onUpdate(on);
    if (this.mode === 'idle') {
      if (!on[0]) return;
      this.mode = 'frame'; this.t0 = now; this.nAcc = 0; this.sAcc = [0, 0, 0, 0];
    }
    const t = now - this.t0;
    if (t >= 100 && t <= 250) for (let i = 0; i < 4; i++) if (on[1 + i]) this.nAcc |= 1 << i;
    for (let k = 0; k < SLOTS; k++) {
      const s = BEACON + k * SLOT;
      if (t >= s + 60 && t <= s + 190)
        for (let i = 0; i < PER; i++) if (on[6 + i]) this.sAcc[k] |= 1 << i;
    }
    if (t > FRAME) this.finish();
  }
  finish() {
    this.mode = 'idle';
    if (this.nonce !== this.nAcc) { // sesión nueva: reiniciar
      if (this.role === 'host' && this.nonce !== null) return; // el anfitrión ignora otras sesiones
      this.nonce = this.nAcc; this.state = [0, 0, 0, 0]; this.sentOwn = false;
    }
    let changed = false;
    for (let k = 0; k < SLOTS; k++) {
      const n = this.state[k] | this.sAcc[k];
      if (n !== this.state[k]) { this.state[k] = n; changed = true; }
    }
    if (this.role === 'participant') {
      const before = this.state.join(); this.markOwn();
      if (this.state.join() !== before) changed = true;
    }
    this.onUpdate();
    if (changed || !this.sentOwn) this.emit();
  }
}
