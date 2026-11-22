// Checks of the GameDistribution zip (https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation): the
// shared checks (index.html at the root, relative paths, only GD's SDK origin, no other portal), GD_OPTIONS { gameId,
// onEvent } and GD's loader snippet for https://html5.api.gamedistribution.com/main.min.js in <head> before the game,
// the events the game must handle (SDK_GAME_PAUSE: pause + mute, SDK_GAME_START: resume, SDK_REWARDED_WATCH_COMPLETE),
// showAd / preloadAd in the code. The game ID comes from GD's developer panel: a build without one is reported (ads
// only work once it is set: VITE_GD_GAME_ID=<id> npm run release -- gamedistribution). Usage: node scripts/gamedistribution/check.mjs
import { checker, commonChecks, SDK } from '../lib/portal.mjs';

const c = checker('GameDistribution zip checks');
const { html, code } = commonChecks(c, 'gamedistribution', { maxMB: 250 });
const head = html.slice(0, html.search(/<\/head>/i));
c.check(!/window\["GD_OPTIONS"\]\s*=\s*\{/.test(head), 'no window["GD_OPTIONS"] in <head>', 'window["GD_OPTIONS"] = { gameId, onEvent } in <head>');
c.check(!head.includes(`js.src = '${SDK.gamedistribution}'`) || !head.includes("'gamedistribution-jssdk'"), "GD's loader snippet (id gamedistribution-jssdk) is missing", "GD's loader snippet loads main.min.js (id gamedistribution-jssdk)");
c.check(head.indexOf('GD_OPTIONS') > html.search(/<script type="module"/), 'GD_OPTIONS comes after the game bundle', 'GD_OPTIONS and the SDK come before the game bundle');
const id = head.match(/"gameId":\s*"([^"]*)"/)?.[1] ?? '';
if (!id) c.note('no GameDistribution game ID in this build: create the game in GD\'s developer panel, then rebuild with VITE_GD_GAME_ID=<game id> (ads stay off until then; the game plays)');
else c.check(!/^[0-9a-f]{32}$/i.test(id), `gameId "${id}" is not a 32-character GD game hash`, `gameId ${id}`);
for (const [needle, what] of [
  ['SDK_GAME_PAUSE', 'SDK_GAME_PAUSE (pause + mute)'],
  ['SDK_GAME_START', 'SDK_GAME_START (resume)'],
  ['SDK_REWARDED_WATCH_COMPLETE', 'SDK_REWARDED_WATCH_COMPLETE (the reward)'],
  ['showAd', 'gdsdk.showAd()'],
  ['preloadAd', "gdsdk.preloadAd('rewarded')"],
  ['visibilitychange', 'hidden-page pause'],
]) c.check(!code.includes(needle), `${what} missing from the game code`, `${what} in the game code`);
c.done();
