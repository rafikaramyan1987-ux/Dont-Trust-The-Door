// Y8 minimal SDK 2.0 (https://docs.y8.com/sdk/intro/). Loaded only from Y8's CDN
// (<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async> in <head>, Y8 build only). Initialised as the
// portal snippet: a `y8sdk.ready` listener calls y8.sdk(), init(appConfig, adConfig) and onAuth(); emitReadyEvent()
// covers an SDK that loaded first. The App ID / Game ID are the game's public IDs from the Y8 developer portal
// (VITE_Y8_APP_ID / VITE_Y8_GAME_ID can override them at build time).
// - interstitial: showAd({ type: 'next' }) on Next, { type: 'browse' } on Levels / Menu of the level-clear card (both
//   are player clicks, never automatic); the SDK paces them (about one per 180 s); Y8 runs the pre-roll itself
// - rewarded: showAd({ type: 'reward' }); beforeReward → showAdFn(); the hint after adViewed; adDismissed (a real ad
//   closed early) gives no hint; any other breakStatus (noAdPreloaded, frequencyCapped, notReady, timeout, error,
//   ignored, other: no ad was shown) gives the hint for free
// - pause + mute on a hidden page and on window blur (Y8 game requirements)
// - pause + mute in beforeAd, resume in afterAd; adBreakDone / .catch / timeout settle each request exactly once
// - pause + mute while the page is hidden; saves in localStorage
import { BasePlatform, rewardResult, type AdOutcome, type AdPlace, type KeyValueStore, type Platform, type RewardResult } from './types';

export const Y8_SDK_URL = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
/** the game's public client IDs from the Y8 developer portal (VITE_Y8_APP_ID / VITE_Y8_GAME_ID override them) */
export const Y8_APP_ID: string = import.meta.env.VITE_Y8_APP_ID || '6aff479cc9841fd9d0e5db3e';
export const Y8_GAME_ID: string = import.meta.env.VITE_Y8_GAME_ID || '294329';

interface Y8ShowAdOptions {
  type: 'start' | 'pause' | 'next' | 'browse' | 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adViewed?: () => void;
  adDismissed?: () => void;
  adBreakDone?: (info: { breakStatus?: string } | undefined) => void;
}
interface Y8Sdk {
  init(app: { appId: string; autoLogin: boolean }, ad: { gameId: string; preloadAdBreaks: string; sound: string; onReady: () => void }): unknown;
  onAuth(cb: (user: unknown, error: unknown) => void): unknown;
  showAd(opts: Y8ShowAdOptions): unknown;
}

declare global {
  interface Window {
    y8?: { sdk(): Y8Sdk; emitReadyEvent?: () => void };
  }
}

export class Y8Platform extends BasePlatform implements Platform {
  readonly name = 'y8' as const;
  private sdk: Y8Sdk | null = null;

  async init(timeoutMs = 3500): Promise<void> {
    this.watchVisibility(true);
    await new Promise<void>((res) => {
      const to = setTimeout(res, timeoutMs);
      window.addEventListener(
        'y8sdk.ready',
        () => {
          try {
            if (!Y8_APP_ID || !Y8_GAME_ID) throw new Error('VITE_Y8_APP_ID / VITE_Y8_GAME_ID are not set in this build');
            const s = window.y8!.sdk();
            s.init({ appId: Y8_APP_ID, autoLogin: true }, { gameId: Y8_GAME_ID, preloadAdBreaks: 'on', sound: 'on', onReady: () => {} });
            s.onAuth((_u, e) => {
              if (e) console.warn('Y8 auth:', e);
            });
            this.sdk = s;
          } catch (e) {
            console.warn('Y8 SDK init failed, playing without ads', e);
          }
          clearTimeout(to);
          res();
        },
        { once: true },
      );
      try {
        window.y8?.emitReadyEvent?.();
      } catch {
        /* ignore */
      }
    });
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
    return this.sdk !== null;
  }

  private show(type: 'next' | 'browse' | 'reward'): Promise<AdOutcome> {
    const s = this.sdk;
    if (!s) return Promise.resolve('failed');
    return this.runAd((done, started) => {
      let viewed = false;
      let dismissed = false;
      const opts: Y8ShowAdOptions = {
        type,
        name: type === 'reward' ? 'hint' : type === 'next' ? 'level-complete' : 'level-select',
        // an ad is really about to show: pause + mute here (Y8: in the callback, not before the call)
        beforeAd: () => started(),
        afterAd: () => {},
        adBreakDone: (info) => {
          const st = info?.breakStatus;
          if (type !== 'reward') done(st === 'viewed' || st === 'dismissed' ? 'completed' : 'failed');
          else if (viewed) done('completed');
          else done(dismissed || st === 'dismissed' ? 'dismissed' : 'failed');
        },
      };
      if (type === 'reward') {
        opts.beforeReward = (showAdFn) => showAdFn();
        opts.adViewed = () => (viewed = true);
        opts.adDismissed = () => (dismissed = true);
      }
      const r = s.showAd(opts) as Promise<unknown> | undefined;
      if (r && typeof r.then === 'function') r.catch(() => done('failed'));
    });
  }

  async interstitial(place: AdPlace): Promise<void> {
    await this.show(place === 'next' ? 'next' : 'browse');
  }
  async rewarded(): Promise<RewardResult> {
    return rewardResult(await this.show('reward'));
  }
}
