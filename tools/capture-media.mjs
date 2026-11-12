// Captures marketing media from the real game (production build, deterministic replays):
//   docs/media/screens/*.png   title, hero expressions, funniest moment of every level
//   docs/media/trailer-9x16.mp4  20 s vertical gameplay video with soundtrack
// Usage: npm run build && node tools/capture-media.mjs [--screens-only|--video-only]
// Requires ffmpeg on PATH and Python 3 with Pillow (for compositing the vertical video).
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serveDist, launch, openGame, ROOT } from '../tests/harness.mjs';

const OUT = join(ROOT, 'docs', 'media');
const SHOTS = join(OUT, 'screens');
const TMP = join(ROOT, '.tmp', 'media');
mkdirSync(SHOTS, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(TMP, 'frames'), { recursive: true });
const args = new Set(process.argv.slice(2));
const R = (l) => JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', `level-${String(l).padStart(2, '0')}.json`), 'utf8'));
const pick = (l, which) => (which === 'win' ? R(l).win : R(l).traps[which] ?? Object.values(R(l).traps)[which]);

const { server, url } = await serveDist();
const browser = await launch();

/** Start a level driven by a replay and advance (rendering) until `until` holds, plus `extra` frames. */
async function advance(page, until, extra = 0, maxFrames = 1500) {
  return page.evaluate(({ until, extra, maxFrames }) => {
    const T = window.__DTTD;
    const f = new Function('s', `return (${until});`);
    let n = 0;
    while (!f(T.state()) && n < maxFrames) { T.step(1); n++; }
    T.step(extra);
    return T.state();
  }, { until, extra, maxFrames });
}

// ---------------------------------------------------------------------------
// Screenshots
if (!args.has('--video-only')) {
  const { page, errors, ctx } = await openGame(browser, url, { context: { deviceScaleFactor: 2 } });
  await page.evaluate(() => window.__DTTD.resetSave());
  // title (real time so the logo bounces and the door winks)
  await page.evaluate(() => window.__DTTD.scene('Title'));
  await page.waitForTimeout(2350);
  await page.screenshot({ path: join(SHOTS, '00-title.png') });
  await page.evaluate(() => window.__DTTD.showcase());
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(SHOTS, '00-hero-expressions.png') });
  await page.evaluate(() => window.__DTTD.scene('Select'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, '00-level-select.png') });

  const moments = [
    [1, 'win', 's.x>=1080 && s.grounded', 14, 'the last block sinks — "oops!"'],
    [2, 0, 's.y>=612', 0, 'the floor lied'],
    [3, 'win', 's.doorX>=1110', 0, 'the EXIT grows legs and runs'],
    [4, 0, 's.state==="dead"', 3, 'spikes pop exactly where you land'],
    [5, 0, 's.state==="dead"', 2, 'the heavy ceiling'],
    [6, 0, 's.y<=330', 0, 'boing… straight into the spikes'],
    [7, 0, 's.state==="dead"', 5, 'the fake EXIT bites'],
    [8, 0, 's.gravity<0', 16, 'gravity flips mid-jump'],
    [9, 0, 's.state==="dead"', 3, 'that coin had teeth'],
    [10, 'win', 's.doorX>=1080', 0, 'everything chases you'],
  ];
  await page.evaluate(() => window.__DTTD.setManual(true));
  for (const [lvl, which, until, extra, caption] of moments) {
    await page.evaluate(({ lvl, rec }) => window.__DTTD.start(lvl, rec), { lvl, rec: pick(lvl, which) });
    await advance(page, until, extra);
    const file = `level-${String(lvl).padStart(2, '0')}.png`;
    await page.screenshot({ path: join(SHOTS, file) });
    console.log(`screens/${file}  ${caption}`);
  }
  if (errors.length) console.log('console errors:', errors);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Vertical trailer
if (!args.has('--screens-only')) {
  const FPS = 30;
  const W = 1080, H = 1920, GAME = 1080; // square crop of a 1920×1080 render
  const clips = [
    { lvl: 3, rec: 'win', from: 's.x>=716', dur: 2.6, cap: 'The EXIT door…|…has LEGS?!' },
    { lvl: 2, rec: 0, from: 's.x>=360', dur: 1.8, cap: 'The floor lied.' },
    { lvl: 4, rec: 0, from: 's.x>=215', dur: 1.8, cap: 'Spikes pop where you land' },
    { lvl: 6, rec: 0, from: 's.x>=330', dur: 1.8, cap: 'Jump pad = bad idea' },
    { lvl: 7, rec: 0, from: 's.x>=930', dur: 1.6, cap: 'Wrong door.' },
    { lvl: 8, rec: 0, from: 's.x>=470', dur: 2.0, cap: 'Gravity? Optional.' },
    { lvl: 9, rec: 0, from: 's.x>=225', dur: 1.4, cap: 'Greedy?' },
    { lvl: 10, rec: 'win', from: 's.levelTick>=8', dur: 4.0, cap: 'FINALE: everything lies' },
  ];
  const END = 3.0; // end card (last 0.5 s cross-fades back to frame 0 for a seamless loop)

  const { page, errors, ctx } = await openGame(browser, url, { viewport: { width: 1920, height: 1080 } });
  await page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.setManual(true); });
  const meta = []; // per video frame: clip index
  const sfx = [];
  let vf = 0;
  let camX = null;
  for (let ci = 0; ci < clips.length; ci++) {
    const c = clips[ci];
    await page.evaluate(({ lvl, rec }) => window.__DTTD.start(lvl, rec), { lvl: c.lvl, rec: pick(c.lvl, c.rec) });
    await advance(page, c.from, 0);
    const startStep = await page.evaluate(() => window.__DTTD.frame());
    const t0 = vf / FPS;
    camX = null;
    const n = Math.round(c.dur * FPS);
    for (let i = 0; i < n; i++) {
      const s = await page.evaluate(() => { window.__DTTD.step(2); return window.__DTTD.state(); });
      // follow the action horizontally (world → screen ×1.5), smoothed and clamped
      const focus = c.lvl === 3 || c.lvl === 10 ? (s.x + s.doorX) / 2 : s.x;
      const want = Math.max(0, Math.min(1920 - GAME, focus * 1.5 - GAME / 2));
      camX = camX === null ? want : camX + (want - camX) * 0.18;
      await page.screenshot({ path: join(TMP, 'frames', `g${String(vf).padStart(4, '0')}.png`), clip: { x: Math.round(camX), y: 0, width: GAME, height: GAME } });
      meta.push(ci);
      vf++;
    }
    const log = await page.evaluate((from) => window.__DTTD.sfxLog.filter((e) => e.tick > from), startStep);
    for (const e of log) {
      const t = t0 + (e.tick - startStep) / 60;
      if (t < t0 + c.dur) sfx.push({ t, name: e.name });
    }
    console.log(`clip ${ci + 1}/${clips.length}: level ${c.lvl} (${n} frames)`);
  }
  const totalDeaths = await page.evaluate(() => window.__DTTD.Save.get().totalDeaths);

  // Soundtrack: the in-game music loop + every sound effect at its moment, rendered offline.
  const endT = vf / FPS;
  sfx.push({ t: endT + 0.05, name: 'hehe' }, { t: endT + 1.2, name: 'win' });
  const seconds = endT + END;
  const wav = await page.evaluate(({ seconds, sfx }) => window.__DTTD.soundtrack(seconds, sfx), { seconds, sfx });
  writeFileSync(join(TMP, 'audio.wav'), Buffer.from(wav, 'base64'));

  // Text overlays rendered by the browser (same font stack as the game) as transparent PNGs.
  const css = `body{margin:0;width:${W}px;height:${H}px;font-family:"Trebuchet MS","Arial Rounded MT Bold",Verdana,system-ui,sans-serif;font-weight:900;color:#fff6d5;
    -webkit-text-stroke:0;text-align:center} .t{position:absolute;left:0;right:0;paint-order:stroke fill;-webkit-text-stroke:18px #2b2d42;}`;
  const ov = await browser.newPage({ viewport: { width: W, height: H } });
  const shot = async (html, file) => { await ov.setContent(`<style>${css}</style>${html}`); await ov.screenshot({ path: join(TMP, file), omitBackground: true }); };
  await shot(`<div class="t" style="top:120px;font-size:96px;line-height:1.05">DON'T TRUST<br><span style="color:#ffd23f;font-size:124px">THE DOOR</span></div>`, 'header.png');
  for (let i = 0; i < clips.length; i++) {
    const parts = clips[i].cap.split('|');
    await shot(`<div class="t" style="top:1560px;font-size:78px;color:#ffd23f">${parts[0]}</div>${parts[1] ? `<div class="t" style="top:1665px;font-size:92px;color:#ff6f91">${parts[1]}</div>` : ''}`, `cap${i}.png`);
  }
  await shot(`<div class="t" style="top:520px;font-size:120px;line-height:1.1">How many<br>tries would<br><span style="color:#ffd23f;font-size:150px">YOU</span><br>need?</div>
    <div class="t" style="top:1350px;font-size:60px;color:#9ad9ff;-webkit-text-stroke:12px #2b2d42">I needed ${totalDeaths}+ 💀</div>`, 'end.png');
  await ov.close();
  writeFileSync(join(TMP, 'compose.json'), JSON.stringify({ W, H, GAME, FPS, frames: vf, meta, clips: clips.map((c) => ({ cap: c.cap, lvl: c.lvl })), end: END, capStart: clips.map((_, i) => meta.indexOf(i)) }));
  if (errors.length) console.log('console errors:', errors);
  await ctx.close();

  execFileSync('python3', [join(ROOT, 'tools', 'compose-trailer.py'), TMP], { stdio: 'inherit' });
  const mp4 = join(OUT, 'trailer-9x16.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(TMP, 'out', 'f%04d.jpg'), '-i', join(TMP, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4], { stdio: 'inherit' });
  console.log(`wrote ${mp4}`);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,duration', '-of', 'compact', mp4]).toString();
  console.log(probe.trim());
}

await browser.close();
server.close();
