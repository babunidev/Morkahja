import assert from 'node:assert/strict';

import {
  formatErrorResponse,
  isClientSafeError,
  isProduction,
  resolveClientErrorMessage,
  resolveHttpErrorStatus,
} from './errorResponse.js';
import { LoreGemError } from '../services/loreGemService.js';
import { SessionError } from '../services/sessionService.js';

const originalNodeEnv = process.env.NODE_ENV;

function withNodeEnv(value: string | undefined, run: () => void): void {
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }

  try {
    run();
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
}

withNodeEnv('production', () => {
  assert.equal(isProduction(), true);

  assert.equal(
    resolveClientErrorMessage(new Error('relation "players" does not exist'), 500),
    'Internal server error',
  );

  assert.equal(
    resolveClientErrorMessage(new Error('secret validation detail'), 400),
    'Bad request',
  );

  assert.equal(
    resolveClientErrorMessage(new LoreGemError('Lore gem is not ready to collect yet', 409), 409),
    'Lore gem is not ready to collect yet',
  );

  assert.equal(
    resolveClientErrorMessage(new SessionError('SESSION_INVALID'), 401),
    'SESSION_INVALID',
  );

  assert.deepEqual(
    formatErrorResponse(new Error('password authentication failed'), 500),
    { error: 'Internal server error' },
  );
});

withNodeEnv('development', () => {
  assert.equal(
    resolveClientErrorMessage(new Error('password authentication failed'), 500),
    'password authentication failed',
  );
});

assert.equal(resolveHttpErrorStatus(new SessionError()), 401);
assert.equal(isClientSafeError(new LoreGemError('test')), true);
assert.equal(isClientSafeError(new Error('password authentication failed')), false);

console.log('errorResponse.test.ts passed');
