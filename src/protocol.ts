import type { Catalog } from './types';
import type { SidebarMode, SidebarState } from './state';

export type WebviewRequest =
  | { readonly type: 'ready' }
  | { readonly type: 'setMode'; readonly mode: SidebarMode }
  | { readonly type: 'toggleFavorite'; readonly sheetId: string; readonly favorite: boolean }
  | { readonly type: 'setGroupHidden'; readonly groupId: string; readonly hidden: boolean }
  | {
      readonly type: 'setGroupCollapsed';
      readonly groupId: string;
      readonly collapsed: boolean;
    }
  | { readonly type: 'setSheetHidden'; readonly sheetId: string; readonly hidden: boolean }
  | { readonly type: 'setShowFavorites'; readonly showFavorites: boolean }
  | { readonly type: 'resetVisibility' }
  | { readonly type: 'openSettings' }
  | { readonly type: 'openSheet'; readonly sheetId: string };

export type HostMessage = {
  readonly type: 'state';
  readonly state: SidebarState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function readId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;
}

/**
 * The sidebar webview is untrusted input. Accept only the exact messages the
 * extension knows how to handle and only ids that exist in the catalog.
 */
export function parseWebviewRequest(raw: unknown, catalog: Catalog): WebviewRequest | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return null;
  }

  switch (raw.type) {
    case 'ready':
      return { type: 'ready' };

    case 'setMode':
      return raw.mode === 'browse' || raw.mode === 'options'
        ? { type: 'setMode', mode: raw.mode }
        : null;

    case 'toggleFavorite': {
      const sheetId = readId(raw.sheetId);
      return sheetId && isBoolean(raw.favorite) && catalog.sheets.some((sheet) => sheet.id === sheetId)
        ? { type: 'toggleFavorite', sheetId, favorite: raw.favorite }
        : null;
    }

    case 'setGroupHidden': {
      const groupId = readId(raw.groupId);
      return groupId && isBoolean(raw.hidden) && catalog.groups.some((group) => group.id === groupId)
        ? { type: 'setGroupHidden', groupId, hidden: raw.hidden }
        : null;
    }

    case 'setGroupCollapsed': {
      const groupId = readId(raw.groupId);
      return groupId &&
        isBoolean(raw.collapsed) &&
        catalog.groups.some((group) => group.id === groupId)
        ? { type: 'setGroupCollapsed', groupId, collapsed: raw.collapsed }
        : null;
    }

    case 'setSheetHidden': {
      const sheetId = readId(raw.sheetId);
      return sheetId && isBoolean(raw.hidden) && catalog.sheets.some((sheet) => sheet.id === sheetId)
        ? { type: 'setSheetHidden', sheetId, hidden: raw.hidden }
        : null;
    }

    case 'setShowFavorites':
      return isBoolean(raw.showFavorites)
        ? { type: 'setShowFavorites', showFavorites: raw.showFavorites }
        : null;

    case 'resetVisibility':
      return { type: 'resetVisibility' };

    case 'openSettings':
      return { type: 'openSettings' };

    case 'openSheet': {
      const sheetId = readId(raw.sheetId);
      return sheetId && catalog.sheets.some((sheet) => sheet.id === sheetId)
        ? { type: 'openSheet', sheetId }
        : null;
    }

    default:
      return null;
  }
}
