# Don't Trust the Door — Y8

> **Owner to-do:** create the game in Y8 Studio, then rebuild with its IDs:
> `VITE_Y8_APP_ID=<app id> VITE_Y8_GAME_ID=<game id> npm run submission:y8`. The committed zip has **no IDs yet**
> (`scripts/y8/check.mjs` says so): it plays without ads until it is rebuilt with them.

| Y8 Studio tab → slot | File (in `submission-y8/`) |
|---|---|
| Builds → upload build | `dont-trust-the-door-y8-v1.zip` (`index.html` + `assets/` at the root, relative paths) |
| Media → Standard Screenshot (4:3) ×4 | `media/screenshot-760x570-1.jpg` … `-4.jpg` |
| Media → Widescreen Screenshot (16:9) ×4 | `media/screenshot-1280x720-1.jpg` … `-4.jpg` |
| Media → Landscape Promo | `media/promo-landscape-1920x1080.jpg` |
| Media → Portrait Promo | `media/promo-portrait-1080x1920.jpg` |
| Media → Game Card Promo | `media/promo-card-760x570.jpg` |
| Media → Gameplay Video (16:9) | `media/gameplay-1280x720.mp4` (H.264, 28 s, no sound) |

Screenshots (real play, level 11, the same four moments at both sizes): the crusher drops in the corridor, the green
button drops the ceiling spikes, the lift lands on its own button, the drawbridge falls forward. The video is one
continuous take of level 11 from its start (four traps), rendered frame by frame from the bot's recorded run.

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

## Y8 SDK

- `<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async>` in `<head>` (Y8's CDN, never bundled).
- Initialised as Y8's snippet: a `y8sdk.ready` listener calls `y8.sdk()`, `init({ appId, autoLogin: true }, { gameId, … })`
  and `onAuth` (guests play everything); `emitReadyEvent()` covers an SDK that loaded first.
- Interstitial: `showAd({ type: 'next' })`; rewarded: `showAd({ type: 'reward' })`, `beforeReward` → `showAdFn()`, the
  reward only after `adViewed`. Pause + mute in `beforeAd`, resume in `afterAd`; `adBreakDone` settles the request.
- Pause + mute while the page is hidden. Saves: localStorage. No external links.

## Ads

- No pre-roll, no ad during a level, no ad after a death, none before level 1 is finished.
- Interstitial: only when the player presses **Next level** or **Levels / Menu** on the level-clear card.
- Rewarded: the hint bulb asks "Watch an ad for the hint"; the hint is given only when the SDK confirms the reward;
  otherwise "No ad available right now, try again later" and the hint stays available. One hint per level, no other
  rewards. Where rewarded ads are not supported, the hint is free.
- The game is paused and muted while an ad plays (and while the page is hidden); afterwards the player's own sound
  setting applies again. Every ad request settles exactly once (finished, closed, failed or an 8 s timeout).
- No frequency cap of our own: the SDK paces the breaks.

## Rebuild

```sh
npm ci
npm run submission:y8     # vite build --mode y8 → zip → checks (scripts/y8/check.mjs)
npm run test:portals -- y8   # mocked-SDK browser tests
node tools/portal-media.mjs   # covers, screenshots and videos from real play (needs a build: npm run build)
```
