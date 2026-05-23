function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    (trimmed.startsWith('<') && trimmed.includes('</'))
  );
}

function tryParseJsonError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as unknown;

    if (!parsed || typeof parsed !== 'object' || !('error' in parsed)) {
      return null;
    }

    const error = (parsed as { error: unknown }).error;
    return typeof error === 'string' && error.trim() ? error.trim() : null;
  } catch {
    return null;
  }
}

/** Turn fetch failure bodies into short, player-facing copy (never raw nginx HTML). */
export function formatHttpErrorMessage(
  status: number,
  statusText: string,
  body: string,
): string {
  const jsonError = tryParseJsonError(body);
  if (jsonError) {
    return jsonError;
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'The game server is temporarily unavailable. Please try again in a moment.';
  }

  if (status >= 500) {
    return 'Something went wrong on the server. Please try again.';
  }

  if (looksLikeHtml(body)) {
    return `Request failed (${status} ${statusText}).`;
  }

  const trimmed = body.trim();
  if (trimmed.length > 0 && trimmed.length <= 200) {
    return trimmed;
  }

  return `Request failed (${status} ${statusText}).`;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string, body: string) {
    super(formatHttpErrorMessage(status, statusText, body));
    this.name = 'ApiRequestError';
    this.status = status;
  }
}
