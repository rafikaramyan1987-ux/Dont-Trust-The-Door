// Unified input: keyboard + on-screen touch buttons + (test only) scripted bot.

export interface Keys {
  left: boolean;
  right: boolean;
  jump: boolean;
}

type Cmd = 'pause' | 'restart' | 'mute' | 'confirm' | 'back';

const kb = { left: false, right: false, jump: false };
const held = new Set<string>();
const listeners = new Set<(c: Cmd) => void>();

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = ['ArrowUp', 'KeyW', 'Space', 'KeyZ', 'KeyK'];

function recompute(): void {
  kb.left = LEFT.some((k) => held.has(k));
  kb.right = RIGHT.some((k) => held.has(k));
  kb.jump = JUMP.some((k) => held.has(k));
}

function emit(c: Cmd): void {
  listeners.forEach((l) => l(c));
}

window.addEventListener('keydown', (e) => {
  if ([...LEFT, ...RIGHT, ...JUMP, 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'Escape' || e.code === 'KeyP') emit('pause');
    if (e.code === 'KeyR') emit('restart');
    if (e.code === 'KeyM') emit('mute');
    if (e.code === 'Enter' || e.code === 'Space') emit('confirm');
    if (e.code === 'Backspace') emit('back');
  }
  held.add(e.code);
  recompute();
});
window.addEventListener('keyup', (e) => {
  held.delete(e.code);
  recompute();
});
window.addEventListener('blur', () => {
  held.clear();
  recompute();
});

const params = new URLSearchParams(window.location.search);

export const Input = {
  touch: { left: false, right: false, jump: false } as Keys,
  /** When set (tests), replaces player input entirely. */
  bot: null as Keys | null,
  /** True when touch controls should be shown. */
  touchUI:
    params.get('touch') === '1' ||
    (params.get('touch') !== '0' &&
      ((typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
        navigator.maxTouchPoints > 0)),
  read(): Keys {
    if (this.bot) return { ...this.bot };
    return {
      left: kb.left || this.touch.left,
      right: kb.right || this.touch.right,
      jump: kb.jump || this.touch.jump,
    };
  },
  on(fn: (c: Cmd) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  isTest: params.has('test'),
};

window.addEventListener(
  'touchstart',
  () => {
    if (!Input.touchUI && params.get('touch') !== '0') {
      Input.touchUI = true;
      window.dispatchEvent(new Event('dttd-touchui'));
    }
  },
  { passive: true },
);
