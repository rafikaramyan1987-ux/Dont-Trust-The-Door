// Playgama QA Tool harness: runs the Playgama zip the way Playgama's archive check and QA Tool do, inside an iframe
// with `?platform_id=qa_tool`, and plays the QA Tool's side of Bridge's `qa_tool` postMessage protocol (initialize →
// get_player → initialize response → liveness ping; storage get / set). Bridge is loaded from Playgama's CDN exactly as
// in the zip: the only request allowed to leave the local server.
// Fails unless, within the time limit:
//   1. Bridge sends the QA Tool its `platform/initialize` handshake,
//   2. Bridge finishes initializing (the liveness ping after the QA Tool answered),
//   3. the game sends `platform/game_ready` after that, once the title screen is shown, and before any level event,
//   4. bridge.platform.id is qa_tool, no page error, no Bridge initialization error, no other outside request.
// Then the two failure paths (the Bridge script blocked; bridge.initialize() rejecting): each must be logged with
// console.error ("[Playgama Bridge] …") and the game must still reach its title screen.
// Usage: node scripts/playgama/qa.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../lib/serve.mjs';
import { zipPath } from '../lib/portal.mjs';

const BRIDGE_CDN = 'https://bridge.playgama.com/';
const TIMEOUT = 45_000;
const zip = zipPath('playgama');
const dir = mkdtempSync(join(tmpdir(), 'playgama-qa-'));
execFileSync('unzip', ['-q', zip, '-d', dir]);
const server = await serve(dir);
const errors = [];
const fail = (m) => (errors.push(m), console.log(`  ✗ ${m}`));
const ok = (m) => console.log(`  ✓ ${m}`);
const expect = (cond, msg, detail = '') => (cond ? ok(msg) : fail(`${msg}${detail ? ` (${detail})` : ''}`));
const QUERY = encodeURIComponent('?platform_id=qa_tool&test=1');
const titleShown = (frame) => frame.waitForFunction(() => window.__DTTD && window.__DTTD.activeScenes().includes('Title'), null, { timeout: TIMEOUT });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 620 } });
const page = await ctx.newPage();
const external = [];
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
  const u = route.request().url();
  if (u.startsWith(BRIDGE_CDN)) return route.continue();
  external.push(u);
  return route.abort();
});
const transcript = [];
await page.exposeFunction('__qaLog', (dirn, m) => transcript.push({ t: Date.now(), dirn, m }));
await page.addInitScript(() => {
  if (window !== window.top) return;
  const store = {};
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.source !== 'bridge' || !d.type) return;
    window.__qaLog('in', { type: d.type, action: d.action });
    const reply = (extra) => {
      const msg = { type: d.type, action: d.action, ...(d.id ? { id: d.id } : {}), ...extra };
      window.__qaLog('out', { type: msg.type, action: msg.action });
      e.source.postMessage(msg, '*');
    };
    const key = d.options?.key;
    if (d.type === 'platform' && d.action === 'initialize')
      reply({ supportedFeatures: ['isInterstitialSupported', 'isRewardedSupported'], config: { platformLanguage: 'en', deviceType: 'desktop' } });
    else if (d.type === 'player' && d.action === 'get_player') reply({ player: { isAuthorized: false } });
    else if (d.type === 'storage' && d.action === 'get_data_from_storage') reply({ storage: Array.isArray(key) ? Object.fromEntries(key.map((k) => [k, store[k] ?? null])) : { [key]: store[key] ?? null } });
    else if (d.type === 'storage' && d.action === 'set_data_to_storage') {
      const ks = Array.isArray(key) ? key : [key];
      const vs = Array.isArray(key) ? d.options.value : [d.options.value];
      ks.forEach((k, i) => (store[k] = vs[i]));
      if (d.id) reply({});
    } else if (d.type === 'platform' && d.action === 'get_server_time') reply({ time: Date.now() });
    else if (d.id) reply({});
  });
});

const t0 = Date.now();
await page.goto(`${server.origin}/?w=960&h=540&q=${QUERY}`);
const frame = await (await page.waitForSelector('#f')).contentFrame();
const seen = (type, action) => transcript.find((x) => x.dirn === 'in' && x.m.type === type && x.m.action === action);
const until = async (fn) => {
  while (!fn() && Date.now() - t0 < TIMEOUT) await new Promise((r) => setTimeout(r, 100));
  return fn();
};
console.log(`Playgama QA Tool harness: ${zip}`);
console.log(`  iframe: /game/index.html?platform_id=qa_tool (Bridge from ${BRIDGE_CDN})`);
const init = await until(() => seen('platform', 'initialize'));
expect(init, 'Bridge sent the QA Tool its initialize handshake (qa_tool adapter loaded)', 'no platform/initialize message');
const alive = await until(() => seen('liveness', 'ping'));
expect(alive, 'Bridge initialized (liveness ping after the QA Tool answered)');
let booted = true;
try {
  await titleShown(frame);
} catch (e) {
  booted = e.message.split('\n')[0];
}
expect(booted === true, 'the game booted to its title screen', String(booted));
const ready = await until(() => seen('platform', 'game_ready'));
expect(ready, 'game sent platform.sendMessage("game_ready") to the QA Tool');
if (alive && ready) expect(ready.t >= alive.t, 'game_ready only after Bridge finished initializing');
// a level: level_started after game_ready, level_completed on the EXIT
await frame.evaluate(() => {
  window.__DTTD.start(1);
});
await frame.waitForFunction(() => window.__DTTD.state()?.state === 'play');
await frame.evaluate(() => window.__DTTD.game.scene.getScene('Game').debugWin());
await until(() => seen('platform', 'level_completed'));
const life = transcript.filter((x) => x.dirn === 'in' && x.m.type === 'platform' && /^(game_ready|level_)/.test(x.m.action)).map((x) => x.m.action);
expect(life.join(',') === 'game_ready,level_started,level_completed', 'game_ready first, then level_started and level_completed', life.join(' → '));
const id = await frame.evaluate(() => window.bridge?.platform?.id).catch(() => null);
expect(id === 'qa_tool', 'bridge.platform.id is qa_tool', String(id));
const saved = transcript.some((x) => x.dirn === 'in' && x.m.type === 'storage' && x.m.action === 'set_data_to_storage');
expect(saved, 'the save went to Bridge storage (set_data_to_storage)');
const initFailed = consoleErrors.filter((m) => /initialize\(\) failed|INITIALIZATION_FAILED/i.test(m));
expect(!initFailed.length, 'no Bridge initialization error in the console', initFailed.join(' | '));
expect(!pageErrors.length, 'no page errors', pageErrors.join(' | '));
expect(!external.length, `no request outside the build except ${BRIDGE_CDN}`, external.join(', '));
console.log('\n  transcript (game → QA Tool "in", QA Tool → game "out"):');
for (const x of transcript) console.log(`    +${String(x.t - t0).padStart(5)} ms  ${x.dirn.padEnd(3)} ${x.m.type}/${x.m.action}`);
await ctx.close();

const FAILURES = {
  'Bridge script blocked': (route) => route.abort(),
  'bridge.initialize() rejects': (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.bridge = { initialize: () => Promise.reject(new Error("qa harness: initialize rejected")) };' }),
};
for (const [name, handle] of Object.entries(FAILURES)) {
  console.log(`\nfailure path: ${name}`);
  const c = await browser.newContext({ viewport: { width: 1000, height: 620 } });
  const p = await c.newPage();
  const logged = [];
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && logged.push(m.text()));
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => (route.request().url().startsWith(BRIDGE_CDN) ? handle(route) : route.abort()));
  await p.goto(`${server.origin}/?w=960&h=540&q=${QUERY}`);
  const f = await (await p.waitForSelector('#f')).contentFrame();
  let up = true;
  try {
    await titleShown(f);
  } catch (e) {
    up = e.message.split('\n')[0];
  }
  const loud = logged.filter((m) => m.includes('[Playgama Bridge]'));
  expect(loud.length > 0, 'the failure is logged with console.error ([Playgama Bridge] …)', logged.join(' | ') || 'nothing logged');
  expect(up === true, 'the game still boots to its title screen', String(up));
  expect(!errs.length, 'no page errors', errs.join(' | '));
  await c.close();
}
await browser.close();
server.close();
console.log(errors.length ? `\nFAILED: ${errors.length} problem(s)` : '\nPlaygama QA Tool harness: all checks passed');
process.exit(errors.length ? 1 : 0);
