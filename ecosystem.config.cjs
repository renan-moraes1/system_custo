const port = String(process.env.PORT || 3000);

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
