// Level builder: composes long levels from troll set-pieces (segments.mjs) and writes
//   src/levels/NN-name.json   – the level data the game loads
//   tests/plans.json          – the bot's condition-based plans (win from start, win from
//                               the checkpoint, and one plan per troll that must kill)
// Usage: node tools/level-builder/build.mjs
//
// The JSON files are the source of truth for the game; this script is just a fast way to
// author many long levels. Hand-written JSON levels work too (see README).
import { writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './segments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROWS = 18;
const LETTERS = 'abcdefghijklmnpqrstuwxyz'.split(''); // no o / v (coin & spike chars)

class Builder {
  constructor(labels) {
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
  group(def) {
    const id = LETTERS[Object.keys(this.groups).length];
    if (!id) throw new Error('too many groups in one level');
    this.groups[id] = JSON.parse(JSON.stringify(def));
    return id;
  }
  groupTroll(g, trollId) { this.groups[g].troll = trollId; }
  /** Register a troll moment: its trap type, where it is (local tile x/width) and its hint. */
  troll(name, { type, x, w, hint }) {
    if (!type || !hint || x === undefined || !w) throw new Error(`troll "${name}" needs type, x, w and hint`);
    let n = name, k = 2;
    while (this.trolls.some((t) => t.name === n)) n = `${name} (${k++})`;
    const id = `t${this.trolls.length + 1}`;
    this.trolls.push({ id, name: n, type, x: this.x0 + x, w, hint });
    return id;
  }
  tutorial(x, y, text) { this.hints.push({ x: this.x0 + x, y, text }); }
  trollName(id) { return this.trolls.find((t) => t.id === id).name; }
  trigger(def) { this.triggers.push(def); }
  uid(p) { return `${p}${++this.uids}`; }
  doorAt(x, y) {
    if (this.hasDoor) throw new Error('two EXIT doors');
    this.hasDoor = true;
    this.put(x, y, 'D');
  }
  fakeExit(trollId) { this.fakeExits[String(this.lastF)] = trollId; }
}

function buildLevel(spec, labels) {
  const b = new Builder(labels);
  const segs = [];
  for (const item of spec.segments) {
    const [fn, opts, label] = Array.isArray(item) ? item : [item, {}, undefined];
    if (label) b.label(label);
    const trollsBefore = b.trolls.length;
    const resolved = typeof opts === 'function' ? opts(b) : opts;
    const r = fn(b, resolved);
    // segments that rename duplicate trolls: map their trap names to the final names
    const traps = {};
    const newTrolls = b.trolls.slice(trollsBefore);
    for (const [name, steps] of Object.entries(r.traps || {})) {
      const t = newTrolls.find((x) => x.name === name || x.name.startsWith(name + ' ('));
      traps[t ? t.name : name] = steps;
    }
    // every segment starts on the ground (the previous one may end with a drop)
    const win = r.win && r.win.length ? [['R', 's.grounded'], ...r.win] : [];
    segs.push({ fn: fn.name, x0: b.x0, w: r.w, win, traps });
    b.x0 += r.w;
  }
  return { b, segs };
}

function compile(spec) {
  // two passes so segments can refer to positions of later segments (door destinations)
  let { b } = buildLevel(spec, {});
  const labels = b.newLabels;
  const out = buildLevel(spec, labels);
  b = out.b;
  const segs = out.segs;
  const W = b.cols;
  const rows = b.grid.map((row) => { const r = row.slice(); while (r.length < W) r.push('.'); return r; });
  if (spec.cave) for (let y = 0; y < spec.cave; y++) for (let x = 0; x < W; x++) if (rows[y][x] === '.') rows[y][x] = '#';
  const map = rows.map((r) => r.join(''));
  const level = {
    id: spec.id, name: spec.name, world: spec.id - 1, idea: spec.idea, winMessage: spec.winMessage,
    deathQuips: spec.deathQuips, hints: b.hints, map, groups: b.groups, triggers: b.triggers,
    trolls: b.trolls, fakeExits: Object.keys(b.fakeExits).length ? b.fakeExits : undefined,
  };
  // plans
  const cpIdx = segs.findIndex((s) => s.fn === 'checkpoint');
  const steps = (from, to) => segs.slice(from, to).flatMap((s) => s.win);
  const plans = { win: steps(0, segs.length), cp: steps(cpIdx + 1, segs.length), traps: {} };
  segs.forEach((s, i) => {
    for (const [name, trap] of Object.entries(s.traps)) {
      const afterCp = i > cpIdx;
      plans.traps[name] = { cp: afterCp, steps: [...(afterCp ? steps(cpIdx + 1, i) : steps(0, i)), ...trap] };
    }
  });
  return { level, plans, width: W, segs };
}

// ---------------------------------------------------------------------------
// The 10 levels. Each line is a segment; [fn, opts, label] puts a label at its start.

const sky = { sky: true };
const LEVELS = [
  {
    id: 1, slug: 'hello-floor', name: 'Hello, Floor', idea: 'The floor is not what it seems', winMessage: 'Welcome. Trust nothing.',
    deathQuips: ['Oops!', 'The floor did that.', 'Ouch.', 'Hmm.'],
    segments: [[S.start, { tutorial: true }], S.meadow, S.l1Sink, S.l1Fake, S.meadow, S.l1Collapse, S.checkpoint, S.l1Bridge, S.meadow,
      S.l1Fake, S.l1Sink, S.l1Collapse, S.end],
  },
  {
    id: 2, slug: 'greedy-blob', name: 'Greedy Little Blob', idea: '"Safe" coins are traps', winMessage: "Money isn't everything.",
    deathQuips: ['Greedy!', 'That coin had teeth.', 'Shiny... ouch.', 'Worth it?'],
    segments: [S.start, S.l2Routes, S.l2Bite, S.l2Arc, S.l2Cursed, S.checkpoint, S.l2Trail, S.l2Bite, S.l2Routes, S.l2Arc, S.l2Cursed, S.end],
  },
  {
    id: 3, slug: 'spring-fever', name: 'Spring Fever', idea: 'Springs', winMessage: 'What goes up... gets spiked.',
    deathQuips: ['Boing... ouch.', 'Too much spring!', 'Splat.', 'Whee— oh.'],
    segments: [[S.start, sky], S.l3Ceiling, S.l3Dud, S.l3Hidden, [S.checkpoint, sky], S.l3Side, S.l3Hidden, S.l3Dud, [S.end, sky]],
  },
  {
    id: 4, slug: 'heavy-ceiling', name: 'Heavy Ceiling', idea: 'Falling ceilings', winMessage: 'The scary spikes were the safe spot.', cave: 2,
    deathQuips: ['Squish.', 'Pancake mode.', 'Flat.', 'Bonk.'],
    segments: [S.start, S.l4Cave, S.l4Drop, S.l4Crusher, S.l4Thwomp, S.checkpoint, S.l4Tunnel, S.l4Thwomp, S.l4Drop, S.l4Cave, S.end],
  },
  {
    id: 5, slug: 'left-is-right', name: 'Left Is Right', idea: 'The controls betray you', winMessage: 'Your fingers lied to you.',
    deathQuips: ['Huh?!', 'Wrong way!', 'Not my fault!', 'Whoops.'],
    segments: [S.start, S.l5Corridor, S.l5Swap, S.l5NoJump, S.checkpoint, S.l5AutoRun, S.l5Corridor, S.l5NoJump, S.l5Swap, S.l5AutoRun, S.end],
  },
  {
    id: 6, slug: 'upside-downer', name: 'Upside Downer', idea: 'Gravity', winMessage: 'Which way is up?!',
    deathQuips: ['Wrong way up!', 'Gravity says hi.', 'Floaty...', 'Heavy...'],
    segments: [S.start, S.l6Dual, S.l6Flip, S.l6Low, S.checkpoint, S.l6Heavy, S.l6Low, S.l6Heavy, S.end],
  },
  {
    id: 7, slug: 'too-many-doors', name: 'Too Many Doors', idea: 'The EXIT keeps changing its mind', winMessage: 'Wrong door. Right wall.',
    deathQuips: ['NOPE!', 'That door bites.', 'Not that one!', 'Rude.'],
    segments: [S.start, S.l7FakeExit, [S.l7Runaway, (b) => ({ to: b.at('swap') + 6 })], S.l7Wall, S.checkpoint, S.l7Wall,
      [S.l7Swap, (b) => ({ to: b.at('end') + 8 }), 'swap'], S.l7FakeExit, S.l7Wall, S.l7Wall, [S.l7HiddenEnd, {}, 'end']],
  },
  {
    id: 8, slug: 'screen-lies', name: 'Screen Lies', idea: 'The camera lies', winMessage: 'Seeing is NOT believing.',
    deathQuips: ['Where did it go?', 'I saw nothing!', 'Lies!', 'Blind luck... none.'],
    segments: [S.start, S.l8Freeze, S.l8Flip, S.l8Zoom, S.l8FakeClear, S.l8Flip, S.checkpoint, S.l8Zoom, S.l8FakeClear, S.l8Freeze, S.l8Flip, S.end],
  },
  {
    id: 9, slug: 'run', name: 'Run!', idea: 'Something is always chasing you', winMessage: 'You outran everything.',
    deathQuips: ['Too slow!', 'Caught!', 'RUN!', 'Faster...'],
    segments: [S.start, S.l9Ball, S.l9Wall, S.l9Flood, S.l9Ball, S.checkpoint, S.l9Wall, S.l9Flood, S.l9Ball, S.l9Wall, S.end],
  },
  {
    id: 10, slug: 'grand-betrayal', name: 'The Grand Betrayal', idea: 'Moving platforms betray you', winMessage: 'You out-trolled them all!',
    deathQuips: ['Betrayed!', 'Not again...', 'Trust issues.', 'Almost!'],
    segments: [[S.start, sky], S.l10Shuttle, S.l10Shy, S.l10Blink, S.l10Elevator, S.l10Shy, [S.checkpoint, sky], S.l10Shuttle, S.l10Elevator,
      S.l10Blink, S.l10Shy, S.l10Shuttle, [S.end, sky]],
  },
];

const only = process.argv.slice(2).map(Number);
const dir = join(ROOT, 'src', 'levels');
if (!only.length) for (const f of readdirSync(dir)) if (f.endsWith('.json')) unlinkSync(join(dir, f));
const allPlans = {};
for (const spec of LEVELS) {
  if (only.length && !only.includes(spec.id)) continue;
  const { level, plans, width } = compile(spec);
  const txt = JSON.stringify(level, null, 2)
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2, $3, $4]');
  writeFileSync(join(dir, `${String(spec.id).padStart(2, '0')}-${spec.slug}.json`), txt + '\n');
  allPlans[spec.id] = plans;
  console.log(`level ${spec.id} "${spec.name}": ${width} tiles, ${level.trolls.length} trolls`);
}
// every trap type may belong to one level only
const owner = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const L = JSON.parse((await import('node:fs')).readFileSync(join(dir, f), 'utf8'));
  for (const t of L.trolls) {
    if (owner[t.type] !== undefined && owner[t.type] !== L.id) throw new Error(`trap type "${t.type}" used by levels ${owner[t.type]} and ${L.id}`);
    owner[t.type] = L.id;
  }
}
const planFile = join(ROOT, 'tests', 'plans.json');
let existing = {};
try { existing = only.length ? JSON.parse((await import('node:fs')).readFileSync(planFile, 'utf8')) : {}; } catch { /* none yet */ }
writeFileSync(planFile, JSON.stringify({ ...existing, ...allPlans }, null, 1) + '\n');
