#!/bin/sh
node ace migration:run
pm2-runtime start ecosystem.config.js