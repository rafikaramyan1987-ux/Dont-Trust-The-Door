// The portal interface. One class per portal build (web, playgama, gamepix, y8, crazygames); the build picks one by
// the compile-time constant __PLATFORM__ (vite.config.ts), so the web build (GitHub Pages) contains no SDK code, no
// ads and no network request.

export type PlatformName = 'web' | 'playgama' | 'gamepix' | 'y8' | 'crazygames';

/** A synchronous key/value store (the save). Portal stores are read once at boot and written through. */
export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface Platform {
  readonly name: PlatformName;
  /** load / initialise the SDK; never rejects, never blocks longer than its own timeout */
  init(): Promise<void>;
  /** the portal's language code (e.g. "de", "pt-BR"), or null */
  locale(): string | null;
  /** the portal's save storage, or null for localStorage */
  storage(): KeyValueStore | null;
  /** boot progress 0..100 */
  loading(p: number): void;
  /** the title screen is shown (sent once) */
  gameReady(): void;
  levelStarted(level: number): void;
  /** the player reached the EXIT */
  levelCompleted(level: number): void;
  /** the player quit a level from the pause menu (a death is not a failure) */
  levelFailed(level: number): void;
  /** a level is being played (true) or not (false) */
  gameplay(on: boolean): void;
  /** rewarded ads exist on this portal right now (false: the hint stays free) */
  readonly rewardedSupported: boolean;
  /** an interstitial at a break (Next / Levels on the level-clear card); settles exactly once */
  interstitial(): Promise<void>;
  /** a rewarded ad; true only when the SDK confirmed the reward; settles exactly once */
  rewarded(): Promise<boolean>;
  /** the game listens: paused (ad, portal pause, hidden page) and muted (the same, or the portal's sound switch) */
  onPause: (paused: boolean) => void;
  onMute: (muted: boolean) => void;
}

/** an ad that has not started after this long counts as failed (ms) */
export const AD_TIMEOUT = 8000;
/** an ad that started but never ends is given up after this long, so the game can never stay paused (ms) */
export const AD_MAX = 120_000;

export type PauseReason = 'ad' | 'sdk' | 'hidden';

/** Shared pause / mute bookkeeping: any reason pauses; resuming restores the player's own sound setting. */
export abstract class BasePlatform {
  onPause: (paused: boolean) => void = () => {};
  onMute: (muted: boolean) => void = () => {};
  private reasons = new Set<PauseReason>();
  private portalMuted = false;
  private lastPaused = false;
  private lastMuted = false;

  get paused(): boolean {
    return this.reasons.size > 0;
  }

  setPaused(reason: PauseReason, on: boolean): void {
    if (on) this.reasons.add(reason);
    else this.reasons.delete(reason);
    this.emit();
  }

  /** the portal's own sound switch */
  setPortalMuted(on: boolean): void {
    this.portalMuted = on;
    this.emit();
  }

  private emit(): void {
    const p = this.paused;
    const m = p || this.portalMuted;
    if (p !== this.lastPaused) {
      this.lastPaused = p;
      this.onPause(p);
    }
    if (m !== this.lastMuted) {
      this.lastMuted = m;
      this.onMute(m);
    }
  }

  /** pause + mute while the page is hidden */
  protected watchVisibility(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => this.setPaused('hidden', document.hidden));
  }

  /**
   * Run one ad request that settles exactly once: `start(done)` calls the SDK and must call `done(ok)` when the ad
   * is finished / closed / failed; `started()` marks that it is playing. Not started within AD_TIMEOUT = failed;
   * anything still open after AD_MAX = given up. The game is paused + muted from start to settle.
   */
  private busy = false;
  protected runAd(start: (done: (ok: boolean) => void, started: () => void) => void): Promise<boolean> {
    if (this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(t1);
        clearTimeout(t2);
        this.busy = false;
        this.setPaused('ad', false);
        res(ok);
      };
      const started = () => {
        if (settled) return;
        clearTimeout(t1);
        this.setPaused('ad', true);
      };
      const t1 = setTimeout(() => done(false), AD_TIMEOUT);
      const t2 = setTimeout(() => done(false), AD_MAX);
      try {
        start(done, started);
      } catch {
        done(false);
      }
    });
  }
}

/** load a script tag (used where an SDK may be missing) */
export function loadScript(src: string, timeoutMs: number): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const to = setTimeout(() => rej(new Error('timeout')), timeoutMs);
    s.onload = () => (clearTimeout(to), res());
    s.onerror = () => (clearTimeout(to), rej(new Error('load failed')));
    document.head.appendChild(s);
  });
}
