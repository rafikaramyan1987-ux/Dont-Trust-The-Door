// Level 19: the hand-written platforming courses between the traps (one list per gap, traps.length + 1 lists).
// Every jump is checked by the parkour pieces; each course starts and ends on the normal ground (row 15).
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

export const COURSES = [
  // start → wall-blast
  [pit(3, 3), up(1, 3), spikes(3, 2), isle(3, 3, 1), isle(3, 2, -1), down(1, 3), thorns(2, 3), pit(4, 3)],
  // → dud-bomb
  [thorns(3, 1), spikes(3, 4), isle(2, 2, 2), isle(3, 2, 0), pit(3, 3, -2), roof(3), thorns(3, 2), pit(3, 3)],
  // → sticky-bomb
  [up(1, 2), pit(3, 3, -1), up(2, 2), down(2, 2), spikes(4, 2), block(2, 1, 3), isle(3, 3, 2), down(2, 2), thorns(1, 2), pit(3, 3)],
  // → kick-bomb
  [roof(2), isle(3, 2, 1), pit(2, 3, 1), pit(3, 3, -2), spikes(3, 3), isle(3, 3, -1), up(1, 3), roof(3), pit(3, 2)],
  // → ring-burst
  [thorns(1, 3), isle(3, 3, 2), isle(2, 2, -1), isle(4, 2, -1), isle(3, 2, 0), spikes(3, 2), up(1, 2), block(1, 2, 2), down(1, 3), pit(4, 3)],
  // → cannon-swing
  [pillars(2, 1, [1, 1]), pillars(3, 2, [-1]), pillars(2, 3, [0, -1]), thorns(3, 1), spikes(4, 2), up(2, 2), roof(3), down(2, 3), pit(3, 2)],
  // → ricochet-cannonball
  [spikes(3, 2), spikes(3, 2, 1), spikes(2, 3, -1), block(2, 2, 2), isle(4, 3), pit(3, 2, 2), down(2, 3), thorns(3, 3)],
  // → mortar-lead
  [up(1, 2), up(1, 2), pit(4, 2), down(2, 2), roof(4), isle(3, 2, 1), isle(4, 2, -1), thorns(2, 3), pit(3, 2)],
  // → barrel-chain
  [block(1, 3, 2), pit(3, 2, 1), pit(4, 2, -1), isle(3, 3, 1), spikes(3, 2, 1), down(2, 2), thorns(1, 2), thorns(2, 2), pit(3, 3)],
  // → pinwheel
  [pillars(3, 2, [0, 1, -1, 0]), spikes(3, 2), up(2, 3), down(1, 2), pit(4, 2, -1), roof(3)],
  // → firework-cake
  [thorns(2, 3), pit(3, 2, 2), isle(2, 3, 1), pit(4, 2, -3), spikes(3, 3), block(1, 1, 3), isle(3, 3, 1), down(1, 2), pit(3, 2)],
  // → confetti-bomb
  [roof(3), pit(3, 3), up(2, 2), spikes(3, 2), down(2, 2), isle(4, 2), isle(3, 2, 2), down(2, 2), thorns(3, 2), pit(4, 2)],
  // → roman-candle
  [pit(2, 3), pit(3, 2, 1), pit(4, 3, 0), pit(3, 2, -1), spikes(4, 2), block(2, 1, 2), isle(3, 3, 1), down(1, 3)],
  // → stomp-the-spark
  [up(1, 2), roof(5), pit(3, 2), down(1, 2), thorns(2, 3), isle(2, 3, 2), isle(3, 1, 0), down(2, 2), spikes(4, 2)],
  // → forked-fuse
  [block(1, 3, 2), pillars(2, 2, [1, -1, 0]), spikes(4, 2), up(3, 2), pit(4, 2, -3), thorns(2, 3), pit(3, 2)],
  // → sparkler-fuses
  [spikes(2, 2), isle(3, 3, 1), isle(3, 2, -1), up(2, 3), pit(3, 2, 0), down(2, 2), roof(3), thorns(3, 1), spikes(4, 3)],
  // → bridge-shelling
  [flat(1), pit(3, 3, 1), up(1, 2), spikes(3, 2, -1), down(1, 2), block(2, 2, 2), isle(3, 2), pit(3, 2, 1), down(1, 3), thorns(3, 2)],
  // → blast-wave
  [thorns(1, 2), thorns(2, 2), thorns(3, 2), pit(4, 2), up(2, 2), isle(3, 3, -2), spikes(3, 2), pit(3, 3, 1), down(1, 2)],
  // → grand-finale
  [isle(2, 3, 1), isle(3, 2, 1), down(3, 4), isle(2, 4, 1), pit(3, 3, 1), spikes(4, 2, -1), block(1, 2, 2), roof(3), pit(3, 3)],
  // grand-finale → EXIT
  [thorns(2, 2), isle(3, 2, 2), isle(2, 3, -1), down(1, 3), block(2, 2, 3), pit(4, 2)],
];
