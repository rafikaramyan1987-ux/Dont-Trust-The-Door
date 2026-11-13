import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SelectScene } from './scenes/SelectScene';
import { GameScene } from './scenes/GameScene';
import { Input } from './input';
import { installTestHooks } from './testHooks';
import { Save } from './save';
import { setLang, detectLang, t } from './i18n';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/nunito/latin-ext-800.css';
import '@fontsource/nunito/latin-ext-900.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/cyrillic-900.css';

setLang(Save.get().lang ?? detectLang(navigator.languages ?? [navigator.language]));
document.title = t('ui.title');
const rot = document.getElementById('rotate');
if (rot) {
  rot.querySelector('[data-t="rotate"]')!.textContent = t('ui.rotate');
  rot.querySelector('[data-t="rotateSub"]')!.textContent = t('ui.rotateSub');
}

const dpr = Math.min(window.devicePixelRatio || 1, 2);
const size = () => ({ w: Math.max(1, Math.round(window.innerWidth * dpr)), h: Math.max(1, Math.round(window.innerHeight * dpr)) });

function start(): void {
  const s = size();
  const game = new Phaser.Game({
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

  const onResize = () => {
    const n = size();
    if (n.w !== game.scale.width || n.h !== game.scale.height) game.scale.resize(n.w, n.h);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 150));

  if (Input.isTest) installTestHooks(game);
}

// Text is drawn into canvases, so the bundled font must be loaded before the first scene.
Promise.race([
  Promise.all(['800', '900'].map((w) => document.fonts.load(`${w} 20px "Nunito"`, 'AaĞşİıЖжçÉ'))),
  new Promise((r) => setTimeout(r, 3000)),
]).catch(() => undefined).then(start);
