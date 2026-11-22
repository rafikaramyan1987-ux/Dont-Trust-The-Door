// CrazyGames HTML5 SDK v3 (https://docs.crazygames.com/sdk/). index.html loads
// https://sdk.crazygames.com/crazygames-sdk-v3.js (CrazyGames build only); init() awaits SDK.init().
// - loadingStart / loadingStop around the boot, gameplayStart / gameplayStop around levels and the pause menu (never
//   on a lost focus), happytime only when the whole game is finished ("use sparingly")
// - interstitial: requestAd('midgame') on Next of the level-clear card only (a level transition; never on menu /
//   navigation buttons); the SDK paces them
// - no Escape key (restricted keys); the language from systemInfo.locale, English otherwise
// - rewarded: requestAd('rewarded'); the reward on adFinished. An adError before adStarted (adsDisabled in Basic
//   Launch / Kids mode / offline, unfilled, adblock, cooldown, other) gives the hint for free; adError after adStarted
//   means the player closed the ad (no hint). Once ads are known to be unavailable (adsDisabled / unfilled / adblock
//   from any request, or SDK.ad.hasAdblock() at boot) the bulb gives the hint directly, without the ad dialog
// - pause + mute from adStarted to adFinished / adError; the SDK's muteAudio setting; a hidden page pauses
// - language: user.systemInfo.locale; saves through the SDK's data module (same save format)
import { BasePlatform, DEFAULT_POLICY, rewardResult, type AdOutcome, type AdPlace, type KeyValueStore, type Platform, type RewardResult } from './types';

export const CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

interface CGSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void;
    hasAdblock?(): Promise<boolean>;
  };
  data?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  user?: { systemInfo?: { locale?: string } };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CGSdk };
  }
}

export class CrazyGamesPlatform extends BasePlatform implements Platform {
  readonly name = 'crazygames' as const;
  readonly policy = { ...DEFAULT_POLICY, esc: 'none' as const, browserLanguage: false, menuAds: false };
  private s: CGSdk | null = null;
  private playing = false;
  private loadingOn = false;
  /** ads are unavailable in this session (Basic Launch / ads disabled, no fill, ad blocker): no ad dialog */
  private adsOff = false;

  async init(timeoutMs = 4000): Promise<void> {
    this.watchVisibility();
    const s = window.CrazyGames?.SDK;
    if (!s) return;
    try {
      await Promise.race([s.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('sdk timeout')), timeoutMs))]);
      if (s.environment === 'disabled') return;
      this.s = s;
      this.setPortalMuted(!!s.game.settings?.muteAudio);
      s.game.addSettingsChangeListener?.((st) => {
        if (st.muteAudio !== undefined) this.setPortalMuted(st.muteAudio);
      });
      // an ad blocker: rewarded ads cannot play, so the bulb gives the hint directly (never blocks the boot)
      void Promise.race([Promise.resolve(s.ad.hasAdblock?.()), new Promise((r) => setTimeout(() => r(false), 2000))])
        .then((blocked) => {
          if (blocked === true) this.adsOff = true;
        })
        .catch(() => {});
    } catch {
      this.s = null;
    }
  }

  locale(): string | null {
    return this.s?.user?.systemInfo?.locale ?? null;
  }
  storage(): KeyValueStore | null {
    return this.s?.data ?? null;
  }
  loading(p: number): void {
    if (!this.s) return;
    try {
      if (p < 100 && !this.loadingOn) {
        this.loadingOn = true;
        this.s.game.loadingStart();
      } else if (p >= 100 && this.loadingOn) {
        this.loadingOn = false;
        this.s.game.loadingStop();
      }
    } catch {
      /* ignore */
    }
  }
  gameReady(): void {
    this.loading(100);
  }
  levelStarted(): void {}
  levelCompleted(_level: number, last: boolean): void {
    if (!last) return;
    try {
      this.s?.game.happytime();
    } catch {
      /* ignore */
    }
  }
  levelFailed(): void {}
  gameplay(on: boolean): void {
    if (!this.s || on === this.playing) return;
    this.playing = on;
    try {
      if (on) this.s.game.gameplayStart();
      else this.s.game.gameplayStop();
    } catch {
      /* ignore */
    }
  }

  get rewardedSupported(): boolean {
    return !!this.s && !this.adsOff;
  }

  private ad(type: 'midgame' | 'rewarded'): Promise<AdOutcome> {
    const s = this.s;
    if (!s) return Promise.resolve('failed');
    return this.runAd((done, started) => {
      let began = false;
      s.ad.requestAd(type, {
        adStarted: () => {
          began = true;
          started();
        },
        adFinished: () => done('completed'),
        adError: (e) => {
          const code = (e as { code?: string } | null)?.code;
          if (code === 'adsDisabled' || code === 'unfilled' || code === 'adblock') this.adsOff = true;
          done(began ? 'dismissed' : 'failed');
        },
      });
    });
  }

  async interstitial(place: AdPlace): Promise<void> {
    if (place !== 'next') return;
    await this.ad('midgame');
  }
  async rewarded(): Promise<RewardResult> {
    return rewardResult(await this.ad('rewarded'));
  }
}
