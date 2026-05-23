import type { Request } from 'express';

import { encounterControllerErrorStatus } from '../controllers/encounterController.js';
import { EncounterConflictError } from '../services/encounterPersistence.js';
import { SessionError } from '../services/sessionService.js';

export type ClientErrorBody = {
  error: string;
};

const GENERIC_CLIENT_MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  500: 'Internal server error',
};

const ENCOUNTER_CLIENT_MESSAGES = new Set([
  'Encounter already resolving',
  'Encounter already resolved',
  'Encounter snapshot mismatch',
]);

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readStatusCode(error: unknown): number | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const statusCode = (error as Error & { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

function hasClientStatusCode(
  error: unknown,
): error is Error & { statusCode: number } {
  const statusCode = readStatusCode(error);
  return statusCode !== undefined && statusCode >= 400 && statusCode < 600;
}

/** True when the error message is safe to return to clients in production. */
export function isClientSafeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof SessionError || error instanceof EncounterConflictError) {
    return true;
  }

  if (hasClientStatusCode(error) && error.statusCode < 500) {
    return true;
  }

  return ENCOUNTER_CLIENT_MESSAGES.has(error.message);
}

export function resolveHttpErrorStatus(error: unknown): number {
  if (error instanceof SessionError) {
    return error.statusCode;
  }

  return encounterControllerErrorStatus(error);
}

function genericClientMessage(status: number): string {
  return GENERIC_CLIENT_MESSAGES[status] ?? GENERIC_CLIENT_MESSAGES[500];
}

export function resolveClientErrorMessage(error: unknown, status: number): string {
  if (!isProduction()) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return genericClientMessage(status);
  }

  if (status >= 500) {
    return genericClientMessage(500);
  }

  if (isClientSafeError(error) && error instanceof Error && error.message) {
    return error.message;
  }

  return genericClientMessage(status);
}

export function formatErrorResponse(error: unknown, status: number): ClientErrorBody {
  return { error: resolveClientErrorMessage(error, status) };
}

export function logServerError(
  error: unknown,
  context?: { method?: string; path?: string; status?: number },
): void {
  const prefix = context?.method && context?.path
    ? `[${context.method} ${context.path}${context.status ? ` ${context.status}` : ''}] `
    : '';

  console.error(`${prefix}Request failed`, error);

  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
}

export function logAndFormatRequestError(
  error: unknown,
  req: Pick<Request, 'method' | 'path'>,
): { status: number; body: ClientErrorBody } {
  const status = resolveHttpErrorStatus(error);
  logServerError(error, { method: req.method, path: req.path, status });
  return { status, body: formatErrorResponse(error, status) };
}
