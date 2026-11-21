# Don't Trust the Door — YouTube Playables

Upload `dont-trust-the-door-youtube.zip` (this folder). The images and videos for the form are in
[`../store/youtube/`](../store/youtube/), shared ones in [`../store/icon/`](../store/icon/) and
[`../store/screenshots/`](../store/screenshots/). Rebuild with `npm run release -- youtube`.

| Form field | File / value |
|---|---|
| Game files (zip, entry point index.html) | `dont-trust-the-door-youtube.zip` |
| Thumbnail 1:1 | `../store/youtube/thumbnail-1x1-1080x1080.png` |
| Thumbnail 5:7 | `../store/youtube/thumbnail-5x7-1000x1400.png` |
| Thumbnail 16:9 | `../store/youtube/thumbnail-16x9-1920x1080.png` |
| Title / description | listing texts below (no branding in thumbnails, title or description) |
| Genre | Platformer / Arcade |
| Age rating | IARC rating: to be filled in by the owner in the developer portal |

## Listing texts

All texts, in English and French, are in [`../store/text/listing-en.md`](../store/text/listing-en.md) and
[`../store/text/listing-fr.md`](../store/text/listing-fr.md) (also `listing.json`):
title, short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

- **Title:** Don't Trust the Door
- **Short description:** A cute troll platformer: 20 levels, 241 traps. The floor, the coins, the springs and even the EXIT door lie to you. Die, laugh, try again.
- **Controls (keyboard):** Move: Left / Right arrows or A / D. Jump: Up arrow, W, Space, Z or K. Restart the level: R. Pause: P. Sound on / off: M. Next / confirm: Enter.
- **Controls (touch):** Move: the ◀ and ▶ buttons at the bottom left. Jump: the ▲ button at the bottom right (hold for a higher jump). On-screen buttons for restart, pause, sound and the hint (bulb).

## Integration (YouTube Playables rules)

- The exact thumbnail pixel sizes are only in YouTube's private developer portal; the three aspect ratios above are
  the ones its documentation names. Check them when uploading.
- `https://www.youtube.com/game_api/v1` is the first script; `firstFrameReady()` on the loading screen, `gameReady()`
  once the title can be used.
- Pause / resume only from `ytgame.system.onPause` / `onResume` (the whole loop stops; the Page Visibility API is not
  used); sound follows `isAudioEnabled()` / `onAudioEnabledChange()` and the game has no overall sound button of its own.
- Saves only through `loadData()` (awaited at boot) / `saveData()`; the language from `getLanguage()` and never kept in
  the save; `requestInterstitialAd()` at the level-clear card, `requestRewardedAd('hint-for-current-level')` for the
  hint (granted only when it returns true); Escape only closes the pause menu.
- Every aspect ratio from 9:32 to 32:9 works: portrait phones get the level on top and the touch buttons below.
- No request outside the zip except the SDK; file names `[a-zA-Z0-9-._]`; well under the 30 MiB initial bundle.
- Checked by `scripts/youtube/check.mjs`.
