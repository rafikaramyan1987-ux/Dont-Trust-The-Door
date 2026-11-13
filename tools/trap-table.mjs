// Prints the Markdown list of every trap (README / PR): per level the traps in order with
// their one-line idea (the English hint), widths and checkpoints.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const en = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
const OLD = { 1: 118, 2: 142, 3: 135, 4: 129, 5: 149, 6: 121, 7: 125, 8: 203, 9: 214, 10: 201 };
let st = {};
try { st = JSON.parse(readFileSync(join(ROOT, 'test-results', 'selftest.json'), 'utf8')).levels ?? {}; } catch { /* no self-test yet */ }
const out = [];
for (const f of readdirSync(join(ROOT, 'src', 'levels')).filter((x) => x.endsWith('.json')).sort()) {
  const L = JSON.parse(readFileSync(join(ROOT, 'src', 'levels', f), 'utf8'));
  const W = L.map[0].length;
  const s = st[L.id];
  out.push(`### ${L.id}. ${en[L.name]} — ${L.idea}`);
  out.push('');
  out.push(`${W} tiles wide (was ${OLD[L.id]}, ×${(W / OLD[L.id]).toFixed(2)}) · ${L.trolls.length} traps · checkpoint after every 3 traps${s ? ` · bot win ${s.winSeconds} s` : ''}`);
  out.push('');
  [...L.trolls].sort((a, b) => a.x - b.x).forEach((t, i) => {
    out.push(`${i + 1}. **${t.name}** (\`${t.type}\`) – ${en[t.hint]}`);
    if ((i + 1) % 3 === 0 && i + 1 < L.trolls.length) out.push(`   - 🚩 *checkpoint*`);
  });
  out.push('');
}
console.log(out.join('\n'));
