import Phaser from 'phaser';
import { WORLD_W, WORLD_H } from './config';
import { Input } from './input';

export interface Layout {
  zoom: number;
  /** Visible world rect (the screen) in world coordinates. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Width of each side pillar (world units) reserved for touch controls; 0 if none. */
  pillar: number;
  touch: boolean;
  /** Portrait layout (portrait allowed and the screen is taller than wide). */
  portrait: boolean;
}

/**
 * Portrait screens are allowed (the YouTube Playables build: every aspect ratio must work, no "rotate your phone"
 * screen) when <body> has the class `portrait-ok` or the URL has `?portrait=1`. The other portal builds declare
 * landscape and keep the rotate screen.
 */
export function portraitAllowed(): boolean {
  if (typeof document !== 'undefined' && document.body?.classList.contains('portrait-ok')) return true;
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('portrait') === '1';
}

/**
 * Should this scene use the portrait layout right now? Portrait screens do, and so do near-square ones (up to 5:4
 * landscape), where the landscape screens would shrink to a strip with tiny buttons.
 */
export function isPortrait(scene: Phaser.Scene): boolean {
  return portraitAllowed() && scene.scale.width <= scene.scale.height * 1.25;
}

/** Portrait design column (world units): every screen and overlay fits in PORTRAIT_W × PORTRAIT_H around (640, 360). */
export const PORTRAIT_W = 460;
export const PORTRAIT_H = 760;

/**
 * The level always occupies world rect (0,0)-(1280,720). We zoom the camera so it
 * fits and, on touch devices, reserve side "pillars" for the on-screen buttons so
 * they never cover the action. In portrait the camera shows a PORTRAIT_W wide column
 * around the centre instead (the scenes arrange themselves for it).
 */
export function applyLayout(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera = scene.cameras.main): Layout {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const dpr = W / Math.max(1, window.innerWidth || W);
  const touch = Input.touchUI;
  const portrait = isPortrait(scene);
  let pillarPx = 0;
  if (touch && !portrait) {
    const cssW = W / dpr;
    pillarPx = Math.min(160, Math.max(100, cssW * 0.135)) * dpr;
  }
  const zoom = portrait ? Math.min(W / PORTRAIT_W, H / PORTRAIT_H) : Math.min(H / WORLD_H, (W - pillarPx * 2) / WORLD_W);
  cam.setZoom(zoom);
  cam.centerOn(WORLD_W / 2, WORLD_H / 2);
  const halfW = W / 2 / zoom;
  const halfH = H / 2 / zoom;
  return {
    zoom,
    left: WORLD_W / 2 - halfW,
    right: WORLD_W / 2 + halfW,
    top: WORLD_H / 2 - halfH,
    bottom: WORLD_H / 2 + halfH,
    pillar: touch && !portrait ? Math.max(0, halfW - WORLD_W / 2) : 0,
    touch,
    portrait,
  };
}
