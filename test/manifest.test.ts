import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogError, findGroup, findSheet, parseCatalog } from '../src/catalog';
import {
  cloneManifest,
  loadCatalogFixture,
  sheetFiles,
  sheetByFile,
} from './helpers';

test('bundled manifest parses and covers every sheet file', () => {
  const catalog = loadCatalogFixture();
  assert.equal(catalog.groups.length, 7);
  assert.equal(catalog.sheets.length, 18);

  const manifestFiles = catalog.sheets.map((sheet) => sheet.file).sort();
  assert.deepEqual(manifestFiles, sheetFiles().filter((file) => file !== 'cheatsheet-template.html'));

  for (const sheet of catalog.sheets) {
    assert.ok(findGroup(catalog, sheet.group), `missing group for ${sheet.id}`);
    assert.equal(findSheet(catalog, sheet.id), sheet);
  }
});

test('group membership and counts are coherent', () => {
  const catalog = loadCatalogFixture();
  assert.deepEqual(
    catalog.groups.map((group) => group.id),
    [
      'git-github',
      'containers',
      'java-spring',
      'salesforce',
      'reporting-data',
      'languages-syntax',
      'ai-tooling',
    ],
  );

  const gitAndGithub = catalog.sheets
    .filter((sheet) => sheet.group === 'git-github')
    .map((sheet) => sheet.id);
  assert.deepEqual(gitAndGithub, ['git', 'git-branches', 'github']);

  for (const sheet of catalog.sheets) {
    assert.ok(!sheet.file.includes('/'), 'sheet files must be direct children');
    assert.ok(!sheet.file.includes('\\'), 'sheet files must not use backslashes');
    assert.notEqual(sheet.file, 'cheatsheet-template.html');
  }
});

test('the real catalog maps files to the expected ids', () => {
  const catalog = loadCatalogFixture();
  assert.equal(sheetByFile(catalog, 'git-cheatsheet.html').id, 'git');
  assert.equal(sheetByFile(catalog, 'java-streams-cheatsheet.html').id, 'java-streams');
  assert.equal(sheetByFile(catalog, 'jaspersoft-advanced-cheatsheet.html').id, 'jaspersoft-advanced');
});

test('rejects path traversal and non-direct file names', () => {
  for (const file of ['../secret.html', 'nested/sheet.html', '..\\sheet.html', '/abs.html', 'sheet.htm']) {
    const manifest = cloneManifest();
    const first = manifest.sheets[0];
    assert.ok(first);
    first.file = file;
    assert.throws(() => parseCatalog(manifest), CatalogError, file);
  }
});

test('rejects the template as a content sheet', () => {
  const manifest = cloneManifest();
  const first = manifest.sheets[0];
  assert.ok(first);
  first.file = 'cheatsheet-template.html';
  assert.throws(() => parseCatalog(manifest), /template/i);
});

test('rejects duplicate ids, files and unknown groups', () => {
  const duplicateId = cloneManifest();
  const firstSheet = duplicateId.sheets[0];
  assert.ok(firstSheet);
  duplicateId.sheets.push({ ...firstSheet, file: 'another-file.html' });
  assert.throws(() => parseCatalog(duplicateId), /Duplicate sheet id/);

  const duplicateFile = cloneManifest();
  const secondSheet = duplicateFile.sheets[1];
  assert.ok(secondSheet);
  if (firstSheet) {
    duplicateFile.sheets.push({ ...secondSheet, id: 'unique-id' });
  }
  assert.throws(() => parseCatalog(duplicateFile), /Duplicate sheet file/);

  const unknownGroup = cloneManifest();
  const sheet = unknownGroup.sheets[0];
  assert.ok(sheet);
  sheet.group = 'missing-group';
  assert.throws(() => parseCatalog(unknownGroup), /unknown group/);
});

test('rejects malformed top-level structures', () => {
  assert.throws(() => parseCatalog(null), CatalogError);
  assert.throws(() => parseCatalog([]), CatalogError);
  assert.throws(() => parseCatalog({ schemaVersion: 2 }), /schemaVersion/);
  assert.throws(() => parseCatalog({ schemaVersion: 1, groups: [], sheets: [] }), /group/);
  assert.throws(() => parseCatalog({ schemaVersion: 1, groups: [{}], sheets: [] }), /sheet/);
});

test('rejects unknown ids and unsafe characters', () => {
  const manifest = cloneManifest();
  const group = manifest.groups[0];
  assert.ok(group);
  group.id = 'Git GitHub';
  assert.throws(() => parseCatalog(manifest), /groups\[0\]\.id/);

  const badFile = cloneManifest();
  const sheet = badFile.sheets[0];
  assert.ok(sheet);
  sheet.file = 'Git-Cheat.html';
  assert.throws(() => parseCatalog(badFile), /file/);
});
