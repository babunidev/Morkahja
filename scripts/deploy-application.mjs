import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnvironment, repositoryRoot, verifyDeploymentIsolation } from './verify-deployment-isolation.mjs';

function run(command, args, cwd, env) {
  process.stdout.write('\n$ ' + command + ' ' + args.join(' ') + '\n');
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
}
function output(command, args, cwd, env) {
  return execFileSync(command, args, { cwd, env, encoding: 'utf8' }).trim();
}
function requireCommand(command) {
  try { execFileSync(command, ['--version'], { stdio: 'ignore' }); }
  catch { throw new Error('DEPLOY_COMMAND_REQUIRED_' + command.toUpperCase()); }
}
export function deployApplication(env = loadEnvironment()) {
  const paths = verifyDeploymentIsolation({
    repoRoot: repositoryRoot,
    contentRoot: env.MORKAHJA_CONTENT_ROOT,
    webRoot: env.MORKAHJA_DEPLOY_WEB_ROOT,
    backupRoot: env.MORKAHJA_CONTENT_BACKUP_ROOT,
    requireBackupMount: true,
  });
  if (env.MORKAHJA_BACKUP_OFF_HOST_CONFIRMED !== '1') {
    throw new Error('DEPLOY_OFF_HOST_BACKUP_CONFIRMATION_REQUIRED');
  }
  const branch = env.MORKAHJA_DEPLOY_BRANCH || 'main';
  const currentBranch = output('git', ['branch', '--show-current'], repositoryRoot, env);
  if (!currentBranch || currentBranch !== branch) throw new Error('DEPLOY_WRONG_BRANCH');
  if (output('git', ['status', '--porcelain'], repositoryRoot, env)) throw new Error('DEPLOY_WORKTREE_NOT_CLEAN');

  for (const command of ['git', 'npm', 'rsync', 'pm2']) requireCommand(command);

  // Capture the current published world before application files or dependencies change.
  run('npm', [
    'run', 'content:backup', '--', '--destination', paths.backup, '--confirm-off-host',
  ], repositoryRoot, env);

  // The preflight above runs before Git can update or replace any application files.
  run('git', ['pull', '--ff-only', 'origin', branch], repositoryRoot, env);
  const refreshed = verifyDeploymentIsolation({
    repoRoot: repositoryRoot,
    contentRoot: env.MORKAHJA_CONTENT_ROOT,
    webRoot: env.MORKAHJA_DEPLOY_WEB_ROOT,
    backupRoot: env.MORKAHJA_CONTENT_BACKUP_ROOT,
    requireBackupMount: true,
  });
  run('npm', ['ci'], repositoryRoot, env);

  run('npm', ['run', 'verify:static-data'], repositoryRoot, env);
  for (const script of [
    'test:content-publication',
    'test:content-runtime',
    'test:content-admin',
    'test:content-artwork',
    'test:client-content',
    'test:content-gameplay',
    'test:content-backup',
  ]) run('npm', ['run', script], repositoryRoot, env);
  run('npm', ['run', 'build', '--prefix', 'client'], repositoryRoot, env);
  // Includes the complete project release checks and server/client typecheck.
  run('npm', ['run', 'release:check'], repositoryRoot, env);

  const builtClient = resolve(repositoryRoot, 'client', 'dist');
  if (!existsSync(builtClient)) throw new Error('DEPLOY_CLIENT_BUILD_MISSING');
  // This is the only --delete destination: a dedicated static web root, never the content store.
  run('rsync', [
    '--archive', '--delete-delay', '--exclude=/.well-known/',
    builtClient + '/', refreshed.web + '/',
  ], repositoryRoot, env);
  run('pm2', ['startOrReload', 'ecosystem.config.cjs', '--update-env'], repositoryRoot, env);
  process.stdout.write('\nApplication deployment completed. Published content was not modified.\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { deployApplication(); }
  catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'DEPLOYMENT_FAILED') + '\n');
    process.exitCode = 1;
  }
}
