import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSidebarState,
  findSheetState,
  hasHiddenEntries,
  isSheetVisible,
  sanitizeCollapsedGroups,
  visibleSheetStates,
} from '../src/state';
import { sanitizeSettings } from '../src/settings';
import { loadCatalogFixture } from './helpers';

const catalog = loadCatalogFixture();

function stateWith(
  rawSettings: Record<string, unknown>,
  mode: 'browse' | 'options' = 'browse',
  collapsedGroups: string[] = [],
) {
  const settings = sanitizeSettings(rawSettings, catalog);
  return buildSidebarState(catalog, settings, mode, null, collapsedGroups);
}

test('sidebar state mirrors groups, sheets and favorites in manifest order', () => {
  const state = stateWith({ favorites: ['regex', 'git'] });
  assert.equal(state.mode, 'browse');
  assert.equal(state.showFavorites, true);
  assert.equal(state.error, null);

  const gitGroup = state.groups.find((group) => group.id === 'git-github');
  assert.ok(gitGroup);
  assert.deepEqual(gitGroup.sheets.map((sheet) => sheet.id), ['git', 'git-branches', 'github']);
  assert.equal(gitGroup.sheets[0]?.favorite, true);
  assert.equal(gitGroup.sheets[1]?.favorite, false);

  assert.deepEqual(state.favorites, ['git', 'regex']);
  assert.equal(findSheetState(state, 'git')?.title, 'Git');
  assert.equal(findSheetState(state, 'missing'), undefined);
});

test('hidden groups and sheets are flagged without being removed from options', () => {
  const state = stateWith({
    hiddenGroups: ['containers'],
    hiddenSheets: ['git'],
    favorites: ['git', 'docker'],
  });
  const containers = state.groups.find((group) => group.id === 'containers');
  assert.ok(containers);
  assert.equal(containers.hidden, true);
  assert.equal(containers.sheets.length, 2);

  const gitGroup = state.groups.find((group) => group.id === 'git-github');
  assert.ok(gitGroup);
  const git = gitGroup.sheets.find((sheet) => sheet.id === 'git');
  assert.ok(git);
  assert.equal(git.hidden, true);

  const docker = containers.sheets.find((sheet) => sheet.id === 'docker');
  assert.ok(docker);
  assert.equal(isSheetVisible(containers, docker), false);

  assert.deepEqual(visibleSheetStates(state).map((sheet) => sheet.id).includes('docker'), false);
  assert.deepEqual(visibleSheetStates(state).map((sheet) => sheet.id).includes('git'), false);
  assert.equal(findSheetState(state, 'git')?.hidden, true);
  assert.equal(findSheetState(state, 'git')?.favorite, true);
  assert.deepEqual(state.favorites, ['git', 'docker']);
  assert.equal(hasHiddenEntries(sanitizeSettings({ hiddenSheets: ['git'] }, catalog)), true);
});

test('hiding a group hides its sheets but keeps the group in the model', () => {
  const state = stateWith({ hiddenGroups: ['java-spring'] });
  const java = state.groups.find((group) => group.id === 'java-spring');
  assert.ok(java);
  assert.equal(java.sheets.length, 4);
  assert.equal(visibleSheetStates(state).some((sheet) => sheet.groupId === 'java-spring'), false);
});

test('collapsed groups are flagged and stale ids are ignored', () => {
  const state = stateWith({}, 'browse', ['containers', 'missing', 'containers']);
  const containers = state.groups.find((group) => group.id === 'containers');
  assert.ok(containers);
  assert.equal(containers.collapsed, true);
  assert.equal(state.groups.filter((group) => group.collapsed).length, 1);

  assert.ok(stateWith({}).groups.every((group) => !group.collapsed));
  assert.deepEqual(
    sanitizeCollapsedGroups(['containers', 'missing', 'containers', 42], catalog),
    ['containers'],
  );
  assert.deepEqual(sanitizeCollapsedGroups('not-an-array', catalog), []);
});

test('showFavorites and mode are carried through', () => {
  const state = stateWith({ showFavorites: false }, 'options');
  assert.equal(state.showFavorites, false);
  assert.equal(state.mode, 'options');
});

test('an error is carried into the state for the sidebar to show', () => {
  const settings = sanitizeSettings({}, catalog);
  const state = buildSidebarState(catalog, settings, 'browse', 'broken manifest');
  assert.equal(state.error, 'broken manifest');
});
