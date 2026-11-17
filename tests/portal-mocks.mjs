// Mock portal SDKs for the mocked-SDK tests (tests/portals.mjs). Each one replaces the real SDK script at its CDN URL
// (Playwright route) and records every call in window.__mock.calls. window.__mock.mode picks how the next ad ends:
//   'ok'      the ad plays (~400 ms) and finishes (a rewarded ad grants its reward)
//   'noreward' a rewarded ad is closed early (no reward)
//   'fail'    the ad fails at once (no fill)
//   'hang'    the SDK never answers (the game's own timeout must settle the request)
// window.__mock.fire(name, ...args) fires a portal event (pause / resume / sound) where the portal has one.
const COMMON = `
window.__mock = window.__mock || { calls: [], mode: 'ok', lang: 'de', store: {}, listeners: {}, adOpen: false };
var M = window.__mock;
function log(n, a) { M.calls.push({ n: n, a: a === undefined ? null : a, t: Date.now() }); }
function on(name, fn) { (M.listeners[name] = M.listeners[name] || []).push(fn); }
M.fire = function (name) { var args = [].slice.call(arguments, 1); (M.listeners[name] || []).forEach(function (f) { f.apply(null, args); }); };
`;

export const MOCKS = {
  playgama: `${COMMON}
var E = { INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed', REWARDED_STATE_CHANGED: 'rewarded_state_changed', AUDIO_STATE_CHANGED: 'audio_state_changed', PAUSE_STATE_CHANGED: 'pause_state_changed' };
function ad(kind) {
  var ev = kind === 'rewarded' ? E.REWARDED_STATE_CHANGED : E.INTERSTITIAL_STATE_CHANGED;
  log(kind === 'rewarded' ? 'showRewarded' : 'showInterstitial');
  var mode = M.mode;
  if (mode === 'hang') return;
  if (mode === 'fail') { setTimeout(function () { M.fire(ev, 'failed'); }, 50); return; }
  M.fire(ev, 'loading'); M.fire(ev, 'opened'); M.adOpen = true;
  setTimeout(function () {
    if (kind === 'rewarded' && mode === 'ok') M.fire(ev, 'rewarded');
    M.adOpen = false; M.fire(ev, 'closed');
  }, 400);
}
window.bridge = {
  EVENT_NAME: E,
  initialize: function () { log('initialize'); return Promise.resolve(); },
  platform: { id: 'mock', get language() { return M.lang; }, isAudioEnabled: true,
    sendMessage: function (m) { log('sendMessage', m); return Promise.resolve(); }, on: on },
  advertisement: { isInterstitialSupported: true, isRewardedSupported: true,
    showInterstitial: function () { ad('interstitial'); }, showRewarded: function () { ad('rewarded'); }, on: on },
  storage: {
    get: function (keys) { log('storage.get', keys); return Promise.resolve(keys.map(function (k) { return M.store[k] === undefined ? null : M.store[k]; })); },
    set: function (k, v) { log('storage.set', k); M.store[k] = v; return Promise.resolve(); },
  },
};`,

  gamepix: `${COMMON}
function ad(kind) {
  log(kind);
  var mode = M.mode;
  if (mode === 'hang') return new Promise(function () {});
  if (mode === 'fail') return Promise.resolve({ success: false, message: 'no fill' });
  M.adOpen = true; M.fire('pause');
  return new Promise(function (r) { setTimeout(function () { M.adOpen = false; M.fire('resume'); r({ success: kind === 'interstitial' ? true : mode === 'ok' }); }, 400); });
}
window.GamePix = {
  lifecycle: { loading: function (p) { log('loading', p); }, loaded: function () { log('loaded'); return Promise.resolve(); }, gameStart: function () { log('gameStart'); } },
  events: { on: on },
  ads: { interstitial: function () { return ad('interstitial'); }, reward: function () { return ad('reward'); } },
  lang: function () { log('lang'); return M.lang; },
};`,

  y8: `${COMMON}
var sdk = {
  init: function (app, adc) { log('init', { appId: app.appId, gameId: adc.gameId }); setTimeout(adc.onReady, 10); },
  onAuth: function () { log('onAuth'); },
  showAd: function (o) {
    log('showAd', o.type);
    var mode = M.mode;
    if (mode === 'hang') return new Promise(function () {});
    if (mode === 'fail') { setTimeout(function () { o.adBreakDone && o.adBreakDone({ breakStatus: 'notReady' }); }, 50); return Promise.resolve(); }
    var play = function () {
      o.beforeAd && o.beforeAd(); M.adOpen = true;
      setTimeout(function () {
        if (o.type === 'reward') { if (mode === 'ok') o.adViewed && o.adViewed(); else o.adDismissed && o.adDismissed(); }
        M.adOpen = false; o.afterAd && o.afterAd(); o.adBreakDone && o.adBreakDone({ breakStatus: 'viewed' });
      }, 400);
    };
    if (o.type === 'reward') o.beforeReward(play); else play();
    return Promise.resolve();
  },
};
window.y8 = { sdk: function () { return sdk; }, emitReadyEvent: function () { log('emitReadyEvent'); window.dispatchEvent(new Event('y8sdk.ready')); } };
setTimeout(function () { window.dispatchEvent(new Event('y8sdk.ready')); }, 0);`,

  crazygames: `${COMMON}
window.CrazyGames = { SDK: {
  environment: 'crazygames',
  init: function () { log('init'); return Promise.resolve(); },
  game: {
    gameplayStart: function () { log('gameplayStart'); }, gameplayStop: function () { log('gameplayStop'); },
    loadingStart: function () { log('loadingStart'); }, loadingStop: function () { log('loadingStop'); },
    happytime: function () { log('happytime'); },
    settings: { muteAudio: false },
    addSettingsChangeListener: function (cb) { on('settings', cb); },
  },
  ad: { requestAd: function (type, cb) {
    log('requestAd', type);
    var mode = M.mode;
    if (mode === 'hang') return;
    if (mode === 'fail') { setTimeout(function () { cb.adError && cb.adError({ code: 'unfilled' }); }, 50); return; }
    cb.adStarted && cb.adStarted(); M.adOpen = true;
    setTimeout(function () { M.adOpen = false; if (type === 'rewarded' && mode === 'noreward') cb.adError && cb.adError({ code: 'closed' }); else cb.adFinished && cb.adFinished(); }, 400);
  } },
  data: { getItem: function (k) { return M.store[k] === undefined ? null : M.store[k]; }, setItem: function (k, v) { log('data.setItem', k); M.store[k] = v; } },
  user: { systemInfo: { get locale() { return M.lang; } } },
} };`,
};
