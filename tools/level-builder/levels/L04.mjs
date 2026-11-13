// LEVEL 4 – "Heavy Ceiling": the cave roof is out to get you. Rows 0-1 are solid rock.
import { T, run, runL, J, land, wait } from '../lib.mjs';

/** TRAP dropping-ceiling-spikes: spikes under a low rock drop when you come near, then go back up. */
function droppingSpikes(b) {
  b.ground(0, 13);
  b.fill(4, 9, 2, 9, '#');
  const g = b.group({ tile: 'v' });
  b.fill(5, 8, 10, 10, g);
  const id = b.troll('Ceiling spikes drop on you', { type: 'dropping-ceiling-spikes', hint: 'The spikes under the low rock drop when you come near – step back, let them fall and rise, then go.', hazards: [[5, 11, 4, 4]] });
  b.trigger({ when: { zone: b.rect(3, 11, 1, 4) }, do: [{ move: g, by: [0, 4], ticks: 12, deadly: true, returnAfter: 50, returnTicks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 14,
    win: [run(X + 3 * T + 10), runL(X + 2 * T), ['', `s.g.${g}[1]>=150`], ['', `s.g.${g}[1]===0`], run(X + 13 * T)],
    die: [run(X + 13 * T)],
  };
}

/** TRAP crusher-slab: a cracked slab shakes and then crashes down – sprint under it. */
function crusherSlab(b) {
  b.ground(0, 15);
  b.fill(5, 10, 2, 5, '#');
  const g = b.group({ tile: '#', look: 'cracked' });
  b.fill(5, 10, 6, 8, g);
  const id = b.troll('The cracked slab crashes down', { type: 'crusher-slab', hint: 'The cracked slab crashes down a moment after you step under it – sprint through without stopping.', hazards: [[5, 9, 6, 6]] });
  b.trigger({ when: { zone: b.rect(4, 9, 1, 6) }, delay: 52, do: [{ move: g, by: [0, 6], ticks: 14, deadly: true }, { say: 'say.rumble', at: [7, 3], ticks: 30 }], troll: id });
  const X = b.px(0);
  return { w: 16, win: [run(X + 15 * T)], die: [run(X + 7 * T), ['', 120]] };
}

/** TRAP loose-brick: bonking the bolted brick shakes spiked rocks loose from the roof. */
function looseBrick(b) {
  b.ground(0, 13);
  const brick = b.group({ tile: '#', look: 'bolted' });
  b.put(7, 10, brick);
  const rocks = b.group({ tile: '*' });
  b.fill(6, 8, 2, 2, rocks);
  const id = b.troll('Bonking the brick drops spiked rocks', { type: 'loose-brick', hint: 'Do not jump into the bolted brick – bonking it drops spiked rocks on you. Just walk under it.', hazards: [[6, 3, 3, 12]] });
  b.trigger({ when: { zone: b.rect(7, 11, 1, 1), airborne: true }, do: [{ toss: rocks, vel: [0, 1] }, { shake: 5 }], troll: id });
  const X = b.px(0);
  return { w: 14, win: [run(X + 13 * T)], die: [run(X + 7 * T), ['J', 16], ['', 90]] };
}

/** TRAP thwomp: a stone block slams down in a steady rhythm – pass right after it lifts. */
function thwomp(b) {
  b.ground(0, 13);
  const g = b.group({ tile: '#', look: 'bolted' });
  b.fill(6, 8, 3, 6, g);
  b.fill(5, 9, 2, 2, '#');
  const id = b.troll('A stone block slams down in rhythm', { type: 'thwomp', hint: 'The stone block slams down in a steady rhythm – wait until it lifts, then run under it.', hazards: [[6, 7, 3, 8]] });
  b.trigger({ when: { zone: b.rect(1, 11, 1, 4) }, do: [{ move: g, by: [0, 8], ticks: 10, deadly: true, returnAfter: 30, returnTicks: 30 }], every: 100, stopAt: b.x0 + 14, troll: id });
  const X = b.px(0);
  return {
    w: 14,
    win: [run(X + 3 * T), ['', `s.g.${g}[1]>=300`], ['', `s.g.${g}[1]<=110`], run(X + 13 * T)],
    die: [run(X + 7 * T), ['', 160]],
  };
}

/** TRAP domino-stalactites: stalactites fall one after another right behind you – don't stop. */
function dominoStalactites(b) {
  b.ground(0, 15);
  const id = b.troll('Stalactites fall one after another', { type: 'domino-stalactites', hint: 'Once you pass the first stalactite they all fall one after another behind you – keep running.' });
  const first = b.uid('dom');
  for (let i = 0; i < 9; i++) {
    const g = b.group({ tile: 'v' });
    b.put(3 + i, 2, g);
    b.trigger({ ...(i === 0 ? { id: first, when: { zone: b.rect(3, 3, 1, 12) } } : { when: { after: first }, delay: i * 9 }), do: [{ move: g, by: [0, 12], ticks: 16, deadly: true }], troll: id });
  }
  const X = b.px(0);
  return { w: 16, win: [run(X + 15 * T)], die: [run(X + 7 * T), ['', 90]] };
}

/** TRAP fake-ceiling: the open hole in a low ceiling is a trap; the way up is the cracked tile. */
function fakeCeiling(b) {
  b.ground(0, 18);
  b.fill(2, 14, 12, 12, '#');
  b.fill(13, 14, 13, 14, '#');
  b.fill(5, 6, 12, 12, '.');
  b.fill(4, 4, 10, 11, '#');
  b.fill(7, 7, 10, 11, '#');
  b.fill(4, 7, 9, 9, '#');
  const sp = b.group({ tile: 'v', hidden: true });
  b.fill(5, 6, 10, 10, sp);
  const fake = b.group({ tile: '#', fake: true, look: 'cracked' });
  b.fill(9, 10, 12, 12, fake);
  b.fill(5, 6, 14, 14, '#');
  b.fill(9, 10, 14, 14, '#');
  const id = b.troll('The hole in the ceiling is a trap', { type: 'fake-ceiling', hint: 'The open hole in the low ceiling hides spikes – the way up is the cracked part that looks solid.' });
  b.trigger({ when: { zone: b.rect(5, 10, 2, 3) }, do: [{ pop: sp }], troll: id });
  b.groupTroll(fake, id);
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 5 * T - 34), J(10), land, run(X + 9 * T - 34), J(10), land, run(X + 9 * T + 20), ["", 8], ["J", 16], ['', 's.vy>0'], ['R', 's.grounded'], run(X + 15 * T + 10), ['R', 's.grounded && s.y>560'], run(X + 18 * T)],
    die: [run(X + 5 * T - 34), J(10), land, run(X + 5 * T + 20), ["", 8], ["J", 16], ['', 90]],
  };
}

/** TRAP safe-notch: a huge slab crushes the whole room – the only safe spot is a slot in the floor. */
function safeNotch(b) {
  b.ground(0, 17);
  b.fill(9, 9, 15, 16, '.');
  b.fill(2, 15, 2, 5, '#');
  const g = b.group({ tile: '#', look: 'cracked' });
  b.fill(2, 15, 6, 8, g);
  const id = b.troll('The whole roof slab crashes down', { type: 'safe-notch', hint: 'The whole roof slab crashes down – drop into the slot in the floor and wait there until it lifts.', hazards: [[2, 9, 14, 6], [9, 15, 1, 2]] });
  b.trigger({ when: { zone: b.rect(2, 9, 1, 6) }, delay: 64, do: [{ move: g, by: [0, 6], ticks: 16, deadly: true, returnAfter: 40, returnTicks: 50 }, { say: 'say.rumble', at: [9, 3], ticks: 30 }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 9 * T + 20), ['', `s.g.${g}[1]>=200`], ['', `s.g.${g}[1]===0`], ['RJ', 16], land, run(X + 17 * T)],
    die: [run(X + 5 * T), ['', 160]],
  };
}

/** TRAP descending-ceiling: a spiked ceiling lowers as soon as you enter – jump the pit while you still can. */
function descendingCeiling(b) {
  b.ground(0, 19);
  b.fill(11, 12, 15, 17, '.');
  b.fill(11, 12, 17, 17, '^');
  const g = b.group({ tile: '#' });
  b.fill(1, 19, 2, 8, g);
  const s = b.group({ tile: 'v' });
  b.fill(1, 19, 9, 9, s);
  const id = b.troll('The spiked ceiling comes down', { type: 'descending-ceiling', hint: 'The spiked ceiling lowers as soon as you enter – hurry to the pit and jump it while there is still room.', hazards: [[11, 17, 2, 1], [1, 10, 19, 3]] });
  b.trigger({ when: { zone: b.rect(1, 10, 1, 5) }, do: [{ chase: g, vel: [0, 0.55], untilY: 4 }, { chase: s, vel: [0, 0.55], untilY: 4 }, { say: 'say.rumble', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 11 * T - 34), J(12), land, run(X + 19 * T)],
    die: [run(X + 3 * T), ['', 120], run(X + 11 * T - 34), J(12), ['R', 60]],
  };
}

export default {
  id: 4, slug: 'heavy-ceiling', name: 'Heavy Ceiling', idea: 'The ceiling is out to get you', cave: 2,
  winMessage: 'The roof stayed up. Mostly.', deathQuips: ['Squish.', 'Pancake mode.', 'Flat.', 'Bonk.'],
  minWidth: 258, style: 'ground',
  traps: [droppingSpikes, crusherSlab, looseBrick, thwomp, dominoStalactites, fakeCeiling, safeNotch, descendingCeiling],
};
