const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.dev.vars');

function readLocalSetting(name) {
  if (!fs.existsSync(envFile)) return undefined;
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`));
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

const requestedPort = Number(process.env.KCA_PORT || process.env.PORT || readLocalSetting('KCA_PORT') || 3000);
const port = String(Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535 ? requestedPort : 3000);
const envFileArgs = fs.existsSync(envFile) ? ['--env-file', envFile] : [];

module.exports = {
  apps: [
    {
      name: 'kca-financeiro',
      cwd: __dirname,
      script: './node_modules/wrangler/bin/wrangler.js',
      args: [
        'dev',
        '--config',
        'dist/server/wrangler.json',
        ...envFileArgs,
        '--persist-to',
        '.wrangler/state',
        '--ip',
        '0.0.0.0',
        '--port',
        port,
      ],
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      min_uptime: '10s',
      max_restarts: 1000,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
