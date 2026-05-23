/** PM2 config — run from repo root: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'morkahja-api',
      cwd: './server',
      script: 'src/server.ts',
      interpreter: '../node_modules/.bin/tsx',
      env_file: '.env',
    },
  ],
};
