# Morkahja — Phase 8 deployment and recovery

**Status:** Implementation review in draft PR #16, stacked on draft PRs #10–15. The repository now contains deployment path guards, an application-only deployment runner, a versioned content backup/verification/restore utility and an Nginx media proxy snippet. [GitHub Actions run 42341790066](https://github.com/babunidev/Morkahja/actions/runs/42341959400) passed all **38/38 focused content and deployment tests**, including 4/4 backup/restore and 4/4 deployment-isolation tests; static-data verification and the standalone frontend build also passed. The complete release gate still fails on eight pre-existing TypeScript errors in three unrelated server test files. No production host, Nginx service, PM2 process, content root, backup mount or live player data was changed.

## Deployment boundaries

Morkahja has three deliberately separate filesystem locations:

| Location | Purpose | May application deployment delete it? |
| --- | --- | --- |
| Git checkout / application root | Server source, dependencies and scripts | Yes, through normal Git/npm operations |
| Static web root | Built client/dist files only | Yes, through the scoped rsync --delete-delay |
| MORKAHJA_CONTENT_ROOT | Published JSON revisions, immutable artwork objects and private admin audit | **Never** |

A fourth location, MORKAHJA_CONTENT_BACKUP_ROOT, is a separately mounted off-host backup destination. It must not be a directory on the production server's application or content filesystem. The scripts can check path separation but cannot prove the physical host identity of a mount; the operator must confirm the remote/off-host storage.

The proposed /var/lib/morkahja/content path is an example, not a verified production directory. deploy/morkahja.env.example shows the two content-related application variables. The content root must be provisioned explicitly, owned by the API service account, and outside both the Git checkout and public web root. Do not symlink the root. The publishing feature flag stays 0 until the complete migration and release gates are approved.

The existing ecosystem.config.cjs runs the API through PM2 and loads the private repository-root .env. No live PM2 or Nginx configuration was fetched or changed. There is no tracked production Nginx site configuration in this repository; the supplied snippet is a reviewable include, not evidence of a live proxy change.

## Application-only deployment

Root scripts:

- npm run deploy:preflight checks that the content root, static web root and backup root exist, are real directories, do not overlap one another or the Git checkout, and that the backup root itself is a mounted filesystem.
- npm run deploy:application runs the guarded deployment workflow.

The deployment runner:
1. Loads the private .env using the same simple key/value convention as the PM2 ecosystem file, with explicitly exported environment variables taking precedence.
2. Requires a clean Git working tree and the configured deployment branch (MORKAHJA_DEPLOY_BRANCH, default main).
3. Checks all path boundaries **before** any Git update.
4. Requires the operator's MORKAHJA_BACKUP_OFF_HOST_CONFIRMED=1 acknowledgement and creates a verified content backup on the configured backup mount.
5. Runs git pull --ff-only, then rechecks path isolation.
6. Runs npm ci, static-data verification, all focused content/client/gameplay/backup tests, the standalone client build and the full npm run release:check gate.
7. Reloads the PM2 application with pm2 startOrReload ecosystem.config.cjs --update-env, then retries the local /health endpoint with curl before changing the static site.
8. Uses rsync --archive --delete-delay only from client/dist/ to the dedicated MORKAHJA_DEPLOY_WEB_ROOT, preserving /.well-known/.

The runner requires Git, npm, rsync, PM2, curl and the Linux mountpoint utility. It never calls a content administration endpoint, changes current.json, edits a published revision, uploads artwork or runs a content rollback. A failed release check stops before the web-root sync and PM2 reload. Git and dependency changes already made earlier in the sequence are not automatically reverted; the published content remains in its independent root.

The preflight deliberately refuses overlapping paths. In particular, rsync --delete-delay must never target the Git checkout, content root, artwork objects, revision directories or backup mount. The content root is also rejected if it is nested under, or contains, the application checkout. This makes normal Git pulls and frontend builds unable to remove published data by path.

Example operator environment (paths must be adapted to the real host):

    export MORKAHJA_CONTENT_ROOT=/var/lib/morkahja/content
    export MORKAHJA_DEPLOY_WEB_ROOT=/var/www/morkahja
    export MORKAHJA_CONTENT_BACKUP_ROOT=/mnt/off-host-backups
    export MORKAHJA_BACKUP_OFF_HOST_CONFIRMED=1
    export MORKAHJA_DEPLOY_BRANCH=main

After provisioning the directories and exporting those variables, run:

    npm run deploy:preflight
    npm run content:backup -- --destination "$MORKAHJA_CONTENT_BACKUP_ROOT" --confirm-off-host
    npm run deploy:application

The backup command is intentionally explicit. The backup destination must be the exact mounted filesystem root and writable. Both the backup CLI and deployment preflight call mountpoint -q; if the mount is absent, an ordinary directory at that path is rejected rather than used as a local fallback.

## Nginx delivery for managed artwork

Include deploy/nginx/content-media-location.conf **inside the existing HTTPS server block**. It proxies /game-data/media/ to the Express API on 127.0.0.1:3000, preserving the original request URI. It does not expose the private content directory with root or alias.

The API's media route validates the requested revision against its manifest and returns only the content-addressed WebP object referenced there. It sets Content-Type: image/webp, a SHA-256 ETag and Cache-Control: public, max-age=31536000, immutable. The include also gives the exact authenticated /game-data/admin/content/assets/stage upload route a 4 MiB Nginx request limit, matching the server-side WebP cap without raising limits for other API routes. The Nginx include deliberately leaves those response headers intact and disables proxy cache by default. A revision replacement creates a different URL; old revision URLs continue to resolve while their immutable objects are retained.

Keep the existing static /game/ route for legacy bundled artwork. Do not point it at the private content root. Do not apply a blanket expires or Cache-Control override to the managed media location. The current public content bundle /game-data/content must continue to revalidate rather than receive a year-long immutable cache header.

Host integration remains a manual deployment task:
1. Review the actual site's existing /game-data/ proxy and place the more-specific media location in the correct HTTPS server block.
2. Run nginx -t against the real host configuration.
3. Reload Nginx only after the syntax test passes.
4. Request a current managed image URL and an old revision URL over HTTPS; verify 200, WebP content type, ETag and immutable cache headers. Confirm unknown revisions/names do not expose filesystem paths.

The repository does not include a production Nginx site configuration, and no production-host access was available to run nginx -t or request a live image. These host checks remain unverified.

## Versioned content backups

The commands are:

    npm run content:backup -- --destination /absolute/off-host/mount --confirm-off-host
    npm run content:restore -- --backup /absolute/off-host/mount/BACKUP_DIRECTORY --destination /var/lib/morkahja/content-restored-YYYYMMDD --create-new-root

The backup utility requires MORKAHJA_CONTENT_ROOT to be set in the environment. It requires an existing absolute destination that is itself a mountpoint, plus an explicit off-host confirmation. It acquires the same exclusive .publication.lock used by publishing, so a publication cannot change the current pointer while the snapshot is assembled. If the lock is already held, backup fails rather than racing a publication.

Each versioned directory contains:
- backup.json, a format-versioned inventory of every included file, byte length and SHA-256 digest;
- current.json, identifying the selected revision;
- every complete immutable revision directory, including the five JSON files and its manifest;
- every content-addressed artwork object referenced by any retained revision;
- admin-audit.jsonl, when present.

The backup intentionally excludes transient .publication.lock, incomplete hidden revision staging directories and uncommitted artwork upload stages. Pending uploads must be staged again after recovery. Unreferenced artwork objects are also excluded; published history is retained in full.

Before committing the backup directory, the utility re-reads and validates every copied file, all revision manifests and hashes, the current pointer, all historical JSON bundles and every artwork object referenced by those revisions. It then renames the completed temporary directory to its versioned final name. Existing backup directories are never overwritten. A damaged file, missing revision or invalid artwork object causes verification to fail.

Backup directories are created with restrictive permissions. Keep the mount restricted to the service/operator account and enable encryption and retention controls at the off-host storage layer. The utility does not encrypt backups itself, upload to a cloud provider, prune old backups or prove that a mount is physically off-host. Those are operator/storage responsibilities. It also does not back up PostgreSQL player/account data, secrets, .env, or the application checkout; database backups require a separate independently tested policy.

## Recovery and rollback are different operations

### Content-level rollback

The authenticated content admin rollback endpoint republishes an earlier content bundle as a **new** revision. It preserves revision history and refuses destructive ID removal. This is the normal correction for an editorial/content publication mistake while the existing application version remains in service.

### Disaster recovery from backup

Use content:restore to verify a backup and copy it into a **new, non-existing** content-root directory. The command never overwrites the current content root. Run it as the API service account (or correct ownership/permissions before the service reads it), inspect the restored current revision, then change MORKAHJA_CONTENT_ROOT in the private environment file to the new directory and restart/reload PM2. Verify /health, /game-data/content, and at least one current and one historical media URL before routing users to the restored service. Keep the previous content root untouched until recovery is accepted.

Do not restore a backup over an active content root, and do not use rsync --delete to restore it. The new-root approach allows the operator to return to the previous path if verification fails.

### Application-code rollback

Application rollback is separate: deploy a previously reviewed application commit/release, reinstall its matching lockfile dependencies, rebuild the client, sync only the static web root and reload PM2. **Do not change MORKAHJA_CONTENT_ROOT or the current content pointer as part of an application rollback.**

Code/content compatibility is not automatically guaranteed across arbitrary historical commits. The rollback target must understand the external content store, the current manifest/artwork format, the public content/media routes and any persisted contentRevision metadata in active encounters/rooms. It must also preserve all JSON fields and IDs used by the current content. A code version predating the revision store or active-gameplay pinning is not an approved rollback target for a live published-content installation. Test the exact application commit against a copy of the intended content backup in staging before using it. If no compatible application release is known, keep the service in maintenance mode rather than silently reverting to Git JSON.

## Verification and release limits

New tests:
- npm run test:content-backup covers versioned backup creation, historical revision retention, managed artwork retention, audit preservation, checksum failure, publication-lock exclusion and fresh-root restore without overwriting.
- npm run test:deployment covers path isolation, overlap, symlink rejection and the mounted-backup-root requirement.

The GitHub Actions release workflow runs both checks. The complete release gate still includes the existing server typecheck and database-dependent tests; the current Phase 7 branch has eight pre-existing TypeScript errors in unrelated test files. The deployment runner therefore fails closed before static sync/PM2 reload until the full release check passes.

Still requiring real-host verification: provisioning and ownership of external paths, remote/off-host backup mount and retention, scheduled backup operations, a full restore rehearsal, PostgreSQL backups, exact old/new application compatibility, actual Nginx syntax and HTTPS requests, PM2 reload/health checks, and production data/artwork parity. No deployment, migration or production publication is authorized by this draft.
