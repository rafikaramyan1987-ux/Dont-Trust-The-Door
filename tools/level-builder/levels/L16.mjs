// LEVEL 16 – "Size Matters": the hero shrinks and grows in a giant garden. Red mushrooms make you one size bigger,
// blue ones one size smaller; flower arches set your size (the white one makes you normal again). Tiny you
// (half height) fits through half-height slots but jumps low, runs slowly and is light (breezes, air vents,
// flytraps); giant you (double size) needs 2-tile gaps, jumps higher, walks over 1-tile holes and is heavy
// (cracked planks, lily pads, springs). Growing without room crushes you. Every respawn makes you normal.
// Between the traps: hand-written platforming courses.
import { T, run, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

const SIZE = (z) => `s.ext.l16size === '${z}'`;

/** a group of '?' tiles handled by the level-16 extension */
const ext = (b, e, extra = {}) => b.group({ tile: '?', ext: e, ...extra });
/** a mushroom: d = +1 (red, grows) or -1 (blue, shrinks); `float` = hanging in the air */
function shroom(b, x, y, d, { float = false, troll } = {}) {
  let g;
  if (troll) g = ext(b, { kind: 'shroom', d, float });
  else {
    const k = `shroom${d}${float ? 'f' : ''}`;
    b.l16 ??= {};
    g = b.l16[k] ??= ext(b, { kind: 'shroom', d, float });
  }
  b.put(x, y, g);
  if (troll) b.groupTroll(g, troll);
  return g;
}
/** the white arch: you come out of it normal size (shared by the whole level) */
function resetArch(b, x, floor = 15, rows = 3) {
  b.l16 ??= {};
  b.l16.arch ??= ext(b, { kind: 'arch', to: 'normal' });
  b.fill(x, x, floor - rows, floor - 1, b.l16.arch);
}
/** a coloured arch that sets your size; `rock`: solid stone over it so you cannot jump past it */
function sizeArch(b, x, e, troll, { rows = 4, rock = true } = {}) {
  const g = ext(b, { kind: 'arch', ...e });
  b.fill(x, x, 15 - rows, 14, g);
  if (rock) b.fill(x - 1, x + 1, 0, 14 - rows, '#');
  if (troll) b.groupTroll(g, troll);
  return g;
}
/** a wall with a half-height slot at its foot (row `row`): only tiny you crawls through */
function slot(b, x0, x1, row = 14, top = 0) {
  b.l16 ??= {};
  b.l16.slab ??= ext(b, { kind: 'slab', y: 0, h: 20 });
  b.fill(x0, x1, top, row - 1, '#');
  b.fill(x0, x1, row, row, b.l16.slab);
}
const crack = (b) => b.group({ tile: '#', look: 'cracked', tint: 0xc89b6d, ext: { kind: 'crack' } });

/** TRAP tunnel-shroom: the red mushroom inside the low tunnel makes you grow – and the roof crushes you. */
function tunnelShroom(b) {
  b.ground(0, 23);
  b.fill(5, 15, 13, 13, '#');
  b.put(5, 12, '#');
  b.fill(12, 15, 12, 12, '#');
  const id = b.troll('The mushroom in the low tunnel crushes you', { type: 'tunnel-shroom', hint: 'The red mushroom inside the low tunnel makes you grow and the roof crushes you – climb on top of the tunnel and walk over it.' });
  shroom(b, 10, 14, +1, { troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 5 * T - 40), J(16), land, run(X + 12 * T - 24), J(8), land, run(X + 16 * T + 10), land, run(X + 23 * T)],
    die: [run(X + 12 * T), wait(60)],
  };
}

/** TRAP shrink-before-gap: the blue mushroom under the rock shrinks you, and tiny you cannot jump the spike pit. */
function shrinkBeforeGap(b) {
  b.ground(0, 12);
  b.fill(3, 10, 0, 11, '#');
  b.fill(13, 15, 17, 17, '#');
  b.fill(13, 15, 16, 16, '^');
  b.ground(16, 21);
  const id = b.troll('The blue mushroom shrinks you before the gap', { type: 'shrink-before-gap', hint: 'The blue mushroom under the rock shrinks you, and tiny you cannot jump the spike pit – hop over the mushroom.', hazards: [[13, 16, 3, 1]] });
  shroom(b, 7, 14, -1, { troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 6 * T), J(6), land, run(X + 13 * T - 12), J(16), land, run(X + 21 * T)],
    die: [run(X + 13 * T - 8), J(16), ['R', 120]],
  };
}

/** TRAP giant-bridge: the red arch makes you giant, and the cracked bridge breaks under giant you. */
function giantBridge(b) {
  b.ground(0, 9);
  const id = b.troll('Giant you breaks the bridge', { type: 'giant-bridge', hint: 'The red arch makes you giant and the cracked bridge breaks under giant you – jump up into the blue mushroom hanging before it, then cross at normal size.', hazards: [[10, 16, 7, 1]] });
  sizeArch(b, 3, { to: 'giant' }, id);
  shroom(b, 7, 11, -1, { float: true });
  const br = crack(b);
  b.fill(10, 16, 15, 15, br);
  b.groupTroll(br, id);
  b.fill(10, 16, 17, 17, '#');
  b.fill(10, 16, 16, 16, '^');
  b.ground(17, 23);
  resetArch(b, 20);
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 7 * T + 4), ['', 12], ['J', 22], ['', 's.grounded'], run(X + 23 * T)],
    die: [run(X + 12 * T), wait(90)],
  };
}

/** TRAP tiny-updraft: past the slot, the air vent blows light tiny you up into the thorns. */
function tinyUpdraft(b) {
  b.ground(0, 25);
  shroom(b, 3, 14, -1);
  slot(b, 6, 7);
  b.fill(11, 17, 0, 9, '#');
  b.fill(11, 17, 10, 10, 'v');
  const id = b.troll('The air vent blows tiny you into the thorns', { type: 'tiny-updraft', hint: 'Tiny you is light: the air vent blows you up into the thorns – hop up into the red mushroom before it and cross at normal size.', hazards: [[11, 10, 7, 1]] });
  const v = ext(b, { kind: 'vent', lift: 1.1 });
  b.fill(12, 16, 11, 14, v);
  b.groupTroll(v, id);
  shroom(b, 9, 13, +1, { float: true });
  resetArch(b, 21);
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 9 * T), ['RJ', 14], ['R', 's.grounded'], run(X + 25 * T)],
    die: [run(X + 13 * T), wait(120)],
  };
}

/** TRAP shrink-ray: a crystal flashes a shrink beam over the pit – tiny you falls short. */
function shrinkRay(b) {
  b.ground(0, 8);
  b.fill(9, 12, 17, 17, '#');
  b.fill(9, 12, 16, 16, '^');
  b.ground(13, 23);
  resetArch(b, 2);
  const id = b.troll('A crystal shrinks you mid-jump', { type: 'shrink-ray', hint: 'The crystal flashes a shrink beam over the pit every few seconds and tiny you falls short – wait for a flash to end, then run and jump at once.', hazards: [[9, 16, 4, 1]] });
  const r = ext(b, { kind: 'ray', beam: b.rect(7, 11, 7, 4), every: 120, on: 24 });
  b.put(14, 14, r);
  b.groupTroll(r, id);
  b.trigger({ when: { zone: b.rect(7, 11, 7, 4) }, do: [], troll: id });
  resetArch(b, 19);
  const X = b.px(0);
  const P = 's.levelTick % 120';
  return {
    w: 24,
    win: [run(X + 5 * T), ['', `${P} === 24`], run(X + 9 * T - 12), ['RJ', 16], land, run(X + 23 * T)],
    die: [run(X + 5 * T), ['', `${P} === 110`], run(X + 9 * T - 12), ['RJ', 16], ['R', 100]],
  };
}

/** TRAP fairy-ring: stepping into the fairy ring makes you giant – right under the low bramble. */
function fairyRing(b) {
  b.ground(0, 25);
  b.fill(11, 19, 0, 12, '#');
  const id = b.troll('The fairy ring grows you into the bramble', { type: 'fairy-ring', hint: 'Walking into the fairy ring makes you giant and the bramble ahead catches giant you – jump over the ring: it only works on whoever walks into it.' });
  const ring = ext(b, { kind: 'ring', to: 'giant' });
  b.fill(6, 7, 14, 14, ring);
  b.groupTroll(ring, id);
  const br = ext(b, { kind: 'bramble', y: 0, h: 38, sl: { deadly: true } });
  b.fill(11, 19, 13, 13, br);
  b.groupTroll(br, id);
  resetArch(b, 22);
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 5 * T - 4), J(8), land, run(X + 25 * T)],
    die: [run(X + 14 * T), wait(40)],
  };
}

/** TRAP sinking-lilypads: giant you (needed for the wall) sinks the lily pads into the thorns. */
function sinkingLilypads(b) {
  b.ground(0, 6);
  shroom(b, 3, 14, +1);
  b.fill(7, 9, 11, 17, '#');
  b.fill(10, 14, 17, 17, '#');
  b.fill(10, 14, 16, 16, '^');
  const id = b.troll('Giant you sinks the lily pads', { type: 'sinking-lilypads', hint: 'Giant you is so heavy the lily pads sink into the thorns – do not step on them: leap over the whole pond from the top of the wall.', hazards: [[10, 16, 5, 1]] });
  for (const [x0, x1] of [[10, 11], [13, 13]]) {
    const pad = b.group({ tile: '#', ext: { kind: 'lily', sink: 2, ticks: 36 } });
    b.fill(x0, x1, 15, 15, pad);
    b.groupTroll(pad, id);
  }
  b.fill(15, 21, 14, 17, '#');
  b.ground(22, 27);
  resetArch(b, 19, 14);
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 6 * T - 20), ['RJ', 22], land, run(X + 10 * T - 30), ['RJ', 22], land, run(X + 27 * T)],
    die: [run(X + 6 * T - 20), ['RJ', 22], land, run(X + 12 * T), wait(90)],
  };
}

/** TRAP tiny-door-step: the little door sits up on a step tiny you cannot climb, and the flytrap eats tiny you. */
function tinyDoorStep(b) {
  b.ground(0, 25);
  const id = b.troll('Tiny you cannot reach the little door', { type: 'tiny-door-step', hint: 'Do not eat the blue mushroom on the ground: tiny you cannot climb the step and the flytrap snaps you up. Jump up the step at normal size through the floating blue mushroom, then crawl through the little door.' });
  shroom(b, 5, 14, -1, { troll: id });
  const ft = ext(b, { kind: 'flytrap', reach: 70 });
  b.put(9, 14, ft);
  b.groupTroll(ft, id);
  b.fill(11, 19, 13, 14, '#');
  slot(b, 15, 16, 12);
  shroom(b, 10, 11, -1, { float: true });
  resetArch(b, 23);
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 4 * T), J(4), land, run(X + 8 * T + 30), ['RJ', 18], ['R', 's.grounded'], run(X + 20 * T + 10), ['R', 's.grounded'], run(X + 25 * T)],
    die: [run(X + 12 * T), wait(60)],
  };
}

/** TRAP grow-to-cross: under the low bramble the floor is full of little spike holes – only giant you walks over them. */
function growToCross(b) {
  b.ground(0, 7);
  const id = b.troll('Only giant you can cross the holes', { type: 'grow-to-cross', hint: 'This time the red mushroom is your friend: jump up to it. Giant you walks straight over the little spike holes under the bramble – do not jump there.' });
  shroom(b, 4, 12, +1, { float: true });
  for (let x = 8; x <= 20; x++) {
    if (x % 2 === 0) b.ground(x, x);
    else { b.put(x, 17, '#'); b.put(x, 16, '^'); }
  }
  b.fill(8, 20, 0, 12, '#');
  const br = ext(b, { kind: 'bramble', y: 0, h: 22, sl: { deadly: true } });
  b.fill(8, 20, 13, 13, br);
  b.groupTroll(br, id);
  b.trigger({ when: { zone: b.rect(9, 15, 11, 2) }, do: [], troll: id });
  b.ground(21, 27);
  resetArch(b, 24);
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 4 * T - 20), ['RJ', 22], land, run(X + 27 * T)],
    die: [run(X + 12 * T), wait(60)],
  };
}

/** TRAP tiny-tailwind: past the slot a tailwind blows light tiny you off the ledge and over the island. */
function tinyTailwind(b) {
  b.ground(0, 16);
  shroom(b, 3, 14, -1);
  slot(b, 6, 7, 14);
  b.fill(17, 18, 16, 17, '#');
  b.put(19, 17, '^');
  b.put(20, 17, '^');
  b.put(21, 17, '^');
  b.ground(22, 27);
  const id = b.troll('The tailwind blows tiny you too far', { type: 'tiny-tailwind', hint: 'Tiny you is light: the tailwind on the ledge blows you over the little island into the spikes – hold LEFT against it and drift slowly off the edge.', hazards: [[19, 17, 3, 1]] });
  const w = ext(b, { kind: 'wind', vx: 330 });
  b.fill(8, 16, 12, 14, w);
  b.groupTroll(w, id);
  resetArch(b, 18, 16);
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 8 * T + 4), ['L', `s.grounded && s.x >= ${X + 17 * T}`], ['', 's.grounded'], ['R', SIZE('normal')], run(X + 19 * T - 12), ['RJ', 16], land, run(X + 27 * T)],
    die: [run(X + 8 * T + 4), ['R', 160]],
  };
}

/** TRAP pulse-tunnel: the pollen arch flips you between tiny and giant – giant you is crushed in the low tunnel. */
function pulseTunnel(b) {
  b.ground(0, 33);
  const id = b.troll('Pollen flips your size in the low tunnel', { type: 'pulse-tunnel', hint: 'The pollen arch flips you between tiny and giant every second, and giant you is crushed in the low tunnel – wait in front of it and in each tall chamber until you turn tiny, then run on.' });
  sizeArch(b, 3, { to: 'pulse', a: 'tiny', b: 'giant', every: 70 }, id);
  // the tunnel: low parts (1 tall) and tall chambers (3 tall) where giant you fits
  b.fill(6, 21, 0, 13, '#');
  for (const [x0, x1] of [[10, 11], [16, 17]]) b.fill(x0, x1, 11, 13, '.');
  const zone = b.rect(6, 14, 16, 1);
  b.trigger({ when: { zone }, do: [], troll: id });
  resetArch(b, 26);
  const X = b.px(0);
  const go = (px) => [['', SIZE('giant')], ['', SIZE('tiny')], run(px)];
  return {
    w: 34,
    win: [run(X + 5 * T), ...go(X + 10 * T + 20), ...go(X + 16 * T + 20), ...go(X + 23 * T), run(X + 33 * T)],
    die: [run(X + 15 * T), wait(60)],
  };
}

/** TRAP puffball-field: a puffball you LAND on shrinks you – and tiny you cannot jump the pit after the field. */
function puffballField(b) {
  b.ground(0, 13);
  const id = b.troll('Landing on a puffball shrinks you', { type: 'puffball-field', hint: 'A puffball bursts and shrinks you only when you land on it, and tiny you cannot jump the pit – walk straight across them all, then jump the pit.', hazards: [[14, 16, 3, 1]] });
  const pf = ext(b, { kind: 'puff', d: -1 });
  b.fill(5, 10, 14, 14, pf);
  b.groupTroll(pf, id);
  b.fill(14, 16, 17, 17, '#');
  b.fill(14, 16, 16, 16, '^');
  b.ground(17, 27);
  resetArch(b, 2);
  resetArch(b, 22);
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 14 * T - 12), ['RJ', 16], land, run(X + 27 * T)],
    die: [run(X + 4 * T), ['RJ', 16], land, run(X + 14 * T - 12), ['RJ', 16], ['R', 100]],
  };
}

/** TRAP flower-stepping: the flower heads over the thorns only hold tiny you – they sink under anyone bigger. */
function flowerStepping(b) {
  b.ground(0, 7);
  shroom(b, 5, 13, -1, { float: true });
  b.fill(8, 16, 17, 17, '#');
  b.fill(8, 16, 16, 16, '^');
  const id = b.troll('The flowers only hold tiny you', { type: 'flower-stepping', hint: 'The flower heads over the thorns sink under anyone bigger than tiny – hop up into the floating blue mushroom first and cross on them tiny.', hazards: [[8, 16, 9, 1]] });
  for (const x of [9, 11, 13, 15]) {
    const f = b.group({ tile: '#', ext: { kind: 'lily', sink: 2, ticks: 14, heavy: ['normal', 'giant'], flower: true } });
    b.put(x, 15, f);
    b.groupTroll(f, id);
  }
  b.ground(17, 23);
  resetArch(b, 20);
  const X = b.px(0);
  const hop = (x) => [run(X + x * T - 8), ['RJ', 8], land];
  return {
    w: 24,
    win: [run(X + 5 * T - 20), ['RJ', 12], land, ...hop(8), ...hop(10), ...hop(12), ...hop(14), ...hop(16), run(X + 23 * T)],
    die: [run(X + 8 * T - 12), ['RJ', 10], land, wait(40)],
  };
}

/** TRAP spring-snap: giant you is too heavy for the springs – they snap and you fall on the spikes. */
function springSnap(b) {
  b.ground(0, 6);
  const id = b.troll('Giant you snaps the springs', { type: 'spring-snap', hint: 'The red arch makes you giant and giant you is too heavy for the springs: they snap – hop onto the stone and jump straight up onto the cliff instead.', hazards: [[7, 17, 2, 1]] });
  sizeArch(b, 2, { to: 'giant' }, id);
  b.fill(4, 5, 14, 14, '#');
  const sp = b.group({ tile: '=', ext: { kind: 'snap' } });
  b.fill(7, 8, 16, 16, sp);
  b.groupTroll(sp, id);
  b.fill(7, 8, 17, 17, '^');
  b.fill(9, 14, 10, 17, '#');
  b.fill(15, 18, 12, 17, '#');
  b.ground(19, 25);
  resetArch(b, 12, 10);
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 4 * T - 30), ['RJ', 5], land, run(X + 6 * T - 28), ['RJ', 22], land, run(X + 25 * T)],
    die: [run(X + 4 * T - 30), ['RJ', 5], land, run(X + 9 * T), wait(60)],
  };
}

/** TRAP tiny-breeze: past the slot the fan blows in gusts – a gust blows tiny you back into the spike pit. */
function tinyBreeze(b) {
  b.ground(0, 11);
  shroom(b, 3, 14, -1);
  slot(b, 6, 7, 14);
  b.fill(12, 13, 17, 17, '#');
  b.fill(12, 13, 16, 16, '^');
  b.ground(14, 25);
  const id = b.troll('A gust blows tiny you back into the pit', { type: 'tiny-breeze', hint: 'The fan blows in gusts and a gust blows light tiny you back into the spike pit – wait at the slot until a gust stops, then run and jump at once.', hazards: [[12, 16, 2, 1]] });
  const w = ext(b, { kind: 'wind', vx: -320, gust: [100, 110] });
  b.fill(8, 15, 12, 14, w);
  b.groupTroll(w, id);
  resetArch(b, 20);
  const X = b.px(0);
  const P = 's.levelTick % 210';
  return {
    w: 26,
    win: [run(X + 8 * T + 4), ['', `${P} === 100`], run(X + 12 * T - 9), ['RJ', 22], land, run(X + 25 * T)],
    die: [run(X + 8 * T + 4), ['', `${P} === 100`], run(X + 12 * T - 9), ['', `${P} === 196`], ['RJ', 22], ['R', 100]],
  };
}

/** TRAP tiny-exit: the EXIT is tiny – it sits in a mouse hole under thorns that only tiny you passes. */
function tinyExit(b) {
  b.ground(0, 19);
  shroom(b, 6, 13, -1, { float: true });
  b.fill(13, 19, 0, 13, '#');
  const id = b.troll('The EXIT is tiny', { type: 'tiny-exit', hint: 'The real EXIT is tiny and the thorns over its mouse hole catch anyone bigger – hop up into the floating blue mushroom first, then walk in.' });
  const br = ext(b, { kind: 'bramble', y: 0, h: 22, tinyDoor: true });
  b.fill(13, 18, 14, 14, br);
  b.groupTroll(br, id);
  b.doorAt(19, 14);
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 6 * T - 20), ['RJ', 10], ['R', 's.grounded'], ['R', 's.state !== "play"']],
    die: [run(X + 15 * T), wait(30)],
  };
}

/** the level ends inside the wall of the last trap: no extra EXIT segment */
function wallEnd(b) {
  b.fill(0, 0, 0, 17, '#');
  return { w: 1, win: [] };
}

export default {
  id: 16,
  slug: 'size-matters',
  name: 'Size Matters',
  idea: 'The hero shrinks and grows',
  winMessage: 'Just the right size!',
  deathQuips: ['Too big for your boots.', 'Small mistake. Literally.', 'Mushrooms: 1, you: 0.', 'You fell short. Very short.', 'Grow up!'],
  handmade: true,
  minWidth: 929,
  traps: [tunnelShroom, shrinkBeforeGap, giantBridge, tinyUpdraft, shrinkRay, fairyRing, sinkingLilypads, tinyDoorStep, growToCross, tinyTailwind, pulseTunnel, puffballField, flowerStepping, springSnap, tinyBreeze, tinyExit],
  endSeg: wallEnd,
  between: [
    [pit(3, 2), up(2, 3), isle(3, 2, 1), pit(3, 2, -1), down(2, 2), spikes(3, 2), thorns(1, 3)],
    [thorns(1, 2), isle(4, 2), pit(3, 2), roof(4), spikes(4, 2), up(1, 3), down(1, 2)],
    [up(1, 2), pit(3, 2, 1), down(2, 3), block(1, 2, 2), spikes(3, 2, 1), isle(3, 2, -1), thorns(3, 2)],
    [pillars(2, 1, [1, 1, 0]), down(2, 2), roof(3), spikes(4, 2), isle(3, 1, 2), down(2, 3)],
    [spikes(3, 2, 2), isle(3, 2, -1), pit(4, 2, -1), thorns(2, 2), up(2, 2), pit(3, 2, -2)],
    [isle(2, 2, 2), isle(3, 3, 1), pit(2, 2, -1), isle(4, 2, -2), spikes(2, 3), block(1, 2, 2), thorns(2, 3)],
    [pit(4, 3), up(2, 2), spikes(3, 2, -2), pillars(3, 1, [0, 1, 0]), down(1, 2), thorns(2, 1)],
    [up(1, 2), roof(3), pit(3, 2, 1), isle(3, 3, -2), spikes(4, 2), up(3, 2), down(3, 3)],
    [isle(3, 2, 1), pit(3, 2, 1), pit(4, 3, -2), spikes(3, 2), roof(4), pit(3, 3)],
    [spikes(2, 2, 1), pit(2, 2, 1), down(1, 1), isle(4, 2, -1), thorns(1, 2), pillars(2, 1, [1, 1, 0]), down(2, 2), block(1, 2, 3)],
    [spikes(4, 2), up(2, 3), roof(3), isle(3, 2, -2), isle(4, 2), pit(3, 2, 1), down(1, 3)],
    [pit(3, 2, 1), up(2, 2), pit(4, 2, -1), spikes(3, 2, -2), isle(2, 2, 1), down(1, 3), block(2, 2, 3)],
    [isle(3, 2, 1), isle(3, 1, 1), isle(3, 2, -2), spikes(4, 2), thorns(2, 1), pit(4, 2)],
    [roof(2), pit(3, 2, 2), roof(3), down(2, 2), spikes(3, 2), up(1, 2), pit(3, 2, -1), isle(4, 3)],
    [pillars(2, 1, [1, 1, 1]), down(3, 4), spikes(4, 2), up(1, 2), isle(4, 2, -1), thorns(2, 2), pit(3, 2)],
    [pit(4, 2), isle(3, 2, 2), down(2, 2), roof(4), spikes(3, 2), up(2, 2), pit(3, 2, -2)],
    [],
  ],
};
