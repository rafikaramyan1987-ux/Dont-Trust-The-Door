// LEVEL 12 – "Crate Expectations": crates you push, climb and trust. A warehouse.
// Crates (groups with `crate: true`) fall, are pushed by walking into them, slide on ice, ride belts, stop turret
// shots and crush the hero when they land on him. Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof } from '../parkour.mjs';

/** TRAP crate-shadow: a crate drops out of the sky onto its shadow – then you need it as a step. */
function crateShadow(b) {
  b.ground(0, 19);
  const c = b.group({ tile: '#', crate: true, hidden: true, rest: [[0, 12], [1, 12], [2, 12], [3, 12]] });
  b.fill(8, 8, 1, 2, c);
  b.decor(8, 15, 1, 1, 'shadow');
  b.fill(12, 15, 11, 14, '#');
  const id = b.troll('A crate falls on its shadow', { type: 'crate-shadow', hint: 'A crate drops onto the dark spot on the floor – wait until it lands, push it to the wall and climb up on it.' });
  b.trigger({ when: { zone: b.rect(2.6, 10, 1, 5) }, do: [{ show: c }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 3 * T), ['', `s.g.${c}[1] >= ${12 * T - 1}`], wait(10), ['R', `s.g.${c}[0] >= ${3 * T - 1}`], wait(4), runL(X + 9 * T + 10), wait(6),
      ['RJ', 13], land, ['RJ', 14], land, run(X + 19 * T)],
    die: [run(X + 19 * T)],
  };
}

/** TRAP crate-mimic: the top crate of the stack has teeth – jump over the stack from the ledge. */
function crateMimic(b) {
  b.ground(0, 17);
  b.put(1, 14, '#');
  b.fill(2, 4, 12, 14, '#');
  const low = b.group({ tile: '#', crate: 'still' });
  b.put(8, 14, low);
  const m = b.group({ tile: '#', crate: 'still', look: 'cracked' });
  b.put(8, 13, m);
  const teeth = b.group({ tile: '^', hidden: true });
  b.put(8, 12, teeth);
  const id = b.troll('The top crate bites', { type: 'crate-mimic', hint: 'The cracked crate on top of the stack bites – do not land on it: jump over the whole stack from the ledge.' });
  b.trigger({ when: { touch: m }, do: [{ pop: teeth }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 1 * T - 16), ['RJ', 6], land, run(X + 2 * T - 16), ['RJ', 10], land, run(X + 5 * T - 12), ['RJ', 16], land, run(X + 17 * T)],
    die: [run(X + 1 * T - 16), ['RJ', 6], land, run(X + 2 * T - 16), ['RJ', 10], land, ['R', `s.x > ${X + 5 * T + 14}`], land, runL(X + 5 * T + 24), wait(6), ['RJ', 14], land, wait(40)],
  };
}

/** TRAP crate-plate: push the crate onto the plate to open the gate – one push too many and it drops into the pit. */
function cratePlate(b) {
  b.ground(0, 9);
  const c = b.group({ tile: '#', crate: true, rest: [[5, 0], [7, 2]] });
  b.put(3, 14, c);
  const p = b.group({ tile: '#', button: 'red' });
  b.fill(8, 8, 15, 17, p);
  b.ground(12, 21);
  b.fill(14, 16, 7, 10, '#');
  const bars = b.group({ tile: '<' });
  b.fill(15, 15, 11, 14, bars);
  const id = b.troll('One push too many and the crate is gone', { type: 'crate-plate', hint: 'Push the crate onto the red plate and stop: it holds the bars open. One push more and it drops into the pit.' });
  b.trigger({ when: { crate: c, zone: b.rect(8, 14, 1, 1) }, hold: true, do: [{ hide: bars }], undo: [{ show: bars }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [['R', `s.g.${c}[0] >= ${5 * T - 1}`], wait(12), ['J', 6], ['RJ', `s.x >= ${X + 8 * T + 6}`], ['', 's.grounded'], wait(4), ['RJ', 16], land, run(X + 21 * T)],
    die: [['R', `s.g.${c}[0] >= ${7 * T}`], run(X + 21 * T)],
  };
}

/** TRAP crate-avalanche: pushing the floor crate brings the stack down on you – hop over it instead. */
function crateAvalanche(b) {
  b.ground(0, 19);
  const c = b.group({ tile: '#', crate: true });
  b.put(9, 14, c);
  const shelf = b.group({ tile: '#', look: 'cracked' });
  b.fill(8, 10, 9, 9, shelf);
  const stack = b.group({ tile: '#', crate: true });
  b.fill(9, 9, 6, 8, stack);
  const id = b.troll('Pushing the crate brings the stack down', { type: 'crate-avalanche', hint: 'Do not push the crate on the floor: the shelf above gives way and the stack falls on you. Hop over it.' });
  b.trigger({ when: { crate: c, zone: b.rect(10, 14, 1, 1) }, do: [{ hide: shelf }], troll: id });
  const X = b.px(0);
  return { w: 20, win: [run(X + 9 * T - 26), ['RJ', 9], land, run(X + 19 * T)], die: [run(X + 19 * T)] };
}

/** TRAP crate-belt-ram: a crate dropped on the belt rams you back into the pit – jump over it. */
function crateBeltRam(b) {
  b.ground(0, 2);
  b.fill(3, 4, 17, 17, '#');
  b.fill(3, 4, 16, 16, '^');
  const belt = b.group({ tile: '#', conveyor: -210 });
  b.fill(5, 18, 15, 17, belt);
  b.ground(19, 21);
  const c = b.group({ tile: '#', crate: true, hidden: true });
  b.put(17, 3, c);
  const id = b.troll('The crate on the belt rams you', { type: 'crate-belt-ram', hint: 'A crate drops onto the belt and rides it at you, too heavy to push back – jump over it as it comes.' });
  b.trigger({ when: { zone: b.rect(5, 10, 2, 5) }, do: [{ show: c }], troll: id });
  const X = b.px(0);
  const gap = `${X + 17 * T + 20} + s.g.${c}[0] - s.x`;
  return {
    w: 22,
    win: [run(X + 3 * T - 14), J(10), land, ['R', `s.g.${c}[1] >= ${11 * T - 1} && ${gap} < 78`], ['RJ', 14], land, run(X + 21 * T)],
    die: [run(X + 3 * T - 14), J(10), land, ['R', 300]],
  };
}

/** TRAP crate-chute: a chute drops a crate through the gap again and again – jump right after one has passed. */
function crateChute(b) {
  b.ground(0, 6);
  b.ground(9, 19);
  b.fill(6, 6, 0, 9, '#');
  b.fill(9, 9, 3, 8, '#');
  const c = b.group({ tile: '#', crate: true, hidden: true });
  b.fill(7, 8, 1, 1, c);
  const id = b.troll('The chute drops crates into the gap', { type: 'crate-chute', hint: 'The chute drops a crate through the gap every couple of seconds – wait for one to fall past, then jump at once.' });
  b.trigger({ when: { zone: b.rect(0, 10, 2, 5) }, every: 96, stopAt: b.x0 + 12, do: [{ respawn: c }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T), ['', `s.g.${c}[1] > ${9 * T} && s.g.${c}[1] < ${11 * T}`], ['', `s.g.${c}[1] > ${16 * T}`], run(X + 7 * T - 20), ['RJ', 12], land, run(X + 19 * T)],
    die: [run(X + 5 * T), ['', `s.g.${c}[1] > ${16 * T}`], ['', `s.g.${c}[1] > ${2 * T} && s.g.${c}[1] < ${3 * T}`], run(X + 7 * T - 20), ['RJ', 12], wait(40)],
  };
}

/** TRAP crate-shield: a turret fires down a low tunnel – push the crate ahead of you as a shield, then climb on it. */
function crateShield(b) {
  b.ground(0, 23);
  const c = b.group({ tile: '#', crate: true, rest: [[6, 0], [10, 0], [14, 0]] });
  b.put(4, 14, c);
  b.fill(6, 16, 9, 13, '#');
  b.fill(19, 23, 12, 14, '#');
  const tur = b.group({ tile: '#', turret: { every: 50, vx: -4, range: 18 } });
  b.put(19, 14, tur);
  const id = b.troll('A turret guards the low tunnel', { type: 'crate-shield', hint: 'A turret fires down the low tunnel, too low to jump in – push the crate ahead of you as a shield, then climb up on it.' });
  b.trigger({ when: { zone: b.rect(0, 10, 3, 5) }, do: [{ activate: tur }], troll: id });
  // anyone coming back from the right into the tunnel wakes it up as well
  b.trigger({ when: { zone: b.rect(17, 10, 2, 5) }, do: [{ activate: tur }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [['R', `s.g.${c}[0] >= ${14 * T - 1}`], wait(8), ['RJ', 8], land, ['RJ', 12], land, run(X + 23 * T)],
    die: [run(X + 4 * T - 26), ['RJ', 9], land, run(X + 18 * T)],
  };
}

/** TRAP crate-ice-stairs: the first step of the crate stairs shoves both crates off on the ice into the gap. */
function crateIceStairs(b) {
  b.ground(0, 4);
  const ice = b.group({ tile: '#', ice: true });
  b.fill(5, 8, 15, 17, ice);
  const a = b.group({ tile: '#', crate: true, look: 'cracked' });
  b.put(6, 14, a);
  const s = b.group({ tile: '#', crate: true });
  b.fill(7, 8, 13, 14, s);
  b.fill(11, 15, 12, 17, '#');
  b.ground(16, 19);
  const id = b.troll('The first step shoves the stairs away', { type: 'crate-ice-stairs', hint: 'Stepping on the small cracked crate shoves both crates across the ice into the gap – jump straight onto the big crate.' });
  b.trigger({ when: { zone: b.rect(6, 13, 1, 1), grounded: true }, do: [{ shove: a, vx: 4 }, { shove: s, vx: 4 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T - 20), ['RJ', 13], land, run(X + 9 * T - 16), ['RJ', 14], land, run(X + 19 * T)],
    die: [run(X + 5 * T + 4), wait(10), ['J', 6], ['RJ', `s.x >= ${X + 6 * T - 6}`], ['', 's.grounded'], wait(90)],
  };
}

/** TRAP crate-heavy-bridge: the ice bridge holds you or the crate, not both – shove the crate and let it slide across alone. */
function crateHeavyBridge(b) {
  b.ground(0, 6);
  const c = b.group({ tile: '#', crate: true, rest: [[4, 0], [9, 0], [13, 0]] });
  b.fill(3, 3, 13, 14, c);
  const br = b.group({ tile: '#', ice: true, look: 'cracked' });
  b.fill(7, 12, 15, 15, br);
  b.ground(13, 21);
  b.fill(17, 20, 11, 14, '#');
  const id = b.troll('The bridge holds you or the crate, not both', { type: 'crate-heavy-bridge', hint: 'The cracked ice bridge breaks under you and the crate together – push the crate onto it, step back and let it slide across alone.' });
  b.trigger({ when: { zone: b.rect(7.4, 13, 5.2, 2), grounded: true, crate: c, crateZone: b.rect(7, 13, 4.6, 2) }, do: [{ fall: br, shake: 6 }], troll: id });
  const X = b.px(0);
  const climb = [['J', 7], ['RJ', `s.x >= ${X + 16 * T - 6}`], ['', 's.grounded'], wait(4), ['RJ', 12], land];
  return {
    w: 22,
    win: [['R', `s.g.${c}[0] >= ${4 * T + 1}`], ['L', 6], wait(4), ['', `s.g.${c}[0] >= ${8 * T}`], wait(30), ['R', `s.g.${c}[0] >= ${13 * T - 1}`], wait(8), ...climb, run(X + 21 * T)],
    die: [['R', 260]],
  };
}

/** TRAP crate-pad-damper: the spring is the obvious way up – it shoots you into the spikes; park the crate on it. */
function cratePadDamper(b) {
  b.ground(0, 19);
  const c = b.group({ tile: '#', crate: true, rest: [[6, 0]] });
  b.fill(3, 3, 13, 14, c);
  const pad = b.group({ tile: '=' });
  b.put(9, 14, pad);
  b.fill(7, 11, 3, 4, '#');
  b.fill(7, 11, 5, 5, 'v');
  b.fill(10, 13, 11, 14, '#');
  const id = b.troll('The spring shoots you into the spikes', { type: 'crate-pad-damper', hint: 'The spring launches you into the ceiling spikes – push the crate onto it and climb up on the crate instead.', hazards: [[7, 5, 5, 1]] });
  b.groupTroll(pad, id);
  const X = b.px(0);
  return {
    w: 20,
    win: [['R', `s.g.${c}[0] >= ${6 * T - 1}`], wait(8), ['J', 7], ['RJ', `s.x >= ${X + 9 * T - 4}`], ['', 's.grounded'], wait(4), ['RJ', 12], land, run(X + 19 * T)],
    die: [run(X + 3 * T - 34), ['RJ', 16], land, run(X + 9 * T + 20), wait(60)],
  };
}

/** TRAP crate-magnet: the magnet lifts the crate – ride it up and jump off onto the ledge before it hits the spikes. */
function crateMagnet(b) {
  b.ground(0, 11);
  const c = b.group({ tile: '#', crate: true, rest: [[4, 0], [4, -1], [4, -2], [4, -3], [4, -4], [4, -6], [4, -9]] });
  b.put(4, 14, c);
  b.fill(8, 11, 2, 3, '#');
  b.fill(8, 11, 4, 4, 'v');
  b.fill(12, 12, 17, 17, '#');
  b.fill(12, 12, 16, 16, '^');
  b.fill(13, 15, 11, 17, '#');
  b.fill(16, 17, 13, 17, '#');
  b.ground(18, 21);
  const id = b.troll('The magnet lifts the crate into its spikes', { type: 'crate-magnet', hint: 'The magnet pulls the crate up to its spikes – jump on as it rises and hop off onto the ledge before the top.', hazards: [[8, 4, 4, 1]] });
  b.trigger({ when: { crate: c, zone: b.rect(9, 5, 2, 10) }, hold: true, do: [{ magnet: c, on: true }], undo: [{ magnet: c, on: false }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [['R', `s.g.${c}[1] <= -4`], ['L', 4], ['J', 7], ['RJ', `s.x >= ${X + 4 * T + 20} + s.g.${c}[0]`], ['', 's.grounded'], ['', `s.g.${c}[1] <= ${-3 * T - 4}`], ['RJ', 16], land, run(X + 17 * T), land, run(X + 21 * T)],
    die: [['R', `s.g.${c}[1] <= -4`], ['L', 4], ['J', 7], ['RJ', `s.x >= ${X + 4 * T + 20} + s.g.${c}[0]`], ['', 's.grounded'], wait(400)],
  };
}

/** TRAP cardboard-crate: the crate at the bottom of the shaft is cardboard over spikes – push the real one down first. */
function cardboardCrate(b) {
  b.ground(0, 3);
  b.fill(4, 4, 14, 17, '#');
  b.fill(5, 5, 13, 17, '#');
  b.fill(6, 9, 11, 17, '#');
  const c = b.group({ tile: '#', crate: true, rest: [[2, 6]] });
  b.fill(8, 9, 10, 10, c);
  b.fill(10, 11, 17, 17, '#');
  b.fill(10, 11, 16, 16, '^');
  const fake = b.group({ tile: '#', crate: 'still', fake: true, look: 'cracked' });
  b.fill(10, 11, 15, 15, fake);
  b.fill(12, 13, 0, 14, '#');
  b.fill(12, 15, 16, 17, '#');
  b.fill(16, 19, 15, 17, '#');
  const id = b.troll('The crate in the shaft is cardboard', { type: 'cardboard-crate', hint: 'The crate at the bottom of the shaft is cardboard over spikes – push the real crate down the shaft first, then drop onto it.' });
  b.trigger({ when: { zone: b.rect(10, 15, 2, 1) }, do: [{ hide: fake }], troll: id });
  b.trigger({ when: { crate: c, zone: b.rect(10, 13, 2, 2) }, do: [{ hide: fake }] });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 4 * T - 16), ['RJ', 6], land, run(X + 5 * T - 16), ['RJ', 6], land, run(X + 6 * T - 16), ['RJ', 10], land,
      ['R', `s.g.${c}[0] >= ${2 * T}`], ['', `s.g.${c}[1] >= ${6 * T - 1}`], wait(10), run(X + 10 * T + 20), land, run(X + 15 * T + 24), ['RJ', 6], land, run(X + 19 * T)],
    die: [run(X + 4 * T - 16), ['RJ', 6], land, run(X + 5 * T - 16), ['RJ', 6], land, run(X + 6 * T - 16), ['RJ', 10], land,
      wait(6), ['RJ', 9], ['R', `s.x >= ${X + 10 * T + 10}`], ['', 's.grounded'], wait(30)],
  };
}

export default {
  id: 12,
  slug: 'crate-expectations',
  name: 'Crate Expectations',
  idea: 'Crates you push, climb and trust',
  winMessage: 'Handle with care!',
  deathQuips: ['This side up. Not you.', 'Fragile: you.', 'Return to sender.', 'Boxed in.', 'Some assembly required.'],
  handmade: true,
  minWidth: 531,
  traps: [crateShadow, crateMimic, cratePlate, crateAvalanche, crateBeltRam, crateChute, crateShield, crateIceStairs, crateHeavyBridge, cratePadDamper, crateMagnet, cardboardCrate],
  between: [
    [flat(2), up(1, 3), pit(3, 2, 1), isle(2, 3, -1), down(1, 3)],
    [thorns(1, 2), up(2, 2), pit(2, 2), pit(3, 2, -1), down(1, 2), spikes(2, 3)],
    [up(1, 2), isle(3, 3, 1), pit(2, 2, -1), block(1, 1, 3), down(1, 2)],
    [thorns(1, 3), up(1, 4), roof(3), down(1, 2), thorns(1, 4)],
    [pit(2, 2, 2), down(1, 3), isle(3, 2, 1), pit(2, 3, -2), thorns(1, 3)],
    [block(2, 2, 2), pit(3, 3), up(2, 3), down(2, 1), pit(3, 3)],
    [spikes(2, 2), isle(2, 2, 2), isle(3, 2, -1), isle(2, 2, 1), pit(2, 3, -2)],
    [up(1, 2), thorns(1, 2), up(1, 2), roof(4), down(2, 2), block(1, 2, 3)],
    [isle(2, 3), spikes(3, 2), up(2, 3), pit(2, 2, -1), down(1, 3)],
    [pit(3, 2, 1), pit(2, 2, 1), down(2, 3), spikes(2, 2), isle(3, 3)],
    [thorns(1, 2), block(1, 1, 2), isle(2, 2, 1), down(1, 2), pit(3, 3)],
    [up(2, 3), pit(3, 2), down(2, 2), isle(2, 2, 1), pit(2, 3, -1)],
    [spikes(3, 3), up(1, 2), isle(3, 2, 1), down(2, 3)],
  ],
};
