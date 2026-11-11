import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSettings, withMembership } from '../src/settings';
import { loadCatalogFixture } from './helpers';

const catalog = loadCatalogFixture();

test('settings keep known ids only and ignore malformed values', () => {
  const settings = sanitizeSettings(
    {
      favorites: ['git', 'git', 'missing', 42, null, 'regex'],
      hiddenGroups: ['containers', 'unknown'],
      hiddenSheets: ['docker', 'git'],
      showFavorites: false,
    },
    catalog,
  );

  assert.deepEqual(settings.favorites, ['git', 'regex']);
  assert.deepEqual(settings.hiddenGroups, ['containers']);
  assert.deepEqual(settings.hiddenSheets, ['docker', 'git']);
  assert.equal(settings.showFavorites, false);
});

test('missing or invalid settings fall back to safe defaults', () => {
  assert.deepEqual(sanitizeSettings(null, catalog), {
    favorites: [],
    hiddenGroups: [],
    hiddenSheets: [],
    showFavorites: true,
  });

  assert.deepEqual(
    sanitizeSettings(
      { favorites: 'git', hiddenGroups: {}, hiddenSheets: 3, showFavorites: 'yes' },
      catalog,
    ),
    {
      favorites: [],
      hiddenGroups: [],
      hiddenSheets: [],
      showFavorites: true,
    },
  );
});

test('group ids cannot be used as sheet ids', () => {
  const settings = sanitizeSettings(
    { favorites: ['git-github'], hiddenSheets: ['containers'] },
    catalog,
  );
  assert.deepEqual(settings.favorites, []);
  assert.deepEqual(settings.hiddenSheets, []);
});

test('membership updates are idempotent', () => {
  assert.deepEqual(withMembership([], 'git', true), ['git']);
  assert.deepEqual(withMembership(['git'], 'git', true), ['git']);
  assert.deepEqual(withMembership(['git', 'regex'], 'regex', false), ['git']);
  assert.deepEqual(withMembership(['git'], 'missing', false), ['git']);
});
