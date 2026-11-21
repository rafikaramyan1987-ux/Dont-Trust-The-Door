// docs/respawn-test.md: the per-level results of tests/respawn.mjs (test-results/respawn-*.json), between the
// <!-- results --> markers; the rest of the file (method, fixes) is kept. Usage: node tools/respawn-report.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../tests/harness.mjs';

const dir = join(ROOT, 'test-results');
const rows = new Map();
for (const f of readdirSync(dir).filter((x) => /^respawn-L\d+-\d+\.json$/.test(x))) for (const r of JSON.parse(readFileSync(join(dir, f), 'utf8'))) rows.set(r.level, r);
const list = [...rows.values()].sort((a, b) => a.level - b.level);
const sum = (k) => list.reduce((a, r) => a + r[k], 0);
let md = '| Level | Run | Forced deaths | Respawns checked | Distinct respawn states won | Explorer (simulated) | Stalls found / probed | Failures |\n|---|---|---|---|---|---|---|---|\n';
for (const r of list) md += `| ${r.level}. ${r.name} | ${(r.runTicks / 60).toFixed(0)} s | ${r.kills} | ${r.respawns} | ${r.wonFromRespawn} / ${r.distinctRespawnStates} | ${(r.exploreSeconds / 60).toFixed(1)} min | ${r.stalls} / ${r.stallsProbed} | ${r.issues.length} |\n`;
md += `| **all ${list.length}** | ${(sum('runTicks') / 3600).toFixed(0)} min | **${sum('kills')}** | **${sum('respawns')}** | ${sum('wonFromRespawn')} / ${sum('distinctRespawnStates')} | ${(sum('exploreSeconds') / 60).toFixed(0)} min | ${sum('stalls')} / ${sum('stallsProbed')} | **${list.reduce((a, r) => a + r.issues.length, 0)}** |\n`;
const f = join(ROOT, 'docs', 'respawn-test.md');
const text = existsSync(f) ? readFileSync(f, 'utf8') : '<!-- results -->\n<!-- /results -->\n';
writeFileSync(f, text.replace(/<!-- results -->[\s\S]*<!-- \/results -->/, `<!-- results -->\n${md}<!-- /results -->`));
console.log(md);
