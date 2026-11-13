import Phaser from 'phaser';
import { FONT } from './config';
import { makeButtonTexture, RES } from './art';
import { Audio } from './audio';

export function label(
  scene: Phaser.Scene, x: number, y: number, text: string, size = 32, color = '#ffffff', stroke = 8,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${size * RES}px`,
    fontStyle: '900',
    color,
    stroke: '#2b2d42',
    strokeThickness: stroke * RES,
    align: 'center',
  });
  t.setScale(1 / RES);
  t.setOrigin(0.5);
  return t;
}

/** Shrink a text object (uniformly) so it is at most `maxW` wide; returns it. */
export function fitText(t: Phaser.GameObjects.Text, maxW: number): Phaser.GameObjects.Text {
  t.setScale(1 / RES);
  if (t.displayWidth > maxW) t.setScale((1 / RES) * (maxW / t.displayWidth));
  return t;
}

export interface ButtonOpts {
  w: number;
  h: number;
  color?: string;
  text?: string;
  icon?: string;
  fontSize?: number;
  radius?: number;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private iconImg?: Phaser.GameObjects.Image;
  txt?: Phaser.GameObjects.Text;
  private onClick: () => void;
  enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, o: ButtonOpts, onClick: () => void) {
    super(scene, x, y);
    const color = o.color ?? '#ffb547';
    const key = `btn-${o.w}x${o.h}-${color}-${o.radius ?? 18}`;
    makeButtonTexture(scene, key, o.w, o.h, color, o.radius ?? Math.min(18, o.h / 2.4));
    this.bg = scene.add.image(0, 0, key).setScale(1 / RES);
    this.add(this.bg);
    if (o.icon) {
      this.iconImg = scene.add.image(o.text ? -o.w / 2 + 30 : 0, -2, `icon-${o.icon}`).setScale(1 / RES);
      this.add(this.iconImg);
    }
    if (o.text) {
      const room = o.w - (o.icon ? 64 : 24);
      this.txt = fitText(label(scene, o.icon ? 14 : 0, -2, o.text, o.fontSize ?? 28, '#ffffff', 6), room);
      this.txt.setData('room', room);
      this.add(this.txt);
    }
    this.onClick = onClick;
    this.setSize(o.w, o.h + 6);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      Audio.unlock();
      this.setScale(0.92);
    });
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      if (!this.enabled) return;
      this.setScale(1);
      Audio.sfx('click');
      this.onClick();
    });
    scene.add.existing(this);
  }

  setIcon(icon: string): void {
    this.iconImg?.setTexture(`icon-${icon}`);
  }

  setText(text: string): void {
    if (!this.txt) return;
    this.txt.setText(text);
    fitText(this.txt, this.txt.getData('room') as number);
  }
}

/** A rounded panel drawn with Graphics. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = 0xfff6d5): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x2b2d42, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2 + 8, w, h, 28);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
  g.lineStyle(6, 0x2b2d42, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 28);
  return g;
}

/** Speech bubble with a tail pointing down to (x, y). */
export function bubble(scene: Phaser.Scene, x: number, y: number, text: string, flip = false): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const t = label(scene, 0, 0, text, 20, '#2b2d42', 0);
  const w = Math.max(56, t.width + 26);
  const h = 38;
  const dir = flip ? 1 : -1;
  const by = dir * (h / 2 + 14);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.lineStyle(4, 0x2b2d42, 1);
  g.fillRoundedRect(-w / 2, by - h / 2, w, h, 16);
  g.strokeRoundedRect(-w / 2, by - h / 2, w, h, 16);
  g.fillTriangle(-8, by - dir * (h / 2 - 2), 8, by - dir * (h / 2 - 2), 0, by - dir * (h / 2 + 12));
  g.lineBetween(-8, by - dir * (h / 2), 0, by - dir * (h / 2 + 12));
  g.lineBetween(8, by - dir * (h / 2), 0, by - dir * (h / 2 + 12));
  t.setY(by - 1);
  c.add([g, t]);
  c.setDepth(50);
  c.setScale(0.2);
  scene.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.Out' });
  return c;
}
