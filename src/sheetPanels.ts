import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { prepareSheetHtml, type SheetTheme } from './htmlTransform';
import { parseSheetMessage } from './sheetProtocol';
import type { Catalog, SheetDefinition } from './types';

const MAX_SHEET_BYTES = 5_000_000;

function themeFor(kind: vscode.ColorThemeKind): SheetTheme {
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? 'light'
    : 'dark';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class SheetPanels implements vscode.Disposable {
  private readonly sheetsDir: vscode.Uri;
  private readonly panels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly catalog: Catalog,
    private readonly output: vscode.OutputChannel,
  ) {
    this.sheetsDir = vscode.Uri.joinPath(context.extensionUri, 'cheatsheets');
  }

  async openById(sheetId: string): Promise<void> {
    const sheet = this.catalog.sheets.find((candidate) => candidate.id === sheetId);
    if (!sheet) {
      this.output.appendLine(`SnipSheet: unknown sheet id "${sheetId}".`);
      return;
    }
    try {
      await this.open(sheet);
    } catch (error) {
      this.output.appendLine(`SnipSheet: could not open ${sheet.file}: ${String(error)}`);
      void vscode.window.showErrorMessage(`SnipSheet could not open "${sheet.title}".`);
    }
  }

  async open(sheet: SheetDefinition): Promise<void> {
    const existing = this.panels.get(sheet.id);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'snipsheet.sheet',
      sheet.title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        enableFindWidget: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.sheetsDir],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.png');
    this.panels.set(sheet.id, panel);

    const disposables: vscode.Disposable[] = [];
    disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        void this.handleMessage(raw);
      }),
      panel.onDidDispose(() => {
        this.panels.delete(sheet.id);
        for (const disposable of disposables) {
          disposable.dispose();
        }
      }),
    );

    try {
      await this.render(panel, sheet);
    } catch (error) {
      this.output.appendLine(`SnipSheet: could not open ${sheet.file}: ${String(error)}`);
      panel.webview.html = this.errorHtml(`SnipSheet could not open "${sheet.title}".`);
    }
  }

  dispose(): void {
    for (const panel of [...this.panels.values()]) {
      panel.dispose();
    }
    this.panels.clear();
  }

  private async render(panel: vscode.WebviewPanel, sheet: SheetDefinition): Promise<void> {
    const uri = vscode.Uri.joinPath(this.sheetsDir, sheet.file);
    const bytes = await vscode.workspace.fs.readFile(uri);
    if (bytes.byteLength > MAX_SHEET_BYTES) {
      throw new Error('The sheet is larger than the supported size limit.');
    }

    const html = new TextDecoder('utf-8').decode(bytes);
    panel.webview.html = prepareSheetHtml(html, {
      nonce: randomBytes(16).toString('base64'),
      cspSource: panel.webview.cspSource,
      theme: themeFor(vscode.window.activeColorTheme.kind),
    });
    panel.title = sheet.title;
  }

  private async handleMessage(raw: unknown): Promise<void> {
    const message = parseSheetMessage(raw);
    if (!message) {
      this.output.appendLine('SnipSheet: ignored an invalid sheet message.');
      return;
    }

    try {
      if (message.type === 'copy') {
        await vscode.env.clipboard.writeText(message.text);
      } else {
        await vscode.env.openExternal(vscode.Uri.parse(message.url, true));
      }
    } catch (error) {
      this.output.appendLine(`SnipSheet: ${String(error)}`);
      void vscode.window.showErrorMessage('SnipSheet could not complete that action.');
    }
  }

  private errorHtml(message: string): string {
    const nonce = randomBytes(16).toString('base64');
    const csp = `default-src 'none'; style-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style nonce="${nonce}">
  body { padding: 16px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); }
</style>
</head>
<body>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
  }
}
