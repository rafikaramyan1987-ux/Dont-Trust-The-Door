import Phaser from 'phaser';
import { TILE, ROWS, WORLD_W, WORLD_H, PHYS, DT, TICK_MS, RESTART_TICKS, PALETTES, Palette } from '../config';
import { LEVELS } from '../levels';
import type { LevelData, GroupDef, TriggerDef, Action, TileChar } from '../levels/schema';
import { drawTerrain, addTerrainTexture, makeTerrainTileset, maskAt, RES, TILESET_PAD } from '../art';
import { Hero } from '../game/Hero';
import { Door } from '../game/Door';
import { Input, Keys } from '../input';
import { Audio, SfxName } from '../audio';
import { Save } from '../save';
import { applyLayout, Layout } from '../layout';
import { Button, label, panel, bubble } from '../ui';

type Dir = 'up' | 'down' | 'left' | 'right';
const SPIKE_DIR: Record<string, Dir> = { '^': 'up', v: 'down', '<': 'left', '>': 'right' };
const SPIKE_ROT: Record<Dir, number> = { up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };

interface R { x: number; y: number; w: number; h: number }
const overlap = (a: R, b: R) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function spikeHit(tx: number, ty: number, d: Dir): R {
  const x = tx * TILE, y = ty * TILE;
  switch (d) {
    case 'up': return { x: x + 6, y: y + 19, w: 28, h: 21 };
    case 'down': return { x: x + 6, y, w: 28, h: 21 };
    case 'left': return { x: x + 19, y: y + 6, w: 21, h: 28 };
    case 'right': return { x, y: y + 6, w: 21, h: 28 };
  }
}

interface Spike { tx: number; ty: number; dir: Dir; img: Phaser.GameObjects.Image; group: GroupRT | null; extend: number }
interface Coin { tx: number; ty: number; img: Phaser.GameObjects.Image; group: GroupRT | null; taken: boolean; spiky: boolean }
interface Pad { tx: number; ty: number; img: Phaser.GameObjects.Image; group: GroupRT | null; squashT: number; tex: string }
interface Ball { tx: number; ty: number; img: Phaser.GameObjects.Image; group: GroupRT | null }

interface MoveState {
  fx: number; fy: number; tx: number; ty: number; t: number; dur: number;
  deadly: boolean; returnAfter?: number; returnTicks?: number; back: boolean;
}

interface GroupRT {
  id: string;
  def: GroupDef;
  tiles: { tx: number; ty: number }[];
  container: Phaser.GameObjects.Container;
  bodies: Phaser.GameObjects.Zone[];
  ox: number; oy: number;
  visible: boolean;
  solid: boolean;
  state: 'idle' | 'shaking' | 'falling' | 'gone';
  shakeT: number;
  fallV: number;
  move: MoveState | null;
  chase: { vx: number; vy: number; untilX?: number; untilY?: number } | null;
  /** Movement this tick (moving platforms carry the hero). */
  dx: number;
  dy: number;
  deadlyMove: boolean;
  /** A deadly move just finished: still deadly for this one tick (the landing frame). */
  deadlyEnd: boolean;
}

interface TriggerRT { def: TriggerDef; fired: boolean }

export interface Snapshot {
  level: number;
  levelTick: number;
  tick: number;
  state: string;
  x: number; y: number; vx: number; vy: number;
  grounded: boolean;
  deathsLevel: number;
  deathsTotal: number;
  gravity: number;
  fired: string[];
  doorX: number; doorY: number;
  lastDeath: string;
  trolls: string[];
  checkpoint: boolean;
  worldW: number;
  controlsFlipped: boolean;
  hudDeaths: string;
  ctrlMode: string;
  gScale: number;
  camFrozen: boolean;
  camFlip: boolean;
  camZoom: number;
  hintUsed: boolean;
  hint: string;
  /** Group offsets/visibility, e.g. g.c = [ox, oy, visible] (bot plans time moving parts). */
  g: Record<string, [number, number, number]>;
  cpX: number;
  zoom: number;
  viewTiles: number;
}

export class GameScene extends Phaser.Scene {
  levelNum = 1;
  lvl!: LevelData;
  pal!: Palette;
  private lay!: Layout;

  // simulation state
  tick = 0;
  levelTick = 0;
  private acc = 0;
  private slowmo = 0;
  state: 'play' | 'dead' | 'won' = 'play';
  paused = false;
  private stateT = 0;
  private gdir = 1;
  private grounded = false;
  private wasGrounded = false;
  private coyote = 0;
  private buffer = 0;
  private jumping = false;
  private prevJump = false;
  private lastVy = 0;
  private spawn = { x: 0, y: 0 };
  deathsLevel = 0;
  lastDeath = '';
  /** Replay input for the scripted bot (RLE expanded), indexed by levelTick. */
  replay: Keys[] | null = null;

  // world objects
  private objs: Phaser.GameObjects.GameObject[] = [];
  private statics!: Phaser.Physics.Arcade.StaticGroup;
  private dyn!: Phaser.Physics.Arcade.Group;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private player!: Phaser.GameObjects.Zone;
  private pbody!: Phaser.Physics.Arcade.Body;
  hero!: Hero;
  private door: Door | null = null;
  private doorPos = { x: 0, y: 0 };
  private doorPath: { x: number; y: number }[] = [];
  private doorSpeed = 0;
  private doorWait = 0;
  private doorVx = 0;
  private fakeDoors: { door: Door; x: number; y: number; flipped: boolean; group: GroupRT | null }[] = [];
  private balls: Ball[] = [];
  private spikes: Spike[] = [];
  private coins: Coin[] = [];
  private pads: Pad[] = [];
  private groups = new Map<string, GroupRT>();
  private triggers: TriggerRT[] = [];
  private scheduled: { at: number; actions: Action[]; every?: number; repeat?: boolean }[] = [];
  /** World x of every death in this level (hints appear near where you keep dying). */
  private deathXs: number[] = [];
  private fired = new Set<string>();
  private hints: { obj: Phaser.GameObjects.Text; after: number }[] = [];
  private staticSolid = new Set<number>();
  private fakeWalls: GroupRT[] = [];
  /** Level width in tiles / pixels (levels scroll horizontally). */
  cols = 32;
  worldW = WORLD_W;
  private cp: { x: number; y: number; tx: number } | null = null;
  /** Checkpoint reached in this attempt series: deaths respawn there. */
  cpActive = false;
  private cpFlag: Phaser.GameObjects.Image | null = null;
  /** Troll ids that have fired at least once since the level was entered. */
  trollsFired = new Set<string>();
  private ctrlFlip = false;
  /** Control mode set by traps: normal, swapped, jump disabled, or forced running. */
  private ctrlMode: 'normal' | 'flip' | 'nojump' | 'autorun' = 'normal';
  /** Gravity strength multiplier (low / heavy gravity traps). */
  private gScale = 1;
  /** Ticks during which air control is off after a sideways spring. */
  private launchLock = 0;
  /** Camera tricks. */
  private camFrozen = false;
  private baseZoom = 1;
  private camFlip = false;
  private camZoomMul = 1;
  private fakeClearUI: Phaser.GameObjects.Container | null = null;
  /** Group the hero is standing on (moving platforms carry the hero). */
  private ride: GroupRT | null = null;
  private camX = 0;
  private camY = 0;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private hintBtn!: Button;
  /** The level's one hint has been spent (resets only when the level is started anew). */
  hintUsed = false;
  hintShown: { id: string; text: string } | null = null;
  private hintBox: Phaser.GameObjects.Container | null = null;
  private tutorialMaxX = 0;
  private touches = new Map<number, keyof Keys>();

  // presentation
  private bg!: Phaser.GameObjects.Image;
  private dots!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;
  private hud!: Phaser.GameObjects.Container;
  private deathText!: Phaser.GameObjects.Text;
  private deathIcon!: Phaser.GameObjects.Image;
  private levelText!: Phaser.GameObjects.Text;
  private quip!: Phaser.GameObjects.Text;
  private sysButtons: Button[] = [];
  private muteBtn!: Button;
  private touchUI!: Phaser.GameObjects.Container;
  private touchBtns: { key: keyof Keys; img: Phaser.GameObjects.Container; zone: R }[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private emitDeath!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emitDust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private emitConfetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bubbles: { c: Phaser.GameObjects.Container; until: number; follow?: 'door' | 'hero' }[] = [];
  private offInput: (() => void) | null = null;


  constructor() {
    super('Game');
  }

  init(data: { level?: number; replay?: Keys[]; checkpoint?: boolean }): void {
    this.levelNum = Phaser.Math.Clamp(data.level ?? 1, 1, LEVELS.length);
    this.cpActive = !!data.checkpoint;
    this.hintUsed = false;
    this.hintShown = null;
    this.hintBox = null;
    this.touches = new Map();
    this.deathXs = [];
    this.trollsFired = new Set();
    this.ctrlFlip = false;
    this.deathsLevel = 0;
    this.replay = data.replay ?? null;
    this.paused = false;
    this.overlay = null;
    this.tick = 0;
    this.acc = 0;
    this.objs = [];
    this.groups = new Map();
    this.spikes = [];
    this.coins = [];
    this.pads = [];
    this.balls = [];
    this.triggers = [];
    this.scheduled = [];
    this.fired = new Set();
    this.fakeDoors = [];
    this.fakeWalls = [];
    this.hints = [];
    this.colliders = [];
    this.door = null;
    this.lastDeath = '';
    this.bubbles = [];
    this.sysButtons = [];
    this.touchBtns = [];
  }

  create(): void {
    this.lvl = LEVELS[this.levelNum - 1];
    this.pal = PALETTES[this.lvl.world % PALETTES.length];
    this.physics.world.isPaused = true; // we step it manually, one fixed tick at a time
    this.cols = Math.max(...this.lvl.map.map((r) => r.length));
    this.worldW = this.cols * TILE;
    this.physics.world.setBounds(0, -400, this.worldW, WORLD_H + 800);
    this.physics.world.setBoundsCollision(true, true, false, false);

    // Two cameras: the main one shows the scrolling world, the UI camera shows the HUD,
    // touch buttons and overlays in a fixed 1280×720 design space.
    this.worldLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(100);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    this.cameras.main.ignore(this.uiLayer);
    this.uiCam.ignore(this.worldLayer);

    this.bg = this.add.image(0, 0, `bg-${this.lvl.world % PALETTES.length}`).setScrollFactor(0).setDepth(-20);
    this.dots = this.add.tileSprite(0, 0, 64, 64, `dots-${this.lvl.world % PALETTES.length}`).setScrollFactor(0).setDepth(-19);
    this.dots.setTileScale(1 / RES);
    const wi = this.lvl.world % PALETTES.length;
    this.clouds = this.add.tileSprite(0, 0, 64, 64, 'clouds').setScrollFactor(0).setDepth(-18).setTileScale(1 / RES);
    this.hills = this.add.tileSprite(0, 0, 64, 64, `hills-${wi}`).setScrollFactor(0).setDepth(-17).setTileScale(1 / RES);
    this.worldLayer.add([this.bg, this.dots, this.clouds, this.hills]);

    this.makeEmitters();
    this.buildHud();
    this.buildTouch();
    this.relayout();
    this.scale.on('resize', this.relayout, this);
    window.addEventListener('dttd-touchui', this.onTouchUI);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.relayout, this);
      window.removeEventListener('dttd-touchui', this.onTouchUI);
      this.offInput?.();
    });
    this.offInput = Input.on((c) => {
      if (c === 'pause') this.togglePause();
      else if (c === 'restart' && !this.overlay) this.restartLevel();
      else if (c === 'mute') this.toggleMute();
      else if (c === 'confirm' && this.overlay && this.state === 'won') this.nextLevel();
    });

    this.buildLevel();
    Audio.startMusic();
    this.cameras.main.fadeIn(180, 43, 45, 66);
  }

  private onTouchUI = () => {
    this.relayout();
  };

  // -------------------------------------------------------------------------
  // Layout

  private relayout(): void {
    this.uiCam.setSize(this.scale.width, this.scale.height);
    this.lay = applyLayout(this, this.uiCam);
    const L = this.lay;
    this.layoutWorldCamera();

    // system buttons: in the right pillar on touch layouts, top-right otherwise
    const P = L.pillar;
    const [hint, restart, mute, pause] = this.sysButtons;
    if (P > 60) {
      // right pillar: a big restart + pause; left pillar: level name, sound, hint
      const size = Math.min(72, P * 0.4);
      const top = Math.max(L.top, 0) + size * 0.7;
      for (const b of this.sysButtons) b.setScale(size / 64);
      restart.setScale((size / 64) * 1.15);
      restart.setPosition(WORLD_W + P / 2 - size * 0.62, top);
      pause.setPosition(WORLD_W + P / 2 + size * 0.62, top);
      mute.setPosition(-P / 2 - size * 0.58, top + size * 1.25);
      hint.setPosition(-P / 2 + size * 0.58, top + size * 1.25);
    } else {
      [hint, restart, mute, pause].forEach((b, i) => {
        b.setScale(i === 1 ? 1.15 : 1);
        b.setPosition(WORLD_W - 46 - (3 - i) * 74, 40);
      });
    }
    this.levelText.setPosition(P > 60 ? -P / 2 : 24, P > 60 ? Math.max(L.top, 0) + 34 : 30);
    this.levelText.setOrigin(P > 60 ? 0.5 : 0, 0.5);
    this.levelText.setWordWrapWidth(P > 60 ? (P - 10) * RES : 600 * RES);
    this.layoutTouch();
    if (this.overlay) this.overlay.getByName('dim')?.setData('fit', true);
    this.fitDim();
  }

  /**
   * World camera: its viewport excludes the touch-button pillars; zoom shows ~22 tiles
   * across on touch screens (bigger hero) and the full 18-tile height on desktop.
   */
  private layoutWorldCamera(): void {
    const L = this.lay;
    const cam = this.cameras.main;
    const W = this.scale.width, H = this.scale.height;
    const px = Math.round(L.pillar * L.zoom);
    const vw = Math.max(1, W - px * 2);
    cam.setViewport(px, 0, vw, H);
    const tilesAcross = L.touch ? 22 : 32;
    const zoom = Math.max(H / WORLD_H, vw / (tilesAcross * TILE));
    this.baseZoom = zoom;
    cam.setZoom(zoom * this.camZoomMul);
    cam.setBounds(0, 0, this.worldW, WORLD_H);
    const pad = 200;
    this.bg.setPosition(vw / 2, H / 2).setDisplaySize(vw / zoom + pad, H / zoom + pad);
    this.dots.setPosition(vw / 2, H / 2).setSize(vw / zoom + pad, H / zoom + pad);
    // scenery: clouds across the top, hills along the bottom (parallax in applyCamera)
    this.clouds.setOrigin(0.5, 0).setPosition(vw / 2, H / 2 - H / zoom / 2 + 10).setSize(vw / zoom + pad, 300);
    this.hills.setOrigin(0.5, 1).setPosition(vw / 2, H / 2 + H / zoom / 2).setSize(vw / zoom + pad, 260);
    if (this.pbody) this.snapCamera();
  }

  private snapCamera(): void {
    this.camX = this.pbody.center.x;
    this.camY = this.pbody.center.y - 40;
    this.applyCamera();
  }

  private applyCamera(): void {
    const cam = this.cameras.main;
    const hw = cam.width / cam.zoom / 2, hh = cam.height / cam.zoom / 2;
    this.camX = Phaser.Math.Clamp(this.camX, hw, Math.max(hw, this.worldW - hw));
    this.camY = Phaser.Math.Clamp(this.camY, hh, Math.max(hh, WORLD_H - hh));
    cam.centerOn(this.camX, this.camY);
    this.dots.tilePositionX = cam.scrollX * 0.35 * RES;
    this.dots.tilePositionY = cam.scrollY * 0.35 * RES;
    this.clouds.tilePositionX = cam.scrollX * 0.12 * RES + this.time.now * 0.004 * RES;
    this.hills.tilePositionX = cam.scrollX * 0.25 * RES;
  }

  /** Camera tricks used by the "the camera lies" traps (presentation only). */
  private cameraTrick(t: 'freeze' | 'follow' | 'flip' | 'unflip' | 'zoom' | 'unzoom' | 'reset'): void {
    const cam = this.cameras.main;
    if (t === 'reset') {
      this.camFrozen = false;
      this.camFlip = false;
      this.camZoomMul = 1;
      this.tweens.killTweensOf(cam);
      cam.setRotation(0);
      return;
    }
    if (t === 'freeze') this.camFrozen = true;
    if (t === 'follow') this.camFrozen = false;
    if (t === 'flip' || t === 'unflip') {
      this.camFlip = t === 'flip';
      this.tweens.add({ targets: cam, rotation: this.camFlip ? Math.PI : 0, duration: 380, ease: 'Sine.InOut' });
      this.sfx('flip');
    }
    if (t === 'zoom') this.camZoomMul = 2.3;
    if (t === 'unzoom') this.camZoomMul = 1;
  }

  /** A fake "level clear" card: looks real, blocks the view, does not stop the game. */
  private showFakeClear(on: boolean): void {
    if (!on) {
      this.fakeClearUI?.destroy();
      this.fakeClearUI = null;
      return;
    }
    if (this.fakeClearUI) return;
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    const c = this.add.container(0, 0).setDepth(180);
    c.add(panel(this, cx, cy, 640, 420, 0xfff6d5));
    c.add(label(this, cx, cy - 130, `LEVEL ${this.levelNum} CLEAR`, 30, '#6fd36b', 7));
    c.add(label(this, cx, cy - 64, 'Too easy!', 46, '#ffd23f', 10));
    c.add(label(this, cx, cy + 10, `Deaths this level: ${this.deathsLevel}`, 28, '#ffffff', 7));
    const nx = new Button(this, cx + 150, cy + 130, { w: 190, h: 72, icon: 'play', text: 'Next', fontSize: 30, color: '#6fd36b' }, () => this.say('lol', 'hero', 40));
    c.add(nx);
    this.uiLayer.add(c);
    this.cameras.main.ignore([c, nx]);
    this.fakeClearUI = c;
    this.sfx('win');
  }

  private fitDim(): void {
    if (!this.overlay) return;
    const d = this.overlay.getByName('dim') as Phaser.GameObjects.Rectangle | null;
    if (d) d.setPosition(this.lay.left - 20, this.lay.top - 20).setSize(this.lay.right - this.lay.left + 40, this.lay.bottom - this.lay.top + 40);
  }

  // -------------------------------------------------------------------------
  // HUD & controls

  private buildHud(): void {
    this.hud = this.add.container(0, 0).setDepth(100);
    this.deathIcon = this.add.image(WORLD_W / 2 - 34, 34, 'skull').setScale(1.15 / RES);
    this.deathText = label(this, WORLD_W / 2 + 8, 34, '0', 40, '#fff6d5', 9).setOrigin(0, 0.5);
    this.quip = label(this, WORLD_W / 2, 84, '', 26, '#ffd23f', 7).setAlpha(0);
    this.levelText = label(this, 24, 30, `${this.levelNum}. ${this.lvl.name}`, 22, '#fff6d5', 6).setOrigin(0, 0.5);
    this.hud.add([this.deathIcon, this.deathText, this.quip, this.levelText]);
    this.uiLayer.add(this.hud);
    const mk = (icon: string, fn: () => void, color = '#5b8cff') => {
      const b = new Button(this, 0, 0, { w: 60, h: 56, icon, color, radius: 16 }, fn);
      b.setDepth(101);
      this.uiLayer.add(b);
      this.cameras.main.ignore(b);
      this.sysButtons.push(b);
      return b;
    };
    this.hintBtn = mk('bulb', () => this.useHint(), '#f2b705');
    mk('restart', () => this.restartLevel(), '#ff6a3d');
    this.muteBtn = mk(Audio.muted ? 'mute' : 'sound', () => this.toggleMute());
    mk('pause', () => this.togglePause());
    this.updateDeathText(false);
  }

  private updateDeathText(bump: boolean): void {
    this.deathText.setText(String(Save.get().totalDeaths));
    if (bump) {
      this.tweens.killTweensOf([this.deathText, this.deathIcon]);
      this.deathText.setScale(1.6 / RES);
      this.deathIcon.setScale(1.6 / RES).setAngle(-15);
      this.tweens.add({ targets: this.deathText, scale: 1 / RES, duration: 260, ease: 'Back.Out' });
      this.tweens.add({ targets: this.deathIcon, scale: 1.15 / RES, angle: 0, duration: 260, ease: 'Back.Out' });
    }
  }

  private toggleMute(): void {
    Audio.unlock();
    const m = Audio.toggleMute();
    this.muteBtn.setIcon(m ? 'mute' : 'sound');
  }

  private buildTouch(): void {
    this.touchUI = this.add.container(0, 0).setDepth(90);
    this.uiLayer.add(this.touchUI);
    const mk = (key: keyof Keys, icon: string) => {
      const c = this.add.container(0, 0);
      const g = this.add.graphics();
      const ic = this.add.image(0, 0, `icon-${icon}`).setScale(1.5 / RES);
      c.add([g, ic]);
      c.setData('g', g);
      this.touchUI.add(c);
      this.touchBtns.push({ key, img: c, zone: { x: 0, y: 0, w: 0, h: 0 } });
    };
    mk('left', 'left');
    mk('right', 'right');
    mk('jump', 'up');
    // Native touch handling (more reliable than generic pointers on phones): every finger
    // "captures" the button it first touched and keeps it until it is lifted, so a rolling
    // thumb never releases ▲ early (a released jump is cut short). ◀ and ▶ may slide
    // into each other like a d-pad.
    const canvas = this.game.canvas;
    const toUi = (t: Touch) => {
      const r = canvas.getBoundingClientRect();
      const sx = this.scale.width / r.width, sy = this.scale.height / r.height;
      return this.uiCam.getWorldPoint((t.clientX - r.left) * sx, (t.clientY - r.top) * sy);
    };
    const zoneAt = (t: Touch): keyof Keys | null => {
      const wp = toUi(t);
      for (const b of this.touchBtns) if (wp.x >= b.zone.x && wp.x <= b.zone.x + b.zone.w && wp.y >= b.zone.y && wp.y <= b.zone.y + b.zone.h) return b.key;
      return null;
    };
    const onStart = (e: TouchEvent) => {
      Audio.unlock();
      if (!this.lay?.touch || this.overlay) return;
      for (const t of Array.from(e.changedTouches)) {
        const k = zoneAt(t);
        if (k) this.touches.set(t.identifier, k);
      }
      this.syncTouch();
    };
    const onMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const cur = this.touches.get(t.identifier);
        if (cur === 'left' || cur === 'right') {
          const k = zoneAt(t);
          if (k === 'left' || k === 'right') this.touches.set(t.identifier, k);
        }
      }
      this.syncTouch();
    };
    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) this.touches.delete(t.identifier);
      this.syncTouch();
    };
    const opts: AddEventListenerOptions = { passive: true };
    canvas.addEventListener('touchstart', onStart, opts);
    canvas.addEventListener('touchmove', onMove, opts);
    canvas.addEventListener('touchend', onEnd, opts);
    canvas.addEventListener('touchcancel', onEnd, opts);
    this.input.on('pointerdown', () => Audio.unlock());
    this.events.once('shutdown', () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
      canvas.removeEventListener('touchcancel', onEnd);
      this.touches.clear();
      Input.touch.left = Input.touch.right = Input.touch.jump = false;
    });
  }

  private syncTouch(): void {
    const t = { left: false, right: false, jump: false };
    this.touches.forEach((k) => { t[k] = true; });
    Input.touch.left = t.left;
    Input.touch.right = t.right;
    Input.touch.jump = t.jump;
    for (const b of this.touchBtns) b.img.setAlpha(t[b.key] ? 1 : 0.7).setScale(t[b.key] ? 0.94 : 1);
  }

  private layoutTouch(): void {
    const L = this.lay;
    this.touchUI.setVisible(L.touch);
    if (!L.touch) return;
    const P = L.pillar;
    const bottom = Math.min(L.bottom, WORLD_H + (L.bottom - WORLD_H)) - 14;
    const usableH = L.bottom - L.top;
    if (P > 60) {
      // Buttons live in the side pillars, outside the level.
      const bw = P / 2 - 10;
      const bh = Math.min(usableH * 0.42, bw * 1.9);
      const draw = (i: number, x: number, y: number, w: number, h: number) => {
        const b = this.touchBtns[i];
        const g = b.img.getData('g') as Phaser.GameObjects.Graphics;
        g.clear();
        g.fillStyle(0x2b2d42, 0.5);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(28, w / 3));
        g.lineStyle(6, 0xffffff, 0.95);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(28, w / 3));
        b.img.setPosition(x + w / 2, y + h / 2);
        b.img.setData('size', { w, h });
        // hit zone is generous: full pillar half, lower 65% of the screen
        b.zone = { x: x - 5, y: L.top + usableH * 0.3, w: w + 10, h: usableH * 0.7 + 40 };
        b.img.setAlpha(0.7);
      };
      const left0 = L.left + 6;
      draw(0, left0, bottom - bh, bw, bh);
      draw(1, left0 + bw + 8, bottom - bh, bw, bh);
      const jw = P - 16;
      draw(2, WORLD_W + 8, bottom - jw * 1.1, jw, jw * 1.1);
      this.touchBtns[2].zone = { x: WORLD_W, y: L.top + usableH * 0.3, w: P + 20, h: usableH * 0.7 + 40 };
    } else {
      // Fallback (very wide level vs screen): corner buttons over the ground.
      const s = 110;
      const draw = (i: number, x: number, y: number) => {
        const b = this.touchBtns[i];
        const g = b.img.getData('g') as Phaser.GameObjects.Graphics;
        g.clear();
        g.fillStyle(0x2b2d42, 0.4);
        g.fillCircle(0, 0, s / 2);
        g.lineStyle(5, 0xffffff, 0.7);
        g.strokeCircle(0, 0, s / 2);
        b.img.setPosition(x, y);
        b.img.setData('size', { w: s, h: s });
        b.zone = { x: x - s / 2 - 10, y: y - s / 2 - 10, w: s + 20, h: s + 20 };
      };
      draw(0, 70, WORLD_H - 70);
      draw(1, 200, WORLD_H - 70);
      draw(2, WORLD_W - 80, WORLD_H - 70);
    }
  }

  private makeEmitters(): void {
    this.emitDeath = this.add.particles(0, 0, 'p-dot', {
      speed: { min: 180, max: 520 }, angle: { min: 0, max: 360 }, scale: { start: 0.9, end: 0 },
      lifespan: { min: 300, max: 650 }, gravityY: 900, tint: [0xffd23f, 0xffe066, 0xff8a5b, 0xffffff], emitting: false,
    }).setDepth(30);
    this.emitDust = this.add.particles(0, 0, 'p-puff', {
      speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 }, scale: { start: 0.9, end: 0.2 },
      alpha: { start: 0.8, end: 0 }, lifespan: 380, emitting: false,
    }).setDepth(4);
    this.emitConfetti = this.add.particles(0, 0, 'p-confetti', {
      speed: { min: 200, max: 600 }, angle: { min: 220, max: 320 }, rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.6 }, lifespan: 1100, gravityY: 800,
      tint: [0xff6f91, 0xffd23f, 0x5b8cff, 0x6fd36b, 0x41c6c0], emitting: false,
    }).setDepth(30);
    this.worldLayer.add([this.emitDeath, this.emitDust, this.emitConfetti]);
  }

  // -------------------------------------------------------------------------
  // Level construction

  private clearLevel(): void {
    for (const c of this.colliders) c.destroy();
    this.colliders = [];
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.statics?.destroy(true);
    this.dyn?.destroy(true);
    for (const b of this.bubbles) b.c.destroy();
    this.bubbles = [];
    this.groups.clear();
    this.spikes = [];
    this.coins = [];
    this.pads = [];
    this.balls = [];
    this.triggers = [];
    this.scheduled = [];
    this.fired.clear();
    this.fakeDoors = [];
    this.fakeWalls = [];
    this.hints = [];
    this.door = null;
    this.cpFlag = null;
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    this.worldLayer.add(o);
    return o;
  }

  private buildLevel(): void {
    const L = this.lvl;
    const map = L.map;
    const gdefs = L.groups ?? {};
    const groupTiles = new Map<string, { tx: number; ty: number }[]>();
    const staticTiles: { tx: number; ty: number }[] = [];
    this.staticSolid = new Set();
    const solidAll = new Set<number>();
    const key = (x: number, y: number) => y * 1000 + x;
    const COLS = this.cols;
    let doorAt: { tx: number; ty: number } | null = null;
    const fakeAt: { tx: number; ty: number }[] = [];
    let cpAt: { tx: number; ty: number } | null = null as { tx: number; ty: number } | null;
    const spikeTiles: { tx: number; ty: number; ch: string }[] = [];
    const padTiles: { tx: number; ty: number }[] = [];
    const coinTiles: { tx: number; ty: number }[] = [];
    const ballTiles: { tx: number; ty: number }[] = [];

    for (let ty = 0; ty < ROWS; ty++) {
      const row = map[ty] ?? '';
      for (let tx = 0; tx < COLS; tx++) {
        const ch = row[tx] ?? '.';
        if (ch === '#') { staticTiles.push({ tx, ty }); this.staticSolid.add(key(tx, ty)); solidAll.add(key(tx, ty)); }
        else if (ch in SPIKE_DIR) spikeTiles.push({ tx, ty, ch });
        else if (ch === '=') padTiles.push({ tx, ty });
        else if (ch === 'o') coinTiles.push({ tx, ty });
        else if (ch === '*') ballTiles.push({ tx, ty });
        else if (ch === 'P') this.spawn = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
        else if (ch === 'D') doorAt = { tx, ty };
        else if (ch === 'F') fakeAt.push({ tx, ty });
        else if (ch === 'C') cpAt = { tx, ty };
        else if (ch >= 'a' && ch <= 'z') {
          if (!groupTiles.has(ch)) groupTiles.set(ch, []);
          groupTiles.get(ch)!.push({ tx, ty });
          const d = gdefs[ch];
          if (d && d.tile === '#' && !d.hidden && !d.fake) solidAll.add(key(tx, ty));
        }
      }
    }
    for (const [, d] of Object.entries(gdefs)) if (d.tile === '#' && !d.hidden && !d.fake) for (const [cx, cy] of d.cover ?? []) solidAll.add(key(cx, cy));
    const isSolidAll = (x: number, y: number): boolean => solidAll.has(key(Math.max(0, Math.min(COLS - 1, x)), Math.max(0, Math.min(ROWS - 1, y))));

    // Static terrain: an auto-tiled tilemap (only visible tiles are drawn), so levels can
    // be far wider than any single texture could be.
    if (!this.textures.exists(`grp-${L.id}-marker`)) {
      this.textures.getTextureKeys().filter((k) => k.startsWith('grp-')).forEach((k) => this.textures.remove(k));
      this.textures.addCanvas(`grp-${L.id}-marker`, document.createElement('canvas'));
    }
    const tsKey = `tileset-${this.lvl.world % PALETTES.length}`;
    makeTerrainTileset(this, tsKey, this.pal);
    const data: number[][] = [];
    for (let ty = 0; ty < ROWS; ty++) {
      const row: number[] = [];
      for (let tx = 0; tx < COLS; tx++) row.push(this.staticSolid.has(key(tx, ty)) ? ((tx * 7 + ty * 13) % 3) * 16 + maskAt(isSolidAll, tx, ty) : -1);
      data.push(row);
    }
    const F = TILE * RES;
    const tmap = this.make.tilemap({ data, tileWidth: F, tileHeight: F });
    const tset = tmap.addTilesetImage(tsKey, tsKey, F, F, TILESET_PAD, TILESET_PAD * 2)!;
    const layer = tmap.createLayer(0, tset, 0, 0)!;
    layer.setScale(1 / RES).setDepth(0);
    this.track(layer);

    // Extend solid bottom / top rows past the level edge so wide screens never show floating ground.
    const ext = this.track(this.add.graphics().setDepth(-0.5));
    const outline = Phaser.Display.Color.HexStringToColor(this.pal.outline).color;
    const fillC = Phaser.Display.Color.HexStringToColor(this.pal.block).color;
    const WW = this.worldW;
    for (const [row, y0, h] of [[ROWS - 1, WORLD_H - 2, 600], [0, -600, 602]] as const) {
      let x = 0;
      while (x < COLS) {
        if (!isSolidAll(x, row)) { x++; continue; }
        let x2 = x;
        while (x2 + 1 < COLS && isSolidAll(x2 + 1, row)) x2++;
        const ex0 = x === 0 ? -800 : x * TILE, ex1 = x2 === COLS - 1 ? WW + 800 : (x2 + 1) * TILE;
        ext.fillStyle(outline, 1).fillRect(ex0, y0, ex1 - ex0, h);
        ext.fillStyle(fillC, 1).fillRect(ex0 + (x === 0 ? 0 : 4), y0, ex1 - ex0 - (x === 0 ? 0 : 4) - (x2 === COLS - 1 ? 0 : 4), h);
        x = x2 + 1;
      }
    }
    // the same for the leftmost / rightmost columns (side pillars)
    for (const [col, x0] of [[0, -800], [COLS - 1, WW]] as const) {
      for (let y = 0; y < ROWS; y++) if (isSolidAll(col, y)) ext.fillStyle(fillC, 1).fillRect(x0, y * TILE + (isSolidAll(col, y - 1) ? 0 : 4), 800, TILE + 1);
    }

    this.statics = this.physics.add.staticGroup();
    for (const r of mergeRects(staticTiles)) {
      const z = this.add.zone(r.x * TILE + (r.w * TILE) / 2, r.y * TILE + (r.h * TILE) / 2, r.w * TILE, r.h * TILE);
      this.statics.add(z);
    }
    this.dyn = this.physics.add.group({ allowGravity: false, immovable: true });

    // Groups
    for (const [id, tiles] of groupTiles) {
      const def = gdefs[id];
      if (!def) throw new Error(`Level ${L.id}: group '${id}' used in map but not defined`);
      this.makeGroup(id, def, tiles, isSolidAll);
    }

    // Plain spikes / pads / coins
    for (const s of spikeTiles) this.addSpike(s.tx, s.ty, SPIKE_DIR[s.ch], null);
    for (const p of padTiles) this.addPad(p.tx, p.ty, null);
    for (const c of coinTiles) this.addCoin(c.tx, c.ty, null);
    for (const c of ballTiles) this.addBall(c.tx, c.ty, null);

    // Doors
    const doorFlip = (tx: number, ty: number) => !isSolidAll(tx, ty + 1) && isSolidAll(tx, ty - 1);
    if (doorAt) {
      const d = doorAt as { tx: number; ty: number };
      const fl = doorFlip(d.tx, d.ty);
      this.doorPos = { x: d.tx * TILE + TILE / 2, y: fl ? d.ty * TILE : (d.ty + 1) * TILE };
      this.door = this.track(new Door(this, this.doorPos.x, this.doorPos.y, false, fl).setDepth(2));
    }
    for (const f of fakeAt) {
      const fl = doorFlip(f.tx, f.ty);
      const x = f.tx * TILE + TILE / 2, y = fl ? f.ty * TILE : (f.ty + 1) * TILE;
      this.fakeDoors.push({ door: this.track(new Door(this, x, y, true, fl).setDepth(2)), x, y, flipped: fl, group: null });
    }
    this.doorPath = [];
    this.doorWait = 0;
    this.doorVx = 0;

    // Checkpoint
    this.cp = cpAt ? { x: cpAt.tx * TILE + TILE / 2, y: (cpAt.ty + 1) * TILE, tx: cpAt.tx } : null;
    if (this.cp) {
      this.cpFlag = this.track(this.add.image(this.cp.x - 1, this.cp.y + 1, this.cpActive ? 'flag-on' : 'flag').setOrigin(12 / 40, 79 / 80).setScale(1 / RES).setDepth(1));
    }

    // Hints
    // Only the level-1 control instructions exist, and they are shown once ever.
    this.tutorialMaxX = 0;
    if (!Save.get().tutorialSeen) {
      for (const h of L.hints ?? []) {
        const t = this.track(label(this, h.x * TILE + TILE / 2, h.y * TILE + TILE / 2, h.text, 24, '#ffffff', 6).setDepth(-5));
        this.hints.push({ obj: t, after: 0 });
        this.tutorialMaxX = Math.max(this.tutorialMaxX, (h.x + 4) * TILE);
      }
    }

    // Player
    this.gdir = 1;
    this.ctrlFlip = false;
    this.ctrlMode = 'normal';
    this.gScale = 1;
    this.launchLock = 0;
    this.ride = null;
    this.cameraTrick('reset');
    this.showFakeClear(false);
    const start = this.cpActive && this.cp ? { x: this.cp.x + 2, y: this.cp.y } : this.spawn;
    this.player = this.track(this.add.zone(start.x, start.y - PHYS.bodyH / 2, PHYS.bodyW, PHYS.bodyH));
    this.physics.add.existing(this.player);
    this.pbody = this.player.body as Phaser.Physics.Arcade.Body;
    this.pbody.setAllowGravity(false);
    this.pbody.setCollideWorldBounds(true);
    this.pbody.setMaxVelocity(2000, 2000);
    this.colliders.push(this.physics.add.collider(this.player, this.statics));
    this.colliders.push(this.physics.add.collider(this.player, this.dyn, undefined, (_p, z) => {
      const g = (z as Phaser.GameObjects.Zone).getData('grp') as GroupRT;
      return g.solid && g.visible;
    }));
    this.hero = this.track(new Hero(this, start.x, start.y).setDepth(5));
    this.hero.setScale(0.2);
    this.tweens.add({ targets: this.hero, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.Out' });

    // Triggers
    this.triggers = (L.triggers ?? []).map((def) => ({ def, fired: false }));
    // Respawning at the checkpoint: everything is re-armed, except "keep" triggers that
    // lie before the flag (e.g. the door already ran ahead) – their end state is applied.
    if (this.cpActive && this.cp) {
      for (const t of this.triggers) {
        const z = t.def.when.zone;
        if (t.def.keep && z && z[0] + z[2] <= this.cp.tx) {
          t.fired = true;
          if (t.def.id) this.fired.add(t.def.id);
          this.fastForward(t.def.do);
        }
      }
    }

    // Reset sim state
    this.state = 'play';
    this.stateT = 0;
    this.levelTick = 0;
    this.grounded = this.wasGrounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.prevJump = true; // holding jump through a restart must not auto-jump
    this.slowmo = 0;
    this.lastVy = 0;
    this.applySlowmo();
    if (this.lay) this.snapCamera();
  }

  /** Apply the end state of actions instantly (used for "keep" triggers at a checkpoint). */
  private fastForward(actions: Action[]): void {
    for (const a of actions) {
      if ('doorRun' in a) {
        const last = a.doorRun[a.doorRun.length - 1];
        this.doorPos = { x: last[0] * TILE + TILE / 2, y: (last[1] + 1) * TILE };
        this.door?.setFace('tired');
      } else if ('fall' in a) {
        const g = this.grp(a.fall);
        g.state = 'gone'; g.visible = false; g.solid = false; g.container.setVisible(false);
      } else if ('move' in a && a.returnAfter === undefined) {
        const g = this.grp(a.move);
        g.ox += a.by[0] * TILE; g.oy += a.by[1] * TILE;
        for (const z of g.bodies) { const b = z.getData('base'); z.setPosition(b.x + g.ox, b.y + g.oy); }
      } else if ('pop' in a || 'show' in a) {
        const g = this.grp('pop' in a ? a.pop : (a as { show: string }).show);
        g.visible = true; g.container.setVisible(true);
        for (const s of this.spikes) if (s.group === g) { s.extend = 1; this.placeSpike(s); }
      } else if ('hide' in a) {
        const g = this.grp(a.hide);
        g.visible = false; g.container.setVisible(false);
      } else if ('gravity' in a) {
        this.gdir = a.gravity === 'flip' ? -this.gdir : 1;
        this.hero?.setFlipped(this.gdir < 0);
      } else if ('controls' in a) {
        this.ctrlFlip = a.controls === 'flip';
        this.ctrlMode = a.controls;
      } else if ('gravityScale' in a) {
        this.gScale = a.gravityScale;
      }
    }
  }

  private makeGroup(id: string, def: GroupDef, tiles: { tx: number; ty: number }[], isSolidAll: (x: number, y: number) => boolean): void {
    if (def.cover) tiles = [...tiles, ...def.cover.map(([tx, ty]) => ({ tx, ty }))];
    const container = this.track(this.add.container(0, 0));
    const g: GroupRT = {
      id, def, tiles, container, bodies: [], ox: 0, oy: 0,
      visible: !def.hidden, solid: def.tile === '#' && !def.fake, state: 'idle',
      shakeT: 0, fallV: 0, move: null, chase: null, deadlyMove: false, deadlyEnd: false, dx: 0, dy: 0,
    };
    this.groups.set(id, g);
    const t = def.tile as TileChar;
    if (t === '#') {
      const minX = Math.min(...tiles.map((v) => v.tx)), minY = Math.min(...tiles.map((v) => v.ty));
      const maxX = Math.max(...tiles.map((v) => v.tx)), maxY = Math.max(...tiles.map((v) => v.ty));
      const k = `grp-${this.lvl.id}-${id}`;
      if (!this.textures.exists(k)) {
        const own = new Set(tiles.map((v) => v.ty * 1000 + v.tx));
        const seam = (x: number, y: number) => !own.has(y * 1000 + x) && this.staticSolid.has(y * 1000 + x);
        const bounds = { x: minX * TILE - 2, y: minY * TILE - 2, w: (maxX - minX + 1) * TILE + 4, h: (maxY - minY + 1) * TILE + 4 };
        addTerrainTexture(this, k, drawTerrain(tiles, def.fake ? (x, y) => own.has(y * 1000 + x) || isSolidAll(x, y) : isSolidAll, this.pal, bounds, def.look, seam));
      }
      const img = this.add.image(minX * TILE - 2, minY * TILE - 2, k).setOrigin(0).setScale(1 / RES);
      container.add(img);
      container.setDepth(def.fake ? 6 : 0.5);
      if (!def.fake) {
        for (const r of mergeRects(tiles)) {
          const z = this.add.zone(r.x * TILE + (r.w * TILE) / 2, r.y * TILE + (r.h * TILE) / 2, r.w * TILE, r.h * TILE);
          this.dyn.add(z);
          const b = z.body as Phaser.Physics.Arcade.Body;
          b.setAllowGravity(false);
          b.setImmovable(true);
          b.moves = false;
          z.setData('grp', g);
          z.setData('base', { x: z.x, y: z.y });
          g.bodies.push(z);
          this.track(z);
        }
      } else this.fakeWalls.push(g);
    } else if (t in SPIKE_DIR) {
      container.setDepth(-1);
      for (const v of tiles) this.addSpike(v.tx, v.ty, SPIKE_DIR[t], g);
    } else if (t === '=') {
      container.setDepth(1);
      for (const v of tiles) this.addPad(v.tx, v.ty, g);
    } else if (t === 'o') {
      container.setDepth(3);
      for (const v of tiles) this.addCoin(v.tx, v.ty, g);
    } else if (t === '*') {
      container.setDepth(3);
      for (const v of tiles) this.addBall(v.tx, v.ty, g);
    } else if (t === 'F') {
      container.setDepth(2);
      for (const v of tiles) {
        const x = v.tx * TILE + TILE / 2, y = (v.ty + 1) * TILE;
        const d = new Door(this, x, y, true, false);
        container.add(d);
        this.fakeDoors.push({ door: d, x, y, flipped: false, group: g });
      }
    }
    container.setVisible(g.visible);
  }

  private addSpike(tx: number, ty: number, dir: Dir, group: GroupRT | null): void {
    const img = this.add.image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'spike').setScale(1 / RES).setRotation(SPIKE_ROT[dir]);
    if (group) group.container.add(img);
    else this.track(img.setDepth(-1));
    const sp: Spike = { tx, ty, dir, img, group, extend: group && group.def.hidden ? 0 : 1 };
    if (group?.def.fake) img.setTint(0xf2f2f2);
    this.spikes.push(sp);
    this.placeSpike(sp);
  }

  private placeSpike(s: Spike): void {
    const off = (1 - s.extend) * 34;
    const d = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[s.dir];
    s.img.setPosition(s.tx * TILE + TILE / 2 + d[0] * off, s.ty * TILE + TILE / 2 + d[1] * off);
  }

  private addPad(tx: number, ty: number, group: GroupRT | null): void {
    const def = group?.def;
    const tex = def?.dud ? 'pad-dud' : def?.launch && def.launch[0] !== 0 ? 'pad-side' : 'pad';
    const img = this.add.image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, tex).setScale(1 / RES);
    if (def?.launch && def.launch[0] < 0) img.setFlipX(true);
    if (group) group.container.add(img);
    else this.track(img.setDepth(1));
    this.pads.push({ tx, ty, img, group, squashT: 0, tex });
  }

  private addBall(tx: number, ty: number, group: GroupRT | null): void {
    const img = this.add.image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'ball').setScale(1 / RES);
    if (group) group.container.add(img);
    else this.track(img.setDepth(3));
    this.balls.push({ tx, ty, img, group });
  }

  private addCoin(tx: number, ty: number, group: GroupRT | null): void {
    const img = this.add.image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'coin').setScale(1 / RES);
    if (group) group.container.add(img);
    else this.track(img.setDepth(3));
    this.tweens.add({ targets: img, y: img.y - 4, duration: 600 + ((tx * 7 + ty) % 5) * 60, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.coins.push({ tx, ty, img, group, taken: false, spiky: false });
  }

  // -------------------------------------------------------------------------
  // Main loop

  update(_time: number, delta: number): void {
    if (!this.paused && !this.overlay) {
      const scale = this.slowmo > 0 ? 0.4 : 1;
      this.acc += Math.min(delta, 100) * scale;
      let n = 0;
      while (this.acc >= TICK_MS - 0.001 && n < 6) {
        this.acc -= TICK_MS;
        this.fixedTick();
        n++;
      }
      if (n === 6) this.acc = 0;
    } else if (this.overlay && this.state === 'won') {
      // keep the celebratory sim (door/hero) still; nothing to do
    }
    this.render(delta / 1000);
  }

  /** One deterministic 1/60 s simulation step. */
  fixedTick(): void {
    this.tick++;
    const k = this.replay ? (this.replay[this.levelTick] ?? { left: false, right: false, jump: false }) : Input.read();
    const jumpPressed = k.jump && !this.prevJump;
    this.prevJump = k.jump;
    if (this.slowmo > 0) { this.slowmo--; if (this.slowmo === 0) this.applySlowmo(); }

    if (this.state === 'dead') {
      this.stateT++;
      if (this.stateT >= RESTART_TICKS) this.respawn();
      return;
    }
    if (this.state === 'won') {
      this.stateT++;
      if (this.stateT === 50) this.showComplete();
      return;
    }
    this.levelTick++;

    this.controlPlayer(k, jumpPressed);
    this.updateGroups();
    // moving platforms carry the hero standing on them
    if (this.ride && this.ride.solid && this.ride.visible && (this.ride.dx || this.ride.dy)) {
      this.player.x += this.ride.dx;
      this.player.y += this.ride.dy;
    }
    this.updateDoor();
    const w = this.physics.world;
    w.isPaused = false;
    w.singleStep();
    w.isPaused = true;
    this.afterPhysics();
    if (this.state !== 'play') return;
    this.checkTriggers();
    this.runScheduled();
    this.checkInteractions();
  }

  private controlPlayer(k: Keys, jumpPressed: boolean): void {
    const b = this.pbody;
    const g = this.gdir;
    let vx = b.velocity.x;
    let vy = b.velocity.y;
    let dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (this.ctrlMode === 'flip') dir = -dir;
    if (this.ctrlMode === 'autorun') dir = 1;
    if (this.ctrlMode === 'nojump') jumpPressed = false;
    const gr = this.grounded;
    if (this.launchLock > 0) {
      this.launchLock--;
    } else if (dir !== 0) {
      const turning = vx !== 0 && Math.sign(vx) !== dir;
      const a = gr ? (turning ? PHYS.groundDecel : PHYS.groundAccel) : PHYS.airAccel;
      vx = approach(vx, dir * PHYS.maxRun, a * DT);
    } else {
      vx = approach(vx, 0, (gr ? PHYS.groundDecel : PHYS.airDecel) * DT);
    }
    if (jumpPressed) this.buffer = PHYS.bufferTicks;
    if (gr) this.coyote = PHYS.coyoteTicks;
    if (this.buffer > 0 && this.coyote > 0) {
      vy = -PHYS.jumpVel * g;
      this.jumping = true;
      this.coyote = 0;
      this.buffer = 0;
      this.hero.jump();
      this.dust(4);
      this.sfx('jump');
    }
    if (this.buffer > 0) this.buffer--;
    if (!gr && this.coyote > 0) this.coyote--;
    if (this.jumping && !k.jump && vy * g < 0) {
      vy *= PHYS.jumpCutMul;
      this.jumping = false;
    }
    if (vy * g >= 0) this.jumping = false;
    const mul = (vy * g > 0 ? PHYS.fallGravityMul : 1) * this.gScale;
    vy += g * PHYS.gravity * mul * DT;
    if (vy * g > PHYS.maxFall) vy = PHYS.maxFall * g;
    b.setVelocity(vx, vy);
    this.lastVy = vy;
  }

  private afterPhysics(): void {
    const b = this.pbody;
    this.wasGrounded = this.grounded;
    this.grounded = this.gdir > 0 ? b.blocked.down : b.blocked.up;
    this.ride = null;
    if (this.grounded) {
      for (const g of this.groups.values()) {
        if (!g.solid || !g.visible || !g.bodies.length) continue;
        for (const z of g.bodies) {
          const zb = z.body as Phaser.Physics.Arcade.Body;
          const touching = this.gdir > 0 ? Math.abs(b.bottom - zb.top) <= 3 : Math.abs(b.top - zb.bottom) <= 3;
          if (touching && b.right > zb.left + 1 && b.left < zb.right - 1) { this.ride = g; break; }
        }
        if (this.ride) break;
      }
    }
    if (this.grounded && !this.wasGrounded && this.levelTick > 2) {
      const impact = Math.abs(this.lastVy);
      this.hero.land(impact);
      if (impact > 350) { this.dust(6); this.sfx('land'); }
    }
    // fell out of the world
    if ((this.gdir > 0 && b.y > WORLD_H + 30) || (this.gdir < 0 && b.bottom < -30)) this.kill('pit');
  }

  private playerRect(inset = 3): R {
    const b = this.pbody;
    return { x: b.x + inset, y: b.y + inset, w: b.width - inset * 2, h: b.height - inset * 2 };
  }

  private checkInteractions(): void {
    const pr = this.playerRect(3);
    // spikes
    for (const s of this.spikes) {
      if (s.extend <= 0) continue;
      if (s.group && (!s.group.visible || s.group.state === 'gone')) continue;
      const h = spikeHit(s.tx, s.ty, s.dir);
      if (s.group) { h.x += s.group.ox; h.y += s.group.oy; }
      if (!overlap(pr, h)) continue;
      if (s.group?.def.fake) {
        // fake spikes: squash flat, harmless
        if (s.img.scaleY > 0.4 / RES) {
          this.tweens.add({ targets: s.img, scaleY: 0.25 / RES, duration: 90, ease: 'Quad.Out' });
          if (!this.trollsFired.has(s.group.def.troll ?? '#')) { this.say('fake!', 'hero', 45); this.sfx('pad'); }
          this.troll(s.group.def.troll);
        }
        continue;
      }
      this.kill('spikes');
      return;
    }
    // deadly moving blocks (crushers)
    for (const g of this.groups.values()) {
      if (!g.deadlyMove || !g.visible) continue;
      for (const t of g.tiles) {
        if (overlap(pr, { x: t.tx * TILE + g.ox + 2, y: t.ty * TILE + g.oy + 2, w: TILE - 4, h: TILE - 4 })) { this.kill('crush'); return; }
      }
    }
    // coins
    const big = this.playerRect(0);
    for (const c of this.coins) {
      if (c.taken) continue;
      if (c.group && !c.group.visible) continue;
      const ox = c.group ? c.group.ox : 0, oy = c.group ? c.group.oy : 0;
      const r = { x: c.tx * TILE + 8 + ox, y: c.ty * TILE + 8 + oy, w: 24, h: 24 };
      if (c.spiky) {
        if (overlap(pr, { x: r.x - 2, y: r.y - 2, w: 28, h: 28 })) { this.kill('coin'); return; }
        continue;
      }
      if (!overlap(big, r)) continue;
      if (c.group?.def.trapCoin) {
        this.troll(c.group.def.troll);
        c.spiky = true;
        c.img.setTexture('coin-spiky');
        this.tweens.killTweensOf(c.img);
        c.img.setScale(1.6 / RES);
        this.tweens.add({ targets: c.img, scale: 1 / RES, duration: 120 });
        this.sfx('chomp');
        this.kill('coin');
        return;
      }
      c.taken = true;
      this.sfx('coin');
      this.tweens.killTweensOf(c.img);
      this.tweens.add({ targets: c.img, y: c.img.y - 40, alpha: 0, scale: 0.8, duration: 350, ease: 'Quad.Out' });
      const plus = this.track(label(this, c.img.x + ox, c.img.y + oy - 20, '+1', 22, '#ffd23f', 6).setDepth(40));
      this.tweens.add({ targets: plus, y: plus.y - 40, alpha: 0, duration: 600 });
    }
    // pads
    for (const p of this.pads) {
      if (p.group && !p.group.visible) continue;
      const ox = p.group ? p.group.ox : 0, oy = p.group ? p.group.oy : 0;
      const r = { x: p.tx * TILE + 4 + ox, y: p.ty * TILE + 14 + oy, w: 32, h: 26 };
      if (p.squashT > 0) p.squashT--;
      if (overlap(big, r) && this.pbody.velocity.y * this.gdir >= 0) {
        const def = p.group?.def;
        if (def?.dud) {
          // a dud: squeaks, does nothing
          if (p.squashT === 0) {
            this.troll(def.troll);
            p.img.setTexture('pad-dud-squash');
            this.time.delayedCall(140, () => p.img.active && p.img.setTexture('pad-dud'));
            this.say('...boing?', 'hero', 40);
            this.sfx('click');
          }
          p.squashT = 20;
          continue;
        }
        const lv = def?.launch ?? [0, -PHYS.padVel];
        this.pbody.setVelocity(lv[0] !== 0 ? lv[0] : this.pbody.velocity.x, lv[1] * this.gdir);
        if (lv[0] !== 0) this.launchLock = 30;
        this.jumping = false;
        this.grounded = false;
        this.coyote = 0;
        this.hero.launch();
        this.troll(def?.troll);
        p.img.setTexture(`${p.tex}-squash`);
        this.time.delayedCall(140, () => p.img.active && p.img.setTexture(p.tex));
        this.sfx('pad');
      }
    }
    // spiked balls
    for (const bl of this.balls) {
      if (bl.group && !bl.group.visible) continue;
      const cx = bl.tx * TILE + TILE / 2 + (bl.group ? bl.group.ox : 0), cy = bl.ty * TILE + TILE / 2 + (bl.group ? bl.group.oy : 0);
      if (overlap(pr, { x: cx - 15, y: cy - 15, w: 30, h: 30 })) {
        this.troll(bl.group?.def.troll);
        this.kill('ball');
        return;
      }
    }
    // fake doors bite
    for (const f of this.fakeDoors) {
      if (f.group && !f.group.visible) continue;
      const fx = f.x + (f.group ? f.group.ox : 0), fy = f.y + (f.group ? f.group.oy : 0);
      const r = { x: fx - 14, y: f.flipped ? fy : fy - 64, w: 28, h: 64 };
      if (overlap(pr, r)) {
        f.door.chomp();
        this.troll(f.group?.def.troll ?? this.lvl.fakeExits?.[String(Math.round((f.x - TILE / 2) / TILE))] ?? this.lvl.fakeExitTroll);
        this.say('NOPE!', [f.x / TILE - 0.5, f.y / TILE - 3.2], 50);
        this.sfx('chomp');
        this.kill('fakedoor');
        return;
      }
    }
    // real door
    if (this.door) {
      const d = this.doorPos;
      const fl = this.door.flipped;
      const r = { x: d.x - 12, y: fl ? d.y + 8 : d.y - 60, w: 24, h: 52 };
      if (overlap(pr, r)) this.win();
    }
    // fake walls turn see-through while you are inside them
    for (const g of this.fakeWalls) {
      let inside = false;
      for (const t of g.tiles) if (overlap(big, { x: t.tx * TILE - 10, y: t.ty * TILE - 10, w: TILE + 20, h: TILE + 20 })) inside = true;
      g.container.setAlpha(inside ? 0.45 : 1);
      if (inside) this.troll(g.def.troll);
    }
    // checkpoint flag
    if (this.cp && !this.cpActive && overlap(big, { x: this.cp.x - 20, y: this.cp.y - 80, w: 40, h: 80 })) {
      this.cpActive = true;
      this.cpFlag?.setTexture('flag-on');
      if (this.cpFlag) this.tweens.add({ targets: this.cpFlag, scaleX: 1.25 / RES, scaleY: 1.25 / RES, duration: 120, yoyo: true });
      this.emitConfetti.emitParticleAt(this.cp.x, this.cp.y - 60, 16);
      this.say('checkpoint!', 'hero', 60);
      this.sfx('coin');
    }
  }

  /** Spend the level's one hint: describe (and highlight) the next trap ahead of the hero. */
  useHint(): void {
    if (this.hintUsed || this.state === 'won') return;
    this.hintUsed = true;
    this.hintBtn.enabled = false;
    this.hintBtn.setAlpha(0.35);
    const hx = this.pbody.center.x / TILE;
    const next = (this.lvl.trolls ?? []).filter((t) => t.x + t.w > hx - 0.5).sort((a, b) => a.x - b.x)[0];
    const text = next ? next.hint : 'Nothing left to fear... probably.';
    this.hintShown = { id: next ? next.id : '', text };
    this.hintBox?.destroy();
    const c = this.add.container(WORLD_W / 2, 150).setDepth(150);
    const t = label(this, 0, 0, text, 24, '#2b2d42', 0);
    const w = Math.min(1100, t.width + 70);
    const g = this.add.graphics();
    g.fillStyle(0xfff6d5, 0.96).fillRoundedRect(-w / 2, -30, w, 60, 22);
    g.lineStyle(5, 0x2b2d42, 1).strokeRoundedRect(-w / 2, -30, w, 60, 22);
    const bulb = this.add.image(-w / 2 + 28, 0, 'icon-bulb').setScale(0.9 / RES).setTint(0xf2b705);
    t.setX(14);
    c.add([g, bulb, t]);
    this.uiLayer.add(c);
    this.hintBox = c;
    c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 4200, duration: 400, onComplete: () => { c.destroy(); if (this.hintBox === c) this.hintBox = null; } });
    if (next) {
      const hl = this.track(this.add.rectangle(next.x * TILE, 0, next.w * TILE, WORLD_H, 0xffd23f, 0.22).setOrigin(0).setDepth(20));
      hl.setStrokeStyle(6, 0xffd23f, 0.9);
      this.tweens.add({ targets: hl, alpha: 0.25, duration: 300, yoyo: true, repeat: 4, onComplete: () => hl.setVisible(false) });
    }
    this.sfx('coin');
  }

  private troll(id: string | undefined): void {
    if (id) this.trollsFired.add(id);
  }

  // -------------------------------------------------------------------------
  // Triggers & actions

  private checkTriggers(): void {
    const pr = this.playerRect(0);
    for (const t of this.triggers) {
      if (t.fired) continue;
      const w = t.def.when;
      let ok = false;
      if (w.start) ok = true;
      else if (w.after) ok = this.fired.has(w.after);
      else if (w.zone) {
        const [x, y, ww, hh] = w.zone;
        ok = overlap(pr, { x: x * TILE, y: y * TILE, w: ww * TILE, h: hh * TILE });
        if (ok && w.airborne) ok = !this.grounded;
        if (ok && w.grounded) ok = this.grounded;
      } else if (w.touch) {
        const g = this.groups.get(w.touch);
        if (g && g.visible) {
          const e = { x: pr.x - 2, y: pr.y - 2, w: pr.w + 4, h: pr.h + 4 };
          for (const tt of g.tiles) if (overlap(e, { x: tt.tx * TILE + g.ox, y: tt.ty * TILE + g.oy, w: TILE, h: TILE })) ok = true;
        }
      }
      if (!ok) continue;
      t.fired = true;
      if (t.def.id) this.fired.add(t.def.id);
      this.troll(t.def.troll);
      if (t.def.delay) this.scheduled.push({ at: this.levelTick + t.def.delay, actions: t.def.do, every: t.def.every });
      else {
        this.runActions(t.def.do);
        if (t.def.every) this.scheduled.push({ at: this.levelTick + t.def.every, actions: t.def.do, every: t.def.every, repeat: true });
      }
    }
  }

  private runScheduled(): void {
    if (!this.scheduled.length) return;
    const due = this.scheduled.filter((s) => s.at <= this.levelTick);
    this.scheduled = this.scheduled.filter((s) => s.at > this.levelTick);
    for (const s of due) {
      this.runActions(s.actions, !!s.repeat);
      if (s.every) this.scheduled.push({ at: s.at + s.every, actions: s.actions, every: s.every, repeat: true });
    }
  }

  private grp(id: string): GroupRT {
    const g = this.groups.get(id);
    if (!g) throw new Error(`Level ${this.lvl.id}: unknown group '${id}'`);
    return g;
  }

  /** `quiet`: a repeat of a rhythmic trap – no slow-motion / shocked face every cycle. */
  private runActions(actions: Action[], quiet = false): void {
    let trap = false;
    for (const a of actions) {
      if ('fall' in a) {
        const g = this.grp(a.fall);
        g.state = 'shaking';
        g.shakeT = a.shake ?? 6;
        this.sfx('crumble');
        trap = true;
      } else if ('pop' in a) {
        const g = this.grp(a.pop);
        g.visible = true;
        g.container.setVisible(true);
        for (const s of this.spikes) if (s.group === g) s.extend = Math.max(s.extend, 0.01);
        this.sfx('spikes');
        trap = true;
      } else if ('retract' in a) {
        const g = this.grp(a.retract);
        for (const s of this.spikes) if (s.group === g) s.extend = 0;
        g.container.setVisible(false);
        g.visible = false;
      } else if ('move' in a) {
        const g = this.grp(a.move);
        g.move = { fx: g.ox, fy: g.oy, tx: g.ox + a.by[0] * TILE, ty: g.oy + a.by[1] * TILE, t: 0, dur: Math.max(1, a.ticks), deadly: !!a.deadly, returnAfter: a.returnAfter, returnTicks: a.returnTicks, back: false };
        g.deadlyMove = !!a.deadly;
        if (a.deadly) { g.solid = false; trap = true; }
      } else if ('chase' in a) {
        const g = this.grp(a.chase);
        g.chase = { vx: a.vel[0], vy: a.vel[1], untilX: a.untilX };
        g.visible = true;
        g.container.setVisible(true);
        for (const s of this.spikes) if (s.group === g) { s.extend = 1; this.placeSpike(s); }
        trap = true;
      } else if ('doorRun' in a) {
        this.doorPath = a.doorRun.map(([x, y]) => ({ x: x * TILE + TILE / 2, y: (y + 1) * TILE }));
        this.doorSpeed = a.speed;
        this.doorWait = a.hehe ?? 0;
        if (this.door) {
          if (this.doorWait > 0) { this.door.hehe(); this.say('hehe', 'door', 40); this.sfx('hehe'); }
        }
        trap = true;
      } else if ('doorHehe' in a) {
        this.door?.hehe();
        this.say('hehe', 'door', a.doorHehe);
        this.sfx('hehe');
      } else if ('gravity' in a) {
        this.gdir = a.gravity === 'flip' ? -this.gdir : 1;
        this.hero.setFlipped(this.gdir < 0);
        this.jumping = false;
        this.sfx('flip');
        this.cameras.main.flash(120, 255, 255, 255, false);
        trap = true;
      } else if ('controls' in a) {
        this.ctrlMode = a.controls;
        this.ctrlFlip = a.controls === 'flip';
        if (a.controls !== 'normal') {
          this.say(a.controls === 'flip' ? 'huh?!' : a.controls === 'nojump' ? '...?' : 'whoa!', 'hero', 50);
          this.sfx('flip');
          trap = true;
        }
      } else if ('gravityScale' in a) {
        this.gScale = a.gravityScale;
        if (a.gravityScale !== 1) {
          this.say(a.gravityScale < 1 ? 'floaty...' : 'so heavy...', 'hero', 50);
          this.sfx('flip');
          trap = true;
        }
      } else if ('camera' in a) {
        this.cameraTrick(a.camera);
        if (a.camera === 'freeze' || a.camera === 'flip' || a.camera === 'zoom') trap = true;
      } else if ('fakeClear' in a) {
        this.showFakeClear(a.fakeClear);
        if (a.fakeClear) trap = true;
      } else if ('say' in a) {
        this.say(a.say, a.at, a.ticks ?? 70);
      } else if ('shake' in a) {
        this.cameras.main.shake((a.ticks ?? 12) * TICK_MS, a.shake * 0.001);
      } else if ('slowmo' in a) {
        this.slowmo = a.slowmo;
        this.applySlowmo();
      } else if ('show' in a) {
        const g = this.grp(a.show);
        g.visible = true;
        g.container.setVisible(true);
        for (const s of this.spikes) if (s.group === g) s.extend = 1;
      } else if ('hide' in a) {
        const g = this.grp(a.hide);
        g.visible = false;
        this.sfx('crumble');
        this.tweens.add({ targets: g.container, alpha: 0, scaleY: 0.9, duration: 110, onComplete: () => { g.container.setVisible(false).setAlpha(1).setScale(1); } });
        trap = true;
      } else if ('scare' in a) {
        trap = true;
      }
    }
    if (trap && !quiet) {
      this.hero.flash('shock', 0.55);
      this.sfx('trap');
      if (this.slowmo < 9) { this.slowmo = 9; this.applySlowmo(); }
    }
  }

  private applySlowmo(): void {
    const s = this.slowmo > 0 ? 0.4 : 1;
    this.tweens.timeScale = s;
    this.time.timeScale = s;
    for (const e of [this.emitDeath, this.emitDust, this.emitConfetti]) if (e) e.timeScale = s;
  }

  private updateGroups(): void {
    for (const g of this.groups.values()) {
      const ox0 = g.ox, oy0 = g.oy;
      g.dx = 0;
      g.dy = 0;
      if (g.state === 'gone') continue;
      if (g.deadlyEnd) { g.deadlyEnd = false; g.deadlyMove = false; }
      if (g.state === 'shaking') {
        g.shakeT--;
        if (g.shakeT <= 0) { g.state = 'falling'; g.solid = false; g.fallV = 1; }
      } else if (g.state === 'falling') {
        g.fallV = Math.min(16, g.fallV + 0.7);
        g.oy += g.fallV;
        if (g.oy > WORLD_H + 80) { g.state = 'gone'; g.visible = false; g.container.setVisible(false); }
      }
      if (g.move) {
        const m = g.move;
        m.t++;
        const p = Math.min(1, m.t / m.dur);
        const e = m.deadly && !m.back ? p * p : 0.5 - Math.cos(p * Math.PI) / 2;
        g.ox = m.fx + (m.tx - m.fx) * e;
        g.oy = m.fy + (m.ty - m.fy) * e;
        if (p >= 1) {
          if (m.deadly && !m.back) {
            this.sfx('slam');
            this.cameras.main.shake(140, 0.008);
          }
          if (g.deadlyMove) g.deadlyEnd = true;
          g.solid = g.def.tile === '#' && !g.def.fake;
          if (m.returnAfter !== undefined && !m.back) {
            g.move = { fx: g.ox, fy: g.oy, tx: m.fx, ty: m.fy, t: -m.returnAfter, dur: m.returnTicks ?? m.dur, deadly: false, back: true };
          } else g.move = null;
        }
        if (g.move && g.move.t < 0) { g.ox = g.move.fx; g.oy = g.move.fy; }
      }
      if (g.chase) {
        g.ox += g.chase.vx;
        g.oy += g.chase.vy;
        if (g.chase && g.chase.untilX !== undefined && g.ox >= g.chase.untilX * TILE) { g.ox = g.chase.untilX * TILE; g.chase = null; }
        if (g.chase && g.chase.untilY !== undefined && Math.abs(g.oy) >= Math.abs(g.chase.untilY * TILE)) { g.oy = g.chase.untilY * TILE; g.chase = null; }
      }
      g.dx = g.ox - ox0;
      g.dy = g.oy - oy0;
      // sync bodies
      for (const z of g.bodies) {
        const base = z.getData('base') as { x: number; y: number };
        z.setPosition(base.x + g.ox, base.y + g.oy);
      }
    }
    // spike pop animation
    for (const s of this.spikes) {
      if (s.extend > 0 && s.extend < 1) {
        s.extend = Math.min(1, s.extend + 0.34);
        this.placeSpike(s);
      }
    }
  }

  private updateDoor(): void {
    if (!this.door || !this.doorPath.length) { if (this.door) this.door.running = false; return; }
    if (this.doorWait > 0) {
      this.doorWait--;
      if (this.doorWait === 0) { this.door.setFace('run'); this.sfx('run'); }
      return;
    }
    const tgt = this.doorPath[0];
    const dx = tgt.x - this.doorPos.x, dy = tgt.y - this.doorPos.y;
    const dist = Math.hypot(dx, dy);
    this.door.running = true;
    this.door.setFace('run');
    if (dist <= this.doorSpeed) {
      this.doorPos = { x: tgt.x, y: tgt.y };
      this.doorPath.shift();
      if (!this.doorPath.length) {
        this.door.running = false;
        this.door.setFace('tired');
        this.say('huff', 'door', 50);
      }
    } else {
      this.doorPos = { x: this.doorPos.x + (dx / dist) * this.doorSpeed, y: this.doorPos.y + (dy / dist) * this.doorSpeed };
    }
    this.doorVx = dx;
    if (this.levelTick % 5 === 0) this.emitDust.emitParticleAt(this.doorPos.x - Math.sign(dx) * 12, this.doorPos.y - 4, 1);
  }

  private say(text: string, at: 'door' | 'hero' | [number, number], ticks: number): void {
    let x: number, y: number;
    if (at === 'door') { x = this.doorPos.x; y = this.doorPos.y - 108; }
    else if (at === 'hero') { x = this.pbody.center.x; y = this.pbody.y - 26; }
    else { x = at[0] * TILE + TILE / 2; y = at[1] * TILE + TILE; }
    const c = bubble(this, x, y, text);
    this.worldLayer.add(c);
    this.bubbles.push({ c, until: this.levelTick + ticks, follow: at === 'door' ? 'door' : at === 'hero' ? 'hero' : undefined });
  }

  // -------------------------------------------------------------------------
  // Death, win, restart

  private kill(cause: string): void {
    if (this.state !== 'play') return;
    this.state = 'dead';
    this.stateT = 0;
    this.lastDeath = cause;
    this.deathsLevel++;
    this.deathXs.push(this.pbody.center.x);
    Save.addDeath(this.lvl.id);
    this.updateDeathText(true);
    this.hero.die();
    this.pbody.setVelocity(0, 0);
    this.pbody.enable = false;
    this.emitDeath.emitParticleAt(this.pbody.center.x, this.pbody.center.y, 26);
    this.cameras.main.shake(180, 0.012);
    this.sfx('death');
    const q = this.lvl.deathQuips;
    if (q && q.length) {
      this.quip.setText(q[(this.deathsLevel - 1) % q.length]).setAlpha(1).setScale(0.6 / RES);
      this.tweens.killTweensOf(this.quip);
      this.tweens.add({ targets: this.quip, scale: 1 / RES, duration: 160, ease: 'Back.Out' });
      this.tweens.add({ targets: this.quip, alpha: 0, delay: 1100, duration: 300 });
    }
  }

  private respawn(): void {
    this.clearLevel();
    this.buildLevel();
  }

  restartLevel(): void {
    if (this.overlay) this.closeOverlay();
    this.paused = false;
    this.cpActive = false;
    this.clearLevel();
    this.buildLevel();
  }

  private win(): void {
    if (this.state !== 'play') return;
    this.state = 'won';
    this.stateT = 0;
    Save.complete(this.lvl.id, LEVELS.length);
    this.pbody.setVelocity(0, 0);
    this.pbody.enable = false;
    this.door?.pop();
    this.sfx('win');
    this.emitConfetti.emitParticleAt(this.doorPos.x, this.doorPos.y - 40, 50);
    const fl = this.door?.flipped ? -1 : 1;
    this.tweens.add({ targets: this.hero, x: this.doorPos.x, y: this.doorPos.y - 12 * fl, scaleX: 0, scaleY: 0, duration: 380, ease: 'Back.In' });
  }

  private showComplete(): void {
    const last = this.levelNum >= LEVELS.length;
    const c = this.makeOverlay();
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    c.add(panel(this, cx, cy, 640, 420, 0xfff6d5));
    const t1 = label(this, cx, cy - 130, last ? 'YOU BEAT THE DOOR!' : `LEVEL ${this.levelNum} CLEAR`, 30, '#6fd36b', 7);
    const msg = label(this, cx, cy - 64, this.lvl.winMessage, 46, '#ffd23f', 10);
    const d = this.deathsLevel;
    const t2 = label(this, cx, cy + 6, d === 0 ? 'Deaths: 0  — not even once?!' : `Deaths this level: ${d}`, 28, '#ffffff', 7);
    const t3 = label(this, cx, cy + 46, `Total deaths: ${Save.get().totalDeaths}`, 22, '#fff6d5', 6);
    c.add([t1, msg, t2, t3]);
    msg.setScale(0.2);
    this.tweens.add({ targets: msg, scale: 1 / RES, duration: 320, ease: 'Back.Out' });
    const bLv = new Button(this, cx - 200, cy + 130, { w: 150, h: 64, icon: 'menu', text: 'Levels', fontSize: 22, color: '#5b8cff' }, () => this.toSelect());
    const bRe = new Button(this, cx - 20, cy + 130, { w: 160, h: 64, icon: 'restart', text: 'Retry', fontSize: 22, color: '#9f7bd8' }, () => this.restartLevel());
    const bNx = new Button(this, cx + 180, cy + 130, { w: 190, h: 72, icon: 'play', text: last ? 'Menu' : 'Next', fontSize: 30, color: '#6fd36b' }, () => this.nextLevel());
    c.add([bLv, bRe, bNx]);
  }

  nextLevel(): void {
    if (this.levelNum >= LEVELS.length) { this.toTitle(); return; }
    this.scene.restart({ level: this.levelNum + 1 });
  }

  private toSelect(): void {
    this.scene.start('Select');
  }

  private toTitle(): void {
    this.scene.start('Title');
  }

  private makeOverlay(): Phaser.GameObjects.Container {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(200);
    this.uiLayer.add(c);
    this.cameras.main.ignore(c);
    const dim = this.add.rectangle(0, 0, 10, 10, 0x2b2d42, 0.55).setOrigin(0).setName('dim').setInteractive();
    this.cameras.main.ignore(dim);
    c.add(dim);
    this.overlay = c;
    this.fitDim();
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    return c;
  }

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  togglePause(): void {
    if (this.state === 'won') return;
    if (this.overlay) {
      this.closeOverlay();
      this.paused = false;
      return;
    }
    this.paused = true;
    const c = this.makeOverlay();
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    c.add(panel(this, cx, cy, 460, 440, 0xfff6d5));
    c.add(label(this, cx, cy - 160, 'PAUSED', 44, '#ffd23f', 9));
    const items: [string, string, string, () => void][] = [
      ['play', 'Resume', '#6fd36b', () => this.togglePause()],
      ['restart', 'Restart', '#9f7bd8', () => this.restartLevel()],
      ['menu', 'Levels', '#5b8cff', () => this.toSelect()],
    ];
    items.forEach(([icon, text, color, fn], i) => c.add(new Button(this, cx, cy - 70 + i * 82, { w: 260, h: 64, icon, text, fontSize: 26, color }, fn)));
    const mb = new Button(this, cx, cy + 176, { w: 260, h: 56, icon: Audio.muted ? 'mute' : 'sound', text: Audio.muted ? 'Sound off' : 'Sound on', fontSize: 22, color: '#ff8a5b' }, () => {
      this.toggleMute();
      mb.setIcon(Audio.muted ? 'mute' : 'sound');
      mb.txt?.setText(Audio.muted ? 'Sound off' : 'Sound on');
    });
    c.add(mb);
  }

  // -------------------------------------------------------------------------
  // Presentation (per render frame, never affects the simulation)

  private sfx(n: SfxName): void {
    Audio.sfx(n);
  }

  private dust(n: number): void {
    const b = this.pbody;
    this.emitDust.emitParticleAt(b.center.x, this.gdir > 0 ? b.bottom : b.top, n);
  }

  private render(dt: number): void {
    if (!this.pbody) return;
    const b = this.pbody;
    if (this.state !== 'won') {
      this.hero.setPosition(b.center.x, this.gdir > 0 ? b.bottom + 1 : b.top - 1);
    }
    this.hero.animate(dt, b.velocity.x, this.grounded, !this.grounded, -b.velocity.y * this.gdir);
    for (const g of this.groups.values()) {
      let sx = 0;
      if (g.state === 'shaking') sx = (Math.random() - 0.5) * 5;
      g.container.setPosition(g.ox + sx, g.oy);
    }
    if (this.door) {
      this.door.setPosition(this.doorPos.x, this.doorPos.y);
      this.door.animate(dt, this.doorVx);
    }
    for (const f of this.fakeDoors) f.door.animate(dt, 0);
    for (const bl of this.balls) if (bl.group) bl.img.setRotation(bl.group.ox / 20);
    for (const bb of this.bubbles) {
      if (bb.follow === 'door') bb.c.setPosition(this.doorPos.x, this.doorPos.y - (this.door?.flipped ? -150 : 108));
      if (bb.follow === 'hero') bb.c.setPosition(b.center.x, b.y - 26);
    }
    const keep = this.bubbles.filter((x) => x.until > this.levelTick);
    for (const x of this.bubbles) if (x.until <= this.levelTick) x.c.destroy();
    this.bubbles = keep;
    if (this.tutorialMaxX && this.pbody.center.x > this.tutorialMaxX) {
      Save.setTutorialSeen();
      this.tutorialMaxX = 0;
      for (const h of this.hints) this.tweens.add({ targets: h.obj, alpha: 0, duration: 400 });
    }
    // camera: smooth follow with a little look-ahead in the running direction
    const cam = this.cameras.main;
    const wantZoom = this.baseZoom * this.camZoomMul;
    if (Math.abs(cam.zoom - wantZoom) > 0.001) cam.setZoom(cam.zoom + (wantZoom - cam.zoom) * Math.min(1, dt * 6));
    if (this.state === 'play' && !this.camFrozen) {
      const look = Phaser.Math.Clamp(b.velocity.x * 0.35, -110, 110);
      const k = 1 - Math.pow(0.004, Math.min(dt, 0.05));
      this.camX += (b.center.x + look - this.camX) * k;
      this.camY += (b.center.y - 40 * this.gdir - this.camY) * k * 0.8;
    }
    this.applyCamera();
  }

  // -------------------------------------------------------------------------
  // Test hooks

  /** Test hook: put the camera on the hero immediately (after a fast-forward). */
  debugSnapCamera(): void {
    this.snapCamera();
  }

  /** Test hook: press the hint button. */
  debugHint(): void {
    this.useHint();
  }

  /** Test hook: kill the hero right now (used to check checkpoint respawns). */
  debugKill(): void {
    this.kill('test');
  }

  snapshot(): Snapshot {
    const b = this.pbody;
    return {
      level: this.levelNum, levelTick: this.levelTick, tick: this.tick, state: this.state,
      x: b.center.x, y: b.center.y, vx: b.velocity.x, vy: b.velocity.y, grounded: this.grounded,
      deathsLevel: this.deathsLevel, deathsTotal: Save.get().totalDeaths, gravity: this.gdir,
      fired: [...this.fired], doorX: this.doorPos.x, doorY: this.doorPos.y, lastDeath: this.lastDeath,
      trolls: [...this.trollsFired], checkpoint: this.cpActive, worldW: this.worldW, controlsFlipped: this.ctrlFlip,
      hudDeaths: this.deathText.text, ctrlMode: this.ctrlMode, gScale: this.gScale, camFrozen: this.camFrozen, camFlip: this.camFlip,
      camZoom: this.camZoomMul, hintUsed: this.hintUsed, hint: this.hintShown ? this.hintShown.text : '',
      g: Object.fromEntries([...this.groups.values()].map((g) => [g.id, [Math.round(g.ox), Math.round(g.oy), g.visible ? 1 : 0]])), cpX: this.cp ? this.cp.x : -1, zoom: this.cameras.main.zoom,
      viewTiles: this.cameras.main.width / this.cameras.main.zoom / TILE,
    };
  }
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

/** Greedy merge of tiles into rectangles (fewer physics bodies, no seams). */
function mergeRects(tiles: { tx: number; ty: number }[]): { x: number; y: number; w: number; h: number }[] {
  const set = new Set(tiles.map((t) => t.ty * 1000 + t.tx));
  const used = new Set<number>();
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const sorted = [...tiles].sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  for (const t of sorted) {
    const k = t.ty * 1000 + t.tx;
    if (used.has(k)) continue;
    let w = 1;
    while (set.has(t.ty * 1000 + t.tx + w) && !used.has(t.ty * 1000 + t.tx + w)) w++;
    let h = 1;
    outer: for (;;) {
      for (let i = 0; i < w; i++) {
        const kk = (t.ty + h) * 1000 + t.tx + i;
        if (!set.has(kk) || used.has(kk)) break outer;
      }
      h++;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add((t.ty + j) * 1000 + t.tx + i);
    out.push({ x: t.tx, y: t.ty, w, h });
  }
  return out;
}
