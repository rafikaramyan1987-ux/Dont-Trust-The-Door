// Level builder: composes the 10 levels from hand-made trap segments (levels/Lnn.mjs) and
// writes
//   src/levels/NN-slug.json  – the level data the game loads
//   src/i18n/en.json         – English texts (UI strings + every level text)
//   tests/plans.json         – the bot's condition-based plans: win from the start, win from
//                              every checkpoint, and per trap: its solution run from the
//                              previous checkpoint and a run that falls for it
// Usage: node tools/level-builder/build.mjs [levelIds…]
//
// Every trap segment registers exactly one troll. Its hint highlight ("danger") is computed
// here from the trap's own triggers and groups, so the highlight always equals the trigger
// area. Checkpoints go after every third trap; trap-free connectors fill each level up to
// its target width (they are seeded, so no terrain pattern repeats).
import { writeFileSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, checkpoint, end, connector } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROWS = 18;
// group ids: a-z (not o, v), A-Z (not P, D, F, C, H), 0-9
const IDS = [...'abcdefghijklmnpqrstuwxyz', ...'ABEGIJKLMNOQRSTUVWXYZ', ...'0123456789'];
const ACTION_GROUP_KEYS = ['fall', 'pop', 'retract', 'move', 'chase', 'show', 'hide', 'toss', 'eat', 'activate'];

class Builder {
  constructor(id, labels) {
    this.id = id;
    this.cols = 0;
    this.grid = Array.from({ length: ROWS }, () => []);
    this.groups = {};
    this.triggers = [];
    this.trolls = [];
    this.hints = [];
    this.fakeExits = {};
    this.x0 = 0;
    this.labels = labels || {};
    this.newLabels = {};
    this.uids = 0;
    this.lastF = null;
    this.hasDoor = false;
    this.text = {};
  }
  at(label) { return this.labels[label] ?? 0; }
  label(name) { this.newLabels[name] = this.x0; }
  px(t) { return (this.x0 + t) * 40; }
  set(x, y, ch) {
    if (y < 0 || y >= ROWS) return;
    const row = this.grid[y];
    while (row.length <= x) row.push('.');
    row[x] = ch;
    this.cols = Math.max(this.cols, x + 1);
    if (ch === 'F') this.lastF = x;
  }
  put(x, y, ch) { this.set(this.x0 + x, y, ch); }
  fill(x0, x1, y0, y1, ch) {
    for (let y = y0; y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) this.put(x, y, ch);
  }
  ground(x0, x1) { this.fill(x0, x1, 15, 17, '#'); }
  range(x0, x1, y0, y1) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([this.x0 + x, y]);
    return out;
  }
  rect(x, y, w, h) { return [this.x0 + x, y, w, h]; }
  tile(x, y) { return [this.x0 + x, y]; }
  group(def) {
    const id = IDS[Object.keys(this.groups).length];
    if (!id) throw new Error(`level ${this.id}: too many groups`);
    this.groups[id] = JSON.parse(JSON.stringify(def));
    return id;
  }
  groupTroll(g, trollId) { this.groups[g].troll = trollId; }
  /**
   * Register the segment's trap. `hint` is the English hint text (stored under the key
   * trap.<type>), `hazards` extra dangerous tile rects (local) that no trigger/group covers.
   */
  troll(name, { type, hint, hazards = [] }) {
    if (!type || !hint) throw new Error(`troll "${name}" needs type and hint`);
    if (this.trolls.length && this.curSeg?.troll) throw new Error(`segment ${this.curSeg.fn} registers two trolls`);
    const id = `t${this.trolls.length + 1}`;
    const key = `trap.${type}`;
    this.text[key] = hint;
    this.trolls.push({ id, name, type, hint: key, hazards: hazards.map(([x, y, w, h]) => [this.x0 + x, y, w, h]) });
    if (this.curSeg) this.curSeg.troll = id;
    return id;
  }
  tutorial(x, y, key) { this.hints.push({ x: this.x0 + x, y, text: key }); }
  trigger(def) { this.triggers.push(def); }
  uid(p) { return `${p}${++this.uids}`; }
  doorAt(x, y) {
    if (this.hasDoor) throw new Error('two EXIT doors');
    this.hasDoor = true;
    this.put(x, y, 'D');
  }
  fakeExit(trollId) { this.fakeExits[String(this.lastF)] = trollId; }
}

/** Expand a recipe: start, traps (checkpoint after every 3rd), connectors, end. */
function layout(spec, fillers) {
  const style = spec.style ?? 'ground';
  const items = [[start, { tutorial: spec.id === 1, style }]];
  spec.traps.forEach((tr, i) => {
    const f = fillers[i];
    if (f) items.push([connector, { w: f, seed: spec.id * 100 + i, style }]);
    items.push(Array.isArray(tr) ? tr : [tr, {}]);
    if ((i + 1) % 3 === 0 && i + 1 < spec.traps.length) items.push([checkpoint, { style }]);
  });
  const f = fillers[spec.traps.length];
  if (f) items.push([connector, { w: f, seed: spec.id * 100 + 99, style }]);
  items.push([end, { style }]);
  return items;
}

function buildLevel(spec, items, labels) {
  const b = new Builder(spec.id, labels);
  const segs = [];
  for (const item of items) {
    const [fn, opts, label] = item;
    if (label) b.label(label);
    const seg = { fn: fn.name, x0: b.x0, troll: null };
    b.curSeg = seg;
    const resolved = typeof opts === 'function' ? opts(b) : opts;
    const r = fn(b, resolved);
    // every segment starts on the ground (the previous one may end with a drop)
    seg.w = r.w;
    seg.win = r.win && r.win.length ? [['R', 's.grounded'], ...r.win] : [];
    seg.die = r.die;
    if (seg.troll && !r.die) throw new Error(`level ${spec.id}: trap segment ${fn.name} has no "die" plan`);
    segs.push(seg);
    b.x0 += r.w;
  }
  b.curSeg = null;
  return { b, segs };
}

function rectsOfTiles(tiles) {
  const set = new Set(tiles.map(([x, y]) => `${x},${y}`));
  const used = new Set();
  const out = [];
  const sorted = [...set].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y] of sorted) {
    if (used.has(`${x},${y}`)) continue;
    let w = 1;
    while (set.has(`${x + w},${y}`) && !used.has(`${x + w},${y}`)) w++;
    let h = 1;
    outer: for (;;) {
      for (let i = 0; i < w; i++) if (!set.has(`${x + i},${y + h}`) || used.has(`${x + i},${y + h}`)) break outer;
      h++;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add(`${x + i},${y + j}`);
    out.push([x, y, w, h]);
  }
  return out;
}

/** The dangerous tiles of a troll: its triggers' zones, touched groups, groups its actions
 *  move/drop/pop, groups that credit it, plus explicit hazards. (Same rule as the validator.) */
export function dangerTiles(level, troll) {
  const tiles = [];
  const groupTiles = (g) => {
    level.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === g) tiles.push([x, y]); }));
    for (const c of level.groups?.[g]?.cover ?? []) tiles.push(c);
  };
  const rect = ([x, y, w, h]) => { for (let j = Math.floor(y); j < Math.ceil(y + h); j++) for (let i = Math.floor(x); i < Math.ceil(x + w); i++) tiles.push([i, j]); };
  for (const t of level.triggers ?? []) {
    if (t.troll !== troll.id) continue;
    if (t.when.zone) rect(t.when.zone);
    if (t.when.touch) groupTiles(t.when.touch);
    for (const a of t.do) for (const k of ACTION_GROUP_KEYS) if (k in a) groupTiles(a[k]);
  }
  for (const [g, d] of Object.entries(level.groups ?? {})) if (d.troll === troll.id) groupTiles(g);
  for (const [x, id] of Object.entries(level.fakeExits ?? {})) if (id === troll.id) { level.map.forEach((row, y) => { if (row[x] === 'F') tiles.push([Number(x), y], [Number(x), y - 1]); }); }
  for (const h of troll.hazards ?? []) rect(h);
  return tiles.filter(([x, y]) => y >= 0 && y < ROWS && x >= 0);
}

function compile(spec, fillers) {
  const items = layout(spec, fillers);
  // two passes so segments can refer to positions of later segments (door destinations)
  let { b } = buildLevel(spec, items, {});
  const out = buildLevel(spec, items, b.newLabels);
  b = out.b;
  const segs = out.segs;
  const W = b.cols;
  const rows = b.grid.map((row) => { const r = row.slice(); while (r.length < W) r.push('.'); return r; });
  if (spec.cave) for (let y = 0; y < spec.cave; y++) for (let x = 0; x < W; x++) if (rows[y][x] === '.') rows[y][x] = '#';
  const map = rows.map((r) => r.join(''));
  const P = `L${spec.id}`;
  const text = { ...b.text, [`${P}.name`]: spec.name, [`${P}.win`]: spec.winMessage };
  spec.deathQuips.forEach((q, i) => { text[`${P}.quip${i + 1}`] = q; });
  const level = {
    id: spec.id, name: `${P}.name`, world: spec.id - 1, idea: spec.idea, winMessage: `${P}.win`,
    deathQuips: spec.deathQuips.map((_, i) => `${P}.quip${i + 1}`), hints: b.hints, map, groups: b.groups, triggers: b.triggers,
    trolls: b.trolls, fakeExits: Object.keys(b.fakeExits).length ? b.fakeExits : undefined,
  };
  // danger rects, bounding box and the solution of every trap
  for (const t of level.trolls) {
    const tiles = dangerTiles(level, t);
    if (!tiles.length) throw new Error(`level ${spec.id}: troll "${t.name}" has no dangerous tiles`);
    t.danger = rectsOfTiles(tiles);
    t.x = Math.min(...tiles.map(([x]) => x));
    t.w = Math.max(...tiles.map(([x]) => x)) - t.x + 1;
    const seg = segs.find((s) => s.troll === t.id);
    t.solution = seg.win;
    delete t.hazards;
  }
  // plans
  const cpIdx = segs.map((s, i) => (s.fn === 'checkpoint' ? i : -1)).filter((i) => i >= 0);
  const steps = (from, to) => segs.slice(from, to).flatMap((s) => s.win);
  const plans = { win: steps(0, segs.length), cps: cpIdx.map((i) => steps(i + 1, segs.length)), traps: {} };
  segs.forEach((s, i) => {
    if (!s.troll) return;
    const t = level.trolls.find((x) => x.id === s.troll);
    const prev = cpIdx.filter((c) => c < i);
    const cp = prev.length ? prev.length - 1 : -1;
    const from = cp >= 0 ? cpIdx[cp] + 1 : 0;
    plans.traps[t.name] = {
      id: t.id, type: t.type, cp,
      solve: [...steps(from, i + 1), ['R', 's.grounded'], ['R', `s.x>=${(t.x + t.w) * 40 + 20}`]],
      die: [...steps(from, i), ['R', 's.grounded'], ...s.die],
    };
  });
  return { level, plans, width: W, segs, text };
}

// ---------------------------------------------------------------------------

const only = process.argv.slice(2).map(Number);
const specs = [];
for (const f of readdirSync(join(dirname(fileURLToPath(import.meta.url)), 'levels')).filter((x) => /^L\d+\.mjs$/.test(x)).sort()) {
  specs.push((await import(`./levels/${f}`)).default);
}
const dir = join(ROOT, 'src', 'levels');
const planFile = join(ROOT, 'tests', 'plans.json');
const enFile = join(ROOT, 'src', 'i18n', 'en.json');
let allPlans = {};
let en = {};
if (only.length) {
  try { allPlans = JSON.parse(readFileSync(planFile, 'utf8')); } catch { /* none yet */ }
  try { en = JSON.parse(readFileSync(enFile, 'utf8')); } catch { /* none yet */ }
} else for (const f of readdirSync(dir)) if (f.endsWith('.json')) unlinkSync(join(dir, f));
Object.assign(en, JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ui-en.json'), 'utf8')));
for (const spec of specs.sort((a, b) => a.id - b.id)) {
  if (only.length && !only.includes(spec.id)) continue;
  // measure without fillers, then spread connectors so the level reaches its target width
  const slots = spec.traps.length + 1;
  const base = compile(spec, new Array(slots).fill(0)).width;
  const deficit = Math.max(0, spec.minWidth - base);
  const fillers = new Array(slots).fill(0);
  if (deficit > 0) {
    const per = Math.max(8, Math.ceil(deficit / slots));
    let left = deficit;
    for (let i = 0; i < slots && left > 0; i++) { const w = Math.max(8, Math.min(per + ((i * 3) % 4), left < 8 ? 8 : left)); fillers[i] = w; left -= w; }
  }
  const { level, plans, width, text } = compile(spec, fillers);
  for (const k of Object.keys(en)) if (k.startsWith(`L${spec.id}.`)) delete en[k];
  Object.assign(en, text);
  const txt = JSON.stringify(level, null, 2)
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2, $3, $4]')
    .replace(/\[\s+"([LRJ]*)",\s+("(?:[^"\\]|\\.)*"|-?\d+)\s+\]/g, '[$1$2]'.replace('$1', '"$1", '));
  writeFileSync(join(dir, `${String(spec.id).padStart(2, '0')}-${spec.slug}.json`), txt + '\n');
  allPlans[spec.id] = plans;
  console.log(`level ${spec.id} "${spec.name}": ${width} tiles (min ${spec.minWidth}), ${level.trolls.length} traps, ${plans.cps.length} checkpoints`);
}
// every trap type belongs to one level
const owner = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const L = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const t of L.trolls) {
    if (owner[t.type] !== undefined) throw new Error(`trap type "${t.type}" used twice (levels ${owner[t.type]} and ${L.id})`);
    owner[t.type] = L.id;
  }
}
const sorted = Object.fromEntries(Object.keys(en).sort().map((k) => [k, en[k]]));
writeFileSync(enFile, JSON.stringify(sorted, null, 2) + '\n');
writeFileSync(planFile, JSON.stringify(allPlans, null, 1) + '\n');
