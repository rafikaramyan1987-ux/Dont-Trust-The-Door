// Level 17 "Blown Away": wind. Wind zones push the hero (sideways, up or down; harder in the air than on the
// ground), fans and vents show where it comes from, streaks and leaves show which way it blows and how hard.
// Wind can blow in rhythm (cycle), follow a pattern that a weather vane forecasts, build up while you are inside
// (ramp), blow only while you stand still (still), be broken by a rock upwind (shelter), ride on a moving platform
// (follow) or be switched on / off / turned round by triggers. Also: balloons that lift you until you let go
// (jump), spiked thistles that float in an updraft and drop when it stops, and a windmill whose blades sweep the path.
//
// Group defs (tile '?', the zone given by `r`, its tiles as `cover` so the hint highlights them):
//   { kind: 'wind', r: [x, y, w, h], vx, vy, ground?, acc?, off?, cycle?: { on, off, warn?, at? },
//     pattern?: [[vx, ticks]…], lead?, vane?: [tx, ty], ramp?, still?, gust?, shelter?, show?, follow?, push?,
//     quiet?, fan?: [tx, ty, 'l'|'r'|'u'|'d'] }   (quiet: no streaks – plain air resistance)
//   { kind: 'balloon', lift }                      (one tile: walk into it to hold on, jump to let go)
//   { kind: 'thistle', wind: '<wind group id>' }   (each tile a floating spiked thistle; falls when that wind stops)
//   { kind: 'mill', c: [tx, ty], r, spin, stop, turns }  (a windmill rotor; hub at tile centre c)
// Actions: wind.on (args.ticks: a gust that stops by itself), wind.off, wind.flip, wind.set (args.vx / args.vy).
import Phaser from 'phaser';
import type { Ext, Scene, MoveCtx } from './types';
import { TILE, DT } from '../../config';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Streak { img: Phaser.GameObjects.Image; u: number; v: number; leaf: boolean; spin: number }
interface Wind {
  g: any; d: any;
  vx: number; vy: number; on: boolean;
  /** ticks left of a self-ending gust (-1: none) */
  gustT: number;
  /** ticks the wind has been on (ramp) / the hero has stood still (still) */
  rampT: number; stillT: number; stillGust: number;
  eff: [number, number];
  warn: boolean;
  /** weather vane: the direction it points (-1 / 1) */
  vaneDir: number;
  streaks: Streak[];
  fan: Phaser.GameObjects.Image | null;
  fanBox: Phaser.GameObjects.Image | null;
  fanAt: [number, number];
  fanSpin: number;
  vane: Phaser.GameObjects.Image | null;
  alpha: number;
}
interface Balloon { g: any; d: any; img: Phaser.GameObjects.Image; held: boolean; gone: boolean; x: number; y: number; vy: number }
interface Thistle { img: Phaser.GameObjects.Image; x: number; y: number; vy: number; falling: boolean; wind: string; ph: number }
interface Mill { g: any; d: any; rotor: Phaser.GameObjects.Image; cx: number; cy: number; ang: number }
interface St { winds: Wind[]; balloons: Balloon[]; thistles: Thistle[]; mills: Mill[]; held: Balloon | null }

const st = (s: Scene): St => s.ext.l17 as St;
const approach = (v: number, t: number, step: number) => (v < t ? Math.min(t, v + step) : v > t ? Math.max(t, v - step) : v);
const KEYS = ['l17-streak', 'l17-leaf', 'l17-fan', 'l17-fanbox', 'l17-vane', 'l17-pole', 'l17-balloon', 'l17-thistle', 'l17-rotor', 'l17-tower'];
const MILL_R = 170;

function textures(s: Scene): void {
  if (s.textures.exists(KEYS[KEYS.length - 1])) return;
  const OUT = 0x2b2d42;
  const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = s.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  // drawn at 2× and shown at 0.5 scale
  make('l17-streak', 84, 10, (g) => {
    g.fillStyle(0x6f8fbf, 0.5).fillRoundedRect(0, 2, 84, 6, 3);
    g.fillStyle(0x6f8fbf, 1).fillRoundedRect(36, 1, 48, 8, 4);
  });
  make('l17-leaf', 30, 20, (g) => {
    g.fillStyle(0xf0a23a, 1).fillEllipse(15, 10, 28, 15);
    g.lineStyle(2.5, 0x2b2d42, 1).strokeEllipse(15, 10, 28, 15);
    g.lineStyle(2, 0xa8611d, 1).lineBetween(3, 10, 27, 10);
  });
  make('l17-fan', 72, 72, (g) => {
    g.fillStyle(0xdfe7f2, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const p = (r: number, da: number) => ({ x: 36 + Math.cos(a + da) * r, y: 36 + Math.sin(a + da) * r });
      const p1 = p(8, -0.5), p2 = p(32, -0.25), p3 = p(32, 0.35), p4 = p(8, 0.5);
      g.fillPoints([p1, p2, p3, p4], true);
      g.lineStyle(3, OUT, 1).strokePoints([p1, p2, p3, p4], true);
    }
    g.fillStyle(0xff8a3d, 1).fillCircle(36, 36, 8);
    g.lineStyle(3, OUT, 1).strokeCircle(36, 36, 8);
  });
  make('l17-fanbox', 80, 80, (g) => {
    g.lineStyle(5, OUT, 1).strokeCircle(40, 40, 36);
    g.lineStyle(2, 0x6e788a, 0.9).strokeCircle(40, 40, 26).strokeCircle(40, 40, 15);
    g.lineBetween(4, 40, 76, 40).lineBetween(40, 4, 40, 76);
  });
  make('l17-vane', 70, 30, (g) => {
    g.fillStyle(0xff8a3d, 1).fillTriangle(70, 15, 48, 3, 48, 27);
    g.fillStyle(0x2b2d42, 1).fillRect(10, 12, 42, 6);
    g.fillStyle(0xff8a3d, 1).fillTriangle(0, 2, 16, 15, 0, 28);
    g.lineStyle(2, OUT, 1).strokeTriangle(70, 15, 48, 3, 48, 27);
  });
  make('l17-pole', 10, 120, (g) => { g.fillStyle(0x2b2d42, 1).fillRect(3, 0, 4, 120); g.fillStyle(0xffd23f, 1).fillCircle(5, 5, 5); });
  make('l17-balloon', 50, 110, (g) => {
    g.lineStyle(2, 0x2b2d42, 1).lineBetween(25, 56, 27, 110);
    g.fillStyle(0xff5a6e, 1).fillEllipse(25, 28, 46, 54);
    g.lineStyle(4, OUT, 1).strokeEllipse(25, 28, 46, 54);
    g.fillStyle(0xffffff, 0.7).fillEllipse(16, 16, 10, 16);
    g.fillStyle(0xff5a6e, 1).fillTriangle(20, 58, 30, 58, 25, 52);
  });
  make('l17-thistle', 40, 40, (g) => {
    g.fillStyle(0x9b5fd0, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      g.fillTriangle(20 + Math.cos(a) * 19, 20 + Math.sin(a) * 19, 20 + Math.cos(a + 0.3) * 9, 20 + Math.sin(a + 0.3) * 9, 20 + Math.cos(a - 0.3) * 9, 20 + Math.sin(a - 0.3) * 9);
    }
    g.fillStyle(0xc89bf0, 1).fillCircle(20, 20, 10);
    g.lineStyle(3, OUT, 1).strokeCircle(20, 20, 10);
    g.fillStyle(0xffffff, 0.9).fillCircle(16, 16, 3);
  });
  // windmill rotor: 4 sails (2× size), hub in the middle
  const R = MILL_R * 2, S = R * 2 + 20;
  make('l17-rotor', S, S, (g) => {
    const c = S / 2;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
      const q = (r: number, w: number) => ({ x: c + ux * r + px * w, y: c + uy * r + py * w });
      g.lineStyle(10, 0x6b4a2b, 1).lineBetween(c, c, c + ux * R, c + uy * R);
      const sail = [q(70, 6), q(R - 4, 6), q(R - 4, 44), q(70, 34)];
      g.fillStyle(0xf4ead2, 1).fillPoints(sail, true);
      g.lineStyle(4, OUT, 1).strokePoints(sail, true);
      g.fillStyle(0xff5a3d, 1).fillCircle(c + ux * (R - 8), c + uy * (R - 8), 12);
    }
    g.fillStyle(0x6b4a2b, 1).fillCircle(c, c, 22);
    g.lineStyle(5, OUT, 1).strokeCircle(c, c, 22);
  });
  make('l17-tower', 160, 420, (g) => {
    g.fillStyle(0xd8c7a6, 1).fillPoints([{ x: 50, y: 0 }, { x: 110, y: 0 }, { x: 150, y: 420 }, { x: 10, y: 420 }], true);
    g.lineStyle(5, OUT, 1).strokePoints([{ x: 50, y: 0 }, { x: 110, y: 0 }, { x: 150, y: 420 }, { x: 10, y: 420 }], true);
    g.fillStyle(0x8a6a4a, 1).fillRoundedRect(62, 300, 36, 120, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.fillStyle(0x8fd0ff, 1).fillCircle(80, 120, 16);
    g.lineStyle(4, OUT, 1).strokeCircle(80, 120, 16);
  });
}

/** the zone rect of a wind (px), following its group if it rides one */
function zone(s: Scene, w: Wind): { x: number; y: number; w: number; h: number } {
  const [x, y, ww, hh] = w.d.r;
  let ox = 0, oy = 0;
  if (w.d.follow) { const f = s.groups.get(w.d.follow); if (f) { ox = f.ox; oy = f.oy; } }
  return { x: x * TILE + ox, y: y * TILE + oy, w: ww * TILE, h: hh * TILE };
}

function inside(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

/** is a solid block within n tiles upwind of the hero (in the row of his centre)? */
function sheltered(s: Scene, w: Wind, n: number): boolean {
  const b = s.pbody;
  const tx = Math.floor(b.center.x / TILE), ty = Math.floor(b.center.y / TILE);
  const up = w.eff[0] < 0 ? 1 : -1;
  for (let k = 1; k <= n; k++) if (s.staticSolid.has(ty * 10000 + tx + up * k)) return true;
  return false;
}

function update(s: Scene, w: Wind): void {
  const d = w.d;
  const t = s.levelTick;
  let active = w.on;
  let vx = w.vx;
  w.warn = false;
  if (d.cycle) {
    const { on, off, warn = 0, at = 0 } = d.cycle;
    const ph = (t + at) % (on + off);
    if (ph >= on) { active = false; if (ph >= on + off - warn) w.warn = w.on; }
  }
  if (d.pattern) {
    const total = d.pattern.reduce((a: number, p: number[]) => a + p[1], 0);
    let ph = (t + (d.at ?? 0)) % total, i = 0;
    while (ph >= d.pattern[i][1]) { ph -= d.pattern[i][1]; i++; }
    vx = d.pattern[i][0];
    const left = d.pattern[i][1] - ph;
    const next = d.pattern[(i + 1) % d.pattern.length][0];
    // the vane swings round (points right, into the wind) `lead` ticks before a gust and while it blows
    w.vaneDir = (left <= (d.lead ?? 0) ? next : vx) !== 0 ? 1 : -1;
  }
  // a self-ending gust (wind.on with args.ticks)
  if (w.gustT > 0) { w.gustT--; if (w.gustT === 0) { w.on = false; active = false; } }
  if (d.still !== undefined) {
    // blows only once the hero has stood still in the zone for `still` ticks (and then for `gust` ticks)
    const b = s.pbody;
    const here = inside(b.center.x, b.center.y, zone(s, w));
    if (w.stillGust > 0) { w.stillGust--; active = true; }
    else {
      active = false;
      if (here && s.grounded && Math.abs(b.velocity.x) < 30 && s.state === 'play') w.stillT++;
      else w.stillT = 0;
      w.warn = w.stillT > 0;
      if (w.stillT >= d.still) { w.stillGust = d.gust ?? 60; w.stillT = 0; active = true; }
    }
  }
  let k = 1;
  if (d.ramp) {
    if (active) w.rampT++;
    else w.rampT = 0;
    k = Math.min(1, (w.rampT * d.ramp) / Math.max(1, Math.abs(vx)));
  }
  w.eff = active ? [vx * k, w.vy] : [0, 0];
}

export const L17: Ext = {
  name: 'l17',
  init(s) {
    s.ext.l17 = { winds: [], balloons: [], thistles: [], mills: [], held: null } as St;
  },
  group(s, g) {
    const d = g.def.ext;
    if (!d) return;
    if (!['wind', 'balloon', 'thistle', 'mill'].includes(d.kind)) return;
    textures(s);
    const S = st(s);
    if (d.kind === 'wind') {
      const w: Wind = { g, d, vx: d.vx ?? 0, vy: d.vy ?? 0, on: !d.off, gustT: -1, rampT: 0, stillT: 0, stillGust: 0, eff: [0, 0], warn: false, vaneDir: -1, streaks: [], fan: null, fanBox: null, fanAt: [0, 0], fanSpin: 0, vane: null, alpha: 0 };
      const [, , ww, hh] = d.r;
      const n = d.quiet ? 0 : Math.min(44, Math.max(5, Math.round((ww * hh) / 1.6)));
      let seed = (g.minTx * 977 + 13) >>> 0;
      const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
      for (let i = 0; i < n; i++) {
        const leaf = i % 4 === 3;
        const img = s.track(s.add.image(0, 0, leaf ? 'l17-leaf' : 'l17-streak').setScale(0.5).setDepth(4.7).setAlpha(0));
        w.streaks.push({ img, u: rnd(), v: rnd(), leaf, spin: (rnd() - 0.5) * 8 });
      }
      if (d.fan) {
        const [fx, fy] = d.fan;
        const cx = fx * TILE + TILE / 2, cy = fy * TILE + TILE / 2;
        w.fanBox = s.track(s.add.image(cx, cy, 'l17-fanbox').setScale(0.62).setDepth(3.1));
        w.fan = s.track(s.add.image(cx, cy, 'l17-fan').setScale(0.62).setDepth(3));
        w.fanAt = [cx, cy];
      }
      if (d.vane) {
        const [vx, vy] = d.vane;
        s.track(s.add.image(vx * TILE + TILE / 2, (vy + 1) * TILE, 'l17-pole').setOrigin(0.5, 1).setScale(0.6, 0.5).setDepth(-2));
        w.vane = s.track(s.add.image(vx * TILE + TILE / 2, (vy + 1) * TILE - 58, 'l17-vane').setScale(0.9).setDepth(-2));
      }
      S.winds.push(w);
    } else if (d.kind === 'balloon') {
      const tt = g.tiles[0];
      const x = tt.tx * TILE + TILE / 2, y = tt.ty * TILE + TILE / 2;
      const img = s.track(s.add.image(x, y - 6, 'l17-balloon').setScale(0.5).setDepth(5.5));
      S.balloons.push({ g, d, img, held: false, gone: false, x, y, vy: 0 });
    } else if (d.kind === 'thistle') {
      for (const tt of g.tiles) {
        const x = tt.tx * TILE + TILE / 2, y = tt.ty * TILE + TILE / 2;
        const img = s.track(s.add.image(x, y, 'l17-thistle').setScale(0.95).setDepth(4.5));
        S.thistles.push({ img, x, y, vy: 0, falling: false, wind: d.wind, ph: tt.tx * 1.7 + tt.ty });
      }
    } else if (d.kind === 'mill') {
      const cx = d.c[0] * TILE, cy = d.c[1] * TILE;
      s.track(s.add.image(cx, cy - 20, 'l17-tower').setOrigin(0.5, 0).setScale(0.5).setDepth(-3));
      const rotor = s.track(s.add.image(cx, cy, 'l17-rotor').setScale(0.5).setDepth(4.4));
      S.mills.push({ g, d, rotor, cx, cy, ang: Math.PI / 4 });
    }
  },
  action(s, a) {
    const [ns, verb] = String(a.ext).split('.');
    if (ns !== 'wind') return false;
    const w = st(s).winds.find((x) => x.g.id === a.g);
    if (!w) return true;
    if (verb === 'on') { w.on = true; w.rampT = 0; if (a.args?.ticks) w.gustT = a.args.ticks; }
    else if (verb === 'off') { w.on = false; w.gustT = -1; }
    else if (verb === 'flip') { w.vx = -w.vx; w.vy = -w.vy; }
    else if (verb === 'set') { if (a.args?.vx !== undefined) w.vx = a.args.vx; if (a.args?.vy !== undefined) w.vy = a.args.vy; }
    if (verb === 'on' || verb === 'flip') { s.sfx('flip'); return 'trap'; }
    return true;
  },
  move(s, m: MoveCtx) {
    const S = st(s);
    if (!S) return;
    const b = s.pbody;
    const cx = b.center.x, cy = b.center.y;
    for (const w of S.winds) {
      if (w.d.push === false || (!w.eff[0] && !w.eff[1])) continue;
      if (!inside(cx, cy, zone(s, w))) continue;
      if (w.d.shelter && sheltered(s, w, w.d.shelter)) continue;
      if (w.eff[0]) m.bias += w.eff[0] * (m.grounded ? (w.d.ground ?? 0.5) : 1);
      if (w.eff[1]) {
        m.gravMul = 0;
        m.vy = approach(m.vy, w.eff[1], (w.d.acc ?? 3000) * DT);
      }
    }
    const h = S.held;
    if (h) {
      if (m.jumpPressed) {
        // let go: the balloon floats away
        h.held = false;
        h.gone = true;
        h.vy = -h.d.lift;
        S.held = null;
        m.jumpPressed = false;
        s.sfx('pad');
      } else {
        m.gravMul = 0;
        m.vy = approach(m.vy, -h.d.lift, 1400 * DT);
        m.maxRun = Math.min(m.maxRun, 170);
        m.jumpPressed = false;
      }
    }
  },
  tick(s) {
    const S = st(s);
    if (!S) return;
    for (const w of S.winds) update(s, w);
    const b = s.pbody;
    // balloons: walk into one to hold on
    for (const bl of S.balloons) {
      if (bl.held) { bl.x = b.center.x + 6; bl.y = b.top - 26; continue; }
      if (bl.gone) { bl.vy = Math.max(bl.vy - 6, -300); bl.y += bl.vy * DT; continue; }
      if (!S.held && s.state === 'play' && Math.abs(b.center.x - bl.x) < 26 && Math.abs(b.center.y - bl.y) < 30) {
        bl.held = true;
        S.held = bl;
        s.sfx('coin');
        s.troll(bl.g.def.troll);
      }
    }
    // thistles fall once their updraft stops
    for (const th of S.thistles) {
      const w = S.winds.find((x) => x.g.id === th.wind);
      if (!th.falling && w && !w.on) th.falling = true;
      if (th.falling) { th.vy = Math.min(th.vy + 2300 * DT, 950); th.y += th.vy * DT; }
    }
    // windmill: turns `turns` quarter turns in `spin` ticks, then stands still for `stop` ticks (sails at 45°)
    for (const m of S.mills) {
      const { spin, stop, turns } = m.d;
      const t = s.levelTick, cyc = spin + stop;
      const n = Math.floor(t / cyc), ph = t % cyc;
      const q = (n * turns + (ph < spin ? (ph / spin) * turns : turns)) * (Math.PI / 2);
      m.ang = Math.PI / 4 + q;
    }
  },
  interact(s) {
    const S = st(s);
    if (!S) return;
    const b = s.pbody;
    const hx = b.center.x, hy = b.center.y;
    for (const th of S.thistles) {
      if (Math.abs(th.x - hx) < 24 && Math.abs(th.y - hy) < 26) { s.kill('thistle'); return; }
    }
    for (const m of S.mills) {
      for (let i = 0; i < 4; i++) {
        const a = m.ang + (i * Math.PI) / 2;
        const ux = Math.sin(a), uy = Math.cos(a); // a = 0: the sail points straight down
        const rx = hx - m.cx, ry = hy - m.cy;
        const along = rx * ux + ry * uy;
        if (along < 40 || along > MILL_R) continue;
        const across = Math.abs(rx * -uy + ry * ux);
        if (across < 24) { s.kill('windmill'); return; }
      }
    }
  },
  render(s, dt) {
    const S = st(s);
    if (!S) return;
    const cam = s.cameras.main;
    const vx0 = cam.worldView.x - 200, vx1 = cam.worldView.right + 200;
    for (const w of S.winds) {
      const z = zone(s, w);
      const near = z.x + z.w > vx0 && z.x < vx1;
      const [ex, ey] = w.eff;
      const sx = ex * (w.d.show ?? 1), sy = ey;
      const mag = Math.hypot(sx, sy);
      const target = mag > 0 ? Math.min(0.9, 0.4 + mag / 800) : w.warn ? 0.3 : 0;
      w.alpha = approach(w.alpha, target, dt * 3);
      // fan blades spin with the wind (and slow down when it stops)
      if (w.fan && w.d.follow) {
        const f = s.groups.get(w.d.follow);
        if (f) { w.fan.setPosition(w.fanAt[0] + f.ox, w.fanAt[1] + f.oy); w.fanBox?.setPosition(w.fanAt[0] + f.ox, w.fanAt[1] + f.oy); }
      }
      if (w.fan) { w.fanSpin = approach(w.fanSpin, (mag / 40) * Math.sign(sx || sy || 1), dt * 30); w.fan.rotation += w.fanSpin * dt; }
      if (w.vane) w.vane.setFlipX(w.vaneDir < 0);
      for (const k of w.streaks) {
        k.img.setVisible(near && w.alpha > 0.01);
        if (!near) continue;
        const sp = mag > 0 ? Math.max(160, mag * 1.3) : w.warn ? 60 : 0;
        const dirx = mag > 0 ? sx / mag : w.warn ? Math.sign(w.vx || w.vaneDir) * (w.d.show ?? 1) : 0, diry = mag > 0 ? sy / mag : 0;
        k.u += (dirx * sp * dt * (k.leaf ? 0.7 : 1)) / z.w;
        k.v += (diry * sp * dt * (k.leaf ? 0.7 : 1)) / z.h + (k.leaf ? Math.sin(s.tick * 0.08 + k.spin) * 0.002 : 0);
        k.u -= Math.floor(k.u);
        k.v -= Math.floor(k.v);
        // fade near the zone's edges so streaks do not pop
        const edge = Math.min(k.u, 1 - k.u, k.v, 1 - k.v) * 6;
        k.img.setPosition(z.x + k.u * z.w, z.y + k.v * z.h).setAlpha(w.alpha * Math.min(1, edge));
        if (k.leaf) k.img.rotation += k.spin * dt;
        else k.img.setRotation(mag > 0 || w.warn ? Math.atan2(diry, dirx) : 0);
      }
    }
    for (const bl of S.balloons) bl.img.setPosition(bl.x, bl.y + Math.sin(s.tick * 0.07) * 3).setVisible(bl.y > -200);
    for (const th of S.thistles) th.img.setPosition(th.x + (th.falling ? 0 : Math.sin(s.tick * 0.05 + th.ph) * 3), th.y + (th.falling ? 0 : Math.cos(s.tick * 0.06 + th.ph) * 4)).setRotation(th.falling ? th.img.rotation + dt * 6 : 0);
    for (const m of S.mills) m.rotor.setRotation(Math.PI / 2 - m.ang);
  },
  snapshot(s) {
    const S = st(s);
    if (!S || !S.winds.length && !S.balloons.length && !S.mills.length) return {};
    const w: Record<string, number> = {}, warn: Record<string, number> = {}, vane: Record<string, number> = {};
    for (const x of S.winds) { w[x.g.id] = Math.round(x.eff[0] || x.eff[1]); warn[x.g.id] = x.warn ? 1 : 0; vane[x.g.id] = x.vaneDir; }
    const mill = S.mills.map((m) => Math.round(((m.ang * 180) / Math.PI) % 360));
    return { w, warn, vane, balloon: S.held ? 1 : 0, mill };
  },
};
