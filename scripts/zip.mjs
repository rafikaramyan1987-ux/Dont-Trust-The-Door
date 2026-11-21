// The upload zip of one portal: release/<portal>/dont-trust-the-door-<portal>.zip from dist-<portal>/ (index.html at
// the root). Usage: node scripts/zip.mjs <portal>
import { makeZip, PORTALS } from './lib/portal.mjs';

const portal = process.argv[2];
if (!PORTALS.includes(portal)) {
  console.error(`usage: node scripts/zip.mjs <${PORTALS.join('|')}>`);
  process.exit(1);
}
makeZip(portal);
