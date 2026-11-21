// Release smoke test: the actual upload zips (release/<portal>/dont-trust-the-door-<portal>.zip), unpacked and served
// locally, each portal's SDK replaced by its mock (tests/portal-mocks.mjs), at two sizes:
//   desktop 1280×720 (mouse) and phone 390×844 (touch). The landscape portals show the "rotate your phone" screen in
//   portrait (they are submitted as landscape games): the test checks it, then turns the phone to 844×390. YouTube
//   Playables must work at every aspect ratio: it plays at 390×844.
// Per portal and size:
//   - the game loads to the title (the portal's ready signal), with no console error and no request outside the zip
//     except its own SDK
//   - Play (a real click / tap on the button) starts level 1 (GameDistribution: after its pre-roll)
//   - level 1 is completed (the recorded winning run fed tick by tick into the game's input) → level-clear card
//   - Next: the portal's interstitial is simulated — the game is paused and silent during it, then the sound is back
//     to the player's setting and level 2 runs
// Usage: npm run release && node tests/release.mjs [portal ...]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, serveDist, ROOT } from './harness.mjs';
import { MOCKS } from './portal-mocks.mjs';
import { PORTALS, SDK, zipPath } from '../scripts/lib/portal.mjs';

const only = process.argv.slice(2).filter((a) => PORTALS.includes(a));
const list = only.length ? only : PORTALS;
const WIN1 = JSON.parse(readFileSync(join(ROOT, 'tests/replays/level-01.json'), 'utf8')).win;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const results = [];

const SIZES = [
  { name: 'desktop 1280×720', viewport: { width: 1280, height: 720 }, touch: false },
  { name: 'phone 390×844 (touch)', viewport: { width: 390, height: 844 }, touch: true },
];

async function run(portal, size, url, browser) {
  const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 1, isMobile: size.touch, hasTouch: size.touch });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/\[Playgama Bridge\]/.test(m.text())) errors.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = route.request().url();
    if (u === SDK[portal]) return route.fulfill({ contentType: 'text/javascript', body: MOCKS[portal] });
    external.push(u);
    return route.abort();
  });
  const checks = [];
  const check = (ok, msg, detail = '') => {
    checks.push({ ok: !!ok, msg });
    console.log(`  ${ok ? '✓' : '✗'} ${msg}${detail && !ok ? ` (${detail})` : ''}`);
    if (!ok) failed++;
  };
  console.log(`\n${portal} — ${size.name}`);
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => window.__DTTD && window.__DTTD.activeScenes().includes('Title'), null, { timeout: 30000 });
  await sleep(500);
  const G = (fn, arg) => page.evaluate(fn, arg);
  const portalState = () => G(() => window.__DTTD.portal());
  const calls = () => G(() => window.__mock.calls.map((c) => c.n + (typeof c.a === 'string' ? `:${c.a}` : '')));
  const ready = { playgama: 'sendMessage:game_ready', gamepix: 'loaded', y8: 'init', crazygames: 'loadingStop', gamedistribution: 'preloadAd:rewarded', youtube: 'gameReady' }[portal];
  check((await calls()).includes(ready), `loads to the title; ${ready.replace(/:.*/, '')} sent`, (await calls()).join(' '));

  // phone: landscape portals ask to rotate in portrait, then the phone is turned
  if (size.touch) {
    const rot = await G(() => getComputedStyle(document.getElementById('rotate')).display);
    if (portal === 'youtube') check(rot === 'none', 'portrait 390×844: playable, no "rotate your phone" screen (every aspect ratio)', rot);
    else {
      check(rot === 'flex', 'portrait 390×844: "rotate your phone" (submitted as a landscape game)', rot);
      await page.setViewportSize({ width: 844, height: 390 });
      await sleep(400);
      check((await G(() => getComputedStyle(document.getElementById('rotate')).display)) === 'none', 'turned to 844×390: the game shows');
    }
  }

  // a real click / tap on the Play button
  const playAt = await G(() => {
    const T = window.__DTTD;
    const s = T.game.scene.getScene('Title');
    const b = s.children.getByName('play');
    const cam = s.cameras.main;
    const dpr = T.game.scale.width / window.innerWidth;
    return { x: ((b.x - cam.worldView.x) * cam.zoom + cam.x) / dpr, y: ((b.y - cam.worldView.y) * cam.zoom + cam.y) / dpr };
  });
  if (size.touch) await page.touchscreen.tap(playAt.x, playAt.y);
  else await page.mouse.click(playAt.x, playAt.y);
  if (portal === 'gamedistribution') {
    await sleep(150);
    const pp = await portalState();
    check((await calls()).includes('showAd') && pp.paused && pp.muted, 'Play: GameDistribution pre-roll, game paused + muted during it', JSON.stringify(pp));
  }
  const started = await page.waitForFunction(() => { const s = window.__DTTD.state(); return s && s.level === 1 && s.state === 'play'; }, null, { timeout: 15000 }).then(() => true, () => false);
  check(started, 'Play starts level 1');

  // level 1 completed by the recorded winning run (fed to the game's input frame by frame, rendered)
  const won = await G((rec) => new Promise((resolve) => {
    const T = window.__DTTD;
    T.setManual(true);
    T.start(1);
    let skip = T.state().levelTick;
    rec = rec.map(([n, k]) => [n, k]);
    while (skip > 0 && rec.length) { const t = Math.min(skip, rec[0][0]); rec[0][0] -= t; skip -= t; if (!rec[0][0]) rec.shift(); }
    const steps = [];
    for (const [n, k] of rec) for (let i = 0; i < n; i++) steps.push(k);
    // tick by tick through the game's own input and fixed update (the recording is per game tick; rendered frames
    // can run zero ticks during the game's slow-motion moments), a frame drawn every 8 ticks
    let i = 0;
    const tick = () => {
      for (let j = 0; j < 8 && i < steps.length; j++) T.sim(steps[i++], 1);
      const s = T.state();
      const end = (ok) => { T.release(); T.setManual(false); resolve(ok); };
      if (s.state === 'won') return end(true);
      if (s.state === 'dead') return end(false);
      if (i >= steps.length) { for (let j = 0; j < 120 && T.state().state === 'play'; j++) T.sim('', 1); return end(T.state().state === 'won'); }
      T.step(0);
      requestAnimationFrame(tick);
    };
    tick();
  }), WIN1);
  check(won, 'level 1 completed (EXIT reached)');
  const card = await page.waitForFunction(() => { const g = window.__DTTD.game.scene.getScene('Game'); return !!(g.overlay && g.overlay.getByName('clearNext')); }, null, { timeout: 15000 }).then(() => true, () => false);
  check(card, 'the level-clear card shows');

  // Next: the interstitial (simulated by the mock) — paused + silent during it, then back
  if (portal === 'gamepix') await G(() => { const o = Date.now; Date.now = () => o() + 125000; }); // GamePix: not in the first 2 minutes
  await G(() => (window.__mock.mode = 'ok'));
  const before = await G(() => window.__DTTD.audioState());
  await G(() => { const g = window.__DTTD.game.scene.getScene('Game'); const b = g.overlay.getByName('clearNext'); b.emit('pointerdown'); b.emit('pointerup'); });
  await sleep(150);
  const during = await portalState();
  const aDuring = await G(() => window.__DTTD.audioState());
  check(during.paused && during.muted && aDuring.sysMuted, 'Next: the interstitial plays — game paused and sound off during it', JSON.stringify({ during, sys: aDuring.sysMuted }));
  const next = await page.waitForFunction(() => { const s = window.__DTTD.state(); return s && s.level === 2 && s.state === 'play'; }, null, { timeout: 20000 }).then(() => true, () => false);
  const after = await portalState();
  const aAfter = await G(() => window.__DTTD.audioState());
  check(next && !after.paused && !after.muted && !aAfter.sysMuted && aAfter.muted === before.muted, "after the ad: level 2 runs, sound back to the player's setting", JSON.stringify({ after, audio: aAfter }));
  const t1 = (await G(() => window.__DTTD.state())).levelTick;
  await sleep(400);
  check((await G(() => window.__DTTD.state())).levelTick > t1, 'the game is not paused any more');

  check(!external.length, 'no request outside the zip except its own SDK', external.join(', '));
  check(!errors.length, 'no console errors', errors.slice(0, 3).join(' | '));
  results.push({ portal, size: size.name, checks });
  await ctx.close();
}

const browser = await launch();
for (const portal of list) {
  const zip = zipPath(portal);
  if (!existsSync(zip)) {
    console.log(`${portal}: ${zip} missing (npm run release)`);
    failed++;
    continue;
  }
  const dir = join(ROOT, '.tmp', 'release-test', portal);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const { server, url } = await serveDist(dir);
  for (const size of SIZES) await run(portal, size, url, browser);
  server.close();
}
await browser.close();
mkdirSync(join(ROOT, 'test-results'), { recursive: true });
writeFileSync(join(ROOT, 'test-results', `release${only.length ? `-${only.join('-')}` : ''}.json`), JSON.stringify(results, null, 2));
const total = results.reduce((n, r) => n + r.checks.length, 0);
console.log(failed ? `\nrelease tests FAILED: ${failed} of ${total} checks` : `\nrelease tests: all ${total} checks passed`);
process.exit(failed ? 1 : 0);
