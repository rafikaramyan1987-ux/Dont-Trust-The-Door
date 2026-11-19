// LEVEL 11 – "Push the Button": buttons and switches do something other than they promise. A factory floor.
// Between the traps: hand-written platforming courses (parkour.mjs), no generated filler.
import { T, run, runL, J, land, wait } from '../lib.mjs';
import { flat, up, down, pit, spikes, isle, block, thorns, roof } from '../parkour.mjs';

/** a push button set into the floor (cols x0..x1, rows y0..17) */
function button(b, x0, x1, color = 'red', y0 = 15, extra = {}) {
  const g = b.group({ tile: '#', button: color, ...extra });
  b.fill(x0, x1, y0, 17, g);
  return g;
}

/** TRAP button-trapdoor: the button opens the gate – and a moment later the floor under the button drops away. */
function buttonTrapdoor(b) {
  b.ground(0, 3);
  const k = button(b, 4, 5);
  b.ground(6, 15);
  const gate = b.group({ tile: '#', look: 'bolted' });
  b.fill(10, 10, 10, 14, gate);
  b.fill(9, 11, 6, 9, '#');
  const id = b.troll('The button drops the floor under itself', { type: 'button-trapdoor', hint: 'The button opens the gate, then the floor under the button drops away – step on it and keep walking straight through.' });
  b.trigger({ when: { touch: k }, do: [{ hide: gate }, { fall: k, shake: 16 }], troll: id });
  const X = b.px(0);
  return { w: 16, win: [run(X + 15 * T)], die: [run(X + 4 * T + 20), wait(90)] };
}

/** TRAP slow-bridge: the button builds the bridge plank by plank, slower than you run. */
function slowBridge(b) {
  b.ground(0, 4);
  const k = button(b, 2, 3);
  const br = b.group({ tile: '#', hidden: true, columns: true });
  b.fill(5, 14, 15, 15, br);
  b.ground(15, 20);
  const id = b.troll('The bridge builds itself slower than you run', { type: 'slow-bridge', hint: 'The button builds the bridge one plank at a time, slower than you run – wait on the button until it reaches the far side.' });
  b.trigger({ when: { touch: k }, do: [{ grow: br, speed: 2.2 }], troll: id });
  const X = b.px(0);
  return { w: 21, win: [run(X + 3 * T), wait(195), run(X + 20 * T)], die: [run(X + 20 * T)] };
}

/** TRAP delayed-crusher: the button opens the gate at once, and drops the corridor's crusher just as you get there. */
function delayedCrusher(b) {
  b.ground(0, 21);
  const k = button(b, 3, 4);
  b.fill(7, 19, 9, 10, '#');
  const cr = b.group({ tile: '#', look: 'cracked' });
  b.fill(10, 11, 10, 10, cr);
  const gate = b.group({ tile: '#', look: 'bolted' });
  b.fill(18, 18, 11, 14, gate);
  const id = b.troll('The button drops the crusher when you get there', { type: 'delayed-crusher', hint: 'The button opens the gate, then drops the cracked crusher in the corridor a moment later – wait on the button until it has crashed down, then hop over it.' });
  const go = b.uid('crush');
  b.trigger({ id: go, when: { touch: k }, do: [{ hide: gate }], troll: id });
  b.trigger({ when: { after: go }, delay: 50, do: [{ move: cr, by: [0, 4], ticks: 14, deadly: true }], troll: id });
  const X = b.px(0);
  return {
    w: 22,
    win: [run(X + 3 * T + 30), wait(90), run(X + 9 * T - 14), ['RJ', 5], land, run(X + 21 * T)],
    die: [run(X + 21 * T)],
  };
}

/** TRAP wrong-colour: the friendly green button drops ceiling spikes; the red one lowers the bridge. */
function wrongColour(b) {
  b.ground(0, 8);
  const green = button(b, 2, 3, 'green');
  const red = button(b, 6, 7, 'red');
  b.fill(1, 4, 5, 6, '#');
  const sp = b.group({ tile: 'v' });
  b.fill(1, 4, 7, 7, sp);
  const br = b.group({ tile: '#', hidden: true });
  b.fill(9, 13, 15, 15, br);
  b.ground(14, 19);
  const id = b.troll('Green is the dangerous colour', { type: 'wrong-colour', hint: 'The green button drops the ceiling spikes on you – jump over it; the red button lowers the bridge.' });
  b.trigger({ when: { touch: green }, do: [{ fall: sp, shake: 2 }], troll: id });
  b.trigger({ when: { touch: red }, do: [{ show: br }] });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 2 * T - 26), ['RJ', 9], land, run(X + 7 * T), run(X + 19 * T)],
    die: [run(X + 2 * T + 30), wait(60)],
  };
}

/** TRAP retract-button: the "extend bridge" button in front of the bridge retracts it. */
function retractButton(b) {
  b.ground(0, 5);
  const k = button(b, 4, 5);
  const br = b.group({ tile: '#' });
  b.fill(6, 11, 15, 15, br);
  b.ground(12, 17);
  const id = b.troll('The bridge button pulls the bridge away', { type: 'retract-button', hint: 'The button in front of the bridge makes the bridge vanish – hop over the button onto the bridge.' });
  b.trigger({ when: { touch: k }, do: [{ hide: br }], troll: id });
  const X = b.px(0);
  return { w: 18, win: [run(X + 4 * T - 26), ['RJ', 9], land, run(X + 17 * T)], die: [run(X + 17 * T)] };
}

/** TRAP ceiling-switch: bonk the ceiling switch – the hatch under its left half opens too. */
function ceilingSwitch(b) {
  b.ground(0, 3);
  const hatch = b.group({ tile: '#', look: 'cracked' });
  b.fill(4, 5, 15, 17, hatch);
  b.ground(6, 17);
  b.fill(4, 7, 9, 10, '#');
  const sw = b.group({ tile: '#', button: 'red', ceilButton: true });
  b.fill(4, 7, 11, 11, sw);
  b.fill(9, 12, 7, 10, '#');
  const wall = b.group({ tile: '#', look: 'bolted' });
  b.fill(11, 11, 11, 14, wall);
  const id = b.troll('The ceiling switch opens the hatch you stand on', { type: 'ceiling-switch', hint: 'Bonking the ceiling switch opens the wall, and the cracked hatch under its left half – bonk it standing on the solid floor under its right half.' });
  b.trigger({ when: { touch: sw }, do: [{ hide: wall }, { fall: hatch, shake: 3 }], troll: id });
  const X = b.px(0);
  return {
    w: 18,
    win: [run(X + 6 * T + 22), wait(12), J(16), land, run(X + 17 * T)],
    die: [run(X + 4 * T + 30), wait(10), ['J', 16], wait(70)],
  };
}

/** TRAP call-button: the button calls the lift – it drops spiked side down onto the button. */
function callButton(b) {
  b.ground(0, 21);
  const k = button(b, 6, 7);
  const lp = b.group({ tile: '#' });
  b.fill(6, 7, 3, 3, lp);
  const ls = b.group({ tile: 'v' });
  b.fill(6, 7, 4, 4, ls);
  b.fill(10, 13, 8, 14, '#');
  const id = b.troll('The lift lands on the button', { type: 'call-button', hint: 'The button calls the lift, which drops spikes first onto the button – step back off it, wait until it lands, hop on and ride it up over the wall.' });
  const down = b.uid('lift');
  b.trigger({ id: down, when: { touch: k }, do: [{ move: lp, by: [0, 10], ticks: 46, deadly: true }, { move: ls, by: [0, 10], ticks: 46 }], troll: id });
  // then up and down for good: up to the wall top, a rest, and back to the floor
  b.trigger({ when: { after: down }, delay: 110, every: 380, stopAt: b.x0 + 14, do: [{ move: lp, by: [0, -6], ticks: 110, returnAfter: 70, returnTicks: 110 }, { move: ls, by: [0, -6], ticks: 110, returnAfter: 70, returnTicks: 110 }] });
  const X = b.px(0);
  return {
    w: 22,
    win: [
      run(X + 6 * T + 20), runL(X + 3 * T), wait(2), ['', `s.g.${lp}[1] >= ${10 * T - 1}`], wait(10),
      run(X + 5 * T - 6), ['RJ', 12], land, wait(4), ['', `s.g.${lp}[1] <= ${4 * T + 1}`],
      ['RJ', 12], land, run(X + 21 * T),
    ],
    die: [run(X + 6 * T + 20), wait(90)],
  };
}

/** TRAP reverse-belt: the button on the belt turns it round, toward the pit – hop, the belt cannot push you in the air. */
function reverseBelt(b) {
  b.ground(0, 1);
  b.fill(2, 3, 16, 17, '#');
  b.fill(2, 3, 15, 15, '^');
  const belt = b.group({ tile: '#', conveyor: 90 });
  b.fill(4, 8, 15, 17, belt);
  const k = button(b, 9, 9, 'red', 15, { conveyor: 90 });
  const belt2 = b.group({ tile: '#', conveyor: 90 });
  b.fill(10, 17, 15, 17, belt2);
  b.fill(18, 21, 15, 17, '#');
  b.fill(17, 19, 8, 10, '#');
  const gate = b.group({ tile: '#', look: 'bolted' });
  b.fill(18, 18, 11, 14, gate);
  const id = b.troll('The button turns the belt round', { type: 'reverse-belt', hint: 'The button turns the belts round toward the spike pit and opens the gate – keep hopping to the gate: the belt cannot push you while you are in the air.' });
  b.trigger({ when: { touch: k }, do: [{ belt: belt, speed: -330 }, { belt: k, speed: -330 }, { belt: belt2, speed: -330 }, { hide: gate }], troll: id });
  const X = b.px(0);
  const hop = [['RJ', 14], land];
  return {
    w: 22,
    win: [run(X + 2 * T - 14), J(10), land, run(X + 9 * T - 12), ...hop, ...hop, ['RJ', 6], land, run(X + 21 * T)],
    die: [run(X + 2 * T - 14), J(10), land, run(X + 9 * T - 12), ['', 150]],
  };
}

/** TRAP heavy-gate: the button drops the drawbridge forward across the pit – onto you if you stand at the edge. */
function heavyGate(b) {
  b.ground(0, 6);
  const k = button(b, 2, 2);
  b.ground(12, 19);
  const gv = b.group({ tile: '#', look: 'bolted' });
  b.fill(12, 12, 7, 14, gv);
  const gh = b.group({ tile: '#', hidden: true, look: 'bolted' });
  b.fill(4, 12, 6, 6, gh);
  const id = b.troll('The drawbridge falls on you', { type: 'heavy-gate', hint: 'The button drops the drawbridge forward across the pit, onto the edge in front of it – stay on the button until it has landed, then walk over it.' });
  b.trigger({ when: { touch: k }, delay: 20, do: [{ hide: gv }, { show: gh }, { move: gh, by: [0, 8], ticks: 26, deadly: true }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 2 * T + 20), ['', `s.g.${gh}[1] >= ${8 * T - 1}`], wait(6), run(X + 3 * T + 4), ['RJ', 6], land, run(X + 19 * T)],
    die: [run(X + 2 * T + 20), run(X + 5 * T + 20), wait(80)],
  };
}

/** TRAP fake-wall-button: the "open the wall" button opens a pit; the wall was never closed (walk through it). */
function fakeWallButton(b) {
  b.ground(0, 6);
  const k = button(b, 4, 4);
  const hatch = b.group({ tile: '#' });
  b.fill(7, 11, 15, 17, hatch);
  b.ground(12, 17);
  b.fill(12, 14, 7, 9, '#');
  const wall = b.group({ tile: '#', fake: true, look: 'bolted' });
  b.fill(13, 13, 10, 14, wall);
  const id = b.troll('The wall button opens a pit instead', { type: 'fake-wall-button', hint: 'Do not press the button: it opens a pit in front of the wall. The wall is fake – hop over the button and walk straight through it.' });
  b.trigger({ when: { touch: k }, do: [{ move: hatch, by: [0, 4], ticks: 10, returnAfter: 100, returnTicks: 30 }], troll: id });
  const X = b.px(0);
  return { w: 18, win: [run(X + 4 * T - 26), ['RJ', 9], land, run(X + 17 * T)], die: [run(X + 17 * T)] };
}

/** TRAP exit-bars (the end): the button opens the bars in front of the EXIT – and they close again soon. */
function exitBars(b) {
  b.ground(0, 3);
  const k = button(b, 4, 5, 'red', 14);
  b.fill(6, 7, 13, 17, '#');
  b.fill(8, 9, 12, 17, '#');
  b.fill(10, 19, 11, 17, '#');
  b.fill(13, 13, 0, 7, '#');
  const bars = b.group({ tile: '<' });
  b.fill(13, 13, 8, 10, bars);
  b.doorAt(16, 10);
  const id = b.troll('The bars close again before you get there', { type: 'exit-bars', hint: 'The button opens the bars in front of the EXIT, but they close again after a second – go up the steps without stopping.' });
  const open = b.uid('bars');
  b.trigger({ id: open, when: { touch: k }, do: [{ hide: bars }], troll: id });
  b.trigger({ when: { after: open }, delay: 130, do: [{ show: bars }], troll: id });
  const X = b.px(0);
  return {
    w: 20,
    win: [run(X + 4 * T - 16), ['RJ', 6], land, run(X + 6 * T - 16), ['RJ', 6], land, run(X + 8 * T - 16), ['RJ', 6], land, run(X + 10 * T - 16), ['RJ', 6], land, ['R', 's.state!=="play"']],
    die: [run(X + 4 * T - 16), ['RJ', 6], land, wait(140), run(X + 6 * T - 16), ['RJ', 6], land, run(X + 8 * T - 16), ['RJ', 6], land, run(X + 10 * T - 16), ['RJ', 6], land, run(X + 15 * T)],
  };
}

export default {
  id: 11,
  slug: 'push-the-button',
  name: 'Push the Button',
  idea: 'Buttons and switches do something other than they promise',
  winMessage: 'Nobody presses my buttons!',
  deathQuips: ['Never trust a big red button.', 'It said PUSH. You pushed.', 'Click. Oops.', 'Buttons are just traps with good PR.', 'Press F to pay respects.'],
  handmade: true,
  minWidth: 462,
  traps: [buttonTrapdoor, slowBridge, delayedCrusher, wrongColour, retractButton, ceilingSwitch, callButton, reverseBelt, heavyGate, fakeWallButton],
  endSeg: exitBars,
  between: [
    [flat(1), up(1, 3), pit(2, 3), up(1, 2), down(2, 4)],
    [flat(1), thorns(1, 3), up(2, 3), pit(3, 2, -1), down(1, 3), spikes(2, 3)],
    [isle(2, 3), isle(3, 2, 1), isle(2, 3, -1), pit(2, 4)],
    [up(1, 2), up(1, 2), roof(4), down(2, 3), pit(3, 3)],
    [spikes(3, 3), isle(2, 2, 2), down(2, 3), block(1, 2, 3), flat(1)],
    [flat(1), pit(1, 2, 1), pit(2, 2, 1), pit(2, 3, -2), thorns(1, 2), spikes(2, 3)],
    [up(2, 2), isle(3, 2), isle(2, 2, -1), pit(3, 3, -1)],
    [pit(2, 3, 1), pit(3, 2), pit(2, 3, 1), pit(2, 2, -2), spikes(2, 2), up(1, 3), down(1, 2)],
    [thorns(1, 2), thorns(2, 2), roof(3), pit(3, 2, 2), down(2, 2), pit(2, 3)],
    [up(1, 3), isle(3, 2, 1), down(2, 2), spikes(2, 2), pit(2, 4)],
    [flat(2), isle(3, 3, 1), up(1, 2), pit(2, 2, -2), spikes(3, 4)],
  ],
};
