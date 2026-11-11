import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWebviewRequest } from '../src/protocol';
import { loadCatalogFixture } from './helpers';

const catalog = loadCatalogFixture();

test('accepts the complete sidebar message vocabulary', () => {
  assert.deepEqual(parseWebviewRequest({ type: 'ready' }, catalog), { type: 'ready' });
  assert.deepEqual(parseWebviewRequest({ type: 'setMode', mode: 'options' }, catalog), {
    type: 'setMode',
    mode: 'options',
  });
  assert.deepEqual(
    parseWebviewRequest({ type: 'toggleFavorite', sheetId: 'git', favorite: true }, catalog),
    { type: 'toggleFavorite', sheetId: 'git', favorite: true },
  );
  assert.deepEqual(
    parseWebviewRequest({ type: 'setGroupHidden', groupId: 'containers', hidden: true }, catalog),
    { type: 'setGroupHidden', groupId: 'containers', hidden: true },
  );
  assert.deepEqual(
    parseWebviewRequest({ type: 'setSheetHidden', sheetId: 'docker', hidden: false }, catalog),
    { type: 'setSheetHidden', sheetId: 'docker', hidden: false },
  );
  assert.deepEqual(parseWebviewRequest({ type: 'setShowFavorites', showFavorites: false }, catalog), {
    type: 'setShowFavorites',
    showFavorites: false,
  });
  assert.deepEqual(parseWebviewRequest({ type: 'resetVisibility' }, catalog), {
    type: 'resetVisibility',
  });
  assert.deepEqual(parseWebviewRequest({ type: 'openSettings' }, catalog), {
    type: 'openSettings',
  });
  assert.deepEqual(parseWebviewRequest({ type: 'openSheet', sheetId: 'regex' }, catalog), {
    type: 'openSheet',
    sheetId: 'regex',
  });
});

test('rejects unknown ids, wrong types and unknown modes', () => {
  assert.equal(
    parseWebviewRequest({ type: 'toggleFavorite', sheetId: 'missing', favorite: true }, catalog),
    null,
  );
  assert.equal(
    parseWebviewRequest({ type: 'toggleFavorite', sheetId: 'git', favorite: 'yes' }, catalog),
    null,
  );
  assert.equal(
    parseWebviewRequest({ type: 'setGroupHidden', groupId: 'git', hidden: true }, catalog),
    null,
  );
  assert.equal(
    parseWebviewRequest({ type: 'setSheetHidden', sheetId: 'containers', hidden: true }, catalog),
    null,
  );
  assert.equal(parseWebviewRequest({ type: 'setMode', mode: 'preview' }, catalog), null);
  assert.equal(parseWebviewRequest({ type: 'setShowFavorites', showFavorites: 1 }, catalog), null);
  assert.equal(parseWebviewRequest({ type: 'openSheet', sheetId: 'missing' }, catalog), null);
});

test('rejects non-objects and unknown message types', () => {
  assert.equal(parseWebviewRequest(null, catalog), null);
  assert.equal(parseWebviewRequest([], catalog), null);
  assert.equal(parseWebviewRequest('ready', catalog), null);
  assert.equal(parseWebviewRequest({ type: 'runCommand', command: 'rm -rf /' }, catalog), null);
});
