// Author replays: runs each plan, records the exact per-tick inputs and saves them.
// Usage: node tests/author-replays.mjs [level ...]   (needs `npm run build` first)
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveDist, launch, openGame, runPlan, ROOT } from './harness.mjs';
import { PLANS } from './plans.mjs';

const only = process.argv.slice(2).map(Number);
const { server, url } = await serveDist();
const browser = await launch();
const { page, errors } = await openGame(browser, url);
const dir = join(ROOT, 'tests', 'replays');
mkdirSync(dir, { recursive: true });
let bad = 0;
for (const [lv, p] of Object.entries(PLANS)) {
  const level = Number(lv);
  if (only.length && !only.includes(level)) continue;
  const file = join(dir, `level-${String(level).padStart(2, '0')}.json`);
  const out = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const w = await runPlan(page, level, p.win);
  const okW = w.final.state === 'won';
  console.log(`L${level} win : ${okW ? 'WON' : 'FAILED'} in ${w.ticks} ticks  (x=${w.final.x.toFixed(0)} y=${w.final.y.toFixed(0)} state=${w.final.state} cause=${w.final.lastDeath})`);
  if (okW) out.win = w.rec; else bad++;
  out.traps = out.traps || {};
  for (const [name, plan] of Object.entries(p.traps)) {
    const t = await runPlan(page, level, plan);
    const okT = t.final.deathsLevel > 0;
    console.log(`L${level} trap "${name}": ${okT ? 'DIED (' + t.final.lastDeath + ')' : 'SURVIVED?!'} after ${t.ticks} ticks`);
    if (okT) out.traps[name] = t.rec; else bad++;
  }
  writeFileSync(file, JSON.stringify(out) + '\n');
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
