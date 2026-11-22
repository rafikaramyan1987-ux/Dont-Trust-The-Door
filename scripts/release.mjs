// One ready-to-upload zip per portal: release/<portal>/dont-trust-the-door-<portal>.zip.
// For each portal: `vite build --mode <portal>` (its own SDK only, see vite.config.ts), the zip (index.html at the
// root), the portal's zip checks (scripts/<portal>/check.mjs; Playgama also its QA Tool harness).
// Usage: npm run release [-- playgama gamepix y8 crazygames gamedistribution youtube]
//   VITE_GD_GAME_ID=<GameDistribution game id> sets GameDistribution's game ID (from GD's developer panel).
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { PORTALS, zipPath } from './lib/portal.mjs';

const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const bad = want.filter((p) => !PORTALS.includes(p));
if (bad.length) {
  console.error(`unknown portal(s): ${bad.join(', ')} (known: ${PORTALS.join(', ')})`);
  process.exit(1);
}
const list = want.length ? want : PORTALS;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', env: process.env });

run('npx', ['tsc', '--noEmit']);
const done = [];
for (const p of list) {
  console.log(`\n=== ${p} ===`);
  run('npx', ['vite', 'build', '--mode', p, '--logLevel', 'warn']);
  run('node', ['scripts/zip.mjs', p]);
  run('node', [`scripts/${p}/check.mjs`]);
  if (p === 'playgama') run('node', ['scripts/playgama/qa.mjs']);
  done.push([p, zipPath(p), statSync(zipPath(p)).size]);
}
console.log('\nrelease zips:');
for (const [p, z, s] of done) console.log(`  ${p.padEnd(17)} ${z.replace(process.cwd() + '/', '')}  ${(s / 1024).toFixed(0)} KB`);
