// Condition-based bot plans, generated together with the levels by
// tools/level-builder/build.mjs (see tests/plans.json). They are used ONLY to author the
// frame-exact replays in tests/replays/ (npm run record).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLANS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'plans.json'), 'utf8'));
