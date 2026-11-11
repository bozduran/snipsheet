import assert from 'node:assert/strict';
import test from 'node:test';
import { findGroup, findSheet } from '../src/catalog';
import { sheetMatches, type SearchableSheet } from '../src/search';
import { loadCatalogFixture } from './helpers';

const catalog = loadCatalogFixture();

function searchable(sheetId: string): SearchableSheet {
  const sheet = findSheet(catalog, sheetId);
  assert.ok(sheet);
  const group = findGroup(catalog, sheet.group);
  assert.ok(group);
  return {
    id: sheet.id,
    title: sheet.title,
    description: sheet.description,
    keywords: sheet.keywords,
    groupTitle: group.title,
  };
}

test('an empty query matches every sheet', () => {
  for (const sheet of catalog.sheets) {
    assert.equal(sheetMatches(searchable(sheet.id), '   '), true);
  }
});

test('title, keyword and group matches are case-insensitive', () => {
  assert.equal(sheetMatches(searchable('docker-compose'), 'DOCKER'), true);
  assert.equal(sheetMatches(searchable('docker-compose'), 'compose'), true);
  assert.equal(sheetMatches(searchable('java-streams'), 'optional'), true);
  assert.equal(sheetMatches(searchable('lwc'), 'salesforce'), true);
  assert.equal(sheetMatches(searchable('kibana'), 'containers'), false);
});

test('all tokens must match', () => {
  assert.equal(sheetMatches(searchable('docker'), 'docker compose'), false);
  assert.equal(sheetMatches(searchable('docker-compose'), 'docker compose'), true);
  assert.equal(sheetMatches(searchable('jaspersoft-advanced'), 'jaspersoft advanced'), true);
  assert.equal(sheetMatches(searchable('git'), 'git rebase'), true);
});

test('group titles make whole categories searchable', () => {
  const matching = catalog.sheets
    .filter((sheet) => sheetMatches(searchable(sheet.id), 'containers'))
    .map((sheet) => sheet.id);
  assert.deepEqual(matching, ['docker', 'docker-compose']);
});

test('diacritics and repeated whitespace are normalized', () => {
  const sheet: SearchableSheet = {
    id: 'cafe',
    title: 'Café commands',
    description: 'Crème brûlée',
    keywords: [],
    groupTitle: 'Food',
  };
  assert.equal(sheetMatches(sheet, 'cafe'), true);
  assert.equal(sheetMatches(sheet, 'creme'), true);
  assert.equal(sheetMatches(sheet, '  cafe   commands  '), true);
  assert.equal(sheetMatches(sheet, 'restaurant'), false);
});

test('hyphenated ids can be found without the hyphen', () => {
  assert.equal(sheetMatches(searchable('docker-compose'), 'docker compose'), true);
  assert.equal(sheetMatches(searchable('git-branches'), 'git branches'), true);
});
