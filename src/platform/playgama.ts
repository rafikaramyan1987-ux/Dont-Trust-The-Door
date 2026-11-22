// Playgama Bridge (https://wiki.playgama.com/playgama/bridge-sdk). The Bridge comes from Playgama's CDN
// (https://bridge.playgama.com/v2/stable/playgama-bridge.js) as the first script in <head>; index.html's inline boot
// (scripts/playgama/boot.js) calls bridge.initialize() and holds the game bundle until it has settled. This class
// reads the outcome (window.__playgamaBridgeInit), never calls initialize() itself, and:
// - language: platform.language (if the game supports it)
// - saves: Bridge storage (one storage.get() of the save key at boot, write-through set())
// - game_ready once the title screen is shown; level_started / level_completed / level_failed, always after
//   game_ready (an earlier one is held and sent right after it)
// - interstitial: advertisement.showInterstitial() on Next / Levels of the level-clear card, only where
//   isInterstitialSupported; no timer of the game's own (Bridge paces them)
// - rewarded: showRewarded(); the hint after the `rewarded` state; `closed` after `opened` without it (the player
//   closed the ad) gives no hint; `failed` / not supported / no state at all gives the hint for free
// - pause + mute on ads, on PAUSE_STATE_CHANGED and while the page is hidden; AUDIO_STATE_CHANGED mutes
import { BasePlatform, DEFAULT_POLICY, rewardResult, type AdOutcome, type KeyValueStore, type Platform, type RewardResult } from './types';

export const SAVE_KEY = 'dttd-save-v1';

type Listener = (...a: unknown[]) => void;
interface Bridge {
  EVENT_NAME: Record<'INTERSTITIAL_STATE_CHANGED' | 'REWARDED_STATE_CHANGED' | 'AUDIO_STATE_CHANGED' | 'PAUSE_STATE_CHANGED', string>;
  platform: { id?: string; language?: string; isAudioEnabled?: boolean; sendMessage(m: string, o?: unknown): unknown; on(e: string, fn: Listener): void };
  advertisement: {
    isInterstitialSupported?: boolean;
    isRewardedSupported?: boolean;
    showInterstitial(placement?: string): void;
    showRewarded(placement?: string): void;
    on(e: string, fn: Listener): void;
  };
  storage: { get(keys: string | string[]): Promise<unknown>; set(k: string, v: string): Promise<unknown> };
}

declare global {
  interface Window {
    bridge?: Bridge;
    /** set by the Playgama boot script: bridge.initialize()'s outcome (null = initialized, else the error) */
    __playgamaBridgeInit?: Promise<unknown>;
    /** test / QA log of what the game sent */
    __playgama?: { log: string[] };
  }
}

type AdKind = 'interstitial' | 'rewarded';

export class PlaygamaPlatform extends BasePlatform implements Platform {
  readonly name = 'playgama' as const;
  // Esc must not be used; the language only from bridge.platform.language, never the browser (English fallback)
  readonly policy = { ...DEFAULT_POLICY, esc: 'none' as const, browserLanguage: false };
  private b: Bridge | null = null;
  private store: Map<string, string> | null = null;
  private ready = false;
  private held: string[] = [];
  private pending: { kind: AdKind; started: () => void; done: (o: AdOutcome) => void; earned: boolean } | null = null;
  readonly log: string[] = [];

  async init(): Promise<void> {
    window.__playgama = { log: this.log };
    this.watchVisibility();
    let err: unknown = new Error('no boot');
    try {
      err = window.__playgamaBridgeInit ? await window.__playgamaBridgeInit : new Error('the Playgama boot script did not run');
    } catch (e) {
      err = e;
    }
    const s = window.bridge;
    if (err || !s) {
      // boot.js has logged it with console.error; the game plays on without Bridge
      return;
    }
    this.b = s;
    try {
      const E = s.EVENT_NAME;
      this.setPortalMuted(s.platform.isAudioEnabled === false);
      s.platform.on(E.AUDIO_STATE_CHANGED, ((on: boolean) => this.setPortalMuted(on === false)) as Listener);
      s.platform.on(E.PAUSE_STATE_CHANGED, ((p: boolean) => this.setPaused('sdk', !!p)) as Listener);
      s.advertisement.on(E.INTERSTITIAL_STATE_CHANGED, ((st: string) => this.onAdState('interstitial', st)) as Listener);
      s.advertisement.on(E.REWARDED_STATE_CHANGED, ((st: string) => this.onAdState('rewarded', st)) as Listener);
    } catch (e) {
      console.error('[Playgama Bridge] event setup failed', e);
    }
    try {
      const v = await Promise.race([s.storage.get([SAVE_KEY]), new Promise((r) => setTimeout(() => r(undefined), 4000))]);
      const val = Array.isArray(v) ? v[0] : (v as Record<string, unknown> | undefined)?.[SAVE_KEY] ?? v;
      this.store = new Map();
      if (typeof val === 'string' && val) this.store.set(SAVE_KEY, val);
    } catch {
      this.store = new Map();
    }
  }

  locale(): string | null {
    return this.b?.platform.language || null;
  }

  storage(): KeyValueStore | null {
    const s = this.b;
    const m = this.store;
    if (!s || !m) return null;
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        m.set(k, v);
        void Promise.resolve(s.storage.set(k, v)).catch(() => {});
      },
    };
  }

  loading(): void {}

  private send(m: string): void {
    this.log.push(m);
    if (!this.b) return;
    if (!this.ready && m !== 'game_ready') {
      this.held.push(m);
      return;
    }
    try {
      void Promise.resolve(this.b.platform.sendMessage(m)).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  gameReady(): void {
    if (this.ready || !this.b) return;
    this.send('game_ready');
    this.ready = true;
    const h = this.held;
    this.held = [];
    h.forEach((m) => this.send(m));
  }
  levelStarted(): void {
    this.send('level_started');
  }
  levelCompleted(): void {
    this.send('level_completed');
  }
  levelFailed(): void {
    this.send('level_failed');
  }
  gameplay(): void {}

  get rewardedSupported(): boolean {
    return !!this.b && this.b.advertisement.isRewardedSupported === true;
  }

  private onAdState(kind: AdKind, state: string): void {
    const p = this.pending;
    if (!p || p.kind !== kind) return;
    if (state === 'opened') p.started(); // a real ad on screen ('loading' is not one yet)
    else if (state === 'rewarded') p.earned = true;
    else if (state === 'closed') p.done(kind === 'rewarded' && !p.earned ? 'dismissed' : 'completed');
    else if (state === 'failed') p.done('failed');
  }

  private show(kind: AdKind): Promise<AdOutcome> {
    const s = this.b;
    if (!s) return Promise.resolve('failed');
    return this.runAd((done, started) => {
      const p = {
        kind,
        earned: false,
        started,
        done: (o: AdOutcome) => {
          if (this.pending === p) this.pending = null;
          done(o);
        },
      };
      this.pending = p;
      if (kind === 'rewarded') s.advertisement.showRewarded();
      else s.advertisement.showInterstitial();
    }).finally(() => {
      if (this.pending?.kind === kind) this.pending = null;
    });
  }

  async interstitial(): Promise<void> {
    if (!this.b || this.b.advertisement.isInterstitialSupported !== true) return;
    await this.show('interstitial');
  }

  async rewarded(): Promise<RewardResult> {
    if (!this.rewardedSupported) return 'unavailable';
    return rewardResult(await this.show('rewarded'));
  }
}
