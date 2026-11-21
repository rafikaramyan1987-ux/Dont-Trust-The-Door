// Checks of the Y8 zip: the shared checks (index.html at the root, relative paths, size, only Y8's CDN, no other
// portal), y8.min.js from https://cdn.y8.com/minimal-sdk/2-0/y8.min.js with `async` in <head>, the SDK snippet
// (y8sdk.ready, emitReadyEvent, the ad callbacks) in the code, the App ID / Game ID. Usage: node scripts/y8/check.mjs
import { checker, commonChecks, SDK } from '../lib/portal.mjs';

const c = checker('Y8 zip checks');
const { html, code } = commonChecks(c, 'y8', { maxMB: 100 });
const head = html.slice(0, html.search(/<\/head>/i));
c.check(!head.includes(`<script src="${SDK.y8}" async></script>`), `no <script src="${SDK.y8}" async> in <head>`, 'y8.min.js from the Y8 CDN, async, in <head>');
for (const [needle, what] of [
  ['y8sdk.ready', '"y8sdk.ready" listener'],
  ['emitReadyEvent', 'emitReadyEvent()'],
  ['beforeAd', 'beforeAd'],
  ['afterAd', 'afterAd'],
  ['adBreakDone', 'adBreakDone'],
  ['beforeReward', 'beforeReward'],
  ['adViewed', 'adViewed'],
  ['visibilitychange', 'visibilitychange pause'],
]) c.check(!code.includes(needle), `${what} missing`, `${what} in the bundle`);
const app = process.env.VITE_Y8_APP_ID || '6aff479cc9841fd9d0e5db3e';
const game = process.env.VITE_Y8_GAME_ID || '294329';
c.check(!code.includes(`"${app}"`) && !code.includes(`'${app}'`), `App ID ${app} is not in the build`, `App ID ${app} in the build`);
c.check(!code.includes(`"${game}"`) && !code.includes(`'${game}'`), `Game ID ${game} is not in the build`, `Game ID ${game} in the build`);
for (const [re, what] of [
  [/appId:\s*\w+,\s*autoLogin:\s*!0|appId:[^,}]+,autoLogin:!0|autoLogin:\s*true/, 'appConfig { appId, autoLogin: true }'],
  [/preloadAdBreaks:\s*["']on["']/, "adConfig preloadAdBreaks: 'on'"],
  [/sound:\s*["']on["']/, "adConfig sound: 'on'"],
]) c.check(!re.test(code), `${what} missing`, `${what} in the bundle`);
c.done();
