#!/bin/sh
echo "Starting the server"
node ace migration:run --force
echo "Migration done"
node ace db:seed
echo "Seed done"
pm2-runtime start ecosystem.config.js