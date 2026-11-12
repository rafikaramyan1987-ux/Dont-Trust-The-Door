// Shared helpers for the headless self-tests (Playwright + the ?test API).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

/** Serve dist/ (the production build) on a free port. */
export function serveDist() {
  const dist = join(ROOT, 'dist');
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ missing: run `npm run build` first');
  const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dist, p);
    if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

export async function launch() {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
}

/** Open the game in test mode and collect console errors. */
export async function openGame(browser, baseUrl, { viewport = { width: 1280, height: 720 }, query = '', context = {} } = {}) {
  const ctx = await browser.newContext({ viewport, ...context });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${baseUrl}?test=1&boot=none${query}`);
  await page.waitForFunction(() => window.__DTTD && window.__DTTD.game.scene.getScene('Boot').sys.settings.status >= 5);
  return { ctx, page, errors };
}

/**
 * Run a condition-based plan inside the page and record the exact per-tick input.
 * A plan is a list of [keys, until] where `until` is a tick count or a JS
 * expression over the state `s` (x, y, vx, vy, grounded, levelTick, state ...).
 */
export async function runPlan(page, level, plan, { stopOnDeath = true, maxTicks = 3000 } = {}) {
  return page.evaluate(({ level, plan, stopOnDeath, maxTicks }) => {
    const T = window.__DTTD;
    T.setManual(true);
    T.start(level);
    const rec = [];
    const push = (k) => { const last = rec[rec.length - 1]; if (last && last[1] === k) last[0]++; else rec.push([1, k]); };
    let s = T.state();
    // ticks that already ran (idle) while the level started: real-time replays prepend them
    if (s.levelTick > 0) rec.push([s.levelTick, '']);
    const startDeaths = s.deathsLevel;
    let total = 0;
    outer: for (const [keys, until] of plan) {
      const cond = typeof until === 'number' ? null : new Function('s', `return (${until});`);
      let n = 0;
      for (;;) {
        if (typeof until === 'number' ? n >= until : cond(s)) break;
        T.sim(keys, 1); push(keys); n++; total++;
        s = T.state();
        if (s.state !== 'play') break outer;
        if (total > maxTicks) break outer;
        if (stopOnDeath && s.deathsLevel > startDeaths) break outer;
      }
    }
    // let a win / death register
    for (let i = 0; i < 3 && s.state === 'play'; i++) { T.sim('', 1); push(''); s = T.state(); }
    T.release();
    return { rec, final: s, ticks: rec.reduce((a, r) => a + r[0], 0) };
  }, { level, plan, stopOnDeath, maxTicks });
}

/** Replay recorded input (no conditions) and report the outcome. */
export async function replay(page, level, rec, { extra = 90, render = false } = {}) {
  return page.evaluate(({ level, rec, extra, render }) => {
    const T = window.__DTTD;
    T.setManual(true);
    T.start(level);
    // the recording starts with the idle lead-in ticks that start() already ran
    rec = rec.slice();
    let skip = T.state().levelTick;
    rec = rec.map(([n, k]) => [n, k]);
    while (skip > 0 && rec.length) { const take = Math.min(skip, rec[0][0]); rec[0][0] -= take; skip -= take; if (!rec[0][0]) rec.shift(); }
    const d0 = T.state().deathsLevel;
    let s;
    let firstDeathTick = -1, deathCause = '';
    for (const [n, k] of rec) for (let i = 0; i < n; i++) {
      if (render) T.hold(k, 1); else T.sim(k, 1);
      s = T.state();
      if (firstDeathTick < 0 && s.state === 'dead') { firstDeathTick = s.levelTick; deathCause = s.lastDeath; }
      if (s.state === 'won') break;
    }
    for (let i = 0; i < extra && s.state === 'play'; i++) { if (render) T.hold('', 1); else T.sim('', 1); s = T.state(); }
    T.release();
    return { final: s, died: s.deathsLevel > d0, deaths: s.deathsLevel - d0, firstDeathTick, deathCause };
  }, { level, rec, extra, render });
}
