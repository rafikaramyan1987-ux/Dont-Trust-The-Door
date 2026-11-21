import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

// One Vite mode per build: `web` (GitHub Pages, the default: no SDK, no ads, no network), `playgama`, `gamepix`,
// `y8`, `crazygames`, `gamedistribution`, `youtube`. The mode sets the compile-time constant __PLATFORM__ (src/platform/index.ts) and, for the
// portals, injects the portal's SDK script into index.html. Relative base everywhere (Pages under /<repo>/, zips).
const PORTALS = ['playgama', 'gamepix', 'y8', 'crazygames', 'gamedistribution', 'youtube'] as const;
type Name = 'web' | (typeof PORTALS)[number];

const PLAYGAMA_BRIDGE = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
const GAMEPIX_SDK = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
const Y8_SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
const CRAZYGAMES_SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const GD_SDK = 'https://html5.api.gamedistribution.com/main.min.js';
const YT_SDK = 'https://www.youtube.com/game_api/v1';

/** GameDistribution's snippet (GD-HTML5 wiki, SDK Implementation): GD_OPTIONS before the SDK, which GD's loader
 * inserts; onEvent queues the events for src/platform/gamedistribution.ts. The game ID comes from GD's panel. */
function gdSnippet(gameId: string): string {
  return `<script>
      window["GD_OPTIONS"] = {
        "gameId": ${JSON.stringify(gameId)},
        "onEvent": function (event) {
          var e = { name: event && event.name, message: event && event.message };
          (window.__gdEvents = window.__gdEvents || []).push(e);
          if (window.__gdOnEvent) window.__gdOnEvent(e);
        }
      };
      (function (d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        js.src = '${GD_SDK}';
        fjs.parentNode.insertBefore(js, fjs);
      }(document, 'script', 'gamedistribution-jssdk'));
    </script>`;
}

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
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const plugins: Plugin[] = [];
  if (name === 'playgama') plugins.push(playgama());
  if (name === 'gamepix') plugins.push(headScript('gamepix', `<script>window.GamePixConfig = { lifecycle: 'manual' };</script>\n    <script src="${GAMEPIX_SDK}"></script>`));
  if (name === 'y8') plugins.push(headScript('y8', `<script src="${Y8_SDK}" async></script>`));
  if (name === 'crazygames') plugins.push(headScript('crazygames', `<script src="${CRAZYGAMES_SDK}"></script>`));
  if (name === 'gamedistribution') plugins.push(headScript('gamedistribution', gdSnippet(env.VITE_GD_GAME_ID ?? '')));
  if (name === 'youtube') {
    // the Playables SDK before any game code; every aspect ratio, never a "rotate your phone" screen
    plugins.push(headScript('youtube', `<script src="${YT_SDK}"></script>`));
    plugins.push({ name: 'dttd-portrait', apply: 'build', transformIndexHtml: { order: 'post', handler: (html) => html.replace('<body>', '<body class="portrait-ok">') } });
  }
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
