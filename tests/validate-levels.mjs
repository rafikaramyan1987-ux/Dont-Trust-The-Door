// Static checks for every level data file: map size, legend, groups, triggers, trolls,
// checkpoint. Run with `npm run test:levels`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const LEGAL = new Set(['.', '#', '^', 'v', '<', '>', '=', 'o', 'P', 'D', 'F', 'C']);
const MIN_W = 32, MAX_W = 200, MAX_GROUP_W = 50;
let errors = 0;
const fail = (f, m) => { errors++; console.error(`✗ ${f}: ${m}`); };

files.forEach((f, idx) => {
  const L = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (L.id !== idx + 1) fail(f, `id ${L.id} should be ${idx + 1} (files are ordered by name)`);
  for (const k of ['name', 'winMessage', 'map']) if (!L[k]) fail(f, `missing "${k}"`);
  if (L.map.length !== 18) fail(f, `map has ${L.map.length} rows, expected 18`);
  const W = L.map[0].length;
  if (W < MIN_W || W > MAX_W) fail(f, `map is ${W} tiles wide, allowed ${MIN_W}-${MAX_W}`);
  const used = new Map(); // group → tile xs
  const count = { P: 0, D: 0, C: 0 };
  const fakeXs = [];
  L.map.forEach((row, y) => {
    if (row.length !== W) fail(f, `row ${y} has ${row.length} columns, expected ${W} (all rows equal)`);
    [...row].forEach((ch, x) => {
      if (ch in count) count[ch]++;
      if (ch === 'F') fakeXs.push(x);
      if (ch >= 'a' && ch <= 'z' && !LEGAL.has(ch)) { if (!used.has(ch)) used.set(ch, []); used.get(ch).push(x); }
      else if (!LEGAL.has(ch)) fail(f, `illegal character '${ch}' in row ${y}`);
    });
  });
  if (count.P !== 1) fail(f, `needs exactly one P (found ${count.P})`);
  if (count.D !== 1) fail(f, `needs exactly one D (found ${count.D})`);
  if (count.C !== 1) fail(f, `needs exactly one checkpoint C (found ${count.C})`);
  const groups = L.groups || {};
  for (const [g, xs] of used) {
    if (!groups[g]) fail(f, `group '${g}' used in map but not defined`);
    const cover = (groups[g]?.cover || []).map(([x]) => x);
    const span = Math.max(...xs, ...cover) - Math.min(...xs, ...cover) + 1;
    if (span > MAX_GROUP_W) fail(f, `group '${g}' spans ${span} tiles (max ${MAX_GROUP_W})`);
  }
  for (const g of Object.keys(groups)) if (!used.has(g)) fail(f, `group '${g}' defined but not used in map`);
  const ids = new Set((L.triggers || []).map((t) => t.id).filter(Boolean));
  const trollIds = new Set((L.trolls || []).map((t) => t.id));
  const referenced = new Set();
  for (const t of L.triggers || []) {
    const w = t.when || {};
    if (!w.zone && !w.touch && !w.start && !w.after) fail(f, 'trigger without a "when" condition');
    if (w.zone && (w.zone[0] < 0 || w.zone[0] + w.zone[2] > W)) fail(f, `trigger zone ${w.zone} outside the map`);
    if (w.touch && !groups[w.touch]) fail(f, `trigger touches unknown group '${w.touch}'`);
    if (w.after && !ids.has(w.after)) fail(f, `trigger waits for unknown id '${w.after}'`);
    if (t.troll) { if (!trollIds.has(t.troll)) fail(f, `trigger credits unknown troll '${t.troll}'`); referenced.add(t.troll); }
    for (const a of t.do || []) {
      for (const k of ['fall', 'pop', 'retract', 'move', 'chase', 'show', 'hide']) {
        if (k in a && !groups[a[k]]) fail(f, `action ${k} refers to unknown group '${a[k]}'`);
      }
    }
  }
  for (const g of Object.values(groups)) if (g.troll) { if (!trollIds.has(g.troll)) fail(f, `group credits unknown troll '${g.troll}'`); referenced.add(g.troll); }
  for (const [x, id] of Object.entries(L.fakeExits || {})) {
    if (!fakeXs.includes(Number(x))) fail(f, `fakeExits refers to x=${x} but there is no F there`);
    referenced.add(id);
  }
  if (L.fakeExitTroll) referenced.add(L.fakeExitTroll);
  const trolls = L.trolls || [];
  if (trolls.length < 5) fail(f, `only ${trolls.length} troll moments (need at least 5)`);
  for (const t of trolls) if (!referenced.has(t.id)) fail(f, `troll "${t.name}" is never triggered by anything`);
  console.log(`✓ ${f}  "${L.name}"  ${W} tiles, ${trolls.length} trolls`);
});
if (errors) { console.error(`\n${errors} problem(s) found`); process.exit(1); }
console.log(`\nAll ${files.length} levels valid.`);
