/** PM2 config — run from repo root: npm install && pm2 start ecosystem.config.cjs */
const path = require('node:path');
const fs = require('node:fs');

const repoRoot = __dirname;
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

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
      env_file: path.join(repoRoot, '.env'),
    },
  ],
};
