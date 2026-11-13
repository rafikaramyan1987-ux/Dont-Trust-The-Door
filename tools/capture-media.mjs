// Captures marketing media from the real game (production build, deterministic replays):
//   docs/media/screens/*.png   title, hero expressions, funniest moment of every level
//   docs/media/trailer-9x16.mp4  20 s vertical video (run with --video-only to re-record)
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
const pick = (l, which) => {
  if (which === 'win') return { rec: R(l).win, cp: false };
  const k = Object.keys(R(l).traps).find((n) => n.startsWith(which));
  if (!k) throw new Error(`level ${l}: no trap replay "${which}"`);
  return R(l).traps[k];
};

const { server, url } = await serveDist();
const browser = await launch();

/**
 * Advance a level driven by a replay until `until` holds, then `extra` more rendered
 * frames. The simulation is deterministic, so we first find the target tick with the fast
 * non-rendering sim, then restart and only render the last `warm` ticks.
 * `until` may be a JS expression over the state `s`, or "troll:<name prefix>" (that troll
 * moment has fired).
 */
async function advance(page, lvl, rec, until, extra = 0, warm = 30, checkpoint = false) {
  let cond = until;
  if (until.startsWith('near:')) {
    // start a little before the troll's region (the hero walks into frame)
    const L = JSON.parse(readFileSync(join(ROOT, 'src', 'levels', readdirSync(join(ROOT, 'src', 'levels')).filter((f) => f.endsWith('.json')).sort()[lvl - 1]), 'utf8'));
    const t = L.trolls.find((x) => x.name.startsWith(until.slice(5)));
    if (!t) throw new Error(`level ${lvl}: no troll "${until}"`);
    cond = `s.x >= ${(t.x - 4) * 40}`;
  } else if (until.startsWith('troll:')) {
    const L = JSON.parse(readFileSync(join(ROOT, 'src', 'levels', readdirSync(join(ROOT, 'src', 'levels')).filter((f) => f.endsWith('.json')).sort()[lvl - 1]), 'utf8'));
    const t = L.trolls.find((x) => x.name.startsWith(until.slice(6)));
    if (!t) throw new Error(`level ${lvl}: no troll "${until}"`);
    cond = `s.trolls.includes('${t.id}')`;
  }
  return page.evaluate(({ lvl, rec, cond, extra, warm, checkpoint }) => {
    const T = window.__DTTD;
    const f = new Function('s', `return (${cond});`);
    const sc = () => T.game.scene.getScene('Game');
    T.start(lvl, rec, checkpoint);
    let n = 0;
    while (!f(T.state()) && n++ < 9000) sc().fixedTick();
    const target = T.state().tick;
    T.start(lvl, rec, checkpoint);
    T.step(12); // render the spawn pop-in
    while (T.state().tick < target - warm) sc().fixedTick();
    T.snapCamera();
    n = 0;
    while (!f(T.state()) && n++ < 600) T.step(1);
    T.step(extra);
    return T.state();
  }, { lvl, rec, cond, extra, warm, checkpoint });
}

// ---------------------------------------------------------------------------
// Screenshots (phone-sized landscape, 844×390 @2x, with the touch controls)
const PHONE = { viewport: { width: 844, height: 390 }, context: { deviceScaleFactor: 2, hasTouch: true, isMobile: true } };
if (!args.has('--video-only')) {
  for (const f of readdirSync(SHOTS)) rmSync(join(SHOTS, f));
  const { page, errors, ctx } = await openGame(browser, url, PHONE);
  await page.evaluate(() => window.__DTTD.resetSave());
  await page.evaluate(() => window.__DTTD.scene('Title'));
  await page.waitForTimeout(2350);
  await page.screenshot({ path: join(SHOTS, '00-title.png') });
  await page.evaluate(() => window.__DTTD.showcase());
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(SHOTS, '00-hero-expressions.png') });
  await page.evaluate(() => window.__DTTD.scene('Select'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, '00-level-select.png') });
  if (errors.length) console.log('console errors:', errors);
  await ctx.close();

  // [level, replay ('win' or trap name prefix), until, extra frames, caption]
  const moments = [
    [1, 'The bridge crumbles behind you', 'troll:The bridge crumbles', 30, 'the bridge crumbles behind you'],
    [2, 'The coin arc over the pit bites', 's.state==="dead"', 3, 'that coin had teeth'],
    [3, 'A sideways spring flings you', 'troll:A sideways spring', 14, 'a sideways spring flings you into spikes'],
    [4, 'The ceiling slab slams down', 's.state==="dead"', 2, 'the cave ceiling slams down'],
    [5, 'Left and right swap', 'troll:Left and right swap', 22, 'left and right swap'],
    [6, 'win', 's.gravity<0', 24, 'gravity flips'],
    [7, 'win', 'troll:The EXIT grows legs', 34, 'the EXIT grows legs and runs away'],
    [8, 'win', 'troll:The screen turns upside down', 40, 'the screen turns upside down'],
    [9, 'win', 'troll:A spike wall chases you', 40, 'a spike wall chases you'],
    [10, 'The elevator rises into ceiling spikes', 'troll:The elevator rises', 40, 'the elevator rises into ceiling spikes'],
  ];
  const lv = await openGame(browser, url, PHONE);
  await lv.page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.setManual(true); });
  for (const [lvl, which, until, extra, caption] of moments) {
    const R = JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', `level-${String(lvl).padStart(2, '0')}.json`), 'utf8'));
    const t = which === 'win' ? { rec: R.win, cp: false } : R.traps[Object.keys(R.traps).find((k) => k.startsWith(which))];
    await advance(lv.page, lvl, t.rec, until, extra, 16, t.cp);
    const file = `level-${String(lvl).padStart(2, '0')}.png`;
    await lv.page.screenshot({ path: join(SHOTS, file), timeout: 180000 });
    console.log(`screens/${file}  ${caption}`);
  }
  // the hint button (one per level): hint shown + the next trap highlighted
  {
    const R = JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', 'level-04.json'), 'utf8'));
    await advance(lv.page, 4, R.win, 's.x>=380', 0, 16);
    await lv.page.evaluate(() => { window.__DTTD.hint(); window.__DTTD.step(24); });
    await lv.page.screenshot({ path: join(SHOTS, 'hint-button.png'), timeout: 180000 });
    console.log('screens/hint-button.png  the one-per-level hint');
  }
  // the checkpoint flag
  {
    const R = JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', 'level-05.json'), 'utf8'));
    await advance(lv.page, 5, R.win, 's.checkpoint', 20, 16);
    await lv.page.screenshot({ path: join(SHOTS, 'checkpoint.png'), timeout: 180000 });
    console.log('screens/checkpoint.png  the checkpoint flag');
  }
  if (lv.errors.length) console.log('console errors:', lv.errors);
  await lv.ctx.close();
  // desktop layout for comparison
  const dk = await openGame(browser, url, { context: { deviceScaleFactor: 1 } });
  await dk.page.evaluate(() => window.__DTTD.setManual(true));
  {
    const R = JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', 'level-09.json'), 'utf8'));
    await advance(dk.page, 9, R.win, 's.x>=2400', 0, 16);
    await dk.page.screenshot({ path: join(SHOTS, 'desktop-1280x720.png'), timeout: 180000 });
  }
  await dk.ctx.close();
}

// ---------------------------------------------------------------------------
// Vertical trailer
if (!args.has('--screens-only')) {
  const FPS = 30;
  const W = 1080, H = 1920, GAME = 1080; // square crop of a 1920×1080 render
  const clips = [
    { lvl: 7, rec: 'win', from: 'near:The EXIT grows legs', dur: 2.6, cap: 'The EXIT door…|…has LEGS?!' },
    { lvl: 1, rec: 'Two fake floor', from: 'near:Two fake floor', dur: 1.7, cap: 'The floor lied.' },
    { lvl: 2, rec: 'The coin arc', from: 'near:The coin arc', dur: 1.8, cap: 'Greedy?' },
    { lvl: 3, rec: 'A sideways spring', from: 'near:A sideways spring', dur: 1.8, cap: 'Spring = bad idea' },
    { lvl: 5, rec: 'Left and right swap', from: 'near:Left and right swap', dur: 2.0, cap: 'Left is… right?!' },
    { lvl: 6, rec: 'win', from: 'near:Gravity flips –', dur: 2.0, cap: 'Gravity? Optional.' },
    { lvl: 8, rec: 'win', from: 'near:The screen turns upside down', dur: 2.2, cap: 'Even the screen lies' },
    { lvl: 9, rec: 'win', from: 'near:A spike wall chases you', dur: 3.4, cap: 'RUN!' },
  ];
  const END = 3.1; // end card (last 0.5 s cross-fades back to frame 0 for a seamless loop)

  const { page, errors, ctx } = await openGame(browser, url, { viewport: { width: 1920, height: 1080 } });
  await page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.setManual(true); });
  const meta = []; // per video frame: clip index
  const sfx = [];
  let vf = 0;
  let camX = null;
  for (let ci = 0; ci < clips.length; ci++) {
    const c = clips[ci];
    const pk = pick(c.lvl, c.rec);
    await advance(page, c.lvl, pk.rec, c.from, 0, 30, pk.cp);
    const startStep = await page.evaluate(() => window.__DTTD.frame());
    const t0 = vf / FPS;
    camX = null;
    const n = Math.round(c.dur * FPS);
    for (let i = 0; i < n; i++) {
      const s = await page.evaluate(() => { window.__DTTD.step(2); return window.__DTTD.state(); });
      // the game camera already follows the hero: take the square around the screen centre,
      // shifted a little toward the running direction
      const want = (1920 - GAME) / 2 + Math.max(-160, Math.min(160, s.vx * 0.25));
      camX = camX === null ? want : camX + (want - camX) * 0.12;
      await page.screenshot({ timeout: 180000, path: join(TMP, 'frames', `g${String(vf).padStart(4, '0')}.png`), clip: { x: Math.round(camX), y: 0, width: GAME, height: GAME } });
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
    <div class="t" style="top:1350px;font-size:60px;color:#9ad9ff;-webkit-text-stroke:12px #2b2d42">Play free in your browser</div>`, 'end.png');
  await ov.close();
  writeFileSync(join(TMP, 'compose.json'), JSON.stringify({ W, H, GAME, FPS, frames: vf, meta, clips: clips.map((c) => ({ cap: c.cap, lvl: c.lvl })), end: END, capStart: clips.map((_, i) => meta.indexOf(i)) }));
  if (errors.length) console.log('console errors:', errors);
  await ctx.close();

  execFileSync('python3', [join(ROOT, 'tools', 'compose-trailer.py'), TMP], { stdio: 'inherit' });
  const mp4 = join(OUT, 'trailer-9x16.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(TMP, 'out', 'f%04d.jpg'), '-i', join(TMP, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', mp4], { stdio: 'inherit' });
  console.log(`wrote ${mp4}`);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,duration', '-of', 'compact', mp4]).toString();
  console.log(probe.trim());
}

await browser.close();
server.close();
