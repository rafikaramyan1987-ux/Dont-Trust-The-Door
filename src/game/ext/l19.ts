// Level 19 "Fireworks": bombs, fuses, cannons and fireworks.
//
// Group kinds (def.ext.kind; the group's tiles are the objects' places, left to right):
//   fw-bomb     bombs / barrels / kegs with a fuse (a spark runs along it, then BOOM: kills in a radius unless solid
//               ground is in between, can break groups, set off other bombs, throw you, stick to you, be kicked …)
//   fw-cannon   'ride': climb in and it fires you at its barrel's angle · 'balls': bouncing cannonballs
//   fw-mortar   lobs shells where you will be (lead) or at fixed targets (blowing holes into a bridge)
//   fw-burst    a rocket that bursts into a ring of falling sparks (with a gap straight below it)
//   fw-cake     a firework "cake": its tubes fire stars straight up one after another
//   fw-candle   a roman candle: fireballs at fixed times
//   fw-wheel    a pinwheel with a spark arm that sweeps round
//   fw-sparkler a sparkler you carry; it lights every fw-cord (fuse cord) you walk over
//   fw-wall     a breakable '#' group (only marks it for the soft-lock analyzer)
// Actions: { ext: 'l19.light' | 'l19.go' | 'l19.enter' | 'l19.stop', g, args? }
import type { Ext, Scene, MoveCtx } from './types';

const T = 40;
const RES = 2;
const KINDS = ['fw-bomb', 'fw-cannon', 'fw-mortar', 'fw-burst', 'fw-cake', 'fw-candle', 'fw-wheel', 'fw-sparkler', 'fw-cord', 'fw-wall'];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Img = any;

interface Bomb {
  i: number; x: number; y: number; x0: number; y0: number;
  look: string; r: number; ticks: number; curve: number;
  fuse: [number, number][]; len: number;
  wait: number; lit: boolean; t: number; out: boolean; boom: boolean;
  dudT: number; dudDone: boolean; nearDone: boolean;
  vx: number; vy: number; kicked: boolean; stuck: boolean; defused: boolean;
  img: Img; spark: Img; cord: Img; dirty: boolean;
  /** this bomb's settings (the group's, with its `each` entry on top) */
  e: any; delay: number; armed: boolean;
}
interface Obj {
  g: any; kind: string; d: any; x: number; y: number;
  bombs: Bomb[];
  on: boolean; t: number; n: number;
  ang: number; locked: number | null;
  img: Img[]; gfx: Img;
  tiles: { x: number; y: number }[];
  runs: { cells: { x: number; y: number }[]; lit: number; bomb: Bomb | null }[];
}
interface Proj { x: number; y: number; vx: number; vy: number; g: number; r: number; kind: string; life: number; bounce: number; boom: number; hide?: string; ty?: number; deadly: boolean; img: Img; roll?: boolean; rico?: number; ember?: number }
interface St {
  objs: Obj[]; by: Map<string, Obj>; proj: Proj[];
  cap: { o: Obj; t: number } | null; flight: number;
  stuck: Bomb | null; stuckObj: Obj | null;
  carry: Obj | null; sparklerImg: Img; sparklerStick?: Img; booms: number;
  solidKeys: Map<any, Set<number>>;
}

const st = (s: Scene): St => s.ext.l19;
const mine = (s: Scene) => s.lvl?.id === 19;

// ---------------------------------------------------------------------------
// textures (drawn once)

function tex(s: Scene, key: string, w: number, h: number, draw: (g: any) => void): void {
  if (s.textures.exists(key)) return;
  const g = s.make.graphics({ x: 0, y: 0 }, false);
  g.scaleCanvas(RES, RES);
  draw(g);
  g.generateTexture(key, w * RES, h * RES);
  g.destroy();
}

function makeTextures(s: Scene): void {
  tex(s, 'fw-bomb', 32, 32, (g) => {
    g.fillStyle(0x1d1b2a, 1).fillCircle(16, 19, 12);
    g.fillStyle(0x4a4766, 1).fillCircle(11, 14, 4);
    g.fillStyle(0x6b6884, 1).fillRect(12, 3, 8, 6);
    g.fillStyle(0xffffff, 0.7).fillCircle(10, 13, 1.6);
  });
  tex(s, 'fw-giant', 80, 80, (g) => {
    g.fillStyle(0x1d1b2a, 1).fillCircle(40, 46, 32);
    g.fillStyle(0x4a4766, 1).fillCircle(27, 33, 10);
    g.fillStyle(0x6b6884, 1).fillRect(31, 6, 18, 12);
    g.fillStyle(0xffffff, 0.6).fillCircle(24, 30, 3.5);
    g.fillStyle(0xff6f91, 1).fillRect(8, 44, 64, 6);
  });
  tex(s, 'fw-barrel', 32, 36, (g) => {
    g.fillStyle(0x8a1f2a, 1).fillRoundedRect(3, 2, 26, 33, 6);
    g.fillStyle(0xd9364a, 1).fillRoundedRect(6, 3, 20, 31, 5);
    g.fillStyle(0x3b2a2a, 1).fillRect(3, 9, 26, 3).fillRect(3, 25, 26, 3);
    g.fillStyle(0xffd23f, 1).fillTriangle(16, 13, 11, 23, 21, 23);
    g.fillStyle(0x3b2a2a, 1).fillRect(15, 16, 2, 4).fillRect(15, 21, 2, 1.5);
  });
  tex(s, 'fw-keg', 32, 32, (g) => {
    g.fillStyle(0x6b3f1f, 1).fillRoundedRect(3, 4, 26, 27, 7);
    g.fillStyle(0x9a6030, 1).fillRoundedRect(6, 5, 20, 25, 6);
    g.fillStyle(0x2b2d42, 1).fillRect(3, 10, 26, 2.5).fillRect(3, 23, 26, 2.5);
    g.fillStyle(0x1d1b2a, 1).fillCircle(16, 17, 3);
  });
  tex(s, 'fw-ball', 32, 32, (g) => {
    g.fillStyle(0x23222f, 1).fillCircle(16, 16, 14);
    g.fillStyle(0x55536b, 1).fillCircle(11, 11, 5);
    g.fillStyle(0xffffff, 0.5).fillCircle(10, 10, 2);
  });
  tex(s, 'fw-spark', 12, 12, (g) => {
    g.fillStyle(0xffffff, 0.35).fillCircle(6, 6, 6);
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 3);
  });
  tex(s, 'fw-fire', 24, 24, (g) => {
    g.fillStyle(0xff5a2e, 0.45).fillCircle(12, 12, 12);
    g.fillStyle(0xff8a3d, 1).fillCircle(12, 12, 8);
    g.fillStyle(0xfff27a, 1).fillCircle(12, 12, 4);
  });
  tex(s, 'fw-shell', 18, 18, (g) => {
    g.fillStyle(0x2b2d42, 1).fillCircle(9, 9, 8);
    g.fillStyle(0xd9364a, 1).fillCircle(9, 9, 5);
  });
  tex(s, 'fw-flash', 64, 64, (g) => {
    for (let i = 8; i >= 1; i--) g.fillStyle(i > 5 ? 0xff8a3d : i > 2 ? 0xffd23f : 0xffffff, 0.16 + (8 - i) * 0.05).fillCircle(32, 32, i * 4);
  });
  tex(s, 'fw-cannon', 72, 30, (g) => {
    g.fillStyle(0x23222f, 1).fillRoundedRect(0, 2, 66, 26, 8);
    g.fillStyle(0x4a4766, 1).fillRect(6, 6, 54, 5);
    g.fillStyle(0x23222f, 1).fillRect(60, 0, 12, 30);
    g.fillStyle(0x0d0c14, 1).fillRect(66, 6, 6, 18);
  });
  tex(s, 'fw-base', 56, 34, (g) => {
    g.fillStyle(0x6b3f1f, 1).fillRoundedRect(4, 4, 48, 16, 4);
    g.fillStyle(0x2b2d42, 1).fillCircle(14, 24, 10).fillCircle(42, 24, 10);
    g.fillStyle(0x9a6030, 1).fillCircle(14, 24, 5).fillCircle(42, 24, 5);
  });
  tex(s, 'fw-mortar', 44, 40, (g) => {
    g.fillStyle(0x23222f, 1).fillRect(10, 2, 24, 30);
    g.fillStyle(0x4a4766, 1).fillRect(14, 4, 5, 26);
    g.fillStyle(0x0d0c14, 1).fillRect(12, 0, 20, 5);
    g.fillStyle(0x6b3f1f, 1).fillRect(2, 30, 40, 10);
  });
  tex(s, 'fw-tube', 20, 40, (g) => {
    g.fillStyle(0x5b8cff, 1).fillRect(3, 4, 14, 36);
    g.fillStyle(0xffffff, 1).fillRect(3, 12, 14, 4).fillRect(3, 24, 14, 4);
    g.fillStyle(0x2b2d42, 1).fillRect(2, 2, 16, 4);
  });
  tex(s, 'fw-candle', 18, 64, (g) => {
    g.fillStyle(0xd9364a, 1).fillRect(3, 4, 12, 60);
    g.fillStyle(0xffd23f, 1);
    for (let y = 10; y < 64; y += 14) g.fillRect(3, y, 12, 5);
    g.fillStyle(0x2b2d42, 1).fillRect(2, 0, 14, 5);
  });
  tex(s, 'fw-wheel', 44, 44, (g) => {
    const cols = [0xff6f91, 0xffd23f, 0x5b8cff, 0x6fd36b];
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
      g.fillStyle(cols[k % 4], 1).slice(22, 22, 20, a0, a1, false).fillPath();
    }
    g.fillStyle(0x2b2d42, 1).fillCircle(22, 22, 5);
  });
  tex(s, 'fw-sparkler', 10, 34, (g) => {
    g.fillStyle(0x8a8aa0, 1).fillRect(4, 8, 2, 26);
    g.fillStyle(0x4a4766, 1).fillRect(3, 0, 4, 12);
  });
  tex(s, 'fw-glow', 32, 32, (g) => {
    g.fillStyle(0xfff27a, 0.25).fillCircle(16, 16, 16);
    g.fillStyle(0xffffff, 0.9).fillCircle(16, 16, 4);
    g.lineStyle(1.5, 0xfff27a, 1);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.lineBetween(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5, 16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13); }
  });
  tex(s, 'fw-rocket', 12, 34, (g) => {
    g.fillStyle(0x8a6a3a, 1).fillRect(5, 18, 2, 16);
    g.fillStyle(0xd9364a, 1).fillRect(2, 6, 8, 14);
    g.fillStyle(0xffd23f, 1).fillRect(2, 11, 8, 3);
    g.fillStyle(0xffffff, 1).fillTriangle(6, 0, 1, 7, 11, 7);
  });
  tex(s, 'fw-cord', 40, 8, (g) => {
    g.fillStyle(0x3b2a2a, 1).fillRect(0, 2, 40, 6);
    g.fillStyle(0xe8c48e, 1).fillRect(0, 3, 40, 4);
    g.fillStyle(0x8a5a2a, 1);
    for (let x = 1; x < 40; x += 6) g.fillRect(x, 3, 3, 4);
  });
}

// ---------------------------------------------------------------------------
// helpers

const sortTiles = (g: any) => [...g.tiles].sort((a: any, b: any) => a.tx - b.tx || a.ty - b.ty);

function solidAt(s: Scene, px: number, py: number): boolean {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (ty < 0 || ty >= 18) return false;
  if (s.staticSolid.has(ty * 10000 + tx)) return true;
  for (const g of s.groups.values()) {
    if (g.def.tile !== '#' || !g.visible || !g.solid || g.def.fake) continue;
    if (g.def.ext?.kind === 'fw-bomb') continue;
    const set = st(s).solidKeys.get(g);
    if (!set) continue;
    const lx = Math.floor((px - g.ox) / T), ly = Math.floor((py - g.oy) / T);
    if (set.has(ly * 10000 + lx)) return true;
  }
  return false;
}

/** nothing solid on the straight line between the two points */
function clear(s: Scene, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / 6));
  for (let i = 1; i < n; i++) if (solidAt(s, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}

function heroRect(s: Scene, inset = 3) {
  const b = s.pbody;
  return { x: b.x + inset, y: b.y + inset, w: b.width - inset * 2, h: b.height - inset * 2 };
}
function circleHits(s: Scene, x: number, y: number, r: number, inset = 3): boolean {
  const h = heroRect(s, inset);
  const cx = Math.max(h.x, Math.min(x, h.x + h.w)), cy = Math.max(h.y, Math.min(y, h.y + h.h));
  return (cx - x) ** 2 + (cy - y) ** 2 < r * r;
}

function polyLen(p: [number, number][]): number {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
function polyAt(p: [number, number][], d: number): [number, number] {
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (d <= l || i === p.length - 1) {
      const f = l ? Math.min(1, d / l) : 1;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f];
    }
    d -= l;
  }
  return p[p.length - 1];
}

function sfx(s: Scene, n: string): void { try { s.sfx(n); } catch { /* audio is optional */ } }

// ---------------------------------------------------------------------------
// explosions

function boom(s: Scene, o: Obj, b: Bomb): void {
  const S = st(s);
  b.boom = true;
  b.lit = false;
  S.booms++;
  const d = b.e;
  const x = b.x, y = b.y;
  b.img?.setVisible(false);
  b.spark?.setVisible(false);
  b.cord?.clear();
  if (b.stuck) { S.stuck = null; S.stuckObj = null; }
  if (d.confetti) {
    s.emitConfetti.emitParticleAt(x, y - 20, 60);
    sfx(s, 'pad');
    if (o.g.def.tile === '#') s.runActions([{ hide: o.g.id }], true);
    return;
  }
  flash(s, x, y, b.r);
  sfx(s, 'slam');
  s.cameras.main.shake(220, 0.012);
  s.emitDeath.emitParticleAt(x, y, 18);
  if (o.g.def.tile === '#') s.runActions([{ hide: o.g.id }], true);
  for (const gid of b.y < 17 * T ? d.breaks ?? [] : []) {
    const g = s.groups.get(gid);
    if (g && g.visible) s.runActions([{ hide: gid }], true);
  }
  if (s.state === 'play') {
    const hb = s.pbody;
    const hx = hb.center.x, hy = hb.center.y;
    const dist = Math.hypot(hx - x, hy - y);
    const seen = d.los === false || clear(s, x, y, hx, hy);
    if (dist <= b.r * T && seen) { s.kill('boom'); return; }
    if (d.push && dist <= d.push.r * T && seen) {
      const dir = hx >= x ? 1 : -1;
      hb.setVelocity(dir * d.push.vx, -d.push.vy);
      S.flight = 1;
    }
  }
  // chain reaction: set off the other bombs of the group nearby
  if (d.chain) {
    const next = d.chain.seq ? [o.bombs[b.i + d.chain.seq]].filter(Boolean) : o.bombs.filter((c) => Math.hypot(c.x - x, c.y - y) <= d.chain.r * T);
    for (const c of next) {
      if (c === b || c.boom || (c.lit && c.ticks - c.t <= d.chain.delay)) continue;
      // (a bomb later in the list steps on in this same tick)
      c.wait = 0; c.lit = true; c.out = false; c.t = c.i > b.i ? -1 : 0;
      c.ticks = d.chain.perTile ? Math.max(1, Math.round((d.chain.perTile * Math.abs(c.x - x)) / T)) : d.chain.delay;
    }
  }
}

function flash(s: Scene, x: number, y: number, r: number): void {
  const im = s.track(s.add.image(x, y, 'fw-flash').setDepth(7).setScale((r * T) / 32 / RES * 0.4));
  s.tweens.add({ targets: im, scale: (r * T) / 32 / RES * 1.05, alpha: 0, duration: 380, ease: 'Quad.Out', onComplete: () => im.setVisible(false) });
}

// ---------------------------------------------------------------------------
// projectiles

function shoot(s: Scene, p: Omit<Proj, 'img'>, key: string, tint?: number, scale = 1): Proj {
  const img = s.track(s.add.image(p.x, p.y, key).setDepth(4.4).setScale(scale / RES));
  if (tint !== undefined) img.setTint(tint);
  const q = { ...p, img } as Proj;
  st(s).proj.push(q);
  return q;
}

function stepProj(s: Scene): void {
  const S = st(s);
  const keep: Proj[] = [];
  for (const p of S.proj) {
    p.life--;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    let dead = p.life <= 0 || p.y > 18 * T + 60 || p.x < -60 || p.x > s.worldW + 60;
    if (p.ember !== undefined) {
      // a spark that came down: it glows on the floor for a moment
      p.x -= p.vx; p.y -= p.vy; p.vy -= p.g;
      if (!dead) keep.push(p); else p.img.destroy();
      continue;
    }
    if (!dead && p.rico !== undefined && solidAt(s, p.x + Math.sign(p.vx) * p.r, p.y)) {
      // a ball hitting a wall: it ricochets back (or is spent)
      if (p.rico > 0) { p.rico--; p.x -= p.vx; p.vx = -p.vx; sfx(s, 'slam'); s.cameras.main.shake(90, 0.005); } else dead = true;
    }
    if (!dead && p.roll && p.vy > 0 && solidAt(s, p.x, p.y + p.r)) {
      p.y = Math.floor((p.y + p.r) / T) * T - p.r;
      p.vy = 0;
    } else if (!dead && p.ty !== undefined && p.vy > 0 && p.y >= p.ty) {
      // a shell reaches its target height
      p.y = p.ty;
      shellBoom(s, p);
      dead = true;
    } else if (!dead && p.bounce && p.vy > 0 && solidAt(s, p.x, p.y + p.r)) {
      p.y = Math.floor((p.y + p.r) / T) * T - p.r;
      p.vy = -p.bounce;
      sfx(s, 'land');
    } else if (!dead && !p.roll && solidAt(s, p.x + Math.sign(p.vx) * p.r * 0.6, p.y + Math.sign(p.vy) * p.r * 0.6)) {
      if (p.boom) shellBoom(s, p);
      if (p.kind === 'spark' && p.vy > 0) {
        p.ember = 1; p.life = 36; p.vx = 0; p.vy = 0; p.g = 0;
        p.y = Math.floor((p.y + p.r) / T) * T - p.r;
      } else dead = true;
    }
    if (dead) { p.img.destroy(); continue; }
    keep.push(p);
  }
  S.proj = keep;
}

function shellBoom(s: Scene, p: Proj): void {
  flash(s, p.x, p.y, p.boom);
  sfx(s, 'slam');
  s.cameras.main.shake(140, 0.008);
  s.emitDeath.emitParticleAt(p.x, p.y, 12);
  if (p.hide) { const g = s.groups.get(p.hide); if (g && g.visible) s.runActions([{ hide: p.hide }], true); }
  if (s.state === 'play') {
    const hb = s.pbody;
    if (Math.hypot(hb.center.x - p.x, hb.center.y - p.y) <= p.boom * T && clear(s, p.x, p.y - 4, hb.center.x, hb.center.y)) s.kill('boom');
  }
}

// ---------------------------------------------------------------------------
// objects

function makeObj(s: Scene, g: any): Obj {
  const d = g.def.ext;
  const tiles = sortTiles(g).map((v: any) => ({ x: v.tx, y: v.ty }));
  const o: Obj = { g, kind: d.kind, d, x: tiles[0].x * T + T / 2, y: tiles[0].y * T + T / 2, bombs: [], on: false, t: 0, n: 0, ang: 0, locked: null, img: [], gfx: null, tiles, runs: [] };
  const add = (im: Img) => { o.img.push(s.track(im)); return im; };
  const S = st(s);
  if (g.def.tile === '#') {
    const set = new Set<number>(g.tiles.map((v: any) => v.ty * 10000 + v.tx));
    S.solidKeys.set(g, set);
  }
  switch (d.kind) {
    case 'fw-bomb': {
      const each = d.each ?? [];
      const places = d.look === 'giant' ? [tiles[0]] : tiles;
      places.forEach((v: { x: number; y: number }, i: number) => {
        const e = { ...d, ...(each[i] ?? {}) };
        const look = e.look ?? 'bomb';
        const big = look === 'giant';
        const x = big ? (Math.min(...tiles.map((q: any) => q.x)) + Math.max(...tiles.map((q: any) => q.x)) + 1) / 2 * T : v.x * T + T / 2;
        const y = big ? (Math.max(...tiles.map((q: any) => q.y)) + 1) * T - 40 : v.y * T + T - 16;
        const fuse: [number, number][] = (e.fuse ?? (d.fuses ? d.fuses[i] : null) ?? [[v.x + 0.5, v.y + 0.1], [v.x + 0.5, v.y + 0.2]]).map(([fx, fy]: [number, number]) => [fx * T, fy * T]);
        const key = look === 'barrel' ? 'fw-barrel' : look === 'keg' ? 'fw-keg' : look === 'giant' ? 'fw-giant' : 'fw-bomb';
        const img = s.track(s.add.image(x, y, key).setScale(1 / RES).setDepth(big ? 0.6 : 2.5));
        if (look === 'hidden') img.setVisible(false);
        const cord = s.track(s.add.graphics().setDepth(2.4));
        const spark = s.track(s.add.image(0, 0, 'fw-glow').setScale(0.8 / RES).setDepth(4.5).setVisible(false));
        const b: Bomb = {
          i, x, y, x0: x, y0: y, look, r: e.r ?? 2.5, ticks: e.ticks ?? 120, curve: e.curve ?? 1, fuse, len: polyLen(fuse),
          wait: 0, lit: false, t: 0, out: false, boom: false, dudT: 0, dudDone: false, nearDone: false,
          vx: 0, vy: 0, kicked: false, stuck: false, defused: false, img, spark, cord, dirty: true, e, delay: 0, armed: false,
        };
        b.e = e;
        b.delay = e.delay ?? 0;
        o.bombs.push(b);
      });
      if (g.img) g.img.setVisible(false);
      break;
    }
    case 'fw-cannon': {
      if (d.mode === 'ride') {
        add(s.add.image(o.x, o.y + 6, 'fw-base').setScale(1 / RES).setDepth(2.6));
        const barrel = add(s.add.image(o.x, o.y - 4, 'fw-cannon').setOrigin(10 / 72, 0.5).setScale(1 / RES).setDepth(2.5));
        o.ang = d.a0;
        barrel.setRotation(-o.ang * Math.PI / 180);
      } else {
        add(s.add.image(o.x, o.y + 6, 'fw-base').setScale(1 / RES).setDepth(2.6).setFlipX(d.vel[0] < 0));
        add(s.add.image(o.x, o.y - 6, 'fw-cannon').setOrigin(10 / 72, 0.5).setScale(1 / RES).setDepth(2.5).setFlipX(d.vel[0] < 0).setOrigin(d.vel[0] < 0 ? 62 / 72 : 10 / 72, 0.5));
      }
      break;
    }
    case 'fw-mortar':
      add(s.add.image(o.x, o.y, 'fw-mortar').setScale(1 / RES).setDepth(2.5));
      break;
    case 'fw-burst':
      add(s.add.image(o.x, o.y, 'fw-tube').setScale(1 / RES).setDepth(2.5));
      break;
    case 'fw-cake':
      if (d.cake) {
        // the birthday cake drawn over its blocks: sponge, pink icing with drips, sprinkles
        const [x0, x1, y0, y1] = d.cake;
        const c = s.track(s.add.graphics().setDepth(0.55));
        const X0 = x0 * T, W = (x1 - x0 + 1) * T, Y0 = y0 * T, H = (y1 - y0 + 1) * T;
        c.fillStyle(0xf6d8a8, 1).fillRoundedRect(X0, Y0, W, H, 8);
        c.fillStyle(0xe0b47e, 1).fillRect(X0, Y0 + H * 0.55, W, 6);
        c.fillStyle(0xff8fb1, 1).fillRoundedRect(X0 - 2, Y0 - 2, W + 4, 16, 8);
        for (let x = X0 + 10; x < X0 + W - 10; x += 26) c.fillCircle(x, Y0 + 14, 7);
        const cols = [0xffffff, 0x5b8cff, 0xffd23f, 0x6fd36b];
        for (let k = 0, x = X0 + 14; x < X0 + W - 8; x += 19, k++) c.fillStyle(cols[k % 4], 1).fillRect(x, Y0 + 3 + (k % 3) * 3, 5, 2);
        c.lineStyle(3, 0x8a4a5a, 1).strokeRoundedRect(X0, Y0, W, H, 8);
      }
      for (const v of tiles) add(s.add.image(v.x * T + T / 2, v.y * T + T / 2, 'fw-tube').setScale(1 / RES).setDepth(2.5).setTint(v.x % 2 ? 0xffd6e0 : 0xffffff));
      o.gfx = s.track(s.add.graphics().setDepth(2.6));
      break;
    case 'fw-candle':
      add(s.add.image(o.x, o.y - 4, 'fw-candle').setScale(1 / RES).setDepth(2.5).setRotation(Math.atan2(d.vel[0], -d.vel[1])));
      break;
    case 'fw-wheel':
      add(s.add.image(o.x, o.y + T * 1.5, 'fw-sparkler').setScale(1 / RES).setDisplaySize(6, T * 3).setDepth(2.3).setTint(0x6b3f1f));
      add(s.add.image(o.x, o.y, 'fw-wheel').setScale(1 / RES).setDepth(2.6));
      o.ang = d.phase ?? 90;
      o.gfx = s.track(s.add.graphics().setDepth(4.4));
      break;
    case 'fw-sparkler':
      add(s.add.image(o.x, o.y + 4, 'fw-sparkler').setScale(1 / RES).setDepth(2.5));
      break;
    case 'fw-cord': {
      // contiguous runs of cord cells (one fuse cord each), drawn on the floor
      let run: { x: number; y: number }[] = [];
      const flush = () => { if (run.length) o.runs.push({ cells: run, lit: -1, bomb: null }); run = []; };
      for (const v of tiles) {
        const last = run[run.length - 1];
        if (last && (v.x !== last.x + 1 || v.y !== last.y)) flush();
        run.push(v);
        add(s.add.image(v.x * T + T / 2, v.y * T + T - 5, 'fw-cord').setScale(1 / RES).setDepth(2.4));
      }
      flush();
      o.gfx = s.track(s.add.graphics().setDepth(4.4));
      break;
    }
  }
  return o;
}

function lightBomb(b: Bomb, ticks?: number): void {
  if (b.boom || b.defused) return;
  b.wait = b.delay;
  if (ticks !== undefined) b.ticks = ticks;
  if (b.wait <= 0) { b.lit = true; b.t = 0; }
  b.out = false;
  b.armed = true;
}

function stepBombs(s: Scene, o: Obj): void {
  const hb = s.pbody;
  for (const b of o.bombs) {
    const d = b.e;
    if (b.boom || b.defused) continue;
    if (b.armed && !b.lit && b.wait > 0) { b.wait--; if (b.wait <= 0) { b.lit = true; b.t = 0; } }
    // sticky: touching it sticks it on your back and lights it
    if (d.sticky && !b.stuck && s.state === 'play' && circleHits(s, b.x, b.y, 14, 0)) {
      b.stuck = true;
      b.img.setDepth(5.5);
      b.spark.setDepth(5.6);
      st(s).stuck = b;
      st(s).stuckObj = o;
      if (!b.lit) { b.lit = true; b.t = 0; }
      s.troll(o.g.def.troll);
      s.hero.flash('shock', 0.6);
      sfx(s, 'trap');
    }
    if (b.stuck) {
      b.x = hb.center.x - 10;
      b.y = hb.center.y - 14;
      if (s.inWater) {
        // the water puts the fuse out
        b.defused = true; b.lit = false; b.stuck = false;
        st(s).stuck = null;
        sfx(s, 'land');
        s.emitDust.emitParticleAt(b.x, b.y, 6);
        b.img.setVisible(false); b.spark.setVisible(false); b.cord.clear();
        continue;
      }
    }
    // kicked: walking into it sends it sliding / flying
    if (d.kick && !b.kicked && s.state === 'play' && circleHits(s, b.x, b.y, 15, 0)) {
      const dir = hb.center.x <= b.x ? 1 : -1;
      b.kicked = true; b.vx = dir * d.kick.vx; b.vy = -d.kick.vy;
      sfx(s, 'click');
      if (!b.lit) lightBomb(b);
      b.dirty = true;
    }
    if (b.kicked) {
      b.vy = Math.min(14, b.vy + 0.55);
      const nx = b.x + b.vx, ny = b.y + b.vy;
      if (solidAt(s, nx + Math.sign(b.vx) * 13, b.y)) b.vx = -b.vx * 0.3;
      if (b.vy > 0 && solidAt(s, nx, ny + 14)) { b.y = Math.floor((ny + 14) / T) * T - 14; b.vy = 0; b.vx *= 0.97; } else b.y = ny;
      b.x += b.vx;
      if (b.y > 18 * T + 40) { b.y = 18 * T + 40; b.vx = 0; b.vy = 0; }
    }
    // "near": coming close (re)lights it with a short fuse
    if (d.near && !b.nearDone && s.state === 'play' && Math.hypot(hb.center.x - b.x, hb.center.y - b.y) <= d.near.r * T) {
      b.nearDone = true;
      if (!b.lit || b.out || b.ticks - b.t > d.near.ticks) {
        b.lit = true; b.out = false; b.dudDone = true; b.t = Math.max(b.t, b.ticks - d.near.ticks);
        s.troll(o.g.def.troll);
        sfx(s, 'hehe');
      }
    }
    if (!b.lit) continue;
    if (b.out) {
      if (b.dudT > 0 && --b.dudT === 0) { b.out = false; sfx(s, 'click'); }
      continue;
    }
    b.t++;
    b.dirty = true;
    const p = Math.min(1, b.t / b.ticks);
    const prog = Math.pow(p, b.curve);
    // a dud: the fuse goes out halfway … and catches again later
    if (d.dud && !b.dudDone && prog >= d.dud.at) { b.dudDone = true; b.out = true; b.dudT = d.dud.wait; s.emitDust.emitParticleAt(sparkPos(b)[0], sparkPos(b)[1], 4); continue; }
    // stamping on the spark puts it out
    if (d.stomp && s.state === 'play' && p < 1) {
      const [sx, sy] = sparkPos(b);
      if (circleHits(s, sx, sy, 10, 0)) { b.out = true; b.lit = false; b.defused = true; sfx(s, 'land'); s.emitDust.emitParticleAt(sx, sy, 6); b.spark.setVisible(false); continue; }
    }
    if (p >= 1) boom(s, o, b);
  }
}

function sparkPos(b: Bomb): [number, number] {
  if (b.stuck || b.kicked) return [b.x + 2, b.y - 16];
  const prog = Math.pow(Math.min(1, b.t / b.ticks), b.curve);
  return polyAt(b.fuse, prog * b.len);
}

function cannonAngle(s: Scene, o: Obj): number {
  const d = o.d;
  if (o.locked !== null) return o.locked;
  const ph = (s.levelTick % d.period) / d.period;
  return d.a0 + (d.a1 - d.a0) * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
}

function stepObj(s: Scene, o: Obj): void {
  const d = o.d;
  const S = st(s);
  const hb = s.pbody;
  switch (o.kind) {
    case 'fw-bomb': stepBombs(s, o); break;
    case 'fw-cannon':
      if (d.mode === 'ride') {
        o.ang = cannonAngle(s, o);
        if (S.cap?.o === o) {
          const c = S.cap;
          c.t++;
          s.player.x = o.x; s.player.y = o.y - 6;
          if (c.t >= d.hold) {
            const a = (o.ang * Math.PI) / 180;
            s.player.x = o.x + Math.cos(a) * 46;
            s.player.y = o.y - 4 - Math.sin(a) * 46;
            hb.setVelocity(Math.cos(a) * d.v, -Math.sin(a) * d.v);
            S.cap = null;
            S.flight = 1;
            s.hero.setVisible(true);
            sfx(s, 'slam');
            s.cameras.main.shake(160, 0.01);
            s.emitDust.emitParticleAt(o.x + Math.cos(a) * 56, o.y - 4 - Math.sin(a) * 56, 10);
          }
        }
      } else if (o.on) {
        o.t++;
        if (d.stopAt !== undefined && hb.center.x > d.stopAt * T) { o.on = false; break; }
        if ((o.t - 1) % d.every === 0 && o.n < (d.count ?? 1e9)) {
          o.n++;
          const dir = Math.sign(d.vel[0]);
          shoot(s, { x: o.x + dir * 40, y: o.y - 6, vx: d.vel[0], vy: d.vel[1], g: d.grav ?? 0.5, r: 15, kind: 'ball', life: d.life ?? 400, bounce: d.bounce ?? 0, boom: 0, deadly: true, roll: !!d.roll, rico: d.rico }, 'fw-ball');
          sfx(s, 'slam');
          s.emitDust.emitParticleAt(o.x + dir * 44, o.y - 6, 5);
        }
      }
      break;
    case 'fw-mortar':
      if (!o.on) break;
      o.t++;
      if (d.targets) {
        for (const tg of d.targets) if (o.t === tg.t) {
          const tx = (tg.x + 0.5) * T, ty = tg.y * T;
          fireShell(s, o, tx, ty, tg.flight ?? d.flight, tg.hide);
        }
        break;
      }
      if (d.stopAt !== undefined && hb.center.x > d.stopAt * T) { o.on = false; break; }
      if ((o.t - (d.first ?? 1)) % d.every === 0 && o.t >= (d.first ?? 1)) {
        // aim where the hero will be when the shell comes down
        const tx = hb.center.x + (hb.velocity.x / 60) * d.flight;
        fireShell(s, o, tx, d.row * T - 8, d.flight);
      }
      break;
    case 'fw-burst':
      if (!o.on) break;
      o.t++;
      if (o.t === 1) {
        shoot(s, { x: o.x, y: o.y - 14, vx: 0, vy: -(d.h * T) / d.rise, g: 0, r: 4, kind: 'rocket', life: d.rise, bounce: 0, boom: 0, deadly: false }, 'fw-rocket');
        sfx(s, 'jump');
      }
      if (o.t === d.rise + 1) {
        const cx = o.x, cy = o.y - 14 - d.h * T;
        flash(s, cx, cy, 1.2);
        sfx(s, 'slam');
        const cols = [0xff6f91, 0xffd23f, 0x5b8cff, 0x6fd36b, 0xffffff];
        for (let k = 0; k < d.n; k++) {
          const a = (k / d.n) * Math.PI * 2;
          // angle from straight down (screen y down = +)
          const fromDown = Math.abs(Math.atan2(Math.cos(a), Math.sin(a)));
          if (fromDown < (d.gap * Math.PI) / 180 || Math.PI - fromDown < ((d.gapUp ?? 0) * Math.PI) / 180) continue;
          shoot(s, { x: cx, y: cy, vx: Math.cos(a) * d.v, vy: Math.sin(a) * d.v, g: d.grav, r: 6, kind: 'spark', life: d.life, bounce: 0, boom: 0, deadly: true }, 'fw-spark', cols[k % cols.length], 1.5);
        }
      }
      break;
    case 'fw-cake': {
      if (!o.on) break;
      o.t++;
      const order = d.order === 'ltr' ? o.tiles : [...o.tiles].reverse();
      for (let sv = 0; sv < (d.salvos ?? 1); sv++) {
        order.forEach((v, k) => {
          const dt = o.t - (d.wait + sv * (d.pause ?? 60) + k * d.gap);
          if (dt >= 0 && dt < (d.per ?? 1) * (d.perGap ?? 5) && dt % (d.perGap ?? 5) === 0) {
            o.n++;
            shoot(s, { x: v.x * T + T / 2, y: v.y * T + 30, vx: 0, vy: -d.v, g: 0, r: 9, kind: 'star', life: d.life ?? 60, bounce: 0, boom: 0, deadly: true }, 'fw-fire', [0xff6f91, 0xffd23f, 0x5b8cff, 0x6fd36b][k % 4]);
            sfx(s, 'jump');
          }
        });
      }
      break;
    }
    case 'fw-candle':
      if (!o.on) break;
      o.t++;
      for (const tt of d.times) if (o.t === tt) {
        o.n++;
        shoot(s, { x: o.x + Math.sign(d.vel[0]) * 12, y: o.y - (d.mouth ?? 20), vx: d.vel[0], vy: d.vel[1], g: d.grav ?? 0, r: 10, kind: 'fire', life: d.life ?? 300, bounce: 0, boom: 0, deadly: true }, 'fw-fire');
        sfx(s, 'jump');
        s.emitDust.emitParticleAt(o.x, o.y - 30, 3);
      }
      break;
    case 'fw-wheel':
      if (!o.on) break;
      o.t++;
      o.ang = (d.phase ?? 90) + (o.t / d.period) * 360 * (d.dir ?? 1);
      break;
    case 'fw-cord':
      if (!S.carry) break;
      for (const r of o.runs) {
        if (r.lit >= 0) continue;
        const h = heroRect(s, 2);
        for (const c of r.cells) {
          if (h.x < c.x * T + T && h.x + h.w > c.x * T && h.y + h.h > c.y * T + T - 10) {
            // the sparkler lights the cord: it flares up toward its bomb
            r.lit = 0;
            const bo = S.by.get(d.bomb);
            const bombs = bo?.bombs ?? [];
            const cx = (r.cells[0].x + r.cells[r.cells.length - 1].x + 1) / 2 * T;
            let best: Bomb | null = null;
            for (const b of bombs) if (!best || Math.abs(b.x - cx) < Math.abs(best.x - cx)) best = b;
            r.bomb = best;
            if (best && !best.lit && !best.boom) { best.lit = true; best.t = Math.max(0, best.ticks - d.delay); }
            s.troll(o.g.def.troll);
            sfx(s, 'trap');
            break;
          }
        }
      }
      for (const r of o.runs) if (r.lit >= 0) r.lit++;
      break;
  }
}

function fireShell(s: Scene, o: Obj, tx: number, ty: number, F: number, hide?: string): void {
  const g = o.d.grav ?? 0.4;
  const x0 = o.x, y0 = o.y - 22;
  const vx = (tx - x0) / F;
  const vy = (ty - y0 - 0.5 * g * F * (F + 1)) / F;
  shoot(s, { x: x0, y: y0, vx, vy, g, r: 7, kind: 'shell', life: F + 400, bounce: 0, boom: o.d.r ?? 1.3, deadly: true, hide, ty }, 'fw-shell');
  o.n++;
  sfx(s, 'slam');
  s.emitDust.emitParticleAt(x0, y0 - 6, 6);
}

// ---------------------------------------------------------------------------

export const l19: Ext = {
  name: 'l19',
  init(s) {
    s.ext.l19 = { objs: [], by: new Map(), proj: [], cap: null, flight: 0, stuck: null, stuckObj: null, carry: null, sparklerImg: null, booms: 0, solidKeys: new Map() } as St;
  },
  group(s, g) {
    if (!mine(s) || !KINDS.includes(g.def.ext?.kind)) return;
    makeTextures(s);
    const o = makeObj(s, g);
    st(s).objs.push(o);
    st(s).by.set(g.id, o);
  },
  action(s, a) {
    if (typeof a.ext !== 'string' || !a.ext.startsWith('l19.')) return false;
    const S = st(s);
    const o = S.by.get(a.g);
    if (!o) return true;
    const verb = a.ext.slice(4);
    const args = a.args ?? {};
    if (verb === 'light') {
      const idx: number[] = args.i === undefined ? o.bombs.map((b) => b.i) : [].concat(args.i);
      for (const i of idx) lightBomb(o.bombs[i], args.ticks);
      sfx(s, 'click');
      return 'trap';
    }
    if (verb === 'enter') {
      if (S.cap || s.state !== 'play') return true;
      S.cap = { o, t: 0 };
      o.locked = cannonAngle(s, o);
      s.hero.setVisible(false);
      sfx(s, 'click');
      return 'trap';
    }
    if (verb === 'go') {
      if (o.kind === 'fw-sparkler') {
        S.carry = o;
        for (const im of o.img) im.setVisible(false);
        if (!S.sparklerImg) { S.sparklerStick = s.track(s.add.image(0, 0, 'fw-sparkler').setScale(1 / RES).setDepth(4.7).setOrigin(0.5, 0.15)); S.sparklerImg = s.track(s.add.image(0, 0, 'fw-glow').setScale(1 / RES).setDepth(4.75)); }
        return true;
      }
      if (!o.on) { o.on = true; o.t = 0; }
      return o.kind === 'fw-wheel' || o.kind === 'fw-cake' || o.kind === 'fw-burst' ? 'trap' : true;
    }
    if (verb === 'stop') {
      if (o.kind === 'fw-sparkler') { S.carry = null; S.sparklerImg?.setVisible(false); S.sparklerStick?.setVisible(false); }
      o.on = false;
      return true;
    }
    return true;
  },
  move(s, m: MoveCtx) {
    if (!mine(s)) return;
    const S = st(s);
    if (S.cap) { m.dir = 0; m.jumpPressed = false; m.vx = 0; m.vy = 0; m.gravMul = 0; m.accMul = 0; }
    else if (S.flight > 0) { m.dir = 0; m.jumpPressed = false; m.accMul = 0; }
  },
  tick(s) {
    if (!mine(s) || s.state !== 'play') return;
    const S = st(s);
    if (S.flight > 0) {
      S.flight++;
      if (S.flight > 4 && s.grounded) S.flight = 0;
      if (S.flight > 600) S.flight = 0;
    }
    for (const o of S.objs) stepObj(s, o);
    stepProj(s);
  },
  interact(s) {
    if (!mine(s)) return;
    const S = st(s);
    for (const p of S.proj) if (p.deadly && circleHits(s, p.x, p.y, p.r)) { s.kill(p.kind === 'spark' || p.kind === 'star' ? 'sparks' : p.kind); return; }
    for (const o of S.objs) {
      if (o.kind !== 'fw-wheel' || !o.on) continue;
      const a = (o.ang * Math.PI) / 180;
      for (let r = 14; r <= o.d.L * T; r += 8) if (circleHits(s, o.x + Math.cos(a) * r, o.y - Math.sin(a) * r, 7)) { s.kill('sparks'); return; }
    }
  },
  render(s) {
    if (!mine(s) || !s.ext.l19) return;
    const S = st(s);
    const now = s.levelTick;
    for (const p of S.proj) {
      p.img.setPosition(p.x, p.y);
      if (p.kind === 'ball') p.img.setRotation(p.x / 15);
      if (p.kind === 'spark') p.img.setAlpha(Math.min(1, p.life / 20));
      if (p.kind === 'rocket' && now % 2 === 0) s.emitDeath.emitParticleAt(p.x, p.y + 16, 1);
    }
    for (const o of S.objs) {
      if (o.kind === 'fw-bomb') {
        for (const b of o.bombs) {
          if (b.boom || b.defused) continue;
          b.img.setPosition(b.x, b.y);
          if (b.kicked) b.img.setRotation(b.x / 14);
          if (b.lit && !b.out && b.ticks - b.t < 40) b.img.setTint(Math.floor(now / 4) % 2 ? 0xff8080 : 0xffffff);
          if (b.dirty && !b.stuck && !b.kicked && !b.e.hideCord) {
            b.dirty = false;
            const prog = b.lit || b.out || b.t > 0 ? Math.pow(Math.min(1, b.t / b.ticks), b.curve) : 0;
            b.cord.clear();
            b.cord.lineStyle(3, 0x3b2a2a, 1).beginPath();
            const start = polyAt(b.fuse, prog * b.len);
            b.cord.moveTo(start[0], start[1]);
            let acc = 0;
            for (let i = 1; i < b.fuse.length; i++) {
              acc += Math.hypot(b.fuse[i][0] - b.fuse[i - 1][0], b.fuse[i][1] - b.fuse[i - 1][1]);
              if (acc > prog * b.len) b.cord.lineTo(b.fuse[i][0], b.fuse[i][1]);
            }
            b.cord.lineTo(b.x, b.y - 10);
            b.cord.strokePath();
          }
          if (b.stuck || b.kicked) b.cord.clear();
          const showSpark = b.lit && !b.out;
          b.spark.setVisible(showSpark);
          if (showSpark) {
            const [sx, sy] = sparkPos(b);
            b.spark.setPosition(sx, sy).setRotation(now * 0.4).setScale((0.7 + 0.25 * Math.sin(now * 0.9)) / RES);
          }
        }
      } else if (o.kind === 'fw-cannon' && o.d.mode === 'ride') {
        o.img[1].setRotation(-(o.ang * Math.PI) / 180);
      } else if (o.kind === 'fw-wheel') {
        o.img[1].setRotation(o.on ? -now * 0.3 : 0);
        o.gfx.clear();
        const a = (o.ang * Math.PI) / 180;
        const L = o.d.L * T;
        o.gfx.lineStyle(4, o.on ? 0xffd23f : 0x8a8aa0, 1).lineBetween(o.x, o.y, o.x + Math.cos(a) * L, o.y - Math.sin(a) * L);
        if (o.on) for (let r = 20; r <= L; r += 14) o.gfx.fillStyle((r / 14 + now) % 2 ? 0xffffff : 0xff8a3d, 1).fillCircle(o.x + Math.cos(a) * r, o.y - Math.sin(a) * r, 4);
      } else if (o.kind === 'fw-cake') {
        o.gfx.clear();
        // candles on the cake: lit once it is going
        for (const v of o.tiles) {
          const x = v.x * T + T / 2, y = v.y * T + 2;
          if (o.on && o.t < o.d.wait + o.tiles.length * o.d.gap * (o.d.salvos ?? 1)) o.gfx.fillStyle(Math.floor(now / 3 + v.x) % 2 ? 0xffd23f : 0xff8a3d, 1).fillCircle(x, y - 3, 3);
        }
      } else if (o.kind === 'fw-cord') {
        o.gfx.clear();
        for (const r of o.runs) if (r.lit >= 0) {
          for (const c of r.cells) o.gfx.fillStyle(Math.floor(now / 2 + c.x) % 2 ? 0xffd23f : 0xff5a2e, 1).fillTriangle(c.x * T + 4, c.y * T + T - 2, c.x * T + T - 4, c.y * T + T - 2, c.x * T + T / 2, c.y * T + T - 14 - ((now + c.x * 3) % 6));
        }
      }
    }
    if (S.carry && S.sparklerImg) {
      const b = s.pbody;
      S.sparklerStick?.setVisible(true).setPosition(b.center.x + 14, b.center.y - 16).setRotation(0.5);
      S.sparklerImg.setVisible(true).setPosition(b.center.x + 14, b.center.y - 18).setRotation(now * 0.5).setScale((0.8 + 0.3 * Math.sin(now)) / RES);
    }
    if (S.cap) s.hero.setVisible(false);
  },
  snapshot(s) {
    if (!mine(s) || !s.ext.l19) return {};
    const S = st(s);
    const b: Record<string, number[]> = {};
    const ang: Record<string, number> = {};
    const n: Record<string, number> = {};
    for (const o of S.objs) {
      if (o.kind === 'fw-bomb') b[o.g.id] = [o.bombs.filter((x) => x.lit && !x.out).length, o.bombs.filter((x) => x.boom).length, o.bombs.filter((x) => x.defused).length];
      if (o.kind === 'fw-cannon' || o.kind === 'fw-wheel') ang[o.g.id] = Math.round(o.ang);
      n[o.g.id] = o.n;
    }
    return { l19: { b, ang, n, cap: !!S.cap, flight: S.flight, stuck: !!S.stuck, carry: !!S.carry, booms: S.booms, p: S.proj.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy)]) } };
  },
};
