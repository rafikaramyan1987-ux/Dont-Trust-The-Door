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
| 18 | 1228 | 18 | Ladder Logic | ladders and climbing |
| 19 | 1412 | 19 | Fireworks | bombs, fuses and cannons |
| 20 | 1624 | 20 | Follow the Signs | signs, arrows and a helpful guide lie |

## Level 11 — Push the Button (factory: steel blue, orange)

Buttons are red plates on the floor (a group with `button: true`). Each one promises something.

1. `button-trapdoor` — the button opens the gate ahead, and a moment later the floor under the button drops away:
   land on it and jump straight on through the gate.
2. `slow-bridge` — the button builds a bridge over the pit, one plank at a time, slower than you run: walk behind
   its tip, never ahead of it.
3. `plate-gate` — the gate stays open only while you stand on the plate and shuts 0.3 s after you leave: jump from
   the plate straight through.
4. `wrong-colour` — two buttons: the friendly green one drops spikes from the ceiling, the red one lowers the
   bridge: jump over the green, press the red.
5. `retract-button` — the "extend" button in front of the bridge retracts the bridge: hop over the button.
6. `wall-riser` — the button raises a spiked wall two tiles ahead: stop on the button, wait until the wall has
   risen and sunk again, then go.
7. `ceiling-switch` — a switch on the ceiling (bonk it) opens the hatch ahead, but the hatch you stand under
   opens too: bonk it while standing on the solid strip, not on the hatch.
8. `button-countdown` — pressing starts a countdown: four ceiling crushers fall one after another from the left;
   do not wait, run the corridor at once.
9. `swap-button` — the button swaps two platforms over the pit: the one you are heading for moves away and the
   far one comes close: aim at the far one after pressing.
10. `decoy-door-button` — the button "opens the EXIT door" ahead (a fake that bites); the real way is the hatch
    the button opened under the stairs: drop down after pressing.
11. `last-button` — a big button right before the EXIT locks the EXIT behind bars when pressed: jump over it
    to the door.

## Level 12 — Crate Expectations (warehouse: brown, cream)

Crates (`crate: true` groups) are pushed by walking into them, fall, and press plates.

1. `crate-step` — the crate you need as a step slides away on ice when you push it.
2. `crate-mimic` — the crate is a mimic: it bites when you stand on it. Jump past it.
3. `crate-plate` — push the crate onto the plate to keep the gate open; pushing it too far drops it into the pit.
4. `crate-avalanche` — pushing the crate knocks a stack of crates down the stairs at you.
5. `heavy-crate` — the crate is too heavy to push; it is a fake wall: walk through it.
6. `crate-lift` — the crate rides a lift up, the lift comes back without it.
7. `crate-bridge` — the crate fills a 1-wide pit, but sinks after a moment: cross at once.
8. `crate-spring` — a crate on a spring is launched at you when you stand next to it.
9. `crate-conveyor` — the crate rides a conveyor toward you; jump on top and ride it.
10. `crate-domino` — crates fall like dominoes onto the path.
11. `empty-crate` — the crate breaks when landed on: you fall into it.
12. `crate-shadow` — a crate falls from the sky where its shadow is.
(names and solutions are refined while building)

## Levels 13–20

Planned themes as in the table above; the trap lists are written when each level is built.
