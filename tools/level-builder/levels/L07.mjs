// LEVEL 7 – "Too Many Doors": the EXIT keeps changing its mind. Castle walls and stairs.
import { T, run, runL, J, land, wait } from '../lib.mjs';

/** TRAP fake-exit: a biting fake EXIT waits under the last step – climb over the wall. */
function fakeExit(b) {
  b.ground(0, 14);
  b.fill(1, 3, 13, 13, '#');
  b.fill(5, 7, 11, 11, '#');
  b.fill(9, 11, 9, 14, '#');
  b.put(8, 14, 'F');
  b.fakeExit(b.troll('A fake EXIT bites', { type: 'fake-exit', hint: 'That EXIT under the steps is fake and bites – climb the steps and go over the wall.' }));
  const X = b.px(0);
  return {
    w: 15,
    win: [run(X - 30), J(), land, run(X + 4 * T - 25), J(), land, run(X + 8 * T - 25), J(), land, run(X + 14 * T)],
    die: [run(X + 9 * T), ['R', 60]],
  };
}

/** TRAP kick-door: right after a pit a door kicks you back into it – jump over the door. */
function kickDoor(b) {
  b.ground(0, 3);
  b.fill(4, 5, 17, 17, '^');
  b.ground(6, 14);
  const d = b.group({ tile: 'F', kick: [-340, -380] });
  b.put(9, 14, d);
  b.groupTroll(d, b.troll('A door kicks you back into the pit', { type: 'kick-door', hint: 'The door after the pit kicks you back into it – jump over the door.', hazards: [[4, 17, 2, 1]] }));
  const X = b.px(0);
  return {
    w: 15,
    win: [run(X + 4 * T - 30), J(), land, run(X + 8 * T - 10), J(), land, run(X + 14 * T)],
    die: [run(X + 4 * T - 30), J(), land, ['R', 90]],
  };
}

/** TRAP door-tongue: a fake door licks at you with a long spiked tongue when you come close. */
function doorTongue(b) {
  b.ground(0, 16);
  b.put(11, 14, 'F');
  const tongue = b.group({ tile: '<', hidden: true });
  b.fill(7, 10, 14, 14, tongue);
  const id = b.troll('A door licks you with a spiked tongue', { type: 'door-tongue', hint: 'The door shoots out a spiked tongue when you come near – stop, let it lick and pull back, then jump over the door.' });
  b.fakeExit(id);
  const tid = b.uid('tg');
  b.trigger({ id: tid, when: { zone: b.rect(4, 11, 2, 4) }, do: [{ pop: tongue }, { say: 'say.hehe', at: [10.5, 10], ticks: 40 }], troll: id });
  b.trigger({ when: { after: tid }, delay: 45, do: [{ retract: tongue }] });
  const X = b.px(0);
  return {
    w: 17,
    win: [run(X + 4 * T + 10), ['', 50], run(X + 10 * T - 16), J(), land, run(X + 16 * T)],
    die: [run(X + 16 * T)],
  };
}

/** TRAP portal-door: a door in the wall is a portal – you come out with your speed, right before a pit. */
function portalDoor(b) {
  b.ground(0, 13);
  b.fill(9, 10, 3, 14, '#');
  b.fill(14, 16, 17, 17, '^');
  b.ground(17, 21);
  const exitDoor = b.group({ tile: 'F', prop: true });
  b.put(11, 14, exitDoor);
  const portal = b.group({ tile: 'F', warp: [b.x0 + 12, 14] });
  b.put(8, 14, portal);
  const id = b.troll('A portal door throws you at a pit', { type: 'portal-door', hint: 'The door in the wall is a portal and you come out just as fast, right before a pit – walk in slowly.', hazards: [[14, 17, 3, 1]] });
  b.groupTroll(portal, id);
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 7 * T + 22), ['', 12], ['R', 4], ['', 's.x>' + (X + 11 * T)], ['', 20], run(X + 14 * T - 34), J(), land, run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP runaway-exit: the EXIT on the ledge runs away – following it off the ledge drops you in a pit. */
function runawayExit(b, { to, toRow = 14 }) {
  b.ground(0, 9);
  b.fill(10, 13, 17, 17, '^');
  b.ground(14, 19);
  b.fill(2, 3, 13, 14, '#');
  b.fill(5, 9, 11, 11, '#');
  b.doorAt(8, 10);
  const fromX = b.x0 + 8;
  const id = b.troll('The EXIT grows legs and runs away', { type: 'runaway-exit', hint: 'The EXIT on the ledge runs away – do not walk off after it: jump from the very edge of the ledge.', hazards: [[10, 17, 4, 1]] });
  b.trigger({ when: { zone: b.rect(5, 7, 5, 4) }, keep: true, troll: id, do: [{ doorRun: [[fromX + 2, 8], [fromX + 4, -3], [to - 3, -3], [to, toRow]], speed: 9, hehe: 20 }] });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 2 * T - 40), J(), land, run(X + 4 * T - 24), J(), land, run(X + 10 * T - 20), J(), land, run(X + 19 * T)],
    die: [run(X + 2 * T - 40), J(), land, run(X + 4 * T - 24), J(), land, ['R', 90]],
  };
}

/** TRAP slamming-doors: three biting doors snap open and shut in turn – walk through while they are open. */
function slammingDoors(b) {
  b.ground(0, 19);
  b.fill(4, 15, 10, 10, '#');
  const id = b.troll('Biting doors slam open and shut', { type: 'slamming-doors', hint: 'The three doors snap open and shut in turn – go through each one right after it opens.' });
  const doors = [];
  [6, 10, 14].forEach((x, i) => {
    const d = b.group({ tile: 'F' });
    b.put(x, 14, d);
    b.groupTroll(d, id);
    doors.push(d);
    b.trigger({ when: { zone: b.rect(1, 11, 1, 4) }, delay: 1 + i * 30, every: 90, stopAt: b.x0 + 18, do: [{ hide: d }], troll: id });
    b.trigger({ when: { zone: b.rect(1, 11, 1, 4) }, delay: 46 + i * 30, every: 90, stopAt: b.x0 + 18, do: [{ show: d }] });
  });
  const X = b.px(0);
  const wait = (d) => [['', `s.g.${d}[2]===1`], ['', `s.g.${d}[2]===0`]];
  return {
    w: 20,
    win: [run(X + 5 * T - 30), ...wait(doors[0]), run(X + 9 * T - 30), ...wait(doors[1]), run(X + 13 * T - 30), ...wait(doors[2]), run(X + 19 * T)],
    die: [run(X + 19 * T)],
  };
}

/** TRAP exit-swap: the EXIT waiting here swaps itself for a biting fake and runs on. */
function exitSwap(b, { to, toRow = 14 }) {
  b.ground(0, 13);
  b.fill(9, 13, 12, 12, '#');
  const f = b.group({ tile: 'F', hidden: true });
  b.put(6, 14, f);
  const id = b.troll('The EXIT swaps itself for a fake', { type: 'exit-swap', hint: 'The EXIT ahead swaps itself for a biting fake when you come near – jump over the fake one.' });
  b.groupTroll(f, id);
  b.trigger({ when: { zone: b.rect(1, 8, 1, 7) }, keep: true, troll: id, do: [{ show: f }, { doorRun: [[b.x0 + 6, 11], [b.x0 + 8, -3], [to - 3, -3], [to, toRow]], speed: 12, hehe: 0 }, { say: 'say.hehe', at: [b.x0 + 5.5, 11], ticks: 50 }] });
  const X = b.px(0);
  return { w: 14, win: [run(X + 5 * T - 30), J(), land, run(X + 13 * T)], die: [run(X + 6 * T), ['R', 60]] };
}

/** End with TRAP hidden-exit: stairs invite you to jump onto the spiked wall top – the EXIT is
 *  hidden inside the castle wall at ground level. */
function hiddenExitEnd(b) {
  b.ground(0, 22);
  b.fill(2, 4, 14, 14, '#');
  b.fill(5, 7, 13, 14, '#');
  b.fill(8, 10, 12, 14, '#');
  b.fill(13, 22, 9, 10, '#');
  b.fill(13, 22, 8, 8, '^');
  const g = b.group({ tile: '#', fake: true, cover: [[b.x0 + 15, 13], [b.x0 + 15, 14]] });
  b.fill(13, 14, 11, 14, g);
  b.put(15, 11, g);
  b.put(15, 12, g);
  b.fill(16, 22, 11, 14, g);
  const id = b.troll('The real EXIT hides inside the wall', { type: 'hidden-exit', hint: 'The wall top is spiked – step down from the stairs and walk into the wall: the real EXIT hides inside it.', hazards: [[13, 8, 10, 1]] });
  b.groupTroll(g, id);
  b.trigger({ when: { zone: b.rect(11, 6, 3, 4) }, do: [{ say: 'say.hehe', at: [15, 8], ticks: 40 }], troll: id });
  const X = b.px(0);
  const climb = [run(X + 2 * T - 40), J(10), land, run(X + 5 * T - 40), J(10), land, run(X + 8 * T - 40), J(10), land];
  return {
    w: 23,
    win: [...climb, run(X + 15 * T), ['', 's.state!=="play"']],
    die: [...climb, run(X + 10 * T + 20), J(), ['R', 90]],
  };
}

export default {
  id: 7, slug: 'too-many-doors', name: 'Too Many Doors', idea: 'The EXIT keeps changing its mind',
  winMessage: 'Wrong door. Right wall.', deathQuips: ['NOPE!', 'That door bites.', 'Not that one!', 'Rude.'],
  minWidth: 250, style: 'ground', endSeg: hiddenExitEnd,
  traps: [fakeExit, kickDoor, doorTongue, portalDoor, [runawayExit, (b) => ({ to: b.at('swap') + 7 })], slammingDoors,
    [exitSwap, (b) => ({ to: b.at('end') + 15 }), 'swap']],
};
