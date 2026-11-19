# Levels 11–20: design

Every level has its own theme, palette and kind of betrayal. Every trap is a new idea (a new type key; nothing
from levels 1–10 reused or re-skinned). Between the traps: hand-written platforming courses
(tools/level-builder/parkour.mjs pieces, every jump checked at build time), no generated filler.
Checkpoint after every 3 traps and never more than 200 tiles apart. Lengths and trap counts follow the table.

| Level | Tiles | Traps | Name | Theme / betrayal |
|---|---|---|---|---|
| 11 | 462 | 11 | Push the Button | buttons and switches do something other than they promise |
| 12 | 531 | 12 | Crate Expectations | crates and boxes you push, stand on and trust |
| 13 | 611 | 13 | The Deep End | water: swimming, tides, currents |
| 14 | 703 | 14 | Lock and Key | keys, locks and the doors they open |
| 15 | 808 | 15 | Laser Show | beams, scanners and light |
| 16 | 929 | 16 | Size Matters | the hero shrinks and grows |
| 17 | 1068 | 17 | Blown Away | wind, fans and air |
| 18 | 1228 | 18 | Haunted Halls | ghosts and possessed furniture: what moves while you look away |
| 19 | 1412 | 19 | Fireworks | bombs, fuses, cannons and fireworks |
| 20 | 1624 | 20 | Follow the Signs | signs, arrows and a helpful guide lie |

## Status

All ten levels are built (155 traps); their trap lists, solutions and hints are in the README ("The 241 traps")
and in `tools/level-builder/levels/L11.mjs` … `L20.mjs`. The mechanics of levels 14–20 live in
`src/game/ext/l14.ts` … `l20.ts`.

| Level | Status |
|---|---|
| 11 Push the Button | done – 462 tiles, 11 traps |
| 12 Crate Expectations | done – 532 tiles, 12 traps |
| 13 The Deep End | done – 614 tiles, 13 traps |
| 14 Lock and Key | done – 708 tiles, 14 traps |
| 15 Laser Show | done – 808 tiles, 15 traps |
| 16 Size Matters | done – 935 tiles, 16 traps |
| 17 Blown Away | done – 1078 tiles, 17 traps |
| 18 Haunted Halls | done – 1228 tiles, 18 traps |
| 19 Fireworks | done – 1424 tiles, 19 traps |
| 20 Follow the Signs | done – 1626 tiles, 20 traps |
