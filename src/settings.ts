import type { Catalog } from './types';

export const CONFIG_SECTION = 'snipsheet';
export const FAVORITES_KEY = 'favorites';
export const HIDDEN_GROUPS_KEY = 'hiddenGroups';
export const HIDDEN_SHEETS_KEY = 'hiddenSheets';
export const SHOW_FAVORITES_KEY = 'showFavorites';

export interface SnipSheetSettings {
  readonly favorites: readonly string[];
  readonly hiddenGroups: readonly string[];
  readonly hiddenSheets: readonly string[];
  readonly showFavorites: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readIds(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed.has(item) && !ids.includes(item)) {
      ids.push(item);
    }
  }
  return ids;
}

/**
 * Settings are user-editable JSON, so every value is treated as untrusted.
 * Unknown ids are ignored instead of being persisted or used in a path.
 */
export function sanitizeSettings(value: unknown, catalog: Catalog): SnipSheetSettings {
  const raw = isRecord(value) ? value : {};
  const sheetIds = new Set(catalog.sheets.map((sheet) => sheet.id));
  const groupIds = new Set(catalog.groups.map((group) => group.id));

  return {
    favorites: readIds(raw.favorites, sheetIds),
    hiddenGroups: readIds(raw.hiddenGroups, groupIds),
    hiddenSheets: readIds(raw.hiddenSheets, sheetIds),
    showFavorites: typeof raw.showFavorites === 'boolean' ? raw.showFavorites : true,
  };
}

export function withMembership(
  current: readonly string[],
  id: string,
  present: boolean,
): string[] {
  if (present) {
    return current.includes(id) ? [...current] : [...current, id];
  }
  return current.filter((item) => item !== id);
}
