// Shared helpers for the level segments.
//
// A segment is a function (b, opts) that draws itself at the builder's cursor and returns
//   w    – width in tiles
//   win  – bot plan steps that get through it (= the trap's machine-readable solution)
//   die  – (trap segments) plan steps that fall for the trap and must die
// Plan steps are [keys, until]: keys from "L","R","J"; until = ticks or an expression over
// the sim state `s` (x, y, vx, vy, grounded, gravity, g.<group> = [ox, oy, visible] …).
// x conditions are absolute pixels: use b.px(localTile).
//
// Ground segments stand on rows 15-17 (hero centre y = 586 when standing there).

export const T = 40;
export const run = (px) => ['R', `s.x>=${px}`];
export const runL = (px) => ['L', `s.x<=${px}`];
export const J = (n = 16) => ['RJ', n];
export const land = ['R', 's.grounded'];
export const wait = (n) => ['', n];

/** Small deterministic PRNG (connectors must never repeat a terrain pattern). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Shared pieces (not traps)

export function start(b, { tutorial = false, style = 'ground' } = {}) {
  floorFor(b, style, 0, 7);
  b.put(2, 14, 'P');
  if (tutorial) {
    b.tutorial(2, 10, 'tut.move');
    b.tutorial(6, 9, 'tut.jump');
    b.put(6, 14, '#');
    const X = b.px(0);
    return { w: 8, win: [run(X + 5 * T), J(12), land, run(X + 7 * T)] };
  }
  return { w: 8, win: [] };
}

export function checkpoint(b, { style = 'ground' } = {}) {
  floorFor(b, style, 0, 4);
  b.put(2, 14, 'C');
  return { w: 5, win: [] };
}

export function end(b, { style = 'ground' } = {}) {
  floorFor(b, style, 0, 7);
  b.doorAt(5, 14);
  return { w: 8, win: [['R', 's.state!=="play"']] };
}

/** The standard floor for a level style: ground rows 15-17, or a floating island (rows 15-16). */
export function floorFor(b, style, x0, x1) {
  if (style === 'sky') b.fill(x0, x1, 15, 16, '#');
  else b.ground(x0, x1);
}

/**
 * A connector: trap-free terrain whose shape comes from a seed, so no two connectors (or
 * traps) ever share a terrain pattern. Bumps, steps, floating ledges, small void gaps.
 */
export function connector(b, { w, seed, style = 'ground' }) {
  const r = rng(seed * 7919 + w);
  const X = b.px(0);
  const win = [];
  floorFor(b, style, 0, 1);
  let x = 2;
  while (x < w - 3) {
    const kind = Math.floor(r() * 4);
    if (kind === 0 && x + 4 < w - 2) {
      // a step up and down (1-2 high, 1-3 wide)
      const h = 1 + Math.floor(r() * 2), ww = 1 + Math.floor(r() * 3);
      floorFor(b, style, x, x + ww + 2);
      b.fill(x + 1, x + ww, 15 - h, 14, '#');
      win.push(run(X + (x + 1) * T - 40), J(h > 1 ? 16 : 10), land);
      x += ww + 3;
    } else if (kind === 1 && x + 5 < w - 2) {
      // a small void gap (1-2 wide)
      const gw = 1 + Math.floor(r() * 2);
      floorFor(b, style, x, x);
      win.push(run(X + (x + 1) * T - 34), J(12), land);
      floorFor(b, style, x + 1 + gw, x + 3 + gw);
      x += gw + 4;
    } else if (kind === 2 && x + 6 < w - 2) {
      // a floating ledge (decoration you can stand on)
      const ww = 2 + Math.floor(r() * 3), hy = 10 + Math.floor(r() * 3);
      floorFor(b, style, x, x + ww + 2);
      b.fill(x + 1, x + ww, hy, hy, '#');
      x += ww + 3;
    } else {
      // plain floor with a pebble pattern of 1-high bumps
      const ww = 2 + Math.floor(r() * 3);
      floorFor(b, style, x, x + ww);
      if (r() < 0.6) { b.put(x + 1, 14, '#'); win.push(run(X + (x + 1) * T - 40), J(10), land); }
      x += ww + 1;
    }
  }
  floorFor(b, style, x, w - 1);
  win.push(run(X + (w - 1) * T));
  return { w, win };
}
