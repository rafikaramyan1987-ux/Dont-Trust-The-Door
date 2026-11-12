import Phaser from 'phaser';
import { generateTextures } from '../art';
import { Input } from '../input';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateTextures(this);
    const p = new URLSearchParams(window.location.search);
    const lvl = Number(p.get('level'));
    if (Input.isTest && p.get('boot') === 'none') return; // tests drive scenes themselves
    if (lvl > 0) this.scene.start('Game', { level: lvl });
    else this.scene.start('Title');
  }
}
