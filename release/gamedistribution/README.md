# Don't Trust the Door — GameDistribution

Upload `dont-trust-the-door-gamedistribution.zip` (this folder). The images and videos for the form are in
[`../store/gamedistribution/`](../store/gamedistribution/), shared ones in [`../store/icon/`](../store/icon/) and
[`../store/screenshots/`](../store/screenshots/). Rebuild with `npm run release -- gamedistribution`.

| Form field | File / value |
|---|---|
| Game files (zip) | `dont-trust-the-door-gamedistribution.zip` (`index.html` at the root) |
| Thumbnail 512×384 (JPG, mandatory) | `../store/gamedistribution/thumb-512x384.jpg` |
| Thumbnail 512×512 (JPG, mandatory) | `../store/gamedistribution/thumb-512x512.jpg` |
| Thumbnail 200×120 (JPG, mandatory) | `../store/gamedistribution/thumb-200x120.jpg` |
| Thumbnail 1280×720 / 1280×550 | `../store/gamedistribution/thumb-1280x720.jpg`, `thumb-1280x550.jpg` |
| Title (≤ 20 characters recommended) | Don't Trust the Door (20) |
| Description (100–500 words) | long description below |
| Tags (max 5) | platformer, troll, funny, traps, puzzle |
| Rewarded ads flag | tick it in the developer panel (the hint uses a rewarded ad) |

## Listing texts

All texts, in English and French, are in [`../store/text/listing-en.md`](../store/text/listing-en.md) and
[`../store/text/listing-fr.md`](../store/text/listing-fr.md) (also `listing.json`):
title, short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

- **Title:** Don't Trust the Door
- **Short description:** A cute troll platformer: 20 levels, 241 traps. The floor, the coins, the springs and even the EXIT door lie to you. Die, laugh, try again.
- **Controls (keyboard):** Move: Left / Right arrows or A / D. Jump: Up arrow, W, Space, Z or K. Restart the level: R. Pause: P. Sound on / off: M. Next / confirm: Enter.
- **Controls (touch):** Move: the ◀ and ▶ buttons at the bottom left. Jump: the ▲ button at the bottom right (hold for a higher jump). On-screen buttons for restart, pause, sound and the hint (bulb).

## Integration (GameDistribution rules)

- **Game ID needed:** create the game in GameDistribution's developer panel, copy its game ID ("game hash"), then
  rebuild: `VITE_GD_GAME_ID=<game id> npm run release -- gamedistribution`. Without it the zip plays but shows no ads.
  After uploading, open the game in the panel's preview and watch one pre-roll to activate the SDK.
- `window["GD_OPTIONS"] = { gameId, onEvent }` and GD's loader snippet for `https://html5.api.gamedistribution.com/main.min.js`
  in `<head>` before the game. `SDK_GAME_PAUSE` pauses + mutes, `SDK_GAME_START` resumes; a hidden page pauses too.
- Pre-roll (`gdsdk.showAd()`) when the player presses Play (once per session), mid-rolls on Next / Levels / Menu of the
  level-clear card (always on a click, never during play); rewarded (`preloadAd('rewarded')`, `showAd('rewarded')`)
  for the hint, granted only on `SDK_REWARDED_WATCH_COMPLETE`.
- Checked by `scripts/gamedistribution/check.mjs`.
