import type { Catalog, GroupDefinition, SheetDefinition } from './types';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/;
const TEMPLATE_FILE = 'cheatsheet-template.html';
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_KEYWORDS = 40;
const MAX_KEYWORD_LENGTH = 80;

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new CatalogError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new CatalogError(`${field} must not be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new CatalogError(`${field} must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

function readId(value: unknown, field: string): string {
  const id = readString(value, field, 64);
  if (!ID_PATTERN.test(id)) {
    throw new CatalogError(`${field} must match ${ID_PATTERN}.`);
  }
  return id;
}

function readKeywords(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new CatalogError(`${field} must be an array of strings.`);
  }
  if (value.length > MAX_KEYWORDS) {
    throw new CatalogError(`${field} must contain at most ${MAX_KEYWORDS} keywords.`);
  }
  const keywords: string[] = [];
  for (const [index, item] of value.entries()) {
    const keyword = readString(item, `${field}[${index}]`, MAX_KEYWORD_LENGTH).toLowerCase();
    if (!keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  return keywords;
}

function parseGroup(value: unknown, index: number): GroupDefinition {
  if (!isRecord(value)) {
    throw new CatalogError(`groups[${index}] must be an object.`);
  }
  return {
    id: readId(value.id, `groups[${index}].id`),
    title: readString(value.title, `groups[${index}].title`, MAX_TITLE_LENGTH),
    description: readString(value.description, `groups[${index}].description`, MAX_DESCRIPTION_LENGTH),
  };
}

function parseSheet(value: unknown, index: number, groupIds: ReadonlySet<string>): SheetDefinition {
  if (!isRecord(value)) {
    throw new CatalogError(`sheets[${index}] must be an object.`);
  }

  const file = readString(value.file, `sheets[${index}].file`, 160);
  if (!FILE_PATTERN.test(file) || file === TEMPLATE_FILE) {
    throw new CatalogError(
      `sheets[${index}].file must be a direct .html file name other than ${TEMPLATE_FILE}.`,
    );
  }

  const group = readId(value.group, `sheets[${index}].group`);
  if (!groupIds.has(group)) {
    throw new CatalogError(`sheets[${index}].group refers to unknown group "${group}".`);
  }

  return {
    id: readId(value.id, `sheets[${index}].id`),
    title: readString(value.title, `sheets[${index}].title`, MAX_TITLE_LENGTH),
    file,
    group,
    description: readString(value.description, `sheets[${index}].description`, MAX_DESCRIPTION_LENGTH),
    keywords: readKeywords(value.keywords, `sheets[${index}].keywords`),
  };
}

/**
 * Validates the on-disk manifest before any of it is used to build a path or
 * render content. The file name pattern is deliberately narrow: sheets live
 * directly in `cheatsheets/`, so separators, `..`, and absolute paths are
 * rejected here rather than trusted later.
 */
export function parseCatalog(value: unknown): Catalog {
  if (!isRecord(value)) {
    throw new CatalogError('Manifest must be a JSON object.');
  }
  if (value.schemaVersion !== 1) {
    throw new CatalogError('Manifest schemaVersion must be 1.');
  }
  if (!Array.isArray(value.groups) || value.groups.length === 0) {
    throw new CatalogError('Manifest must define at least one group.');
  }
  if (!Array.isArray(value.sheets) || value.sheets.length === 0) {
    throw new CatalogError('Manifest must define at least one sheet.');
  }

  const groups: GroupDefinition[] = [];
  const groupIds = new Set<string>();
  for (const [index, rawGroup] of value.groups.entries()) {
    const group = parseGroup(rawGroup, index);
    if (groupIds.has(group.id)) {
      throw new CatalogError(`Duplicate group id "${group.id}".`);
    }
    groupIds.add(group.id);
    groups.push(group);
  }

  const sheets: SheetDefinition[] = [];
  const sheetIds = new Set<string>();
  const files = new Set<string>();
  for (const [index, rawSheet] of value.sheets.entries()) {
    const sheet = parseSheet(rawSheet, index, groupIds);
    if (sheetIds.has(sheet.id)) {
      throw new CatalogError(`Duplicate sheet id "${sheet.id}".`);
    }
    if (files.has(sheet.file)) {
      throw new CatalogError(`Duplicate sheet file "${sheet.file}".`);
    }
    sheetIds.add(sheet.id);
    files.add(sheet.file);
    sheets.push(sheet);
  }

  return { groups, sheets };
}

export function findGroup(catalog: Catalog, groupId: string): GroupDefinition | undefined {
  return catalog.groups.find((group) => group.id === groupId);
}

export function findSheet(catalog: Catalog, sheetId: string): SheetDefinition | undefined {
  return catalog.sheets.find((sheet) => sheet.id === sheetId);
}
