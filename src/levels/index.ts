import type { LevelData } from './schema';

// Every JSON file in this folder is a level; they are ordered by file name.
const modules = import.meta.glob<LevelData>('./*.json', { eager: true, import: 'default' });

export const LEVELS: LevelData[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k]);

export type { LevelData };
