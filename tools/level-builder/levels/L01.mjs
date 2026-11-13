// LEVEL 1 – "Hello, Floor": the floor is not what it seems. Gentle tutorial difficulty.
import { T, run, J, land, wait } from '../lib.mjs';

/** TRAP sinking-floor: a patch of floor slowly sinks into the abyss while you stand on it. */
function sinkingFloor(b) {
  b.ground(0, 4);
  b.ground(8, 13);
  b.put(11, 14, '#');
  const g = b.group({ tile: '#', look: 'cracked' });
  b.fill(5, 7, 15, 15, g);
  const id = b.troll('The floor sinks into the abyss', { type: 'sinking-floor', hint: 'The cracked floor ahead slowly sinks into the abyss – step on it and jump off to the right straight away.' });
  b.trigger({ when: { touch: g }, do: [{ move: g, by: [0, 5], ticks: 260 }, { say: 'say.oops', at: 'hero', ticks: 50 }], troll: id });
  const X = b.px(0);
  return {
    w: 14,
    win: [run(X + 6 * T), J(), land, run(X + 10 * T - 40), J(10), land, run(X + 13 * T)],
    die: [run(X + 6 * T + 20), ['', 400]],
  };
}

/** TRAP fake-floor: on a little plateau, two tiles are fake and hide a spike pit. */
function fakeFloor(b) {
  b.ground(0, 15);
  b.fill(3, 12, 14, 14, '#');
  b.fill(7, 8, 14, 16, '.');
  b.fill(7, 8, 16, 16, '^');
  const g = b.group({ tile: '#', fake: true });
  b.fill(7, 8, 14, 14, g);
  b.groupTroll(g, b.troll('Two fake floor tiles over spikes', { type: 'fake-floor', hint: 'Two tiles in the middle of the plateau are fake – jump over them.', hazards: [[7, 16, 2, 1]] }));
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 2 * T - 30), J(10), land, run(X + 6 * T + 10), J(), land, run(X + 15 * T)],
    die: [run(X + 2 * T - 30), J(10), land, run(X + 8 * T), ['R', 60]],
  };
}

/** TRAP collapsing-floor: cracked floor in a dip crumbles a moment after you step on it. */
function collapsingFloor(b) {
  b.ground(0, 3);
  b.fill(4, 10, 16, 17, '#');
  b.ground(11, 15);
  b.fill(5, 9, 16, 17, '.');
  b.fill(5, 9, 17, 17, '^');
  const g = b.group({ tile: '#', look: 'cracked' });
  b.fill(5, 9, 16, 16, g);
  const id = b.troll('Cracked floor crumbles if you stop on it', { type: 'collapsing-floor', hint: 'The cracked floor in the dip crumbles shortly after you step on it – keep walking across.', hazards: [[5, 17, 5, 1]] });
  b.trigger({ when: { touch: g }, do: [{ fall: g, shake: 34 }], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 10 * T), J(10), land, run(X + 15 * T)],
    die: [run(X + 6 * T + 10), ['', 120]],
  };
}

/** TRAP conveyor-floor: after a small pit, a conveyor belt pulls you back into it. */
function conveyorFloor(b) {
  b.ground(0, 3);
  b.fill(4, 5, 17, 17, '^');
  const g = b.group({ tile: '#', conveyor: -210 });
  b.fill(6, 14, 15, 16, g);
  b.ground(15, 19);
  b.fill(6, 14, 17, 17, '#');
  const id = b.troll('The conveyor belt drags you into the pit', { type: 'conveyor-floor', hint: 'After the little pit the floor is a conveyor belt that drags you back into it – keep running right.', hazards: [[4, 17, 2, 1]] });
  b.groupTroll(g, id);
  b.trigger({ when: { touch: g }, do: [{ say: 'say.wheee', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 4 * T - 30), J(), land, run(X + 19 * T)],
    die: [run(X + 4 * T - 30), J(), land, ['', 200]],
  };
}

/** TRAP hard-landing hatch: a hatch behind a spike breaks if you land on it from a big jump. */
function hatchFloor(b) {
  b.ground(0, 4);
  b.put(4, 14, '^');
  b.fill(5, 9, 16, 17, '#');
  b.fill(5, 9, 17, 17, '^');
  b.ground(10, 15);
  const g = b.group({ tile: '#', look: 'bolted' });
  b.fill(5, 9, 15, 15, g);
  b.fill(5, 9, 16, 16, '.');
  const id = b.troll('The hatch breaks under a hard landing', { type: 'hard-landing-hatch', hint: 'The bolted hatch after the spike breaks if you land on it hard – clear the spike with a tiny tap jump.', hazards: [[5, 17, 5, 1]] });
  b.trigger({ when: { zone: b.rect(5, 13, 5, 2), landFaster: 640 }, do: [{ fall: g, shake: 1 }, { say: 'say.oops', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 4 * T - 26), ['RJ', 5], land, run(X + 15 * T)],
    die: [run(X + 3 * T), J(), ['R', 70]],
  };
}

/** TRAP invisible-floor: a wide spike pit is bridged by invisible blocks that start 2 tiles out. */
function invisibleFloor(b) {
  b.ground(0, 4);
  b.fill(5, 13, 17, 17, '^');
  const g = b.group({ tile: '#', invisible: true });
  b.fill(7, 13, 15, 15, g);
  b.ground(14, 19);
  const id = b.troll('An invisible bridge over the wide pit', { type: 'invisible-floor', hint: 'An invisible bridge crosses the wide pit, but it starts 2 tiles out – jump from the edge, then walk.', hazards: [[5, 17, 9, 1]] });
  b.groupTroll(g, id);
  b.trigger({ when: { zone: b.rect(5, 15, 2, 2) }, do: [{ say: 'say.oops', at: 'hero', ticks: 30 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T - 30), J(), land, run(X + 19 * T)],
    die: [run(X + 5 * T + 10), ['R', 60]],
  };
}

/** TRAP ice-floor: a slippery ice slab ends right at a spike pit – you cannot stop on it. */
function iceFloor(b) {
  b.ground(0, 3);
  const g = b.group({ tile: '#', ice: true });
  b.fill(4, 11, 15, 17, g);
  b.fill(12, 15, 17, 17, '^');
  b.ground(16, 21);
  b.fill(18, 19, 14, 14, '#');
  const id = b.troll('Slippery ice slides you into the pit', { type: 'ice-floor', hint: 'The blue floor is ice: you cannot stop on it – keep running and jump at its very end.', hazards: [[12, 17, 4, 1]] });
  b.groupTroll(g, id);
  b.trigger({ when: { touch: g }, do: [{ say: 'say.wheee', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 12 * T - 24), J(), land, run(X + 18 * T - 40), J(), land, run(X + 21 * T)],
    die: [run(X + 9 * T), ['', 120]],
  };
}

/** TRAP crumbling-bridge: a long bridge whose planks drop one after another behind you. */
function crumblingBridge(b) {
  b.ground(0, 2);
  b.fill(3, 14, 17, 17, '^');
  const id = b.troll('The bridge crumbles behind you', { type: 'crumbling-bridge', hint: 'The long bridge crumbles plank by plank right after you step on it – keep running across.', hazards: [[3, 17, 12, 1]] });
  for (let x = 3; x <= 13; x += 2) {
    const g = b.group({ tile: '#', look: 'cracked' });
    b.fill(x, x + 1, 14, 14, g);
    b.trigger({ when: { touch: g }, do: [{ fall: g, shake: 20 }], troll: id });
  }
  b.fill(2, 2, 14, 14, '#');
  b.ground(15, 19);
  b.fill(15, 19, 14, 14, '#');
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 2 * T - 40), J(10), land, run(X + 19 * T)],
    die: [run(X + 2 * T - 40), J(10), land, run(X + 6 * T), ['', 90]],
  };
}

export default {
  id: 1, slug: 'hello-floor', name: 'Hello, Floor', idea: 'The floor is not what it seems',
  winMessage: 'Welcome. Trust nothing.', deathQuips: ['Oops!', 'The floor did that.', 'Ouch.', 'Hmm.'],
  minWidth: 236, style: 'ground',
  traps: [sinkingFloor, fakeFloor, collapsingFloor, conveyorFloor, hatchFloor, invisibleFloor, iceFloor, crumblingBridge],
};
