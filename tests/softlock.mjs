// Soft-lock analyzer: proves that from every place the hero can reach, he can either get
// out and continue toward the EXIT, or die (spikes, crushers, falling out of the level)
// and respawn. A place with neither is a soft-lock (e.g. a pit too deep to climb out of
// that has no spikes in it).
//
// Model: a graph over tiles. A "stand" node is an empty tile with solid ground under it
// (above it while gravity is flipped). Moves: walk, walk off an edge and fall, jump.
//   • REACHABILITY is over-approximated (generous jumps, falls that drift sideways), so
//     no place the hero could get to is missed.
//   • ESCAPE is under-approximated with conservative jumps (≤ 2 tiles up, ≤ 3-tile gaps,
//     while the real hero manages ~3 tiles up and ~4.7-tile gaps), so when the analyzer
//     says "escapable", the hero really can escape.
// It is run on several world states: the initial map, the map after every trap has
// fired, and each trap fired on its own (floors gone, platforms moved, spikes out, …).
// Heavy-gravity regions allow no climbing; "broken jump" regions allow no jumping.
// Newer mechanics: zone effects that hold while you are inside (turbo / super jump widen
// the reachable area; floating bubbles act as upward gravity; "jump flips gravity" lets you
// fall to the ceiling and back), platforms on orbits, followers and pulleys (sampled
// positions), teleporting platforms (cumulative moves), portal doors (an edge to their
// exit) and kicking doors (a wall). Moves that return on their own are transient and add no
// world state.

const ROWS = 18;
const SOLID = '#';
const isGroup = (ch) => (ch >= 'a' && ch <= 'z' && ch !== 'o' && ch !== 'v') || (ch >= 'A' && ch <= 'Z' && !'PDFCH'.includes(ch)) || (ch >= '0' && ch <= '9');
const SPIKES = new Set(['^', 'v', '<', '>', '*']);

const MOVES = {
  // [maxUp, gapReach] per vertical delta for the conservative (escape) model
  escape: { up: 2, reach: (dy) => (dy <= -2 ? 2 : dy === -1 ? 3 : 4), drift: 0 },
  // generous model for "where can the hero possibly get to"
  reach: { up: 3, reach: (dy) => (dy <= -3 ? 3 : 5), drift: 3 },
};

function regions(level, W) {
  // per-column modifiers derived from set/reset trigger pairs, ordered by x
  const grav = new Array(W).fill(1), heavy = new Array(W).fill(false), nojump = new Array(W).fill(false);
  const flipjump = new Array(W).fill(false), boost = new Array(W).fill(false);
  const evs = [];
  for (const t of level.triggers || []) {
    const z = t.when.zone;
    if (!z) continue;
    if (t.hold) {
      // zone effects hold exactly over the zone's columns
      for (let c = Math.max(0, Math.floor(z[0])); c < Math.min(W, Math.ceil(z[0] + z[2])); c++) for (const a of t.do) {
        if ('gravityScale' in a && a.gravityScale > 1) heavy[c] = true;
        if ('gravityScale' in a && a.gravityScale < 0) grav[c] = -1;
        if ('controls' in a && a.controls === 'nojump') nojump[c] = true;
        if ('controls' in a && a.controls === 'flipjump') { flipjump[c] = true; nojump[c] = true; }
        if ('controls' in a && (a.controls === 'turbo' || a.controls === 'superjump')) boost[c] = true;
      }
      continue;
    }
    if (t.every) continue; // rhythmic flips (gravity pulse) come back on their own
    for (const a of t.do) {
      if ('gravity' in a) evs.push({ x: z[0], kind: 'grav', on: a.gravity === 'flip' });
      if ('gravityScale' in a) evs.push({ x: z[0], kind: 'heavy', on: a.gravityScale > 1 });
      if ('controls' in a) evs.push({ x: z[0], kind: 'nojump', on: a.controls === 'nojump' });
    }
  }
  evs.sort((a, b) => a.x - b.x);
  for (const kind of ['grav', 'heavy', 'nojump']) {
    let on = false, last = 0;
    const arr = kind === 'grav' ? grav : kind === 'heavy' ? heavy : nojump;
    const list = evs.filter((e) => e.kind === kind);
    for (let i = 0; i <= list.length; i++) {
      const x = i < list.length ? Math.floor(list[i].x) : W;
      for (let c = last; c < x && c < W; c++) arr[c] = kind === 'grav' ? (on ? -1 : 1) : on;
      if (i < list.length) { on = list[i].on; last = Math.max(0, x); }
    }
  }
  return { grav, heavy, nojump, flipjump, boost };
}

/** Group tiles and the alternative configurations their triggers can put them in. */
function groupStates(level) {
  const groups = {};
  level.map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (isGroup(ch) && level.groups?.[ch]) (groups[ch] ??= []).push([x, y]);
  }));
  for (const [g, d] of Object.entries(level.groups || {})) for (const c of d.cover || []) (groups[g] ??= []).push(c);
  const alts = {}; // group -> list of {dx, dy, present}
  const add = (g, v) => (alts[g] ??= []).push(v);
  const at = {}; // cumulative offset of each group (teleporting platforms move step by step)
  for (const t of level.triggers || []) for (const a of t.do) {
    if ('fall' in a) add(a.fall, { dx: 0, dy: 0, present: false });
    if ('hide' in a) add(a.hide, { dx: 0, dy: 0, present: false });
    if ('show' in a) add(a.show, { dx: 0, dy: 0, present: true });
    if ('pop' in a) add(a.pop, { dx: 0, dy: 0, present: true });
    if ('eat' in a || 'toss' in a) add(a.eat ?? a.toss, { dx: 0, dy: 0, present: false });
    if ('activate' in a) add(a.activate, { dx: 0, dy: 0, present: false });
    if ('move' in a) {
      if (a.returnAfter !== undefined) continue; // comes back by itself: transient
      const [x0, y0] = at[a.move] ?? [0, 0];
      for (const f of [0.25, 0.5, 0.75, 1]) add(a.move, { dx: x0 + a.by[0] * f, dy: y0 + a.by[1] * f, present: true });
      at[a.move] = [x0 + a.by[0], y0 + a.by[1]];
    }
    if ('chase' in a) {
      const n = a.untilX !== undefined ? a.untilX : 0, m = a.untilY !== undefined ? a.untilY : 0;
      for (const f of [0.5, 1]) add(a.chase, { dx: n * f, dy: m * f, present: true });
    }
  }
  // platforms that move by themselves
  for (const [g, d] of Object.entries(level.groups || {})) {
    if (d.orbit) for (let k = 0; k < 8; k++) {
      const ph = d.orbit.phase ?? 0, a = ph + (k * Math.PI) / 4;
      add(g, { dx: d.orbit.r * (Math.cos(a) - Math.cos(ph)), dy: d.orbit.r * (Math.sin(a) - Math.sin(ph)), present: true });
    }
    if (d.follow) for (let v = d.follow.min; v <= d.follow.max; v += 1) add(g, { dx: v, dy: 0, present: true });
    if (d.pulley) for (let v = -d.pulley.range; v <= d.pulley.range; v += 0.5) {
      add(g, { dx: 0, dy: v, present: true, with: { [d.pulley.partner]: { dx: 0, dy: -v, present: true } } });
    }
  }
  return { groups, alts };
}

function buildGrid(level, W, groups, cfg) {
  // cfg: group -> {dx, dy, present}
  const pads = [];
  const grid = { warps: [] };
  const solid = Array.from({ length: ROWS }, () => new Array(W).fill(false));
  const deadly = Array.from({ length: ROWS }, () => new Array(W).fill(false));
  level.map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === SOLID) solid[y][x] = true;
    else if (SPIKES.has(ch)) deadly[y][x] = true;
    else if (ch === '=') pads.push({ x, y, side: 0 });
  }));
  for (const [g, cells] of Object.entries(groups)) {
    const d = level.groups[g];
    const c = cfg[g] ?? { dx: 0, dy: 0, present: !d.hidden };
    if (!c.present) continue;
    const isBlock = (d.tile === '#' && !d.fake) || (d.tile === 'F' && !!d.kick);
    const isDeadly = (SPIKES.has(d.tile) && !d.fake) || d.trapCoin || (d.tile === 'F' && !d.kick && !d.warp && !d.prop);
    for (const [x0, y0] of cells) {
      const x = x0 + Math.round(c.dx), y = y0 + Math.round(c.dy);
      if (x < 0 || x >= W || y < 0 || y >= ROWS) continue;
      if (isBlock) { solid[y][x] = true; if (d.tile === 'F' && y > 0) solid[y - 1][x] = true; }
      if (d.tile === 'F' && d.warp) grid.warps.push({ x, y, to: d.warp });
      if (isDeadly) deadly[y][x] = true;
      if (d.tile === '=' && !d.dud) pads.push({ x, y, side: d.launch ? d.launch[0] : 0 });
    }
  }
  // fake EXITs bite
  level.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'F') { deadly[y][x] = true; if (y > 0) deadly[y - 1][x] = true; } }));
  return { solid, deadly, pads, warps: grid.warps };
}

/** Movement helpers for one world state. */
function makeState(level, W, grid, reg) {
  const { solid, deadly } = grid;
  const S = (x, y) => x < 0 || x >= W || (y >= 0 && y < ROWS && solid[y][x]);
  const free = (x, y) => x >= 0 && x < W && (y < 0 || y >= ROWS || !solid[y][x]);
  const D = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < W && deadly[y][x];
  const g = (x) => reg.grav[Math.max(0, Math.min(W - 1, x))];
  // under the ceiling in a "jump flips gravity" strip you can stand upside down
  const onCeil = (x, y) => reg.flipjump[Math.max(0, Math.min(W - 1, x))] && g(x) > 0 && S(x, y - 1) && !S(x, y + 1);
  const stand = (x, y) => y >= 0 && y < ROWS && free(x, y) && !D(x, y) && (S(x, y + g(x)) || onCeil(x, y));
  const key = (x, y) => y * 1000 + x;

  // falling from (x, y) with the column's gravity (optionally drifting sideways)
  function fall(x, y, drift, gOverride) {
    const res = [];
    const cols = drift ? Array.from({ length: drift * 2 + 1 }, (_, i) => x - drift + i) : [x];
    for (const cx of cols) {
      if (cx < 0 || cx >= W) continue;
      const gg = gOverride ?? g(cx);
      let cy = y;
      for (let n = 0; n < 40; n++) {
        if (!free(cx, cy)) break;
        if (cy < 0 || cy >= ROWS) { res.push(DEATH); break; }
        if (D(cx, cy)) { res.push(DEATH); break; }
        if (S(cx, cy + gg)) { res.push(key(cx, cy)); break; }
        cy += gg;
      }
    }
    return res;
  }
  const rangeRows = (a, b) => { const r = []; for (let y = Math.min(a, b); y <= Math.max(a, b); y++) r.push(y); return r; };

  let padTarget = null;
  function moves(x, y, model) {
    const M = MOVES[model];
    const out = [];
    const gg = g(x);
    if (onCeil(x, y)) {
      // walking upside down along the ceiling, or flipping back down
      for (const dx of [-1, 1]) {
        const nx = x + dx;
        if (!free(nx, y)) continue;
        if (D(nx, y)) { out.push(DEATH); continue; }
        out.push(...(S(nx, y - 1) ? [key(nx, y)] : fall(nx, y, 0, -1)));
      }
      out.push(...fall(x, y, model === 'reach' ? 4 : 0, 1));
      return out;
    }
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (!free(nx, y)) continue;
      if (D(nx, y)) { out.push(DEATH); continue; }
      if (stand(nx, y)) out.push(key(nx, y));
      else out.push(...fall(nx, y, model === 'reach' ? M.drift : 0));
    }
    // "jump flips gravity": fall to the other side (ceiling ↔ floor), drifting while you run
    if (reg.flipjump[x]) out.push(...fall(x, y, model === 'reach' ? 4 : 0, -gg));
    // portal doors: step in, come out at the exit
    for (const w of grid.warps) if (w.x === x && (w.y === y || w.y === y + 1)) { const [tx, ty] = w.to; out.push(stand(tx, ty) ? key(tx, ty) : DEATH, ...fall(tx, ty, model === 'reach' ? 4 : 0)); }
    if (reg.nojump[x]) return out;
    const heavy = reg.heavy[x];
    const boost = model === 'reach' && reg.boost[x];
    const maxUp = heavy ? 0 : boost ? 5 : M.up;
    if (!free(x, y - gg)) return out; // no head room to jump
    for (let dyAbs = -maxUp; dyAbs <= 8; dyAbs++) {
      const dy = dyAbs * gg; // screen rows (negative = up under normal gravity)
      const reach = heavy ? 2 : boost ? 10 : M.reach(dyAbs);
      for (let dx = -reach; dx <= reach; dx++) {
        if (dx === 0 && dyAbs >= 0) continue;
        const tx = x + dx, ty = y + dy;
        if (ty < 0 || ty >= ROWS || tx < 0 || tx >= W) continue;
        // the arc: one row above the higher of start/target must be free in every column
        const top = gg > 0 ? Math.min(y, ty) - 1 : Math.max(y, ty) + 1;
        let ok = true, hitsDeath = false;
        const step = Math.sign(dx);
        for (let cx = x; ok; cx += step) {
          const mid = cx !== tx && cx !== x;
          const rows = cx === tx ? rangeRows(top, ty) : cx === x ? rangeRows(top, y) : rangeRows(top - gg, top);
          for (const ry of rows) {
            if (!free(cx, ry)) { ok = false; break; }
            // in the middle of a jump the hero is at least two tiles up: only the upper row can hurt
            if (D(cx, ry) && (!mid || ry === top - gg)) hitsDeath = true;
          }
          if (cx === tx || step === 0) break;
        }
        if (!ok) continue;
        if (hitsDeath || D(tx, ty)) { out.push(DEATH); continue; }
        if (stand(tx, ty)) out.push(key(tx, ty));
        else if (padTarget) out.push(...padTarget(tx, ty, model));
      }
    }
    return out;
  }
  // jump pads: being on a pad tile launches you; you can come down anywhere along the way
  const padAt = new Map();
  for (const p of grid.pads) padAt.set(key(p.x, p.y), p);
  function padMoves(x, y, model) {
    const p = padAt.get(key(x, y));
    if (!p) return [];
    const out = [];
    const spread = model === 'reach' ? 6 : 2;
    if (p.side) {
      const dir = Math.sign(p.side);
      for (let dx = 1; dx <= 12; dx++) { const cx = x + dir * dx; if (!free(cx, y - 1)) break; if (D(cx, y - 1)) { out.push(DEATH); break; } out.push(...fall(cx, y - 1, 0)); }
      return out;
    }
    for (let h = 1; h <= 11; h++) {
      const cy = y - h;
      if (!free(x, cy)) break;
      if (D(x, cy)) { out.push(DEATH); break; }
      for (let dx = -spread; dx <= spread; dx++) if (free(x + dx, cy)) out.push(...fall(x + dx, cy, 0));
    }
    return out;
  }
  padTarget = (x, y, model) => (padAt.has(key(x, y)) ? padMoves(x, y, model) : []);
  const baseMoves = moves;
  const allMoves = (x, y, model) => [...baseMoves(x, y, model), ...padMoves(x, y, model)];
  const nodes = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < W; x++) if (stand(x, y)) nodes.push(key(x, y));
  return { stand, fall, moves: allMoves, nodes, key, g };
}
const DEATH = -1;

/** Analyze one level. Returns { stuck: [{state, x, y}], states, reached }. */
export function analyzeLevel(level) {
  const W = level.map[0].length;
  const reg = regions(level, W);
  const { groups, alts } = groupStates(level);
  // goal = the EXIT's final position (door runs move it), and the tiles around it
  let door = null;
  level.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'D') door = [x, y]; }));
  for (const t of level.triggers || []) for (const a of t.do) if ('doorRun' in a) { const p = a.doorRun[a.doorRun.length - 1]; door = [Math.round(p[0]), Math.round(p[1])]; }
  const goalCells = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 0; dy++) goalCells.add((door[1] + dy) * 1000 + door[0] + dx);
  const starts = [];
  level.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'P' || ch === 'C') starts.push([x, y]); }));
  // world states: initial, all fired, each group's alternatives alone
  const configs = [{ name: 'initial', cfg: {} }];
  const all = {};
  for (const [gname, list] of Object.entries(alts)) {
    all[gname] = list[list.length - 1];
    list.forEach((v, i) => configs.push({ name: `${gname}#${i}`, cfg: { [gname]: v, ...(v.with ?? {}) } }));
  }
  configs.push({ name: 'all traps fired', cfg: all });
  const states = configs.map((c) => ({ ...c, h: makeState(level, W, buildGrid(level, W, groups, c.cfg), reg) }));
  const altState = new Map(); // "group#i" -> state index
  states.forEach((st, i) => altState.set(st.name, i));
  // group membership of every tile in the initial layout (to detect riding)
  const tileGroup = new Map();
  for (const [gname, cells] of Object.entries(groups)) for (const [x, y] of cells) tileGroup.set(y * 1000 + x, gname);

  // 1) over-approximated reachability over the union of world states
  const seen = new Set();
  const q = [];
  const push = (si, k) => { if (k < 0) return; const id = si * 1e6 + k; if (!seen.has(id)) { seen.add(id); q.push(id); } };
  for (const [sx, sy] of starts) states.forEach((st, si) => { for (const k of [st.h.key(sx, sy), ...st.h.fall(sx, sy, 0)]) if (k >= 0 && st.h.stand(k % 1000, Math.floor(k / 1000))) push(si, k); });
  while (q.length) {
    const id = q.pop();
    const si = Math.floor(id / 1e6), k = id % 1e6;
    const st = states[si];
    const x = k % 1000, y = Math.floor(k / 1000);
    for (const n of st.h.moves(x, y, 'reach')) push(si, n);
    // the world may change around the hero (any trap fires)
    states.forEach((o, oi) => {
      if (oi === si) return;
      if (o.h.stand(x, y)) push(oi, k);
      else for (const n of o.h.fall(x, y, 0)) push(oi, n);
    });
    // riding a moving group: carried to its moved position
    const under = (y + st.h.g(x)) * 1000 + x;
    const gname = tileGroup.get(under);
    if (gname && alts[gname]) alts[gname].forEach((v, i) => {
      const oi = altState.get(`${gname}#${i}`);
      if (oi === undefined || !v.present) return;
      const nx = x + Math.round(v.dx), ny = y + Math.round(v.dy);
      const o = states[oi];
      if (o.h.stand(nx, ny)) push(oi, o.h.key(nx, ny));
      else for (const n of o.h.fall(nx, ny, 0)) push(oi, n);
    });
  }
  // 2) conservative escape within each state: reach the EXIT or a death
  const stuck = [];
  const perState = [];
  let reached = 0, minMaxX = Infinity;
  states.forEach((st, si) => {
    const succ = new Map();
    for (const k of st.h.nodes) succ.set(k, st.h.moves(k % 1000, Math.floor(k / 1000), 'escape'));
    const ok = new Set();
    for (const k of st.h.nodes) if (goalCells.has(k) || succ.get(k).some((n) => n === DEATH)) ok.add(k);
    for (let changed = true; changed;) {
      changed = false;
      for (const k of st.h.nodes) if (!ok.has(k) && succ.get(k).some((n) => n >= 0 && ok.has(n))) { ok.add(k); changed = true; }
    }
    const mine = [...seen].filter((id) => Math.floor(id / 1e6) === si).map((id) => id % 1e6);
    for (const k of mine) if (!ok.has(k)) stuck.push({ state: st.name, x: k % 1000, y: Math.floor(k / 1000) });
    const maxX = mine.length ? Math.max(...mine.map((k) => k % 1000)) : -1;
    reached += mine.length;
    minMaxX = Math.min(minMaxX, maxX);
    perState.push({ state: st.name, maxX, reached: mine.length });
  });
  return { stuck, states: configs.length, reached, maxX: minMaxX, width: W, perState };
}
