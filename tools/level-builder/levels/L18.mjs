// LEVEL 18 – "Haunted Halls": a haunted house. Ghosts and possessed things betray you, and most of them care about
// where you LOOK: the hero looks the way he last moved (he keeps looking that way while he stands still).
// Mechanics: src/game/ext/l18.ts. Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

/** a spike pit (spikes on row 16 over a floor on row 17) under local columns x0..x1 */
const spikePit = (b, x0, x1) => {
  for (let x = x0; x <= x1; x++) { b.put(x, 17, '#'); b.put(x, 16, '^'); }
};
/** a deep pit with spikes on its bottom row (local columns x0..x1) */
const deepPit = (b, x0, x1) => { for (let x = x0; x <= x1; x++) b.put(x, 17, '^'); };
/** a cobweb (decoration) hanging at local tile x, y */
const web = (b, x, y) => b.put(x, y, b.group({ tile: '?', ext: { kind: 'cobweb' } }));
/** absolute tile x of a local column */
const ax = (b, x) => b.x0 + x;
/** creep forward: tap RIGHT (never faster than ~180 px/s) until x ≥ px */
const tiptoe = (px, n = 60) => Array.from({ length: n }, () => [['R', `s.vx >= 150 || s.x >= ${px}`], ['', `s.vx <= 0 || s.x >= ${px}`]]).flat();

/** TRAP boo-ghost: a ghost creeps up behind you while you wait at the bars – it only moves while your back is turned. */
function booGhost(b) {
  b.ground(0, 23);
  b.fill(16, 16, 0, 11, '#');
  const bars = b.group({ tile: '#', look: 'bolted' });
  b.fill(16, 16, 12, 14, bars);
  const ghost = b.group({ tile: '?', hidden: true, ext: { kind: 'ghost', mode: 'boo', speed: 3, until: ax(b, 17) } });
  b.put(1, 13, ghost);
  const id = b.troll('A ghost creeps up behind you', { type: 'boo-ghost', hint: 'A ghost creeps up behind you while you wait for the bars to open – it only moves while your back is turned: face it and wait, then run on when the bars are up.' });
  b.groupTroll(ghost, id);
  b.trigger({ when: { zone: b.rect(4, 11, 1, 4) }, do: [{ ext: 'l18.wake', g: ghost }], troll: id });
  b.trigger({ when: { zone: b.rect(4, 11, 1, 4) }, delay: 230, do: [{ hide: bars }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 15 * T), ['', 6], ['L', 1], ['', `s.g.${bars}[2] === 0`], run(X + 23 * T)],
    die: [run(X + 15 * T), wait(400)],
  };
}

/** TRAP hopping-chair: a possessed chair hops after you and squashes you at the high step – dodge it, then climb on it. */
function hoppingChair(b) {
  b.ground(0, 23);
  b.fill(16, 19, 11, 14, '#');
  web(b, 21, 8);
  const chair = b.group({ tile: '#', ext: { kind: 'chair', wake: ax(b, 6), rest: 46, air: 24, hop: 3, h: 50, min: 0, max: 12 } });
  b.put(3, 14, chair);
  const id = b.troll('A chair hops after you and squashes you', { type: 'hopping-chair', hint: 'The chair hops after you and lands on you at the high step – when it leaps at you, run back under it; it lands by the wall: hop on it and jump up the step.' });
  b.groupTroll(chair, id);
  const X = b.px(0);
  const c = `s.g.${chair}`;
  return {
    w: 24,
    win: [run(X + 3 * T - 30), J(10), land, run(X + 15 * T + 10), ['', `s.ext.chair === 1 && ${c}[0] > ${9 * T}`], ['L', `s.x <= ${X + 12 * T}`], ['', `s.ext.chair === 0`], ['R', `s.x >= ${X + 14 * T}`], ['RJ', 8], ['R', 's.grounded'], ['RJ', 20], ['R', 's.grounded'], run(X + 23 * T)],
    die: [run(X + 3 * T - 30), J(10), land, run(X + 15 * T + 10), wait(700)],
  };
}

/** TRAP gaze-bridge: the ghostly planks over the pit only exist while you face them – a ghost wakes behind you: don't turn. */
function gazeBridge(b) {
  b.ground(0, 5);
  spikePit(b, 6, 17);
  const planks = b.group({ tile: '#', ext: { kind: 'gaze', face: 1 } });
  b.fill(6, 17, 15, 15, planks);
  b.ground(18, 23);
  const ghost = b.group({ tile: '?', hidden: true, ext: { kind: 'ghost', mode: 'boo', speed: 3.2, until: ax(b, 19) } });
  b.put(1, 12, ghost);
  const id = b.troll('The planks vanish when you look back', { type: 'gaze-bridge', hint: 'The ghostly planks only exist while you look at them – a ghost wakes up behind you on the bridge: do not turn round, keep running across.' });
  b.groupTroll(planks, id);
  b.groupTroll(ghost, id);
  b.trigger({ when: { zone: b.rect(8, 11, 1, 4) }, do: [{ ext: 'l18.wake', g: ghost }], troll: id });
  const X = b.px(0);
  return { w: 24, win: [run(X + 23 * T)], die: [run(X + 10 * T), ['L', 2], wait(120)] };
}

/** TRAP haunted-mirror: the mirror shows the true floor – the pit has a hidden bridge, the floor after it is fake. */
function hauntedMirror(b) {
  b.ground(0, 5);
  spikePit(b, 6, 11);
  const hidden = b.group({ tile: '#', invisible: true });
  b.fill(6, 11, 15, 15, hidden);
  b.ground(12, 13);
  spikePit(b, 14, 16);
  const fake = b.group({ tile: '#', fake: true });
  b.fill(14, 16, 15, 15, fake);
  b.ground(17, 25);
  b.group({ tile: '?', cover: b.range(2, 9, 6, 10), ext: { kind: 'mirror', a: ax(b, 4), b: ax(b, 19), r0: 14, r1: 17 } });
  const id = b.troll('The mirror shows the real floor', { type: 'haunted-mirror', hint: 'The haunted mirror shows the real floor: an invisible bridge crosses the pit – walk on – and the floor right after it is fake: jump over that part.' });
  b.groupTroll(hidden, id);
  b.groupTroll(fake, id);
  b.trigger({ when: { zone: b.rect(14, 15, 3, 2) }, do: [], troll: id });
  const X = b.px(0);
  return { w: 26, win: [run(X + 14 * T - 12), J(14), land, run(X + 25 * T)], die: [run(X + 15 * T), wait(80)] };
}

/** TRAP piano-keys: the haunted piano's keys hold you only in the order of its tune (1st, 3rd, 2nd, 4th). */
function pianoKeys(b) {
  b.ground(0, 3);
  spikePit(b, 4, 17);
  const keys = [];
  // tune order of each key, left to right: K1 first, K3 second, K2 third, K4 last
  [[5, 0], [8, 2], [11, 1], [14, 3]].forEach(([x, n]) => {
    const k = b.group({ tile: '#', ext: { kind: 'key', n, piano: 'p' } });
    b.fill(x, x + 1, 15, 15, k);
    keys.push(k);
  });
  b.ground(18, 21);
  const id = b.troll('A wrong piano key drops you', { type: 'piano-keys', hint: 'The piano plays its tune first: step on the keys in the order they light up – the 1st, the 3rd, back to the 2nd, then the 4th. A wrong key drops.' });
  for (const k of keys) b.groupTroll(k, id);
  b.trigger({ when: { zone: b.rect(1, 11, 1, 4) }, do: [{ ext: 'l18.tune' }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [
      run(X + 4 * T - 12), ['RJ', 4], ['R', `s.x >= ${X + 5 * T + 6}`], ['', 's.grounded'], wait(8),
      run(X + 7 * T - 16), ['RJ', 12], ['R', `s.x >= ${X + 10 * T + 30}`], ['', 's.grounded'], wait(8),
      runL(X + 11 * T + 16), ['LJ', 6], ['L', `s.x <= ${X + 9 * T + 20}`], ['', 's.grounded'], wait(8),
      run(X + 10 * T - 16), ['RJ', 12], ['R', `s.x >= ${X + 13 * T + 30}`], ['', 's.grounded'], wait(8),
      run(X + 16 * T - 14), J(12), land, run(X + 21 * T),
    ],
    die: [run(X + 4 * T - 12), ['RJ', 4], ['R', `s.x >= ${X + 5 * T + 6}`], ['', 's.grounded'], wait(8), run(X + 7 * T - 16), ['RJ', 4], ['R', `s.x >= ${X + 8 * T + 10}`], ['', 300]],
  };
}

/** TRAP draft-candles: jumping near the candles blows them out, and the floor under an unlit candle vanishes. */
function draftCandles(b) {
  b.ground(0, 3);
  spikePit(b, 4, 17);
  const candles = b.group({ tile: '#', columns: true, ext: { kind: 'candles' } });
  b.fill(4, 17, 15, 15, candles);
  b.ground(18, 23);
  const web = b.group({ tile: '?', ext: { kind: 'cobweb' } });
  b.put(9, 13, web);
  const id = b.troll('Jumping blows the candles out', { type: 'draft-candles', hint: 'The draft of a jump blows out the candles near you, and the floor under an unlit candle vanishes – walk across, straight through the cobweb: it is harmless.' });
  b.groupTroll(candles, id);
  const X = b.px(0);
  return { w: 24, win: [run(X + 23 * T)], die: [run(X + 7 * T), J(12), ['R', 120]] };
}

/** TRAP mirror-ghost: the ghost behind the doorway copies your moves mirrored – you always meet in the doorway. */
function mirrorGhost(b) {
  b.ground(0, 21);
  b.fill(11, 11, 0, 11, '#');
  const ghost = b.group({ tile: '?', hidden: true, ext: { kind: 'ghost', mode: 'mirror', axis: ax(b, 11.5), min: ax(b, 2), max: ax(b, 21), until: ax(b, 21) } });
  b.put(11, 14, ghost);
  const id = b.troll('A mirror ghost meets you in the doorway', { type: 'mirror-ghost', hint: 'The ghost copies your moves mirrored – you go right, it goes left – so you always meet in the doorway: hop over it right there, low, under the lintel.' });
  b.groupTroll(ghost, id);
  b.trigger({ when: { zone: b.rect(2, 11, 1, 4) }, do: [{ ext: 'l18.wake', g: ghost }], troll: id });
  const X = b.px(0);
  return { w: 22, win: [run(X + 10 * T + 18), ['RJ', 5], ['R', 's.grounded'], run(X + 21 * T)], die: [run(X + 15 * T), wait(30)] };
}

/** TRAP shy-carrier: a ghost carries a plank over the pit and drops it if you look at it while you ride. */
function shyCarrier(b) {
  b.ground(0, 4);
  deepPit(b, 5, 19);
  const plank = b.group({ tile: '#', ext: { kind: 'carrier', range: 12, speed: 1.8, pause: 50 } });
  b.fill(5, 7, 15, 15, plank);
  b.ground(20, 25);
  web(b, 23, 10);
  const id = b.troll('The ghost drops its plank when you look at it', { type: 'shy-carrier', hint: 'The ghost drops its plank the moment you look at it while you ride – jump onto the far end of the plank, past the ghost, so it stays behind your back, and stand still.' });
  b.groupTroll(plank, id);
  b.trigger({ when: { zone: b.rect(5, 15, 15, 2) }, do: [], troll: id });
  const X = b.px(0);
  const p = `s.g.${plank}[0]`;
  const at = [run(X + 4 * T), ['', `${p} > 100`], ['', `${p} === 0`]];
  return {
    w: 26,
    win: [...at, ['RJ', 6], ['R', `s.x >= ${X + 7 * T + 2}`], ['', 's.grounded'], ['', `${p} >= ${12 * T}`], run(X + 25 * T)],
    die: [...at, ['RJ', 2], ['R', `s.x >= ${X + 5 * T + 10}`], ['', 's.grounded'], wait(120)],
  };
}

/** TRAP portrait-gaze: the portrait's eyes follow you and zap you if they see you too long – catch your breath behind
 *  the wardrobes. */
function portraitGaze(b) {
  b.ground(0, 29);
  b.fill(6, 6, 13, 14, '#');
  b.fill(11, 11, 13, 14, '#');
  b.fill(16, 16, 13, 14, '#');
  // the mantelpiece at the end: under it the portrait cannot see you
  b.fill(19, 29, 11, 12, '#');
  b.group({ tile: '?', cover: [6, 11, 16].flatMap((x) => [b.tile(x, 13), b.tile(x, 14)]), ext: { kind: 'wardrobe' } });
  const p = b.group({ tile: '?', ext: { kind: 'portrait', x0: ax(b, 2), x1: ax(b, 19), limit: 50 } });
  b.put(22, 2, p);
  const id = b.troll('The portrait stares you down', { type: 'portrait-gaze', hint: 'The portrait zaps you if it watches you too long – stop in the shadow behind each wardrobe until its stare has cooled down, then go on to the next one.' });
  b.groupTroll(p, id);
  b.trigger({ when: { zone: b.rect(2, 11, 1, 4) }, do: [], troll: id });
  const X = b.px(0);
  const cool = ['', 's.ext.gaze === 0'];
  return {
    w: 30,
    win: [run(X + 6 * T - 16), cool, J(14), land, run(X + 11 * T - 16), cool, J(14), land, run(X + 16 * T - 16), cool, J(14), land, run(X + 29 * T)],
    die: [run(X + 6 * T - 22), J(14), land, run(X + 11 * T - 22), J(14), land, run(X + 16 * T - 22), J(14), land, run(X + 29 * T)],
  };
}

/** TRAP musical-statues: when the music box stops, the ghost opens its eyes and zaps anything that moves. */
function musicalStatues(b) {
  b.ground(0, 6);
  spikePit(b, 7, 9);
  b.ground(10, 15);
  b.put(14, 14, '^');
  b.ground(16, 19);
  spikePit(b, 20, 22);
  b.ground(23, 31);
  const box = b.group({ tile: '?', ext: { kind: 'music', x0: ax(b, 2), x1: ax(b, 29), play: 110, rest: 60, grace: 8, watch: [ax(b, 25), 7] } });
  b.put(1, 14, box);
  const id = b.troll('Freeze when the music stops', { type: 'musical-statues', hint: 'When the music box stops, the ghost opens its eyes and zaps anything that moves – go while it plays, and stand still on the floor whenever it stops.' });
  b.groupTroll(box, id);
  b.trigger({ when: { zone: b.rect(2, 11, 1, 4) }, do: [], troll: id });
  const X = b.px(0);
  const pause = [['', 's.ext.music === 0'], ['', 's.ext.music === 1']];
  return {
    w: 32,
    win: [run(X + 2 * T + 10), run(X + 7 * T - 12), J(14), land, run(X + 12 * T), ...pause, run(X + 14 * T - 20), J(10), land, run(X + 20 * T - 12), J(14), land, run(X + 24 * T), ...pause, run(X + 31 * T)],
    die: [run(X + 7 * T - 12), J(14), land, run(X + 14 * T - 20), J(10), land, run(X + 20 * T - 12), J(14), land, run(X + 31 * T)],
  };
}

/** TRAP beam-lamp: the planks over the pit only exist in the light of a possessed lamp that sweeps to and fro. */
function beamLamp(b) {
  b.ground(0, 4);
  spikePit(b, 5, 18);
  const planks = b.group({ tile: '#', columns: true, ext: { kind: 'beam', a: ax(b, 5), b: ax(b, 18), speed: 2.6, half: 62, lamp: [ax(b, 11), 3] } });
  b.fill(5, 18, 15, 15, planks);
  b.ground(19, 23);
  const id = b.troll('The planks only exist in the lamp light', { type: 'beam-lamp', hint: 'The planks only exist where the swinging lamp shines – wait until the light reaches your side, then walk along with it, never ahead of it, to the far side.' });
  b.groupTroll(planks, id);
  b.trigger({ when: { zone: b.rect(5, 15, 14, 2) }, do: [], troll: id });
  const X = b.px(0);
  const end = X + 17 * T + 30;
  const follow = Array.from({ length: 40 }, () => [['R', `s.x >= s.ext.beam + 6 || s.x >= ${end}`], ['', `s.x < s.ext.beam - 14 || s.x >= ${end}`]]).flat();
  const wait0 = [run(X + 4 * T + 4), ['', `s.ext.beam > ${X + 9 * T}`], ['', `s.ext.beam <= ${X + 5 * T + 24}`]];
  return {
    w: 24,
    win: [...wait0, ['', `s.ext.beam >= ${X + 5 * T + 30}`], ...follow, run(X + 23 * T)],
    die: [...wait0, run(X + 23 * T)],
  };
}

/** TRAP shy-furniture: the sideboard slides over to bridge the pit, but only while nobody is looking at it. */
function shyFurniture(b) {
  b.ground(0, 6);
  spikePit(b, 7, 12);
  b.ground(13, 23);
  web(b, 3, 9);
  const sb = b.group({ tile: '#', ext: { kind: 'shy', to: [-7, 1], speed: 3 } });
  b.fill(14, 19, 14, 14, sb);
  const id = b.troll('The furniture only moves when you look away', { type: 'shy-furniture', hint: 'The pit is too wide to jump, but the sideboard moves while nobody looks at it – stand at the edge and turn your back on it: it slides over and bridges the pit.' });
  b.groupTroll(sb, id);
  b.trigger({ when: { zone: b.rect(7, 15, 6, 2) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 6 * T + 10), ['', 8], ['L', 1], ['', `s.g.${sb}[0] <= ${-7 * T}`], run(X + 23 * T)],
    die: [run(X + 7 * T - 14), J(16), ['R', 120]],
  };
}

/** TRAP front-ghost: the ghost over the pit is only solid while its face is in front of you. */
function frontGhost(b) {
  b.ground(0, 4);
  spikePit(b, 5, 11);
  const gh = b.group({ tile: '#', ext: { kind: 'front' } });
  b.fill(7, 10, 15, 15, gh);
  b.ground(12, 21);
  const id = b.troll('The ghost platform vanishes behind you', { type: 'front-ghost', hint: 'The ghost lying over the pit is only solid while its face is in front of you – land on its near half and jump on again at once, before you pass its face.' });
  b.groupTroll(gh, id);
  b.trigger({ when: { zone: b.rect(5, 15, 7, 2) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 5 * T - 14), ['RJ', 6], ['R', 's.grounded'], ['RJ', 18], land, run(X + 21 * T)],
    die: [run(X + 5 * T - 14), ['RJ', 6], ['R', 's.grounded'], ['R', 90]],
  };
}

/** TRAP look-back-stairs: the ghostly stairs up only exist while you look back the way you came. */
function lookBackStairs(b) {
  b.ground(0, 13);
  spikePit(b, 14, 17);
  b.fill(18, 23, 5, 17, '#');
  b.fill(7, 17, 5, 5, '#');
  b.fill(2, 3, 7, 7, '#');
  const steps = b.group({ tile: '#', ext: { kind: 'gaze', face: -1 } });
  b.fill(11, 12, 13, 13, steps);
  b.fill(8, 9, 11, 11, steps);
  b.fill(5, 6, 9, 9, steps);
  b.ground(24, 27);
  const id = b.troll('The stairs only appear when you look back', { type: 'look-back-stairs', hint: 'There is no way over the high wall, but ghostly stairs appear while you look back the way you came – turn round at the pit and climb them to the left, then take the high beam.' });
  b.groupTroll(steps, id);
  b.trigger({ when: { zone: b.rect(14, 15, 4, 2) }, do: [], troll: id });
  const X = b.px(0);
  const hopL = (from, to) => [runL(X + from), ['LJ', 14], ['L', `s.x <= ${X + to}`], ['', 's.grounded'], wait(4)];
  return {
    w: 28,
    win: [run(X + 13 * T + 10), wait(8), ['L', 1], wait(4), ['LJ', 14], ['L', `s.x <= ${X + 12 * T + 20}`], ['', 's.grounded'], wait(4),
      ...hopL(11 * T + 14, 9 * T + 20), ...hopL(8 * T + 14, 6 * T + 20), ...hopL(5 * T + 14, 3 * T + 20),
      ['R', `s.x >= ${X + 3 * T + 20}`], ['RJ', 18], ['R', 's.grounded'], run(X + 24 * T + 14), ["", "s.grounded"], run(X + 27 * T)],
    die: [run(X + 14 * T - 14), J(16), ['R', 120]],
  };
}

/** TRAP slam-door: the possessed doors slam shut on anyone who runs through them – tiptoe. */
function slamDoor(b) {
  b.ground(0, 23);
  b.put(12, 14, '^');
  const doors = [];
  for (const x of [8, 17]) {
    b.fill(x, x, 0, 10, '#');
    const d = b.group({ tile: '#', ext: { kind: 'slamdoor' } });
    b.fill(x, x, 11, 12, d);
    doors.push([x, d]);
  }
  web(b, 21, 9);
  const id = b.troll('The doors slam on anyone who runs', { type: 'slam-door', hint: 'The possessed doors slam shut on anyone who runs through them – stop before each doorway and tiptoe through it with short taps of RIGHT.' });
  for (const [x, d] of doors) b.trigger({ when: { zone: b.rect(x, 13, 1, 2), ext: { kind: 'fast', v: 200 } }, do: [{ move: d, by: [0, 2], ticks: 4, deadly: true, returnAfter: 90, returnTicks: 30 }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 6 * T), wait(10), ...tiptoe(X + 10 * T), run(X + 11 * T - 14), ['RJ', 8], ['R', `s.x >= ${X + 13 * T + 10}`], ['', 's.grounded'], wait(10), ...tiptoe(X + 19 * T), run(X + 23 * T)],
    die: [run(X + 12 * T)],
  };
}

/** TRAP magic-rug: the flying carpet only flies while you stand still on it – walk on it and it sinks into the spikes. */
function magicRug(b) {
  b.ground(0, 4);
  deepPit(b, 5, 20);
  const rug = b.group({ tile: '#', ext: { kind: 'rug', range: 13, speed: 2.4, sink: 3, maxSink: 3 } });
  b.fill(5, 7, 15, 15, rug);
  b.ground(21, 25);
  const id = b.troll('The flying carpet sinks when you walk on it', { type: 'magic-rug', hint: 'The flying carpet only flies while you stand still on it; walk on it and it sinks into the spikes – hop on, let go of the keys and ride it to the far side.' });
  b.groupTroll(rug, id);
  b.trigger({ when: { zone: b.rect(5, 15, 16, 2) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 4 * T + 10), ['', 8], ['RJ', 3], ['R', `s.x >= ${X + 5 * T + 4}`], ['', 's.grounded'], ['', `s.g.${rug}[0] >= ${13 * T}`], run(X + 25 * T)],
    die: [run(X + 9 * T), wait(120)],
  };
}

/** TRAP boo-lift: the ghost pulls the lift up only while your back is turned to it – into the ceiling spikes. */
function booLift(b) {
  b.ground(0, 9);
  b.fill(8, 9, 0, 1, '#');
  b.fill(8, 9, 2, 2, 'v');
  b.fill(10, 17, 7, 17, '#');
  b.fill(10, 17, 0, 1, '#');
  b.ground(18, 23);
  const lift = b.group({ tile: '#', ext: { kind: 'lift', rise: 12, speed: 2, back: 3, ghost: [ax(b, 13), 6] } });
  b.fill(8, 9, 14, 14, lift);
  const id = b.troll('The lift rises while your back is turned', { type: 'boo-lift', hint: 'The ghost only pulls the lift up while your back is turned to it, all the way into the spikes – turn away to go up, and look at the ghost to stop at the ledge.' });
  b.groupTroll(lift, id);
  b.trigger({ when: { zone: b.rect(8, 2, 2, 2) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 7 * T - 20), ['RJ', 6], ['R', `s.x >= ${X + 8 * T + 24}`], ['', 's.grounded'], wait(10), ['L', 1], ['', `s.g.${lift}[1] <= ${-7 * T - 30}`], run(X + 23 * T)],
    die: [run(X + 7 * T - 20), ['RJ', 6], ['R', `s.x >= ${X + 8 * T + 24}`], ['', 's.grounded'], wait(10), ['L', 1], wait(400)],
  };
}

/** TRAP behind-exit (the end): the EXIT bites from the front – only from behind is it real. */
function behindExit(b) {
  b.ground(0, 15);
  b.doorAt(8, 14);
  const g = b.group({ tile: '?', cover: [b.tile(8, 14), b.tile(8, 13)], ext: { kind: 'exitghost' } });
  const id = b.troll('The EXIT is only real from behind', { type: 'behind-exit', hint: 'The haunted EXIT bites anyone who walks in from the front – jump over it and walk into it from behind.' });
  b.groupTroll(g, id);
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 6 * T), J(16), ['R', `s.x >= ${X + 11 * T}`], ['', 's.grounded'], ['L', 's.state!=="play"']],
    die: [run(X + 12 * T)],
  };
}

export default {
  id: 18,
  slug: 'haunted-halls',
  name: 'Haunted Halls',
  idea: 'Ghosts and possessed things betray you',
  winMessage: 'You escaped the haunted house!',
  deathQuips: ['Boo! Got you.', 'Now you are a ghost too.', 'The house says thanks for staying.', 'Spooky, and a bit sad.', 'Even the chairs are laughing.'],
  handmade: true,
  minWidth: 1228,
  traps: [booGhost, hoppingChair, gazeBridge, hauntedMirror, pianoKeys, draftCandles, mirrorGhost, shyCarrier, portraitGaze, musicalStatues, beamLamp, shyFurniture, frontGhost, lookBackStairs, slamDoor, magicRug, booLift],
  endSeg: behindExit,
  between: [
    [flat(4), pit(3, 2), up(2, 3), spikes(3, 2, 1), isle(3, 2, -1), down(2, 3), thorns(2, 1), pit(4, 2), block(2, 1, 2), spikes(3, 2)],
    [thorns(1, 3), up(1, 2), pit(4, 2), isle(3, 3, 1), spikes(2, 2, -2), roof(3), flat(1), pit(3, 2), block(1, 2, 2), thorns(3, 2)],
    [pillars(2, 1, [1, 1, 1]), spikes(3, 2, -1), down(2, 3), isle(4, 1), isle(3, 2, 1), down(1, 2), thorns(2, 2), roof(2), flat(1), pit(3, 2)],
    [spikes(4, 2), up(2, 2), isle(2, 1, 1), isle(3, 2, -1), pit(2, 3, 1), down(3, 4), block(2, 2, 2), spikes(2, 2), roof(1), flat(1), pit(3, 1)],
    [up(1, 3), roof(2), flat(1), pit(3, 2, 1), spikes(4, 3, -2), isle(3, 1), isle(3, 1), isle(2, 3, 1), down(1, 2), thorns(2, 2), block(1, 1, 2)],
    [pit(4, 1), pit(3, 2, 2), down(2, 3), spikes(3, 1), spikes(3, 2), up(3, 2), down(3, 4), isle(4, 2), thorns(2, 2), roof(2)],
    [block(2, 1, 2), pit(4, 2), up(1, 1), pit(3, 2, -1), isle(2, 2, 2), isle(3, 2, 1), spikes(3, 2, -3), thorns(2, 1), pit(4, 2), roof(2)],
    [isle(3, 2), up(2, 3), roof(2), flat(1), spikes(2, 2, 1), down(3, 4), pit(4, 2), block(1, 2, 2), spikes(4, 2), isle(3, 1, 1), down(1, 2)],
    [thorns(3, 2), pit(3, 2, 1), pit(2, 2, 1), spikes(3, 2, -2), isle(4, 1), pit(3, 2), up(1, 2), roof(2), down(1, 2), pit(4, 2)],
    [pillars(3, 2, [0, 1, -1]), spikes(2, 3), isle(3, 2, 2), isle(4, 2, -1), down(1, 2), roof(3), flat(1), block(1, 1, 2), pit(3, 2)],
    [up(3, 2), spikes(3, 3, -1), pit(4, 1), down(2, 3), isle(2, 1, 2), isle(3, 3, -2), thorns(1, 2), block(2, 1, 2), pit(3, 2), roof(1), flat(1), thorns(2, 1)],
    [isle(4, 2), isle(4, 2), up(1, 3), pit(2, 2, 1), down(2, 3), spikes(3, 2), roof(2), flat(1), pit(3, 2, 1), down(1, 2), thorns(1, 2)],
    [spikes(3, 1, 2), spikes(2, 2, -2), pit(4, 2), block(1, 1, 2), thorns(2, 2), isle(3, 2, 1), isle(3, 2, 1), down(2, 3), roof(1), flat(1), pit(3, 2)],
    [thorns(2, 2), up(2, 1), pit(3, 1, 1), spikes(4, 3, -1), isle(3, 2, -2), pit(4, 3), roof(3), flat(1), spikes(2, 1), block(2, 2, 3)],
    [pit(3, 2, 1), roof(2), down(1, 2), isle(4, 1), isle(3, 2, 2), spikes(3, 2, -2), pillars(2, 2, [1, 1, -2]), spikes(2, 3)],
    [thorns(1, 2), spikes(4, 3), up(1, 2), isle(3, 2), pit(4, 2, -1), roof(2), flat(1), thorns(2, 1), pit(2, 2, 2), down(2, 3), pit(3, 1)],
    [isle(2, 2, 1), spikes(3, 2), isle(4, 2, -1), roof(2), flat(1), pit(3, 2, 2), spikes(2, 2, -2), block(2, 1, 3), thorns(2, 1), pit(4, 2)],
    [up(1, 2), spikes(4, 2), pit(3, 3, 1), down(2, 3), roof(3), flat(1), isle(4, 2), thorns(3, 2), pit(3, 1, 1), down(1, 2), block(1, 1, 2)],
  ],
};
