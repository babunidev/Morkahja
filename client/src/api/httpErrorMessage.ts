export function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    (trimmed.startsWith('<') && trimmed.includes('</'))
  );
}

const ROOM_ERROR_MESSAGES: Record<string, string> = {
  ROOM_FULL: 'This room is already full.',
  ALREADY_IN_ROOM: 'You are already in another room.',
  ROOM_NOT_FOUND: 'That room is no longer available.',
  FRIEND_NOT_IN_ROOM: 'Your friend is no longer in a room.',
  ROOM_NOT_JOINABLE: 'You cannot join this room right now.',
  INVITE_EXPIRED: 'That invitation has expired.',
  INVALID_ROOM_STATE: 'This encounter isn\u2019t ready to continue yet.',
  CHOICE_LOCKED: 'That choice was already locked in \u2014 refresh or rejoin the room.',
};

function tryParseJsonError(body: string): { code?: string; message: string } | null {
  try {
    const parsed = JSON.parse(body) as unknown;

    if (!parsed || typeof parsed !== 'object' || !('error' in parsed)) {
      return null;
    }

    const error = (parsed as { error: unknown }).error;
    if (typeof error !== 'string' || !error.trim()) {
      return null;
    }

    const trimmed = error.trim();
    const explicitCode = 'code' in parsed && typeof (parsed as { code: unknown }).code === 'string'
      ? (parsed as { code: string }).code.trim()
      : undefined;
    const lookupCode = explicitCode ?? trimmed;
    const knownMessage = ROOM_ERROR_MESSAGES[lookupCode];
    if (knownMessage) {
      return { code: lookupCode, message: knownMessage };
    }

    return { code: explicitCode, message: trimmed };
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
    return jsonError.message;
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
  readonly code?: string;

  constructor(status: number, statusText: string, body: string) {
    const parsed = tryParseJsonError(body);
    super(parsed?.message ?? formatHttpErrorMessage(status, statusText, body));
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = parsed?.code;
  }
}

export function isApiErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiRequestError && error.code === code;
}

export function userFacingApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
