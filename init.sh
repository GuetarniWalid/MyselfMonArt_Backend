#!/bin/sh
node ace migration:run
node ace db:seed
pm2-runtime start ecosystem.config.js