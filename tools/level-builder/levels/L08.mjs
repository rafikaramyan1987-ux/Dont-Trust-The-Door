// LEVEL 8 – "Screen Lies": the camera lies. Plains with sudden drops. Every camera trick is
// on exactly while you are inside its zone; the hero always stays visible (an arrow at the
// screen edge shows where he is when the camera looks elsewhere).
import { T, run, runL, J, land, wait } from '../lib.mjs';

const pit = (b, x0, x1) => { b.fill(x0, x1, 15, 17, '.'); b.fill(x0, x1, 17, 17, '^'); };
const camZone = (b, x0, w, id, on, off, extra = []) =>
  b.trigger({ when: { zone: b.rect(x0, 2, w, 13) }, hold: true, do: [{ camera: on }, ...extra], undo: [{ camera: off }], troll: id });

/** TRAP camera-freeze: the camera stops following you – walk on off-screen (the arrow shows you). */
function cameraFreeze(b) {
  b.ground(0, 25);
  pit(b, 9, 10);
  pit(b, 16, 17);
  pit(b, 21, 22);
  const id = b.troll('The camera stops following you', { type: 'camera-freeze', hint: 'The camera stops following you – keep going and watch the yellow arrow: jump three pits, 7, 14 and 19 tiles after the start of the frozen stretch.', hazards: [[9, 17, 2, 1], [16, 17, 2, 1], [21, 17, 2, 1]] });
  camZone(b, 2, 23, id, 'freeze', 'follow');
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 9 * T - 30), J(), land, run(X + 16 * T - 30), J(), land, run(X + 21 * T - 30), J(), land, run(X + 25 * T)],
    die: [run(X + 9 * T - 30), J(), land, run(X + 16 * T - 30), J(), land, run(X + 25 * T)],
  };
}

/** TRAP tunnel-vision: the camera zooms right in – you only see a few tiles around you. */
function tunnelVision(b) {
  b.ground(0, 27);
  pit(b, 5, 6);
  b.fill(13, 14, 14, 14, '#');
  b.fill(13, 14, 13, 13, '^');
  pit(b, 18, 19);
  b.put(25, 14, '^');
  const id = b.troll('The camera zooms in – tunnel vision', { type: 'tunnel-vision', hint: 'The camera zooms right in – go slowly: a pit, a spiked block (jump over it), another pit and a single spike follow.', hazards: [[5, 17, 2, 1], [13, 13, 2, 1], [18, 17, 2, 1], [25, 14, 1, 1]] });
  camZone(b, 2, 25, id, 'zoom', 'unzoom');
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 5 * T - 30), J(), land, run(X + 12 * T - 10), J(16), land, run(X + 18 * T - 30), J(), land, run(X + 25 * T - 40), J(10), land, run(X + 27 * T)],
    die: [run(X + 5 * T - 30), J(), land, run(X + 12 * T), J(8), ['R', 60]],
  };
}

/** TRAP screen-flip: the screen turns upside down over a stretch of pits and a spiked bar. */
function screenFlip(b) {
  b.ground(0, 24);
  pit(b, 5, 6);
  b.fill(10, 13, 11, 11, '#');
  b.fill(10, 13, 12, 12, 'v');
  pit(b, 16, 18);
  const id = b.troll('The screen turns upside down', { type: 'screen-flip', hint: 'The screen turns upside down – your keys still work normally: jump the pit, walk under the spiked bar without jumping, jump the wide pit.', hazards: [[5, 17, 2, 1], [10, 12, 4, 1], [16, 17, 3, 1]] });
  camZone(b, 2, 21, id, 'flip', 'unflip');
  const X = b.px(0);
  return {
    w: 25,
    win: [run(X + 5 * T - 30), J(), land, run(X + 16 * T - 30), J(), land, run(X + 24 * T)],
    die: [run(X + 5 * T - 30), J(), land, run(X + 10 * T - 60), J(), ['R', 60]],
  };
}

/** TRAP fake-victory: a fake "level clear" card pops up – stop and a spiked ball drops on you. */
function fakeVictory(b) {
  b.ground(0, 22);
  b.fill(3, 7, 13, 13, '#');
  b.fill(8, 10, 2, 2, '#');
  const ball = b.group({ tile: '*' });
  b.put(9, 3, ball);
  pit(b, 15, 16);
  const id = b.troll('A fake "level clear" screen', { type: 'fake-victory', hint: 'The "level clear" card is fake – do not stop under it: a spiked ball drops right there. Keep running and jump the pit.', hazards: [[8, 4, 3, 11], [15, 17, 2, 1]] });
  const tid = b.uid('fv');
  b.trigger({ id: tid, when: { zone: b.rect(9, 9, 1, 6) }, do: [{ fakeClear: true }, { scare: true }], troll: id });
  b.trigger({ when: { after: tid }, delay: 34, do: [{ toss: ball, vel: [0, 4] }] });
  b.trigger({ when: { zone: b.rect(19, 9, 1, 6) }, do: [{ fakeClear: false }] });
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 15 * T - 30), J(), land, run(X + 22 * T)],
    die: [run(X + 9 * T + 20), ['', 120]],
  };
}

/** TRAP blackout: the lights go out – only a small circle around you stays lit. */
function blackout(b) {
  b.ground(0, 31);
  pit(b, 6, 7);
  b.fill(12, 13, 14, 14, '^');
  pit(b, 17, 19);
  b.fill(22, 23, 13, 14, '#');
  pit(b, 28, 29);
  const id = b.troll('The lights go out', { type: 'blackout', hint: 'The lights go out and you only see around you – walk slowly: a pit, two spikes, a wide pit, a block and a last pit.', hazards: [[6, 17, 2, 1], [12, 14, 2, 1], [17, 17, 3, 1], [28, 17, 2, 1]] });
  camZone(b, 2, 29, id, 'dark', 'light', [{ say: 'say.lights', at: 'hero', ticks: 60 }]);
  const X = b.px(0);
  return {
    w: 32,
    win: [run(X + 6 * T - 30), J(), land, run(X + 12 * T - 40), J(), land, run(X + 17 * T - 22), J(), land, run(X + 22 * T - 40), J(), land,
      run(X + 28 * T - 30), J(), land, run(X + 31 * T)],
    die: [run(X + 6 * T - 30), J(), land, run(X + 13 * T), ['R', 60]],
  };
}

/** TRAP screen-smudge: a big smudge sticks to the screen and hides what is ahead of you. */
function screenSmudge(b) {
  b.ground(0, 24);
  b.fill(7, 9, 12, 14, '#');
  b.fill(10, 10, 12, 14, '>');
  b.fill(10, 12, 17, 17, '^');
  b.fill(10, 12, 15, 16, '.');
  b.fill(13, 14, 12, 14, '#');
  pit(b, 18, 19);
  const id = b.troll('A smudge on the screen hides the way', { type: 'screen-smudge', hint: 'A smudge on the screen hides what is ahead – jump onto the block, then over the gap to the next block, then over a pit.', hazards: [[10, 12, 1, 3], [10, 17, 3, 1], [18, 17, 2, 1]] });
  camZone(b, 2, 21, id, 'smudge', 'unsmudge', [{ say: 'say.smudge', at: 'hero', ticks: 50 }]);
  const X = b.px(0);
  return {
    w: 25,
    win: [run(X + 7 * T - 40), J(), land, run(X + 9 * T + 20), J(), land, run(X + 18 * T - 30), J(), land, run(X + 24 * T)],
    die: [run(X + 7 * T - 40), J(), land, ['R', 80]],
  };
}

/** TRAP backward-camera: the camera stares behind you – what is ahead appears at the last moment. */
function backwardCamera(b) {
  b.ground(0, 26);
  b.put(6, 14, '^');
  pit(b, 10, 11);
  b.fill(14, 15, 13, 14, '#');
  b.fill(16, 16, 14, 14, '^');
  pit(b, 20, 22);
  const id = b.troll('The camera looks the wrong way', { type: 'backward-camera', hint: 'The camera looks behind you, so things ahead pop up late – a spike, a pit, a block with a spike after it, then a wide pit.', hazards: [[6, 14, 1, 1], [10, 17, 2, 1], [16, 14, 1, 1], [20, 17, 3, 1]] });
  camZone(b, 2, 23, id, 'back', 'front', [{ say: 'say.behind', at: 'hero', ticks: 50 }]);
  const X = b.px(0);
  return {
    w: 27,
    win: [run(X + 6 * T - 40), J(10), land, run(X + 10 * T - 30), J(), land, run(X + 14 * T - 40), J(), land, run(X + 20 * T - 30), J(), land, run(X + 26 * T)],
    die: [run(X + 6 * T - 40), J(10), land, run(X + 10 * T - 30), J(), land, run(X + 14 * T - 40), J(), land, run(X + 15 * T + 30), J(8), ['R', 60]],
  };
}

/** TRAP strobe-lights: it is pitch dark except for short flashes – learn the way in the flashes. */
function strobeLights(b) {
  b.ground(0, 30);
  pit(b, 5, 6);
  b.fill(9, 10, 13, 14, '#');
  pit(b, 12, 14);
  b.fill(19, 19, 14, 14, '^');
  b.fill(20, 22, 11, 11, '#');
  b.fill(20, 22, 12, 12, 'v');
  pit(b, 26, 27);
  const id = b.troll('The lights only flash', { type: 'strobe-lights', hint: 'It is dark except for short flashes – a pit, a block, a wide pit, a spike before a spiked bar (hop it low), then a pit.', hazards: [[5, 17, 2, 1], [12, 17, 3, 1], [19, 14, 1, 1], [20, 12, 3, 1], [26, 17, 2, 1]] });
  camZone(b, 2, 27, id, 'strobe', 'unstrobe');
  const X = b.px(0);
  return {
    w: 31,
    win: [run(X + 5 * T - 30), J(), land, run(X + 9 * T - 40), J(), land, run(X + 12 * T - 22), J(), land, run(X + 19 * T - 34), ['RJ', 5], land, run(X + 26 * T - 30), J(), land, run(X + 30 * T)],
    die: [run(X + 5 * T - 30), J(), land, run(X + 9 * T - 40), J(), land, run(X + 12 * T - 22), J(), land, run(X + 19 * T - 34), ['RJ', 5], land, run(X + 21 * T), ['J', 20], ['', 60]],
  };
}

/** TRAP seasick-tilt: the screen rocks from side to side over a climb of uneven platforms. */
function seasickTilt(b) {
  b.ground(0, 2);
  b.fill(3, 4, 17, 17, '^');
  b.fill(5, 7, 13, 17, '#');
  b.fill(8, 9, 17, 17, '^');
  b.fill(10, 11, 11, 17, '#');
  b.fill(12, 14, 17, 17, '^');
  b.fill(15, 17, 14, 17, '#');
  b.fill(18, 19, 17, 17, '^');
  b.ground(20, 25);
  const id = b.troll('The screen rocks like a ship', { type: 'seasick-tilt', hint: 'The screen rocks like a ship and the steps look tilted – they are level: jump up two steps, down one, then across.', hazards: [[3, 17, 2, 1], [8, 17, 2, 1], [12, 17, 3, 1], [18, 17, 2, 1]] });
  camZone(b, 1, 23, id, 'seasick', 'steady', [{ say: 'say.seasick', at: 'hero', ticks: 50 }]);
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 3 * T - 30), J(), land, run(X + 8 * T - 30), J(), land, run(X + 12 * T - 30), J(), land, run(X + 18 * T - 30), J(), land, run(X + 25 * T)],
    die: [run(X + 3 * T - 30), J(), land, run(X + 8 * T - 30), J(8), ['R', 60]],
  };
}

/** TRAP decoy-hero: a fake hero appears and runs back – the camera follows HIM, not you. */
function decoyHero(b) {
  b.ground(0, 30);
  pit(b, 8, 9);
  pit(b, 14, 16);
  b.fill(20, 21, 13, 14, '#');
  pit(b, 24, 26);
  const d = b.group({ tile: 'H', hidden: true });
  b.put(5, 14, d);
  const id = b.troll('The camera follows a fake you', { type: 'decoy-hero', hint: 'A fake you runs back and the camera follows it – follow the yellow arrow: the real you jumps a pit, a wide pit, a block and a wide pit.', hazards: [[8, 17, 2, 1], [14, 17, 3, 1], [24, 17, 3, 1]] });
  b.trigger({ when: { zone: b.rect(5, 2, 1, 13) }, do: [{ show: d }, { move: d, by: [-24, 0], ticks: 200 }, { say: 'say.thatsnotme', at: 'hero', ticks: 60 }], troll: id });
  camZone(b, 5, 23, id, 'decoy', 'undecoy');
  b.triggers[b.triggers.length - 1].do[0].target = d;
  const X = b.px(0);
  return {
    w: 31,
    win: [run(X + 8 * T - 30), J(), land, run(X + 14 * T - 22), J(), land, run(X + 20 * T - 40), J(), land, run(X + 24 * T - 22), J(), land, run(X + 30 * T)],
    die: [run(X + 8 * T - 30), J(), land, run(X + 14 * T - 22), J(), land, run(X + 20 * T - 40), J(), land, ['R', 90]],
  };
}

export default {
  id: 8, slug: 'screen-lies', name: 'Screen Lies', idea: 'The camera lies',
  winMessage: 'Seeing is NOT believing.', deathQuips: ['Where did it go?', 'I saw nothing!', 'Lies!', 'Blind luck... none.'],
  minWidth: 406, style: 'ground',
  traps: [cameraFreeze, tunnelVision, screenFlip, fakeVictory, blackout, screenSmudge, backwardCamera, strobeLights, seasickTilt, decoyHero],
};
