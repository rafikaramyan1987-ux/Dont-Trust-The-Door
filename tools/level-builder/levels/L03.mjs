// LEVEL 3 – "Spring Fever": springs. Floating islands over a bottomless void.
import { T, run, runL, J, land, wait } from '../lib.mjs';

const sky = (b, x0, x1) => b.fill(x0, x1, 15, 16, '#');

/** TRAP spring-ceiling: the spring shoots you into a spiked ceiling – steer back through the gap. */
function springCeiling(b) {
  sky(b, 0, 10);
  sky(b, 20, 24);
  b.fill(0, 5, 7, 7, '#');
  b.fill(9, 19, 7, 7, '#');
  b.fill(9, 14, 8, 8, 'v');
  const p = b.group({ tile: '=' });
  b.put(8, 14, p);
  b.groupTroll(p, b.troll('The spring shoots you into ceiling spikes', { type: 'spring-ceiling', hint: 'The spring shoots you at spikes – hold LEFT while flying to go up through the gap.', hazards: [[9, 8, 6, 1]] }));
  const X = b.px(0);
  return {
    w: 25,
    win: [['R', 's.vy<-1000'], ['L', 's.grounded'], run(X + 5 * T - 30), J(), land, run(X + 19 * T + 30), ['R', 's.grounded && s.y>480'], run(X + 24 * T)],
    die: [['R', 's.vy<-1000'], ['R', 100]],
  };
}

/** TRAP dud-spring: of two floating springs the first (rusty) one is a dud. */
function dudSpring(b) {
  sky(b, 0, 4);
  sky(b, 14, 18);
  const d = b.group({ tile: '=', dud: true });
  b.put(6, 14, d);
  const r = b.group({ tile: '=' });
  b.put(8, 14, r);
  b.groupTroll(d, b.troll('The first spring is a dud', { type: 'dud-spring', hint: 'The first (rusty) spring over the void is a dud – jump past it onto the red one.' }));
  const X = b.px(0);
  return {
    w: 19,
    win: [run(X + 4 * T - 10), J(), ['R', 's.vy<-1000'], ['R', 's.grounded'], run(X + 18 * T)],
    die: [run(X + 4 * T - 10), ['RJ', 6], ['R', 120]],
  };
}

/** TRAP hidden-spring: a spring pops out of the floor right under you, below a spiked bar. */
function hiddenSpring(b) {
  sky(b, 0, 15);
  b.fill(5, 10, 7, 7, '#');
  b.fill(5, 10, 8, 8, 'v');
  b.put(3, 14, '#');
  const p = b.group({ tile: '=', hidden: true });
  b.put(8, 14, p);
  const id = b.troll('A spring pops out of the floor', { type: 'hidden-spring', hint: 'A spring pops out of the floor under the spiked bar – jump over that spot.', hazards: [[5, 8, 6, 1]] });
  b.trigger({ when: { zone: b.rect(8, 13, 1, 2), grounded: true }, do: [{ show: p }], troll: id });
  const X = b.px(0);
  return {
    w: 16,
    win: [run(X + 3 * T - 40), J(10), land, run(X + 6 * T + 20), J(), land, run(X + 15 * T)],
    die: [run(X + 3 * T - 40), J(10), land, run(X + 9 * T), ['R', 60]],
  };
}

/** TRAP sideways-spring: a blue sideways spring flings you into a spiked overhang. */
function sidewaysSpring(b) {
  sky(b, 0, 14);
  sky(b, 18, 22);
  const p = b.group({ tile: '=', launch: [950, -650] });
  b.put(4, 14, p);
  b.fill(10, 12, 10, 11, '#');
  b.fill(10, 10, 12, 13, '<');
  b.groupTroll(p, b.troll('A sideways spring flings you into spikes', { type: 'sideways-spring', hint: 'The blue spring flings you sideways into spikes – jump over it.', hazards: [[10, 12, 1, 2]] }));
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 4 * T - 40), J(10), land, run(X + 15 * T - 34), J(), land, run(X + 22 * T)],
    die: [run(X + 4 * T + 10), ['R', 100]],
  };
}

/** TRAP catapult-spring: a pressure plate makes a spring on a ledge lob a spiked ball at you. */
function catapultSpring(b) {
  sky(b, 0, 17);
  b.fill(11, 15, 9, 9, '#');
  b.put(12, 8, '=');
  const ball = b.group({ tile: '*' });
  b.put(12, 7, ball);
  const id = b.troll('A spring lobs a spiked ball at you', { type: 'catapult-spring', hint: 'Stepping on the stone plate makes the spring lob a spiked ball at you – keep running under it.', hazards: [[3, 13, 2, 2]] });
  b.trigger({ when: { zone: b.rect(3, 13, 1, 2) }, do: [{ toss: ball, vel: [-5, -14.1] }, { say: 'say.run', at: 'hero', ticks: 40 }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 17 * T)],
    die: [run(X + 3 * T + 20), ['', 120]],
  };
}

/** TRAP rubber-floor: springy floor bounces you only when you land on it from a jump. */
function rubberFloor(b) {
  sky(b, 0, 11);
  sky(b, 18, 22);
  const r = b.group({ tile: '=', minFall: 620 });
  b.fill(4, 11, 14, 14, r);
  b.fill(4, 8, 6, 6, '#');
  b.fill(4, 8, 7, 7, 'v');
  b.fill(11, 11, 6, 6, '#');
  b.fill(11, 11, 7, 7, 'v');
  b.fill(12, 13, 6, 16, '#');
  b.fill(14, 17, 6, 6, '#');
  b.groupTroll(r, b.troll('The rubber floor bounces you into spikes', { type: 'rubber-floor', hint: 'The springy floor only bounces when you land on it hard – walk on it and jump only under the gap in the ceiling.', hazards: [[4, 7, 5, 1], [11, 7, 1, 1]] }));
  const X = b.px(0);
  return {
    w: 23,
    win: [run(X + 9 * T + 30), ['', 8], ['J', 16], ['', 's.vy<-1000'], ['', 's.y<200'], ['R', 's.grounded'], run(X + 17 * T + 30), ['R', 's.grounded && s.y>480'], run(X + 22 * T)],
    die: [run(X + 6 * T), ['', 6], ['J', 16], ['', 120]],
  };
}

/** TRAP escalating-spring: a spring in a well bounces you higher every time – into spikes on the 3rd. */
function escalatingSpring(b) {
  sky(b, 0, 4);
  b.fill(5, 7, 17, 17, '#');
  b.fill(4, 4, 15, 17, '#');
  const p = b.group({ tile: '=', stack: [700, 1150, 1720] });
  b.fill(5, 7, 16, 16, p);
  b.fill(8, 14, 11, 16, '#');
  b.fill(3, 9, 1, 1, '#');
  b.fill(3, 9, 2, 2, 'v');
  b.fill(15, 16, 13, 16, '#');
  sky(b, 17, 21);
  b.groupTroll(p, b.troll('The spring bounces higher every time', { type: 'escalating-spring', hint: 'The spring in the well bounces you higher each time – jump off to the right on the second bounce.', hazards: [[3, 2, 7, 1]] }));
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 5 * T + 30), ['', 's.vy<-1000'], ['R', 's.grounded'], run(X + 21 * T)],
    die: [run(X + 5 * T + 30), ['', 300]],
  };
}

/** TRAP overshoot-spring: a diagonal spring flings you far past the tiny island if you hold RIGHT. */
function overshootSpring(b) {
  sky(b, 0, 5);
  const p = b.group({ tile: '=', launch: [600, -1000], lock: 0 });
  b.put(5, 14, p);
  b.fill(7, 9, 12, 12, '#');
  sky(b, 15, 20);
  b.groupTroll(p, b.troll('The diagonal spring flings you too far', { type: 'overshoot-spring', hint: 'The diagonal spring throws you way too far – let go of the keys after it launches you to land on the small island.', hazards: [[10, 15, 5, 2]] }));
  const X = b.px(0);
  return {
    w: 21,
    win: [['R', 's.vy<-600'], ['', 's.grounded'], run(X + 10 * T - 20), J(), land, run(X + 20 * T)],
    die: [['R', 's.vy<-600'], ['R', 120]],
  };
}

export default {
  id: 3, slug: 'spring-fever', name: 'Spring Fever', idea: 'Springs',
  winMessage: 'What goes up... gets spiked.', deathQuips: ['Boing... ouch.', 'Too much spring!', 'Splat.', 'Whee— oh.'],
  minWidth: 270, style: 'sky',
  traps: [springCeiling, dudSpring, hiddenSpring, sidewaysSpring, catapultSpring, rubberFloor, escalatingSpring, overshootSpring],
};
