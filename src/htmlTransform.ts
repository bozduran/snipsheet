export type SheetTheme = 'light' | 'dark';

export interface SheetHtmlOptions {
  readonly nonce: string;
  readonly cspSource: string;
  readonly theme: SheetTheme;
}

export class SheetHtmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetHtmlError';
  }
}

const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{16,64}$/;

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyTheme(html: string, theme: SheetTheme): string {
  return html.replace(
    /(<html\b[^>]*\bdata-theme\s*=\s*["'])[^"']*(["'])/i,
    (_match, prefix: string, suffix: string) => `${prefix}${theme}${suffix}`,
  );
}

function hardenScripts(html: string, nonce: string): string {
  return html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    (_match, attributes: string, body: string) => {
      // External scripts are removed rather than nonce-approved: a nonce would
      // authorize whatever remote file the tag points at.
      if (/\bsrc\s*=/i.test(attributes)) {
        return '';
      }
      const withoutNonce = attributes.replace(/\snonce\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
      return `<script${withoutNonce} nonce="${nonce}">${body}</script>`;
    },
  );
}

function hardenStyles(html: string, nonce: string): string {
  return html.replace(
    /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
    (_match, attributes: string, body: string) => {
      const withoutNonce = attributes.replace(/\snonce\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
      return `<style${withoutNonce} nonce="${nonce}">${body}</style>`;
    },
  );
}

function shim(nonce: string): string {
  return `<script nonce="${nonce}">
(function () {
  'use strict';
  var api = acquireVsCodeApi();
  function fallbackCopy(text) {
    api.postMessage({ type: 'copy', text: String(text).slice(0, 200000) });
    return Promise.resolve();
  }
  try {
    var clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      var original = clipboard.writeText.bind(clipboard);
      var wrapped = function (text) {
        return Promise.resolve().then(function () { return original(text); }).catch(function () {
          return fallbackCopy(text);
        });
      };
      try {
        clipboard.writeText = wrapped;
      } catch (_assignError) {
        try {
          Object.defineProperty(clipboard, 'writeText', { configurable: true, value: wrapped });
        } catch (_defineError) {
          // Keep the native method; a failed copy is caught by the sheet script.
        }
      }
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: fallbackCopy }
      });
    }
  } catch (_error) {
    // Leave the native clipboard untouched if it cannot be wrapped.
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor) { return; }
    var href = anchor.getAttribute('href') || '';
    if (!/^https?:\\/\\//i.test(href)) { return; }
    event.preventDefault();
    api.postMessage({ type: 'openExternal', url: href });
  }, true);
})();
</script>`;
}

function csp(nonce: string, cspSource: string): string {
  const source = escapeAttribute(cspSource);
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${source} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; font-src ${source}; connect-src 'none'; media-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';">`;
}

/**
 * Turns a bundled, first-party cheat sheet into a document that is safe to
 * load in a sandboxed webview: no remote resources, no navigation, no inline
 * event handlers, and only nonce-approved inline scripts/styles.
 */
export function prepareSheetHtml(html: string, options: SheetHtmlOptions): string {
  if (!NONCE_PATTERN.test(options.nonce)) {
    throw new SheetHtmlError('Invalid nonce.');
  }
  if (!/<head\b[^>]*>/i.test(html)) {
    throw new SheetHtmlError('Sheet HTML has no <head> element.');
  }

  const headMatch = html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i);
  if (!headMatch) {
    throw new SheetHtmlError('Sheet HTML has no complete <head> element.');
  }

  // Bundled sheets are designed to work offline. Remove resource and navigation
  // tags from the head only: code samples inside a sheet may legitimately show
  // strings such as `<base>` or `<link>` and must keep rendering as text.
  const head = headMatch[0]
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<base(?:\s[^>]*)?>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');

  let out = html.replace(headMatch[0], head);
  out = applyTheme(out, options.theme);
  out = hardenScripts(out, options.nonce);
  out = hardenStyles(out, options.nonce);

  if (/<script\b[^>]*\bsrc\s*=/i.test(out)) {
    throw new SheetHtmlError('Sheet HTML still references an external script.');
  }

  const injection = `${csp(options.nonce, options.cspSource)}\n${shim(options.nonce)}`;
  out = out.replace(/<head\b[^>]*>/i, (match) => `${match}\n${injection}`);
  return out;
}
