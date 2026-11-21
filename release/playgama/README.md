# Don't Trust the Door — Playgama

Upload `dont-trust-the-door-playgama.zip` (this folder). The images and videos for the form are in
[`../store/playgama/`](../store/playgama/), shared ones in [`../store/icon/`](../store/icon/) and
[`../store/screenshots/`](../store/screenshots/). Rebuild with `npm run release -- playgama`.

| Form field | File / value |
|---|---|
| Game files (zip) | `dont-trust-the-door-playgama.zip` (`index.html` + `playgama-bridge-config.json` at the root) |
| Cover square 800×800 | `../store/playgama/cover-800x800.png` |
| Cover portrait 1080×1920 | `../store/playgama/cover-1080x1920.png` |
| Cover landscape 1920×1080 | `../store/playgama/cover-1920x1080.png` |
| Screenshots | `../store/screenshots/*-1920x1080.png` (6 levels) |
| Icon | `../store/icon/icon-512x512.png` |
| Title / Description / How to play | listing texts below (each ≥ 100 characters) |
| Game Engine | js |
| Category | arcade (Playgama has no platformer category) |
| Supported devices / orientation | DESKTOP, IOS, ANDROID · landscape |
| Languages | English, French, German, Spanish, Portuguese (Brazil), Italian, Russian, Turkish |

## Listing texts

All texts, in English and French, are in [`../store/text/listing-en.md`](../store/text/listing-en.md) and
[`../store/text/listing-fr.md`](../store/text/listing-fr.md) (also `listing.json`):
title, short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

- **Title:** Don't Trust the Door
- **Short description:** A cute troll platformer: 20 levels, 241 traps. The floor, the coins, the springs and even the EXIT door lie to you. Die, laugh, try again.
- **Controls (keyboard):** Move: Left / Right arrows or A / D. Jump: Up arrow, W, Space, Z or K. Restart the level: R. Pause: P. Sound on / off: M. Next / confirm: Enter.
- **Controls (touch):** Move: the ◀ and ▶ buttons at the bottom left. Jump: the ▲ button at the bottom right (hold for a higher jump). On-screen buttons for restart, pause, sound and the hint (bulb).

## Integration (Playgama rules)

- Playgama Bridge v2 from `https://bridge.playgama.com/v2/stable/playgama-bridge.js`, the first script in `<head>`;
  `bridge.initialize()` before the game bundle loads; `playgama-bridge-config.json` beside `index.html`.
- `game_ready` once the title can be used; `level_started` / `level_completed` / `level_failed`.
- Interstitial (`showInterstitial`) on Next / Levels / Menu of the level-clear card; rewarded (`showRewarded`) for
  the hint, granted only on the `rewarded` state; no timers of the game's own.
- Pause + mute on `PAUSE_STATE_CHANGED` and during ads; `isAudioEnabled` / `AUDIO_STATE_CHANGED`; saves only in
  `bridge.storage`; language only from `bridge.platform.language` (English otherwise); Escape is not used.
- Sound is recorded mp3 files (no sound synthesized in code); in-game sound button.
- Checked by `scripts/playgama/check.mjs` (incl. Playgama's precheck) and the QA Tool harness `scripts/playgama/qa.mjs`.
