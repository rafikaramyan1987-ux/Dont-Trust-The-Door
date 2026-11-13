// All art is drawn in code with the Canvas 2D API and registered as Phaser textures.
// Textures are drawn at RES× and displayed at 1/RES scale so they stay crisp on
// high-density phone screens.

import Phaser from 'phaser';
import { PALETTES, Palette, TILE, FONT } from './config';
import { t } from './i18n';

export const RES = 2;
const OUT = '#2b2d42';

type C2D = CanvasRenderingContext2D;

/** Resolution for the hero's textures (small, often shown big, so extra crisp). */
export const HERO_RES = 4;

function canvas(w: number, h: number, res = RES): [HTMLCanvasElement, C2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res);
  c.height = Math.ceil(h * res);
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

/** Rounded rect path with individual corner radii [tl, tr, br, bl]. */
export function rr(ctx: C2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): void {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function ellipse(ctx: C2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

// ---------------------------------------------------------------------------
// Hero

export const HERO_W = 44; // texture size (logical px)
export const HERO_H = 44;

function drawHeroBody(ctx: C2D): void {
  const x = 4, y = 6, w = 36, h = 33;
  // soft shadow inside bottom
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#fff07a');
  g.addColorStop(0.55, '#ffd23f');
  g.addColorStop(1, '#f5b014');
  rr(ctx, x, y, w, h, 13);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // glossy highlight
  ctx.save();
  rr(ctx, x, y, w, h, 13);
  ctx.clip();
  ellipse(ctx, x + 11, y + 7, 9, 5, -0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fill();
  ellipse(ctx, x + 24, y + 4.5, 2.2, 1.6);
  ctx.fill();
  // bottom shade
  ellipse(ctx, x + w / 2, y + h + 4, w * 0.6, 9);
  ctx.fillStyle = 'rgba(214,120,0,0.25)';
  ctx.fill();
  ctx.restore();
  // blush
  ctx.fillStyle = 'rgba(255,110,140,0.55)';
  ellipse(ctx, x + 7, y + 22, 4.2, 2.6);
  ctx.fill();
  ellipse(ctx, x + w - 7, y + 22, 4.2, 2.6);
  ctx.fill();
}

type Expr = 'happy' | 'focus' | 'shock' | 'dead' | 'blink';

function eye(ctx: C2D, cx: number, cy: number, rx: number, ry: number): void {
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fillStyle = OUT;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, cx - rx * 0.32, cy - ry * 0.38, rx * 0.5, ry * 0.36);
  ctx.fill();
  ellipse(ctx, cx + rx * 0.38, cy + ry * 0.4, rx * 0.22, ry * 0.18);
  ctx.fill();
}

function drawFace(ctx: C2D, e: Expr): void {
  // Face is drawn facing right (forward = +x). Eye centres:
  const ly = 19, lx = 17, rx = 29;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = OUT;
  switch (e) {
    case 'happy':
      eye(ctx, lx, ly, 3.6, 4.8);
      eye(ctx, rx, ly, 3.6, 4.8);
      ctx.beginPath();
      ctx.arc(23, 25.5, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    case 'blink':
      ctx.beginPath();
      ctx.moveTo(lx - 3.5, ly + 1); ctx.quadraticCurveTo(lx, ly + 3.5, lx + 3.5, ly + 1);
      ctx.moveTo(rx - 3.5, ly + 1); ctx.quadraticCurveTo(rx, ly + 3.5, rx + 3.5, ly + 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(23, 25.5, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    case 'focus': {
      eye(ctx, lx + 2, ly + 0.5, 3.3, 4.2);
      eye(ctx, rx + 2, ly + 0.5, 3.3, 4.2);
      // determined brows
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(lx - 2, ly - 7.5); ctx.lineTo(lx + 5, ly - 5.5);
      ctx.moveTo(rx - 1, ly - 5.5); ctx.lineTo(rx + 6, ly - 7.5);
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(23, 26.5); ctx.lineTo(28.5, 26);
      ctx.stroke();
      break;
    }
    case 'shock': {
      for (const cx of [lx - 0.5, rx + 0.5]) {
        ellipse(ctx, cx, ly - 0.5, 5, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();
        ellipse(ctx, cx, ly, 1.8, 2.2);
        ctx.fillStyle = OUT;
        ctx.fill();
      }
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(lx - 4, ly - 10); ctx.quadraticCurveTo(lx, ly - 13, lx + 4, ly - 10.5);
      ctx.moveTo(rx - 4, ly - 10.5); ctx.quadraticCurveTo(rx, ly - 13, rx + 4, ly - 10);
      ctx.stroke();
      ellipse(ctx, 23, 28, 3, 3.6);
      ctx.fillStyle = '#7a2340';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.stroke();
      break;
    }
    case 'dead': {
      ctx.lineWidth = 2.8;
      for (const cx of [lx, rx]) {
        ctx.beginPath();
        ctx.moveTo(cx - 3.5, ly - 3.5); ctx.lineTo(cx + 3.5, ly + 3.5);
        ctx.moveTo(cx + 3.5, ly - 3.5); ctx.lineTo(cx - 3.5, ly + 3.5);
        ctx.stroke();
      }
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(17, 27);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(18.5 + i * 3, 25 + (i % 2) * 4, 20 + i * 3, 27);
      ctx.stroke();
      // tongue
      ellipse(ctx, 26, 29.5, 2, 2.4);
      ctx.fillStyle = '#ff6f91';
      ctx.fill();
      break;
    }
  }
}

function drawFoot(ctx: C2D): void {
  ellipse(ctx, 7, 5, 6, 4);
  ctx.fillStyle = '#f29e1f';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
}

function drawLeaf(ctx: C2D): void {
  // stem base at (10, 18)
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(10, 18);
  ctx.quadraticCurveTo(9, 11, 11, 7);
  ctx.stroke();
  const leaf = (rot: number, ox: number, oy: number) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5, -6, 11, -1);
    ctx.quadraticCurveTo(5, 4, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -5, 0, 4);
    g.addColorStop(0, '#9df26f');
    g.addColorStop(1, '#4fbf4a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  };
  leaf(-0.35, 11, 7);
  leaf(Math.PI + 0.45, 10, 8);
}

// ---------------------------------------------------------------------------
// Door: a teal door with a smug little face in its window.

export const DOOR_W = 48;
export const DOOR_H = 80;

type DoorFace = 'idle' | 'hehe' | 'wink' | 'run' | 'tired' | 'chomp';

function drawDoor(ctx: C2D, face: DoorFace, fake = false): void {
  const x = 6, y = 4, w = 36, h = 74;
  // frame
  rr(ctx, x - 3, y - 2, w + 6, h + 2, [18, 18, 3, 3]);
  ctx.fillStyle = '#7a4b2a';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // door leaf
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (fake) { g.addColorStop(0, '#62d4c8'); g.addColorStop(1, '#2f9e95'); }
  else { g.addColorStop(0, '#5fd6c9'); g.addColorStop(1, '#2a9b91'); }
  rr(ctx, x + 2, y + 2, w - 4, h - 2, [15, 15, 2, 2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // panels
  ctx.strokeStyle = 'rgba(20,60,60,0.35)';
  ctx.lineWidth = 2;
  rr(ctx, x + 8, y + 40, w - 16, 26, 4);
  ctx.stroke();
  // knob
  ellipse(ctx, x + w - 9, y + 44, 3.2, 3.2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  // window with face
  rr(ctx, x + 7, y + 10, w - 14, 22, 9);
  ctx.fillStyle = '#e9fbff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  const cx = x + w / 2, cy = y + 20;
  ctx.fillStyle = OUT;
  ctx.lineWidth = 2.2;
  switch (face) {
    case 'idle':
      ellipse(ctx, cx - 5, cy, 2, 2.6); ctx.fill();
      ellipse(ctx, cx + 5, cy, 2, 2.6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 4, cy + 6); ctx.quadraticCurveTo(cx + 1, cy + 9, cx + 5, cy + 5); ctx.stroke();
      break;
    case 'hehe':
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 1); ctx.quadraticCurveTo(cx - 5, cy - 3, cx - 2, cy + 1);
      ctx.moveTo(cx + 2, cy + 1); ctx.quadraticCurveTo(cx + 5, cy - 3, cx + 8, cy + 1);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 5, cy + 4); ctx.quadraticCurveTo(cx, cy + 11, cx + 5, cy + 4); ctx.closePath();
      ctx.fillStyle = '#7a2340'; ctx.fill(); ctx.stroke();
      break;
    case 'wink':
      ellipse(ctx, cx - 5, cy, 2, 2.6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 8, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 5, cy + 5); ctx.quadraticCurveTo(cx, cy + 10, cx + 5, cy + 5); ctx.stroke();
      break;
    case 'run':
      ellipse(ctx, cx - 4, cy, 2, 2.6); ctx.fill();
      ellipse(ctx, cx + 6, cy, 2, 2.6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 5); ctx.lineTo(cx - 2, cy - 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx + 10, cy - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 3, cy + 6); ctx.lineTo(cx + 6, cy + 6); ctx.stroke();
      break;
    case 'tired':
      ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx - 2, cy); ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 8, cy); ctx.stroke();
      ellipse(ctx, cx, cy + 6, 2.5, 3); ctx.fillStyle = '#7a2340'; ctx.fill(); ctx.stroke();
      break;
    case 'chomp': {
      // angry eyes
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 4); ctx.lineTo(cx - 3, cy - 1); ctx.moveTo(cx + 3, cy - 1); ctx.lineTo(cx + 9, cy - 4); ctx.stroke();
      ellipse(ctx, cx - 5, cy + 2, 1.8, 2); ctx.fill();
      ellipse(ctx, cx + 5, cy + 2, 1.8, 2); ctx.fill();
      // big mouth with teeth across the lower door
      rr(ctx, x + 5, y + 38, w - 10, 30, 8);
      ctx.fillStyle = '#5a1430'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const tx = x + 7 + i * 6.5;
        ctx.beginPath(); ctx.moveTo(tx, y + 39); ctx.lineTo(tx + 3.2, y + 47); ctx.lineTo(tx + 6.4, y + 39); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx, y + 67); ctx.lineTo(tx + 3.2, y + 59); ctx.lineTo(tx + 6.4, y + 67); ctx.closePath(); ctx.fill();
      }
      break;
    }
  }
}

/** The EXIT sign on the doors, in the current language (redrawn when it changes). */
export function makeExitSign(scene: Phaser.Scene): void {
  const [c, ctx] = canvas(56, 24);
  drawExitSign(ctx, t('ui.exitSign'));
  add(scene, 'exit-sign', c);
}

function drawExitSign(ctx: C2D, text = 'EXIT'): void {
  rr(ctx, 2, 2, 52, 20, 7);
  const g = ctx.createLinearGradient(0, 2, 0, 22);
  g.addColorStop(0, '#5ee07a');
  g.addColorStop(1, '#2fae4f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  let size = 13;
  ctx.font = `900 ${size}px ${FONT}`;
  while (size > 7 && ctx.measureText(text).width > 46) { size -= 0.5; ctx.font = `900 ${size}px ${FONT}`; }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 28, 13);
}

function drawLeg(ctx: C2D): void {
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(5, 12);
  ctx.stroke();
  ellipse(ctx, 7, 13, 5.5, 3.2);
  ctx.fillStyle = '#ff6f61';
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Hazards & props

function drawSpikes(ctx: C2D): void {
  // Two spikes pointing up inside a 40×40 tile; base at the bottom.
  for (let i = 0; i < 2; i++) {
    const bx = 2 + i * 18;
    ctx.beginPath();
    ctx.moveTo(bx, 39);
    ctx.lineTo(bx + 9, 14);
    ctx.lineTo(bx + 18, 39);
    ctx.closePath();
    const g = ctx.createLinearGradient(bx, 0, bx + 18, 0);
    g.addColorStop(0, '#f4f6fb');
    g.addColorStop(0.5, '#c9cfe0');
    g.addColorStop(1, '#8c93ad');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 5, 34);
    ctx.lineTo(bx + 9, 21);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function drawPad(ctx: C2D, squashed: boolean, style: 'normal' | 'dud' | 'side' = 'normal'): void {
  const top = squashed ? 26 : 16;
  // spring coils
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const n = 3;
  for (let i = 0; i <= n; i++) {
    const yy = 36 - ((36 - top - 4) * i) / n;
    ctx.lineTo(i % 2 ? 28 : 12, yy);
  }
  ctx.stroke();
  // base
  rr(ctx, 4, 34, 32, 6, 3);
  ctx.fillStyle = '#5b6077';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // top plate
  rr(ctx, 2, top - 4, 36, 9, 4.5);
  const g = ctx.createLinearGradient(0, top - 4, 0, top + 5);
  g.addColorStop(0, style === 'dud' ? '#c9a27a' : style === 'side' ? '#7de0ff' : '#ff7d7d');
  g.addColorStop(1, style === 'dud' ? '#9a7550' : style === 'side' ? '#2f9fd0' : '#e0384a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  rr(ctx, 7, top - 2, 12, 2.5, 1.2);
  ctx.fill();
  if (style === 'side') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(26, top - 2); ctx.lineTo(33, top + 0.5); ctx.lineTo(26, top + 3); ctx.closePath(); ctx.fill();
  }
  if (style === 'dud') {
    ctx.fillStyle = 'rgba(120,70,30,0.6)';
    ellipse(ctx, 12, top, 2, 1.4); ctx.fill();
    ellipse(ctx, 27, top + 1, 1.6, 1.2); ctx.fill();
  }
}

function drawCoin(ctx: C2D, spiky: boolean): void {
  const cx = 16, cy = 16;
  if (spiky) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 10 : 16;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#c9cfe0';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
  ellipse(ctx, cx, cy, 10, 10);
  const g = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 11);
  g.addColorStop(0, spiky ? '#ff9a7a' : '#fff4a8');
  g.addColorStop(1, spiky ? '#d83a3a' : '#f5b014');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  if (spiky) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 4); ctx.lineTo(cx - 2, cy - 2);
    ctx.moveTo(cx + 6, cy - 4); ctx.lineTo(cx + 2, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 3.5, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  } else {
    rr(ctx, cx - 2, cy - 6, 4, 12, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  }
}

/** A grumpy spiked ball, centred in a 40×40 tile. */
function drawBall(ctx: C2D): void {
  const cx = 20, cy = 20;
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = i % 2 ? 13 : 19;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#c9cfe0';
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ellipse(ctx, cx, cy, 13, 13);
  const g = ctx.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, 14);
  g.addColorStop(0, '#8a8fa8');
  g.addColorStop(1, '#3d4157');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 5); ctx.lineTo(cx - 2, cy - 2);
  ctx.moveTo(cx + 8, cy - 5); ctx.lineTo(cx + 2, cy - 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, cx - 4, cy + 1, 1.8, 1.8); ctx.fill();
  ellipse(ctx, cx + 4, cy + 1, 1.8, 1.8); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + 9, 4, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
}

function drawSkull(ctx: C2D): void {
  ellipse(ctx, 16, 14, 12, 11);
  ctx.fillStyle = '#fff6d5';
  ctx.fill();
  rr(ctx, 9, 18, 14, 10, 4);
  ctx.fill();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = OUT;
  ellipse(ctx, 16, 14, 12, 11);
  ctx.stroke();
  ctx.fillStyle = OUT;
  ellipse(ctx, 11.5, 14, 3.4, 3.8); ctx.fill();
  ellipse(ctx, 20.5, 14, 3.4, 3.8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16, 18); ctx.lineTo(14.5, 21); ctx.lineTo(17.5, 21); ctx.closePath(); ctx.fill();
  ctx.fillRect(12, 24, 1.8, 4);
  ctx.fillRect(15.1, 24, 1.8, 4);
  ctx.fillRect(18.2, 24, 1.8, 4);
}

/** Checkpoint flag on a pole; the pole's foot is at (12, 78). */
function drawFlag(ctx: C2D, on: boolean): void {
  rr(ctx, 4, 72, 18, 7, 3);
  ctx.fillStyle = '#5b6077';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  rr(ctx, 10, 6, 5, 68, 2.5);
  ctx.fillStyle = '#e9ecf5';
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, 12.5, 6, 4.5, 4.5);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.stroke();
  const fy = on ? 10 : 46;
  ctx.beginPath();
  ctx.moveTo(15, fy);
  ctx.quadraticCurveTo(26, fy + 2, 37, fy + 3);
  ctx.quadraticCurveTo(30, fy + 10, 37, fy + 19);
  ctx.quadraticCurveTo(26, fy + 18, 15, fy + 22);
  ctx.closePath();
  ctx.fillStyle = on ? '#6fd36b' : '#b8bdd0';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (on) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(20, fy + 11); ctx.lineTo(24, fy + 15); ctx.lineTo(31, fy + 6);
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// UI icons (white glyphs)

function drawIcon(ctx: C2D, kind: string): void {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  const s = 32;
  switch (kind) {
    case 'pause':
      rr(ctx, 9, 7, 5, 18, 2); ctx.fill();
      rr(ctx, 18, 7, 5, 18, 2); ctx.fill();
      break;
    case 'restart':
      ctx.beginPath(); ctx.arc(16, 17, 8, -0.4 * Math.PI, 1.35 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, 3); ctx.lineTo(23, 9); ctx.lineTo(14, 13); ctx.closePath(); ctx.fill();
      break;
    case 'sound':
    case 'mute':
      ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(11, 12); ctx.lineTo(18, 6); ctx.lineTo(18, 26); ctx.lineTo(11, 20); ctx.lineTo(5, 20); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3;
      if (kind === 'sound') {
        ctx.beginPath(); ctx.arc(19, 16, 5, -0.3 * Math.PI, 0.3 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(19, 16, 10, -0.3 * Math.PI, 0.3 * Math.PI); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(21, 11); ctx.lineTo(29, 21); ctx.moveTo(29, 11); ctx.lineTo(21, 21); ctx.stroke();
      }
      break;
    case 'left':
    case 'right':
    case 'up': {
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(kind === 'left' ? Math.PI : kind === 'up' ? -Math.PI / 2 : 0);
      ctx.beginPath(); ctx.moveTo(-6, -11); ctx.lineTo(9, 0); ctx.lineTo(-6, 11); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.stroke(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'menu':
      for (let i = 0; i < 3; i++) { rr(ctx, 7, 8 + i * 7, 18, 3.5, 1.7); ctx.fill(); }
      break;
    case 'play':
      ctx.beginPath(); ctx.moveTo(11, 7); ctx.lineTo(25, 16); ctx.lineTo(11, 25); ctx.closePath(); ctx.lineWidth = 3; ctx.stroke(); ctx.fill();
      break;
    case 'lock':
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(16, 13, 6, Math.PI, 0); ctx.stroke();
      rr(ctx, 7, 13, 18, 13, 3); ctx.fill();
      break;
    case 'bulb': {
      ellipse(ctx, 16, 13, 8.5, 8.5); ctx.fill();
      rr(ctx, 12, 19, 8, 6, 2); ctx.fill();
      ctx.fillStyle = 'rgba(43,45,66,0.55)';
      rr(ctx, 12.5, 26, 7, 2.2, 1); ctx.fill();
      rr(ctx, 13.5, 29, 5, 2, 1); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
      for (const [x1, y1, x2, y2] of [[3, 13, 0.5, 13], [29, 13, 31.5, 13], [6, 4, 4, 2], [26, 4, 28, 2]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      break;
    }
    case 'globe': {
      ellipse(ctx, 16, 16, 12, 12); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ellipse(ctx, 16, 16, 5.5, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 16); ctx.lineTo(28, 16); ctx.moveTo(6.5, 9.5); ctx.lineTo(25.5, 9.5); ctx.moveTo(6.5, 22.5); ctx.lineTo(25.5, 22.5); ctx.stroke();
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 6 : 13;
        ctx.lineTo(16 + Math.cos(a) * r, 17 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Terrain (auto-tiled, merged blocks)

export type SolidFn = (tx: number, ty: number) => boolean;

export interface TerrainTile { tx: number; ty: number }

/** Neighbour mask bits for auto-tiling. */
export const M_UP = 1, M_RIGHT = 2, M_DOWN = 4, M_LEFT = 8;

/**
 * Draws ONE block tile whose top-left corner is (bx, by), given which of its four
 * neighbours are solid. Exposed edges get the thick outline and rounded convex corners;
 * exposed tops get the grass / icing band. Tiles drawn side by side merge seamlessly.
 */
export function drawTile(
  ctx: C2D, bx: number, by: number, mask: number, pal: Palette, variant: number,
  look?: 'cracked' | 'bolted', seam?: { l: boolean; r: boolean },
): void {
  const R = 10, O = 4;
  const u = !!(mask & M_UP), d = !!(mask & M_DOWN), l = !!(mask & M_LEFT), r = !!(mask & M_RIGHT);
  const radii = [!u && !l ? R : 0, !u && !r ? R : 0, !d && !r ? R : 0, !d && !l ? R : 0] as [number, number, number, number];
  ctx.fillStyle = pal.outline;
  rr(ctx, bx, by, TILE, TILE, radii);
  ctx.fill();
  const x = bx + (l ? 0 : O);
  const y = by + (u ? 0 : O);
  const w = TILE - (l ? 0 : O) - (r ? 0 : O);
  const h = TILE - (u ? 0 : O) - (d ? 0 : O);
  const rad = radii.map((v) => (v ? R - O + 1 : 0)) as [number, number, number, number];
  const g = ctx.createLinearGradient(0, by, 0, by + TILE);
  g.addColorStop(0, pal.blockLight);
  g.addColorStop(1, pal.block);
  rr(ctx, x, y, w, h, rad);
  ctx.fillStyle = g;
  ctx.fill();
  // speckles
  ctx.fillStyle = pal.blockDark;
  const seed = [3, 7, 10][variant % 3];
  ctx.globalAlpha = 0.55;
  ellipse(ctx, bx + 10 + (seed % 5) * 4, by + 24 + (seed % 3) * 3, 2.4, 1.6);
  ctx.fill();
  ellipse(ctx, bx + 27 - (seed % 4) * 3, by + 14 + (seed % 4) * 4, 1.8, 1.3);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (!u) {
    ctx.save();
    rr(ctx, x, y, w, h, rad);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(bx - 1, by);
    ctx.lineTo(bx + TILE + 1, by);
    ctx.lineTo(bx + TILE + 1, by + 12);
    for (let i = 4; i >= 0; i--) {
      const px = bx + i * 10;
      ctx.quadraticCurveTo(px + 5, by + 18, px, by + 12);
    }
    ctx.closePath();
    ctx.fillStyle = pal.top;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,45,66,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = pal.topLight;
    rr(ctx, x + 4, by + 5, Math.max(4, w - 14), 3, 1.5);
    ctx.fill();
    ctx.restore();
  }
  if (look === 'cracked') {
    ctx.strokeStyle = 'rgba(43,45,66,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx + 12, by + 16); ctx.lineTo(bx + 17, by + 23); ctx.lineTo(bx + 14, by + 30);
    ctx.moveTo(bx + 17, by + 23); ctx.lineTo(bx + 25, by + 25);
    ctx.stroke();
  }
  if (look === 'bolted') {
    ctx.fillStyle = '#e9ecf5';
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 1.6;
    for (const [px, py] of [[9, 10], [31, 10]]) {
      ellipse(ctx, bx + px, by + py, 3, 3);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (seam && (seam.l || seam.r)) {
    ctx.strokeStyle = 'rgba(43,45,66,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (seam.l) { ctx.moveTo(bx + 1, by + 3); ctx.lineTo(bx + 1, by + TILE - 3); }
    if (seam.r) { ctx.moveTo(bx + TILE - 1, by + 3); ctx.lineTo(bx + TILE - 1, by + TILE - 3); }
    ctx.stroke();
  }
}

export function maskAt(isSolid: SolidFn, tx: number, ty: number): number {
  return (isSolid(tx, ty - 1) ? M_UP : 0) | (isSolid(tx + 1, ty) ? M_RIGHT : 0) | (isSolid(tx, ty + 1) ? M_DOWN : 0) | (isSolid(tx - 1, ty) ? M_LEFT : 0);
}

/**
 * Draws a set of block tiles (a trap group) into its own canvas, merged with whatever
 * `isSolid` says is around it, so it is indistinguishable from the ground.
 */
export function drawTerrain(
  tiles: TerrainTile[], isSolid: SolidFn, pal: Palette,
  bounds: { x: number; y: number; w: number; h: number },
  look?: 'cracked' | 'bolted', seamWith?: SolidFn,
): HTMLCanvasElement {
  const [c, ctx] = canvas(bounds.w, bounds.h);
  ctx.translate(-bounds.x, -bounds.y);
  for (const t of tiles) {
    const seam = seamWith ? { l: seamWith(t.tx - 1, t.ty), r: seamWith(t.tx + 1, t.ty) } : undefined;
    drawTile(ctx, t.tx * TILE, t.ty * TILE, maskAt(isSolid, t.tx, t.ty), pal, (t.tx * 7 + t.ty * 13) % 3, look, seam);
  }
  return c;
}

/** Tileset for the static terrain: 16 neighbour masks × 3 speckle variants, extruded. */
export const TILESET_PAD = 2; // px of extrusion around every frame (prevents seams when zoomed)
export function makeTerrainTileset(scene: Phaser.Scene, key: string, pal: Palette): void {
  if (scene.textures.exists(key)) return;
  const F = TILE * RES, P = TILESET_PAD, S = F + P * 2;
  const c = document.createElement('canvas');
  c.width = S * 16;
  c.height = S * 3;
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  for (let v = 0; v < 3; v++) for (let m = 0; m < 16; m++) {
    const ox = m * S + P, oy = v * S + P;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(RES, RES);
    drawTile(ctx, 0, 0, m, pal, v);
    ctx.restore();
    // extrude the frame's border pixels outward
    for (let i = 1; i <= P; i++) {
      ctx.drawImage(c, ox, oy, 1, F, ox - i, oy, 1, F);
      ctx.drawImage(c, ox + F - 1, oy, 1, F, ox + F - 1 + i, oy, 1, F);
    }
    for (let i = 1; i <= P; i++) {
      ctx.drawImage(c, ox - P, oy, S, 1, ox - P, oy - i, S, 1);
      ctx.drawImage(c, ox - P, oy + F - 1, S, 1, ox - P, oy + F - 1 + i, S, 1);
    }
  }
  scene.textures.addCanvas(key, c);
}

export function addTerrainTexture(scene: Phaser.Scene, key: string, c: HTMLCanvasElement): void {
  add(scene, key, c);
}

// ---------------------------------------------------------------------------
// Buttons

export function makeButtonTexture(scene: Phaser.Scene, key: string, w: number, h: number, fill: string, radius = 18): void {
  if (scene.textures.exists(key)) return;
  const [c, ctx] = canvas(w + 8, h + 12);
  rr(ctx, 4, 8, w, h, radius);
  ctx.fillStyle = OUT;
  ctx.fill();
  rr(ctx, 4, 3, w, h, radius);
  const g = ctx.createLinearGradient(0, 3, 0, 3 + h);
  g.addColorStop(0, shade(fill, 0.18));
  g.addColorStop(1, fill);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rr(ctx, 4 + radius * 0.6, 8, w - radius * 1.2, Math.min(8, h * 0.18), 4);
  ctx.fill();
  add(scene, key, c);
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.round(Math.min(255, v + (255 - v) * amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------------------------------------------------------------------------
// Props for the newer traps: conveyor chevrons, turret, frog, bird, storm cloud,
// lightning, darkness veil, screen smudge and the off-screen arrow.

function drawTrapProps(scene: Phaser.Scene): void {
  let c: HTMLCanvasElement, ctx: C2D;
  [c, ctx] = canvas(20, 12);
  ctx.strokeStyle = '#fff6d5'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(10, 6); ctx.lineTo(4, 10); ctx.moveTo(11, 2); ctx.lineTo(17, 6); ctx.lineTo(11, 10); ctx.stroke();
  add(scene, 'chevron', c);

  [c, ctx] = canvas(24, 28);
  rr(ctx, 2, 4, 20, 20, 6); ctx.fillStyle = '#3b3f58'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  ellipse(ctx, 8, 14, 5, 5); ctx.fillStyle = '#111'; ctx.fill();
  ctx.fillStyle = '#ff5a5a'; ellipse(ctx, 16, 10, 2.5, 2.5); ctx.fill();
  add(scene, 'turret-mouth', c);

  // copycat frog (spiky, deadly)
  [c, ctx] = canvas(TILE, TILE);
  ctx.fillStyle = '#c9cfe0';
  for (let i = 0; i < 5; i++) { const x = 6 + i * 7; ctx.beginPath(); ctx.moveTo(x - 4, 16); ctx.lineTo(x, 4); ctx.lineTo(x + 4, 16); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
  ellipse(ctx, 20, 25, 16, 12); ctx.fillStyle = '#58c25a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  for (const ex of [12, 28]) { ellipse(ctx, ex, 17, 5, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); ellipse(ctx, ex, 17, 2, 2); ctx.fillStyle = OUT; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(12, 30); ctx.quadraticCurveTo(20, 35, 28, 30); ctx.stroke();
  add(scene, 'frog', c);

  // homing spike bird
  [c, ctx] = canvas(TILE, TILE);
  ctx.fillStyle = '#8c93ad';
  ctx.beginPath(); ctx.moveTo(4, 20); ctx.lineTo(14, 4); ctx.lineTo(20, 16); ctx.lineTo(26, 4); ctx.lineTo(36, 20); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
  ellipse(ctx, 20, 24, 11, 10); ctx.fillStyle = '#e05a7a'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(18, 27); ctx.lineTo(22, 27); ctx.lineTo(20, 36); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const ex of [16, 24]) { ellipse(ctx, ex, 22, 2.4, 2.4); ctx.fillStyle = '#fff'; ctx.fill(); }
  add(scene, 'bird', c);

  // storm cloud and lightning bolt
  [c, ctx] = canvas(140, 70);
  ctx.fillStyle = '#5b6077'; ctx.strokeStyle = OUT; ctx.lineWidth = 4;
  for (const [x, y, r] of [[34, 42, 22], [62, 30, 28], [96, 38, 24], [116, 48, 16], [70, 50, 22]]) { ellipse(ctx, x, y, r, r * 0.85); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ellipse(ctx, 60, 24, 14, 6); ctx.fill();
  add(scene, 'storm', c);
  [c, ctx] = canvas(40, 540);
  ctx.fillStyle = 'rgba(255,242,122,0.35)'; ctx.fillRect(4, 0, 32, 540);
  ctx.strokeStyle = '#fff27a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(20, 0);
  for (let y = 0; y <= 540; y += 30) ctx.lineTo(y % 60 ? 30 : 10, y);
  ctx.stroke();
  add(scene, 'bolt', c);

  // darkness veil: opaque everywhere except a soft round hole in the middle.
  // 750 px texture shown 2.2–4× (the game scales it), so it always covers the screen.
  [c, ctx] = canvas(750, 750, 1);
  ctx.fillStyle = 'rgba(12,10,26,0.97)'; ctx.fillRect(0, 0, 750, 750);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(375, 375, 25, 375, 375, 60);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 750, 750);
  ctx.globalCompositeOperation = 'source-over';
  add(scene, 'veil', c);

  // a big greasy smudge stuck to the screen
  [c, ctx] = canvas(520, 420);
  ctx.fillStyle = '#6b5a4a';
  for (const [x, y, r] of [[200, 210, 150], [320, 170, 130], [300, 290, 120], [150, 300, 90], [400, 260, 90], [250, 110, 90]]) { ellipse(ctx, x, y, r, r * 0.9); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ellipse(ctx, 230, 150, 60, 25); ctx.fill();
  add(scene, 'smudge', c);

  // off-screen arrow (points right; rotated toward the hero)
  [c, ctx] = canvas(56, 48);
  ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(30, 14); ctx.lineTo(30, 4); ctx.lineTo(52, 24); ctx.lineTo(30, 44); ctx.lineTo(30, 34); ctx.lineTo(4, 34); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
  add(scene, 'edge-arrow', c);
}

export function generateTextures(scene: Phaser.Scene): void {
  let c: HTMLCanvasElement, ctx: C2D;

  [c, ctx] = canvas(HERO_W, HERO_H, HERO_RES); drawHeroBody(ctx); add(scene, 'hero-body', c);
  for (const e of ['happy', 'focus', 'shock', 'dead', 'blink'] as Expr[]) {
    [c, ctx] = canvas(HERO_W, HERO_H, HERO_RES); drawFace(ctx, e); add(scene, `face-${e}`, c);
  }
  [c, ctx] = canvas(14, 10, HERO_RES); drawFoot(ctx); add(scene, 'hero-foot', c);
  [c, ctx] = canvas(24, 20, HERO_RES); drawLeaf(ctx); add(scene, 'hero-leaf', c);

  for (const f of ['idle', 'hehe', 'wink', 'run', 'tired', 'chomp'] as DoorFace[]) {
    [c, ctx] = canvas(DOOR_W, DOOR_H); drawDoor(ctx, f); add(scene, `door-${f}`, c);
  }
  makeExitSign(scene);
  [c, ctx] = canvas(14, 18); drawLeg(ctx); add(scene, 'door-leg', c);

  [c, ctx] = canvas(TILE, TILE); drawSpikes(ctx); add(scene, 'spike', c);
  [c, ctx] = canvas(TILE, TILE); drawPad(ctx, false); add(scene, 'pad', c);
  [c, ctx] = canvas(TILE, TILE); drawPad(ctx, true); add(scene, 'pad-squash', c);
  [c, ctx] = canvas(TILE, TILE); drawPad(ctx, false, 'dud'); add(scene, 'pad-dud', c);
  [c, ctx] = canvas(TILE, TILE); drawPad(ctx, true, 'dud'); add(scene, 'pad-dud-squash', c);
  [c, ctx] = canvas(TILE, TILE); drawPad(ctx, false, 'side'); add(scene, 'pad-side', c);
  [c, ctx] = canvas(TILE, TILE); drawPad(ctx, true, 'side'); add(scene, 'pad-side-squash', c);
  [c, ctx] = canvas(TILE, TILE); drawBall(ctx); add(scene, 'ball', c);
  [c, ctx] = canvas(32, 32); drawCoin(ctx, false); add(scene, 'coin', c);
  [c, ctx] = canvas(32, 32); drawCoin(ctx, true); add(scene, 'coin-spiky', c);
  [c, ctx] = canvas(32, 32); drawSkull(ctx); add(scene, 'skull', c);
  [c, ctx] = canvas(40, 80); drawFlag(ctx, false); add(scene, 'flag', c);
  [c, ctx] = canvas(40, 80); drawFlag(ctx, true); add(scene, 'flag-on', c);
  for (const k of ['pause', 'restart', 'sound', 'mute', 'left', 'right', 'up', 'menu', 'play', 'lock', 'star', 'bulb', 'globe']) {
    [c, ctx] = canvas(32, 32); drawIcon(ctx, k); add(scene, `icon-${k}`, c);
  }

  drawTrapProps(scene);

  // particles
  [c, ctx] = canvas(12, 12); ellipse(ctx, 6, 6, 5, 5); ctx.fillStyle = '#fff'; ctx.fill(); add(scene, 'p-dot', c);
  [c, ctx] = canvas(20, 20);
  { const g = ctx.createRadialGradient(10, 10, 1, 10, 10, 10); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 20, 20); }
  add(scene, 'p-puff', c);
  [c, ctx] = canvas(10, 6); rr(ctx, 0, 0, 10, 6, 2); ctx.fillStyle = '#fff'; ctx.fill(); add(scene, 'p-confetti', c);
  [c, ctx] = canvas(16, 16);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 3 : 7.5; ctx.lineTo(8 + Math.cos(a) * r, 8 + Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); add(scene, 'p-star', c);

  // backgrounds per palette: vertical gradient strip + dot pattern
  PALETTES.forEach((p, i) => {
    [c, ctx] = canvas(4, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, p.bgTop);
    g.addColorStop(1, p.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    add(scene, `bg-${i}`, c);
    [c, ctx] = canvas(28, 28);
    ctx.fillStyle = p.dot;
    ellipse(ctx, 7, 7, 2, 2); ctx.fill();
    ellipse(ctx, 21, 21, 2, 2); ctx.fill();
    add(scene, `dots-${i}`, c);
  });

  // parallax scenery per palette: distant hills (tileable) and clouds (tileable)
  PALETTES.forEach((p, i) => {
    [c, ctx] = canvas(640, 260);
    const hill = (x: number, w: number, h: number, col: string) => {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 260);
      ctx.bezierCurveTo(x - w / 2, 260 - h, x - w * 0.2, 260 - h * 1.05, x, 260 - h);
      ctx.bezierCurveTo(x + w * 0.2, 260 - h * 1.05, x + w / 2, 260 - h, x + w / 2, 260);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    for (const off of [-640, 0, 640]) {
      hill(off + 90, 300, 150, p.dot.replace(/[\d.]+\)$/, '0.10)'));
      hill(off + 330, 380, 200, p.dot.replace(/[\d.]+\)$/, '0.08)'));
      hill(off + 540, 260, 120, p.dot.replace(/[\d.]+\)$/, '0.10)'));
    }
    add(scene, `hills-${i}`, c);
  });
  [c, ctx] = canvas(720, 300);
  const cloud = (x: number, y: number, k: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [dx, dy, r] of [[0, 0, 26], [28, -12, 32], [60, 0, 24], [30, 8, 26]]) { ellipse(ctx, x + dx * k, y + dy * k, r * k, r * k * 0.8); ctx.fill(); }
  };
  for (const off of [-720, 0, 720]) { cloud(off + 80, 70, 1.2); cloud(off + 330, 150, 0.9); cloud(off + 560, 50, 1.4); cloud(off + 470, 230, 0.7); }
  add(scene, 'clouds', c);
  // speech bubble is drawn with Graphics at runtime; title logo letters use text.
}
