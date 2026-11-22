// CrazyGames HTML5 SDK v3 (https://docs.crazygames.com/sdk/). index.html loads
// https://sdk.crazygames.com/crazygames-sdk-v3.js (CrazyGames build only); init() awaits SDK.init().
// - loadingStart / loadingStop around the boot, gameplayStart / gameplayStop around levels, happytime on a clear
// - interstitial: requestAd('midgame') on Next / Levels of the level-clear card; the SDK paces them
// - rewarded: requestAd('rewarded'); the reward only on adFinished
// - pause + mute from adStarted to adFinished / adError; the SDK's muteAudio setting; a hidden page pauses
// - language: user.systemInfo.locale; saves through the SDK's data module (same save format)
import { BasePlatform, type KeyValueStore, type Platform } from './types';

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
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void };
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
  private s: CGSdk | null = null;
  private playing = false;
  private loadingOn = false;

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
  levelCompleted(): void {
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
    return !!this.s;
  }

  private ad(type: 'midgame' | 'rewarded'): Promise<boolean> {
    const s = this.s;
    if (!s) return Promise.resolve(false);
    return this.runAd((done, started) => {
      s.ad.requestAd(type, { adStarted: started, adFinished: () => done(true), adError: () => done(false) });
    });
  }

  async interstitial(): Promise<void> {
    await this.ad('midgame');
  }
  async rewarded(): Promise<boolean> {
    return this.ad('rewarded');
  }
}
