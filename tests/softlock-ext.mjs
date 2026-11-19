// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
  // level 16 (src/game/ext/l16.ts): sizes. The analyzer models the normal hero; mushrooms, arches, rings, puffballs,
  // vents, wind and flytraps are no terrain; a half-height slab (tiny-only slot) counts as open; brambles say in `sl`
  // whether they count as deadly. Cracked planks can be gone, lily pads / flower heads sunk, springs snapped.
  {
    kinds: ['shroom', 'arch', 'ring', 'puff', 'slab', 'vent', 'wind', 'ray', 'bramble', 'flytrap', 'crack', 'lily', 'snap'],
    cell: (def) => def.ext.sl ?? {},
    alts: (def) => {
      const k = def.ext.kind;
      if (k === 'crack' || k === 'snap') return [{ dx: 0, dy: 0, present: false }];
      if (k === 'lily') return [{ dx: 0, dy: def.ext.sink ?? 3, present: true }];
      return [];
    },
  },
];

export function extFor(def) {
  const kind = def?.ext?.kind;
  return kind ? SOFTLOCK_EXT.find((e) => e.kinds.includes(kind)) : null;
}
