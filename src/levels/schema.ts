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
 *   C  checkpoint flag (one after every three traps; death respawns at the last one touched)
 *   a–z (except o, v), A–Z (except P, D, F, C), 0–9: tile belonging to a named group; the
 *        group's `tile` says what it is (block, spike, coin, pad …) and triggers can make
 *        the group do things.
 *
 * All player-visible text is a key into src/i18n/<lang>.json (see src/i18n).
 */

/** H = a decoy hero sprite (no collision; the camera can follow it). */
export type TileChar = '#' | '^' | 'v' | '<' | '>' | '=' | 'o' | '*' | 'F' | 'H' | '~';

/** Is this map character a group id? */
export function isGroupChar(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z' && ch !== 'o' && ch !== 'v') || (ch >= 'A' && ch <= 'Z' && !'PDFCH'.includes(ch)) || (ch >= '0' && ch <= '9');
}

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
  /** Jump pads: ticks without air control after the launch (default 30 for sideways pads). */
  lock?: number;
  /** Jump pads: launch speeds (px/s, upward) for the 1st, 2nd, 3rd… bounce of the group. */
  stack?: number[];
  /** Jump pads: only launch when you land on them faster than this (px/s) – "rubber floor". */
  minFall?: number;
  /** Blocks: a conveyor belt that carries whoever stands on it (px/s, + = right). */
  conveyor?: number;
  /** Blocks: slippery ice (almost no grip). */
  ice?: boolean;
  /** Blocks: solid but invisible until touched. */
  invisible?: boolean;
  /** Fake doors: kick you away with this velocity [vx, vy] (px/s) instead of biting. */
  kick?: [number, number];
  /** Fake doors: a portal that teleports you to this tile [x, y] (you keep your speed). */
  warp?: [number, number];
  /** Fake doors: a harmless prop (e.g. the portal's exit). */
  prop?: boolean;
  /** Moves in a circle around its drawn position (tiles / ticks / radians); from the start. */
  orbit?: { r: number; period: number; phase?: number };
  /** Pulley: standing on this group lowers it and lifts the partner (px/tick, max tiles). */
  pulley?: { partner: string; speed: number; range: number };
  /** Follows the hero's x (px/tick) once ridden, within [min, max] tiles of its start. */
  follow?: { speed: number; min: number; max: number };
  /** Spiked balls: fly toward the hero (px/tick) once activated. */
  homing?: number;
  /** Spiked balls: a frog that walks toward you (px/tick) and jumps whenever you jump. */
  frog?: { speed: number; jump: number };
  /** Blocks: a turret that fires spiked balls every N ticks at vx px/tick once activated. */
  turret?: { every: number; vx: number; range: number };
  /** Blocks: colour tint marking special floor (e.g. a strip where the controls change). */
  tint?: number;
  /** Blocks: one physics body per column (needed for `eat`). */
  columns?: boolean;
  /** Blocks: a push button / pressure plate on top of the block (its colour); it sinks while stood on. */
  button?: 'red' | 'green';
  /** Blocks: the button hangs under the block (a ceiling switch you bonk from below). */
  ceilButton?: boolean;
  /** Blocks: a wooden crate: it falls, the hero pushes it by walking into it, it slides on ice, rides belts and
   *  crushes the hero if it lands on him. 'still': looks like a crate but stays put. */
  crate?: boolean | 'still';
  /** Water (tile '~'): a current that pushes the swimmer (px/s, [x, y]). */
  current?: [number, number];
  /** Water: electrified (it kills) while it is visible; pair it with calm water shown in between. */
  zap?: boolean;
  /** Crates: where the crate can come to rest (tile offsets) – world states for the soft-lock analyzer. */
  rest?: [number, number][];
}

export type Rect = [number, number, number, number]; // tile x, y, w, h

export interface TriggerWhen {
  /** Player's body enters this tile rectangle. */
  zone?: Rect;
  /** Only while the player is in the air (with zone). */
  airborne?: boolean;
  /** Only while the player is on the ground (with zone). */
  grounded?: boolean;
  /** Only when the player lands in the zone falling faster than this (px/s): a hard landing. */
  landFaster?: number;
  /** Player stands on / touches a solid group, or touches a coin group. */
  touch?: string;
  /** Fires at level start. */
  start?: boolean;
  /** Fires when the trigger with this id has fired (use with delay). */
  after?: string;
  /** With zone: fires when this crate (group) is in the zone instead of the hero. With crateZone: the hero's own
   *  condition (zone / touch) and, at the same time, this crate in crateZone (both on a fragile bridge). */
  crate?: string;
  crateZone?: Rect;
}

export type CtrlMode = 'normal' | 'flip' | 'nojump' | 'autorun' | 'lag' | 'hiccup' | 'superjump' | 'turbo' | 'frozen' | 'flipjump';
export type CameraTrick = 'freeze' | 'follow' | 'flip' | 'unflip' | 'zoom' | 'unzoom' | 'dark' | 'light' | 'strobe' | 'unstrobe'
  | 'smudge' | 'unsmudge' | 'back' | 'front' | 'seasick' | 'steady' | 'decoy' | 'undecoy';

export type Action =
  | { fall: string; shake?: number }
  | { pop: string }
  | { retract: string }
  | { move: string; by: [number, number]; ticks: number; deadly?: boolean; returnAfter?: number; returnTicks?: number }
  | { chase: string; vel: [number, number]; untilX?: number; untilY?: number }
  /** Ballistic flight: a group is thrown with this velocity (px/tick) and falls. */
  | { toss: string; vel: [number, number] }
  /** The group's tiles vanish from left to right at this speed (px/tick). */
  | { eat: string; speed: number }
  /** Start a group's behaviour (homing ball, frog, turret, decoy run…). */
  | { activate: string }
  | { deactivate: string }
  /** A shadow of the hero that replays your path this many ticks later; touching it kills. */
  | { clone: number }
  | { unclone: true }
  /** A storm cloud follows you and strikes where it is every `every` ticks (warns `warn` ticks before). */
  | { storm: { every: number; warn: number } }
  | { unstorm: true }
  /** Sideways pull on the hero (px/s²), 0 = off. */
  | { gravityX: number }
  | { doorRun: [number, number][]; speed: number; hehe?: number }
  | { doorHehe: number }
  | { gravity: 'flip' | 'normal' }
  | { controls: CtrlMode }
  | { gravityScale: number }
  | { camera: CameraTrick; target?: string }
  | { fakeClear: boolean }
  | { say: string; at: 'door' | 'hero' | [number, number]; ticks?: number }
  | { shake: number; ticks?: number }
  | { slowmo: number }
  /** The (hidden) group appears column by column from the left at this speed (px/tick): a bridge building itself. */
  | { grow: string; speed: number }
  /** A crate goes back to its drawn place (visible, at rest). */
  | { respawn: string }
  /** A magnet pulls a crate up (on) or lets it fall again (off). */
  | { magnet: string; on: boolean }
  /** A crate starts sliding at this speed (px/tick; it keeps it on ice). */
  | { shove: string; vx: number }
  /** A conveyor group changes its speed (px/s, + = right; the arrows turn round). */
  | { belt: string; speed: number }
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
  /** Repeats stop once the hero is past this tile x. */
  stopAt?: number;
  /** Zone effect: `do` runs whenever the hero enters the zone, `undo` when he leaves it. */
  hold?: boolean;
  undo?: Action[];
  /** With hold: the undo actions run this many ticks after the hero left (0 = at once). */
  undoDelay?: number;
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
  /** i18n key */
  text: string;
}

/** One step of a bot plan: keys ("L", "R", "J" letters) held until a tick count or condition. */
export type PlanStep = [string, number | string];

export interface TrollDef {
  id: string;
  /** Short description, e.g. "The floor collapses into spikes". */
  name: string;
  /** Trap type key; a type may only be used by ONE level (checked by the validator). */
  type: string;
  /** Bounding box of the dangerous area (tile x and width) – used by the hint button. */
  x: number;
  w: number;
  /** Exactly the dangerous tiles (tile rects): what the hint highlights. */
  danger: [number, number, number, number][];
  /** i18n key of the one-line hint shown when the player spends the level's hint on it. */
  hint: string;
  /** Machine-readable solution: the bot's inputs that get past this trap (absolute px). */
  solution: PlanStep[];
}

export interface LevelData {
  id: number;
  /** i18n key */
  name: string;
  world: number;
  /** The level's main idea (each level has its own). */
  idea?: string;
  /** i18n key, shown on the level-complete card. */
  winMessage: string;
  /** i18n keys of small jokes shown when the player dies here (optional). */
  deathQuips?: string[];
  hints?: HintDef[];
  map: string[];
  groups?: Record<string, GroupDef>;
  triggers?: TriggerDef[];
  /** Every troll moment in the level (each must be referenced by a trigger/group/fake exit). */
  trolls?: TrollDef[];
  /** Decorations that show where a zone effect is (tile rects). */
  decor?: { x: number; y: number; w: number; h: number; kind: 'bubble' | 'shadow' }[];
  /** Troll id credited when a fake EXIT (F) bites. */
  fakeExitTroll?: string;
  /** Per fake EXIT: tile x of the F → troll id (overrides fakeExitTroll). */
  fakeExits?: Record<string, string>;
}
