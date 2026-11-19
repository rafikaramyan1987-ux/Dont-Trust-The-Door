// Checks of the CrazyGames zip: the shared checks (index.html at the root, relative paths, size, only CrazyGames' SDK
// origin, no other portal), the SDK v3 script in <head> before the game bundle, SDK.init / gameplayStart / Stop /
// loadingStart / Stop / requestAd / data in the code, and the media. Usage: node scripts/crazygames/check.mjs [--no-media]
import { checker, commonChecks, mediaChecks, SDK } from '../lib/portal.mjs';

const c = checker('CrazyGames zip checks');
const { html, code, files } = commonChecks(c, 'crazygames', { maxMB: 250 });
const head = html.slice(0, html.search(/<\/head>/i));
c.check(!head.includes(`<script src="${SDK.crazygames}"></script>`), `no <script src="${SDK.crazygames}"> in <head>`, 'the CrazyGames SDK v3 in <head>');
c.check(html.indexOf(SDK.crazygames) > html.search(/<script type="module"/), 'the SDK comes after the game bundle', 'the game bundle comes after the SDK');
c.check(files.length > 1500, `${files.length} files: CrazyGames allows at most 1500`, `${files.length} files (CrazyGames allows 1500)`);
for (const [needle, what] of [
  ['gameplayStart', 'gameplayStart()'],
  ['gameplayStop', 'gameplayStop()'],
  ['loadingStart', 'loadingStart()'],
  ['loadingStop', 'loadingStop()'],
  ['"midgame"', 'midgame ads'],
  ['"rewarded"', 'rewarded ads'],
  ['adStarted', 'adStarted'],
  ['adFinished', 'adFinished'],
  ['adError', 'adError'],
  ['happytime', 'happytime()'],
]) c.check(!code.includes(needle), `${what} missing from the game code`, `${what} in the game code`);
if (!process.argv.includes('--no-media'))
  mediaChecks(c, 'submission-crazygames', [
    ['cover-1920x1080.png', 1920, 1080, 10 << 20],
    ['cover-800x1200.png', 800, 1200, 10 << 20],
    ['cover-800x800.png', 800, 800, 10 << 20],
    ['icon-512x512.png', 512, 512, 5 << 20],
    ['trailer-1920x1080.mp4', 1920, 1080, 50 << 20],
    ['trailer-1080x1920.mp4', 1080, 1920, 50 << 20],
  ]);
c.done();
