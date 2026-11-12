import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SelectScene } from './scenes/SelectScene';
import { GameScene } from './scenes/GameScene';
import { Input } from './input';
import { installTestHooks } from './testHooks';

const dpr = Math.min(window.devicePixelRatio || 1, 2);
const size = () => ({ w: Math.max(1, Math.round(window.innerWidth * dpr)), h: Math.max(1, Math.round(window.innerHeight * dpr)) });
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
