// Hand-authored platforming between the traps of levels 11+ (no generated filler).
//
// A course is a list of pieces that I write out by hand, left to right, e.g.
//   course(b, [flat(3), up(2, 4), pit(3, 3), isle(2, 3, 2), down(3, 4), spikes(2, 3), ...])
// Every piece draws its terrain at the course cursor and adds the bot's steps to get through it. Each jump is
// checked with a model of the hero's movement (jumpArc, the game's PHYS numbers): the piece throws at build time
// if the hero could not make it, so a course can never contain an impossible jump. The real game then verifies
// every plan (npm run record / the self-test).
//
// Heights are floor-top rows: 15 = the normal ground (rows 15-17 solid). `up(2, …)` raises the floor to row 13.
import { T, run, land } from './lib.mjs';

const P = { maxRun: 300, airAccel: 2600, groundAccel: 3600, gravity: 2300, fallMul: 1.18, jumpVel: 770, cut: 0.45, maxFall: 950, bodyW: 26, bodyH: 28 };
const DT = 1 / 60;

/**
 * The hero's arc for a jump holding the key `hold` ticks, taking off at full run speed: [{x, y}] per tick, px from
 * the take-off point (y up = negative), feet position.
 */
export function jumpArc(hold, ticks = 90) {
  let x = 0, y = 0, vx = P.maxRun, vy = -P.jumpVel;
  let jumping = true;
  const out = [];
  for (let t = 0; t < ticks; t++) {
    // the game: velocity set by controlPlayer (cut on release, gravity), then the body moves
    if (jumping && t >= hold && vy < 0) { vy *= P.cut; jumping = false; }
    if (vy >= 0) jumping = false;
    vy += P.gravity * (vy > 0 ? P.fallMul : 1) * DT;
    if (vy > P.maxFall) vy = P.maxFall;
    vx = Math.min(P.maxRun, vx + P.airAccel * DT);
    x += vx * DT;
    y += vy * DT;
    out.push({ x, y });
  }
  return out;
}

/**
 * Choose a take-off point and a hold so the hero (feet) clears everything up to `clearX` px at `clearH` px above the
 * take-off floor, and lands on [landA, landB] (px from the take-off EDGE) at height `dh` px above it.
 * Returns { off, hold } with off = take-off position relative to the edge (≤ 0), or null.
 */
function planJump({ clearX, obstacle = 0, landA, landB, dh, lowCeil = Infinity }) {
  const half = P.bodyW / 2;
  for (const off of [-10, -24, -40, -60, -80, -100]) {
    for (let hold = 1; hold <= 22; hold++) {
      const arc = jumpArc(hold);
      // the body's leading edge is +half from its centre; centre starts at `off`
      let ok = true;
      let landed = null;
      for (let i = 0; i < arc.length; i++) {
        const cx = off + arc[i].x, fy = -arc[i].y; // feet height above take-off floor
        if (fy + P.bodyH > lowCeil) { ok = false; break; }
        // an obstacle standing on the take-off floor over [0, clearX]: the body must stay above it there
        if (obstacle > 0 && cx + half > 0 && cx - half < clearX && fy < obstacle) { ok = false; break; }
        // a higher landing floor: its wall face starts at clearX
        if (dh > 0 && cx + half > clearX && fy < dh - 1 && !(i > 0 && arc[i].y > arc[i - 1].y && -arc[i - 1].y >= dh - 0.5)) { ok = false; break; }
        // falling onto the landing floor
        if (i > 0 && arc[i].y > arc[i - 1].y && fy <= dh && -arc[i - 1].y >= dh - 0.5) {
          landed = cx;
          break;
        }
        if (fy < dh - 200) break;
      }
      if (!ok || landed === null) continue;
      if (landed - half >= landA - 2 && landed + half <= landB + 2 && landed > clearX + half - 6) return { off, hold, landed };
    }
  }
  return null;
}

class Course {
  constructor(b, top) {
    this.b = b;
    this.x = 0;
    this.top = top;
    this.win = [];
    this.X = b.px(0);
    this.thin = false;
  }
  /** a floor column x (local) at floor-top row `top`: solid to the bottom, or 2 thick (an island) */
  col(x, top, thin) {
    if (thin) this.b.fill(x, x, top, Math.min(17, top + 1), '#');
    else this.b.fill(x, x, top, 17, '#');
  }
  floor(n, thin = this.thin) {
    for (let i = 0; i < n; i++) this.col(this.x + i, this.top, thin);
    this.x += n;
  }
  /** a jump from the current floor edge (cursor) over `gap` columns onto a floor at `top2`, `len` long */
  jump(gap, top2, len, { thin = false, obstacle = 0, lowCeil } = {}) {
    const dh = (this.top - top2) * T;
    const landA = gap * T, landB = (gap + len) * T;
    const clearX = gap * T;
    const j = planJump({ clearX, obstacle: obstacle * T + 2, landA, landB, dh, lowCeil });
    if (!j) throw new Error(`level ${this.b.id}: course jump gap ${gap} dh ${dh / T} len ${len} at local x ${this.x} is not makeable`);
    const edge = this.X + this.x * T;
    this.win.push(run(edge + j.off), ['RJ', j.hold], land);
    this.x += gap;
    this.top = top2;
    this.thin = thin;
    this.floor(len, thin);
  }
}

// ---- pieces (each returns (course) => void) ----

/** n tiles of floor (keep these short: the course is about jumping) */
export const flat = (n) => (c) => c.floor(n);
/** a step up by dh (1-3) onto n tiles */
export const up = (dh, n) => (c) => c.jump(0, c.top - dh, n);
/** a step down by dh onto n tiles: walk off */
export const down = (dh, n) => (c) => {
  c.top += dh;
  c.thin = false;
  c.floor(n);
};
/** a bottomless pit `g` wide, then n tiles (optionally dh higher / lower) */
export const pit = (g, n, dh = 0) => (c) => c.jump(g, c.top - dh, n);
/** a spike-lined pit `g` wide (spikes on a floor at the bottom row), then n tiles */
export const spikes = (g, n, dh = 0) => (c) => {
  const x0 = c.x;
  for (let i = 0; i < g; i++) {
    c.b.put(x0 + i, 17, '#');
    c.b.put(x0 + i, 16, '^');
  }
  c.jump(g, c.top - dh, n);
};
/** a floating island (2 thick, void below) after a gap g, `n` long, dy higher than the current floor */
export const isle = (g, n, dy = 0) => (c) => c.jump(g, c.top - dy, n, { thin: true });
/** a block h high (1-2) and w wide standing on the floor, then n tiles of floor after it: hop over */
export const block = (h, w, n) => (c) => {
  // the block is drawn on top of floor columns; the jump clears it and lands beyond
  const top = c.top;
  const x0 = c.x;
  for (let i = 0; i < w; i++) {
    c.col(x0 + i, top, c.thin);
    c.b.fill(x0 + i, x0 + i, top - h, top - 1, '#');
  }
  c.jump(w, top, n, { obstacle: h, thin: c.thin });
};
/** a spike strip (1-3 wide) on the floor to hop, then n tiles */
export const thorns = (w, n) => (c) => {
  const top = c.top;
  for (let i = 0; i < w; i++) {
    c.col(c.x + i, top + 1 > 17 ? top : top + 1, c.thin);
    c.b.put(c.x + i, top, '^');
  }
  c.jump(w, top, n, { thin: c.thin });
};
/** a low roof with spikes under it over the next n tiles of floor: walk, do not jump */
export const roof = (n, gapRows = 2) => (c) => {
  const top = c.top;
  for (let i = 0; i < n; i++) {
    c.col(c.x + i, top, c.thin);
    c.b.put(c.x + i, top - gapRows - 1, 'v');
    c.b.fill(c.x + i, c.x + i, Math.max(0, top - gapRows - 4), top - gapRows - 2, '#');
  }
  c.x += n;
  c.win.push(run(c.X + c.x * T - 10));
};
/** single-tile pillars: k pillars of floor separated by gaps g, each pillar `w` wide, heights by dys */
export const pillars = (g, w, dys) => (c) => {
  for (const dy of dys) c.jump(g, c.top - dy, w, { thin: false });
};

/** Draw a hand-written course at the builder's cursor; returns the segment ({ w, win }). */
export function course(b, pieces, { top = 15 } = {}) {
  const c = new Course(b, top);
  for (const p of pieces) p(c);
  if (c.top !== 15) throw new Error(`level ${b.id}: a course must end on the normal ground (row 15), ends at ${c.top}`);
  c.win.push(run(c.X + c.x * T - 10));
  return { w: c.x, win: c.win };
}
