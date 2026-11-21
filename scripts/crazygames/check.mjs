// Checks of the CrazyGames zip: the shared checks (index.html at the root, relative paths, size, only CrazyGames' SDK
// origin, no other portal), the SDK v3 script in <head> before the game bundle, SDK.init / gameplayStart / Stop /
// loadingStart / Stop / requestAd / data in the code. Usage: node scripts/crazygames/check.mjs
import { checker, commonChecks, SDK } from '../lib/portal.mjs';

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
c.done();
