import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const keyPath = path.join(repoRoot, 'Key.js');

if (!process.env.DATABASE_URL?.trim() && existsSync(keyPath)) {
  const keyModule = await import(pathToFileURL(keyPath).href);
  const url =
    typeof keyModule.buildDatabaseUrl === 'function'
      ? keyModule.buildDatabaseUrl(keyModule.pgConnection)
      : undefined;

  if (typeof url === 'string' && url.length > 0) {
    process.env.DATABASE_URL = url;
  }
}
