# Don't Trust the Door — GamePix

Upload `dont-trust-the-door-gamepix.zip` (this folder). The images and videos for the form are in
[`../store/gamepix/`](../store/gamepix/), shared ones in [`../store/icon/`](../store/icon/) and
[`../store/screenshots/`](../store/screenshots/). Rebuild with `npm run release -- gamepix`.

| Form field | File / value |
|---|---|
| Game files (zip) | `dont-trust-the-door-gamepix.zip` (`index.html` at the root) |
| Cover 1360×850 | `../store/gamepix/cover-1360x850.png` |
| Icon 256×256 | `../store/gamepix/icon-256x256.png` (512 / 1024: `../store/icon/`) |
| Screenshots | `../store/screenshots/` (6 levels, 1920×1080 and 1280×720) |
| Category | Platformer |

## Listing texts

All texts, in English and French, are in [`../store/text/listing-en.md`](../store/text/listing-en.md) and
[`../store/text/listing-fr.md`](../store/text/listing-fr.md) (also `listing.json`):
title, short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

- **Title:** Don't Trust the Door
- **Short description:** A cute troll platformer: 20 levels, 241 traps. The floor, the coins, the springs and even the EXIT door lie to you. Die, laugh, try again.
- **Controls (keyboard):** Move: Left / Right arrows or A / D. Jump: Up arrow, W, Space, Z or K. Restart the level: R. Pause: P. Sound on / off: M. Next / confirm: Enter.
- **Controls (touch):** Move: the ◀ and ▶ buttons at the bottom left. Jump: the ▲ button at the bottom right (hold for a higher jump). On-screen buttons for restart, pause, sound and the hint (bulb).

## Integration (GamePix rules)

- GamePix's documentation site refuses automated access, so these sizes are the ones its form used before; please
  check them in the form. The integration follows the public SDK file `https://integration.gamepix.com/sdk/v3/gamepix.sdk.js`.
- `window.GamePixConfig = { lifecycle: 'manual' }` before the SDK; `loading(0..100)`, `loaded()` before the title,
  `gameStart()` at the first level, `updateLevel(n)`, `happyMoment()` at the end of the game.
- `ads.interstitial()` on the level-clear card (at most one per 2 minutes); `ads.reward()` for the hint, granted only on
  `success: true`; pause / resume and soundOff / soundOn events and a hidden page pause + mute the game.
- Checked by `scripts/gamepix/check.mjs`.
