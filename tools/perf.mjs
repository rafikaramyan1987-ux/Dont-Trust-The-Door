// Frame rate and memory of the longest level, played through in real time by the bot's recorded run, at 640×360
// (a phone held sideways, touch) and at 1280×720 (desktop). Prints a Markdown table for the PR.
// Usage: npm run build && node tools/perf.mjs [level]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveDist, launch, openGame, ROOT } from '../tests/harness.mjs';

const levels = readdirSync(join(ROOT, 'src', 'levels')).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'src', 'levels', f), 'utf8')));
const longest = process.argv[2] ? levels[Number(process.argv[2]) - 1] : levels.reduce((a, b) => (b.map[0].length > a.map[0].length ? b : a));
const rec = JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', `level-${String(longest.id).padStart(2, '0')}.json`), 'utf8')).win;
const { server, url } = await serveDist();
const browser = await launch();
const rows = [];
for (const [name, opts] of [
  ['phone 640×360 (touch)', { viewport: { width: 640, height: 360 }, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 1 } }],
  ['desktop 1280×720', { viewport: { width: 1280, height: 720 } }],
]) {
  const { page, ctx, errors } = await openGame(browser, url, opts);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const res = await page.evaluate(({ level, rec }) => new Promise((resolve) => {
    const T = window.__DTTD;
    T.start(level, rec);
    const t0 = performance.now();
    let last = t0;
    const d = [];
    const tick = () => {
      const now = performance.now();
      d.push(now - last);
      last = now;
      const s = T.state();
      if ((s && (s.state === 'won' || s.deathsLevel > 0)) || now - t0 > 300000) {
        d.splice(0, 10);
        const sorted = [...d].sort((a, b) => a - b);
        const mean = d.reduce((a, b) => a + b, 0) / d.length;
        resolve({ state: s.state, secs: (now - t0) / 1000, fps: 1000 / mean, p95: sorted[Math.floor(sorted.length * 0.95)], worst: sorted[sorted.length - 1] });
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { level: longest.id, rec });
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  rows.push({ name, ...res, heap: m.JSHeapUsedSize / 1048576, nodes: m.Nodes, errors: errors.length });
  await ctx.close();
}
await browser.close();
server.close();
console.log(`Level ${longest.id} (${longest.map[0].length} tiles), the bot's run in real time, headless Chromium with software WebGL (SwiftShader, no GPU):\n`);
console.log('| Screen | Result | Avg fps | 95th pct frame | Worst frame | JS heap used |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.state} in ${r.secs.toFixed(1)} s | ${r.fps.toFixed(1)} | ${r.p95.toFixed(1)} ms | ${r.worst.toFixed(0)} ms | ${r.heap.toFixed(1)} MB |`);
