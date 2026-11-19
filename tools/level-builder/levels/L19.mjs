// LEVEL 19 – "Fireworks": bombs, fuses, cannons and fireworks betray you on a fireworks night. A bomb's spark runs
// along its fuse, then it goes off: it kills in a radius unless solid ground is in between, and can blow walls away.
// Cannons fire you or cannonballs, mortars lob shells, rockets burst into sparks (src/game/ext/l19.ts).
// Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';
import { COURSES } from './L19-courses.mjs';

/** a fuse path in local tiles → absolute tiles */
const fuse = (b, pts) => pts.map(([x, y]) => [b.x0 + x, y]);
const bombG = (b, ext, tile = '?') => b.group({ tile, ext: { kind: 'fw-bomb', ...ext } });
const L = (g) => `s.ext.l19.b.${g}`;

/** TRAP wall-blast: the bomb at the wall is lit as you come – shelter behind the block, then use the hole it blows. */
function wallBlast(b) {
  b.ground(0, 25);
  b.fill(10, 11, 13, 14, '#');
  const wall = b.group({ tile: '#', look: 'cracked', ext: { kind: 'fw-wall' } });
  b.fill(16, 17, 9, 14, wall);
  b.fill(16, 17, 0, 8, '#');
  const bomb = bombG(b, { r: 6.5, ticks: 110, breaks: [wall], fuse: fuse(b, [[12.4, 14.93], [14.9, 14.93], [15.5, 14.4]]) });
  b.put(15, 14, bomb);
  const id = b.troll('The bomb at the wall is lit as you come', { type: 'wall-blast', hint: 'Coming near the wall lights the bomb in front of it – jump back behind the stone block at once, let the bomb blow the wall open, then go through the hole.' });
  b.trigger({ when: { zone: b.rect(12, 12, 1, 3) }, do: [{ ext: 'l19.light', g: bomb, g2: wall }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 9 * T - 30), J(16), land, run(X + 12 * T + 20), ['L', 10], ['LJ', 16], ['L', 's.grounded'], ['', `${L(bomb)}[1] === 1`], wait(10), run(X + 9 * T - 20), J(16), land, run(X + 25 * T)],
    die: [run(X + 9 * T - 30), J(16), land, run(X + 13 * T + 20), wait(200)],
  };
}

/** TRAP dud-bomb: the "dud" in the tunnel flares up when you come close – wait at the mouth until it goes off. */
function dudBomb(b) {
  b.ground(0, 23);
  b.fill(8, 19, 0, 13, '#');
  const bomb = bombG(b, { r: 3.5, ticks: 160, dud: { at: 0.3, wait: 120 }, near: { r: 4.5, ticks: 30 }, fuse: fuse(b, [[11.6, 14.93], [14.1, 14.93], [14.5, 14.4]]) });
  b.put(14, 14, bomb);
  const id = b.troll('The dud bomb is not a dud', { type: 'dud-bomb', hint: 'The fuse of the bomb in the tunnel goes out, but it flares up when you come close – wait at the tunnel mouth until it goes off by itself, then go on.' });
  b.groupTroll(bomb, id);
  b.trigger({ when: { zone: b.rect(1, 11, 1, 4) }, do: [{ ext: 'l19.light', g: bomb }], troll: id });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 6 * T + 20), ['', `${L(bomb)}[1] === 1`], wait(10), run(X + 23 * T)],
    die: [run(X + 23 * T), wait(60)],
  };
}

/** TRAP sticky-bomb: the bomb in the low passage sticks to you – douse it in the pool straight after. */
const SINK = 's.wet && s.vy > 50 && s.levelTick % 12 < 6';
const swimTo = (px) => [['R+J?' + SINK, `s.x >= ${px}`], ['R+J?s.wet && s.levelTick % 12 < 6', '!s.wet && s.grounded']];
function stickyBomb(b) {
  b.ground(0, 11);
  b.fill(5, 9, 0, 13, '#');
  b.fill(12, 15, 17, 17, '#');
  const pool = b.group({ tile: '~' });
  b.fill(12, 15, 15, 15, pool);
  b.put(12, 16, pool);
  b.put(13, 16, '#');
  b.fill(14, 15, 16, 16, pool);
  b.ground(16, 27);
  const bomb = bombG(b, { sticky: true, r: 1.5, ticks: 200, fuse: fuse(b, [[7.5, 14.3], [7.5, 14.35]]) });
  b.put(7, 14, bomb);
  const id = b.troll('The bomb sticks to you', { type: 'sticky-bomb', hint: 'The bomb in the low passage sticks to you and its fuse starts to burn – drop into the pool right after the passage to put it out, then swim out.' });
  b.groupTroll(bomb, id);
  b.trigger({ when: { zone: b.rect(6, 13, 3, 2) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 12 * T + 10), ['', 's.wet'], ...swimTo(X + 15 * T + 10), run(X + 27 * T)],
    die: [run(X + 12 * T - 14), J(16), land, run(X + 27 * T), wait(240)],
  };
}

/** TRAP kick-bomb: a lit bomb on the plank bridge would blow the bridge away – walk into it to kick it into the gap. */
function kickBomb(b) {
  b.ground(0, 4);
  const bridge = b.group({ tile: '#', look: 'bolted', ext: { kind: 'fw-wall' } });
  b.fill(5, 11, 15, 15, bridge);
  b.fill(14, 19, 15, 15, bridge);
  b.ground(20, 25);
  const bomb = bombG(b, { r: 3, ticks: 90, kick: { vx: 8, vy: 0 }, breaks: [bridge], fuse: fuse(b, [[9.5, 14.3], [9.5, 14.35]]) });
  b.put(9, 14, bomb);
  const id = b.troll('The lit bomb blows the bridge away', { type: 'kick-bomb', hint: 'The bomb lit on the plank bridge would blow the whole bridge away – walk into it to kick it into the gap, stop, wait for the bang, then go on.' });
  b.trigger({ when: { zone: b.rect(5, 12, 1, 3) }, do: [{ ext: 'l19.light', g: bomb, g2: bridge }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 9 * T), wait(20), ['', `${L(bomb)}[1] === 1`], run(X + 12 * T - 14), J(10), land, run(X + 25 * T)],
    die: [run(X + 8 * T - 10), J(10), land, run(X + 12 * T - 14), J(10), land, run(X + 25 * T), wait(60)],
  };
}

/** TRAP ring-burst: a rocket bursts over the path into a ring of sparks – the only safe spot is right under it. */
function ringBurst(b) {
  b.ground(0, 27);
  const tube = b.group({ tile: '?', ext: { kind: 'fw-burst', rise: 30, h: 6, n: 72, v: 4.4, gap: 46, gapUp: 40, grav: 0.16, life: 160 } });
  b.put(14, 14, tube);
  const id = b.troll('The firework rains sparks all around', { type: 'ring-burst', hint: 'The rocket bursts right over the path into a ring of falling sparks – stand right under the burst (by its tube) until they have all gone out.' });
  b.trigger({ when: { zone: b.rect(7, 11, 1, 4) }, do: [{ ext: 'l19.go', g: tube }], troll: id });
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 14 * T + 14), ['', 's.ext.l19.p.length === 0 && s.ext.l19.n.' + tube + ' >= 0 && s.levelTick > 5'], wait(4), ['', 's.ext.l19.p.length === 0'], run(X + 27 * T)],
    die: [run(X + 27 * T), wait(30)],
  };
}

/** TRAP cannon-swing: the cannon fires you at its barrel's angle – climb in only while it points steeply up. */
function cannonSwing(b) {
  b.ground(0, 4);
  b.fill(5, 22, 17, 17, '#');
  b.fill(5, 9, 16, 16, '^');
  b.fill(13, 22, 16, 16, '^');
  b.fill(10, 12, 11, 17, '#');
  b.fill(13, 22, 11, 11, '#');
  b.fill(14, 16, 10, 10, '^');
  b.ground(23, 29);
  const cannon = b.group({ tile: '?', ext: { kind: 'fw-cannon', mode: 'ride', a0: 25, a1: 74, period: 200, v: 1200, hold: 16 } });
  b.put(3, 14, cannon);
  const id = b.troll('The cannon fires you where its barrel points', { type: 'cannon-swing', hint: 'The cannon fires you a moment after you climb in, at the angle its barrel has then – climb in only while it points steeply up, and you land on the pillar.', hazards: [[5, 16, 5, 1], [13, 16, 10, 1], [14, 10, 3, 1]] });
  b.trigger({ when: { zone: b.rect(3, 13, 1, 2) }, do: [{ ext: 'l19.enter', g: cannon }], troll: id });
  const X = b.px(0);
  const A = `s.ext.l19.ang.${cannon}`;
  return {
    w: 30,
    win: [run(X + 2 * T + 6), ['', `${A} <= 30`], ['', `${A} >= 71`], ['R', 's.ext.l19.cap'], ['', '!s.ext.l19.cap'], ['', 's.ext.l19.flight === 0 && s.grounded'],
      run(X + 14 * T - 22), ['RJ', 16], land, run(X + 22 * T + 30), ['', 's.grounded'], run(X + 29 * T)],
    die: [run(X + 2 * T + 6), ['', `${A} >= 66`], ['', `${A} <= 40`], ['R', 's.ext.l19.cap'], wait(200)],
  };
}

/** TRAP ricochet-cannonball: the cannonball you jump comes back off the wall behind you – jump it again. */
function ricochet(b) {
  b.ground(0, 3);
  b.fill(4, 27, 17, 17, '#');
  b.fill(28, 31, 15, 17, '#');
  const cannon = b.group({ tile: '?', ext: { kind: 'fw-cannon', mode: 'balls', every: 9999, count: 1, vel: [-12, 0], grav: 0.5, roll: true, rico: 1, life: 600 } });
  b.put(26, 16, cannon);
  const id = b.troll('The cannonball ricochets back at you', { type: 'ricochet-cannonball', hint: 'Jump the cannonball as it rolls at you – it bounces off the wall behind you and comes back: stop and jump it a second time.' });
  b.trigger({ when: { zone: b.rect(4, 15, 2, 2) }, do: [{ ext: 'l19.go', g: cannon }], troll: id });
  const X = b.px(0);
  const P = 's.ext.l19.p[0]';
  return {
    w: 32,
    win: [run(X + 4 * T + 20), ['R', `${P} && ${P}[0] - s.x < 110`], J(10), land, ['', `${P} && ${P}[2] > 0 && s.x - ${P}[0] < 75`], ['J', 10], ['', 's.grounded'], ['', `!${P} || ${P}[0] > s.x + 40`],
      run(X + 27 * T - 20), J(14), land, run(X + 31 * T)],
    die: [run(X + 4 * T + 20), ['R', `${P} && ${P}[0] - s.x < 110`], J(10), land, run(X + 27 * T - 20), wait(60)],
  };
}

/** TRAP mortar-lead: the mortar lobs its shell where you will be – stop the moment it fires. */
function mortarLead(b) {
  b.ground(0, 29);
  b.fill(26, 27, 8, 8, '#');
  const mortar = b.group({ tile: '?', ext: { kind: 'fw-mortar', flight: 60, every: 120, first: 30, row: 15, r: 1.4, stopAt: b.x0 + 21 } });
  b.put(26, 7, mortar);
  const id = b.troll('The mortar aims where you will be', { type: 'mortar-lead', hint: 'The mortar lobs each shell to where you will be if you keep running – stop dead the moment it fires, let the shell land ahead of you, then run on.' });
  b.trigger({ when: { zone: b.rect(2, 11, 1, 4) }, do: [{ ext: 'l19.go', g: mortar }], troll: id });
  const X = b.px(0);
  const N = `s.ext.l19.n.${mortar}`;
  return {
    w: 30,
    win: [run(X + 2 * T + 20), ['R', `${N} >= 1`], ['', 's.ext.l19.p.length === 0'], ['R', `${N} >= 2 || s.x >= ${X + 21 * T + 20}`], ['', 's.ext.l19.p.length === 0'], run(X + 29 * T)],
    die: [run(X + 29 * T)],
  };
}

/** TRAP barrel-chain: the hanging barrels go off one after another, faster than you run – wait in the gap. */
function barrelChain(b) {
  b.ground(0, 31);
  b.fill(1, 30, 0, 11, '#');
  const barrels = bombG(b, { look: 'barrel', r: 2.6, ticks: 10, chain: { seq: 1, perTile: 4 }, hideCord: true });
  for (const c of [3, 5, 7, 9, 11, 19, 21, 23, 25, 27, 29]) b.put(c, 12, barrels);
  const id = b.troll('The barrels go off one after another', { type: 'barrel-chain', hint: 'Once you are under the barrels they go off one after another from behind you, faster than you can run – stop in the stretch where no barrels hang and let the chain pass.' });
  b.trigger({ when: { zone: b.rect(10, 12, 1, 3) }, do: [{ ext: 'l19.light', g: barrels, args: { i: 0, ticks: 10 } }], troll: id });
  const X = b.px(0);
  return {
    w: 32,
    win: [run(X + 15 * T), ['', `${L(barrels)}[1] === 11`], wait(6), run(X + 31 * T)],
    die: [run(X + 31 * T), wait(30)],
  };
}

/** TRAP pinwheel: the pinwheel lights up as you come and its spark arm sweeps the floor – go while it is up. */
function pinwheel(b) {
  b.ground(0, 23);
  b.fill(12, 12, 14, 14, '^');
  const wheel = b.group({ tile: '?', ext: { kind: 'fw-wheel', L: 3.6, period: 96, phase: 90, dir: -1 } });
  b.put(12, 11, wheel);
  const id = b.troll('The pinwheel sweeps the floor with sparks', { type: 'pinwheel', hint: 'The pinwheel lights up as you come and its spark arm sweeps down across the floor – wait until the arm has just swept past the bottom, then run under it and hop the spike.' });
  b.trigger({ when: { zone: b.rect(6, 11, 1, 4) }, do: [{ ext: 'l19.go', g: wheel }], troll: id });
  const X = b.px(0);
  const A = `((s.ext.l19.ang.${wheel} % 360) + 360) % 360`;
  return {
    w: 24,
    win: [run(X + 6 * T + 20), ['', `${A} > 200 && ${A} < 230`], run(X + 12 * T - 30), J(8), land, run(X + 23 * T)],
    die: [run(X + 6 * T + 20), ['', `${A} > 60 && ${A} < 80`], run(X + 12 * T - 30), J(8), land, run(X + 23 * T), wait(20)],
  };
}

/** TRAP firework-cake: the birthday cake is a firework cake – step back off it and let all its tubes fire. */
function fireworkCake(b) {
  b.ground(0, 25);
  b.fill(8, 17, 13, 14, '#');
  const cake = b.group({ tile: '?', ext: { kind: 'fw-cake', cake: [b.x0 + 8, b.x0 + 17, 13, 14], wait: 40, gap: 5, per: 4, perGap: 5, v: 7, life: 70, order: 'rtl' } });
  b.fill(9, 16, 12, 12, cake);
  const id = b.troll('The birthday cake is a firework cake', { type: 'firework-cake', hint: 'When you step onto the cake its candles light and its tubes fire from the far end toward you – jump back off it and wait until all of them have fired.' });
  b.trigger({ when: { zone: b.rect(9, 10, 2, 3) }, do: [{ ext: 'l19.go', g: cake }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 8 * T - 40), J(14), land, run(X + 9 * T + 24), runL(X + 6 * T), ['', 's.grounded'], ['', `s.ext.l19.n.${cake} >= 32 && s.ext.l19.p.length === 0`], run(X + 8 * T - 40), J(14), land, run(X + 25 * T)],
    die: [run(X + 8 * T - 40), J(14), land, run(X + 12 * T), wait(120)],
  };
}

/** TRAP confetti-bomb: a giant bomb blocks the island – it only pops confetti; fleeing back lands you in spikes. */
function confettiBomb(b) {
  b.ground(0, 2);
  b.fill(3, 5, 13, 17, '#');
  b.fill(6, 9, 17, 17, '#');
  b.fill(6, 9, 16, 16, '^');
  b.fill(10, 16, 15, 17, '#');
  const giant = bombG(b, { look: 'giant', confetti: true, ticks: 150, fuse: fuse(b, [[17.2, 13.6], [16.6, 13.05], [16.05, 13.1]]) }, '#');
  b.fill(15, 16, 13, 14, giant);
  b.fill(15, 16, 0, 12, '#');
  b.ground(17, 21);
  const id = b.troll('A giant bomb is lit next to you', { type: 'confetti-bomb', hint: 'The giant bomb on the island is a joke and only pops confetti – stay where you are and wait; jumping back lands you in the spikes.', hazards: [[6, 16, 4, 1]] });
  b.trigger({ when: { zone: b.rect(10, 13, 4, 2), grounded: true }, do: [{ ext: 'l19.light', g: giant }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 3 * T - 20), J(12), land, run(X + 6 * T - 16), J(14), land, run(X + 12 * T), ['', `${L(giant)}[1] === 1`], wait(20), run(X + 21 * T)],
    die: [run(X + 3 * T - 20), J(12), land, run(X + 6 * T - 16), J(14), land, run(X + 11 * T), ['L', 6], ['LJ', 20], ['L', 60]],
  };
}

/** TRAP roman-candle: the roman candle down the low tunnel fires six times, with a pause after three – count them. */
function romanCandle(b) {
  b.ground(0, 5);
  b.fill(4, 4, 13, 14, '#');
  b.fill(6, 6, 16, 17, '#');
  b.ground(7, 27);
  b.fill(8, 21, 0, 13, '#');
  const candle = b.group({ tile: '?', ext: { kind: 'fw-candle', vel: [-8, 0], mouth: 2, times: [40, 70, 100, 190, 220, 250], life: 300 } });
  b.put(23, 14, candle);
  const id = b.troll('The roman candle only pauses', { type: 'roman-candle', hint: 'The roman candle fires six fireballs down the low tunnel, with a pause after the third – wait in the dip in front of it until the sixth has flown over you, then go.' });
  b.trigger({ when: { zone: b.rect(1, 11, 1, 4) }, do: [{ ext: 'l19.go', g: candle }], troll: id });
  const X = b.px(0);
  const N = `s.ext.l19.n.${candle}`;
  return {
    w: 28,
    win: [run(X + 4 * T - 30), J(14), ['R', `s.x >= ${X + 6 * T + 4}`], ['', 's.grounded'], ['', `${N} >= 6 && s.ext.l19.p.every((q) => q[0] < s.x - 30)`], J(10), land, run(X + 27 * T)],
    die: [run(X + 4 * T - 30), J(14), ['R', `s.x >= ${X + 6 * T + 4}`], ['', 's.grounded'], ['', `${N} >= 3 && s.ext.l19.p.every((q) => q[0] < s.x - 30)`], J(10), land, run(X + 27 * T)],
  };
}

/** TRAP stomp-the-spark: stepping onto the bridge lights a fuse to the keg under it – turn round and stamp it out. */
function stompSpark(b) {
  b.ground(0, 2);
  const bridge = b.group({ tile: '#', look: 'bolted', ext: { kind: 'fw-wall' } });
  b.fill(3, 20, 15, 15, bridge);
  b.ground(21, 25);
  const keg = bombG(b, { look: 'keg', r: 3, ticks: 110, stomp: true, breaks: [bridge], fuse: fuse(b, [[3.05, 14.93], [11.8, 14.93], [12.1, 15.4], [12.4, 16.35]]) });
  b.put(12, 16, keg);
  const id = b.troll('The fuse on the bridge burns to the keg under it', { type: 'stomp-the-spark', hint: 'Stepping onto the bridge lights the fuse behind you, and it burns to the powder keg under the bridge – turn round and step on the spark to stamp it out.' });
  b.trigger({ when: { zone: b.rect(5, 13, 1, 2) }, do: [{ ext: 'l19.light', g: keg, g2: bridge }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 5 * T + 16), ['L', `${L(keg)}[2] === 1`], run(X + 25 * T)],
    die: [run(X + 25 * T), wait(60)],
  };
}

/** TRAP forked-fuse: the fuse forks – one branch runs to a keg behind the stone block; hide in the slot instead. */
function forkedFuse(b) {
  b.fill(0, 12, 15, 17, '#');
  b.fill(13, 13, 17, 17, '#');
  b.fill(14, 27, 15, 17, '#');
  b.fill(9, 10, 13, 14, '#');
  const wall = b.group({ tile: '#', look: 'cracked', ext: { kind: 'fw-wall' } });
  b.fill(20, 21, 9, 14, wall);
  b.fill(20, 21, 0, 8, '#');
  const bombs = bombG(b, {
    each: [
      { look: 'keg', ticks: 100, r: 2.5, fuse: fuse(b, [[15.5, 14.93], [11.05, 14.93], [11.05, 12.95], [8.95, 12.95], [8.6, 14.3]]) },
      { ticks: 140, r: 6.5, breaks: [wall], fuse: fuse(b, [[15.5, 14.93], [18.8, 14.93], [19.5, 14.4]]) },
    ],
  });
  b.put(8, 14, bombs);
  b.put(19, 14, bombs);
  const id = b.troll('The fuse forks to a keg behind the shelter', { type: 'forked-fuse', hint: 'The fuse forks: one branch runs to a powder keg behind the stone block – do not hide there; drop into the slot in the floor and wait for both bangs.' });
  b.trigger({ when: { zone: b.rect(15, 12, 1, 3) }, do: [{ ext: 'l19.light', g: bombs, g2: wall }], troll: id });
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 9 * T - 30), J(16), land, run(X + 13 * T - 14), J(10), land, run(X + 15 * T + 20), ['L', `s.x <= ${X + 13 * T + 26}`], ['', 's.grounded'], ['', `${L(bombs)}[1] === 2`], wait(10),
      J(16), land, run(X + 27 * T)],
    die: [run(X + 9 * T - 30), J(16), land, run(X + 13 * T - 14), J(10), land, run(X + 15 * T + 20), ['L', 6], ['LJ', 18], ['L', 's.grounded'], ['LJ', 16], ['L', `s.x <= ${X + 8 * T + 10}`], ['', 200]],
  };
}

/** TRAP sparkler-fuses: the sparkler lights your way in the dark – and every fuse cord you walk over: hop them. */
function sparklerFuses(b) {
  b.ground(0, 23);
  b.ground(26, 37);
  const sparkler = b.group({ tile: '?', ext: { kind: 'fw-sparkler' } });
  b.put(3, 14, sparkler);
  const bombs = bombG(b, { r: 3, ticks: 14, hideCord: true });
  const cords = b.group({ tile: '?', ext: { kind: 'fw-cord', bomb: bombs, delay: 14 } });
  for (const [x0, x1, bx] of [[7, 8, 9], [13, 15, 16], [19, 20, 21], [29, 31, 32], [34, 35, 36]]) {
    b.fill(x0, x1, 14, 14, cords);
    b.put(bx, 14, bombs);
  }
  const id = b.troll('The sparkler lights the fuses you walk over', { type: 'sparkler-fuses', hint: 'The sparkler lights your way in the dark – and every fuse cord on the floor you walk over, which sets off its bomb: hop over each cord.' });
  b.groupTroll(cords, id);
  b.trigger({ when: { zone: b.rect(3, 12, 1, 3) }, do: [{ ext: 'l19.go', g: sparkler, g2: bombs }, { camera: 'dark' }], troll: id });
  b.trigger({ when: { zone: b.rect(37, 11, 1, 4) }, do: [{ ext: 'l19.stop', g: sparkler }, { camera: 'light' }] });
  const X = b.px(0);
  const hop = (x, n = 10) => [run(X + x * T - 14), J(n), land];
  return {
    w: 38,
    win: [...hop(7, 10), ...hop(13, 12), ...hop(19, 10), ...hop(24, 12), ...hop(29, 12), ...hop(34, 10), run(X + 37 * T + 30)],
    die: [...hop(7, 10), run(X + 15 * T), wait(40)],
  };
}

/** TRAP bridge-shelling: a mortar shoots holes into the bridge just ahead of you – jump each hole as it opens. */
function bridgeShelling(b) {
  b.ground(0, 1);
  b.fill(2, 25, 17, 17, '#');
  b.fill(2, 25, 16, 16, '^');
  b.fill(2, 25, 15, 15, '#');
  const holes = [8, 14, 20].map((c) => {
    const h = b.group({ tile: '#', ext: { kind: 'fw-wall' } });
    b.fill(c, c + 1, 15, 15, h);
    return h;
  });
  b.ground(26, 29);
  const mortar = b.group({ tile: '?', ext: { kind: 'fw-mortar', r: 1.0, grav: 0.4, flight: 28, targets: [
    { t: 2, x: b.x0 + 8.5, y: 15, hide: holes[0] }, { t: 50, x: b.x0 + 14.5, y: 15, hide: holes[1] }, { t: 98, x: b.x0 + 20.5, y: 15, hide: holes[2] },
  ] } });
  b.put(29, 14, mortar);
  const id = b.troll('The mortar shoots holes into the bridge', { type: 'bridge-shelling', hint: 'The mortar at the far end shoots three holes into the bridge just ahead of you – keep running and jump over each hole as it opens.', hazards: [[2, 16, 24, 1]] });
  b.trigger({ when: { zone: b.rect(2, 12, 1, 3) }, do: [{ ext: 'l19.go', g: mortar, g2: holes[0] }], troll: id });
  for (const h of holes) b.groupTroll(h, id);
  const X = b.px(0);
  return {
    w: 30,
    win: [run(X + 8 * T - 14), J(10), land, run(X + 14 * T - 14), J(10), land, run(X + 20 * T - 14), J(10), land, run(X + 29 * T)],
    die: [run(X + 29 * T), wait(30)],
  };
}

/** TRAP blast-wave: you are trapped in the pit room with a lit bomb – let its blast throw you over the wide pit. */
function blastWave(b) {
  b.ground(0, 1);
  b.fill(2, 3, 13, 17, '#');
  b.fill(4, 12, 17, 17, '#');
  b.fill(4, 5, 16, 16, '^');
  b.ground(20, 25);
  const bomb = bombG(b, { r: 0.9, ticks: 80, push: { r: 4.6, vx: 520, vy: 900 }, fuse: fuse(b, [[9.5, 16.3], [9.5, 16.35]]) });
  b.put(9, 16, bomb);
  const id = b.troll('The blast throws you', { type: 'blast-wave', hint: 'The bomb in the pit room is lit as you drop in, and its blast throws you away from it – stand on its right, by the pit, and it throws you over the pit; on its left it throws you into the spikes.', hazards: [[4, 16, 2, 1]] });
  b.trigger({ when: { zone: b.rect(6, 15, 7, 2) }, do: [{ ext: 'l19.light', g: bomb }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 2 * T - 20), J(12), land, run(X + 4 * T - 16), J(16), land, run(X + 11 * T + 20), ['', 's.ext.l19.flight > 0'], ['', 's.ext.l19.flight === 0 && s.grounded'], run(X + 25 * T)],
    die: [run(X + 2 * T - 20), J(12), land, run(X + 4 * T - 16), J(16), land, runL(X + 7 * T), wait(150)],
  };
}

/** TRAP grand-finale: everything goes off – the barrels behind you, the bombs ahead: move from gap to gap in time. */
function grandFinale(b) {
  b.ground(0, 43);
  b.fill(1, 39, 0, 11, '#');
  const barrels = bombG(b, { look: 'barrel', r: 2.6, ticks: 30, chain: { seq: 1, delay: 32 }, hideCord: true });
  for (let c = 2; c <= 38; c += 2) b.put(c, 12, barrels);
  const times = [52, 170, 266, 362, 458];
  const cols = [10, 16, 22, 28, 34];
  // each bomb's fuse is coiled beside it (up and down, stepping left): a wider coil is a longer fuse (1.6 px per tick)
  const zig = (c, ticks) => {
    const segs = Math.max(1, Math.round((ticks * 1.6) / 96));
    const pts = [];
    for (let k = segs; k >= 0; k--) {
      const x = c + 0.3 - 0.24 * k;
      pts.push(...(k % 2 ? [[x, 12.3], [x, 14.7]] : [[x, 14.7], [x, 12.3]]));
    }
    pts.push([c + 0.5, 14.45]);
    return pts;
  };
  const bombs = bombG(b, { r: 2.5, each: cols.map((c, i) => ({ ticks: times[i], fuse: fuse(b, zig(c, times[i])) })) });
  for (const c of cols) b.put(c, 14, bombs);
  const id = b.troll('Everything goes off at once', { type: 'grand-finale', hint: 'Everything is lit at once: the barrels go off behind you one by one and each bomb ahead has a longer fuse – wait in each gap halfway between two bombs until the next bomb has gone off, then run to the next gap.' });
  b.trigger({ when: { zone: b.rect(3, 12, 1, 3) }, do: [{ ext: 'l19.light', g: barrels, args: { i: 0, ticks: 30 } }, { ext: 'l19.light', g: bombs }], troll: id });
  const X = b.px(0);
  const step = (k) => [run(X + (cols[k] - 3) * T + 20), ['', `${L(bombs)}[1] >= ${k + 1}`]];
  return {
    w: 44,
    win: [...step(0), ...step(1), ...step(2), ...step(3), ...step(4), run(X + 43 * T)],
    die: [run(X + 43 * T), wait(30)],
  };
}

const ALL = [wallBlast, dudBomb, stickyBomb, kickBomb, ringBurst, cannonSwing, ricochet, mortarLead, barrelChain, pinwheel, fireworkCake, confettiBomb, romanCandle, stompSpark, forkedFuse, sparklerFuses, bridgeShelling, blastWave, grandFinale];
void flat; void up; void down; void pit; void spikes; void isle; void block; void thorns; void roof; void pillars;

export default {
  id: 19,
  slug: 'fireworks',
  name: 'Fireworks',
  idea: 'Bombs, fuses, cannons and fireworks betray you',
  winMessage: 'What a show!',
  deathQuips: ['Kaboom.', 'You went out with a bang.', 'Ooh! Aah! Ouch.', 'Lit.', 'That was not a sparkler.'],
  handmade: true,
  minWidth: 1412,
  traps: ALL,
  between: COURSES,
};
