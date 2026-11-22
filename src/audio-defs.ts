// Names and timing shared by the runtime audio engine (src/audio.ts) and the offline
// synthesiser (src/audio-synth.ts, used only by tools/render-audio.mjs). No WebAudio here.

export const SFX_NAMES = [
  'jump', 'land', 'death', 'trap', 'win', 'hehe', 'coin', 'spikes',
  'crumble', 'click', 'flip', 'pad', 'chomp', 'run', 'slam',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

// Music: an original 8-bar loop at 150 BPM, one entry per 8th note.
export const BPM = 150;
export const MUSIC_EIGHTH = 60 / BPM / 2;
export const LOOP_STEPS = 64; // 8 bars of 8 eighths
export const LOOP_SECONDS = LOOP_STEPS * MUSIC_EIGHTH;

/** Recorded files in public/audio/ (copied to the build root); always relative to the page. */
export const MUSIC_FILE = 'music';
export const audioUrl = (name: string): string => `./audio/${name}.mp3`;
