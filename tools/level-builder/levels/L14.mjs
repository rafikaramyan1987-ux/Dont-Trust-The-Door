// LEVEL 14 – "Lock and Key": keys and locks betray you. You pick up keys (you carry one at a time: the key you hold
// shows over your head, and picking up another drops it where you stand); doors, posts and padlocks open when you
// touch them with the right key (a skeleton key opens any lock). Mechanics: src/game/ext/l14.ts.
// Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

/** a key lying (or hanging) at a tile */
const keyAt = (b, x, y, key, extra = {}) => {
  const g = b.group({ tile: '?', ext: { kind: 'key', key, ...extra } });
  b.put(x, y, g);
  return g;
};
/** a locked door / post: a solid column of tiles that opens with the key */
const gate = (b, x, y0, y1, key, extra = {}) => {
  const g = b.group({ tile: '#', ext: { kind: 'lock', key, ...extra } });
  b.fill(x, x, y0, y1, g);
  return g;
};
/** a spike-lined pit over columns x0..x1 (spikes on row 16, floor on row 17) */
const spikePit = (b, x0, x1) => {
  b.fill(x0, x1, 17, 17, '#');
  b.fill(x0, x1, 16, 16, '^');
};
/** a locked door in a wall over the far end of a pit: the wall (rows 6-10), the door (rows 11-15) and the pit
 *  below it at column x – bump into it shut and you slide down into the spikes; open, you fly through */
const wallGate = (b, x, key, extra = {}) => {
  b.fill(x, x, 6, 10, '#');
  spikePit(b, x, x);
  return gate(b, x, 11, 15, key, extra);
};
const has = (k) => `s.ext.l14.keys.includes("${k}")`;
const none = 's.ext.l14.keys.length === 0';

/** TRAP key-plank: one plank of the bridge over the spikes is the key – walking on it picks it up and you fall. */
function keyPlank(b) {
  b.ground(0, 3);
  b.fill(4, 13, 15, 15, '#');
  spikePit(b, 4, 13);
  const key = b.group({ tile: '#', ext: { kind: 'key', key: 'gold', plank: true } });
  b.fill(8, 9, 15, 15, key);
  b.ground(14, 19);
  gate(b, 16, 11, 14, 'gold');
  const id = b.troll('The golden plank is the key', { type: 'key-plank', hint: 'The golden plank in the bridge is the key: step on it and you take it and fall – hop over it, then step back onto its edge from the right to pick it up.', hazards: [[4, 16, 10, 1]] });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 8 * T - 20), ['RJ', 7], land, run(X + 11 * T + 10), ['L', 's.ext.l14.keys.length > 0'], ['', 4], run(X + 19 * T)],
    die: [run(X + 12 * T), ['R', 60]],
  };
}

/** TRAP iron-key: the iron key is so heavy your jumps are low – hop the spiky wall and you hit it; take the tunnel. */
function ironKey(b) {
  b.ground(0, 5);
  const key = keyAt(b, 2, 14, 'iron', { heavy: 0.7 });
  // the tunnel: in at columns 6-7, under the floor of 8-12, out at 13 (a step at 14)
  b.fill(6, 7, 17, 17, '#');
  b.fill(8, 12, 15, 15, '#');
  b.fill(8, 12, 17, 17, '#');
  b.fill(13, 13, 17, 17, '#');
  b.fill(14, 14, 16, 17, '#');
  b.ground(15, 20);
  // the spiky wall on top
  b.fill(9, 11, 13, 14, '#');
  b.fill(8, 8, 13, 14, '<');
  gate(b, 18, 11, 14, 'iron');
  const id = b.troll('The iron key weighs you down', { type: 'iron-key', hint: 'Carrying the iron key your jumps are very low – you cannot hop the spiky wall: drop into the tunnel in front of it and walk under it.', hazards: [[8, 13, 1, 2]] });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 13 * T + 14), ['RJ', 12], land, ['RJ', 12], land, run(X + 20 * T)],
    die: [run(X + 5 * T + 10), ['RJ', 16], ['R', 60]],
  };
}

/** TRAP skeleton-key: the skeleton key opens every lock – also the padlock on the chain that holds the spiked ball. */
function skeletonKey(b) {
  b.ground(0, 17);
  keyAt(b, 2, 14, 'bone');
  const ball = b.group({ tile: '*' });
  b.put(5, 8, ball);
  const post = gate(b, 6, 14, 14, 'gold', { trap: true, stay: true, rope: [b.x0 + 5, 8], do: [{ move: ball, by: [0, 6], ticks: 20, deadly: true }] });
  gate(b, 12, 11, 14, 'silver');
  const id = b.troll('The skeleton key opens the wrong lock too', { type: 'skeleton-key', hint: 'The skeleton key opens every lock – also the padlock on the post that holds the spiked ball over you. Hop over the post without touching it.' });
  b.groupTroll(post, id);
  b.groupTroll(ball, id);
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 4 * T + 26), ['RJ', 8], land, run(X + 17 * T)],
    die: [run(X + 6 * T - 14), ['R', 80]],
  };
}

/** TRAP glass-key: the glass key shatters when you land hard – walk down the steps and hop the spike with a tiny jump. */
function glassKey(b) {
  b.ground(0, 2);
  b.fill(3, 3, 14, 17, '#');
  b.fill(4, 4, 13, 17, '#');
  b.fill(5, 5, 12, 17, '#');
  b.fill(6, 9, 11, 17, '#');
  const key = keyAt(b, 8, 10, 'glass', { glass: 740 });
  b.fill(10, 12, 13, 17, '#');
  b.ground(13, 22);
  b.put(17, 14, '^');
  gate(b, 20, 11, 14, 'glass');
  const X0 = b.px(0);
  const climb = [3, 4, 5, 6].flatMap((c) => [run(X0 + c * T - 14), ['RJ', 6], land]);
  const id = b.troll('The glass key shatters on a hard landing', { type: 'glass-key', hint: 'The glass key breaks if you land hard – no big jumps or drops while you carry it: walk down the steps and hop the spike with a tiny jump.' });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 23,
    win: [...climb, run(X + 10 * T), ['R', 's.grounded'], run(X + 13 * T), ['R', 's.grounded'], run(X + 17 * T - 16), ['RJ', 5], land, run(X + 22 * T)],
    die: [...climb, run(X + 9 * T), ['RJ', 20], ['R', 60]],
  };
}

/** TRAP hungry-lock: two padlocks lower the bridge – the first one eats your key; jump over it, use the second. */
function hungryLock(b) {
  b.ground(0, 12);
  keyAt(b, 2, 14, 'gold');
  const bridge = b.group({ tile: '#', hidden: true, ext: { kind: 'bridge' } });
  b.fill(13, 17, 15, 15, bridge);
  spikePit(b, 13, 17);
  const first = b.group({ tile: '?', ext: { kind: 'lock', key: 'gold', mode: 'hungry' } });
  b.put(8, 14, first);
  const second = b.group({ tile: '?', ext: { kind: 'lock', key: 'gold', do: [{ show: bridge }] } });
  b.put(12, 14, second);
  b.ground(18, 21);
  const id = b.troll('The first padlock eats your key', { type: 'hungry-lock', hint: 'Both padlocks lower the bridge, but the first one is hungry: it eats your key. Jump over the first padlock and touch the second one at the pit.', hazards: [[13, 16, 5, 1]] });
  b.groupTroll(first, id);
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 7 * T - 20), ['RJ', 10], land, run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP chained-key: the key is chained to its post – run off with it and the chain yanks you back into the pit. */
function chainedKey(b) {
  b.ground(0, 8);
  const post = gate(b, 3, 14, 14, 'gold', { mode: 'release' });
  const key = keyAt(b, 7, 14, 'gold', { chain: post, len: 6.5 });
  spikePit(b, 9, 11);
  b.ground(12, 19);
  gate(b, 16, 11, 14, 'gold');
  const id = b.troll('The key is chained to its post', { type: 'chained-key', hint: 'The key is chained to the post behind it – run off with it and the chain yanks you back into the pit. Take it back to the post first: the key opens the padlock on its chain.', hazards: [[9, 16, 3, 1]] });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 3 * T - 14), J(10), land, run(X + 7 * T + 10), runL(X + 5 * T), ['L', `s.g.${post}[2] === 0`], run(X + 9 * T - 12), ['RJ', 16], land, run(X + 19 * T)],
    die: [run(X + 3 * T - 14), J(10), land, run(X + 9 * T - 12), ['RJ', 16], ['R', 90]],
  };
}

/** TRAP melting-key: the ice key melts after a few seconds – run straight to the padlock that lowers the bridge. */
function meltingKey(b) {
  b.ground(0, 9);
  const key = keyAt(b, 2, 14, 'ice', { melt: 135 });
  b.put(6, 14, '^');
  spikePit(b, 10, 11);
  b.ground(12, 15);
  const bridge = b.group({ tile: '#', hidden: true, ext: { kind: 'bridge' } });
  b.fill(16, 20, 15, 15, bridge);
  spikePit(b, 16, 20);
  const pad = b.group({ tile: '?', ext: { kind: 'lock', key: 'ice', do: [{ show: bridge }] } });
  b.put(15, 14, pad);
  b.ground(21, 23);
  const id = b.troll('The ice key melts', { type: 'melting-key', hint: 'The ice key melts a few seconds after you take it – run straight to the padlock at the wide pit without stopping: it lowers the bridge as you pass.', hazards: [[16, 16, 5, 1]] });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 6 * T - 16), ['RJ', 6], land, run(X + 10 * T - 12), ['RJ', 10], land, run(X + 23 * T)],
    die: [run(X + 3 * T), wait(150), run(X + 6 * T - 16), ['RJ', 6], land, run(X + 10 * T - 12), ['RJ', 10], land, ['R', 120]],
  };
}

/** TRAP fishing-key: the key hangs on a fishing line and is yanked away from you – corner it against the post. */
function fishingKey(b) {
  b.ground(0, 10);
  const post = b.group({ tile: '#', ext: { kind: 'lock', key: 'gold' } });
  b.fill(3, 3, 13, 14, post);
  const key = keyAt(b, 7, 14, 'gold', { fish: true });
  b.fill(6, 8, 11, 11, '#');
  const bridge = b.group({ tile: '#', hidden: true, ext: { kind: 'bridge' } });
  b.fill(11, 15, 15, 15, bridge);
  b.groups[post].ext.do = [{ show: bridge }];
  spikePit(b, 11, 15);
  b.ground(16, 21);
  const id = b.troll('The key is yanked away on a fishing line', { type: 'fishing-key', hint: 'The key hangs on a fishing line and is yanked away from you – from the left it flees over the pit. Go over it on the ledge, drop down on its right and chase it back into the corner at the post.', hazards: [[11, 16, 5, 1]] });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 22,
    win: [
      run(X + 1.5 * T), ['RJ', `s.x >= ${X + 3 * T - 8}`], ['J', 's.grounded'], ['', 4], ['RJ', 20], land,
      run(X + 9 * T - 10), ['', 's.vx < 5'], ...Array.from({ length: 8 }, () => [['R', 2], ['', 3]]).flat(), ['', 's.grounded'], ['L', 's.ext.l14.keys.length > 0'], ['L', `s.g.${bridge}[2] === 1`], run(X + 21 * T),
    ],
    die: [run(X + 3 * T - 18), J(16), land, ['R', 's.grounded'], run(X + 11 * T - 12), ['RJ', 14], ['R', 90]],
  };
}

/** TRAP key-juggle: you carry one key – the silver key on the grate makes you drop the gold one through the grate. */
function keyJuggle(b) {
  b.ground(0, 4);
  keyAt(b, 2, 14, 'gold');
  const grate = b.group({ tile: '#', ext: { kind: 'grate' } });
  b.fill(5, 10, 15, 15, grate);
  spikePit(b, 5, 10);
  const silver = keyAt(b, 8, 14, 'silver');
  b.ground(11, 13);
  spikePit(b, 14, 15);
  wallGate(b, 16, 'gold');
  b.ground(17, 25);
  b.fill(19, 19, 15, 15, '.');
  b.put(19, 16, '^');
  gate(b, 22, 11, 14, 'silver');
  const id = b.troll('Taking the silver key drops the gold one', { type: 'key-juggle', hint: 'You carry only one key: taking the silver key on the grate drops your gold key through it. Hop over the silver key, open the gold door first, then come back for the silver one.', hazards: [[5, 16, 6, 1]] });
  b.groupTroll(silver, id);
  b.groupTroll(grate, id);
  const X = b.px(0);
  return {
    w: 26,
    win: [
      run(X + 7 * T - 4), ['RJ', 8], land, run(X + 14 * T - 12), ['RJ', 14], land, run(X + 17 * T + 10),
      runL(X + 17 * T + 16), ['LJ', 14], ['L', 's.grounded'], runL(X + 8 * T + 20), ['L', has('silver')], ['', 6],
      run(X + 14 * T - 12), ['RJ', 14], land, run(X + 25 * T),
    ],
    die: [run(X + 14 * T - 12), ['RJ', 14], ['R', 90]],
  };
}

/** TRAP magpie-key: the magpie steals the key when you jump with it – let it, follow it to its nest, then jump. */
function magpieKey(b) {
  b.ground(0, 9);
  b.fill(1, 2, 13, 14, '#');
  const nest = b.group({ tile: '?', hidden: true, ext: { kind: 'key', key: 'gold' } });
  b.put(1, 12, nest);
  const key = keyAt(b, 5, 14, 'gold');
  const bird = b.group({ tile: '?', ext: { kind: 'magpie', steal: 'gold', nest, zone: [b.x0, b.x0 + 13] } });
  b.put(7, 9, bird);
  spikePit(b, 10, 11);
  wallGate(b, 12, 'gold');
  b.ground(13, 21);
  const id = b.troll('A magpie steals the key when you jump', { type: 'magpie-key', hint: 'The magpie steals the key the moment you jump with it. Let it: hop once on the safe ground, follow it to its nest on the block, take the key back, then jump to the door.', hazards: [[10, 16, 3, 1]] });
  b.groupTroll(bird, id);
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 22,
    win: [
      run(X + 1 * T - 14), J(16), land, run(X + 6 * T), ['', 's.vx < 20'], ['J', 10], ['', 's.grounded'], ['', 's.ext.l14.bird === "nest"'],
      runL(X + 3 * T + 30), ['LJ', 16], ['L', has('gold')], ['', 's.grounded'], run(X + 10 * T - 12), ['RJ', 16], land, run(X + 21 * T),
    ],
    die: [run(X + 1 * T - 14), J(16), land, run(X + 10 * T - 12), ['RJ', 16], ['R', 90]],
  };
}

/** TRAP rusty-lock: the rusty lock takes long to turn – a spiked ball rolls up behind you meanwhile: jump it. */
function rustyLock(b) {
  b.ground(0, 19);
  const ball = b.group({ tile: '*', hidden: true, ext: { kind: 'roller' } });
  b.put(3, 14, ball);
  keyAt(b, 6, 14, 'gold');
  b.fill(15, 15, 6, 10, '#');
  const lock = gate(b, 15, 11, 14, 'gold', { mode: 'rusty', need: 150, start: [{ chase: ball, vel: [3.5, 0], untilX: 11 }] });
  const id = b.troll('A ball rolls up while the rusty lock turns', { type: 'rusty-lock', hint: 'The rusty lock needs you to stay at it for a few seconds, and a spiked ball rolls up behind you meanwhile – jump straight up when it comes, then stay at the lock.' });
  b.groupTroll(lock, id);
  b.groupTroll(ball, id);
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 15 * T - 14), ['R', `s.g.${ball}[0] >= ${11 * T - 110}`], ['RJ', 20], ['R', `s.g.${lock}[2] === 0`], run(X + 19 * T)],
    die: [run(X + 15 * T - 14), ['R', 300]],
  };
}

/** TRAP alarm-key: taking the key sets off the alarm – the bars over the way back crash down. Out through the roof. */
function alarmKey(b) {
  b.ground(0, 23);
  b.put(1, 14, '#');
  // the vault: roof on row 12 (a hole at 10-11), its back wall at 12, a pedestal at 10
  b.fill(3, 9, 12, 12, '#');
  b.fill(12, 14, 12, 12, '#');
  b.fill(12, 12, 13, 14, '#');
  b.put(10, 14, '#');
  b.put(16, 14, '#');
  const bars = b.group({ tile: '#', ext: { kind: 'bars' } });
  b.put(3, 13, bars);
  keyAt(b, 10, 13, 'gold');
  gate(b, 19, 11, 14, 'gold');
  const id = b.troll('Taking the key drops the bars', { type: 'alarm-key', hint: 'Taking the key sets off the alarm: the bars over the doorway crash down when you go back out. Jump up through the hole in the roof instead.' });
  b.trigger({ when: { zone: b.rect(3, 13, 1, 2), ext: { kind: 'has', key: 'gold' } }, do: [{ move: bars, by: [0, 1], ticks: 4, deadly: true }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 1 * T - 14), J(8), land, run(X + 10 * T - 14), ['RJ', 4], land, ['', 6], ['RJ', 20], land, run(X + 23 * T)],
    die: [run(X + 1 * T - 14), J(8), land, run(X + 10 * T - 14), ['RJ', 4], land, ['', 6], ['L', 200]],
  };
}

/** TRAP jingle-keys: running with a key makes it jingle – the jingle wakes the bat: walk slowly under it. */
function jingleKeys(b) {
  b.ground(0, 23);
  keyAt(b, 2, 14, 'gold');
  b.fill(9, 15, 7, 8, '#');
  const bat = b.group({ tile: '?', ext: { kind: 'bat', zone: [b.x0 + 6, b.x0 + 18] } });
  b.put(12, 9, bat);
  gate(b, 21, 11, 14, 'gold');
  const id = b.troll('The jingling key wakes the bat', { type: 'jingle-keys', hint: 'The key jingles when you run with it, and the jingle wakes the spiked bat under the rock – walk slowly (tap the arrow) until you are past it.', hazards: [[6, 9, 13, 6]] });
  b.groupTroll(bat, id);
  const X = b.px(0);
  const tiptoe = Array.from({ length: 50 }, () => [['R', 4], ['', 3]]).flat();
  return {
    w: 24,
    win: [run(X + 4 * T), ['', 's.vx < 5'], ...tiptoe, ['R', `s.x >= ${X + 19 * T}`], run(X + 23 * T)],
    die: [run(X + 12 * T), ['R', 90]],
  };
}

/** TRAP chameleon-key: the key keeps changing colour – it only opens the gold door while it is gold. */
function chameleonKey(b) {
  b.ground(0, 6);
  const key = keyAt(b, 2, 14, 'gold', { cycle: ['gold', 'silver', 'ruby'], period: 40 });
  spikePit(b, 7, 8);
  wallGate(b, 9, 'gold');
  b.ground(10, 19);
  const id = b.troll('The key keeps changing colour', { type: 'chameleon-key', hint: 'The key keeps changing colour, and the gold door only opens while it is gold – wait at the edge until it turns gold, then jump at once.', hazards: [[7, 16, 3, 1]] });
  b.groupTroll(key, id);
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 7 * T - 16), ['', 's.vx < 5'], ['', 's.ext.l14.keys[0] === "ruby"'], ['', 's.ext.l14.keys[0] === "gold"'], ['RJ', 20], land, run(X + 19 * T)],
    die: [run(X + 7 * T - 16), ['', 's.vx < 5'], ['', 's.ext.l14.keys[0] === "gold"'], ['', 's.ext.l14.keys[0] === "silver"'], ['RJ', 20], ['R', 90]],
  };
}

void none;

export default {
  id: 14,
  slug: 'lock-and-key',
  name: 'Lock and Key',
  idea: 'Keys and locks betray you',
  winMessage: 'Unlocked at last!',
  deathQuips: ['Wrong key, wrong life.', 'Locked out of living.', 'Key-rect? Not quite.', 'That lock had other plans.', 'You turned the wrong corner.'],
  handmade: true,
  minWidth: 703,
  traps: [keyPlank, ironKey, skeletonKey, glassKey, hungryLock, chainedKey, meltingKey, fishingKey, keyJuggle, magpieKey, rustyLock, alarmKey, jingleKeys, chameleonKey],
  between: [
    [up(1, 3), spikes(4, 2), isle(2, 2, 1), pit(3, 3, -1), down(1, 2), thorns(2, 2)],
    [spikes(4, 2), up(2, 2), pit(3, 2, -1), thorns(2, 2), down(1, 2), isle(3, 2), block(2, 1, 3)],
    [isle(3, 2), isle(3, 2, 1), pit(4, 3, -1), roof(3), thorns(1, 2), pit(2, 3)],
    [thorns(1, 1), up(2, 2), isle(4, 2, -1), spikes(3, 3, -1), roof(2), pit(3, 2), block(1, 1, 2)],
    [thorns(2, 3), pit(3, 2, 1), isle(3, 2, -1), spikes(4, 3)],
    [block(2, 2, 2), up(2, 3), pit(3, 2, -2), isle(4, 2), spikes(2, 2)],
    [pit(4, 2), up(1, 2), roof(4), pit(3, 2, -1), thorns(3, 2)],
    [up(1, 2), isle(3, 2, 1), roof(3), isle(3, 2, -2), spikes(3, 3), block(1, 2, 2)],
    [up(2, 2), spikes(3, 2, -2), pillars(3, 2, [0, 1, -1])],
    [thorns(1, 2), pit(4, 2), block(2, 1, 3), isle(3, 3, 1), down(1, 2), pit(3, 3)],
    [isle(3, 2, 1), spikes(3, 2, 1), pit(3, 2, -1), down(1, 3), roof(3)],
    [block(1, 1, 2), pit(4, 2), up(2, 2), isle(3, 2, -1), down(1, 1), spikes(4, 3), thorns(1, 2)],
    [block(2, 1, 2), pit(3, 3, 1), down(1, 2), isle(4, 2), isle(2, 2, 1), down(1, 3)],
    [roof(2), pit(3, 2), spikes(3, 2, 1), thorns(1, 2), down(1, 2), pit(4, 3)],
    [roof(3), isle(4, 2), up(2, 2), thorns(2, 3), pit(3, 2, -2), flat(2)],
  ],
};
