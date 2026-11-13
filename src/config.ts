// Global tuning constants. All simulation runs at a fixed 60 ticks per second.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const WORLD_W = TILE * COLS; // 1280
export const WORLD_H = TILE * ROWS; // 720

export const TICK_MS = 1000 / 60;
export const DT = 1 / 60;

/** Player movement tuning (pixels / second). */
export const PHYS = {
  bodyW: 26,
  bodyH: 28,
  maxRun: 300,
  groundAccel: 3600,
  groundDecel: 5400,
  airAccel: 2600,
  airDecel: 1800,
  gravity: 2300,
  fallGravityMul: 1.18,
  jumpVel: 770,
  jumpCutMul: 0.45,
  maxFall: 950,
  padVel: 1450,
  coyoteTicks: 6,
  bufferTicks: 7,
};

/** Death → restart delay (ticks). 16 ticks ≈ 0.27 s. */
export const RESTART_TICKS = 16;

export interface Palette {
  name: string;
  bgTop: string;
  bgBottom: string;
  dot: string;
  block: string;
  blockLight: string;
  blockDark: string;
  top: string; // grass / icing band
  topLight: string;
  outline: string;
  accent: string;
  hex: { bg: number; accent: number; ui: number };
}

const OUT = '#2b2d42';

export const PALETTES: Palette[] = [
  {
    name: 'Mint Meadow',
    bgTop: '#bdf0e4', bgBottom: '#f0fff7', dot: 'rgba(34,104,92,0.13)',
    block: '#c9925e', blockLight: '#dcae7c', blockDark: '#a8723f',
    top: '#6fd36b', topLight: '#a6ee8f', outline: OUT, accent: '#ff8a5b',
    hex: { bg: 0xbdf0e4, accent: 0xff8a5b, ui: 0x2b2d42 },
  },
  {
    name: 'Golden Hour',
    bgTop: '#ffe9a8', bgBottom: '#fff8e0', dot: 'rgba(150,100,10,0.13)',
    block: '#b9845a', blockLight: '#cf9e74', blockDark: '#946240',
    top: '#f7c948', topLight: '#ffe58a', outline: OUT, accent: '#e0523b',
    hex: { bg: 0xffe9a8, accent: 0xe0523b, ui: 0x2b2d42 },
  },
  {
    name: 'Candy Clouds',
    bgTop: '#ffd3e6', bgBottom: '#fff4f8', dot: 'rgba(160,50,100,0.12)',
    block: '#9f7bd8', blockLight: '#b99cec', blockDark: '#7e5bb8',
    top: '#ff8fbe', topLight: '#ffc0da', outline: OUT, accent: '#41c6c0',
    hex: { bg: 0xffd3e6, accent: 0x41c6c0, ui: 0x2b2d42 },
  },
  {
    name: 'Deep Cave',
    bgTop: '#9d97b8', bgBottom: '#cfcbe0', dot: 'rgba(30,24,60,0.16)',
    block: '#6b6386', blockLight: '#857da0', blockDark: '#524a6b',
    top: '#9be0c8', topLight: '#c8f5e6', outline: OUT, accent: '#ffb547',
    hex: { bg: 0x9d97b8, accent: 0xffb547, ui: 0x2b2d42 },
  },
  {
    name: 'Neon Arcade',
    bgTop: '#2e2b5f', bgBottom: '#4b3f8a', dot: 'rgba(255,90,220,0.20)',
    block: '#3b8fd9', blockLight: '#5aaaf0', blockDark: '#2a6fb0',
    top: '#ff5ad6', topLight: '#ff9de8', outline: OUT, accent: '#ffe14d',
    hex: { bg: 0x2e2b5f, accent: 0xffe14d, ui: 0x2b2d42 },
  },
  {
    name: 'Twilight Tiles',
    bgTop: '#c9d3ff', bgBottom: '#eef0ff', dot: 'rgba(40,50,140,0.13)',
    block: '#5a7bd8', blockLight: '#7d98ea', blockDark: '#4260b8',
    top: '#7fe0f0', topLight: '#bff3fa', outline: OUT, accent: '#ffb547',
    hex: { bg: 0xc9d3ff, accent: 0xffb547, ui: 0x2b2d42 },
  },
  {
    name: 'Royal Castle',
    bgTop: '#e8d6c4', bgBottom: '#f8efe6', dot: 'rgba(110,40,40,0.12)',
    block: '#9a8f87', blockLight: '#b3a9a1', blockDark: '#7a706a',
    top: '#c0413b', topLight: '#e4766e', outline: OUT, accent: '#4f8a3c',
    hex: { bg: 0xe8d6c4, accent: 0x4f8a3c, ui: 0x2b2d42 },
  },
  {
    name: 'Midnight',
    bgTop: '#1d2546', bgBottom: '#34416e', dot: 'rgba(200,220,255,0.18)',
    block: '#4a5a8c', blockLight: '#6475a8', blockDark: '#36436d',
    top: '#a8c8ff', topLight: '#d6e6ff', outline: OUT, accent: '#ff6f91',
    hex: { bg: 0x1d2546, accent: 0xff6f91, ui: 0x2b2d42 },
  },
  {
    name: 'Lava',
    bgTop: '#ffb38a', bgBottom: '#ffe0c7', dot: 'rgba(140,30,0,0.14)',
    block: '#5e4a4a', blockLight: '#786060', blockDark: '#463636',
    top: '#ff5a2e', topLight: '#ff9a6b', outline: OUT, accent: '#ffd23f',
    hex: { bg: 0xffb38a, accent: 0xffd23f, ui: 0x2b2d42 },
  },
  {
    name: 'Sunset',
    bgTop: '#ffd1b0', bgBottom: '#fff1e2', dot: 'rgba(150,60,20,0.12)',
    block: '#d8664a', blockLight: '#ea8a68', blockDark: '#b44a32',
    top: '#ffc84a', topLight: '#ffe590', outline: OUT, accent: '#5b8cff',
    hex: { bg: 0xffd1b0, accent: 0x5b8cff, ui: 0x2b2d42 },
  },
];

/** Nunito (bundled, SIL OFL): Latin, Latin-extended (Turkish) and Cyrillic glyphs. */
export const FONT = '"Nunito", "Trebuchet MS", "Verdana", system-ui, sans-serif';
export const COLORS = {
  outline: 0x2b2d42,
  hero: 0xffd23f,
  cream: 0xfff6d5,
  white: 0xffffff,
};
