import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSheetHtml } from '../src/htmlTransform';
import { readSheet, sheetFiles } from './helpers';

const NONCE = 'securityNonce123456789';
const CSP_SOURCE = 'https://*.vscode-cdn.net';
const ALLOWED_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'github.com',
]);
const DANGEROUS_APIS = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bsendBeacon\s*\(/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
];

test('bundled sheets contain no active network or script-injection features', () => {
  const files = sheetFiles().filter((file) => file !== 'cheatsheet-template.html');
  assert.equal(files.length, 16);

  for (const file of files) {
    const html = readSheet(file);

    const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
    assert.equal(scriptTags.length, 1, `${file} must have exactly one script tag`);
    assert.ok(!/\bsrc\s*=/.test(scriptTags[0] ?? ''), `${file} loads an external script`);

    const styleTags = [...html.matchAll(/<style\b[^>]*>/gi)];
    assert.equal(styleTags.length, 1, `${file} must have exactly one style tag`);

    for (const pattern of DANGEROUS_APIS) {
      assert.ok(!pattern.test(html), `${file} matches ${pattern}`);
    }

    const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
    assert.ok(!/<iframe\b/i.test(withoutScripts), `${file} contains an iframe`);
    assert.ok(!/<object\b/i.test(withoutScripts), `${file} contains an object`);
    assert.ok(!/<embed\b/i.test(withoutScripts), `${file} contains an embed`);
    assert.ok(!/<base(?:\s|>)/i.test(withoutScripts), `${file} contains a base tag`);
    assert.ok(
      !/http-equiv\s*=\s*["']?refresh/i.test(withoutScripts),
      `${file} contains a refresh meta`,
    );
    assert.ok(!/<[^>]+\son[a-z]+\s*=/i.test(withoutScripts), `${file} has an inline handler`);
    assert.ok(!/\sstyle\s*=/i.test(withoutScripts), `${file} has an inline style attribute`);

    const urls = withoutScripts.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
    for (const url of urls) {
      if (/^http:\/\/localhost(?::|$)/.test(url)) {
        continue;
      }
      const parsed = new URL(url);
      assert.ok(ALLOWED_HOSTS.has(parsed.hostname), `${file} references an unexpected URL: ${url}`);
    }
  }
});

test('transformed sheets have a locked CSP and no remote loads', () => {
  for (const file of sheetFiles()) {
    if (file === 'cheatsheet-template.html') {
      continue;
    }
    const out = prepareSheetHtml(readSheet(file), {
      nonce: NONCE,
      cspSource: CSP_SOURCE,
      theme: 'dark',
    });
    assert.match(out, /default-src 'none'/);
    assert.ok(!out.includes('unsafe-inline'));
    assert.ok(!out.includes('unsafe-eval'));
    assert.ok(!/<link\b/i.test(out));
    assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(out));
    assert.ok(!/<(iframe|object|embed)\b/i.test(out));
  }
});
