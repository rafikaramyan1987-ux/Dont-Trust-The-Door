// Condition-based plans used ONLY to author the recorded replays in tests/replays/.
// `win` completes the level; every entry in `traps` walks into a troll and must die.
// Each step: [keys, until] – keys from "L", "R", "J"; until = ticks or an expression over
// the state `s` (x, y, vx, vy, grounded, levelTick, state, gravity ...).
const J = (n = 16) => ['RJ', n];
const land = ['R', 's.grounded'];
export const PLANS = {
  1: {
    win: [['R', 's.x>=228'], J(14), land, ['R', 's.x>=345'], J(), land, ['R', 's.x>=545'], J(), land, ['R', 's.x>=880'], J(), land, ['R', 's.x>=1070'], ['', 40], J(), ['R', 's.state!=="play"']],
    traps: { 'the gap (tutorial)': [['R', 's.x>=228'], J(14), land, ['R', 's.x>=345'], J(), land, ['R', 's.x>=545'], J(), land, ['R', 300]] },
  },
  2: {
    win: [['R', 's.x>=440'], J(), land, ['R', 's.x>=790'], J(), land, ['R', 's.x>=905'], J(), land, ['R', 's.state!=="play"']],
    traps: { 'floor collapses into spikes': [['R', 300]] },
  },
  3: {
    win: [['R', 's.x>=262'], ['RJ', 8], land, ['R', 's.x>=385'], ['RJ', 8], land, ['R', 's.x>=495'], ['RJ', 8], land, ['R', 's.x>=1060'], J(), land, ['R', 's.x>=1150'], J(), land, ['LJ', 16], ['L', 's.grounded'], ['L', 's.x<=590'], ['LJ', 16], ['L', 's.state!=="play"']],
    traps: { 'chasing the door into the gap': [['R', 's.x>=262'], ['RJ', 8], land, ['R', 's.x>=385'], ['RJ', 8], land, ['R', 's.x>=495'], ['RJ', 8], land, ['R', 's.x>=1060'], J(), land, ['R', 's.x>=1150'], J(), land, ['LJ', 16], ['L', 's.grounded'], ['L', 400]] },
  },
  4: {
    win: [['R', 's.x>=300'], ['RJ', 6], land, ['R', 's.x>=775'], J(), land, ['R', 's.state!=="play"']],
    traps: {
      'spikes pop where a normal jump lands': [['R', 's.x>=285'], J(), ['R', 200]],
      'second patch: the tiny hop lands on new spikes': [['R', 's.x>=300'], ['RJ', 6], land, ['R', 's.x>=783'], ['RJ', 5], ['R', 200]],
    },
  },
  5: {
    win: [['R', 's.x>=765'], ['L', 's.x<=620'], ['', 150], ['R', 's.state!=="play"']],
    traps: { 'the ceiling falls': [['R', 400]] },
  },
  6: {
    win: [['R', 's.vy<-1000'], ['L', 's.grounded'], ['R', 's.x>=315'], J(), land, ['R', 's.state!=="play"']],
    traps: { 'jump pad into ceiling spikes': [['R', 300]] },
  },
  7: {
    win: [['L', 's.state!=="play"']],
    traps: { 'the fake EXIT bites': [['R', 's.x>=310'], J(), land, ['R', 's.x>=520'], J(), land, ['R', 's.x>=750'], J(), land, ['R', 's.x>=860'], J(), land, ['R', 300]] },
  },
  8: {
    win: [['R', 's.x>=200'], J(14), land, ['R', 's.x>=355'], J(), land, ['R', 's.x>=547'], ['', 's.grounded && s.y<300'], ['R', 's.x>=640'], J(), land, ['R', 's.x>=905'], J(), land, ['R', 's.state!=="play"']],
    traps: { 'gravity flips into ceiling spikes': [['R', 's.x>=200'], J(14), land, ['R', 's.x>=355'], J(), land, ['R', 400]] },
  },
  9: {
    win: [['R', 's.x>=170'], J(), land, ['R', 's.x>=365'], ['RJ', 6], land, ['R', 's.x>=575'], ['RJ', 6], land, ['R', 's.x>=975'], J(), land, ['R', 's.state!=="play"']],
    traps: {
      'the coin on the floor bites': [['R', 300]],
      'coin arc over the pit': [['R', 's.x>=170'], J(), land, ['R', 's.x>=365'], ['RJ', 6], land, ['R', 's.x>=570'], J(), ['R', 120]],
    },
  },
  10: {
    win: [['R', 's.x>=290'], J(14), land, ['R', 's.x>=440'], J(12), land, ['R', 's.x>=610'], J(), land, ['R', 's.x>=755'], J(), land, ['R', 's.x>=1040'], J(), land, ['R', 's.x>=1120'], J(), land, ['R', 's.state!=="play"']],
    traps: {
      'the floor drops': [['R', 300]],
      'the spike wall catches you': [['R', 's.x>=290'], J(14), land, ['R', 's.x>=300'], ['', 400]],
    },
  },
};
