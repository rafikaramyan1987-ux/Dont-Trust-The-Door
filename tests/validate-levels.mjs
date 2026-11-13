// Static checks for every level data file. Run with `npm run test:levels`.
//  • map: 18 equal rows, legal characters, one P, one D, groups/triggers valid
//  • size: every level at least twice as wide as before the rework
//  • traps: exactly 8 per level (10 in levels 8-10), 86 in total, every trap TYPE unique
//    across the game, every trap with a hint (an existing text key) and a machine-readable
//    solution, and its highlight ("danger") exactly equal to its trigger area
//  • checkpoints: one after every three traps
//  • no copy-pasted terrain: no 12-column stretch with ≥4 non-trivial columns appears twice
//    (plain ground, void, cave and bare spike-pit columns are trivial; groups compare by kind)
//  • no text in the levels except the level-1 move/jump instructions
//  • no soft-locks (static analysis, tests/softlock.mjs)
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLevel } from './softlock.mjs';
import { dangerTiles, rectTiles } from '../tools/level-builder/danger.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(ROOT, 'src', 'levels');
const en = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
/** Widths before the rework (tiles); every level must be at least twice as wide now. */
export const OLD_WIDTHS = { 1: 118, 2: 142, 3: 135, 4: 129, 5: 149, 6: 121, 7: 125, 8: 203, 9: 214, 10: 201 };
const TRAPS = (id) => (id >= 8 ? 10 : 8);
const BASIC = new Set(['.', '#', '^', 'v', '<', '>', '=', 'o', '*', 'P', 'D', 'F', 'C']);
/** A group's kind: its tile plus the properties that make it a different block (tint, ice …). */
const groupKind = (d) => (d ? [d.tile, ...Object.entries(d).filter(([k]) => !['tile', 'troll', 'cover'].includes(k)).map(([k, v]) => `${k}=${JSON.stringify(v)}`).sort()].join(';') : '?');
const isGroup = (ch) => (ch >= 'a' && ch <= 'z' && ch !== 'o' && ch !== 'v') || (ch >= 'A' && ch <= 'Z' && !'PDFCH'.includes(ch)) || (ch >= '0' && ch <= '9');
let errors = 0;
const fail = (f, m) => { errors++; console.error(`✗ ${f}: ${m}`); };
const typeOwner = {};
const levels = [];
let totalTraps = 0;

files.forEach((f, idx) => {
  const L = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  levels.push(L);
  if (L.id !== idx + 1) fail(f, `id ${L.id} should be ${idx + 1}`);
  for (const k of ['name', 'winMessage']) if (!en[L[k]]) fail(f, `"${k}" must be a text key that exists in en.json (got "${L[k]}")`);
  for (const q of L.deathQuips ?? []) if (!en[q]) fail(f, `death quip key "${q}" missing in en.json`);
  if (L.map.length !== 18) fail(f, `map has ${L.map.length} rows, expected 18`);
  const W = L.map[0].length;
  if (W < 2 * OLD_WIDTHS[L.id]) fail(f, `map is ${W} tiles wide – must be at least 2 × ${OLD_WIDTHS[L.id]} = ${2 * OLD_WIDTHS[L.id]}`);
  const count = { P: 0, D: 0, C: 0 };
  const used = new Set();
  const cps = [];
  L.map.forEach((row, y) => {
    if (row.length !== W) fail(f, `row ${y} has ${row.length} columns, expected ${W}`);
    [...row].forEach((ch, x) => {
      if (ch in count) count[ch]++;
      if (ch === 'C') cps.push(x);
      if (isGroup(ch)) used.add(ch);
      else if (!BASIC.has(ch)) fail(f, `illegal character '${ch}' at ${x},${y}`);
    });
  });
  if (count.P !== 1) fail(f, `needs exactly one P (found ${count.P})`);
  if (count.D !== 1) fail(f, `needs exactly one D (found ${count.D})`);
  const groups = L.groups ?? {};
  for (const g of used) if (!groups[g]) fail(f, `group '${g}' used in map but not defined`);
  for (const [g, d] of Object.entries(groups)) if (!used.has(g) && !d.cover?.length) fail(f, `group '${g}' defined but not used`);
  const ids = new Set((L.triggers ?? []).map((t) => t.id).filter(Boolean));
  const trollIds = new Set(L.trolls.map((t) => t.id));
  const referenced = new Set();
  for (const t of L.triggers ?? []) {
    const w = t.when;
    if (!w.zone && !w.touch && !w.start && !w.after) fail(f, 'trigger without a "when" condition');
    if (w.zone && (w.zone[0] < 0 || w.zone[0] + w.zone[2] > W)) fail(f, `trigger zone ${w.zone} outside the map`);
    if (w.touch && !groups[w.touch]) fail(f, `trigger touches unknown group '${w.touch}'`);
    if (w.after && !ids.has(w.after)) fail(f, `trigger waits for unknown id '${w.after}'`);
    if (t.troll) { if (!trollIds.has(t.troll)) fail(f, `trigger credits unknown troll '${t.troll}'`); referenced.add(t.troll); }
    for (const a of [...t.do, ...(t.undo ?? [])]) {
      for (const k of ['fall', 'pop', 'retract', 'move', 'chase', 'show', 'hide', 'toss', 'eat', 'activate', 'deactivate']) if (k in a && !groups[a[k]]) fail(f, `action ${k} refers to unknown group '${a[k]}'`);
      if ('say' in a && !en[a.say]) fail(f, `say text "${a.say}" is not a key in en.json`);
    }
  }
  for (const g of Object.values(groups)) if (g.troll) referenced.add(g.troll);
  for (const id of Object.values(L.fakeExits ?? {})) referenced.add(id);
  // traps
  const trolls = [...L.trolls].sort((a, b) => a.x - b.x);
  totalTraps += trolls.length;
  if (trolls.length !== TRAPS(L.id)) fail(f, `${trolls.length} traps – level ${L.id} must have exactly ${TRAPS(L.id)}`);
  for (const t of trolls) {
    if (!referenced.has(t.id)) fail(f, `trap "${t.name}" is never triggered`);
    if (!t.type) fail(f, `trap "${t.name}" has no type`);
    if (typeOwner[t.type]) fail(f, `trap type "${t.type}" also used in level ${typeOwner[t.type]} – every trap must be a different idea`);
    typeOwner[t.type] = L.id;
    if (!t.hint || !en[t.hint]) fail(f, `trap "${t.name}" needs a hint (text key in en.json), got "${t.hint}"`);
    if (!Array.isArray(t.solution) || !t.solution.length || !t.solution.every((s) => Array.isArray(s) && s.length === 2 && typeof s[0] === 'string')) fail(f, `trap "${t.name}" needs a machine-readable solution (bot plan steps)`);
    const want = new Set(dangerTiles(L, t).map(([x, y]) => `${x},${y}`));
    const got = rectTiles(t.danger ?? []);
    const missing = [...want].filter((k) => !got.has(k)), extra = [...got].filter((k) => !want.has(k));
    if (missing.length || extra.length) fail(f, `trap "${t.name}": highlight ≠ trigger area (missing ${missing.slice(0, 4)} extra ${extra.slice(0, 4)})`);
    if (t.x !== Math.min(...[...got].map((k) => +k.split(',')[0]))) fail(f, `trap "${t.name}": x does not match its danger area`);
  }
  // one checkpoint after every three traps
  const wantCps = Math.floor((trolls.length - 1) / 3);
  if (cps.length !== wantCps) fail(f, `${cps.length} checkpoints, expected ${wantCps} (one after every 3 traps)`);
  cps.sort((a, b) => a - b).forEach((cx, i) => {
    const before = trolls.filter((t) => t.x + t.w <= cx).length;
    if (before !== 3 * (i + 1)) fail(f, `checkpoint ${i + 1} at x=${cx} has ${before} traps before it, expected ${3 * (i + 1)}`);
  });
  // text in the level: only the level-1 tutorial (move / jump), as keys
  if ((L.hints ?? []).length && L.id !== 1) fail(f, 'text hints are only allowed in level 1 (control instructions)');
  for (const h of L.hints ?? []) { if (!en[h.text]) fail(f, `tutorial text "${h.text}" is not a key`); if ('afterDeaths' in h) fail(f, 'hints after deaths are not allowed'); }
  // soft-locks
  const sl = analyzeLevel(L);
  const spots = [...new Set(sl.stuck.map((p) => `col ${p.x} row ${p.y}`))];
  if (spots.length) fail(f, `soft-lock at ${spots.slice(0, 8).join('; ')}${spots.length > 8 ? ` … (${spots.length})` : ''} [states: ${[...new Set(sl.stuck.map((p) => p.state))].slice(0, 6).join(', ')}]`);
  if (sl.maxX < W - 2) fail(f, `soft-lock analysis only covered columns up to ${sl.maxX} of ${W}`);
  console.log(`✓ ${f}  ${W} tiles (≥ ${2 * OLD_WIDTHS[L.id]}), ${trolls.length} traps, ${cps.length} checkpoints, no soft-locks (${sl.states} world states, ${sl.reached} reachable spots)`);
});

// no copy-pasted terrain: every 12-column window with ≥4 non-trivial columns is unique
// (repeats inside one and the same trap, e.g. evenly spaced pillars, are part of its design)
const PLAIN = new Set();
const col = (L, x) => L.map.map((r) => r[x]).join('');
const canon = (L) => {
  const g = L.groups ?? {};
  return (x) => [...col(L, x)].map((ch) => (ch in g || isGroup(ch) ? `[${groupKind(g[ch])}]` : 'PCD'.includes(ch) ? '.' : ch)).join('');
};
for (const L of levels) {
  for (let y0 = 0; y0 <= 2; y0++) {
    // ground, sky island and cave columns are trivial
    PLAIN.add('.'.repeat(15) + '###');
    PLAIN.add('.'.repeat(15) + '##.');
    PLAIN.add('##' + '.'.repeat(13) + '###');
    PLAIN.add('.'.repeat(18));
    PLAIN.add('##' + '.'.repeat(16));
    PLAIN.add('.'.repeat(17) + '^');
    PLAIN.add('##' + '.'.repeat(15) + '^');
  }
}
const seen = new Map();
let windows = 0;
for (const L of levels) {
  const c = canon(L);
  const cols = Array.from({ length: L.map[0].length }, (_, x) => c(x));
  const owner = (x) => L.trolls.find((t) => x >= t.x && x < t.x + t.w)?.id ?? null;
  for (let x = 0; x + 12 <= cols.length; x++) {
    const win = cols.slice(x, x + 12);
    if (win.filter((s) => !PLAIN.has(s)).length < 4) continue;
    windows++;
    const k = win.join('|');
    const o = owner(x + 6);
    const prev = seen.get(k);
    if (prev && !(prev.id === L.id && o && prev.o === o)) fail(`level ${L.id}`, `terrain at x=${x}-${x + 11} is a copy of level ${prev.id} x=${prev.x}-${prev.x + 11}`);
    else if (!prev) seen.set(k, { id: L.id, x, o });
  }
}
if (totalTraps !== 86) fail('levels', `${totalTraps} traps in total, expected 86`);
const worlds = levels.map((L) => L.world);
if (new Set(worlds).size !== worlds.length) fail('levels', 'palettes must differ per level');
console.log(`\n${totalTraps} traps, ${Object.keys(typeOwner).length} distinct trap types; ${windows} terrain windows compared, no copies.`);
if (errors) { console.error(`\n${errors} problem(s) found`); process.exit(1); }
console.log(`All ${files.length} levels valid.`);
