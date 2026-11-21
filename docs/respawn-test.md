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
jumps, idle). Whenever the hero stays inside a 3×3-tile box (stricter than "within 1 tile": small pockets count
too) for 20 s of game time without dying while the inputs keep changing, that state is probed: 20 seeded rollouts of up to 30 s each from exactly that state (re-created by
re-simulating the segment) must reach a death, a new checkpoint (from which the level is known to be winnable) or
the EXIT. A state where none of them does would be a failure: neither the EXIT reachable nor death possible.

**Self-check.** Every run first proves the stuck detector works: in an in-memory copy of level 1 the hero is boxed in
at the spawn (walls, a roof, nothing that can kill); the explorer must find the stall and every probe must fail. It
does (stall found after 20 s, no probe escapes).

## Results

`Explorer deaths / reach`: deaths during the random play and the furthest point it reached (% of the level's width),
which shows the random play covers the levels. No stall (20 s confined without dying) occurred on any level.

<!-- results -->
| Level | Run | Forced deaths | Respawns checked | Distinct respawn states won | Explorer (simulated) | Explorer deaths / reach | Stalls found / probed | Failures |
|---|---|---|---|---|---|---|---|---|
| 1. Hello, Floor | 33 s | 62 | 62 | 3 / 3 | 5.0 min | 27 / 90% | 0 / 0 | 0 |
| 2. Greedy Little Blob | 39 s | 65 | 65 | 3 / 3 | 5.4 min | 24 / 99% | 0 / 0 | 0 |
| 3. Spring Fever | 40 s | 65 | 65 | 3 / 3 | 5.0 min | 35 / 95% | 0 / 0 | 0 |
| 4. Heavy Ceiling | 39 s | 65 | 65 | 3 / 3 | 5.0 min | 21 / 94% | 0 / 0 | 0 |
| 5. Left Is Right | 42 s | 65 | 65 | 3 / 3 | 5.0 min | 28 / 91% | 0 / 0 | 0 |
| 6. Upside Downer | 33 s | 61 | 61 | 3 / 3 | 5.0 min | 27 / 88% | 0 / 0 | 0 |
| 7. Too Many Doors | 37 s | 62 | 62 | 3 / 3 | 5.0 min | 26 / 88% | 0 / 0 | 0 |
| 8. Screen Lies | 54 s | 86 | 86 | 4 / 4 | 5.0 min | 33 / 87% | 0 / 0 | 0 |
| 9. Run! | 59 s | 86 | 86 | 4 / 4 | 5.0 min | 19 / 80% | 0 / 0 | 0 |
| 10. The Grand Betrayal | 62 s | 89 | 89 | 4 / 4 | 5.0 min | 38 / 96% | 0 / 0 | 0 |
| 11. Push the Button | 70 s | 98 | 98 | 4 / 4 | 5.0 min | 44 / 92% | 0 / 0 | 0 |
| 12. Crate Expectations | 107 s | 121 | 121 | 4 / 4 | 5.0 min | 80 / 96% | 0 / 0 | 0 |
| 13. The Deep End | 103 s | 127 | 127 | 5 / 5 | 5.0 min | 89 / 87% | 0 / 0 | 0 |
| 14. Lock and Key | 114 s | 138 | 138 | 5 / 5 | 5.0 min | 94 / 94% | 0 / 0 | 0 |
| 15. Laser Show | 146 s | 159 | 159 | 5 / 5 | 5.0 min | 100 / 90% | 0 / 0 | 0 |
| 16. Size Matters | 142 s | 163 | 163 | 6 / 6 | 5.0 min | 93 / 93% | 0 / 0 | 0 |
| 17. Blown Away | 170 s | 184 | 184 | 6 / 6 | 5.0 min | 75 / 94% | 0 / 0 | 0 |
| 18. Haunted Halls | 206 s | 217 | 217 | 10 / 10 | 5.0 min | 85 / 92% | 0 / 0 | 0 |
| 19. Fireworks | 224 s | 241 | 241 | 13 / 13 | 5.0 min | 83 / 84% | 0 / 0 | 0 |
| 20. Follow the Signs | 230 s | 253 | 253 | 14 / 14 | 5.0 min | 84 / 92% | 0 / 0 | 0 |
| **all 20** | 33 min | **2407** | **2407** | 105 / 105 | 100 min | 1105 | 0 / 0 | **0** |
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
