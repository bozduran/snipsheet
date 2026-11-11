import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  CONFIG_SECTION,
  FAVORITES_KEY,
  HIDDEN_GROUPS_KEY,
  HIDDEN_SHEETS_KEY,
  SHOW_FAVORITES_KEY,
  sanitizeSettings,
  withMembership,
  type SnipSheetSettings,
} from './settings';
import {
  buildSidebarState,
  visibleSheetStates,
  type SidebarMode,
  type SidebarState,
  type SheetState,
} from './state';
import { parseWebviewRequest, type HostMessage } from './protocol';
import { renderSidebarHtml } from './sidebarHtml';
import type { SheetPanels } from './sheetPanels';
import type { Catalog } from './types';

const MEDIA_DIR = 'media';
const SETTINGS_QUERY = '@ext:BozNtouranLabs.snipsheet';

interface SheetPickItem extends vscode.QuickPickItem {
  readonly sheet: SheetState;
}

export class SidebarViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private listeners: vscode.Disposable[] = [];
  private mode: SidebarMode = 'browse';
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly catalog: Catalog,
    private readonly panels: SheetPanels,
    private readonly output: vscode.OutputChannel,
    private readonly startupError: string | null,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.disposeListeners();
    this.view = view;

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, MEDIA_DIR)],
    };
    view.webview.html = this.render(view.webview);

    this.listeners.push(
      view.webview.onDidReceiveMessage((raw: unknown) => {
        void this.handleMessage(raw);
      }),
      view.onDidDispose(() => {
        this.disposeListeners();
        this.view = undefined;
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
          this.postState();
        }
      }),
    );
  }

  async focus(): Promise<void> {
    // Try the container and the view command independently: if one id changes
    // in a future VS Code release, the other can still reveal the sidebar.
    for (const command of ['workbench.view.extension.snipsheet', 'snipsheet.main.focus']) {
      try {
        await vscode.commands.executeCommand(command);
      } catch (error) {
        this.output.appendLine(`SnipSheet: ${command} failed: ${String(error)}`);
      }
    }
  }

  async showOptions(): Promise<void> {
    this.mode = 'options';
    await this.focus();
    this.postState();
  }

  async pickSheet(): Promise<void> {
    const sheets = visibleSheetStates(this.currentState());
    if (sheets.length === 0) {
      void vscode.window.showInformationMessage(
        'SnipSheet has no visible cheat sheets. Open Options to unhide some.',
      );
      return;
    }

    const items: SheetPickItem[] = sheets.map((sheet) => ({
      label: sheet.title,
      description: sheet.groupTitle,
      detail: sheet.description,
      sheet,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Open a cheat sheet',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (picked) {
      await this.panels.openById(picked.sheet.id);
    }
  }

  async resetVisibilityCommand(): Promise<void> {
    try {
      await this.run(() => this.resetVisibility());
      void vscode.window.showInformationMessage('SnipSheet visibility reset.');
    } catch (error) {
      this.reportError(error);
    }
  }

  dispose(): void {
    this.disposeListeners();
    this.view = undefined;
  }

  private render(webview: vscode.Webview): string {
    return renderSidebarHtml({
      nonce: randomBytes(16).toString('base64'),
      cspSource: webview.cspSource,
      styleUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, MEDIA_DIR, 'sidebar.css'))
        .toString(),
      scriptUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, MEDIA_DIR, 'webview.js'))
        .toString(),
      state: this.currentState(),
    });
  }

  private currentState(): SidebarState {
    return buildSidebarState(
      this.catalog,
      this.readSettings(),
      this.mode,
      this.startupError,
    );
  }

  private readSettings(): SnipSheetSettings {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return sanitizeSettings(
      {
        favorites: config.get<unknown>(FAVORITES_KEY, []),
        hiddenGroups: config.get<unknown>(HIDDEN_GROUPS_KEY, []),
        hiddenSheets: config.get<unknown>(HIDDEN_SHEETS_KEY, []),
        showFavorites: config.get<unknown>(SHOW_FAVORITES_KEY, true),
      },
      this.catalog,
    );
  }

  private postState(): void {
    const view = this.view;
    if (!view) {
      return;
    }
    const message: HostMessage = { type: 'state', state: this.currentState() };
    void view.webview.postMessage(message);
  }

  private async handleMessage(raw: unknown): Promise<void> {
    const request = parseWebviewRequest(raw, this.catalog);
    if (!request) {
      this.output.appendLine('SnipSheet: ignored an invalid sidebar message.');
      return;
    }

    switch (request.type) {
      case 'ready':
        this.postState();
        return;

      case 'setMode':
        this.mode = request.mode;
        this.postState();
        return;

      case 'toggleFavorite':
        void this.run(() => this.setMembership(FAVORITES_KEY, request.sheetId, request.favorite));
        return;

      case 'setGroupHidden':
        void this.run(() => this.setMembership(HIDDEN_GROUPS_KEY, request.groupId, request.hidden));
        return;

      case 'setSheetHidden':
        void this.run(() => this.setMembership(HIDDEN_SHEETS_KEY, request.sheetId, request.hidden));
        return;

      case 'setShowFavorites':
        void this.run(() =>
          this.updateConfig(SHOW_FAVORITES_KEY, request.showFavorites),
        );
        return;

      case 'resetVisibility':
        void this.run(() => this.resetVisibility());
        return;

      case 'openSettings':
        void this.openSettings();
        return;

      case 'openSheet':
        void this.panels.openById(request.sheetId);
        return;
    }
  }

  private run(task: () => Promise<void>): Promise<void> {
    const next = this.queue.then(task);
    this.queue = next.catch((error: unknown) => {
      this.reportError(error);
      this.postState();
    });
    return next;
  }

  private async setMembership(key: string, id: string, present: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const current = config.get<unknown>(key, []);
    const list = Array.isArray(current)
      ? current.filter((item): item is string => typeof item === 'string')
      : [];
    await config.update(key, withMembership(list, id, present), vscode.ConfigurationTarget.Global);
  }

  private async resetVisibility(): Promise<void> {
    await this.updateConfig(HIDDEN_GROUPS_KEY, []);
    await this.updateConfig(HIDDEN_SHEETS_KEY, []);
  }

  private async updateConfig(key: string, value: unknown): Promise<void> {
    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update(key, value, vscode.ConfigurationTarget.Global);
  }

  private async openSettings(): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.action.openSettings', SETTINGS_QUERY);
    } catch (error) {
      this.reportError(error);
    }
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.output.appendLine(`SnipSheet: ${message}`);
    void vscode.window.showErrorMessage(`SnipSheet: ${message}`);
  }

  private disposeListeners(): void {
    for (const listener of this.listeners) {
      listener.dispose();
    }
    this.listeners = [];
  }
}
