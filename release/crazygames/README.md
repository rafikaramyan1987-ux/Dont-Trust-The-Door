# Don't Trust the Door — CrazyGames

Upload `dont-trust-the-door-crazygames.zip` (this folder). The images and videos for the form are in
[`../store/crazygames/`](../store/crazygames/), shared ones in [`../store/icon/`](../store/icon/) and
[`../store/screenshots/`](../store/screenshots/). Rebuild with `npm run release -- crazygames`.

| Form field | File / value |
|---|---|
| Game files (zip) | `dont-trust-the-door-crazygames.zip` (`index.html` at the root, relative paths; well under the 50 MB initial download and 1500 files) |
| Cover landscape 16:9 (1920×1080) | `../store/crazygames/cover-1920x1080.png` |
| Cover portrait 2:3 (800×1200) | `../store/crazygames/cover-800x1200.png` |
| Cover square 1:1 (800×800) | `../store/crazygames/cover-800x800.png` |
| Preview video landscape 1080p 16:9 | `../store/crazygames/video-landscape-1920x1080.mp4` (19 s, no sound, starts on the cover) |
| Preview video portrait 1080p 2:3 | `../store/crazygames/video-portrait-1080x1620.mp4` (19 s, no sound, starts on the cover) |
| Description / controls | listing texts below |
| Category | Platformer |
| Orientation | landscape (desktop and mobile) |

## Listing texts

All texts, in English and French, are in [`../store/text/listing-en.md`](../store/text/listing-en.md) and
[`../store/text/listing-fr.md`](../store/text/listing-fr.md) (also `listing.json`):
title, short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

- **Title:** Don't Trust the Door
- **Short description:** A cute troll platformer: 20 levels, 241 traps. The floor, the coins, the springs and even the EXIT door lie to you. Die, laugh, try again.
- **Controls (keyboard):** Move: Left / Right arrows or A / D. Jump: Up arrow, W, Space, Z or K. Restart the level: R. Pause: P. Sound on / off: M. Next / confirm: Enter.
- **Controls (touch):** Move: the ◀ and ▶ buttons at the bottom left. Jump: the ▲ button at the bottom right (hold for a higher jump). On-screen buttons for restart, pause, sound and the hint (bulb).

## Integration (CrazyGames rules)

- SDK v3 `https://sdk.crazygames.com/crazygames-sdk-v3.js` in `<head>`; `await SDK.init()`; `loadingStart` /
  `loadingStop` around the boot; `gameplayStart` / `gameplayStop` around levels and the pause menu (never on a lost
  focus); `happytime()` only when the whole game is finished.
- `requestAd('midgame')` only at the level transition (Next on the level-clear card), never on menu buttons; the SDK
  paces it. `requestAd('rewarded')` for the hint, granted only on `adFinished`. Mute + pause from `adStarted` to
  `adFinished` / `adError`; `settings.muteAudio` is honoured; saves in the data module; language from
  `systemInfo.locale` (English otherwise); Escape is not used.
- Enable "Progress Save / Data Module" in the submission form (the game saves through `SDK.data`).
- Checked by `scripts/crazygames/check.mjs`.
