import Phaser from 'phaser';
import { WORLD_W, PALETTES } from '../config';
import { applyLayout } from '../layout';
import { Button, label } from '../ui';
import { LEVELS } from '../levels';
import { Save } from '../save';
import { Audio } from '../audio';
import { RES } from '../art';
import { Input } from '../input';

export class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  create(): void {
    const bg = this.add.image(0, 0, 'bg-2').setOrigin(0).setDepth(-20);
    const dots = this.add.tileSprite(0, 0, 64, 64, 'dots-2').setOrigin(0).setDepth(-19).setTileScale(1 / RES);
    const fit = () => {
      const L = applyLayout(this);
      bg.setPosition(L.left - 50, L.top - 50).setDisplaySize(L.right - L.left + 100, L.bottom - L.top + 100);
      dots.setPosition(L.left - 50, L.top - 50).setSize(L.right - L.left + 100, L.bottom - L.top + 100);
    };
    fit();
    this.scale.on('resize', fit);
    const off = Input.on((c) => { if (c === 'back' || c === 'pause') this.scene.start('Title'); });
    this.events.once('shutdown', () => { this.scale.off('resize', fit); off(); });

    label(this, WORLD_W / 2, 80, 'CHOOSE A LEVEL', 56, '#fff6d5', 12);
    const s = Save.get();
    const colors = PALETTES.map((p) => p.accent);
    LEVELS.forEach((lv, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = WORLD_W / 2 + (col - 2) * 200, y = 250 + row * 210;
      const locked = lv.id > s.unlocked;
      const b = new Button(this, x, y, { w: 150, h: 130, color: locked ? '#9aa0b8' : colors[lv.world % colors.length], radius: 26 }, () => {
        if (locked) { this.cameras.main.shake(120, 0.004); return; }
        Audio.unlock();
        this.scene.start('Game', { level: lv.id });
      });
      if (locked) b.add(this.add.image(0, -4, 'icon-lock').setScale(1.6 / RES));
      else {
        b.add(label(this, 0, -14, String(lv.id), 56, '#ffffff', 10));
        const d = s.levelDeaths[String(lv.id)] || 0;
        b.add(this.add.image(-22, 34, 'skull').setScale(0.6 / RES));
        b.add(label(this, 4, 34, String(d), 20, '#ffffff', 5).setOrigin(0, 0.5));
        if (s.completed[String(lv.id)]) b.add(this.add.image(54, -50, 'icon-star').setScale(1.1 / RES).setTint(0xffd23f));
      }
      label(this, x, y + 86, locked ? '???' : lv.name, 18, '#2b2d42', 0).setAlpha(0.8);
    });
    new Button(this, 110, 660, { w: 170, h: 60, icon: 'left', text: 'Back', fontSize: 24, color: '#ff8a5b' }, () => this.scene.start('Title'));
    if (new URLSearchParams(window.location.search).has('unlock')) Save.unlockAll(LEVELS.length);
    this.add.image(WORLD_W - 190, 660, 'skull').setScale(1 / RES);
    label(this, WORLD_W - 160, 660, `Total deaths: ${s.totalDeaths}`, 24, '#fff6d5', 7).setOrigin(0, 0.5);
  }
}
