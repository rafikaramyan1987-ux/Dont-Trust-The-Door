// Translation completeness: every language file has exactly the English keys, no empty
// values, the same {placeholders}, and every text key used by the code or the levels exists.
// Run with `npm run test:i18n` (part of `npm test`).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const I18N = join(ROOT, 'src', 'i18n');
const LANGS = ['en', 'fr', 'de', 'es', 'pt-BR', 'it', 'ru', 'tr'];
let errors = 0;
const fail = (m) => { errors++; console.error(`✗ ${m}`); };
const load = (c) => { try { return JSON.parse(readFileSync(join(I18N, `${c}.json`), 'utf8')); } catch (e) { fail(`${c}.json missing or invalid (${e.message})`); return {}; } };
const en = load('en');
const files = readdirSync(I18N).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
for (const f of files) if (!LANGS.includes(f)) fail(`unexpected language file ${f}.json`);
const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
for (const code of LANGS) {
  const d = load(code);
  const missing = Object.keys(en).filter((k) => !(k in d));
  const extra = Object.keys(d).filter((k) => !(k in en));
  if (missing.length) fail(`${code}: ${missing.length} missing key(s): ${missing.slice(0, 8).join(', ')}`);
  if (extra.length) fail(`${code}: ${extra.length} unknown key(s): ${extra.slice(0, 8).join(', ')}`);
  for (const [k, v] of Object.entries(d)) {
    if (typeof v !== 'string' || !v.trim()) fail(`${code}: "${k}" is empty`);
    else if (k in en && ph(v) !== ph(en[k])) fail(`${code}: "${k}" placeholders ${ph(v) || '-'} ≠ English ${ph(en[k]) || '-'}`);
  }
  if ((d['ui.exitSign'] ?? '').length > 7) fail(`${code}: EXIT sign "${d['ui.exitSign']}" longer than 7 letters`);
  console.log(`${code.padEnd(5)} ${Object.keys(d).length} keys${missing.length || extra.length ? '' : ' ✓'}`);
}
// keys used in code: t('key') / say('key') and level data
const used = new Set();
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).forEach((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) walk(p);
  else if (/\.ts$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(/\b(?:t|say)\(\s*'([a-z]+\.[\w.]+)'/g)) used.add(m[1]);
});
walk(join(ROOT, 'src'));
for (const f of readdirSync(join(ROOT, 'src', 'levels')).filter((x) => x.endsWith('.json'))) {
  const L = JSON.parse(readFileSync(join(ROOT, 'src', 'levels', f), 'utf8'));
  [L.name, L.winMessage, ...(L.deathQuips ?? []), ...(L.hints ?? []).map((h) => h.text), ...L.trolls.map((t) => t.hint)].forEach((k) => used.add(k));
  for (const t of L.triggers ?? []) for (const a of t.do) if ('say' in a) used.add(a.say);
}
for (const k of used) if (!(k in en)) fail(`key "${k}" is used but not defined in en.json`);
console.log(`${used.size} keys used by code and levels, all defined.`);
if (errors) { console.error(`\n${errors} problem(s)`); process.exit(1); }
console.log(`All ${LANGS.length} languages complete.`);
