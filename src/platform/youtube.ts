// YouTube Playables (https://developers.google.com/youtube/gaming/playables/reference/sdk and the certification
// requirements). index.html (YouTube build only, vite.config.ts) loads https://www.youtube.com/game_api/v1 before any
// game code; the SDK is the global `ytgame` (never overridden).
// - ytgame.game.firstFrameReady() while the loading screen is drawn, gameReady() once the title can be used
// - pause / resume ONLY from ytgame.system.onPause / onResume (the whole game loop, rendering and sound stop; the
//   Page Visibility API must not be used: the Phaser visibility listener is not installed in this build)
// - audio: isAudioEnabled() at boot, onAudioEnabledChange(); no overall sound button of the game's own
// - saves only through ytgame.game.loadData() (awaited once at boot) / saveData() after every change; the
//   language is never stored in the save
// - language only from ytgame.system.getLanguage() (never navigator.language); English otherwise
// - ads: ytgame.ads.requestInterstitialAd() at the level transition / menu break (never rewarded on it),
//   requestRewardedAd() → the hint when the reward was earned, none when the ad was closed early, the hint for free
//   when no ad could be shown (rejected request, timeout); YouTube paces and fills them
// - Escape only closes the pause menu and is never blocked
import { BasePlatform, DEFAULT_POLICY, rewardResult, type AdOutcome, type KeyValueStore, type Platform, type RewardResult } from './types';

export const YT_SDK_URL = 'https://www.youtube.com/game_api/v1';
export const REWARD_ID = 'hint-for-current-level';
/** an ad request that never settles is given up after this long (ms), so the game can never stay paused */
export const YT_AD_MAX = 60_000;

interface YtGame {
  IN_PLAYABLES_ENV?: boolean;
  game: { firstFrameReady(): void; gameReady(): void; loadData(): Promise<string>; saveData(d: string): Promise<void> };
  system: {
    isAudioEnabled(): boolean;
    onAudioEnabledChange(cb: (enabled: boolean) => void): unknown;
    onPause(cb: () => void): unknown;
    onResume(cb: () => void): unknown;
    getLanguage(): Promise<string>;
  };
  ads?: { requestInterstitialAd(): Promise<void>; requestRewardedAd(id: string): Promise<boolean> };
  health?: { logError(): void; logWarning(): void };
}

declare global {
  interface Window {
    ytgame?: YtGame;
  }
}

/** The Playables environment forbids the Page Visibility API: drop such listeners before Phaser installs one. */
function blockVisibilityListeners(): void {
  if (typeof document === 'undefined') return;
  const add = Document.prototype.addEventListener;
  Document.prototype.addEventListener = function (this: Document, type: string, ...rest: unknown[]) {
    if (/visibilitychange$/i.test(type)) return;
    return (add as (...a: unknown[]) => void).call(this, type, ...rest);
  } as typeof add;
}

export class YouTubePlatform extends BasePlatform implements Platform {
  readonly name = 'youtube' as const;
  readonly policy = { ...DEFAULT_POLICY, esc: 'close' as const, ownMuteButton: false, browserLanguage: false, persistLanguage: false, pauseLoop: true };
  private y: YtGame | null = null;
  private lang: string | null = null;
  private store: Map<string, string> | null = null;
  private firstDone = false;
  private readyDone = false;
  private saving: Promise<unknown> = Promise.resolve();

  constructor() {
    super();
    blockVisibilityListeners();
  }

  async init(timeoutMs = 4000): Promise<void> {
    const y = window.ytgame;
    if (!y?.game || !y.system) return;
    this.y = y;
    this.firstFrame();
    const race = <T>(p: Promise<T>) => Promise.race([p, new Promise<T | undefined>((r) => setTimeout(() => r(undefined), timeoutMs))]);
    try {
      this.setPortalMuted(!y.system.isAudioEnabled());
      y.system.onAudioEnabledChange((on) => this.setPortalMuted(!on));
      y.system.onPause(() => this.setPaused('sdk', true));
      y.system.onResume(() => this.setPaused('sdk', false));
    } catch {
      /* ignore */
    }
    try {
      this.lang = (await race(y.system.getLanguage())) || null;
    } catch {
      this.lang = null;
    }
    // the save: awaited before any saveData (the SDK rejects a save made before loadData)
    this.store = new Map();
    try {
      const raw = await race(y.game.loadData());
      if (raw) {
        const o = JSON.parse(raw) as Record<string, unknown>;
        for (const [k, v] of Object.entries(o)) if (typeof v === 'string') this.store.set(k, v);
      }
    } catch {
      /* a new player (or an unreadable save): start fresh */
    }
  }

  locale(): string | null {
    return this.lang;
  }

  storage(): KeyValueStore | null {
    const y = this.y;
    const m = this.store;
    if (!y || !m) return null;
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        m.set(k, v);
        const data = JSON.stringify(Object.fromEntries(m));
        // one save at a time, in order
        this.saving = this.saving.then(() => y.game.saveData(data)).catch(() => {});
      },
    };
  }

  loading(): void {}

  firstFrame(): void {
    if (this.firstDone || !this.y) return;
    this.firstDone = true;
    try {
      this.y.game.firstFrameReady();
    } catch {
      /* ignore */
    }
  }

  gameReady(): void {
    if (this.readyDone || !this.y) return;
    this.firstFrame();
    this.readyDone = true;
    try {
      this.y.game.gameReady();
    } catch {
      /* ignore */
    }
  }
  levelStarted(): void {}
  levelCompleted(): void {}
  levelFailed(): void {}
  gameplay(): void {}

  get rewardedSupported(): boolean {
    return !!this.y?.ads;
  }

  private ad(run: (a: NonNullable<YtGame['ads']>) => Promise<AdOutcome>): Promise<AdOutcome> {
    const a = this.y?.ads;
    if (!a) return Promise.resolve('failed');
    return this.runAd((done, started) => {
      // the request is the ad: the game stays paused + muted until it settles; a rejected request = no ad ('failed')
      started();
      run(a).then(
        (o) => done(o),
        () => done('failed'),
      );
    }, YT_AD_MAX);
  }

  async interstitial(): Promise<void> {
    await this.ad((a) => a.requestInterstitialAd().then((): AdOutcome => 'completed'));
  }
  /** true: the reward was earned (hint); false: the ad played but was not watched to the end (no hint); a rejected
   * request (no ad) or a timeout: the hint for free */
  async rewarded(): Promise<RewardResult> {
    return rewardResult(await this.ad((a) => a.requestRewardedAd(REWARD_ID).then((earned): AdOutcome => (earned === true ? 'completed' : 'dismissed'))));
  }
}
