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
/** levels the game is planned to have (the level select shows them all; those not built yet stay locked) */
export const PLANNED_LEVELS = 30;
/** level-select page size */
export const PAGE_SIZE = 10;

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
  },  {
    name: 'Factory Floor',
    bgTop: '#b8cbe0', bgBottom: '#e8f0f8', dot: 'rgba(30,60,100,0.13)',
    block: '#7b8ba3', blockLight: '#97a6bc', blockDark: '#5f6e86',
    top: '#ff9f43', topLight: '#ffc685', outline: OUT, accent: '#ff5e3a',
    hex: { bg: 0xb8cbe0, accent: 0xff5e3a, ui: 0x2b2d42 },
  },
  {
    name: 'Warehouse',
    bgTop: '#e6d3b8', bgBottom: '#fbf3e6', dot: 'rgba(110,70,30,0.13)',
    block: '#a8784c', blockLight: '#c2956a', blockDark: '#875a33',
    top: '#d9b778', topLight: '#efd7a2', outline: OUT, accent: '#3f8fd9',
    hex: { bg: 0xe6d3b8, accent: 0x3f8fd9, ui: 0x2b2d42 },
  },
  {
    name: 'Lagoon',
    bgTop: '#a9e4f2', bgBottom: '#e6fbff', dot: 'rgba(20,90,120,0.13)',
    block: '#3f8fb0', blockLight: '#5fabc9', blockDark: '#2d6f8e',
    top: '#7fe0c4', topLight: '#b8f5e2', outline: OUT, accent: '#ff7a59',
    hex: { bg: 0xa9e4f2, accent: 0xff7a59, ui: 0x2b2d42 },
  },
  {
    name: 'Vault',
    bgTop: '#d9d0ec', bgBottom: '#f5f1fc', dot: 'rgba(70,40,120,0.13)',
    block: '#8e7a5c', blockLight: '#a8957a', blockDark: '#6e5c42',
    top: '#e6c45a', topLight: '#f6df94', outline: OUT, accent: '#d94f8a',
    hex: { bg: 0xd9d0ec, accent: 0xd94f8a, ui: 0x2b2d42 },
  },
  {
    name: 'Neon Night',
    bgTop: '#4b4d7a', bgBottom: '#8d8fc0', dot: 'rgba(255,255,255,0.10)',
    block: '#3c3f66', blockLight: '#565a88', blockDark: '#2a2d4c',
    top: '#5ef0ff', topLight: '#b2f8ff', outline: OUT, accent: '#ff4fd8',
    hex: { bg: 0x4b4d7a, accent: 0xff4fd8, ui: 0x2b2d42 },
  },
  {
    name: 'Giant Garden',
    bgTop: '#cdeec0', bgBottom: '#f4fff0', dot: 'rgba(40,100,40,0.13)',
    block: '#8a6a4a', blockLight: '#a68566', blockDark: '#6c4f33',
    top: '#9ce06b', topLight: '#c8f5a2', outline: OUT, accent: '#ff6f91',
    hex: { bg: 0xcdeec0, accent: 0xff6f91, ui: 0x2b2d42 },
  },
  {
    name: 'Windy Peaks',
    bgTop: '#cfe6ff', bgBottom: '#f6fbff', dot: 'rgba(40,80,140,0.12)',
    block: '#8c96a8', blockLight: '#a8b1c1', blockDark: '#6e788a',
    top: '#eef4ff', topLight: '#ffffff', outline: OUT, accent: '#ff8a3d',
    hex: { bg: 0xcfe6ff, accent: 0xff8a3d, ui: 0x2b2d42 },
  },
  {
    name: 'Haunted Manor',
    bgTop: '#2e3350', bgBottom: '#6a6f99', dot: 'rgba(220,230,255,0.08)',
    block: '#6e5a7e', blockLight: '#8a76a0', blockDark: '#4e3e5e',
    top: '#9ee6c0', topLight: '#d2fbe6', outline: OUT, accent: '#ffb347',
    hex: { bg: 0x2e3350, accent: 0xffb347, ui: 0x2b2d42 },
  },
  {
    name: 'Fireworks Night',
    bgTop: '#3d3561', bgBottom: '#7b6fa8', dot: 'rgba(255,230,180,0.10)',
    block: '#5b4a7a', blockLight: '#76649a', blockDark: '#41345c',
    top: '#ff7b54', topLight: '#ffb38f', outline: OUT, accent: '#ffe066',
    hex: { bg: 0x3d3561, accent: 0xffe066, ui: 0x2b2d42 },
  },
  {
    name: 'Signpost Valley',
    bgTop: '#d6f0d8', bgBottom: '#f6fff4', dot: 'rgba(40,110,60,0.12)',
    block: '#b5835a', blockLight: '#cc9f78', blockDark: '#91623d',
    top: '#79c86a', topLight: '#aee69c', outline: OUT, accent: '#e84a5f',
    hex: { bg: 0xd6f0d8, accent: 0xe84a5f, ui: 0x2b2d42 },
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
