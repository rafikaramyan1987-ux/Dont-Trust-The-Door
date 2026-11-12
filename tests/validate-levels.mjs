// Static checks for every level data file: map size, legend, groups and trigger references.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const LEGAL = new Set(['.', '#', '^', 'v', '<', '>', '=', 'o', 'P', 'D', 'F']);
let errors = 0;
const fail = (f, m) => { errors++; console.error(`✗ ${f}: ${m}`); };

files.forEach((f, idx) => {
  const L = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (L.id !== idx + 1) fail(f, `id ${L.id} should be ${idx + 1} (files are ordered by name)`);
  for (const k of ['name', 'winMessage', 'map']) if (!L[k]) fail(f, `missing "${k}"`);
  if (L.map.length !== 18) fail(f, `map has ${L.map.length} rows, expected 18`);
  const used = new Set();
  let P = 0, D = 0;
  L.map.forEach((row, y) => {
    if (row.length !== 32) fail(f, `row ${y} has ${row.length} columns, expected 32`);
    for (const ch of row) {
      if (ch === 'P') P++;
      if (ch === 'D') D++;
      if (ch >= 'a' && ch <= 'z' && !LEGAL.has(ch)) used.add(ch);
      else if (!LEGAL.has(ch)) fail(f, `illegal character '${ch}' in row ${y}`);
    }
  });
  if (P !== 1) fail(f, `needs exactly one P (found ${P})`);
  if (D !== 1) fail(f, `needs exactly one D (found ${D})`);
  const groups = L.groups || {};
  for (const g of used) if (!groups[g]) fail(f, `group '${g}' used in map but not defined`);
  for (const g of Object.keys(groups)) if (!used.has(g)) fail(f, `group '${g}' defined but not used in map`);
  const ids = new Set((L.triggers || []).map((t) => t.id).filter(Boolean));
  for (const t of L.triggers || []) {
    const w = t.when || {};
    if (!w.zone && !w.touch && !w.start && !w.after) fail(f, 'trigger without a "when" condition');
    if (w.touch && !groups[w.touch]) fail(f, `trigger touches unknown group '${w.touch}'`);
    if (w.after && !ids.has(w.after)) fail(f, `trigger waits for unknown id '${w.after}'`);
    for (const a of t.do || []) {
      for (const k of ['fall', 'pop', 'retract', 'move', 'chase', 'show', 'hide']) {
        if (k in a && !groups[a[k]]) fail(f, `action ${k} refers to unknown group '${a[k]}'`);
      }
    }
  }
  console.log(`✓ ${f}  "${L.name}"`);
});
if (errors) { console.error(`\n${errors} problem(s) found`); process.exit(1); }
console.log(`\nAll ${files.length} levels valid.`);
