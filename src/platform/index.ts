// The build's portal (chosen at compile time; the other classes are dropped from the bundle).
import type { Platform } from './types';
import { WebPlatform } from './web';
import { PlaygamaPlatform } from './playgama';
import { GamePixPlatform } from './gamepix';
import { Y8Platform } from './y8';
import { CrazyGamesPlatform } from './crazygames';
import { GameDistributionPlatform } from './gamedistribution';
import { YouTubePlatform } from './youtube';

declare const __PLATFORM__: string;

function make(): Platform {
  if (__PLATFORM__ === 'playgama') return new PlaygamaPlatform();
  if (__PLATFORM__ === 'gamepix') return new GamePixPlatform();
  if (__PLATFORM__ === 'y8') return new Y8Platform();
  if (__PLATFORM__ === 'crazygames') return new CrazyGamesPlatform();
  if (__PLATFORM__ === 'gamedistribution') return new GameDistributionPlatform();
  if (__PLATFORM__ === 'youtube') return new YouTubePlatform();
  return new WebPlatform();
}

export const Portal: Platform = make();
/** true in the portal builds (ads possible); false on the web build */
export const PORTAL_BUILD: boolean = __PLATFORM__ !== 'web';

/** current pause / mute state from the portal (ads, portal pause, hidden page) */
export const PortalState = { paused: false, muted: false };
