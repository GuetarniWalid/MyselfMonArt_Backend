module.exports = {
  apps: [
    {
      name: 'app',
      script: 'server.js',
      // 1 instance (et non 'max') : le conteneur app est plafonné à 512 Mo et chaque
      // instance Node pèse ~110 Mo à vide. Avec 2 instances (2 CPU), il ne restait pas
      // assez de marge pour les traitements d'image du juge custom-art -> libvips
      // segfaultait par dépassement mémoire (incident 13/06). Le worker custom-art ne
      // tourne de toute façon que sur une seule instance ; le trafic boutique est faible.
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      // Redémarrage propre avant la limite cgroup (évite un OOM brutal natif)
      max_memory_restart: '460M',
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
