// LEVEL 17 – "Blown Away": wind betrays you. Windy mountain peaks: wind zones (streaks and leaves show which way
// and how hard) push the hero sideways, up or down – harder in the air than on the ground. Fans, vents, gusts that
// come and go, storms, a weather vane, a vacuum pipe, balloons, floating thistles and a windmill (src/game/ext/l17.ts).
// Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

/** an extension group over local tiles: drawn into the map where the air is free, the rest as cover (the hint
 *  highlights them all) */
const airGroup = (b, tiles, def) => {
  const g = b.group(def);
  const cover = [];
  for (const [x, y] of tiles) {
    if ((b.grid[y][x] ?? '.') === '.') b.set(x, y, g);
    else cover.push([x, y]);
  }
  if (cover.length) b.groups[g].cover = cover;
  return g;
};
/** a wind zone (local tiles, fractions allowed) */
const wind = (b, x, y, w, h, o = {}) => {
  const ext = { kind: 'wind', r: b.rect(x, y, w, h), ...o };
  if (o.fan) ext.fan = [b.x0 + o.fan[0], o.fan[1], o.fan[2]];
  if (o.vane) ext.vane = [b.x0 + o.vane[0], o.vane[1]];
  return airGroup(b, b.range(Math.floor(x), Math.ceil(x + w) - 1, Math.floor(y), Math.ceil(y + h) - 1), { tile: '?', ext });
};
/** a spike-lined pit floor over local columns x0..x1 */
const spikePit = (b, x0, x1) => { b.fill(x0, x1, 17, 17, '#'); b.fill(x0, x1, 16, 16, '^'); };
const W = (g) => `s.ext.w.${g}`;
/** n hops holding RIGHT: jump on landing (each held `hold` ticks) */
const hops = (n, hold = 8) => Array.from({ length: n }, () => [['RJ', hold], ['R', 's.grounded']]).flat();

/** TRAP gap-fan: the fan on the far bank blows in bursts – jump the pit right after it stops. */
function gapFan(b) {
  b.ground(0, 5);
  spikePit(b, 6, 9);
  b.ground(10, 16);
  b.put(13, 14, '#');
  const f = wind(b, 5, 9, 8, 6, { vx: -450, ground: 0.5, cycle: { on: 100, off: 90, warn: 30 }, fan: [13, 13, 'l'] });
  const id = b.troll('The fan blows you back into the pit', { type: 'gap-fan', hint: 'The fan on the far side blows in bursts and pushes you back into the spikes – wait until it stops, then jump across at once.' });
  b.groupTroll(f, id);
  b.trigger({ when: { zone: b.rect(4, 10, 2, 5) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 17,
    win: [run(X + 3 * T), ['', `${W(f)} !== 0`], ['', `${W(f)} === 0`], run(X + 6 * T - 14), ['RJ', 16], land, run(X + 13 * T - 40), J(14), land, run(X + 16 * T)],
    die: [run(X + 4 * T), ['', `s.ext.warn.${f} === 1`], run(X + 6 * T - 14), ['RJ', 16], ['R', 120]],
  };
}

/** TRAP vent-updraft: a vent in the pit blows you up – jump and it flings you into the roof spikes: walk off. */
function ventUpdraft(b) {
  b.ground(0, 3);
  spikePit(b, 4, 9);
  b.fill(6, 7, 16, 16, '#');
  b.ground(10, 15);
  b.fill(3, 10, 0, 7, '#');
  b.fill(4, 9, 8, 8, 'v');
  const v = wind(b, 5, 9, 4, 8, { vy: -350, acc: 2500, fan: [6.5, 16, 'u'] });
  const id = b.troll('The updraft flings you into the roof spikes', { type: 'vent-updraft', hint: 'Do not jump over the vent: the updraft would fling you into the roof spikes – just walk off the edge and let it carry you across.' });
  b.groupTroll(v, id);
  b.trigger({ when: { zone: b.rect(4, 9, 6, 6) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 10 * T + 20), ['R', 's.grounded'], run(X + 15 * T)],
    die: [run(X + 4 * T - 14), ['RJ', 16], ['R', 150]],
  };
}

/** TRAP lying-leaves: the leaves fly left, but the wind blows right – hop small onto the island. */
function lyingLeaves(b) {
  b.ground(0, 3);
  spikePit(b, 4, 6);
  b.fill(7, 9, 15, 16, '#');
  spikePit(b, 10, 15);
  b.ground(16, 22);
  const lw = wind(b, 3, 8, 14, 7, { vx: 260, ground: 0, show: -1 });
  const id = b.troll('The leaves lie about the wind', { type: 'lying-leaves', hint: 'The leaves fly left, but the wind really blows right – a tiny hop reaches the island; from there a full jump carries you over the wide pit.' });
  b.groupTroll(lw, id);
  b.trigger({ when: { zone: b.rect(3, 8, 8, 7), airborne: true }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 4 * T - 14), ['RJ', 1], ['R', 's.grounded'], run(X + 10 * T - 14), ['RJ', 16], land, run(X + 22 * T)],
    die: [run(X + 4 * T - 14), ['RJ', 16], ['R', 120]],
  };
}

/** TRAP ground-jet: a jet blows along the ground only – hop all the way, in the air it cannot push you back. */
function groundJet(b) {
  b.ground(0, 2);
  spikePit(b, 3, 5);
  b.ground(6, 26);
  b.put(22, 14, '#');
  const j = wind(b, 6, 14, 16, 1, { vx: -650, ground: 1, fan: [22, 14, 'l'] });
  const id = b.troll('The ground jet blows you back into the pit', { type: 'ground-jet', hint: 'The fan blows a jet along the ground only – keep hopping all the way to it: in the air the jet cannot push you back into the pit.' });
  b.groupTroll(j, id);
  b.trigger({ when: { zone: b.rect(6, 14, 3, 1) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 27,
    win: [run(X + 3 * T - 14), ['RJ', 12], ['R', 's.grounded'], ['R+J?s.grounded || s.vy < -250', `s.x >= ${X + 20 * T}`], ['R', 's.grounded'], run(X + 22 * T - 36), J(14), land, run(X + 26 * T)],
    die: [run(X + 3 * T - 14), ['RJ', 12], ['R', 's.grounded'], ['R', 200]],
  };
}

/** TRAP thistle-grate: spiked thistles float in the updraft over a grate – step on it and they drop: jump over. */
function thistleGrate(b) {
  b.ground(0, 7);
  b.fill(8, 10, 16, 17, '#');
  const grate = b.group({ tile: '#', tint: 0x6e788a, look: 'bolted' });
  b.fill(8, 10, 15, 15, grate);
  b.ground(11, 19);
  const vent = wind(b, 8, 6, 3, 9, { vy: -200, push: false, fan: [9, 15, 'u'] });
  const th = b.group({ tile: '?', cover: [b.tile(8, 8), b.tile(9, 7), b.tile(10, 8), b.tile(11, 9), b.tile(12, 8)], ext: { kind: 'thistle', wind: vent } });
  const id = b.troll('Standing on the grate drops the thistles', { type: 'thistle-grate', hint: 'Spiked thistles float in the updraft over the grate – if you step on the grate you block the air and they drop on you. Jump over the grate.' });
  b.groupTroll(th, id);
  b.trigger({ when: { zone: b.rect(8, 14, 3, 1), grounded: true }, do: [{ ext: 'wind.off', g: vent }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 8 * T - 24), J(16), land, run(X + 19 * T)],
    die: [run(X + 19 * T)],
  };
}

/** TRAP turning-fan: the fan helps you over the first pit, then turns round and sucks you back: hold RIGHT. */
function turningFan(b) {
  b.ground(0, 4);
  spikePit(b, 5, 9);
  b.fill(10, 12, 15, 17, '#');
  spikePit(b, 13, 17);
  b.ground(18, 23);
  const f = wind(b, 3, 9, 15, 6, { vx: 100, ground: 1, fan: [2, 11, 'r'] });
  const id = b.troll('The fan turns round when you are halfway', { type: 'turning-fan', hint: 'The fan blows you over the first pit, but turns round and sucks you back once you land on the middle rock – hold RIGHT to stand your ground until it blows again, then jump.' });
  b.groupTroll(f, id);
  const go = b.uid('fan');
  b.trigger({ id: go, when: { zone: b.rect(10, 14, 3, 1), grounded: true }, do: [{ ext: 'wind.flip', g: f }, { ext: 'wind.set', g: f, args: { vx: -300 } }], troll: id });
  b.trigger({ when: { after: go }, delay: 150, do: [{ ext: 'wind.set', g: f, args: { vx: 100 } }] });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 5 * T - 14), ['RJ', 16], ['R', 's.grounded'], ['R', `${W(f)} > 0`], run(X + 13 * T - 14), ['RJ', 16], land, run(X + 23 * T)],
    die: [run(X + 5 * T - 14), ['RJ', 16], ['R', 's.grounded'], ['', 200]],
  };
}

/** TRAP balloon-rise: the balloon lifts you over the tall wall and on into the thorns – let go (jump) in time. */
function balloonRise(b) {
  b.ground(0, 16);
  b.fill(7, 8, 6, 14, '#');
  b.fill(1, 15, 0, 0, '#');
  b.fill(1, 15, 1, 1, 'v');
  const bl = airGroup(b, [b.tile(4, 14)], { tile: '?', ext: { kind: 'balloon', lift: 170 } });
  const id = b.troll('The balloon never stops rising', { type: 'balloon-rise', hint: 'The balloon lifts you over the tall wall but never stops rising – press jump to let go as soon as you are over the wall.', hazards: [[1, 1, 15, 1]] });
  b.groupTroll(bl, id);
  const X = b.px(0);
  return {
    w: 17,
    win: [run(X + 4 * T), ['R', `s.x >= ${X + 9 * T + 10}`], ['RJ', 2], ['R', 's.grounded'], run(X + 16 * T)],
    die: [run(X + 4 * T), ['R', 400]],
  };
}

/** TRAP crosswind-shaft: a crosswind blows across the shaft into the spiked wall – hold LEFT on the way down. */
function crosswindShaft(b) {
  b.ground(0, 2);
  b.fill(3, 4, 13, 14, '#');
  b.fill(5, 6, 11, 14, '#');
  b.fill(7, 8, 9, 14, '#');
  b.ground(3, 20);
  b.fill(12, 14, 0, 13, '#');
  b.fill(11, 11, 10, 12, '<');
  const c = wind(b, 9, 6, 3, 7, { vx: 280, fan: [8, 11, 'r'] });
  const id = b.troll('The crosswind blows you into the spiked wall', { type: 'crosswind-shaft', hint: 'A crosswind blows across the shaft into the spiked wall – drop in and hold LEFT all the way down, then walk out under the wall.' });
  b.groupTroll(c, id);
  b.trigger({ when: { zone: b.rect(9, 9, 3, 4) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 3 * T - 30), J(16), land, run(X + 5 * T - 30), J(16), land, run(X + 7 * T - 30), J(16), land, run(X + 9 * T + 16), ['L', 's.y > 500'], ['L', 's.grounded'], run(X + 20 * T)],
    die: [run(X + 3 * T - 30), J(16), land, run(X + 5 * T - 30), J(16), land, run(X + 7 * T - 30), J(16), land, run(X + 9 * T + 2), ['R', 120]],
  };
}

/** TRAP still-gust: the wind only blows while you stand still – hop from pillar to pillar without stopping. */
function stillGust(b) {
  b.ground(0, 2);
  spikePit(b, 3, 17);
  b.fill(6, 7, 14, 16, '#');
  b.fill(10, 11, 13, 16, '#');
  b.fill(14, 15, 14, 16, '#');
  b.ground(18, 22);
  const g = wind(b, 3, 8, 15, 7, { vx: -260, ground: 1, still: 18, gust: 70 });
  const id = b.troll('The wind blows only while you stand still', { type: 'still-gust', hint: 'The wind here only blows while you stand still – hop from pillar to pillar without ever stopping.' });
  b.groupTroll(g, id);
  b.trigger({ when: { zone: b.rect(6, 12, 2, 2) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 3 * T - 14), ['RJ', 15], ['R', 's.grounded'], run(X + 8 * T - 14), ['RJ', 9], ['R', 's.grounded'], run(X + 12 * T - 14), ['RJ', 2], ['R', 's.grounded'], run(X + 16 * T - 14), ['RJ', 6], land, run(X + 22 * T)],
    die: [run(X + 3 * T - 14), ['RJ', 15], ['R', 's.grounded'], wait(120)],
  };
}

/** TRAP storm-shelter: storm gusts sweep the plateau – wait behind a rock while one blows. */
function stormShelter(b) {
  b.ground(0, 2);
  spikePit(b, 3, 4);
  b.ground(5, 11);
  b.fill(11, 11, 13, 14, '#');
  spikePit(b, 12, 13);
  b.ground(14, 20);
  b.fill(20, 20, 13, 14, '#');
  spikePit(b, 21, 22);
  b.ground(23, 29);
  const s = wind(b, 3, 8, 23, 7, { vx: -700, ground: 1, shelter: 3, cycle: { on: 90, off: 130, warn: 50 } });
  const id = b.troll('Storm gusts sweep the plateau', { type: 'storm-shelter', hint: 'Storm gusts sweep the plateau – when the leaves start flying, stand right behind the next rock and go on once the gust is over.' });
  b.groupTroll(s, id);
  b.trigger({ when: { zone: b.rect(5, 12, 6, 3) }, do: [], troll: id });
  const X = b.px(0);
  const lull = [['', `${W(s)} !== 0`], ['', `${W(s)} === 0`]];
  return {
    w: 30,
    win: [run(X + 2 * T), ...lull, run(X + 3 * T - 14), J(12), land, run(X + 9 * T + 20), ...lull, ['RJ', 16], land, run(X + 18 * T + 20), ...lull, ['RJ', 16], land, run(X + 29 * T)],
    die: [run(X + 2 * T), ...lull, run(X + 3 * T - 14), J(12), land, run(X + 7 * T), wait(300)],
  };
}

/** TRAP vacuum-hole: the pipe sucks you toward its spiked mouth – brake (hold LEFT) and drop into the gap. */
function vacuumHole(b) {
  b.ground(0, 2);
  b.fill(3, 10, 13, 17, '#');
  b.ground(11, 20);
  b.fill(14, 16, 0, 13, '#');
  b.fill(13, 13, 11, 13, '<');
  const v = wind(b, 5, 9, 9, 4, { vx: 450, ground: 1, off: true, ramp: 6, fan: [14, 12, 'l'] });
  const id = b.troll('The vacuum pipe sucks you into its mouth', { type: 'vacuum-hole', hint: 'The pipe sucks you toward its spiked mouth – hold LEFT to slow down, drop into the gap in front of it and walk through the low tunnel.' });
  b.trigger({ when: { zone: b.rect(5, 9, 2, 4) }, do: [{ ext: 'wind.on', g: v }], troll: id });
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 3 * T - 30), J(16), land, run(X + 6 * T), ['', `s.x >= ${X + 10 * T + 20}`], ['L', 's.y > 560 && s.grounded'], run(X + 20 * T)],
    die: [run(X + 3 * T - 30), J(16), land, run(X + 6 * T), ['R', 150]],
  };
}

/** TRAP hairdryer-platform: the hairdryer on the moving platform blows you off it – ride on top of the dryer. */
function hairdryerPlatform(b) {
  b.ground(0, 3);
  spikePit(b, 4, 15);
  b.ground(16, 21);
  const p = b.group({ tile: '#' });
  b.fill(4, 6, 15, 15, p);
  b.put(6, 14, p);
  const d = wind(b, 4, 14, 2, 1, { vx: -500, ground: 1, off: true, follow: p, fan: [6, 14, 'l'] });
  const id = b.troll('The hairdryer blows you off the platform', { type: 'hairdryer-platform', hint: 'Once the platform moves, the hairdryer on it switches on and blows you off the back – jump up and ride on top of the hairdryer.' });
  const go = b.uid('dryer');
  b.trigger({ id: go, when: { touch: p }, do: [{ move: p, by: [9, 0], ticks: 300 }], troll: id });
  b.trigger({ when: { after: go }, delay: 70, do: [{ ext: 'wind.on', g: d }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 4 * T - 14), ['RJ', 8], ['R', `s.x >= ${X + 6 * T + 10}`], ['', 's.grounded'], ['', `s.g.${p}[0] >= ${9 * T}`], run(X + 17 * T), land, run(X + 21 * T)],
    die: [run(X + 5 * T), wait(200)],
  };
}

/** TRAP gust-ride: the pit is too wide – only the gust from behind carries you over: jump as it starts. */
function gustRide(b) {
  b.ground(0, 4);
  spikePit(b, 5, 10);
  b.ground(11, 19);
  const g = wind(b, 2, 8, 11, 7, { vx: 300, ground: 0, cycle: { on: 55, off: 160, warn: 40 } });
  const id = b.troll('Only the gust carries you over the pit', { type: 'gust-ride', hint: 'The pit is too wide to jump on your own – wait a tile from the edge until the gust from behind starts (the leaves fly past), then run and jump at once.' });
  b.groupTroll(g, id);
  b.trigger({ when: { zone: b.rect(5, 9, 6, 6) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 4 * T), ['', `${W(g)} === 0`], ['', `${W(g)} !== 0`], run(X + 5 * T - 14), ['RJ', 16], land, run(X + 19 * T)],
    die: [run(X + 4 * T), ['', `${W(g)} !== 0`], ['', `${W(g)} === 0`], run(X + 5 * T - 14), ['RJ', 16], ['R', 120]],
  };
}

/** TRAP windmill: the sails sweep the path while the wind blows – walk under them when they stop. */
function windmill(b) {
  b.ground(0, 22);
  const m = airGroup(b, b.range(8, 15, 11, 14), { tile: '?', ext: { kind: 'mill', c: [b.x0 + 11.5, 11.15], r: 170, spin: 100, stop: 110, turns: 2 } });
  const air = wind(b, 0, 4, 23, 11, { vx: -260, push: false, cycle: { on: 100, off: 110 } });
  const id = b.troll('The windmill sails sweep the path', { type: 'windmill', hint: 'The windmill sails sweep the path while the wind blows – wait until the wind drops and the sails stop, then walk under them.' });
  b.groupTroll(m, id);
  b.trigger({ when: { zone: b.rect(7, 12, 2, 3) }, do: [], troll: id });
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 6 * T), ['', `${W(air)} !== 0`], ['', `${W(air)} === 0`], run(X + 22 * T)],
    die: [run(X + 11 * T + 20), wait(220)],
  };
}

/** TRAP air-cushion: two shafts with air cushions – the first one switches off when you drop in. */
function airCushion(b) {
  b.ground(0, 2);
  b.fill(3, 4, 14, 17, '#');
  b.fill(5, 6, 12, 17, '#');
  b.fill(7, 8, 10, 17, '#');
  spikePit(b, 9, 10);
  b.fill(11, 13, 10, 13, '#');
  b.fill(11, 13, 15, 17, '#');
  spikePit(b, 14, 15);
  b.fill(16, 18, 10, 13, '#');
  b.ground(16, 23);
  const brakeA = wind(b, 9, 10, 2, 4.5, { vy: 250, acc: 6000, quiet: true });
  const cushA = wind(b, 9, 14.5, 2, 1.5, { vy: -120, acc: 9000, fan: [9.5, 16, 'u'] });
  const brakeB = wind(b, 14, 10, 2, 4.5, { vy: 250, acc: 6000, quiet: true });
  const cushB = wind(b, 14, 14.5, 2, 1.5, { vy: -120, acc: 9000, fan: [14.5, 16, 'u'] });
  void brakeB; void cushB;
  const id = b.troll('The first air cushion switches off', { type: 'air-cushion', hint: 'The first air cushion switches off as soon as you drop into its shaft – jump over it and drop into the second shaft: its cushion holds you so you can walk out to the right.' });
  b.trigger({ when: { zone: b.rect(9, 10, 2, 4) }, do: [{ ext: 'wind.off', g: brakeA }, { ext: 'wind.off', g: cushA }], troll: id });
  const X = b.px(0);
  const climb = [run(X + 3 * T - 30), J(16), land, run(X + 5 * T - 30), J(16), land, run(X + 7 * T - 30), J(16), land];
  return {
    w: 24,
    win: [...climb, run(X + 9 * T - 14), J(10), land, run(X + 14 * T + 6), ['', 's.y > 560'], ['R', `s.x >= ${X + 17 * T}`], ['R', 's.grounded'], run(X + 23 * T)],
    die: [...climb, run(X + 9 * T + 10), ['', 150]],
  };
}

/** TRAP rising-gale: the headwind in the gorge grows stronger and stronger – run through without stopping. */
function risingGale(b) {
  b.ground(0, 2);
  spikePit(b, 3, 5);
  b.ground(6, 20);
  b.fill(6, 17, 0, 11, '#');
  b.put(10, 14, '#');
  b.put(14, 14, '#');
  const g = wind(b, 3, 8, 15, 7, { vx: -600, ground: 1, off: true, ramp: 1.2 });
  const id = b.troll('The gale in the gorge grows stronger', { type: 'rising-gale', hint: 'Once you are in the gorge the headwind grows stronger and stronger – run straight through and hop the rocks without ever stopping.' });
  b.trigger({ when: { zone: b.rect(6, 12, 2, 3) }, do: [{ ext: 'wind.on', g }], troll: id });
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 3 * T - 14), ['RJ', 14], land, run(X + 10 * T - 34), J(8), land, run(X + 14 * T - 34), J(8), land, run(X + 20 * T)],
    die: [run(X + 3 * T - 14), ['RJ', 14], land, run(X + 8 * T), wait(400)],
  };
}

/** TRAP weather-vane: gusts blow you back off the pillars – the vane turns before each one: jump while it points left. */
function weatherVane(b) {
  b.ground(0, 3);
  spikePit(b, 4, 21);
  b.fill(7, 8, 14, 16, '#');
  b.fill(12, 13, 13, 16, '#');
  b.fill(17, 18, 14, 16, '#');
  b.ground(22, 26);
  const pat = [[0, 120], [-450, 70], [0, 100], [-450, 50], [0, 150], [-450, 80], [0, 110], [-450, 60]];
  const g = wind(b, 4, 7, 18, 8, { ground: 0, pattern: pat, lead: 60, vane: [2, 14] });
  const id = b.troll('The gusts blow you off the pillars', { type: 'weather-vane', hint: 'Gusts blow anyone in the air back into the spikes – the weather vane swings round to the right before each gust: jump only while it points left.' });
  b.groupTroll(g, id);
  b.trigger({ when: { zone: b.rect(4, 8, 4, 7), airborne: true }, do: [], troll: id });
  const X = b.px(0);
  const calm = ['', `${W(g)} === 0 && s.ext.vane.${g} < 0`];
  return {
    w: 27,
    win: [run(X + 3 * T), calm, run(X + 4 * T - 14), ['RJ', 15], ['R', 's.grounded'], wait(2), calm, run(X + 9 * T - 14), ['RJ', 14], ['R', 's.grounded'], wait(2), calm, run(X + 14 * T - 14), ['RJ', 10], ['R', 's.grounded'], wait(2), calm, run(X + 19 * T - 14), ['RJ', 12], land, run(X + 26 * T)],
    die: [run(X + 3 * T), ['', `${W(g)} === 0`], ['', `${W(g)} !== 0`], run(X + 4 * T - 14), ['RJ', 12], ['R', 120]],
  };
}

export default {
  id: 17,
  slug: 'blown-away',
  name: 'Blown Away',
  idea: 'Wind, fans and air betray you',
  winMessage: 'Still standing!',
  deathQuips: ['Gone with the wind.', 'You fly like a brick with wings.', 'Light as a feather, dumb as a rock.', 'That was a breeze. For the wind.', 'Hold on to your hat. And your life.'],
  handmade: true,
  minWidth: 1068,
  traps: [gapFan, ventUpdraft, lyingLeaves, groundJet, thistleGrate, turningFan, balloonRise, crosswindShaft, stillGust, stormShelter, vacuumHole, hairdryerPlatform, gustRide, windmill, airCushion, risingGale, weatherVane],
  between: [
    [isle(3, 2, 2), spikes(4, 3), isle(3, 2, -1), pit(3, 2, 1), thorns(2, 3), up(1, 2), down(2, 2), spikes(3, 3, -1)],
    [thorns(1, 3), isle(3, 2, 2), isle(2, 2, -1), down(1, 3), block(2, 1, 2), roof(5), spikes(4, 3), pit(4, 2)],
    [spikes(3, 2, 1), pit(3, 2, -1), isle(4, 2), thorns(3, 3), pillars(3, 2, [1, -1, 1]), down(1, 3)],
    [up(2, 2), isle(3, 3, 1), spikes(4, 2, -2), down(1, 3), block(1, 3, 2), pit(4, 3)],
    [pit(3, 2, 1), up(1, 2), roof(5, 1), down(2, 3), spikes(4, 1), isle(3, 3, 2), spikes(3, 2, -2), thorns(2, 2)],
    [isle(2, 1, 1), isle(3, 1), isle(3, 2, 1), pit(3, 2, -2), thorns(1, 1), thorns(2, 3), up(1, 3), roof(3), spikes(3, 2, -1), down(0, 2)],
    [block(2, 1, 3), spikes(3, 2, 2), down(1, 2), isle(3, 2, -1), up(2, 2), pit(3, 3), pillars(3, 2, [1, -2, -1])],
    [spikes(2, 1), spikes(3, 2), up(1, 1), isle(4, 3), down(1, 2), thorns(3, 2), pit(3, 2, 2), isle(2, 2, -1), down(1, 4)],
    [roof(2), pit(3, 2, 1), pit(3, 2, 1), spikes(4, 2, -2), thorns(1, 2), isle(3, 3, 1), down(1, 3), spikes(3, 3)],
    [up(1, 3), roof(5, 1), spikes(4, 2, -1), block(2, 2, 2), isle(3, 1, 2), isle(2, 2, -2), thorns(2, 2), pit(4, 4)],
    [thorns(3, 2), isle(2, 2, 1), isle(4, 2, -1), spikes(3, 1, 1), up(1, 3), down(2, 2), pit(3, 2), spikes(3, 4)],
    [isle(3, 2, 2), isle(2, 3), pit(4, 2, -2), roof(5), thorns(2, 2), spikes(3, 2, 1), down(1, 2), block(2, 1, 2)],
    [pillars(2, 1, [1, 1, 1]), spikes(4, 2, -1), down(2, 2), pit(4, 3), isle(3, 2, 1), down(1, 3), thorns(3, 3)],
    [spikes(4, 1), up(2, 3), thorns(2, 1), isle(4, 2, -1), isle(3, 2, -1), thorns(2, 2), block(2, 2, 3), roof(4), spikes(3, 3)],
    [isle(3, 2, 1), isle(3, 2, 1), isle(3, 3, -1), down(1, 2), spikes(4, 3), roof(3, 1), pit(3, 3, 1), down(1, 3)],
    [roof(3), thorns(2, 3), pit(3, 1, 1), spikes(3, 2, -2), isle(3, 2, 1), pit(4, 3), isle(4, 2), block(2, 2, 2)],
    [isle(3, 1, 1), pillars(2, 2, [1, -1]), spikes(3, 2, -1), up(2, 2), isle(3, 2, -1), down(1, 2), thorns(2, 2), pit(4, 3)],
    [spikes(4, 2), thorns(3, 1), isle(3, 3, 2), down(2, 2), pit(4, 2), roof(3), spikes(3, 4)],
  ],
};
