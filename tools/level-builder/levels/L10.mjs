// LEVEL 10 – "The Grand Betrayal": moving platforms betray you. Sky islands over a void.
import { T, run, runL, J, land, wait } from '../lib.mjs';

const isl = (b, x0, x1, y = 15) => b.fill(x0, x1, y, y + 1, '#');

/** TRAP shy-platform: the platform slides away when you jump at it – aim further. */
function shyPlatform(b) {
  isl(b, 0, 3);
  isl(b, 13, 16);
  const p = b.group({ tile: '#' });
  b.fill(6, 8, 15, 15, p);
  const id = b.troll('The platform dodges your jump', { type: 'shy-platform', hint: 'The platform slides two tiles away when you jump at it – aim two tiles further than it is.' });
  b.trigger({ when: { zone: b.rect(4, 11, 6, 4), airborne: true }, do: [{ move: p, by: [2, 0], ticks: 8 }, { say: 'say.nope', at: [b.x0 + 7.5, 13.5], ticks: 30 }], troll: id });
  const X = b.px(0);
  return {
    w: 17,
    win: [run(X + 4 * T - 15), J(), land, run(X + 10 * T - 20), J(), land, run(X + 16 * T)],
    die: [run(X + 4 * T - 35), ['RJ', 9], ['R', 120]],
  };
}

/** TRAP blinking-platform: two platforms blink out for a moment every few seconds. */
function blinkingPlatform(b) {
  isl(b, 0, 3);
  isl(b, 14, 17);
  const a = b.group({ tile: '#' });
  b.fill(6, 7, 15, 15, a);
  const c = b.group({ tile: '#' });
  b.fill(10, 11, 15, 15, c);
  const id = b.troll('The platforms blink away', { type: 'blinking-platform', hint: 'The two platforms blink out every few seconds – start hopping right after they come back.' });
  const on = b.uid('blink');
  b.trigger({ id: on, when: { zone: b.rect(1, 10, 1, 5) }, every: 160, stopAt: b.x0 + 15, do: [{ hide: a }, { hide: c }], troll: id });
  b.trigger({ when: { after: on }, delay: 40, every: 160, stopAt: b.x0 + 15, do: [{ show: a }, { show: c }] });
  const X = b.px(0);
  const w8 = [run(X + 3 * T + 10), ['', `s.g.${a}[2]===0`], ['', `s.g.${a}[2]===1`]];
  return {
    w: 18,
    win: [...w8, J(10), land, ['R', 2], J(10), land, run(X + 13 * T - 25), J(10), land, run(X + 17 * T)],
    die: [...w8, ['', 100], J(10), ['', 120]],
  };
}

/** TRAP splitting-platform: land on its left half and that half drops away – jump to the right half. */
function splittingPlatform(b) {
  isl(b, 0, 4);
  isl(b, 15, 19);
  const l = b.group({ tile: '#', look: 'cracked' });
  b.fill(6, 8, 15, 15, l);
  const r = b.group({ tile: '#' });
  b.fill(9, 11, 15, 15, r);
  const id = b.troll('The platform splits under you', { type: 'splitting-platform', hint: 'The left half of the platform drops away when you land on it – jump from the very edge to land on its right half.' });
  b.trigger({ when: { touch: l }, do: [{ fall: l, shake: 4 }, { move: r, by: [1, 0], ticks: 10 }, { say: 'say.split', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T - 6), J(), land, run(X + 12 * T - 4), J(), land, run(X + 19 * T)],
    die: [run(X + 5 * T - 40), J(), ['R', 120]],
  };
}

/** TRAP elevator-spikes: the elevator rises all the way into ceiling spikes – step off at the ledge. */
function elevatorSpikes(b) {
  isl(b, 0, 2);
  b.fill(7, 13, 9, 9, '#');
  isl(b, 14, 17);
  b.fill(3, 6, 4, 4, '#');
  b.fill(3, 5, 5, 5, 'v');
  const p = b.group({ tile: '#' });
  b.fill(3, 5, 15, 15, p);
  const id = b.troll('The elevator rises into ceiling spikes', { type: 'elevator-spikes', hint: 'The elevator goes all the way up into the spikes – jump right onto the ledge on the way up.', hazards: [[3, 5, 3, 1]] });
  b.trigger({ when: { touch: p }, delay: 10, do: [{ move: p, by: [0, -9], ticks: 140, returnAfter: 40, returnTicks: 100 }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 3 * T + 30), ['', `s.g.${p}[1]<=-${5 * T}`], J(), land, run(X + 13 * T + 30), ['R', 's.grounded && s.y>480'], run(X + 17 * T)],
    die: [run(X + 3 * T + 30), ['', 300]],
  };
}

/** TRAP loyal-platform: a platform follows you over a long pit, but slowly – walk, don't run. */
function loyalPlatform(b) {
  isl(b, 0, 2);
  const p = b.group({ tile: '#', follow: { speed: 2.4, min: 0, max: 15 } });
  b.fill(3, 4, 15, 15, p);
  isl(b, 21, 25);
  const id = b.troll('The loyal platform cannot keep up', { type: 'loyal-platform', hint: 'The platform follows you across the pit, but slowly – walk in short steps and stay above it.' });
  b.groupTroll(p, id);
  b.trigger({ when: { touch: p }, do: [{ say: 'say.wait', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  const cx = X + 4 * T;
  const steps = [];
  for (let i = 0; i < 40; i++) steps.push(['R', `s.x >= ${cx} + s.g.${p}[0] + 20 || s.g.${p}[0] >= ${15 * T - 2}`], ['', `Math.abs(s.x - (${cx} + s.g.${p}[0])) < 8 || s.g.${p}[0] >= ${15 * T - 2}`]);
  return {
    w: 26,
    win: [run(X + 4 * T), ...steps, run(X + 20 * T - 30), J(10), land, run(X + 25 * T)],
    die: [run(X + 4 * T), ['R', 160]],
  };
}

/** TRAP ferris-wheel: ride the wheel over the top, step off on the right before it dips into spikes. */
function ferrisWheel(b) {
  isl(b, 0, 4);
  isl(b, 14, 18);
  b.fill(8, 10, 16, 16, '^');
  const r = 3.5;
  const pa = b.group({ tile: '#', orbit: { r, period: 300, phase: 0 } });
  b.fill(12, 13, 14, 14, pa);
  const pb = b.group({ tile: '#', orbit: { r, period: 300, phase: Math.PI } });
  b.fill(5, 6, 14, 14, pb);
  const id = b.troll('The ferris wheel dips into spikes', { type: 'ferris-wheel', hint: 'Step onto a wheel platform as it comes up past the left island, ride it over the top and step off onto the right island before it dips into the spikes.', hazards: [[8, 16, 3, 1]] });
  b.groupTroll(pa, id);
  b.groupTroll(pb, id);
  for (const g of [pa, pb]) b.trigger({ when: { touch: g }, do: [{ say: 'say.wheee', at: 'hero', ticks: 30 }], troll: id });
  const X = b.px(0);
  const R = r * T;
  // board when the left platform comes up from below, just under the island's level
  const board = `s.g.${pb}[1] <= 76 && s.g.${pb}[1] >= 60 && s.g.${pb}[0] < 26`;
  return {
    w: 19,
    win: [run(X + 4 * T + 10), ['', board], ['R', 10], ['', `s.g.${pb}[0] >= ${2 * R - 6}`], run(X + 18 * T)],
    die: [run(X + 4 * T + 10), ['', board], ['R', 10], ['', 400]],
  };
}

/** TRAP shuttle-dive: the shuttle platform dives into the void halfway – jump off before it does. */
function shuttleDive(b) {
  isl(b, 0, 3);
  isl(b, 15, 18);
  const p = b.group({ tile: '#' });
  b.fill(4, 6, 15, 15, p);
  const sid = b.uid('shuttle');
  const id = b.troll('The shuttle dives into the void', { type: 'shuttle-dive', hint: 'The moving platform dives halfway across – jump to the far island before it does.' });
  b.trigger({ id: sid, when: { touch: p }, do: [{ move: p, by: [8, 0], ticks: 96 }], troll: id });
  b.trigger({ when: { after: sid }, delay: 60, do: [{ move: p, by: [0, 7], ticks: 30 }] });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 4 * T + 10), ['R', `s.x >= ${X + 7 * T - 16} + s.g.${p}[0]`], ['', `s.g.${p}[0]>=${4 * T}`], J(), land, run(X + 18 * T)],
    die: [run(X + 4 * T + 10), ['', 200]],
  };
}

/** TRAP flip-platform: the platform turns over every few seconds – then its spikes are on top. */
function flipPlatform(b) {
  isl(b, 0, 3);
  isl(b, 14, 18);
  const p = b.group({ tile: '#', look: 'bolted' });
  b.fill(7, 10, 15, 15, p);
  const under = b.group({ tile: 'v' });
  b.fill(7, 10, 16, 16, under);
  const top = b.group({ tile: '^', hidden: true });
  b.fill(7, 10, 14, 14, top);
  const id = b.troll('The platform flips its spikes up', { type: 'flip-platform', hint: 'The platform turns over every few seconds and its spikes come up top – cross right after it turns back.' });
  const fid = b.uid('flip');
  b.trigger({ id: fid, when: { zone: b.rect(1, 10, 1, 5) }, every: 130, stopAt: b.x0 + 15, do: [{ show: top }, { hide: under }, { say: 'say.flipover', at: [b.x0 + 8.5, 12], ticks: 30 }], troll: id });
  b.trigger({ when: { after: fid }, delay: 55, every: 130, stopAt: b.x0 + 15, do: [{ hide: top }, { show: under }] });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 4 * T - 30), ['', `s.g.${top}[2]===1`], ['', `s.g.${top}[2]===0`], J(), land, run(X + 11 * T - 30), J(), land, run(X + 18 * T)],
    die: [run(X + 4 * T - 30), ['', `s.g.${top}[2]===1`], J(), ['R', 150]],
  };
}

/** TRAP pulley-platforms: two platforms on a pulley – yours sinks toward spikes while the other rises. */
function pulleyPlatforms(b) {
  isl(b, 0, 3);
  b.fill(4, 12, 17, 17, '^');
  const a = b.group({ tile: '#' });
  const c = b.group({ tile: '#' });
  b.groups[a].pulley = { partner: c, speed: 1, range: 3 };
  b.fill(4, 6, 15, 15, a);
  b.fill(10, 12, 15, 15, c);
  isl(b, 16, 20, 13);
  const id = b.troll('The pulley sinks you into spikes', { type: 'pulley-platforms', hint: 'The two platforms hang on a pulley: yours sinks while the other rises – jump across as soon as it is a bit higher, then straight on to the high island.', hazards: [[4, 17, 9, 1]] });
  b.groupTroll(a, id);
  b.groupTroll(c, id);
  b.trigger({ when: { touch: a }, do: [{ say: 'say.oops', at: 'hero', ticks: 30 }], troll: id });
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 5 * T + 20), ["", `s.g.${c}[1] <= -24`], run(X + 7 * T - 8), J(), land, run(X + 13 * T - 24), J(), land, run(X + 20 * T)],
    die: [run(X + 5 * T + 20), ['', 300]],
  };
}

/** TRAP teleporting-platform: the platform blinks out and reappears 4 tiles on – jump as it blinks. */
function teleportingPlatform(b) {
  isl(b, 0, 3);
  isl(b, 17, 21);
  const p = b.group({ tile: '#' });
  b.fill(5, 6, 15, 15, p);
  const id = b.troll('The platform teleports away under you', { type: 'teleporting-platform', hint: 'The platform blinks out and reappears 4 tiles further – stand on it and jump forward the moment it blinks, then again.' });
  const zone = { zone: b.rect(1, 10, 1, 5) };
  const cyc = { every: 210, stopAt: b.x0 + 18 };
  b.trigger({ when: zone, delay: 60, ...cyc, do: [{ hide: p }], troll: id });
  b.trigger({ when: zone, delay: 70, ...cyc, do: [{ move: p, by: [4, 0], ticks: 1 }, { show: p }] });
  b.trigger({ when: zone, delay: 130, ...cyc, do: [{ hide: p }] });
  b.trigger({ when: zone, delay: 140, ...cyc, do: [{ move: p, by: [4, 0], ticks: 1 }, { show: p }] });
  b.trigger({ when: zone, delay: 200, ...cyc, do: [{ hide: p }] });
  b.trigger({ when: zone, delay: 210, ...cyc, do: [{ move: p, by: [-8, 0], ticks: 1 }, { show: p }] });
  const X = b.px(0);
  const at = (k) => `s.g.${p}[0]===${k * 4 * T} && s.g.${p}[2]===1`;
  return {
    w: 22,
    win: [run(X + 3 * T + 20), ['', at(0)], ['RJ', 6], ['', 's.grounded'], run(X + 6 * T), ['', `s.g.${p}[2]===0`], J(), ['R', 's.grounded'], runL(X + 10 * T + 10), ['', `s.g.${p}[2]===0`], J(), ['R', 's.grounded'], run(X + 15 * T - 34), J(), land, run(X + 21 * T)],
    die: [run(X + 3 * T + 20), ['', at(0)], ['RJ', 6], ['', 's.grounded'], ['', 120]],
  };
}

export default {
  id: 10, slug: 'grand-betrayal', name: 'The Grand Betrayal', idea: 'Moving platforms betray you',
  winMessage: 'You out-trolled them all!', deathQuips: ['Betrayed!', 'Not again...', 'Trust issues.', 'Almost!'],
  minWidth: 402, style: 'sky',
  traps: [shyPlatform, blinkingPlatform, splittingPlatform, elevatorSpikes, loyalPlatform, ferrisWheel, shuttleDive, flipPlatform, pulleyPlatforms, teleportingPlatform],
};
