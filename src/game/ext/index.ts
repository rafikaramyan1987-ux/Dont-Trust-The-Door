// The level extensions in use (one file per level that brings new mechanics).
import type { Ext } from './types';
import l14 from './l14';
import l15 from './l15';
import { L17 } from './l17';
import { l20 } from './l20';

export const EXTS: Ext[] = [l14, l15, L17, l20];
