# Don't Trust the Door — CrazyGames

| Form field | File (in `submission-crazygames/`) |
|---|---|
| Game files (zip) | `dont-trust-the-door-crazygames-v1.zip` — `index.html` at the root, relative paths only |
| Cover landscape (1920×1080) | `cover-1920x1080.png` |
| Cover portrait (800×1200) | `cover-800x1200.png` |
| Cover square (800×800) | `cover-800x800.png` |
| Icon (512×512) | `icon-512x512.png` |
| Trailer landscape (1920×1080) | `trailer-1920x1080.mp4` (20 s) |
| Trailer portrait (1080×1920) | `trailer-1080x1920.mp4` (20 s) |

## Name

Don't Trust the Door

## Description (340 characters)

A troll platformer where the level betrays you. Floors sink, coins bite, springs lie, the camera cheats and the EXIT runs away. Every trap is fair the second time: spot the trick, remember it and outsmart the level. Hand-made levels full of buttons that lie and doors you should never trust, one hint per level, checkpoints and 8 languages.

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

## CrazyGames SDK v3

- `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">` in `<head>`; `SDK.init()` before the game starts.
- `loadingStart` / `loadingStop` around the boot, `gameplayStart` / `gameplayStop` around every level, `happytime()`
  on a level clear.
- Saves: the SDK's data module (key `dttd-save-v1`, the same JSON as the web version). Language:
  `user.systemInfo.locale`. The SDK's `muteAudio` setting mutes the game.

## Ads

- No pre-roll, no ad during a level, no ad after a death, none before level 1 is finished.
- Interstitial: only when the player presses **Next level** or **Levels / Menu** on the level-clear card.
- Rewarded: the hint bulb asks "Watch an ad for the hint"; the hint is given only when the SDK confirms the reward;
  otherwise "No ad available right now, try again later" and the hint stays available. One hint per level, no other
  rewards. Where rewarded ads are not supported, the hint is free.
- The game is paused and muted while an ad plays (and while the page is hidden); afterwards the player's own sound
  setting applies again. Every ad request settles exactly once (finished, closed, failed or an 8 s timeout).
- `requestAd('midgame')` / `requestAd('rewarded')`: paused and muted from `adStarted` to `adFinished` / `adError`;
  the SDK paces the midgame ads (no timer of our own).

## Rebuild

```sh
npm ci
npm run submission:crazygames     # vite build --mode crazygames → zip → checks (scripts/crazygames/check.mjs)
npm run test:portals -- crazygames   # mocked-SDK browser tests
node tools/portal-media.mjs   # covers, screenshots and videos from real play (needs a build: npm run build)
```
