import * as vscode from 'vscode';
import { loadCatalog } from './catalogLoader';
import { SheetPanels } from './sheetPanels';
import { SidebarViewProvider } from './sidebarView';
import type { Catalog } from './types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('SnipSheet');
  context.subscriptions.push(output);

  let catalog: Catalog = { groups: [], sheets: [] };
  let startupError: string | null = null;
  try {
    catalog = await loadCatalog(context.extensionUri);
  } catch (error) {
    startupError = 'The bundled cheat sheet manifest could not be loaded.';
    output.appendLine(`SnipSheet: ${String(error)}`);
    void vscode.window.showErrorMessage(`SnipSheet: ${startupError}`);
  }

  const panels = new SheetPanels(context, catalog, output);
  const provider = new SidebarViewProvider(context, catalog, panels, output, startupError);
  context.subscriptions.push(panels, provider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('snipsheet.main', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('snipsheet.focus', () => provider.focus()),
    vscode.commands.registerCommand('snipsheet.openOptions', () => provider.showOptions()),
    vscode.commands.registerCommand('snipsheet.openSheet', () => provider.pickSheet()),
    vscode.commands.registerCommand('snipsheet.resetVisibility', () =>
      provider.resetVisibilityCommand(),
    ),
  );
}

export function deactivate(): void {
  // All resources are owned by context.subscriptions.
}
