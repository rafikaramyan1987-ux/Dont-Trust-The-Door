// The web build (GitHub Pages): no SDK, no ads, no network. Everything is a no-op; the hint is free.
import { DEFAULT_POLICY, type KeyValueStore, type Platform } from './types';

export class WebPlatform implements Platform {
  readonly name = 'web' as const;
  readonly rewardedSupported = false;
  readonly policy = DEFAULT_POLICY;
  onPause: (paused: boolean) => void = () => {};
  onMute: (muted: boolean) => void = () => {};
  async init(): Promise<void> {}
  locale(): string | null {
    return null;
  }
  storage(): KeyValueStore | null {
    return null;
  }
  loading(): void {}
  firstFrame(): void {}
  gameReady(): void {}
  levelStarted(): void {}
  levelCompleted(): void {}
  levelFailed(): void {}
  gameplay(): void {}
  async interstitial(): Promise<void> {}
  async preroll(): Promise<void> {}
  async rewarded(): Promise<boolean> {
    return false;
  }
}
