// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
  // level 17 (src/game/ext/l17.ts): wind zones, balloons and the windmill only push / lift / sweep (no tiles of
  // their own); the floating thistles are spiked
  { kinds: ['wind', 'balloon', 'thistle', 'mill'], cell: (d) => ({ solid: false, deadly: d.ext.kind === 'thistle' }) },
  // level 15 (src/game/ext/l15.ts): lasers are drawn by the extension and are no terrain ('?'); the solar lift rides
  // up and down (every height it can stop at), the hard-light bridge is there once it has slid out
  {
    kinds: ['solar', 'blade'],
    alts(def) {
      const e = def.ext;
      if (e.kind === 'blade') return [{ dx: 0, dy: 0, present: true }];
      const out = [];
      for (let dy = Math.round(e.minOy / 40); dy <= Math.round(e.maxOy / 40); dy++) if (dy) out.push({ dx: 0, dy, present: true });
      return out;
    },
  },
  // level 20: the arrow plank tips over (gone); signs, guides and party guests drawn on '?' tiles are nothing to stand on
  { kinds: ['l20seesaw'], alts: () => [{ dx: 0, dy: 0, present: false }] },
  // level 14: locks open (their tiles go), lowered bridges appear, a key lying in a bridge can be picked up (it goes);
  // a key, a padlock hanging from a post, a magpie or a bat take no room
  { kinds: ['lock', 'key'], alts: () => [{ dx: 0, dy: 0, present: false }] },
  { kinds: ['bridge'], alts: () => [{ dx: 0, dy: 0, present: true }] },
  // level 19: walls / bridge planks that explosions blow away, and the giant (solid) bomb that pops
  { kinds: ['fw-wall', 'fw-bomb'], alts: () => [{ dx: 0, dy: 0, present: false }] },
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
