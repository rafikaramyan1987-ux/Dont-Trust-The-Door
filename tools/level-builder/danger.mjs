// The dangerous tiles of a trap = exactly what the hint button highlights.
// Shared by the level builder (which stores them as `danger` rects) and the validator
// (which recomputes them and checks they match), so the highlight always equals the
// trap's trigger area.
export const ACTION_GROUP_KEYS = ['fall', 'pop', 'retract', 'move', 'chase', 'show', 'hide', 'toss', 'eat', 'activate'];

/** Tiles of: the troll's trigger zones, groups those triggers touch or act on, groups that
 *  credit the troll, fake EXITs credited to it, and the hazards declared with it. */
export function dangerTiles(level, troll, hazards = troll.hazards ?? []) {
  const tiles = [];
  const groupTiles = (g) => {
    level.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === g) tiles.push([x, y]); }));
    for (const c of level.groups?.[g]?.cover ?? []) tiles.push(c);
  };
  const rect = ([x, y, w, h]) => { for (let j = Math.floor(y); j < Math.ceil(y + h); j++) for (let i = Math.floor(x); i < Math.ceil(x + w); i++) tiles.push([i, j]); };
  for (const t of level.triggers ?? []) {
    if (t.troll !== troll.id) continue;
    if (t.when.zone) rect(t.when.zone);
    if (t.when.touch) groupTiles(t.when.touch);
    for (const a of t.do) for (const k of ACTION_GROUP_KEYS) if (k in a) groupTiles(a[k]);
  }
  for (const [g, d] of Object.entries(level.groups ?? {})) if (d.troll === troll.id) groupTiles(g);
  for (const [x, id] of Object.entries(level.fakeExits ?? {})) if (id === troll.id) level.map.forEach((row, y) => { if (row[x] === 'F') tiles.push([Number(x), y], [Number(x), y - 1]); });
  for (const h of hazards) rect(h);
  const seen = new Set();
  return tiles.filter(([x, y]) => y >= 0 && y < 18 && x >= 0 && !seen.has(`${x},${y}`) && seen.add(`${x},${y}`));
}

/** Expand rects to a set of "x,y" strings. */
export function rectTiles(rects) {
  const s = new Set();
  for (const [x, y, w, h] of rects) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) s.add(`${i},${j}`);
  return s;
}
