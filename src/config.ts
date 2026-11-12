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
    name: 'Candy Clouds',
    bgTop: '#ffd3e6', bgBottom: '#fff4f8', dot: 'rgba(160,50,100,0.12)',
    block: '#9f7bd8', blockLight: '#b99cec', blockDark: '#7e5bb8',
    top: '#ff8fbe', topLight: '#ffc0da', outline: OUT, accent: '#41c6c0',
    hex: { bg: 0xffd3e6, accent: 0x41c6c0, ui: 0x2b2d42 },
  },
  {
    name: 'Twilight Tiles',
    bgTop: '#c9d3ff', bgBottom: '#eef0ff', dot: 'rgba(40,50,140,0.13)',
    block: '#5a7bd8', blockLight: '#7d98ea', blockDark: '#4260b8',
    top: '#7fe0f0', topLight: '#bff3fa', outline: OUT, accent: '#ffb547',
    hex: { bg: 0xc9d3ff, accent: 0xffb547, ui: 0x2b2d42 },
  },
  {
    name: 'Sunset Finale',
    bgTop: '#ffd1b0', bgBottom: '#fff1e2', dot: 'rgba(150,60,20,0.12)',
    block: '#d8664a', blockLight: '#ea8a68', blockDark: '#b44a32',
    top: '#ffc84a', topLight: '#ffe590', outline: OUT, accent: '#5b8cff',
    hex: { bg: 0xffd1b0, accent: 0x5b8cff, ui: 0x2b2d42 },
  },
];

export const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", "Verdana", system-ui, sans-serif';
export const COLORS = {
  outline: 0x2b2d42,
  hero: 0xffd23f,
  cream: 0xfff6d5,
  white: 0xffffff,
};
