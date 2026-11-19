// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { level: N, kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
  // level 17 (src/game/ext/l17.ts): wind zones, balloons and the windmill only push / lift / sweep (no tiles of
  // their own); the floating thistles are spiked
  { level: 17, kinds: ['wind', 'balloon', 'thistle', 'mill'], cell: (d) => ({ solid: false, deadly: d.ext.kind === 'thistle' }) },
  // level 15 (src/game/ext/l15.ts): lasers are drawn by the extension and are no terrain ('?'); the solar lift rides
  // up and down (every height it can stop at), the hard-light bridge is there once it has slid out
  {
    level: 15, kinds: ['solar', 'blade'],
    alts(def) {
      const e = def.ext;
      if (e.kind === 'blade') return [{ dx: 0, dy: 0, present: true }];
      const out = [];
      for (let dy = Math.round(e.minOy / 40); dy <= Math.round(e.maxOy / 40); dy++) if (dy) out.push({ dx: 0, dy, present: true });
      return out;
    },
  },
  // level 20: the arrow plank tips over (gone); signs, guides and party guests drawn on '?' tiles are nothing to stand on
  { level: 20, kinds: ['l20seesaw'], alts: () => [{ dx: 0, dy: 0, present: false }] },
  // level 14: locks open (their tiles go), lowered bridges appear, a key lying in a bridge can be picked up (it goes);
  // a key, a padlock hanging from a post, a magpie or a bat take no room
  { level: 14, kinds: ['lock', 'key'], alts: () => [{ dx: 0, dy: 0, present: false }] },
  { level: 14, kinds: ['bridge'], alts: () => [{ dx: 0, dy: 0, present: true }] },
  // level 19: walls / bridge planks that explosions blow away, and the giant (solid) bomb that pops
  { level: 19, kinds: ['fw-wall', 'fw-bomb'], alts: () => [{ dx: 0, dy: 0, present: false }] },
  // level 18 (src/game/ext/l18.ts): ghosts, planks that need your eyes, possessed furniture
  {
    level: 18, kinds: ['ghost', 'gaze', 'front', 'chair', 'key', 'candles', 'carrier', 'portrait', 'music', 'beam', 'shy', 'rug', 'lift', 'slamdoor', 'exitghost', 'mirror', 'cobweb'],
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
  // level 16 (src/game/ext/l16.ts): sizes. The analyzer models the normal hero; mushrooms, arches, rings, puffballs,
  // vents, wind and flytraps are no terrain; a half-height slab (tiny-only slot) counts as open; brambles say in `sl`
  // whether they count as deadly. Cracked planks can be gone, lily pads / flower heads sunk, springs snapped.
  {
    level: 16, kinds: ['shroom', 'arch', 'ring', 'puff', 'slab', 'vent', 'wind', 'ray', 'bramble', 'flytrap', 'crack', 'lily', 'snap'],
    cell: (def) => def.ext.sl ?? {},
    alts: (def) => {
      const k = def.ext.kind;
      if (k === 'crack' || k === 'snap') return [{ dx: 0, dy: 0, present: false }];
      if (k === 'lily') return [{ dx: 0, dy: def.ext.sink ?? 3, present: true }];
      return [];
    },
  },
];

// kinds are per level (levels 16 and 17 both have 'wind', 14 and 18 both 'key', 15 and 18 both 'beam')
export function extFor(def, levelId) {
  const kind = def?.ext?.kind;
  return kind ? SOFTLOCK_EXT.find((e) => e.level === levelId && e.kinds.includes(kind)) ?? null : null;
}
