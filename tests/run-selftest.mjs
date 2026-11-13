// Headless self-test against the production build (npm run build first).
//
//  0. Soft-lock detector still finds the pit reported in the old level 1.
//  1. Phone check: every level played by the bot in REAL TIME in a 640×360 (360×640 phone
//     held sideways) touch viewport; must win with 0 deaths at a steady frame rate.
//  2. Every level won from the start and from each checkpoint; every one of the 86 traps:
//     its solution (from the previous checkpoint) gets past it alive, and walking into it
//     kills with the trap's troll firing. A screenshot of every trap at 640×360.
//  3. The hint: names the next trap, highlights exactly its danger tiles, greys out, survives
//     deaths/restarts, resets on level select / next level, changes nothing else.
//  4. Text: the level-1 instructions show once; no text after deaths.
//  5. Death counter, saving (old saves without a language still load), blocked storage.
//  6. Checkpoints: one after every 3 traps; a death respawns at the furthest one reached.
//  7. Languages: browser language picked by default, selector on the title screen and in
//     the pause menu, choice saved; font has every glyph; at 640×360 every button text and
//     the hint box fit in every language.
//  8. The camera never hides the hero: an arrow at the screen edge shows him (camera freeze).
//  9. Layouts and touch (desktop, phone landscape, portrait), full jump on ▲, restart button.
// 10. No console errors; build < 10 MB.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveDist, launch, openGame, replay, ROOT } from './harness.mjs';
import { analyzeLevel } from './softlock.mjs';

const results = [];
const log = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const CI = !!process.env.CI;
const perf = (ok, name, detail = '') => {
  if (ok || !CI) return log(ok, name, detail);
  results.push({ ok: true, info: true, name, detail });
  console.log(`INFO  ${name}  — ${detail} (timing check, not enforced on CI)`);
};
const replays = Object.fromEntries(readdirSync(join(ROOT, 'tests', 'replays')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => [Number(f.match(/\d+/)[0]), JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', f), 'utf8'))]));
const LEVELS = readdirSync(join(ROOT, 'src', 'levels')).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'src', 'levels', f), 'utf8')));
const EN = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
const LANGS = ['en', 'fr', 'de', 'es', 'pt-BR', 'it', 'ru', 'tr'];
const shotDir = join(ROOT, 'test-results');
mkdirSync(join(shotDir, 'traps'), { recursive: true });
const PHONE = { viewport: { width: 640, height: 360 }, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 1 } };

// 0. static: the analyzer catches the soft-lock reported in the old level 1
{
  const old = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'softlock-old-level1.json'), 'utf8'));
  const spots = [...new Set(analyzeLevel(old).stuck.map((p) => `col ${p.x} row ${p.y}`))];
  log(spots.some((s) => /col (8[2-9]|9[0-4]) /.test(s)), 'soft-lock detector finds the reported pit in the OLD level 1 (cols 82-94)', spots.join('; '));
}

const { server, url } = await serveDist();
const browser = await launch();
const allErrors = [];

// 1. phone check: real-time play of every level at 640×360
const levelInfo = {};
{
  const { page, errors, ctx } = await openGame(browser, url, PHONE);
  await page.evaluate(() => window.__DTTD.resetSave());
  const fpsAll = [];
  for (const [lvl, r] of Object.entries(replays)) {
    const level = Number(lvl);
    const res = await page.evaluate(({ level, rec }) => new Promise((resolve) => {
      const T = window.__DTTD;
      T.start(level, rec);
      const t0 = performance.now();
      let last = t0, frames = 0;
      const deltas = [];
      const tick = () => {
        const now = performance.now();
        deltas.push(now - last); last = now; frames++;
        const s = T.state();
        if ((s && s.level === level && (s.state === 'won' || s.deathsLevel > 0)) || now - t0 > 240000) {
          deltas.splice(0, 8);
          deltas.sort((a, b) => a - b);
          const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
          resolve({ s, secs: (now - t0) / 1000, fps: 1000 / mean, p95: deltas[Math.floor(deltas.length * 0.95)] || 0 });
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { level, rec: r.win });
    fpsAll.push(res.fps);
    log(res.s.state === 'won' && res.s.deathsLevel === 0, `phone 640×360: bot plays level ${level} through in real time`, `${res.s.state}, ${res.secs.toFixed(1)} s, ${res.fps.toFixed(0)} fps`);
    levelInfo[level] = { realtimeSeconds: +res.secs.toFixed(1) };
    await page.waitForTimeout(400);
  }
  const avg = fpsAll.reduce((a, b) => a + b, 0) / fpsAll.length;
  perf(avg >= 50, 'steady frame rate during the real-time runs', `avg ${avg.toFixed(1)} fps, worst level ${Math.min(...fpsAll).toFixed(1)} fps (640×360, software WebGL)`);
  const save = await page.evaluate(() => window.__DTTD.Save.get());
  log(save.unlocked === 10 && Object.keys(save.completed).length === 10, 'progress saved: all 10 levels completed', JSON.stringify({ unlocked: save.unlocked }));
  allErrors.push(...errors);
  await ctx.close();
}

// 2. completion, every trap's solution and death, screenshots of every trap at 640×360
{
  const { page, errors, ctx } = await openGame(browser, url);
  await page.evaluate(() => window.__DTTD.resetSave());
  let solved = 0, killed = 0, traps = 0;
  for (const L of LEVELS) {
    const r = replays[L.id];
    const fired = new Set();
    const w = await replay(page, L.id, r.win);
    w.final.trolls.forEach((t) => fired.add(t));
    log(w.final.state === 'won' && !w.died, `level ${L.id} is completable from the start`, `${(w.final.levelTick / 60).toFixed(1)} s, ${L.map[0].length} tiles`);
    const cpTimes = [];
    for (let i = 0; i < r.cps.length; i++) {
      const c = await replay(page, L.id, r.cps[i], { checkpoint: i });
      c.final.trolls.forEach((t) => fired.add(t));
      cpTimes.push((c.final.levelTick / 60).toFixed(1));
      log(c.final.state === 'won' && !c.died, `level ${L.id} is completable from checkpoint ${i + 1}`, `${cpTimes[i]} s`);
    }
    for (const t of [...L.trolls].sort((a, b) => a.x - b.x)) {
      const rec = r.traps[t.name];
      traps++;
      const s = await replay(page, L.id, rec.solve, { checkpoint: rec.cp, extra: 0 });
      const okS = !s.died && (s.final.state === 'won' || s.final.x >= (t.x + t.w) * 40);
      if (okS) solved++;
      const d = await replay(page, L.id, rec.die, { checkpoint: rec.cp });
      d.final.trolls.forEach((x) => fired.add(x));
      const okD = d.died && d.final.trolls.includes(t.id);
      if (okD) killed++;
      log(okS && okD, `level ${L.id} trap "${t.name}" [${t.type}]`, `solution from ${rec.cp < 0 ? 'the start' : `checkpoint ${rec.cp + 1}`}: ${okS ? 'passes' : 'FAILS'} · walking into it: ${okD ? `kills (${d.deathCause})` : 'DOES NOT KILL'}`);
    }
    const missing = L.trolls.filter((t) => !fired.has(t.id)).map((t) => t.name);
    log(!missing.length, `level ${L.id}: all ${L.trolls.length} traps fire`, missing.length ? `never fired: ${missing.join('; ')}` : '');
    // the hint names the next trap and changes nothing else
    const h = await replay(page, L.id, r.win, { hintAt: 40 });
    const next = [...L.trolls].sort((a, b) => a.x - b.x).find((t) => t.x + t.w > h.hinted.x / 40 - 0.5);
    log(h.hinted.hintUsed && h.hinted.hint === EN[next.hint] && h.final.state === 'won' && h.final.levelTick === w.final.levelTick,
      `level ${L.id}: the hint explains the next trap and changes nothing else`, `"${h.hinted.hint}" → still wins on tick ${h.final.levelTick}`);
    levelInfo[L.id] = { ...levelInfo[L.id], name: EN[L.name], width: L.map[0].length, winSeconds: +(w.final.levelTick / 60).toFixed(1), cpSeconds: cpTimes.map(Number),
      traps: L.trolls.map((t) => ({ name: t.name, type: t.type, hint: EN[t.hint] })) };
  }
  log(traps === 86 && solved === 86 && killed === 86, 'all 86 traps: solution passes and the trap kills', `${solved}/86 solved, ${killed}/86 kill`);
  allErrors.push(...errors);
  await ctx.close();
}

// 2b. screenshot of every trap on a 640×360 phone screen
{
  const { page, errors, ctx } = await openGame(browser, url, PHONE);
  await page.evaluate(() => window.__DTTD.setManual(true));
  let shots = 0;
  for (const L of LEVELS) {
    for (const t of L.trolls) {
      const rec = replays[L.id].traps[t.name];
      const ok = await page.evaluate(({ level, rec, cp, id }) => {
        const T = window.__DTTD;
        T.start(level, rec, cp);
        const sc = T.game.scene.getScene('Game');
        let n = 0;
        while (!T.state().trolls.includes(id) && n++ < 9000) sc.fixedTick();
        T.snapCamera();
        T.step(14);
        return T.state().trolls.includes(id);
      }, { level: L.id, rec: rec.die, cp: rec.cp, id: t.id });
      if (ok) { await page.screenshot({ path: join(shotDir, 'traps', `L${String(L.id).padStart(2, '0')}-${t.id}-${t.type}.png`) }); shots++; }
    }
  }
  log(shots === 86, 'phone 640×360: a screenshot of every trap in action', `${shots} screenshots in test-results/traps/`);
  allErrors.push(...errors);
  await ctx.close();
}

// 3 + 4. hint highlight & lifecycle, the one-time instructions, no text after deaths
{
  const { page, errors, ctx } = await openGame(browser, url);
  const r = await page.evaluate(({ win1 }) => {
    const T = window.__DTTD;
    T.resetSave();
    T.lang('en');
    T.setManual(true);
    const sc = () => T.game.scene.getScene('Game');
    const btn = () => { const b = sc().sysButtons[0]; return { alpha: b.alpha, enabled: b.enabled !== false }; };
    const out = {};
    T.start(4); T.sim('R', 20);
    out.fresh = btn();
    T.hint();
    const hl = [...sc().worldLayer.list].filter((o) => o.name === 'highlight').map((o) => [o.x / 40, o.y / 40, o.width / 40, o.height / 40]);
    out.highlight = hl;
    out.first = T.state().hint;
    T.sim('', 5); T.hint();
    out.used = { again: T.state().hint, btn: btn() };
    T.kill(); T.sim('', 30);
    out.afterDeath = T.state().hintUsed;
    T.restart(); T.sim('', 2);
    out.afterRestart = T.state().hintUsed;
    T.start(4); T.sim('', 2);
    out.afterSelect = T.state().hintUsed;
    T.start(1); T.sim('', 2);
    out.tut1 = sc().hints.filter((h) => h.obj.visible && h.obj.alpha > 0).map((h) => h.obj.text);
    const keys = []; for (const [n, k] of win1) for (let i = 0; i < n; i++) keys.push(k);
    let i = 0; while (i < keys.length && T.state().state === 'play') T.sim(keys[i++], 1);
    out.seen = T.Save.get().tutorialSeen;
    sc().nextLevel(); T.step(3);
    out.next = { level: T.state().level, used: T.state().hintUsed };
    T.start(1); T.sim('', 2);
    out.tut2 = sc().hints.length;
    out.deathText = [];
    for (let l = 1; l <= 10; l++) { T.start(l); for (let d = 0; d < 5; d++) { T.kill(); T.sim('', 30); } out.deathText.push(sc().hints.length); }
    T.release();
    return out;
  }, { win1: replays[1].win });
  const L4 = LEVELS[3];
  const want = [...L4.trolls].sort((a, b) => a.x - b.x)[0];
  const same = JSON.stringify([...r.highlight].sort()) === JSON.stringify([...want.danger].sort());
  log(r.fresh.enabled && r.first === EN[want.hint] && same, 'hint highlights exactly the dangerous tiles of the next trap', `${r.highlight.length} rect(s) ${JSON.stringify(r.highlight)} = danger ${JSON.stringify(want.danger)}`);
  log(r.used.again === r.first && !r.used.btn.enabled && r.used.btn.alpha < 0.5, 'one hint per level: used once, then the button greys out', `alpha ${r.used.btn.alpha}`);
  log(r.afterDeath && r.afterRestart && !r.afterSelect && !r.next.used && r.next.level === 2, 'hint stays used after deaths/restarts, resets on level select and the next level', JSON.stringify({ death: r.afterDeath, restart: r.afterRestart, select: r.afterSelect, next: r.next }));
  log(r.tut1.length === 2 && r.seen && r.tut2 === 0, 'level-1 move/jump instructions are shown once, never again', r.tut1.join(' | '));
  log(r.deathText.every((n) => n === 0), 'no text hints after deaths in any level', r.deathText.join(','));
  allErrors.push(...errors);
  await ctx.close();
}

// 5 + 6. deaths, saving, checkpoints
{
  const { page, errors, ctx } = await openGame(browser, url);
  const r = await page.evaluate((levels) => {
    const T = window.__DTTD;
    T.resetSave();
    T.setManual(true);
    const out = { cps: [] };
    for (const l of levels) {
      T.start(l.id, null, l.cps - 1);
      const s0 = T.state();
      T.kill(); T.sim('', 20);
      const s1 = T.state();
      out.cps.push({ id: l.id, count: s0.cpCount, at: s0.cpX, respawn: s1.x, idx: s1.cpIdx });
    }
    T.restart(); T.sim('', 2);
    out.restart = T.state();
    out.deaths = T.Save.get().totalDeaths;
    T.release();
    return out;
  }, LEVELS.map((L) => ({ id: L.id, cps: Math.floor((L.trolls.length - 1) / 3) })));
  const okCp = r.cps.every((c) => c.count === (c.id >= 8 ? 3 : 2) && Math.abs(c.respawn - c.at) < 30 && c.idx === c.count - 1);
  log(okCp, 'every level: a checkpoint after every 3 traps; a death respawns at the furthest one reached', r.cps.map((c) => `L${c.id}:${c.count}`).join(' '));
  log(r.restart.cpIdx === -1 && r.restart.x < 200, 'the restart button goes back to the very start', `x=${r.restart.x.toFixed(0)}`);
  log(r.deaths === 10, 'death counter counts every death', `${r.deaths}`);
  await page.evaluate(() => localStorage.setItem('dttd-save-v1', JSON.stringify({ unlocked: 7, totalDeaths: 321, levelDeaths: { 1: 3 }, completed: { 1: true, 6: true }, muted: true, tutorialSeen: true })));
  await page.reload();
  await page.waitForFunction(() => window.__DTTD);
  const old = await page.evaluate(() => ({ s: window.__DTTD.Save.get(), lang: window.__DTTD.lang() }));
  log(old.s.unlocked === 7 && old.s.totalDeaths === 321 && old.s.muted && old.s.lang === null && old.lang === 'en', 'an old save (no language yet) still loads: unlocked levels and settings kept', JSON.stringify(old.s));
  const blocked = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
    try { window.__DTTD.Save.addDeath(1); window.__DTTD.Save.setLang('de'); return 'ok'; } catch (e) { return String(e); } finally { Storage.prototype.setItem = orig; }
  });
  log(blocked === 'ok', 'blocked localStorage is handled', blocked);
  allErrors.push(...errors);
  await ctx.close();
}

// 7. languages
{
  // the browser language is used by default
  const de = await openGame(browser, url, { context: { locale: 'de-DE' } });
  const d = await de.page.evaluate(() => window.__DTTD.lang());
  log(d === 'de', 'default language follows the browser (de-DE → Deutsch)', d);
  allErrors.push(...de.errors);
  await de.ctx.close();
  const xx = await openGame(browser, url, { context: { locale: 'ja-JP' } });
  const x = await xx.page.evaluate(() => window.__DTTD.lang());
  log(x === 'en', 'unsupported browser language falls back to English', x);
  await xx.ctx.close();

  const { page, errors, ctx } = await openGame(browser, url, PHONE);
  const fonts = await page.evaluate(() => ['ЖжЁё', 'ĞğİıŞşÇçÖöÜü', 'ãçéêíõúÀÉ', 'äöüßÄÖÜ'].map((s) => document.fonts.check('900 24px "Nunito"', s)));
  log(fonts.every(Boolean), 'the bundled font (Nunito) covers Cyrillic, Turkish, Portuguese/Spanish/French and German letters', JSON.stringify(fonts));
  // the selector on the title screen: pick Русский, it is saved and survives a reload
  await page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.lang('en'); window.__DTTD.scene('Title'); });
  await page.waitForTimeout(500);
  const picked = await page.evaluate(() => {
    const T = window.__DTTD;
    const title = T.game.scene.getScene('Title');
    const btn = title.children.list.find((o) => o.name === 'language');
    btn.emit('pointerdown'); btn.emit('pointerup');
    const picker = title.children.list.find((o) => o.name === 'langpicker');
    const names = picker.list.filter((o) => o.name?.startsWith('lang-')).map((o) => o.name);
    const ru = picker.list.find((o) => o.name === 'lang-ru');
    ru.emit('pointerdown'); ru.emit('pointerup');
    return { names, lang: T.lang(), saved: T.Save.get().lang };
  });
  await page.waitForTimeout(400);
  const titleText = await page.evaluate(() => window.__DTTD.game.scene.getScene('Title').children.list.find((o) => o.name === 'play')?.txt?.text);
  await page.screenshot({ path: join(shotDir, 'language-title-ru.png') });
  await page.reload();
  await page.waitForFunction(() => window.__DTTD);
  const after = await page.evaluate(() => window.__DTTD.lang());
  log(picked.names.length === 8 && picked.lang === 'ru' && picked.saved === 'ru' && titleText === 'ИГРАТЬ' && after === 'ru', 'title screen language selector: 8 languages, choice applied and saved', `${picked.names.length} choices, PLAY → "${titleText}", after reload: ${after}`);
  // pause menu has the selector too
  const pause = await page.evaluate(() => {
    const T = window.__DTTD; T.setManual(true); T.start(3); T.step(3);
    const g = T.game.scene.getScene('Game'); g.togglePause();
    return !!g.overlay?.list.find((o) => o.name === 'langbtn');
  });
  log(pause, 'pause menu has the language selector', '');
  // every text fits at 640×360 in every language
  const fit = await page.evaluate((langs) => {
    const T = window.__DTTD;
    const bad = [];
    const check = (where, root) => {
      const walk = (o) => {
        if (o.list) o.list.forEach(walk);
        if (o.txt && o.txt.getData('room') && o.txt.displayWidth > o.txt.getData('room') + 0.5) bad.push(`${where}: "${o.txt.text}" ${o.txt.displayWidth.toFixed(0)} > ${o.txt.getData('room')}`);
      };
      root.forEach(walk);
    };
    for (const l of langs) {
      T.lang(l);
      T.scene('Title'); T.step(3);
      check(`${l} title`, T.game.scene.getScene('Title').children.list);
      T.start(5); T.step(3);
      const g = T.game.scene.getScene('Game');
      g.togglePause(); T.step(2); check(`${l} pause`, g.overlay.list); g.togglePause();
      // the longest hint of all levels in the hint box
      let longest = '';
      for (let id = 1; id <= 10; id++) for (const tr of T.levelData(id).trolls) { const s = T.t(tr.hint); if (s.length > longest.length) longest = s; }
      const box = g.showHintBox(longest);
      T.step(14);
      const tx = box.list[2];
      const L = g.lay;
      // at most 3 lines, inside the visible screen
      if (tx.displayHeight > 3 * 34 || box.getData('w') > L.right - L.left - 30 || tx.displayWidth > box.getData('w') - 80) bad.push(`${l} hint box: text ${tx.displayWidth.toFixed(0)}×${tx.displayHeight.toFixed(0)} in box ${box.getData('w').toFixed(0)} (screen ${(L.right - L.left).toFixed(0)})`);
      box.destroy();
      g.showFakeClear(true); check(`${l} fake clear`, g.uiLayer.list); g.showFakeClear(false);
      g.debugWin(); T.step(60); check(`${l} level clear`, g.overlay?.list ?? []);
    }
    T.lang('en');
    return bad;
  }, LANGS);
  log(fit.length === 0, 'at 640×360 every button text and the longest hint fit, in all 8 languages', fit.slice(0, 6).join(' | '));
  allErrors.push(...errors);
  await ctx.close();
}

// 8. the camera never hides the hero: edge arrow while the camera is frozen (level 8)
{
  const { page, errors, ctx } = await openGame(browser, url, PHONE);
  const L8 = LEVELS[7];
  const freeze = L8.trolls.find((t) => t.type === 'camera-freeze');
  const rec = replays[8].traps[freeze.name].solve;
  const r = await page.evaluate(({ rec }) => {
    const T = window.__DTTD; T.setManual(true); T.start(8, rec, -1);
    let arrow = false, n = 0;
    while (n++ < 2400 && T.state().state === 'play') { T.step(1); const s = T.state(); if (s.arrow && s.cam.includes('freeze')) { arrow = true; break; } }
    return { arrow, s: T.state() };
  }, { rec });
  await page.screenshot({ path: join(shotDir, 'camera-freeze-arrow.png') });
  log(r.arrow, 'camera freeze: when the hero leaves the screen an arrow at the edge shows where he is', `x=${(r.s.x / 40).toFixed(1)}`);
  allErrors.push(...errors);
  await ctx.close();
}

// 9. layouts, touch, full jump, restart button
{
  const d = await openGame(browser, url, { viewport: { width: 1280, height: 720 } });
  await d.page.evaluate(() => { window.__DTTD.lang('en'); window.__DTTD.start(3); });
  await d.page.waitForTimeout(600);
  const dl = await d.page.evaluate(() => {
    const g = window.__DTTD.game.scene.getScene('Game');
    const b = g.sysButtons[1]; const bb = b.getBounds(); const cam = g.uiCam; const w = cam.getWorldPoint(0, 0);
    return { zoom: g.cameras.main.zoom, touch: g.touchUI.visible, rb: { x: (bb.x - w.x) * cam.zoom, y: (bb.y - w.y) * cam.zoom, w: bb.width * cam.zoom } };
  });
  await d.page.screenshot({ path: join(shotDir, 'layout-desktop-1280x720.png') });
  log(Math.abs(dl.zoom - 1) < 0.01 && !dl.touch && dl.rb.w >= 44 && dl.rb.x >= 0 && dl.rb.x + dl.rb.w <= 1280, 'desktop 1280×720: level fills the screen, restart button visible, no touch buttons', JSON.stringify(dl.rb));
  allErrors.push(...d.errors);
  await d.ctx.close();

  for (const vp of [{ width: 844, height: 390 }, { width: 640, height: 360 }]) {
    const p = await openGame(browser, url, { viewport: vp, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
    await p.page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.lang('en'); window.__DTTD.start(1); });
    await p.page.waitForTimeout(700);
    const lay = await p.page.evaluate(() => {
      const g = window.__DTTD.game.scene.getScene('Game');
      const cam = g.uiCam; const wv = g.cameras.main; const dpr = g.scale.width / window.innerWidth;
      const toCss = (x, y) => { const w = cam.getWorldPoint(0, 0); return { x: ((x - w.x) * cam.zoom) / dpr, y: ((y - w.y) * cam.zoom) / dpr }; };
      const btns = g.touchBtns.map((b) => { const c = b.img; const sz = c.getData('size'); const a = toCss(c.x - sz.w / 2, c.y - sz.h / 2), z = toCss(c.x + sz.w / 2, c.y + sz.h / 2); return { key: b.key, x: (a.x + z.x) / 2, y: (a.y + z.y) / 2, w: z.x - a.x, h: z.y - a.y }; });
      const rb = g.sysButtons[1].getBounds(); const rbA = toCss(rb.x, rb.y);
      return { levelL: wv.x / dpr, levelR: (wv.x + wv.width) / dpr, btns, restart: { x: rbA.x, w: (rb.width * cam.zoom) / dpr }, tiles: wv.width / wv.zoom / 40 };
    });
    await p.page.screenshot({ path: join(shotDir, `layout-phone-${vp.width}x${vp.height}.png`) });
    const outside = lay.btns.every((b) => b.x + b.w / 2 <= lay.levelL + 1 || b.x - b.w / 2 >= lay.levelR - 1);
    log(outside && lay.btns.every((b) => b.w >= 44 && b.h >= 44) && lay.restart.w >= 44 && lay.tiles >= 20 && lay.tiles <= 24,
      `phone ${vp.width}×${vp.height}: ~22 tiles visible, touch buttons ≥44 px outside the level, restart button ≥44 px`, `${lay.tiles.toFixed(1)} tiles; restart ${lay.restart.w.toFixed(0)} px`);
    if (vp.width === 844) {
      const cdp = await p.ctx.newCDPSession(p.page);
      const jump = lay.btns.find((b) => b.key === 'jump');
      const right = lay.btns.find((b) => b.key === 'right');
      const st = () => p.page.evaluate(() => window.__DTTD.state());
      const waitTicks = async (n) => { const t0 = (await st()).levelTick; for (let i = 0; i < 2000; i++) { const s = await st(); if (s.levelTick >= t0 + n) return s; await p.page.waitForTimeout(10); } return st(); };
      const peak = async (press, release) => {
        await p.page.evaluate(() => window.__DTTD.start(1)); await waitTicks(25);
        await p.page.evaluate(() => { const sc = window.__DTTD.game.scene.getScene('Game'); window.__ys = []; if (!sc.__h) { const o = sc.fixedTick; sc.fixedTick = function () { o.call(this); window.__ys.push(this.pbody.center.y); }; sc.__h = 1; } });
        await press(); await waitTicks(50); await release(); await waitTicks(30);
        return p.page.evaluate(() => Math.max(...window.__ys) - Math.min(...window.__ys));
      };
      const kb = await peak(() => p.page.keyboard.down('Space'), () => p.page.keyboard.up('Space'));
      const tch = await peak(() => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jump.x, y: jump.y, id: 3 }] }), () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
      log(kb > 100 && Math.abs(kb - tch) <= 1, 'touch: holding ▲ gives the same full jump as the keyboard', `keyboard ${kb.toFixed(1)} px, ▲ ${tch.toFixed(1)} px`);
      await p.page.evaluate(() => window.__DTTD.start(1));
      const x0 = (await waitTicks(10)).x;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }] });
      const x1 = (await waitTicks(30)).x;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      log(x1 > x0 + 20, 'touch: holding ▶ moves the hero', `x ${x0.toFixed(0)} → ${x1.toFixed(0)}`);
    }
    allErrors.push(...p.errors);
    await p.ctx.close();
  }
  const pp = await openGame(browser, url, { viewport: { width: 360, height: 640 }, context: { hasTouch: true, isMobile: true } });
  const rot = await pp.page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display);
  log(rot === 'flex', 'phone portrait 360×640 asks to rotate the phone', rot);
  await pp.ctx.close();
}

// 10. errors and size
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
