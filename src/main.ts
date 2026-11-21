import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SelectScene } from './scenes/SelectScene';
import { GameScene } from './scenes/GameScene';
import { Input } from './input';
import { installTestHooks } from './testHooks';
import { Save } from './save';
import { setLang, detectLang, t } from './i18n';
import { Portal, PortalState } from './platform';
import { Audio } from './audio';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/nunito/latin-ext-800.css';
import '@fontsource/nunito/latin-ext-900.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/cyrillic-900.css';

/**
 * The language: the player's own 🌐 choice, else the portal's (if supported), else the browser's where the portal's
 * rules allow it (Playgama, CrazyGames and YouTube: never), else English.
 */
function applyLanguage(): void {
  const browser = Portal.policy.browserLanguage ? (navigator.languages ?? [navigator.language]) : [];
  const portal = Portal.locale();
  setLang(Save.get().lang ?? detectLang(portal ? [portal, ...browser] : browser));
  document.title = t('ui.title');
  const rot = document.getElementById('rotate');
  if (rot) {
    rot.querySelector('[data-t="rotate"]')!.textContent = t('ui.rotate');
    rot.querySelector('[data-t="rotateSub"]')!.textContent = t('ui.rotateSub');
  }
}

const dpr = Math.min(window.devicePixelRatio || 1, 2);
const size = () => ({ w: Math.max(1, Math.round(window.innerWidth * dpr)), h: Math.max(1, Math.round(window.innerHeight * dpr)) });

let game: Phaser.Game | null = null;

function start(): void {
  const s = size();
  const g = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#2b2d42',
    width: s.w,
    height: s.h,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    render: { antialias: true, roundPixels: false, preserveDrawingBuffer: Input.isTest, powerPreference: 'high-performance' },
    input: { activePointers: 4 },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false, fps: 60, fixedStep: true } },
    fps: { target: 60, smoothStep: true },
    scene: [BootScene, TitleScene, SelectScene, GameScene],
    banner: false,
  });
  game = g;

  const onResize = () => {
    const n = size();
    if (n.w !== g.scale.width || n.h !== g.scale.height) g.scale.resize(n.w, n.h);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 150));

  if (Input.isTest) installTestHooks(g);
}

async function boot(): Promise<void> {
  Portal.onPause = (p) => {
    PortalState.paused = p;
    // YouTube: a pause stops everything (loop, rendering), not only the level
    if (Portal.policy.pauseLoop && game) {
      if (p) game.loop.sleep();
      else game.loop.wake();
    }
  };
  Save.persistLanguage(Portal.policy.persistLanguage);
  Portal.onMute = (m) => {
    PortalState.muted = m;
    Audio.setSysMuted(m);
  };
  await Portal.init().catch(() => undefined);
  Portal.loading(20);
  // YouTube: the Playable may get the focus without a tap; sound must not wait for one (it stays silent while
  // YouTube's audio is off: Portal.onMute above)
  if (Portal.name === 'youtube') Audio.unlock();
  // the portal's store holds the save in those builds (same key, same format)
  const kv = Portal.storage();
  if (kv) Save.use(kv);
  applyLanguage();
  Portal.loading(50);
  // Text is drawn into canvases, so the bundled font must be loaded before the first scene.
  await Promise.race([
    Promise.all(['800', '900'].map((w) => document.fonts.load(`${w} 20px "Nunito"`, 'AaĞşİıЖжçÉ'))),
    new Promise((r) => setTimeout(r, 3000)),
  ]).catch(() => undefined);
  Portal.loading(90);
  start();
  // the recorded sounds load in the background (the first scene does not wait for them)
  void Audio.preload();
}

void boot();
