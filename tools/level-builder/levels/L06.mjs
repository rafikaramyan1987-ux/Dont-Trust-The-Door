// LEVEL 6 – "Upside Downer": gravity. Floor and ceiling are both walkways.
import { T, run, runL, J, land, wait } from '../lib.mjs';

/** TRAP gravity-flip: gravity flips and you fall up – holding RIGHT drifts you into ceiling spikes. */
function gravityFlip(b) {
  b.ground(0, 14);
  b.fill(2, 13, 3, 3, '#');
  b.fill(6, 8, 4, 4, 'v');
  const id = b.troll('Gravity flips – drifting lands you in ceiling spikes', { type: 'gravity-flip', hint: 'Gravity flips at the arrow and you fall up – let go of the keys so you land before the ceiling spikes, then jump over them.', hazards: [[6, 4, 3, 1]] });
  b.trigger({ when: { zone: b.rect(2, 5, 1, 10) }, do: [{ gravity: 'flip' }], troll: id });
  const X = b.px(0);
  return {
    w: 14,
    win: [run(X + 2 * T), ['', 's.grounded'], run(X + 6 * T - 36), J(), ['R', 's.grounded'], run(X + 13 * T + 30)],
    die: [run(X + 2 * T), ['R', 90]],
  };
}

/** TRAP gravity-flip-back: on the ceiling walk gravity flips back above a field of spikes. */
function gravityFlipBack(b) {
  b.ground(0, 3);
  b.fill(4, 9, 15, 17, '#');
  b.fill(4, 9, 14, 14, '^');
  b.ground(10, 15);
  b.fill(0, 6, 3, 3, '#');
  const id = b.troll('Gravity flips back above a spike field', { type: 'gravity-flip-back', hint: 'At the end of the ceiling walk gravity flips back above spikes – keep holding RIGHT while you fall.', hazards: [[4, 14, 6, 1]] });
  b.trigger({ when: { zone: b.rect(6, 4, 1, 3) }, do: [{ gravity: 'normal' }], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [['R', 's.gravity>0'], ['R', 's.grounded'], run(X + 15 * T)],
    die: [['R', `s.x>=${X + 6 * T}`], ['', 90]],
  };
}

/** TRAP low-gravity: above the ledge gravity is weak – a jump hits the spikes; just float down. */
function lowGravity(b) {
  b.ground(0, 11);
  b.fill(2, 4, 14, 14, '#');
  b.fill(5, 7, 13, 14, '#');
  b.fill(8, 11, 12, 14, '#');
  b.fill(12, 14, 17, 17, '^');
  b.ground(15, 20);
  b.fill(11, 14, 6, 6, '#');
  b.fill(11, 14, 7, 7, 'v');
  const id = b.troll('Floaty gravity – a jump hits the spikes', { type: 'low-gravity', hint: 'Gravity is weak at the end of the top step – do not jump (you would hit the spikes); just walk off the edge and float across.', hazards: [[11, 7, 4, 1], [12, 17, 3, 1]] });
  b.trigger({ when: { zone: b.rect(11, 8, 4, 7) }, hold: true, do: [{ gravityScale: 0.3 }], undo: [{ gravityScale: 1 }], troll: id });
  const X = b.px(0);
  const climb = [run(X + 2 * T - 40), J(10), land, run(X + 5 * T - 40), J(10), land, run(X + 8 * T - 40), J(10), land];
  return {
    w: 21,
    win: [...climb, run(X + 20 * T)],
    die: [...climb, run(X + 11 * T + 20), ['', 8], ['J', 40], ['', 90]],
  };
}

/** TRAP heavy-gravity: you are so heavy you fall into cracks you could normally walk over. */
function heavyGravity(b) {
  b.ground(0, 2);
  const g = b.group({ tile: '#', tint: 0x6b5fa6 });
  for (const [a, z] of [[3, 4], [6, 8], [10, 12], [14, 15]]) b.fill(a, z, 15, 16, g);
  b.fill(3, 15, 17, 17, '#');
  for (const c of [5, 9, 13]) b.put(c, 16, '^');
  b.ground(16, 19);
  const id = b.troll('Heavy gravity – you fall into tiny cracks', { type: 'heavy-gravity', hint: 'On the dark floor you are so heavy you fall into the thin cracks – hop over each crack.', hazards: [[5, 15, 1, 2], [9, 15, 1, 2], [13, 15, 1, 2]] });
  b.trigger({ when: { zone: b.rect(3, 6, 13, 9) }, hold: true, do: [{ gravityScale: 2.4 }], undo: [{ gravityScale: 1 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T - 24), J(10), land, run(X + 9 * T - 24), J(10), land, run(X + 13 * T - 24), J(10), land, run(X + 19 * T)],
    die: [run(X + 19 * T)],
  };
}

/** TRAP ground-falls-up: a chunk of the ground ahead falls UP into the sky and leaves a pit. */
function groundFallsUp(b) {
  b.ground(0, 7);
  b.fill(8, 10, 17, 17, '^');
  b.ground(11, 16);
  const g = b.group({ tile: '#' });
  b.fill(8, 10, 15, 16, g);
  const id = b.troll('The ground falls up into the sky', { type: 'ground-falls-up', hint: 'A chunk of the ground ahead falls up into the sky when you come near – jump over the hole it leaves.', hazards: [[8, 17, 3, 1]] });
  b.trigger({ when: { zone: b.rect(4, 9, 1, 6) }, do: [{ move: g, by: [0, -11], ticks: 14 }], troll: id });
  const X = b.px(0);
  return { w: 17, win: [run(X + 8 * T - 30), J(), land, run(X + 16 * T)], die: [run(X + 16 * T)] };
}

/** TRAP floating-bubble: inside the bubble you slowly float up – walk straight through it. */
function floatingBubble(b) {
  b.ground(0, 2);
  b.fill(3, 8, 17, 17, '^');
  b.ground(9, 15);
  b.fill(2, 9, 2, 2, '#');
  b.fill(2, 9, 3, 3, 'v');
  b.decor(3, 4, 6, 11, 'bubble');
  const id = b.troll('A bubble makes you float up into spikes', { type: 'floating-bubble', hint: 'Inside the bubble over the pit you float upward – do not jump or stop, walk straight through it.', hazards: [[2, 3, 8, 1], [3, 17, 6, 1]] });
  b.trigger({ when: { zone: b.rect(3, 4, 6, 11) }, hold: true, do: [{ gravityScale: -0.3 }], undo: [{ gravityScale: 1 }], troll: id });
  const X = b.px(0);
  return { w: 16, win: [run(X + 15 * T)], die: [run(X + 4 * T), ['', 150]] };
}

/** TRAP flip-on-jump: on the blue strip the jump button flips gravity instead of jumping. */
function flipOnJump(b) {
  b.ground(0, 18);
  b.fill(6, 8, 15, 17, '.');
  b.fill(6, 8, 17, 17, '^');
  const g = b.group({ tile: '#', tint: 0x6fa8ff });
  b.fill(1, 5, 15, 15, g);
  b.fill(9, 16, 15, 15, g);
  b.fill(1, 16, 3, 3, '#');
  b.fill(11, 13, 4, 4, 'v');
  const id = b.troll('Jump flips gravity instead', { type: 'flip-on-jump', hint: 'On the blue strip jump flips gravity – flip up before the pit, then flip down right after it, before the ceiling spikes.', hazards: [[6, 17, 3, 1], [11, 4, 3, 1]] });
  b.trigger({ when: { zone: b.rect(1, 4, 16, 11) }, hold: true, do: [{ controls: 'flipjump' }], undo: [{ controls: 'normal' }, { gravity: 'normal' }], troll: id });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 2 * T + 20), ['RJ', 2], ['R', 's.grounded'], run(X + 9 * T + 24), ['RJ', 2], ['R', 's.grounded'], run(X + 18 * T)],
    die: [run(X + 5 * T + 20), ['RJ', 2], ['R', 's.grounded'], ['R', 120]],
  };
}

/** TRAP gravity-pulse: gravity flips back and forth every 1.25 s – cross the spikes on the ceiling. */
function gravityPulse(b) {
  b.ground(0, 23);
  b.fill(8, 11, 14, 14, '^');
  b.fill(3, 21, 3, 3, '#');
  const id = b.troll('Gravity flips back and forth', { type: 'gravity-pulse', hint: 'Gravity flips up and down every moment – keep running: cross the floor spikes while you are on the ceiling.', hazards: [[2, 4, 20, 11]] });
  b.trigger({ when: { zone: b.rect(1, 4, 1, 11) }, delay: 40, every: 75, stopAt: b.x0 + 21, do: [{ gravity: 'flip' }], troll: id });
  b.trigger({ when: { zone: b.rect(22, 4, 1, 11) }, do: [{ gravity: 'normal' }] });
  const X = b.px(0);
  return { w: 24, win: [run(X + 23 * T)], die: [run(X + 9 * T + 20), ['R', 's.gravity<0 && s.grounded'], ['', 150]] };
}

export default {
  id: 6, slug: 'upside-downer', name: 'Upside Downer', idea: 'Gravity',
  winMessage: 'Which way is up?!', deathQuips: ['Wrong way up!', 'Gravity says hi.', 'Floaty...', 'Heavy...'],
  minWidth: 242, style: 'ground',
  traps: [gravityFlip, [gravityFlipBack, { noFiller: true }], lowGravity, heavyGravity, groundFallsUp, floatingBubble, flipOnJump, gravityPulse],
};
