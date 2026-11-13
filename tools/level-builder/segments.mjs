// Troll set-pieces ("segments") for the level builder. Every level has its OWN segments
// and its own trap types – no trap type is used by two levels (the validator checks this).
//
// A segment draws itself into the level at the builder's cursor and returns:
//   w      – width in tiles
//   win    – bot plan steps that get through it (x conditions are absolute pixels)
//   traps  – { name: steps } that walk into its troll and must die (optional)
// Plan steps are [keys, until]: keys from "L","R","J"; until = ticks or an expression over
// the sim state `s` (x, y, vx, vy, grounded, gravity, g.<group> = [ox, oy, visible] …).
//
// Most segments start and end on ground rows 15-17 (the hero stands at y = 600); sky levels
// use islands over a bottomless void (falling out of the level kills).

const T = 40;
const run = (px) => ['R', `s.x>=${px}`];
const runL = (px) => ['L', `s.x<=${px}`];
const J = (n = 16) => ['RJ', n];
const land = ['R', 's.grounded'];

// ---------------------------------------------------------------------------
// Shared pieces (not traps)

export function start(b, { tutorial = false, sky = false } = {}) {
  if (sky) b.fill(0, 7, 13, 17, '#');
  else b.ground(0, 7);
  b.put(2, sky ? 12 : 14, 'P');
  if (tutorial) {
    b.tutorial(2, 10, '← →  move');
    b.tutorial(6, 9, 'SPACE / ▲  jump');
    b.put(6, 14, '#');
    const X = b.px(0);
    return { w: 8, win: [run(X + 5 * T), J(12), land, run(X + 7 * T)] };
  }
  return { w: 8, win: [] };
}

export function checkpoint(b, { sky = false } = {}) {
  if (sky) b.fill(0, 4, 13, 17, '#');
  else b.ground(0, 4);
  b.put(2, sky ? 12 : 14, 'C');
  return { w: 5, win: [] };
}

export function end(b, { sky = false } = {}) {
  if (sky) b.fill(0, 7, 13, 17, '#');
  else b.ground(0, 7);
  b.doorAt(5, sky ? 12 : 14);
  return { w: 8, win: [['R', 's.state!=="play"']] };
}

/** Plain ground (connector). */
export function flat(b, w = 4) {
  b.ground(0, w - 1);
  return { w, win: [] };
}

// ===========================================================================
// LEVEL 1 – "Hello, Floor": the floor is not what it seems (tutorial, open meadow)

/** Meadow connector: gentle 1-tile bumps (no traps). */
export function meadow(b, { w = 10 } = {}) {
  b.ground(0, w - 1);
  b.put(4, 14, '#');
  const X = b.px(0);
  return { w, win: [run(X + 3 * T), J(10), land, run(X + (w - 1) * T)] };
}

/** TRAP sinking-step: the floor sags one tile under you (harmless; hop out). */
export function l1Sink(b) {
  b.ground(0, 2);
  b.ground(5, 8);
  b.fill(3, 4, 17, 17, '.');
  const g = b.group({ tile: '#', cover: b.range(3, 4, 17, 17) });
  b.fill(3, 4, 15, 16, g);
  const id = b.troll('The floor sags under you', { type: 'sinking-step', x: 3, w: 2, hint: 'The floor ahead sags a little – it is harmless, just hop back out.' });
  b.trigger({ when: { touch: g }, do: [{ move: g, by: [0, 1], ticks: 20 }, { say: 'oops!', at: 'hero', ticks: 50 }], troll: id });
  const X = b.px(0);
  return { w: 9, win: [run(X + 3 * T + 20), ['', 's.grounded && s.y>=620'], ['', 20], J(), land, run(X + 8 * T)] };
}

/** TRAP fake-floor: two floor tiles are fake – you drop onto spikes one tile below. */
export function l1Fake(b) {
  b.ground(0, 2);
  b.ground(5, 8);
  b.fill(3, 4, 17, 17, '#');
  b.fill(3, 4, 16, 16, '^');
  const g = b.group({ tile: '#', fake: true, cover: b.range(3, 4, 16, 16) });
  b.fill(3, 4, 15, 15, g);
  const name = 'Two fake floor tiles over spikes';
  b.groupTroll(g, b.troll(name, { type: 'fake-floor', x: 3, w: 2, hint: 'Two floor tiles ahead are fake – jump over them.' }));
  const X = b.px(0);
  return { w: 9, win: [run(X + 3 * T - 40), J(), land, run(X + 8 * T)], traps: { [name]: [run(X + 4 * T), ['', 60]] } };
}

/** TRAP collapsing-floor: cracked floor crumbles a moment after you step on it – keep moving. */
export function l1Collapse(b, { shake = 26 } = {}) {
  b.ground(0, 2);
  b.ground(5, 8);
  b.fill(3, 4, 17, 17, '#');
  b.fill(3, 4, 16, 16, '^');
  const g = b.group({ tile: '#', look: 'cracked', cover: b.range(3, 4, 16, 16) });
  b.fill(3, 4, 15, 15, g);
  const name = 'Cracked floor crumbles if you stop on it';
  b.trigger({ when: { touch: g }, do: [{ fall: g, shake }], troll: b.troll(name, { type: 'collapsing-floor', x: 3, w: 2, hint: 'The cracked floor crumbles a moment after you step on it – do not stop.' }) });
  const X = b.px(0);
  return { w: 9, win: [run(X + 8 * T)], traps: { [name]: [run(X + 3 * T + 20), ['', 90]] } };
}

/** TRAP crumbling-bridge: a long bridge whose pieces drop one after another. */
export function l1Bridge(b) {
  b.ground(0, 1);
  b.ground(10, 12);
  b.fill(2, 9, 17, 17, '#');
  b.fill(2, 9, 16, 16, '^');
  const name = 'The bridge crumbles behind you';
  const id = b.troll(name, { type: 'crumbling-bridge', x: 2, w: 8, hint: 'The bridge crumbles piece by piece – keep running across.' });
  for (let x = 2; x <= 8; x += 2) {
    const g = b.group({ tile: '#', look: 'cracked' });
    b.fill(x, x + 1, 15, 15, g);
    b.trigger({ when: { touch: g }, do: [{ fall: g, shake: 16 }], troll: id });
  }
  const X = b.px(0);
  return { w: 13, win: [run(X + 12 * T)], traps: { [name]: [run(X + 5 * T), ['', 90]] } };
}

// ===========================================================================
// LEVEL 2 – "Greedy Little Blob": "safe" coins are traps (upper & lower routes)

/** Two routes: a raised walkway with genuine coins over the lower path (no traps). */
export function l2Routes(b) {
  b.ground(0, 15);
  b.fill(2, 3, 13, 13, '#');
  b.fill(5, 12, 11, 11, '#');
  for (const x of [6, 8, 10]) b.put(x, 9, 'o');
  const X = b.px(0);
  return { w: 16, win: [run(X + 15 * T)] };
}

/** TRAP biting-coin: a coin on the floor turns into a spiky ball when you touch it. */
export function l2Bite(b) {
  b.ground(0, 9);
  b.put(2, 12, 'o');
  const a = b.group({ tile: 'o', trapCoin: true });
  b.put(6, 14, a);
  const name = 'A coin on the floor bites';
  b.groupTroll(a, b.troll(name, { type: 'biting-coin', x: 6, w: 1, hint: 'The coin on the floor ahead has teeth – jump over it.' }));
  const X = b.px(0);
  return { w: 10, win: [run(X + 6 * T - 35), ['RJ', 8], land, run(X + 9 * T)], traps: { [name]: [run(X + 6 * T), ['R', 40]] } };
}

/** TRAP coin-arc: spiky coins arc over a pit exactly where a full jump goes – hop under. */
export function l2Arc(b) {
  b.ground(0, 2);
  b.ground(5, 9);
  b.fill(3, 4, 17, 17, '#');
  b.fill(3, 4, 16, 16, '^');
  const c = b.group({ tile: 'o', trapCoin: true });
  b.fill(1, 6, 11, 11, c);
  const name = 'The coin arc over the pit bites';
  b.groupTroll(c, b.troll(name, { type: 'coin-arc', x: 1, w: 6, hint: 'The coins over the pit bite – use a small jump to pass under them.' }));
  const X = b.px(0);
  return { w: 10, win: [run(X + 3 * T - 25), ['RJ', 6], land, run(X + 9 * T)], traps: { [name]: [run(X + 3 * T - 30), J(), ['R', 80]] } };
}

/** TRAP cursed-coin: jumping for the lone coin makes spikes shoot up all around you. */
export function l2Cursed(b) {
  b.ground(0, 13);
  const c = b.group({ tile: 'o' });
  b.put(7, 12, c);
  const s = b.group({ tile: '^', hidden: true });
  b.fill(3, 11, 14, 14, s);
  const name = 'Grabbing the lone coin makes spikes shoot up';
  b.trigger({ when: { touch: c }, do: [{ pop: s }], troll: b.troll(name, { type: 'cursed-coin', x: 3, w: 9, hint: 'Do not jump for the lone coin – just walk underneath it.' }) });
  const X = b.px(0);
  return { w: 14, win: [run(X + 13 * T)], traps: { [name]: [run(X + 6 * T - 20), J(), ['R', 90]] } };
}

/** TRAP coin-trail: a trail of coins leads off the raised walkway straight into a pit. */
export function l2Trail(b) {
  b.ground(0, 11);
  b.ground(15, 20);
  b.fill(12, 14, 17, 17, '#');
  b.fill(12, 14, 16, 16, '^');
  b.fill(1, 2, 13, 13, '#');
  b.fill(4, 10, 11, 11, '#');
  for (const [x, y] of [[11, 10], [12, 11], [12.5, 12], [13, 13]]) b.put(x, y, 'o');
  const name = 'The coin trail leads into a pit';
  b.trigger({ when: { zone: b.rect(12, 11, 3, 4), airborne: true }, do: [{ say: 'wheee...', at: 'hero', ticks: 40 }], troll: b.troll(name, { type: 'coin-trail', x: 11, w: 4, hint: 'The coin trail leads into the pit – stay on the lower path and jump the pit.' }) });
  const X = b.px(0);
  return {
    w: 21,
    win: [run(X + 12 * T - 45), J(), land, run(X + 20 * T)],
    traps: { [name]: [run(X + 1 * T - 40), J(), land, run(X + 4 * T - 40), J(), land, run(X + 11 * T), ['R', 90]] },
  };
}

// ===========================================================================
// LEVEL 3 – "Spring Fever": springs (sky islands over a bottomless void)

/** Island hop: islands separated by a void gap (no traps). */
export function l3Islands(b, { gap = 2, w = 6 } = {}) {
  b.fill(0, w - 1, 13, 17, '#');
  b.fill(w + gap, w + gap + 3, 13, 17, '#');
  const X = b.px(0);
  return { w: w + gap + 4, win: [run(X + w * T - 40), J(), land, run(X + (w + gap + 3) * T)] };
}

/** TRAP spring-ceiling: the spring shoots you into ceiling spikes – steer back through the gap. */
export function l3Ceiling(b) {
  b.fill(0, 10, 13, 17, '#');
  b.fill(20, 24, 13, 17, '#');
  b.fill(0, 5, 5, 5, '#');
  b.fill(9, 19, 5, 5, '#');
  b.fill(9, 14, 6, 6, 'v');
  const p = b.group({ tile: '=' });
  b.put(8, 12, p);
  const name = 'The spring shoots you into ceiling spikes';
  b.groupTroll(p, b.troll(name, { type: 'spring-ceiling', x: 6, w: 9, hint: 'After the spring, hold BACK (left) to fly up through the gap.' }));
  const X = b.px(0);
  return {
    w: 25,
    win: [['R', 's.vy<-1000'], ['L', 's.grounded'], run(X + 5 * T - 30), J(), land, run(X + 19 * T + 30), ['R', 's.grounded && s.y>400'], run(X + 24 * T)],
    traps: { [name]: [['R', 's.vy<-1000'], ['R', 100]] },
  };
}

/** TRAP dud-spring: the first floating spring is a dud; the real one is further on. */
export function l3Dud(b) {
  b.fill(0, 4, 13, 17, '#');
  b.fill(14, 18, 13, 17, '#');
  const d = b.group({ tile: '=', dud: true });
  b.put(6, 12, d);
  const r = b.group({ tile: '=' });
  b.put(8, 12, r);
  const name = 'The first spring is a dud';
  b.groupTroll(d, b.troll(name, { type: 'dud-spring', x: 6, w: 1, hint: 'The first (rusty) spring is a dud – jump past it onto the red one.' }));
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 4 * T - 10), J(), ['R', 's.vy<-1000'], ['R', 's.grounded'], run(X + 18 * T)],
    traps: { [name]: [run(X + 4 * T - 10), ['RJ', 6], ['R', 120]] },
  };
}

/** TRAP sideways-spring: a sideways spring flings you into a spiked overhang. */
export function l3Side(b) {
  b.fill(0, 14, 13, 17, '#');
  b.fill(18, 22, 13, 17, '#');
  const p = b.group({ tile: '=', launch: [950, -650] });
  b.put(4, 12, p);
  b.fill(10, 12, 8, 9, '#');
  b.fill(10, 10, 10, 11, '<');
  const name = 'A sideways spring flings you into spikes';
  b.groupTroll(p, b.troll(name, { type: 'sideways-spring', x: 4, w: 7, hint: 'The blue spring flings you sideways into spikes – jump over it.' }));
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 4 * T - 40), J(10), land, run(X + 15 * T - 40), J(), land, run(X + 22 * T)],
    traps: { [name]: [run(X + 4 * T + 10), ['R', 100]] },
  };
}

/** TRAP hidden-spring: a spring pops out of the floor and launches you into ceiling spikes. */
export function l3Hidden(b) {
  b.fill(0, 13, 13, 17, '#');
  b.fill(3, 10, 4, 4, '#');
  b.fill(3, 10, 5, 5, 'v');
  const p = b.group({ tile: '=', hidden: true });
  b.put(6, 12, p);
  const name = 'A spring pops out of the floor';
  b.trigger({ when: { zone: b.rect(6, 11, 1, 2), grounded: true }, do: [{ show: p }], troll: b.troll(name, { type: 'hidden-spring', x: 6, w: 1, hint: 'A spring hides in the floor under the spiky ceiling – jump over the middle.' }) });
  const X = b.px(0);
  return { w: 14, win: [run(X + 5 * T - 20), J(10), land, run(X + 13 * T)], traps: { [name]: [run(X + 7 * T), ['R', 80]] } };
}

// ===========================================================================
// LEVEL 4 – "Heavy Ceiling": falling ceilings (caves; the level has a rock ceiling)

/** Cave connector: stalactite decor high above (no traps). */
export function l4Cave(b, { w = 8 } = {}) {
  b.ground(0, w - 1);
  b.fill(1, w - 2, 3, 3, '#');
  b.put(3, 14, '#');
  const X = b.px(0);
  return { w, win: [run(X + 2 * T), J(10), land, run(X + (w - 1) * T)] };
}

/** TRAP crusher-slab: the ceiling slams down; the bolted spiky part is the safe spot. */
export function l4Crusher(b) {
  b.ground(0, 21);
  const a = b.group({ tile: '#' });
  b.fill(0, 5, 9, 10, a);
  b.fill(9, 21, 9, 10, a);
  const safe = b.group({ tile: '#', look: 'bolted' });
  b.fill(6, 8, 9, 10, safe);
  b.fill(6, 8, 11, 11, 'v');
  const name = 'The ceiling slab slams down';
  const id = b.troll(name, { type: 'crusher-slab', x: 0, w: 22, hint: 'The whole ceiling falls – hide under the bolted part with the spikes.' });
  const rid = b.uid('rumble');
  b.trigger({ id: rid, when: { zone: b.rect(11, 11, 2, 4) }, do: [{ shake: 4, ticks: 34 }, { say: 'rumble...', at: [b.x0 + 13, 10], ticks: 34 }, { scare: true }], troll: id });
  b.trigger({ when: { after: rid }, delay: 34, do: [{ move: a, by: [0, 4], ticks: 14, deadly: true, returnAfter: 50, returnTicks: 40 }] });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 11 * T - 12), runL(X + 7.5 * T), ['', 150], run(X + 21 * T)],
    traps: { [name]: [run(X + 21 * T), ['R', 200]] },
  };
}

/** TRAP dropping-ceiling-spikes: a row of ceiling spikes drops on you – wait for it to rise. */
export function l4Drop(b) {
  b.ground(0, 13);
  b.fill(2, 11, 5, 5, '#');
  const g = b.group({ tile: 'v' });
  b.fill(5, 8, 6, 6, g);
  const name = 'Ceiling spikes drop on you';
  b.trigger({ when: { zone: b.rect(3, 8, 2, 7), grounded: true }, do: [{ say: '!', at: [b.x0 + 6.5, 4.2], ticks: 30 }, { move: g, by: [0, 8], ticks: 30, deadly: true, returnAfter: 50, returnTicks: 40 }], troll: b.troll(name, { type: 'dropping-ceiling-spikes', x: 3, w: 6, hint: 'Those ceiling spikes drop – step back and wait until they go up again.' }) });
  const X = b.px(0);
  return { w: 14, win: [run(X + 3 * T - 13), ['', 130], run(X + 12 * T)], traps: { [name]: [run(X + 12 * T), ['R', 120]] } };
}

/** TRAP thwomp: a ceiling block slams down in a rhythm – time it. */
export function l4Thwomp(b) {
  b.ground(0, 11);
  b.fill(3, 8, 3, 4, '#');
  const g = b.group({ tile: '#', look: 'bolted' });
  b.fill(5, 6, 5, 10, g);
  const name = 'A ceiling block slams down in rhythm';
  b.trigger({ when: { zone: b.rect(4, 8, 1, 7) }, every: 150, do: [{ move: g, by: [0, 4], ticks: 10, deadly: true, returnAfter: 40, returnTicks: 50 }], troll: b.troll(name, { type: 'thwomp', x: 4, w: 4, hint: 'The block slams in a rhythm – wait for it to rise, then go.' }) });
  const X = b.px(0);
  return { w: 12, win: [run(X + 4 * T - 12), ['', 70], run(X + 10 * T)], traps: { [name]: [run(X + 10 * T), ['R', 100]] } };
}

/** TRAP tunnel-ceiling-spikes: a low tunnel ceiling hides spikes – only small hops survive. */
export function l4Tunnel(b) {
  b.ground(0, 17);
  b.fill(2, 15, 9, 10, '#');
  b.fill(5, 6, 15, 16, '.'); b.fill(5, 6, 16, 16, '^');
  b.fill(10, 11, 15, 16, '.'); b.fill(10, 11, 16, 16, '^');
  const g = b.group({ tile: 'v', hidden: true });
  b.fill(3, 13, 11, 11, g);
  const name = 'The tunnel ceiling hides spikes';
  b.trigger({ when: { zone: b.rect(3, 11, 11, 2) }, do: [{ pop: g }], troll: b.troll(name, { type: 'tunnel-ceiling-spikes', x: 3, w: 11, hint: 'Spikes hide in the low tunnel ceiling – use small hops only.' }) });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 5 * T - 30), ['RJ', 6], land, run(X + 10 * T - 30), ['RJ', 6], land, run(X + 17 * T)],
    traps: { [name]: [run(X + 5 * T - 30), J(), ['R', 60]] },
  };
}

// ===========================================================================
// LEVEL 5 – "Left Is Right": the controls betray you (tight corridors)

/** Corridor connector with a low ceiling and a 1-tile hurdle (no traps). */
export function l5Corridor(b, { w = 10 } = {}) {
  b.ground(0, w - 1);
  b.fill(0, w - 1, 8, 9, '#');
  b.put(5, 14, '#');
  const X = b.px(0);
  return { w, win: [run(X + 4 * T), J(10), land, run(X + (w - 1) * T)] };
}

/** TRAP controls-swap: left and right swap; spikes behind punish holding →. */
export function l5Swap(b) {
  b.ground(0, 18);
  b.fill(0, 18, 8, 9, '#');
  b.fill(0, 1, 14, 14, '^');
  b.fill(8, 9, 14, 14, '^');
  b.fill(13, 18, 13, 14, '#');
  const name = 'Left and right swap';
  b.trigger({ when: { zone: b.rect(2, 10, 3, 5), grounded: true }, do: [{ controls: 'flip' }], troll: b.troll(name, { type: 'controls-swap', x: 2, w: 12, hint: 'Left and right swap here – press ◀ to go ▶ until you are up on the block.' }) });
  b.trigger({ when: { zone: b.rect(13, 10, 2, 3), grounded: true }, do: [{ controls: 'normal' }, { say: 'phew', at: 'hero', ticks: 40 }] });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X - 50), J(), land, ['L', `s.x>=${X + 8 * T - 50}`], ['LJ', 16], ['L', 's.grounded'], ['L', `s.x>=${X + 12 * T - 45}`], ['LJ', 16], ['L', "s.grounded && s.ctrlMode==='normal'"], run(X + 18 * T)],
    traps: { [name]: [run(X - 50), J(), land, ['R', 120]] },
  };
}

/** TRAP broken-jump: step on the strip and jump stops working – the pit after it is deadly. */
export function l5NoJump(b) {
  b.ground(0, 14);
  b.fill(0, 14, 8, 9, '#');
  b.fill(8, 9, 15, 16, '.');
  b.fill(8, 9, 16, 16, '^');
  const name = 'Jump stops working';
  b.trigger({ when: { zone: b.rect(3, 10, 3, 5), grounded: true }, do: [{ controls: 'nojump' }], troll: b.troll(name, { type: 'broken-jump', x: 3, w: 7, hint: 'Touching the ground at the strip ahead breaks your jump – leap over the whole strip and the pit.' }) });
  b.trigger({ when: { zone: b.rect(10, 10, 2, 5) }, do: [{ controls: 'normal' }] });
  const X = b.px(0);
  return {
    w: 15,
    win: [run(X + 2 * T + 10), J(), land, run(X + 7 * T + 20), J(), land, run(X + 14 * T)],
    traps: { [name]: [run(X + 4 * T), ['R', 120]] },
  };
}

/** TRAP auto-run: you can't stop – time the jumps over the spikes while running. */
export function l5AutoRun(b) {
  b.ground(0, 19);
  b.fill(0, 19, 8, 9, '#');
  b.put(6, 14, '^');
  b.fill(10, 11, 14, 14, '^');
  b.fill(16, 19, 13, 14, '#');
  const name = 'You cannot stop running';
  b.trigger({ when: { zone: b.rect(2, 10, 1, 5) }, do: [{ controls: 'autorun' }], troll: b.troll(name, { type: 'auto-run', x: 2, w: 15, hint: 'Here you cannot stop – jump the spikes while you run, then hop onto the block.' }) });
  b.trigger({ when: { zone: b.rect(17, 10, 2, 3), grounded: true }, do: [{ controls: 'normal' }, { say: 'phew', at: 'hero', ticks: 40 }] });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 5 * T - 20), J(10), land, run(X + 9 * T - 30), J(), land, run(X + 15 * T - 40), J(), ['R', "s.grounded && s.ctrlMode==='normal'"], run(X + 19 * T)],
    traps: { [name]: [run(X + 3 * T), ['', 120]] },
  };
}

// ===========================================================================
// LEVEL 6 – "Upside Downer": gravity (two surfaces: floor and ceiling)

/** Dual-surface connector: floor + ceiling (no traps). */
export function l6Dual(b, { w = 6 } = {}) {
  b.ground(0, w - 1);
  b.fill(0, w - 1, 0, 2, '#');
  return { w, win: [] };
}

/** TRAPS gravity-flip + flip-back: drift into ceiling spikes; flip back above a spike field. */
export function l6Flip(b) {
  b.ground(0, 25);
  b.fill(0, 25, 0, 2, '#');
  b.fill(6, 21, 14, 14, '^');
  b.fill(7, 9, 3, 3, 'v');
  b.put(14, 3, '#');
  const n1 = 'Gravity flips – drifting lands you in ceiling spikes';
  const n2 = 'Gravity flips back above a spike field';
  b.trigger({ when: { zone: b.rect(4, 8, 1, 7) }, do: [{ gravity: 'flip' }, { say: 'whoops', at: 'hero', ticks: 40 }], troll: b.troll(n1, { type: 'gravity-flip', x: 4, w: 6, hint: 'Gravity flips at the edge of the spikes – let go of the keys so you fall straight up.' }) });
  b.trigger({ when: { zone: b.rect(19, 3, 1, 5) }, do: [{ gravity: 'normal' }, { say: 'wheee', at: 'hero', ticks: 40 }], troll: b.troll(n2, { type: 'gravity-flip-back', x: 19, w: 4, hint: 'Gravity flips back above the spikes – keep holding ▶ while you fall.' }) });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 4 * T - 13), ['', 's.grounded && s.y<300'], run(X + 6 * T), J(), land, run(X + 12.6 * T), J(), land, run(X + 19 * T), ['R', 's.grounded && s.y>500']],
    traps: {
      [n1]: [run(X + 6 * T), ['R', 120]],
      [n2]: [run(X + 4 * T - 13), ['', 's.grounded && s.y<300'], run(X + 6 * T), J(), land, run(X + 12.6 * T), J(), land, run(X + 19 * T - 5), ['', 120]],
    },
  };
}

/** TRAP low-gravity: gravity goes floaty – a full jump flies into the spiky ceiling. */
export function l6Low(b) {
  b.ground(0, 15);
  b.fill(0, 15, 0, 2, '#');
  b.fill(3, 12, 7, 7, '#');
  b.fill(4, 11, 8, 8, 'v');
  b.fill(7, 8, 15, 16, '.');
  b.fill(7, 8, 16, 16, '^');
  const name = 'Floaty gravity – a full jump hits the ceiling';
  b.trigger({ when: { zone: b.rect(2, 9, 2, 6), grounded: true }, do: [{ gravityScale: 0.45 }], troll: b.troll(name, { type: 'low-gravity', x: 2, w: 10, hint: 'Gravity gets floaty here – use a tiny hop over the pit, a full jump hits the spikes.' }) });
  b.trigger({ when: { zone: b.rect(12, 9, 2, 6), grounded: true }, do: [{ gravityScale: 1 }] });
  const X = b.px(0);
  return { w: 16, win: [run(X + 7 * T - 30), ['RJ', 4], land, run(X + 15 * T)], traps: { [name]: [run(X + 6 * T - 20), J(40), ['R', 80]] } };
}

/** TRAP heavy-gravity: gravity goes heavy – your jump is too weak for the pit. */
export function l6Heavy(b) {
  b.ground(0, 17);
  b.fill(0, 17, 0, 2, '#');
  b.fill(8, 10, 15, 16, '.');
  b.fill(8, 10, 16, 16, '^');
  const name = 'Heavy gravity – your jump is too weak';
  b.trigger({ when: { zone: b.rect(3, 9, 2, 6), grounded: true }, do: [{ gravityScale: 2.4 }], troll: b.troll(name, { type: 'heavy-gravity', x: 3, w: 8, hint: 'Landing on the ground just ahead makes you heavy – jump over that bit first.' }) });
  b.trigger({ when: { zone: b.rect(12, 9, 2, 6), grounded: true }, do: [{ gravityScale: 1 }] });
  const X = b.px(0);
  return { w: 18, win: [run(X + 2 * T + 10), J(), land, run(X + 7 * T + 20), J(), land, run(X + 17 * T)], traps: { [name]: [run(X + 7 * T + 10), J(), ['R', 80]] } };
}

// ===========================================================================
// LEVEL 7 – "Too Many Doors": the EXIT keeps changing its mind (castle)

/** Castle connector: a battlement wall to climb over (no traps). */
export function l7Wall(b) {
  b.ground(0, 11);
  b.fill(4, 5, 13, 14, '#');
  b.fill(6, 7, 12, 14, '#');
  b.put(6, 11, '#');
  const X = b.px(0);
  return { w: 12, win: [run(X + 4 * T - 40), J(), land, run(X + 6 * T - 30), J(), land, run(X + 11 * T), land] };
}

/** TRAP fake-exit: a biting fake EXIT under the last step; climb over it. */
export function l7FakeExit(b) {
  b.ground(0, 14);
  b.fill(1, 3, 13, 13, '#');
  b.fill(5, 7, 11, 11, '#');
  b.fill(9, 11, 9, 14, '#');
  b.put(8, 14, 'F');
  const name = 'A fake EXIT bites';
  b.fakeExit(b.troll(name, { type: 'fake-exit', x: 8, w: 1, hint: 'That EXIT is fake and bites – climb the steps and go over the wall.' }));
  const X = b.px(0);
  return {
    w: 15,
    win: [run(X - 30), J(), land, run(X + 4 * T - 25), J(), land, run(X + 8 * T - 25), J(), land, run(X + 14 * T)],
    traps: { [name]: [run(X + 9 * T), ['R', 60]] },
  };
}

/** TRAP runaway-exit: the EXIT appears early and runs off over the castle to `to`. */
export function l7Runaway(b, { to, toRow = 14 }) {
  b.ground(0, 9);
  const name = 'The EXIT grows legs and runs away';
  b.doorAt(7, 14);
  const fromX = b.x0 + 7;
  b.trigger({ when: { zone: b.rect(2, 8, 2, 7) }, keep: true, troll: b.troll(name, { type: 'runaway-exit', x: 2, w: 6, hint: 'This EXIT runs away when you come close – just follow the castle onward.' }), do: [{ doorRun: [[fromX + 1, 11], [fromX + 3, -3], [to - 3, -3], [to, toRow]], speed: 9, hehe: 24 }] });
  return { w: 10, win: [run(b.px(9))] };
}

/** TRAP exit-swap: the EXIT waiting here swaps itself for a biting fake and runs to `to`. */
export function l7Swap(b, { to, toRow = 14 }) {
  b.ground(0, 11);
  const f = b.group({ tile: 'F', hidden: true });
  b.put(6, 14, f);
  const name = 'The EXIT swaps itself for a fake';
  const id = b.troll(name, { type: 'exit-swap', x: 0, w: 8, hint: 'The EXIT ahead swaps itself for a biting fake – jump over the fake one.' });
  b.groupTroll(f, id);
  b.trigger({ when: { zone: b.rect(1, 8, 1, 7) }, keep: true, troll: id, do: [{ show: f }, { doorRun: [[b.x0 + 6, 11], [b.x0 + 8, -3], [to - 3, -3], [to, toRow]], speed: 12, hehe: 0 }, { say: 'hehe', at: [b.x0 + 5.5, 11], ticks: 50 }] });
  const X = b.px(0);
  return { w: 12, win: [run(X + 5 * T - 30), J(), land, run(X + 11 * T)], traps: { [name]: [run(X + 6 * T), ['R', 60]] } };
}

/** End with TRAP hidden-exit: a fake EXIT in plain sight; the real one is inside the wall. */
export function l7HiddenEnd(b) {
  b.ground(0, 11);
  b.fill(7, 11, 5, 11, '#');
  const g = b.group({ tile: '#', fake: true, cover: [[b.x0 + 8, 13], [b.x0 + 8, 14]] });
  b.fill(7, 11, 12, 14, g);
  b.fill(8, 8, 13, 14, '.');
  b.put(4, 14, 'F');
  const n1 = 'The real EXIT hides inside the wall';
  b.groupTroll(g, b.troll(n1, { type: 'hidden-exit', x: 7, w: 5, hint: 'The real EXIT is hidden inside the wall – walk into it.' }));
  b.fakeExit(b.troll('A fake EXIT in front of the wall', { type: 'fake-exit', x: 4, w: 1, hint: 'The EXIT in front of the wall is a fake – jump over it.' }));
  const X = b.px(0);
  return { w: 12, win: [run(X + 4 * T - 45), J(), ['R', 's.state!=="play"']], traps: { 'A fake EXIT in front of the wall': [run(X + 5 * T), ['R', 60]] } };
}

// ===========================================================================
// LEVEL 8 – "Screen Lies": the camera lies (long plains with sudden drops)

/** Plains with drops: void gaps you must jump (no traps). */
function plains(b, x0, x1, gaps) {
  b.ground(x0, x1);
  for (const [gx, gw] of gaps) b.fill(gx, gx + gw - 1, 15, 17, '.');
}

/** TRAP camera-freeze: the camera stops following; the drops ahead happen off-screen. */
export function l8Freeze(b) {
  plains(b, 0, 29, [[18, 2], [24, 2]]);
  const name = 'The camera stops following you';
  b.trigger({ when: { zone: b.rect(1, 8, 1, 7) }, do: [{ camera: 'freeze' }], troll: b.troll(name, { type: 'camera-freeze', x: 1, w: 30, hint: 'The camera stops following soon – two gaps follow off-screen: jump, run four steps, jump again.' }) });
  b.trigger({ when: { zone: b.rect(28, 8, 1, 7) }, do: [{ camera: 'follow' }] });
  const X = b.px(0);
  return {
    w: 30,
    win: [run(X + 18 * T - 40), J(), land, run(X + 24 * T - 40), J(), land, run(X + 29 * T)],
    traps: { [name]: [run(X + 29 * T), ['R', 60]] },
  };
}

/** TRAP screen-flip: the whole screen turns upside down while you jump the drops. */
export function l8Flip(b) {
  plains(b, 0, 17, [[4, 2], [12, 2]]);
  b.put(8, 14, '#');
  const name = 'The screen turns upside down';
  b.trigger({ when: { zone: b.rect(1, 8, 1, 7) }, do: [{ camera: 'flip' }], troll: b.troll(name, { type: 'screen-flip', x: 1, w: 15, hint: 'The screen flips upside down soon – keep pressing ▶ and jump the two gaps as usual.' }) });
  b.trigger({ when: { zone: b.rect(16, 8, 1, 7) }, do: [{ camera: 'unflip' }] });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 4 * T - 40), J(), land, run(X + 8 * T - 40), J(10), land, run(X + 12 * T - 40), J(), land, run(X + 17 * T)],
    traps: { [name]: [run(X + 17 * T), ['R', 60]] },
  };
}

/** TRAP tunnel-vision: the camera zooms right in – the drops appear at the last moment. */
export function l8Zoom(b) {
  plains(b, 0, 15, [[7, 2], [11, 2]]);
  const name = 'The camera zooms in – tunnel vision';
  b.trigger({ when: { zone: b.rect(1, 8, 1, 7) }, do: [{ camera: 'zoom' }], troll: b.troll(name, { type: 'tunnel-vision', x: 1, w: 13, hint: 'The view zooms in soon – two gaps come quickly, four steps apart.' }) });
  b.trigger({ when: { zone: b.rect(14, 8, 1, 7) }, do: [{ camera: 'unzoom' }] });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 7 * T - 40), J(), land, run(X + 11 * T - 40), J(), land, run(X + 15 * T)],
    traps: { [name]: [run(X + 15 * T), ['R', 60]] },
  };
}

/** TRAP fake-victory: a fake "level clear" card covers the screen – keep playing blind. */
export function l8FakeClear(b) {
  plains(b, 0, 17, [[6, 2], [12, 2]]);
  const name = 'A fake "level clear" screen';
  b.trigger({ when: { zone: b.rect(1, 8, 1, 7) }, do: [{ fakeClear: true }], troll: b.troll(name, { type: 'fake-victory', x: 1, w: 15, hint: 'The "level clear" card ahead is fake – keep going and jump the two gaps behind it.' }) });
  b.trigger({ when: { zone: b.rect(16, 8, 1, 7) }, do: [{ fakeClear: false }] });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 6 * T - 40), J(), land, run(X + 12 * T - 40), J(), land, run(X + 17 * T)],
    traps: { [name]: [run(X + 17 * T), ['R', 60]] },
  };
}

// ===========================================================================
// LEVEL 9 – "Run!": something is always chasing you (runs and climbs)

/** TRAP chasing-wall: a spike wall appears behind you and chases you over the pits. */
export function l9Wall(b) {
  b.ground(0, 23);
  b.fill(7, 8, 15, 17, '.');
  b.fill(15, 16, 15, 17, '.');
  b.put(11, 14, '#');
  b.fill(19, 19, 13, 14, '#');
  const wall = b.group({ tile: '>', hidden: true });
  b.fill(0, 0, 8, 14, wall);
  const name = 'A spike wall chases you';
  b.trigger({ when: { zone: b.rect(3, 8, 2, 7) }, do: [{ chase: wall, vel: [3.4, 0], untilX: 22 }, { say: 'RUN!', at: 'hero', ticks: 40 }], troll: b.troll(name, { type: 'chasing-wall', x: 0, w: 23, hint: 'A spike wall comes from behind – do not stop until it is gone.' }) });
  const X = b.px(0);
  return {
    w: 24,
    win: [run(X + 7 * T - 40), J(), land, run(X + 11 * T - 40), J(10), land, run(X + 15 * T - 40), J(), land, run(X + 19 * T - 40), J(), land, run(X + 23 * T)],
    traps: { [name]: [run(X + 5 * T), ['', 200]] },
  };
}

/** TRAP rising-flood: spikes rise from the floor while you climb the steps. */
export function l9Flood(b) {
  b.ground(0, 25);
  b.fill(2, 4, 13, 13, '#');
  b.fill(6, 8, 11, 11, '#');
  b.fill(10, 12, 9, 9, '#');
  b.fill(14, 16, 7, 7, '#');
  b.fill(18, 22, 5, 5, '#');
  const f = b.group({ tile: '^' });
  b.fill(1, 22, 16, 16, f);
  const name = 'Spikes rise from the floor';
  b.trigger({ when: { zone: b.rect(2, 8, 1, 7) }, do: [{ chase: f, vel: [0, -1.4], untilY: -10 }, { say: '!!', at: 'hero', ticks: 30 }], troll: b.troll(name, { type: 'rising-flood', x: 1, w: 22, hint: 'Spikes rise from the floor here – climb the steps without stopping.' }) });
  const X = b.px(0);
  const climb = [run(X + 2 * T - 40), J(), land, run(X + 5 * T - 50), J(), land, run(X + 9 * T - 50), J(), land, run(X + 13 * T - 50), J(), land, run(X + 17 * T - 50), J(), land];
  return { w: 26, win: [...climb, run(X + 23 * T + 30), ['R', 's.grounded && s.y>500'], run(X + 25 * T)], traps: { [name]: [run(X + 3 * T), ['', 240]] } };
}

/** TRAP rolling-ball: a spiked ball rolls after you, faster than you – jump it or duck. */
export function l9Ball(b) {
  b.ground(0, 19);
  b.fill(20, 21, 15, 17, '.');
  b.ground(22, 22);
  b.fill(9, 10, 15, 15, '.');
  const ball = b.group({ tile: '*', hidden: true });
  b.put(0, 14, ball);
  const name = 'A spiked ball rolls after you';
  const rid = b.uid('ball');
  b.trigger({ id: rid, when: { zone: b.rect(5, 8, 1, 7) }, do: [{ show: ball }, { chase: ball, vel: [7, 0], untilX: 24 }], troll: b.troll(name, { type: 'rolling-ball', x: 0, w: 22, hint: 'A spiked ball rolls after you – drop into the little dip and let it pass.' }) });
  b.trigger({ when: { after: rid }, delay: 140, do: [{ hide: ball }] });
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 9 * T + 30), ['', 's.grounded && s.y>600'], ['', 's.g.' + ball + '[0]>' + 12 * T], J(10), land, run(X + 20 * T - 40), J(), land, run(X + 22 * T)],
    traps: { [name]: [run(X + 9 * T - 40), J(), land, ['R', 200]] },
  };
}

// ===========================================================================
// LEVEL 10 – "The Grand Betrayal": moving platforms betray you (sky over a void)

/** TRAP shuttle-dive: the shuttle platform dives into the void halfway – jump off early. */
export function l10Shuttle(b) {
  b.fill(0, 3, 13, 17, '#');
  b.fill(15, 18, 13, 17, '#');
  const p = b.group({ tile: '#' });
  b.fill(4, 6, 13, 13, p);
  const name = 'The shuttle dives into the void';
  const sid = b.uid('shuttle');
  b.trigger({ id: sid, when: { touch: p }, do: [{ move: p, by: [8, 0], ticks: 96 }], troll: b.troll(name, { type: 'shuttle-dive', x: 4, w: 11, hint: 'The moving platform dives halfway – jump to the far island before it does.' }) });
  b.trigger({ when: { after: sid }, delay: 60, do: [{ move: p, by: [0, 7], ticks: 30 }] });
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 4 * T + 10), ['R', `s.x >= ${X + 7 * T - 16} + s.g.${p}[0]`], ['', `s.g.${p}[0]>=${4 * T}`], J(), land, run(X + 18 * T)],
    traps: { [name]: [run(X + 4 * T + 10), ['', 200]] },
  };
}

/** TRAP elevator-spikes: the elevator rises into ceiling spikes – jump off at the ledge. */
export function l10Elevator(b) {
  b.fill(0, 2, 13, 17, '#');
  b.fill(7, 13, 7, 7, '#');
  b.fill(14, 17, 13, 17, '#');
  b.fill(3, 6, 2, 2, '#');
  b.fill(3, 5, 3, 3, 'v');
  const p = b.group({ tile: '#' });
  b.fill(3, 5, 13, 13, p);
  const name = 'The elevator rises into ceiling spikes';
  b.trigger({ when: { touch: p }, delay: 10, do: [{ move: p, by: [0, -9], ticks: 140, returnAfter: 40, returnTicks: 100 }], troll: b.troll(name, { type: 'elevator-spikes', x: 3, w: 4, hint: 'The elevator goes all the way into the spikes – jump right onto the ledge on the way up.' }) });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 3 * T + 30), ['', `s.g.${p}[1]<=-${5 * T}`], J(), land, run(X + 13 * T + 30), ['R', 's.grounded && s.y>400'], run(X + 17 * T)],
    traps: { [name]: [run(X + 3 * T + 30), ['', 300]] },
  };
}

/** TRAP shy-platform: the platform dodges away when you jump at it – aim further. */
export function l10Shy(b) {
  b.fill(0, 3, 13, 17, '#');
  b.fill(13, 16, 13, 17, '#');
  const p = b.group({ tile: '#' });
  b.fill(6, 8, 13, 13, p);
  const name = 'The platform dodges your jump';
  b.trigger({ when: { zone: b.rect(4, 9, 6, 4), airborne: true }, do: [{ move: p, by: [2, 0], ticks: 8 }, { say: 'nope', at: [b.x0 + 7.5, 11.5], ticks: 30 }], troll: b.troll(name, { type: 'shy-platform', x: 5, w: 6, hint: 'The platform slides two steps away when you jump – aim further than it is.' }) });
  const X = b.px(0);
  return {
    w: 17,
    win: [run(X + 4 * T - 15), J(), land, run(X + 10 * T - 20), J(), land, run(X + 16 * T)],
    traps: { [name]: [run(X + 4 * T - 35), ['RJ', 9], ['R', 120]] },
  };
}

/** TRAP blinking-platform: platforms blink in and out of existence in a rhythm. */
export function l10Blink(b) {
  b.fill(0, 3, 13, 17, '#');
  b.fill(14, 17, 13, 17, '#');
  const a = b.group({ tile: '#' });
  b.fill(6, 7, 13, 13, a);
  const c = b.group({ tile: '#' });
  b.fill(10, 11, 13, 13, c);
  const name = 'The platforms blink away';
  const id = b.troll(name, { type: 'blinking-platform', x: 6, w: 6, hint: 'The two platforms blink out for a moment every few seconds – start hopping right after they reappear.' });
  const on = b.uid('blink');
  b.trigger({ id: on, when: { zone: b.rect(1, 8, 1, 7) }, every: 140, do: [{ hide: a }, { hide: c }], troll: id });
  b.trigger({ when: { after: on }, delay: 50, every: 140, do: [{ show: a }, { show: c }] });
  const X = b.px(0);
  const wait = [run(X + 3 * T + 10), ['', `s.g.${a}[2]===0`], ['', `s.g.${a}[2]===1`]];
  return {
    w: 18,
    win: [...wait, J(10), land, ['R', 2], J(10), land, run(X + 13 * T - 25), J(10), land, run(X + 17 * T)],
    traps: { [name]: [...wait, ['', 80], J(10), ['', 120]] },
  };
}
