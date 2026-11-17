# Don't Trust the Door — GamePix

| Form field | File (in `submission-gamepix/`) |
|---|---|
| Game build (zip) | `dont-trust-the-door-gamepix-v1.zip` — `index.html` at the root, relative paths only |
| Cover (1360×850) | `cover-1360x850.png` |
| Icon (256×256) | `icon-256x256.png` |

## Name

Don't Trust the Door

## Description (364 characters)

A troll platformer where the level betrays you. Floors sink, coins bite, springs lie, the camera cheats and the EXIT runs away. Every trap is fair the second time: spot the trick, remember it and outsmart the level. 13 hand-made levels with 122 traps: buttons that lie, crates you can't trust, water that won't let go. One hint per level, checkpoints, 8 languages.

## How to play

Run and jump to the EXIT door at the end of each level. Almost everything is a trap: a floor that sinks, a coin that bites, a button that does the opposite of what it promises. When a trap gets you, you are back at the last checkpoint in a moment; remember the trick and beat it the next time. Stuck? The bulb gives one hint per level and highlights the next trap.

## Controls

- **Keyboard:** ← → or A / D to move, Space / ↑ / W to jump (hold for a higher jump), P pause, R restart the level, M sound.
- **Touch:** on-screen ◀ ▶ buttons on the left, the jump button on the right; pause, restart, sound and the hint bulb at the top.
- **Mouse:** menus and the buttons at the top.

## Tags

platformer, troll, trap, funny, hard, puzzle, jump, retro, 2d, casual, mobile, html5

## Category

Platformer

## GamePix SDK v3

- `window.GamePixConfig = { lifecycle: 'manual' }` and `<script src="https://integration.gamepix.com/sdk/v3/gamepix.sdk.js">`
  are the first scripts in `<head>`, before the game bundle.
- Lifecycle: `loading(0…100)` while the game boots, `await loaded()` before the title screen, `gameStart()` when the
  first level starts.
- `pause` / `resume` events (and the legacy `GamePix.pause` / `resume` properties) pause the game and mute it;
  `soundOff` / `soundOn` silence it; a hidden page pauses it. Language: `GamePix.lang()`. Saves: localStorage.

## Ads

- No pre-roll, no ad during a level, no ad after a death, none before level 1 is finished.
- Interstitial: only when the player presses **Next level** or **Levels / Menu** on the level-clear card.
- Rewarded: the hint bulb asks "Watch an ad for the hint"; the hint is given only when the SDK confirms the reward;
  otherwise "No ad available right now, try again later" and the hint stays available. One hint per level, no other
  rewards. Where rewarded ads are not supported, the hint is free.
- The game is paused and muted while an ad plays (and while the page is hidden); afterwards the player's own sound
  setting applies again. Every ad request settles exactly once (finished, closed, failed or an 8 s timeout).
- GamePix: at most one interstitial per 2 minutes (none in the first 2 minutes). Rewarded: `GamePix.ads.reward()`,
  the reward only on `success: true`.

## Rebuild

```sh
npm ci
npm run submission:gamepix     # vite build --mode gamepix → zip → checks (scripts/gamepix/check.mjs)
npm run test:portals -- gamepix   # mocked-SDK browser tests
node tools/portal-media.mjs   # covers, screenshots and videos from real play (needs a build: npm run build)
```
