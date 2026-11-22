// Checks of the GamePix zip: the shared checks (index.html at the root, relative paths, size, only GamePix's SDK origin,
// no other portal), then GamePix's: window.GamePixConfig = { lifecycle: 'manual' } before the SDK v3 script, both first
// in <head> before the game bundle; loading / loaded / gameStart, pause / resume, interstitial / reward in the code;
// the icon and cover. Usage: node scripts/gamepix/check.mjs [--no-media]
import { checker, commonChecks, mediaChecks, SDK } from '../lib/portal.mjs';

const c = checker('GamePix zip checks');
const { html, code } = commonChecks(c, 'gamepix', { maxMB: 50 });
const head = html.slice(0, html.search(/<\/head>/i));
const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
c.check(!/window\.GamePixConfig\s*=\s*\{\s*lifecycle:\s*'manual'\s*\}/.test(scripts[0]?.[2] ?? ''), "the first script does not set window.GamePixConfig = { lifecycle: 'manual' }", "first script: window.GamePixConfig = { lifecycle: 'manual' }");
c.check(scripts[1]?.[1].trim() !== `src="${SDK.gamepix}"`, `the second script is not <script src="${SDK.gamepix}">`, 'second script: the GamePix SDK v3, loaded before the game bundle');
c.check(html.indexOf(SDK.gamepix) > html.search(/<script type="module"/), 'the SDK comes after the game bundle', 'the game bundle comes after the SDK');
for (const [needle, what] of [
  ['lifecycle.loading', 'loading(0..100)'],
  ['lifecycle.loaded', 'loaded()'],
  ['lifecycle.gameStart', 'gameStart()'],
  ['ads.interstitial', 'ads.interstitial()'],
  ['ads.reward', 'ads.reward()'],
  ['"pause"', 'pause event'],
  ['"resume"', 'resume event'],
  ['visibilitychange', 'hidden-page pause'],
]) c.check(!code.includes(needle), `${what} missing from the game code`, `${what} in the game code`);
if (!process.argv.includes('--no-media'))
  mediaChecks(c, 'submission-gamepix', [
    ['icon-256x256.png', 256, 256, 1 << 20],
    ['cover-1360x850.png', 1360, 850, 5 << 20],
  ]);
c.done();
