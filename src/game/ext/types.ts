// Level extensions: the mechanics of levels 14+ live in their own files (src/game/ext/lNN.ts) and hook into the
// engine at fixed points, so each level's new mechanics stay in one place. An extension sees the scene through
// `S(scene)` (its internals: groups, pbody, hero, kill(), troll(), runActions(), sfx(), track() …) and keeps its
// per-run state in `scene.ext[name]` (reset whenever the level is (re)built).
//
// Level data talks to an extension through:
//   group defs     { tile: '#' | '?' | …, ext: { kind: 'key', … } }   ('?' = drawn and handled by the extension only)
//   actions        { ext: 'keys.give', g: 'a', g2?: 'b', args?: {…} } (`g`/`g2` = groups it acts on, highlighted by the hint)
//   trigger when   { ext: { kind: 'hasKey', … } }  (alone, or together with zone / touch: both must hold)
import type { Keys } from '../../input';

export interface MoveCtx {
  /** input direction (-1, 0, 1) after control tricks; jump pressed this tick */
  dir: number;
  jumpPressed: boolean;
  readonly grounded: boolean;
  /** run speed cap (px/s), acceleration multiplier, sideways bias (px/s) */
  maxRun: number;
  accMul: number;
  bias: number;
  /** multipliers of the jump speed and of gravity */
  jumpMul: number;
  gravMul: number;
  /** the velocity before this tick's control (px/s) — an extension may change it */
  vx: number;
  vy: number;
  readonly keys: Keys;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Scene = any;

export interface Ext {
  name: string;
  /** the level is (re)built: reset per-run state */
  init?(s: Scene): void;
  /** a group was made (generic visuals and bodies exist unless tile is '?'): add visuals / state */
  group?(s: Scene, g: any): void;
  /** run an action `{ ext: '<name>.<verb>' … }`: return false if not yours, true if handled, 'trap' if it is a trap moment */
  action?(s: Scene, a: Record<string, any>): boolean | 'trap';
  /** a trigger condition `when.ext`: return undefined if not yours */
  when?(s: Scene, w: Record<string, any>): boolean | undefined;
  /** the hero's control this tick (before speeds are applied) */
  move?(s: Scene, m: MoveCtx): void;
  /** once per tick, after groups moved */
  tick?(s: Scene): void;
  /** once per tick, with the other hazards: may kill the hero (s.kill(cause)) */
  interact?(s: Scene): void;
  /** once per rendered frame (presentation only) */
  render?(s: Scene, dt: number): void;
  /** extra fields for the test snapshot (s.ext.<name> …) */
  snapshot?(s: Scene): Record<string, unknown>;
}
