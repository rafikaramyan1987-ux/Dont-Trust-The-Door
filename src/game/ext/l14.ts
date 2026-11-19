// Level 14 "Lock and Key": keys you carry and locks that open when you touch them with the right key.
//
// Groups (def.ext.kind):
//   key    – a key to pick up ('?' tile; '#' for a key that lies in a bridge as a plank). ext: { key: colour,
//            heavy?: jump multiplier, glass?: landing speed that breaks it, melt?: ticks, chain?: anchor lock group,
//            len?: chain length (tiles), fish?: it hangs on a fishing line and is yanked away from you,
//            cycle?: [colours] + period: its colour keeps changing }
//            You carry ONE key: picking up another drops the one you hold where you stand.
//   lock   – a door / post / padlock ('#' solid or '?'). ext: { key: colour | 'any', mode?: 'hungry' | 'rusty' |
//            'release', need?: ticks (rusty), start?: actions (rusty: when you start turning), do?: actions when it
//            opens, trap?: true (opening is the trap moment) }. A skeleton key ('bone') opens every lock.
//   bridge – a hidden plank bridge that a lock lowers (drawn as planks)
//   grate  – a metal grate you walk on; a dropped key falls through it
//   bars   – a portcullis (drawn as spiked bars)
//   magpie – a magpie on its perch ('?'): it steals the key when you jump with it and takes it to its nest
//            (ext.nest: the hidden key group there)
//   bat    – a sleeping spiked bat ('?'): running while you carry a key jingles it and wakes the bat (ext.zone)
//   roller – a spiked ball ('*') that bursts when its roll ends
import Phaser from 'phaser';
import type { Ext, Scene, MoveCtx } from './types';
import { RES } from '../../art';

const T = 40;
const N = 'l14';
const OUT = 0x2b2d42;
export const KEY_COLORS: Record<string, number> = {
  gold: 0xffd23f, silver: 0xd5dee8, ice: 0xaeefff, iron: 0x6a7080, glass: 0xe9fdff, bone: 0xf3ead2, ruby: 0xff6b7d,
};
const KINDS = ['key', 'lock', 'bridge', 'grate', 'bars', 'magpie', 'bat', 'roller'];

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Held { g: any; k: string; t: number; chain: any | null }
interface Drop { g: any; vy: number; still: boolean; noPick: boolean }
interface Fish { g: any; to: number | null; up: number }
interface Bird { g: any; state: 'perch' | 'fly' | 'nest' | 'gone'; x: number; y: number; t: number; fx: number; fy: number; img: any; flap: number }
interface Bat { g: any; state: 'sleep' | 'dive' | 'gone'; x: number; y: number; img: any; z: any }
interface St {
  on: boolean;
  keys: Held[];
  drops: Drop[];
  fish: Fish[];
  birds: Bird[];
  bats: Bat[];
  prog: Map<string, number>;
  yankT: number;
  gfx: any;
  icons: any[];
  noteT: number;
}

const st = (s: Scene): St => s.ext[N];
const ext = (g: any) => g.def.ext as Record<string, any> | undefined;
const kind = (g: any) => (g.def.ext?.kind as string | undefined) ?? '';
const overlap = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const heroRect = (s: Scene) => { const b = s.pbody; return { x: b.x, y: b.y, w: b.width, h: b.height }; };

/** one texture drawn at RES resolution (w × h world px) */
function tex(s: Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics, k: number) => void): string {
  if (s.textures.exists(key)) return key;
  const g = s.make.graphics({ x: 0, y: 0 }, false) as Phaser.GameObjects.Graphics;
  draw(g, RES);
  g.generateTexture(key, Math.ceil(w * RES), Math.ceil(h * RES));
  g.destroy();
  return key;
}


/** a key, 36 × 20: ring on the left, teeth on the right */
function keyTex(s: Scene, color: string): string {
  const c = KEY_COLORS[color] ?? KEY_COLORS.gold;
  return tex(s, `l14-key-${color}`, 38, 22, (g, k) => {
    const a = color === 'glass' ? 0.55 : color === 'ice' ? 0.85 : 1;
    g.lineStyle(2.5 * k, OUT, 1);
    g.fillStyle(c, a);
    // shaft + teeth
    g.fillRect(16 * k, 8 * k, 19 * k, 5 * k).strokeRect(16 * k, 8 * k, 19 * k, 5 * k);
    g.fillRect(25 * k, 13 * k, 4 * k, 5 * k).strokeRect(25 * k, 13 * k, 4 * k, 5 * k);
    g.fillRect(31 * k, 13 * k, 4 * k, 7 * k).strokeRect(31 * k, 13 * k, 4 * k, 7 * k);
    // ring
    g.fillCircle(10 * k, 10.5 * k, 8 * k).strokeCircle(10 * k, 10.5 * k, 8 * k);
    g.fillStyle(OUT, 1).fillCircle(10 * k, 10.5 * k, 3.2 * k);
    // shine
    g.fillStyle(0xffffff, color === 'iron' ? 0.35 : 0.7).fillCircle(7 * k, 7 * k, 2 * k).fillRect(19 * k, 9 * k, 10 * k, 1.5 * k);
    if (color === 'bone') {
      // a little skull for a ring
      g.fillStyle(OUT, 1).fillCircle(7.5 * k, 9 * k, 1.6 * k).fillCircle(12.5 * k, 9 * k, 1.6 * k).fillRect(9 * k, 13 * k, 2 * k, 2.5 * k);
    }
    if (color === 'iron') g.fillStyle(0x3b3f4a, 1).fillRect(18 * k, 9.5 * k, 2 * k, 2 * k).fillRect(22 * k, 9.5 * k, 2 * k, 2 * k);
    if (color === 'glass') g.lineStyle(1.2 * k, 0xffffff, 0.9).lineBetween(4 * k, 6 * k, 8 * k, 4 * k).lineBetween(28 * k, 9 * k, 33 * k, 9 * k);
  });
}

/** a big golden key lying flat as a bridge plank, 80 × 40 */
function bigKeyTex(s: Scene): string {
  return tex(s, 'l14-bigkey', 80, 40, (g, k) => {
    const c = KEY_COLORS.gold;
    g.lineStyle(3 * k, OUT, 1).fillStyle(c, 1);
    g.fillRect(16 * k, 2 * k, 62 * k, 13 * k).strokeRect(16 * k, 2 * k, 62 * k, 13 * k);
    g.fillRect(56 * k, 15 * k, 8 * k, 12 * k).strokeRect(56 * k, 15 * k, 8 * k, 12 * k);
    g.fillRect(68 * k, 15 * k, 8 * k, 17 * k).strokeRect(68 * k, 15 * k, 8 * k, 17 * k);
    g.fillCircle(16 * k, 14 * k, 14 * k).strokeCircle(16 * k, 14 * k, 14 * k);
    g.fillStyle(OUT, 1).fillCircle(16 * k, 14 * k, 6 * k);
    g.fillStyle(0xffffff, 0.75).fillRect(22 * k, 4 * k, 40 * k, 3 * k).fillCircle(11 * k, 8 * k, 3 * k);
  });
}

/** a padlock, 24 × 28 */
function padTex(s: Scene, color: string, style: string): string {
  const c = color === 'any' ? KEY_COLORS.gold : KEY_COLORS[color] ?? KEY_COLORS.gold;
  return tex(s, `l14-pad-${color}-${style}`, 26, 30, (g, k) => {
    const body = style === 'rusty' ? 0xb0683a : c;
    g.lineStyle(4 * k, 0x5d6370, 1);
    g.beginPath();
    g.arc(13 * k, 12 * k, 7 * k, Math.PI, 0, false);
    g.strokePath();
    g.lineStyle(2.5 * k, OUT, 1).fillStyle(body, 1);
    g.fillRoundedRect(3 * k, 12 * k, 20 * k, 16 * k, 3 * k).strokeRoundedRect(3 * k, 12 * k, 20 * k, 16 * k, 3 * k);
    if (style === 'hungry') {
      // a mouth for a keyhole: teeth and a tongue
      g.fillStyle(OUT, 1).fillRoundedRect(6 * k, 16 * k, 14 * k, 8 * k, 3 * k);
      g.fillStyle(0xff8fa3, 1).fillEllipse(13 * k, 22.5 * k, 8 * k, 3.5 * k);
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 4; i++) g.fillTriangle((6.5 + i * 3.4) * k, 16 * k, (9.9 + i * 3.4) * k, 16 * k, (8.2 + i * 3.4) * k, 19.5 * k);
    } else {
      g.fillStyle(OUT, 1).fillCircle(13 * k, 18 * k, 2.6 * k).fillRect(11.8 * k, 18 * k, 2.4 * k, 6 * k);
      g.fillStyle(0xffffff, 0.6).fillRect(5 * k, 14 * k, 3 * k, 10 * k);
    }
    if (style === 'rusty') g.fillStyle(0xe28a3c, 1).fillCircle(7 * k, 25 * k, 1.6 * k).fillCircle(19 * k, 15 * k, 1.4 * k).fillCircle(18 * k, 25 * k, 1.2 * k);
    if (color === 'any') g.fillStyle(0xffffff, 0.9).fillCircle(20 * k, 14 * k, 1.5 * k);
  });
}

/** a wooden door / post with iron bands for a lock group (its tile box) */
function doorTex(s: Scene, key: string, w: number, h: number, look: string): string {
  return tex(s, key, w, h, (g, k) => {
    if (look === 'post') {
      g.fillStyle(0x7d7f8c, 1).fillRect(4 * k, 0, (w - 8) * k, h * k);
      g.lineStyle(2.5 * k, OUT, 1).strokeRect(4 * k, 1 * k, (w - 8) * k, (h - 2) * k);
      g.fillStyle(0x9a9caa, 1).fillRect(7 * k, 3 * k, 5 * k, (h - 6) * k);
      return;
    }
    g.fillStyle(0x8a5a33, 1).fillRect(2 * k, 0, (w - 4) * k, h * k);
    g.lineStyle(1.5 * k, 0x5e3a1f, 1);
    for (let x = 12; x < w - 4; x += 12) g.lineBetween(x * k, 2 * k, x * k, (h - 2) * k);
    g.fillStyle(0x4b4f5c, 1);
    for (const y of [h * 0.2, h * 0.8 - 6]) {
      g.fillRect(2 * k, y * k, (w - 4) * k, 6 * k);
      g.fillStyle(0x9aa0ad, 1);
      for (let x = 7; x < w - 4; x += 12) g.fillCircle(x * k, (y + 3) * k, 1.4 * k);
      g.fillStyle(0x4b4f5c, 1);
    }
    g.lineStyle(3 * k, OUT, 1).strokeRect(2 * k, 1.5 * k, (w - 4) * k, (h - 3) * k);
  });
}

function planksTex(s: Scene, key: string, w: number, h: number): string {
  return tex(s, key, w, h, (g, k) => {
    for (let x = 0; x < w; x += 20) {
      g.fillStyle(x % 40 ? 0xb07a45 : 0xc48c52, 1).fillRect((x + 1) * k, 2 * k, 18 * k, 14 * k);
      g.lineStyle(2 * k, OUT, 1).strokeRect((x + 1) * k, 2 * k, 18 * k, 14 * k);
    }
    g.lineStyle(2 * k, 0x6b4a2b, 1).lineBetween(0, 10 * k, w * k, 10 * k);
  });
}

function grateTex(s: Scene, key: string, w: number): string {
  return tex(s, key, w, 40, (g, k) => {
    g.fillStyle(0x4b4f5c, 1).fillRect(0, 0, w * k, 7 * k);
    g.lineStyle(2 * k, OUT, 1).strokeRect(0, 1 * k, w * k, 6 * k);
    for (let x = 4; x < w; x += 9) g.fillStyle(0x6a7080, 1).fillRect(x * k, 7 * k, 3 * k, 22 * k);
    g.fillStyle(0x4b4f5c, 1).fillRect(0, 27 * k, w * k, 4 * k);
  });
}

function barsTex(s: Scene): string {
  return tex(s, 'l14-bars', 40, 40, (g, k) => {
    g.fillStyle(0x4b4f5c, 1).fillRect(0, 0, 40 * k, 6 * k);
    for (let x = 3; x < 40; x += 9) {
      g.fillStyle(0x6a7080, 1).fillRect(x * k, 0, 4 * k, 32 * k);
      g.fillStyle(0xdfe5ee, 1).fillTriangle(x * k - 1 * k, 32 * k, (x + 5) * k, 32 * k, (x + 2) * k, 40 * k);
    }
    g.lineStyle(1.5 * k, OUT, 1).strokeRect(0, 0, 40 * k, 6 * k);
  });
}

function magpieTex(s: Scene): string {
  return tex(s, 'l14-magpie', 46, 34, (g, k) => {
    g.lineStyle(2 * k, OUT, 1);
    // tail
    g.fillStyle(0x23263a, 1).fillTriangle(30 * k, 18 * k, 46 * k, 12 * k, 44 * k, 20 * k);
    // body
    g.fillStyle(0x23263a, 1).fillEllipse(22 * k, 19 * k, 26 * k, 17 * k).strokeEllipse(22 * k, 19 * k, 26 * k, 17 * k);
    g.fillStyle(0xffffff, 1).fillEllipse(19 * k, 23 * k, 14 * k, 8 * k);
    // wing
    g.fillStyle(0x3d7fd6, 1).fillEllipse(26 * k, 16 * k, 13 * k, 7 * k).strokeEllipse(26 * k, 16 * k, 13 * k, 7 * k);
    // head + beak + eye
    g.fillStyle(0x23263a, 1).fillCircle(10 * k, 11 * k, 7 * k).strokeCircle(10 * k, 11 * k, 7 * k);
    g.fillStyle(0x2b2d42, 1).fillTriangle(1 * k, 11 * k, 5 * k, 8.5 * k, 5 * k, 13.5 * k);
    g.fillStyle(0xffffff, 1).fillCircle(9 * k, 9.5 * k, 2.4 * k);
    g.fillStyle(OUT, 1).fillCircle(8.5 * k, 9.5 * k, 1.2 * k);
    // legs
    g.lineStyle(1.5 * k, 0xffb347, 1).lineBetween(20 * k, 27 * k, 19 * k, 33 * k).lineBetween(24 * k, 27 * k, 25 * k, 33 * k);
  });
}

function nestTex(s: Scene): string {
  return tex(s, 'l14-nest', 44, 18, (g, k) => {
    g.fillStyle(0x8a5a33, 1).fillEllipse(22 * k, 11 * k, 42 * k, 13 * k);
    g.lineStyle(1.5 * k, 0x5e3a1f, 1);
    for (let i = 0; i < 7; i++) g.lineBetween((4 + i * 6) * k, 6 * k, (9 + i * 5) * k, 16 * k);
    g.lineStyle(2 * k, OUT, 1).strokeEllipse(22 * k, 11 * k, 42 * k, 13 * k);
  });
}

function batTex(s: Scene, awake: boolean): string {
  return tex(s, `l14-bat-${awake ? 1 : 0}`, 48, 34, (g, k) => {
    g.lineStyle(2 * k, OUT, 1).fillStyle(0x7b4fa8, 1);
    if (awake) {
      g.fillTriangle(24 * k, 14 * k, 1 * k, 4 * k, 8 * k, 22 * k).strokeTriangle(24 * k, 14 * k, 1 * k, 4 * k, 8 * k, 22 * k);
      g.fillTriangle(24 * k, 14 * k, 47 * k, 4 * k, 40 * k, 22 * k).strokeTriangle(24 * k, 14 * k, 47 * k, 4 * k, 40 * k, 22 * k);
    } else g.fillEllipse(24 * k, 14 * k, 26 * k, 22 * k).strokeEllipse(24 * k, 14 * k, 26 * k, 22 * k);
    // spikes round the body
    g.fillStyle(0xe8e8f0, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, cx = 24 + Math.cos(a) * 11, cy = 17 + Math.sin(a) * 11;
      g.fillTriangle((cx + Math.cos(a) * 6) * k, (cy + Math.sin(a) * 6) * k, (cx + Math.cos(a + 1.4) * 3) * k, (cy + Math.sin(a + 1.4) * 3) * k, (cx + Math.cos(a - 1.4) * 3) * k, (cy + Math.sin(a - 1.4) * 3) * k);
    }
    g.fillStyle(0x7b4fa8, 1).fillCircle(24 * k, 17 * k, 10 * k).strokeCircle(24 * k, 17 * k, 10 * k);
    if (awake) {
      g.fillStyle(0xfff27a, 1).fillCircle(20 * k, 15 * k, 2.6 * k).fillCircle(28 * k, 15 * k, 2.6 * k);
      g.fillStyle(0xffffff, 1).fillTriangle(21 * k, 21 * k, 23 * k, 21 * k, 22 * k, 25 * k).fillTriangle(25 * k, 21 * k, 27 * k, 21 * k, 26 * k, 25 * k);
    } else {
      g.lineStyle(1.8 * k, OUT, 1).lineBetween(18 * k, 16 * k, 22 * k, 16 * k).lineBetween(26 * k, 16 * k, 30 * k, 16 * k);
    }
  });
}

function noteTex(s: Scene): string {
  return tex(s, 'l14-note', 16, 20, (g, k) => {
    g.fillStyle(OUT, 1).fillEllipse(5 * k, 16 * k, 8 * k, 6 * k).fillRect(8 * k, 2 * k, 2 * k, 14 * k);
    g.fillTriangle(9 * k, 2 * k, 15 * k, 6 * k, 9 * k, 8 * k);
  });
}

// ---------------------------------------------------------------------------

/** the key group's centre in world px (its first tile, plus its offset) */
function keyPos(g: any): { x: number; y: number } {
  const t0 = g.tiles[0];
  return { x: t0.tx * T + T / 2 + g.ox, y: t0.ty * T + T / 2 + g.oy };
}

/** the colour a held key has right now (a chameleon key keeps changing) */
function colourOf(s: Scene, h: Held): string {
  const e = ext(h.g)!;
  if (e.cycle) return e.cycle[Math.floor(s.levelTick / (e.period ?? 45)) % e.cycle.length];
  return h.k;
}

function solidAt(s: Scene, x: number, y: number): boolean {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (s.staticSolid.has(ty * 10000 + tx)) return true;
  for (const g of s.groups.values()) {
    if (!g.visible || !g.solid || g.state === 'gone' || kind(g) === 'key') continue;
    for (const t of g.tiles) if (t.tx * T + g.ox <= x && x < t.tx * T + g.ox + T && t.ty * T + g.oy <= y && y < t.ty * T + g.oy + T) return true;
  }
  return false;
}

function scare(s: Scene): void {
  s.runActions([{ scare: true }]);
}

function hideGroup(s: Scene, g: any): void {
  g.visible = false;
  s.tweens.add({ targets: g.container, alpha: 0, duration: 160, onComplete: () => g.container.setVisible(false).setAlpha(1) });
}

function pickup(s: Scene, g: any): void {
  const S = st(s);
  // you carry one key: the one you hold drops where you stand
  for (const h of S.keys.splice(0)) dropKey(s, h);
  const e = ext(g)!;
  S.keys.push({ g, k: e.key, t: s.levelTick, chain: e.chain ? s.groups.get(e.chain) ?? null : null });
  g.visible = false;
  g.container.setVisible(false);
  s.troll(g.def.troll);
  s.sfx('coin');
  if (e.plank) { s.sfx('crumble'); s.emitDust.emitParticleAt(keyPos(g).x + 20, keyPos(g).y, 8); }
}

function dropKey(s: Scene, h: Held): void {
  const S = st(s);
  const g = h.g;
  const t0 = g.tiles[0];
  const b = s.pbody;
  g.ox = b.center.x - (t0.tx * T + T / 2);
  g.oy = b.center.y - (t0.ty * T + T / 2);
  g.visible = true;
  g.container.setVisible(true).setAlpha(1);
  S.drops.push({ g, vy: -2, still: false, noPick: true });
  s.troll(g.def.troll);
  s.sfx('click');
}

function openLock(s: Scene, g: any, h: Held | null): void {
  const S = st(s);
  const e = ext(g)!;
  if (e.mode === 'release') {
    // the chain's own padlock: the key stays in your hand, the chain falls off
    for (const k of S.keys) if (k.chain === g) k.chain = null;
  } else if (h) S.keys.splice(S.keys.indexOf(h), 1);
  if (e.stay) {
    // only the padlock springs open; the post stays
    g.l14open = true;
    if (g.l14pad) s.tweens.add({ targets: g.l14pad, y: g.l14pad.y - 30, alpha: 0, angle: 40, duration: 300 });
  } else hideGroup(s, g);
  s.sfx('click');
  s.emitDust.emitParticleAt(g.cx + g.ox, g.cy + g.oy, 8);
  if (e.trap) s.troll(g.def.troll);
  if (e.do) s.runActions(e.do, !e.trap);
}

const l14: Ext = {
  name: N,
  init(s) {
    // only on level 14: level 18 also has groups of kind 'key' (its piano keys)
    const on = s.lvl?.id === 14 && Object.values(s.lvl.groups ?? {}).some((d: any) => KINDS.includes(d.ext?.kind));
    s.ext[N] = { on, keys: [], drops: [], fish: [], birds: [], bats: [], prog: new Map(), yankT: 0, gfx: null, icons: [], noteT: 0 } as St;
  },
  group(s, g) {
    const S = st(s);
    if (!S?.on) return;
    const e = ext(g);
    const k = kind(g);
    if (!e || !KINDS.includes(k)) return;
    const xs = g.tiles.map((t: any) => t.tx), ys = g.tiles.map((t: any) => t.ty);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = (Math.max(...xs) - x0 + 1) * T, h = (Math.max(...ys) - y0 + 1) * T;
    const c = g.container;
    if (k === 'key') {
      if (e.plank) {
        g.img?.setVisible(false);
        c.add(s.add.image(x0 * T, y0 * T + 2, bigKeyTex(s)).setOrigin(0).setScale(1 / RES));
      } else {
        const p = keyPos(g);
        const img = s.add.image(p.x, p.y, keyTex(s, e.cycle ? e.cycle[0] : e.key)).setScale(1 / RES);
        c.add(img);
        c.setDepth(3.2);
        if (!e.fish) s.tweens.add({ targets: img, y: p.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        g.l14img = img;
        if (e.fish) S.fish.push({ g, to: null, up: 0 });
      }
    } else if (k === 'lock') {
      const look = e.look ?? (w === T && h === T ? 'post' : 'door');
      if (g.def.tile === '#') {
        g.img?.setVisible(false);
        c.add(s.add.image(x0 * T, y0 * T, doorTex(s, `l14-door-${s.lvl.id}-${g.id}`, w, h, look)).setOrigin(0).setScale(1 / RES));
      } else {
        // a padlock hanging from a little post (not solid)
        const gx = s.add.graphics();
        gx.fillStyle(0x8a5a33, 1).fillRect(x0 * T + 16, y0 * T - 2 * T, 8, 2 * T + 12).lineStyle(2, OUT, 1).strokeRect(x0 * T + 16, y0 * T - 2 * T, 8, 2 * T + 12);
        c.add(gx);
        c.setDepth(1);
      }
      const pad = s.add.image(x0 * T + w / 2, y0 * T + Math.min(h, 3 * T) / 2 + (h >= 3 * T ? T / 2 : 0), padTex(s, e.key ?? 'gold', e.mode === 'hungry' ? 'hungry' : e.mode === 'rusty' ? 'rusty' : 'plain')).setScale(1 / RES);
      c.add(pad);
      g.l14pad = pad;
    } else if (k === 'bridge') {
      g.img?.setVisible(false);
      c.add(s.add.image(x0 * T, y0 * T, planksTex(s, `l14-planks-${w}`, w, 20)).setOrigin(0).setScale(1 / RES));
    } else if (k === 'grate') {
      g.img?.setVisible(false);
      c.add(s.add.image(x0 * T, y0 * T, grateTex(s, `l14-grate-${w}`, w)).setOrigin(0).setScale(1 / RES));
    } else if (k === 'bars') {
      g.img?.setVisible(false);
      for (const t of g.tiles) c.add(s.add.image(t.tx * T, t.ty * T, barsTex(s)).setOrigin(0).setScale(1 / RES));
      c.setDepth(4);
    } else if (k === 'magpie') {
      const img = s.track(s.add.image(x0 * T + T / 2, y0 * T + T - 14, magpieTex(s)).setScale(1 / RES).setDepth(6));
      const gx = s.track(s.add.graphics().setDepth(0.4));
      gx.fillStyle(0x6b4a2b, 1).fillRect(x0 * T - 6, y0 * T + T - 4, T + 30, 7).lineStyle(2, OUT, 1).strokeRect(x0 * T - 6, y0 * T + T - 4, T + 30, 7);
      S.birds.push({ g, state: 'perch', x: img.x, y: img.y, t: 0, fx: 0, fy: 0, img, flap: 0 });
      if (e.nest) {
        // the nest the key ends up in
        const n = s.groups.get(e.nest);
        const nd = s.lvl.groups?.[e.nest];
        void n;
        const tiles: [number, number][] = [];
        s.lvl.map.forEach((row: string, y: number) => [...row].forEach((ch, x) => { if (ch === e.nest) tiles.push([x, y]); }));
        for (const [cx, cov] of nd?.cover ?? []) tiles.push([cx, cov]);
        if (tiles.length) s.track(s.add.image(tiles[0][0] * T + T / 2, tiles[0][1] * T + T - 6, nestTex(s)).setScale(1 / RES).setDepth(3.1));
      }
    } else if (k === 'bat') {
      const img = s.track(s.add.image(x0 * T + T / 2, y0 * T + 16, batTex(s, false)).setScale(1.4 / RES).setDepth(6));
      const z = s.track(s.add.text(img.x + 14, img.y - 26, 'z z', { fontFamily: 'Arial', fontSize: '18px', color: '#4b3f72', fontStyle: 'bold' }).setDepth(6));
      s.tweens.add({ targets: z, y: z.y - 6, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      S.bats.push({ g, state: 'sleep', x: img.x, y: img.y, img, z });
    }
  },
  action(s, a) {
    if (!String(a.ext).startsWith(`${N}.`)) return false;
    return true;
  },
  when(s, w) {
    const S = st(s);
    if (!S?.on) return undefined;
    if (w.kind === 'has') return S.keys.some((h) => !w.key || colourOf(s, h) === w.key);
    if (w.kind === 'none') return S.keys.length === 0;
    return undefined;
  },
  move(s, m: MoveCtx) {
    const S = st(s);
    if (!S?.on) return;
    for (const h of S.keys) { const e = ext(h.g)!; if (e.heavy) m.jumpMul *= e.heavy; }
  },
  tick(s) {
    const S = st(s);
    if (!S?.on || s.state !== 'play') return;
    const b = s.pbody;
    const hx = b.center.x, hy = b.center.y;
    // melting keys
    for (const h of [...S.keys]) {
      const e = ext(h.g)!;
      if (e.melt && s.levelTick - h.t >= e.melt) {
        S.keys.splice(S.keys.indexOf(h), 1);
        s.troll(h.g.def.troll);
        s.emitDust.emitParticleAt(hx, b.top - 20, 10);
        s.sfx('crumble');
        scare(s);
      }
    }
    // dropped keys fall (through grates and spikes) until they land on solid ground
    for (const d of S.drops) {
      if (d.still || !d.g.visible) continue;
      d.vy = Math.min(12, d.vy + 0.5);
      for (let n = 0; n < Math.ceil(d.vy); n++) {
        const p = keyPos(d.g);
        if (s.staticSolid.has(Math.floor((p.y + 12) / T) * 10000 + Math.floor(p.x / T))) { d.still = true; break; }
        d.g.oy += Math.min(1, d.vy - n);
      }
      if (keyPos(d.g).y > 18 * T + 60) { d.g.visible = false; d.g.container.setVisible(false); d.still = true; }
    }
    // keys on a fishing line are yanked away from you (until a wall stops them)
    for (const f of S.fish) {
      const g = f.g;
      if (!g.visible) continue;
      const p = keyPos(g);
      if (f.to === null && Math.abs(hx - p.x) < 70 && Math.abs(hy - p.y) < 60) {
        const dir = hx <= p.x ? 1 : -1;
        let to = p.x;
        for (let i = 0; i < 120; i += 4) { if (solidAt(s, p.x + dir * (i + 16), p.y)) break; to = p.x + dir * i; }
        if (Math.abs(to - p.x) > 6) { f.to = to; s.troll(g.def.troll); s.sfx('flip'); if (!s.trollsFired.has(`${g.id}-yank`)) { s.trollsFired.add(`${g.id}-yank`); scare(s); } }
      }
      if (f.to !== null) {
        const dx = f.to - p.x;
        const step = Math.sign(dx) * Math.min(Math.abs(dx), 9);
        g.ox += step;
        if (Math.abs(f.to - (p.x + step)) < 0.5) f.to = null;
      }
    }
    // a chained key yanks you back at the end of its chain
    if (S.yankT > 0) S.yankT--;
    for (const h of S.keys) {
      const a = h.chain;
      if (!a || !a.visible) continue;
      const e = ext(h.g)!;
      if (hx - (a.cx + a.ox) > (e.len ?? 5) * T && S.yankT === 0) {
        b.setVelocity(-380, Math.min(b.velocity.y, -120));
        s.launchLock = 26;
        s.jumping = false;
        S.yankT = 30;
        s.troll(h.g.def.troll);
        s.sfx('slam');
        scare(s);
      }
    }
    // the magpie steals the key when you jump with it
    for (const m of S.birds) {
      const e = ext(m.g)!;
      if (m.state === 'perch' && s.jumpedNow && hx >= e.zone[0] * T && hx <= e.zone[1] * T) {
        const h = S.keys.find((k) => colourOf(s, k) === e.steal);
        if (h) {
          S.keys.splice(S.keys.indexOf(h), 1);
          m.state = 'fly'; m.t = 0; m.fx = m.x; m.fy = m.y;
          s.troll(m.g.def.troll);
          s.sfx('flip');
          scare(s);
        }
      } else if (m.state === 'fly') {
        m.t++;
        const nest = s.groups.get(e.nest);
        const np = nest ? keyPos(nest) : { x: m.fx, y: m.fy };
        if (m.t <= 8) { m.x = m.fx + (hx - m.fx) * (m.t / 8); m.y = m.fy + (b.top - 6 - m.fy) * (m.t / 8); if (m.t === 8) { m.fx = m.x; m.fy = m.y; } }
        else {
          const p = Math.min(1, (m.t - 8) / 40);
          m.x = m.fx + (np.x + 18 - m.fx) * p;
          m.y = m.fy + (np.y - 12 - m.fy) * p - Math.sin(p * Math.PI) * 50;
          if (p >= 1) { m.state = 'nest'; if (nest) { nest.visible = true; nest.container.setVisible(true); } }
        }
      } else if (m.state === 'nest') {
        if (Math.abs(hx - m.x) < 2.5 * T && Math.abs(hy - m.y) < 3 * T) { m.state = 'gone'; m.t = 0; m.fx = m.x; m.fy = m.y; s.sfx('flip'); }
      } else if (m.state === 'gone' && m.t < 120) {
        m.t++;
        m.x = m.fx + m.t * 5;
        m.y = m.fy - m.t * 4;
      }
    }
    // a key you carry jingles while you run: it wakes the bat
    const noisy = S.keys.length > 0 && Math.abs(b.velocity.x) > 250;
    for (const bt of S.bats) {
      const e = ext(bt.g)!;
      if (bt.state === 'sleep' && noisy && hx >= e.zone[0] * T && hx <= e.zone[1] * T) {
        bt.state = 'dive';
        bt.img.setTexture(batTex(s, true));
        bt.z.setVisible(false);
        s.troll(bt.g.def.troll);
        s.sfx('hehe');
        scare(s);
      } else if (bt.state === 'dive') {
        const dx = hx - bt.x, dy = hy - bt.y, d = Math.hypot(dx, dy) || 1;
        bt.x += (dx / d) * 7;
        bt.y += (dy / d) * 7;
        if (s.staticSolid.has(Math.floor(bt.y / T) * 10000 + Math.floor(bt.x / T))) {
          bt.state = 'gone';
          bt.img.setVisible(false);
          s.emitDeath.emitParticleAt(bt.x, bt.y, 12);
          s.sfx('slam');
        }
      }
    }
    // a spiked ball that has rolled to its end bursts
    for (const g of s.groups.values()) {
      if (kind(g) !== 'roller' || !g.visible || g.chase || g.ox === 0) continue;
      g.visible = false;
      g.container.setVisible(false);
      s.emitDeath.emitParticleAt(g.cx + g.ox, g.cy + g.oy, 14);
      s.sfx('slam');
    }
  },
  interact(s) {
    const S = st(s);
    if (!S?.on) return;
    const b = s.pbody;
    const hr = heroRect(s);
    // the glass key breaks when you land hard
    if (s.grounded && !s.wasGrounded) {
      for (const h of S.keys) {
        const e = ext(h.g)!;
        if (e.glass && Math.abs(s.lastVy) > e.glass) {
          S.keys.splice(S.keys.indexOf(h), 1);
          s.troll(h.g.def.troll);
          s.emitDeath.emitParticleAt(b.center.x, b.top - 10, 18);
          s.sfx('crumble');
          s.kill('glass');
          return;
        }
      }
    }
    // the bat
    for (const bt of S.bats) if (bt.state === 'dive' && Math.abs(bt.x - b.center.x) < 24 && Math.abs(bt.y - b.center.y) < 24) { s.kill('bat'); return; }
    // picking up keys
    for (const g of s.groups.values()) {
      if (kind(g) !== 'key' || !g.visible) continue;
      const d = S.drops.find((x) => x.g === g);
      let r;
      if (ext(g)!.plank) {
        const xs = g.tiles.map((t: any) => t.tx), y0 = Math.min(...g.tiles.map((t: any) => t.ty));
        r = { x: Math.min(...xs) * T + 6 + g.ox, y: y0 * T - 4 + g.oy, w: (Math.max(...xs) - Math.min(...xs) + 1) * T - 12, h: 14 };
      } else { const p = keyPos(g); r = { x: p.x - 13, y: p.y - 11, w: 26, h: 22 }; }
      const hit = overlap(hr, r);
      if (d) {
        if (!d.still && d.vy > 0) continue;
        if (d.noPick) { if (!hit) d.noPick = false; continue; }
      }
      if (!hit) continue;
      if (d) S.drops.splice(S.drops.indexOf(d), 1);
      pickup(s, g);
    }
    // locks
    const pr = s.playerRect(0);
    for (const g of s.groups.values()) {
      if (kind(g) !== 'lock' || !g.visible || g.l14open) continue;
      const e = ext(g)!;
      if (!s.touchingGroup(g.id, pr)) { if (e.mode === 'rusty') S.prog.set(g.id, S.prog.get(g.id) ?? 0); continue; }
      const h = S.keys.find((k) => { const c = colourOf(s, k); return e.key === 'any' || c === e.key || c === 'bone'; });
      if (!h) continue;
      if (e.mode === 'hungry') {
        // it eats the key and stays shut
        S.keys.splice(S.keys.indexOf(h), 1);
        s.troll(g.def.troll);
        s.sfx('chomp');
        g.l14pad?.setScale(1.5 / RES);
        s.tweens.add({ targets: g.l14pad, scale: 1 / RES, duration: 200, ease: 'Back.Out' });
        scare(s);
        continue;
      }
      if (e.mode === 'rusty') {
        const p = (S.prog.get(g.id) ?? 0) + 1;
        S.prog.set(g.id, p);
        if (p === 1) { s.troll(g.def.troll); if (e.start) s.runActions(e.start); }
        if (p % 12 === 1) s.sfx('click');
        if (p >= (e.need ?? 120)) openLock(s, g, h);
        continue;
      }
      openLock(s, g, h);
    }
  },
  render(s) {
    const S = st(s);
    if (!S?.on || !s.pbody) return;
    if (!S.gfx || !S.gfx.active) S.gfx = s.track(s.add.graphics().setDepth(3.15));
    const gx = S.gfx;
    gx.clear();
    const b = s.pbody;
    // fishing lines
    for (const f of S.fish) {
      if (!f.g.visible) continue;
      const p = keyPos(f.g);
      gx.lineStyle(2, 0x2b2d42, 0.8).lineBetween(p.x - 9, p.y - 8, p.x - 9, -40);
      if (f.g.l14img) f.g.l14img.setPosition(p.x - f.g.ox, p.y - f.g.oy + Math.sin(s.levelTick / 9) * 2);
    }
    // chains from the anchor to the key you hold (or to the key lying there)
    for (const g of s.groups.values()) {
      if (kind(g) !== 'key' || !ext(g)!.chain) continue;
      const a = s.groups.get(ext(g)!.chain);
      if (!a || !a.visible) continue;
      const held = S.keys.find((h) => h.g === g);
      if (!held && !g.visible) continue;
      const p = held ? { x: b.center.x, y: b.top - 14 } : keyPos(g);
      const ax = a.cx + a.ox, ay = a.cy + a.oy;
      const n = Math.max(2, Math.floor(Math.hypot(p.x - ax, p.y - ay) / 9));
      const sag = Math.max(0, 40 - Math.abs(p.x - ax) / 6);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = ax + (p.x - ax) * t, y = ay + (p.y - ay) * t + Math.sin(t * Math.PI) * sag;
        gx.lineStyle(2.5, 0x4b4f5c, 1).strokeCircle(x, y, 3.2);
      }
    }
    // a rope from a padlocked post up over a beam to what it holds
    for (const g of s.groups.values()) {
      const e = ext(g);
      if (kind(g) !== 'lock' || !e?.rope || !g.visible || g.l14open) continue;
      const px = g.cx + g.ox, py = g.cy + g.oy - T / 2;
      const bx = e.rope[0] * T + T / 2, by = e.rope[1] * T + T / 2;
      const top = by - 34;
      gx.fillStyle(0x6b4a2b, 1).fillRect(Math.min(px, bx) - 14, top - 8, Math.abs(px - bx) + 28, 8).lineStyle(2, OUT, 1).strokeRect(Math.min(px, bx) - 14, top - 8, Math.abs(px - bx) + 28, 8);
      gx.lineStyle(3, 0xc9a06a, 1).lineBetween(px, py, px, top).lineBetween(bx, top, bx, by - 16);
      gx.lineStyle(3, 0x4b4f5c, 1).strokeCircle(px, top - 2, 5).strokeCircle(bx, top - 2, 5);
    }
    // rusty locks: how far the key has turned
    for (const [id, p] of S.prog) {
      const g = s.groups.get(id);
      if (!g || !g.visible || p <= 0) continue;
      const need = ext(g)!.need ?? 120;
      const x = g.cx + g.ox, y = g.l14pad ? g.l14pad.y - 30 : g.cy - 40;
      gx.lineStyle(6, 0x2b2d42, 0.5).strokeCircle(x, y, 12);
      gx.lineStyle(5, 0xffd23f, 1).beginPath().arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p) / need, false).strokePath();
    }
    // the keys you carry, over your head
    S.icons = S.icons.filter((i) => i.active);
    while (S.icons.length < S.keys.length) S.icons.push(s.track(s.add.image(0, 0, keyTex(s, 'gold')).setDepth(7)));
    S.icons.forEach((img, i) => {
      const h = S.keys[i];
      if (!h || s.state !== 'play') { img.setVisible(false); return; }
      const e = ext(h.g)!;
      const c = colourOf(s, h);
      img.setTexture(keyTex(s, c)).setVisible(true);
      let sc = 0.8;
      if (e.melt) sc *= Math.max(0.25, 1 - (s.levelTick - h.t) / e.melt);
      img.setScale(sc / RES).setPosition(b.center.x + (i - (S.keys.length - 1) / 2) * 30, b.top - 22 + Math.sin(s.levelTick / 8) * 1.5);
      if (e.melt && s.levelTick % 14 === 0) s.emitDust.emitParticleAt(img.x, img.y + 8, 1);
      if (e.glass) img.setAlpha(0.75 + 0.25 * Math.sin(s.levelTick / 5));
    });
    // jingle notes while you run with a key near a bat
    if (S.bats.some((bt) => bt.state === 'sleep') && S.keys.length && Math.abs(b.velocity.x) > 250 && s.levelTick - S.noteT > 10) {
      S.noteT = s.levelTick;
      const n = s.track(s.add.image(b.center.x + 10, b.top - 30, noteTex(s)).setScale(1 / RES).setDepth(7));
      s.tweens.add({ targets: n, y: n.y - 30, x: n.x + 12, alpha: 0, duration: 600, onComplete: () => n.destroy() });
    }
    for (const m of S.birds) {
      m.img.setPosition(m.x, m.y + (m.state === 'perch' || m.state === 'nest' ? 0 : Math.sin(s.levelTick / 3) * 3));
      m.img.setFlipX(m.state === 'gone' || (m.state === 'fly' && m.t > 8 ? false : m.x < b.center.x));
      m.img.setVisible(m.state !== 'gone' || m.t < 120);
      if (m.state === 'fly' && m.t > 8) {
        // the stolen key in its beak
        gx.fillStyle(KEY_COLORS[ext(m.g)!.steal] ?? 0xffd23f, 1).fillRect(m.x - 22, m.y - 2, 14, 4);
      }
    }
    // a chameleon key lying there changes colour too
    for (const g of s.groups.values()) {
      const e = ext(g);
      if (kind(g) === 'key' && e?.cycle && g.visible && g.l14img) g.l14img.setTexture(keyTex(s, e.cycle[Math.floor(s.levelTick / (e.period ?? 45)) % e.cycle.length]));
    }
    for (const bt of S.bats) if (bt.state !== 'gone') bt.img.setPosition(bt.x, bt.y).setRotation(bt.state === 'dive' ? Math.sin(s.levelTick / 2) * 0.2 : 0);
  },
  snapshot(s) {
    const S = st(s);
    if (!S?.on) return {};
    return {
      l14: {
        keys: S.keys.map((h) => colourOf(s, h)),
        prog: Math.max(0, ...S.prog.values()),
        bird: S.birds.map((m) => m.state).join(','),
        bat: S.bats.map((x) => x.state).join(','),
        drops: S.drops.filter((d) => d.g.visible).length,
      },
    };
  },
};

export default l14;
