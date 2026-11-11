import type { GroupState, SheetState, SidebarMode, SidebarState } from '../state';
import type { HostMessage, WebviewRequest } from '../protocol';
import { sheetMatches } from '../search';

interface VsCodeApi {
  postMessage(message: WebviewRequest): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

declare global {
  interface Window {
    __SNIPSHEET_STATE__?: SidebarState;
  }
}

const vscode = acquireVsCodeApi();

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`SnipSheet UI is missing #${id}.`);
  }
  return found as T;
}

const searchInput = element<HTMLInputElement>('search');
const clearButton = element<HTMLButtonElement>('clearSearch');
const openOptionsButton = element<HTMLButtonElement>('openOptions');
const searchRow = element<HTMLDivElement>('searchRow');
const optionsRow = element<HTMLDivElement>('optionsRow');
const backButton = element<HTMLButtonElement>('backToSheets');
const content = element<HTMLElement>('content');
const banner = element<HTMLDivElement>('banner');

let state: SidebarState | null = window.__SNIPSHEET_STATE__ ?? null;
let mode: SidebarMode = state?.mode ?? 'browse';
let query = '';

function post(message: WebviewRequest): void {
  try {
    vscode.postMessage(message);
  } catch {
    // The webview can be disposed between an event and this call.
  }
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function makeButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = make('button', className, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

function setBanner(message: string | null): void {
  banner.textContent = message ?? '';
  banner.hidden = !message;
}

function updateChrome(): void {
  const hasError = Boolean(state?.error);
  searchRow.hidden = mode !== 'browse';
  optionsRow.hidden = mode !== 'options';
  searchInput.disabled = hasError;
  openOptionsButton.disabled = hasError;
  clearButton.hidden = mode !== 'browse' || query.length === 0 || hasError;
}

function focusKeyOf(element: Element | null): string | null {
  if (element instanceof HTMLElement && content.contains(element) && element.dataset.focusKey) {
    return element.dataset.focusKey;
  }
  return null;
}

function restoreFocus(key: string | null): void {
  if (!key) {
    return;
  }
  for (const candidate of content.querySelectorAll<HTMLElement>('[data-focus-key]')) {
    if (candidate.dataset.focusKey === key) {
      candidate.focus();
      return;
    }
  }
}

function findVisible(
  current: SidebarState,
  sheetId: string,
): { group: GroupState; sheet: SheetState } | undefined {
  for (const group of current.groups) {
    for (const sheet of group.sheets) {
      if (sheet.id === sheetId && !group.hidden && !sheet.hidden) {
        return { group, sheet };
      }
    }
  }
  return undefined;
}

function sheetRow(sheet: SheetState, inFavorites: boolean): HTMLLIElement {
  const row = make('li', 'sheet-row');
  const open = makeButton('', 'sheet-open', () => {
    post({ type: 'openSheet', sheetId: sheet.id });
  });
  open.dataset.focusKey = `${inFavorites ? 'fav' : 'group'}-open-${sheet.id}`;
  open.append(
    make('span', 'sheet-title', sheet.title),
    make('span', 'sheet-desc', sheet.description),
  );

  const star = make('button', sheet.favorite ? 'star-button is-favorite' : 'star-button');
  star.type = 'button';
  star.textContent = sheet.favorite ? '★' : '☆';
  star.dataset.focusKey = `${inFavorites ? 'fav' : 'group'}-star-${sheet.id}`;
  star.setAttribute('aria-pressed', String(sheet.favorite));
  star.title = sheet.favorite ? `Remove ${sheet.title} from favorites` : `Add ${sheet.title} to favorites`;
  star.setAttribute('aria-label', star.title);
  star.addEventListener('click', () => {
    post({ type: 'toggleFavorite', sheetId: sheet.id, favorite: !sheet.favorite });
  });

  row.append(open, star);
  return row;
}

function sheetSection(
  title: string,
  entries: ReadonlyArray<{ group: GroupState; sheet: SheetState }>,
  inFavorites: boolean,
): HTMLElement {
  const section = make('section', inFavorites ? 'section favorites' : 'section');
  const heading = make('h2', 'section-title');
  if (inFavorites) {
    const star = make('span', 'section-star', '★');
    star.setAttribute('aria-hidden', 'true');
    heading.append(star);
  }
  heading.append(document.createTextNode(title));
  const count = make('span', 'section-count', String(entries.length));
  heading.append(count);
  section.append(heading);

  const list = make('ul', 'sheet-list');
  for (const entry of entries) {
    list.append(sheetRow(entry.sheet, inFavorites));
  }
  section.append(list);
  return section;
}

function emptyBlock(
  title: string,
  detail: string,
  actionLabel: string,
  action: () => void,
): HTMLElement {
  const wrap = make('div', 'empty');
  wrap.append(make('p', 'empty-title', title), make('p', 'empty-detail', detail));
  const actionButton = makeButton(actionLabel, 'primary-button', action);
  actionButton.dataset.focusKey = 'empty-action';
  wrap.append(actionButton);
  return wrap;
}

function clearSearch(focusSearch: boolean): void {
  query = '';
  searchInput.value = '';
  clearButton.hidden = true;
  renderContent();
  if (focusSearch) {
    searchInput.focus();
  }
}

function renderBrowse(current: SidebarState): void {
  const visibleCount = current.groups.reduce(
    (total, group) =>
      total + (group.hidden ? 0 : group.sheets.filter((sheet) => !sheet.hidden).length),
    0,
  );

  if (visibleCount === 0) {
    content.append(
      emptyBlock(
        'Everything is hidden.',
        'Open Options to bring groups or sheets back.',
        'Open Options',
        () => setMode('options', true),
      ),
    );
    return;
  }

  const sections: HTMLElement[] = [];

  if (current.showFavorites) {
    const favorites: Array<{ group: GroupState; sheet: SheetState }> = [];
    for (const sheetId of current.favorites) {
      const found = findVisible(current, sheetId);
      if (found && sheetMatches(found.sheet, query)) {
        favorites.push(found);
      }
    }
    if (favorites.length > 0) {
      sections.push(sheetSection('Favorites', favorites, true));
    }
  }

  for (const group of current.groups) {
    if (group.hidden) {
      continue;
    }
    const entries = group.sheets
      .filter((sheet) => !sheet.hidden && sheetMatches(sheet, query))
      .map((sheet) => ({ group, sheet }));
    if (entries.length > 0) {
      sections.push(sheetSection(group.title, entries, false));
    }
  }

  if (sections.length === 0) {
    const trimmed = query.trim();
    content.append(
      trimmed
        ? emptyBlock(
            'No matches.',
            `Nothing matches “${trimmed}”.`,
            'Clear search',
            () => clearSearch(true),
          )
        : emptyBlock(
            'Nothing visible.',
            'Open Options to configure which sheets appear.',
            'Open Options',
            () => setMode('options', true),
          ),
    );
    return;
  }

  content.append(...sections);
}

function checkboxRow(
  labelText: string,
  checked: boolean,
  hint: string,
  focusKey: string,
  onChange: (checked: boolean) => void,
): HTMLLabelElement {
  const row = make('label', 'toggle-row');
  const input = make('input', 'toggle-input');
  input.type = 'checkbox';
  input.checked = checked;
  input.dataset.focusKey = focusKey;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(input, make('span', 'toggle-label', labelText));
  if (hint) {
    row.append(make('span', 'toggle-hint', hint));
  }
  return row;
}

function renderOptions(current: SidebarState): void {
  content.append(
    make('p', 'options-intro', 'Changes save immediately to your user settings.'),
  );

  content.append(
    checkboxRow(
      'Show Favorites section',
      current.showFavorites,
      '',
      'show-favorites',
      (checked) => post({ type: 'setShowFavorites', showFavorites: checked }),
    ),
  );

  content.append(make('h2', 'options-heading', 'Groups'));

  for (const group of current.groups) {
    const wrapper = make('div', 'option-group');
    const groupRow = checkboxRow(
      group.title,
      !group.hidden,
      `${group.sheets.length}`,
      `group-${group.id}`,
      (checked) => post({ type: 'setGroupHidden', groupId: group.id, hidden: !checked }),
    );
    groupRow.classList.add('option-group-row');
    if (group.hidden) {
      groupRow.classList.add('is-hidden');
    }
    wrapper.append(groupRow);

    const children = make('div', 'option-children');
    for (const sheet of group.sheets) {
      const childRow = checkboxRow(
        sheet.title,
        !sheet.hidden,
        '',
        `sheet-${sheet.id}`,
        (checked) => post({ type: 'setSheetHidden', sheetId: sheet.id, hidden: !checked }),
      );
      childRow.classList.add('option-child');
      if (group.hidden) {
        childRow.classList.add('muted');
      }
      children.append(childRow);
    }
    wrapper.append(children);
    content.append(wrapper);
  }

  const hasHidden =
    current.groups.some((group) => group.hidden) ||
    current.groups.some((group) => group.sheets.some((sheet) => sheet.hidden));

  const actions = make('div', 'options-actions');
  const reset = makeButton('Reset visibility', 'secondary-button', () => {
    post({ type: 'resetVisibility' });
  });
  reset.dataset.focusKey = 'reset-visibility';
  reset.disabled = !hasHidden;
  const settings = makeButton('Open Settings', 'secondary-button', () => {
    post({ type: 'openSettings' });
  });
  settings.dataset.focusKey = 'open-settings';
  actions.append(reset, settings);
  content.append(actions);

  content.append(
    make(
      'p',
      'options-note',
      'A hidden group hides all of its sheets. Favorites obey the same visibility rules.',
    ),
  );
}

function renderContent(): void {
  const current = state;
  const focusKey = focusKeyOf(document.activeElement);
  content.replaceChildren();

  if (!current) {
    setBanner(null);
    content.append(make('p', 'loading', 'Loading cheat sheets…'));
    return;
  }

  setBanner(current.error);
  if (current.error) {
    const error = make('div', 'empty');
    error.append(
      make('p', 'empty-title', 'SnipSheet could not start.'),
      make('p', 'empty-detail', current.error),
    );
    content.append(error);
    return;
  }

  if (mode === 'options') {
    renderOptions(current);
  } else {
    renderBrowse(current);
  }
  restoreFocus(focusKey);
}

function focusForMode(next: SidebarMode): void {
  if (next === 'options') {
    backButton.focus();
  } else {
    searchInput.focus();
  }
}

function setMode(next: SidebarMode, notifyHost: boolean): void {
  mode = next;
  updateChrome();
  renderContent();
  focusForMode(next);
  if (notifyHost) {
    post({ type: 'setMode', mode: next });
  }
}

function applyState(next: SidebarState): void {
  const modeChanged = next.mode !== mode;
  state = next;
  mode = next.mode;
  updateChrome();
  renderContent();
  if (modeChanged) {
    focusForMode(next.mode);
  }
}

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  clearButton.hidden = query.length === 0;
  renderContent();
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && query.length > 0) {
    event.preventDefault();
    clearSearch(true);
  }
});

clearButton.addEventListener('click', () => clearSearch(true));

openOptionsButton.addEventListener('click', () => {
  setMode('options', true);
});

backButton.addEventListener('click', () => {
  setMode('browse', true);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mode === 'options') {
    event.preventDefault();
    setMode('browse', true);
  }
});

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = event.data as HostMessage | undefined;
  if (message && typeof message === 'object' && message.type === 'state') {
    applyState(message.state);
  }
});

updateChrome();
renderContent();
post({ type: 'ready' });
