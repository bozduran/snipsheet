export type SheetMessage =
  | { readonly type: 'copy'; readonly text: string }
  | { readonly type: 'openExternal'; readonly url: string };

export const MAX_COPY_LENGTH = 200_000;
const MAX_URL_LENGTH = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Only two actions are accepted from a sheet webview: copy text and open an
 * https URL after a user click. No command execution, no arbitrary URIs.
 */
export function parseSheetMessage(raw: unknown): SheetMessage | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return null;
  }

  if (raw.type === 'copy') {
    return typeof raw.text === 'string' && raw.text.length <= MAX_COPY_LENGTH
      ? { type: 'copy', text: raw.text }
      : null;
  }

  if (raw.type === 'openExternal') {
    if (typeof raw.url !== 'string' || raw.url.length > MAX_URL_LENGTH) {
      return null;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw.url);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
      return null;
    }
    return { type: 'openExternal', url: parsed.toString() };
  }

  return null;
}
