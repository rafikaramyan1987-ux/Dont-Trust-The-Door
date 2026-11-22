// GameDistribution HTML5 SDK (https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation, rendered at
// https://gamedistribution.com/developers/sdk/html5). index.html (GameDistribution build only, vite.config.ts) defines
// window.GD_OPTIONS = { gameId, onEvent } and loads https://html5.api.gamedistribution.com/main.min.js with GD's
// loader snippet before the game. onEvent queues the SDK's events in window.__gdEvents until this class listens.
// - pre-roll: gdsdk.showAd() when the player presses Play (title / level select), once per session — GD requires a
//   pre-roll on the Start / Play button and only shows ads on user input
// - mid-roll: gdsdk.showAd() on Next / Levels / Menu of the level-clear card (outside gameplay, on a click); the SDK
//   paces them
// - rewarded: preloadAd('rewarded') tells whether one is available (if not, the bulb gives the hint without the ad
//   dialog); showAd('rewarded'); the hint on SDK_REWARDED_WATCH_COMPLETE; an ad that played but ended without it
//   (closed early) gives no hint; a rejected showAd (no fill, blocked, error) or a timeout gives the hint for free
// - SDK_GAME_PAUSE pauses + mutes, SDK_GAME_START resumes (mandatory); a hidden page pauses + mutes too
// - saves in localStorage (GD has no storage API); the browser's language
// The game ID ("game hash") comes from GameDistribution's developer panel: VITE_GD_GAME_ID at build time.
import { BasePlatform, rewardResult, type AdOutcome, type KeyValueStore, type Platform, type RewardResult } from './types';

export const GD_SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';

interface GdEvent {
  name: string;
  message?: string;
}
interface GdSdk {
  showAd(type?: string): Promise<unknown>;
  preloadAd?(type: string): Promise<unknown>;
}

declare global {
  interface Window {
    gdsdk?: GdSdk;
    __gdEvents?: GdEvent[];
    __gdOnEvent?: (e: GdEvent) => void;
  }
}

export class GameDistributionPlatform extends BasePlatform implements Platform {
  readonly name = 'gamedistribution' as const;
  private rewardReady = false;
  private prerollDone = false;
  private sdkReady = false;
  /** the open ad: SDK_GAME_PAUSE marks it started, SDK_REWARDED_WATCH_COMPLETE earns the reward */
  private pending: { started: () => void; earned: boolean } | null = null;

  async init(timeoutMs = 4000): Promise<void> {
    this.watchVisibility();
    const handle = (e: GdEvent) => this.onEvent(e);
    for (const e of window.__gdEvents ?? []) handle(e);
    window.__gdOnEvent = handle;
    // wait (shortly) for SDK_READY so the first Play can show the pre-roll; never block the boot for long
    const t0 = Date.now();
    while (!this.sdkReady && Date.now() - t0 < timeoutMs && window.__gdEvents) await new Promise((r) => setTimeout(r, 50));
    this.preloadRewarded();
  }

  private sdk(): GdSdk | null {
    const s = window.gdsdk;
    return s && typeof s.showAd === 'function' ? s : null;
  }

  private onEvent(e: GdEvent): void {
    switch (e.name) {
      case 'SDK_READY':
        this.sdkReady = true;
        break;
      case 'SDK_GAME_PAUSE':
        // an ad is about to play: pause + mute (also for ads the SDK starts by itself)
        this.pending?.started();
        this.setPaused('sdk', true);
        break;
      case 'SDK_GAME_START':
        this.setPaused('sdk', false);
        break;
      case 'SDK_REWARDED_WATCH_COMPLETE':
        if (this.pending) this.pending.earned = true;
        break;
    }
  }

  private preloadRewarded(): void {
    const s = this.sdk();
    if (!s?.preloadAd) return;
    s.preloadAd('rewarded').then(
      () => (this.rewardReady = true),
      () => (this.rewardReady = false),
    );
  }

  locale(): string | null {
    return null;
  }
  storage(): KeyValueStore | null {
    return null;
  }
  loading(): void {}
  gameReady(): void {}
  levelStarted(): void {}
  levelCompleted(): void {}
  levelFailed(): void {}
  gameplay(): void {}

  get rewardedSupported(): boolean {
    return this.sdk() !== null && this.rewardReady;
  }

  private show(type?: 'rewarded'): Promise<AdOutcome> {
    const s = this.sdk();
    if (!s) return Promise.resolve('failed');
    return this.runAd((done, started) => {
      const p = { started, earned: false };
      this.pending = p;
      const finish = (ok: boolean) => {
        if (this.pending === p) this.pending = null;
        this.setPaused('sdk', false);
        // a rewarded ad that played without SDK_REWARDED_WATCH_COMPLETE was closed early ('dismissed' only counts
        // after SDK_GAME_PAUSE); a rejection (no fill, blocked, error) is 'failed'
        if (!ok) done('failed');
        else done(type === 'rewarded' && !p.earned ? 'dismissed' : 'completed');
      };
      // the promise settles when the ad is over (or failed / blocked / skipped by the pacing); SDK_GAME_PAUSE marks
      // the start (an SDK that never answers is given up after AD_TIMEOUT)
      Promise.resolve(type ? s.showAd(type) : s.showAd()).then(
        () => finish(true),
        () => finish(false),
      );
    }).finally(() => {
      if (type === 'rewarded') {
        this.rewardReady = false;
        this.preloadRewarded();
      }
    });
  }

  preroll(): Promise<void> | null {
    if (this.prerollDone || !this.sdk()) return null;
    this.prerollDone = true;
    return this.show().then(() => undefined);
  }
  async interstitial(): Promise<void> {
    await this.show();
  }
  async rewarded(): Promise<RewardResult> {
    if (!this.rewardedSupported) return 'unavailable';
    return rewardResult(await this.show('rewarded'));
  }
}
