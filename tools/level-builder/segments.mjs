// Troll set-pieces ("segments") for the level builder.
//
// Every segment draws itself into the level at the builder's cursor and returns:
//   w      – width in tiles
//   win    – bot plan steps that get through it (x conditions are absolute pixels)
//   traps  – { name: steps } that walk into its troll and must die (optional)
// Plan steps are [keys, until]: keys from "L","R","J"; until = ticks or an expression over
// the sim state `s` (x, y, vx, vy, grounded, gravity, state …).
//
// Conventions: the ground is rows 15-17 (the hero stands at y = 600), segments start
// and end on that ground so they can be chained in any order.

const T = 40;
const run = (px) => ['R', `s.x>=${px}`];
const runL = (px) => ['L', `s.x<=${px}`];
const J = (n = 16) => ['RJ', n];
const land = ['R', 's.grounded'];

/** Plain ground, optional scenery: floating platforms higher up to use the vertical space. */
export function flat(b, w = 6, { deco = true } = {}) {
  b.ground(0, w - 1);
  if (deco && w >= 6) b.fill(1, w - 2, 9, 9, '#');
  return { w, win: [] };
}

export function start(b) {
  b.ground(0, 5);
  b.put(2, 14, 'P');
  return { w: 6, win: [] };
}

export function checkpoint(b) {
  b.ground(0, 4);
  b.put(2, 14, 'C');
  return { w: 5, win: [] };
}

/** Steps up and down, with optional hints (tutorial). Uses rows 9-13. */
export function steps(b, { hints = false } = {}) {
  b.ground(0, 13);
  b.put(3, 14, '#');
  b.fill(6, 7, 13, 14, '#');
  b.fill(9, 11, 11, 11, '#');
  b.put(10, 10, 'o');
  if (hints) {
    b.hint(1, 11, '← →  move');
    b.hint(5, 10, 'SPACE / ▲  jump');
    b.hint(10, 7, 'hold jump = higher');
  }
  const X = b.px(0);
  return {
    w: 14,
    win: [run(X + 2 * T - 30), J(12), land, run(X + 5 * T - 30), J(), land, run(X + 7 * T + 10), J(), land, run(X + 12 * T)],
  };
}

/** Climb an upper route: blocks up to a long high platform, then drop down. */
export function upper(b, { coins = true } = {}) {
  b.ground(0, 21);
  b.fill(2, 3, 13, 14, '#');
  b.fill(5, 6, 11, 14, '#');
  b.fill(8, 14, 9, 9, '#');
  b.fill(8, 9, 10, 14, '#');
  if (coins) { b.put(11, 7, 'o'); b.put(13, 7, 'o'); }
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 2 * T - 40), J(), land, run(X + 5 * T - 40), J(), land, run(X + 8 * T - 45), J(), land, run(X + 16 * T), land, run(X + 20 * T)],
  };
}

/** A plain spike pit to jump (no troll). */
export function pit(b, w = 3) {
  b.ground(0, 2);
  b.fill(3, 2 + w, 17, 17, '#');
  b.fill(3, 2 + w, 16, 16, '^');
  b.ground(3 + w, 5 + w);
  const X = b.px(0);
  return { w: 6 + w, win: [run(X + 3 * T - 40), J(), land] };
}

/** TROLL: the floor collapses into a spike pit when touched. */
export function collapse(b, { width = 3, shake = 3, cracked = false, name = 'The floor collapses into spikes' } = {}) {
  const w = width + 6;
  b.ground(0, 2);
  b.ground(3 + width, w - 1);
  b.fill(3, 2 + width, 17, 17, '#');
  b.fill(3, 2 + width, 16, 16, '^');
  const g = b.group({ tile: '#', look: cracked ? 'cracked' : undefined, cover: b.range(3, 2 + width, 16, 16) });
  b.fill(3, 2 + width, 15, 15, g);
  const id = b.troll(name);
  b.trigger({ when: { touch: g }, do: [{ fall: g, shake }], troll: id });
  b.hint(3 + width / 2, 11, 'jump it!', 2);
  const X = b.px(0);
  return {
    w,
    win: [run(X + 3 * T - 45), J(), land],
    traps: { [name]: [run(X + 3 * T + 30), ['', 60]] },
  };
}

/** TROLL: a fake floor – drawn like ground, you fall straight through. */
export function fakeFloor(b) {
  b.ground(0, 2);
  b.ground(6, 8);
  b.fill(3, 5, 17, 17, '#');
  b.fill(3, 5, 16, 16, '^');
  const g = b.group({ tile: '#', fake: true, cover: b.range(3, 5, 16, 16) });
  b.fill(3, 5, 15, 15, g);
  const name = 'A fake floor you fall straight through';
  b.groupTroll(g, b.troll(name));
  b.hint(4, 11, 'that floor is fake', 1);
  const X = b.px(0);
  return { w: 9, win: [run(X + 3 * T - 45), J(), land], traps: { [name]: [run(X + 4 * T), ['', 60]] } };
}

/** TROLL (harmless): the floor sinks a tile under you. */
export function sink(b) {
  b.ground(0, 2);
  b.ground(5, 7);
  b.fill(3, 4, 17, 17, '.');
  const g = b.group({ tile: '#', cover: b.range(3, 4, 17, 17) });
  b.fill(3, 4, 15, 16, g);
  const id = b.troll('The floor sinks under you');
  b.trigger({ when: { touch: g }, do: [{ move: g, by: [0, 1], ticks: 20 }, { say: 'oops!', at: 'hero', ticks: 50 }], troll: id });
  const X = b.px(0);
  return { w: 8, win: [run(X + 3 * T + 20), ['', 's.grounded && s.y>=620'], ['', 20], J(), land] };
}

/** TROLL: hidden spikes pop up exactly where a normal jump lands. */
export function popLanding(b, { mode = 'short' } = {}) {
  b.ground(0, 13);
  const X = b.px(0);
  const name = mode === 'short' ? 'Spikes pop up where a normal jump lands' : 'Spikes pop up where a small hop lands';
  const id = b.troll(name);
  if (mode === 'short') {
    b.put(3, 14, '^');
    const g = b.group({ tile: '^', hidden: true });
    b.fill(6, 9, 14, 14, g);
    b.trigger({ when: { zone: b.rect(6, 8, 4, 7), airborne: true }, do: [{ pop: g }], troll: id });
    b.hint(4.5, 10, 'tap jump = tiny hop', 1);
    return { w: 14, win: [run(X + 3 * T - 22), ['RJ', 4], land, run(X + 12 * T)], traps: { [name]: [run(X + 3 * T - 45), J(), ['R', 100]] } };
  }
  b.put(5, 14, '^');
  const g = b.group({ tile: '^', hidden: true });
  b.fill(6, 7, 14, 14, g);
  b.trigger({ when: { zone: b.rect(6, 8, 2, 7), airborne: true }, do: [{ pop: g }], troll: id });
  b.hint(6, 10, 'BIG jump', 1);
  return { w: 14, win: [run(X + 175), J(), land, run(X + 12 * T)], traps: { [name]: [run(X + 183), ['RJ', 5], ['R', 100]] } };
}

/** TROLL: harmless fake spikes; the landing spot behind them is the real trap. */
export function fakeSpikes(b) {
  b.ground(0, 13);
  const f = b.group({ tile: '^', fake: true });
  b.fill(3, 5, 14, 14, f);
  b.groupTroll(f, b.troll('Fake spikes (walk right through)'));
  const p = b.group({ tile: '^', hidden: true });
  b.fill(6, 10, 14, 14, p);
  const name = 'Hidden spikes behind the fake ones';
  b.trigger({ when: { zone: b.rect(6, 8, 5, 7), airborne: true }, do: [{ pop: p }], troll: b.troll(name) });
  b.hint(4, 10, 'those spikes look... cheap', 1);
  const X = b.px(0);
  return { w: 14, win: [run(X + 12 * T)], traps: { [name]: [run(X + 3 * T - 40), J(), ['R', 100]] } };
}

/** TROLL: the ceiling slams down; the bolted, spiky part is the safe spot (old level 5). */
export function crusher(b) {
  b.ground(0, 21);
  const a = b.group({ tile: '#' });
  b.fill(0, 5, 9, 10, a);
  b.fill(9, 21, 9, 10, a);
  const safe = b.group({ tile: '#', look: 'bolted' });
  b.fill(6, 8, 9, 10, safe);
  b.fill(6, 8, 11, 11, 'v');
  const name = 'The ceiling falls (safe spot: under the bolted spikes)';
  const id = b.troll(name);
  const rid = b.uid('rumble');
  b.trigger({ id: rid, when: { zone: b.rect(11, 11, 2, 4) }, do: [{ shake: 4, ticks: 34 }, { say: 'rumble...', at: [b.x0 + 13, 10], ticks: 34 }, { scare: true }], troll: id });
  b.trigger({ when: { after: rid }, delay: 34, do: [{ move: a, by: [0, 4], ticks: 14, deadly: true, returnAfter: 50, returnTicks: 40 }] });
  b.hint(7, 7, 'bolted on', 1);
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 11 * T - 12), runL(X + 7.5 * T), ['', 150], run(X + 21 * T)],
    traps: { [name]: [run(X + 21 * T), ['R', 200]] },
  };
}

/** TROLL: a row of ceiling spikes drops when you walk in – wait for it to go back up. */
export function ceilingSpikes(b) {
  b.ground(0, 13);
  b.fill(2, 11, 5, 5, '#');
  const g = b.group({ tile: 'v' });
  b.fill(5, 8, 6, 6, g);
  const name = 'Ceiling spikes drop on you';
  b.trigger({ when: { zone: b.rect(3, 8, 2, 7), grounded: true }, do: [{ say: '!', at: [b.x0 + 6.5, 4.2], ticks: 30 }, { move: g, by: [0, 8], ticks: 30, deadly: true, returnAfter: 50, returnTicks: 40 }], troll: b.troll(name) });
  b.hint(4, 3, 'wait for them to go back up', 1);
  const X = b.px(0);
  return { w: 14, win: [run(X + 3 * T - 13), ['', 130], run(X + 12 * T)], traps: { [name]: [run(X + 12 * T), ['R', 120]] } };
}

/** TROLL (timing): a ceiling block slams down in a rhythm. */
export function thwomp(b) {
  b.ground(0, 11);
  b.fill(3, 8, 3, 4, '#');
  const g = b.group({ tile: '#', look: 'bolted' });
  b.fill(5, 6, 5, 10, g);
  const name = 'A ceiling block slams down in rhythm';
  b.trigger({ when: { zone: b.rect(4, 8, 1, 7) }, every: 150, do: [{ move: g, by: [0, 4], ticks: 10, deadly: true, returnAfter: 40, returnTicks: 50 }], troll: b.troll(name) });
  b.hint(5, 2, 'time it', 1);
  const X = b.px(0);
  // the first slam starts when you enter; walk in right after it starts going back up
  return { w: 12, win: [run(X + 4 * T - 12), ['', 70], run(X + 10 * T)], traps: { [name]: [run(X + 10 * T), ['R', 100]] } };
}

/** TROLL: platforms over a spike pit vanish shortly after you land on them. */
export function vanish(b, { delay = 16 } = {}) {
  b.ground(0, 1);
  b.ground(12, 13);
  b.fill(2, 11, 17, 17, '#');
  b.fill(2, 11, 16, 16, '^');
  const name = 'Platforms vanish under your feet';
  const id = b.troll(name);
  const plats = [3, 6, 9].map((px) => {
    const g = b.group({ tile: '#' });
    b.fill(px, px + 1, 13, 13, g);
    b.trigger({ when: { touch: g }, delay, do: [{ hide: g }], troll: id });
    return px;
  });
  b.hint(6, 10, "don't stop!", 1);
  const X = b.px(0);
  const win = [run(X + 2 * T - 30), ['RJ', 10], land];
  for (let i = 1; i < plats.length; i++) win.push(['R', 2], ['RJ', 10], land);
  win.push(['R', 2], ['RJ', 10], land);
  return { w: 14, win, traps: { [name]: [run(X + 2 * T - 30), ['RJ', 10], ['', 's.grounded'], ['', 60]] } };
}

/** TROLL: the "safe" pillar in a spike pit grows spikes after you land on it. */
export function popBlock(b) {
  b.ground(0, 1);
  b.ground(10, 12);
  b.fill(2, 9, 17, 17, '#');
  b.fill(2, 9, 16, 16, '^');
  b.fill(5, 6, 16, 16, '#');
  b.fill(5, 6, 13, 15, '#');
  const g = b.group({ tile: '^', hidden: true });
  b.fill(5, 6, 12, 12, g);
  const name = 'The safe pillar grows spikes';
  b.trigger({ when: { zone: b.rect(5, 11, 2, 2), grounded: true }, delay: 18, do: [{ pop: g }], troll: b.troll(name) });
  b.hint(5.5, 9, 'keep jumping!', 1);
  const X = b.px(0);
  return {
    w: 13,
    win: [run(X + 2 * T - 35), J(), land, ['R', 2], J(), land],
    traps: { [name]: [run(X + 2 * T - 35), J(), ['', 's.grounded'], ['', 60]] },
  };
}

/** TROLL: the jump pad shoots you into ceiling spikes – steer back through the gap (old level 6). */
export function spring(b) {
  b.ground(0, 10);
  b.ground(20, 24);
  b.fill(11, 19, 17, 17, '#');
  b.fill(11, 19, 16, 16, '^');
  b.fill(0, 5, 5, 5, '#');
  b.fill(9, 19, 5, 5, '#');
  b.fill(9, 14, 6, 6, 'v');
  const p = b.group({ tile: '=' });
  b.put(8, 14, p);
  const name = 'The jump pad launches you into ceiling spikes';
  b.groupTroll(p, b.troll(name));
  b.hint(4, 10, '◀ hold back in the air', 1);
  const X = b.px(0);
  return {
    w: 25,
    win: [['R', 's.vy<-1000'], ['L', 's.grounded'], run(X + 5 * T - 30), J(), land, run(X + 19 * T + 30), ['R', 's.grounded && s.y>500'], run(X + 24 * T)],
    traps: { [name]: [['R', 's.vy<-1000'], ['R', 100]] },
  };
}

/** A genuine jump pad up to an upper ledge (not a troll). */
export function boost(b) {
  b.ground(0, 21);
  b.fill(9, 16, 6, 6, '#');
  b.put(4, 14, '=');
  b.put(11, 5, 'o'); b.put(13, 5, 'o');
  const X = b.px(0);
  return { w: 22, win: [['R', 's.vy<-1000'], ['R', 's.grounded'], run(X + 16 * T + 30), ['R', 's.grounded && s.y>500'], run(X + 21 * T)] };
}

/** TROLL: gravity flips mid-level (release the keys!), and flips back over spikes (keep running!). */
export function gravity(b) {
  b.ground(0, 25);
  b.fill(0, 25, 0, 2, '#');
  b.fill(6, 21, 14, 14, '^');
  b.fill(7, 9, 3, 3, 'v');
  b.put(14, 3, '#');
  const n1 = 'Gravity flips – drifting lands you in ceiling spikes';
  const n2 = 'Gravity flips back above a spike field';
  b.trigger({ when: { zone: b.rect(4, 8, 1, 7) }, do: [{ gravity: 'flip' }, { say: 'whoops', at: 'hero', ticks: 40 }], troll: b.troll(n1) });
  b.trigger({ when: { zone: b.rect(19, 3, 1, 5) }, do: [{ gravity: 'normal' }, { say: 'wheee', at: 'hero', ticks: 40 }], troll: b.troll(n2) });
  b.hint(5, 6, 'let go when it flips', 1);
  b.hint(19, 11, 'keep running!', 1);
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

/** TROLL: left and right swap after you land; spikes behind you punish holding →.
 *  Controls come back to normal on top of a raised block, where turning round is safe. */
export function controlFlip(b) {
  b.ground(0, 18);
  b.fill(0, 1, 14, 14, '^');
  b.fill(8, 9, 14, 14, '^');
  b.fill(13, 18, 13, 14, '#');
  const name = 'Left and right swap';
  b.trigger({ when: { zone: b.rect(2, 8, 3, 7), grounded: true }, do: [{ controls: 'flip' }], troll: b.troll(name) });
  b.trigger({ when: { zone: b.rect(13, 9, 2, 4), grounded: true }, do: [{ controls: 'normal' }, { say: 'phew', at: 'hero', ticks: 40 }] });
  b.hint(5, 10, 'press ◀ to go ▶', 1);
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X - 50), J(), land, ['L', `s.x>=${X + 8 * T - 50}`], ['LJ', 16], ['L', 's.grounded'], ['L', `s.x>=${X + 12 * T - 45}`], ['LJ', 16], ['L', 's.grounded && !s.controlsFlipped'], run(X + 18 * T)],
    traps: { [name]: [run(X - 50), J(), land, ['R', 120]] },
  };
}

/** TROLL: coins with teeth – one on the floor, an arc above a pit (hop UNDER it). */
export function coins(b) {
  b.ground(0, 21);
  b.put(5, 12, 'o');
  const a = b.group({ tile: 'o', trapCoin: true });
  b.put(10, 14, a);
  b.fill(15, 16, 15, 16, '.');
  b.fill(15, 16, 16, 16, '^');
  const c = b.group({ tile: 'o', trapCoin: true });
  b.fill(13, 18, 11, 11, c);
  const n1 = 'A coin on the floor bites';
  const n2 = 'The coin arc over the pit bites';
  b.groupTroll(a, b.troll(n1));
  b.groupTroll(c, b.troll(n2));
  b.hint(16, 8, 'small jump!', 1);
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 170), J(), land, run(X + 365), ['RJ', 6], land, run(X + 575), ['RJ', 6], land, run(X + 20 * T)],
    traps: {
      [n1]: [run(X + 9 * T), ['R', 60]],
      [n2]: [run(X + 170), J(), land, run(X + 365), ['RJ', 6], land, run(X + 570), J(), ['R', 120]],
    },
  };
}

/** TROLL: a spike wall chases you across collapsing floors (old level 10). */
export function chase(b) {
  b.ground(0, 25);
  const wall = b.group({ tile: '>', hidden: true });
  b.fill(0, 0, 8, 14, wall);
  const f = b.group({ tile: '#', cover: b.range(8, 9, 16, 17) });
  b.fill(8, 9, 15, 15, f);
  b.fill(8, 9, 16, 17, '.');
  const g = b.group({ tile: '#', cover: b.range(16, 17, 16, 17) });
  b.fill(16, 17, 15, 15, g);
  b.fill(16, 17, 16, 17, '.');
  b.put(12, 14, '#');
  b.fill(20, 20, 13, 14, '#');
  const n1 = 'A spike wall chases you';
  const n2 = 'The floor drops while you run';
  b.trigger({ when: { zone: b.rect(3, 8, 2, 7) }, do: [{ chase: wall, vel: [3.4, 0], untilX: 23 }, { say: 'RUN!', at: 'hero', ticks: 40 }], troll: b.troll(n1) });
  const id2 = b.troll(n2);
  b.trigger({ when: { touch: f }, do: [{ fall: f, shake: 14 }], troll: id2 });
  b.trigger({ when: { touch: g }, do: [{ fall: g, shake: 14 }], troll: id2 });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 290), J(14), land, run(X + 440), J(12), land, run(X + 610), J(), land, run(X + 755), J(), land, run(X + 25 * T)],
    traps: {
      [n1]: [run(X + 4 * T), ['', 300]],
      [n2]: [run(X + 7 * T), ['R', 100]],
    },
  };
}

/** TROLL: a fake EXIT under the last step; the way on is up the steps and over the wall. */
export function fakeExit(b) {
  b.ground(0, 14);
  b.fill(1, 3, 13, 13, '#');
  b.fill(5, 7, 11, 11, '#');
  b.fill(9, 11, 9, 14, '#');
  b.put(8, 14, 'F');
  const name = 'A fake EXIT that bites';
  b.fakeExit(b.troll(name));
  b.hint(6, 7, 'climb over it', 1);
  const X = b.px(0);
  return {
    w: 15,
    win: [run(X - 30), J(), land, run(X + 4 * T - 25), J(), land, run(X + 8 * T - 25), J(), land, run(X + 14 * T)],
    traps: { [name]: [run(X + 9 * T), ['R', 60]] },
  };
}

/** The EXIT appears early and runs ahead to `to` (absolute tile x of its next spot). */
export function doorRun(b, { to, toRow = 14, hehe = 24 }) {
  b.ground(0, 9);
  const name = 'The EXIT grows legs and runs away';
  const id = b.troll(name);
  b.doorAt(7, 14);
  const fromX = b.x0 + 7;
  b.trigger({ when: { zone: b.rect(2, 8, 2, 7) }, keep: true, troll: id, do: [{ doorRun: [[fromX + 1, 11], [fromX + 3, -3], [to - 3, -3], [to, toRow]], speed: 9, hehe }] });
  return { w: 10, win: [run(b.px(9))] };
}

/** The fled EXIT waits here (it must have been sent to local x 4) and flees again to `to`. */
export function doorWait(b, { to, toRow = 14 }) {
  b.ground(0, 9);
  b.put(1, 12, 'o');
  const name = 'The EXIT runs away again';
  b.trigger({ when: { zone: b.rect(0, 8, 1, 7) }, keep: true, troll: b.troll(name), do: [{ doorRun: [[b.x0 + 5, 11], [b.x0 + 7, -3], [to - 3, -3], [to, toRow]], speed: 9, hehe: 16 }] });
  return { w: 10, win: [run(b.px(9))] };
}

/** End: the fled EXIT waits at local x 4 and makes one last dash up a staircase. */
export function endFlee(b) {
  b.ground(0, 13);
  b.fill(9, 13, 13, 14, '#');
  b.fill(11, 13, 11, 12, '#');
  const name = 'The EXIT makes a last dash up the stairs';
  b.trigger({ when: { zone: b.rect(0, 8, 1, 7) }, troll: b.troll(name), do: [{ doorRun: [[b.x0 + 9, 12], [b.x0 + 10, 12], [b.x0 + 11.5, 10], [b.x0 + 12, 10]], speed: 7, hehe: 16 }] });
  const X = b.px(0);
  return { w: 14, win: [run(X + 9 * T - 45), J(), land, run(X + 11 * T - 45), J(), land, ['R', 's.state!=="play"']] };
}

/** End: plain door on the ground. */
export function endDoor(b, { sinkLast = false } = {}) {
  b.ground(0, 7);
  b.doorAt(5, 14);
  const X = b.px(0);
  if (sinkLast) {
    b.fill(2, 3, 17, 17, '.');
    const g = b.group({ tile: '#', cover: b.range(2, 3, 17, 17) });
    b.fill(2, 3, 15, 16, g);
    const id = b.troll('The last step sinks');
    b.trigger({ when: { touch: g }, do: [{ move: g, by: [0, 1], ticks: 20 }, { say: 'oops!', at: 'hero', ticks: 50 }, { doorHehe: 40 }], troll: id });
    return { w: 8, win: [run(X + 2 * T + 20), ['', 's.grounded && s.y>=620'], ['', 20], J(), ['R', 's.state!=="play"']] };
  }
  return { w: 8, win: [['R', 's.state!=="play"']] };
}

/** End: a fake EXIT in plain sight; the real one hides inside the wall (old level 7). */
export function endHidden(b) {
  b.ground(0, 11);
  b.fill(7, 11, 5, 11, '#');
  const g = b.group({ tile: '#', fake: true, cover: [[b.x0 + 8, 13], [b.x0 + 8, 14]] });
  b.fill(7, 11, 12, 14, g);
  b.fill(8, 8, 13, 14, '.');
  b.doorAt(8, 14);
  b.put(4, 14, 'F');
  const name = 'The real EXIT hides inside the wall';
  b.groupTroll(g, b.troll(name));
  b.fakeExit(b.troll('A fake EXIT in front of the real one'));
  b.hint(5, 9, 'walls lie too', 1);
  const X = b.px(0);
  return { w: 12, win: [run(X + 4 * T - 45), J(), ['R', 's.state!=="play"']], traps: { 'A fake EXIT in front of the real one': [run(X + 5 * T), ['R', 60]] } };
}
