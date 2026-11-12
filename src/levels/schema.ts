/**
 * Level data format. Each level is one JSON file in src/levels/ (see README).
 *
 * The map is 18 rows × 32 columns of characters (one character = one 40px tile):
 *   .  empty                 #  solid block
 *   ^  spike (points up)     v  spike (points down)
 *   <  spike (points left)   >  spike (points right)
 *   =  jump pad              o  coin (a harmless, genuine coin)
 *   P  player start          D  the EXIT door (bottom tile of the door)
 *   F  a FAKE exit door (bites when touched)
 *   a–z  (except o and v) tile belonging to a named group; the group's `tile` says what it is
 *        (block, spike, coin, pad …) and triggers can make the group do things.
 */

export type TileChar = '#' | '^' | 'v' | '<' | '>' | '=' | 'o';

export interface GroupDef {
  /** What every tile of this group is. */
  tile: TileChar;
  /** Starts invisible and harmless (e.g. retracted spikes). */
  hidden?: boolean;
  /** Fake wall: drawn like a block but you can walk through it. */
  fake?: boolean;
  /** Visual hint: tiny cracks (used to make a collapse "fair the second time"). */
  look?: 'cracked' | 'bolted';
  /** For coins: when touched they become a spiky ball and kill. */
  trapCoin?: boolean;
  /** Extra tiles drawn as part of this group (e.g. a fake wall covering the real door). */
  cover?: [number, number][];
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
  | { chase: string; vel: [number, number]; untilX?: number }
  | { doorRun: [number, number][]; speed: number; hehe?: number }
  | { doorHehe: number }
  | { gravity: 'flip' | 'normal' }
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
}

export interface HintDef {
  x: number;
  y: number;
  text: string;
  /** Only show after the player has died at least this many times in the level. */
  afterDeaths?: number;
}

export interface LevelData {
  id: number;
  name: string;
  world: number;
  /** Shown on the level-complete card. */
  winMessage: string;
  /** Small caption shown when the player dies here (optional). */
  deathQuips?: string[];
  hints?: HintDef[];
  map: string[];
  groups?: Record<string, GroupDef>;
  triggers?: TriggerDef[];
}
