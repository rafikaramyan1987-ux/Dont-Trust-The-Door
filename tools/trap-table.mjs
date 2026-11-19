// Prints the Markdown list of every trap (README / PR): per level the traps in order with their type key and
// one-line idea (the English hint), the width, the checkpoints (🚩 where they really are) and the bot's win time
// (from the self-test results, every shard). `--from 11` lists only levels 11 and up.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const en = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
const OLD = { 1: 118, 2: 142, 3: 135, 4: 129, 5: 149, 6: 121, 7: 125, 8: 203, 9: 214, 10: 201 };
const TABLE = { 11: 462, 12: 531, 13: 611, 14: 703, 15: 808, 16: 929, 17: 1068, 18: 1228, 19: 1412, 20: 1624 };
const from = process.argv.includes('--from') ? Number(process.argv[process.argv.indexOf('--from') + 1]) : 1;
const st = {};
const dir = join(ROOT, 'test-results');
if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => /^selftest.*\.json$/.test(x))) {
  try { Object.assign(st, JSON.parse(readFileSync(join(dir, f), 'utf8')).levels ?? {}); } catch { /* ignore */ }
}
const out = [];
for (const f of readdirSync(join(ROOT, 'src', 'levels')).filter((x) => x.endsWith('.json')).sort()) {
  const L = JSON.parse(readFileSync(join(ROOT, 'src', 'levels', f), 'utf8'));
  if (L.id < from) continue;
  const W = L.map[0].length;
  const s = st[L.id];
  const cps = L.map.flatMap((r) => [...r].map((c, x) => (c === 'C' ? x : -1)).filter((x) => x >= 0)).sort((a, b) => a - b);
  out.push(`### ${L.id}. ${en[L.name]} — ${L.idea}`);
  out.push('');
  const size = L.id <= 10 ? `${W} tiles wide (was ${OLD[L.id]}, ×${(W / OLD[L.id]).toFixed(2)})` : `${W} tiles (table ${TABLE[L.id]})`;
  out.push(`${size} · ${L.trolls.length} traps · ${cps.length} checkpoints${s?.winSeconds ? ` · bot win ${s.winSeconds} s` : ''}`);
  out.push('');
  const trolls = [...L.trolls].sort((a, b) => a.x - b.x);
  let ci = 0;
  trolls.forEach((t, i) => {
    while (ci < cps.length && cps[ci] < t.x) { if (i > 0) out.push('   - 🚩 *checkpoint*'); ci++; }
    out.push(`${i + 1}. **${t.name}** (\`${t.type}\`) – ${en[t.hint]}`);
  });
  out.push('');
}
console.log(out.join('\n'));
