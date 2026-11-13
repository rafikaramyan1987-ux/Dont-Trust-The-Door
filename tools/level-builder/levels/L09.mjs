// LEVEL 9 – "Run!": something is always chasing you. Lava-coloured runs and climbs.
import { T, run, runL, J, land, wait } from '../lib.mjs';

const pit = (b, x0, x1) => { b.fill(x0, x1, 15, 17, '.'); b.fill(x0, x1, 17, 17, '^'); };

/** TRAP rolling-ball: a spiked ball rolls after you – jump the ditch and it falls in. */
function rollingBall(b) {
  b.ground(0, 24);
  b.fill(11, 12, 15, 16, '.');
  const ball = b.group({ tile: '*', hidden: true });
  b.put(0, 14, ball);
  const id = b.troll('A spiked ball rolls after you', { type: 'rolling-ball', hint: 'A spiked ball rolls after you, faster than you – keep running and jump the ditch: the ball falls into it.', hazards: [[11, 15, 2, 2]] });
  const tid = b.uid('rb');
  b.trigger({ id: tid, when: { zone: b.rect(4, 9, 1, 6) }, do: [{ chase: ball, vel: [6.2, 0], untilX: 11 }, { say: 'say.run', at: 'hero', ticks: 40 }], troll: id });
  b.trigger({ when: { after: tid }, delay: 73, do: [{ move: ball, by: [0, 2], ticks: 10 }] });
  const X = b.px(0);
  return { w: 25, win: [run(X + 11 * T - 34), J(), land, run(X + 24 * T)], die: [run(X + 8 * T), ['', 120]] };
}

/** TRAP spike-turret: a turret fires spiked balls along the floor – jump each one, then hop the turret. */
function spikeTurret(b) {
  b.ground(0, 24);
  const t = b.group({ tile: '#', turret: { every: 80, vx: -6, range: 22 } });
  b.fill(20, 21, 14, 14, t);
  b.fill(20, 21, 13, 13, '#');
  const id = b.troll('A turret shoots spiked balls', { type: 'spike-turret', hint: 'The turret at the end fires spiked balls along the floor – jump over each ball as it comes, then hop onto the turret.', hazards: [[3, 14, 17, 1]] });
  b.trigger({ when: { zone: b.rect(2, 9, 1, 6) }, do: [{ activate: t }], troll: id });
  b.trigger({ when: { zone: b.rect(23, 9, 1, 6) }, do: [{ deactivate: t }] });
  const X = b.px(0);
  const dodge = [['R', `s.shot<64 || s.x>=${X + 18 * T}`], J(), land];
  return {
    w: 25,
    win: [...dodge, ...dodge, ...dodge, ...dodge, run(X + 19 * T - 30), J(), land, run(X + 24 * T)],
    die: [run(X + 6 * T), ['', 150]],
  };
}

/** TRAP chasing-wall: a spike wall chases you – it is only a little slower than you, don't stop. */
function chasingWall(b) {
  b.ground(0, 25);
  b.put(8, 14, '#');
  pit(b, 12, 13);
  b.fill(18, 18, 13, 14, '#');
  const w = b.group({ tile: '>', hidden: true });
  b.fill(0, 0, 3, 14, w);
  const id = b.troll('A spike wall chases you', { type: 'chasing-wall', hint: 'A spike wall chases you, only a little slower than you – never stop: hop the bump, jump the pit, jump the block.', hazards: [[12, 17, 2, 1]] });
  b.trigger({ when: { zone: b.rect(3, 9, 1, 6) }, do: [{ chase: w, vel: [4.7, 0], untilX: 23 }, { say: 'say.run', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 26,
    win: [run(X + 8 * T - 40), J(10), land, run(X + 12 * T - 30), J(), land, run(X + 18 * T - 40), J(), land, run(X + 25 * T)],
    die: [run(X + 6 * T), ['', 90]],
  };
}

/** TRAP spiked-fish: a spiked fish leaps out of the pit when you come near – wait for it, then jump. */
function spikedFish(b) {
  b.ground(0, 6);
  b.fill(7, 9, 17, 17, '#');
  b.ground(10, 16);
  const f = b.group({ tile: '*' });
  b.put(8, 16, f);
  const id = b.troll('A spiked fish leaps out of the pit', { type: 'spiked-fish', hint: 'A spiked fish leaps out of the pit as you come near – wait at the edge until it drops back, then jump.' });
  b.trigger({ when: { zone: b.rect(5, 9, 2, 6) }, do: [{ move: f, by: [0, -5], ticks: 20, returnAfter: 14, returnTicks: 22 }], troll: id });
  const X = b.px(0);
  return {
    w: 17,
    win: [run(X + 6 * T + 10), ['', `s.g.${f}[1]<-100`], ['', `s.g.${f}[1]===0`], J(), land, run(X + 16 * T)],
    die: [run(X + 6 * T + 10), J(), ['R', 60]],
  };
}

/** TRAP homing-bird: a spiked bird dives at you – run into the low tunnel, it crashes into the roof. */
function homingBird(b) {
  b.ground(0, 26);
  b.fill(11, 19, 3, 12, '#');
  const bird = b.group({ tile: '*', homing: 5.5, hidden: true });
  b.put(0, 2, bird);
  const id = b.troll('A spiked bird dives at you', { type: 'homing-bird', hint: 'A spiked bird hunts you, faster than you can run – hide in the low tunnel ahead: it crashes into the roof.' });
  b.trigger({ when: { zone: b.rect(6, 9, 1, 6) }, do: [{ activate: bird }, { say: 'say.run', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return { w: 27, win: [run(X + 15 * T), ['', `s.g.${bird}[2]===0`], run(X + 26 * T)], die: [run(X + 6 * T), ['', 150]] };
}

/** TRAP rising-flood: a floor of spikes rises from the pit – climb the ledges fast. */
function risingFlood(b) {
  b.ground(0, 2);
  const fl = b.group({ tile: '^' });
  b.fill(3, 17, 16, 17, fl);
  b.fill(4, 6, 13, 13, '#');
  b.fill(8, 10, 11, 11, '#');
  b.fill(12, 14, 9, 9, '#');
  b.fill(16, 25, 7, 7, '#');
  b.ground(26, 30);
  const id = b.troll('A floor of spikes rises', { type: 'rising-flood', hint: 'A floor of spikes rises out of the pit – climb the ledges quickly without waiting.' });
  b.trigger({ when: { zone: b.rect(2, 9, 1, 6) }, do: [{ chase: fl, vel: [0, -1.3], untilY: -8 }, { say: 'say.rumble', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 31,
    win: [run(X + 3 * T - 10), J(), land, run(X + 7 * T - 10), J(), land, run(X + 11 * T - 10), J(), land, run(X + 15 * T - 10), J(), land, run(X + 30 * T)],
    die: [run(X + 3 * T - 10), J(), land, ['', 200]],
  };
}

/** TRAP copycat-frog: a spiked frog hops toward you and jumps whenever you jump – bait it, run under it. */
function copycatFrog(b) {
  b.ground(0, 25);
  const fr = b.group({ tile: '*', frog: { speed: 2, jump: 11 } });
  b.put(19, 14, fr);
  const id = b.troll('A frog copies your jumps', { type: 'copycat-frog', hint: 'The spiked frog jumps whenever you jump – do a small hop when it is about 4 tiles away and run under it while it is in the air.' });
  b.trigger({ when: { zone: b.rect(3, 9, 1, 6) }, do: [{ activate: fr }], troll: id });
  b.trigger({ when: { zone: b.rect(24, 9, 1, 6) }, do: [{ deactivate: fr }] });
  const X = b.px(0);
  const fx = X + 19 * T + 20;
  return {
    w: 26,
    win: [run(X + 4 * T), ['R', `s.x >= ${fx} + s.g.${fr}[0] - 182`], ['RJ', 6], ['R', 's.grounded'], run(X + 25 * T)],
    die: [run(X + 25 * T)],
  };
}

/** TRAP storm-cloud: a storm cloud follows you and strikes where you stand – wait only under roofs. */
function stormCloud(b) {
  b.ground(0, 26);
  b.fill(7, 10, 11, 11, '#');
  b.fill(16, 19, 11, 11, '#');
  const sp = b.group({ tile: '^', hidden: true });
  b.fill(12, 14, 14, 14, sp);
  const id = b.troll('A storm cloud strikes where you stand', { type: 'storm-cloud', hint: 'A storm cloud follows you and strikes where you stand – only stop under the stone roofs, and pass the spikes when they are down.', hazards: [[12, 14, 3, 1]] });
  b.trigger({ when: { zone: b.rect(2, 9, 1, 6) }, do: [{ storm: { every: 70, warn: 30 } }, { pop: sp }], troll: id });
  b.trigger({ when: { zone: b.rect(2, 9, 1, 6) }, delay: 60, every: 120, stopAt: b.x0 + 24, do: [{ retract: sp }] });
  b.trigger({ when: { zone: b.rect(2, 9, 1, 6) }, delay: 120, every: 120, stopAt: b.x0 + 24, do: [{ pop: sp }] });
  b.trigger({ when: { zone: b.rect(24, 2, 1, 13) }, do: [{ unstorm: true }] });
  const X = b.px(0);
  return {
    w: 27,
    win: [run(X + 8 * T + 20), ['', `s.g.${sp}[2]===1`], ['', `s.g.${sp}[2]===0`], run(X + 17 * T + 20), ['', 20], run(X + 26 * T)],
    die: [run(X + 5 * T), ['', 120]],
  };
}

/** TRAP floor-eater: the thin bridge is eaten away behind you faster than you run – hop the pillars. */
function floorEater(b) {
  b.ground(0, 1);
  b.fill(2, 21, 17, 17, '^');
  const br = b.group({ tile: '#', columns: true });
  for (const [a, z] of [[2, 6], [8, 11], [13, 16], [18, 21]]) b.fill(a, z, 15, 15, br);
  for (const x of [7, 12, 17]) b.fill(x, x, 13, 17, '#');
  b.ground(22, 27);
  const id = b.troll('The floor is eaten away behind you', { type: 'floor-eater', hint: 'Something eats the thin bridge behind you faster than you can run – get up on the stone pillars and hop from pillar to pillar.', hazards: [[2, 17, 20, 1]] });
  b.trigger({ when: { zone: b.rect(3, 9, 1, 6) }, do: [{ eat: br, speed: 6 }, { say: 'say.run', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 28,
    win: [run(X + 5 * T + 10), J(), land, run(X + 7 * T + 34), J(), land, run(X + 12 * T + 34), J(), land, run(X + 17 * T + 34), J(), land, run(X + 27 * T)],
    die: [run(X + 6 * T), ['R', 120]],
  };
}

/** TRAP shadow-clone: a shadow replays your path a moment later – never stop and never go back. */
function shadowClone(b) {
  b.ground(0, 34);
  pit(b, 7, 8);
  b.fill(13, 14, 13, 14, '#');
  pit(b, 19, 21);
  b.put(26, 14, '#');
  pit(b, 29, 30);
  const id = b.troll('Your shadow replays your path', { type: 'shadow-clone', hint: 'A shadow of you follows your exact path a moment later – touching it kills: never stop and never go back.', hazards: [[7, 17, 2, 1], [19, 17, 3, 1], [29, 17, 2, 1]] });
  b.trigger({ when: { zone: b.rect(2, 2, 1, 13) }, do: [{ clone: 75 }], troll: id });
  b.trigger({ when: { zone: b.rect(33, 2, 1, 13) }, do: [{ unclone: true }] });
  const X = b.px(0);
  return {
    w: 35,
    win: [run(X + 7 * T - 30), J(), land, run(X + 13 * T - 40), J(), land, run(X + 19 * T - 22), J(), land, run(X + 26 * T - 40), J(10), land, run(X + 29 * T - 30), J(), land, run(X + 34 * T)],
    die: [run(X + 7 * T - 30), J(), land, ['', 150]],
  };
}

export default {
  id: 9, slug: 'run', name: 'Run!', idea: 'Something is always chasing you',
  winMessage: 'You outran everything.', deathQuips: ['Too slow!', 'Caught!', 'RUN!', 'Faster...'],
  minWidth: 428, style: 'ground',
  traps: [rollingBall, spikeTurret, chasingWall, spikedFish, homingBird, risingFlood, copycatFrog, stormCloud, floorEater, shadowClone],
};
