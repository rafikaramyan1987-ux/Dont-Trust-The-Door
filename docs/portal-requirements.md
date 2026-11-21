# Portal requirements (read 2026-11-21)

What each portal's current developer documentation asks for, and how the game's build for it complies. Each portal
gets its own build (`vite build --mode <portal>`, `npm run release`), which loads only that portal's SDK; the web
build (GitHub Pages) loads none. Code: `src/platform/<portal>.ts`; zip checks: `scripts/<portal>/check.mjs`;
browser tests with mocked SDKs: `tests/portals.mjs`, release smoke test: `tests/release.mjs`.

## Playgama — https://wiki.playgama.com/playgama/

| Rule (source) | Build |
|---|---|
| Bridge v2 `https://bridge.playgama.com/v2/stable/playgama-bridge.js` first in `<head>`, not async; `bridge.initialize()` before the game loads; `playgama-bridge-config.json` beside `index.html` (bridge-sdk/setup, config, api) | ✓ (inline boot holds the bundle until initialize settles) |
| `game_ready` when the first playable screen can be used (bridge-sdk/api/platform) | ✓ title screen |
| Interstitial at natural pauses, no own timers; never during play; rewarded only on `rewarded`, button says it is an ad (advertisement/interstitial, rewarded; game-requirements/advertising-requirements) | ✓ level-clear card; hint card |
| Pause + mute during ads, `PAUSE_STATE_CHANGED`, `isAudioEnabled` / `AUDIO_STATE_CHANGED`, sound stops on a hidden page (api/platform; user-experience-requirements 3.3) | ✓ |
| Saves only via `bridge.storage`, never localStorage (api/storage, UX 3.2.1) | ✓ |
| Language from `bridge.platform.language`, never the browser; English default (UX 3.4) | ✓ (`policy.browserLanguage = false`) |
| Recorded ogg/mp3 sound, no sound synthesized in code; in-game mute button (UX 3.3.2, 3.3.3) | ✓ 16 recorded mp3 files (`tools/render-audio.mjs`) |
| Esc must not be used (technical-requirements 1.5) | ✓ (`policy.esc = 'none'`) |
| ZIP with `index.html` at the root, Latin names, ≤ 300 MB (technical-requirements 1.3) | ✓ |
| Covers 800×800, 1080×1920, 1920×1080 PNG/JPEG ≤ 10 MB; title, description and how-to-play ≥ 100 characters; one category (mcp/tools, submitting-a-game) | ✓ `release/store/playgama/` (category: arcade — there is no platformer) |

## GamePix — https://integration.gamepix.com/sdk/v3/gamepix.sdk.js

docs.gamepix.com and www.gamepix.com refuse automated access (Cloudflare 403), so only the public SDK file could be
read. The build follows its API: `GamePixConfig = { lifecycle: 'manual' }`, `loading()`, `loaded()`, `gameStart()`,
`updateLevel()`, `happyMoment()`, `ads.interstitial()` / `ads.reward()` (`{ success }`), pause / resume and
soundOff / soundOn events. Store image sizes, size limits and text limits: not readable — the cover 1360×850 and
icon 256×256 are the sizes its form used before; please check them in the form.

## CrazyGames — https://docs.crazygames.com/

| Rule (source) | Build |
|---|---|
| SDK v3 `https://sdk.crazygames.com/crazygames-sdk-v3.js` in `<head>`, `await SDK.init()` (sdk/intro) | ✓ |
| `loadingStart` / `loadingStop`; `gameplayStart` when playable, `gameplayStop` on every break, not on focus loss; `happytime` sparingly (sdk/game) | ✓ (pause menu stops gameplay; happytime only at the end of the game) |
| Midgame only at logical breaks, never on navigation buttons; mute + pause from `adStarted` to `adFinished` / `adError`; reward only on `adFinished`; playable with an adblocker (sdk/video-ads, requirements/ads) | ✓ (Next only) |
| `settings.muteAudio` honoured; data module for saves; `systemInfo.locale`, English mandatory; avoid Escape (sdk/game, sdk/data, requirements/gameplay, quality) | ✓ |
| ≤ 50 MB initial download, ≤ 1500 files, relative paths (requirements/technical) | ✓ |
| Covers 1920×1080, 800×1200, 800×800 (only the title as text); videos landscape 1080p 16:9 and portrait 1080p 2:3, 15–20 s, no sound, start on the cover (requirements/game-covers) | ✓ `release/store/crazygames/` |

## Y8 — https://docs.y8.com/

| Rule (source) | Build |
|---|---|
| `https://cdn.y8.com/minimal-sdk/2-0/y8.min.js` async; `y8sdk.ready` + `emitReadyEvent()`; `init({ appId, autoLogin }, { gameId, preloadAdBreaks, sound, onReady })` (sdk/intro) | ✓ App ID 6aff479cc9841fd9d0e5db3e, Game ID 294329 |
| `showAd({ type })` (`adBreak` throws); interstitials only on player clicks (Play / Next / Retry), never automatic; reward only on `adViewed`; pause + mute in `beforeAd` (sdk/advertising, ad-placement-guidelines) | ✓ `next` on Next, `browse` on Levels / Menu |
| Pause + mute on `visibilitychange` and window `blur`; saves progress; playable with ad blockers; no external links (studio/game-requirements) | ✓ |
| Media: screenshots 760×570 and 1280×720, promos 1920×1080, 1080×1920, 760×570, gameplay video 16:9 ≥ 1280×720 ≥ 15 s (studio/media) | ✓ `release/store/y8/` |

## GameDistribution — https://github.com/GameDistribution/GD-HTML5/wiki (shown at gamedistribution.com/developers/sdk/html5)

| Rule (source) | Build |
|---|---|
| `window["GD_OPTIONS"] = { gameId, onEvent }` + GD's loader for `https://html5.api.gamedistribution.com/main.min.js` before the game (SDK-Implementation) | ✓ (game ID from `VITE_GD_GAME_ID`) |
| `SDK_GAME_PAUSE` → pause + mute, `SDK_GAME_START` → resume (mandatory) (SDK-Implementation) | ✓ |
| Pre-roll on Start / Play and mid-rolls on Replay / Next / Menu; ads only on user input, outside gameplay (SDK-Implementation) | ✓ |
| Rewarded: `preloadAd('rewarded')`, `showAd('rewarded')`, reward only on `SDK_REWARDED_WATCH_COMPLETE`; "Rewarded Ads" flag in the panel (Rewarded-Ads) | ✓ (flag: owner) |
| No other ads, no tracking, no outgoing links; English required (gamedistribution.com/developers/quality-guidelines) | ✓ |
| Thumbnails JPG 512×384, 512×512, 200×120 (+1280×720, 1280×550); title ≤ 20 characters; ≤ 5 tags; description 100–500 words (quality-guidelines) | ✓ `release/store/gamedistribution/` |

## YouTube Playables — https://developers.google.com/youtube/gaming/playables

| Rule (source) | Build |
|---|---|
| `https://www.youtube.com/game_api/v1` before any game code; `ytgame` never overridden (reference/getting_started, sdk) | ✓ |
| `firstFrameReady()` on the loading screen, then `gameReady()` when interactive (certification/requirements_integration §2) | ✓ |
| Pause everything on `onPause`, resume on `onResume`; never the Page Visibility API (§6) | ✓ (loop sleeps; visibility listeners are not installed in this build) |
| Audio from `isAudioEnabled` / `onAudioEnabledChange`; no overall mute button of the game's own; sound must not wait for a gesture (§5, certification_faq) | ✓ |
| Saves only with `loadData` (awaited first) / `saveData` after progress; language from `getLanguage()`, never `navigator.language`, not stored in the save (§4, requirements_i18n_l10n) | ✓ |
| Interstitials at natural transitions, rewarded strictly opt-in, reward only when `requestRewardedAd` returns true (requirements_monetization) | ✓ |
| Every aspect ratio 9:32–32:9, resize live, no orientation lock, touch and mouse for everything; Esc never blocked (requirements_design) | ✓ portrait layout (body.portrait-ok) |
| No external requests; initial bundle < 30 MiB, files < 30 MiB, ≤ 8000 files, names `[a-zA-Z0-9-._]` (requirements_privacydata, requirements_stability) | ✓ |
| Thumbnails in each aspect ratio, title, description, genre, IARC rating (developer_portal) | thumbnails 1:1, 5:7, 16:9 in `release/store/youtube/`; exact pixel sizes and the IARC rating are in the private developer portal (owner) |
