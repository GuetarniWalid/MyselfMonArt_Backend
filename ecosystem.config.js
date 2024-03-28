module.exports = {
  apps: [
    {
      name: 'app',
      script: 'server.js',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'cron tasks',
      script: 'npm',
      args: 'run cron',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
}
