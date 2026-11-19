// Progress persistence. Every storage access is wrapped: private mode,
// blocked storage or quota errors must never break the game. The store is localStorage, or the portal's own storage
// (Playgama Bridge storage, CrazyGames data module) in those builds: the same key and the same JSON format.
import type { KeyValueStore } from './platform/types';

const KEY = 'dttd-save-v1';

export interface SaveData {
  unlocked: number; // highest level number the player may start (1-based)
  totalDeaths: number;
  levelDeaths: Record<string, number>; // deaths per level id (all-time)
  completed: Record<string, boolean>;
  muted: boolean;
  /** The level-1 control instructions have been shown. */
  tutorialSeen: boolean;
  /** Chosen language code (null: follow the browser language). */
  lang: string | null;
}

function fresh(): SaveData {
  return { unlocked: 1, totalDeaths: 0, levelDeaths: {}, completed: {}, muted: false, tutorialSeen: false, lang: null };
}

let store: KeyValueStore | null = null;
let data: SaveData = load();

function backend(): KeyValueStore {
  return store ?? window.localStorage;
}

function load(): SaveData {
  try {
    const raw = backend().getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = fresh();
    const completed = typeof parsed.completed === 'object' && parsed.completed ? parsed.completed : base.completed;
    // older saves capped `unlocked` at the old level count (10): finishing a level always unlocks the next one
    const best = Math.max(0, ...Object.keys(completed).filter((k) => completed[k]).map(Number).filter((n) => n > 0));
    return {
      unlocked: Math.max(1, Number(parsed.unlocked) || 1, best + 1),
      totalDeaths: Math.max(0, Number(parsed.totalDeaths) || 0),
      levelDeaths: typeof parsed.levelDeaths === 'object' && parsed.levelDeaths ? parsed.levelDeaths : base.levelDeaths,
      completed,
      muted: !!parsed.muted,
      tutorialSeen: !!parsed.tutorialSeen,
      lang: typeof parsed.lang === 'string' ? parsed.lang : null,
    };
  } catch {
    return fresh();
  }
}

function persist(): void {
  try {
    backend().setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: keep playing with in-memory progress */
  }
}

export const Save = {
  /** switch to the portal's store (or back to localStorage with null) and reload from it */
  use(kv: KeyValueStore | null): void {
    store = kv;
    data = load();
  },
  /** reload from the store (tests) */
  reload(): void {
    data = load();
  },
  get(): Readonly<SaveData> {
    return data;
  },
  addDeath(levelId: number): void {
    data.totalDeaths += 1;
    const k = String(levelId);
    data.levelDeaths[k] = (data.levelDeaths[k] || 0) + 1;
    persist();
  },
  complete(levelId: number, levelCount: number): void {
    data.completed[String(levelId)] = true;
    data.unlocked = Math.min(levelCount, Math.max(data.unlocked, levelId + 1));
    persist();
  },
  setTutorialSeen(): void {
    if (data.tutorialSeen) return;
    data.tutorialSeen = true;
    persist();
  },
  setLang(code: string): void {
    data.lang = code;
    persist();
  },
  setMuted(m: boolean): void {
    data.muted = m;
    persist();
  },
  unlockAll(levelCount: number): void {
    data.unlocked = levelCount;
    persist();
  },
  reset(): void {
    data = fresh();
    persist();
  },
};
