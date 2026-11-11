export interface GroupDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface SheetDefinition {
  readonly id: string;
  readonly title: string;
  readonly file: string;
  readonly group: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

export interface Catalog {
  readonly groups: readonly GroupDefinition[];
  readonly sheets: readonly SheetDefinition[];
}
