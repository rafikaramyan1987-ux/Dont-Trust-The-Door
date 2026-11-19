// Level 18 "Haunted Halls": ghosts and possessed things that react to where you LOOK.
//
// "Looking" = the way the hero faces: the last direction he moved in (it stays while he stands still). The hero's
// sprite is turned to match it. Group kinds (group def `ext.kind`, all deterministic, per tick):
//   ghost     ('?') a ghost. mode 'boo': drifts toward you (through walls) only while your back is turned to it,
//             freezes while you face it. mode 'mirror': floats at your mirror image around `axis` (tile x): you go
//             right, it goes left. Touching it kills. Woken by the action `l18.wake`; it fades once you are past
//             `until` (tile x).
//   gaze      ('#') planks that are solid only while you face `face` (1 = right, -1 = left); faint otherwise.
//   front     ('#') a ghost lying flat: solid only while its face (its centre) is in front of you.
//   chair     ('#', 1 tile) a possessed chair: once woken it hops toward you every so often and squashes you if
//             it lands on you; you can stand on it.
//   key       ('#') a piano key; `n` = its place in the tune. Stepping on the next key plays it; a wrong key drops.
//   candles   ('#', columns) a candle on every floor plank; while you are in the air near a candle, the draft of
//             your jump blows it out and the plank under it vanishes.
//   carrier   ('#') a plank a ghost carries back and forth; if you stand on it while looking at the ghost, it
//             drops it.
//   portrait  ('?') a portrait whose eyes follow you; if it sees you for too long (line of sight through solid
//             tiles) it zaps you. Hiding behind solid furniture lets its stare cool down.
//   music     ('?') a music box: while it plays you may move; when it stops, the watcher ghost opens its eyes and
//             anything that moves is zapped.
//   beam      ('#', columns) planks that exist only in the light of a possessed lamp sweeping back and forth.
//   shy       ('#') furniture that slides toward `to` (tiles) only while nobody looks at it.
//   rug       ('#') a flying carpet: carries you right while you stand still on it, sinks while you walk on it.
//   lift      ('#') a lift that a ghost operator pulls up only while your back is turned to the ghost.
//   slamdoor  ('#') art for a door that slams (the trigger uses the condition `{ kind: 'fast', v }`).
//   exitghost ('?', cover = the EXIT) the EXIT bites you from the front; only from behind it is real.
//   mirror    ('?', cover = the frame) a haunted mirror that shows the true floor (`a`..`b` tiles, rows r0..r1).
//   cobweb    ('?') harmless decoration.
import type { Ext, MoveCtx, Scene } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const T = 40;
const S = (s: Scene): any => s;
const st = (s: Scene): any => S(s).ext.l18;
const approach = (v: number, to: number, step: number) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));

// ---------------------------------------------------------------------------------------------------------------
// art (drawn once per texture key, at 2× and shown at half size)

function tex(s: Scene, key: string, w: number, h: number, draw: (g: any) => void): void {
  if (S(s).textures.exists(key)) return;
  const g = S(s).make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w * 2, h * 2);
  g.destroy();
}

function ghostBody(g: any, x: number, y: number, w: number, h: number, shy: boolean, col = 0xf4f1ff): void {
  // a sheet ghost: round head, wavy hem
  g.fillStyle(0x6b5fa8, 0.25).fillEllipse(x + w / 2, y + h - 2, w * 0.9, 8);
  g.fillStyle(col, 1);
  g.fillCircle(x + w / 2, y + w / 2, w / 2);
  g.fillRect(x, y + w / 2, w, h - w / 2 - 8);
  const n = 4, sw = w / n;
  for (let i = 0; i < n; i++) g.fillCircle(x + sw / 2 + i * sw, y + h - 9, sw / 2);
  if (shy) {
    // hands over the eyes
    g.fillStyle(0xe2dcff, 1).fillEllipse(x + w * 0.33, y + w * 0.5, w * 0.3, w * 0.22).fillEllipse(x + w * 0.67, y + w * 0.5, w * 0.3, w * 0.22);
    g.fillStyle(0xff9ec7, 0.8).fillCircle(x + w * 0.22, y + w * 0.72, 4).fillCircle(x + w * 0.78, y + w * 0.72, 4);
  } else {
    g.fillStyle(0x2b2d42, 1).fillEllipse(x + w * 0.35, y + w * 0.48, w * 0.16, w * 0.24).fillEllipse(x + w * 0.65, y + w * 0.48, w * 0.16, w * 0.24);
    g.fillStyle(0xffffff, 1).fillCircle(x + w * 0.37, y + w * 0.43, 2.5).fillCircle(x + w * 0.67, y + w * 0.43, 2.5);
    g.fillStyle(0x2b2d42, 1).fillEllipse(x + w / 2, y + w * 0.78, w * 0.16, w * 0.12);
    g.fillStyle(0xff9ec7, 0.7).fillCircle(x + w * 0.2, y + w * 0.66, 4).fillCircle(x + w * 0.8, y + w * 0.66, 4);
  }
}

function makeArt(s: Scene): void {
  tex(s, 'l18-ghost', 40, 44, (g) => ghostBody(g, 6, 4, 68, 82, false));
  tex(s, 'l18-ghost-shy', 40, 44, (g) => ghostBody(g, 6, 4, 68, 82, true));
  tex(s, 'l18-ghost-big', 80, 88, (g) => ghostBody(g, 8, 6, 144, 166, false, 0xe9e4ff));
  tex(s, 'l18-ghost-sleep', 80, 88, (g) => {
    ghostBody(g, 8, 6, 144, 166, true, 0xe9e4ff);
  });
  tex(s, 'l18-plank', 40, 40, (g) => {
    g.fillStyle(0xb9b2ff, 0.85).fillRoundedRect(2, 4, 76, 30, 8);
    g.fillStyle(0xe8e5ff, 0.9).fillRect(8, 10, 64, 4);
    g.fillStyle(0x7a6fd0, 0.9).fillCircle(14, 20, 3).fillCircle(66, 20, 3);
  });
  tex(s, 'l18-wood', 40, 40, (g) => {
    g.fillStyle(0x6b3f2a, 1).fillRect(0, 0, 80, 80);
    g.fillStyle(0x8a5536, 1).fillRect(0, 4, 80, 20).fillRect(0, 44, 80, 20);
    g.fillStyle(0x4a2a1c, 1).fillRect(0, 0, 80, 4).fillRect(0, 40, 80, 4).fillRect(38, 4, 4, 36);
  });
  tex(s, 'l18-candle', 40, 40, (g) => {
    g.fillStyle(0xfff4d6, 1).fillRoundedRect(30, 30, 20, 50, 4);
    g.fillStyle(0xe8d9b0, 1).fillRect(30, 70, 20, 10);
    g.fillStyle(0x2b2d42, 1).fillRect(39, 22, 3, 9);
  });
  tex(s, 'l18-flame', 20, 24, (g) => {
    g.fillStyle(0xffb03a, 1).fillEllipse(20, 28, 18, 30);
    g.fillStyle(0xfff27a, 1).fillEllipse(20, 32, 9, 16);
  });
  tex(s, 'l18-key', 40, 40, (g) => {
    g.fillStyle(0x2b2d42, 1).fillRect(0, 0, 80, 80);
    g.fillStyle(0xfdfbf2, 1).fillRoundedRect(3, 3, 74, 74, 6);
    g.fillStyle(0x2b2d42, 1).fillRect(0, 3, 14, 40).fillRect(66, 3, 14, 40);
  });
  tex(s, 'l18-chair', 40, 64, (g) => {
    // backrest above the seat (the seat is the solid tile: the bottom 40 px)
    g.fillStyle(0x7a3e22, 1).fillRect(6, 4, 10, 60).fillRect(64, 4, 10, 60).fillRoundedRect(6, 2, 68, 18, 6);
    g.fillStyle(0xfff27a, 1).fillCircle(28, 34, 6).fillCircle(52, 34, 6);
    g.fillStyle(0x2b2d42, 1).fillCircle(29, 35, 3).fillCircle(53, 35, 3);
    g.fillStyle(0x9b5a32, 1).fillRoundedRect(0, 48, 80, 16, 4);
    g.fillStyle(0x7a3e22, 1).fillRect(6, 64, 10, 64).fillRect(64, 64, 10, 64);
  });
  tex(s, 'l18-cobweb', 80, 80, (g) => {
    g.lineStyle(2, 0xeeeeff, 0.75);
    const cx = 80, cy = 30;
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.05 + (i / 8) * 0.9); g.lineBetween(cx, cy, cx + Math.cos(a) * 150, cy + Math.sin(a) * 140); }
    for (let r = 25; r < 150; r += 25) {
      g.beginPath();
      for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.05 + (i / 8) * 0.9); const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.93; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.strokePath();
    }
    g.lineBetween(cx, 0, cx, 92);
    g.fillStyle(0x2b2d42, 1).fillCircle(cx, 100, 12).fillCircle(cx, 86, 8);
    g.lineStyle(3, 0x2b2d42, 1);
    for (const d of [-1, 1]) for (let k = 0; k < 3; k++) g.lineBetween(cx, 98 + k * 4, cx + d * 22, 90 + k * 10);
    g.fillStyle(0xff4d6d, 1).fillCircle(cx - 4, 84, 2.5).fillCircle(cx + 4, 84, 2.5);
  });
  tex(s, 'l18-frame', 80, 80, (g) => {
    g.fillStyle(0xc99a2e, 1).fillRoundedRect(0, 0, 160, 160, 10);
    g.fillStyle(0x8a6418, 1).fillRoundedRect(10, 10, 140, 140, 6);
    g.fillStyle(0x3d3355, 1).fillRect(18, 18, 124, 124);
    // a stern old face
    g.fillStyle(0xd9c3a5, 1).fillEllipse(80, 84, 76, 92);
    g.fillStyle(0x5b4a3a, 1).fillEllipse(80, 44, 84, 34);
    g.fillStyle(0xffffff, 1).fillEllipse(62, 76, 22, 16).fillEllipse(98, 76, 22, 16);
    g.fillStyle(0x7a4b3a, 1).fillRect(66, 108, 28, 5);
  });
  tex(s, 'l18-pupil', 6, 6, (g) => g.fillStyle(0xd7263d, 1).fillCircle(6, 6, 5));
  tex(s, 'l18-musicbox', 40, 40, (g) => {
    g.fillStyle(0x9b5de5, 1).fillRoundedRect(6, 30, 68, 46, 6);
    g.fillStyle(0xffd23f, 1).fillRect(6, 44, 68, 6);
    g.fillStyle(0x5a3a8a, 1).fillRoundedRect(2, 22, 76, 14, 5);
    g.fillStyle(0xc0c0c0, 1).fillRect(74, 50, 10, 4).fillRect(80, 40, 4, 14);
  });
  tex(s, 'l18-note', 14, 18, (g) => {
    g.fillStyle(0xfff6d5, 1).fillEllipse(10, 28, 14, 10).fillRect(15, 2, 3, 26).fillRect(15, 2, 12, 5);
  });
  tex(s, 'l18-lamp', 60, 50, (g) => {
    g.fillStyle(0x2b2d42, 1).fillRect(58, 0, 4, 20);
    g.fillStyle(0xe85d75, 1).fillTriangle(60, 16, 6, 84, 114, 84);
    g.fillStyle(0xc2405a, 1).fillRect(6, 78, 108, 8);
    g.fillStyle(0xffffff, 1).fillCircle(44, 56, 9).fillCircle(76, 56, 9);
    g.fillStyle(0x2b2d42, 1).fillCircle(46, 58, 5).fillCircle(78, 58, 5);
    g.fillStyle(0xfff27a, 1).fillCircle(60, 92, 10);
  });
  tex(s, 'l18-sideboard', 40, 40, (g) => {
    g.fillStyle(0x5c3520, 1).fillRect(0, 0, 80, 80);
    g.fillStyle(0x83502f, 1).fillRect(4, 6, 72, 30).fillRect(4, 42, 72, 32);
    g.fillStyle(0xffd23f, 1).fillCircle(40, 21, 4).fillCircle(40, 58, 4);
  });
  tex(s, 'l18-eyes', 40, 20, (g) => {
    g.fillStyle(0xfff27a, 1).fillEllipse(26, 20, 22, 16).fillEllipse(54, 20, 22, 16);
    g.fillStyle(0x2b2d42, 1).fillCircle(28, 21, 5).fillCircle(56, 21, 5);
  });
  tex(s, 'l18-cloud', 40, 40, (g) => {
    g.fillStyle(0xf4f1ff, 1).fillRoundedRect(0, 8, 80, 30, 14);
    g.fillStyle(0xdcd6ff, 1).fillCircle(20, 40, 10).fillCircle(60, 40, 10);
  });
  tex(s, 'l18-face', 40, 40, (g) => {
    g.fillStyle(0x2b2d42, 1).fillEllipse(26, 30, 12, 18).fillEllipse(54, 30, 12, 18).fillEllipse(40, 52, 16, 10);
    g.fillStyle(0xff9ec7, 0.8).fillCircle(14, 44, 5).fillCircle(66, 44, 5);
  });
  tex(s, 'l18-door', 40, 80, (g) => {
    g.fillStyle(0x4a2a1c, 1).fillRect(0, 0, 80, 160);
    g.fillStyle(0x7a4428, 1).fillRect(6, 6, 68, 148);
    g.fillStyle(0x4a2a1c, 1).fillRect(12, 20, 56, 4).fillRect(12, 136, 56, 4);
    g.fillStyle(0xff4d6d, 1).fillTriangle(16, 52, 34, 60, 16, 64).fillTriangle(64, 52, 46, 60, 64, 64);
    g.fillStyle(0xfdfbf2, 1);
    for (let i = 0; i < 4; i++) g.fillTriangle(20 + i * 11, 96, 31 + i * 11, 96, 25 + i * 11, 108);
    g.fillStyle(0xffd23f, 1).fillCircle(62, 116, 5);
  });
  tex(s, 'l18-rug', 40, 40, (g) => {
    g.fillStyle(0xb5179e, 1).fillRect(0, 2, 80, 26);
    g.fillStyle(0xffd23f, 1).fillRect(0, 6, 80, 3).fillRect(0, 21, 80, 3);
    g.fillStyle(0x7209b7, 1).fillTriangle(30, 15, 40, 9, 50, 15).fillTriangle(30, 15, 40, 21, 50, 15);
  });
  tex(s, 'l18-tassel', 10, 40, (g) => {
    g.fillStyle(0xffd23f, 1);
    for (let i = 0; i < 3; i++) g.fillRect(4 + i * 6, 4, 3, 22 + (i % 2) * 6);
  });
  tex(s, 'l18-lift', 40, 40, (g) => {
    g.fillStyle(0x6b3f2a, 1).fillRect(0, 0, 80, 26);
    g.fillStyle(0x8a5536, 1).fillRect(4, 4, 72, 10);
    g.fillStyle(0xc9c1a8, 1).fillRect(6, 26, 4, 54).fillRect(70, 26, 4, 54);
  });
  tex(s, 'l18-rope', 4, 40, (g) => g.fillStyle(0xc9b27a, 1).fillRect(2, 0, 4, 80));
  tex(s, 'l18-smoke', 20, 20, (g) => g.fillStyle(0xd0d0e0, 0.8).fillCircle(20, 20, 16));
}

/** an image in a group's container (world position, half-size art) */
function img(s: Scene, g: any, x: number, y: number, key: string, ox = 0.5, oy = 0.5): any {
  const im = S(s).add.image(x, y, key).setOrigin(ox, oy).setScale(0.5);
  g.container.add(im);
  return im;
}

// ---------------------------------------------------------------------------------------------------------------

const heroRect = (s: Scene) => S(s).playerRect(0);
const overlapR = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** does the hero overlap any tile of the group (at its current offset)? */
function heroInside(s: Scene, g: any, tiles = g.tiles): boolean {
  const pr = heroRect(s);
  return tiles.some((t: any) => overlapR(pr, { x: t.tx * T + g.ox, y: t.ty * T + g.oy, w: T, h: T }));
}
/** solid on/off (planks that appear do not appear around the hero: they wait until he is out of them) */
function setSolid(s: Scene, g: any, want: boolean): void {
  if (want === g.solid) return;
  if (want && heroInside(s, g)) return;
  g.solid = want;
}
/** move a group to an offset this tick (bodies follow; a rider is carried by dx/dy) */
function moveTo(g: any, ox: number, oy: number): void {
  g.dx += ox - g.ox;
  g.dy += oy - g.oy;
  g.ox = ox;
  g.oy = oy;
  for (const z of g.bodies) {
    const base = z.getData('base');
    z.setPosition(base.x + ox, base.y + oy);
  }
}
const hx = (s: Scene) => S(s).pbody.center.x;
const hy = (s: Scene) => S(s).pbody.center.y;
/** is the hero facing the point x? */
const looksAt = (s: Scene, x: number, slack = 0) => st(s).face * (x - hx(s)) > slack;
/** per-column body on / off and the column's art */
function setColumn(g: any, col: number, on: boolean): void {
  for (const z of g.bodies) if (Math.floor(z.getData('base').x / T) === col) z.body.enable = on;
}

function kill(s: Scene, g: any, cause: string): void {
  S(s).troll(g.def.troll);
  S(s).kill(cause);
}

export const l18: Ext = {
  name: 'l18',

  init(s) {
    S(s).ext.l18 = { on: S(s).lvl?.id === 18, face: 1, dir: 0, piano: {}, music: 1, gaze: 0, beam: 0, chair: 0 };
    if (st(s).on) makeArt(s);
  },

  group(s, g) {
    const k = g.def.ext?.kind;
    if (!k || !st(s).on) return;
    const e = g.def.ext;
    const tiles = g.tiles;
    const minX = Math.min(...tiles.map((t: any) => t.tx)), maxX = Math.max(...tiles.map((t: any) => t.tx));
    const minY = Math.min(...tiles.map((t: any) => t.ty));
    g.l18 = { t: 0 };
    const hideTerrain = () => g.img?.setVisible(false);
    const each = (key: string, alpha = 1) => tiles.map((t: any) => img(s, g, t.tx * T + T / 2, t.ty * T + T / 2, key).setAlpha(alpha));
    switch (k) {
      case 'ghost':
        g.l18 = { x: g.cx, y: g.cy, active: false, im: img(s, g, g.cx, g.cy, 'l18-ghost'), gone: false };
        break;
      case 'gaze':
      case 'front':
        hideTerrain();
        g.l18.ims = k === 'gaze' ? each('l18-plank') : each('l18-cloud');
        if (k === 'front') g.l18.face = img(s, g, g.cx, minY * T + 18, 'l18-face');
        break;
      case 'chair':
        hideTerrain();
        g.l18 = { phase: 'rest', t: 0, fx: 0, tx: 0, active: false, ox: 0 };
        img(s, g, g.cx, (minY + 1) * T, 'l18-chair', 0.5, 1);
        break;
      case 'key':
        hideTerrain();
        g.l18 = { played: false, ims: each('l18-key') };
        break;
      case 'candles':
        hideTerrain();
        g.l18 = { lit: new Map() };
        for (const t of tiles) {
          const wood = img(s, g, t.tx * T + T / 2, t.ty * T + T / 2, 'l18-wood');
          const candle = img(s, g, t.tx * T + T / 2, t.ty * T - 18, 'l18-candle');
          const flame = img(s, g, t.tx * T + T / 2, t.ty * T - 42, 'l18-flame');
          g.l18.lit.set(t.tx, { wood, candle, flame });
        }
        break;
      case 'carrier':
        hideTerrain();
        each('l18-plank');
        g.l18 = { pos: 0, dir: 1, wait: 0, dropped: false, ghost: img(s, g, g.cx, minY * T - 26, 'l18-ghost') };
        break;
      case 'portrait': {
        const x = g.cx, y = g.cy;
        img(s, g, x, y, 'l18-frame');
        g.l18 = { seen: 0, eyes: [img(s, g, x - 9, y - 2, 'l18-pupil'), img(s, g, x + 9, y - 2, 'l18-pupil')], ray: S(s).add.graphics() };
        g.container.add(g.l18.ray);
        break;
      }
      case 'music': {
        img(s, g, g.cx, g.cy, 'l18-musicbox');
        const wx = e.watch[0] * T + T, wy = e.watch[1] * T + T;
        g.l18 = { t: 0, notes: [0, 1, 2].map(() => img(s, g, g.cx, g.cy - 30, 'l18-note')), big: img(s, g, wx, wy, 'l18-ghost-sleep') };
        break;
      }
      case 'beam': {
        hideTerrain();
        g.l18 = { cols: new Map(), cone: S(s).add.graphics().setDepth(-0.4), lamp: null };
        S(s).track(g.l18.cone);
        for (const t of tiles) g.l18.cols.set(t.tx, img(s, g, t.tx * T + T / 2, t.ty * T + T / 2, 'l18-plank'));
        g.l18.lamp = S(s).track(S(s).add.image(e.lamp[0] * T + T / 2, e.lamp[1] * T, 'l18-lamp').setOrigin(0.5, 0).setScale(0.5).setDepth(3));
        break;
      }
      case 'shy':
        hideTerrain();
        each('l18-sideboard');
        img(s, g, g.cx, g.cy - 4, 'l18-eyes');
        g.l18 = { p: 0 };
        break;
      case 'rug':
        hideTerrain();
        each('l18-rug');
        img(s, g, minX * T, minY * T + 14, 'l18-tassel', 1, 0.5);
        img(s, g, (maxX + 1) * T, minY * T + 14, 'l18-tassel', 0, 0.5).setFlipX(true);
        g.l18 = { pos: 0, sunk: 0, done: false };
        break;
      case 'lift': {
        hideTerrain();
        each('l18-lift');
        const ropeX = g.cx;
        const rope = S(s).add.tileSprite(ropeX, 0, 4, minY * T, 'l18-rope').setOrigin(0.5, 0);
        g.container.add(rope);
        const gh = S(s).track(S(s).add.image(e.ghost[0] * T + T / 2, e.ghost[1] * T + T / 2, 'l18-ghost').setScale(0.5).setDepth(3));
        g.l18 = { rope, gh, top: minY * T };
        break;
      }
      case 'slamdoor':
        hideTerrain();
        img(s, g, minX * T, minY * T, 'l18-door', 0, 0);
        break;
      case 'exitghost':
        g.l18 = { face: img(s, g, minX * T + 8, (minY + 1) * T - 4, 'l18-face').setAlpha(0.8) };
        g.container.setDepth(4);
        break;
      case 'wardrobe':
        each('l18-sideboard');
        for (const t of tiles) if (!tiles.some((u: any) => u.tx === t.tx && u.ty === t.ty - 1)) img(s, g, t.tx * T + T / 2, t.ty * T + 12, 'l18-eyes').setScale(0.4);
        g.container.setDepth(1);
        break;
      case 'cobweb':
        img(s, g, minX * T, minY * T, 'l18-cobweb', 0, 0);
        break;
      case 'mirror':
        drawMirror(s, g);
        break;
    }
  },

  action(s, a) {
    if (!a.ext.startsWith('l18.') || !st(s).on) return false;
    const g = a.g ? S(s).groups.get(a.g) : null;
    if (a.ext === 'l18.wake' && g) {
      g.visible = true;
      g.container.setVisible(true).setAlpha(0);
      S(s).tweens.add({ targets: g.container, alpha: 1, duration: 250 });
      if (g.l18.active !== undefined) g.l18.active = true;
      S(s).sfx('hehe');
      return 'trap';
    }
    if (a.ext === 'l18.tune') {
      st(s).tune = S(s).levelTick;
      return true;
    }
    return false;
  },

  when(s, w) {
    if (w.kind === 'fast') return Math.abs(S(s).pbody.velocity.x) > w.v;
    return undefined;
  },

  move(s, m: MoveCtx) {
    const o = st(s);
    if (!o?.on) return;
    o.dir = m.dir;
    if (m.dir !== 0) o.face = m.dir;
  },

  tick(s) {
    const o = st(s);
    if (!o.on) return;
    const sc = S(s);
    for (const g of sc.groups.values()) {
      const e = g.def.ext;
      if (!e) continue;
      switch (e.kind) {
        case 'ghost': ghostTick(s, g); break;
        case 'gaze': setSolid(s, g, o.face === e.face); break;
        case 'front': setSolid(s, g, o.face * (g.cx + g.ox - hx(s)) >= 0); break;
        case 'chair': chairTick(s, g); break;
        case 'key': keyTick(s, g); break;
        case 'candles': candleTick(s, g); break;
        case 'carrier': carrierTick(s, g); break;
        case 'portrait': portraitTick(s, g); break;
        case 'music': musicTick(s, g); break;
        case 'beam': beamTick(s, g); break;
        case 'shy': {
          const len = Math.hypot(e.to[0], e.to[1]) * T;
          if (g.l18.p < len && !looksAt(s, g.cx + g.ox)) {
            g.l18.p = Math.min(len, g.l18.p + e.speed);
            const f = g.l18.p / len;
            moveTo(g, e.to[0] * T * f, e.to[1] * T * f);
          }
          break;
        }
        case 'rug': {
          const r = g.l18;
          if (sc.ride === g && !r.done) {
            if (o.dir !== 0) r.sunk = Math.min(e.maxSink * T, r.sunk + e.sink);
            else r.pos = Math.min(e.range * T, r.pos + e.speed);
            if (r.pos >= e.range * T) r.done = true;
            moveTo(g, r.pos, r.sunk);
          }
          break;
        }
        case 'lift': {
          const up = sc.ride === g && !looksAt(s, e.ghost[0] * T + T / 2);
          let oy = up ? Math.max(-e.rise * T, g.oy - e.speed) : sc.ride === g ? g.oy : Math.min(0, g.oy + e.back);
          // it does not come down onto the hero
          if (oy > g.oy && heroInside(s, { ...g, oy }, g.tiles)) oy = g.oy;
          moveTo(g, 0, oy);
          break;
        }
      }
    }
  },

  interact(s) {
    const o = st(s);
    if (!o.on) return;
    const sc = S(s);
    for (const g of sc.groups.values()) {
      const e = g.def.ext;
      if (!e) continue;
      if (e.kind === 'ghost' && g.l18.active && !g.l18.gone) {
        if (Math.abs(g.l18.x - hx(s)) < 24 && Math.abs(g.l18.y - hy(s)) < 27) { kill(s, g, 'ghost'); return; }
      }
      if (e.kind === 'chair' && g.l18.phase === 'hop' && g.l18.vy > 0) {
        const pr = heroRect(s);
        const box = { x: g.tiles[0].tx * T + g.ox + 4, y: g.tiles[0].ty * T + g.oy, w: T - 8, h: T };
        if (overlapR(pr, box) && hy(s) > box.y + 12) { kill(s, g, 'crush'); return; }
      }
      if (e.kind === 'exitghost' && sc.door && o.face > 0) {
        const d = sc.doorPos;
        if (overlapR(sc.playerRect(3), { x: d.x - 12, y: d.y - 60, w: 24, h: 52 })) {
          sc.door.chomp();
          sc.sfx('chomp');
          kill(s, g, 'fakedoor');
          return;
        }
      }
    }
  },

  render(s) {
    const o = st(s);
    if (!o?.on) return;
    const sc = S(s);
    patchHero(s);
    for (const g of sc.groups.values()) {
      const e = g.def.ext;
      if (!e) continue;
      const r = g.l18;
      switch (e.kind) {
        case 'ghost':
          if (r.im) {
            const frozen = e.mode === 'boo' && looksAt(s, r.x);
            r.im.setTexture(frozen ? 'l18-ghost-shy' : 'l18-ghost');
            r.im.setFlipX(r.x > hx(s));
            r.im.y = g.cy + Math.sin(sc.levelTick / 9) * 3;
          }
          break;
        case 'gaze':
        case 'front':
          for (const im of r.ims) im.setAlpha(g.solid ? 0.95 : 0.14);
          if (r.face) r.face.setAlpha(g.solid ? 1 : 0.2);
          break;
        case 'key': {
          const tuneN = o.tune !== undefined && !Object.keys(o.piano).length ? Math.floor((sc.levelTick - o.tune) % 150 / 24) : -1;
          const on = r.played || e.n === tuneN;
          for (const im of r.ims) im.setTint(on ? 0xffe27a : 0xffffff);
          break;
        }
        case 'carrier':
          r.ghost.setTexture(sc.ride === g ? 'l18-ghost' : 'l18-ghost').setFlipX(hx(s) < g.cx + g.ox);
          r.ghost.y = g.tiles[0].ty * T - 26 + Math.sin(sc.levelTick / 8) * 2;
          break;
        case 'portrait': {
          const ex = g.cx, ey = g.cy;
          const a = Math.atan2(hy(s) - ey, hx(s) - ex);
          r.eyes[0].setPosition(ex - 9 + Math.cos(a) * 3, ey - 2 + Math.sin(a) * 3);
          r.eyes[1].setPosition(ex + 9 + Math.cos(a) * 3, ey - 2 + Math.sin(a) * 3);
          r.ray.clear();
          if (r.seen > 0 && r.sees) r.ray.lineStyle(2 + (r.seen / e.limit) * 4, 0xff4d6d, 0.15 + (r.seen / e.limit) * 0.6).lineBetween(ex, ey, hx(s), hy(s));
          break;
        }
        case 'music': {
          const playing = o.music === 1;
          r.notes.forEach((n: any, i: number) => {
            const p = ((sc.levelTick + i * 20) % 60) / 60;
            n.setVisible(playing).setPosition(g.cx - 10 + i * 12 + Math.sin(p * 6) * 6, g.cy - 24 - p * 40).setAlpha(1 - p);
          });
          r.big.setTexture(playing ? 'l18-ghost-sleep' : 'l18-ghost-big');
          break;
        }
        case 'beam': {
          const c = r.cone;
          c.clear();
          const lx = e.lamp[0] * T + T / 2, ly = e.lamp[1] * T + 46;
          const fy = (Math.min(...g.tiles.map((t: any) => t.ty))) * T;
          c.fillStyle(0xfff27a, 0.22).fillTriangle(lx - 10, ly, lx + 10, ly, o.beam + e.half, fy);
          c.fillTriangle(lx - 10, ly, o.beam - e.half, fy, o.beam + e.half, fy);
          r.lamp.setRotation(Math.atan2(o.beam - lx, fy - ly) * -0.5);
          for (const [col, im] of r.cols) im.setAlpha(r.on?.get(col) ? 0.95 : 0.12);
          break;
        }
        case 'lift':
          r.rope.height = Math.max(1, r.top + g.oy);
          r.rope.y = -g.oy;
          r.gh.setTexture(looksAt(s, r.gh.x) ? 'l18-ghost-shy' : 'l18-ghost').setFlipX(true);
          break;
        case 'mirror':
          if (r.dot) {
            const inX = hx(s) >= e.a * T && hx(s) < (e.b + 1) * T;
            r.dot.setVisible(inX || true).setPosition(r.mx(hx(s)), r.my(hy(s)));
          }
          break;
        case 'exitghost':
          r.face.setAlpha(0.55 + Math.sin(sc.levelTick / 12) * 0.3);
          break;
      }
    }
  },

  snapshot(s) {
    const o = st(s);
    if (!o?.on) return {};
    return { face: o.face, music: o.music, gaze: o.gaze, beam: Math.round(o.beam), chair: o.chair };
  },
};

/** the hero's sprite faces the way he looks (also while he drifts backwards in the air) */
function patchHero(s: Scene): void {
  const h = S(s).hero;
  if (!h || h.__l18) return;
  h.__l18 = true;
  const orig = h.animate.bind(h);
  h.animate = (dt: number, vx: number, ...rest: any[]) => {
    orig(dt, vx, ...rest);
    if (h.dead) return;
    const f = st(s)?.face ?? 1;
    h.facing = f;
    h.rig.scaleX = Math.abs(h.rig.scaleX) * f;
  };
}

// ---------------------------------------------------------------------------------------------------------------

function ghostTick(s: Scene, g: any): void {
  const r = g.l18, e = g.def.ext;
  if (!r.active || r.gone) return;
  if (e.until !== undefined && hx(s) > e.until * T) {
    r.gone = true;
    S(s).tweens.add({ targets: g.container, alpha: 0, duration: 400 });
    return;
  }
  if (e.mode === 'boo') {
    if (!looksAt(s, r.x)) {
      const dx = hx(s) - r.x, dy = hy(s) - 4 - r.y;
      const d = Math.hypot(dx, dy) || 1;
      r.x += (dx / d) * e.speed;
      r.y += (dy / d) * e.speed;
    }
  } else if (e.mode === 'mirror') {
    const want = Math.max(e.min * T, Math.min(e.max * T, 2 * e.axis * T - hx(s)));
    r.x = approach(r.x, want, 12);
  }
  g.ox = r.x - g.cx;
  g.oy = r.y - g.cy;
}

function chairTick(s: Scene, g: any): void {
  const r = g.l18, e = g.def.ext;
  if (!r.active) {
    if (hx(s) > e.wake * T) r.active = true;
    else return;
  }
  st(s).chair = r.phase === 'rest' ? 0 : 1;
  if (r.phase === 'rest') {
    r.t++;
    if (r.t >= e.rest) {
      const dx = Math.max(-e.hop * T, Math.min(e.hop * T, hx(s) - (g.cx + g.ox)));
      r.fx = g.ox;
      r.tx = Math.max(e.min * T, Math.min(e.max * T, g.ox + dx));
      r.phase = 'hop';
      r.t = 0;
      r.vy = -1;
      S(s).sfx('jump');
    }
    return;
  }
  r.t++;
  const p = Math.min(1, r.t / e.air);
  const oy = -4 * e.h * p * (1 - p);
  r.vy = p < 0.5 ? -1 : 1;
  moveTo(g, r.fx + (r.tx - r.fx) * p, oy);
  if (p >= 1) {
    r.phase = 'rest';
    r.t = 0;
    r.vy = 0;
    S(s).sfx('land');
  }
}

function keyTick(s: Scene, g: any): void {
  const r = g.l18, e = g.def.ext, o = st(s);
  if (S(s).ride !== g || r.played || r.broken) return;
  const next = o.piano[e.piano] ?? 0;
  if (e.n === next) {
    r.played = true;
    o.piano[e.piano] = next + 1;
    S(s).sfx('coin');
  } else {
    r.broken = true;
    S(s).troll(g.def.troll);
    S(s).runActions([{ fall: g.id, shake: 4 }]);
  }
}

function candleTick(s: Scene, g: any): void {
  const sc = S(s);
  if (sc.grounded) return;
  const x = hx(s), y = hy(s);
  const top = g.tiles[0].ty * T;
  if (y < top - 5 * T || y > top + T) return;
  for (const [col, c] of g.l18.lit) {
    if (Math.abs(col * T + T / 2 - x) > 46) continue;
    g.l18.lit.delete(col);
    setColumn(g, col, false);
    c.flame.setVisible(false);
    sc.tweens.add({ targets: [c.wood, c.candle], alpha: 0, y: '+=30', duration: 220 });
    const puff = img(s, g, col * T + T / 2, top - 44, 'l18-smoke');
    sc.tweens.add({ targets: puff, alpha: 0, y: '-=30', scale: 1, duration: 500 });
    sc.troll(g.def.troll);
    sc.sfx('crumble');
  }
}

function carrierTick(s: Scene, g: any): void {
  const r = g.l18, e = g.def.ext, sc = S(s);
  if (r.dropped || g.state !== 'idle') return;
  const gx = g.cx + g.ox;
  if (sc.ride === g && looksAt(s, gx, -4)) {
    r.dropped = true;
    sc.troll(g.def.troll);
    sc.runActions([{ fall: g.id, shake: 8 }]);
    sc.tweens.add({ targets: r.ghost, alpha: 0, y: '-=80', duration: 500 });
    return;
  }
  if (r.wait > 0) { r.wait--; return; }
  r.pos += r.dir * e.speed;
  if (r.pos >= e.range * T) { r.pos = e.range * T; r.dir = -1; r.wait = e.pause; }
  if (r.pos <= 0) { r.pos = 0; r.dir = 1; r.wait = e.pause; }
  moveTo(g, r.pos, 0);
}

function portraitTick(s: Scene, g: any): void {
  const r = g.l18, e = g.def.ext, sc = S(s);
  const x = hx(s), y = hy(s);
  if (x < e.x0 * T || x > e.x1 * T) { r.seen = 0; r.sees = false; st(s).gaze = 0; return; }
  // line of sight from the eyes to the hero, through the static terrain
  const ex = g.cx, ey = g.cy;
  const n = Math.ceil(Math.hypot(x - ex, y - ey) / 8);
  let clear = true;
  for (let i = 1; i < n; i++) {
    const px = ex + ((x - ex) * i) / n, py = ey + ((y - ey) * i) / n;
    if (sc.staticSolid.has(Math.floor(py / T) * 10000 + Math.floor(px / T))) { clear = false; break; }
  }
  r.sees = clear;
  r.seen = clear ? r.seen + 1 : Math.max(0, r.seen - 1);
  st(s).gaze = r.seen;
  if (r.seen >= e.limit) {
    sc.cameras.main.flash(120, 255, 80, 110, false);
    kill(s, g, 'zap');
  }
}

function musicTick(s: Scene, g: any): void {
  const r = g.l18, e = g.def.ext, o = st(s), sc = S(s);
  const x = hx(s);
  if (x < e.x0 * T || x > e.x1 * T) { o.music = 1; return; }
  const ph = r.t % (e.play + e.rest);
  r.t++;
  const playing = ph < e.play;
  if (o.music === 1 && !playing) sc.sfx('click');
  o.music = playing ? 1 : 0;
  if (!playing && ph - e.play >= e.grace && (Math.abs(sc.pbody.velocity.x) > 15 || !sc.grounded)) {
    sc.cameras.main.flash(120, 200, 160, 255, false);
    kill(s, g, 'music');
  }
}

function beamTick(s: Scene, g: any): void {
  const e = g.def.ext, o = st(s);
  const a = e.a * T + T / 2, b = e.b * T + T / 2;
  const span = b - a;
  const d = (S(s).levelTick * e.speed + (e.phase ?? 0)) % (2 * span);
  o.beam = a + (d < span ? d : 2 * span - d);
  g.l18.on ??= new Map();
  for (const t of g.tiles) {
    const lit = Math.abs(t.tx * T + T / 2 - o.beam) <= e.half;
    const was = g.l18.on.get(t.tx) ?? true;
    let now = lit;
    // a plank does not appear inside the hero
    if (lit && !was && heroInside(s, g, [t])) now = false;
    g.l18.on.set(t.tx, now);
    setColumn(g, t.tx, now);
  }
}

/** the haunted mirror: a frame on the wall showing the true floor below it (fake floor missing, hidden floor there) */
function drawMirror(s: Scene, g: any): void {
  const sc = S(s), e = g.def.ext, L = sc.lvl;
  const tiles = g.tiles;
  const x0 = Math.min(...tiles.map((t: any) => t.tx)) * T, y0 = Math.min(...tiles.map((t: any) => t.ty)) * T;
  const x1 = (Math.max(...tiles.map((t: any) => t.tx)) + 1) * T, y1 = (Math.max(...tiles.map((t: any) => t.ty)) + 1) * T;
  const gfx = sc.add.graphics();
  g.container.add(gfx);
  gfx.fillStyle(0x8a6418, 1).fillRoundedRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16, 12);
  gfx.fillStyle(0xc99a2e, 1).fillRoundedRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, 9);
  gfx.fillStyle(0x2e3a5c, 1).fillRect(x0, y0, x1 - x0, y1 - y0);
  gfx.fillStyle(0x3f5080, 1).fillRect(x0, y0, x1 - x0, (y1 - y0) * 0.45);
  const cols = e.b - e.a + 1, rows = e.r1 - e.r0 + 1;
  const cw = (x1 - x0 - 8) / cols, ch = Math.min(cw, (y1 - y0 - 8) / rows);
  const ox = x0 + 4, oy = y1 - 4 - rows * ch;
  const gdefs = L.groups ?? {};
  for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
    const tx = e.a + c, ty = e.r0 + rr;
    const chr = L.map[ty][tx];
    const gd = gdefs[chr];
    const solid = chr === '#' || (gd && gd.tile === '#' && !gd.fake);
    const spike = chr === '^' || (gd && gd.tile === '^');
    const px = ox + c * cw, py = oy + rr * ch;
    if (solid) gfx.fillStyle(gd?.invisible ? 0xb9f3ff : 0x9aa6c8, 1).fillRect(px, py, cw + 0.5, ch + 0.5);
    else if (spike) gfx.fillStyle(0xff4d6d, 1).fillTriangle(px + 1, py + ch, px + cw / 2, py + 2, px + cw - 1, py + ch);
  }
  // shine
  gfx.lineStyle(3, 0xffffff, 0.35).lineBetween(x0 + 10, y0 + 30, x0 + 30, y0 + 10).lineBetween(x0 + 16, y0 + 44, x0 + 44, y0 + 16);
  const dot = sc.add.image(0, 0, 'l18-ghost').setScale(Math.max(0.12, ch / 80)).setTint(0x9bf6a1);
  g.container.add(dot);
  g.l18 = {
    dot,
    mx: (x: number) => Math.max(x0 + 4, Math.min(x1 - 4, ox + (x / T - e.a) * cw)),
    my: (y: number) => Math.max(y0 + 4, Math.min(y1 - 4, oy + (y / T - e.r0) * ch)),
  };
}
