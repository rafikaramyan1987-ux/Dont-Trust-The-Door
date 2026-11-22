// Checks of the YouTube Playables zip (https://developers.google.com/youtube/gaming/playables/certification/
// requirements_stability and reference/sdk): the shared checks (index.html at the root, relative paths, only YouTube's
// SDK origin, no other portal), <script src="https://www.youtube.com/game_api/v1"> before any game code, file names
// [a-zA-Z0-9-._] only, ≤ 8000 files, every file < 30 MiB, total < 250 MiB, the initial bundle (everything the game
// loads before gameReady — here all of index.html's scripts / styles / fonts) < 30 MiB (SHOULD < 15 MiB), the SDK
// calls in the code (firstFrameReady, gameReady, onPause / onResume, isAudioEnabled / onAudioEnabledChange,
// loadData / saveData, getLanguage) and no Page Visibility API listener left. Usage: node scripts/youtube/check.mjs
import { statSync } from 'node:fs';
import { checker, commonChecks, SDK } from '../lib/portal.mjs';

const MiB = 1 << 20;
const c = checker('YouTube Playables zip checks');
const { html, code, files, entries, dir } = commonChecks(c, 'youtube', { maxMB: 250 });
const head = html.slice(0, html.search(/<\/head>/i));
const firstScript = head.match(/<script\b[^>]*>/i)?.[0] ?? '';
c.check(firstScript !== `<script src="${SDK.youtube}">`, `the first script in <head> is not <script src="${SDK.youtube}">`, 'the Playables SDK is the first script, before any game code');
const badNames = entries.filter((e) => !/^[a-zA-Z0-9\-._/]+$/.test(e));
c.check(badNames.length, `file names outside [a-zA-Z0-9-._]: ${badNames.join(', ')}`, 'every file name uses only [a-zA-Z0-9-._]');
c.check(files.length > 8000, `${files.length} files (max 8000)`, `${files.length} files (max 8000)`);
const sizes = files.map((f) => [f.slice(dir.length + 1), statSync(f).size]);
const big = sizes.filter(([, s]) => s >= 30 * MiB);
c.check(big.length, `files of 30 MiB or more: ${big.map(([f]) => f).join(', ')}`, `largest file ${(Math.max(...sizes.map(([, s]) => s)) / MiB).toFixed(1)} MiB (< 30 MiB each)`);
const total = sizes.reduce((a, [, s]) => a + s, 0);
c.check(total >= 250 * MiB, `total ${(total / MiB).toFixed(1)} MiB (max 250)`, `total ${(total / MiB).toFixed(1)} MiB (< 250 MiB)`);
const initial = sizes.filter(([f]) => !/^audio\//.test(f)).reduce((a, [, s]) => a + s, 0);
c.check(initial >= 30 * MiB, `initial bundle ${(initial / MiB).toFixed(1)} MiB (max 30)`, `initial bundle ≤ ${(initial / MiB).toFixed(1)} MiB uncompressed (< 30 MiB, SHOULD < 15 MiB)`);
for (const [needle, what] of [
  ['firstFrameReady', 'ytgame.game.firstFrameReady()'],
  ['gameReady', 'ytgame.game.gameReady()'],
  ['onPause', 'ytgame.system.onPause()'],
  ['onResume', 'ytgame.system.onResume()'],
  ['isAudioEnabled', 'ytgame.system.isAudioEnabled()'],
  ['onAudioEnabledChange', 'ytgame.system.onAudioEnabledChange()'],
  ['loadData', 'ytgame.game.loadData()'],
  ['saveData', 'ytgame.game.saveData()'],
  ['getLanguage', 'ytgame.system.getLanguage()'],
  ['requestInterstitialAd', 'ytgame.ads.requestInterstitialAd()'],
  ['requestRewardedAd', 'ytgame.ads.requestRewardedAd()'],
]) c.check(!code.includes(needle), `${what} missing from the game code`, `${what} in the game code`);
c.check(!html.includes('class="portrait-ok"'), 'portrait is not allowed (rotate screen still on)', 'every aspect ratio: no "rotate your phone" screen (body.portrait-ok)');
c.done();
