// LEVEL 15 – "Laser Show": lasers, beams, scanners and light betray you. A neon night lab (src/game/ext/l15.ts):
// red lasers kill while they shine, the green sensor line is harmless to touch (but it reports you), yellow light
// is just light. Between the traps: hand-written platforming courses.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof, pillars } from '../parkour.mjs';

/** a group drawn by the laser extension only; its map tile (local x, y) is where its prop sits */
const laser = (b, x, y, ext, extra = {}) => {
  const g = b.group({ tile: '?', ...extra, ext });
  b.put(x, y, g);
  return g;
};
const E = (g) => `s.ext.l15.${g}`;

/** creep right at walking pace (tap right) until x ≥ px: never faster than ~150 px/s */
const creep = (px) => Array.from({ length: 140 }, () => [['R', `s.vx >= 110 || s.x >= ${px}`], ['', `s.vx <= 50 || s.x >= ${px}`]]).flat();

/** TRAP tripwire-alarm: breaking the green sensor line sends a laser wall sweeping back down the hall – hop it. */
function tripwireAlarm(b) {
  const X = b.px(0);
  b.ground(0, 2);
  b.fill(3, 4, 17, 17, '#');
  b.fill(3, 4, 16, 16, '^');
  b.ground(5, 21);
  b.fill(5, 19, 0, 8, '#');
  const wire = laser(b, 7, 14, { kind: 'beam', harmless: true, trip: true, pts: [[X + 7 * T, 590], [X + 10 * T, 590]] });
  const wall = laser(b, 19, 9, { kind: 'beam', pts: [[X + 19 * T + 20, 372], [X + 19 * T + 20, 600]] }, { hidden: true });
  const id = b.troll('Breaking the sensor line sends a laser wall', { type: 'tripwire-alarm', hint: 'The thin green line at your ankles is an alarm: if you break it a laser wall sweeps back down the hall – hop over the line right after the spike pit.', hazards: [[3, 16, 2, 1]] });
  b.trigger({ when: { zone: b.rect(5, 9, 15, 6), ext: { kind: 'cut', g: wire } }, do: [{ show: wall }, { move: wall, by: [-15, 0], ticks: 55 }], troll: id });
  return {
    w: 22,
    win: [run(X + 3 * T - 10), ['RJ', 4], land, run(X + 7 * T - 30), J(16), land, run(X + 21 * T)],
    die: [run(X + 3 * T - 10), ['RJ', 4], land, run(X + 16 * T), wait(120)],
  };
}

/** TRAP jump-armed-laser: the dim "switched-off" laser over the hurdles switches on the moment you jump. */
function jumpArmedLaser(b) {
  const X = b.px(0);
  b.ground(0, 19);
  const beam = laser(b, 2, 12, { kind: 'beam', dim: true, ends: true, pts: [[X + 2 * T + 20, 480], [X + 17 * T + 20, 480]] }, { hidden: true });
  b.put(6, 14, '#');
  b.put(10, 14, '#');
  b.fill(13, 14, 14, 14, '^');
  const id = b.troll('The switched-off laser switches on when you jump', { type: 'jump-armed-laser', hint: 'The dim laser over the hurdles is not off: it switches on the moment you jump – clear the hurdles and spikes with short, low hops.' });
  b.trigger({ when: { zone: b.rect(3, 9, 14, 6), airborne: true }, do: [{ show: beam }], troll: id });
  return {
    w: 20,
    win: [run(X + 6 * T - 34), ['RJ', 6], land, run(X + 10 * T - 34), ['RJ', 6], land, run(X + 13 * T - 34), ['RJ', 6], land, run(X + 19 * T)],
    die: [run(X + 6 * T - 34), J(16), ['R', 60]],
  };
}

/** TRAP sweep-scanner: a scanner ray turns round the hall; its tip races ahead of you – follow behind it. */
function sweepScanner(b) {
  const X = b.px(0);
  b.ground(0, 25);
  b.fill(4, 21, 0, 6, '#');
  b.fill(1, 3, 0, 12, '#');
  b.fill(22, 24, 0, 12, '#');
  b.fill(16, 17, 14, 14, '^');
  const ray = laser(b, 13, 7, { kind: 'rot', c: [X + 13 * T, 7 * T + 12], len: 900, a0: 90, w: -1.12 });
  const id = b.troll('The scanner ray sweeps the hall', { type: 'sweep-scanner', hint: 'The scanner ray turns round and its tip on the floor speeds up as it goes – wait until it has swept past the doorway, then follow close behind it (do not jump right behind it: the ray leans back over you).' });
  b.trigger({ when: { zone: b.rect(4, 7, 18, 8) }, do: [], troll: id });
  return {
    w: 26,
    win: [['', `${E(ray)} > 150 && ${E(ray)} < 200`], ['', `${E(ray)} <= 128`], run(X + 15 * T + 20), ['RJ', 10], land, run(X + 25 * T)],
    die: [['', `${E(ray)} > 240 && ${E(ray)} < 300`], ['', `${E(ray)} <= 235`], run(X + 15 * T + 20), ['RJ', 10], land, run(X + 25 * T)],
  };
}

/** TRAP gap-curtain: the gaps at the foot of the laser curtains start moving when you come near – go with the wave. */
function gapCurtain(b) {
  const X = b.px(0);
  b.ground(0, 21);
  b.fill(4, 17, 0, 7, '#');
  const P = 110;
  const cur = (lx, k) => laser(b, lx - 1, 8, { kind: 'curtain', x: X + lx * T, y0: 324, y1: 600, gap: 84, lo: 580, hi: 380, period: P, phase: (-360 * 32 * k) / P });
  const c1 = cur(7, 0), c2 = cur(11, 1), c3 = cur(15, 2);
  const id = b.troll('The gaps in the laser curtains move', { type: 'gap-curtain', hint: 'The gaps at the foot of the three laser curtains start moving up and down as you come – wait until the first gap comes back down to the floor and run straight through all three with the wave.' });
  b.trigger({ when: { zone: b.rect(3, 8, 2, 7) }, do: [{ ext: 'laser.start', g: c1, g2: c2 }, { ext: 'laser.start', g: c3 }], troll: id });
  return {
    w: 22,
    win: [run(X + 6 * T - 6), ['', 4], ['', `${E(c1)} < 450`], ['', `${E(c1)} >= 548`], run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP mirror-ledge: the plate on the open ledge swings the mirror – the beam then sweeps the ledge. Take the low tunnel. */
function mirrorLedge(b) {
  const X = b.px(0);
  b.ground(0, 23);
  b.fill(2, 2, 13, 14, '#');
  b.fill(4, 7, 12, 12, '#');
  const plate = b.group({ tile: '#', button: 'red' });
  b.fill(8, 10, 12, 12, plate);
  b.fill(11, 19, 12, 12, '#');
  b.put(9, 14, '^');
  b.put(14, 14, '^');
  const mx = X + 4 * T + 20, ex = X + 21 * T + 20;
  const beam = laser(b, 21, 9, {
    kind: 'beam',
    paths: [[[ex, 380], [mx, 380], [mx, -40]], [[ex, 380], [mx, 380], [mx, 466], [X + 20 * T + 20, 466]]],
    mirrors: [[mx, 380, -45, 45], [mx, 466, -45, -45]],
  });
  const id = b.troll('The mirror turns the laser onto the ledge', { type: 'mirror-ledge', hint: 'The red plate on the open ledge swings the mirror and the laser sweeps the whole ledge – drop down and take the low tunnel under it (hop its two spikes with tiny hops).' });
  b.trigger({ when: { touch: plate }, do: [{ ext: 'laser.path', g: beam, args: { i: 1 } }], troll: id });
  return {
    w: 24,
    win: [run(X + 2 * T - 30), ['RJ', 10], land, run(X + 9 * T - 26), ['RJ', 2], land, run(X + 14 * T - 26), ['RJ', 2], land, run(X + 23 * T)],
    die: [run(X + 2 * T - 30), ['RJ', 10], land, run(X + 3 * T - 6), ['RJ', 8], land, run(X + 12 * T), wait(30)],
  };
}

/** TRAP smoke-beam: an invisible laser crosses the smoke column – only the smoke glows while it is on. */
function smokeBeam(b) {
  const X = b.px(0);
  b.ground(0, 2);
  b.fill(3, 4, 17, 17, '#');
  b.fill(3, 4, 16, 16, '^');
  b.ground(5, 19);
  b.fill(6, 13, 0, 8, '#');
  const x = X + 9 * T + 20;
  const beam = laser(b, 9, 9, { kind: 'beam', smoke: [x, 372, 600], pts: [[x, 362], [x, 600]], seq: [80, 45], first: 'on' });
  const id = b.troll('An invisible laser crosses the smoke', { type: 'smoke-beam', hint: 'An invisible laser crosses the smoke column: while it is on the smoke glows red – wait on the far side of the spike pit until the smoke turns grey, then run through.', hazards: [[9, 9, 1, 6]] });
  b.trigger({ when: { zone: b.rect(0, 10, 2, 5) }, do: [{ ext: 'laser.start', g: beam }], troll: id });
  return {
    w: 20,
    win: [run(X + 3 * T - 10), J(10), land, run(X + 6 * T), ['', `s.g.${beam}[2] === 0`], run(X + 19 * T)],
    die: [run(X + 3 * T - 10), J(10), land, run(X + 19 * T)],
  };
}

/** TRAP prism-fan: passing under the prism makes it fan out into rays – stop in its shadow until they go out. */
function prismFan(b) {
  const X = b.px(0);
  b.ground(0, 25);
  b.fill(3, 23, 0, 5, '#');
  b.fill(18, 23, 6, 6, '#');
  const cx = X + 13 * T + 20;
  const xs = [0.5, 2, 3.5, 5, 6.5, 8, 9.5, 13.5, 15, 16.5, 18, 19.5, 21, 22.5, 24, 25.5].map((v) => X + v * T);
  const pr = laser(b, 13, 6, { kind: 'prism', c: [cx, 300], top: 6 * T, xs, y: 600, warn: 45, on: 70 });
  b.decor(11, 15, 2, 1, 'shadow');
  const id = b.troll('The prism fans out into rays', { type: 'prism-fan', hint: 'When you pass under it the prism charges and fans out into rays down to the floor – stop on the dark spot in its shadow just before the prism and wait until the rays go out.' });
  b.trigger({ when: { zone: b.rect(6, 6, 1, 9) }, do: [{ ext: 'laser.start', g: pr }], troll: id });
  return {
    w: 26,
    win: [run(X + 11 * T + 26), ['', `${E(pr)} >= 118`], run(X + 25 * T)],
    die: [run(X + 25 * T)],
  };
}

/** TRAP rhythm-beams: the laser gates pulse to a beat that gets faster and faster. */
function rhythmBeams(b) {
  const X = b.px(0);
  b.ground(0, 25);
  b.fill(3, 23, 0, 7, '#');
  const g = b.group({ tile: '?', ext: { kind: 'beam', down: true, seq: [70, 40, 56, 36, 46, 32, 38, 28, 32, 26, 28, 24], first: 'off' } });
  const xs = [6, 10, 14, 18, 22];
  for (const x of xs) b.put(x, 8, g);
  b.put(12, 14, '^');
  b.put(16, 14, '#');
  const id = b.troll('The laser gates pulse faster and faster', { type: 'rhythm-beams', hint: 'The five laser gates pulse together and the beat gets faster each time – stop in front of every gate, and run through the moment it goes out.' });
  b.trigger({ when: { zone: b.rect(2, 8, 1, 7) }, do: [{ ext: 'laser.start', g }], troll: id });
  const gate = (x) => [run(X + x * T - 10), ['', 6], ['', `s.g.${g}[2] === 1`], ['', `s.g.${g}[2] === 0`]];
  return {
    w: 26,
    win: [...gate(6), run(X + 9 * T + 10), ...gate(10), run(X + 12 * T - 34), J(8), land, ...gate(14), run(X + 16 * T - 34), J(8), land, ...gate(18), ...gate(22), run(X + 25 * T)],
    die: [run(X + 12 * T - 34), J(8), land, run(X + 16 * T - 34), J(8), land, run(X + 25 * T)],
  };
}

/** TRAP camera-cone: if the camera's light cone finds you, the laser grid fires – hide under the stone canopies. */
function cameraCone(b) {
  const X = b.px(0);
  b.ground(0, 27);
  b.fill(2, 25, 0, 5, '#');
  b.fill(6, 8, 12, 13, '#');
  b.fill(13, 15, 12, 13, '#');
  b.fill(20, 22, 12, 13, '#');
  const cam = laser(b, 14, 6, { kind: 'cam', c: [X + 14 * T + 20, 262], a0: 130, a1: 50, hold: 50, sweep: 70, half: 13, range: 640, delay: 20, grid: [X + 2 * T + 10, X + 25 * T + 30, 6 * T, 600] });
  const id = b.troll('The camera sees you and the laser grid fires', { type: 'camera-cone', hint: 'If the camera\'s light cone touches you the whole room fills with lasers – move only while it looks the other way and hide under the three stone canopies.' });
  b.trigger({ when: { zone: b.rect(2, 6, 24, 9), ext: { kind: 'seen', g: cam } }, do: [], troll: id });
  const A = E(cam);
  return {
    w: 28,
    win: [['', `${A} <= 60`], run(X + 7 * T + 8), ['', `${A} >= 120`], ['', `${A} <= 60`], run(X + 14 * T + 8), ['', `${A} >= 120`], run(X + 21 * T + 8), ['', `${A} <= 60`], ['', `${A} >= 128`], run(X + 27 * T)],
    die: [['', `${A} >= 128`], run(X + 27 * T), wait(60)],
  };
}

/** TRAP speed-camera: the speed camera zaps anyone faster than walking pace – creep past it. */
function speedCamera(b) {
  const X = b.px(0);
  b.ground(0, 16);
  b.fill(17, 19, 17, 17, '#');
  b.fill(17, 19, 16, 16, '^');
  b.ground(20, 23);
  const radar = laser(b, 4, 12, { kind: 'radar', c: [X + 4 * T + 14, 13 * T], zone: [X + 5 * T, X + 16 * T], y: 598 });
  const id = b.troll('The speed camera zaps you', { type: 'speed-camera', hint: 'The camera on the pole zaps anyone faster than walking pace on the dashed stretch – tap right to creep along it, then take a run-up for the spike pit.', hazards: [[17, 16, 3, 1]] });
  b.trigger({ when: { zone: b.rect(5, 11, 11, 4), ext: { kind: 'fast', v: 200 } }, do: [{ ext: 'laser.zap', g: radar }], troll: id });
  return {
    w: 24,
    win: [run(X + 4 * T), ['', 's.vx <= 60'], ...creep(X + 16 * T + 14), run(X + 17 * T - 14), J(16), land, run(X + 23 * T)],
    die: [run(X + 20 * T)],
  };
}

/** TRAP hologram-grid: the bright laser wall is a hologram – the faint line above it is the real laser. */
function hologramGrid(b) {
  const X = b.px(0);
  b.ground(0, 21);
  b.fill(4, 15, 0, 5, '#');
  b.put(5, 14, '#');
  b.fill(6, 6, 13, 14, '#');
  b.fill(7, 7, 12, 14, '#');
  const lines = [];
  for (let i = 0; i < 8; i++) { const x = X + 9 * T + 10 + i * 20; lines.push([x, 446, x, 600]); }
  const holo = laser(b, 9, 10, { kind: 'beam', holo: true, lines });
  const real = laser(b, 8, 9, { kind: 'beam', faint: true, ends: true, pts: [[X + 8 * T, 430], [X + 14 * T + 10, 430]] });
  const id = b.troll('The real laser is the faint one above the hologram', { type: 'hologram-grid', hint: 'The bright laser wall is a flickering hologram – walk straight through it; the faint pink line above it is the real laser, so do not jump over the wall from the stairs.' });
  b.groupTroll(holo, id);
  b.groupTroll(real, id);
  b.trigger({ when: { zone: b.rect(8, 9, 7, 2) }, do: [], troll: id });
  return {
    w: 22,
    win: [run(X + 5 * T - 14), ['RJ', 4], land, run(X + 6 * T - 14), ['RJ', 4], land, run(X + 7 * T - 14), ['RJ', 4], land, run(X + 21 * T)],
    die: [run(X + 5 * T - 14), ['RJ', 4], land, run(X + 6 * T - 14), ['RJ', 4], land, run(X + 7 * T - 14), ['RJ', 4], land, run(X + 7 * T + 20), J(22), ['R', 60]],
  };
}

/** TRAP dance-floor: the dance floor fires lasers up from every other pair of panels – step to the dark ones in time. */
function danceFloor(b) {
  const X = b.px(0);
  b.ground(0, 23);
  b.fill(2, 21, 0, 8, '#');
  const d = laser(b, 3, 9, { kind: 'dance', x0: b.x0 + 3, pairs: 8, top: 9 * T, floor: 600, warn: 40, fire: 22 });
  const id = b.troll('The dance floor fires lasers', { type: 'dance-floor', hint: 'Every other pair of dance-floor panels glows and then fires a laser up to the ceiling – keep stepping onto the pair that is not glowing, one pair at a time.', hazards: [[3, 9, 16, 6]] });
  b.trigger({ when: { zone: b.rect(1, 9, 1, 6) }, do: [{ ext: 'laser.start', g: d }], troll: id });
  const steps = [];
  for (let j = 2; j < 8; j++) {
    const p = (j - 1) % 2;
    steps.push(['', `${E(d)} % 124 >= ${62 * p} && ${E(d)} % 124 < ${62 * p + 34}`], run(X + (3 + 2 * j + 1) * T - 14), ['', 8]);
  }
  return {
    w: 24,
    win: [run(X + 6 * T - 14), ['', 8], ...steps, ['', `${E(d)} % 124 >= 62 && ${E(d)} % 124 < 96`], run(X + 23 * T)],
    die: [run(X + 23 * T)],
  };
}

/** TRAP solar-lift: the lift rises on sunlight – your shadow on its panel sinks it into the spikes. */
function solarLift(b) {
  const X = b.px(0);
  b.ground(0, 3);
  b.fill(4, 17, 17, 17, '#');
  b.fill(4, 17, 16, 16, '^');
  b.fill(3, 8, 0, 1, '#');
  const lift = b.group({ tile: '#', ext: { kind: 'solar', bx: X + 5 * T + 20, by: 2 * T + 6, up: 1.6, down: 4, minOy: -5 * T, maxOy: 2 * T } });
  b.fill(4, 6, 15, 15, lift);
  b.fill(9, 19, 10, 10, '#');
  b.ground(18, 23);
  const id = b.troll('Your shadow sinks the solar lift', { type: 'solar-lift', hint: 'The lift only rises while the light reaches its solar panel – stand on its left edge (out of the light beam) and ride it up; standing in the middle casts your shadow on the panel and it sinks into the spikes.', hazards: [[4, 16, 14, 1]] });
  b.trigger({ when: { touch: lift }, do: [], troll: id });
  return {
    w: 24,
    win: [run(X + 4 * T + 2), ['', `s.g.${lift}[1] <= ${-5 * T}`], run(X + 7 * T - 18), J(14), land, run(X + 19 * T + 30), ['R', 's.grounded'], run(X + 23 * T)],
    die: [run(X + 5 * T + 10), wait(200)],
  };
}

/** TRAP blade-bridge: the hard-light bridge slides out to you with a laser blade on its tip – let it dock first. */
function bladeBridge(b) {
  const X = b.px(0);
  b.ground(0, 3);
  b.fill(4, 15, 17, 17, '#');
  b.fill(4, 15, 16, 16, '^');
  const br = b.group({ tile: '#', hidden: true, columns: true, tint: 0x9ff7ff, ext: { kind: 'blade', speed: 2.4, minX: X + 4 * T, maxX: X + 16 * T, y0: 15 * T - 150, y1: 15 * T + 30 } });
  b.fill(4, 15, 15, 15, br);
  b.ground(16, 21);
  b.put(16, 14, '#');
  const id = b.troll('The light bridge has a laser blade', { type: 'blade-bridge', hint: 'The light bridge slides out toward you with a laser blade on its tip – stay back at the edge and only step on once it has docked and the blade is gone.', hazards: [[4, 16, 12, 1]] });
  b.trigger({ when: { zone: b.rect(1, 10, 2, 5) }, do: [{ ext: 'laser.extend', g: br }], troll: id });
  return {
    w: 22,
    win: [run(X + 3 * T - 12), ['', `${E(br)} <= ${X + 4 * T}`], ['', 4], run(X + 16 * T - 30), J(10), land, run(X + 21 * T)],
    die: [run(X + 3 * T - 12), ['', `${E(br)} <= ${X + 9 * T}`], run(X + 4 * T - 14), J(16), ['R', 60]],
  };
}

/** TRAP charge-cannon: the cannon behind you fires a long beam along the floor – duck into the trenches. */
function chargeCannon(b) {
  const X = b.px(0);
  b.ground(0, 6);
  b.fill(7, 8, 16, 17, '#');
  b.ground(9, 13);
  b.fill(14, 15, 16, 17, '#');
  b.ground(16, 20);
  b.fill(21, 22, 16, 17, '#');
  b.ground(23, 27);
  b.put(1, 14, '#');
  b.put(25, 14, '#');
  const cn = laser(b, 2, 13, { kind: 'cannon', c: [X + 2 * T + 6, 586], x1: X + 25 * T, charge: 64, fire: 46, rest: 30, lead: 24 });
  const id = b.troll('The cannon fires along the floor', { type: 'charge-cannon', hint: 'The cannon behind you charges up and fires a long beam along the floor – drop into a trench before every shot and run on after it.', hazards: [[3, 14, 22, 1]] });
  b.trigger({ when: { zone: b.rect(0, 10, 1, 5) }, do: [{ ext: 'laser.start', g: cn }], troll: id });
  const after = `${E(cn)} % 140 >= 110`, firing = `${E(cn)} % 140 >= 64 && ${E(cn)} % 140 < 110`;
  return {
    w: 28,
    win: [run(X + 1 * T - 30), ['RJ', 10], land, run(X + 8 * T), ['', 's.grounded && s.y > 615'], ['', firing], ['', after], ['RJ', 8], land, run(X + 15 * T), ['', 's.grounded && s.y > 615'], ['', firing], ['', after], ['RJ', 8], land, run(X + 22 * T), ['', 's.grounded && s.y > 615'], ['', firing], ['', after], ['RJ', 8], land, run(X + 25 * T - 34), J(10), land, run(X + 27 * T)],
    die: [run(X + 1 * T - 30), ['RJ', 10], land, wait(200)],
  };
}

export default {
  id: 15,
  slug: 'laser-show',
  name: 'Laser Show',
  idea: 'Lasers, beams, scanners and light betray you',
  winMessage: 'Lights out, you made it!',
  deathQuips: ['Zapped!', 'Crispy.', 'That was a light snack.', 'Pew pew. You lost.', 'Shine on, you crazy blob.'],
  handmade: true,
  minWidth: 808,
  traps: [tripwireAlarm, jumpArmedLaser, sweepScanner, gapCurtain, mirrorLedge, smokeBeam, prismFan, rhythmBeams, cameraCone, speedCamera, hologramGrid, danceFloor, solarLift, bladeBridge, chargeCannon],
  between: [
    [flat(1), pit(3, 3, 1), isle(3, 2, 1), pit(4, 2, -2), up(2, 2), down(2, 3)],
    [thorns(2, 2), up(1, 2), isle(3, 2, 1), pit(3, 2, -1), spikes(4, 2, -1)],
    [roof(4), flat(1), pit(3, 2), block(2, 1, 2), isle(3, 2, 1), down(1, 2), spikes(3, 2)],
    [up(2, 2), pit(3, 1, 1), down(2, 3), spikes(4, 2), isle(3, 3, 2), pit(2, 2, -3)],
    [isle(3, 2), isle(3, 3, 1), isle(4, 2, -1), pit(4, 3), thorns(2, 2)],
    [spikes(3, 2, 1), up(2, 2), pit(3, 2, -1), spikes(3, 2, -2), pillars(3, 1, [0, 1]), down(1, 2)],
    [thorns(3, 2), isle(3, 2, 2), isle(2, 3, 1), pit(4, 2, -2), spikes(2, 2, -1)],
    [up(1, 2), spikes(3, 2, 1), pit(3, 2, 1), down(3, 4), isle(4, 2), pit(3, 1)],
    [pillars(3, 2, [1, 1, -2]), roof(4), spikes(4, 2), block(1, 1, 3), pit(3, 2)],
    [isle(2, 2, 2), isle(3, 2, 1), isle(4, 2, -2), pit(3, 2, -1), thorns(2, 3)],
    [up(1, 2), spikes(3, 2, -1), pit(3, 2, 1), isle(3, 3, 1), pit(4, 2, -2)],
    [block(2, 2, 2), spikes(3, 2, 1), pit(3, 2, 1), isle(4, 2, -1), down(1, 3), pit(3, 2)],
    [isle(3, 2, 2), down(2, 2), spikes(4, 3), pillars(2, 1, [1, 1]), down(2, 3)],
    [up(2, 3), pit(4, 2), spikes(3, 2, -2), roof(3), flat(1), isle(3, 2, 1), pit(3, 2, -1)],
    [thorns(1, 3), pit(3, 2, 2), down(2, 2), spikes(3, 4), block(2, 1, 4)],
    [isle(4, 2), roof(2), flat(1), spikes(3, 2, 1), down(1, 2), isle(3, 2), pit(4, 3)],
  ],
};
