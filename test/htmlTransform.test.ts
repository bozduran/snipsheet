import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSheetHtml, SheetHtmlError } from '../src/htmlTransform';
import { loadCatalogFixture, readSheet, sheetByFile, sheetFiles } from './helpers';

const NONCE = 'abcdefghijklmnop1234';
const CSP_SOURCE = 'https://*.vscode-cdn.net';
const catalog = loadCatalogFixture();

function transform(file: string, theme: 'light' | 'dark' = 'dark'): string {
  return prepareSheetHtml(readSheet(file), { nonce: NONCE, cspSource: CSP_SOURCE, theme });
}

test('every bundled sheet transforms without remote resources', () => {
  for (const file of sheetFiles()) {
    if (file === 'cheatsheet-template.html') {
      continue;
    }
    const out = transform(file);
    assert.match(out, /http-equiv="Content-Security-Policy"/, file);
    assert.ok(!out.includes('fonts.googleapis.com'), file);
    assert.ok(!out.includes('fonts.gstatic.com'), file);
    assert.ok(!/<link\b/i.test(out), file);
    assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(out), file);
    assert.ok(!out.includes('unsafe-inline'), file);
    assert.ok(!out.includes('unsafe-eval'), file);
    assert.match(out, new RegExp(`script-src 'nonce-${NONCE}'`), file);
    assert.match(out, new RegExp(`style-src 'nonce-${NONCE}'`), file);
    assert.match(out, new RegExp(`<script nonce="${NONCE}">`), file);
    assert.match(out, new RegExp(`<style nonce="${NONCE}">`), file);
    assert.match(out, /acquireVsCodeApi/, file);
    assert.match(out, /postMessage\(\{ type: 'openExternal'/, file);
    assert.ok(out.includes('/^https:\\/\\//i'), file);
    assert.ok(!out.includes('/^https?:\\/\\//i'), file);

    const charsetOffset = out.indexOf('<meta charset');
    assert.ok(charsetOffset >= 0, file);
    assert.ok(
      Buffer.byteLength(out.slice(0, charsetOffset), 'utf8') < 1024,
      `${file} charset declaration is outside the prescan window`,
    );
    assert.ok(
      out.indexOf('Content-Security-Policy') > charsetOffset,
      `${file} CSP must follow the charset declaration`,
    );
    assert.ok(
      out.indexOf('Content-Security-Policy') < out.indexOf('<style'),
      `${file} CSP must precede the sheet style`,
    );
  }
});

test('the sheet theme is aligned when the sheet supports it', () => {
  const docker = sheetByFile(catalog, 'docker-cheatsheet.html');
  assert.match(transform(docker.file, 'light'), /<html[^>]*data-theme="light"/);
  assert.match(transform(docker.file, 'dark'), /<html[^>]*data-theme="dark"/);

  const git = sheetByFile(catalog, 'git-cheatsheet.html');
  assert.doesNotMatch(transform(git.file, 'light'), /data-theme=/);
});

test('tag-like text inside sheet code samples is preserved', () => {
  assert.ok(transform('docker-cheatsheet.html').includes('FROM <base-image>:<tag>'));
  assert.ok(transform('git-branches-cheatsheet.html').includes('git rebase <base>'));
});

test('remote scripts, refresh metas, bases and font links are removed', () => {
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=https://evil.example">
<base href="https://evil.example/">
<link rel="stylesheet" href="https://fonts.googleapis.com/css">
</head><body>
<script src="https://evil.example/x.js"></script>
<script>document.title = 'ok';</script>
</body></html>`;
  const out = prepareSheetHtml(html, { nonce: NONCE, cspSource: CSP_SOURCE, theme: 'dark' });
  assert.ok(!out.includes('evil.example'));
  assert.ok(!out.includes('fonts.googleapis.com'));
  assert.ok(!out.includes('<base'));
  assert.ok(!out.includes('http-equiv="refresh"'));
  assert.match(out, new RegExp(`<script nonce="${NONCE}">document.title`));
  assert.match(out, /default-src 'none'/);
});

test('invalid nonces and documents without a head are rejected', () => {
  const html = '<html><head></head><body></body></html>';
  assert.throws(
    () => prepareSheetHtml(html, { nonce: 'short', cspSource: CSP_SOURCE, theme: 'dark' }),
    SheetHtmlError,
  );
  assert.throws(
    () =>
      prepareSheetHtml('<html><body>no head</body></html>', {
        nonce: NONCE,
        cspSource: CSP_SOURCE,
        theme: 'dark',
      }),
    SheetHtmlError,
  );
});

test('csp source is attribute-escaped', () => {
  const out = prepareSheetHtml('<html><head></head><body></body></html>', {
    nonce: NONCE,
    cspSource: 'https://a.example "quoted"',
    theme: 'dark',
  });
  assert.ok(!out.includes('"quoted"'));
  assert.match(out, /&quot;quoted&quot;/);
});
