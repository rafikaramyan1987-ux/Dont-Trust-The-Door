# Don't Trust the Door — Y8

Upload `dont-trust-the-door-y8.zip` (this folder). The images and videos for the form are in
[`../store/y8/`](../store/y8/), shared ones in [`../store/icon/`](../store/icon/) and
[`../store/screenshots/`](../store/screenshots/). Rebuild with `npm run release -- y8`.

| Form field | File / value |
|---|---|
| Builds → upload build | `dont-trust-the-door-y8.zip` (`index.html` + `assets/` + `audio/` at the root) |
| Standard screenshots 760×570 (up to 6) | `../store/y8/screenshot-760x570-1..4.jpg` |
| Widescreen screenshots 1280×720 (up to 6) | `../store/y8/screenshot-1280x720-1..4.jpg` |
| Landscape promo 1920×1080 | `../store/y8/promo-landscape-1920x1080.jpg` |
| Portrait promo 1080×1920 | `../store/y8/promo-portrait-1080x1920.jpg` |
| Game card promo 760×570 | `../store/y8/promo-card-760x570.jpg` |
| Gameplay video (16:9, ≥ 1280×720, ≥ 15 s) | `../store/y8/gameplay-1280x720.mp4` (28 s, level 14) |
| Basic info | listing texts below |

## Listing texts

All texts, in English and French, are in [`../store/text/listing-en.md`](../store/text/listing-en.md) and
[`../store/text/listing-fr.md`](../store/text/listing-fr.md) (also `listing.json`):
title, short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

- **Title:** Don't Trust the Door
- **Short description:** A cute troll platformer: 20 levels, 241 traps. The floor, the coins, the springs and even the EXIT door lie to you. Die, laugh, try again.
- **Controls (keyboard):** Move: Left / Right arrows or A / D. Jump: Up arrow, W, Space, Z or K. Restart the level: R. Pause: P. Sound on / off: M. Next / confirm: Enter.
- **Controls (touch):** Move: the ◀ and ▶ buttons at the bottom left. Jump: the ▲ button at the bottom right (hold for a higher jump). On-screen buttons for restart, pause, sound and the hint (bulb).

## Integration (Y8 rules)

- App ID `6aff479cc9841fd9d0e5db3e`, Game ID `294329` (public client IDs, built in: `src/platform/y8.ts`).
- `https://cdn.y8.com/minimal-sdk/2-0/y8.min.js` async in `<head>`; `y8sdk.ready` listener + `emitReadyEvent()`;
  `init({ appId, autoLogin: true }, { gameId, preloadAdBreaks: 'on', sound: 'on', onReady })`.
- `showAd({ type: 'next' })` on Next and `{ type: 'browse' }` on Levels / Menu of the level-clear card (player clicks
  only); `showAd({ type: 'reward' })` for the hint, granted only on `adViewed`. Pause + mute in `beforeAd`, resume
  after the break; also pause + mute on a hidden page and on window blur. Y8 runs the pre-roll itself.
- Checked by `scripts/y8/check.mjs`.
