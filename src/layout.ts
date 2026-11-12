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
}

/**
 * The level always occupies world rect (0,0)-(1280,720). We zoom the camera so it
 * fits and, on touch devices, reserve side "pillars" for the on-screen buttons so
 * they never cover the action.
 */
export function applyLayout(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera = scene.cameras.main): Layout {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const dpr = W / Math.max(1, window.innerWidth || W);
  const touch = Input.touchUI;
  let pillarPx = 0;
  if (touch) {
    const cssW = W / dpr;
    pillarPx = Math.min(160, Math.max(100, cssW * 0.135)) * dpr;
  }
  const zoom = Math.min(H / WORLD_H, (W - pillarPx * 2) / WORLD_W);
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
    pillar: touch ? Math.max(0, halfW - WORLD_W / 2) : 0,
    touch,
  };
}
