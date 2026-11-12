// Author replays: runs each plan, records the exact per-tick inputs and saves them to
// tests/replays/level-NN.json as { win, cp, traps: { name: { cp, rec } } }.
// Usage: node tests/author-replays.mjs [level ...]   (needs `npm run build` first)
import { writeFileSync, mkdirSync } from 'node:fs';
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
  const out = { win: null, cp: null, traps: {} };
  const w = await runPlan(page, level, p.win);
  const okW = w.final.state === 'won';
  console.log(`L${level} win : ${okW ? 'WON' : 'FAILED'} in ${(w.ticks / 60).toFixed(1)} s (x=${w.final.x.toFixed(0)} y=${w.final.y.toFixed(0)} ${w.final.state} ${w.final.lastDeath})`);
  if (okW) out.win = w.rec; else bad++;
  const c = await runPlan(page, level, p.cp, { checkpoint: true });
  const okC = c.final.state === 'won';
  console.log(`L${level} cp  : ${okC ? 'WON' : 'FAILED'} in ${(c.ticks / 60).toFixed(1)} s (x=${c.final.x.toFixed(0)} y=${c.final.y.toFixed(0)} ${c.final.state} ${c.final.lastDeath})`);
  if (okC) out.cp = c.rec; else bad++;
  for (const [name, t] of Object.entries(p.traps)) {
    const r = await runPlan(page, level, t.steps, { checkpoint: t.cp });
    const fired = r.final.trolls.length;
    const ok = r.final.deathsLevel > 0;
    console.log(`L${level} trap "${name}": ${ok ? 'DIED (' + r.final.lastDeath + ')' : 'SURVIVED?! x=' + r.final.x.toFixed(0) + ' y=' + r.final.y.toFixed(0)} after ${r.ticks} ticks${t.cp ? ' [from checkpoint]' : ''} trolls=${fired}`);
    if (ok) out.traps[name] = { cp: t.cp, rec: r.rec }; else bad++;
  }
  writeFileSync(join(dir, `level-${String(level).padStart(2, '0')}.json`), JSON.stringify(out) + '\n');
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
