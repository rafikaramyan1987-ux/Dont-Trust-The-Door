// Death / respawn / no-soft-lock test for every level (production build with the test hooks, pure simulation).
//
// Per level:
//  1. Forced deaths along the recorded winning run (tests/replays/level-NN.json `win`): the hero is killed at every
//     2 s of the run, and right before, during and right after every trap (the run entering / crossing / leaving the
//     trap) and every checkpoint (just before / when / just after its flag is touched). After each death:
//       a) the hero respawns at the last checkpoint touched before the death (or at the start), at its flag;
//       b) the whole game state (scene values, groups, triggers, extensions: GameScene.debugState) equals a fresh
//          start at that checkpoint: every trap after it is re-armed and the "keep" triggers before it are applied
//          as specified (the same rule a fresh checkpoint start uses);
//       c) the level is still won from that exact respawn state: the recorded run from that checkpoint is replayed
//          from it to the EXIT (once per distinct respawn state);
//       d) so no stuck state: from the respawn the EXIT is reachable.
//  2. A random-input explorer (fixed seeds, reproducible): segments of seeded random play starting at points along
//     the winning run, at least `--explore` seconds of simulated play per level (default 300). Whenever the hero has
//     stayed within 1 tile for 20 s of game time without dying while the inputs keep changing, that state is probed:
//     20 seeded rollouts from it (the state is re-created by re-simulating the segment) must reach a death, a new
//     checkpoint or the EXIT; a state where none does is a failure (neither the EXIT reachable nor death possible).
// Usage: npm run build && node tests/respawn.mjs [--levels 1-20] [--explore 300]
// Writes test-results/respawn-L<a>-<b>.json (docs/respawn-test.md is made from these by tools/respawn-report.mjs).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, serveDist, openGame, ROOT } from './harness.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const [l0, l1x] = arg('--levels', '1-20').split('-').map(Number);
const l1 = Number.isFinite(l1x) ? l1x : l0;
const EXPLORE_S = Number(arg('--explore', '300'));
const KILL_EVERY = 120; // ticks: every 2 s
const STALL_TICKS = 1200; // 20 s
const PROBES = 20;
const MAX_PROBED_STALLS = 12;

/** attempt-level values that a respawn keeps on purpose (counters, the hint, wall clock, input edge) */
const ATTEMPT_KEYS = new Set(['tick', 'deathsLevel', 'deathXs', 'hintUsed', 'hintShown', 'lastDeath', 'acc', 'adBusy', 'resumed', 'frame', 'quipT', 'lastQuip', 'trollsFired', 'quipIdx']);

const levelsDir = join(ROOT, 'src', 'levels');
const rec = (id) => JSON.parse(readFileSync(join(ROOT, 'tests', 'replays', `level-${String(id).padStart(2, '0')}.json`), 'utf8'));

const { server, url } = await serveDist();
const browser = await launch();
const results = [];
let failures = 0;

function diff(a, b, path = '', out = []) {
  if (out.length > 8) return out;
  if (a === undefined) a = null; // a drawing object made lazily (missing) vs reset (null): the same game state
  if (b === undefined) b = null;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out);
  } else out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`);
  return out;
}
const strip = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => !ATTEMPT_KEYS.has(k)));

for (let L = l0; L <= l1; L++) {
  const t0 = Date.now();
  const R = rec(L);
  const { page, ctx } = await openGame(browser, url);
  await page.evaluate(() => { window.__DTTD.resetSave(); window.__DTTD.lang('en'); window.__DTTD.setManual(true); });
  // in-page helpers: expand a run, play it from the current state, the explorer's input policy
  await page.evaluate(() => {
    const T = window.__DTTD;
    window.__R = {
      flat(rle) { const s = []; for (const [n, k] of rle) for (let i = 0; i < n; i++) s.push(k); return s; },
      /** start the level (at checkpoint c, -1 = start) and play `steps` from the tick the start already ran */
      startAndPlay(level, c, steps, upto) {
        T.release(); // no key may be held into the start's lead-in ticks
        T.start(level, null, c >= 0 ? c : false);
        let i = T.state().levelTick;
        while (i < upto && i < steps.length) { T.sim(steps[i++], 1); if (T.state().state !== 'play') break; }
        return T.state();
      },
      rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
      /** random inputs, each held 6–40 ticks; `bias` leans right (explorer) or is even (probe) */
      policy(r, bias) {
        const opts = bias ? [['R', 35], ['RJ', 20], ['L', 15], ['LJ', 8], ['J', 7], ['', 15]] : [['R', 22], ['RJ', 22], ['L', 22], ['LJ', 22], ['J', 8], ['', 4]];
        const tot = opts.reduce((a, [, w]) => a + w, 0);
        let k = '', left = 0;
        return () => {
          if (left <= 0) { let x = r() * tot; for (const [o, w] of opts) { if ((x -= w) < 0) { k = o; break; } } left = 6 + Math.floor(r() * 35); }
          left--;
          return k;
        };
      },
    };
  });
  const lvl = await page.evaluate((l) => window.__DTTD.levelData(l), L);
  const traps = lvl.trolls ?? [];
  const winSteps = await page.evaluate((w) => window.__R.flat(w), R.win);

  // 1. trace of the winning run: hero x and checkpoint index per tick
  const trace = await page.evaluate(({ L, n }) => {
    const T = window.__DTTD;
    const steps = window.__lastSteps;
    T.release();
    T.start(L);
    const xs = [], cps = [];
    let i = T.state().levelTick;
    for (let j = 0; j < i; j++) { xs.push(T.state().x); cps.push(T.state().cpIdx); }
    while (i < n) { T.sim(steps[i++], 1); const s = T.state(); xs.push(s.x); cps.push(s.cpIdx); if (s.state !== 'play') break; }
    return { xs, cps, end: T.state().state, ticks: i };
  }, { L, n: winSteps.length, _: await page.evaluate((s) => { window.__lastSteps = s; }, winSteps) });
  const issues = [];
  if (trace.end !== 'won') issues.push(`the recorded winning run does not win (${trace.end} at tick ${trace.ticks})`);

  // kill points
  const ticks = new Set();
  for (let t = KILL_EVERY; t < trace.ticks - 5; t += KILL_EVERY) ticks.add(t);
  for (const tr of traps) {
    const xa = tr.x * 40, xb = (tr.x + tr.w) * 40;
    const enter = trace.xs.findIndex((x) => x >= xa - 20);
    let leave = -1;
    for (let t = trace.xs.length - 1; t >= 0; t--) if (trace.xs[t] <= xb + 20) { leave = t; break; }
    if (enter < 0) continue;
    const lv = leave > enter ? leave : enter;
    for (const t of [enter - 15, enter, Math.round((enter + lv) / 2), lv, lv + 15]) ticks.add(t);
  }
  for (let t = 1; t < trace.cps.length; t++) if (trace.cps[t] !== trace.cps[t - 1]) for (const d of [-10, 0, 10]) ticks.add(t + d);
  const killAt = [...ticks].filter((t) => t >= 5 && t < trace.ticks - 3).sort((a, b) => a - b);

  // reference states: a fresh start at each checkpoint (and the level start)
  const refs = {};
  const refAt = async (c) => {
    // the reference: a respawn at checkpoint c from a fresh start there (nothing fired yet), reached the same way
    // (a death, then pure simulation), so drawing-only values compare like for like
    if (!refs[c]) refs[c] = await page.evaluate(({ L, c }) => {
      const T = window.__DTTD;
      T.release();
      T.start(L, null, c >= 0 ? c : false);
      T.kill();
      let n = 0;
      while (!(T.state().state === 'play' && T.state().levelTick === 0) && n++ < 400) T.sim('', 1);
      while (T.state().levelTick < 6) T.sim('', 1);
      return { d: T.debugState(), s: T.state() };
    }, { L, c });
    return refs[c];
  };

  const verified = new Map(); // respawn-state signature → won
  let respawns = 0;
  for (const t of killAt) {
    const r = await page.evaluate(({ L, t }) => {
      const T = window.__DTTD;
      const s0 = window.__R.startAndPlay(L, -1, window.__lastSteps, t);
      if (s0.state !== 'play') return { skip: s0.state };
      const c = s0.cpIdx;
      T.kill();
      let n = 0;
      while (!(T.state().state === 'play' && T.state().levelTick === 0) && n++ < 400) T.sim('', 1);
      if (T.state().state !== 'play') return { c, stuck: T.state().state };
      while (T.state().levelTick < 6) T.sim('', 1);
      return { c, s: T.state(), d: T.debugState(), deaths: T.state().deathsLevel };
    }, { L, t });
    if (r.skip) continue;
    respawns++;
    if (r.stuck) { issues.push(`kill at tick ${t}: no respawn (${r.stuck})`); continue; }
    const ref = await refAt(r.c);
    // a) the last checkpoint touched, at its flag
    if (r.s.cpIdx !== r.c || Math.abs(r.s.x - ref.s.x) > 1) issues.push(`kill at tick ${t}: respawned at checkpoint ${r.s.cpIdx} x=${r.s.x.toFixed(0)}, want checkpoint ${r.c} x=${ref.s.x.toFixed(0)}`);
    // b) everything re-armed exactly like a fresh start at that checkpoint
    const d = diff(strip(r.d), strip(ref.d));
    if (d.length) issues.push(`kill at tick ${t} (checkpoint ${r.c}): state after respawn differs from a fresh checkpoint start: ${d.join('; ')}`);
    // c / d) won from this exact respawn state
    const sig = JSON.stringify(strip(r.d));
    if (!verified.has(sig)) {
      const steps = r.c >= 0 ? R.cps[r.c] : R.win;
      const won = await page.evaluate(({ L, t, steps }) => {
        const T = window.__DTTD;
        window.__R.startAndPlay(L, -1, window.__lastSteps, t);
        T.kill();
        let n = 0;
        while (!(T.state().state === 'play' && T.state().levelTick === 0) && n++ < 400) T.sim('', 1);
        const run = window.__R.flat(steps);
        // the recording is indexed by levelTick from a fresh checkpoint start; the respawn is at levelTick 0
        let i = T.state().levelTick;
        while (i < run.length) { T.sim(run[i++], 1); if (T.state().state !== 'play') break; }
        for (let j = 0; j < 180 && T.state().state === 'play'; j++) T.sim('', 1);
        return T.state().state;
      }, { L, t, steps });
      verified.set(sig, won === 'won');
      if (won !== 'won') issues.push(`kill at tick ${t} (checkpoint ${r.c}): the level is not won from the respawn (${won})`);
    }
  }

  // 2. the explorer
  const budget = EXPLORE_S * 60;
  let explored = 0, seg = 0, stalls = 0, probed = 0, exDeaths = 0, exWins = 0, exMaxX = 0;
  const exCps = new Set();
  const seen = new Set();
  while (explored < budget) {
    const seed = L * 100003 + seg * 7919;
    const out = await page.evaluate(({ L, seed, maxLen, stallTicks }) => {
      const T = window.__DTTD;
      const R = window.__R;
      const r = R.rng(seed);
      const k = Math.floor(r() * (window.__lastSteps.length * 0.95));
      R.startAndPlay(L, -1, window.__lastSteps, k);
      const pol = R.policy(r, true);
      const inputs = [];
      const pos = [];
      let lastDeath = 0, d0 = T.state().deathsLevel, i = 0, deaths = 0, maxX = 0, maxCp = T.state().cpIdx;
      for (; i < maxLen; i++) {
        const key = pol();
        inputs.push(key);
        T.sim(key, 1);
        const s = T.state();
        if (s.state === 'won') break;
        if (s.deathsLevel !== d0) { d0 = s.deathsLevel; lastDeath = i; deaths++; }
        maxX = Math.max(maxX, s.x);
        maxCp = Math.max(maxCp, s.cpIdx);
        pos.push([s.x, s.y]);
        if (i - lastDeath >= stallTicks && s.state === 'play') {
          const win = pos.slice(-stallTicks);
          const [cx, cy] = win[win.length - 1];
          if (win.every(([x, y]) => Math.abs(x - cx) <= 40 && Math.abs(y - cy) <= 40) && new Set(inputs.slice(-stallTicks)).size > 1)
            return { k, inputs, deaths, maxX, maxCp, stall: { x: cx, y: cy, cp: s.cpIdx, tick: i } };
        }
      }
      return { k, n: i, deaths, maxX, maxCp, won: T.state().state === 'won' };
    }, { L, seed, maxLen: 1800, stallTicks: STALL_TICKS });
    explored += out.stall ? out.inputs.length : out.n;
    seg++;
    exDeaths += out.deaths;
    if (out.won) exWins++;
    exMaxX = Math.max(exMaxX, out.maxX);
    if (out.maxCp >= 0) exCps.add(out.maxCp);
    if (!out.stall) continue;
    stalls++;
    const key = `${Math.round(out.stall.x / 40)},${Math.round(out.stall.y / 40)},${out.stall.cp}`;
    if (seen.has(key) || probed >= MAX_PROBED_STALLS) continue;
    seen.add(key);
    probed++;
    const ok = await page.evaluate(({ L, k, inputs, probes, seed }) => {
      const T = window.__DTTD;
      const R = window.__R;
      for (let p = 0; p < probes; p++) {
        R.startAndPlay(L, -1, window.__lastSteps, k);
        for (const key of inputs) T.sim(key, 1);
        const s0 = T.state();
        const pol = R.policy(R.rng(seed + p * 31), false);
        for (let i = 0; i < 1800; i++) {
          T.sim(pol(), 1);
          const s = T.state();
          if (s.state === 'won' || s.deathsLevel > s0.deathsLevel || s.state === 'dead' || s.cpIdx > s0.cpIdx) return { ok: true, p, how: s.state === 'won' ? 'exit' : s.cpIdx > s0.cpIdx ? 'checkpoint' : 'death' };
        }
      }
      return { ok: false };
    }, { L, k: out.k, inputs: out.inputs, probes: PROBES, seed: seg * 13 });
    if (!ok.ok) issues.push(`explorer: stuck at x=${out.stall.x.toFixed(0)} y=${out.stall.y.toFixed(0)} (checkpoint ${out.stall.cp}; seed segment ${seg - 1}): no rollout reaches a death, a checkpoint or the EXIT`);
  }

  const res = {
    level: L, name: lvl.name, runTicks: trace.ticks, kills: killAt.length, respawns, distinctRespawnStates: verified.size,
    wonFromRespawn: [...verified.values()].filter(Boolean).length, exploreSeconds: Math.round(explored / 60), segments: seg,
    stalls, stallsProbed: probed, explorerDeaths: exDeaths, explorerExits: exWins, explorerCheckpoints: exCps.size,
    explorerReach: Math.round((exMaxX / (lvl.map[0].length * 40)) * 100), issues, seconds: Math.round((Date.now() - t0) / 1000),
  };
  results.push(res);
  failures += issues.length;
  console.log(`L${L} ${issues.length ? 'FAIL' : 'ok  '} ${killAt.length} forced deaths, ${respawns} respawns checked, ${verified.size} respawn states won, explorer ${res.exploreSeconds} s (${seg} segments, ${exDeaths} deaths, reach ${res.explorerReach}%, ${stalls} stalls, ${probed} probed) [${res.seconds} s]`);
  for (const i of issues.slice(0, 12)) console.log(`     ✗ ${i}`);
  if (issues.length > 12) console.log(`     … ${issues.length - 12} more`);
  await ctx.close();
}
await browser.close();
server.close();
mkdirSync(join(ROOT, 'test-results'), { recursive: true });
writeFileSync(join(ROOT, 'test-results', `respawn-L${l0}-${l1}.json`), JSON.stringify(results, null, 2));
console.log(failures ? `\nrespawn test FAILED: ${failures} problem(s)` : `\nrespawn test: levels ${l0}-${l1} all passed`);
process.exit(failures ? 1 : 0);
