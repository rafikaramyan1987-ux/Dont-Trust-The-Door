import Phaser from 'phaser';
import { RES } from '../art';

export type Expression = 'happy' | 'focus' | 'shock' | 'dead';

/**
 * Visual rig for the hero. Positioned at the bottom-centre of the physics body
 * (or the top-centre when gravity is flipped). Purely cosmetic: it never affects
 * the simulation, so it can use real-time tweens.
 */
export class Hero extends Phaser.GameObjects.Container {
  private rig: Phaser.GameObjects.Container;
  private body_: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Image;
  private leaf: Phaser.GameObjects.Image;
  private footL: Phaser.GameObjects.Image;
  private footR: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Image[] = [];
  expr: Expression = 'happy';
  private forced: { e: Expression; until: number } | null = null;
  private sx = 1;
  private sy = 1;
  private facing = 1;
  private blinkAt = 0;
  private blinking = 0;
  private walkPhase = 0;
  private time = 0;
  dead = false;
  flipped = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const s = 1 / RES;
    this.rig = scene.add.container(0, 0);
    this.footL = scene.add.image(-8, -4, 'hero-foot').setScale(s);
    this.footR = scene.add.image(8, -4, 'hero-foot').setScale(s);
    // body texture: body spans y 6..39 of a 44px canvas → bottom at 39
    this.body_ = scene.add.image(0, -3, 'hero-body').setOrigin(0.5, 39 / 44).setScale(s);
    this.face = scene.add.image(0, -3, 'face-happy').setOrigin(0.5, 39 / 44).setScale(s);
    this.leaf = scene.add.image(0, -35, 'hero-leaf').setOrigin(10 / 24, 18 / 20).setScale(s);
    this.rig.add([this.footL, this.footR, this.leaf, this.body_, this.face]);
    for (let i = 0; i < 3; i++) {
      const st = scene.add.image(0, -30, 'p-star').setScale(0.55).setTint(0xffd23f).setVisible(false);
      this.stars.push(st);
      this.add(st);
    }
    this.add(this.rig);
    this.blinkAt = 1.5 + Math.random() * 2;
    scene.add.existing(this);
  }

  /** Temporarily force an expression (e.g. "shock" when a trap fires). */
  flash(e: Expression, seconds: number): void {
    this.forced = { e, until: this.time + seconds };
  }

  jump(): void {
    this.sx = 0.72;
    this.sy = 1.34;
  }

  land(impact: number): void {
    const k = Math.min(1, impact / 900);
    this.sx = 1 + 0.42 * k;
    this.sy = 1 - 0.36 * k;
  }

  launch(): void {
    this.sx = 0.6;
    this.sy = 1.5;
  }

  die(): void {
    this.dead = true;
    this.forced = null;
    this.setExpr('dead');
    this.scene.tweens.killTweensOf(this.rig);
    this.rig.setScale(1.9 * this.facing, 1.4);
    this.scene.tweens.add({ targets: this.rig, scaleX: 1.75 * this.facing, scaleY: 0.32, duration: 90, ease: 'Quad.Out' });
    this.stars.forEach((s) => s.setVisible(true));
  }

  setFlipped(f: boolean): void {
    this.flipped = f;
    this.setScale(1, f ? -1 : 1);
  }

  private setExpr(e: Expression | 'blink'): void {
    const key = `face-${e}`;
    if (this.face.texture.key !== key) this.face.setTexture(key);
  }

  /** Called every render frame with the current physical state. */
  animate(dt: number, vx: number, grounded: boolean, inAir: boolean, vyUp: number): void {
    this.time += dt;
    if (this.dead) {
      const r = 18;
      this.stars.forEach((s, i) => {
        const a = this.time * 7 + (i * Math.PI * 2) / 3;
        s.setPosition(Math.cos(a) * r, -22 + Math.sin(a) * 5);
        s.setRotation(this.time * 5);
      });
      return;
    }
    if (Math.abs(vx) > 20) this.facing = vx > 0 ? 1 : -1;

    // expression
    let e: Expression = Math.abs(vx) > 40 || inAir ? 'focus' : 'happy';
    if (this.forced) {
      if (this.time < this.forced.until) e = this.forced.e;
      else this.forced = null;
    }
    this.expr = e;
    // idle blink
    if (e === 'happy') {
      this.blinkAt -= dt;
      if (this.blinkAt <= 0) {
        this.blinking = 0.12;
        this.blinkAt = 2 + Math.random() * 2.5;
      }
    }
    if (this.blinking > 0) {
      this.blinking -= dt;
      this.setExpr(e === 'happy' ? 'blink' : e);
    } else this.setExpr(e);

    // squash & stretch recovers toward 1 (plus a slight stretch while rising)
    const k = 1 - Math.pow(0.0008, dt);
    let tx = 1, ty = 1;
    if (inAir) {
      const s = Phaser.Math.Clamp(vyUp / 2200, -0.12, 0.18);
      tx = 1 - s;
      ty = 1 + s;
    }
    this.sx += (tx - this.sx) * k;
    this.sy += (ty - this.sy) * k;
    this.rig.setScale(this.sx * this.facing, this.sy);

    // feet: trot when running on ground, tuck in the air
    const running = grounded && Math.abs(vx) > 30;
    if (running) {
      this.walkPhase += dt * 22;
      const a = Math.sin(this.walkPhase);
      this.footL.setPosition(-8 + a * 3, -4 - Math.max(0, a) * 4);
      this.footR.setPosition(8 - a * 3, -4 - Math.max(0, -a) * 4);
      this.body_.y = -3 - Math.abs(a) * 1.5;
    } else if (inAir) {
      this.footL.setPosition(-9, -6);
      this.footR.setPosition(9, -6);
      this.body_.y = -3;
    } else {
      // idle breathing
      const b = Math.sin(this.time * 3) * 0.6;
      this.footL.setPosition(-8, -4);
      this.footR.setPosition(8, -4);
      this.body_.y = -3 + b;
    }
    this.face.y = this.body_.y;
    this.leaf.y = this.body_.y - 32;
    // leaf sway reacts to motion
    const sway = Phaser.Math.Clamp(-vx / 600, -0.5, 0.5) + Math.sin(this.time * 4) * 0.08 + (inAir ? -vyUp / 4000 : 0);
    this.leaf.setRotation(sway * this.facing);
  }
}
