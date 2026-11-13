// LEVEL 5 – "Left Is Right": the controls betray you. Every trap is a tinted strip of floor;
// its effect is on exactly while you are above that strip (the hint highlights it).
import { T, run, runL, J, land, wait } from '../lib.mjs';

const strip = (b, x0, x1, tint, y1 = 15) => { b.fill(x0, x1, y1 + 1, 17, '#'); const g = b.group({ tile: '#', tint }); b.fill(x0, x1, 15, y1, g); return g; };

/** TRAP controls-swap: after a pit you land on a purple strip where left and right are swapped. */
function controlsSwap(b) {
  b.ground(0, 2);
  b.fill(3, 4, 17, 17, '^');
  strip(b, 5, 8, 0xc9a0ff);
  b.fill(9, 10, 17, 17, '^');
  strip(b, 11, 14, 0xc9a0ff);
  b.ground(15, 18);
  const id = b.troll('Left and right swap', { type: 'controls-swap', hint: 'On the purple floor left and right are swapped – hold LEFT to go right, and LEFT+jump over its pit.', hazards: [[3, 17, 2, 1], [9, 17, 2, 1]] });
  b.trigger({ when: { zone: b.rect(5, 9, 10, 6) }, hold: true, do: [{ controls: 'flip' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 3 * T - 30), J(), ['', 's.grounded'], ['L', `s.x>=${X + 9 * T - 34}`], ['LJ', 16], ['L', 's.grounded'], ['L', `s.x>=${X + 15 * T + 14}`], run(X + 18 * T)],
    die: [run(X + 3 * T - 30), J(), ['R', 120]],
  };
}

/** TRAP broken-jump: on the 3 grey tiles before a little pit the jump button does nothing. */
function brokenJump(b) {
  b.ground(0, 4);
  strip(b, 5, 6, 0x8d93ab);
  b.fill(7, 8, 17, 17, '^');
  b.ground(9, 14);
  const id = b.troll('The jump stops working', { type: 'broken-jump', hint: 'Jump does not work on the 2 grey tiles before the pit – take off just before the grey tiles.', hazards: [[7, 17, 2, 1]] });
  b.trigger({ when: { zone: b.rect(5, 9, 2, 6) }, hold: true, do: [{ controls: 'nojump' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  return { w: 15, win: [run(X + 5 * T - 22), J(), land, run(X + 14 * T)], die: [run(X + 7 * T - 30), J(), ['R', 60]] };
}

/** TRAP super-jump: on the orange strip jumps are 1.5× stronger – a full jump hits the spiked roof. */
function superJump(b) {
  b.ground(0, 6);
  b.fill(7, 8, 15, 17, '.');
  b.fill(7, 8, 17, 17, '^');
  b.ground(9, 14);
  const g = b.group({ tile: '#', tint: 0xffa25e });
  b.fill(3, 6, 15, 15, g);
  b.fill(9, 11, 15, 15, g);
  b.fill(3, 11, 6, 6, '#');
  b.fill(3, 11, 7, 7, 'v');
  const id = b.troll('Super jumps hit the spiked roof', { type: 'super-jump', hint: 'On the orange floor every jump is super strong – cross the pit with a short tap so you stay under the spiked roof.', hazards: [[3, 7, 9, 1], [7, 17, 2, 1]] });
  b.trigger({ when: { zone: b.rect(3, 8, 9, 7) }, hold: true, do: [{ controls: 'superjump' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  return { w: 15, win: [run(X + 7 * T - 30), ['RJ', 6], land, run(X + 14 * T)], die: [run(X + 7 * T - 30), J(30), ['R', 60]] };
}

/** TRAP hiccup-jump: in a spiky tunnel you hop by yourself every 0.8 s – wait in the gaps. */
function hiccupJump(b) {
  b.ground(0, 20);
  strip(b, 2, 18, 0x7fd9a8, 15);
  for (const x0 of [4, 9, 14]) {
    b.fill(x0, x0 + 2, 9, 12, '#');
    b.fill(x0, x0 + 2, 13, 13, 'v');
  }
  const id = b.troll('You get the hiccups', { type: 'hiccup-jump', hint: 'On the green floor you hop by yourself every moment – wait in each gap for a hop, then run under the next spikes.', hazards: [[4, 13, 3, 1], [9, 13, 3, 1], [14, 13, 3, 1]] });
  b.trigger({ when: { zone: b.rect(2, 9, 17, 6) }, hold: true, do: [{ controls: 'hiccup' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  const hop = ['', 's.ctrlMode==="hiccup" && s.grounded && s.levelTick%60===30'];
  return {
    w: 21,
    win: [run(X + 3 * T), hop, run(X + 7 * T + 20), hop, run(X + 12 * T + 20), hop, run(X + 20 * T)],
    die: [run(X + 10 * T), ['', 70]],
  };
}

/** TRAP input-lag: on the teal strip your buttons react a third of a second late. */
function inputLag(b) {
  b.ground(0, 3);
  strip(b, 4, 8, 0x55c7c7);
  b.fill(9, 10, 17, 17, '^');
  strip(b, 11, 13, 0x55c7c7);
  b.ground(14, 17);
  const id = b.troll('Your buttons lag behind', { type: 'input-lag', hint: 'On the teal floor every button reacts late – press jump about two tiles before the pit.', hazards: [[9, 17, 2, 1]] });
  b.trigger({ when: { zone: b.rect(4, 8, 10, 7) }, hold: true, do: [{ controls: 'lag' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 4 * T + 20), ['R', 's.vx>200'], run(X + 9 * T - 25 - 90), ['RJ', 16], ['R', 's.grounded && s.x>' + (X + 11 * T)], run(X + 17 * T)],
    die: [run(X + 4 * T + 20), ['R', 's.vx>200'], run(X + 9 * T - 30), ['RJ', 16], ['R', 90]],
  };
}

/** TRAP frozen-controls: stepping on the pale strip freezes your controls and you slide on. */
function frozenControls(b) {
  b.ground(0, 4);
  strip(b, 5, 10, 0xd6d8ff);
  b.fill(11, 13, 17, 17, '^');
  b.ground(14, 18);
  const id = b.troll('Your controls freeze', { type: 'frozen-controls', hint: 'The pale strip freezes your controls for a second and you keep sliding – step onto it slowly.', hazards: [[11, 17, 3, 1]] });
  const tid = b.uid('fz');
  b.trigger({ id: tid, when: { zone: b.rect(5, 9, 1, 6) }, do: [{ controls: 'frozen' }], troll: id });
  b.trigger({ when: { after: tid }, delay: 60, do: [{ controls: 'normal' }] });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 4 * T + 10), ['', 10], ['R', 2], ['', 75], run(X + 11 * T - 34), J(), land, run(X + 18 * T)],
    die: [run(X + 9 * T), ['R', 120]],
  };
}

/** TRAP turbo-speed: on the red floor you run twice as fast – a normal jump flies over the island. */
function turboSpeed(b) {
  b.ground(0, 3);
  strip(b, 4, 9, 0xff6b6b);
  b.fill(10, 12, 17, 17, '^');
  strip(b, 13, 15, 0xff6b6b, 16);
  b.fill(16, 21, 17, 17, '^');
  b.ground(22, 28);
  const id = b.troll('Turbo speed makes you overshoot', { type: 'turbo-speed', hint: 'On the red floor you run twice as fast – make a tiny hop onto the island, then a full jump from its edge.', hazards: [[10, 17, 3, 1], [16, 17, 6, 1]] });
  b.trigger({ when: { zone: b.rect(4, 6, 25, 9) }, hold: true, do: [{ controls: 'turbo' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  return {
    w: 29,
    win: [run(X + 10 * T - 40), ['RJ', 5], land, run(X + 16 * T - 40), J(), land, run(X + 28 * T)],
    die: [run(X + 10 * T - 30), J(), ['R', 90]],
  };
}

/** TRAP auto-run: on the yellow strip you cannot stop running – jump everything in time. */
function autoRun(b) {
  b.ground(0, 26);
  b.fill(7, 8, 15, 17, '.');
  b.fill(7, 8, 17, 17, '^');
  b.fill(13, 13, 14, 14, '#');
  b.fill(17, 19, 15, 17, '.');
  b.fill(17, 19, 17, 17, '^');
  const g = b.group({ tile: '#', tint: 0xffe066 });
  for (const [a, z] of [[2, 6], [9, 16], [20, 23]]) b.fill(a, z, 15, 15, g);
  const id = b.troll('You cannot stop running', { type: 'auto-run', hint: 'On the yellow floor you cannot stop running – jump the pit, the block and the wide pit right at their edges.', hazards: [[7, 17, 2, 1], [17, 17, 3, 1]] });
  b.trigger({ when: { zone: b.rect(2, 9, 22, 6) }, hold: true, do: [{ controls: 'autorun' }], undo: [{ controls: 'normal' }], troll: id });
  const X = b.px(0);
  return {
    w: 27,
    win: [run(X + 7 * T - 34), J(12), land, run(X + 13 * T - 46), J(12), land, run(X + 17 * T - 30), J(), land, run(X + 26 * T)],
    die: [run(X + 26 * T)],
  };
}

export default {
  id: 5, slug: 'left-is-right', name: 'Left Is Right', idea: 'The controls betray you',
  winMessage: 'Your fingers lied to you.', deathQuips: ['Huh?!', 'Wrong way!', 'Not my fault!', 'Whoops.'],
  minWidth: 298, style: 'ground',
  traps: [controlsSwap, brokenJump, superJump, hiccupJump, inputLag, frozenControls, turboSpeed, autoRun],
};
