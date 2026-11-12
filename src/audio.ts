// Procedural sound effects and an original chiptune loop, generated with WebAudio.
// Every voice is written against BaseAudioContext + a start time, so the same code
// can play live or be rendered offline (used to give the trailer video a soundtrack).

import { Save } from './save';

export type SfxName =
  | 'jump' | 'land' | 'death' | 'trap' | 'win' | 'hehe' | 'coin' | 'spikes'
  | 'crumble' | 'click' | 'flip' | 'pad' | 'chomp' | 'run' | 'slam';

type Ctx = BaseAudioContext;

let noiseCache = new WeakMap<Ctx, AudioBuffer>();
function noise(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x3fffffff) - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

const waveCache = new WeakMap<Ctx, PeriodicWave>();
/** 25% pulse wave: the classic thin "chip" lead. */
function pulse(ctx: Ctx): PeriodicWave {
  let w = waveCache.get(ctx);
  if (!w) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    const duty = 0.25;
    for (let k = 1; k < n; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.cos(k * Math.PI * duty);
      imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.sin(k * Math.PI * duty);
    }
    w = ctx.createPeriodicWave(real, imag);
    waveCache.set(ctx, w);
  }
  return w;
}

function tone(
  ctx: Ctx, dest: AudioNode, t: number, dur: number,
  f0: number, f1: number, type: OscillatorType | 'pulse', vol: number, attack = 0.005,
): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (type === 'pulse') o.setPeriodicWave(pulse(ctx));
  else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(
  ctx: Ctx, dest: AudioNode, t: number, dur: number, vol: number,
  filter: BiquadFilterType, freq: number, freqEnd = freq,
): void {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd !== freq) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

export function playSfxAt(ctx: Ctx, dest: AudioNode, name: SfxName, t: number): void {
  switch (name) {
    case 'jump':
      tone(ctx, dest, t, 0.14, 330, 760, 'pulse', 0.16);
      break;
    case 'land':
      hiss(ctx, dest, t, 0.07, 0.18, 'lowpass', 900, 300);
      break;
    case 'death':
      tone(ctx, dest, t, 0.09, 880, 440, 'square', 0.16);
      tone(ctx, dest, t + 0.08, 0.32, 520, 90, 'pulse', 0.18);
      hiss(ctx, dest, t, 0.22, 0.22, 'lowpass', 2400, 200);
      break;
    case 'trap':
      tone(ctx, dest, t, 0.08, 1180, 1180, 'square', 0.1);
      tone(ctx, dest, t + 0.07, 0.16, 590, 560, 'square', 0.12);
      break;
    case 'win':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ctx, dest, t + i * 0.065, 0.2, f, f, 'pulse', 0.13));
      tone(ctx, dest, t, 0.08, 200, 1200, 'sine', 0.25); // the "pop"
      break;
    case 'hehe':
      for (let i = 0; i < 2; i++) {
        tone(ctx, dest, t + i * 0.13, 0.09, 1250, 1500, 'triangle', 0.18);
        tone(ctx, dest, t + i * 0.13 + 0.04, 0.06, 1500, 1100, 'triangle', 0.12);
      }
      break;
    case 'coin':
      tone(ctx, dest, t, 0.07, 880, 880, 'triangle', 0.18);
      tone(ctx, dest, t + 0.06, 0.07, 1175, 1175, 'triangle', 0.18);
      tone(ctx, dest, t + 0.12, 0.18, 1568, 1568, 'triangle', 0.16);
      break;
    case 'spikes':
      hiss(ctx, dest, t, 0.16, 0.25, 'highpass', 4000, 7000);
      tone(ctx, dest, t, 0.12, 1900, 2600, 'sawtooth', 0.05);
      break;
    case 'crumble':
      hiss(ctx, dest, t, 0.45, 0.3, 'lowpass', 700, 120);
      break;
    case 'click':
      tone(ctx, dest, t, 0.05, 660, 990, 'pulse', 0.12);
      break;
    case 'flip':
      tone(ctx, dest, t, 0.3, 200, 1400, 'sine', 0.16);
      hiss(ctx, dest, t, 0.3, 0.1, 'bandpass', 600, 3000);
      break;
    case 'pad':
      tone(ctx, dest, t, 0.28, 180, 900, 'sine', 0.25);
      tone(ctx, dest, t + 0.05, 0.2, 360, 1200, 'triangle', 0.08);
      break;
    case 'chomp':
      tone(ctx, dest, t, 0.08, 160, 80, 'square', 0.22);
      tone(ctx, dest, t + 0.1, 0.08, 160, 80, 'square', 0.22);
      break;
    case 'run':
      for (let i = 0; i < 4; i++) tone(ctx, dest, t + i * 0.07, 0.04, 700 + i * 60, 600, 'triangle', 0.1);
      break;
    case 'slam':
      tone(ctx, dest, t, 0.3, 120, 40, 'sine', 0.4);
      hiss(ctx, dest, t, 0.35, 0.3, 'lowpass', 1200, 100);
      break;
  }
}

// ---------------------------------------------------------------------------
// Music: an original 4-bar loop at 150 BPM in A minor → C major.
// Each array entry is one 8th note; 0 = rest. MIDI note numbers.

const BPM = 150;
const EIGHTH = 60 / BPM / 2;
export const LOOP_STEPS = 64; // 8 bars of 8 eighths
export const LOOP_SECONDS = LOOP_STEPS * EIGHTH;

// prettier-ignore
const LEAD = [
  76, 0, 74, 72, 74, 0, 79, 0,   76, 0, 72, 0, 69, 71, 72, 0,
  74, 0, 72, 71, 72, 0, 76, 0,   74, 72, 71, 0, 67, 0, 0, 0,
  76, 0, 74, 72, 74, 0, 79, 0,   81, 0, 79, 76, 77, 0, 76, 74,
  72, 0, 74, 76, 79, 0, 77, 76,  74, 0, 71, 0, 72, 0, 0, 0,
];
// prettier-ignore
const BASS = [
  45, 0, 57, 0, 45, 0, 57, 0,   41, 0, 53, 0, 41, 0, 53, 0,
  43, 0, 55, 0, 43, 0, 55, 0,   48, 0, 55, 0, 43, 0, 47, 0,
  45, 0, 57, 0, 45, 0, 57, 0,   41, 0, 53, 0, 41, 0, 53, 0,
  48, 0, 55, 0, 43, 0, 55, 0,   43, 0, 47, 0, 48, 0, 43, 0,
];
// Arpeggio sparkle on off-beats (quiet).
// prettier-ignore
const ARP = [
  0, 69, 0, 72, 0, 76, 0, 72,    0, 65, 0, 69, 0, 72, 0, 69,
  0, 67, 0, 71, 0, 74, 0, 71,    0, 64, 0, 67, 0, 72, 0, 71,
  0, 69, 0, 72, 0, 76, 0, 72,    0, 65, 0, 69, 0, 72, 0, 69,
  0, 64, 0, 67, 0, 72, 0, 67,    0, 67, 0, 71, 0, 74, 0, 0,
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Schedule one 8th-note step of the loop. */
export function scheduleMusicStep(ctx: Ctx, dest: AudioNode, step: number, t: number): void {
  const i = step % LOOP_STEPS;
  if (LEAD[i]) tone(ctx, dest, t, EIGHTH * 0.9, midi(LEAD[i]), midi(LEAD[i]), 'pulse', 0.075, 0.004);
  if (BASS[i]) tone(ctx, dest, t, EIGHTH * 1.6, midi(BASS[i]), midi(BASS[i]), 'triangle', 0.16, 0.004);
  if (ARP[i]) tone(ctx, dest, t, EIGHTH * 0.5, midi(ARP[i] + 12), midi(ARP[i] + 12), 'square', 0.022, 0.002);
  // Drums: kick on beats, hat on off-beats, snare on 2 & 4.
  if (i % 4 === 0) tone(ctx, dest, t, 0.12, 150, 45, 'sine', 0.28);
  if (i % 2 === 1) hiss(ctx, dest, t, 0.035, 0.05, 'highpass', 7000);
  if (i % 8 === 4) hiss(ctx, dest, t, 0.12, 0.12, 'bandpass', 1800, 900);
}

export const MUSIC_EIGHTH = EIGHTH;

// ---------------------------------------------------------------------------
// Live engine

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  muted = Save.get().muted;
  private musicOn = false;
  private nextStep = 0;
  private nextTime = 0;
  private timer: number | null = null;
  /** Test hook: every sfx call is reported here (used for the trailer soundtrack). */
  onSfx: ((name: SfxName) => void) | null = null;

  /** Must be called from a user gesture at least once (mobile autoplay rules). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.55;
        this.musicBus.connect(this.master);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.musicOn && this.timer === null) this.startScheduler();
    } catch {
      /* no audio available */
    }
  }

  sfx(name: SfxName): void {
    if (this.onSfx) this.onSfx(name);
    if (!this.ctx || !this.sfxBus || this.muted || this.ctx.state !== 'running') return;
    try {
      playSfxAt(this.ctx, this.sfxBus, name, this.ctx.currentTime + 0.005);
    } catch {
      /* ignore */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    Save.setMuted(m);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic(): void {
    this.musicOn = true;
    if (this.ctx && this.timer === null) this.startScheduler();
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startScheduler(): void {
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.pump(), 50);
    this.pump();
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    if (ctx.currentTime > this.nextTime + 1) this.nextTime = ctx.currentTime + 0.05; // tab was asleep
    while (this.nextTime < ctx.currentTime + 0.25) {
      if (!this.muted) scheduleMusicStep(ctx, this.musicBus, this.nextStep, this.nextTime);
      this.nextStep = (this.nextStep + 1) % LOOP_STEPS;
      this.nextTime += EIGHTH;
    }
  }
}

export const Audio = new AudioEngine();

/**
 * Render a soundtrack offline: music loop plus a list of timed sound effects.
 * Returns 16-bit PCM WAV bytes (used by tools/capture-media.mjs).
 */
export async function renderSoundtrack(seconds: number, events: { t: number; name: SfxName }[]): Promise<Uint8Array> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  const music = ctx.createGain();
  music.gain.value = 0.5;
  music.connect(master);
  const sfx = ctx.createGain();
  sfx.connect(master);
  for (let s = 0, t = 0; t < seconds; s++, t += EIGHTH) scheduleMusicStep(ctx, music, s, t);
  for (const e of events) if (e.t < seconds) playSfxAt(ctx, sfx, e.name, e.t);
  const buf = await ctx.startRendering();
  return encodeWav(buf);
}

function encodeWav(buf: AudioBuffer): Uint8Array {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  return new Uint8Array(out.buffer);
}

// keep the cache variable referenced for strict builds
export function _resetAudioCaches(): void { noiseCache = new WeakMap(); }
