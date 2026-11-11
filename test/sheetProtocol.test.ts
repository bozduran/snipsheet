import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_COPY_LENGTH, parseSheetMessage } from '../src/sheetProtocol';

test('copy messages accept bounded text', () => {
  assert.deepEqual(parseSheetMessage({ type: 'copy', text: 'git status' }), {
    type: 'copy',
    text: 'git status',
  });
  assert.deepEqual(parseSheetMessage({ type: 'copy', text: '' }), { type: 'copy', text: '' });
  assert.equal(
    parseSheetMessage({ type: 'copy', text: 'x'.repeat(MAX_COPY_LENGTH + 1) }),
    null,
  );
  assert.equal(parseSheetMessage({ type: 'copy', text: 42 }), null);
  assert.equal(parseSheetMessage({ type: 'copy' }), null);
});

test('external links are https-only and credential-free', () => {
  assert.deepEqual(parseSheetMessage({ type: 'openExternal', url: 'https://github.com/bozduran' }), {
    type: 'openExternal',
    url: 'https://github.com/bozduran',
  });
  assert.equal(parseSheetMessage({ type: 'openExternal', url: 'http://github.com' }), null);
  assert.equal(parseSheetMessage({ type: 'openExternal', url: 'javascript:alert(1)' }), null);
  assert.equal(parseSheetMessage({ type: 'openExternal', url: 'file:///etc/passwd' }), null);
  assert.equal(parseSheetMessage({ type: 'openExternal', url: 'https://user:pass@example.com' }), null);
  assert.equal(parseSheetMessage({ type: 'openExternal', url: '/relative' }), null);
  assert.equal(parseSheetMessage({ type: 'openExternal', url: 'https://example.com/' + 'a'.repeat(2100) }), null);
});

test('unknown or malformed messages are ignored', () => {
  assert.equal(parseSheetMessage(null), null);
  assert.equal(parseSheetMessage([]), null);
  assert.equal(parseSheetMessage({ type: 'paste', text: 'x' }), null);
  assert.equal(parseSheetMessage({ text: 'x' }), null);
});
