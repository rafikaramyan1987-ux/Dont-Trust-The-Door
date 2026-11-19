// Level 15 "Laser Show": lasers, beams, scanners and light. A neon night lab.
//
// Group kinds (def.ext.kind; '?' groups are drawn here only, their map tile is where the prop sits):
//   beam     a laser along a polyline (pts, absolute px; or paths[i], switched with laser.path) or, with `down`, one
//            beam from every tile of the group straight down to the floor. Kills while the group is visible.
//            harmless (a sensor: `trip` – breaking it is remembered, see when {kind:'cut'}), dim (drawn dim while
//            hidden), holo (a harmless hologram), faint (barely visible), smoke (invisible: only the smoke column
//            it crosses glows), seq (after laser.start: on/off durations, `first` = 'on' | 'off', the last two repeat)
//   rot      a scanner ray from c (px) turning at w degrees per tick from a0, clipped by solid tiles
//   curtain  a vertical laser from y0 to y1 at x with a gap that moves (after laser.start) between lo and hi
//   prism    after laser.start it charges (warn ticks) and fans out rays to the floor points xs for `on` ticks
//   cam      a security camera at c panning between a0 and a1 (deg); if it sees you (cone + line of sight) the
//            room's laser grid fires (when {kind:'seen'})
//   radar    a speed camera: laser.zap strikes the hero (paired with when {kind:'fast', v})
//   dance    a dance floor of 2-tile panels from tile x0: after laser.start every other pair glows, then fires
//   solar    (tile '#') a lift that rises while you ride it and its solar panel is lit, and sinks while your
//            shadow covers the panel (the light beam comes down at bx from by)
//   blade    (tile '#', hidden, columns) a hard-light bridge that laser.extend slides out from the right, with a
//            laser blade on its tip until it has docked
//   cannon   after laser.start it charges, fires a beam from c to x1, rests (charge / fire / rest ticks)
import type { Ext, Scene } from './types';
import { PALETTES } from '../../config';

const T = 40;
const ID = 15;
type Seg = [number, number, number, number];
type Rec = { g: any; d: Record<string, any>; segs: Seg[]; lethal: boolean; look: 'laser' | 'dim' | 'sensor' | 'holo' | 'faint' | 'smoke' | 'light' | 'none'; path: number; props: any[]; box: any; v: number };
interface St {
  recs: Rec[];
  clock: Record<string, number>;
  cut: Record<string, boolean>;
  seen: Record<string, number>;
  zap: { x0: number; y0: number; x1: number; y1: number; t: number } | null;
  pool: any[];
  fx: any;
  used: number;
}

const st = (s: Scene): St => s.ext.l15;
const RED = 0xff2d55, PINK = 0xff7ad9, GREEN = 0x6dff8a, CYAN = 0x6ef3ff, GOLD = 0xffe27a;

/** walk from (x, y) toward angle `a` until a solid tile (or len px) */
function ray(s: Scene, x: number, y: number, a: number, len: number): [number, number] {
  const dx = Math.cos(a), dy = Math.sin(a);
  let d = 0;
  for (; d < len; d += 4) {
    const px = x + dx * d, py = y + dy * d;
    if (py < -40 || py > 18 * T + 40) break;
    if (s.staticSolid.has(Math.floor(py / T) * 1000 + Math.floor(px / T))) break;
  }
  return [x + dx * d, y + dy * d];
}

/** does the segment touch the rectangle grown by r? (Liang–Barsky) */
function hits(seg: Seg, x: number, y: number, w: number, h: number, r: number): boolean {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - (x - r), x + w + r - x1, y1 - (y - r), y + h + r - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

const heroRect = (s: Scene, inset = 3) => { const b = s.pbody; return { x: b.x + inset, y: b.y + inset, w: b.width - inset * 2, h: b.height - inset * 2 }; };

/** on/off schedule after a start: seq of durations, alternating from `first`; the last two repeat */
function seqOn(d: Record<string, any>, t: number): boolean {
  const seq: number[] = d.seq;
  let on = d.first !== 'off';
  for (let i = 0; i < 1000; i++) {
    const dur = i < seq.length ? seq[i] : seq[seq.length - 2 + ((i - seq.length) % 2)];
    if (t < dur) return on;
    t -= dur;
    on = !on;
  }
  return on;
}

function texture(s: Scene, key: string, w: number, h: number, draw: (g: any) => void): void {
  if (s.textures.exists(key)) return;
  const g = s.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function makeTextures(s: Scene): void {
  texture(s, 'l15-glow', 8, 24, (g) => {
    for (let i = 0; i < 12; i++) g.fillStyle(0xffffff, 0.03 + (i / 12) ** 2 * 0.5).fillRect(0, i, 8, 24 - i * 2);
  });
  texture(s, 'l15-core', 8, 4, (g) => { g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 4); });
  texture(s, 'l15-puff', 32, 32, (g) => { for (let r = 16; r > 2; r -= 2) g.fillStyle(0xffffff, 0.08).fillCircle(16, 16, r); });
  texture(s, 'l15-emit', 22, 22, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 22, 22, 5);
    g.fillStyle(0x4b4673, 1).fillRoundedRect(2, 2, 18, 18, 4);
    g.fillStyle(0xff2d55, 1).fillCircle(11, 11, 5);
    g.fillStyle(0xffffff, 0.9).fillCircle(9, 9, 2);
  });
  texture(s, 'l15-sensor', 14, 26, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 14, 26, 4);
    g.fillStyle(0x4b4673, 1).fillRoundedRect(2, 2, 10, 22, 3);
    g.fillStyle(0x6dff8a, 1).fillCircle(7, 8, 3);
  });
  texture(s, 'l15-mirror', 10, 44, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 10, 44, 3);
    g.fillStyle(0xdff6ff, 1).fillRect(3, 3, 4, 38);
    g.fillStyle(0xffffff, 1).fillRect(4, 5, 1, 12);
  });
  texture(s, 'l15-prism', 44, 38, (g) => {
    g.fillStyle(0x1b1838, 1).fillTriangle(22, 0, 0, 38, 44, 38);
    g.fillStyle(0x9ff7ff, 0.95).fillTriangle(22, 6, 6, 34, 38, 34);
    g.fillStyle(0xffffff, 0.8).fillTriangle(22, 10, 14, 26, 20, 26);
  });
  texture(s, 'l15-cam', 44, 26, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 2, 34, 22, 5);
    g.fillStyle(0xe8e6f5, 1).fillRoundedRect(2, 4, 30, 18, 4);
    g.fillStyle(0x1b1838, 1).fillRect(32, 7, 12, 12);
    g.fillStyle(0xff2d55, 1).fillCircle(8, 9, 3);
  });
  texture(s, 'l15-mount', 16, 16, (g) => { g.fillStyle(0x1b1838, 1).fillRect(5, 0, 6, 16); g.fillStyle(0x4b4673, 1).fillCircle(8, 12, 5); });
  texture(s, 'l15-radar', 40, 120, (g) => {
    g.fillStyle(0x1b1838, 1).fillRect(17, 20, 6, 100);
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 40, 26, 5);
    g.fillStyle(0xf6f1ff, 1).fillRoundedRect(2, 2, 36, 22, 4);
    g.fillStyle(0x1b1838, 1).fillCircle(12, 13, 8);
    g.fillStyle(0xffe27a, 1).fillCircle(12, 13, 5);
    // the "slow" sign: a snail-ish spiral
    g.lineStyle(2, 0x1b1838, 1).strokeCircle(29, 13, 6);
    g.lineStyle(2, 0x1b1838, 1).strokeCircle(29, 13, 2.5);
  });
  texture(s, 'l15-cannon', 46, 34, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 40, 34, 7);
    g.fillStyle(0x5b5590, 1).fillRoundedRect(3, 3, 34, 28, 6);
    g.fillStyle(0x1b1838, 1).fillRect(36, 10, 10, 14);
    g.fillStyle(0xff2d55, 1).fillCircle(20, 17, 7);
  });
  texture(s, 'l15-vent', 36, 12, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 36, 12, 3);
    for (let i = 0; i < 4; i++) g.fillStyle(0x7d77a8, 1).fillRect(4 + i * 8, 3, 4, 6);
  });
  texture(s, 'l15-panel', 40, 10, (g) => {
    g.fillStyle(0x1b1838, 1).fillRect(0, 0, 40, 10);
    for (let i = 0; i < 4; i++) g.fillStyle(0x3d7bff, 1).fillRect(2 + i * 9.5, 2, 8, 6);
  });
  texture(s, 'l15-lamp', 30, 16, (g) => {
    g.fillStyle(0x1b1838, 1).fillRoundedRect(0, 0, 30, 12, 4);
    g.fillStyle(0xffe27a, 1).fillRoundedRect(5, 8, 20, 8, 3);
  });
}

const prop = (s: Scene, r: Rec, key: string, x: number, y: number, ox = 0.5, oy = 0.5) => {
  const im = s.add.image(x, y, key).setOrigin(ox, oy);
  r.box.add(im);
  r.props.push(im);
  return im;
};

function makeRec(s: Scene, g: any): void {
  const d = g.def.ext as Record<string, any>;
  // the props live in their own container (a hidden laser keeps its emitter)
  const r: Rec = { g, d, segs: [], lethal: false, look: 'none', path: 0, props: [], box: s.track(s.add.container(0, 0).setDepth(4.9)), v: 0 };
  st(s).recs.push(r);
  switch (d.kind) {
    case 'beam': {
      if (d.down) for (const t of g.tiles) prop(s, r, 'l15-emit', t.tx * T + T / 2, t.ty * T + 11);
      else if (d.trip) { const p = d.pts; prop(s, r, 'l15-sensor', p[0][0], p[0][1] + 4); prop(s, r, 'l15-sensor', p[p.length - 1][0], p[p.length - 1][1] + 4); }
      else if (d.smoke) prop(s, r, 'l15-vent', d.smoke[0], d.smoke[2] - 6, 0.5, 0.5);
      else if (d.lines) for (const l of d.lines) prop(s, r, 'l15-emit', l[0], l[1] - 6);
      else if (!d.noBox) {
        const p = d.paths ? d.paths[0] : d.pts;
        prop(s, r, 'l15-emit', p[0][0], p[0][1]);
        if (d.ends) prop(s, r, 'l15-emit', p[p.length - 1][0], p[p.length - 1][1]);
      }
      for (const m of d.mirrors ?? []) { const im = prop(s, r, 'l15-mirror', m[0], m[1]); im.setRotation((m[2] * Math.PI) / 180); m.img = im; }
      break;
    }
    case 'rot': prop(s, r, 'l15-mount', d.c[0], d.c[1] - 8, 0.5, 0.5); prop(s, r, 'l15-emit', d.c[0], d.c[1]); break;
    case 'curtain': prop(s, r, 'l15-emit', d.x, d.y0 - 4); break;
    case 'prism': prop(s, r, 'l15-emit', d.c[0], d.top + 11); prop(s, r, 'l15-prism', d.c[0], d.c[1], 0.5, 0.5); break;
    case 'cam': prop(s, r, 'l15-mount', d.c[0], d.c[1] - 10); r.props.push(prop(s, r, 'l15-cam', d.c[0], d.c[1], 0.3, 0.5)); break;
    case 'radar': prop(s, r, 'l15-radar', d.c[0], d.c[1] - 13, 0.3, 0); break;
    case 'cannon': prop(s, r, 'l15-cannon', d.c[0] + 8, d.c[1], 1, 0.5); break;
    case 'solar': prop(s, r, 'l15-panel', d.bx, g.tiles.reduce((m: number, t: any) => Math.min(m, t.ty), 99) * T - 4, 0.5, 0.5); prop(s, r, 'l15-lamp', d.bx, d.by - 6); break;
    case 'dance': break;
    default: break;
  }
}

function rects(s: Scene, r: Rec): void {
  const { g, d } = r;
  const t = s.levelTick;
  const clk = st(s).clock[g.id];
  const since = clk === undefined ? -1 : t - clk;
  r.segs = [];
  r.lethal = false;
  r.look = 'none';
  switch (d.kind) {
    case 'beam': {
      if (d.seq && since >= 0) { const on = seqOn(d, since); if (on !== g.visible) { g.visible = on; g.container.setVisible(true); } }
      if (d.down) {
        for (const tt of g.tiles) {
          const x = tt.tx * T + T / 2 + g.ox, y = tt.ty * T + 20 + g.oy;
          const [, y2] = ray(s, x, y, Math.PI / 2, 900);
          r.segs.push([x, y, x, y2]);
        }
      } else if (d.lines) {
        for (const l of d.lines) r.segs.push([l[0] + g.ox, l[1] + g.oy, l[2] + g.ox, l[3] + g.oy]);
      } else {
        const pts: [number, number][] = d.paths ? d.paths[r.path] : d.pts;
        for (let i = 0; i + 1 < pts.length; i++) r.segs.push([pts[i][0] + g.ox, pts[i][1] + g.oy, pts[i + 1][0] + g.ox, pts[i + 1][1] + g.oy]);
      }
      const on = g.visible && !st(s).cut[g.id];
      r.lethal = on && !d.harmless && !d.holo;
      r.look = !on ? (d.dim ? 'dim' : 'none') : d.trip ? 'sensor' : d.holo ? 'holo' : d.faint ? 'faint' : d.smoke ? 'smoke' : 'laser';
      break;
    }
    case 'rot': {
      const a = ((d.a0 + d.w * t) * Math.PI) / 180;
      r.v = (((d.a0 + d.w * t) % 360) + 360) % 360;
      const [x2, y2] = ray(s, d.c[0], d.c[1], a, d.len);
      r.segs.push([d.c[0] + Math.cos(a) * 10, d.c[1] + Math.sin(a) * 10, x2, y2]);
      r.lethal = g.visible;
      r.look = g.visible ? 'laser' : 'none';
      break;
    }
    case 'curtain': {
      const mid = (d.lo + d.hi) / 2, amp = (d.lo - d.hi) / 2;
      const c = since < 0 ? d.lo : mid + amp * Math.cos((2 * Math.PI * since) / d.period + (d.phase * Math.PI) / 180);
      r.v = Math.round(c);
      const a = c - d.gap / 2, b = c + d.gap / 2;
      if (a > d.y0) r.segs.push([d.x, d.y0, d.x, a]);
      if (b < d.y1) r.segs.push([d.x, b, d.x, d.y1]);
      r.lethal = g.visible;
      r.look = 'laser';
      break;
    }
    case 'prism': {
      r.segs.push([d.c[0], d.top + 20, d.c[0], d.c[1] - 14]);
      r.lethal = true;
      r.look = 'laser';
      r.v = since;
      if (since >= d.warn && since < d.warn + d.on) for (const x of d.xs) r.segs.push([d.c[0], d.c[1] + 8, x, d.y]);
      break;
    }
    case 'cam': {
      const per = 2 * (d.hold + d.sweep);
      const ph = t % per;
      let k: number;
      if (ph < d.hold) k = 0;
      else if (ph < d.hold + d.sweep) k = (ph - d.hold) / d.sweep;
      else if (ph < 2 * d.hold + d.sweep) k = 1;
      else k = 1 - (ph - 2 * d.hold - d.sweep) / d.sweep;
      k = 0.5 - Math.cos(k * Math.PI) / 2;
      r.v = d.a0 + (d.a1 - d.a0) * k;
      const seen = st(s).seen[g.id];
      if (seen !== undefined && t - seen >= d.delay) {
        for (let x = d.grid[0]; x <= d.grid[1]; x += 34) r.segs.push([x, d.grid[2], x, d.grid[3]]);
        r.lethal = true;
        r.look = 'laser';
      }
      break;
    }
    case 'dance': {
      r.v = since;
      if (since < 0) break;
      const H = d.warn + d.fire;
      const k = Math.floor(since / H) % 2;
      if (since % H >= d.warn) {
        for (let i = k; i < d.pairs; i += 2) for (const dx of [8, 20, 32, 48, 60, 72]) {
          const x = (d.x0 + i * 2) * T + dx;
          r.segs.push([x, d.top, x, d.floor]);
        }
        r.lethal = true;
        r.look = 'laser';
      }
      break;
    }
    case 'cannon': {
      // `lead`: extra ticks before the first charge
      r.v = since < 0 ? -1 : since - (d.lead ?? 0);
      if (r.v < 0) break;
      const ph = r.v % (d.charge + d.fire + d.rest);
      if (ph >= d.charge && ph < d.charge + d.fire) {
        r.segs.push([d.c[0] + 6, d.c[1], d.x1, d.c[1]]);
        r.lethal = true;
        r.look = 'laser';
      }
      break;
    }
    case 'blade': {
      const tip = st(s).clock[`tip_${g.id}`];
      r.v = tip ?? -1;
      if (tip !== undefined && tip > d.minX) {
        r.segs.push([tip, d.y0, tip, d.y1]);
        r.lethal = true;
        r.look = 'laser';
      }
      break;
    }
    case 'solar': {
      const top = g.tiles.reduce((m: number, tt: any) => Math.min(m, tt.ty), 99) * T + g.oy - 8;
      const hr = heroRect(s, 0);
      const shade = hr.x < d.bx + 6 && hr.x + hr.w > d.bx - 6 && hr.y + hr.h > d.by && hr.y < top + 8;
      r.v = shade ? 1 : 0;
      r.segs.push([d.bx, d.by, d.bx, shade ? hr.y : top]);
      r.look = 'light';
      break;
    }
    default:
      break;
  }
}

function moveSolar(s: Scene, r: Rec): void {
  const { g, d } = r;
  const oy0 = g.oy;
  if (r.v === 1) g.oy = Math.min(d.maxOy, g.oy + d.down);
  else if (s.ride === g) g.oy = Math.max(d.minOy, g.oy - d.up);
  g.dy += g.oy - oy0;
  for (const z of g.bodies) { const b = z.getData('base'); z.setPosition(b.x + g.ox, b.y + g.oy); }
}

function stepBlade(s: Scene, r: Rec): void {
  const { g, d } = r;
  const k = `tip_${g.id}`;
  const S = st(s);
  if (S.clock[k] === undefined) return;
  if (S.clock[k] > d.minX) S.clock[k] = Math.max(d.minX, S.clock[k] - d.speed);
  const tip = S.clock[k];
  for (const z of g.bodies) { const b = z.getData('base'); (z.body as any).enable = b.x - T / 2 >= tip - 0.5; }
  // the bridge is drawn from its tip on (texture pixels are RES = 2 per px)
  if (g.img) g.img.setCrop(Math.max(0, (tip - g.img.x) * 2), 0, g.img.width, g.img.height);
}

const ext: Ext = {
  name: 'l15',
  init(s) {
    if (s.lvl?.id !== ID) return;
    // a neon night lab: the Neon Arcade colours (set before the terrain is drawn)
    s.lvl.world = 4;
    s.pal = PALETTES[4];
    s.bg?.setTexture('bg-4');
    s.dots?.setTexture('dots-4');
    s.hills?.setTexture('hills-4');
    s.bg?.setTint(0x8c86c0);
    makeTextures(s);
    const S: St = { recs: [], clock: {}, cut: {}, seen: {}, zap: null, pool: [], fx: null, used: 0 };
    s.ext.l15 = S;
    S.fx = s.track(s.add.graphics().setDepth(0.7));
  },
  group(s, g) {
    if (!s.ext.l15 || !g.def.ext) return;
    makeRec(s, g);
    if (g.def.ext.kind === 'blade' && g.img) g.img.setTint(0x9ff7ff).setAlpha(0.45);
  },
  action(s, a) {
    const S: St | undefined = s.ext.l15;
    if (!S || !a.ext.startsWith('laser.')) return false;
    const verb = a.ext.slice(6);
    const gs = [a.g, a.g2].filter(Boolean);
    if (verb === 'start') { for (const id of gs) if (S.clock[id] === undefined) S.clock[id] = s.levelTick; s.sfx('click'); return 'trap'; }
    if (verb === 'path') { for (const r of S.recs) if (gs.includes(r.g.id)) { r.path = a.args?.i ?? 1; for (const m of r.d.mirrors ?? []) m.img?.setRotation(((r.path ? m[3] : m[2]) * Math.PI) / 180); } s.sfx('flip'); return 'trap'; }
    if (verb === 'extend') {
      for (const r of S.recs) if (gs.includes(r.g.id)) {
        S.clock[`tip_${r.g.id}`] = r.d.maxX;
        r.g.visible = true;
        r.g.container.setVisible(true);
        stepBlade(s, r);
      }
      s.sfx('spikes');
      return 'trap';
    }
    if (verb === 'zap') {
      const r = S.recs.find((x) => x.g.id === a.g);
      const b = s.pbody;
      if (r) S.zap = { x0: r.d.c[0], y0: r.d.c[1], x1: b.center.x, y1: b.center.y, t: s.levelTick };
      s.cameras.main.flash(120, 255, 255, 255, false);
      s.kill('laser');
      return 'trap';
    }
    return false;
  },
  when(s, w) {
    const S: St | undefined = s.ext.l15;
    if (!S) return undefined;
    if (w.kind === 'cut') return !!S.cut[w.g];
    if (w.kind === 'seen') return S.seen[w.g] !== undefined;
    if (w.kind === 'fast') return Math.abs(s.pbody.velocity.x) > w.v;
    return undefined;
  },
  tick(s) {
    const S: St | undefined = s.ext.l15;
    if (!S) return;
    for (const r of S.recs) {
      if (r.d.kind === 'blade') stepBlade(s, r);
      rects(s, r);
      if (r.d.kind === 'solar') moveSolar(s, r);
    }
  },
  interact(s) {
    const S: St | undefined = s.ext.l15;
    if (!S) return;
    const hr = heroRect(s, 3);
    const b = s.pbody;
    for (const r of S.recs) {
      if (r.d.kind === 'cam' && S.seen[r.g.id] === undefined) {
        // the camera sees the hero: inside the cone and nothing solid in between
        const px = b.center.x, py = b.center.y;
        const dx = px - r.d.c[0], dy = py - r.d.c[1];
        const dist = Math.hypot(dx, dy);
        const da = ((Math.atan2(dy, dx) * 180) / Math.PI - r.v + 540) % 360 - 180;
        if (Math.abs(da) <= r.d.half && dist <= r.d.range) {
          const [ex, ey] = ray(s, r.d.c[0], r.d.c[1], Math.atan2(dy, dx), dist);
          if (Math.hypot(ex - r.d.c[0], ey - r.d.c[1]) >= dist - 6) { S.seen[r.g.id] = s.levelTick; s.sfx('hehe'); s.cameras.main.flash(90, 255, 40, 80, false); }
        }
      }
      if (!r.segs.length) continue;
      if (r.d.trip && r.g.visible && !S.cut[r.g.id]) {
        for (const sg of r.segs) if (hits(sg, hr.x, hr.y, hr.w, hr.h, 2)) { S.cut[r.g.id] = true; s.sfx('click'); }
      }
      if (!r.lethal) continue;
      for (const sg of r.segs) if (hits(sg, hr.x, hr.y, hr.w, hr.h, 3)) { s.kill('laser'); return; }
    }
  },
  render(s) {
    const S: St | undefined = s.ext.l15;
    if (!S || !S.fx) return;
    const v = s.cameras.main.worldView;
    const x0 = v.x - 200, x1 = v.x + v.width + 200;
    const fx = S.fx;
    fx.clear();
    S.used = 0;
    const t = s.levelTick;
    const flick = (t >> 1) % 7 === 0 ? 0.5 : 1;
    for (const r of S.recs) {
      const d = r.d;
      r.box.setPosition(r.g.ox, r.g.oy);
      const gx = r.g.tiles[0].tx * T;
      if (gx < x0 - 800 || gx > x1 + 800) continue;
      // extras drawn under the beams
      if (d.kind === 'cam') {
        const seen = S.seen[r.g.id] !== undefined;
        const pts: number[] = [d.c[0], d.c[1]];
        for (let i = 0; i <= 14; i++) {
          const a = ((r.v - d.half + (2 * d.half * i) / 14) * Math.PI) / 180;
          const [ex, ey] = ray(s, d.c[0], d.c[1], a, d.range);
          pts.push(ex, ey);
        }
        fx.fillStyle(seen ? RED : GOLD, seen ? 0.4 : 0.3);
        fx.beginPath();
        fx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) fx.lineTo(pts[i], pts[i + 1]);
        fx.closePath();
        fx.fillPath();
        const cam = r.props[r.props.length - 1];
        cam?.setRotation((r.v * Math.PI) / 180);
      } else if (d.kind === 'dance') {
        const since = r.v;
        const H = d.warn + d.fire;
        const k = since < 0 ? -1 : Math.floor(since / H) % 2;
        const warn = since >= 0 && since % H < d.warn;
        for (let i = 0; i < d.pairs; i++) {
          const x = (d.x0 + i * 2) * T;
          const lit = k === i % 2;
          const col = i % 2 ? CYAN : PINK;
          fx.fillStyle(col, lit ? (warn ? 0.5 + 0.4 * Math.sin(t * 0.5) : 0.95) : 0.3).fillRect(x + 3, d.floor - 10, 2 * T - 6, 12);
          fx.lineStyle(2, 0x1b1838, 1).strokeRect(x + 3, d.floor - 10, 2 * T - 6, 12);
          // a glowing pair is about to fire: its column shimmers
          if (lit && warn) fx.fillStyle(col, 0.1 + 0.07 * Math.sin(t * 0.5)).fillRect(x + 4, d.top, 2 * T - 8, d.floor - d.top - 10);
        }
      } else if (d.kind === 'radar') {
        // the watched stretch (dashes on the floor) and radar waves from the camera
        fx.lineStyle(4, GOLD, 0.9);
        for (let x = d.zone[0]; x < d.zone[1]; x += 24) fx.lineBetween(x + 2, d.y, x + 14, d.y);
        for (let k = 0; k < 3; k++) {
          const rr = 12 + ((t * 0.6 + k * 12) % 36);
          fx.lineStyle(3, GOLD, 0.9 * (1 - rr / 50));
          fx.beginPath();
          fx.arc(d.c[0] + 26, d.c[1], rr, -0.5, 0.7);
          fx.strokePath();
        }
      } else if (d.kind === 'cannon' && r.v >= 0) {
        const ph = r.v % (d.charge + d.fire + d.rest);
        if (ph < d.charge) fx.fillStyle(RED, 0.2 + (0.6 * ph) / d.charge).fillCircle(d.c[0] + 10, d.c[1], 4 + (14 * ph) / d.charge);
      } else if (d.kind === 'prism' && r.v >= 0 && r.v < d.warn) {
        fx.fillStyle(CYAN, 0.25 + 0.5 * Math.abs(Math.sin(t * 0.4))).fillCircle(d.c[0], d.c[1], 16 + (12 * r.v) / d.warn);
      } else if (d.kind === 'blade' && r.g.visible) {
        const tip = S.clock[`tip_${r.g.id}`];
        // hard light: a glowing cyan slab over the part that is out
        if (tip !== undefined && d.maxX > tip) {
          fx.fillStyle(CYAN, 0.35).fillRect(tip, d.y1 - 30, d.maxX - tip, 40);
          fx.fillStyle(0xffffff, 0.8).fillRect(tip, d.y1 - 30, d.maxX - tip, 3);
        }
      } else if (d.kind === 'beam' && d.smoke) {
        // the smoke column (it glows where the hidden beam crosses it)
        const [sx, sy0, sy1] = d.smoke;
        for (let i = 0; i < 9; i++) {
          const y = sy1 - ((t * 1.2 + i * 37) % (sy1 - sy0));
          const x = sx + Math.sin((t + i * 40) * 0.05) * 8;
          const lit = r.look === 'smoke' && r.segs.some((sg) => Math.abs(sg[0] - x) < 26 && y > Math.min(sg[1], sg[3]) && y < Math.max(sg[1], sg[3]));
          const im = puff(s, S);
          im.setPosition(x, y).setScale(1.2 + ((i * 7) % 5) * 0.12).setTint(lit ? 0xff4d6d : 0xcfc8ff).setAlpha(lit ? 0.95 : 0.55);
        }
      }
      if (r.look === 'none' || r.look === 'smoke') continue;
      for (const sg of r.segs) {
        if (Math.max(sg[0], sg[2]) < x0 || Math.min(sg[0], sg[2]) > x1) continue;
        const look = r.look;
        if (look === 'dim') line(s, S, sg, 0x8a86a8, 0.35, 0.25, 0.5);
        else if (look === 'sensor') line(s, S, sg, GREEN, 0.55, 0.95, 0.6);
        else if (look === 'faint') line(s, S, sg, PINK, 0.14, 0.32, 0.45);
        else if (look === 'holo') line(s, S, sg, RED, 0.55 * flick, 0.75 * flick, 1);
        else if (look === 'light') line(s, S, sg, GOLD, 0.45, 0.6, 1.6);
        else line(s, S, sg, d.kind === 'dance' ? (Math.floor(r.v / (d.warn + d.fire)) % 2 ? CYAN : PINK) : RED, 0.7, 1, 1.3);
      }
    }
    // the speed camera's strike
    if (S.zap && t - S.zap.t < 20) line(s, S, [S.zap.x0, S.zap.y0, S.zap.x1, S.zap.y1], GOLD, 0.8, 1, 1.6);
    for (let i = S.used; i < S.pool.length; i++) S.pool[i].setVisible(false);
  },
  snapshot(s) {
    const S: St | undefined = s.ext.l15;
    if (!S) return {};
    const o: Record<string, number> = {};
    for (const r of S.recs) o[r.g.id] = Math.round(r.v * 10) / 10;
    for (const k of Object.keys(S.cut)) o[`cut_${k}`] = 1;
    return { l15: o };
  },
};

function pooled(s: Scene, S: St, key: string): any {
  let im = S.pool[S.used];
  if (!im) { im = s.track(s.add.image(0, 0, key).setDepth(5.2)); S.pool.push(im); }
  S.used++;
  im.setTexture(key).setVisible(true).setAlpha(1).clearTint().setRotation(0).setScale(1).setOrigin(0.5, 0.5);
  return im;
}

function puff(s: Scene, S: St): any {
  return pooled(s, S, 'l15-puff');
}

/** a beam: a coloured glow and a white core (thickness scale k) */
function line(s: Scene, S: St, sg: Seg, color: number, glowA: number, coreA: number, k: number): void {
  const [x1, y1, x2, y2] = sg;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const g = pooled(s, S, 'l15-glow');
  g.setOrigin(0, 0.5).setPosition(x1, y1).setRotation(a).setDisplaySize(len, 24 * k).setTint(color).setAlpha(glowA);
  const c = pooled(s, S, 'l15-core');
  c.setOrigin(0, 0.5).setPosition(x1, y1).setRotation(a).setDisplaySize(len, 2.5 * k).setTint(color === GOLD ? 0xfff3b0 : 0xffffff).setAlpha(coreA);
}

export default ext;
