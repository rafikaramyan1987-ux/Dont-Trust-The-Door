// Checks of the Playgama zip. The shared checks (index.html at the root, relative Latin paths, size, only the Bridge
// CDN origin, no other portal), then Playgama's lessons:
//  - the first script in <head> is Playgama's CDN Bridge (https://bridge.playgama.com/v2/stable/playgama-bridge.js),
//    loaded normally (not async / defer / module); no Bridge copy in the zip,
//  - the second is the inline boot that calls bridge.initialize() and logs a failure with console.error,
//  - the game bundle is held (<script type="text/plain" data-playgama-game>) until initialize() has settled,
//  - the game code sends platform.sendMessage('game_ready'), reads platform.language, uses Bridge storage,
//    listens to PAUSE_STATE_CHANGED / AUDIO_STATE_CHANGED, shows interstitial and rewarded ads,
//  - playgama-bridge-config.json beside index.html, valid JSON,
//  - Playgama's own precheck (scripts/playgama/precheck.mjs, vendored from Playgama's playgama-publish skill): no FAIL;
//    its WARNs must be the two explained ones (Phaser's licence-comment URLs; localStorage as the fallback store when
//    Bridge storage is not available).
// The QA Tool harness (?platform_id=qa_tool, the initialize handshake, game_ready) is scripts/playgama/qa.mjs.
// Usage: node scripts/playgama/check.mjs [--no-media]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, commonChecks, mediaChecks, SDK } from '../lib/portal.mjs';

const c = checker('Playgama zip checks');
const { dir, html, code, entries } = commonChecks(c, 'playgama', { maxMB: 300 });
const head = html.slice(0, html.search(/<\/head>/i));
const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1], body: m[2], tag: `<script${m[1]}>` }));
const [first, second] = scripts;
c.check(first?.attrs.trim() !== `src="${SDK.playgama}"`, `the first script in <head> is not a plain <script src="${SDK.playgama}">: ${first?.tag}`, `Bridge from Playgama's CDN is the first script in <head>, loaded normally: ${first?.tag}`);
c.check(second?.attrs.trim() !== '' || !/window\.bridge\.initialize\(\)/.test(second?.body ?? ''), 'the second script is not the inline boot calling bridge.initialize()', 'bridge.initialize() is called right after it, in a classic inline script (boot.js)');
c.check(!/console\.error\(/.test(second?.body ?? ''), 'a failed bridge.initialize() would be silent', 'a failed bridge.initialize() is logged with console.error');
const modules = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>/gi)];
const held = [...html.matchAll(/<script type="text\/plain" data-playgama-game data-src="\.\/[^"]+"><\/script>/g)];
c.check(modules.length || !held.length, `the game bundle can run before bridge.initialize() settles (module scripts: ${modules.length}, held: ${held.length})`, `the game bundle is held until bridge.initialize() has settled (${held.length} held script)`);
c.check(entries.some((e) => /playgama-bridge[^/]*\.js$/.test(e)), 'a playgama-bridge.js is shipped in the zip', 'no Bridge copy in the zip (Bridge comes from the CDN)');
for (const [re, what] of [
  [/["'`]game_ready["'`]/, "sendMessage('game_ready')"],
  [/["'`]level_started["'`]/, "sendMessage('level_started')"],
  [/["'`]level_completed["'`]/, "sendMessage('level_completed')"],
  [/["'`]level_failed["'`]/, "sendMessage('level_failed')"],
  [/platform\.language/, 'platform.language'],
  [/storage\.get\(/, 'Bridge storage.get'],
  [/storage\.set\(/, 'Bridge storage.set'],
  [/PAUSE_STATE_CHANGED/, 'PAUSE_STATE_CHANGED listener'],
  [/AUDIO_STATE_CHANGED/, 'AUDIO_STATE_CHANGED listener'],
  [/showInterstitial\(/, 'showInterstitial()'],
  [/showRewarded\(/, 'showRewarded()'],
  [/isRewardedSupported/, 'isRewardedSupported (the hint stays free without rewarded ads)'],
]) c.check(!re.test(code), `${what} missing from the game code`, `${what} in the game code`);
try {
  JSON.parse(readFileSync(join(dir, 'playgama-bridge-config.json'), 'utf8'));
  c.check(false, '', 'playgama-bridge-config.json beside index.html, valid JSON');
} catch (e) {
  c.check(true, `playgama-bridge-config.json missing or invalid: ${e.message}`, '');
}
console.log("  Playgama's precheck (scripts/playgama/precheck.mjs):");
const pre = spawnSync(process.execPath, ['scripts/playgama/precheck.mjs', dir], { encoding: 'utf8' });
const lines = pre.stdout.split('\n').filter((l) => /^(ok|warn|FAIL|note)\s/.test(l) || /^\s{13}\S/.test(l));
console.log(lines.map((l) => `      ${l}`).join('\n'));
c.check(pre.status !== 0, "Playgama's precheck reports FAIL", "Playgama's precheck: no FAIL");
const EXPLAINED = [/^warn\s+1\.2\.5\s/, /^warn\s+3\.2\.1\s+localStorage/];
const warns = lines.filter((l) => /^warn\s/.test(l));
const unexplained = warns.filter((w) => !EXPLAINED.some((re) => re.test(w)));
c.check(unexplained.length, `unexplained precheck WARN: ${unexplained.join(' | ')}`, `precheck WARNs: ${warns.length ? 'only the explained ones (licence-comment URLs in Phaser; localStorage fallback)' : 'none'}`);
if (!process.argv.includes('--no-media'))
  mediaChecks(c, 'submission-playgama', [
    ['cover-1920x1080.png', 1920, 1080, 10 << 20],
    ['cover-1080x1920.png', 1080, 1920, 10 << 20],
    ['cover-800x800.png', 800, 800, 10 << 20],
  ]);
c.done();
