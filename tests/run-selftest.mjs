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
//  7. Level design rules: no soft-locks (static analysis of every reachable spot in every
//     world state), every trap type belongs to exactly one level, no text hints except the
//     level-1 controls (shown once), one player-chosen hint per level that changes nothing.
//  8. Phone: holding ▲ gives exactly the same full jump as holding the keyboard key; the
//     restart button is clearly visible on phone and desktop.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveDist, launch, openGame, replay, ROOT } from './harness.mjs';
import { analyzeLevel } from './softlock.mjs';

const results = [];
const log = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
// Timing checks depend on the machine. On shared CI runners they are reported (INFO) but
// do not fail the build; locally they are strict.
const CI = !!process.env.CI;
const perf = (ok, name, detail = '') => {
  if (ok || !CI) return log(ok, name, detail);
  results.push({ ok: true, info: true, name, detail });
  console.log(`INFO  ${name}  — ${detail} (timing check, not enforced on CI)`);
};
const replays = Object.fromEntries(
  readdirSync(join(ROOT, 'tests', 'replays')).filter((f) => f.endsWith('.json')).sort()
    .map((f) => [Number(f.match(/\d+/)[0]), JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', f), 'utf8'))]),
);
const levelFiles = readdirSync(join(ROOT, 'src', 'levels')).filter((f) => f.endsWith('.json')).sort();
const LEVELS = levelFiles.map((f) => JSON.parse(readFileSync(join(ROOT, 'src', 'levels', f), 'utf8')));
const shotDir = join(ROOT, 'test-results');

// ---------------------------------------------------------------------------
// 0. Static level-design rules (no browser needed)
{
  // the analyzer must catch the soft-lock that was reported in the old level 1
  const old = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'softlock-old-level1.json'), 'utf8'));
  const oa = analyzeLevel(old);
  const hit = oa.stuck.some((p) => p.x >= 82 && p.x <= 94);
  log(hit, 'soft-lock detector finds the reported pit in the OLD level 1 (cols 82-94)', [...new Set(oa.stuck.map((p) => `col ${p.x} row ${p.y}`))].join('; '));
  for (const L of LEVELS) {
    const a = analyzeLevel(L);
    const spots = [...new Set(a.stuck.map((p) => `col ${p.x} row ${p.y}`))];
    log(!spots.length && a.maxX >= L.map[0].length - 2, `level ${L.id}: no soft-locks (from every reachable spot the hero can reach the exit or die)`, spots.length ? `stuck at ${spots.join('; ')}` : `${a.reached} spots in ${a.states} world states checked`);
  }
  const owner = {};
  let clash = [];
  for (const L of LEVELS) for (const t of L.trolls) { if (owner[t.type] && owner[t.type] !== L.id) clash.push(`${t.type} (${owner[t.type]} & ${L.id})`); owner[t.type] = L.id; }
  log(!clash.length && new Set(LEVELS.map((L) => L.world)).size === LEVELS.length && new Set(LEVELS.map((L) => L.idea)).size === LEVELS.length,
    'every level has its own idea, palette and trap types (no type in two levels)', clash.length ? clash.join(', ') : `${Object.keys(owner).length} trap types, 10 ideas, 10 palettes`);
  const texts = LEVELS.filter((L) => L.id !== 1 && (L.hints || []).length).map((L) => L.id);
  const after = LEVELS.filter((L) => (L.hints || []).some((h) => 'afterDeaths' in h)).map((L) => L.id);
  log(!texts.length && !after.length, 'no text hints in the levels (only the level-1 controls), none after deaths', texts.length || after.length ? `levels ${texts} / ${after}` : `level 1: ${(LEVELS[0].hints || []).map((h) => h.text).join(' | ')}`);
  const w17 = LEVELS.slice(0, 7).reduce((a, L) => a + L.map[0].length, 0) / 7;
  const w810 = LEVELS.slice(7).map((L) => L.map[0].length);
  log(w810.every((w) => w >= w17 * 1.4), 'levels 8-10 are ~1.5× as long as levels 1-7', `avg 1-7: ${w17.toFixed(0)} tiles; 8-10: ${w810.join(', ')} (×${(w810.reduce((a, b) => a + b, 0) / 3 / w17).toFixed(2)})`);
  const t17 = Math.max(...LEVELS.slice(0, 7).map((L) => L.trolls.length));
  log(LEVELS.slice(7).every((L) => L.trolls.length > t17 || L.trolls.length >= 8), 'levels 8-10 have more troll moments', LEVELS.map((L) => `${L.id}:${L.trolls.length}`).join(' '));
}
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
        if (done || now - t0 > 180000) {
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
  perf(avg >= 55 && Math.min(...fpsAll) >= 50, 'stable ~60 fps during the real-time bot run', `avg ${avg.toFixed(1)} fps, worst level avg ${Math.min(...fpsAll).toFixed(1)} fps (${RT_VIEW.width}×${RT_VIEW.height}, software WebGL)`);

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('dttd-save-v1')));
  log(save && save.unlocked === 10 && Object.keys(save.completed).length === 10, 'progress saved: all 10 levels completed/unlocked', JSON.stringify({ unlocked: save?.unlocked, completed: Object.keys(save?.completed || {}).length }));
  allErrors.push(...errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 2 + 3. Every level is completable from the start AND from its checkpoint; every trap
// kills; every listed troll moment fires; the death counter and save stay consistent.
const levelInfo = {};
{
  const { page, errors, ctx } = await openGame(browser, url);
  await page.evaluate(() => window.__DTTD.resetSave());
  let expected = 0;
  for (const [lvl, r] of Object.entries(replays)) {
    const level = Number(lvl);
    const meta = LEVELS[level - 1];
    const fired = new Set();
    const w = await replay(page, level, r.win);
    w.final.trolls.forEach((t) => fired.add(t));
    log(w.final.state === 'won' && !w.died, `level ${lvl} is completable from the start`, `${(w.final.levelTick / 60).toFixed(1)} s, ${meta.map[0].length} tiles`);
    const c = await replay(page, level, r.cp, { checkpoint: true });
    c.final.trolls.forEach((t) => fired.add(t));
    log(c.final.state === 'won' && !c.died, `level ${lvl} is completable from its checkpoint`, `${(c.final.levelTick / 60).toFixed(1)} s`);
    for (const [name, t] of Object.entries(r.traps || {})) {
      const res = await replay(page, level, t.rec, { checkpoint: t.cp });
      res.final.trolls.forEach((x) => fired.add(x));
      expected += res.deaths;
      log(res.died && res.deaths === 1, `trap kills: level ${lvl} – ${name}`, `cause=${res.deathCause} at ${(res.firstDeathTick / 60).toFixed(1)} s${t.cp ? ' (from checkpoint)' : ''}`);
    }
    // the hint button: shows the next trap's hint, greys out, changes nothing else
    const h = await replay(page, level, r.win, { hintAt: 40 });
    const hx = h.hinted.x / 40;
    const nextTroll = meta.trolls.filter((t) => t.x + t.w > hx - 0.5).sort((a, b) => a.x - b.x)[0];
    log(h.hinted.hintUsed && h.hinted.hint === nextTroll.hint && h.final.state === 'won' && h.final.levelTick === w.final.levelTick,
      `level ${lvl}: the hint button shows the next trap's hint and changes nothing else`, `"${h.hinted.hint}" → still wins at the same tick ${h.final.levelTick}`);
    const missing = meta.trolls.filter((t) => !fired.has(t.id)).map((t) => t.name);
    log(missing.length === 0 && meta.trolls.length >= 5, `level ${lvl}: all ${meta.trolls.length} troll moments fire`, missing.length ? `never fired: ${missing.join('; ')}` : meta.trolls.map((t) => t.name).join(' · '));
    levelInfo[level] = { name: meta.name, width: meta.map[0].length, winSeconds: +(w.final.levelTick / 60).toFixed(1), cpSeconds: +(c.final.levelTick / 60).toFixed(1), trolls: meta.trolls.map((t) => t.name) };
  }
  const total = await page.evaluate(() => window.__DTTD.Save.get().totalDeaths);
  log(total === expected, 'death counter equals number of deaths', `${total} == ${expected}`);
  const hud = await page.evaluate(() => window.__DTTD.state().hudDeaths);
  log(Number(hud) === expected, 'HUD death counter shows the total', `HUD "${hud}"`);
  // reload → persisted
  await page.reload();
  await page.waitForFunction(() => window.__DTTD);
  const after = await page.evaluate(() => window.__DTTD.Save.get());
  log(after.totalDeaths === expected && after.levelDeaths['2'] >= 1, 'save survives a page reload', `totalDeaths=${after.totalDeaths}, per level ${JSON.stringify(after.levelDeaths)}`);
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
// 3b. Checkpoint behaviour: reach the flag by playing, die → respawn at the flag with the
// traps re-armed (and "keep" results such as a fled door applied); restart → back to start.
{
  const { page, errors, ctx } = await openGame(browser, url);
  for (const level of Object.keys(replays).map(Number)) {
    const r = replays[level];
    const res = await page.evaluate(({ level, rec }) => {
      const T = window.__DTTD;
      T.setManual(true);
      T.start(level, null, false);
      const start = T.state();
      const keys = [];
      for (const [n, k] of rec) for (let i = 0; i < n; i++) keys.push(k);
      let i = 0, s = T.state();
      while (!s.checkpoint && i < keys.length) { T.sim(keys[i++], 1); s = T.state(); }
      T.sim('R', 30); // a few steps past the flag (triggers after it may fire)
      const before = T.state();
      T.kill();
      T.sim('', 20); // restart delay
      const after = T.state();
      T.sim('', 2);
      T.restart();
      T.sim('', 2);
      const restarted = T.state();
      T.release();
      return { reached: before.checkpoint, cpX: before.cpX, firedBefore: before.fired.length, before, start, after, restarted };
    }, { level, rec: r.win });
    const atFlag = Math.abs(res.after.x - res.cpX) < 30 && res.after.state === 'play' && res.after.checkpoint;
    log(res.reached && atFlag && res.after.deathsLevel === 1, `level ${level}: death after the checkpoint respawns at the flag`, `flag x=${res.cpX}, respawn x=${res.after.x.toFixed(0)}, deaths=${res.after.deathsLevel}`);
    if (level === 7) log(res.before.doorX !== res.start.doorX && res.after.doorX > res.cpX && res.after.doorX !== res.start.doorX, `level ${level}: the door that already ran away stays away after the checkpoint respawn`, `door x ${res.start.doorX.toFixed(0)} → ${res.before.doorX.toFixed(0)} (running), after respawn ${res.after.doorX.toFixed(0)} (its destination)`);
    if (level === 1 || level === 10) log(res.restarted.x < 200 && !res.restarted.checkpoint, `level ${level}: the restart button goes back to the very start`, `x=${res.restarted.x.toFixed(0)}`);
  }
  allErrors.push(...errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 3c. Hint lifecycle and the one-time level-1 instructions
{
  const { page, errors, ctx } = await openGame(browser, url);
  const r = await page.evaluate(({ win1 }) => {
    const T = window.__DTTD;
    T.resetSave();
    T.setManual(true);
    const sc = () => T.game.scene.getScene('Game');
    const btn = () => { const b = sc().sysButtons[0]; return { alpha: b.alpha, enabled: b.enabled !== false, visible: b.visible }; };
    const out = {};
    T.start(4); T.sim('R', 20);
    out.fresh = { used: T.state().hintUsed, btn: btn() };
    T.hint();
    const first = T.state().hint;
    T.sim('', 5); T.hint();
    out.used = { used: T.state().hintUsed, hint: first, again: T.state().hint, btn: btn() };
    T.kill(); T.sim('', 30);
    out.afterDeath = T.state().hintUsed;
    T.restart(); T.sim('', 2);
    out.afterRestart = T.state().hintUsed;
    T.start(4); T.sim('', 2); // replay from level select
    out.afterSelect = { used: T.state().hintUsed, btn: btn() };
    // level 1 instructions: shown on the first visit only
    T.start(1); T.sim('', 2);
    out.tut1 = sc().hints.filter((h) => h.obj.visible && h.obj.alpha > 0).map((h) => h.obj.text);
    const keys = []; for (const [n, k] of win1) for (let i = 0; i < n; i++) keys.push(k);
    let i = 0; while (i < keys.length && T.state().state === 'play') T.sim(keys[i++], 1);
    out.seen = T.Save.get().tutorialSeen;
    out.won = T.state().state;
    sc().nextLevel(); T.step(3);
    out.nextLevel = { level: T.state().level, used: T.state().hintUsed };
    T.start(1); T.sim('', 2);
    out.tut2 = sc().hints.length;
    // no text appears after many deaths in any level
    out.deathText = [];
    for (let l = 1; l <= 10; l++) {
      T.start(l);
      for (let d = 0; d < 6; d++) { T.kill(); T.sim('', 30); }
      out.deathText.push(sc().hints.length);
    }
    T.release();
    return out;
  }, { win1: replays[1].win });
  log(!r.fresh.used && r.fresh.btn.enabled && r.fresh.btn.alpha === 1, 'hint button is available at the start of a level', JSON.stringify(r.fresh));
  log(r.used.used && !!r.used.hint && r.used.again === r.used.hint && !r.used.btn.enabled && r.used.btn.alpha < 0.5, 'hint is used once, then the button greys out', `"${r.used.hint}", alpha ${r.used.btn.alpha}`);
  log(r.afterDeath && r.afterRestart, 'dying or restarting does not give the hint back', `after death ${r.afterDeath}, after restart ${r.afterRestart}`);
  log(!r.afterSelect.used && r.afterSelect.btn.enabled && !r.nextLevel.used && r.nextLevel.level === 2, 'hint resets when the level is replayed from level select or the next level starts', JSON.stringify({ select: r.afterSelect.used, next: r.nextLevel }));
  log(r.tut1.length === 2 && r.seen && r.won === 'won' && r.tut2 === 0, 'level-1 move/jump instructions are shown once, never again', `first visit: ${r.tut1.join(' | ')}; second visit: ${r.tut2} texts`);
  log(r.deathText.every((n) => n === 0), 'no text hint appears after deaths in any level', `texts after 6 deaths per level: ${r.deathText.join(',')}`);
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
  }), replays[2].traps[Object.keys(replays[2].traps)[0]].rec);
  perf(ms < 300, 'restart after death is instant (< 0.3 s)', `${ms.toFixed(0)} ms`);
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
  perf(frame < 4, 'CPU time per frame at 1280×720 is far below the 16.7 ms budget', `${frame.toFixed(2)} ms/frame`);
  perf(rebuild < 20, 'level rebuild on restart is cheap', `${rebuild.toFixed(2)} ms (restart delay itself is 16 ticks = 267 ms)`);
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
    const b = g.sysButtons[1]; const bb = b.getBounds(); const cam = g.uiCam; const w = cam.getWorldPoint(0, 0);
    const rb = { visible: b.visible && b.alpha === 1, x: (bb.x - w.x) * cam.zoom, y: (bb.y - w.y) * cam.zoom, w: bb.width * cam.zoom, h: bb.height * cam.zoom };
    return { zoom: g.cameras.main.zoom, touch: g.touchUI.visible, rb };
  });
  await d.page.screenshot({ path: join(shotDir, 'layout-desktop-1280x720.png') });
  log(Math.abs(dl.zoom - 1) < 0.01 && !dl.touch, 'desktop 1280×720: level fills the screen, no touch buttons', JSON.stringify({ zoom: dl.zoom, touch: dl.touch }));
  const drb = dl.rb;
  log(drb.visible && drb.w >= 44 && drb.x >= 0 && drb.y >= 0 && drb.x + drb.w <= 1280 && drb.y + drb.h <= 720, 'desktop: restart button is visible on screen', `${drb.w.toFixed(0)}×${drb.h.toFixed(0)} px at (${drb.x.toFixed(0)}, ${drb.y.toFixed(0)})`);
  allErrors.push(...d.errors);
  await d.ctx.close();

  // Phone landscape (iPhone-class 844×390, touch)
  const phone = { viewport: { width: 844, height: 390 }, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 3 } };
  const p = await openGame(browser, url, phone);
  await p.page.evaluate(() => { window.__DTTD.start(1); });
  await p.page.waitForTimeout(700);
  const lay = await p.page.evaluate(() => {
    const g = window.__DTTD.game.scene.getScene('Game');
    const cam = g.uiCam; const wv = g.cameras.main; const dprv = g.scale.width / window.innerWidth;
    const toCss = (x, y) => { const w = cam.getWorldPoint(0, 0); const z = cam.zoom; const dpr = g.scale.width / window.innerWidth; return { x: ((x - w.x) * z) / dpr, y: ((y - w.y) * z) / dpr }; };
    const levelL = wv.x / dprv, levelR = (wv.x + wv.width) / dprv;
    const btns = g.touchBtns.map((b) => {
      const c = b.img; const sz = c.getData('size');
      const a = toCss(c.x - sz.w / 2, c.y - sz.h / 2), z = toCss(c.x + sz.w / 2, c.y + sz.h / 2);
      return { key: b.key, x: (a.x + z.x) / 2, y: (a.y + z.y) / 2, w: z.x - a.x, h: z.y - a.y, alpha: c.alpha };
    });
    return { visible: g.touchUI.visible, levelL, levelR, btns, rotate: getComputedStyle(document.getElementById('rotate')).display };
  });
  await p.page.screenshot({ path: join(shotDir, 'layout-phone-844x390.png') });
  const view = await p.page.evaluate(() => { const s = window.__DTTD.state(); return { tiles: s.viewTiles, heroCss: (28 * s.zoom) / (window.__DTTD.game.scale.width / window.innerWidth) }; });
  log(view.tiles >= 20 && view.tiles <= 24, 'phone landscape: camera shows ~22 tiles across and follows the hero', `${view.tiles.toFixed(1)} tiles visible, hero ${view.heroCss.toFixed(1)} css px tall (was 12.5 px when the whole 32-tile level was shown)`);
  const outside = lay.btns.every((b) => b.x + b.w / 2 <= lay.levelL + 1 || b.x - b.w / 2 >= lay.levelR - 1);
  const big = lay.btns.every((b) => b.w >= 44 && b.h >= 44);
  log(lay.visible && outside && big && lay.rotate === 'none', 'phone landscape 844×390: buttons visible, ≥44 px, outside the level area',
    `level spans ${lay.levelL.toFixed(0)}–${lay.levelR.toFixed(0)} css px; buttons ${lay.btns.map((b) => `${b.key} ${b.w.toFixed(0)}×${b.h.toFixed(0)}@${b.x.toFixed(0)}`).join(', ')}`);

  // Real touch input via CDP: hold ▶, then tap jump
  const cdp = await p.ctx.newCDPSession(p.page);
  const right = lay.btns.find((b) => b.key === 'right');
  const jump = lay.btns.find((b) => b.key === 'jump');
  // Measured in game ticks, not milliseconds, so a slow machine can't make it flaky.
  const st = () => p.page.evaluate(() => window.__DTTD.state());
  const waitTicks = async (n, watch) => {
    const t0 = (await st()).levelTick;
    for (let i = 0; i < 1500; i++) {
      const s = await st();
      if (watch) watch(s);
      if (s.levelTick >= t0 + n) return s;
      await p.page.waitForTimeout(10);
    }
    return st();
  };
  const x0 = (await st()).x;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }] });
  let vx = 0;
  const s1 = await waitTicks(36, (s) => { vx = Math.max(vx, s.vx); });
  const x1 = s1.x;
  // multi-touch: keep holding right, press jump with a second finger
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }, { x: jump.x, y: jump.y, id: 2 }] });
  let minY = 1e9;
  await waitTicks(24, (s) => { minY = Math.min(minY, s.y); });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const y0 = 586;
  log(x1 > x0 + 20 && vx > 250, 'touch: holding ▶ moves the hero right', `x ${x0.toFixed(0)} → ${x1.toFixed(0)}, vx ${vx.toFixed(0)}`);
  log(minY < y0 - 40, 'touch: second finger on jump makes the hero jump (multi-touch)', `min y ${minY.toFixed(0)} (ground ${y0})`);

  // Full jump: holding ▲ must give exactly the same jump as holding the keyboard key —
  // also when the thumb slides off the button into the level while holding.
  const jumpPeak = async (press, release) => {
    await p.page.evaluate(() => window.__DTTD.start(1));
    await waitTicks(25);
    // record the hero's height on every fixed game tick (exact, independent of frame timing)
    await p.page.evaluate(() => {
      const sc = window.__DTTD.game.scene.getScene('Game');
      window.__ys = [];
      if (!sc.__peakHook) { const o = sc.fixedTick; sc.fixedTick = function () { o.call(this); window.__ys.push(this.pbody.center.y); }; sc.__peakHook = true; }
    });
    await press();
    await waitTicks(50);
    await release();
    await waitTicks(30);
    return p.page.evaluate(() => { const ys = window.__ys; return Math.max(...ys) - Math.min(...ys); });
  };
  const kb = await jumpPeak(() => p.page.keyboard.down('Space'), () => p.page.keyboard.up('Space'));
  const tch = await jumpPeak(
    () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jump.x, y: jump.y, id: 3 }] }),
    () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
  const drift = await jumpPeak(async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jump.x, y: jump.y, id: 4 }] });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jump.x - k * 60, y: jump.y - k * 25, id: 4 }] });
  }, () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
  log(kb > 100 && Math.abs(kb - tch) <= 1 && Math.abs(kb - drift) <= 1, 'touch: holding ▲ gives exactly the same full jump as holding the keyboard key', `keyboard ${kb.toFixed(1)} px, ▲ ${tch.toFixed(1)} px, ▲ with thumb sliding into the level ${drift.toFixed(1)} px`);

  // restart button: clearly visible, big, outside the level area
  const rb = await p.page.evaluate(() => {
    const g = window.__DTTD.game.scene.getScene('Game');
    const cam = g.uiCam; const dpr = g.scale.width / window.innerWidth;
    const b = g.sysButtons[1]; const bb = b.getBounds();
    const w = cam.getWorldPoint(0, 0); const z = cam.zoom;
    return { visible: b.visible && b.alpha === 1, x: ((bb.x - w.x) * z) / dpr, y: ((bb.y - w.y) * z) / dpr, w: (bb.width * z) / dpr, h: (bb.height * z) / dpr, levelL: g.cameras.main.x / dpr, levelR: (g.cameras.main.x + g.cameras.main.width) / dpr };
  });
  log(rb.visible && rb.w >= 44 && rb.h >= 44 && rb.x >= 0 && rb.y >= 0 && rb.x + rb.w <= 844 && rb.y + rb.h <= 390 && (rb.x >= rb.levelR - 1 || rb.x + rb.w <= rb.levelL + 1),
    'phone landscape: restart button is visible, ≥44 px, outside the level area', `${rb.w.toFixed(0)}×${rb.h.toFixed(0)} css px at (${rb.x.toFixed(0)}, ${rb.y.toFixed(0)})`);
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
writeFileSync(join(shotDir, 'selftest.json'), JSON.stringify({ date: new Date().toISOString(), passed: results.length - failed, failed, levels: levelInfo, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
