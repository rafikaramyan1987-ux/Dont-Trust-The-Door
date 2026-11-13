// Author replays: runs each plan, records the exact per-tick inputs and saves them to
// tests/replays/level-NN.json as
//   { win, cps: [rec…], traps: { name: { id, type, cp, solve, die } } }
//   win   – the whole level from the start
//   cps   – the rest of the level from each checkpoint
//   solve – from the trap's previous checkpoint through the trap using its solution
//   die   – from the same checkpoint, falling for the trap (must die, and the trap must fire)
// Usage: node tests/author-replays.mjs [level ...]   (needs `npm run build` first, or set
// DTTD_URL to a running dev server)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveDist, launch, openGame, runPlan, ROOT } from './harness.mjs';
import { PLANS } from './plans.mjs';

const only = process.argv.slice(2).map(Number);
const { server, url } = process.env.DTTD_URL ? { server: null, url: process.env.DTTD_URL } : await serveDist();
const browser = await launch();
const { page, errors } = await openGame(browser, url);
const dir = join(ROOT, 'tests', 'replays');
mkdirSync(dir, { recursive: true });
let bad = 0;
const pos = (s) => `x=${s.x.toFixed(0)} (tile ${(s.x / 40).toFixed(1)}) y=${s.y.toFixed(0)} ${s.state} ${s.lastDeath}`;
for (const [lv, p] of Object.entries(PLANS)) {
  const level = Number(lv);
  if (only.length && !only.includes(level)) continue;
  const file = join(dir, `level-${String(level).padStart(2, '0')}.json`);
  const out = { win: null, cps: [], traps: {} };
  const w = await runPlan(page, level, p.win);
  const okW = w.final.state === 'won';
  console.log(`L${level} win   : ${okW ? 'WON' : 'FAILED'} in ${(w.ticks / 60).toFixed(1)} s ${okW ? '' : pos(w.final)}`);
  if (okW) out.win = w.rec; else bad++;
  for (let i = 0; i < p.cps.length; i++) {
    const c = await runPlan(page, level, p.cps[i], { checkpoint: i });
    const ok = c.final.state === 'won';
    console.log(`L${level} cp ${i + 1}  : ${ok ? 'WON' : 'FAILED'} in ${(c.ticks / 60).toFixed(1)} s ${ok ? '' : pos(c.final)}`);
    if (ok) out.cps.push(c.rec); else { bad++; out.cps.push(null); }
  }
  for (const [name, t] of Object.entries(p.traps)) {
    const s = await runPlan(page, level, t.solve, { checkpoint: t.cp });
    const okS = s.final.state === 'play' && s.final.deathsLevel === 0;
    const d = await runPlan(page, level, t.die, { checkpoint: t.cp });
    const okD = d.final.deathsLevel > 0 && d.final.trolls.includes(t.id);
    console.log(`L${level} ${okS && okD ? 'ok ' : 'BAD'} "${name}" [${t.type}] solve: ${okS ? 'passed' : 'FAILED ' + pos(s.final)} · die: ${okD ? 'died (' + d.final.lastDeath + ')' : 'NOT DEAD/NOT FIRED ' + pos(d.final) + ' trolls=' + d.final.trolls}`);
    if (!okS || !okD) bad++;
    out.traps[name] = { id: t.id, type: t.type, cp: t.cp, solve: okS ? s.rec : null, die: okD ? d.rec : null };
  }
  writeFileSync(file, JSON.stringify(out) + '\n');
}
console.log(errors.length ? `console errors:\n${errors.slice(0, 10).join('\n')}` : 'no console errors');
await browser.close();
server?.close();
process.exit(bad ? 1 : 0);
