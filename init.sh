#!/bin/sh

echo "En attente de la base de données..."
while ! nc -z db 3306; do
  sleep 1
done

echo "La base de données est prête!"
node ace migration:run
pm2-runtime start ecosystem.config.js