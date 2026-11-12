// Test-only API (enabled with ?test in the URL). Lets the headless self-test drive
// the game deterministically: the real-time loop is put to sleep and the harness
// advances the game one fixed 1/60 s frame at a time.

import Phaser from 'phaser';
import type { GameScene } from './scenes/GameScene';
import { Input, Keys } from './input';
import { Save } from './save';
import { Audio, SfxName, renderSoundtrack } from './audio';
import { LEVELS } from './levels';

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

  const api = {
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
    start(level: number, replay?: [number, string][]) {
      game.scene.getScenes(true).forEach((s) => { if (s.scene.key !== 'Game') game.scene.stop(s.scene.key); });
      const g = game.scene.getScene('Game');
      if (g.scene.isActive()) g.scene.restart({ level });
      else game.scene.start('Game', { level });
      if (manual) step(2);
      if (replay) api.setReplay(replay);
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
