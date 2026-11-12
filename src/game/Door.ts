import Phaser from 'phaser';
import { RES } from '../art';

export type DoorFaceKey = 'idle' | 'hehe' | 'wink' | 'run' | 'tired' | 'chomp';

/**
 * The EXIT door character. (x, y) is the bottom-centre of the door (the floor it
 * stands on). Movement is driven by the simulation (GameScene), the rig here only
 * animates.
 */
export class Door extends Phaser.GameObjects.Container {
  private rig: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private sign: Phaser.GameObjects.Image;
  private legL: Phaser.GameObjects.Image;
  private legR: Phaser.GameObjects.Image;
  private t = 0;
  running = false;
  legsOut = 0; // 0..1
  bob = 0;
  readonly fake: boolean;
  readonly flipped: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, fake: boolean, flipped: boolean) {
    super(scene, x, y);
    this.fake = fake;
    this.flipped = flipped;
    const s = 1 / RES;
    this.rig = scene.add.container(0, 0);
    this.legL = scene.add.image(-9, -8, 'door-leg').setOrigin(5 / 14, 0).setScale(s).setVisible(false);
    this.legR = scene.add.image(9, -8, 'door-leg').setOrigin(5 / 14, 0).setScale(s).setVisible(false);
    this.img = scene.add.image(0, 0, 'door-idle').setOrigin(0.5, 78 / 80).setScale(s);
    this.sign = scene.add.image(0, -84, 'exit-sign').setScale(s);
    this.rig.add([this.legL, this.legR, this.img, this.sign]);
    this.add(this.rig);
    if (flipped) this.setScale(1, -1);
    scene.add.existing(this);
  }

  setFace(f: DoorFaceKey): void {
    this.img.setTexture(`door-${f}`);
  }

  /** A smug little "hehe" hop. */
  hehe(): void {
    this.setFace('hehe');
    this.scene.tweens.add({
      targets: this.rig, scaleY: { from: 0.85, to: 1.08 }, scaleX: { from: 1.12, to: 0.95 },
      y: { from: 0, to: -8 }, duration: 110, yoyo: true, repeat: 2, ease: 'Sine.InOut',
      onComplete: () => this.rig.setScale(1).setY(0),
    });
  }

  wink(): void {
    this.setFace('wink');
    this.scene.time.delayedCall(450, () => this.setFace('idle'));
  }

  /** Celebrate the player reaching it. */
  pop(): void {
    this.setFace('hehe');
    this.scene.tweens.add({ targets: this.rig, scaleX: 1.3, scaleY: 1.3, duration: 120, yoyo: true, ease: 'Back.Out' });
  }

  chomp(): void {
    this.setFace('chomp');
    this.scene.tweens.add({ targets: this.rig, scaleX: 1.25, scaleY: 1.15, duration: 70, yoyo: true, repeat: 1 });
  }

  animate(dt: number, vx: number): void {
    this.t += dt;
    const want = this.running ? 1 : 0;
    this.legsOut += (want - this.legsOut) * Math.min(1, dt * 12);
    const out = this.legsOut;
    const showLegs = out > 0.05;
    this.legL.setVisible(showLegs);
    this.legR.setVisible(showLegs);
    const lift = out * 14;
    this.img.y = -lift;
    this.sign.y = -84 - lift;
    if (showLegs) {
      const a = Math.sin(this.t * 26) * (this.running ? 1 : 0);
      this.legL.setPosition(-9 + a * 4, -lift - 2);
      this.legR.setPosition(9 - a * 4, -lift - 2);
      this.legL.setRotation(a * 0.6);
      this.legR.setRotation(-a * 0.6);
      this.legL.setScale((1 / RES) * Math.max(0.2, out) * (vx < 0 ? -1 : 1), (1 / RES) * out);
      this.legR.setScale((1 / RES) * Math.max(0.2, out) * (vx < 0 ? -1 : 1), (1 / RES) * out);
    }
    // lean into the run, idle sway otherwise
    const lean = this.running ? Phaser.Math.Clamp(vx / 30, -0.18, 0.18) : Math.sin(this.t * 2) * 0.02;
    this.img.setRotation(lean);
    this.sign.setRotation(lean * 0.6);
    if (this.running) this.img.y += Math.abs(Math.sin(this.t * 26)) * -3;
  }
}
