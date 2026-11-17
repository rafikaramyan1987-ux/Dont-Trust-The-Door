// Debug a bot plan: node tests/debug-plan.mjs <level> win|cp<N>|solve:<trap name>|die:<trap name> [fromTile] [toTile]
// Prints the hero's state every few ticks between the two tile columns (needs a build).
import { serveDist, launch, openGame } from './harness.mjs';
import { PLANS } from './plans.mjs';

const [lv, what, a = '0', z = '99999'] = process.argv.slice(2);
const P = PLANS[lv];
let plan, cp = false;
if (what === 'win') plan = P.win;
else if (what.startsWith('cp')) { cp = Number(what.slice(2)) - 1; plan = P.cps[cp]; }
else { const [k, name] = what.split(':'); const t = P.traps[name]; plan = t[k]; cp = t.cp; }
const { server, url } = await serveDist();
const browser = await launch();
const { page } = await openGame(browser, url);
const out = await page.evaluate(({ level, plan, cp, a, z }) => {
  const T = window.__DTTD;
  T.setManual(true);
  T.start(level, null, cp === false ? false : cp);
  let s = T.state();
  const lines = [];
  let step = 0, total = 0;
  for (const [keys, until] of plan) {
    const cond = typeof until === 'number' ? null : new Function('s', `return (${until});`);
    let n = 0;
    for (;;) {
      if (typeof until === 'number' ? n >= until : cond(s)) break;
      T.sim(keys, 1); n++; total++;
      s = T.state();
      const tx = s.x / 40;
      if (tx >= a && tx <= z && total % 2 === 0) lines.push(`#${step} [${keys}|${until}] t=${s.levelTick} x=${tx.toFixed(2)} y=${(s.y / 40).toFixed(2)} vx=${s.vx.toFixed(0)} vy=${s.vy.toFixed(0)} gr=${s.grounded} ${s.state}`);
      if (s.state !== 'play' || total > 20000 || s.deathsLevel > 0) return lines.concat([`END ${s.state} ${s.lastDeath} at x=${tx.toFixed(2)}`]);
    }
    step++;
  }
  return lines.concat(['plan finished']);
}, { level: Number(lv), plan, cp, a: Number(a), z: Number(z) });
console.log(out.slice(-80).join('\n'));
await browser.close();
server.close();
