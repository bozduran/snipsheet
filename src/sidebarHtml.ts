import type { SidebarState } from './state';

export interface SidebarHtmlOptions {
  readonly nonce: string;
  readonly cspSource: string;
  readonly styleUri: string;
  readonly scriptUri: string;
  readonly state: SidebarState;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeState(state: SidebarState): string {
  return JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderSidebarHtml(options: SidebarHtmlOptions): string {
  const { nonce, cspSource, styleUri, scriptUri, state } = options;
  const csp = [
    "default-src 'none'",
    `style-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
  <title>SnipSheet</title>
  <link rel="stylesheet" href="${escapeAttribute(styleUri)}">
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="search-row" id="searchRow">
        <div class="search-box">
          <input id="search" type="search" placeholder="Search cheat sheets" aria-label="Search cheat sheets" autocomplete="off" spellcheck="false">
          <button id="clearSearch" class="icon-button clear-button" type="button" aria-label="Clear search" title="Clear search" hidden>&times;</button>
        </div>
        <button id="openOptions" class="icon-button" type="button" aria-label="Open options" title="Options">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>
            <circle cx="5.5" cy="4.5" r="1.7" fill="var(--vscode-sideBar-background, #1e1e1e)"/>
            <circle cx="10.5" cy="8" r="1.7" fill="var(--vscode-sideBar-background, #1e1e1e)"/>
            <circle cx="6.5" cy="11.5" r="1.7" fill="var(--vscode-sideBar-background, #1e1e1e)"/>
          </svg>
        </button>
      </div>
      <div class="options-row" id="optionsRow" hidden>
        <button id="backToSheets" class="back-button" type="button">
          <span aria-hidden="true">&larr;</span> Back
        </button>
        <h1>Options</h1>
      </div>
    </header>
    <div id="banner" class="banner" role="alert" hidden></div>
    <main id="content" class="content">
      <p class="loading">Loading cheat sheets&hellip;</p>
    </main>
  </div>
  <noscript>SnipSheet needs JavaScript enabled in this view.</noscript>
  <script nonce="${nonce}">window.__SNIPSHEET_STATE__ = ${serializeState(state)};</script>
  <script nonce="${nonce}" src="${escapeAttribute(scriptUri)}"></script>
</body>
</html>`;
}
