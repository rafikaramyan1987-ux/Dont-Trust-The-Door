import Phaser from 'phaser';
import { WORLD_W, PALETTES, TILE } from '../config';
import { applyLayout, Layout } from '../layout';
import { Button, label, fitText } from '../ui';
import { t } from '../i18n';
import { openLanguagePicker, currentLangName } from '../langPicker';
import { Hero } from '../game/Hero';
import { Door } from '../game/Door';
import { Audio } from '../audio';
import { Save } from '../save';
import { drawTerrain, addTerrainTexture, RES } from '../art';
import { Input } from '../input';

export class TitleScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private dots!: Phaser.GameObjects.TileSprite;
  private hero!: Hero;
  private door!: Door;
  private lay!: Layout;
  private muteBtn!: Button;

  constructor() {
    super('Title');
  }

  create(): void {
    this.bg = this.add.image(0, 0, 'bg-0').setOrigin(0).setDepth(-20);
    this.dots = this.add.tileSprite(0, 0, 64, 64, 'dots-0').setOrigin(0).setDepth(-19).setTileScale(1 / RES);

    // ground strip
    const tiles: { tx: number; ty: number }[] = [];
    for (let x = -6; x < 38; x++) for (let y = 15; y < 18; y++) tiles.push({ tx: x, ty: y });
    if (!this.textures.exists('title-ground')) {
      const set = new Set(tiles.map((t) => `${t.tx},${t.ty}`));
      addTerrainTexture(this, 'title-ground', drawTerrain(tiles, (x, y) => set.has(`${x},${y}`) || y > 17, PALETTES[0], { x: -6 * TILE, y: 15 * TILE, w: 44 * TILE, h: 3 * TILE + 200 }));
    }
    this.add.image(-6 * TILE, 15 * TILE, 'title-ground').setOrigin(0).setScale(1 / RES);

    // Title letters with a bouncy wave
    const lines = ["DON'T TRUST", 'THE DOOR'];
    lines.forEach((line, li) => {
      const size = li === 0 ? 92 : 112;
      const color = li === 0 ? '#fff6d5' : '#ffd23f';
      const spacing = size * 0.62;
      const startX = WORLD_W / 2 - ((line.length - 1) * spacing) / 2;
      [...line].forEach((ch, i) => {
        if (ch === ' ') return;
        const t = label(this, startX + i * spacing, 130 + li * 120, ch, size, color, 14);
        t.setAngle((i % 2 ? 1 : -1) * 3);
        this.tweens.add({ targets: t, y: t.y - 10, duration: 700, delay: i * 70 + li * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    });
    fitText(label(this, WORLD_W / 2, 330, t('ui.tagline'), 24, '#2b2d42', 0), 900).setAlpha(0.75);

    this.hero = new Hero(this, 330, 15 * TILE + 1).setScale(2.2);
    this.door = new Door(this, 960, 15 * TILE, false, false).setScale(2);
    this.time.addEvent({ delay: 2200, loop: true, callback: () => this.door.wink() });
    this.time.addEvent({ delay: 2200, startAt: 1100, loop: true, callback: () => this.tweens.add({ targets: this.hero, y: this.hero.y - 30, duration: 180, yoyo: true, ease: 'Quad.Out' }) });

    new Button(this, WORLD_W / 2, 450, { w: 320, h: 92, icon: 'play', text: t('ui.play'), fontSize: 46, color: '#6fd36b' }, () => this.play()).setName('play');
    new Button(this, WORLD_W / 2 - 140, 560, { w: 250, h: 62, icon: 'menu', text: t('ui.levels'), fontSize: 26, color: '#5b8cff' }, () => this.scene.start('Select')).setName('levels');
    new Button(this, WORLD_W / 2 + 140, 560, { w: 250, h: 62, icon: 'globe', text: currentLangName(), fontSize: 24, color: '#41c6c0' }, () => {
      openLanguagePicker(this, null, () => this.scene.restart());
    }).setName('language');
    this.muteBtn = new Button(this, WORLD_W - 60, 50, { w: 64, h: 58, icon: Audio.muted ? 'mute' : 'sound', color: '#ff8a5b' }, () => {
      Audio.unlock();
      this.muteBtn.setIcon(Audio.toggleMute() ? 'mute' : 'sound');
    });
    const s = Save.get();
    if (s.totalDeaths > 0) {
      this.add.image(70, 50, 'skull').setScale(1 / RES);
      label(this, 100, 50, String(s.totalDeaths), 30, '#fff6d5', 7).setOrigin(0, 0.5);
    }
    fitText(label(this, WORLD_W / 2, 690, t('ui.controlsHelp'), 18, '#2b2d42', 0), 1100).setAlpha(0.6);

    this.relayout();
    this.scale.on('resize', this.relayout, this);
    const off = Input.on((c) => { if (c === 'confirm') this.play(); });
    this.events.once('shutdown', () => { this.scale.off('resize', this.relayout, this); off(); });
    this.input.on('pointerdown', () => Audio.unlock());
    Audio.startMusic();
  }

  private play(): void {
    Audio.unlock();
    const s = Save.get();
    const next = Math.min(s.unlocked, 10);
    this.scene.start('Game', { level: next });
  }

  private relayout(): void {
    this.lay = applyLayout(this);
    const L = this.lay;
    this.bg.setPosition(L.left - 50, L.top - 50).setDisplaySize(L.right - L.left + 100, L.bottom - L.top + 100);
    this.dots.setPosition(L.left - 50, L.top - 50).setSize(L.right - L.left + 100, L.bottom - L.top + 100);
  }

  update(_t: number, dms: number): void {
    this.hero.animate(dms / 1000, 0, true, false, 0);
    this.door.animate(dms / 1000, 0);
  }
}
