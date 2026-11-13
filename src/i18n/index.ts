// Translations. Every player-visible text lives in one JSON file per language
// (src/i18n/<code>.json); code and level data only refer to keys. Missing keys fall back
// to English (the test suite fails if any language misses a key).

const files = import.meta.glob<Record<string, string>>('./*.json', { eager: true, import: 'default' });

export interface Lang { code: string; name: string }

/** The supported languages, with their names in their own language. */
export const LANGS: Lang[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt-BR', name: 'Português (BR)' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
];

const dict: Record<string, Record<string, string>> = {};
for (const [path, data] of Object.entries(files)) dict[path.replace(/^\.\//, '').replace(/\.json$/, '')] = data;

let current = 'en';

/** Best supported language for a list of browser languages (e.g. navigator.languages). */
export function detectLang(prefs: readonly string[]): string {
  for (const p of prefs) {
    const l = p.toLowerCase();
    const exact = LANGS.find((x) => x.code.toLowerCase() === l);
    if (exact) return exact.code;
    const base = l.split('-')[0];
    const byBase = LANGS.find((x) => x.code.split('-')[0].toLowerCase() === base);
    if (byBase) return byBase.code;
  }
  return 'en';
}

export function setLang(code: string): void {
  current = LANGS.some((l) => l.code === code) ? code : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

export function getLang(): string {
  return current;
}

/** Translate a key; `{name}` placeholders are filled from `vars`. Unknown keys are returned as-is. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[current]?.[key] ?? dict.en?.[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** All keys of a language (used by tests). */
export function keysOf(code: string): string[] {
  return Object.keys(dict[code] ?? {});
}
