// Level 20 "Follow the Signs": signs, arrows and a "helpful" guide that lie to you.
//
// Group kinds (def.ext.kind):
//   l20sign   a pictogram sign (no words): { pic, post?: px of pole, arm?: true (a fingerpost arm that can spin) }
//             on a '?' group it is only drawn; on a '#' group it replaces the terrain look (you can stand on it)
//   l20guide  the little guide: walks (engine `move` actions), points, waves, laughs, digs; '#' = you can stand on him
//   l20mark   a small marker badge on top of a block (✓ / ✗ …), or a floor decal ({ decal: true }) on cover tiles
//   l20flag   a checkpoint flag that is not one
//   l20count  a countdown board: shows 5…1 and a tick, in a cycle that starts with the action l20.sync
//   l20tail   a "you are here" sign that hovers over the hero, following his path a little later; you bonk it
//   l20seesaw a big arrow plank on a pivot ('#'): l20.tip tips it over
//   l20hopper a party guest with a spiked hat that hops in place ({ period, hop, h, phase }); touching him kills
// Actions: l20.spin { g, args: { turns, ticks } } · l20.topple { g, args: { ticks } } · l20.tip { g } ·
//   l20.pose { g, args: { pose } } · l20.shove { args: { vx, vy, lock } } · l20.tail { g } · l20.sync { g } ·
//   l20.flagOn { g } · l20.flash · l20.party { g } · l20.fly { g } (a flying sign hurts while it flies)
// Conditions (when.ext): { kind: 'l20unstopped', id, zone } – the hero did not come to a full stop in `zone` first;
//   { kind: 'l20guideOn', g, x0, x1 } – the guide stands between tile columns x0 and x1.
import Phaser from 'phaser';
import type { Ext, Scene } from './types';
import { TILE, DT } from '../../config';
import { RES } from '../../art';

/* eslint-disable @typescript-eslint/no-explicit-any */
const OUT = '#2b2d42';
const KINDS = ['l20sign', 'l20guide', 'l20mark', 'l20flag', 'l20count', 'l20tail', 'l20seesaw', 'l20hopper'];
/** the tailgating sign trails the hero's path by this many ticks */
const TAIL_LAG = 22;
/** pictogram boards are drawn this much larger than their texture */
const SIGN_SCALE = 1.3;
/** the guide and the party guests */
const GUIDE_SCALE = 1.15;

type C2D = CanvasRenderingContext2D;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: C2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * RES);
  cv.height = Math.ceil(h * RES);
  const c = cv.getContext('2d')!;
  c.scale(RES, RES);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  scene.textures.addCanvas(key, cv);
  return key;
}

function rr(c: C2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function fillStroke(c: C2D, fill: string, lw = 3): void {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = OUT;
  c.stroke();
}
function poly(c: C2D, pts: number[][]): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}
/** an arrow from its centre (cx, cy), `len` long, pointing at angle a (radians, 0 = right) */
function arrow(c: C2D, cx: number, cy: number, len: number, a: number, color: string, wid = 7): void {
  c.save();
  c.translate(cx, cy);
  c.rotate(a);
  const h = len / 2, head = Math.min(len * 0.45, wid * 2.4);
  poly(c, [[-h, -wid / 2], [h - head, -wid / 2], [h - head, -wid * 1.5], [h, 0], [h - head, wid * 1.5], [h - head, wid / 2], [-h, wid / 2]]);
  c.fillStyle = color;
  c.fill();
  c.restore();
}
/** the pictogram hero: a round blob */
function blob(c: C2D, x: number, y: number, r: number, color = OUT): void {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

type Board = 'rect' | 'tri' | 'diamond' | 'circle' | 'oct';
const BOARD: Record<string, { w: number; h: number; board: Board; fill: string }> = {
  down: { w: 44, h: 44, board: 'rect', fill: '#3b7dd8' },
  jump: { w: 48, h: 44, board: 'rect', fill: '#3b7dd8' },
  right: { w: 96, h: 30, board: 'rect', fill: '#43a85a' },
  hole: { w: 52, h: 46, board: 'tri', fill: '#ffffff' },
  rocks: { w: 60, h: 54, board: 'tri', fill: '#ffffff' },
  bridgeout: { w: 52, h: 52, board: 'diamond', fill: '#ff9f2e' },
  stop: { w: 46, h: 46, board: 'oct', fill: '#e0523b' },
  you: { w: 40, h: 34, board: 'rect', fill: '#3b7dd8' },
  works: { w: 52, h: 46, board: 'tri', fill: '#ffffff' },
  one: { w: 60, h: 40, board: 'rect', fill: '#3b7dd8' },
  wind: { w: 52, h: 46, board: 'tri', fill: '#ffffff' },
  flyer: { w: 44, h: 34, board: 'rect', fill: '#ffd23f' },
  detour: { w: 44, h: 44, board: 'rect', fill: '#ff9f2e' },
  party: { w: 56, h: 48, board: 'rect', fill: '#9f7bd8' },
  safe: { w: 40, h: 40, board: 'circle', fill: '#6fd36b' },
  thumb: { w: 44, h: 44, board: 'circle', fill: '#6fd36b' },
};

function drawBoard(c: C2D, b: Board, w: number, h: number, fill: string): void {
  if (b === 'rect') rr(c, 2, 2, w - 4, h - 4, 6);
  else if (b === 'tri') { poly(c, [[w / 2, 3], [w - 3, h - 3], [3, h - 3]]); c.lineWidth = 3; }
  else if (b === 'diamond') poly(c, [[w / 2, 2], [w - 2, h / 2], [w / 2, h - 2], [2, h / 2]]);
  else if (b === 'circle') { c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); }
  else {
    const r = w / 2 - 2, pts: number[][] = [];
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; pts.push([w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a)]); }
    poly(c, pts);
  }
  fillStroke(c, fill, 3);
  if (b === 'tri') {
    // the red rim of a warning sign
    poly(c, [[w / 2, 9], [w - 10, h - 7], [10, h - 7]]);
    c.lineWidth = 4;
    c.strokeStyle = '#e0523b';
    c.stroke();
  }
}

function glyph(c: C2D, pic: string, w: number, h: number): void {
  const W = '#ffffff';
  switch (pic) {
    case 'down': arrow(c, w / 2, h / 2, 30, Math.PI / 2, W, 8); break;
    case 'jump': {
      blob(c, 13, 32, 5, W);
      c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(13, 26); c.quadraticCurveTo(24, 2, 38, 26); c.lineWidth = 2.5; c.strokeStyle = W; c.stroke();
      c.setLineDash([]);
      arrow(c, 37, 22, 12, Math.PI * 0.42, W, 4);
      c.fillStyle = W; c.fillRect(6, 37, 36, 3);
      break;
    }
    case 'right': arrow(c, w / 2 + 6, h / 2, w - 30, 0, W, 9); break;
    case 'hole': {
      c.fillStyle = OUT; c.beginPath(); c.ellipse(w / 2, h - 13, 12, 4, 0, 0, Math.PI * 2); c.fill();
      blob(c, w / 2 + 2, h - 24, 4.5);
      c.fillRect(w / 2 - 15, h - 13, 6, 2); c.fillRect(w / 2 + 9, h - 13, 6, 2);
      break;
    }
    case 'rocks': {
      blob(c, w / 2 + 8, h - 15, 5);
      for (const [x, y, r] of [[w / 2 - 6, 22, 4], [w / 2 + 2, 30, 3.5], [w / 2 - 10, 34, 3]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = OUT; c.fill(); }
      c.fillRect(13, h - 10, w - 26, 2);
      break;
    }
    case 'bridgeout': {
      c.fillStyle = OUT;
      c.fillRect(11, 28, 11, 4); c.fillRect(30, 28, 11, 4);
      poly(c, [[22, 28], [25, 31], [22, 33]]); c.fill();
      poly(c, [[30, 28], [27, 26], [30, 33]]); c.fill();
      c.fillRect(13, 32, 3, 6); c.fillRect(36, 32, 3, 6);
      break;
    }
    case 'stop': {
      // an open hand
      c.fillStyle = W;
      rr(c, 15, 20, 16, 15, 5); c.fill();
      for (let i = 0; i < 4; i++) { rr(c, 15 + i * 4, 9 + (i === 0 || i === 3 ? 3 : 0), 3.6, 14, 1.8); c.fill(); }
      c.save(); c.translate(31, 25); c.rotate(-0.6); rr(c, -2, -8, 4, 11, 2); c.fill(); c.restore();
      break;
    }
    case 'you': arrow(c, w / 2, h / 2 - 1, 22, Math.PI / 2, W, 7); break;
    case 'works': {
      blob(c, w / 2 - 5, h - 25, 4.5);
      c.strokeStyle = OUT; c.lineWidth = 3;
      c.beginPath(); c.moveTo(w / 2 - 5, h - 21); c.lineTo(w / 2 - 3, h - 13); c.stroke();
      c.beginPath(); c.moveTo(w / 2 - 2, h - 22); c.lineTo(w / 2 + 8, h - 14); c.stroke();
      c.fillStyle = OUT; poly(c, [[w / 2 + 6, h - 14], [w / 2 + 12, h - 16], [w / 2 + 11, h - 10]]); c.fill();
      c.beginPath(); c.ellipse(w / 2 + 12, h - 10, 6, 2, 0, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'one': {
      blob(c, 17, 17, 5, W);
      c.fillStyle = W; c.fillRect(8, 26, 18, 3);
      blob(c, 38, 17, 4.5, W); blob(c, 48, 17, 4.5, W);
      c.fillRect(33, 26, 20, 3);
      c.strokeStyle = '#e0523b'; c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(33, 9); c.lineTo(54, 31); c.stroke();
      break;
    }
    case 'wind': {
      c.strokeStyle = OUT; c.lineWidth = 3;
      for (const [y, x0, l] of [[21, -10, 16], [28, -14, 24], [35, -8, 14]]) {
        c.beginPath(); c.moveTo(w / 2 + x0, y); c.lineTo(w / 2 + x0 + l, y); c.stroke();
        c.beginPath(); c.arc(w / 2 + x0 + l, y - 3, 3, Math.PI / 2, Math.PI * 1.6, true); c.stroke();
      }
      break;
    }
    case 'flyer': arrow(c, w / 2, h / 2, 28, Math.PI, OUT, 8); break;
    case 'detour': {
      c.strokeStyle = W; c.lineWidth = 7;
      c.beginPath(); c.moveTo(14, 36); c.lineTo(14, 16); c.lineTo(26, 16); c.stroke();
      arrow(c, 30, 16, 12, 0, W, 7);
      break;
    }
    case 'party': {
      // a party popper and confetti
      c.fillStyle = '#ffd23f'; poly(c, [[12, 40], [22, 18], [32, 30]]); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      const cols = ['#ffffff', '#ff8fbe', '#6fd36b', '#41c6c0', '#ffd23f'];
      [[30, 12], [38, 16], [44, 10], [40, 24], [46, 30], [34, 6], [27, 8]].forEach(([x, y], i) => { c.fillStyle = cols[i % 5]; c.fillRect(x, y, 4, 4); });
      c.strokeStyle = W; c.lineWidth = 2;
      c.beginPath(); c.moveTo(28, 20); c.quadraticCurveTo(36, 14, 34, 22); c.stroke();
      break;
    }
    case 'safe': {
      c.strokeStyle = W; c.lineWidth = 5;
      c.beginPath(); c.moveTo(11, 21); c.lineTo(18, 28); c.lineTo(30, 13); c.stroke();
      break;
    }
    case 'thumb': {
      c.fillStyle = W;
      rr(c, 13, 20, 15, 14, 4); c.fill();
      rr(c, 17, 9, 6, 14, 3); c.fill();
      rr(c, 28, 21, 4, 12, 2); c.fill();
      break;
    }
    default: break;
  }
}

/** the board texture of a pictogram sign */
function boardTex(scene: Phaser.Scene, pic: string): string {
  const b = BOARD[pic];
  return tex(scene, `l20-${pic}`, b.w, b.h, (c) => { drawBoard(c, b.board, b.w, b.h, b.fill); glyph(c, pic, b.w, b.h); });
}

function makeTextures(scene: Phaser.Scene): void {
  tex(scene, 'l20-post', 8, 40, (c) => { rr(c, 1, 0, 6, 40, 2); fillStroke(c, '#c9ced8', 2); });
  tex(scene, 'l20-guide', 36, 38, (c) => {
    // a little round guide in a safari hat
    c.beginPath(); c.ellipse(18, 25, 14, 12.5, 0, 0, Math.PI * 2); fillStroke(c, '#ffb05c', 3);
    c.fillStyle = '#fff6d5'; c.beginPath(); c.ellipse(18, 29, 8, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(13, 22, 2.4, 0, Math.PI * 2); c.arc(24, 22, 2.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.arc(18.5, 27, 3.5, 0.2, Math.PI - 0.2); c.stroke();
    rr(c, 4, 10, 28, 4, 2); fillStroke(c, '#d8c27a', 2);
    rr(c, 10, 3, 16, 9, 5); fillStroke(c, '#d8c27a', 2);
  });
  tex(scene, 'l20-guide-laugh', 36, 38, (c) => {
    c.beginPath(); c.ellipse(18, 25, 14, 12.5, 0, 0, Math.PI * 2); fillStroke(c, '#ffb05c', 3);
    c.fillStyle = '#fff6d5'; c.beginPath(); c.ellipse(18, 29, 8, 6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(10, 23); c.lineTo(14, 20); c.lineTo(16, 23); c.stroke();
    c.beginPath(); c.moveTo(21, 23); c.lineTo(24, 20); c.lineTo(27, 23); c.stroke();
    c.fillStyle = OUT; c.beginPath(); c.arc(18.5, 27, 4.5, 0, Math.PI); c.fill();
    rr(c, 4, 10, 28, 4, 2); fillStroke(c, '#d8c27a', 2);
    rr(c, 10, 3, 16, 9, 5); fillStroke(c, '#d8c27a', 2);
  });
  tex(scene, 'l20-arm', 18, 8, (c) => {
    rr(c, 1, 2, 12, 4, 2); fillStroke(c, '#ffb05c', 1.5);
    c.beginPath(); c.arc(14, 4, 3, 0, Math.PI * 2); fillStroke(c, '#fff6d5', 1.5);
  });
  tex(scene, 'l20-shovel', 14, 30, (c) => {
    c.fillStyle = '#9a6b3f'; c.fillRect(6, 0, 3, 20);
    c.beginPath(); c.moveTo(2, 19); c.lineTo(12, 19); c.lineTo(10, 28); c.lineTo(4, 28); c.closePath(); fillStroke(c, '#c9ced8', 1.5);
  });
  tex(scene, 'l20-partyhat', 22, 22, (c) => {
    poly(c, [[11, 1], [20, 20], [2, 20]]); fillStroke(c, '#ff5d8f', 2);
    c.fillStyle = '#ffd23f'; c.fillRect(7, 11, 8, 3);
    // the spikes on its rim give it away
    c.fillStyle = '#e9ecf5';
    for (let i = 0; i < 4; i++) { poly(c, [[3 + i * 5, 20], [5.5 + i * 5, 14 + (i % 2) * 2], [8 + i * 5, 20]]); c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke(); }
  });
  tex(scene, 'l20-camera', 34, 22, (c) => {
    rr(c, 2, 4, 24, 15, 3); fillStroke(c, '#5b6077', 2.5);
    c.beginPath(); c.arc(26, 11, 5, 0, Math.PI * 2); fillStroke(c, '#9ef0ff', 2);
    c.fillStyle = '#e0523b'; c.fillRect(6, 7, 4, 3);
  });
  tex(scene, 'l20-barrier', 84, 120, (c) => {
    // a road-closed barricade: striped boards on two legs and a no-entry disc
    c.fillStyle = '#5b6077'; c.fillRect(10, 8, 6, 112); c.fillRect(68, 8, 6, 112);
    for (const y of [10, 46, 82]) {
      rr(c, 2, y, 80, 22, 3); fillStroke(c, '#ffffff', 2.5);
      c.save(); rr(c, 3, y + 1, 78, 20, 3); c.clip();
      c.fillStyle = '#e0523b';
      for (let x = -14; x < 90; x += 18) { poly(c, [[x, y + 22], [x + 9, y + 22], [x + 23, y], [x + 14, y]]); c.fill(); }
      c.restore();
    }
    c.beginPath(); c.arc(42, 64, 15, 0, Math.PI * 2); fillStroke(c, '#e0523b', 2.5);
    c.fillStyle = '#ffffff'; c.fillRect(32, 61, 20, 6);
    c.beginPath(); c.arc(8, 7, 4, 0, Math.PI * 2); fillStroke(c, '#ffd23f', 1.5);
    c.beginPath(); c.arc(76, 7, 4, 0, Math.PI * 2); fillStroke(c, '#ffd23f', 1.5);
  });
  tex(scene, 'l20-plank', 200, 22, (c) => {
    // a big arrow-shaped plank
    poly(c, [[2, 3], [166, 3], [166, 0], [198, 11], [166, 22], [166, 19], [2, 19]]);
    fillStroke(c, '#ffd23f', 3);
    arrow(c, 100, 11, 120, 0, OUT, 5);
  });
  tex(scene, 'l20-pivot', 30, 40, (c) => { poly(c, [[15, 2], [28, 38], [2, 38]]); fillStroke(c, '#8a90a8', 3); });
  tex(scene, 'l20-badge-check', 22, 30, (c) => {
    c.fillStyle = '#8a90a8'; c.fillRect(9.5, 18, 3, 12);
    c.beginPath(); c.arc(11, 11, 9.5, 0, Math.PI * 2); fillStroke(c, '#6fd36b', 2.5);
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(6.5, 11); c.lineTo(10, 14.5); c.lineTo(16, 7.5); c.stroke();
  });
  tex(scene, 'l20-badge-cross', 22, 30, (c) => {
    c.fillStyle = '#8a90a8'; c.fillRect(9.5, 18, 3, 12);
    c.beginPath(); c.arc(11, 11, 9.5, 0, Math.PI * 2); fillStroke(c, '#e0523b', 2.5);
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(7, 7); c.lineTo(15, 15); c.moveTo(15, 7); c.lineTo(7, 15); c.stroke();
  });
  tex(scene, 'l20-decal-jump', 40, 12, (c) => {
    // a bright take-off board painted on the floor
    c.fillStyle = '#ffd23f'; c.fillRect(0, 1, 40, 9);
    c.fillStyle = OUT;
    for (let x = 1; x < 40; x += 13) { poly(c, [[x, 1], [x + 6, 1], [x + 12, 5.5], [x + 6, 10], [x, 10], [x + 6, 5.5]]); c.fill(); }
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 3, 11);
  });
  tex(scene, 'l20-decal-hole', 120, 120, (c) => {
    // a hole painted on the floor: a dark shaft down out of sight
    const g = c.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#2b2d42'); g.addColorStop(0.5, '#1d1e2b'); g.addColorStop(1, '#101018');
    c.beginPath(); c.moveTo(3, 0); c.lineTo(117, 0); c.lineTo(115, 30); c.lineTo(118, 120); c.lineTo(2, 120); c.lineTo(5, 40); c.closePath();
    c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = OUT; c.beginPath(); c.moveTo(3, 0); c.lineTo(5, 40); c.lineTo(2, 120); c.moveTo(117, 0); c.lineTo(115, 30); c.lineTo(118, 120); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(14, 6, 34, 3); c.fillRect(70, 22, 20, 2);
  });
  tex(scene, 'l20-decal-line', 40, 10, (c) => { c.fillStyle = '#ffffff'; c.fillRect(4, 1, 32, 6); c.strokeStyle = OUT; c.lineWidth = 1.5; c.strokeRect(4, 1, 32, 6); });
  for (let d = 0; d <= 5; d++) {
    tex(scene, `l20-n${d}`, 40, 46, (c) => {
      rr(c, 2, 2, 36, 42, 6); fillStroke(c, '#1f2130', 3);
      if (d === 0) {
        c.strokeStyle = '#6fd36b'; c.lineWidth = 6; c.beginPath(); c.moveTo(10, 23); c.lineTo(17, 31); c.lineTo(30, 14); c.stroke();
      } else {
        c.fillStyle = '#ffd23f'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(d), 20, 25);
      }
    });
  }
}

interface Rig { c: Phaser.GameObjects.Container; px: number; py: number; len: number; arm: boolean }

interface GX {
  rig?: Rig;
  spin?: { t: number; dur: number; to: number; from: number };
  topple?: { t: number; dur: number };
  tip?: { t: number };
  fly?: boolean;
  guide?: { body: Phaser.GameObjects.Image; arm: Phaser.GameObjects.Image; tool: Phaser.GameObjects.Image | null; pose: string; face: number; x: number; y: number; walk: number };
  count?: { img: Phaser.GameObjects.Image; origin: number | null };
  tail?: { on: boolean; img: Phaser.GameObjects.Container };
  hop?: { period: number; hop: number; h: number; phase: number };
  flag?: Phaser.GameObjects.Image;
}

interface State {
  hist: number[];
  stopped: Record<string, boolean>;
  stops: { id: string; zone: [number, number, number, number] }[];
  gx: Map<string, GX>;
}

const st = (s: Scene): State => s.ext.l20 as State;
const gx = (s: Scene, g: any): GX => {
  const m = st(s).gx;
  if (!m.has(g.id)) m.set(g.id, {});
  return m.get(g.id)!;
};
const box = (g: any) => {
  const xs = g.tiles.map((t: any) => t.tx), ys = g.tiles.map((t: any) => t.ty);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: x0 * TILE + g.ox, y: y0 * TILE + g.oy, w: (Math.max(...xs) - x0 + 1) * TILE, h: (Math.max(...ys) - y0 + 1) * TILE };
};
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** distance from point p to the segment a→b */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function heroRect(s: Scene, inset = 3) {
  const b = s.pbody;
  return { x: b.x + inset, y: b.y + inset, w: b.width - inset * 2, h: b.height - inset * 2 };
}

export const l20: Ext = {
  name: 'l20',
  init(s) {
    s.ext.l20 = { hist: [], stopped: {}, stops: [], gx: new Map() } as State;
    const stops: State['stops'] = [];
    for (const t of s.lvl.triggers ?? []) if (t.when.ext?.kind === 'l20unstopped') stops.push({ id: t.when.ext.id, zone: t.when.ext.zone });
    st(s).stops = stops;
  },
  group(s, g) {
    const k = g.def.ext?.kind;
    if (!KINDS.includes(k)) return;
    makeTextures(s);
    const e = g.def.ext;
    const b = box(g);
    const cx = b.x + b.w / 2, bottom = b.y + b.h;
    const X = gx(s, g);
    const sc = 1 / RES;
    if (g.img && k !== 'l20mark') g.img.setVisible(false);
    if (k === 'l20sign' && e.pic === 'post') {
      // a bare pole (its board flies off)
      g.container.add(s.add.image(cx, bottom, 'l20-post').setOrigin(0.5, 1).setScale(sc, (e.post ?? 40) / 40 * sc));
      g.container.setDepth(1.5);
    } else if (k === 'l20sign') {
      const key = e.pic === 'barrier' ? 'l20-barrier' : e.pic === 'camera' ? 'l20-camera' : boardTex(s, e.pic);
      const tx = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const ss = e.pic === 'barrier' || e.pic === 'camera' ? 1 : SIGN_SCALE;
      const bw = (tx.width / RES) * ss, bh = (tx.height / RES) * ss;
      const post = e.post ?? 0;
      if (e.arm) {
        // a fingerpost: the pole stays, the arm turns round the top of the pole
        if (post) g.container.add(s.add.image(cx, bottom, 'l20-post').setOrigin(0.5, 1).setScale(sc, (post + 6) / 40 * sc));
        const rig = s.add.container(cx, bottom - post);
        rig.add(s.add.image(-8, 0, key).setOrigin(0, 0.5).setScale(sc * ss));
        g.container.add(rig);
        X.rig = { c: rig, px: cx, py: bottom - post, len: bw - 8, arm: true };
      } else {
        const rig = s.add.container(cx, bottom);
        if (post) rig.add(s.add.image(0, 0, 'l20-post').setOrigin(0.5, 1).setScale(sc, post / 40 * sc));
        rig.add(s.add.image(0, -post, key).setOrigin(0.5, 1).setScale(sc * ss));
        g.container.add(rig);
        X.rig = { c: rig, px: cx, py: bottom, len: post + bh, arm: false };
      }
      g.container.setDepth(e.front ? 6 : 1.5);
    } else if (k === 'l20guide') {
      const y = bottom;
      const gs = sc * GUIDE_SCALE;
      const body = s.add.image(cx, y, 'l20-guide').setOrigin(0.5, 1).setScale(gs);
      const arm = s.add.image(cx, y - 15, 'l20-arm').setOrigin(0.1, 0.5).setScale(gs * 1.2);
      let tool: Phaser.GameObjects.Image | null = null;
      if (e.tool === 'shovel') tool = s.add.image(cx - 14, y, 'l20-shovel').setOrigin(0.5, 1).setScale(gs * 1.3);
      g.container.add([arm, body, ...(tool ? [tool] : [])]);
      if (e.hat === 'party') g.container.add(s.add.image(cx, y - 31, 'l20-partyhat').setOrigin(0.5, 1).setScale(sc));
      g.container.setDepth(4);
      X.guide = { body, arm, tool, pose: e.pose ?? 'point', face: e.face ?? -1, x: cx, y, walk: 0 };
    } else if (k === 'l20mark') {
      if (e.decal) {
        const key = `l20-decal-${e.pic}`;
        g.container.add(s.add.image(b.x, b.y - (e.pic === 'hole' ? 0 : 1), key).setOrigin(0, 0).setScale(sc));
        g.container.setDepth(0.7);
      } else {
        g.container.add(s.add.image(cx, b.y + 1, `l20-badge-${e.pic}`).setOrigin(0.5, 1).setScale(sc * SIGN_SCALE));
      }
    } else if (k === 'l20flag') {
      X.flag = s.add.image(cx - 1, bottom + 1, 'flag').setOrigin(12 / 40, 79 / 80).setScale(sc);
      g.container.add(X.flag);
      g.container.setDepth(1);
    } else if (k === 'l20count') {
      const img = s.add.image(cx, bottom - (e.post ?? 0), 'l20-n5').setOrigin(0.5, 1).setScale(sc);
      if (e.post) g.container.add(s.add.image(cx, bottom, 'l20-post').setOrigin(0.5, 1).setScale(sc, e.post / 40 * sc));
      g.container.add(img);
      g.container.setDepth(1.5);
      X.count = { img, origin: null };
    } else if (k === 'l20tail') {
      const c = s.add.container(0, 0);
      c.add(s.add.image(cx, b.y + b.h, boardTex(s, 'you')).setOrigin(0.5, 1).setScale(sc * SIGN_SCALE));
      g.container.add(c);
      g.container.setDepth(4.5);
      X.tail = { on: false, img: c };
    } else if (k === 'l20seesaw') {
      g.container.add(s.add.image(cx, b.y + 4, 'l20-pivot').setOrigin(0.5, 0).setScale(sc));
      const rig = s.add.container(cx, b.y);
      rig.add(s.add.image(0, 0, 'l20-plank').setOrigin(0.5, 0).setScale(sc));
      g.container.add(rig);
      X.rig = { c: rig, px: cx, py: b.y, len: b.w, arm: false };
    } else if (k === 'l20hopper') {
      const y = bottom;
      g.container.add([s.add.image(cx, y, 'l20-guide-laugh').setOrigin(0.5, 1).setScale(sc * GUIDE_SCALE), s.add.image(cx, y - 34, 'l20-partyhat').setOrigin(0.5, 1).setScale(sc * GUIDE_SCALE * 1.2)]);
      g.container.setDepth(4);
      X.hop = { period: e.period ?? 70, hop: e.hop ?? 40, h: e.h ?? 100, phase: e.phase ?? 0 };
    }
  },
  action(s, a) {
    const [n, verb] = String(a.ext).split('.');
    if (n !== 'l20') return false;
    const g = a.g ? s.groups.get(a.g) : null;
    const args = a.args ?? {};
    const X = g ? gx(s, g) : null;
    switch (verb) {
      case 'spin': {
        const from = X!.spin ? X!.spin.to : 0;
        X!.spin = { t: 0, dur: args.ticks ?? 90, from, to: from + Math.PI * 2 * (args.turns ?? 1.5) };
        s.sfx('flip');
        return 'trap';
      }
      case 'topple': X!.topple = { t: 0, dur: args.ticks ?? 36 }; s.sfx('crumble'); return 'trap';
      case 'tip':
        X!.tip = { t: 0 };
        g.solid = false;
        s.sfx('crumble');
        return 'trap';
      case 'pose': if (X!.guide) X!.guide.pose = args.pose; return true;
      case 'shove': {
        const b = s.pbody;
        b.setVelocity(args.vx ?? -520, args.vy ?? -260);
        s.launchLock = args.lock ?? 24;
        s.jumping = false;
        s.grounded = false;
        s.coyote = 0;
        s.hero.launch();
        s.sfx('pad');
        if (X?.guide) X.guide.pose = 'laugh';
        return 'trap';
      }
      case 'tail': X!.tail!.on = true; return 'trap';
      case 'sync': if (X!.count) X!.count.origin = s.levelTick; return true;
      case 'flagOn':
        X!.flag?.setTexture('flag-on');
        s.emitConfetti.emitParticleAt(g.cx, g.cy - 40, 16);
        s.sfx('coin');
        return true;
      case 'flash': s.cameras.main.flash(140, 255, 255, 255, false); s.sfx('click'); return true;
      case 'party': s.emitConfetti.emitParticleAt(g.cx, g.cy - 30, 40); s.sfx('coin'); return true;
      case 'fly': X!.fly = true; s.sfx('flip'); return 'trap';
      default: return false;
    }
  },
  when(s, w) {
    if (w.kind === 'l20unstopped') return !st(s).stopped[w.id];
    if (w.kind === 'l20guideOn') {
      const g = s.groups.get(w.g);
      if (!g) return false;
      const x = g.cx + g.ox;
      return x >= w.x0 * TILE && x <= w.x1 * TILE;
    }
    return undefined;
  },
  tick(s) {
    const S = st(s);
    if (!S) return;
    const b = s.pbody;
    S.hist.push(b.center.x);
    if (S.hist.length > 200) S.hist.shift();
    // stop lines: a full stop on the ground inside the zone counts
    for (const z of S.stops) {
      if (S.stopped[z.id]) continue;
      const [x, y, w, h] = z.zone;
      if (s.grounded && Math.abs(b.velocity.x) < 4 && overlap(heroRect(s, 0), { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE })) S.stopped[z.id] = true;
    }
    for (const g of s.groups.values()) {
      const k = g.def.ext?.kind;
      if (!k || !KINDS.includes(k)) continue;
      const X = gx(s, g);
      if (X.spin) X.spin.t++;
      if (X.topple && X.topple.t < X.topple.dur + 1) X.topple.t++;
      if (X.tip) {
        X.tip.t++;
        if (X.tip.t === 30) { g.state = 'falling'; g.fallV = 1; }
      }
      if (X.hop) {
        const p = ((s.levelTick + X.hop.phase) % X.hop.period + X.hop.period) % X.hop.period;
        const q = p / X.hop.hop;
        g.oy = p < X.hop.hop ? -X.hop.h * 4 * q * (1 - q) : 0;
      }
      if (X.tail?.on) {
        const i = Math.max(0, S.hist.length - 1 - TAIL_LAG);
        const e = g.def.ext;
        g.ox = Phaser.Math.Clamp(S.hist[i] - g.cx, (e.min ?? -4) * TILE, (e.max ?? 12) * TILE);
      }
      if (X.tail) {
        // you bonk your head on it
        const r = box(g);
        const hr = { x: b.x, y: b.y, w: b.width, h: b.height };
        if (b.velocity.y < 0 && hr.x < r.x + r.w - 6 && hr.x + hr.w > r.x + 6 && hr.y >= r.y + r.h - 4 && hr.y + b.velocity.y * DT < r.y + r.h) {
          b.setVelocity(b.velocity.x, Math.min(0, (r.y + r.h - hr.y) / DT));
          s.jumping = false;
        }
      }
    }
  },
  interact(s) {
    const S = st(s);
    if (!S) return;
    const b = s.pbody;
    const hx = b.center.x, hy = b.center.y;
    for (const g of s.groups.values()) {
      const k = g.def.ext?.kind;
      if (!k || !KINDS.includes(k)) continue;
      const X = gx(s, g);
      if (X.spin && X.spin.t <= X.spin.dur && X.rig) {
        const a = angleOf(X);
        const r = X.rig;
        if (segDist(hx, hy, r.px + g.ox, r.py + g.oy, r.px + g.ox + Math.cos(a) * r.len, r.py + g.oy + Math.sin(a) * r.len) < 22) { s.kill('sign'); return; }
      }
      if (X.topple && X.topple.t <= X.topple.dur && X.rig) {
        const a = angleOf(X);
        const r = X.rig;
        const ex = r.px + g.ox + Math.sin(a) * r.len, ey = r.py + g.oy - Math.cos(a) * r.len;
        if (segDist(hx, hy, r.px + g.ox, r.py + g.oy - 6, ex, ey) < 22) { s.kill('sign'); return; }
      }
      if (X.fly && g.chase) {
        if (overlap(heroRect(s, 3), { ...box(g), y: box(g).y + 6, h: box(g).h - 8 })) { s.kill('sign'); return; }
      }
      if (X.hop) {
        const r = box(g);
        if (overlap(heroRect(s, 3), { x: r.x + 7, y: r.y + 4, w: r.w - 14, h: r.h - 4 })) { s.troll(g.def.troll); s.kill('sign'); return; }
      }
    }
  },
  render(s, dt) {
    const S = st(s);
    if (!S || !s.groups) return;
    for (const g of s.groups.values()) {
      const k = g.def.ext?.kind;
      if (!k || !KINDS.includes(k)) continue;
      const X = gx(s, g);
      if (X.rig && (X.spin || X.topple || X.tip)) X.rig.c.setRotation(angleOf(X));
      if (X.count) {
        const o = X.count.origin;
        const e = g.def.ext;
        const p = o === null ? 0 : (((s.levelTick - o) % e.period) + e.period) % e.period;
        const d = Math.max(0, 5 - Math.floor(p / e.step));
        X.count.img.setTexture(`l20-n${d}`);
      }
      if (X.guide) {
        const G = X.guide;
        const moving = Math.abs(g.dx) > 0.2 || Math.abs(g.dy) > 0.2;
        if (moving && Math.abs(g.dx) > 0.2) G.face = Math.sign(g.dx);
        G.walk += moving ? dt * 14 : 0;
        const bob = moving ? Math.abs(Math.sin(G.walk)) * -3 : 0;
        const laugh = G.pose === 'laugh';
        G.body.setTexture(laugh ? 'l20-guide-laugh' : 'l20-guide');
        G.body.setFlipX(G.face < 0).setY(G.y + bob + (laugh ? Math.sin(s.levelTick * 0.9) * 1.5 : 0));
        // the arm: points ahead (the way he wants you to go), waves, or digs
        const t = s.levelTick;
        let rot = -0.5;
        if (G.pose === 'wave') rot = -1.9 + Math.sin(t * 0.25) * 0.5;
        else if (G.pose === 'laugh') rot = -2.3 + Math.sin(t * 0.6) * 0.3;
        else if (G.pose === 'dig') rot = 0.6 + Math.sin(t * 0.4) * 0.6;
        else if (G.pose === 'stop') rot = -1.3;
        const face = G.pose === 'point' || G.pose === 'wave' ? 1 : G.face;
        G.arm.setPosition(G.x + face * 11, G.y - 17 + bob).setFlipX(face < 0).setOrigin(face < 0 ? 0.9 : 0.1, 0.5).setRotation(face < 0 ? -rot : rot);
        if (G.tool) G.tool.setPosition(G.x - G.face * 17, G.y + (G.pose === 'dig' ? Math.sin(t * 0.4) * 4 : 0)).setRotation(G.pose === 'dig' ? Math.sin(t * 0.4) * 0.5 : 0);
      }
    }
  },
  snapshot(s) {
    const S = st(s);
    if (!S) return {};
    const out: Record<string, unknown> = {};
    for (const [id, X] of S.gx) {
      if (X.spin) out[`spin_${id}`] = X.spin.t >= X.spin.dur ? 1 : 0;
      if (X.topple) out[`topple_${id}`] = X.topple.t >= X.topple.dur ? 1 : 0;
      if (X.count) out[`count_${id}`] = X.count.origin === null ? -1 : (((s.levelTick - X.count.origin) % 240) + 240) % 240;
    }
    return { l20: out };
  },
};

/** the current rotation of a sign's moving part */
function angleOf(X: GX): number {
  if (X.spin) {
    const p = Math.min(1, X.spin.t / X.spin.dur);
    const e = 0.5 - Math.cos(p * Math.PI) / 2;
    return X.spin.from + (X.spin.to - X.spin.from) * e;
  }
  if (X.topple) {
    const p = Math.min(1, X.topple.t / X.topple.dur);
    return -(Math.PI / 2) * p * p;
  }
  if (X.tip) return Math.min(0.55, X.tip.t * 0.05);
  return 0;
}
