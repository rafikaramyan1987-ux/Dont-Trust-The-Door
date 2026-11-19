// Level 16 "Size Matters": the hero shrinks and grows in a giant garden.
//
// Three sizes: tiny (14×14 px body, half-height gaps, low jump, slow legs, light: wind and air vents push him,
// flytraps hunt him), normal (26×28) and giant (52×56: needs 2-tile gaps, jumps higher, walks over 1-tile holes,
// heavy: breaks cracked planks, sinks lily pads, snaps springs). The body and the sprite always change together;
// growing where there is no room crushes the hero. Every respawn starts normal (scene.ext is rebuilt).
//
// Group kinds (group def `ext.kind`; most are '?' tiles drawn here):
//   shroom  { d: +1 | -1, float? }      a mushroom: red grows one step, blue shrinks one step (eaten on touch)
//   arch    { to: 'normal' | 'giant' | 'tiny' | 'pulse', a?, b?, every? }  a flower arch over the whole path:
//           walking through sets that size ('pulse': flips between a and b every `every` ticks until a white arch)
//   ring    { to }                       a fairy ring on the floor: sets the size of whoever WALKS into it
//   puff    { d }                        a puffball: bursts (changes size) only when you LAND on it
//   slab    { y, h }                     a solid half-tile (y, h in px inside the tile): tiny-only slots
//   vent    { lift }                     an air vent: blows tiny you up (column = the group's tiles)
//   wind    { vx, gust?: [on, off] }     a breeze over the group's tiles that pushes tiny you (px/s)
//   ray     { beam: [x, y, w, h], every, on }   a crystal that flashes a shrink beam over the rect (tiles)
//   bramble { y, h, sl?, tinyDoor? }     thorns: kill the hero's body inside (y, h px in each tile); tinyDoor:
//                                        this level's EXIT door is drawn tiny
//   flytrap { reach }                    a flytrap: snaps at tiny you within `reach` px of its mouth
//   crack   ('#' group)                  a cracked plank: breaks under giant you
//   lily    ('#' group) { sink, ticks, heavy? }  a lily pad: sinks under giant you (or under the sizes in `heavy`)
//   snap    ('=' group)                  a spring: giant you is too heavy, it snaps
import type { Ext, MoveCtx, Scene } from './types';

type Size = 'tiny' | 'normal' | 'giant';
const ORDER: Size[] = ['tiny', 'normal', 'giant'];
const SIZES: Record<Size, { w: number; h: number; scale: number; jump: number; run: number }> = {
  tiny: { w: 14, h: 14, scale: 0.55, jump: 0.62, run: 0.75 },
  normal: { w: 26, h: 28, scale: 1, jump: 1, run: 1 },
  giant: { w: 52, h: 56, scale: 2, jump: 1.2, run: 0.93 },
};
const T = 40;
const RES = 2;

interface R { x: number; y: number; w: number; h: number }
const overlap = (a: R, b: R) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

interface St {
  size: Size;
  disp: number;
  pulse: { a: Size; b: Size; every: number; t: number } | null;
  tinyDoor: boolean;
  /** fx objects redrawn per frame */
  beams: { g: any; def: any; img: any }[];
}
const st = (s: Scene): St => s.ext.l16;
/** this level's looping tweens per scene: removed when the level is rebuilt (their images are gone by then) */
const OWN = new WeakMap<Scene, any[]>();
const tween = (s: Scene, cfg: Record<string, unknown>) => { const t = s.tweens.add(cfg); OWN.get(s)?.push(t); return t; };
const kind = (g: any): string | undefined => g.def.ext?.kind;

// ---------------------------------------------------------------------------
// art (drawn once per texture key)

function tex(s: Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): string {
  if (s.textures.exists(key)) return key;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * RES);
  cv.height = Math.ceil(h * RES);
  const c = cv.getContext('2d')!;
  c.scale(RES, RES);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  s.textures.addCanvas(key, cv);
  return key;
}
const OUT = '#2b2d42';

function shroomTex(s: Scene, red: boolean): string {
  return tex(s, red ? 'l16-shroom-red' : 'l16-shroom-blue', 32, 32, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    c.fillStyle = '#fff3dc';
    c.beginPath(); c.roundRect(11, 15, 10, 15, 4); c.fill(); c.stroke();
    c.fillStyle = red ? '#ff4f5e' : '#4f8dff';
    c.beginPath(); c.moveTo(2, 19); c.quadraticCurveTo(3, 2, 16, 2); c.quadraticCurveTo(29, 2, 30, 19); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff';
    for (const [x, y, r] of [[9, 11, 2.6], [17, 7, 2.2], [24, 13, 2.4], [15, 15, 1.6]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    // a sign: + grows, − shrinks
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(13, 23); c.lineTo(19, 23); if (red) { c.moveTo(16, 20); c.lineTo(16, 26); } c.stroke();
  });
}

const ARCH_COL: Record<string, [string, string]> = {
  normal: ['#ffffff', '#c9f2c7'], giant: ['#ff4f5e', '#ffd0d4'], tiny: ['#4f8dff', '#cfe0ff'], pulse: ['#ffd23f', '#fff3b0'],
};
function archTex(s: Scene, to: string, rows: number): string {
  const [c1, c2] = ARCH_COL[to] ?? ARCH_COL.normal;
  return tex(s, `l16-arch-${to}-${rows}`, 40, rows * T, (c) => {
    const H = rows * T;
    c.lineWidth = 3;
    c.strokeStyle = OUT;
    // two vine posts and an arc of flowers over the top
    c.fillStyle = '#5fbf5a';
    c.beginPath(); c.roundRect(2, 14, 6, H - 14, 3); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(32, 14, 6, H - 14, 3); c.fill(); c.stroke();
    c.strokeStyle = '#3f8f3b';
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(5, 18); c.quadraticCurveTo(20, -4, 35, 18); c.stroke();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.1 + i * 0.2);
      const x = 20 - Math.cos(a) * 16, y = 18 - Math.sin(a) * 13;
      c.fillStyle = c1;
      c.strokeStyle = OUT;
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
    }
    // a soft glow curtain inside the arch: the size it gives you
    c.fillStyle = c2;
    c.globalAlpha = 0.45;
    c.fillRect(9, 20, 22, H - 20);
    c.globalAlpha = 1;
    // the sign on the arch: big, small, normal or both
    c.fillStyle = '#fff6d5';
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath(); c.roundRect(10, 22, 20, 16, 5); c.fill(); c.stroke();
    c.fillStyle = c1 === '#ffffff' ? '#6fd36b' : c1;
    if (to === 'giant') { c.fillRect(14, 29, 12, 3); c.fillRect(18.5, 25, 3, 11); }
    else if (to === 'tiny') c.fillRect(14, 29, 12, 3);
    else if (to === 'pulse') { c.fillRect(13, 26, 6, 2); c.fillRect(15, 24, 2, 6); c.fillRect(21, 31, 6, 2); }
    else { c.beginPath(); c.arc(20, 30, 4, 0, Math.PI * 2); c.fill(); }
  });
}

function ringTex(s: Scene): string {
  return tex(s, 'l16-ring', 40, 16, (c) => {
    c.lineWidth = 1.6;
    c.strokeStyle = OUT;
    for (const [x, sc] of [[8, 1], [21, 0.8], [33, 1.1]] as const) {
      c.fillStyle = '#fff3dc';
      c.fillRect(x - 1.5 * sc, 8, 3 * sc, 7);
      c.strokeRect(x - 1.5 * sc, 8, 3 * sc, 7);
      c.fillStyle = '#ff4f5e';
      c.beginPath(); c.ellipse(x, 8, 6 * sc, 4.5 * sc, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x - 2, 6, 1.1, 0, Math.PI * 2); c.fill();
    }
  });
}

function puffTex(s: Scene, burst: boolean): string {
  return tex(s, burst ? 'l16-puff-burst' : 'l16-puff', 40, 26, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    c.fillStyle = burst ? '#b9c7ff' : '#e8e3ff';
    c.beginPath();
    if (burst) c.ellipse(20, 22, 15, 4, 0, 0, Math.PI * 2);
    else c.ellipse(20, 15, 15, 10, 0, 0, Math.PI * 2);
    c.fill(); c.stroke();
    if (!burst) {
      c.fillStyle = '#9fb0ff';
      for (const [x, y] of [[13, 13], [21, 10], [27, 15], [18, 18]]) { c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI * 2); c.fill(); }
    }
  });
}

function slabTex(s: Scene, h: number): string {
  return tex(s, `l16-slab-${h}`, 40, h, (c) => {
    c.lineWidth = 3;
    c.strokeStyle = OUT;
    c.fillStyle = '#b5835a';
    c.beginPath(); c.roundRect(1.5, 1.5, 37, h - 3, 4); c.fill(); c.stroke();
    c.strokeStyle = '#8a5f3c';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(6, h / 2); c.lineTo(20, h / 2 - 2); c.moveTo(24, h / 2 + 2); c.lineTo(34, h / 2); c.stroke();
  });
}

function ventTex(s: Scene): string {
  return tex(s, 'l16-vent', 40, 10, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    c.fillStyle = '#8d99ae';
    c.beginPath(); c.roundRect(1, 1, 38, 8, 2); c.fill(); c.stroke();
    c.fillStyle = OUT;
    for (let x = 6; x < 36; x += 7) c.fillRect(x, 3, 3, 4);
  });
}

function streakTex(s: Scene): string {
  return tex(s, 'l16-streak', 6, 26, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(3, 24); c.quadraticCurveTo(0, 13, 3, 2); c.stroke();
  });
}

function fanTex(s: Scene): string {
  return tex(s, 'l16-fan', 40, 40, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    c.fillStyle = '#8d99ae';
    c.beginPath(); c.roundRect(16, 22, 8, 18, 2); c.fill(); c.stroke();
    c.fillStyle = '#dfe7f2';
    c.beginPath(); c.arc(20, 18, 16, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#5b8cff';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      c.beginPath(); c.ellipse(20 + Math.cos(a) * 7, 18 + Math.sin(a) * 7, 7, 3.5, a, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  });
}

function brambleTex(s: Scene, y: number, h: number): string {
  return tex(s, `l16-bramble-${y}-${h}`, 40, 40, (c) => {
    c.strokeStyle = '#3f7a35';
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, y + h * 0.4); c.bezierCurveTo(12, y + h, 26, y, 40, y + h * 0.5); c.stroke();
    c.beginPath(); c.moveTo(0, y + h * 0.75); c.bezierCurveTo(14, y + h * 0.2, 28, y + h, 40, y + h * 0.3); c.stroke();
    c.fillStyle = '#e9f5d0';
    c.strokeStyle = OUT;
    c.lineWidth = 1.2;
    for (const [x, yy, d] of [[6, 0.35, 1], [15, 0.8, -1], [23, 0.3, 1], [31, 0.75, -1], [37, 0.45, 1]] as const) {
      const py = y + h * yy;
      c.beginPath(); c.moveTo(x - 3, py); c.lineTo(x, py + 7 * d); c.lineTo(x + 3, py); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 3, py); c.lineTo(x, py - 6 * d); c.lineTo(x + 3, py); c.closePath(); c.fill(); c.stroke();
    }
  });
}

function flytrapTex(s: Scene, shut: boolean): string {
  return tex(s, shut ? 'l16-flytrap-shut' : 'l16-flytrap', 40, 48, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    c.fillStyle = '#5fbf5a';
    c.beginPath(); c.moveTo(20, 48); c.quadraticCurveTo(14, 36, 20, 26); c.lineTo(23, 26); c.quadraticCurveTo(18, 36, 24, 48); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(12, 42, 8, 3, -0.4, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(31, 42, 8, 3, 0.4, 0, Math.PI * 2); c.fill(); c.stroke();
    // the jaws
    const open = shut ? 0 : 8;
    c.fillStyle = '#ff6f91';
    c.beginPath(); c.moveTo(4, 18 - open); c.quadraticCurveTo(20, 4 - open, 36, 18 - open); c.lineTo(36, 20); c.quadraticCurveTo(20, 14, 4, 20); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(4, 20 + open); c.quadraticCurveTo(20, 34 + open, 36, 20 + open); c.lineTo(36, 22); c.quadraticCurveTo(20, 26, 4, 22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff';
    for (let x = 7; x <= 33; x += 6.5) {
      c.beginPath(); c.moveTo(x - 2, 19 - open * 0.4); c.lineTo(x, 23 - open * 0.4); c.lineTo(x + 2, 19 - open * 0.4); c.fill();
      c.beginPath(); c.moveTo(x - 2, 22 + open * 0.4); c.lineTo(x, 18 + open * 0.4); c.lineTo(x + 2, 22 + open * 0.4); c.fill();
    }
  });
}

function padTex(s: Scene, flower: boolean): string {
  return tex(s, flower ? 'l16-flowerhead' : 'l16-lilypad', 40, 40, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    if (flower) {
      // a big daisy head seen from the side: petals around a yellow middle, a stalk below
      c.fillStyle = '#5fbf5a';
      c.beginPath(); c.roundRect(17, 20, 6, 20, 2); c.fill(); c.stroke();
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) {
        const x = 4 + i * 5.3;
        c.beginPath(); c.ellipse(x, 9, 4, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.fillStyle = '#ffa8cf';
      c.beginPath(); c.roundRect(1.5, 4, 37, 10, 5); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.ellipse(20, 5, 9, 4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    } else {
      c.fillStyle = '#6fcf6a';
      c.beginPath(); c.ellipse(20, 8, 19, 7, 0, 0.2, Math.PI * 2 - 0.2); c.lineTo(20, 8); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#3f8f3b';
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(20, 8); c.lineTo(8, 5); c.moveTo(20, 8); c.lineTo(10, 12); c.moveTo(20, 8); c.lineTo(31, 12); c.stroke();
    }
  });
}

function crystalTex(s: Scene): string {
  return tex(s, 'l16-crystal', 40, 40, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = OUT;
    c.fillStyle = '#5fbf5a';
    c.beginPath(); c.roundRect(17, 26, 6, 14, 2); c.fill(); c.stroke();
    c.fillStyle = '#8fd0ff';
    c.beginPath(); c.moveTo(20, 2); c.lineTo(31, 14); c.lineTo(20, 30); c.lineTo(9, 14); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(20, 6); c.lineTo(24, 13); c.lineTo(20, 18); c.closePath(); c.fill();
  });
}

// ---------------------------------------------------------------------------
// size changes

/** is the box blocked by the level (static tiles, visible solid groups and slabs)? */
function blocked(s: Scene, r: R): boolean {
  const x0 = Math.floor((r.x + 0.5) / T), x1 = Math.floor((r.x + r.w - 0.5) / T);
  const y0 = Math.floor((r.y + 0.5) / T), y1 = Math.floor((r.y + r.h - 0.5) / T);
  if (r.x < 0 || r.x + r.w > s.worldW) return true;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (ty >= 0 && s.staticSolid.has(ty * 1000 + tx)) return true;
  for (const g of s.groups.values()) {
    if (!g.solid || !g.visible || g.state === 'gone') continue;
    for (const z of g.bodies) {
      const b = z.body;
      if (!b.enable) continue;
      if (overlap({ x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 }, { x: b.x, y: b.y, w: b.width, h: b.height })) return true;
    }
  }
  return false;
}

/** change the hero's size: body and sprite. Growing without room crushes him. Returns false if he died. */
function resize(s: Scene, to: Size): boolean {
  const S = st(s);
  if (S.size === to || s.state !== 'play') return true;
  const b = s.pbody;
  const D = SIZES[to];
  const cx = b.center.x, bot = b.bottom;
  const grow = D.h > SIZES[S.size].h;
  let spot: { x: number; bot: number } | null = null;
  // keep the feet where they are; growing may push the hero up out of a dip or aside from a wall
  outer: for (let dy = 0; dy <= (grow ? D.h : 0); dy += 2) {
    for (let dx = 0; dx <= (grow ? D.w : 0); dx += 2) {
      for (const sx of dx ? [-dx, dx] : [0]) {
        const x = cx + sx, y = bot - dy;
        if (!blocked(s, { x: x - D.w / 2, y: y - D.h, w: D.w, h: D.h })) { spot = { x, bot: y }; break outer; }
      }
    }
  }
  if (!spot) {
    s.kill('crush');
    return false;
  }
  const vx = b.velocity.x, vy = b.velocity.y;
  s.player.setSize(D.w, D.h);
  b.setSize(D.w, D.h);
  b.reset(spot.x, spot.bot - D.h / 2);
  // shrinking in mid-air: the little body loses most of its momentum
  const air = !s.grounded;
  b.setVelocity(!grow && air ? vx * 0.5 : vx, !grow && air && vy < 0 ? vy * 0.5 : vy);
  S.size = to;
  s.emitDust.emitParticleAt(b.center.x, b.center.y, grow ? 12 : 8);
  s.sfx(grow ? 'pad' : 'flip');
  s.hero.flash(grow ? 'shock' : 'focus', 0.4);
  return true;
}
const step = (sz: Size, d: number): Size => ORDER[Math.max(0, Math.min(2, ORDER.indexOf(sz) + d))];

// ---------------------------------------------------------------------------

const groupBox = (g: any): R => {
  const xs = g.tiles.map((t: any) => t.tx), ys = g.tiles.map((t: any) => t.ty);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: x0 * T + g.ox, y: y0 * T + g.oy, w: (Math.max(...xs) - x0 + 1) * T, h: (Math.max(...ys) - y0 + 1) * T };
};

function pickBox(t: { tx: number; ty: number }, fl: boolean): R {
  return { x: t.tx * T + 8, y: t.ty * T + (fl ? 8 : 14), w: 24, h: fl ? 24 : 26 };
}

/** an arch group: one arch per column (its tiles there, top to bottom) */
function archCols(g: any): { x: number; y: number; rows: number }[] {
  const by = new Map<number, number[]>();
  for (const t of g.tiles) { if (!by.has(t.tx)) by.set(t.tx, []); by.get(t.tx)!.push(t.ty); }
  return [...by].map(([x, ys]) => ({ x, y: Math.min(...ys), rows: Math.max(...ys) - Math.min(...ys) + 1 }));
}

/** is the hero (centre) inside a wind / vent column, and is the breeze blowing now */
function inside(s: Scene, g: any): boolean {
  const b = s.pbody;
  for (const t of g.tiles) if (b.center.x >= t.tx * T && b.center.x < t.tx * T + T && b.center.y >= t.ty * T && b.center.y < t.ty * T + T) return true;
  return false;
}
const blowing = (s: Scene, d: any): boolean => !d.gust || s.levelTick % (d.gust[0] + d.gust[1]) < d.gust[0];
const rayOn = (s: Scene, d: any): boolean => s.levelTick % d.every < d.on;

export const l16: Ext = {
  name: 'l16',
  init(s) {
    for (const t of OWN.get(s) ?? []) t.remove();
    OWN.set(s, []);
    s.ext.l16 = { size: 'normal', disp: 1, pulse: null, tinyDoor: false, beams: [] } as St;
  },
  group(s, g) {
    const k = kind(g);
    if (!k) return;
    const d = g.def.ext;
    const c = g.container;
    const img = (key: string, x: number, y: number, ox = 0.5, oy = 1) => { const i = s.add.image(x, y, key).setOrigin(ox, oy).setScale(1 / RES); c.add(i); return i; };
    if (d.troll) g.def.troll = d.troll;
    if (k === 'shroom') {
      g.eaten = new Set();
      for (const t of g.tiles) {
        const i = img(shroomTex(s, d.d > 0), t.tx * T + T / 2, t.ty * T + (d.float ? 36 : 40)).setName(`s${t.tx}_${t.ty}`);
        if (d.float) tween(s, { targets: i, y: i.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      c.setDepth(3);
    } else if (k === 'arch') {
      g.cols = archCols(g);
      for (const a of g.cols) img(archTex(s, d.to, a.rows), a.x * T + T / 2, (a.y + a.rows) * T);
      c.setDepth(4.7);
    } else if (k === 'ring') {
      for (const t of g.tiles) img(ringTex(s), t.tx * T + T / 2, (t.ty + 1) * T + 1);
      c.setDepth(1);
    } else if (k === 'puff') {
      for (const t of g.tiles) { const i = img(puffTex(s, false), t.tx * T + T / 2, (t.ty + 1) * T + 1); i.setName(`p${t.tx}`); }
      g.burst = new Set();
      c.setDepth(1);
    } else if (k === 'slab') {
      g.solid = true;
      for (const t of g.tiles) {
        img(slabTex(s, d.h), t.tx * T, t.ty * T + d.y, 0, 0);
        const z = s.add.zone(t.tx * T + T / 2, t.ty * T + d.y + d.h / 2, T, d.h);
        s.dyn.add(z);
        const zb = z.body;
        zb.setAllowGravity(false);
        zb.setImmovable(true);
        zb.moves = false;
        z.setData('grp', g);
        z.setData('base', { x: z.x, y: z.y });
        g.bodies.push(z);
        s.track(z);
      }
      c.setDepth(0.6);
    } else if (k === 'vent') {
      const bottom = Math.max(...g.tiles.map((t: any) => t.ty));
      for (const t of g.tiles) {
        if (t.ty === bottom) img(ventTex(s), t.tx * T + T / 2, (t.ty + 1) * T + 2);
        if ((t.tx + t.ty) % 2) continue;
        const sk = img(streakTex(s), t.tx * T + 12 + ((t.ty * 7) % 16), (t.ty + 1) * T - 4).setAlpha(0);
        tween(s, { targets: sk, y: sk.y - 40, alpha: { from: 0.8, to: 0 }, duration: 520, delay: ((t.tx * 3 + t.ty * 5) % 9) * 60, repeat: -1 });
      }
      c.setDepth(4.5);
    } else if (k === 'wind') {
      const xs = g.tiles.map((t: any) => t.tx), ys = g.tiles.map((t: any) => t.ty);
      const fx = d.vx < 0 ? Math.max(...xs) + 1 : Math.min(...xs) - 1;
      img(fanTex(s), fx * T + T / 2, (Math.max(...ys) + 1) * T).setFlipX(d.vx > 0);
      g.streaks = [];
      for (const t of g.tiles) {
        if ((t.tx + t.ty) % 2) continue;
        const sk = img(streakTex(s), t.tx * T + T / 2, t.ty * T + 26, 0.5, 0.5).setRotation(Math.PI / 2).setAlpha(0);
        tween(s, { targets: sk, x: sk.x + Math.sign(d.vx) * 30, alpha: { from: 0.8, to: 0 }, duration: 420, delay: ((t.tx * 7 + t.ty * 3) % 7) * 60, repeat: -1 });
        g.streaks.push(sk);
      }
      c.setDepth(4.5);
    } else if (k === 'ray') {
      const t = g.tiles[0];
      img(crystalTex(s), t.tx * T + T / 2, (t.ty + 1) * T);
      const beam = s.add.graphics();
      c.add(beam);
      st(s).beams.push({ g, def: d, img: beam });
      c.setDepth(4.5);
    } else if (k === 'bramble') {
      if (d.tinyDoor) st(s).tinyDoor = true;
      for (const t of g.tiles) img(brambleTex(s, d.y, d.h), t.tx * T, t.ty * T, 0, 0);
      c.setDepth(2);
    } else if (k === 'flytrap') {
      const t = g.tiles[0];
      g.trap = img(flytrapTex(s, false), t.tx * T + T / 2, (t.ty + 1) * T);
      g.snapT = 0;
      c.setDepth(3);
    } else if (k === 'lily') {
      // lily pads and flower heads instead of terrain
      g.img?.setVisible(false);
      for (const t of g.tiles) img(padTex(s, !!d.flower), t.tx * T, t.ty * T, 0, 0);
    }
  },
  move(s, m: MoveCtx) {
    const S = st(s);
    const D = SIZES[S.size];
    m.jumpMul *= D.jump;
    m.maxRun *= D.run;
    if (S.size !== 'tiny') return;
    // tiny you is light: breezes push you and air vents lift you
    for (const g of s.groups.values()) {
      const k = kind(g);
      if (!g.visible || (k !== 'wind' && k !== 'vent')) continue;
      if (!inside(s, g)) continue;
      if (k === 'wind' && blowing(s, g.def.ext)) { m.bias += g.def.ext.vx; s.troll(g.def.troll); }
      if (k === 'vent') { m.gravMul = -(g.def.ext.lift ?? 1); s.troll(g.def.troll); }
    }
  },
  tick(s) {
    const S = st(s);
    if (s.state !== 'play') return;
    // an air vent's lift has a top speed
    if (S.size === 'tiny' && s.pbody.velocity.y < -330) {
      for (const g of s.groups.values()) if (kind(g) === 'vent' && g.visible && inside(s, g)) { s.pbody.setVelocity(s.pbody.velocity.x, -330); break; }
    }
    if (S.pulse) {
      S.pulse.t++;
      if (S.pulse.t % S.pulse.every === 0) resize(s, S.size === S.pulse.a ? S.pulse.b : S.pulse.a);
    }
  },
  interact(s) {
    const S = st(s);
    const b = s.pbody;
    const hero = { x: b.x, y: b.y, w: b.width, h: b.height };
    const pr = { x: b.x + 3, y: b.y + 3, w: b.width - 6, h: b.height - 6 };
    for (const g of s.groups.values()) {
      if (s.state !== 'play') return;
      const k = kind(g);
      if (!k || !g.visible) continue;
      const d = g.def.ext;
      if (k === 'shroom') {
        const t = g.tiles.find((t: any) => !g.eaten.has(`${t.tx}_${t.ty}`) && overlap(hero, pickBox(t, d.float)));
        if (!t) continue;
        g.eaten.add(`${t.tx}_${t.ty}`);
        g.container.getByName(`s${t.tx}_${t.ty}`)?.setVisible(false);
        s.troll(g.def.troll);
        s.emitDust.emitParticleAt(b.center.x, b.center.y, 6);
        resize(s, step(S.size, d.d));
      } else if (k === 'arch') {
        if (!g.cols.some((a: any) => overlap(hero, { x: a.x * T + 14, y: a.y * T, w: T - 28, h: a.rows * T }))) continue;
        if (d.to === 'pulse') {
          if (S.pulse) continue;
          s.troll(g.def.troll);
          S.pulse = { a: d.a, b: d.b, every: d.every, t: 0 };
          resize(s, d.a);
          s.hero.flash('shock', 0.55);
          s.sfx('trap');
        } else {
          if (d.to === 'normal') S.pulse = null;
          if (S.size === d.to) continue;
          if (g.def.troll) { s.troll(g.def.troll); s.sfx('trap'); }
          resize(s, d.to);
        }
      } else if (k === 'ring') {
        if (!s.grounded || S.size === d.to) continue;
        const box = groupBox(g);
        if (!overlap(hero, { x: box.x + 4, y: box.y, w: box.w - 8, h: box.h + 2 })) continue;
        s.troll(g.def.troll);
        s.sfx('trap');
        resize(s, d.to);
      } else if (k === 'puff') {
        if (!s.grounded || s.wasGrounded) continue;
        for (const t of g.tiles) {
          if (g.burst.has(t.tx)) continue;
          if (b.right <= t.tx * T + 4 || b.left >= t.tx * T + T - 4 || Math.abs(b.bottom - (t.ty + 1) * T) > 4) continue;
          g.burst.add(t.tx);
          const i = g.container.getByName(`p${t.tx}`);
          if (i) i.setTexture(puffTex(s, true));
          s.emitDust.emitParticleAt(t.tx * T + T / 2, (t.ty + 1) * T - 8, 10);
          s.troll(g.def.troll);
          resize(s, step(S.size, d.d));
          break;
        }
      } else if (k === 'ray') {
        if (!rayOn(s, d) || S.size === 'tiny') continue;
        const [x, y, w, h] = d.beam;
        if (!overlap(hero, { x: x * T, y: y * T + 8, w: w * T, h: h * T - 16 })) continue;
        s.troll(g.def.troll);
        resize(s, 'tiny');
      } else if (k === 'bramble') {
        for (const t of g.tiles) {
          if (!overlap(pr, { x: t.tx * T, y: t.ty * T + d.y, w: T, h: d.h })) continue;
          s.troll(g.def.troll);
          s.kill('thorns');
          return;
        }
      } else if (k === 'flytrap') {
        if (S.size !== 'tiny') continue;
        const t = g.tiles[0];
        const mx = t.tx * T + T / 2, my = (t.ty + 1) * T - 20;
        if (Math.hypot(b.center.x - mx, b.center.y - my) > d.reach) continue;
        g.trap.setTexture(flytrapTex(s, true));
        tween(s, { targets: g.trap, x: g.trap.x + Math.sign(b.center.x - mx) * 10, duration: 70, yoyo: true });
        s.troll(g.def.troll);
        s.sfx('chomp');
        s.kill('flytrap');
        return;
      } else if (k === 'crack') {
        if (S.size !== 'giant' || s.ride !== g || g.state !== 'idle') continue;
        s.troll(g.def.troll);
        s.runActions([{ fall: g.id, shake: 3 }]);
      } else if (k === 'lily') {
        if (!(d.heavy ?? ['giant']).includes(S.size) || s.ride !== g || g.sunk) continue;
        g.sunk = true;
        s.troll(g.def.troll);
        s.sfx('crumble');
        s.runActions([{ move: g.id, by: [0, d.sink ?? 3], ticks: d.ticks ?? 40 }]);
      } else if (k === 'snap') {
        if (S.size !== 'giant' || b.velocity.y < 0) continue;
        for (const t of g.tiles) {
          if (!overlap(hero, { x: t.tx * T + 4, y: t.ty * T + 14, w: 32, h: 26 })) continue;
          g.visible = false;
          g.container.setAlpha(0.6).setScale(1, 1);
          for (const o of g.container.list) if (o.setTexture) o.setTexture('pad-dud-squash');
          s.troll(g.def.troll);
          s.sfx('crumble');
          s.say('say.boing', 'hero', 40);
          break;
        }
      }
    }
  },
  render(s, dt) {
    const S = st(s);
    if (!S || !s.hero) return;
    const want = SIZES[S.size].scale;
    if (s.state !== 'won' && (S.size !== 'normal' || Math.abs(S.disp - 1) > 0.005)) {
      S.disp += (want - S.disp) * Math.min(1, dt * 14);
      if (Math.abs(S.disp - want) < 0.005) S.disp = want;
      s.hero.setScale(S.disp, S.disp * (s.hero.flipped ? -1 : 1));
    }
    if (S.tinyDoor && s.door) s.door.setScale(0.4);
    for (const r of S.beams) {
      const d = r.def;
      const g = r.img;
      g.clear();
      const [x, y, w, h] = d.beam;
      const ph = s.levelTick % d.every;
      if (ph < d.on) {
        g.fillStyle(0x8fd0ff, 0.55).fillRect(x * T, y * T + 8, w * T, h * T - 16);
        g.fillStyle(0xffffff, 0.8).fillRect(x * T, y * T + h * T / 2 - 3, w * T, 6);
      } else if (ph > d.every - 30 && Math.floor(ph / 4) % 2 === 0) {
        g.fillStyle(0x8fd0ff, 0.35).fillRect(x * T, y * T + h * T / 2 - 2, w * T, 4);
      }
    }
    for (const g of s.groups.values()) {
      if (kind(g) !== 'wind' || !g.streaks) continue;
      const on = blowing(s, g.def.ext);
      for (const sk of g.streaks) sk.setVisible(on);
    }
  },
  snapshot(s) {
    const S = st(s);
    return S ? { l16size: S.size, l16pulse: S.pulse ? S.pulse.t : -1 } : {};
  },
};
