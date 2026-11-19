// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
  // level 18 (src/game/ext/l18.ts): ghosts, planks that need your eyes, possessed furniture
  {
    kinds: ['ghost', 'gaze', 'front', 'chair', 'key', 'candles', 'carrier', 'portrait', 'music', 'beam', 'shy', 'rug', 'lift', 'slamdoor', 'exitghost', 'mirror', 'cobweb'],
    alts(def) {
      const e = def.ext;
      const out = [];
      const span = (n, f) => { for (let i = 0; i <= n; i++) out.push(f(i)); };
      switch (e.kind) {
        // there or not, depending on where you look / whether it was blown out or dropped
        case 'gaze': case 'front': case 'key': case 'candles': case 'beam': out.push({ dx: 0, dy: 0, present: false }); break;
        case 'carrier': span(e.range, (i) => ({ dx: i, dy: 0, present: true })); out.push({ dx: 0, dy: 0, present: false }); break;
        case 'chair': for (let x = e.min; x <= e.max; x++) out.push({ dx: x, dy: 0, present: true }); break;
        case 'shy': span(4, (i) => ({ dx: (e.to[0] * i) / 4, dy: (e.to[1] * i) / 4, present: true })); break;
        case 'rug': span(e.range, (i) => ({ dx: i, dy: 0, present: true })); for (let d = 1; d <= e.maxSink; d++) out.push({ dx: 0, dy: d, present: true }, { dx: e.range >> 1, dy: d, present: true }); break;
        case 'lift': span(e.rise, (i) => ({ dx: 0, dy: -i, present: true })); break;
      }
      return out;
    },
  },
];

export function extFor(def) {
  const kind = def?.ext?.kind;
  return kind ? SOFTLOCK_EXT.find((e) => e.kinds.includes(kind)) : null;
}
