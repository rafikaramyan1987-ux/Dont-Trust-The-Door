// Progress persistence. Every storage access is wrapped: private mode,
// blocked storage or quota errors must never break the game.

const KEY = 'dttd-save-v1';

export interface SaveData {
  unlocked: number; // highest level number the player may start (1-based)
  totalDeaths: number;
  levelDeaths: Record<string, number>; // deaths per level id (all-time)
  completed: Record<string, boolean>;
  muted: boolean;
  /** The level-1 control instructions have been shown. */
  tutorialSeen: boolean;
}

function fresh(): SaveData {
  return { unlocked: 1, totalDeaths: 0, levelDeaths: {}, completed: {}, muted: false, tutorialSeen: false };
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = fresh();
    return {
      unlocked: Math.max(1, Number(parsed.unlocked) || 1),
      totalDeaths: Math.max(0, Number(parsed.totalDeaths) || 0),
      levelDeaths: typeof parsed.levelDeaths === 'object' && parsed.levelDeaths ? parsed.levelDeaths : base.levelDeaths,
      completed: typeof parsed.completed === 'object' && parsed.completed ? parsed.completed : base.completed,
      muted: !!parsed.muted,
      tutorialSeen: !!parsed.tutorialSeen,
    };
  } catch {
    return fresh();
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: keep playing with in-memory progress */
  }
}

export const Save = {
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
