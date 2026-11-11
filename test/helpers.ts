import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalog } from '../src/catalog';
import type { Catalog, SheetDefinition } from '../src/types';

export const repoRoot = fileURLToPath(new URL('..', import.meta.url));
export const cheatsheetsDir = join(repoRoot, 'cheatsheets');

export function readManifestText(): string {
  return readFileSync(join(cheatsheetsDir, 'manifest.json'), 'utf8');
}

export function loadCatalogFixture(): Catalog {
  return parseCatalog(JSON.parse(readManifestText()));
}

export function sheetFiles(): string[] {
  return readdirSync(cheatsheetsDir)
    .filter((file) => file.endsWith('.html'))
    .sort();
}

export function readSheet(file: string): string {
  return readFileSync(join(cheatsheetsDir, file), 'utf8');
}

export function sheetByFile(catalog: Catalog, file: string): SheetDefinition {
  const sheet = catalog.sheets.find((candidate) => candidate.file === file);
  if (!sheet) {
    throw new Error(`No manifest entry for ${file}.`);
  }
  return sheet;
}

export type RawManifest = {
  schemaVersion: number;
  groups: Array<Record<string, unknown>>;
  sheets: Array<Record<string, unknown>>;
};

export function rawManifest(): RawManifest {
  return JSON.parse(readManifestText()) as RawManifest;
}

export function cloneManifest(): RawManifest {
  return JSON.parse(readManifestText()) as RawManifest;
}
