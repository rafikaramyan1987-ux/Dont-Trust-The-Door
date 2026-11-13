/**
 * Level data format. Each level is one JSON file in src/levels/ (see README).
 *
 * The map is 18 rows of equal length; every character is one 40 px tile. Width can be
 * anything from 32 to 200 tiles — the camera scrolls and follows the hero.
 *   .  empty                 #  solid block
 *   ^  spike (points up)     v  spike (points down)
 *   <  spike (points left)   >  spike (points right)
 *   =  jump pad              o  coin (a harmless, genuine coin)
 *   *  spiked ball (deadly)
 *   P  player start          D  the EXIT door (bottom tile of the door)
 *   F  a FAKE exit door (bites when touched)
 *   C  checkpoint flag (exactly one per level; death after touching it respawns there)
 *   a–z  (except o and v) tile belonging to a named group; the group's `tile` says what it
 *        is (block, spike, coin, pad …) and triggers can make the group do things.
 */

export type TileChar = '#' | '^' | 'v' | '<' | '>' | '=' | 'o' | '*' | 'F';

export interface GroupDef {
  /** What every tile of this group is. */
  tile: TileChar;
  /** Starts invisible and harmless (e.g. retracted spikes, a platform that appears later). */
  hidden?: boolean;
  /**
   * Fake: for blocks, drawn like ground but you fall / walk straight through it;
   * for spikes, drawn like spikes but harmless (they squash flat when touched).
   */
  fake?: boolean;
  /** Visual hint: tiny cracks or bolts (used to make a trap "fair the second time"). */
  look?: 'cracked' | 'bolted';
  /** For coins: when touched they become a spiky ball and kill. */
  trapCoin?: boolean;
  /** Extra tiles drawn as part of this group (e.g. a fake wall covering the real door). */
  cover?: [number, number][];
  /** Troll id (see LevelData.trolls) credited when this group's built-in trick fires. */
  troll?: string;
  /** Jump pads: launch velocity [vx, vy] in px/s (default straight up). */
  launch?: [number, number];
  /** Jump pads: a dud that only squeaks and does not launch. */
  dud?: boolean;
}

export type Rect = [number, number, number, number]; // tile x, y, w, h

export interface TriggerWhen {
  /** Player's body enters this tile rectangle. */
  zone?: Rect;
  /** Only while the player is in the air (with zone). */
  airborne?: boolean;
  /** Only while the player is on the ground (with zone). */
  grounded?: boolean;
  /** Player stands on / touches a solid group, or touches a coin group. */
  touch?: string;
  /** Fires at level start. */
  start?: boolean;
  /** Fires when the trigger with this id has fired (use with delay). */
  after?: string;
}

export type Action =
  | { fall: string; shake?: number }
  | { pop: string }
  | { retract: string }
  | { move: string; by: [number, number]; ticks: number; deadly?: boolean; returnAfter?: number; returnTicks?: number }
  | { chase: string; vel: [number, number]; untilX?: number; untilY?: number }
  | { doorRun: [number, number][]; speed: number; hehe?: number }
  | { doorHehe: number }
  | { gravity: 'flip' | 'normal' }
  | { controls: 'flip' | 'normal' | 'nojump' | 'autorun' }
  | { gravityScale: number }
  | { camera: 'freeze' | 'follow' | 'flip' | 'unflip' | 'zoom' | 'unzoom' }
  | { fakeClear: boolean }
  | { say: string; at: 'door' | 'hero' | [number, number]; ticks?: number }
  | { shake: number; ticks?: number }
  | { slowmo: number }
  | { show: string }
  | { hide: string }
  | { scare: true };

export interface TriggerDef {
  id?: string;
  when: TriggerWhen;
  delay?: number;
  do: Action[];
  /** Troll id credited when this trigger fires. */
  troll?: string;
  /** Re-run the actions every N ticks after the first firing (rhythmic traps). */
  every?: number;
  /**
   * Keep the result after a checkpoint respawn: if this trigger's zone lies before the
   * checkpoint, its final state (door moved, floor gone …) is applied instantly when the
   * player respawns at the checkpoint, instead of being re-armed.
   */
  keep?: boolean;
}

/** On-screen text. Only the level-1 control instructions use this (shown once ever). */
export interface HintDef {
  x: number;
  y: number;
  text: string;
}

export interface TrollDef {
  id: string;
  /** Short description, e.g. "The floor collapses into spikes". */
  name: string;
  /** Trap type key; a type may only be used by ONE level (checked by the validator). */
  type: string;
  /** Where the trap is (tile x and width) – used by the hint button. */
  x: number;
  w: number;
  /** The one-line hint shown when the player spends the level's hint on this trap. */
  hint: string;
}

export interface LevelData {
  id: number;
  name: string;
  world: number;
  /** The level's main idea (each level has its own). */
  idea?: string;
  /** Shown on the level-complete card. */
  winMessage: string;
  /** Small caption shown when the player dies here (optional). */
  deathQuips?: string[];
  hints?: HintDef[];
  map: string[];
  groups?: Record<string, GroupDef>;
  triggers?: TriggerDef[];
  /** Every troll moment in the level (each must be referenced by a trigger/group/fake exit). */
  trolls?: TrollDef[];
  /** Troll id credited when a fake EXIT (F) bites. */
  fakeExitTroll?: string;
  /** Per fake EXIT: tile x of the F → troll id (overrides fakeExitTroll). */
  fakeExits?: Record<string, string>;
}
