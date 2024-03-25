#!/bin/bash
echo "Starting the server"
node ace migration:run
node ace db:seed
pm2-runtime start ecosystem.config.js