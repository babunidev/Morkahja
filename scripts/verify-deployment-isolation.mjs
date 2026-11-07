import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(code) { throw new Error(code); }
function inside(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}
function overlaps(a, b) { return inside(a, b) || inside(b, a); }
function requiredDirectory(value, code) {
  if (typeof value !== 'string' || !value || !isAbsolute(value)) fail(code);
  let stat;
  try { stat = lstatSync(value); } catch { return fail(code); }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail(code);
  return realpathSync(value);
}
export function loadEnvironment(root = repositoryRoot, base = process.env) {
  const result = {};
  const envPath = resolve(root, '.env');
  if (existsSync(envPath)) {
    const stat = lstatSync(envPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('DEPLOY_ENV_FILE_UNSAFE');
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const valueLine = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
      const separator = valueLine.indexOf('=');
      if (separator <= 0) continue;
      const key = valueLine.slice(0, separator).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let value = valueLine.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      result[key] = value;
    }
  }
  return { ...result, ...base };
}
export function verifyDeploymentIsolation({
  repoRoot = repositoryRoot,
  contentRoot,
  webRoot,
  backupRoot,
}) {
  const repository = realpathSync(repoRoot);
  const content = requiredDirectory(contentRoot, 'DEPLOY_CONTENT_ROOT_REQUIRED');
  const web = requiredDirectory(webRoot, 'DEPLOY_WEB_ROOT_REQUIRED');
  const backup = requiredDirectory(backupRoot, 'DEPLOY_BACKUP_ROOT_REQUIRED');

  if (overlaps(content, repository)) fail('DEPLOY_CONTENT_ROOT_OVERLAPS_APPLICATION');
  if (overlaps(web, repository)) fail('DEPLOY_WEB_ROOT_OVERLAPS_APPLICATION');
  if (overlaps(backup, repository)) fail('DEPLOY_BACKUP_ROOT_OVERLAPS_APPLICATION');
  if (overlaps(content, web)) fail('DEPLOY_CONTENT_ROOT_OVERLAPS_WEB_ROOT');
  if (overlaps(content, backup)) fail('DEPLOY_BACKUP_ROOT_OVERLAPS_CONTENT_ROOT');
  if (overlaps(web, backup)) fail('DEPLOY_BACKUP_ROOT_OVERLAPS_WEB_ROOT');

  return { repository, content, web, backup };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const env = loadEnvironment();
    const paths = verifyDeploymentIsolation({
      contentRoot: env.MORKAHJA_CONTENT_ROOT,
      webRoot: env.MORKAHJA_DEPLOY_WEB_ROOT,
      backupRoot: env.MORKAHJA_CONTENT_BACKUP_ROOT,
    });
    process.stdout.write(
      'Deployment paths are isolated.\n' +
      'Application checkout, published content, static web root and backup root do not overlap.\n' +
      'Off-host backup location must be independently confirmed by the operator.\n',
    );
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'DEPLOY_PREFLIGHT_FAILED') + '\n');
    process.exitCode = 1;
  }
}
