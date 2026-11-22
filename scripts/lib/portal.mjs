// Shared settings and checks of the portal zips (scripts/<portal>/zip.mjs, scripts/<portal>/check.mjs).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const SLUG = 'dont-trust-the-door';
export const SDK = {
  playgama: 'https://bridge.playgama.com/v2/stable/playgama-bridge.js',
  gamepix: 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js',
  y8: 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js',
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  gamedistribution: 'https://html5.api.gamedistribution.com/main.min.js',
  youtube: 'https://www.youtube.com/game_api/v1',
};
export const PORTALS = Object.keys(SDK);
/** strings that name another portal: none may appear in a portal's zip */
export const PORTAL_MARKS = { playgama: 'playgama', gamepix: 'gamepix', y8: 'cdn.y8.com', crazygames: 'crazygames', gamedistribution: 'gamedistribution', youtube: 'game_api/v1' };

/** URLs that appear in Phaser's bundled code as text only (licence comments, SVG namespace, banner): never requested */
export const LIBRARY_TEXT = ['https://opensource.org', 'https://github.com', 'https://phaser.io', 'http://prunegames.com', 'http://steffe.se', 'http://www.w3.org'];

/** release/<portal>/<slug>-<portal>.zip: the file to upload */
export const zipPath = (portal) => resolve(`release/${portal}/${SLUG}-${portal}.zip`);
/** release/store/<portal>/: that portal's listing images and videos */
export const storeDir = (portal) => resolve(`release/store/${portal}`);
export const distDir = (portal) => resolve(`dist-${portal}`);

/** release/<portal>/<slug>-<portal>-media.zip: the portal's listing images / videos plus the shared icon, screenshots
 * and listing texts (from release/store/), ready to attach to the portal's form */
export const mediaZipPath = (portal) => resolve(`release/${portal}/${SLUG}-${portal}-media.zip`);
export function makeMediaZip(portal) {
  const store = resolve('release/store');
  const parts = [portal, 'icon', 'screenshots', 'text'].filter((d) => existsSync(join(store, d)));
  if (!parts.includes(portal)) throw new Error(`release/store/${portal}/ missing: run \`npm run store\` first`);
  const out = mediaZipPath(portal);
  rmSync(out, { force: true });
  execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', out, ...parts, '-x', '.DS_Store'], { cwd: store, stdio: 'inherit' });
  console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
  return out;
}

/** zip dist-<portal>/ with index.html at the root (no directory entries, no extra attributes) */
export function makeZip(portal) {
  const dist = distDir(portal);
  if (!existsSync(`${dist}/index.html`)) throw new Error(`dist-${portal}/index.html missing: run \`vite build --mode ${portal}\` first`);
  const out = zipPath(portal);
  mkdirSync(dirname(out), { recursive: true });
  rmSync(out, { force: true });
  execFileSync('zip', ['-r', '-9', '-X', '-D', '-q', out, '.', '-x', '*.map', '.DS_Store'], { cwd: dist, stdio: 'inherit' });
  console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
  return out;
}

/** a tiny check runner: ok / fail lines, exits non-zero on any failure */
export function checker(title) {
  const errors = [];
  const notes = [];
  console.log(title);
  return {
    check(bad, badMsg, okMsg) {
      if (bad) {
        errors.push(badMsg);
        console.log(`  ✗ ${badMsg}`);
      } else console.log(`  ✓ ${okMsg}`);
    },
    note(m) {
      notes.push(m);
      console.log(`  ! ${m}`);
    },
    done() {
      console.log(errors.length ? `\nFAILED: ${errors.length} problem(s)` : `\nall checks passed${notes.length ? ` (${notes.length} note(s) above)` : ''}`);
      process.exit(errors.length ? 1 : 0);
    },
    errors,
  };
}

/**
 * The checks every portal zip must pass: index.html at the root; relative, Latin paths; the size limit; index.html
 * loads only relative files and the portal's SDK; no URL in the code but the portal's SDK origin; no other portal's
 * SDK or name. Returns { dir, html, files, code } of the unpacked zip for portal-specific checks.
 */
export function commonChecks(c, portal, { maxMB }) {
  const zip = zipPath(portal);
  c.check(!existsSync(zip), `${zip} missing: run \`npm run release -- ${portal}\``, `zip: ${zip}`);
  if (!existsSync(zip)) c.done();
  const size = statSync(zip).size;
  c.check(size > maxMB * 1024 * 1024, `zip is ${(size / 1048576).toFixed(1)} MB, over ${maxMB} MB`, `${(size / 1024).toFixed(0)} KB, under the ${maxMB} MB limit`);
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
  c.check(!entries.includes('index.html'), 'index.html is not at the zip root', 'index.html at the zip root');
  const unsafe = entries.filter((e) => e.startsWith('/') || e.split('/').includes('..') || e.includes('\\') || /[^\x20-\x7e]/.test(e));
  c.check(unsafe.length, `unsafe / non-Latin paths: ${unsafe.join(', ')}`, `${entries.length} files, relative Latin paths`);
  const dir = mkdtempSync(join(tmpdir(), `dttd-${portal}-`));
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const files = [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
  walk(dir);
  const html = existsSync(join(dir, 'index.html')) ? readFileSync(join(dir, 'index.html'), 'utf8') : '';
  const sdk = SDK[portal];
  const refs = [...html.matchAll(/\s(?:src|href|data-src)="([^"]*)"/g)].map((m) => m[1]).filter((r) => r !== sdk);
  const bad = refs.filter((r) => !r.startsWith('./') && !r.startsWith('data:') && !r.startsWith('#'));
  c.check(bad.length, `index.html references non-relative paths: ${bad.join(', ')}`, `index.html: ${refs.length} game references, all relative (./)`);
  c.check(!html.includes(`src="${sdk}"`) && !html.includes(`'${sdk}'`), `index.html does not load ${sdk}`, `index.html loads the SDK from ${new URL(sdk).origin}`);
  const text = files.filter((f) => /\.(html|js|css|json)$/.test(f)).map((f) => [f.slice(dir.length + 1), readFileSync(f, 'utf8')]);
  const code = text.map(([, s]) => s).join('\n');
  // every absolute URL in the code: only the SDK's origin. LIBRARY_TEXT are Phaser's own non-loading strings (licence
  // comments, the SVG namespace, the console banner text): the mocked-SDK tests also check at run time that the game
  // requests nothing outside the zip but the SDK.
  const origin = new URL(sdk).origin;
  const urls = [...new Set(code.match(/https?:\/\/[A-Za-z0-9.\-_]+/g) ?? [])];
  const other = urls.filter((u) => u !== origin && !LIBRARY_TEXT.includes(u));
  c.check(other.length, `URLs of other origins in the build: ${other.join(', ')}`, `the only external origin in the build is ${origin} (plus Phaser's licence / banner text: ${urls.filter((u) => LIBRARY_TEXT.includes(u)).join(', ')})`);
  const hits = [];
  for (const [p, mark] of Object.entries(PORTAL_MARKS)) if (p !== portal) for (const [f, s] of text) if (s.toLowerCase().includes(mark)) hits.push(`${f}: "${mark}"`);
  c.check(hits.length, `another portal named in the zip: ${hits.join('; ')}`, `no other portal's SDK or name in the zip`);
  c.check(files.some((f) => /(gamepix\.sdk|y8\.min|crazygames-sdk|playgama-bridge|gamedistribution|game_api)[^/]*\.js$/i.test(f)), 'a copy of a portal SDK is bundled', 'no bundled copy of any portal SDK (loaded from the portal only)');
  return { dir, html, files, code, entries };
}

/** the media files of a portal (exact sizes, formats) */
export function mediaChecks(c, folder, list) {
  for (const [file, w, h, maxBytes] of list) {
    const f = join(folder, file);
    if (!existsSync(f)) {
      c.check(true, `${f} missing (npm run store)`, '');
      continue;
    }
    const size = statSync(f).size;
    let dims = '';
    try {
      dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name:format=duration', '-of', 'json', f], { encoding: 'utf8' });
    } catch {
      dims = '';
    }
    const j = dims ? JSON.parse(dims) : null;
    const st = j?.streams?.[0];
    const ok = st && st.width === w && st.height === h && size <= maxBytes;
    const dur = j?.format?.duration ? ` ${(+j.format.duration).toFixed(1)} s` : '';
    c.check(!ok, `${file}: ${st ? `${st.width}x${st.height}` : 'unreadable'}, ${(size / 1024).toFixed(0)} KB (want ${w}x${h}, ≤ ${(maxBytes / 1048576).toFixed(0)} MB)`, `${file}: ${w}x${h} ${st.codec_name}${dur}, ${(size / 1024).toFixed(0)} KB`);
  }
}
