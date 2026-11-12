// Test-only API (enabled with ?test in the URL). Lets the headless self-test drive
// the game deterministically: the real-time loop is put to sleep and the harness
// advances the game one fixed 1/60 s frame at a time.

import Phaser from 'phaser';
import type { GameScene } from './scenes/GameScene';
import { Input, Keys } from './input';
import { Save } from './save';
import { Audio, SfxName, renderSoundtrack } from './audio';
import { LEVELS } from './levels';
import { Hero } from './game/Hero';
import { label } from './ui';
import { applyLayout } from './layout';
import { RES } from './art';

/** Test/marketing only: the hero's four expressions side by side. */
class ShowcaseScene extends Phaser.Scene {
  heroes: Hero[] = [];
  constructor() { super('Showcase'); }
  create(): void {
    applyLayout(this);
    this.add.image(-200, -200, 'bg-0').setOrigin(0).setDisplaySize(1680, 1120);
    this.add.tileSprite(-200, -200, 1680, 1120, 'dots-0').setOrigin(0).setTileScale(1 / RES);
    const names = ['HAPPY', 'FOCUSED', 'SHOCKED', 'DIZZY / DEAD'];
    this.heroes = names.map((n, i) => {
      const x = 200 + i * 293;
      const g = this.add.graphics();
      g.fillStyle(0x2b2d42, 0.12).fillEllipse(x, 470, 170, 30);
      label(this, x, 560, n, 34, '#fff6d5', 9);
      return new Hero(this, x, 470).setScale(4.2);
    });
    label(this, 640, 110, 'MEET THE HERO', 56, '#ffd23f', 12);
    this.heroes[2].flash('shock', 999);
    this.heroes[3].die();
  }
  update(_t: number, d: number): void {
    const dt = d / 1000;
    this.heroes[0].animate(dt, 0, true, false, 0);
    this.heroes[1].animate(dt, 300, true, false, 0);
    this.heroes[2].animate(dt, 0, true, false, 0);
    this.heroes[3].animate(dt, 0, true, false, 0);
  }
}

const FRAME = 1000 / 60;

export function expandReplay(rle: [number, string][]): Keys[] {
  const out: Keys[] = [];
  for (const [n, k] of rle) for (let i = 0; i < n; i++) out.push({ left: k.includes('L'), right: k.includes('R'), jump: k.includes('J') });
  return out;
}

export function installTestHooks(game: Phaser.Game): void {
  let manual = false;
  let clock = 0;
  const sfxLog: { tick: number; name: SfxName }[] = [];
  let frameCount = 0;
  const scene = () => game.scene.getScene('Game') as GameScene;
  Audio.onSfx = (name) => sfxLog.push({ tick: frameCount, name });

  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      clock += FRAME;
      frameCount++;
      game.step(clock, FRAME);
    }
  };

  // Tweens normally measure wall-clock time (Date.now). While the harness steps the game
  // manually, make them follow the stepped clock so captures are deterministic.
  const TM = Phaser.Tweens.TweenManager.prototype as unknown as { getDelta: (tick: boolean) => number };
  const origDelta = TM.getDelta;
  TM.getDelta = function (this: unknown, tick: boolean) {
    return manual ? FRAME : origDelta.call(this, tick);
  };
  game.scene.add('Showcase', ShowcaseScene, false);
  const api = {
    showcase() {
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start('Showcase');
      if (manual) step(3);
    },
    scene(key: string, data?: object) {
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start(key, data);
      if (manual) step(3);
    },
    levels: LEVELS.length,
    game,
    Save,
    /** Stop the real-time loop; from now on only step() advances the game. */
    setManual(on: boolean) {
      manual = on;
      if (on) { game.loop.sleep(); clock = performance.now(); }
      else game.loop.wake();
    },
    step,
    /** Advance n fixed frames holding the given keys ("L", "R", "J" letters). */
    hold(keys: string, n: number) {
      Input.bot = { left: keys.includes('L'), right: keys.includes('R'), jump: keys.includes('J') };
      step(n);
    },
    /** Pure simulation: run n fixed ticks without rendering (fast, same results). */
    sim(keys: string, n: number) {
      Input.bot = { left: keys.includes('L'), right: keys.includes('R'), jump: keys.includes('J') };
      const s = scene();
      for (let i = 0; i < n; i++) s.fixedTick();
    },
    release() { Input.bot = null; },
    kill() { scene().debugKill(); },
    snapCamera() { scene().debugSnapCamera(); },
    restart() { scene().restartLevel(); },
    /** Start a level; with `replay` the bot's recorded inputs drive it from tick 0.
     *  With `checkpoint` the attempt starts at the level's checkpoint flag. */
    start(level: number, replay?: [number, string][] | null, checkpoint = false) {
      game.scene.getScenes(true).forEach((s) => { if (s.scene.key !== 'Game') game.scene.stop(s.scene.key); });
      const g = game.scene.getScene('Game');
      const data = { level, replay: replay ? expandReplay(replay) : undefined, checkpoint };
      if (g.scene.isActive()) g.scene.restart(data);
      else game.scene.start('Game', data);
      if (manual) step(2);
    },
    setReplay(rle: [number, string][] | null) {
      const s = scene();
      s.replay = rle ? expandReplay(rle) : null;
    },
    state() {
      const s = scene();
      if (!s || !s.scene.isActive() || !s.hero) return null;
      return { ...s.snapshot(), paused: s.paused, scene: game.scene.getScenes(true).map((x) => x.scene.key) };
    },
    activeScenes() { return game.scene.getScenes(true).map((x) => x.scene.key); },
    sfxLog,
    frame() { return frameCount; },
    resetSave() { Save.reset(); },
    async soundtrack(seconds: number, events: { t: number; name: SfxName }[]) {
      const bytes = await renderSoundtrack(seconds, events);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    isManual: () => manual,
  };
  (window as unknown as { __DTTD: typeof api }).__DTTD = api;
}
