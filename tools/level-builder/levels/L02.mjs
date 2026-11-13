// LEVEL 2 – "Greedy Little Blob": "safe" coins are traps.
import { T, run, J, land, wait } from '../lib.mjs';

/** TRAP biting-coin: a coin lying in a shallow trough turns into a spiky ball when touched. */
function bitingCoin(b) {
  b.ground(0, 4);
  b.fill(5, 7, 16, 17, '#');
  b.ground(8, 12);
  b.put(2, 12, 'o');
  const a = b.group({ tile: 'o', trapCoin: true });
  b.put(6, 15, a);
  b.groupTroll(a, b.troll('A coin in the trough bites', { type: 'biting-coin', hint: 'The coin lying in the trough has teeth – jump over the whole trough.' }));
  const X = b.px(0);
  return { w: 13, win: [run(X + 5 * T - 30), J(), land, run(X + 12 * T)], die: [run(X + 6 * T), ['R', 40]] };
}

/** TRAP coin-arc: spiky coins arc over a pit between two plateaus, exactly where a full jump goes. */
function coinArc(b) {
  b.ground(0, 2);
  b.fill(3, 6, 14, 17, '#');
  b.fill(9, 12, 14, 17, '#');
  b.ground(13, 15);
  b.fill(7, 8, 17, 17, '^');
  const c = b.group({ tile: 'o', trapCoin: true });
  b.fill(5, 10, 10, 10, c);
  b.groupTroll(c, b.troll('The coin arc over the pit bites', { type: 'coin-arc', hint: 'The coins above the pit bite – cross it with a small hop that stays under them.', hazards: [[7, 17, 2, 1]] }));
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 3 * T - 40), J(10), land, run(X + 7 * T - 22), ['RJ', 6], land, run(X + 15 * T)],
    die: [run(X + 3 * T - 40), J(10), land, run(X + 7 * T - 30), J(), ['R', 80]],
  };
}

/** TRAP cursed-coin: the lone coin above a stage makes spikes shoot up all over it. */
function cursedCoin(b) {
  b.ground(0, 15);
  b.fill(3, 12, 14, 14, '#');
  const c = b.group({ tile: 'o' });
  b.put(8, 11, c);
  const s = b.group({ tile: '^', hidden: true });
  b.fill(3, 12, 13, 13, s);
  const id = b.troll('Grabbing the lone coin makes spikes shoot up', { type: 'cursed-coin', hint: 'Do not jump for the lone coin above the stage – walk underneath it.' });
  b.trigger({ when: { touch: c }, do: [{ pop: s }], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 2 * T - 30), J(10), land, run(X + 12 * T), J(10), land, run(X + 15 * T)],
    die: [run(X + 2 * T - 30), J(10), land, run(X + 7 * T - 20), J(), ['R', 90]],
  };
}

/** TRAP coin-trail: a trail of coins leads off the high walkway down into a spike pit. */
function coinTrail(b) {
  b.ground(0, 11);
  b.ground(15, 20);
  b.fill(12, 14, 17, 17, '^');
  b.fill(1, 2, 13, 13, '#');
  b.fill(4, 10, 11, 11, '#');
  for (const [x, y] of [[11, 10], [12, 11], [13, 12], [13, 13]]) b.put(x, y, 'o');
  const id = b.troll('The coin trail leads into a pit', { type: 'coin-trail', hint: 'The coin trail from the high walkway leads into the pit – stay low and jump the pit from the ground.', hazards: [[12, 17, 3, 1]] });
  b.trigger({ when: { zone: b.rect(12, 9, 3, 6), airborne: true }, do: [{ say: 'say.wheee', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 11 * T + 10), J(), land, run(X + 20 * T)],
    die: [run(X + 1 * T - 40), J(), land, run(X + 4 * T - 40), J(), land, run(X + 11 * T), ['R', 90]],
  };
}

/** TRAP coin-wall: a wall of coins blocks the way – only its top row is real money. */
function coinWall(b) {
  b.ground(0, 13);
  b.fill(0, 13, 9, 9, '#');
  b.put(6, 11, 'o');
  b.put(6, 12, 'o');
  const w = b.group({ tile: 'o', trapCoin: true });
  b.fill(6, 6, 13, 14, w);
  b.groupTroll(w, b.troll('Only the top of the coin wall is real', { type: 'coin-wall', hint: 'The lower half of the coin wall bites – jump so you fly through its top half.' }));
  const X = b.px(0);
  return { w: 14, win: [run(X + 5 * T - 40), J(), land, run(X + 13 * T)], die: [run(X + 6 * T), ['R', 40]] };
}

/** TRAP coin-rain: spiky coins rain down in three columns – dash through right after a shower. */
function coinRain(b) {
  b.ground(0, 15);
  b.fill(2, 13, 0, 0, '#');
  const r = b.group({ tile: 'o', trapCoin: true });
  for (const x of [4, 7, 10]) b.put(x, 1, r);
  const id = b.troll('Spiky coins rain from the sky', { type: 'coin-rain', hint: 'Coins rain down in three columns – wait until a shower hits the ground, then dash through.', hazards: [[4, 1, 1, 14], [7, 1, 1, 14], [10, 1, 1, 14]] });
  b.groupTroll(r, id);
  b.trigger({ when: { zone: b.rect(0, 11, 2, 4) }, do: [{ move: r, by: [0, 14], ticks: 26, returnAfter: 0, returnTicks: 1 }], every: 110, stopAt: b.x0 + 16, troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 1 * T), ['', `s.g.${r}[1]>=540`], run(X + 15 * T)],
    die: [run(X + 7 * T), ['', 130]],
  };
}

/** TRAP giant-coin: in a low corridor a coin balloons into a giant spiked coin, then shrinks back. */
function giantCoin(b) {
  b.ground(0, 15);
  b.fill(0, 15, 0, 10, '#');
  const c = b.group({ tile: 'o' });
  b.put(10, 13, c);
  const big = b.group({ tile: '*', hidden: true });
  b.fill(9, 11, 12, 12, big);
  b.fill(9, 11, 14, 14, big);
  b.put(9, 13, big);
  b.put(11, 13, big);
  const mid = b.group({ tile: '*', hidden: true, cover: [b.tile(10, 13)] });
  const id = b.troll('A coin balloons into a giant spiked coin', { type: 'giant-coin', hint: 'The coin in the low corridor puffs up into a giant spiked coin – stop, wait until it shrinks, then go.' });
  const tid = b.uid('g');
  b.trigger({ id: tid, when: { zone: b.rect(6, 11, 2, 4) }, do: [{ hide: c }, { show: big }, { show: mid }, { say: 'say.bigcoin', at: 'hero', ticks: 50 }], troll: id });
  b.trigger({ when: { after: tid }, delay: 110, do: [{ hide: big }, { hide: mid }, { show: c }] });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 6 * T + 10), ['', 115], run(X + 15 * T)],
    die: [run(X + 15 * T)],
  };
}

/** TRAP coin-bomb: a coin in a low tunnel explodes into spikes a moment after you take it. */
function coinBomb(b) {
  b.ground(0, 15);
  b.fill(0, 15, 0, 11, '#');
  b.fill(0, 2, 12, 12, '.');
  b.fill(13, 15, 12, 12, '.');
  const c = b.group({ tile: 'o' });
  b.put(7, 14, c);
  const s = b.group({ tile: '^', hidden: true, cover: [b.tile(7, 14)] });
  b.fill(5, 6, 14, 14, s);
  b.fill(8, 9, 14, 14, s);
  const id = b.troll('The coin explodes into spikes', { type: 'coin-bomb', hint: 'The coin in the tunnel explodes into spikes a moment after you grab it – keep running.' });
  b.trigger({ when: { touch: c }, delay: 28, do: [{ pop: s }, { shake: 6 }, { say: 'say.boom', at: [7, 11], ticks: 40 }], troll: id });
  const X = b.px(0);
  return { w: 16, win: [run(X + 15 * T)], die: [run(X + 7 * T), ['', 90]] };
}

export default {
  id: 2, slug: 'greedy-blob', name: 'Greedy Little Blob', idea: '"Safe" coins are traps',
  winMessage: "Money isn't everything.", deathQuips: ['Greedy!', 'That coin had teeth.', 'Shiny... ouch.', 'Worth it?'],
  minWidth: 284, style: 'ground',
  traps: [bitingCoin, coinArc, cursedCoin, coinTrail, coinWall, coinRain, giantCoin, coinBomb],
};
