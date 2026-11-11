import * as vscode from 'vscode';
import { CatalogError, parseCatalog } from './catalog';
import type { Catalog } from './types';

export async function loadCatalog(extensionUri: vscode.Uri): Promise<Catalog> {
  const manifestUri = vscode.Uri.joinPath(extensionUri, 'cheatsheets', 'manifest.json');
  const bytes = await vscode.workspace.fs.readFile(manifestUri);

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    throw new CatalogError('cheatsheets/manifest.json is not valid JSON.');
  }

  return parseCatalog(raw);
}
