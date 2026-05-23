/** PM2 config — run from repo root: pm2 start ecosystem.config.cjs */
const path = require('node:path');

const repoRoot = __dirname;
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

module.exports = {
  apps: [
    {
      name: 'morkahja-api',
      cwd: path.join(repoRoot, 'server'),
      script: 'src/server.ts',
      interpreter: tsx,
      env_file: path.join(repoRoot, '.env'),
    },
  ],
};
