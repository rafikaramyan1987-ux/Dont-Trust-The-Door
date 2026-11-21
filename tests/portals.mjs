// Mocked-SDK tests of the portal builds (and the web build) in a real browser. Each portal's SDK script is replaced
// at its CDN URL by a mock (tests/portal-mocks.mjs) that records every call; nothing else may leave the local server.
// Checked per build:
//   - boot: the portal's ready signal once the title is shown (game_ready / loaded / loadingStop / SDK init)
//   - language from the portal (mock: German) where the portal has one; saves in the portal's store where it has one
//   - no ad during a level, after a death or on a restart; no pre-roll
//   - the rewarded hint: the card asks first; the hint only when the SDK confirms the reward; "no ad" on a failure, an
//     early close or a silent SDK (the game's own timeout); the game paused + muted during the ad and resumed with the
//     player's own sound setting; never stuck; still one hint per level
//   - interstitial only from Next / Levels on the level-clear card (GamePix: at most one per 2 minutes)
//   - level started / completed / failed (Playgama), a death is not a failure; portal pause events and a hidden page
//     pause + mute the game
//   - GameDistribution: GD_OPTIONS events (SDK_GAME_PAUSE / SDK_GAME_START / SDK_REWARDED_WATCH_COMPLETE), a pre-roll
//     on the Play button (once); YouTube: firstFrameReady → gameReady, cloud save (loadData before saveData), the
//     language from getLanguage, onPause / onResume and the audio switch, no Page Visibility pause, no sound button
//   - Escape: pauses only where the portal allows it (not Playgama / CrazyGames; YouTube: only closes the menu)
//   - CrazyGames: midgame only at the level transition (Next), happytime only at the end of the game
//   - web: no SDK, no ads, the hint is free, no request at all outside the build
// Usage: node tests/portals.mjs [web|playgama|gamepix|y8|crazygames|gamedistribution|youtube ...]
//   (builds must exist: dist/, dist-<portal>/)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { launch, serveDist, ROOT } from './harness.mjs';
import { MOCKS } from './portal-mocks.mjs';
import { SDK } from '../scripts/lib/portal.mjs';

const ALL = ['web', 'playgama', 'gamepix', 'y8', 'crazygames', 'gamedistribution', 'youtube'];
const only = process.argv.slice(2).filter((a) => ALL.includes(a));
const builds = only.length ? only : ALL;
const results = [];
let failed = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(build) {
  const dir = build === 'web' ? 'dist' : `dist-${build}`;
  const { server, url } = await serveDist(dir);
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/\[Playgama Bridge\]/.test(m.text())) errors.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = route.request().url();
    if (build !== 'web' && u === SDK[build]) return route.fulfill({ contentType: 'text/javascript', body: MOCKS[build] });
    external.push(u);
    return route.abort();
  });
  const checks = [];
  const check = (cond, msg, detail = '') => {
    checks.push({ ok: !!cond, msg: detail && !cond ? `${msg} (${detail})` : msg });
    console.log(`  ${cond ? '✓' : '✗'} ${msg}${detail && !cond ? ` (${detail})` : ''}`);
    if (!cond) failed++;
  };
  console.log(`\n${build}: ${dir}/`);
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => window.__DTTD && window.__DTTD.activeScenes().includes('Title'), null, { timeout: 30000 });
  await sleep(600);
  const calls = () => page.evaluate(() => (window.__mock ? window.__mock.calls.map((c) => c.n + (typeof c.a === 'string' || typeof c.a === 'number' ? `:${c.a}` : '')) : []));
  const ads = async () => (await calls()).filter((c) => /^(showInterstitial|showRewarded|interstitial|reward|showAd|requestAd|requestInterstitialAd|requestRewardedAd)/.test(c));
  const G = (fn, arg) => page.evaluate(fn, arg);
  const scene = "window.__DTTD.game.scene.getScene('Game')";
  const press = (name) => G(`(() => { const s = ${scene}; const b = s.overlay && s.overlay.getByName('${name}'); if (!b) return false; b.emit('pointerdown'); b.emit('pointerup'); return true; })()`);
  const overlayName = () => G(`(() => { const s = ${scene}; return s.overlay ? s.overlay.name || 'overlay' : null; })()`);
  const st = () => G(() => window.__DTTD.state());
  const portal = () => G(() => window.__DTTD.portal());
  const startLevel = async (l) => {
    // the scene object is reused on a restart: wait for its new hero
    await G((x) => { const g = window.__DTTD.game.scene.getScene('Game'); if (g && g.hero) g.hero.__old = true; window.__DTTD.start(x); }, l);
    await page.waitForFunction((x) => { const g = window.__DTTD.game.scene.getScene('Game'); const s = window.__DTTD.state(); return s && g.hero && !g.hero.__old && s.level === x && s.state === 'play' && s.levelTick > 2; }, l, { timeout: 10000 });
  };

  // boot
  const c0 = await calls();
  if (build === 'playgama') check(c0.includes('sendMessage:game_ready'), 'game_ready sent once the title is shown', c0.join(' '));
  if (build === 'gamepix') check(c0.includes('loading:100') && c0.includes('loaded') && c0.indexOf('loading:0') < c0.indexOf('loading:100'), 'lifecycle loading 0 → 100, then loaded()', c0.join(' '));
  if (build === 'crazygames') check(c0.includes('init') && c0.includes('loadingStart') && c0.includes('loadingStop'), 'SDK.init(), loadingStart → loadingStop before the title', c0.join(' '));
  if (build === 'y8') {
    const init = await page.evaluate(() => window.__mock.calls.find((c) => c.n === 'init')?.a);
    check(init && init.appId === '6aff479cc9841fd9d0e5db3e' && init.gameId === '294329' && init.autoLogin === true && init.preloadAdBreaks === 'on' && init.sound === 'on',
      'Y8 SDK initialised from the y8sdk.ready snippet with the App ID, Game ID, autoLogin, preloadAdBreaks and sound', JSON.stringify(init));
  }
  if (build === 'gamedistribution') {
    const ev = c0.filter((c) => c.startsWith('event:'));
    check(ev.includes('event:SDK_READY') && c0.includes('preloadAd:rewarded'), "GD_OPTIONS.onEvent receives the SDK's events; a rewarded ad is preloaded", c0.join(' '));
  }
  if (build === 'youtube') {
    const i1 = c0.indexOf('firstFrameReady'), i2 = c0.indexOf('gameReady');
    check(i1 >= 0 && i2 > i1 && c0.filter((c) => c === 'gameReady').length === 1, 'firstFrameReady() on the loading screen, then gameReady() once at the title', c0.join(' '));
    check(c0.includes('loadData') && c0.includes('getLanguage') && (c0.indexOf('saveData') < 0 || c0.indexOf('saveData') > c0.indexOf('loadData')), 'loadData() awaited before any saveData(); getLanguage() for the language', c0.join(' '));
    const btn = await G(() => window.__DTTD.game.scene.getScene('Title').muteBtn.visible);
    check(btn === false, 'no overall sound button of its own on the title (the player mutes in YouTube)', String(btn));
  }
  check(!(await ads()).length, 'no pre-roll / no ad at boot');
  const lang = await G(() => window.__DTTD.lang());
  if (['playgama', 'gamepix', 'crazygames', 'youtube'].includes(build)) check(lang === 'de', "the portal's language is used (mock: de)", lang);
  else check(lang === 'en', 'no portal language: the browser language (en)', lang);

  // a level: no ads while playing, after a death or a restart
  await startLevel(1);
  if (build === 'gamepix') check((await calls()).includes('gameStart'), 'gameStart() when the first level starts');
  if (build === 'crazygames') check((await calls()).includes('gameplayStart'), 'gameplayStart() when a level starts');
  // Escape: pauses only where the portal allows it
  await page.keyboard.press('Escape');
  await sleep(150);
  const escPaused = !!(await overlayName());
  const escWant = ['web', 'gamepix', 'y8', 'gamedistribution'].includes(build);
  check(escPaused === escWant, escWant ? 'Escape pauses the game' : build === 'youtube' ? 'Escape does not open the pause menu (it only closes it)' : 'Escape is not used (portal rule)', String(escPaused));
  if (escPaused) {
    await page.keyboard.press(build === 'youtube' ? 'Escape' : 'KeyP');
    await sleep(100);
  }
  if (build === 'youtube') {
    await G(`${scene}.togglePause()`);
    await page.keyboard.press('Escape');
    await sleep(100);
    check(!(await overlayName()), 'Escape closes the pause menu');
  }
  if (escPaused && build !== 'youtube') await G(`(() => { const s = ${scene}; if (s.overlay) s.togglePause(); })()`);
  await sleep(700);
  await G(`${scene}.debugKill()`);
  await sleep(900);
  await G(`${scene}.restartLevel()`);
  await sleep(400);
  check(!(await ads()).length, 'no ad during the level, after a death or on a restart', (await ads()).join(' '));
  if (build === 'playgama') check(!(await calls()).includes('sendMessage:level_failed'), 'a death is not level_failed');

  const p0 = await portal();
  const rewarded = build !== 'web';
  check(p0.rewarded === rewarded, rewarded ? 'rewarded ads supported: the bulb offers an ad' : 'no rewarded ads: the hint is free', JSON.stringify(p0));

  if (!rewarded) {
    await G(() => window.__DTTD.pressHint());
    const s = await st();
    check(s.hintUsed && s.hint && !(await overlayName()), 'the bulb gives the hint at once, no ad card');
  } else {
    // 1. reward confirmed
    await G(`${scene}.restartLevel()`);
    await G(() => window.__DTTD.pressHint());
    check((await overlayName()) === 'hintAd', 'the bulb asks first: "Watch an ad for the hint"');
    const cardText = await G(`${scene}.overlay.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' | ')`);
    const want = await G(() => window.__DTTD.t('ui.hintAd'));
    check(cardText.includes(want), 'the card shows the translated text', cardText);
    const t1 = (await st()).levelTick;
    await sleep(300);
    check((await st()).levelTick === t1, 'the level is paused while the card is open');
    await G(() => (window.__mock.mode = 'ok'));
    await press('hintAdYes');
    await sleep(150);
    const during = await portal();
    const mutedDuring = await G(() => window.__DTTD.audioState ? window.__DTTD.audioState() : null);
    check(during.paused && during.muted, 'paused + muted while the rewarded ad plays', JSON.stringify(during));
    check(mutedDuring === null || mutedDuring.sysMuted === true, 'audio silenced during the ad', JSON.stringify(mutedDuring));
    await page.waitForFunction(() => !window.__mock.adOpen, null, { timeout: 15000 });
    await sleep(200);
    let s = await st();
    const after = await portal();
    check(s.hintUsed && s.hint, 'the hint is given after the SDK confirmed the reward', JSON.stringify({ hintUsed: s.hintUsed, hint: s.hint }));
    check(!after.paused && !after.muted, 'resumed and unmuted after the ad', JSON.stringify(after));
    const as = await G(() => window.__DTTD.audioState());
    check(as.sysMuted === false && as.muted === as.saved, "sound back to the player's own setting", JSON.stringify(as));
    const t2 = s.levelTick;
    await sleep(300);
    check((await st()).levelTick > t2, 'the level runs again');
    await G(() => window.__DTTD.pressHint());
    check(!(await overlayName()), 'still one hint per level: the bulb does nothing after it');

    // 2. failures: no fill, closed early, silent SDK
    // YouTube has no "ad started" signal: the game waits up to 60 s for a silent request (not run here)
    for (const mode of build === 'youtube' ? ['fail', 'noreward'] : ['fail', 'noreward', 'hang']) {
      await startLevel(2);
      await G((m) => (window.__mock.mode = m), mode);
      await G(() => window.__DTTD.pressHint());
      await press('hintAdYes');
      const tStart = Date.now();
      await page.waitForFunction(`(() => { const s = ${scene}; return !s.overlay; })()`, null, { timeout: 12000 }).catch(() => {});
      await sleep(150);
      s = await st();
      const pp = await portal();
      const box = await G(`(() => { const s = ${scene}; return s.hintBox ? s.hintBox.name : null; })()`);
      check(!s.hintUsed && !pp.paused && !pp.muted && box === 'adNone', `${mode}: no hint, "No ad available right now, try again later", game resumed${mode === 'hang' ? ` (timeout after ${((Date.now() - tStart) / 1000).toFixed(1)} s)` : ''}`, JSON.stringify({ hintUsed: s.hintUsed, pp, box }));
      await G(() => window.__DTTD.pressHint());
      check((await overlayName()) === 'hintAd', `${mode}: the hint can be tried again`);
      await press('hintAdNo');
    }
    check(!(await calls()).some((c) => /^(showInterstitial|interstitial|requestAd:midgame|showAd:next|showAd:browse|showAd$|requestInterstitialAd)/.test(c)), 'no interstitial anywhere so far');
  }

  // interstitial on the level-clear card only
  await G(() => (window.__mock ? (window.__mock.mode = 'ok') : 0));
  if (build === 'gamepix') {
    await startLevel(1);
    await G(`${scene}.debugWin()`);
    await page.waitForFunction(`(() => !!${scene}.overlay)()`, null, { timeout: 15000 });
    const n0 = (await ads()).filter((c) => c === 'interstitial').length;
    await press('clearNext');
    await page.waitForFunction(() => window.__DTTD.state()?.level === 2, null, { timeout: 15000 });
    check((await ads()).filter((c) => c === 'interstitial').length === n0, 'GamePix: no interstitial in the first 2 minutes');
    await G(() => { const o = Date.now; Date.now = () => o() + 125000; });
  }
  const inter = (c) => /^(showInterstitial|interstitial$|requestAd:midgame|showAd:next|showAd:browse|showAd$|requestInterstitialAd)/.test(c);
  const noMenuAd = build === 'crazygames';
  for (const [lvl, btn] of [[3, 'clearNext'], [4, 'clearLevels']]) {
    await startLevel(lvl);
    await G(`${scene}.debugWin()`);
    await page.waitForFunction(`(() => !!${scene}.overlay)()`, null, { timeout: 15000 });
    const n0 = (await calls()).filter(inter).length;
    await press(btn);
    if (build !== 'web') {
      await sleep(150);
      if (!(build === 'gamepix' && btn === 'clearLevels') && !(noMenuAd && btn === 'clearLevels')) {
        const pp = await portal();
        check(pp.paused && pp.muted, `${btn}: paused + muted during the interstitial`, JSON.stringify(pp));
      }
    }
    if (btn === 'clearNext') await page.waitForFunction((l) => window.__DTTD.state()?.level === l + 1 && window.__DTTD.state()?.state === 'play', lvl, { timeout: 15000 });
    else await page.waitForFunction(() => window.__DTTD.activeScenes().includes('Select'), null, { timeout: 15000 });
    const n1 = (await calls()).filter(inter).length;
    if (build === 'web') check(n1 === 0, `${btn} on the level-clear card: no ad on the web build`);
    else if (build === 'gamepix' && btn === 'clearLevels') check(n1 === n0, 'GamePix: a second interstitial within 2 minutes is skipped');
    else if (noMenuAd && btn === 'clearLevels') check(n1 === n0, 'CrazyGames: no midgame on a menu / navigation button (Levels)');
    else check(n1 === n0 + 1, `${btn} on the level-clear card: exactly one interstitial, then the game goes on`, `${n0} → ${n1}`);
  }
  if (build === 'crazygames') {
    check(!(await calls()).includes('happytime') && (await calls()).includes('gameplayStop'), 'no happytime() on an ordinary clear; gameplayStop() when leaving a level');
    const n = await G(() => window.__DTTD.levels ?? 20);
    await startLevel(n);
    await G(`${scene}.debugWin()`);
    await page.waitForFunction(`(() => !!${scene}.overlay)()`, null, { timeout: 15000 });
    check((await calls()).filter((c) => c === 'happytime').length === 1, 'happytime() once the whole game is finished (last level)');
  }

  // failed interstitial: never stuck
  if (build !== 'web' && build !== 'gamepix') {
    await G(() => (window.__mock.mode = 'fail'));
    await startLevel(5);
    await G(`${scene}.debugWin()`);
    await page.waitForFunction(`(() => !!${scene}.overlay)()`, null, { timeout: 15000 });
    await press('clearNext');
    const ok = await page.waitForFunction(() => window.__DTTD.state()?.level === 6 && window.__DTTD.state()?.state === 'play', null, { timeout: 15000 }).then(() => true, () => false);
    check(ok && !(await portal()).paused, 'a failed interstitial: the next level starts anyway, not paused');
  }

  // level failed only from the pause menu; Playgama lifecycle order
  await startLevel(7);
  await G(`${scene}.togglePause()`);
  await press('pauseLevels');
  await page.waitForFunction(() => window.__DTTD.activeScenes().includes('Select'), null, { timeout: 15000 });
  if (build === 'playgama') {
    const life = (await calls()).filter((c) => /^sendMessage:/.test(c)).map((c) => c.slice(12));
    check(life[0] === 'game_ready', 'game_ready before every level message', life.slice(0, 3).join(' '));
    check(life[life.length - 1] === 'level_failed' && life.filter((m) => m === 'level_failed').length === 1, 'level_failed only when the player quits from the pause menu', life.join(' '));
    check(life.includes('level_completed') && life.includes('level_started'), 'level_started / level_completed sent');
  }

  // portal pause event + hidden page
  await startLevel(1);
  if (build === 'playgama' || build === 'gamepix' || build === 'youtube') {
    if (build === 'playgama') await G(() => window.__mock.fire('pause_state_changed', true));
    else await G(() => window.__mock.fire('pause'));
    const a = await portal();
    const t1 = (await st()).levelTick;
    await sleep(300);
    check(a.paused && a.muted && (await st()).levelTick === t1, "the portal's pause event pauses + mutes the game", JSON.stringify(a));
    if (build === 'playgama') await G(() => window.__mock.fire('pause_state_changed', false));
    else await G(() => window.__mock.fire('resume'));
    check(!(await portal()).paused, 'and its resume event resumes it');
  }
  if (build === 'playgama' || build === 'crazygames' || build === 'gamepix' || build === 'youtube') {
    if (build === 'youtube') await G(() => window.__mock.fire('audio', false));
    if (build === 'playgama') await G(() => window.__mock.fire('audio_state_changed', false));
    if (build === 'gamepix') await G(() => window.__mock.fire('soundOff'));
    if (build === 'crazygames') await G(() => window.__mock.fire('settings', { muteAudio: true }));
    const as = await G(() => window.__DTTD.audioState());
    check(as.sysMuted && !(await portal()).paused, "the portal's sound switch mutes the game (without pausing it)", JSON.stringify(as));
    if (build === 'youtube') await G(() => window.__mock.fire('audio', true));
    if (build === 'playgama') await G(() => window.__mock.fire('audio_state_changed', true));
    if (build === 'gamepix') await G(() => window.__mock.fire('soundOn'));
    if (build === 'crazygames') await G(() => window.__mock.fire('settings', { muteAudio: false }));
    check(!(await G(() => window.__DTTD.audioState())).sysMuted, 'and back on');
  }
  await G(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hp = await portal();
  if (build === 'web') check(!hp.paused, 'web: unchanged (no portal pause)');
  else if (build === 'youtube') check(!hp.paused, 'YouTube: the Page Visibility API is not used (only onPause / onResume pause the game)');
  else check(hp.paused && hp.muted, 'a hidden page pauses + mutes the game', JSON.stringify(hp));
  await G(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(!(await portal()).paused, 'visible again: resumed');

  // saves
  const store = await G(() => (window.__mock ? Object.keys(window.__mock.store) : []));
  const ls = await G(() => localStorage.getItem('dttd-save-v1'));
  if (build === 'playgama' || build === 'crazygames' || build === 'youtube') {
    const v = await G(() => window.__mock.store['dttd-save-v1']);
    check(store.includes('dttd-save-v1') && JSON.parse(v).completed['3'] === true && !ls, "progress saved in the portal's storage (same format), not in localStorage", `store: ${store.join(',')}, localStorage: ${ls ? 'set' : 'empty'}`);
  } else check(ls && JSON.parse(ls).completed['3'] === true, 'progress saved in localStorage');

  if (build === 'youtube') {
    const v = await G(() => JSON.parse(window.__mock.store['dttd-save-v1'] || '{}'));
    check(v.lang === null || v.lang === undefined, 'the language is not kept in the save', JSON.stringify(v.lang));
  }

  // GameDistribution: the pre-roll on the Play button, once per session
  if (build === 'gamedistribution') {
    await G(() => (window.__mock.mode = 'ok'));
    await G(() => window.__DTTD.scene('Title'));
    await page.waitForFunction(() => window.__DTTD.activeScenes().includes('Title'), null, { timeout: 10000 });
    const pre = async () => (await calls()).filter((c) => c === 'showAd').length;
    const playTitle = () => G(() => { const s = window.__DTTD.game.scene.getScene('Title'); const b = s.children.getByName('play'); b.emit('pointerdown'); b.emit('pointerup'); });
    const n0 = await pre();
    await playTitle();
    await sleep(150);
    const pp = await portal();
    check((await pre()) === n0 + 1 && pp.paused && pp.muted, 'Play on the title: the pre-roll (gdsdk.showAd()), game paused + muted during it', JSON.stringify(pp));
    await page.waitForFunction(() => window.__DTTD.activeScenes().includes('Game'), null, { timeout: 15000 });
    await G(() => window.__DTTD.scene('Title'));
    await page.waitForFunction(() => window.__DTTD.activeScenes().includes('Title'), null, { timeout: 10000 });
    await playTitle();
    await page.waitForFunction(() => window.__DTTD.activeScenes().includes('Game'), null, { timeout: 15000 });
    check((await pre()) === n0 + 1, 'the pre-roll only once per session');
  }

  check(!external.length, build === 'web' ? 'web: no request outside the build at all' : 'no request outside the build except the portal SDK', external.join(', '));
  check(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  results.push({ build, checks });
  await browser.close();
  server.close();
}

for (const b of builds) {
  if (!existsSync(`${ROOT}/${b === 'web' ? 'dist' : `dist-${b}`}/index.html`)) {
    console.log(`${b}: build missing (npm run build${b === 'web' ? '' : `:${b}`})`);
    failed++;
    continue;
  }
  await run(b);
}
mkdirSync(`${ROOT}/test-results`, { recursive: true });
writeFileSync(`${ROOT}/test-results/portals${only.length ? `-${only.join('-')}` : ''}.json`, JSON.stringify(results, null, 2));
console.log(failed ? `\nportal tests FAILED: ${failed}` : '\nportal tests: all passed');
process.exit(failed ? 1 : 0);
