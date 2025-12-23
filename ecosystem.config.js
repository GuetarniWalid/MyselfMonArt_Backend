module.exports = {
  apps: [
    {
      name: 'app',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
    },
    {
      name: 'cron',
      script: 'npm',
      args: 'run cron',
      autorestart: true,
      watch: false,
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
}
