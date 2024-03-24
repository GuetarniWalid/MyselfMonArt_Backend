#!/bin/sh

echo "Waitning database..."
while ! nc -z db 3306; do
  sleep 1
done

echo "Database is ready!"
node ace migration:run
pm2-runtime start ecosystem.config.js