// LEVEL 13 – "The Deep End": water betrays you. Swimming: jump = a stroke (also under water), you sink slowly, and
// your air lasts 4 seconds under water (bubbles over your head). Currents push you. A lagoon.
// Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof } from '../parkour.mjs';

const water = (b, x0, x1, y0, y1, extra = {}) => {
  const g = b.group({ tile: '~', ...extra });
  b.fill(x0, x1, y0, y1, g);
  return g;
};

/** n swim strokes: tap jump (holding `keys`) every `gap` ticks */
const strokes = (n, keys = '', gap = 11) => Array.from({ length: n }, () => [[keys + 'J', 1], [keys, gap - 1]]).flat();
/** swim up (strokes) until the hero is out of the water above row `row` (tile), then hold `keys` until he lands */
const swimUp = (row, keys = 'R', max = 12) => [...Array.from({ length: max }, () => [['J', 1], ['', `s.y < ${row * T} || s.grounded`]]).flat().slice(0, -1), ['', 10], [keys, 's.grounded']];

/** TRAP flood-tunnel: the low tunnel floods behind you – swim on and up the shaft before your air runs out. */
function floodTunnel(b) {
  b.ground(0, 3);
  // the tunnel: floor row 15, roof rows 12-13 (2 tall inside: rows 13-14 → hero fits, a jump does not)
  b.fill(4, 15, 15, 17, '#');
  b.fill(4, 13, 11, 12, '#');
  b.fill(4, 13, 0, 10, '#');
  // the shaft up at the end (cols 14-15 open from row 5), its top exit onto a ledge
  b.fill(16, 21, 5, 17, '#');
  const w = water(b, 4, 15, 13, 14, { hidden: true });
  const shaft = water(b, 14, 15, 6, 12, { hidden: true });
  const id = b.troll('The tunnel floods behind you', { type: 'flood-tunnel', hint: 'The low tunnel floods as soon as you are inside – do not turn back: swim on to the end and straight up the shaft before your air runs out.' });
  b.trigger({ when: { zone: b.rect(6, 13, 1, 2) }, do: [{ show: w }, { show: shaft }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 14 * T + 20), ...strokes(5), ['J', 1], ['', 9], ['RJ', 1], ['R', 12], ['R', 's.grounded'], run(X + 21 * T)],
    die: [run(X + 8 * T), wait(300)],
  };
}

/** swim right with strokes whenever the hero starts to sink, until x ≥ px (then one more stroke jumps out) */
/** swim right, stroking whenever the hero starts to sink, until x ≥ px; then stroke out of the water onto the bank */
const SINK = 's.wet && s.vy > 50 && s.levelTick % 12 < 6';
const swimTo = (px) => [['R+J?' + SINK, `s.x >= ${px}`], ['R+J?s.wet && s.levelTick % 12 < 6', '!s.wet && s.grounded']];

/** TRAP undertow: the calm pool drags anyone near the bottom into the grate – stroke and stay at the surface. */
function undertow(b) {
  b.ground(0, 2);
  b.fill(3, 15, 17, 17, '#');
  const top = water(b, 3, 15, 15, 15);
  const low = water(b, 3, 15, 16, 16, { current: [-280, 0] });
  b.group({ tile: '>', cover: [b.tile(3, 16)] });
  b.ground(16, 19);
  const id = b.troll('The undertow drags you into the grate', { type: 'undertow', hint: 'Near the bottom of the pool a current drags you into the spiked grate – keep stroking (jump) and stay at the surface.', hazards: [[3, 16, 1, 1]] });
  b.trigger({ when: { zone: b.rect(4, 16, 12, 1) }, do: [], troll: id });
  void top;
  void low;
  const X = b.px(0);
  return { w: 20, win: [run(X + 3 * T + 10), ...swimTo(X + 15 * T + 10), run(X + 19 * T)], die: [run(X + 3 * T + 10), ['R', 30], ['', 300]] };
}

/** TRAP freezing-pool: the surface freezes over once you are in – swim under the wall to the hole at the far end. */
function freezingPool(b) {
  b.ground(0, 3);
  b.fill(4, 17, 17, 17, '#');
  const top = b.group({ tile: '~' });
  b.fill(4, 9, 15, 15, top);
  b.fill(11, 15, 15, 15, top);
  water(b, 16, 17, 15, 15);
  water(b, 4, 17, 16, 16);
  b.fill(10, 10, 0, 15, '#');
  const ice = b.group({ tile: '#', ice: true, hidden: true, tint: 0xd6f4ff, cover: [...b.range(4, 9, 15, 15), ...b.range(11, 15, 15, 15)] });
  b.ground(18, 21);
  const id = b.troll('The pool freezes over', { type: 'freezing-pool', hint: 'The pool freezes over a moment after you jump in – swim under the wall at once and come up through the hole at the far end.' });
  b.trigger({ when: { zone: b.rect(4, 15, 2, 2) }, delay: 30, do: [{ hide: top }, { show: ice }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 4 * T + 10), ['R', `s.x >= ${X + 16 * T + 20}`], ['RJ', 1], ['R', 10], ['RJ', 1], ['R', 's.grounded'], run(X + 21 * T)],
    die: [run(X + 4 * T + 10), ['R', `s.x >= ${X + 8 * T}`], ['L', 400]],
  };
}

/** TRAP bubble-lift: two bubble streams lift you – the one by the wall carries you into the spikes under the ledge. */
function bubbleLift(b) {
  b.ground(0, 14);
  b.fill(15, 17, 6, 17, '#');
  b.fill(5, 14, 6, 6, '#');
  water(b, 3, 4, 5, 14, { current: [0, -330] });
  water(b, 10, 11, 8, 14, { current: [0, -330] });
  b.fill(10, 11, 7, 7, 'v');
  b.ground(18, 19);
  const id = b.troll('The bubble stream by the wall lifts you into spikes', { type: 'bubble-lift', hint: 'Both bubble streams lift you, but the one near the wall carries you into the spikes under the ledge – take the first one and step off onto the ledge.', hazards: [[10, 7, 2, 1]] });
  b.trigger({ when: { zone: b.rect(10, 8, 2, 7) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 3 * T + 20), ['', `s.y < ${5 * T}`], ['R', 's.grounded'], run(X + 18 * T + 18), ['', 's.grounded'], run(X + 19 * T)],
    die: [run(X + 10 * T + 20), wait(200)],
  };
}

/** TRAP dam-break: the sluice gate bursts when you reach it – the flood washes you back into the pit: get up the step. */
function damBreak(b) {
  b.ground(0, 1);
  b.fill(2, 3, 17, 17, '#');
  b.fill(2, 3, 16, 16, '^');
  b.ground(4, 23);
  b.fill(9, 10, 13, 13, '#');
  b.fill(17, 19, 0, 8, '#');
  const gate = b.group({ tile: '#', look: 'bolted' });
  b.fill(18, 18, 9, 14, gate);
  const res = water(b, 19, 23, 9, 14);
  const flood = water(b, 2, 17, 14, 14, { hidden: true, current: [-420, 0] });
  const id = b.troll('The dam bursts and the flood washes you back', { type: 'dam-break', hint: 'When you reach the sluice gate it creaks and bursts, and a flood washes everything back into the spike pit – run back up onto the little ledge and wait until the water is gone.', hazards: [[2, 16, 2, 1]] });
  const go = b.uid('dam');
  // the gate creaks (the screen shakes) a second before it bursts
  b.trigger({ when: { zone: b.rect(15, 11, 2, 4) }, do: [{ shake: 4, ticks: 50 }], troll: id });
  b.trigger({ id: go, when: { zone: b.rect(15, 11, 2, 4) }, delay: 60, do: [{ hide: gate }, { hide: res }, { show: flood }, { shake: 12, ticks: 30 }], troll: id });
  b.trigger({ when: { after: go }, delay: 260, do: [{ hide: flood }] });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 2 * T - 14), J(10), land, run(X + 15 * T + 10), runL(X + 12 * T + 10), ['LJ', 12], ['L', `s.x <= ${X + 10 * T + 10}`], ['', 's.grounded'], wait(340), run(X + 23 * T)],
    die: [run(X + 2 * T - 14), J(10), land, run(X + 15 * T + 10), wait(300)],
  };
}

/** TRAP drifting-raft: the raft drifts toward the edge of the falls – jump off onto the ledge as you pass under it. */
function driftingRaft(b) {
  b.ground(0, 3);
  b.fill(4, 21, 17, 17, '#');
  water(b, 4, 23, 15, 16, { current: [120, 0] });
  const raft = b.group({ tile: '#' });
  b.fill(4, 6, 14, 14, raft);
  b.fill(13, 25, 12, 12, '#');
  const id = b.troll('The raft drifts over the falls', { type: 'drifting-raft', hint: 'The raft drifts all the way to the edge of the falls – jump up onto the ledge as it passes under it.' });
  const go = b.uid('raft');
  b.trigger({ id: go, when: { touch: raft }, delay: 20, do: [{ move: raft, by: [17, 0], ticks: 300 }], troll: id });
  b.trigger({ when: { after: go }, delay: 330, do: [{ fall: raft }] });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 4 * T - 10), ['RJ', 6], ['R', `s.x >= ${X + 5 * T}`], ['', 's.grounded'], ['', `s.g.${raft}[0] >= ${7.5 * T}`], ['RJ', 12], land, run(X + 25 * T)],
    die: [run(X + 4 * T - 10), ['RJ', 6], ['R', `s.x >= ${X + 5 * T}`], ['', 's.grounded'], wait(500)],
  };
}

/** TRAP whirlpool: the pool is a whirlpool that sucks swimmers down into the spiked drain – hop across on the rocks. */
function whirlpool(b) {
  b.ground(0, 3);
  b.fill(4, 15, 17, 17, '#');
  water(b, 4, 8, 15, 16, { current: [240, 0] });
  water(b, 11, 15, 15, 16, { current: [-240, 0] });
  water(b, 9, 10, 15, 15, { current: [0, 400] });
  b.fill(9, 10, 16, 16, '^');
  b.fill(7, 7, 13, 13, '#');
  b.fill(12, 12, 13, 13, '#');
  b.ground(16, 19);
  const id = b.troll('The pool is a whirlpool', { type: 'whirlpool', hint: 'The pool is a whirlpool: the water drags you to the spiked drain in the middle – do not swim, hop across on the two rocks.', hazards: [[9, 16, 2, 1]] });
  b.trigger({ when: { zone: b.rect(4, 15, 12, 1) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 4 * T - 14), ['RJ', 12], ['R', `s.x >= ${X + 7 * T}`], ['', 's.grounded'], wait(4), run(X + 7 * T + 26), ['RJ', 16], ['R', `s.x >= ${X + 12 * T}`], ['', 's.grounded'], wait(4), run(X + 12 * T + 26), ['RJ', 10], land, run(X + 19 * T)],
    die: [run(X + 4 * T + 10), ['R', 300]],
  };
}

/** TRAP waterfall-pause: the waterfall over the pit knocks you down – it pauses every few seconds: jump then. */
function waterfallPause(b) {
  b.ground(0, 7);
  b.fill(8, 11, 17, 17, '#');
  b.fill(8, 11, 16, 16, '^');
  b.ground(12, 19);
  const fall = water(b, 8, 11, 0, 15, { current: [0, 800] });
  const id = b.troll('The waterfall knocks you into the pit', { type: 'waterfall-pause', hint: 'The waterfall knocks anyone jumping through it down into the spikes – it pauses every few seconds: jump across right after it stops.', hazards: [[8, 16, 4, 1]] });
  const off = b.uid('fall');
  b.trigger({ id: off, when: { zone: b.rect(2, 10, 2, 5) }, every: 170, stopAt: b.x0 + 12, do: [{ hide: fall }], troll: id });
  b.trigger({ when: { after: off }, delay: 70, every: 170, stopAt: b.x0 + 12, do: [{ show: fall }] });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T), ['', `s.g.${fall}[2] === 1`], ['', `s.g.${fall}[2] === 0`], run(X + 8 * T - 12), ['RJ', 16], land, run(X + 19 * T)],
    die: [run(X + 5 * T), ['', `s.g.${fall}[2] === 0`], ['', `s.g.${fall}[2] === 1`], run(X + 8 * T - 12), ['RJ', 16], ['R', 90]],
  };
}

/** TRAP heavy-water: this water is too heavy to swim in – you sink straight onto the spikes; take the ledge above. */
function heavyWater(b) {
  b.ground(0, 3);
  b.fill(4, 15, 17, 17, '#');
  b.fill(4, 15, 16, 16, '^');
  water(b, 4, 15, 15, 15, { current: [0, 500], tint: 0x2d6f9e });
  b.fill(6, 13, 13, 13, '#');
  b.ground(16, 19);
  const id = b.troll('The water is too heavy to swim in', { type: 'heavy-water', hint: 'This dark water is too heavy to swim in: you sink at once onto the spikes – jump up onto the ledge above it instead.', hazards: [[4, 16, 12, 1]] });
  b.trigger({ when: { zone: b.rect(4, 15, 12, 1) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 4 * T - 14), ['RJ', 12], land, run(X + 14 * T - 14), ['RJ', 12], land, run(X + 19 * T)],
    die: [run(X + 4 * T + 10), wait(120)],
  };
}

/** TRAP fake-air-pocket: the first bright pocket in the flooded tunnel is water, not air – breathe at the second. */
function fakeAirPocket(b) {
  b.ground(0, 2);
  b.fill(3, 26, 15, 17, '#');
  b.fill(3, 26, 0, 11, '#');
  b.fill(3, 9, 12, 12, '#');
  b.fill(11, 19, 12, 12, '#');
  b.fill(21, 26, 12, 12, '#');
  water(b, 3, 26, 13, 14);
  const fake = water(b, 10, 10, 12, 12, { tint: 0xd8f6ff });
  b.ground(27, 29);
  const id = b.troll('The first air pocket is water', { type: 'fake-air-pocket', hint: 'The bright pocket halfway along the flooded tunnel is water, not air – keep going and breathe in the second pocket.', hazards: [[3, 13, 24, 2]] });
  b.groupTroll(fake, id);
  b.trigger({ when: { zone: b.rect(10, 12, 1, 1) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 30,
    win: [run(X + 20 * T + 20), ['J', 1], ['', 10], ['J', 1], ['', 30], run(X + 29 * T)],
    die: [run(X + 10 * T + 20), ['J', 1], ['', 10], ['J', 1], ['', 10], ['J', 1], ['', 50], run(X + 29 * T)],
  };
}

/** TRAP electric-water: the pool is live for a moment every few seconds – dive in right after a zap. */
function electricWater(b) {
  b.ground(0, 3);
  b.fill(4, 13, 17, 17, '#');
  const calm = water(b, 4, 13, 15, 16, { tint: 0x46c2c9 });
  const live = b.group({ tile: '~', zap: true, hidden: true, cover: b.range(4, 13, 15, 16) });
  b.ground(14, 19);
  const id = b.troll('The pool is electrified', { type: 'electric-water', hint: 'Every few seconds the pool is electrified for a moment – wait for a zap, then swim across at once.' });
  const on = b.uid('zap');
  b.trigger({ id: on, when: { zone: b.rect(0, 10, 2, 5) }, every: 300, stopAt: b.x0 + 14, do: [{ hide: calm }, { show: live }], troll: id });
  b.trigger({ when: { after: on }, delay: 40, every: 300, stopAt: b.x0 + 14, do: [{ show: calm }, { hide: live }] });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 3 * T), ['', `s.g.${live}[2] === 1`], ['', `s.g.${live}[2] === 0`], run(X + 4 * T), ...swimTo(X + 13 * T + 10), run(X + 19 * T)],
    die: [run(X + 3 * T), ['', `s.g.${live}[2] === 0`], ['', `s.g.${live}[2] === 1`], wait(1), ['', `s.g.${live}[2] === 0`], wait(150), run(X + 4 * T + 20), ['R', 120]],
  };
}

/** TRAP spiked-buoy: a spiked buoy drifts along the surface at you – dive under it as it passes. */
function spikedBuoy(b) {
  b.ground(0, 3);
  b.fill(4, 15, 17, 17, '#');
  const sea = water(b, 4, 14, 15, 15);
  b.fill(4, 15, 16, 16, sea);
  const buoy = b.group({ tile: '*' });
  b.put(15, 15, buoy);
  // a rock roof over the middle of the pool: no jumping over the buoy there
  b.fill(6, 13, 9, 14, '#');
  b.ground(16, 23);
  const id = b.troll('A spiked buoy drifts at you', { type: 'spiked-buoy', hint: 'A spiked buoy drifts along the surface toward you under the rock roof – dive to the bottom and let it pass over you.' });
  b.trigger({ when: { zone: b.rect(4, 14, 2, 3) }, do: [{ move: buoy, by: [-12, 0], ticks: 110 }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 4 * T + 20), ['R', `s.x >= ${X + 6 * T}`], ['', `s.g.${buoy}[0] <= ${-10 * T}`], ...swimTo(X + 15 * T + 10), run(X + 23 * T)],
    die: [run(X + 4 * T + 20), ['R+J?' + SINK, `s.g.${buoy}[0] <= ${-11 * T}`]],
  };
}

/** TRAP water-wall: a wall of water hangs over the pit – you get stuck in it and sink: stroke all the way through. */
function waterWall(b) {
  b.ground(0, 5);
  b.fill(6, 12, 17, 17, '#');
  b.fill(6, 12, 16, 16, '^');
  b.ground(13, 17);
  water(b, 7, 11, 3, 14);
  const id = b.troll('A wall of water hangs over the pit', { type: 'water-wall', hint: 'The wall of water over the pit slows you down and you sink in it – jump in and keep stroking until you come out on the far side.', hazards: [[6, 16, 7, 1]] });
  b.trigger({ when: { zone: b.rect(7, 3, 5, 12) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 6 * T - 14), ['RJ', 10], ['R+J?' + SINK, `s.x >= ${X + 12 * T + 10}`], ['R', 's.grounded'], run(X + 17 * T)],
    die: [run(X + 6 * T - 14), ['RJ', 16], ['R', 200]],
  };
}

export default {
  id: 13,
  slug: 'the-deep-end',
  name: 'The Deep End',
  idea: 'Water betrays you',
  winMessage: 'Dry at last!',
  deathQuips: ['Glub glub.', 'You swim like a brick.', 'Hold your breath next time.', 'Wet and wrong.', 'The fish are laughing.'],
  handmade: true,
  minWidth: 611,
  traps: [floodTunnel, undertow, freezingPool, bubbleLift, damBreak, driftingRaft, whirlpool, waterfallPause, heavyWater, fakeAirPocket, electricWater, spikedBuoy, waterWall],
  between: [
    [flat(2), isle(2, 3, 1), pit(3, 2, -1), up(2, 2), down(2, 3)],
    [spikes(3, 2), up(2, 3), isle(2, 3, -1), pit(3, 2, -1), block(1, 2, 3), flat(1)],
    [thorns(2, 2), up(2, 3), roof(3), pit(2, 2, -1), down(1, 2), spikes(3, 3)],
    [isle(3, 2, 2), down(2, 2), block(2, 1, 3), pit(3, 3), thorns(1, 2)],
    [up(1, 3), pit(2, 2, 1), pit(3, 2, -2), spikes(2, 2), isle(2, 3, 1), down(1, 3)],
    [pit(2, 3), up(2, 2), isle(2, 2), isle(3, 2, -2), thorns(2, 3)],
    [block(1, 2, 2), spikes(3, 2), up(1, 2), roof(4), down(1, 2), pit(3, 3)],
    [isle(2, 2, 1), isle(2, 2, 1), down(2, 3), thorns(1, 2), pit(3, 2)],
    [thorns(1, 3), pit(2, 2, 2), down(2, 2), spikes(2, 3), block(2, 2, 3)],
    [up(2, 2), pit(3, 3), isle(2, 2, -1), down(1, 3), thorns(2, 2), pit(2, 3)],
    [spikes(3, 3), isle(2, 2, 1), up(1, 2), pit(2, 2, -2), block(1, 1, 2), flat(1)],
    [pit(2, 2, 1), down(1, 3), isle(3, 3), thorns(1, 2), up(2, 2), down(2, 3)],
    [thorns(2, 3), isle(2, 2, 2), down(2, 2), pit(3, 3), spikes(2, 2)],
    [thorns(1, 2), up(2, 3), pit(2, 2, -2), isle(3, 3)],
  ],
};
