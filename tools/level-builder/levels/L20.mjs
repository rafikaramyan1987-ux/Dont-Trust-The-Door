// LEVEL 20 – "Follow the Signs": signs, arrows and a "helpful" little guide lie to you. The finale of the first 20
// levels. Signs are pictograms only (arrows, warning triangles, a hand, numbers, a party popper) – no words.
// Mechanics (src/game/ext/l20.ts): pictogram signs that spin, topple, tip, fly and follow you; the guide who walks
// ahead, points, waves, digs and shoves; a checkpoint flag that is not one; a countdown board; party guests.
// Between the traps: hand-written platforming courses.
import { T, run, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

/** a pictogram sign on a '?' tile (only drawn), standing on the floor below row y1 */
const sign = (b, x, y0, y1, pic, ext = {}, tile = '?') => {
  const g = b.group({ tile, ext: { kind: 'l20sign', pic, ...ext } });
  b.fill(x, x, y0, y1, g);
  return g;
};
/** the little guide (a '?' tile: you walk through him; '#' – you can stand on him) */
const guide = (b, x, y, ext = {}, tile = '?') => {
  const g = b.group({ tile, ext: { kind: 'l20guide', ...ext } });
  b.put(x, y, g);
  return g;
};
/** a spike pit floor (spikes on row 16 over solid row 17) */
const spikePit = (b, x0, x1) => b.fill(x0, x1, 17, 17, '^');

/** TRAP arrow-shaft: the arrow points down into the shaft – the signpost itself is the step up to the high wall. */
function arrowShaft(b) {
  b.ground(0, 7);
  sign(b, 7, 13, 14, 'down', { post: 40 }, '#');
  b.fill(10, 13, 11, 17, '#');
  b.ground(14, 17);
  const id = b.troll('The arrow points into the shaft', { type: 'arrow-shaft', hint: 'The arrow points down the shaft, which has no bottom – hop up onto the signpost itself and jump from it onto the high wall.' });
  b.trigger({ when: { zone: b.rect(8, 15, 2, 3) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 6 * T - 24), ['RJ', 12], ['R', `s.x >= ${X + 7 * T}`], ['', 's.grounded'], wait(4), ['RJ', 18], ['R', 's.grounded'], run(X + 17 * T)],
    die: [run(X + 6 * T - 30), ['RJ', 16], ['R', 90]],
  };
}

/** TRAP early-jump-mark: the painted jump mark is two tiles before the edge – jump from the edge itself. */
function earlyJumpMark(b) {
  b.ground(0, 7);
  sign(b, 5, 14, 14, 'jump', { post: 50 });
  const mark = b.group({ tile: '?', ext: { kind: 'l20mark', pic: 'jump', decal: true }, cover: [b.tile(5, 15)] });
  spikePit(b, 8, 11);
  b.ground(12, 15);
  const id = b.troll('The jump mark is two tiles early', { type: 'early-jump-mark', hint: 'The painted jump mark is two tiles too early – run past it and jump from the very edge of the pit.', hazards: [[8, 16, 4, 1]] });
  b.groupTroll(mark, id);
  b.trigger({ when: { zone: b.rect(8, 13, 4, 3) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 8 * T - 12), ['RJ', 22], land, run(X + 15 * T)],
    die: [run(X + 5 * T + 20), ['RJ', 22], ['R', 90]],
  };
}

/** TRAP spinning-signpost: the fingerpost whirls round when you come near and its arm swats you. */
function spinningSignpost(b) {
  b.ground(0, 17);
  const g = sign(b, 10, 13, 14, 'right', { arm: true, post: 80 });
  const id = b.troll('The signpost spins round and swats you', { type: 'spinning-signpost', hint: 'The fingerpost creaks and spins round when you come near, and its arm swats everything close to it – stop, let it spin until it points back, then walk on.' });
  const go = b.uid('spin');
  b.trigger({ id: go, when: { zone: b.rect(6, 12, 1, 3) }, do: [{ shake: 3, ticks: 18 }], troll: id });
  b.trigger({ when: { after: go }, delay: 16, do: [{ ext: 'l20.spin', g, args: { turns: 1.5, ticks: 110 } }] });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 6 * T - 12), ['', `s.ext.l20.spin_${g} === 1`], run(X + 17 * T)],
    die: [run(X + 17 * T)],
  };
}

/** TRAP guide-air-bridge: the guide strolls across the pit on a bridge that only holds him – take the blocks above. */
function guideAirBridge(b) {
  b.ground(0, 5);
  const g = guide(b, 5, 14, { pose: 'point', face: -1 });
  b.fill(7, 8, 13, 13, '#');
  b.fill(11, 12, 12, 12, '#');
  b.ground(14, 21);
  const id = b.troll('The guide walks on a bridge only he can use', { type: 'guide-air-bridge', hint: 'The guide strolls across the pit on an invisible bridge that only holds him – do not follow him: hop over on the two floating blocks.' });
  const go = b.uid('stroll');
  b.trigger({ id: go, when: { zone: b.rect(1, 12, 1, 3) }, do: [{ move: g, by: [10, 0], ticks: 150 }], troll: id });
  b.trigger({ when: { after: go }, delay: 152, do: [{ ext: 'l20.pose', g, args: { pose: 'wave' } }] });
  b.trigger({ when: { zone: b.rect(6, 15, 8, 3) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 6 * T - 16), ['RJ', 9], land, run(X + 9 * T - 16), ['RJ', 8], land, run(X + 13 * T - 16), ['RJ', 4], land, run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP painted-pit: the "hole ahead" sign and the hole are painted on solid floor – jumping it hits the spiked roof. */
function paintedPit(b) {
  b.ground(0, 19);
  sign(b, 3, 14, 14, 'hole', { post: 40 });
  const hole = b.group({ tile: '?', ext: { kind: 'l20mark', pic: 'hole', decal: true }, cover: b.range(8, 10, 15, 17) });
  b.fill(6, 13, 0, 11, '#');
  b.fill(6, 13, 12, 12, 'v');
  const id = b.troll('The hole is painted on the floor', { type: 'painted-pit', hint: 'The hole under the spiked roof is only painted on the floor – do not jump it: just walk straight across.' });
  b.groupTroll(hole, id);
  b.trigger({ when: { zone: b.rect(6, 12, 8, 2), airborne: true }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 19 * T)],
    die: [run(X + 8 * T - 16), ['RJ', 12], ['R', 60]],
  };
}

/** TRAP toppling-sign: the "falling rocks" sign is the thing that falls – it topples toward you. */
function topplingSign(b) {
  b.ground(0, 21);
  const g = sign(b, 14, 11, 14, 'rocks', { post: 120 });
  const id = b.troll('The falling-rocks sign falls on you', { type: 'toppling-sign', hint: 'The tall "falling rocks" sign is what falls: it topples toward you when you come near – stop at once, let it crash down, then walk over it.' });
  const go = b.uid('topple');
  b.trigger({ id: go, when: { zone: b.rect(9, 12, 1, 3) }, do: [{ shake: 3, ticks: 8 }], troll: id });
  b.trigger({ when: { after: go }, delay: 6, do: [{ ext: 'l20.topple', g, args: { ticks: 24 } }] });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 9 * T - 13), ['', `s.ext.l20.topple_${g} === 1`], wait(10), run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP guide-shove: the guide on the ledge shoves you back into the spike pit when you walk up to him. */
function guideShove(b) {
  b.ground(0, 3);
  spikePit(b, 4, 6);
  b.ground(7, 23);
  const g = guide(b, 12, 14, { pose: 'point', face: -1 });
  const id = b.troll('The guide shoves you into the pit', { type: 'guide-shove', hint: 'When you walk up to the guide he shoves you back into the spike pit – jump right over him instead.', hazards: [[4, 16, 3, 1]] });
  b.trigger({ when: { zone: b.rect(10, 13, 2, 2), grounded: true }, do: [{ ext: 'l20.shove', g, args: { vx: -560, vy: -240, lock: 26 } }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 4 * T - 14), ['RJ', 14], land, run(X + 9 * T + 10), ['RJ', 16], land, run(X + 23 * T)],
    die: [run(X + 4 * T - 14), ['RJ', 14], land, run(X + 23 * T)],
  };
}

/** TRAP bridge-out: the "bridge out" sign stands at the good bridge – the next, unmarked one is the one that drops. */
function bridgeOut(b) {
  b.ground(0, 3);
  sign(b, 2, 14, 14, 'bridgeout', { post: 44 });
  b.fill(4, 7, 15, 15, '#');
  b.ground(8, 11);
  const br = b.group({ tile: '#' });
  b.fill(12, 15, 15, 15, br);
  b.ground(16, 25);
  const id = b.troll('The unmarked bridge is the broken one', { type: 'bridge-out', hint: 'The "bridge out" sign stands at the good bridge – the second, unmarked bridge drops as soon as you touch it: jump over it from its very edge.' });
  b.trigger({ when: { touch: br }, do: [{ fall: br, shake: 8 }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 12 * T - 14), ['RJ', 22], land, run(X + 25 * T)],
    die: [run(X + 25 * T)],
  };
}

/** TRAP honest-stop-sign: for once a sign tells the truth – cross the line without stopping and the camera fires. */
function honestStopSign(b) {
  b.ground(0, 21);
  sign(b, 8, 14, 14, 'stop', { post: 48 });
  sign(b, 9, 13, 13, 'camera');
  b.group({ tile: '?', ext: { kind: 'l20mark', pic: 'line', decal: true }, cover: [b.tile(9, 15)] });
  b.fill(10, 14, 0, 13, '#');
  const sp = b.group({ tile: '^', hidden: true });
  b.fill(10, 14, 14, 14, sp);
  const id = b.troll('This sign tells the truth', { type: 'honest-stop-sign', hint: 'This one sign tells the truth: come to a full stop at the hand sign before the tunnel, then go – drive through without stopping and the camera fires the spikes.' });
  const stopZone = b.rect(6, 13, 4, 2);
  b.trigger({ when: { zone: b.rect(10, 14, 5, 1), ext: { kind: 'l20unstopped', id: b.uid('stop'), zone: stopZone } }, do: [{ ext: 'l20.flash' }, { pop: sp }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 7 * T + 20), wait(12), run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP tailgating-sign: a "you are here" sign hovers after you – stop on the pillar and you bonk it when you jump. */
function tailgatingSign(b) {
  b.ground(0, 7);
  spikePit(b, 8, 9);
  b.fill(10, 11, 15, 17, '#');
  spikePit(b, 12, 13);
  b.ground(14, 21);
  const g = b.group({ tile: '?', ext: { kind: 'l20tail', min: -2, max: 16 } });
  b.put(2, 12, g);
  const id = b.troll('The sign follows you and blocks your jump', { type: 'tailgating-sign', hint: 'The hovering "you are here" sign follows a moment behind you and blocks any jump from where you stand still – land on the pillar and jump on at once, before it catches up.', hazards: [[8, 16, 2, 1], [12, 16, 2, 1]] });
  b.trigger({ when: { zone: b.rect(3, 12, 1, 3) }, do: [{ ext: 'l20.tail', g }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 8 * T - 14), ['RJ', 8], ['R', 's.grounded'], ['RJ', 14], land, run(X + 21 * T)],
    die: [run(X + 8 * T - 14), ['RJ', 8], ['', 's.grounded'], wait(40), ['RJ', 14], ['R', 90]],
  };
}

/** TRAP fake-checkpoint: the checkpoint flag lights up – and the floor under it drops away. */
function fakeCheckpoint(b) {
  b.ground(0, 6);
  const door = b.group({ tile: '#' });
  b.fill(7, 9, 15, 17, door);
  b.ground(10, 17);
  const f = b.group({ tile: '?', ext: { kind: 'l20flag' } });
  b.put(7, 14, f);
  const id = b.troll('The checkpoint flag is a fake', { type: 'fake-checkpoint', hint: 'That checkpoint flag is a fake: touching it opens the floor under it – jump right over the flag.' });
  b.trigger({ when: { zone: b.rect(7, 12, 1, 3), grounded: true }, do: [{ ext: 'l20.flagOn', g: f }, { fall: door, shake: 4 }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 6 * T - 6), ['RJ', 16], land, run(X + 17 * T)],
    die: [run(X + 17 * T)],
  };
}

/** TRAP roadworks: the guide with the shovel digs a hole right in front of your feet. */
function roadworks(b) {
  b.ground(0, 10);
  sign(b, 5, 14, 14, 'works', { post: 44 });
  const dig = b.group({ tile: '#' });
  b.fill(11, 12, 15, 17, dig);
  b.ground(13, 19);
  const g = guide(b, 10, 14, { pose: 'point', face: -1, tool: 'shovel' });
  const id = b.troll('The guide digs a hole in front of you', { type: 'roadworks', hint: 'The guide at the roadworks digs a hole right in front of you as you pass – jump as soon as you reach him.' });
  b.trigger({ when: { zone: b.rect(10, 12, 1, 3) }, do: [{ hide: dig }, { ext: 'l20.pose', g, args: { pose: 'dig' } }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 10 * T - 30), ['RJ', 16], land, run(X + 19 * T)],
    die: [run(X + 19 * T)],
  };
}

/** TRAP lying-countdown: the countdown says "go" at the tick – but the spikes come out at 2 and stay past 0. */
function lyingCountdown(b) {
  b.ground(0, 25);
  const cd = b.group({ tile: '?', ext: { kind: 'l20count', period: 240, step: 40, post: 40 } });
  b.put(10, 14, cd);
  b.fill(12, 17, 0, 12, '#');
  const sp = b.group({ tile: '^', hidden: true });
  b.fill(12, 17, 14, 14, sp);
  const id = b.troll('The countdown lies', { type: 'lying-countdown', hint: 'The countdown lies: the spikes in the tunnel come out at 2 and stay out until just after it starts again at 5 – run in as soon as they sink, never at the tick.' });
  const a = b.uid('cd');
  const stopAt = b.x0 + 19;
  b.trigger({ id: a, when: { zone: b.rect(2, 12, 1, 3) }, every: 240, stopAt, do: [{ ext: 'l20.sync', g: cd }], troll: id });
  b.trigger({ when: { after: a }, delay: 120, every: 240, stopAt, do: [{ show: sp }] });
  b.trigger({ when: { after: a }, delay: 270, every: 240, stopAt, do: [{ retract: sp }] });
  const X = b.px(0);
  const ph = `s.ext.l20.count_${cd}`;
  return {
    w: 26,
    win: [run(X + 10 * T), ['', `${ph} >= 30 && ${ph} < 40`], run(X + 25 * T)],
    die: [run(X + 10 * T), ['', `${ph} >= 200 && ${ph} < 210`], run(X + 25 * T)],
  };
}

/** TRAP tipping-arrow: the arrow plank over the spikes is a seesaw – step past its pivot and it tips you in. */
function tippingArrow(b) {
  b.ground(0, 3);
  const p = b.group({ tile: '#', ext: { kind: 'l20seesaw' } });
  b.fill(4, 8, 15, 15, p);
  spikePit(b, 4, 9);
  b.ground(10, 19);
  const id = b.troll('The arrow plank is a seesaw', { type: 'tipping-arrow', hint: 'The arrow plank is a seesaw: step past its pivot and it tips you into the spikes – jump for the far side before you reach the middle.', hazards: [[4, 16, 6, 1]] });
  b.trigger({ when: { zone: b.rect(6.5, 14, 2.5, 1), grounded: true }, do: [{ ext: 'l20.tip', g: p }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T + 26), ['RJ', 16], land, run(X + 19 * T)],
    die: [run(X + 19 * T)],
  };
}

/** TRAP one-at-a-time: the bridge holds one – the guide steps on with you and it breaks. */
function oneAtATime(b) {
  b.ground(0, 5);
  sign(b, 3, 14, 14, 'one', { post: 46 });
  const br = b.group({ tile: '#' });
  b.fill(6, 15, 15, 16, br);
  b.ground(16, 23);
  const g = guide(b, 5, 14, { pose: 'point', face: -1 });
  const id = b.troll('The bridge holds only one', { type: 'one-at-a-time', hint: 'The bridge holds one at a time and the guide is crossing it slowly – wait until he is off the far end before you step on.' });
  b.trigger({ when: { zone: b.rect(1, 12, 1, 3) }, do: [{ move: g, by: [12, 0], ticks: 260 }], troll: id });
  b.trigger({ when: { zone: b.rect(6, 14, 10, 1), grounded: true, ext: { kind: 'l20guideOn', g, x0: b.x0 + 6, x1: b.x0 + 16 } }, do: [{ fall: br, shake: 6 }, { fall: g, shake: 6 }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 4 * T), ['', `s.g.${g}[0] >= ${11 * T}`], run(X + 23 * T)],
    die: [run(X + 23 * T)],
  };
}

/** TRAP flying-arrow: a gust tears the arrow board off its post and it flies at you at jump height – stay down. */
function flyingArrow(b) {
  b.ground(0, 8);
  b.ground(10, 21);
  sign(b, 2, 14, 14, 'wind', { post: 44 });
  sign(b, 18, 14, 14, 'post', { post: 40 });
  const fl = sign(b, 18, 13, 13, 'flyer');
  const id = b.troll('A gust sends the sign flying at you', { type: 'flying-arrow', hint: 'A gust tears the arrow board off its post and it flies at you at jump height – stand still on the ground until it has passed over you, then jump the gap.' });
  b.trigger({ when: { zone: b.rect(4, 12, 1, 3) }, do: [{ shake: 4, ticks: 20 }, { ext: 'l20.fly', g: fl }, { chase: fl, vel: [-7, 0] }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 4 * T - 12), ['', `s.g.${fl}[0] <= ${-16 * T}`], run(X + 9 * T - 12), ['RJ', 10], land, run(X + 21 * T)],
    die: [run(X + 9 * T - 12), ['RJ', 12], ['R', 60]],
  };
}

/** TRAP hopscotch-marks: the green ticks mark the stepping stones that drop – the red crosses are the safe ones. */
function hopscotchMarks(b) {
  b.ground(0, 2);
  spikePit(b, 3, 15);
  const good = [], bad = [];
  for (const x of [4, 9, 14]) { const g = b.group({ tile: '#', ext: { kind: 'l20mark', pic: 'check' } }); b.put(x, 15, g); bad.push(g); }
  for (const x of [6, 11]) { const g = b.group({ tile: '#', ext: { kind: 'l20mark', pic: 'cross' } }); b.fill(x, x + 1, 15, 15, g); good.push(g); }
  b.ground(16, 19);
  const id = b.troll('The ticks mark the stones that drop', { type: 'hopscotch-marks', hint: 'The stepping stones with green ticks drop the moment you touch them – hop only on the red-cross stones.', hazards: [[3, 16, 13, 1]] });
  for (const g of bad) b.trigger({ when: { touch: g }, do: [{ fall: g, shake: 3 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 3 * T - 14), ['RJ', 12], ['R', 's.grounded'], ['RJ', 14], ['R', 's.grounded'], run(X + 13 * T - 14), ['RJ', 18], ['R', 's.grounded'], run(X + 19 * T)],
    die: [run(X + 3 * T - 14), ['RJ', 6], ['', 's.grounded'], wait(30), ['R', 90]],
  };
}

/** TRAP guide-ride: the guide offers his head as a step – then strolls off into the pit with you on it. */
function guideRide(b) {
  b.ground(0, 2);
  spikePit(b, 3, 5);
  b.ground(6, 9);
  const g = guide(b, 9, 14, { pose: 'wave', face: -1 }, '#');
  b.fill(10, 13, 11, 17, '#');
  b.ground(14, 21);
  const id = b.troll('The guide walks off with you', { type: 'guide-ride', hint: 'The guide lets you stand on his head, then walks off into the spike pit with you – jump from his head onto the wall at once.', hazards: [[3, 16, 3, 1]] });
  const go = b.uid('ride');
  b.trigger({ id: go, when: { zone: b.rect(9, 13, 1, 1), grounded: true }, delay: 14, do: [{ move: g, by: [-4, 0], ticks: 44 }, { ext: 'l20.pose', g, args: { pose: 'laugh' } }], troll: id });
  b.trigger({ when: { after: go }, delay: 58, do: [{ fall: g, shake: 2 }] });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 3 * T - 14), ['RJ', 14], land, run(X + 8 * T), ['RJ', 8], ['R', 's.grounded'], ['RJ', 22], ['R', 's.grounded'], run(X + 21 * T)],
    die: [run(X + 3 * T - 14), ['RJ', 14], land, run(X + 8 * T), ['RJ', 8], ['R', 's.grounded'], ['', 200]],
  };
}

/** TRAP detour-sign: the road-closed barrier is cardboard – the detour over it pops spikes. */
function detourSign(b) {
  b.ground(0, 25);
  sign(b, 6, 14, 14, 'detour', { post: 44 });
  b.fill(8, 9, 13, 13, '#');
  b.fill(11, 17, 11, 11, '#');
  const sp = b.group({ tile: '^', hidden: true });
  b.fill(11, 17, 10, 10, sp);
  const bar = b.group({ tile: '?', ext: { kind: 'l20sign', pic: 'barrier' } });
  b.fill(13, 14, 12, 14, bar);
  const id = b.troll('The detour leads into spikes', { type: 'detour-sign', hint: 'The detour over the top pops spikes – the road-closed barrier is only cardboard: walk straight through it.' });
  b.trigger({ when: { zone: b.rect(11, 9, 7, 2), grounded: true }, do: [{ pop: sp }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 25 * T)],
    die: [run(X + 7 * T - 10), ['RJ', 10], ['R', `s.x >= ${X + 8 * T + 10}`], ['', 's.grounded'], wait(4), ['RJ', 14], ['R', 's.grounded'], ['R', 40]],
  };
}

/** TRAP party-crowd: the party sign says you made it – the party guests hop about in spiked hats. */
function partyCrowd(b) {
  b.ground(0, 25);
  const ps = sign(b, 3, 14, 14, 'party', { post: 46 });
  const hs = [[9, 0], [14, 27], [19, 54]].map(([x, phase]) => {
    const g = b.group({ tile: '?', ext: { kind: 'l20hopper', period: 80, hop: 46, h: 110, phase } });
    b.put(x, 14, g);
    return g;
  });
  const id = b.troll('The party guests wear spiked hats', { type: 'party-crowd', hint: 'You have not made it yet: the hopping party guests wear spiked hats – run under each one while it is up in the air.' });
  for (const g of hs) b.groupTroll(g, id);
  b.trigger({ when: { zone: b.rect(4, 12, 1, 3) }, do: [{ ext: 'l20.party', g: ps }], troll: id });
  const X = b.px(0);
  // each guest is in the air while (levelTick + phase) % 80 < 46: start running under it right after it jumps
  const under = (x, phase) => [run(X + (x - 3) * T), ['', `(s.levelTick + ${phase}) % 80 === 2`], run(X + (x + 2) * T)];
  return {
    w: 26,
    win: [...under(9, 0), ...under(14, 27), ...under(19, 54), run(X + 25 * T)],
    die: [run(X + 25 * T)],
  };
}

export default {
  id: 20,
  slug: 'follow-the-signs',
  name: 'Follow the Signs',
  idea: 'Signs, arrows and a helpful guide lie to you',
  winMessage: 'Never trust a sign!',
  deathQuips: ['The sign said so!', 'Lost in translation.', 'Your guide sends his regards.', 'Should have read the small print.', 'Wrong way, right on time.'],
  handmade: true,
  minWidth: 1624,
  traps: [arrowShaft, earlyJumpMark, spinningSignpost, guideAirBridge, paintedPit, topplingSign, guideShove, bridgeOut, honestStopSign,
    tailgatingSign, fakeCheckpoint, roadworks, lyingCountdown, tippingArrow, oneAtATime, flyingArrow, hopscotchMarks, guideRide, detourSign, partyCrowd],
  between: [
    [flat(2), pit(3, 3), up(2, 2), isle(3, 2, 1), down(3, 4), block(1, 2, 2), pit(4, 3), thorns(2, 2), isle(2, 2, 2), pit(3, 3, -2), roof(3), spikes(2, 3)],
    [spikes(4, 2), up(2, 2), pit(3, 2), isle(4, 2, -1), down(1, 3), pit(3, 2, 1), roof(4), down(1, 2), thorns(3, 2), isle(3, 3, 1), pit(4, 2, -1), flat(2)],
    [flat(1), pit(2, 2, 1), pit(3, 2), pit(3, 2, -1), spikes(3, 3), up(2, 2), roof(3), isle(3, 2, 1), isle(3, 2, -1), down(2, 3), block(1, 3, 2), spikes(4, 2), thorns(1, 2), pit(3, 3)],
    [isle(2, 3, 2), pit(2, 3), down(2, 3), spikes(2, 3), thorns(2, 2), up(1, 2), pillars(2, 1, [1, 1]), pit(2, 2, -2), down(1, 3), pit(4, 3), isle(2, 3, 1), roof(2), pit(3, 2, -1), flat(1)],
    [pit(2, 2), up(2, 3), roof(4), isle(3, 2, -1), pit(2, 2, 2), down(3, 4), spikes(3, 2), pit(4, 2), block(1, 1, 3), isle(4, 3), up(1, 2), down(1, 2), spikes(2, 2)],
    [spikes(3, 3), isle(3, 3, 1), isle(2, 2, 1), isle(3, 2, -2), pit(4, 3), up(2, 2), roof(3), pit(3, 3, -2), block(2, 1, 3), spikes(4, 3), flat(1)],
    [pit(2, 2), pillars(2, 1, [0, 1, 1]), down(1, 3), spikes(3, 3, -1), up(1, 2), isle(4, 2, -1), block(1, 2, 2), pit(3, 2, 1), roof(3), down(1, 3), pit(4, 3)],
    [isle(3, 2, 1), pit(2, 3, 1), down(1, 3), spikes(4, 3, -1), pit(3, 2, 1), pit(2, 2, -1), roof(4), flat(2), block(2, 2, 3), isle(3, 3, 1), down(1, 3), thorns(2, 2), spikes(3, 2)],
    [up(2, 3), isle(3, 2), pit(4, 3, -2), block(1, 3, 3), pillars(3, 1, [0, 1]), pit(3, 2, -1), thorns(1, 2), up(2, 3), roof(2), pit(3, 2, -2), spikes(3, 3)],
    [pit(3, 3), up(2, 2), down(2, 4), spikes(3, 2), isle(3, 2, 2), isle(3, 2), pit(2, 3, -2), block(2, 1, 2), pit(4, 2), roof(4), isle(3, 3), flat(1)],
    [spikes(2, 3), isle(4, 2, -0), up(1, 3), pit(3, 2, 1), down(2, 3), pillars(3, 1, [1, 1]), pit(2, 3, -2), spikes(2, 4), block(2, 1, 3), pit(3, 3), roof(3)],
    [block(2, 1, 3), pit(4, 2), isle(3, 2, 1), down(1, 3), up(2, 2), pit(3, 2), roof(3), pit(2, 3, -2), thorns(1, 3), isle(4, 2), spikes(2, 2), flat(1)],
    [isle(2, 2, 1), pit(3, 2, 1), pit(4, 3, -2), block(1, 1, 2), spikes(4, 3), up(1, 2), roof(3), isle(3, 2, -1), pillars(3, 1, [0, 0]), pit(2, 3)],
    [pit(3, 2), spikes(3, 2), up(2, 2), isle(4, 2, -1), pit(3, 2, 1), down(2, 4), pit(3, 2), block(1, 2, 3), isle(3, 3, 1), down(1, 2), spikes(3, 2)],
    [up(2, 2), roof(2), pit(3, 3, -1), pillars(2, 1, [1]), pit(2, 2, -1), pit(2, 2, -1), spikes(4, 2), isle(3, 2, 1), down(1, 3), block(1, 3, 2), pit(3, 2), isle(2, 2, 2), pit(4, 2, -2)],
    [thorns(2, 2), pit(4, 2), isle(3, 3, 2), down(2, 3), pillars(3, 1, [1, 0]), pit(3, 2, -1), block(2, 1, 2), up(1, 3), roof(2), pit(3, 2, -1), spikes(3, 4)],
    [spikes(2, 2), up(2, 3), pit(4, 2, -1), isle(2, 2, 2), roof(2), pit(3, 3, -2), block(1, 2, 3), pit(2, 2, 1), down(1, 4), spikes(3, 2), isle(3, 2, -1)],
    [isle(3, 2, 1), down(1, 3), pit(3, 2), isle(3, 2, 1), pit(3, 3, 1), down(2, 3), pillars(2, 1, [1, 0]), down(1, 2), spikes(3, 2), up(2, 2), roof(3), pit(4, 3, -2), flat(1)],
    [isle(3, 3, 1), down(1, 3), spikes(3, 3, 1), pit(3, 3, 2), roof(4), pit(4, 2, -2), block(1, 1, 2), pillars(3, 1, [0, 1]), spikes(3, 2, -1), spikes(3, 3, -1)],
    [up(1, 2), pit(3, 3, 1), isle(4, 2, -2), spikes(3, 2), thorns(3, 2), pit(2, 3, 2), roof(2), pit(4, 3, -2), block(2, 2, 2), isle(3, 2), spikes(4, 2), flat(1)],
    [pit(4, 3), isle(3, 2, 2), pit(3, 3, -2), thorns(2, 2), pillars(2, 1, [1, 1]), pit(3, 2, -2), block(1, 2, 3), pit(4, 2), up(2, 2), roof(3), down(2, 3), flat(2)],
  ],
};
