import Phaser from 'phaser';
import { WORLD_W, PALETTES, PLANNED_LEVELS, PAGE_SIZE } from '../config';
import { applyLayout, isPortrait } from '../layout';
import { Button, label, fitText } from '../ui';
import { t } from '../i18n';
import { LEVELS } from '../levels';
import { Save } from '../save';
import { Audio } from '../audio';
import { RES } from '../art';
import { Input } from '../input';

/**
 * The level select: pages of 10 levels (2 rows of 5), arrows to change page, every planned level shown (locked
 * ones with a padlock), each unlocked level with its deaths. Opens on the page of the newest unlocked level.
 */
export class SelectScene extends Phaser.Scene {
  private page = 0;
  private grid: Phaser.GameObjects.GameObject[] = [];
  private pageText!: Phaser.GameObjects.Text;
  private prevBtn!: Button;
  private nextBtn!: Button;
  /** laid out for portrait: 3 columns in a narrow column (a switch of orientation re-creates the screen) */
  private portrait = false;

  constructor() {
    super('Select');
  }

  get pages(): number {
    return Math.ceil(Math.max(PLANNED_LEVELS, LEVELS.length) / PAGE_SIZE);
  }

  init(data: { page?: number }): void {
    const s = Save.get();
    const newest = Math.min(s.unlocked, LEVELS.length);
    this.page = data.page ?? Math.floor((newest - 1) / PAGE_SIZE);
    this.grid = [];
  }

  create(): void {
    const P = (this.portrait = isPortrait(this));
    const bg = this.add.image(0, 0, 'bg-2').setOrigin(0).setDepth(-20);
    const dots = this.add.tileSprite(0, 0, 64, 64, 'dots-2').setOrigin(0).setDepth(-19).setTileScale(1 / RES);
    const fit = () => {
      if (isPortrait(this) !== this.portrait) { this.scene.restart({ page: this.page }); return; }
      const L = applyLayout(this);
      bg.setPosition(L.left - 50, L.top - 50).setDisplaySize(L.right - L.left + 100, L.bottom - L.top + 100);
      dots.setPosition(L.left - 50, L.top - 50).setSize(L.right - L.left + 100, L.bottom - L.top + 100);
    };
    fit();
    this.scale.on('resize', fit);
    const off = Input.on((c) => { if (c === 'back' || c === 'pause') this.scene.start('Title'); });
    const keys = (e: KeyboardEvent) => {
      if (e.code === 'PageDown' || e.code === 'KeyE') this.setPage(this.page + 1);
      if (e.code === 'PageUp' || e.code === 'KeyQ') this.setPage(this.page - 1);
    };
    window.addEventListener('keydown', keys);
    this.events.once('shutdown', () => { this.scale.off('resize', fit); off(); window.removeEventListener('keydown', keys); });
    if (new URLSearchParams(window.location.search).has('unlock')) Save.unlockAll(LEVELS.length);

    fitText(label(this, WORLD_W / 2, P ? 18 : 70, t('ui.chooseLevel'), P ? 44 : 52, '#fff6d5', P ? 10 : 12), P ? 420 : 900);
    const pg = P ? { w: 100, h: 72 } : { w: 84, h: 150 };
    this.prevBtn = new Button(this, P ? 490 : 70, P ? 628 : 355, { ...pg, icon: 'left', color: '#41c6c0', radius: 24 }, () => this.setPage(this.page - 1)).setName('pagePrev');
    this.nextBtn = new Button(this, P ? 790 : WORLD_W - 70, P ? 628 : 355, { ...pg, icon: 'right', color: '#41c6c0', radius: 24 }, () => this.setPage(this.page + 1)).setName('pageNext');
    this.pageText = label(this, WORLD_W / 2, P ? 628 : 590, '', 26, '#fff6d5', 7).setName('pageText');
    new Button(this, P ? 520 : 120, P ? 716 : 660, { w: 190, h: 60, icon: 'left', text: t('ui.back'), fontSize: 24, color: '#ff8a5b' }, () => this.scene.start('Title'));
    const s = Save.get();
    this.add.image(P ? 650 : WORLD_W - 360, P ? 716 : 660, 'skull').setScale(1 / RES);
    fitText(label(this, P ? 680 : WORLD_W - 330, P ? 716 : 660, t('ui.deathsTotal', { n: s.totalDeaths }), 24, '#fff6d5', 7).setOrigin(0, 0.5), P ? 180 : 300);
    this.drawPage();
  }

  setPage(p: number): void {
    const n = Phaser.Math.Clamp(p, 0, this.pages - 1);
    if (n === this.page) return;
    this.page = n;
    this.drawPage();
  }

  private drawPage(): void {
    this.grid.forEach((g) => g.destroy());
    this.grid = [];
    const s = Save.get();
    const colors = PALETTES.map((p) => p.accent);
    for (let i = 0; i < PAGE_SIZE; i++) {
      const id = this.page * PAGE_SIZE + i + 1;
      if (id > Math.max(PLANNED_LEVELS, LEVELS.length)) break;
      const lv = LEVELS[id - 1];
      // portrait: 3 columns (the 10th level centred in the 4th row), smaller tiles
      const P = this.portrait;
      const col = P ? (i === 9 ? 1 : i % 3) : i % 5, row = P ? Math.floor(i / 3) : Math.floor(i / 5);
      const x = P ? WORLD_W / 2 + (col - 1) * 150 : WORLD_W / 2 + (col - 2) * 200, y = P ? 122 + row * 134 : 215 + row * 200;
      const k = P ? 0.84 : 1;
      const locked = !lv || id > s.unlocked;
      const b = new Button(this, x, y, { w: P ? 130 : 150, h: P ? 104 : 124, color: locked ? '#9aa0b8' : colors[lv.world % colors.length], radius: 26 }, () => {
        if (locked) { this.cameras.main.shake(120, 0.004); return; }
        Audio.unlock();
        this.scene.start('Game', { level: id });
      });
      b.setName(`level-${id}`);
      if (locked) {
        b.add(this.add.image(0, -18 * k, 'icon-lock').setScale((1.4 * k) / RES));
        b.add(label(this, 0, 36 * k, String(id), 24, '#ffffff', 5));
      } else {
        b.add(label(this, 0, -14 * k, String(id), 54 * k, '#ffffff', 10));
        const d = s.levelDeaths[String(id)] || 0;
        b.add(this.add.image(-22, 32 * k, 'skull').setScale(0.6 / RES));
        b.add(label(this, 4, 32 * k, String(d), 20, '#ffffff', 5).setOrigin(0, 0.5));
        if (s.completed[String(id)]) b.add(this.add.image(54 * k, -48 * k, 'icon-star').setScale((1.1 * k) / RES).setTint(0xffd23f));
      }
      const name = fitText(label(this, x, y + (P ? 68 : 80), locked ? '???' : t(lv.name), P ? 17 : 18, '#2b2d42', 0), P ? 144 : 190).setAlpha(0.8);
      this.grid.push(b, name);
    }
    this.pageText.setText(`${this.page + 1} / ${this.pages}`);
    this.prevBtn.setAlpha(this.page > 0 ? 1 : 0.3);
    this.prevBtn.enabled = this.page > 0;
    this.nextBtn.setAlpha(this.page < this.pages - 1 ? 1 : 0.3);
    this.nextBtn.enabled = this.page < this.pages - 1;
  }
}
