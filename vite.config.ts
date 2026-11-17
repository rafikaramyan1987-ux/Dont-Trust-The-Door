import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

// One Vite mode per build: `web` (GitHub Pages, the default: no SDK, no ads, no network), `playgama`, `gamepix`,
// `y8`, `crazygames`. The mode sets the compile-time constant __PLATFORM__ (src/platform/index.ts) and, for the
// portals, injects the portal's SDK script into index.html. Relative base everywhere (Pages under /<repo>/, zips).
const PORTALS = ['playgama', 'gamepix', 'y8', 'crazygames'] as const;
type Name = 'web' | (typeof PORTALS)[number];

const PLAYGAMA_BRIDGE = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
const GAMEPIX_SDK = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
const Y8_SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
const CRAZYGAMES_SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** Playgama: Bridge from the CDN as the first script in <head>, then the inline boot (bridge.initialize()); the game
 * bundle is held (<script type="text/plain" data-playgama-game>) until initialize() has settled. */
function playgama(): Plugin {
  return {
    name: 'dttd-playgama',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        let held = 0;
        html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_m, src) => {
          held++;
          return `<script type="text/plain" data-playgama-game data-src="${src}"></script>`;
        });
        if (!held) throw new Error('playgama build: no module script to hold');
        const boot = readFileSync('scripts/playgama/boot.js', 'utf8')
          .split('\n')
          .filter((l) => !/^\s*\/\//.test(l))
          .join('\n');
        return html.replace(/(<meta charset="UTF-8" \/>)/i, `$1\n    <script src="${PLAYGAMA_BRIDGE}"></script>\n    <script>${boot}</script>`);
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: readFileSync('scripts/playgama/playgama-bridge-config.json', 'utf8') });
    },
  };
}

/** a portal SDK as the first script in <head> (before the game bundle) */
function headScript(name: string, tags: string): Plugin {
  return {
    name: `dttd-${name}`,
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html) => html.replace(/(<meta charset="UTF-8" \/>)/i, `$1\n    ${tags}`) },
  };
}

export default defineConfig(({ mode }) => {
  const name: Name = (PORTALS as readonly string[]).includes(mode) ? (mode as Name) : 'web';
  const plugins: Plugin[] = [];
  if (name === 'playgama') plugins.push(playgama());
  if (name === 'gamepix') plugins.push(headScript('gamepix', `<script>window.GamePixConfig = { lifecycle: 'manual' };</script>\n    <script src="${GAMEPIX_SDK}"></script>`));
  if (name === 'y8') plugins.push(headScript('y8', `<script src="${Y8_SDK}" async></script>`));
  if (name === 'crazygames') plugins.push(headScript('crazygames', `<script src="${CRAZYGAMES_SDK}"></script>`));
  return {
    base: './',
    define: { __PLATFORM__: JSON.stringify(name) },
    plugins,
    build: {
      target: 'es2019',
      outDir: name === 'web' ? 'dist' : `dist-${name}`,
      chunkSizeWarningLimit: 2000,
      assetsInlineLimit: 0,
    },
    server: { host: true },
  };
});
