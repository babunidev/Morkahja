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

const fileEnv = loadEnvFile(envFilePath);

/**
 * Bot adventurers (server/scripts/bot-adventurers.ts): three always-online
 * players that talk to the API over HTTP like any browser. They get no access
 * to the database or the .env secrets. Set MORKAHJA_BOTS=0 in .env to leave
 * them out.
 */
const botsEnabled = (fileEnv.MORKAHJA_BOTS ?? '1') !== '0';
const botsApp = {
  name: 'morkahja-bots',
  cwd: path.join(repoRoot, 'server'),
  script: tsx,
  args: 'scripts/bot-adventurers.ts',
  interpreter: 'none',
  // Give the API time to come up; back off if it is unreachable.
  restart_delay: 5000,
  exp_backoff_restart_delay: 2000,
  env: {
    NODE_ENV: 'production',
    BOT_ALLOW_PRODUCTION: '1',
    BOT_API: `http://127.0.0.1:${fileEnv.PORT || 3000}`,
  },
};

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
        ...fileEnv,
      },
    },
    ...(botsEnabled ? [botsApp] : []),
  ],
};
