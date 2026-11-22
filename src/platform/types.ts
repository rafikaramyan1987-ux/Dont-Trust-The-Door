// The portal interface. One class per portal build (web, playgama, gamepix, y8, crazygames, gamedistribution,
// youtube); the build picks one by
// the compile-time constant __PLATFORM__ (vite.config.ts), so the web build (GitHub Pages) contains no SDK code, no
// ads and no network request.

export type PlatformName = 'web' | 'playgama' | 'gamepix' | 'y8' | 'crazygames' | 'gamedistribution' | 'youtube';

/** where an interstitial is offered: Next on the level-clear card, or a menu button (Levels / Menu) */
export type AdPlace = 'next' | 'menu';

/** What each portal's rules allow the game to do (see docs/portal-requirements.md). */
export interface Policy {
  /** Escape: 'pause' toggles the pause menu, 'close' only closes it (YouTube: never blocked), 'none' unused */
  esc: 'pause' | 'close' | 'none';
  /** the game's own overall sound button (YouTube: the player's mute is YouTube's) */
  ownMuteButton: boolean;
  /** the browser's language may be used when the portal gives none (Playgama / YouTube / CrazyGames: never) */
  browserLanguage: boolean;
  /** the player's language choice is kept in the save (YouTube: never) */
  persistLanguage: boolean;
  /** a portal pause stops the whole game loop, rendering included (YouTube) */
  pauseLoop: boolean;
  /** interstitials allowed on menu buttons too (CrazyGames: only at the level transition) */
  menuAds: boolean;
}

export const DEFAULT_POLICY: Policy = { esc: 'pause', ownMuteButton: true, browserLanguage: true, persistLanguage: true, pauseLoop: false, menuAds: true };

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
  /** what this portal allows (keys, sound button, language, ad places) */
  readonly policy: Policy;
  /** boot progress 0..100 */
  loading(p: number): void;
  /** the first frame (a loading screen) is on screen */
  firstFrame(): void;
  /** the title screen is shown (sent once) */
  gameReady(): void;
  levelStarted(level: number): void;
  /** the player reached the EXIT (`last`: the final level, the game is finished) */
  levelCompleted(level: number, last: boolean): void;
  /** the player quit a level from the pause menu (a death is not a failure) */
  levelFailed(level: number): void;
  /** a level is being played (true) or not (false) */
  gameplay(on: boolean): void;
  /** rewarded ads exist on this portal right now (false: the hint stays free) */
  readonly rewardedSupported: boolean;
  /** an interstitial at a break (Next / Levels on the level-clear card); settles exactly once */
  interstitial(place: AdPlace): Promise<void>;
  /** the portal's pre-roll when the player presses Play (GameDistribution, once per session): a promise that settles
   * exactly once, or null when there is none (the game starts at once) */
  preroll(): Promise<void> | null;
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

export type PauseReason = 'ad' | 'sdk' | 'hidden' | 'blur';

/** Shared pause / mute bookkeeping: any reason pauses; resuming restores the player's own sound setting. */
export abstract class BasePlatform {
  readonly policy: Policy = DEFAULT_POLICY;
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

  /** pause + mute while the page is hidden (and, with `blur`, while the window has lost the focus: Y8) */
  protected watchVisibility(blur = false): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => this.setPaused('hidden', document.hidden));
    if (blur) {
      window.addEventListener('blur', () => this.setPaused('blur', true));
      window.addEventListener('focus', () => this.setPaused('blur', false));
    }
  }

  firstFrame(): void {}
  preroll(): Promise<void> | null {
    return null;
  }

  /**
   * Run one ad request that settles exactly once: `start(done)` calls the SDK and must call `done(ok)` when the ad
   * is finished / closed / failed; `started()` marks that it is playing. Not started within AD_TIMEOUT = failed;
   * anything still open after AD_MAX = given up. The game is paused + muted from start to settle.
   */
  private busy = false;
  protected runAd(start: (done: (ok: boolean) => void, started: () => void) => void, maxMs = AD_MAX): Promise<boolean> {
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
      const t2 = setTimeout(() => done(false), maxMs);
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
