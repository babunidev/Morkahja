/** PM2 config — run from repo root:
 *   npm install && pm2 start ecosystem.config.cjs --update-env
 * Loads repo-root `.env` into the app env (PM2 does not apply `env_file` on its own).
 */
const path = require('node:path');
const fs = require('node:fs');

const repoRoot = __dirname;
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
const envFilePath = path.join(repoRoot, '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[morkahja] No .env at ${filePath} — set DATABASE_URL in the environment or create .env on the server.`);
    return {};
  }

  const env = {};

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const withoutExport = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const separator = withoutExport.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, separator).trim();

    if (!key) {
      continue;
    }

    let value = withoutExport.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

if (!fs.existsSync(tsx)) {
  console.error(
    `[morkahja] Missing ${tsx}. From repo root run: npm install`,
  );
}

module.exports = {
  apps: [
    {
      name: 'morkahja-api',
      cwd: path.join(repoRoot, 'server'),
      script: tsx,
      args: 'src/server.ts',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        ...loadEnvFile(envFilePath),
      },
    },
  ],
};
