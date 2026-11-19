// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
  // level 17 (src/game/ext/l17.ts): wind zones, balloons and the windmill only push / lift / sweep (no tiles of
  // their own); the floating thistles are spiked
  { kinds: ['wind', 'balloon', 'thistle', 'mill'], cell: (d) => ({ solid: false, deadly: d.ext.kind === 'thistle' }) },
];

export function extFor(def) {
  const kind = def?.ext?.kind;
  return kind ? SOFTLOCK_EXT.find((e) => e.kinds.includes(kind)) : null;
}
