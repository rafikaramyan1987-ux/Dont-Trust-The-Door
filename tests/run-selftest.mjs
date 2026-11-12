// Headless self-test. Requires `npm run build` first (tests the production build).
//
//  1. Bot: every level is completed from its recorded replay, in REAL TIME (normal game
//     loop, rendering on), while frame rate is sampled.  Must win with 0 deaths.
//  2. Traps: every recorded trap replay must kill the player (deterministic sim).
//  3. Death counter + saving: counter == number of deaths, localStorage survives reload.
//  4. Instant restart: death → playable again in < 300 ms.
//  5. Layouts: phone landscape (touch buttons in side pillars, real touch input moves and
//     jumps the hero), phone portrait ("rotate your phone"), desktop 1280×720.
//  6. No console errors anywhere; build size < 10 MB.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveDist, launch, openGame, replay, ROOT } from './harness.mjs';

const results = [];
const log = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const replays = Object.fromEntries(
  readdirSync(join(ROOT, 'tests', 'replays')).filter((f) => f.endsWith('.json')).sort()
    .map((f) => [Number(f.match(/\d+/)[0]), JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', f), 'utf8'))]),
);
const shotDir = join(ROOT, 'test-results');
mkdirSync(shotDir, { recursive: true });

const { server, url } = await serveDist();
const browser = await launch();
const allErrors = [];

// ---------------------------------------------------------------------------
// 1. Real-time bot run through all levels.
// Headless Chromium has no GPU: WebGL is rasterised on the CPU by SwiftShader, which caps a
// 1280×720 canvas at ~12-18 fps regardless of the game. The real-time run therefore uses a
// small window (so rasterisation is not the bottleneck) and the CPU cost of a frame at
// 1280×720 is measured separately below.
const RT_VIEW = { width: 480, height: 270 };
{
  const { page, errors, ctx } = await openGame(browser, url, { viewport: RT_VIEW });
  await page.evaluate(() => window.__DTTD.resetSave());
  const fpsAll = [];
  for (const [lvl, r] of Object.entries(replays)) {
    const level = Number(lvl);
    const res = await page.evaluate(({ level, rec }) => new Promise((resolve) => {
      const T = window.__DTTD;
      T.start(level, rec);
      const t0 = performance.now();
      let last = t0, frames = 0, worst = 0;
      const deltas = [];
      const tick = () => {
        const now = performance.now();
        const dt = now - last; last = now; frames++;
        if (frames > 8) { deltas.push(dt); worst = Math.max(worst, dt); }
        const s = T.state();
        const done = s && s.level === level && (s.state === 'won' || s.deathsLevel > 0);
        if (done || now - t0 > 60000) {
          const secs = (now - t0) / 1000;
          deltas.sort((a, b) => a - b);
          const p95 = deltas[Math.floor(deltas.length * 0.95)] || 0;
          const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
          resolve({ s, secs, fps: 1000 / mean, p95, worst, loopFps: T.game.loop.actualFps });
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { level, rec: r.win });
    fpsAll.push(res.fps);
    const ok = res.s.state === 'won' && res.s.deathsLevel === 0;
    log(ok, `bot completes level ${level} in real time`, `${res.s.state}, ${res.secs.toFixed(1)} s, ${res.fps.toFixed(0)} fps, p95 frame ${res.p95.toFixed(1)} ms`);
    // let the "level complete" card appear, then check it
    await page.waitForTimeout(1100);
    if (level === 2) await page.screenshot({ path: join(shotDir, 'level-complete.png') });
  }
  const avg = fpsAll.reduce((a, b) => a + b, 0) / fpsAll.length;
  log(avg >= 55 && Math.min(...fpsAll) >= 50, 'stable ~60 fps during the real-time bot run', `avg ${avg.toFixed(1)} fps, worst level avg ${Math.min(...fpsAll).toFixed(1)} fps (${RT_VIEW.width}×${RT_VIEW.height}, software WebGL)`);

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('dttd-save-v1')));
  log(save && save.unlocked === 10 && Object.keys(save.completed).length === 10, 'progress saved: all 10 levels completed/unlocked', JSON.stringify({ unlocked: save?.unlocked, completed: Object.keys(save?.completed || {}).length }));
  allErrors.push(...errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 2 + 3. Every trap kills; death counter and save stay consistent
{
  const { page, errors, ctx } = await openGame(browser, url);
  await page.evaluate(() => window.__DTTD.resetSave());
  let expected = 0;
  for (const [lvl, r] of Object.entries(replays)) {
    for (const [name, rec] of Object.entries(r.traps || {})) {
      const res = await replay(page, Number(lvl), rec);
      expected += res.deaths;
      log(res.died && res.deaths === 1, `trap kills: level ${lvl} – ${name}`, `cause=${res.deathCause} at tick ${res.firstDeathTick}`);
    }
    // and the recorded winning run is deterministic in the pure simulation too
    const w = await replay(page, Number(lvl), r.win);
    log(w.final.state === 'won' && !w.died, `deterministic replay wins level ${lvl}`, `${w.final.levelTick} ticks = ${(w.final.levelTick / 60).toFixed(1)} s`);
  }
  const total = await page.evaluate(() => window.__DTTD.Save.get().totalDeaths);
  log(total === expected, 'death counter equals number of deaths', `${total} == ${expected}`);
  const hud = await page.evaluate(() => window.__DTTD.game.scene.getScene('Game').children.list.filter((o) => o.type === 'Container').flatMap((c) => c.list || []).find((o) => o.type === 'Text' && /^\d+$/.test(o.text))?.text);
  log(Number(hud) === expected, 'HUD death counter shows the total', `HUD "${hud}"`);
  // reload → persisted
  await page.reload();
  await page.waitForFunction(() => window.__DTTD);
  const after = await page.evaluate(() => window.__DTTD.Save.get());
  log(after.totalDeaths === expected && after.levelDeaths['2'] >= 1, 'save survives a page reload', `totalDeaths=${after.totalDeaths}`);
  // storage failure must not crash
  const blocked = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
    try { window.__DTTD.Save.addDeath(1); return 'ok'; } catch (e) { return String(e); } finally { Storage.prototype.setItem = orig; }
  });
  log(blocked === 'ok', 'blocked localStorage is handled (try/catch)', blocked);
  allErrors.push(...errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4. Instant restart in real time
{
  const { page, errors, ctx } = await openGame(browser, url, { viewport: RT_VIEW });
  const ms = await page.evaluate((rec) => new Promise((resolve) => {
    const T = window.__DTTD;
    T.start(2, rec);
    let tDead = 0;
    const tick = () => {
      const s = T.state();
      if (s && s.state === 'dead' && !tDead) tDead = performance.now();
      if (tDead && s.state === 'play') { resolve(performance.now() - tDead); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), replays[2].traps[Object.keys(replays[2].traps)[0]]);
  log(ms < 300, 'restart after death is instant (< 0.3 s)', `${ms.toFixed(0)} ms`);
  allErrors.push(...errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4b. CPU cost per frame at full 1280×720 (game logic + render submission)
{
  const { page, errors, ctx } = await openGame(browser, url);
  const r = await page.evaluate(() => {
    const T = window.__DTTD; T.setManual(true);
    const out = {};
    for (const l of [5, 10]) {
      T.start(l);
      const sc = T.game.scene.getScene('Game');
      let t = performance.now(); T.hold('R', 180); out['frame' + l] = (performance.now() - t) / 180;
      t = performance.now(); for (let i = 0; i < 20; i++) sc.restartLevel(); out['rebuild' + l] = (performance.now() - t) / 20;
    }
    T.release(); T.setManual(false);
    return out;
  });
  const frame = Math.max(r.frame5, r.frame10), rebuild = Math.max(r.rebuild5, r.rebuild10);
  log(frame < 4, 'CPU time per frame at 1280×720 is far below the 16.7 ms budget', `${frame.toFixed(2)} ms/frame`);
  log(rebuild < 20, 'level rebuild on restart is cheap', `${rebuild.toFixed(2)} ms (restart delay itself is 16 ticks = 267 ms)`);
  allErrors.push(...errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 5. Layouts and touch controls
{
  // Desktop
  const d = await openGame(browser, url, { viewport: { width: 1280, height: 720 } });
  await d.page.evaluate(() => { window.__DTTD.start(3); });
  await d.page.waitForTimeout(600);
  const dl = await d.page.evaluate(() => {
    const g = window.__DTTD.game.scene.getScene('Game');
    return { zoom: g.cameras.main.zoom, touch: g.touchUI.visible };
  });
  await d.page.screenshot({ path: join(shotDir, 'layout-desktop-1280x720.png') });
  log(Math.abs(dl.zoom - 1) < 0.01 && !dl.touch, 'desktop 1280×720: level fills the screen, no touch buttons', JSON.stringify(dl));
  allErrors.push(...d.errors);
  await d.ctx.close();

  // Phone landscape (iPhone-class 844×390, touch)
  const phone = { viewport: { width: 844, height: 390 }, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 3 } };
  const p = await openGame(browser, url, phone);
  await p.page.evaluate(() => { window.__DTTD.start(1); });
  await p.page.waitForTimeout(700);
  const lay = await p.page.evaluate(() => {
    const g = window.__DTTD.game.scene.getScene('Game');
    const cam = g.cameras.main;
    const toCss = (x, y) => { const w = cam.getWorldPoint(0, 0); const z = cam.zoom; const dpr = g.scale.width / window.innerWidth; return { x: ((x - w.x) * z) / dpr, y: ((y - w.y) * z) / dpr }; };
    const levelL = toCss(0, 0).x, levelR = toCss(1280, 0).x;
    const btns = g.touchBtns.map((b) => {
      const c = b.img; const sz = c.getData('size');
      const a = toCss(c.x - sz.w / 2, c.y - sz.h / 2), z = toCss(c.x + sz.w / 2, c.y + sz.h / 2);
      return { key: b.key, x: (a.x + z.x) / 2, y: (a.y + z.y) / 2, w: z.x - a.x, h: z.y - a.y, alpha: c.alpha };
    });
    return { visible: g.touchUI.visible, levelL, levelR, btns, rotate: getComputedStyle(document.getElementById('rotate')).display };
  });
  await p.page.screenshot({ path: join(shotDir, 'layout-phone-844x390.png') });
  const outside = lay.btns.every((b) => b.x + b.w / 2 <= lay.levelL + 1 || b.x - b.w / 2 >= lay.levelR - 1);
  const big = lay.btns.every((b) => b.w >= 44 && b.h >= 44);
  log(lay.visible && outside && big && lay.rotate === 'none', 'phone landscape 844×390: buttons visible, ≥44 px, outside the level area',
    `level spans ${lay.levelL.toFixed(0)}–${lay.levelR.toFixed(0)} css px; buttons ${lay.btns.map((b) => `${b.key} ${b.w.toFixed(0)}×${b.h.toFixed(0)}@${b.x.toFixed(0)}`).join(', ')}`);

  // Real touch input via CDP: hold ▶, then tap jump
  const cdp = await p.ctx.newCDPSession(p.page);
  const right = lay.btns.find((b) => b.key === 'right');
  const jump = lay.btns.find((b) => b.key === 'jump');
  const x0 = await p.page.evaluate(() => window.__DTTD.state().x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }] });
  await p.page.waitForTimeout(600);
  const x1 = await p.page.evaluate(() => window.__DTTD.state().x);
  const vx = await p.page.evaluate(() => window.__DTTD.state().vx);
  // multi-touch: keep holding right, press jump with a second finger
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }, { x: jump.x, y: jump.y, id: 2 }] });
  let minY = 1e9;
  for (let i = 0; i < 12; i++) { await p.page.waitForTimeout(25); minY = Math.min(minY, await p.page.evaluate(() => window.__DTTD.state().y)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const y0 = 586;
  log(x1 > x0 + 20 && vx > 250, 'touch: holding ▶ moves the hero right', `x ${x0.toFixed(0)} → ${x1.toFixed(0)}, vx ${vx.toFixed(0)}`);
  log(minY < y0 - 40, 'touch: second finger on jump makes the hero jump (multi-touch)', `min y ${minY.toFixed(0)} (ground ${y0})`);
  allErrors.push(...p.errors);
  await p.ctx.close();

  // Phone portrait → rotate message
  const pp = await openGame(browser, url, { viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 3 } });
  const rot = await pp.page.evaluate(() => { const el = document.getElementById('rotate'); return { display: getComputedStyle(el).display, text: el.innerText.split('\n')[0] }; });
  await pp.page.screenshot({ path: join(shotDir, 'layout-phone-portrait-390x844.png') });
  log(rot.display === 'flex' && /rotate/i.test(rot.text), 'phone portrait 390×844 shows "rotate your phone"', JSON.stringify(rot));
  allErrors.push(...pp.errors);
  await pp.ctx.close();
}

// ---------------------------------------------------------------------------
// 6. Errors and size
log(allErrors.length === 0, 'no console errors', allErrors.slice(0, 5).join(' | '));
const sizeOf = (dir) => readdirSync(dir).reduce((a, f) => { const p = join(dir, f); const st = statSync(p); return a + (st.isDirectory() ? sizeOf(p) : st.size); }, 0);
const bytes = sizeOf(join(ROOT, 'dist'));
log(bytes < 10 * 1024 * 1024, 'production build under 10 MB', `${(bytes / 1024 / 1024).toFixed(2)} MB`);

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
writeFileSync(join(shotDir, 'selftest.json'), JSON.stringify({ date: new Date().toISOString(), passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
