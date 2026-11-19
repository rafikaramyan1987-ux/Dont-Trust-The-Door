# Don't Trust the Door — Playgama

| Form field | File (in `submission-playgama/`) |
|---|---|
| Game archive | `dont-trust-the-door-playgama-v1.zip` — `index.html` at the root, `playgama-bridge-config.json` beside it, `assets/` |
| Cover 16:9 (1920×1080) | `cover-1920x1080.png` |
| Cover 9:16 (1080×1920) | `cover-1080x1920.png` |
| Cover 1:1 (800×800) | `cover-800x800.png` |

All three covers are frames of real play (traps of level 11) rendered natively at their size, with the title.

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

## Playgama Bridge

- `<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>` is the first script in `<head>`
  (Bridge from Playgama's CDN, never bundled).
- An inline boot script right after it calls `bridge.initialize()`; the game bundle is held
  (`<script type="text/plain" data-playgama-game>`) and starts only once `initialize()` has settled. A failure is
  logged with `console.error("[Playgama Bridge] …")` and the game still plays (no ads, local saves).
- `playgama-bridge-config.json` (`{}`) beside `index.html`.
- Tested with the QA Tool protocol: `?platform_id=qa_tool` (`scripts/playgama/qa.mjs`): the `initialize` handshake,
  then `game_ready` once the title screen is shown, then `level_started` / `level_completed`; `level_failed` only when
  the player quits a level from the pause menu (a death is not a failure).
- Language: `platform.language` if the game has it (8 languages), else the browser's, else English; the player's
  own 🌐 choice wins. Saves: Bridge storage (key `dttd-save-v1`, the same JSON as the web version).
- Pause + mute on ads, on `PAUSE_STATE_CHANGED` and while the page is hidden; `AUDIO_STATE_CHANGED` mutes.

## Ads

- No pre-roll, no ad during a level, no ad after a death, none before level 1 is finished.
- Interstitial: only when the player presses **Next level** or **Levels / Menu** on the level-clear card.
- Rewarded: the hint bulb asks "Watch an ad for the hint"; the hint is given only when the SDK confirms the reward;
  otherwise "No ad available right now, try again later" and the hint stays available. One hint per level, no other
  rewards. Where rewarded ads are not supported, the hint is free.
- The game is paused and muted while an ad plays (and while the page is hidden); afterwards the player's own sound
  setting applies again. Every ad request settles exactly once (finished, closed, failed or an 8 s timeout).
- Interstitials only where `isInterstitialSupported`; how often one shows is Bridge's call (no timer of our own).

## Rebuild

```sh
npm ci
npm run submission:playgama     # vite build --mode playgama → zip → checks (scripts/playgama/check.mjs) → QA Tool harness
npm run test:portals -- playgama   # mocked-SDK browser tests
node tools/portal-media.mjs   # covers, screenshots and videos from real play (needs a build: npm run build)
```
