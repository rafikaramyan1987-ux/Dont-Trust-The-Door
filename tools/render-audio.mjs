// Renders the game's sound files from the original synthesiser (src/audio-synth.ts):
//   public/audio/<sfx>.mp3   one file per SfxName (mono, 96 kbps)
//   public/audio/music.mp3   the music loop, exactly LOOP_SECONDS long so it loops seamlessly (mono, 112 kbps)
// Usage: npm run audio        (= node tools/render-audio.mjs)
// The synthesiser is bundled on its own with Vite (it is never part of the game bundle), rendered with
// OfflineAudioContext in headless Chromium (Playwright), written as WAV to a temp dir, encoded with ffmpeg
// (must be on PATH) and the WAVs deleted. The game (src/audio.ts) only plays these files.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'audio');
const SFX_KBPS = '96k';
const MUSIC_KBPS = '112k';

// 1. the synthesiser as one IIFE script (global __SYNTH)
const res = await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  build: {
    write: false,
    minify: false,
    target: 'es2020',
    lib: { entry: join(ROOT, 'src', 'audio-synth.ts'), formats: ['iife'], name: '__SYNTH', fileName: () => 'synth.js' },
  },
});
const code = (Array.isArray(res) ? res[0] : res).output.find((o) => o.type === 'chunk').code;

// 2. render in headless Chromium
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.setContent('<!doctype html><meta charset="utf-8"><title>render</title>');
await page.addScriptTag({ content: code });
const { names, loopSeconds } = await page.evaluate(() => ({ names: [...window.__SYNTH.SFX_NAMES], loopSeconds: window.__SYNTH.LOOP_SECONDS }));
const tmp = mkdtempSync(join(tmpdir(), 'dttd-audio-'));
const wavs = [];
for (const name of names) {
  const b64 = await page.evaluate((n) => window.__SYNTH.renderSfx(n), name);
  writeFileSync(join(tmp, `${name}.wav`), Buffer.from(b64, 'base64'));
  wavs.push([name, SFX_KBPS]);
}
writeFileSync(join(tmp, 'music.wav'), Buffer.from(await page.evaluate(() => window.__SYNTH.renderMusicLoop()), 'base64'));
wavs.push(['music', MUSIC_KBPS]);
await browser.close();
if (errors.length) throw new Error(`render page errors: ${errors.join(' | ')}`);

// 3. encode (CBR mp3 with the LAME/Info header, so browsers trim the encoder delay), drop the WAVs
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.mp3')) rmSync(join(OUT, f));
let total = 0;
for (const [name, kbps] of wavs) {
  const mp3 = join(OUT, `${name}.mp3`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(tmp, `${name}.wav`), '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', kbps, '-map_metadata', '-1', mp3]);
  const size = statSync(mp3).size;
  total += size;
  console.log(`${name.padEnd(8)} ${(size / 1024).toFixed(1).padStart(6)} KB`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`total    ${(total / 1024).toFixed(1).padStart(6)} KB in public/audio/ (music loop ${loopSeconds} s)`);
