// Soft-lock analyzer support for the level extensions (src/game/ext): one entry per extension, by group ext.kind.
// Each entry: { kinds: ['key', …], cell?(def) → { solid?, deadly? }, alts?(def, cells) → [{ dx, dy, present }] }.
//   cell: how one tile of such a group counts (default: as its `tile` says: '#' solid, spikes deadly, '?' nothing)
//   alts: extra world states for such a group (where it can be, whether it is there)
export const SOFTLOCK_EXT = [
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
];

export function extFor(def) {
  const kind = def?.ext?.kind;
  return kind ? SOFTLOCK_EXT.find((e) => e.kinds.includes(kind)) : null;
}
