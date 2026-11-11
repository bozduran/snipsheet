import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSidebarHtml } from '../src/sidebarHtml';
import { sanitizeSettings } from '../src/settings';
import { buildSidebarState } from '../src/state';
import { loadCatalogFixture } from './helpers';

const catalog = loadCatalogFixture();
const NONCE = 'sidebarNonce1234567890';
const state = buildSidebarState(catalog, sanitizeSettings({ favorites: ['git'] }, catalog), 'browse');

function render(overrides: Partial<Parameters<typeof renderSidebarHtml>[0]> = {}): string {
  return renderSidebarHtml({
    nonce: NONCE,
    cspSource: 'https://*.vscode-cdn.net',
    styleUri: 'https://file+.vscode-resource.vscode-cdn.net/sidebar.css',
    scriptUri: 'https://file+.vscode-resource.vscode-cdn.net/webview.js',
    state,
    ...overrides,
  });
}

test('sidebar document is CSP-locked and nonce-scoped', () => {
  const html = render();
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, new RegExp(`script-src 'nonce-${NONCE}'`));
  assert.ok(!html.includes('unsafe-inline'));
  assert.ok(!html.includes('unsafe-eval'));
  assert.ok(!html.includes('fonts.googleapis'));
  assert.match(html, new RegExp(`<script nonce="${NONCE}">window.__SNIPSHEET_STATE__`));
  assert.match(html, new RegExp(`<script nonce="${NONCE}" src="`));
  assert.match(html, /<link rel="stylesheet" href="/);
});

test('state is serialized without closing-tag injection', () => {
  const unsafeState = {
    ...state,
    groups: state.groups.map((group, index) =>
      index === 0 ? { ...group, title: '</script><script>alert(1)</script>' } : group,
    ),
  };
  const html = render({ state: unsafeState });
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.ok(html.includes('\\u003c/script>'));
});

test('the shell includes the search bar and options affordances', () => {
  const html = render();
  assert.match(html, /id="search"/);
  assert.match(html, /aria-label="Search cheat sheets"/);
  assert.match(html, /id="openOptions"/);
  assert.match(html, /id="optionsRow"/);
  assert.match(html, /id="backToSheets"/);
});

test('uris are attribute-escaped', () => {
  const html = render({
    scriptUri: 'https://example.test/a.js?x="quoted"&y=1',
  });
  assert.ok(!html.includes('x="quoted"'));
  assert.match(html, /&quot;quoted&quot;/);
});
