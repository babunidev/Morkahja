import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const keyPath = path.join(repoRoot, 'Key.js');
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && existsSync(keyPath)) {
  throw new Error('Key.js must not exist in production. Use DATABASE_URL from environment.');
}

if (!isProduction && !process.env.DATABASE_URL?.trim() && existsSync(keyPath)) {
  const keyModule = await import(pathToFileURL(keyPath).href);
  const url =
    typeof keyModule.buildDatabaseUrl === 'function'
      ? keyModule.buildDatabaseUrl(keyModule.pgConnection)
      : undefined;

  if (typeof url === 'string' && url.length > 0) {
    process.env.DATABASE_URL = url;
  }
}
