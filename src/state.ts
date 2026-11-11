import type { SnipSheetSettings } from './settings';
import type { Catalog } from './types';

export type SidebarMode = 'browse' | 'options';

export interface SheetState {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly groupId: string;
  readonly groupTitle: string;
  readonly hidden: boolean;
  readonly favorite: boolean;
}

export interface GroupState {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly hidden: boolean;
  readonly sheets: readonly SheetState[];
}

export interface SidebarState {
  readonly mode: SidebarMode;
  readonly showFavorites: boolean;
  readonly groups: readonly GroupState[];
  /** Sheet ids in manifest order, including sheets hidden by a group. */
  readonly favorites: readonly string[];
  readonly error: string | null;
}

export function buildSidebarState(
  catalog: Catalog,
  settings: SnipSheetSettings,
  mode: SidebarMode,
  error: string | null = null,
): SidebarState {
  const favorites = new Set(settings.favorites);
  const hiddenGroups = new Set(settings.hiddenGroups);
  const hiddenSheets = new Set(settings.hiddenSheets);

  const groups: GroupState[] = catalog.groups.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    hidden: hiddenGroups.has(group.id),
    sheets: catalog.sheets
      .filter((sheet) => sheet.group === group.id)
      .map((sheet) => ({
        id: sheet.id,
        title: sheet.title,
        description: sheet.description,
        keywords: sheet.keywords,
        groupId: group.id,
        groupTitle: group.title,
        hidden: hiddenSheets.has(sheet.id),
        favorite: favorites.has(sheet.id),
      })),
  }));

  return {
    mode,
    showFavorites: settings.showFavorites,
    groups,
    favorites: catalog.sheets
      .filter((sheet) => favorites.has(sheet.id))
      .map((sheet) => sheet.id),
    error,
  };
}

export function isSheetVisible(group: GroupState, sheet: SheetState): boolean {
  return !group.hidden && !sheet.hidden;
}

export function visibleSheetStates(state: SidebarState): SheetState[] {
  const visible: SheetState[] = [];
  for (const group of state.groups) {
    for (const sheet of group.sheets) {
      if (isSheetVisible(group, sheet)) {
        visible.push(sheet);
      }
    }
  }
  return visible;
}

export function findSheetState(state: SidebarState, sheetId: string): SheetState | undefined {
  for (const group of state.groups) {
    for (const sheet of group.sheets) {
      if (sheet.id === sheetId) {
        return sheet;
      }
    }
  }
  return undefined;
}

export function hasHiddenEntries(settings: SnipSheetSettings): boolean {
  return settings.hiddenGroups.length > 0 || settings.hiddenSheets.length > 0;
}
