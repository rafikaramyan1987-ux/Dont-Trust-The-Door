// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
  // level 14: locks open (their tiles go), lowered bridges appear, a key lying in a bridge can be picked up (it goes);
  // a key, a padlock hanging from a post, a magpie or a bat take no room
  { kinds: ['lock', 'key'], alts: () => [{ dx: 0, dy: 0, present: false }] },
  { kinds: ['bridge'], alts: () => [{ dx: 0, dy: 0, present: true }] },
];

export function extFor(def) {
  const kind = def?.ext?.kind;
  return kind ? SOFTLOCK_EXT.find((e) => e.kinds.includes(kind)) : null;
}
