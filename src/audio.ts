// Sound: recorded, compressed files (public/audio/*.mp3, copied to the build root) played with WebAudio.
// Nothing is synthesised at runtime: the files are rendered from the original synthesiser
// (src/audio-synth.ts) by `npm run audio` (tools/render-audio.mjs). They are fetched and decoded right
// after boot, without holding up the first scene; a sound whose file is not decoded yet is skipped.

import { Save } from './save';
import { SFX_NAMES, LOOP_SECONDS, LOOP_STEPS, MUSIC_EIGHTH, MUSIC_FILE, audioUrl, type SfxName } from './audio-defs';
import { encodeWav } from './wav';

export type { SfxName };
export { LOOP_SECONDS, LOOP_STEPS, MUSIC_EIGHTH };

const MASTER = 0.8;
const MUSIC = 0.55;

type AC = typeof AudioContext;
type OAC = typeof OfflineAudioContext;

/** decodeAudioData, promise or callback form (older Safari only has the callback one) */
function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  muted = Save.get().muted;
  /** the portal silences the game (ad, portal pause, hidden page, the portal's sound switch): never saved */
  sysMuted = false;
  /** decoded files by name (every SfxName, and 'music') */
  readonly buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private decoder: BaseAudioContext | null = null;
  private musicOn = false;
  private music: AudioBufferSourceNode | null = null;
  /** loop position (s) at `posAt` (ctx time); posAt null = the loop clock is stopped (music off) */
  private posBase = 0;
  private posAt: number | null = null;
  /** Test hook: every sfx call is reported here (used for the trailer soundtrack). */
  onSfx: ((name: SfxName) => void) | null = null;

  /** Fetch and decode every file (once; called after boot and again, harmlessly, on unlock). */
  preload(): Promise<void> {
    if (!this.loading) this.loading = Promise.all([...SFX_NAMES, MUSIC_FILE].map((n) => this.load(n))).then(() => undefined);
    return this.loading;
  }

  private async load(name: string): Promise<void> {
    try {
      const res = await fetch(audioUrl(name));
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      const ctx = this.ctx ?? this.decodeCtx();
      if (!ctx) return;
      this.buffers.set(name, await decode(ctx, data));
      if (name === MUSIC_FILE) this.syncMusic();
    } catch {
      /* no audio for this one */
    }
  }

  /** decoding needs no user gesture with an OfflineAudioContext (buffers play in any context) */
  private decodeCtx(): BaseAudioContext | null {
    if (!this.decoder) {
      const O: OAC | undefined = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: OAC }).webkitOfflineAudioContext;
      if (O) this.decoder = new O(1, 1, 44100);
    }
    return this.decoder;
  }

  /** Must be called from a user gesture at least once (mobile autoplay rules). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const C: AC | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
        if (!C) return;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted || this.sysMuted ? 0 : MASTER;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = MUSIC;
        this.musicBus.connect(this.master);
        if (this.musicOn) this.posAt = this.ctx.currentTime;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      void this.preload();
      this.syncMusic();
    } catch {
      /* no audio available */
    }
  }

  sfx(name: SfxName): void {
    if (this.onSfx) this.onSfx(name);
    if (!this.ctx || !this.sfxBus || this.muted || this.sysMuted || this.ctx.state !== 'running') return;
    const buf = this.buffers.get(name);
    if (!buf) return; // not decoded yet
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.sfxBus);
      s.start(this.ctx.currentTime + 0.005);
    } catch {
      /* ignore */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    Save.setMuted(m);
    this.applyGain();
  }

  /** portal mute on / off; when it ends, the player's own sound setting applies again */
  setSysMuted(m: boolean): void {
    this.sysMuted = m;
    this.applyGain();
  }

  private applyGain(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted || this.sysMuted ? 0 : MASTER, this.ctx.currentTime, 0.02);
    this.syncMusic();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic(): void {
    this.musicOn = true;
    if (this.ctx && this.posAt === null) this.posAt = this.ctx.currentTime;
    this.syncMusic();
  }

  stopMusic(): void {
    this.posBase = this.loopPos();
    this.posAt = null;
    this.musicOn = false;
    this.syncMusic();
  }

  /** where in the loop the music is now; while muted the loop clock keeps running silently */
  private loopPos(): number {
    if (this.posAt === null || !this.ctx) return this.posBase;
    return (this.posBase + this.ctx.currentTime - this.posAt) % LOOP_SECONDS;
  }

  /** The music plays (a looping buffer source) while it is on, the sound is on and the file is decoded. */
  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const buf = this.buffers.get(MUSIC_FILE);
    const want = this.musicOn && !this.muted && !this.sysMuted && !!buf;
    try {
      if (want && !this.music && buf) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.loopStart = 0;
        s.loopEnd = LOOP_SECONDS;
        s.connect(this.musicBus);
        s.start(ctx.currentTime, this.loopPos());
        this.music = s;
      } else if (!want && this.music) {
        const s = this.music;
        this.music = null;
        s.stop(ctx.currentTime + 0.1); // after the master fade
      }
    } catch {
      /* ignore */
    }
  }
}

export const Audio = new AudioEngine();

/**
 * Render a soundtrack offline from the recorded files: the music loop plus a list of timed
 * sound effects, in the game's mix. Returns 16-bit PCM WAV bytes (used by tools/capture-media.mjs).
 */
export async function renderSoundtrack(seconds: number, events: { t: number; name: SfxName }[]): Promise<Uint8Array> {
  await Audio.preload();
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const master = ctx.createGain();
  master.gain.value = MASTER;
  master.connect(ctx.destination);
  const music = ctx.createGain();
  music.gain.value = 0.5;
  music.connect(master);
  const sfx = ctx.createGain();
  sfx.connect(master);
  const loop = Audio.buffers.get(MUSIC_FILE);
  if (loop) {
    const s = ctx.createBufferSource();
    s.buffer = loop;
    s.loop = true;
    s.loopEnd = LOOP_SECONDS;
    s.connect(music);
    s.start(0);
  }
  for (const e of events) {
    const b = Audio.buffers.get(e.name);
    if (!b || e.t >= seconds) continue;
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(sfx);
    s.start(e.t);
  }
  return encodeWav(await ctx.startRendering());
}
