import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';

import { requireAdminAuth } from './adminAuthMiddleware.js';

function run(authorization: string | undefined): { status: number | null; passed: boolean } {
  let status: number | null = null;
  let passed = false;
  const req = { headers: authorization === undefined ? {} : { authorization } } as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json() { return this; },
  } as unknown as Response;
  requireAdminAuth(req, res, (() => { passed = true; }) as NextFunction);
  return { status, passed };
}

const previous = process.env.ADMIN_API_KEY;
delete process.env.ADMIN_API_KEY;
assert.deepEqual(run('Bearer anything'), { status: 503, passed: false });

process.env.ADMIN_API_KEY = 'correct-admin-key';
assert.deepEqual(run('Bearer correct-admin-key'), { status: null, passed: true });
assert.deepEqual(run('Bearer correct-admin-kez'), { status: 401, passed: false });
assert.deepEqual(run('Bearer correct'), { status: 401, passed: false });
assert.deepEqual(run('Bearer '), { status: 401, passed: false });
assert.deepEqual(run('correct-admin-key'), { status: 401, passed: false });
assert.deepEqual(run(undefined), { status: 401, passed: false });

if (previous === undefined) {
  delete process.env.ADMIN_API_KEY;
} else {
  process.env.ADMIN_API_KEY = previous;
}
console.log('adminAuthMiddleware.test.ts passed');
