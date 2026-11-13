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
  troll(name) {
    let n = name, k = 2;
    while (this.trolls.some((t) => t.name === n)) n = `${name} (${k++})`;
    const id = `t${this.trolls.length + 1}`;
    this.trolls.push({ id, name: n });
    return id;
  }
  trollName(id) { return this.trolls.find((t) => t.id === id).name; }
  trigger(def) { this.triggers.push(def); }
  hint(x, y, text, afterDeaths) { this.hints.push({ x: this.x0 + x, y, text, ...(afterDeaths ? { afterDeaths } : {}) }); }
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
  const map = b.grid.map((row) => { const r = row.slice(); while (r.length < W) r.push('.'); return r.join(''); });
  const level = {
    id: spec.id, name: spec.name, world: spec.world, winMessage: spec.winMessage,
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

const LEVELS = [
  {
    id: 1, slug: 'hello-floor', name: 'Hello, Floor', world: 0, winMessage: 'Welcome. Trust nothing.',
    deathQuips: ['Oops!', 'Mind the gap!', 'The floor did that.', 'Wait for it...'],
    segments: [S.start, [S.steps, { hints: true }], [S.flat, 4], S.sink, [S.doorRun, (b) => ({ to: b.at('end') + 4 })],
      [S.pit, 3], [S.collapse, { cracked: true, shake: 10 }], [S.flat, 3], S.pulse, S.checkpoint, S.upper, S.ceilingSpikes, [S.flat, 4], S.boost,
      S.sink, [S.endFlee, {}, 'end']],
  },
  {
    id: 2, slug: 'solid-ground', name: 'Solid Ground?', world: 0, winMessage: 'The floor lied. Repeatedly.',
    deathQuips: ['The floor lied.', 'Still lying.', 'Never trust a floor.', 'Keep moving!'],
    segments: [S.start, S.collapse, S.sink, S.fakeFloor, [S.pit, 3], S.bridge, S.checkpoint,
      [S.collapse, { shake: 2 }], [S.vanish, { delay: 20 }], S.upper, S.fakeFloor, S.popBlock, [S.popLanding, { mode: 'long' }], S.tower, [S.collapse, { width: 4 }], [S.endDoor, { sinkLast: true }]],
  },
  {
    id: 3, slug: 'exit-stage-left', name: 'Exit, Stage Left', world: 0, winMessage: "Doors shouldn't have legs.",
    deathQuips: ['It ran away?!', 'Come back here!', 'Wrong door!', 'Chase it!'],
    segments: [S.start, [S.flat, 4], [S.doorRun, (b) => ({ to: b.at('wait') + 4 })], [S.popLanding, { mode: 'short' }], [S.pit, 3], S.fakeExit, S.tunnel,
      S.checkpoint, S.collapse, [S.doorWait, (b) => ({ to: b.at('end') + 4 }), 'wait'], S.vanish, S.ceilingSpikes, S.upper, S.fakeExit, [S.endFlee, {}, 'end']],
  },
  {
    id: 4, slug: 'landing-zone', name: 'Landing Zone', world: 1, winMessage: 'Seriously?!',
    deathQuips: ['Seriously?!', 'They were waiting.', 'Land somewhere else!', 'Those were fake?!'],
    segments: [S.start, S.steps, [S.popLanding, { mode: 'short' }], S.fakeSpikes, [S.pit, 3], [S.popLanding, { mode: 'long' }], S.pulse,
      S.checkpoint, S.popBlock, S.ceilingSpikes, S.fakeSpikes, S.tunnel, S.bridge, S.collapse, [S.flat, 4], S.endDoor],
  },
  {
    id: 5, slug: 'heavy-ceiling', name: 'Heavy Ceiling', world: 1, winMessage: 'The scary spikes were the safe spot.',
    deathQuips: ['Squish.', 'Pancake mode.', 'Look up!', 'Time it!'],
    segments: [S.start, [S.flat, 4], S.ceilingSpikes, S.crusher, [S.pit, 3], S.thwomp, S.pulse, S.checkpoint,
      S.collapse, S.crusher, S.tunnel, S.thwomp, [S.popLanding, { mode: 'long' }], S.ceilingSpikes, S.endDoor],
  },
  {
    id: 6, slug: 'spring-fever', name: 'Spring Fever', world: 1, winMessage: 'What goes up... gets spiked.',
    deathQuips: ['Too much spring!', 'Boing... ouch.', 'Steer back!', "Don't stop!"],
    segments: [S.start, S.boost, [S.flat, 4], S.spring, S.vanish, S.checkpoint, S.popBlock, S.spring,
      S.fakeFloor, S.boost, [S.popLanding, { mode: 'short' }], S.thwomp, S.collapse, S.endDoor],
  },
  {
    id: 7, slug: 'two-doors', name: 'Too Many Doors', world: 2, winMessage: 'Wrong door. Right wall.',
    deathQuips: ['NOPE!', 'That door bites.', 'Doors lie. Walls too.', 'Look closer...'],
    segments: [S.start, [S.flat, 4], S.fakeExit, S.fakeFloor, S.fakeSpikes, [S.pit, 3], S.bridge, S.checkpoint,
      S.vanish, S.fakeExit, S.pulse, S.collapse, S.tower, [S.popLanding, { mode: 'long' }], S.endHidden],
  },
  {
    id: 8, slug: 'upside-downer', name: 'Upside Downer', world: 2, winMessage: 'Which way is up?!',
    deathQuips: ['Wrong way up!', 'Gravity says hi.', 'Left is right?!', 'Let go!'],
    segments: [S.start, S.gravity, S.controlFlip, S.tunnel, S.checkpoint, S.thwomp, S.vanish, S.gravity, S.controlFlip, S.fakeFloor, S.crusher, S.endDoor],
  },
  {
    id: 9, slug: 'greedy-blob', name: 'Greedy Little Blob', world: 2, winMessage: "Money isn't everything.",
    deathQuips: ['Greedy!', 'That coin had teeth.', 'Not all that glitters...', 'Hop UNDER them.'],
    segments: [S.start, S.coins, S.fakeFloor, S.controlFlip, S.bridge, S.checkpoint, S.popBlock, S.coins, S.vanish, S.tunnel, S.thwomp,
      S.crusher, [S.endDoor, { sinkLast: true }]],
  },
  {
    id: 10, slug: 'grand-betrayal', name: 'The Grand Betrayal', world: 3, winMessage: 'You out-trolled the door!',
    deathQuips: ['RUN!', 'Keep moving!', 'The floor too?!', 'Everything lies!', 'Almost!'],
    segments: [S.start, [S.doorRun, (b) => ({ to: b.at('wait') + 4 })], S.chase, S.spring, S.pulse, S.checkpoint,
      [S.doorWait, (b) => ({ to: b.at('end') + 4 }), 'wait'], S.gravity, S.thwomp, S.fakeExit, S.collapse, S.vanish, [S.endFlee, {}, 'end']],
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
const planFile = join(ROOT, 'tests', 'plans.json');
let existing = {};
try { existing = only.length ? JSON.parse((await import('node:fs')).readFileSync(planFile, 'utf8')) : {}; } catch { /* none yet */ }
writeFileSync(planFile, JSON.stringify({ ...existing, ...allPlans }, null, 1) + '\n');
