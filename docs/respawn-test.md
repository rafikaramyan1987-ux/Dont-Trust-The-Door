# Death and respawn test (all 20 levels)

`node tests/respawn.mjs [--levels 1-20] [--explore 300]` (in `npm test` as `npm run test:respawn`, and in CI: every
self-test shard runs it for its own levels). It drives the production build through the test hooks, in pure
simulation (the game's own fixed update, about 80× real time).

## Method

**Forced deaths along the winning run.** For each level the recorded winning run (`tests/replays/level-NN.json`)
is walked tick by tick. The hero is killed

- at every 2 seconds of the run,
- right before, when, halfway through, when leaving and right after every trap (the run entering / crossing /
  leaving the trap's tiles),
- right before, when and right after every checkpoint flag is touched.

After every forced death the test checks:

1. **Respawn point** – the hero comes back at the last checkpoint touched before that death (or the level start),
   at its flag.
2. **Re-armed level** – the whole game state after the respawn (every plain value of the game scene, every group's
   position / visibility / state, every trigger, every level extension's state: `GameScene.debugState()`) equals a
   respawn at the same checkpoint from a fresh start, where nothing has fired yet. So every trap after the checkpoint
   is re-armed, and "keep" triggers before it are applied exactly as specified (`keep` triggers whose zone lies
   before the flag keep their end state, everything else is reset).
3. **Still winnable** – from that exact respawn state the recorded run from that checkpoint is replayed to the EXIT
   (once per distinct respawn state).
4. **Never stuck** – follows from 3 for every respawn state; the explorer below looks for stuck states anywhere else.

**Random-input explorer.** At least 5 minutes of simulated play per level, in seeded (reproducible) segments of up
to 30 s that start at seeded points along the winning run, with random inputs held 6–40 ticks each (left, right,
jumps, idle). Whenever the hero stays within 1 tile for 20 s of game time without dying while the inputs keep
changing, that state is probed: 20 seeded rollouts of up to 30 s each from exactly that state (re-created by
re-simulating the segment) must reach a death, a new checkpoint (from which the level is known to be winnable) or
the EXIT. A state where none of them does would be a failure: neither the EXIT reachable nor death possible.

## Results

<!-- results -->
<!-- /results -->

## Problems found and fixed

- **The EXIT door's speed survived a respawn** (found in level 7, "Too Many Doors", at checkpoint 0). After a door-run
  trap had set the door's speed, a respawn reset its path but kept its speed. Fixed in the game code (`buildLevel`
  resets `doorSpeed` with the rest of the door's state). It had no visible effect yet (the next door run sets the
  speed again), but a respawn now starts exactly like a fresh checkpoint start.

Test issues found while building the test (not game bugs) and fixed in the test: a key still held from the previous
run leaked into the next start's two lead-in ticks; the first reference state had been drawn on screen while the
respawn was pure simulation (drawing-only values such as wind streak alpha differed), so the reference is now a
respawn too.

No level data or replay had to change.
