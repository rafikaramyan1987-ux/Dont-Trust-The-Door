// Portal media from real play (the production build driven by the recorded replays of the new levels):
//   submission-playgama/   cover-1920x1080.png, cover-1080x1920.png, cover-800x800.png
//   submission-gamepix/    cover-1360x850.png, icon-256x256.png
//   submission-y8/media/   screenshot-760x570-1..4.jpg, screenshot-1280x720-1..4.jpg, promo-landscape-1920x1080.jpg,
//                          promo-portrait-1080x1920.jpg, promo-card-760x570.jpg, gameplay-1280x720.mp4 (~28 s)
//   submission-crazygames/ cover-1920x1080.png, cover-800x1200.png, cover-800x800.png, icon-512x512.png,
//                          trailer-1920x1080.mp4, trailer-1080x1920.mp4 (~20 s)
// Every picture is a frame of the game rendered natively at the target size (no upscaling); covers and promos add
// the game's title over the frame. Screenshots and videos show the traps of the new levels (L11+) as they fire.
// Usage: npm run build && node tools/portal-media.mjs [--no-video]
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serveDist, launch, ROOT } from '../tests/harness.mjs';

const args = new Set(process.argv.slice(2));
const TMP = join(ROOT, '.tmp', 'portal-media');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const DIRS = { playgama: 'submission-playgama', gamepix: 'submission-gamepix', y8: 'submission-y8/media', crazygames: 'submission-crazygames' };
for (const d of Object.values(DIRS)) mkdirSync(join(ROOT, d), { recursive: true });
const LEVEL_FILES = readdirSync(join(ROOT, 'src', 'levels')).filter((f) => f.endsWith('.json')).sort();
const level = (id) => JSON.parse(readFileSync(join(ROOT, 'src', 'levels', LEVEL_FILES[id - 1]), 'utf8'));
const replays = (id) => JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', `level-${String(id).padStart(2, '0')}.json`), 'utf8'));
const FONT = readFileSync(join(ROOT, 'node_modules/@fontsource/nunito/files/nunito-latin-900-normal.woff2')).toString('base64');

/** trap moments of the new levels: [level, trap type, 'die' | 'solve', frames after it fires] */
const MOMENTS = [
  [19, 'firework-cake', 'die', 75],
  [15, 'prism-fan', 'die', 70],
  [16, 'tunnel-shroom', 'die', 10],
  [18, 'boo-ghost', 'die', 40],
  [17, 'gap-fan', 'die', 30],
  [20, 'arrow-shaft', 'die', 24],
];

const { server, url } = await serveDist();
const browser = await launch();

async function gamePage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${url}?test=1&boot=none`);
  await page.waitForFunction(() => window.__DTTD && window.__DTTD.game.scene.getScene('Boot').sys.settings.status >= 5);
  await page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.lang('en'); window.__DTTD.setManual(true); });
  return { ctx, page };
}

/** run a trap's replay until it fires, then render `extra` frames; hud: show the buttons or not */
async function moment(page, [lv, type, kind, extra], { hud = true, warm = 40 } = {}) {
  const L = level(lv);
  const t = L.trolls.find((x) => x.type === type);
  const r = replays(lv).traps[t.name];
  await page.evaluate(({ lv, rec, cp, id, extra, warm, hud }) => {
    const T = window.__DTTD;
    const sc = () => T.game.scene.getScene('Game');
    const fired = () => T.state().trolls.includes(id);
    T.start(lv, rec, cp);
    let n = 0;
    while (!fired() && n++ < 20000) sc().fixedTick();
    const target = T.state().tick;
    T.start(lv, rec, cp);
    T.step(12);
    while (T.state().tick < target - warm) sc().fixedTick();
    T.snapCamera();
    T.step(warm + extra - 1);
    sc().uiLayer.setVisible(hud);
    T.step(1);
  }, { lv, rec: r[kind], cp: r.cp, id: t.id, extra, warm, hud });
}

/** a frame of the current page as PNG bytes */
const frame = (page) => page.screenshot({ type: 'png' });

/** compose a cover / promo: a game frame with the title over it, rendered at w×h */
async function cover(png, w, h, out, { quality } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const big = Math.round(Math.min(w, h * 1.6) * 0.105);
  const tall = h > w * 1.2;
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: N; src: url(data:font/woff2;base64,${FONT}) format('woff2'); font-weight: 900; }
    html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: #2b2d42; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .band { position: absolute; left: 0; right: 0; ${tall ? 'top: 9%' : 'top: 7%'}; text-align: center; font-family: N; font-weight: 900; line-height: 0.95; }
    .l1, .l2 { display: block; letter-spacing: 0.02em; -webkit-text-stroke: ${Math.round(big * 0.13)}px #2b2d42; paint-order: stroke fill; transform: rotate(-3deg); }
    .l1 { color: #fff6d5; font-size: ${Math.round(big * 0.82)}px; }
    .l2 { color: #ffd23f; font-size: ${big}px; margin-top: ${Math.round(big * 0.08)}px; }
    .shade { position: absolute; left: 0; right: 0; top: 0; height: ${tall ? 36 : 48}%; background: linear-gradient(rgba(43,45,66,0.35), rgba(43,45,66,0)); }
  </style></head><body><img src="data:image/png;base64,${png.toString('base64')}"><div class="shade"></div>
  <div class="band"><span class="l1">DON'T TRUST</span><span class="l2">THE DOOR</span></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', quality: out.endsWith('.jpg') ? (quality ?? 90) : undefined });
  await ctx.close();
  console.log(out);
}

/** a frame of the game at w×h (hud hidden), from a trap moment */
async function shotAt(w, h, m, opts = {}) {
  const { ctx, page } = await gamePage(w, h);
  await moment(page, m, { hud: false, ...opts });
  const png = await frame(page);
  await ctx.close();
  return png;
}

/** the icon: the hero next to the EXIT at the end of level 11, the camera zoomed in */
async function icon(size, out) {
  const { ctx, page } = await gamePage(size * 2, size * 2);
  await page.evaluate(() => {
    const T = window.__DTTD;
    const rec = null;
    T.start(11, rec);
    const sc = T.game.scene.getScene('Game');
    const L = T.levelData(11);
    const dx = L.map.map((r) => r.indexOf('D')).find((x) => x >= 0);
    const dy = L.map.findIndex((r) => r.includes('D'));
    sc.pbody.reset((dx - 1.6) * 40, (dy - 0.2) * 40);
    T.step(30);
    sc.uiLayer.setVisible(false);
    sc.camZoomMul = 2.6;
    T.step(60);
    T.snapCamera();
    T.step(2);
  });
  await page.screenshot({ path: join(TMP, `icon-${size}.png`) });
  await ctx.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(TMP, `icon-${size}.png`), '-vf', `scale=${size}:${size}:flags=lanczos`, out]);
  console.log(out);
}

/** a video of real play: a replay rendered frame by frame at 30 fps (2 game ticks per frame) */
async function video(w, h, clips, out) {
  const { ctx, page } = await gamePage(w, h);
  const dir = join(TMP, `v-${w}x${h}`);
  mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const c of clips) {
    const L = level(c.level);
    const r = replays(c.level);
    const t = c.trap ? L.trolls.find((x) => x.type === c.trap) : null;
    const rec = t ? r.traps[t.name][c.kind] : c.cp !== undefined ? r.cps[c.cp] : r.win;
    const cp = t ? r.traps[t.name].cp : c.cp ?? false;
    await page.evaluate(({ lv, rec, cp, skip }) => {
      const T = window.__DTTD;
      T.start(lv, rec, cp);
      const sc = T.game.scene.getScene('Game');
      for (let i = 0; i < skip; i++) sc.fixedTick();
      T.snapCamera();
    }, { lv: c.level, rec, cp, skip: c.skip ?? 0 });
    for (let f = 0; f < c.seconds * 30; f++) {
      await page.evaluate(() => window.__DTTD.step(2));
      await page.screenshot({ path: join(dir, `f${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    }
  }
  await ctx.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out]);
  console.log(`${out} (${(n / 30).toFixed(1)} s)`);
}

// ---------------------------------------------------------------------------
// covers / promos (a trap moment each, title over it)
const P = (d, f) => join(ROOT, DIRS[d], f);
await cover(await shotAt(1920, 1080, MOMENTS[1]), 1920, 1080, P('playgama', 'cover-1920x1080.png'));
await cover(await shotAt(1080, 1920, MOMENTS[2]), 1080, 1920, P('playgama', 'cover-1080x1920.png'));
await cover(await shotAt(800, 800, MOMENTS[0]), 800, 800, P('playgama', 'cover-800x800.png'));
await cover(await shotAt(1360, 850, MOMENTS[3]), 1360, 850, P('gamepix', 'cover-1360x850.png'));
await icon(256, P('gamepix', 'icon-256x256.png'));
await cover(await shotAt(1920, 1080, MOMENTS[3]), 1920, 1080, P('y8', 'promo-landscape-1920x1080.jpg'));
await cover(await shotAt(1080, 1920, MOMENTS[1]), 1080, 1920, P('y8', 'promo-portrait-1080x1920.jpg'));
await cover(await shotAt(760, 570, MOMENTS[4]), 760, 570, P('y8', 'promo-card-760x570.jpg'));
await cover(await shotAt(1920, 1080, MOMENTS[2]), 1920, 1080, P('crazygames', 'cover-1920x1080.png'));
await cover(await shotAt(800, 1200, MOMENTS[0]), 800, 1200, P('crazygames', 'cover-800x1200.png'));
await cover(await shotAt(800, 800, MOMENTS[1]), 800, 800, P('crazygames', 'cover-800x800.png'));
await icon(512, P('crazygames', 'icon-512x512.png'));

// Y8 screenshots: four traps of the new levels, in play (with the buttons), 4:3 and 16:9
for (const [i, m] of MOMENTS.slice(0, 4).entries()) {
  for (const [w, h] of [[760, 570], [1280, 720]]) {
    const { ctx, page } = await gamePage(w, h);
    await moment(page, m, { hud: true });
    const out = P('y8', `screenshot-${w}x${h}-${i + 1}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
    await ctx.close();
    console.log(out);
  }
}

// videos: level 14 from the start (28 s); trailers: level 19 / level 15 from their first checkpoint
if (!args.has('--no-video')) {
  await video(1280, 720, [{ level: 14, seconds: 28 }], P('y8', 'gameplay-1280x720.mp4'));
  await video(1920, 1080, [{ level: 19, cp: 0, seconds: 20 }], P('crazygames', 'trailer-1920x1080.mp4'));
  await video(1080, 1920, [{ level: 15, cp: 0, seconds: 20 }], P('crazygames', 'trailer-1080x1920.mp4'));
}

await browser.close();
server.close();
writeFileSync(join(TMP, 'done'), new Date().toISOString());
