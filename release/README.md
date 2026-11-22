# Release: Don't Trust the Door for six web game portals

`npm run release` rebuilds and checks every zip; `npm run store` re-renders the images and videos in `store/`
(from real play of the game); `npm run test:release` plays each zip in a browser at desktop and phone size.
What each portal's documentation requires and how the build complies: [`../docs/portal-requirements.md`](../docs/portal-requirements.md).

| Portal | Upload | Form material | Notes |
|---|---|---|---|
| Playgama | `playgama/dont-trust-the-door-playgama.zip` | `store/playgama/` (3 covers), `store/screenshots/`, `store/icon/` | [`playgama/README.md`](playgama/README.md) |
| GamePix | `gamepix/dont-trust-the-door-gamepix.zip` | `store/gamepix/` (cover, icon), `store/screenshots/` | [`gamepix/README.md`](gamepix/README.md) — its docs could not be read; check the sizes in the form |
| CrazyGames | `crazygames/dont-trust-the-door-crazygames.zip` | `store/crazygames/` (3 covers, 2 preview videos) | [`crazygames/README.md`](crazygames/README.md) — tick "Progress Save / Data Module" |
| Y8 | `y8/dont-trust-the-door-y8.zip` | `store/y8/` (screenshots, promos, gameplay video) | [`y8/README.md`](y8/README.md) — App ID / Game ID built in |
| GameDistribution | `gamedistribution/dont-trust-the-door-gamedistribution.zip` | `store/gamedistribution/` (5 JPG thumbnails) | [`gamedistribution/README.md`](gamedistribution/README.md) — **needs its game ID** (`VITE_GD_GAME_ID`), tick "Rewarded Ads" |
| YouTube Playables | `youtube/dont-trust-the-door-youtube.zip` | `store/youtube/` (thumbnails 1:1, 5:7, 16:9) | [`youtube/README.md`](youtube/README.md) — IARC rating in the developer portal |

Shared material:
- `store/icon/` — the game icon at 256, 512 and 1024 px.
- `store/screenshots/` — six gameplay screenshots from six different levels (15–20), 1920×1080 and 1280×720.
- `store/text/` — listing texts in English and French (`listing-en.md`, `listing-fr.md`, `listing.json`): title,
  short description (≤ 160 characters), long description, controls (keyboard and touch), category, 8 tags.

Each zip loads only its own portal's SDK (no other portal's ads), has `index.html` at the root and relative paths,
and makes no request outside the zip except that SDK.
