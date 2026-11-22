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
/** failed resume() attempts before the next gesture builds a fresh AudioContext */
const RESUME_TRIES = 3;

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
  /** failed resume() attempts in a row: after RESUME_TRIES (or a closed context) the next gesture makes a new one */
  private resumeFails = 0;
  private listening = false;
  private lastState: string | null = null;

  constructor() {
    // the first pointerdown / touchstart / keydown anywhere unlocks the sound (a user gesture); nothing plays before
    if (typeof window !== 'undefined') this.listen();
  }

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

  /**
   * Must be called from a user gesture at least once (mobile autoplay rules). Creates the AudioContext on the first
   * gesture, and a fresh one when the old one is closed or will not resume (the decoded buffers are reused); resumes
   * a context that is not running. Also installs the gesture / focus listeners that keep the sound alive.
   */
  unlock(): void {
    this.listen();
    try {
      if (this.ctx && (this.ctx.state === 'closed' || this.resumeFails >= RESUME_TRIES)) this.dropContext();
      if (!this.ctx) {
        const C: AC | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
        if (!C) return;
        const ctx = new C();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted || this.sysMuted ? 0 : MASTER;
        this.master.connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = MUSIC;
        this.musicBus.connect(this.master);
        // the loop clock continues where it was (posBase) on the new context's clock
        if (this.musicOn) this.posAt = ctx.currentTime;
        this.lastState = ctx.state;
        ctx.onstatechange = () => this.onState(ctx);
      }
      this.resume();
      void this.preload();
      this.syncMusic();
    } catch {
      /* no audio available */
    }
  }

  /**
   * Resume a context that is not running and not closed: "suspended", and Safari's own "interrupted" (another app
   * or tab took the audio). Without a gesture this may fail; the next gesture tries again.
   */
  resume(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    try {
      void Promise.resolve(ctx.resume()).then(
        () => {
          if (this.ctx === ctx && ctx.state === 'running') this.resumeFails = 0;
        },
        () => {
          if (this.ctx === ctx) this.resumeFails++;
        },
      );
    } catch {
      this.resumeFails++;
    }
  }

  /** the context changed state: back to "running" restarts the music loop once, at the loop position */
  private onState(ctx: AudioContext): void {
    if (ctx !== this.ctx) return;
    const was = this.lastState;
    this.lastState = ctx.state;
    if (ctx.state === 'running' && was !== 'running') {
      this.resumeFails = 0;
      this.restartMusic();
    }
  }

  /** the music source is replaced by a new one at the current loop position (after the context came back) */
  private restartMusic(): void {
    const old = this.music;
    if (!old) return this.syncMusic();
    this.music = null;
    try {
      old.stop();
    } catch {
      /* already stopped */
    }
    try {
      old.disconnect();
    } catch {
      /* ignore */
    }
    this.syncMusic();
  }

  /** forget a closed / broken context (its nodes); the next unlock() builds a new one */
  private dropContext(): void {
    const ctx = this.ctx;
    if (ctx) {
      this.posBase = this.loopPos();
      ctx.onstatechange = null;
      if (ctx.state !== 'closed') void Promise.resolve(ctx.close()).catch(() => {});
    }
    this.ctx = null;
    this.master = this.sfxBus = this.musicBus = null;
    this.music = null;
    this.resumeFails = 0;
    this.lastState = null;
  }

  /**
   * Once: every pointerdown / touchstart / keydown (capture phase, passive) resumes or rebuilds the audio (it is a
   * user gesture); window focus and the page becoming visible resume it. Before the first gesture nothing plays.
   */
  private listen(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    const gesture = () => this.unlock();
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, gesture, { capture: true, passive: true });
    window.addEventListener('focus', () => this.resume());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.resume();
    });
  }

  sfx(name: SfxName): void {
    if (this.onSfx) this.onSfx(name);
    if (this.ctx && this.ctx.state !== 'running') this.resume();
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
