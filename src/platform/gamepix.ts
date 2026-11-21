// GamePix JS SDK v3 (manual lifecycle). index.html sets `window.GamePixConfig = { lifecycle: 'manual' }` and loads
// https://integration.gamepix.com/sdk/v3/gamepix.sdk.js before the game (vite.config.ts, GamePix build only).
// - lifecycle: loading(0..100) during boot, `await loaded()` before the title shows, gameStart() at the first level
// - pause / resume events, soundOff / soundOn, and a hidden page pause + mute the game
// - interstitial only on Next / Levels of the level-clear card, at most one per 2 minutes (and not in the first 2)
// - rewarded: the reward only on `success === true`
// - updateLevel(n) when a level starts, happyMoment() when the whole game is finished
// - language from GamePix.lang(); saves in localStorage
import { BasePlatform, type KeyValueStore, type Platform } from './types';

export const GPX_SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
export const MIDGAME_GAP = 120_000;

interface GamePixAdResult {
  success: boolean;
}
interface GamePixSdk {
  lifecycle: { loading(p: number): void; loaded(): Promise<unknown>; gameStart(): void };
  events: { on(name: 'pause' | 'resume' | 'soundOff' | 'soundOn', fn: () => void): void };
  ads: { interstitial(): Promise<GamePixAdResult>; reward(): Promise<GamePixAdResult> };
  lang?(): string;
  updateLevel?(level: number): unknown;
  happyMoment?(): unknown;
  soundOff?: () => void;
  soundOn?: () => void;
  pause?: () => void;
  resume?: () => void;
}

declare global {
  interface Window {
    GamePix?: GamePixSdk;
    GamePixConfig?: { lifecycle?: 'manual' | 'auto' };
  }
}

export class GamePixPlatform extends BasePlatform implements Platform {
  readonly name = 'gamepix' as const;
  private s: GamePixSdk | null = null;
  private progress = -1;
  private lang: string | null = null;
  private started = false;
  private readyDone = false;
  private lastAd = Date.now();
  /** the open ad request: the SDK's pause event marks it as started */
  private adStarted: (() => void) | null = null;

  async init(): Promise<void> {
    this.watchVisibility();
    const s = window.GamePix;
    if (!s?.lifecycle || !s.ads) return;
    this.s = s;
    const pause = () => {
      this.adStarted?.();
      this.setPaused('sdk', true);
    };
    const resume = () => this.setPaused('sdk', false);
    const off = () => this.setPortalMuted(true);
    const on = () => this.setPortalMuted(false);
    try {
      s.events.on('pause', pause);
      s.events.on('resume', resume);
      s.events.on('soundOff', off);
      s.events.on('soundOn', on);
    } catch {
      /* no events */
    }
    try {
      s.pause = pause;
      s.resume = resume;
      s.soundOff = off;
      s.soundOn = on;
    } catch {
      /* read-only */
    }
    try {
      const l = typeof s.lang === 'function' ? s.lang() : null;
      this.lang = typeof l === 'string' && l ? l : null;
    } catch {
      this.lang = null;
    }
    this.loading(0);
  }

  locale(): string | null {
    return this.lang;
  }
  storage(): KeyValueStore | null {
    return null;
  }

  /** 0..100, integer, only increasing; at 100 waits for loaded() (capped at 5 s) */
  loading(p: number): void {
    p = Math.round(Math.min(100, Math.max(0, p)));
    if (!this.s || p <= this.progress) return;
    this.progress = p;
    try {
      this.s.lifecycle.loading(p);
    } catch {
      /* ignore */
    }
  }

  async whenLoaded(): Promise<void> {
    this.loading(100);
    if (!this.s || this.readyDone) return;
    try {
      await Promise.race([this.s.lifecycle.loaded(), new Promise((r) => setTimeout(r, 5000))]);
    } catch {
      /* play on */
    }
    this.readyDone = true;
  }

  gameReady(): void {
    void this.whenLoaded();
  }
  levelStarted(level: number): void {
    try {
      this.s?.updateLevel?.(level);
    } catch {
      /* ignore */
    }
    if (this.started || !this.s) return;
    this.started = true;
    try {
      this.s.lifecycle.gameStart();
    } catch {
      /* ignore */
    }
  }
  levelCompleted(_level: number, last: boolean): void {
    if (!last) return;
    try {
      this.s?.happyMoment?.();
    } catch {
      /* ignore */
    }
  }
  levelFailed(): void {}
  gameplay(): void {}

  get rewardedSupported(): boolean {
    return !!this.s;
  }

  private ad(kind: 'interstitial' | 'reward'): Promise<boolean> {
    const s = this.s;
    if (!s) return Promise.resolve(false);
    return this.runAd((done, started) => {
      // the SDK pauses the game when the ad starts (or the promise settles first); not started in AD_TIMEOUT = failed
      this.adStarted = started;
      const r = kind === 'reward' ? s.ads.reward() : s.ads.interstitial();
      Promise.resolve(r).then(
        (v) => done(!!v && v.success === true),
        () => done(false),
      );
    }).finally(() => (this.adStarted = null));
  }

  async interstitial(): Promise<void> {
    if (!this.s || Date.now() - this.lastAd < MIDGAME_GAP) return;
    this.lastAd = Date.now();
    await this.ad('interstitial');
  }

  async rewarded(): Promise<boolean> {
    const ok = await this.ad('reward');
    if (ok) this.lastAd = Date.now();
    return ok;
  }
}
