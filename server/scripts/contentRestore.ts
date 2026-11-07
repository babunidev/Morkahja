import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { restoreContentBackup } from './contentBackup.js';
import { loadEnvironment } from '../../scripts/verify-deployment-isolation.mjs';

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    Object.assign(process.env, loadEnvironment());
    const args = process.argv.slice(2);
    const backup = option(args, '--backup');
    const destination = option(args, '--destination');
    if (!backup || !isAbsolute(backup)) throw new Error('CONTENT_BACKUP_PATH_MUST_BE_ABSOLUTE');
    if (!destination || !isAbsolute(destination)) throw new Error('CONTENT_RESTORE_DESTINATION_MUST_BE_ABSOLUTE');
    if (!args.includes('--create-new-root')) throw new Error('CONTENT_RESTORE_NEW_ROOT_CONFIRMATION_REQUIRED');
    if (!process.env.MORKAHJA_DEPLOY_WEB_ROOT) throw new Error('MORKAHJA_DEPLOY_WEB_ROOT_REQUIRED');
    const restored = restoreContentBackup(backup, destination);
    process.stdout.write(
      'Restored and verified content root: ' + restored.destination +
      '\nRevision: ' + restored.revision + '\n',
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CONTENT_RESTORE_FAILED';
    process.stderr.write(code + '\n');
    process.exitCode = 1;
  }
}
